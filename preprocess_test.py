"""
전처리 테스트 스크립트 (단일 이미지)
- 원본 / 전처리 결과를 나란히 시각화
- 원본 파일은 건드리지 않음
"""

import os
import cv2
import numpy as np
from preprocess import preprocess_image, get_output_size


def main():
    out_w, out_h = get_output_size()

    print("테스트할 이미지 경로를 입력하세요.")
    print("예) dataset/banilla/001.jpg\n")
    img_path = input("  이미지 경로: ").strip()

    if not os.path.exists(img_path):
        print(f"\n[오류] 파일을 찾을 수 없습니다: {img_path}")
        return

    original = cv2.imread(img_path)
    if original is None:
        print(f"\n[오류] 이미지를 읽을 수 없습니다: {img_path}")
        return

    print(f"\n  원본 크기: {original.shape[1]} x {original.shape[0]}")
    print("  전처리 중...")

    result = preprocess_image(img_path, out_w, out_h)

    if result is None:
        print("\n[실패] 얼굴을 검출하지 못했습니다.")
        print("  → 다른 이미지로 다시 시도해보세요.")
        return

    print(f"  전처리 완료: {result.shape[1]} x {result.shape[0]}")

    # 원본을 동일 높이로 리사이즈 (비교용)
    orig_resized = cv2.resize(
        original,
        (int(original.shape[1] * out_h / original.shape[0]), out_h)
    )

    # 구분선
    divider = np.ones((out_h, 10, 3), dtype=np.uint8) * 200

    # 나란히 붙이기
    comparison = np.hstack([orig_resized, divider, result])

    # 라벨
    font = cv2.FONT_HERSHEY_SIMPLEX
    cv2.putText(comparison, "Original", (10, 25),
                font, 0.7, (0, 200, 0), 2)
    cv2.putText(comparison, f"Processed ({out_w}x{out_h})",
                (orig_resized.shape[1] + 20, 25),
                font, 0.7, (0, 100, 255), 2)

    # 저장
    save_path = "test_result.jpg"
    cv2.imwrite(save_path, comparison)
    print(f"\n  비교 이미지 저장됨: {save_path}")

    # 화면 출력 (GUI 환경)
    cv2.imshow("Preprocessing Test  |  Original  vs  Processed", comparison)
    print("  (아무 키나 누르면 종료)")
    cv2.waitKey(0)
    cv2.destroyAllWindows()


if __name__ == "__main__":
    main()
