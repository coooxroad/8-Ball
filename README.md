# CUE

위에서 내려다보는 3D 당구(8볼·9볼·4구·3구). 게임은 웹 페이지 한 장(`web/`)이고, 안드로이드 앱(`app/`)은 그 페이지를 전체 화면으로 띄우는 얇은 껍데기입니다. 인터넷 없이 실행되며 권한을 요구하지 않습니다.

## 설치

[Releases](../../releases)에서 최신 `CUE-*.apk`를 받아 설치합니다. `main`에 push할 때마다 GitHub Actions가 새 APK를 만들어 올립니다.

## 게임

- **8볼**: 자기 공(단색 또는 줄무늬) 7개를 넣고 8번 공을 넣으면 승리.
- **9볼**: 번호가 가장 낮은 공을 먼저 맞혀야 하고, 9번 공을 넣으면 승리.
- **4구**: 포켓 없는 중대. 공 네 개를 굴려 놓고 노란 공이 먼저. 빨간 공 두 개를 모두 맞히면 득점, 이름별 수지.
- **3구**: 대대에서 쓰리쿠션.

첫 화면은 기울어진 책상입니다: **플레이**(친구와 플레이, 투어·랭킹전은 서버 준비 중), **훈련**(레슨 교본, 퍼즐, 자유 연습,
컴퓨터 대전), **내 장비**와 **상점**(큐, 공, 테이블, 트레일, 장갑 — 희귀도별 카드). 경기가 끝나면 점수지와 하이라이트가 나옵니다.

## 구조

코드 지도와 고치는 방법(스킨 추가, 스킨별 소리, 레슨, 서버 준비)은 [AGENTS.md](AGENTS.md)에 있습니다.
`web/`을 고친 뒤 `sh web/build.sh`로 `app/src/main/assets/`를 만들고, 검사 네 가지를 통과시킵니다. `main`에 올리면
GitHub Actions(`.github/workflows/build.yml`)가 APK를 만들어 릴리스합니다.

## 고정 서명 키 (선택)

키가 없으면 빌드마다 임시 키로 서명되어, 새 버전을 깔 때 기존 앱을 먼저 지워야 합니다. 한 번만 설정하면 그대로 덮어 설치됩니다.

```sh
keytool -genkeypair -v -keystore release.jks -alias eightball -keyalg RSA -keysize 2048 \
  -validity 10000 -storepass <비밀번호> -keypass <비밀번호> -dname "CN=8-Ball"
base64 -w0 release.jks
```

저장소 Settings → Secrets and variables → Actions에 두 개를 추가합니다.

- `SIGNING_KEYSTORE_B64`: 위 base64 출력 전체
- `SIGNING_PASSWORD`: 위에서 쓴 비밀번호

`release.jks` 파일은 따로 보관하세요. 잃어버리면 같은 키로 다시 서명할 수 없습니다.

## 라이선스 표기

three.js r128 (MIT). 글꼴 Gothic A1, Outfit, Jua (SIL OFL 1.1). 하이라이트 음악은 앱에 들어 있지 않습니다. 설정에서 기기 안의 노래를 고르면 그 기기에만 저장되어 쓰입니다.
