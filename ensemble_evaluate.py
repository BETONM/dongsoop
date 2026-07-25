import argparse
import os
from pathlib import Path
from typing import List, Sequence

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
    format_confusion_matrix,
    get_device,
    get_transforms,
    resolve_relative_samples,
    set_seed,
)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Evaluate an ensemble of saved classifiers")
    parser.add_argument("--data_dir", type=str, default="dataset_final_10class", help="데이터 폴더")
    parser.add_argument("--model_paths", nargs="+", required=True, help="앙상블할 모델 checkpoint 경로들")
    parser.add_argument("--batch_size", type=int, default=32, help="batch size")
    parser.add_argument("--num_workers", type=int, default=0, help="DataLoader worker 수")
    parser.add_argument("--seed", type=int, default=42, help="랜덤 시드")
    parser.add_argument(
        "--weights",
        type=str,
        default="",
        help="모델별 가중치. 예: 1,1,0.7 비워두면 동일 가중치",
    )
    parser.add_argument(
        "--tta",
        action="store_true",
        help="원본 이미지와 좌우반전 이미지를 함께 예측해서 평균냅니다.",
    )
    parser.add_argument(
        "--output_dir",
        type=str,
        default="models/ensemble",
        help="앙상블 평가 결과 저장 폴더",
    )
    parser.add_argument(
        "--cache_dir",
        type=str,
        default="models/ensemble/prob_cache",
        help="모델별 예측 확률 캐시 폴더. 여러 조합을 빠르게 비교할 때 사용합니다.",
    )
    return parser.parse_args()


def parse_weights(weights_text: str, model_count: int) -> np.ndarray:
    """CLI로 받은 모델별 가중치를 numpy array로 바꿉니다."""
    if not weights_text:
        return np.ones(model_count, dtype=np.float32) / model_count

    weights = np.array([float(value.strip()) for value in weights_text.split(",")], dtype=np.float32)
    if len(weights) != model_count:
        raise ValueError(f"weights 개수({len(weights)})와 model_paths 개수({model_count})가 다릅니다.")
    if weights.sum() <= 0:
        raise ValueError("weights 합은 0보다 커야 합니다.")
    return weights / weights.sum()


def save_confusion_matrix_csv(matrix: np.ndarray, class_names: Sequence[str], output_path: Path) -> None:
    """confusion matrix를 CSV로 저장합니다."""
    lines = ["," + ",".join(class_names)]
    for class_name, row in zip(class_names, matrix):
        lines.append(class_name + "," + ",".join(str(int(value)) for value in row))
    output_path.write_text("\n".join(lines), encoding="utf-8")


def save_confusion_matrix_png(matrix: np.ndarray, class_names: Sequence[str], output_path: Path) -> None:
    """confusion matrix를 이미지 파일로 저장합니다."""
    plt.figure(figsize=(10, 8))
    plt.imshow(matrix, interpolation="nearest", cmap="Blues")
    plt.title("Ensemble Confusion Matrix")
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


@torch.no_grad()
def predict_probabilities(
    checkpoint_path: Path,
    loader: DataLoader,
    class_names: Sequence[str],
    device: torch.device,
    use_tta: bool,
) -> np.ndarray:
    """한 모델의 validation 예측 확률을 반환합니다."""
    checkpoint = torch.load(checkpoint_path, map_location=device)

    if checkpoint["class_names"] != list(class_names):
        raise ValueError(
            f"클래스 이름이 다릅니다: {checkpoint_path}\n"
            f"expected: {class_names}\n"
            f"actual: {checkpoint['class_names']}"
        )

    model_name = checkpoint.get("model_name", "resnet18")
    model = build_model(
        num_classes=len(class_names),
        model_name=model_name,
        pretrained=False,
    ).to(device)
    model.load_state_dict(checkpoint["model_state_dict"])
    model.eval()

    chunks: List[np.ndarray] = []
    for images, _ in tqdm(loader, desc=f"Predict {checkpoint_path.parent.name}", leave=False):
        images = images.to(device)
        probs = torch.softmax(model(images), dim=1)

        # 얼굴 좌우 반전도 같은 사람으로 볼 수 있으므로, TTA로 예측 안정성을 조금 올릴 수 있습니다.
        if use_tta:
            flipped_images = torch.flip(images, dims=[3])
            flipped_probs = torch.softmax(model(flipped_images), dim=1)
            probs = (probs + flipped_probs) / 2

        chunks.append(probs.cpu().numpy())

    del model
    if device.type == "mps":
        torch.mps.empty_cache()
    elif device.type == "cuda":
        torch.cuda.empty_cache()

    return np.concatenate(chunks, axis=0)


