# 모델 사용법

## 1. 구성 요소
content/
    ㄴ best_model.pth   // eva02 모델 전이학습을 통해 개발한 가중치 파일
    ㄴ classes.txt      // 동물의 숲 캐릭터 12명의 이름이 들어있는 txt 파일
    ㄴ test.jpg         // 테스트용 .jpg 이미지 파일

## 2. requirements.txt    모델 개발에 사용된 라이브러리 버전

```Bash
pip install -r requirements.txt
```

위 명령어 입력을 통해 라이브러리 버전 맞출 수 있음. 

## 3. predict.py 파일 실행
- .py 내부에서 test.jpg를 찾아 분석 후, 비슷한 캐릭터 3개를 %와 함께 출력함. 


## 4. 출력 예시
이세호의 안경 쓴 사진을 업로드 시, 

\========================================\
 🍃 Animal Crossing Face  Matcher🍃                     
\========================================\
📸 입력 이미지: content/test.jpg                                  
\========================================\
 Top 1: jackson (21.89%)                             
 Top 2: frank (20.43%)                                
 Top 3: master (20.24%)  