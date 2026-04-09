# Sosik — DB 스키마 설계

> 작성일: 2026-04-09
> 브랜치: plan/schema

---

## 저장소 분리 원칙

| 항목 | 저장소 | 이유 |
|------|--------|------|
| 레포 메타데이터, 설정 | SQLite | 비민감 구조화 데이터 |
| 보안 제외 규칙 | SQLite | 비민감 구조화 데이터 |
| 릴리즈 노트 (초안, 편집본, raw diff) | SQLite | 비민감 구조화 데이터 |
| 전역 앱 설정 (언어, 테마, 웹훅 포트 등) | SQLite | 비민감 설정 |
| API Key (Claude, OpenAI, Naver Works) | electron-store (암호화) | 민감 정보 |
| 레포별 Access Token | electron-store (암호화) | 민감 정보 |
| 웹훅 시크릿 토큰 | electron-store (암호화) | 민감 정보 |

> CLAUDE.md 규칙: "민감 정보(API Key, Access Token)는 반드시 electron-store 암호화 저장"

---

## 테이블 목록

| 테이블 | 설명 |
|--------|------|
| `repositories` | 레포지토리 목록 및 레포별 설정 |
| `security_exclusion_rules` | 보안 파일 제외 규칙 (레포별 독립) |
| `release_notes` | 릴리즈 노트 — AI 초안 + 사용자 편집본 |
| `global_settings` | 전역 비민감 설정 (key-value) |

---

## 테이블 상세

### `repositories`

레포지토리 목록 및 레포별 설정을 저장한다.  
`id`는 UUID를 사용한다 — 웹훅 수신 경로(`/webhook/{id}`)에 노출되므로 예측 불가능한 값이 필요하다.

| 컬럼 | 타입 | 제약 | 설명 |
|------|------|------|------|
| `id` | TEXT | PK | UUID v4 |
| `name` | TEXT | NOT NULL | 표시 이름 |
| `platform` | TEXT | NOT NULL, CHECK ('gitlab'\|'github') | 플랫폼 (등록 후 읽기 전용) |
| `diff_source` | TEXT | NOT NULL, CHECK ('api'\|'local_git') | diff 소스 방식 (등록 후 읽기 전용) |
| `repo_url` | TEXT | NOT NULL | 저장소 URL (등록 후 읽기 전용) |
| `local_path` | TEXT | NULL 허용 | 로컬 git 폴더 경로 (`diff_source = 'local_git'` 일 때만 사용) |
| `ai_provider` | TEXT | NOT NULL, DEFAULT 'claude', CHECK ('claude'\|'gpt') | AI 제공자 (레포별) |
| `summary_language` | TEXT | NOT NULL, DEFAULT 'ko', CHECK ('ko'\|'en'\|'both') | 요약 언어 (레포별) |
| `summary_style` | TEXT | NOT NULL, DEFAULT 'detailed', CHECK ('detailed'\|'concise'\|'technical') | 요약 스타일 (레포별) |
| `baseline_sha` | TEXT | NULL 허용 | 다음 diff의 시작 기준 SHA — 등록 시 HEAD로 초기화, 릴리즈 노트 생성 후 `to_sha`로 갱신 |
| `display_order` | INTEGER | NOT NULL, DEFAULT 0 | 사이드바 정렬 순서 |
| `created_at` | TEXT | NOT NULL, DEFAULT datetime('now') | 생성 시각 (ISO 8601) |
| `updated_at` | TEXT | NOT NULL, DEFAULT datetime('now') | 수정 시각 (ISO 8601) |

**읽기 전용 컬럼**: `platform`, `diff_source`, `repo_url`  
**수정 가능 컬럼**: `name`, `ai_provider`, `summary_language`, `summary_style`, `display_order`  
**Access Token**: electron-store에 `repo:{id}:access_token` 키로 별도 저장

---

### `security_exclusion_rules`

레포마다 완전히 독립된 보안 파일 제외 규칙.

| 컬럼 | 타입 | 제약 | 설명 |
|------|------|------|------|
| `id` | INTEGER | PK AUTOINCREMENT | |
| `repo_id` | TEXT | NOT NULL, FK → repositories(id) ON DELETE CASCADE | |
| `pattern` | TEXT | NOT NULL | 경로/확장자 패턴 (예: `**/.env`, `.pem`) |
| `created_at` | TEXT | NOT NULL, DEFAULT datetime('now') | |

**인덱스**: `idx_security_rules_repo (repo_id)`

---

