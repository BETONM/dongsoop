import argparse
import time
from pathlib import Path
from typing import Sequence

import cv2
import mediapipe as mp
import numpy as np
import timm
import torch
import torch.nn as nn
from mediapipe.tasks import python as mp_python
from mediapipe.tasks.python import vision as mp_vision
from PIL import Image
from torchvision import transforms


ROOT = Path(__file__).resolve().parent
WEIGHTS_PATH = ROOT / "models" / "best_model.pth"
CLASSES_PATH = ROOT / "models" / "classes.txt"
FACE_LANDMARKER_PATH = ROOT / "models" / "face_landmarker.task"

WINDOW_NAME = "Animal Crossing Face Matcher"
IMAGE_SIZE = 224
MODEL_NAME = "eva02_base_patch14_224.mim_in22k"
MEAN = [0.48145466, 0.4578275, 0.40821073]
STD = [0.26862954, 0.26130258, 0.27577711]
CAPTURE_COUNT = 20
RESULT_DISPLAY_SECONDS = 5.0

LEFT_EYE_CENTER = [33, 133]
RIGHT_EYE_CENTER = [362, 263]

BUTTON_W = 220
BUTTON_H = 58
BUTTON_MARGIN = 24


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="웹캠 얼굴 20장을 평균내 동물의 숲 캐릭터를 매칭합니다."
    )
    parser.add_argument("--camera", type=int, default=0, help="웹캠 번호 (기본값: 0)")
    parser.add_argument(
        "--capture-interval",
        type=float,
        default=0.08,
        help="얼굴 캡처 간격(초). 기본값: 0.08",
    )
    return parser.parse_args()


def get_device() -> torch.device:
    if torch.cuda.is_available():
        return torch.device("cuda")
    if torch.backends.mps.is_available():
        return torch.device("mps")
    return torch.device("cpu")


def load_class_names(path: Path) -> list[str]:
    if not path.is_file():
        raise FileNotFoundError(f"클래스 파일을 찾을 수 없습니다: {path}")

    indexed_names: list[tuple[int, str]] = []
    for line in path.read_text(encoding="utf-8").splitlines():
        parts = line.strip().split("\t")
        if len(parts) == 2:
            indexed_names.append((int(parts[0]), parts[1]))
    indexed_names.sort()
    class_names = [name for _, name in indexed_names]
    if not class_names:
        raise ValueError(f"클래스 이름이 비어 있습니다: {path}")
    return class_names


def build_model(num_classes: int, device: torch.device) -> nn.Module:
    if not WEIGHTS_PATH.is_file():
        raise FileNotFoundError(f"모델 가중치를 찾을 수 없습니다: {WEIGHTS_PATH}")

    model = timm.create_model(MODEL_NAME, pretrained=False)
    model.head = nn.Sequential(
        nn.Linear(model.num_features, 512),
        nn.LayerNorm(512),
        nn.GELU(),
        nn.Dropout(0.3),
        nn.Linear(512, 256),
        nn.LayerNorm(256),
        nn.GELU(),
        nn.Dropout(0.2),
        nn.Linear(256, num_classes),
    )

    checkpoint = torch.load(WEIGHTS_PATH, map_location=device, weights_only=True)
    if isinstance(checkpoint, dict) and "model_state_dict" in checkpoint:
        state_dict = checkpoint["model_state_dict"]
    elif isinstance(checkpoint, dict) and "state_dict" in checkpoint:
        state_dict = checkpoint["state_dict"]
    else:
        state_dict = checkpoint

    model.load_state_dict(state_dict)
    model.to(device)
    model.eval()
    return model


def build_face_detector() -> mp_vision.FaceLandmarker:
    if not FACE_LANDMARKER_PATH.is_file():
        raise FileNotFoundError(
            f"MediaPipe 얼굴 모델을 찾을 수 없습니다: {FACE_LANDMARKER_PATH}"
        )

    options = mp_vision.FaceLandmarkerOptions(
        base_options=mp_python.BaseOptions(
            model_asset_path=str(FACE_LANDMARKER_PATH)
        ),
        running_mode=mp_vision.RunningMode.IMAGE,
        output_face_blendshapes=False,
        output_facial_transformation_matrixes=False,
        num_faces=5,
        min_face_detection_confidence=0.5,
        min_face_presence_confidence=0.5,
        min_tracking_confidence=0.5,
    )
    return mp_vision.FaceLandmarker.create_from_options(options)


def detect_faces(detector: mp_vision.FaceLandmarker, frame_bgr: np.ndarray):
    frame_rgb = cv2.cvtColor(frame_bgr, cv2.COLOR_BGR2RGB)
    mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=frame_rgb)
    return detector.detect(mp_image).face_landmarks


