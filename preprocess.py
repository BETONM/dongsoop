"""
MediaPipe FaceLandmarker (Task API) 기반 얼굴 전처리 스크립트
- 눈 중심축 기반 정렬
- 머리카락 포함 크롭 (top_pad 70%)
- 사용자 지정 출력 해상도
- 원본 파일명 유지 덮어쓰기
"""

import os
import cv2
import numpy as np
import urllib.request
import pathlib
import mediapipe as mp
from mediapipe.tasks import python as mp_python
from mediapipe.tasks.python import vision as mp_vision

# 눈 중심 랜드마크 인덱스
LEFT_EYE_CENTER  = [33, 133]
RIGHT_EYE_CENTER = [362, 263]

# 모델 다운로드 (최초 1회)
MODEL_PATH = pathlib.Path("face_landmarker.task")
if not MODEL_PATH.exists():
    print("face_landmarker.task 모델 다운로드 중...")
    urllib.request.urlretrieve(
        "https://storage.googleapis.com/mediapipe-models/"
        "face_landmarker/face_landmarker/float16/1/face_landmarker.task",
        MODEL_PATH,
    )
    print("다운로드 완료\n")

# FaceLandmarker 옵션 설정
_options = mp_vision.FaceLandmarkerOptions(
    base_options=mp_python.BaseOptions(model_asset_path=str(MODEL_PATH)),
    output_face_blendshapes=False,
    output_facial_transformation_matrixes=False,
    num_faces=1,
)
_detector = mp_vision.FaceLandmarker.create_from_options(_options)


# ── 유틸 함수 ────────────────────────────────────────────────

def get_output_size():
    print("\n" + "="*50)
    print("  MediaPipe 얼굴 전처리 스크립트")
    print("="*50)
    print("\n최종 출력 이미지 크기를 입력하세요.")
    print("(일반적으로 CNN 입력: 224x224 또는 128x128)\n")
    while True:
        try:
            w = int(input("  가로 픽셀 수 (width) : "))
            h = int(input("  세로 픽셀 수 (height): "))
            if w > 0 and h > 0:
                print(f"\n  → 출력 크기: {w} x {h} 픽셀\n")
                return w, h
            print("  [오류] 0보다 큰 값을 입력하세요.\n")
        except ValueError:
            print("  [오류] 숫자만 입력하세요.\n")


def get_eye_center(landmarks, indices, img_w, img_h):
    pts = np.array([[landmarks[i].x * img_w, landmarks[i].y * img_h]
                    for i in indices])
    return pts.mean(axis=0)


def get_face_bbox(landmarks, img_w, img_h):
    xs = [lm.x * img_w for lm in landmarks]
    ys = [lm.y * img_h for lm in landmarks]
    return int(min(xs)), int(min(ys)), int(max(xs)), int(max(ys))


def align_face(img, left_eye, right_eye):
    dy = right_eye[1] - left_eye[1]
    dx = right_eye[0] - left_eye[0]
    angle = np.degrees(np.arctan2(dy, dx))
    eye_center = tuple(((left_eye + right_eye) / 2).astype(float))
    M = cv2.getRotationMatrix2D(tuple(eye_center), angle, scale=1.0)
    h, w = img.shape[:2]
    aligned = cv2.warpAffine(img, M, (w, h), flags=cv2.INTER_LINEAR)
    return aligned, M


def transform_box(x1, y1, x2, y2, M):
    corners = np.array([[x1,y1,1],[x2,y1,1],[x2,y2,1],[x1,y2,1]], dtype=np.float32)
    t = (M @ corners.T).T
    return int(t[:,0].min()), int(t[:,1].min()), int(t[:,0].max()), int(t[:,1].max())


def crop_with_hair(img, x1, y1, x2, y2,
                   top_pad=0.7, side_pad=0.25, bottom_pad=0.2):
    img_h, img_w = img.shape[:2]
    bw, bh = x2 - x1, y2 - y1
    cx1 = max(0, int(x1 - bw * side_pad))
    cx2 = min(img_w, int(x2 + bw * side_pad))
    cy1 = max(0, int(y1 - bh * top_pad))
    cy2 = min(img_h, int(y2 + bh * bottom_pad))
    return img[cy1:cy2, cx1:cx2]


def preprocess_image(image_path, out_w, out_h,
                     top_pad=0.7, side_pad=0.25, bottom_pad=0.2):
    img_bgr = cv2.imread(image_path)
    if img_bgr is None:
        return None

    img_h, img_w = img_bgr.shape[:2]
    img_rgb = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2RGB)

    # 1. MediaPipe Task API로 랜드마크 검출
    mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=img_rgb)
    result = _detector.detect(mp_image)

    if not result.face_landmarks:
        return None

    landmarks = result.face_landmarks[0]

    # 2. 눈 중심 좌표
    left_eye  = get_eye_center(landmarks, LEFT_EYE_CENTER,  img_w, img_h)
    right_eye = get_eye_center(landmarks, RIGHT_EYE_CENTER, img_w, img_h)

    # 3. 정렬
    aligned, M = align_face(img_bgr, left_eye, right_eye)

    # 4. bbox → 회전 적용
    x1, y1, x2, y2 = get_face_bbox(landmarks, img_w, img_h)
    rx1, ry1, rx2, ry2 = transform_box(x1, y1, x2, y2, M)

    # 5. 머리카락 포함 크롭
    cropped = crop_with_hair(aligned, rx1, ry1, rx2, ry2,
                             top_pad, side_pad, bottom_pad)
    if cropped.size == 0:
        return None

    # 6. 리사이즈
    return cv2.resize(cropped, (out_w, out_h), interpolation=cv2.INTER_AREA)


# ── 메인 ─────────────────────────────────────────────────────

def main():
    out_w, out_h = get_output_size()

    script_dir   = os.path.dirname(os.path.abspath(__file__))
    dataset_root = os.path.join(script_dir, "dataset")
    output_root  = os.path.join(script_dir, "dataset_preprocessed")

    if not os.path.exists(dataset_root):
        print(f"[오류] dataset 폴더를 찾을 수 없습니다: {dataset_root}")
        return

    os.makedirs(output_root, exist_ok=True)

    character_dirs = sorted([
        d for d in os.listdir(dataset_root)
        if os.path.isdir(os.path.join(dataset_root, d))
    ])

    total_ok = total_fail = 0

    for char in character_dirs:
        char_path     = os.path.join(dataset_root, char)
        out_char_path = os.path.join(output_root, char)
        os.makedirs(out_char_path, exist_ok=True)

        jpg_files = [f for f in os.listdir(char_path)
                     if f.lower().endswith(('.jpg', '.jpeg'))]

        ok = fail = 0
        print(f"[{char}] {len(jpg_files)}장 처리 중...")

        for fname in jpg_files:
            fpath     = os.path.join(char_path, fname)
            out_fpath = os.path.join(out_char_path, fname)
            result    = preprocess_image(fpath, out_w, out_h)

            if result is not None:
                cv2.imwrite(out_fpath, result)
                ok += 1
            else:
                print(f"  [SKIP] 얼굴 미검출: {fname}")
                fail += 1

        print(f"  → 성공 {ok}장 / 실패(스킵) {fail}장\n")
        total_ok   += ok
        total_fail += fail

    print("="*50)
    print(f"  전처리 완료  |  성공 {total_ok}장  |  스킵 {total_fail}장")
    print(f"  저장 위치: {output_root}")
    print("="*50)


if __name__ == "__main__":
    main()
