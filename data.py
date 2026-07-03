import kagglehub
import os
import shutil

# 전체 데이터셋을 캐시에 다운로드합니다.
base_path = kagglehub.dataset_download("lyk1652/afad-full")

# 캐시된 경로 안에서 28, 29 폴더 경로 찾기
cached_path_28 = os.path.join(base_path, "AFAD-Full", "28")
cached_path_29 = os.path.join(base_path, "AFAD-Full", "29")

# 현재 실행 중인 폴더(프로젝트 폴더) 내의 타겟 경로 지정
local_path_28 = os.path.join(os.getcwd(), "28")
local_path_29 = os.path.join(os.getcwd(), "29")

# 현재 폴더에 복사해옵니다. (없을 경우에만 복사)
if not os.path.exists(local_path_28):
    print("Copying 28 folder to local directory...")
    shutil.copytree(cached_path_28, local_path_28)

if not os.path.exists(local_path_29):
    print("Copying 29 folder to local directory...")
    shutil.copytree(cached_path_29, local_path_29)

print("Data is ready in the current folder!")
print("Local path to 28:", local_path_28)
print("Local path to 29:", local_path_29)