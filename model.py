import random
from pathlib import Path
from typing import Dict, List, Sequence, Tuple

import numpy as np
import torch
import torch.nn as nn
from PIL import Image
from sklearn.metrics import classification_report, confusion_matrix
from torch.utils.data import Dataset
from torchvision import models, transforms


IMAGE_SIZE = 224
VALID_EXTENSIONS = {".jpg", ".jpeg", ".png"}
IMAGENET_MEAN = [0.485, 0.456, 0.406]
IMAGENET_STD = [0.229, 0.224, 0.225]


def set_seed(seed: int = 42) -> None:
    """실험 재현을 위해 가능한 범위에서 랜덤 시드를 고정합니다."""
    random.seed(seed)
    np.random.seed(seed)
    torch.manual_seed(seed)
    torch.cuda.manual_seed_all(seed)
    torch.backends.cudnn.deterministic = True
    torch.backends.cudnn.benchmark = False


def get_device() -> torch.device:
    """Apple Silicon(MPS)을 먼저 사용하고, 없으면 CUDA, CPU 순서로 선택합니다."""
    if torch.backends.mps.is_available():
        return torch.device("mps")
    if torch.cuda.is_available():
        return torch.device("cuda")
    return torch.device("cpu")


def discover_classes(data_dir: str) -> List[str]:
    """dataset_preprocessed 아래 폴더명을 클래스 이름으로 사용합니다."""
    root = Path(data_dir)
    if not root.exists():
        raise FileNotFoundError(f"데이터 폴더를 찾을 수 없습니다: {data_dir}")

    class_names = sorted([path.name for path in root.iterdir() if path.is_dir()])
    if not class_names:
        raise ValueError(f"클래스 폴더가 없습니다: {data_dir}")
    return class_names


def collect_image_samples(data_dir: str) -> Tuple[List[Tuple[str, int]], List[str]]:
    """
    이미지 경로와 label index를 수집합니다.

    - 각 하위 폴더명을 클래스명으로 사용합니다.
    - jpg/jpeg/png만 사용합니다.
    - 캐릭터 대표 이미지로 추정되는 image.png는 학습/평가에서 제외합니다.
    """
    root = Path(data_dir)
    class_names = discover_classes(data_dir)
    class_to_idx = {class_name: idx for idx, class_name in enumerate(class_names)}
    samples: List[Tuple[str, int]] = []

    for class_name in class_names:
        class_dir = root / class_name
        for path in sorted(class_dir.iterdir()):
            if not path.is_file():
                continue
            if path.name.lower() == "image.png":
                continue
            if path.suffix.lower() not in VALID_EXTENSIONS:
                continue
            samples.append((str(path), class_to_idx[class_name]))

    if not samples:
        raise ValueError(f"사용 가능한 이미지가 없습니다: {data_dir}")
    return samples, class_names


def make_relative_samples(samples: Sequence[Tuple[str, int]], data_dir: str) -> List[Tuple[str, int]]:
    """체크포인트에 저장하기 좋도록 이미지 경로를 data_dir 기준 상대 경로로 바꿉니다."""
    root = Path(data_dir).resolve()
    relative_samples = []
    for image_path, label in samples:
        relative_path = Path(image_path).resolve().relative_to(root)
        relative_samples.append((str(relative_path), int(label)))
    return relative_samples


def resolve_relative_samples(samples: Sequence[Tuple[str, int]], data_dir: str) -> List[Tuple[str, int]]:
    """체크포인트에 저장된 상대 경로를 현재 data_dir 기준 실제 경로로 바꿉니다."""
    root = Path(data_dir)
    return [(str(root / relative_path), int(label)) for relative_path, label in samples]


class AnimalCrossingFaceDataset(Dataset):
    """캐릭터별 폴더 구조를 읽는 간단한 PyTorch Dataset입니다."""

    def __init__(self, samples: Sequence[Tuple[str, int]], transform=None):
        self.samples = list(samples)
        self.transform = transform

    def __len__(self) -> int:
        return len(self.samples)

    def __getitem__(self, index: int):
        image_path, label = self.samples[index]

        # RGB로 변환해서 흑백/알파 채널 이미지가 섞여도 모델 입력이 일정하게 유지됩니다.
        image = Image.open(image_path).convert("RGB")

        if self.transform is not None:
            image = self.transform(image)

        return image, label


