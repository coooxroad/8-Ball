# 구글 로그인 켜기 (소유자가 한 번 할 일)

서버 쪽은 준비돼 있습니다(`server/src/google.js`가 구글의 로그인 토큰을 검증하고, `server/src/link.js`가 구글 계정과 CUE 계정을
잇습니다). 켜려면 **OAuth 클라이언트 ID** 하나가 필요합니다. 무료이고 카드가 필요 없습니다.

## 1. 클라이언트 ID 만들기 (Google Cloud Console, 휴대폰 브라우저로도 됩니다)

1. https://console.cloud.google.com 에서 프로젝트를 하나 만듭니다(이름: CUE).
2. **API 및 서비스 → OAuth 동의 화면**: 사용자 유형 '외부', 앱 이름 CUE, 지원 이메일. 범위는 기본(이메일·프로필)만.
   처음에는 '테스트' 상태로 두고 테스트 사용자에 본인과 친구들의 구글 메일을 넣습니다(나중에 '게시').
3. **사용자 인증 정보 → 사용자 인증 정보 만들기 → OAuth 클라이언트 ID**
   - 유형: **웹 애플리케이션**
   - 승인된 JavaScript 원본: `https://cue.oxcorp.workers.dev`
4. 만들어진 **클라이언트 ID**(`…apps.googleusercontent.com`)를 Claude에게 알려 주세요. 비밀이 아닙니다(웹 페이지에 그대로 실립니다).
   클라이언트 보안 비밀번호는 필요 없고, 알려 주지 마세요.

## 2. Claude가 할 일 (ID를 받으면)

- `server/wrangler.toml`의 `[vars]`에 `GOOGLE_CLIENT_ID = "…"` → 배포되면 `/v1/link/google-config`가 ID를 알려 주고
  `/v1/link/google`이 켜집니다.
- **웹**: 설정 → 계정에 '구글로 로그인' 버튼(Google Identity Services). 처음 누르면 지금 계정에 구글 계정이 묶이고, 다른 기기의 웹에서
  누르면 같은 계정이 됩니다.
- **안드로이드 앱**: 구글은 앱 속 웹뷰에서 로그인을 막습니다. 그래서 `app/`의 껍데기에 Credential Manager(구글 로그인)를 넣고, 받은 토큰을
  페이지에 넘깁니다. 이때 Google Cloud에 **Android 클라이언트 ID**(패키지 이름 + 서명 인증서 SHA-1)도 하나 더 만들어야 합니다.
  SHA-1은 릴리스 서명 키에서 나오므로 GitHub Actions에서 뽑아 드릴 수 있습니다.

## 그 전까지

설정 → 계정 → **다른 기기 연결 / 코드로 연결**(8자 코드, 10분, 한 번)로 태블릿·폰·PC를 한 계정으로 묶을 수 있습니다.
