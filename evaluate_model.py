import argparse
import os
from pathlib import Path
from typing import List, Tuple

os.environ.setdefault("MPLCONFIGDIR", str(Path(".cache/matplotlib").resolve()))
os.environ.setdefault("TORCH_HOME", str(Path(".cache/torch").resolve()))

import matplotlib.pyplot as plt
import numpy as np
import torch
from torch.utils.data import DataLoader
from tqdm import tqdm

from model import (
    AnimalCrossingFaceDataset,
    build_classification_outputs,
    build_model,
    collect_image_samples,
    format_confusion_matrix,
    get_device,
    get_transforms,
    resolve_relative_samples,
    set_seed,
)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Animal Crossing character face classifier evaluation")
    parser.add_argument("--data_dir", type=str, default="dataset_preprocessed", help="평가 데이터 폴더")
    parser.add_argument("--model_path", type=str, default="models/best_model.pth", help="학습된 모델 경로")
    parser.add_argument("--batch_size", type=int, default=32, help="batch size")
    parser.add_argument("--num_workers", type=int, default=0, help="DataLoader worker 수")
    parser.add_argument("--seed", type=int, default=42, help="랜덤 시드")
    parser.add_argument(
        "--evaluate_all",
        action="store_true",
        help="체크포인트에 저장된 validation split 대신 전체 데이터로 평가합니다.",
    )
    return parser.parse_args()


@torch.no_grad()
def predict(model: torch.nn.Module, loader: DataLoader, device: torch.device) -> Tuple[List[int], List[int]]:
    model.eval()
    y_true: List[int] = []
    y_pred: List[int] = []

    for images, labels in tqdm(loader, desc="Evaluate"):
        images = images.to(device)
        labels = labels.to(device)

        outputs = model(images)
        preds = outputs.argmax(dim=1)

        y_true.extend(labels.cpu().tolist())
        y_pred.extend(preds.cpu().tolist())

    return y_true, y_pred


def save_confusion_matrix_csv(matrix: np.ndarray, class_names: List[str], output_path: Path) -> None:
    """confusion matrix를 CSV로 저장합니다."""
    lines = ["," + ",".join(class_names)]
    for class_name, row in zip(class_names, matrix):
        lines.append(class_name + "," + ",".join(str(int(value)) for value in row))
    output_path.write_text("\n".join(lines), encoding="utf-8")


def save_confusion_matrix_png(matrix: np.ndarray, class_names: List[str], output_path: Path) -> None:
    """confusion matrix를 이미지 파일로 저장합니다."""
    plt.figure(figsize=(10, 8))
    plt.imshow(matrix, interpolation="nearest", cmap="Blues")
    plt.title("Confusion Matrix")
    plt.colorbar()

    tick_marks = np.arange(len(class_names))
    plt.xticks(tick_marks, class_names, rotation=45, ha="right")
    plt.yticks(tick_marks, class_names)

    threshold = matrix.max() / 2 if matrix.max() > 0 else 0
    for row_idx in range(matrix.shape[0]):
        for col_idx in range(matrix.shape[1]):
            value = int(matrix[row_idx, col_idx])
            color = "white" if value > threshold else "black"
            plt.text(col_idx, row_idx, value, ha="center", va="center", color=color)

    plt.ylabel("True Label")
    plt.xlabel("Predicted Label")
    plt.tight_layout()
    plt.savefig(output_path, dpi=150)
    plt.close()


def main() -> None:
    args = parse_args()
    set_seed(args.seed)

    model_path = Path(args.model_path)
    if not model_path.exists():
        raise FileNotFoundError(f"모델 파일을 찾을 수 없습니다: {model_path}")

    device = get_device()
    checkpoint = torch.load(model_path, map_location=device)
    class_names = checkpoint["class_names"]
    model_name = checkpoint.get("model_name", "resnet18")
    num_classes = len(class_names)

    if args.evaluate_all or "val_samples" not in checkpoint:
        samples, discovered_class_names = collect_image_samples(args.data_dir)
        if discovered_class_names != class_names:
            raise ValueError(
                "체크포인트의 클래스 이름과 현재 data_dir의 클래스 이름이 다릅니다.\n"
                f"checkpoint: {class_names}\n"
                f"data_dir: {discovered_class_names}"
            )
        evaluation_name = "all data"
    else:
        samples = resolve_relative_samples(checkpoint["val_samples"], args.data_dir)
        evaluation_name = "saved validation split"

    dataset = AnimalCrossingFaceDataset(samples, transform=get_transforms(train=False))
    loader = DataLoader(
        dataset,
        batch_size=args.batch_size,
        shuffle=False,
        num_workers=args.num_workers,
        pin_memory=torch.cuda.is_available(),
    )

    # 평가 시에는 이미 저장된 가중치를 불러오므로 pretrained=False로 모델 구조만 생성합니다.
    model = build_model(num_classes=num_classes, model_name=model_name, pretrained=False).to(device)
    model.load_state_dict(checkpoint["model_state_dict"])

    y_true, y_pred = predict(model, loader, device)
    accuracy = sum(int(t == p) for t, p in zip(y_true, y_pred)) / len(y_true)
    matrix, report, class_accuracy = build_classification_outputs(y_true, y_pred, class_names)

    output_dir = model_path.parent
    matrix_csv_path = output_dir / "evaluation_confusion_matrix.csv"
    matrix_png_path = output_dir / "evaluation_confusion_matrix.png"
    report_path = output_dir / "evaluation_classification_report.txt"
    save_confusion_matrix_csv(matrix, class_names, matrix_csv_path)
    save_confusion_matrix_png(matrix, class_names, matrix_png_path)
    report_path.write_text(report, encoding="utf-8")

    print(f"Device: {device}")
    print(f"Evaluation target: {evaluation_name}")
    print(f"Images: {len(samples)}")
    print(f"Accuracy: {accuracy:.4f} ({accuracy * 100:.2f}%)")
    print(f"Checkpoint Best Validation Accuracy: {checkpoint.get('best_val_acc', 'N/A')}")
    print("\nConfusion Matrix:")
    print(format_confusion_matrix(matrix, class_names))
    print("\nClassification Report:")
    print(report)
    print("Class Accuracy:")
    for class_name, class_acc in class_accuracy.items():
        print(f"- {class_name}: {class_acc:.4f} ({class_acc * 100:.2f}%)")
    print(f"\nModel path: {model_path}")
    print(f"Confusion matrix CSV: {matrix_csv_path}")
    print(f"Confusion matrix PNG: {matrix_png_path}")
    print(f"Classification report: {report_path}")
    print(f"Class names: {class_names}")


if __name__ == "__main__":
    main()