def get_eye_center(landmarks, indices: Sequence[int], width: int, height: int):
    points = np.array(
        [[landmarks[i].x * width, landmarks[i].y * height] for i in indices],
        dtype=np.float32,
    )
    return points.mean(axis=0)


def get_face_bbox(landmarks, width: int, height: int):
    xs = [landmark.x * width for landmark in landmarks]
    ys = [landmark.y * height for landmark in landmarks]
    return int(min(xs)), int(min(ys)), int(max(xs)), int(max(ys))


def align_face(frame: np.ndarray, left_eye: np.ndarray, right_eye: np.ndarray):
    dy = right_eye[1] - left_eye[1]
    dx = right_eye[0] - left_eye[0]
    angle = np.degrees(np.arctan2(dy, dx))
    eye_center = tuple(((left_eye + right_eye) / 2).astype(float))
    matrix = cv2.getRotationMatrix2D(eye_center, angle, scale=1.0)
    height, width = frame.shape[:2]
    aligned = cv2.warpAffine(
        frame, matrix, (width, height), flags=cv2.INTER_LINEAR
    )
    return aligned, matrix


def transform_box(x1: int, y1: int, x2: int, y2: int, matrix: np.ndarray):
    corners = np.array(
        [[x1, y1, 1], [x2, y1, 1], [x2, y2, 1], [x1, y2, 1]],
        dtype=np.float32,
    )
    transformed = (matrix @ corners.T).T
    return (
        int(transformed[:, 0].min()),
        int(transformed[:, 1].min()),
        int(transformed[:, 0].max()),
        int(transformed[:, 1].max()),
    )


def crop_face_like_training(
    frame: np.ndarray,
    landmarks,
    top_pad: float = 0.7,
    side_pad: float = 0.25,
    bottom_pad: float = 0.2,
) -> np.ndarray | None:
    height, width = frame.shape[:2]
    left_eye = get_eye_center(landmarks, LEFT_EYE_CENTER, width, height)
    right_eye = get_eye_center(landmarks, RIGHT_EYE_CENTER, width, height)
    aligned, matrix = align_face(frame, left_eye, right_eye)

    x1, y1, x2, y2 = get_face_bbox(landmarks, width, height)
    x1, y1, x2, y2 = transform_box(x1, y1, x2, y2, matrix)
    box_width = x2 - x1
    box_height = y2 - y1

    crop_x1 = max(0, int(x1 - box_width * side_pad))
    crop_x2 = min(width, int(x2 + box_width * side_pad))
    crop_y1 = max(0, int(y1 - box_height * top_pad))
    crop_y2 = min(height, int(y2 + box_height * bottom_pad))
    cropped = aligned[crop_y1:crop_y2, crop_x1:crop_x2]
    if cropped.size == 0:
        return None

    # Seho 모델 학습/기존 test pipeline과 같은 224x224 강제 리사이즈입니다.
    return cv2.resize(
        cropped, (IMAGE_SIZE, IMAGE_SIZE), interpolation=cv2.INTER_AREA
    )


def landmark_bbox_for_display(landmarks, width: int, height: int):
    x1, y1, x2, y2 = get_face_bbox(landmarks, width, height)
    padding_x = int((x2 - x1) * 0.12)
    padding_y = int((y2 - y1) * 0.18)
    return (
        max(0, x1 - padding_x),
        max(0, y1 - padding_y),
        min(width - 1, x2 + padding_x),
        min(height - 1, y2 + padding_y),
    )


INFERENCE_TRANSFORM = transforms.Compose(
    [
        transforms.Resize((IMAGE_SIZE, IMAGE_SIZE)),
        transforms.ToTensor(),
        transforms.Normalize(MEAN, STD),
    ]
)


@torch.inference_mode()
def average_predictions(
    face_images: Sequence[np.ndarray],
    model: nn.Module,
    device: torch.device,
    batch_size: int = 4,
) -> np.ndarray:
    total_probabilities = None
    processed_count = 0

    for start in range(0, len(face_images), batch_size):
        batch_images = face_images[start : start + batch_size]
        tensors = []
        for face_bgr in batch_images:
            face_rgb = cv2.cvtColor(face_bgr, cv2.COLOR_BGR2RGB)
            tensors.append(INFERENCE_TRANSFORM(Image.fromarray(face_rgb)))

        batch = torch.stack(tensors).to(device)
        probabilities = torch.softmax(model(batch), dim=1)
        batch_sum = probabilities.sum(dim=0).detach().cpu().numpy()
        if total_probabilities is None:
            total_probabilities = batch_sum
        else:
            total_probabilities += batch_sum
        processed_count += len(batch_images)

    if total_probabilities is None or processed_count == 0:
        raise ValueError("예측할 얼굴 이미지가 없습니다.")
    return total_probabilities / processed_count


