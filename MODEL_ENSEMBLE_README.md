# Ahin Model Ensemble

동물의 숲 캐릭터 얼굴 분류 모델 학습/평가 코드입니다.

이 브랜치에는 모델 학습 코드와 앙상블 평가 코드만 포함합니다. 데이터셋과 `.pth` 가중치 파일은 용량이 커서 GitHub 커밋에서 제외했습니다.

## 포함 파일

- `model.py`: 데이터 로딩, transform, 모델 생성, metric helper
- `train_model.py`: 단일 모델 학습 코드
- `evaluate_model.py`: 단일 모델 평가 코드
- `ensemble_evaluate.py`: 여러 checkpoint 앙상블 평가 코드

## 최고 성능 요약

- 데이터셋: `dataset_final_12class_mixed`
- 검증 이미지 수: 213장
- 방식: TTA 적용 weighted ensemble
- 최종 Accuracy: 50.70%
- 결과 폴더: `models/ensemble/final12_mixed_best_tta_5070`

## 앙상블 구성

최고 성능 조합은 아래 5개 모델의 softmax probability를 weighted average한 방식입니다.

| 모델 | 가중치 |
| --- | ---: |
| `final12_mixed_convnext_tiny_no_weights/best_model.pth` | 0.45 |
| `final12_mixed_efficientnet_b1_no_weights/best_model.pth` | 0.30 |
| `final12_mixed_convnext_tiny_strong_ls01_no_weights/best_model.pth` | 0.05 |
| `final12_mixed_efficientnet_b1/best_model.pth` | 0.05 |
| `final12_mixed_convnext_tiny_strong_ls01/best_model.pth` | 0.15 |

TTA는 원본 이미지와 좌우 반전 이미지를 함께 예측한 뒤 평균내는 방식입니다.

## 앙상블 평가 실행

아래 checkpoint들이 준비되어 있을 때 실행합니다.

```bash
python ensemble_evaluate.py \
  --data_dir dataset_final_12class_mixed \
  --tta \
  --weights 0.45,0.30,0.05,0.05,0.15 \
  --output_dir models/ensemble/final12_mixed_best_tta_5070 \
  --model_paths \
    models/final12_mixed_convnext_tiny_no_weights/best_model.pth \
    models/final12_mixed_efficientnet_b1_no_weights/best_model.pth \
    models/final12_mixed_convnext_tiny_strong_ls01_no_weights/best_model.pth \
    models/final12_mixed_efficientnet_b1/best_model.pth \
    models/final12_mixed_convnext_tiny_strong_ls01/best_model.pth
```

## 단일 모델 학습 예시

```bash
python train_model.py \
  --data_dir dataset_final_12class_mixed \
  --model_name convnext_tiny \
  --augmentation basic \
  --class_weight_power 0.0 \
  --label_smoothing 0.0 \
  --epochs 30 \
  --batch_size 32 \
  --model_path models/final12_mixed_convnext_tiny_no_weights/best_model.pth
```

```bash
python train_model.py \
  --data_dir dataset_final_12class_mixed \
  --model_name efficientnet_b1 \
  --augmentation basic \
  --class_weight_power 0.0 \
  --label_smoothing 0.0 \
  --epochs 30 \
  --batch_size 32 \
  --model_path models/final12_mixed_efficientnet_b1_no_weights/best_model.pth
```

## 결과

Classification report 기준 최종 정확도입니다.

```text
accuracy: 0.5070
macro avg f1-score: 0.4759
weighted avg f1-score: 0.4823
```

클래스별 accuracy입니다.

| 클래스 | Accuracy |
| --- | ---: |
| banilla | 15% |
| bboyami | 70% |
| bianka | 30% |
| chamdori | 40% |
| frank | 20% |
| geullahem | 25% |
| jackson | 75% |
| marimo | 50% |
| master | 65% |
| mati | 65% |
| saida | 70% |
| yeoul | 60% |

## 필요 패키지

```bash
pip install torch torchvision numpy pillow scikit-learn matplotlib tqdm
```

Apple Silicon Mac에서는 `mps`를 우선 사용하고, 없으면 `cuda`, 그것도 없으면 `cpu`를 사용합니다.
