# dataset 폴더 내부의 전체 이미지를 전처리 -> preprocess.py
# 사진 한장만 테스트로 전처리 -> preprocess_test.py

# 얼굴 이미지 전처리 파이프라인

**도구**: MediaPipe FaceLandmarker (Task API)  
**대상**: `dataset/` 하위 각 캐릭터 폴더의 JPG/PNG 이미지  

---

## 처리 순서

### 1. 얼굴 랜드마크 검출
- MediaPipe FaceLandmarker로 468개 랜드마크 검출
- 얼굴 미검출 시 해당 파일 삭제

### 2. 눈 중심축 정렬 (Alignment)
- 좌안(33, 133) / 우안(362, 263) 랜드마크로 각 눈의 중심 좌표 계산
- 두 눈 사이 기울기 각도 계산 후 Affine 회전 변환 적용
- 기준점: 두 눈의 중심점

### 3. 얼굴 영역 크롭 (Crop)
- 전체 468개 랜드마크의 min/max로 얼굴 bounding box 산출
- 회전된 bbox에 아래 패딩 적용

| 방향 | 패딩 비율 |
|------|----------|
| 상단 (머리카락) | bbox 높이의 70% |
| 좌/우 (귀 포함) | bbox 너비의 25% |
| 하단 (턱선) | bbox 높이의 20% |

### 4. 리사이즈
- 사용자 입력 크기로 리사이즈 (기본 권장: 224×224)
- 보간법: `INTER_AREA` (축소 시 품질 우선)

---

## 미적용 항목 (학습 코드에서 처리)
- Normalize (mean/std)
- 데이터 증강 (Flip, Rotation, ColorJitter 등)