def get_transforms(train: bool, augmentation: str = "basic") -> transforms.Compose:
    """
    ImageNet 사전학습 모델에 맞는 변환을 반환합니다.

    Resize가 포함되어 있어서 224x224가 아닌 얼굴 이미지도 자동으로 맞춰집니다.
    """
    if train and augmentation == "strong":
        return transforms.Compose(
            [
                transforms.RandomResizedCrop(IMAGE_SIZE, scale=(0.75, 1.0), ratio=(0.9, 1.1)),
                transforms.RandomHorizontalFlip(p=0.5),
                transforms.RandomAffine(
                    degrees=12,
                    translate=(0.04, 0.04),
                    scale=(0.90, 1.10),
                ),
                transforms.ColorJitter(
                    brightness=0.20,
                    contrast=0.20,
                    saturation=0.15,
                    hue=0.03,
                ),
                transforms.RandomGrayscale(p=0.05),
                transforms.ToTensor(),
                transforms.Normalize(mean=IMAGENET_MEAN, std=IMAGENET_STD),
                transforms.RandomErasing(p=0.12, scale=(0.02, 0.10), ratio=(0.3, 3.3)),
            ]
        )

    if train:
        return transforms.Compose(
            [
                transforms.Resize((IMAGE_SIZE, IMAGE_SIZE)),
                transforms.RandomHorizontalFlip(p=0.5),
                transforms.RandomRotation(degrees=10),
                transforms.ColorJitter(
                    brightness=0.15,
                    contrast=0.15,
                    saturation=0.10,
                    hue=0.02,
                ),
                transforms.ToTensor(),
                transforms.Normalize(mean=IMAGENET_MEAN, std=IMAGENET_STD),
            ]
        )

    return transforms.Compose(
        [
            transforms.Resize((IMAGE_SIZE, IMAGE_SIZE)),
            transforms.ToTensor(),
            transforms.Normalize(mean=IMAGENET_MEAN, std=IMAGENET_STD),
        ]
    )


def build_model(num_classes: int, model_name: str = "resnet18", pretrained: bool = True) -> nn.Module:
    """전이학습용 이미지 분류 모델을 생성합니다."""
    model_name = model_name.lower()

    if model_name == "resnet18":
        weights = models.ResNet18_Weights.DEFAULT if pretrained else None
        model = models.resnet18(weights=weights)
        model.fc = nn.Linear(model.fc.in_features, num_classes)
        return model

    if model_name == "resnet34":
        weights = models.ResNet34_Weights.DEFAULT if pretrained else None
        model = models.resnet34(weights=weights)
        model.fc = nn.Linear(model.fc.in_features, num_classes)
        return model

    if model_name == "resnet50":
        weights = models.ResNet50_Weights.DEFAULT if pretrained else None
        model = models.resnet50(weights=weights)
        model.fc = nn.Linear(model.fc.in_features, num_classes)
        return model

    if model_name == "efficientnet_b0":
        weights = models.EfficientNet_B0_Weights.DEFAULT if pretrained else None
        model = models.efficientnet_b0(weights=weights)
        model.classifier[1] = nn.Linear(model.classifier[1].in_features, num_classes)
        return model

    if model_name == "efficientnet_b1":
        weights = models.EfficientNet_B1_Weights.DEFAULT if pretrained else None
        model = models.efficientnet_b1(weights=weights)
        model.classifier[1] = nn.Linear(model.classifier[1].in_features, num_classes)
        return model

    if model_name == "efficientnet_b2":
        weights = models.EfficientNet_B2_Weights.DEFAULT if pretrained else None
        model = models.efficientnet_b2(weights=weights)
        model.classifier[1] = nn.Linear(model.classifier[1].in_features, num_classes)
        return model

    if model_name == "mobilenet_v3_small":
        weights = models.MobileNet_V3_Small_Weights.DEFAULT if pretrained else None
        model = models.mobilenet_v3_small(weights=weights)
        model.classifier[3] = nn.Linear(model.classifier[3].in_features, num_classes)
        return model

    if model_name == "mobilenet_v3_large":
        weights = models.MobileNet_V3_Large_Weights.DEFAULT if pretrained else None
        model = models.mobilenet_v3_large(weights=weights)
        model.classifier[3] = nn.Linear(model.classifier[3].in_features, num_classes)
        return model

    if model_name == "convnext_tiny":
        weights = models.ConvNeXt_Tiny_Weights.DEFAULT if pretrained else None
        model = models.convnext_tiny(weights=weights)
        model.classifier[2] = nn.Linear(model.classifier[2].in_features, num_classes)
        return model

    if model_name == "regnet_y_400mf":
        weights = models.RegNet_Y_400MF_Weights.DEFAULT if pretrained else None
        model = models.regnet_y_400mf(weights=weights)
        model.fc = nn.Linear(model.fc.in_features, num_classes)
        return model

    raise ValueError(
        "지원하지 않는 모델입니다. resnet18, resnet34, resnet50, efficientnet_b0, "
        "efficientnet_b1, efficientnet_b2, mobilenet_v3_small, mobilenet_v3_large, "
        "convnext_tiny, regnet_y_400mf 중 하나를 사용하세요."
    )


