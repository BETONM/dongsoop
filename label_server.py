#!/usr/bin/env python3
"""
🏷️ Dongsoop Labeling Server
Filters high-resolution images and serves a web-based labeling tool.

Usage:
    python3 label_server.py
"""
import os
import sys
import json
import shutil
import webbrowser
import mimetypes
from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse, unquote

try:
    from PIL import Image
except ImportError:
    print("❌ Pillow가 필요합니다. 설치해주세요:")
    print("   pip install Pillow")
    sys.exit(1)
import argparse

# ── Configuration ──────────────────────────────────────────
MIN_SIZE = 193  # 최소 width AND height (108-0.jpg 기준: 193x193)
TARGET_COUNT = 50  # 각 소스에서 뽑을 목표 수
PROJECT_DIR = os.path.dirname(os.path.abspath(__file__))
LABELS_FILE = os.path.join(PROJECT_DIR, "labels.json")

# 동적 구성
SOURCES = []

def parse_args():
    global SOURCES
    parser = argparse.ArgumentParser(description="Dongsoop Labeling Server")
    parser.add_argument(
        "ages",
        nargs="*",
        default=["24", "25"],
        help="나이 목록 (예: 21 22). 기본값: 28 29",
    )
    args = parser.parse_args()
    
    # 입력된 나이들로 SOURCES 리스트 생성 (예: 21 -> 21/111, 21/112)
    for age in args.ages:
        SOURCES.extend([f"{age}/111", f"{age}/112"])
    return args


def scan_and_filter():
    """이미지를 스캔하고 해상도 기준으로 필터링합니다 (헤더만 읽어서 빠름)."""
    import struct

    def get_jpeg_size(fpath):
        """JPEG 파일 헤더에서 크기를 빠르게 읽습니다."""
        with open(fpath, "rb") as f:
            f.seek(0)
            data = f.read(2)
            if data != b"\xff\xd8":
                return None
            while True:
                marker = f.read(2)
                if len(marker) < 2:
                    return None
                if marker[0] != 0xFF:
                    return None
                # SOFn markers (0xC0-0xCF except 0xC4, 0xC8, 0xCC)
                if marker[1] in (0xC0, 0xC1, 0xC2, 0xC3, 0xC5, 0xC6, 0xC7,
                                 0xC9, 0xCA, 0xCB, 0xCD, 0xCE, 0xCF):
                    f.read(3)  # length(2) + precision(1)
                    h = struct.unpack(">H", f.read(2))[0]
                    w = struct.unpack(">H", f.read(2))[0]
                    return w, h
                else:
                    length = struct.unpack(">H", f.read(2))[0]
                    f.seek(length - 2, 1)
        return None

    result = {}
    for src in SOURCES:
        folder = os.path.join(PROJECT_DIR, src)
        if not os.path.isdir(folder):
            print(f"  ⚠️  {src} 폴더를 찾을 수 없습니다. 건너뜁니다.")
            continue
        imgs = []
        all_files = sorted(f for f in os.listdir(folder) if f.lower().endswith((".jpg", ".jpeg", ".png")))
        total = len(all_files)
        for i, fname in enumerate(all_files):
            if (i + 1) % 500 == 0:
                print(f"    {src}: {i+1}/{total} 스캔 중...", flush=True)
            fpath = os.path.join(folder, fname)
            try:
                size = None
                if fname.lower().endswith((".jpg", ".jpeg")):
                    size = get_jpeg_size(fpath)
                if size is None:
                    # Fallback: PIL (PNG 등)
                    with Image.open(fpath) as im:
                        size = im.size
                if size and size[0] >= MIN_SIZE and size[1] >= MIN_SIZE:
                    imgs.append({"name": fname, "path": f"{src}/{fname}", "w": size[0], "h": size[1]})
            except Exception:
                pass
        result[src] = imgs
    return result


def get_characters():
    """dataset 폴더에서 캐릭터 목록을 읽어옵니다."""
    dataset_dir = os.path.join(PROJECT_DIR, "dataset")
    if not os.path.isdir(dataset_dir):
        return []
    chars = []
    for name in sorted(os.listdir(dataset_dir)):
        char_dir = os.path.join(dataset_dir, name)
        if not os.path.isdir(char_dir):
            continue
        # 레퍼런스 이미지 경로 찾기
        ref_img = None
        for fname in ["image.png", "image.jpg", "reference.png", "reference.jpg"]:
            if os.path.exists(os.path.join(char_dir, fname)):
                ref_img = f"dataset/{name}/{fname}"
                break
        chars.append({"id": name, "ref_image": ref_img})
    return chars


# ── Global State ──
filtered_images = {}
characters = []
labels = {}