def draw_text(
    frame: np.ndarray,
    text: str,
    origin: tuple[int, int],
    scale: float = 0.75,
    color: tuple[int, int, int] = (255, 255, 255),
    thickness: int = 2,
) -> None:
    cv2.putText(
        frame,
        text,
        origin,
        cv2.FONT_HERSHEY_SIMPLEX,
        scale,
        (0, 0, 0),
        thickness + 3,
        cv2.LINE_AA,
    )
    cv2.putText(
        frame,
        text,
        origin,
        cv2.FONT_HERSHEY_SIMPLEX,
        scale,
        color,
        thickness,
        cv2.LINE_AA,
    )


def button_rect(frame: np.ndarray):
    height, width = frame.shape[:2]
    x2 = width - BUTTON_MARGIN
    y2 = height - BUTTON_MARGIN
    return x2 - BUTTON_W, y2 - BUTTON_H, x2, y2


def draw_button(frame: np.ndarray, enabled: bool) -> None:
    x1, y1, x2, y2 = button_rect(frame)
    fill = (50, 180, 80) if enabled else (90, 90, 90)
    cv2.rectangle(frame, (x1, y1), (x2, y2), fill, -1)
    cv2.rectangle(frame, (x1, y1), (x2, y2), (255, 255, 255), 2)
    label = "START MATCHING" if enabled else "ONE FACE REQUIRED"
    text_size = cv2.getTextSize(label, cv2.FONT_HERSHEY_SIMPLEX, 0.55, 2)[0]
    text_x = x1 + (BUTTON_W - text_size[0]) // 2
    text_y = y1 + (BUTTON_H + text_size[1]) // 2
    cv2.putText(
        frame,
        label,
        (text_x, text_y),
        cv2.FONT_HERSHEY_SIMPLEX,
        0.55,
        (255, 255, 255),
        2,
        cv2.LINE_AA,
    )


def draw_progress(frame: np.ndarray, current: int, total: int) -> None:
    height, width = frame.shape[:2]
    bar_x1, bar_x2 = 60, width - 60
    bar_y1, bar_y2 = height - 72, height - 42
    ratio = min(1.0, current / total)
    cv2.rectangle(frame, (bar_x1, bar_y1), (bar_x2, bar_y2), (55, 55, 55), -1)
    fill_x = bar_x1 + int((bar_x2 - bar_x1) * ratio)
    cv2.rectangle(frame, (bar_x1, bar_y1), (fill_x, bar_y2), (60, 200, 100), -1)
    cv2.rectangle(frame, (bar_x1, bar_y1), (bar_x2, bar_y2), (255, 255, 255), 2)
    draw_text(
        frame,
        f"Capturing faces: {current}/{total}",
        (bar_x1, bar_y1 - 14),
        scale=0.7,
    )


def print_result(class_names: Sequence[str], probabilities: np.ndarray) -> None:
    top_indices = np.argsort(probabilities)[::-1][:3]
    print("\n" + "=" * 48)
    print(" Animal Crossing Face Matcher - 20 frame average")
    print("=" * 48)
    for rank, index in enumerate(top_indices, start=1):
        print(f" Top {rank}: {class_names[index]} ({probabilities[index] * 100:.2f}%)")
    print("=" * 48)