def get_class_counts(samples: Sequence[Tuple[str, int]], num_classes: int) -> np.ndarray:
    """클래스별 이미지 개수를 계산합니다."""
    counts = np.zeros(num_classes, dtype=np.int64)
    for _, label in samples:
        counts[label] += 1
    return counts


def get_class_weights(samples: Sequence[Tuple[str, int]], num_classes: int) -> torch.Tensor:
    """
    class imbalance 완화를 위한 loss weight를 계산합니다.

    샘플 수가 적은 클래스에 더 큰 가중치를 줍니다.
    """
    counts = get_class_counts(samples, num_classes)
    counts = np.maximum(counts, 1)
    weights = len(samples) / (num_classes * counts)
    return torch.tensor(weights, dtype=torch.float32)


def format_confusion_matrix(matrix: np.ndarray, class_names: Sequence[str]) -> str:
    """터미널에서 보기 쉬운 confusion matrix 문자열을 만듭니다."""
    name_width = max(8, max(len(name) for name in class_names))
    cell_width = max(5, len(str(matrix.max())) + 1)
    header = " " * (name_width + 2) + "".join(name[:cell_width].rjust(cell_width) for name in class_names)
    rows = [header]
    for class_name, row in zip(class_names, matrix):
        values = "".join(str(value).rjust(cell_width) for value in row)
        rows.append(class_name.rjust(name_width) + "  " + values)
    return "\n".join(rows)


def calculate_class_accuracy(matrix: np.ndarray, class_names: Sequence[str]) -> Dict[str, float]:
    """Confusion matrix에서 클래스별 accuracy를 계산합니다."""
    result: Dict[str, float] = {}
    for idx, class_name in enumerate(class_names):
        total = matrix[idx].sum()
        result[class_name] = float(matrix[idx, idx] / total) if total > 0 else 0.0
    return result


def build_classification_outputs(
    y_true: Sequence[int], y_pred: Sequence[int], class_names: Sequence[str]
) -> Tuple[np.ndarray, str, Dict[str, float]]:
    """Confusion matrix, classification report, 클래스별 accuracy를 함께 계산합니다."""
    labels = list(range(len(class_names)))
    matrix = confusion_matrix(y_true, y_pred, labels=labels)
    report = classification_report(
        y_true,
        y_pred,
        labels=labels,
        target_names=list(class_names),
        digits=4,
        zero_division=0,
    )
    class_accuracy = calculate_class_accuracy(matrix, class_names)
    return matrix, report, class_accuracy