class LabelingHandler(BaseHTTPRequestHandler):
    """라벨링 도구용 HTTP 핸들러 (BaseHTTPRequestHandler 기반)"""

    def do_GET(self):
        path = unquote(urlparse(self.path).path)

        if path == "/":
            self._serve_file(os.path.join(PROJECT_DIR, "labeling_tool.html"), "text/html")

        elif path == "/api/data":
            self._send_json({
                "images": filtered_images,
                "characters": characters,
                "labels": labels,
                "target": TARGET_COUNT,
            })

        else:
            # 정적 파일 서빙 (이미지 등)
            # 보안: PROJECT_DIR 밖의 파일 접근 방지
            safe_path = os.path.normpath(os.path.join(PROJECT_DIR, path.lstrip("/")))
            if not safe_path.startswith(PROJECT_DIR):
                self.send_error(403, "Forbidden")
                return
            if os.path.isfile(safe_path):
                content_type, _ = mimetypes.guess_type(safe_path)
                self._serve_file(safe_path, content_type or "application/octet-stream")
            else:
                self.send_error(404, "Not Found")

    def do_POST(self):
        global labels
        path = urlparse(self.path).path
        body = self._read_body()

        if path == "/api/label":
            img_path = body["path"]
            character = body["character"]
            labels[img_path] = character
            self._persist_labels()
            self._send_json({"ok": True, "total": len(labels)})

        elif path == "/api/unlabel":
            img_path = body["path"]
            labels.pop(img_path, None)
            self._persist_labels()
            self._send_json({"ok": True, "total": len(labels)})

        elif path == "/api/export":
            result = self._export_files()
            self._send_json(result)

        else:
            self.send_error(404)

    def _export_files(self):
        """라벨링된 파일을 dataset/캐릭터/ 폴더로 복사합니다."""
        copied, errors = 0, []
        for img_path, character in labels.items():
            src = os.path.join(PROJECT_DIR, img_path)
            dst_dir = os.path.join(PROJECT_DIR, "dataset", character)
            os.makedirs(dst_dir, exist_ok=True)
            # 소스 정보를 파일명에 포함 (충돌 방지: 28_111_파일명)
            source_prefix = os.path.dirname(img_path).replace("/", "_")
            dst_name = f"{source_prefix}_{os.path.basename(img_path)}"
            dst = os.path.join(dst_dir, dst_name)
            try:
                shutil.copy2(src, dst)
                copied += 1
            except Exception as e:
                errors.append(f"{img_path}: {e}")
        return {"ok": True, "copied": copied, "errors": errors}

    # ── Helper methods ──

    def _serve_file(self, filepath, content_type):
        try:
            with open(filepath, "rb") as f:
                content = f.read()
            self.send_response(200)
            self.send_header("Content-Type", f"{content_type}; charset=utf-8")
            self.send_header("Content-Length", len(content))
            self.send_header("Cache-Control", "no-cache")
            self.end_headers()
            self.wfile.write(content)
        except FileNotFoundError:
            self.send_error(404, f"File not found")

    def _read_body(self):
        length = int(self.headers.get("Content-Length", 0))
        raw = self.rfile.read(length)
        return json.loads(raw) if raw else {}

    def _send_json(self, data):
        content = json.dumps(data, ensure_ascii=False).encode("utf-8")
        self.send_response(200)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", len(content))
        self.end_headers()
        self.wfile.write(content)

    def _persist_labels(self):
        with open(LABELS_FILE, "w", encoding="utf-8") as f:
            json.dump(labels, f, ensure_ascii=False, indent=2)

    def log_message(self, format, *args):
        # 로그 숨기기 (깔끔한 출력)
        pass


def main():
    global filtered_images, characters, labels

    args = parse_args()
    os.chdir(PROJECT_DIR)

    print(f"🔍 사용할 소스 폴더: {', '.join(SOURCES)}")
    print("🔍 이미지 필터링 중 (최소 해상도: {0}×{0}px)...".format(MIN_SIZE))
    filtered_images = scan_and_filter()
    characters = get_characters()

    total = 0
    for src, imgs in filtered_images.items():
        print(f"  📁 {src}: {len(imgs)}장 통과")
        total += len(imgs)
    print(f"  📊 합계: {total}장")
    print(f"  🎭 캐릭터: {len(characters)}종 ({', '.join(c['id'] for c in characters)})")

    # 기존 라벨 로드
    if os.path.exists(LABELS_FILE):
        with open(LABELS_FILE, "r", encoding="utf-8") as f:
            labels = json.load(f)
        print(f"  🏷️  기존 라벨 {len(labels)}개 로드")

    port = 8765
    print(f"\n🚀 라벨링 도구 실행: http://localhost:{port}")
    print("   종료: Ctrl+C\n")

    server = HTTPServer(("localhost", port), LabelingHandler)
    webbrowser.open(f"http://localhost:{port}")

    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n👋 서버 종료")
        server.server_close()


if __name__ == "__main__":
    main()
