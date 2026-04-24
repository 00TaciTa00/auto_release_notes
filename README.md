# Sosik

> GitLab · GitHub 배포 변경사항을 AI로 분석하고, 팀 전달용 업데이트 노트를 자동 생성하는 데스크톱 앱

[![Electron](https://img.shields.io/badge/Electron-28-47848F?style=flat-square&logo=electron&logoColor=white)](https://www.electronjs.org/)
[![React](https://img.shields.io/badge/React-18-61DAFB?style=flat-square&logo=react&logoColor=black)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-3178C6?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![SQLite](https://img.shields.io/badge/SQLite-better--sqlite3-003B57?style=flat-square&logo=sqlite&logoColor=white)](https://github.com/WiseLibs/better-sqlite3)
[![License: MIT](https://img.shields.io/badge/License-MIT-green?style=flat-square)](LICENSE)
[![GitHub Stars](https://img.shields.io/github/stars/00TaciTa00/SoSik?style=flat-square)](https://github.com/00TaciTa00/SoSik/stargazers)

---

## 왜 만들었나

배포 직후마다 반복되는 루틴이 있었습니다.

1. `git log`나 GitLab MR 목록을 열어 변경사항 확인
2. `.env`, 인증서 등 민감 파일은 직접 걸러내기
3. 팀에 전달할 언어로 내용 요약 작성
4. Naver Works · Slack 포맷에 맞춰 다시 가공

**Sosik**은 이 흐름을 자동화합니다. 레포를 등록하면 배포를 감지하고, 보안 파일을 제외한 diff를 추출해 Claude 또는 GPT로 요약한 뒤 바로 복사할 수 있는 형태로 제공합니다.

---

## 주요 기능

### 배포 감지
- 레포별 고유 웹훅 URL(`localhost:45678/webhook/{id}`) 자동 발급
- GitLab · GitHub 웹훅, 로컬 git `post-receive` hook 모두 지원
- 신규 커밋 감지 시 OS 데스크톱 알림

### AI 요약 생성
- **Claude / OpenAI GPT** 교체 가능한 추상화 레이어
- 변경 유형 자동 분류: 버그수정 · 기능추가 · UI변경 · 성능개선
- 요약 언어(한국어 / 영어 / 동시), 스타일(상세 / 간결 / 기술적) 레포별 독립 설정

### diff 추출 및 보안 필터
- GitLab · GitHub REST API 방식 또는 로컬 git CLI 방식
- **보안 파일 제외 필터가 diff 추출 전에 반드시 적용** (`.env`, `*.pem` 등 패턴 레포별 관리)
- 이전 릴리즈 SHA ~ 현재 HEAD 범위 자동 계산

### 릴리즈 노트 편집 및 복사
- AI 초안과 사용자 편집본 모두 SQLite에 영구 보존
- 복사 포맷 선택: **Naver Works**(HTML) · 마크다운 · 일반 텍스트

---

## 기술 스택

| 영역 | 기술 | 선택 이유 |
|------|------|---------|
| 프레임워크 | Electron 28 + React 18 | 크로스 플랫폼 데스크톱, 웹 생태계 활용 |
| 언어 | TypeScript 5.3 (strict) | 타입 안전성, IPC 채널 타입 공유 |
| 로컬 DB | SQLite (`better-sqlite3`) | 클라우드 불필요, 빠른 동기 API |
| 민감 정보 | `electron-store` (암호화) | OS 키체인 수준 보안, API 키 보호 |
| AI | Claude API · OpenAI API | 추상화 레이어로 교체 가능 |
| 빌드 | electron-builder | Windows `.exe` / macOS `.dmg` 단일 커맨드 |
| 스타일 | CSS Modules + CSS 변수 | 라이트/다크 테마, 스코프 충돌 없음 |
| i18n | 커스텀 번역 훅 | 한국어/영어 전환, 외부 라이브러리 의존 없음 |

---

## 아키텍처

```
┌─────────────────────────────────────────────────┐
│                  Main Process (Node.js)          │
│  ┌──────────┐  ┌──────────┐  ┌───────────────┐  │
│  │  SQLite  │  │ electron │  │ Webhook       │  │
│  │   CRUD   │  │  -store  │  │ HTTP Server   │  │
│  │ src/db/  │  │(암호화)   │  │ :45678        │  │
│  └──────────┘  └──────────┘  └───────────────┘  │
│  ┌──────────┐  ┌──────────┐                      │
│  │   diff   │  │    AI    │                      │
│  │extractor │  │ provider │                      │
│  │ src/diff/│  │ src/ai/  │                      │
│  └──────────┘  └──────────┘                      │
│           ▲ ipcMain.handle()                     │
└───────────│─────────────────────────────────────┘
            │ 채널 화이트리스트 (preload)
┌───────────│─────────────────────────────────────┐
│  Renderer Process (React)   contextIsolation=true│
│           │                  nodeIntegration=false│
│  ┌────────┴──────────────────────────────────┐   │
│  │  AppContext → 레포 / 릴리즈노트 / 설정 상태 │   │
│  └───────────────────────────────────────────┘   │
│  Dashboard · ReleaseNotes · GitGraph · Settings  │
└─────────────────────────────────────────────────┘

공유 레이어: src/shared/ — 타입 · 에러 클래스 · 로거
```

**IPC 통신 흐름**: `window.api.invoke(channel, ...args)` → preload 화이트리스트 검증 → `ipcMain.handle()` → DB / AI / diff 실행 → 응답 반환

---

## 구현 하이라이트

### AI 교체 가능 추상화 레이어

`src/ai/provider.ts`에 인터페이스를 정의하고, `claude.ts`와 `openai.ts`가 각각 구현합니다. 레포 설정에서 제공자를 바꾸면 동일 인터페이스로 동작하며, 향후 다른 모델 추가 시 기존 코드를 건드리지 않습니다.

### 보안 파일 제외 순서 보장

diff 추출 함수 내부에서 `securityFilter.ts`를 반드시 먼저 통과한 뒤 AI로 전송합니다. 이 순서는 아키텍처 수준에서 강제되며, 필터를 우회해 민감 정보가 외부로 전송되는 경로가 없습니다.

### IPC 채널 화이트리스트

preload에서 허용된 채널 목록만 renderer에 노출합니다. renderer가 임의 채널을 호출하거나 Node.js API에 직접 접근하는 경로를 차단합니다.

### 로컬 우선 데이터 보관

모든 릴리즈 노트와 설정은 기기 내 SQLite에 저장됩니다. API 키만 OS 수준 암호화 저장소(`electron-store`)에 별도 보관하며, 서버로 전송되는 데이터는 없습니다.

---

## 화면 구성

```
┌───────────────┬────────────────────────────────────┐
│  사이드바      │  [대시보드] [릴리즈노트]              │
│               │  [깃 그래프] [설정]                  │
│  [+ 레포 추가] │                                    │
│               │  ┌──────────────────────────────┐  │
│  • repo-A 🔴  │  │  AI 초안          │  편집창    │  │
│  • repo-B     │  │  (읽기 전용)       │  (수정 가능)│  │
│               │  └──────────────────────────────┘  │
│  ⚙ 전역 설정  │  [Naver Works] [마크다운] [텍스트]   │
└───────────────┴────────────────────────────────────┘
```

라이트 / 다크 모드 전환 · 한 / 영 UI 언어 전환

---

## 설치 및 실행

```bash
# 의존성 설치 (네이티브 모듈 자동 rebuild 포함)
npm install

# 개발 모드
npm run dev

# 프로덕션 빌드
npm run build
```

> `npm install` 실행 시 `postinstall` 훅이 `electron-rebuild`를 자동 실행해 `better-sqlite3`를 현재 Electron 버전 ABI에 맞게 컴파일합니다.

---

## 개발 커맨드

```bash
npm run typecheck   # TypeScript 타입 체크
npm run lint        # ESLint 검사
npm run test        # Jest 테스트
```

---

## 구현 현황

| 모듈 | 상태 |
|------|------|
| UI — React 컴포넌트, 라이트/다크, 한/영 i18n | ✅ 완료 |
| SQLite 스키마 및 CRUD (`src/db/`) | ✅ 완료 |
| IPC 핸들러 (`src/main/ipc/`) | ✅ 완료 |
| electron-store 암호화 저장 | ✅ 완료 |
| diff 추출 — API · 로컬 git (`src/diff/`) | ✅ 완료 |
| 보안 파일 제외 필터 | ✅ 완료 |
| AI 요약 — Claude · OpenAI (`src/ai/`) | ✅ 완료 |
| 웹훅 수신 서버 | ✅ 완료 |
| 시스템 트레이 | 🔲 미구현 |

상세 검토 결과: [`docs/review/deploy-readiness-260421.md`](docs/review/deploy-readiness-260421.md)

---

## 라이선스

MIT
