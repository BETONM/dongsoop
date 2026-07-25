import os
import torch
import torch.nn as nn
import timm
from torchvision import transforms
from PIL import Image

# ==========================================================
# 1. 설정 (학습 코드의 Config와 정확히 일치)
# ==========================================================
class InferenceConfig:
    IMAGE_SIZE = 224
    MODEL_NAME = "eva02_base_patch14_224.mim_in22k"
    
    # 학습 시 정상 정규화값
    MEAN = [0.48145466, 0.4578275, 0.40821073]
    STD = [0.26862954, 0.26130258, 0.27577711]

CFG = InferenceConfig()

# 디바이스 설정 (CUDA -> MPS -> CPU)
DEVICE = torch.device(
    "cuda" if torch.cuda.is_available() 
    else "mps" if torch.backends.mps.is_available() 
    else "cpu"
)

# ==========================================================
# 2. Transform (학습 코드의 val_transform과 동일)
# ==========================================================
val_transform = transforms.Compose([
    transforms.Resize((CFG.IMAGE_SIZE, CFG.IMAGE_SIZE)),
    transforms.ToTensor(),
    transforms.Normalize(CFG.MEAN, CFG.STD)
])

# ==========================================================
# 3. 모델 빌더 (학습 코드의 build_model과 동일한 Head 구조)
# ==========================================================
def build_inference_model(num_classes: int, weights_path: str):
    # 백본 생성 (가중치는 아래 pth에서 로드하므로 pretrained=False)
    model = timm.create_model(CFG.MODEL_NAME, pretrained=False)
    
    # 커스텀 Head 붙이기 (Part 1의 build_model과 동일)
    model.head = nn.Sequential(
        nn.Linear(model.num_features, 512),
        nn.LayerNorm(512),
        nn.GELU(),
        nn.Dropout(0.3),
        
        nn.Linear(512, 256),
        nn.LayerNorm(256),
        nn.GELU(),
        nn.Dropout(0.2),
        
        nn.Linear(256, num_classes)
    )
    
    # 가중치 파일 로드
    checkpoint = torch.load(weights_path, map_location=DEVICE, weights_only=True)
    if isinstance(checkpoint, dict) and 'model_state_dict' in checkpoint:
        model.load_state_dict(checkpoint['model_state_dict'])
    elif isinstance(checkpoint, dict) and 'state_dict' in checkpoint:
        model.load_state_dict(checkpoint['state_dict'])
    else:
        model.load_state_dict(checkpoint)
        
    model.to(DEVICE)
    model.eval()
    return model

# ==========================================================
# 4. 클래스 라벨 로더 (classes.txt 호환)
# ==========================================================
def load_class_names(classes_path: str = None):
    if classes_path and os.path.exists(classes_path):
        class_names = []
        with open(classes_path, "r", encoding="utf-8") as f:
            for line in f:
                parts = line.strip().split("\t")
                if len(parts) == 2:
                    class_names.append(parts[1])
        return class_names
    else:
        # classes.txt 경로가 없거나 파일이 없을 경우 기본 리스트
        return [
            'banilla', 'bboyami', 'bianka', 'chamdori', 'frank', 'geullahem',
            'jackson', 'marimo', 'master', 'mati', 'saida', 'yeoul'
        ]

# ==========================================================
# 5. 예측 함수 (torch.inference_mode 사용으로 가볍고 빠른 실행)
# ==========================================================
def predict_image(image_path: str, model, class_names: list, top_k: int = 3):
    image = Image.open(image_path).convert("RGB")
    tensor = val_transform(image).unsqueeze(0).to(DEVICE)

    with torch.inference_mode():
        logits = model(tensor)
        probs = torch.softmax(logits, dim=1)[0]

    top_prob, top_indices = torch.topk(probs, k=min(top_k, len(class_names)))

    print("\n" + "=" * 40)
    print(" 🍃 Animal Crossing Face Matcher 🍃")
    print("=" * 40)
    print(f"📸 입력 이미지: {image_path}")
    print("-" * 40)
    
    for i in range(len(top_indices)):
        idx = top_indices[i].item()
        prob = top_prob[i].item() * 100
        print(f" Top {i+1}: {class_names[idx]} ({prob:.2f}%)")
        
    print("=" * 40)
    
    top_1_character = class_names[top_indices[0].item()]
    top_1_confidence = top_prob[0].item() * 100
    return top_1_character, top_1_confidence

# ==========================================================
# 6. 메인 실행부
# ==========================================================
if __name__ == "__main__":
    # 경로 설정
    WEIGHTS_PATH = "content/best_model.pth"             # 저장된 pth 경로
    CLASSES_TXT_PATH = "content/classes.txt"    # 저장된 classes.txt 경로
    TEST_IMAGE_PATH = "content/test.jpg"        # 테스트할 사람 얼굴 사진
    
    # 1. 클래스 이름 목록 로드
    class_names = load_class_names(CLASSES_TXT_PATH)
    
    # 2. 모델 로드 및 가중치 복원
    model = build_inference_model(
        num_classes=len(class_names),
        weights_path=WEIGHTS_PATH
    )
    
    # 3. 예측 실행
    best_match, confidence = predict_image(
        image_path=TEST_IMAGE_PATH,
        model=model,
        class_names=class_names,
        top_k=3
    )