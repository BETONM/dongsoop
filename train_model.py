import argparse
import json
import os
from pathlib import Path
from typing import Dict, List, Tuple

os.environ.setdefault("MPLCONFIGDIR", str(Path(".cache/matplotlib").resolve()))
os.environ.setdefault("TORCH_HOME", str(Path(".cache/torch").resolve()))

import matplotlib.pyplot as plt
import numpy as np
import torch
import torch.nn as nn
import torch.optim as optim
from sklearn.model_selection import train_test_split
from torch.utils.data import DataLoader
from tqdm import tqdm

from model import (
    AnimalCrossingFaceDataset,
    build_classification_outputs,
    build_model,
    collect_image_samples,
    format_confusion_matrix,
    get_class_counts,
    get_class_weights,
    get_device,
    get_transforms,
    make_relative_samples,
    set_seed,
)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Animal Crossing character face classifier training")
    parser.add_argument("--data_dir", type=str, default="dataset_preprocessed", help="학습 데이터 폴더")
    parser.add_argument("--epochs", type=int, default=30, help="최대 epoch 수")
    parser.add_argument("--batch_size", type=int, default=32, help="batch size")
    parser.add_argument("--lr", type=float, default=1e-4, help="learning rate")
    parser.add_argument("--weight_decay", type=float, default=1e-4, help="AdamW weight decay")
    parser.add_argument("--val_ratio", type=float, default=0.2, help="validation 비율")
    parser.add_argument("--patience", type=int, default=7, help="early stopping patience")
    parser.add_argument("--seed", type=int, default=42, help="랜덤 시드")
    parser.add_argument(
        "--model_name",
        type=str,
        default="resnet18",
        choices=[
            "resnet18",
            "resnet34",
            "resnet50",
            "efficientnet_b0",
            "efficientnet_b1",
            "efficientnet_b2",
            "mobilenet_v3_small",
            "mobilenet_v3_large",
            "convnext_tiny",
            "regnet_y_400mf",
        ],
        help="전이학습에 사용할 모델",
    )
    parser.add_argument(
        "--augmentation",
        type=str,
        default="basic",
        choices=["basic", "strong"],
        help="data augmentation 강도",
    )
    parser.add_argument(
        "--label_smoothing",
        type=float,
        default=0.0,
        help="CrossEntropyLoss label smoothing 값",
    )
    parser.add_argument(
        "--class_weight_power",
        type=float,
        default=1.0,
        help=(
            "class imbalance 보정 강도입니다. 1.0은 기존 class weight, "
            "0.5는 완화, 0.0은 class weight를 끕니다."
        ),
    )
    parser.add_argument(
        "--no_pretrained",
        action="store_true",
        help="ImageNet 사전학습 가중치를 쓰지 않습니다. 인터넷이 안 될 때 사용할 수 있습니다.",
    )
    parser.add_argument("--num_workers", type=int, default=0, help="DataLoader worker 수")
    parser.add_argument("--model_path", type=str, default="models/best_model.pth", help="best 모델 저장 경로")
    return parser.parse_args()


def train_one_epoch(
    model: nn.Module,
    loader: DataLoader,
    criterion: nn.Module,
    optimizer: optim.Optimizer,
    device: torch.device,
) -> Tuple[float, float]:
    model.train()
    running_loss = 0.0
    correct = 0
    total = 0

    for images, labels in tqdm(loader, desc="Train", leave=False):
        images = images.to(device)
        labels = labels.to(device)

        optimizer.zero_grad()
        outputs = model(images)
        loss = criterion(outputs, labels)
        loss.backward()
        optimizer.step()

        batch_size = labels.size(0)
        running_loss += loss.item() * batch_size
        preds = outputs.argmax(dim=1)
        correct += (preds == labels).sum().item()
        total += batch_size

    return running_loss / total, correct / total