def cache_name_for(checkpoint_path: Path, use_tta: bool) -> str:
    """checkpoint 경로를 캐시 파일명으로 바꿉니다."""
    safe_name = "__".join(checkpoint_path.with_suffix("").parts[-3:])
    tta_suffix = "tta" if use_tta else "plain"
    return f"{safe_name}__{tta_suffix}.npy"


def main() -> None:
    args = parse_args()
    set_seed(args.seed)

    model_paths = [Path(path) for path in args.model_paths]
    for model_path in model_paths:
        if not model_path.exists():
            raise FileNotFoundError(f"모델 파일을 찾을 수 없습니다: {model_path}")

    weights = parse_weights(args.weights, len(model_paths))
    device = get_device()

    # 첫 번째 checkpoint의 validation split을 기준으로 모두 같은 데이터에서 평가합니다.
    first_checkpoint = torch.load(model_paths[0], map_location=device)
    class_names = first_checkpoint["class_names"]
    samples = resolve_relative_samples(first_checkpoint["val_samples"], args.data_dir)

    dataset = AnimalCrossingFaceDataset(samples, transform=get_transforms(train=False))
    loader = DataLoader(
        dataset,
        batch_size=args.batch_size,
        shuffle=False,
        num_workers=args.num_workers,
        pin_memory=torch.cuda.is_available(),
    )
    y_true = np.array([label for _, label in samples], dtype=np.int64)
    cache_dir = Path(args.cache_dir)
    cache_dir.mkdir(parents=True, exist_ok=True)

    ensemble_probs = np.zeros((len(samples), len(class_names)), dtype=np.float32)
    for weight, model_path in zip(weights, model_paths):
        print(f"Loading: {model_path} | weight={weight:.4f}")
        cache_path = cache_dir / cache_name_for(model_path, args.tta)
        if cache_path.exists():
            probs = np.load(cache_path)
            print(f"Using cached probabilities: {cache_path}")
        else:
            probs = predict_probabilities(model_path, loader, class_names, device, args.tta)
            np.save(cache_path, probs)
            print(f"Saved cached probabilities: {cache_path}")

        if probs.shape != ensemble_probs.shape:
            raise ValueError(
                f"캐시/예측 확률 shape이 다릅니다: {cache_path}\n"
                f"expected: {ensemble_probs.shape}\n"
                f"actual: {probs.shape}"
            )
        ensemble_probs += weight * probs

    y_pred = ensemble_probs.argmax(axis=1)
    accuracy = float((y_pred == y_true).mean())
    matrix, report, class_accuracy = build_classification_outputs(y_true.tolist(), y_pred.tolist(), class_names)

    output_dir = Path(args.output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)
    matrix_csv_path = output_dir / "confusion_matrix.csv"
    matrix_png_path = output_dir / "confusion_matrix.png"
    report_path = output_dir / "classification_report.txt"
    save_confusion_matrix_csv(matrix, class_names, matrix_csv_path)
    save_confusion_matrix_png(matrix, class_names, matrix_png_path)
    report_path.write_text(report, encoding="utf-8")

    print(f"\nDevice: {device}")
    print(f"Images: {len(samples)}")
    print(f"TTA: {args.tta}")
    print(f"Ensemble Accuracy: {accuracy:.4f} ({accuracy * 100:.2f}%)")
    print("\nConfusion Matrix:")
    print(format_confusion_matrix(matrix, class_names))
    print("\nClassification Report:")
    print(report)
    print("Class Accuracy:")
    for class_name, class_acc in class_accuracy.items():
        print(f"- {class_name}: {class_acc:.4f} ({class_acc * 100:.2f}%)")
    print(f"\nOutput dir: {output_dir}")
    print(f"Confusion matrix CSV: {matrix_csv_path}")
    print(f"Confusion matrix PNG: {matrix_png_path}")
    print(f"Classification report: {report_path}")
    print(f"Class names: {class_names}")


if __name__ == "__main__":
    main()
