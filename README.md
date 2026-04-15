# Sosik — 업데이트 노트 자동 생성 데스크톱 앱

[![GitHub Stars](https://img.shields.io/github/stars/00TaciTa00/auto_release_notes?style=flat-square)](https://github.com/00TaciTa00/auto_release_notes/stargazers)
[![GitHub Forks](https://img.shields.io/github/forks/00TaciTa00/auto_release_notes?style=flat-square)](https://github.com/00TaciTa00/auto_release_notes/network/members)
[![GitHub Issues](https://img.shields.io/github/issues/00TaciTa00/auto_release_notes?style=flat-square)](https://github.com/00TaciTa00/auto_release_notes/issues)
[![License: MIT](https://img.shields.io/badge/License-MIT-green?style=flat-square)](LICENSE)

GitLab / GitHub 레포지토리의 배포 변경사항을 AI로 요약해 **업데이트 노트를 자동으로 생성**하는 데스크톱 앱입니다.

---

## 주요 기능

### 레포지토리 관리

- GitLab · GitHub 레포 추가 / 수정 / 삭제
- 레포별 완전 독립 설정 — AI 제공자, 요약 언어, 요약 스타일, 보안 제외 규칙
- 사이드바에서 레포 빠른 전환 (접기 / 펼치기)

### 배포 감지

- **웹훅 수신** — 레포별 고유 URL(`/webhook/{repo-id}`) 자동 발급
  - GitLab / GitHub: 레포 웹훅 설정에 URL 등록
  - 로컬 git 폴더: `post-receive` hook 스크립트 자동 생성 제공
- 신규 커밋 감지 시 OS 데스크톱 알림
- 수동 새로고침 버튼 병행 지원
- 시스템 트레이 상주 (창 닫기 → 완전 종료 아닌 트레이 최소화)

### AI 요약 생성

- **AI 제공자**: Claude / GPT (레포별 선택, API Key 전역 관리)
- **요약 언어**: 한국어 / 영어 / 한국어+영어 동시 (레포별)
- **요약 스타일**: 상세 / 간결 / 기술적 (레포별)
- 변경 유형 자동 분류: 버그수정 · 기능추가 · UI변경 · 성능개선
- Git 태그 자동 감지로 릴리즈 버전 번호 표시

### diff 추출

- GitLab / GitHub REST API 방식
- 로컬 git 폴더 방식 (PC에 clone된 경로 직접 지정)
- **이전 릴리즈 기준 SHA ~ 현재 HEAD** 범위로 자동 합산
- 레포별 보안 파일 제외 규칙 적용 후 추출 (`.env`, `.pem` 등 패턴 설정)

### 릴리즈 노트 편집 및 복사

- 마크다운 에디터로 AI 초안 직접 수정
- AI 원본 초안과 사용자 편집본 모두 SQLite에 영구 보존
- 복사 포맷 선택:
  - **Naver Works** — HTML 형식 (에디터 붙여넣기용)
  - **마크다운**
  - **일반 텍스트**

---

## 기술 스택

| 영역 | 기술 |
|------|------|
| 프레임워크 | Electron + React (TypeScript) |
| 로컬 DB | SQLite (`better-sqlite3`) |
| 민감 정보 저장 | `electron-store` (암호화) |
| diff 추출 | GitLab/GitHub REST API · 로컬 git CLI |
| AI | 추상화 레이어 — Claude / GPT 교체 가능 |
| 빌드 | electron-builder (`Windows .exe` / `macOS .dmg`) |

---

## 화면 구성

```
┌─────────────────────────────────────────────┐
│ 사이드바        │ 메인 영역                   │
│                │ [대시보드] [릴리즈노트]       │
│ [+ 레포 추가]   │ [깃 그래프] [설정]          │
│                │                             │
│ • repo-A  🔴   │  릴리즈 노트 에디터          │
│ • repo-B       │  + 복사 포맷 선택            │
│                │                             │
│ ⚙ 전역 설정    │                             │
└─────────────────────────────────────────────┘
```

- 라이트 / 다크 모드 전환
- 한 / 영 UI 언어 전환

---

## 설치 및 실행

```bash
# 의존성 설치
npm install

# 개발 모드 실행
npm run dev

# 프로덕션 빌드
npm run build
```

---

## 개발 커맨드

```bash
npm run test        # Jest 테스트
npm run lint        # ESLint 검사
npm run typecheck   # TypeScript 타입 체크
```

---

## 라이선스

MIT