@torch.no_grad()
def evaluate(
    model: nn.Module,
    loader: DataLoader,
    criterion: nn.Module,
    device: torch.device,
) -> Tuple[float, float, List[int], List[int]]:
    model.eval()
    running_loss = 0.0
    correct = 0
    total = 0
    y_true: List[int] = []
    y_pred: List[int] = []

    for images, labels in tqdm(loader, desc="Valid", leave=False):
        images = images.to(device)
        labels = labels.to(device)

        outputs = model(images)
        loss = criterion(outputs, labels)
        preds = outputs.argmax(dim=1)

        batch_size = labels.size(0)
        running_loss += loss.item() * batch_size
        correct += (preds == labels).sum().item()
        total += batch_size

        y_true.extend(labels.cpu().tolist())
        y_pred.extend(preds.cpu().tolist())

    return running_loss / total, correct / total, y_true, y_pred


def save_training_curves(history: Dict[str, List[float]], output_path: Path) -> None:
    """loss/accuracy 학습 곡선을 PNG로 저장합니다."""
    epochs = range(1, len(history["train_loss"]) + 1)

    plt.figure(figsize=(10, 4))
    plt.subplot(1, 2, 1)
    plt.plot(epochs, history["train_loss"], label="Train Loss")
    plt.plot(epochs, history["val_loss"], label="Validation Loss")
    plt.xlabel("Epoch")
    plt.ylabel("Loss")
    plt.legend()
    plt.grid(alpha=0.3)

    plt.subplot(1, 2, 2)
    plt.plot(epochs, history["train_acc"], label="Train Accuracy")
    plt.plot(epochs, history["val_acc"], label="Validation Accuracy")
    plt.xlabel("Epoch")
    plt.ylabel("Accuracy")
    plt.legend()
    plt.grid(alpha=0.3)

    plt.tight_layout()
    plt.savefig(output_path, dpi=150)
    plt.close()


def save_confusion_matrix_csv(matrix: np.ndarray, class_names: List[str], output_path: Path) -> None:
    """confusion matrix를 CSV로 저장합니다."""
    lines = ["," + ",".join(class_names)]
    for class_name, row in zip(class_names, matrix):
        lines.append(class_name + "," + ",".join(str(int(value)) for value in row))
    output_path.write_text("\n".join(lines), encoding="utf-8")


