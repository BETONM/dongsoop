import kagglehub
import os
import shutil

# 전체 데이터셋을 캐시에 다운로드합니다.
base_path = kagglehub.dataset_download("lyk1652/afad-full")

# 캐시된 경로 안에서 28, 29 폴더 경로 찾기
cached_path_24 = os.path.join(base_path, "AFAD-Full", "24")
cached_path_25 = os.path.join(base_path, "AFAD-Full", "25")

# 현재 실행 중인 폴더(프로젝트 폴더) 내의 타겟 경로 지정
local_path_24 = os.path.join(os.getcwd(), "24")
local_path_25 = os.path.join(os.getcwd(), "25")

# 현재 폴더에 복사해옵니다. (없을 경우에만 복사)
if not os.path.exists(local_path_24):
    print("Copying 24 folder to local directory...")
    shutil.copytree(cached_path_24, local_path_24)

if not os.path.exists(local_path_25):
    print("Copying 25 folder to local directory...")
    shutil.copytree(cached_path_25, local_path_25)

print("Data is ready in the current folder!")
print("Local path to 24:", local_path_24)
print("Local path to 25:", local_path_25)