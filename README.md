# Seho EVA02 Webcam Demo

웹캠에서 얼굴을 감지하고, 얼굴 사진 20장의 예측 결과를 평균내 가장 닮은 동물의 숲 캐릭터를 출력하는 프로그램입니다.

## 1. Seho 모델 불러오기

Seho 모델 파일 `best_model.pth`를 준비한 뒤 `models` 폴더 안에 놓습니다.

```text
demo_test/
└── models/
    ├── best_model.pth
    ├── classes.txt
    └── face_landmarker.task
```

최종 모델 경로는 다음과 같아야 합니다.

```text
demo_test/models/best_model.pth
```

## 2. 가상환경 생성 및 실행

터미널에서 `demo_test` 폴더로 이동합니다.

```bash
cd ~/Desktop/dongsoop/demo_test
```

가상환경을 생성하고 활성화합니다.

```bash
python3 -m venv .venv
source .venv/bin/activate
```

필요한 패키지를 설치합니다.

```bash
python -m pip install --upgrade pip
python -m pip install -r requirements.txt
```

## 3. 코드 실행

```bash
python webcam_demo.py
```

다른 웹캠을 사용하려면 카메라 번호를 지정합니다.

```bash
python webcam_demo.py --camera 1
```

얼굴이 정확히 한 명 감지되면 `START MATCHING` 버튼이 활성화됩니다. 프로그램을 종료하려면 웹캠 창에서 `Q` 또는 `ESC`를 누릅니다.

macOS에서 처음 실행할 때 카메라 접근 권한 요청이 나타나면 허용해야 합니다.
