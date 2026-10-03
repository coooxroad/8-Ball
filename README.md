# 딥 포켓 8볼

위에서 내려다보는 3D 8볼 당구. 게임은 웹 페이지 한 장(`web/`)이고, 안드로이드 앱(`app/`)은 그 페이지를 전체 화면으로 띄우는 얇은 껍데기입니다. 인터넷 없이 실행되며 권한을 요구하지 않습니다.

## 설치

[Releases](../../releases)에서 최신 `DeepPocket8Ball-*.apk`를 받아 설치합니다. `main`에 push할 때마다 GitHub Actions가 새 APK를 만들어 올립니다.

## 게임

- **8볼**: 자기 공(단색 또는 줄무늬) 7개를 넣고 8번 공을 넣으면 승리.
- **9볼**: 번호가 가장 낮은 공을 먼저 맞혀야 하고, 9번 공을 넣으면 승리.
- **4구**: 포켓 없는 테이블. 자기 공으로 빨간 공 두 개를 모두 맞히면 1점, 상대 공을 맞히거나 빨간 공을 못 맞히면 1점 감점.

둘이서 태블릿 한 대로 번갈아 치거나 컴퓨터와 겨룹니다. 전적은 이름별로 기기에 저장됩니다.

## 구조

| 경로 | 내용 |
| --- | --- |
| `web/physics.js` | 공·쿠션·포켓 물리, 조준 예측. 포켓 유무와 공 크기를 설정으로 받음 |
| `web/game.js` | 게임별 규칙, 차례 진행, 기록, 컴퓨터 상대 |
| `web/scene.js` | three.js 장면. 움직이지 않는 배경·테이블은 한 번만 그려 텍스처로 재사용 |
| `web/main.js` | 화면 전환, 입력, 저장 |
| `web/head.html` | 화면 구성과 스타일 |
| `web/build.sh` | 위 파일을 합쳐 `app/src/main/assets/index.html`을 만듦 |
| `app/` | WebView 껍데기 (회전 따라가기, 전체 화면, 화면 꺼짐 방지) |
| `.github/workflows/build.yml` | APK 빌드와 릴리스 |

`web/`을 고친 뒤에는 `sh web/build.sh`를 실행해 `assets/`를 갱신하고 함께 커밋합니다.

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

three.js r128 (MIT). 글꼴 Jua, Black Han Sans, Lilita One (SIL OFL 1.1)
