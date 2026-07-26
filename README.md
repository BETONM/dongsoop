# Seho EVA02 Webcam Demo

웹캠에서 얼굴이 정확히 1명 검출되면 버튼을 활성화하고, 버튼 클릭 후 얼굴 20장을 수집해 평균 확률로 동물의 숲 캐릭터를 매칭합니다.

## 실행

현재 `dongsoop-seho` 가상환경을 그대로 사용하는 경우:

```bash
cd <저장소 경로>/demo_test
source ~/Desktop/dongsoop/dongsoop-seho/.venv/bin/activate
cp ~/Desktop/dongsoop/dongsoop-seho/content/best_model.pth models/best_model.pth
python webcam_demo.py
```

새 가상환경을 만드는 경우:

```bash
cd <저장소 경로>/demo_test
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements.txt
cp ~/Desktop/dongsoop/dongsoop-seho/content/best_model.pth models/best_model.pth
python webcam_demo.py
```

다른 웹캠을 선택하려면:

```bash
python webcam_demo.py --camera 1
```

종료하려면 웹캠 창에서 `Q` 또는 `ESC`를 누릅니다.

macOS에서 처음 실행할 때 터미널 또는 Python의 카메라 접근 권한을 허용해야 합니다.

## 동작

1. 웹캠에서 MediaPipe로 최대 5명의 얼굴을 탐지합니다.
2. 얼굴이 정확히 1명일 때만 `START MATCHING` 버튼이 활성화됩니다.
3. 버튼을 클릭하면 `3, 2, 1` 카운트다운을 표시합니다.
4. 학습 때 사용한 방식으로 얼굴을 정렬·크롭·224×224 변환해 20장을 수집합니다.
5. Seho EVA02 모델로 각 이미지의 12개 클래스 확률을 구합니다.
6. 20개 확률을 클래스별로 평균내 Top 3를 터미널에 출력합니다.
7. 결과를 5초간 보여준 뒤 얼굴 탐지 상태로 돌아갑니다.

## 포함 파일

```text
demo_test/
├── webcam_demo.py
├── requirements.txt
├── README.md
└── models/
    ├── best_model.pth  # Git 제외: 실행 전 로컬에서 복사
    ├── classes.txt
    └── face_landmarker.task
```

`best_model.pth`는 GitHub 일반 파일 크기 제한을 초과하므로 저장소에 포함하지 않습니다.