def save_confusion_matrix_png(matrix: np.ndarray, class_names: List[str], output_path: Path) -> None:
    """confusion matrix를 이미지 파일로 저장해서 발표/보고서에 바로 사용할 수 있게 합니다."""
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
    output_dir = model_path.parent
    output_dir.mkdir(parents=True, exist_ok=True)

    samples, class_names = collect_image_samples(args.data_dir)
    labels = [label for _, label in samples]
    num_classes = len(class_names)

    train_samples, val_samples = train_test_split(
        samples,
        test_size=args.val_ratio,
        random_state=args.seed,
        stratify=labels,
    )

    print(f"Device: {get_device()}")
    print(f"Total images: {len(samples)}")
    print(f"Train images: {len(train_samples)}")
    print(f"Validation images: {len(val_samples)}")
    print(f"Classes: {class_names}")
    print("Class counts:", dict(zip(class_names, get_class_counts(samples, num_classes).tolist())))

    train_dataset = AnimalCrossingFaceDataset(
        train_samples,
        transform=get_transforms(train=True, augmentation=args.augmentation),
    )
    val_dataset = AnimalCrossingFaceDataset(val_samples, transform=get_transforms(train=False))

    train_loader = DataLoader(
        train_dataset,
        batch_size=args.batch_size,
        shuffle=True,
        num_workers=args.num_workers,
        pin_memory=torch.cuda.is_available(),
    )
    val_loader = DataLoader(
        val_dataset,
        batch_size=args.batch_size,
        shuffle=False,
        num_workers=args.num_workers,
        pin_memory=torch.cuda.is_available(),
    )

    device = get_device()
    model = build_model(
        num_classes=num_classes,
        model_name=args.model_name,
        pretrained=not args.no_pretrained,
    ).to(device)

    # 클래스 불균형을 완화하기 위해 train split 기준 class weight를 CrossEntropyLoss에 적용합니다.
    # 데이터가 매우 불균형할 때는 class_weight_power를 낮춰 전체 accuracy와 class별 균형 사이를 조절합니다.
    class_weights = get_class_weights(train_samples, num_classes).pow(args.class_weight_power).to(device)
    criterion = nn.CrossEntropyLoss(weight=class_weights, label_smoothing=args.label_smoothing)
    optimizer = optim.AdamW(model.parameters(), lr=args.lr, weight_decay=args.weight_decay)
    scheduler = optim.lr_scheduler.ReduceLROnPlateau(
        optimizer,
        mode="max",
        factor=0.5,
        patience=2,
    )

    best_val_acc = 0.0
    best_epoch = 0
    epochs_without_improvement = 0
    history: Dict[str, List[float]] = {
        "train_loss": [],
        "train_acc": [],
        "val_loss": [],
        "val_acc": [],
        "lr": [],
    }

    for epoch in range(1, args.epochs + 1):
        train_loss, train_acc = train_one_epoch(model, train_loader, criterion, optimizer, device)
        val_loss, val_acc, y_true, y_pred = evaluate(model, val_loader, criterion, device)
        current_lr = optimizer.param_groups[0]["lr"]
        scheduler.step(val_acc)

        history["train_loss"].append(train_loss)
        history["train_acc"].append(train_acc)
        history["val_loss"].append(val_loss)
        history["val_acc"].append(val_acc)
        history["lr"].append(current_lr)

        print(
            f"Epoch {epoch:03d}/{args.epochs:03d} | "
            f"Train Loss: {train_loss:.4f} | Train Accuracy: {train_acc:.4f} | "
            f"Validation Loss: {val_loss:.4f} | Validation Accuracy: {val_acc:.4f} | "
            f"Learning Rate: {current_lr:.6f}"
        )

        if val_acc > best_val_acc:
            best_val_acc = val_acc
            best_epoch = epoch
            epochs_without_improvement = 0

            torch.save(
                {
                    "model_state_dict": model.state_dict(),
                    "model_name": args.model_name,
                    "num_classes": num_classes,
                    "class_names": class_names,
                    "best_val_acc": best_val_acc,
                    "best_epoch": best_epoch,
                    "seed": args.seed,
                    "val_ratio": args.val_ratio,
                    "augmentation": args.augmentation,
                    "label_smoothing": args.label_smoothing,
                    "class_weight_power": args.class_weight_power,
                    "val_samples": make_relative_samples(val_samples, args.data_dir),
                    "history": history,
                },
                model_path,
            )
            print(f"Best model saved: {model_path}")
        else:
            epochs_without_improvement += 1

        if epochs_without_improvement >= args.patience:
            print(f"Early stopping: {args.patience} epochs 동안 validation accuracy가 개선되지 않았습니다.")
            break

    # 마지막으로 best checkpoint를 다시 불러와서 best validation 결과를 정확히 출력합니다.
    checkpoint = torch.load(model_path, map_location=device)
    model.load_state_dict(checkpoint["model_state_dict"])
    val_loss, val_acc, y_true, y_pred = evaluate(model, val_loader, criterion, device)
    matrix, report, class_accuracy = build_classification_outputs(y_true, y_pred, class_names)

    history_path = output_dir / "training_history.json"
    curves_path = output_dir / "training_curves.png"
    matrix_csv_path = output_dir / "confusion_matrix.csv"
    matrix_png_path = output_dir / "confusion_matrix.png"
    report_path = output_dir / "classification_report.txt"

    history_path.write_text(json.dumps(history, indent=2), encoding="utf-8")
    save_training_curves(history, curves_path)
    save_confusion_matrix_csv(matrix, class_names, matrix_csv_path)
    save_confusion_matrix_png(matrix, class_names, matrix_png_path)
    report_path.write_text(report, encoding="utf-8")

    print("\nTraining finished")
    print(f"Best Validation Accuracy: {best_val_acc:.4f} ({best_val_acc * 100:.2f}%)")
    print(f"Best Epoch: {best_epoch}")
    print("\nConfusion Matrix:")
    print(format_confusion_matrix(matrix, class_names))
    print("\nClassification Report:")
    print(report)
    print("Class Accuracy:")
    for class_name, accuracy in class_accuracy.items():
        print(f"- {class_name}: {accuracy:.4f} ({accuracy * 100:.2f}%)")
    print(f"\nSaved model path: {model_path}")
    print(f"Training curves: {curves_path}")
    print(f"Confusion matrix CSV: {matrix_csv_path}")
    print(f"Confusion matrix PNG: {matrix_png_path}")
    print(f"Classification report: {report_path}")
    print(f"Class names: {class_names}")


if __name__ == "__main__":
    main()