def main() -> None:
    args = parse_args()
    if args.capture_interval < 0:
        raise ValueError("--capture-interval은 0 이상이어야 합니다.")

    class_names = load_class_names(CLASSES_PATH)
    device = get_device()
    print(f"Seho EVA02 모델 로딩 중... (device={device})")
    model = build_model(len(class_names), device)
    detector = build_face_detector()

    camera = cv2.VideoCapture(args.camera)
    camera.set(cv2.CAP_PROP_FRAME_WIDTH, 1280)
    camera.set(cv2.CAP_PROP_FRAME_HEIGHT, 720)
    if not camera.isOpened():
        detector.close()
        raise RuntimeError(
            f"웹캠 {args.camera}번을 열 수 없습니다. "
            "macOS 카메라 권한과 --camera 번호를 확인해 주세요."
        )

    state = "detecting"
    countdown_started = 0.0
    last_capture_at = 0.0
    captured_faces: list[np.ndarray] = []
    result_name = ""
    result_confidence = 0.0
    result_started = 0.0
    face_count = 0

    def on_mouse(event, x, y, _flags, _userdata):
        nonlocal state, countdown_started, captured_faces
        if event != cv2.EVENT_LBUTTONUP or state != "detecting" or face_count != 1:
            return
        x1, y1, x2, y2 = button_rect(last_frame)
        if x1 <= x <= x2 and y1 <= y <= y2:
            captured_faces = []
            countdown_started = time.monotonic()
            state = "countdown"

    cv2.namedWindow(WINDOW_NAME, cv2.WINDOW_AUTOSIZE)
    last_frame = np.zeros((720, 1280, 3), dtype=np.uint8)
    cv2.setMouseCallback(WINDOW_NAME, on_mouse)

    print("웹캠이 시작되었습니다. 종료하려면 Q 또는 ESC를 누르세요.")
    try:
        while True:
            ok, frame = camera.read()
            if not ok:
                print("웹캠 프레임을 읽지 못했습니다.")
                break

            frame = cv2.flip(frame, 1)
            last_frame = frame
            display = frame.copy()
            landmarks_list = detect_faces(detector, frame)
            face_count = len(landmarks_list)

            for landmarks in landmarks_list:
                x1, y1, x2, y2 = landmark_bbox_for_display(
                    landmarks, frame.shape[1], frame.shape[0]
                )
                color = (50, 220, 80) if face_count == 1 else (30, 80, 240)
                cv2.rectangle(display, (x1, y1), (x2, y2), color, 3)

            now = time.monotonic()
            if state == "detecting":
                status = (
                    "Face ready - click START MATCHING"
                    if face_count == 1
                    else f"Exactly one face required (detected: {face_count})"
                )
                draw_text(display, status, (24, 42), scale=0.75)
                draw_button(display, enabled=face_count == 1)

            elif state == "countdown":
                elapsed = now - countdown_started
                if elapsed >= 3.0:
                    state = "capturing"
                    last_capture_at = 0.0
                else:
                    count = 3 - int(elapsed)
                    text = str(count)
                    text_size = cv2.getTextSize(
                        text, cv2.FONT_HERSHEY_SIMPLEX, 5.0, 10
                    )[0]
                    tx = (display.shape[1] - text_size[0]) // 2
                    ty = (display.shape[0] + text_size[1]) // 2
                    draw_text(display, text, (tx, ty), scale=5.0, thickness=10)
                    draw_text(
                        display,
                        "Keep one face inside the frame",
                        (24, 42),
                        scale=0.75,
                    )

            elif state == "capturing":
                if face_count == 1 and now - last_capture_at >= args.capture_interval:
                    face = crop_face_like_training(frame, landmarks_list[0])
                    if face is not None:
                        captured_faces.append(face)
                        last_capture_at = now

                draw_progress(display, len(captured_faces), CAPTURE_COUNT)
                if face_count != 1:
                    draw_text(
                        display,
                        "Capture paused - show exactly one face",
                        (24, 42),
                        scale=0.75,
                        color=(50, 100, 255),
                    )
                else:
                    draw_text(
                        display,
                        "Capturing... keep looking at the camera",
                        (24, 42),
                        scale=0.75,
                    )

                if len(captured_faces) >= CAPTURE_COUNT:
                    state = "inferencing"

            elif state == "inferencing":
                draw_text(
                    display,
                    "Analyzing 20 face images...",
                    (24, 42),
                    scale=0.85,
                    color=(80, 230, 255),
                )
                cv2.imshow(WINDOW_NAME, display)
                cv2.waitKey(1)

                average = average_predictions(captured_faces, model, device)
                best_index = int(np.argmax(average))
                result_name = class_names[best_index]
                result_confidence = float(average[best_index]) * 100
                print_result(class_names, average)
                result_started = time.monotonic()
                state = "result"

            elif state == "result":
                draw_text(
                    display,
                    f"Best match: {result_name} ({result_confidence:.2f}%)",
                    (24, 52),
                    scale=1.0,
                    color=(80, 255, 160),
                    thickness=3,
                )
                draw_text(
                    display,
                    "Returning to face detection...",
                    (24, 88),
                    scale=0.65,
                )
                if now - result_started >= RESULT_DISPLAY_SECONDS:
                    captured_faces = []
                    state = "detecting"

            cv2.imshow(WINDOW_NAME, display)
            key = cv2.waitKey(1) & 0xFF
            if key in (27, ord("q"), ord("Q")):
                break
    finally:
        camera.release()
        detector.close()
        cv2.destroyAllWindows()


if __name__ == "__main__":
    main()
