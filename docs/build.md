# 빌드와 실행

## 개발

```bash
npm install        # postinstall에서 Electron 실행 파일도 내려받는다
npm run dev        # 개발 모드 실행
npm test           # 전체 테스트
npm run typecheck  # 타입 검사
```

- 개발자 도구가 필요하면 `IMWORKING_DEVTOOLS=1 npm run dev`로 실행한다.

## Windows 빌드

```bash
npm run dist:win
```

- 결과: `dist/win-unpacked/imworkinghh.exe` (설치 없이 폴더째 실행)
- 바로가기: `C:\Users\홍길동\Desktop\09_앱_바로가기\imworkinghh.lnk`
- 다시 빌드하기 전에 실행 중인 앱을 닫는다. 실행 중이면 exe를 덮어쓰지 못한다.

## macOS 빌드

맥용 앱은 맥에서만 빌드할 수 있다.

1. Node.js LTS 설치: `brew install node` 또는 https://nodejs.org
2. 저장소를 받고 폴더로 이동
3. 빌드:
   ```bash
   npm ci
   npm run dist:mac
   ```
4. 결과: `dist/imworkinghh-<버전>.dmg`. 열어서 Applications로 끌어 놓는다.
5. 서명하지 않은 앱이라 처음 한 번은 Finder에서 앱을 우클릭 → 열기 → 열기로 허용한다.

## 탐색기에서 이 앱으로 열기

- Windows: 빌드한 뒤 `powershell -ExecutionPolicy Bypass -File scripts/register-file-types.ps1`을 한 번 실행한다. 현재 사용자 레지스트리(HKCU)에만 등록하고, 다른 앱의 기존 연결은 건드리지 않는다. `.md`/`.txt` 파일을 우클릭 → 연결 프로그램 → imworkinghh를 고르고 "항상 이 앱으로 열기"를 켜면 더블클릭으로 열린다. 폴더를 옮기면 스크립트를 다시 실행한다.
- macOS: dmg로 설치하면 Finder에서 파일 우클릭 → 다음으로 열기 → imworkinghh가 보인다. 기본 앱으로 하려면 정보 가져오기 → 다음으로 열기 → 모두 변경.
- 이미 실행 중이면 새 창 대신 기존 창에서 연다.

## 데이터 위치

| 항목 | Windows | macOS |
|---|---|---|
| 설정 | `%APPDATA%\imworkinghh\settings.json` | `~/Library/Application Support/imworkinghh/settings.json` |
| 자동 백업 | `%APPDATA%\imworkinghh\backup\current.json` | `~/Library/Application Support/imworkinghh/backup/current.json` |

설정 파일이 깨지면 `settings.bad.json`으로 옮겨지고 기본값으로 시작한다.