### `release_notes`

AI가 생성한 원본 초안과 사용자가 수정한 편집본을 모두 보존한다.  
한국어/영어 각각 독립 컬럼으로 관리한다 — `summary_language` 설정에 따라 일부는 NULL.

| 컬럼 | 타입 | 제약 | 설명 |
|------|------|------|------|
| `id` | INTEGER | PK AUTOINCREMENT | |
| `repo_id` | TEXT | NOT NULL, FK → repositories(id) ON DELETE CASCADE | |
| `from_sha` | TEXT | NOT NULL | diff 시작 커밋 SHA |
| `to_sha` | TEXT | NOT NULL | diff 끝 커밋 SHA (HEAD) |
| `version_tag` | TEXT | NULL 허용 | Git 태그 (태그 없으면 NULL) |
| `raw_diff` | TEXT | NOT NULL | 보안 제외 규칙 적용 후 원본 diff |
| `ai_draft_ko` | TEXT | NULL 허용 | AI 원본 (한국어) |
| `ai_draft_en` | TEXT | NULL 허용 | AI 원본 (영어) |
| `edited_ko` | TEXT | NULL 허용 | 사용자 편집본 (한국어) — 편집 전 NULL |
| `edited_en` | TEXT | NULL 허용 | 사용자 편집본 (영어) — 편집 전 NULL |
| `change_types` | TEXT | NULL 허용 | JSON 배열 — `["bug_fix","feature","ui","performance"]` |
| `created_at` | TEXT | NOT NULL, DEFAULT datetime('now') | |
| `updated_at` | TEXT | NOT NULL, DEFAULT datetime('now') | |

**인덱스**:
- `idx_release_notes_repo (repo_id)`
- `idx_release_notes_created (repo_id, created_at DESC)` — 목록 조회 최적화

**표시 우선순위**: `edited_ko ?? ai_draft_ko` (편집본 우선, 없으면 AI 초안)

---

### `global_settings`

전역 비민감 설정을 key-value로 저장한다.

| 컬럼 | 타입 | 제약 |
|------|------|------|
| `key` | TEXT | PK |
| `value` | TEXT | NOT NULL |
| `updated_at` | TEXT | NOT NULL, DEFAULT datetime('now') |

**초기값**:

| key | 기본값 | 설명 |
|-----|--------|------|
| `app_language` | `'ko'` | 앱 UI 언어 (ko / en) |
| `app_theme` | `'light'` | 테마 (light / dark) |
| `startup_launch` | `'false'` | 시작 프로그램 등록 여부 |
| `webhook_enabled` | `'false'` | 웹훅 수신 ON/OFF |
| `webhook_port` | `'45678'` | 웹훅 수신 로컬 포트 |

---

## electron-store 키 구조

```
claude_api_key                  # Claude API Key
openai_api_key                  # OpenAI API Key
naver_works_api_key             # Naver Works API Key
webhook_secret_token            # 웹훅 시크릿 토큰 (전역)
repo:{uuid}:access_token        # 레포별 Access Token
```

---

## 핵심 설계 결정

### 1. `repositories.id` → UUID

웹훅 경로 `/webhook/{id}`에 노출되는 값이므로 예측 불가능한 UUID 사용.  
다른 테이블은 INTEGER AUTOINCREMENT 사용.

### 2. `baseline_sha` 흐름

```
레포 등록
  └→ baseline_sha = 등록 시점의 origin/main HEAD

릴리즈 노트 생성
  └→ from_sha = baseline_sha
  └→ to_sha   = 현재 origin/main HEAD
  └→ baseline_sha 갱신 = to_sha
```

첫 릴리즈 노트 생성 전에는 `baseline_sha`가 등록 시점 HEAD로 유지된다.

### 3. AI 초안 vs 편집본 분리

`ai_draft_*`는 불변 보존 — AI가 생성한 원본.  
`edited_*`는 사용자 수정본 — 처음에는 NULL, 수정 시 저장.  
UI 표시는 `edited_*`가 있으면 편집본, 없으면 AI 초안을 보여준다.

### 4. `change_types` JSON 컬럼

변경 유형은 중복 가능(버그수정이면서 기능추가)하므로 배열 JSON으로 저장.  
값 후보: `"bug_fix"` / `"feature"` / `"ui"` / `"performance"`

### 5. 민감 정보 분리

API Key, Access Token, Webhook Secret은 SQLite에 저장하지 않는다.  
electron-store가 OS 키체인 수준의 암호화를 제공한다.
