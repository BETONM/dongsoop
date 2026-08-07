import time
import requests
from datetime import datetime

URL = "https://dongsoop.onrender.com/test-db"

while True:
    try:
        response = requests.get(URL, timeout=10)

        print(
            f"[{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] "
            f"Status: {response.status_code}"
        )

    except Exception as e:
        print(
            f"[{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] "
            f"Error: {e}"
        )

    # 5분 대기
    time.sleep(300)