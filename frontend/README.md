
# 프메의 숲 Frontend

Figma Make로 제작한 모바일 웹 화면입니다.

## 실행 방법

```bash
npm install
npm run dev
```

로컬 개발 중에는 `/api` 요청이 기본적으로 `http://localhost:3000` 백엔드 서버로 프록시됩니다.

## 백엔드 연결

프론트에서 사용하는 API는 `origin/backend` 브랜치 기준입니다.

- `POST /api/auth/google` : 구글 로그인
- `GET /api/auth/dev-token` : 개발용 JWT 발급
- `GET /api/user/me` : 내 정보 조회
- `PATCH /api/user/profile` : 이름/캐릭터 설정
- `PATCH /api/user/verify` : 관리자 비밀번호 인증
- `GET /api/mission` : 현재 미션 조회
- `PATCH /api/mission/1` : 미션 1 완료
- `PATCH /api/mission/2` : 미션 2 사진 업로드 완료
- `PATCH /api/mission/3` : 미션 3 사진 업로드 완료
- `GET /api/history` : 미션 진행 내역 조회

## 환경 변수

`frontend/.env.example`을 참고해서 `frontend/.env`를 만들면 됩니다.

```bash
VITE_API_BASE_URL=
VITE_API_PROXY_TARGET=http://localhost:3000
VITE_GOOGLE_CLIENT_ID=
VITE_USE_DEV_TOKEN=true
```

- `VITE_API_BASE_URL` : 배포된 백엔드 API 주소. 비워두면 같은 도메인의 `/api`로 요청합니다.
- `VITE_API_PROXY_TARGET` : 로컬 개발용 백엔드 주소입니다.
- `VITE_GOOGLE_CLIENT_ID` : 실제 Google 로그인에 사용할 클라이언트 ID입니다.
- `VITE_USE_DEV_TOKEN` : `true`면 Google 로그인 대신 `/api/auth/dev-token`으로 테스트합니다.

## 배포 전 확인

```bash
npm run build
```

실제 배포 시에는 백엔드 배포 주소를 `VITE_API_BASE_URL`에 넣고 다시 빌드/배포해야 합니다.
