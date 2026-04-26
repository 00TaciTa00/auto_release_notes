# Sosik 코드 리뷰 보고서

**작성일**: 2026-04-26  
**리뷰 대상**: `/home/tacita/projects/SoSik` (Electron + React TypeScript)  
**배포 준비도**: 85/100

---

## 1. 구현 현황 요약

| 영역 | 완성도 | 상태 |
|------|--------|------|
| UI/컴포넌트 | 80% | ✅ |
| TypeScript 타입 | 100% | ✅ |
| DB 스키마 + CRUD | 100% | ✅ |
| IPC 통신 (17개 핸들러) | 100% | ✅ |
| diff 추출 (API + 로컬 git) | 100% | ✅ |
| AI 요약 (Claude) | 100% | ✅ |
| AI 요약 (OpenAI) | 0% | ❌ stub만 존재 |
| 웹훅 서버 | 100% | ✅ |
| 암호화 저장 (electron-store) | 100% | ✅ |
| 보안 파일 필터 | 100% | ✅ |
| 시스템 트레이 | 100% | ✅ |
| 테스트 | 0% | ❌ 파일 없음 |

> **이전 리뷰(2026-04-21)의 모든 CRITICAL/HIGH 이슈가 해결됨.**  
> CLAUDE.md의 현황 정보가 실제 구현보다 크게 뒤처져 있음 → 업데이트 필요.

---

## 2. 발견된 문제점

### CRITICAL — 배포 차단 이슈

#### C-1. OpenAI 제공자 미구현
- **위치**: `src/ai/openai.ts`
- **문제**: 함수 호출 시 `AIError`만 throw하는 stub 상태 (25줄 전체)
- **영향**: 사용자가 OpenAI를 선택하면 앱이 에러 발생
- **해결**: `src/ai/claude.ts`를 참고해 GPT-4o API 호출 구현

```typescript
// 현재 상태 (src/ai/openai.ts)
generate(): Promise<...> {
  throw new AIError('OpenAI 제공자는 아직 구현되지 않았습니다')
}
```

#### C-2. 웹훅 서명 검증 미구현
- **위치**: `src/main/webhook/server.ts`
- **문제**: GitLab/GitHub이 보내는 HMAC-SHA256 서명 검증 로직 없음
- **영향**: 누구나 `POST /webhook/{repoId}`로 AI 요약 트리거 가능 (로컬 바인딩이라 외부 위협은 낮으나 보안 미흡)
- **해결**: `X-Gitlab-Token` / `X-Hub-Signature-256` 헤더 검증 추가

---

### HIGH — 품질 관련

#### H-1. Anthropic API 버전 구식
- **위치**: `src/ai/claude.ts:17`
- **문제**: `anthropic-version: '2023-06-01'` 하드코딩 — 2년 전 버전
- **해결**: `'2024-06-01'` 이상으로 갱신 (Anthropic 공식 권장 버전 확인 필요)

#### H-2. Naver Works HTML 복사 미구현
- **위치**: `src/renderer/src/components/ReleaseNotes/ReleaseNoteDetail.tsx`
- **문제**: "Naver Works 복사" 버튼이 HTML이 아닌 텍스트만 복사할 가능성 있음
- **해결**: `navigator.clipboard.write()` + `ClipboardItem`으로 `text/html` MIME 타입 복사

#### H-3. IPC 핸들러 입력 검증 부재
- **위치**: `src/main/ipc/` 전체
- **문제**: 핸들러가 렌더러에서 온 매개변수를 타입만 신뢰하고 런타임 검증 없음
- **영향**: 예: `repo:add`에 잘못된 `platform` 값 전달 시 DB CHECK 제약 위반으로 unhandled error
- **해결**: 핸들러 진입 시점에 값 범위 검증 추가 (`Platform`, `DiffSource`, `AIProvider` 열거형 검사)

---

### MEDIUM

#### M-1. 테스트 파일 전무
- **위치**: `src/__tests__/` 없음 (jest.config.ts만 존재)
- **문제**: 회귀를 잡을 안전망이 없음
- **우선 작성 대상**:
  - `src/diff/securityFilter.ts` — 글로브 패턴 매칭 로직 (버그 위험 높음)
  - `src/ai/claude.ts` — 프롬프트 생성, 응답 파싱
  - `src/db/repository.ts` — CRUD 정확성

#### M-2. baselineSha 초기 값 미설정
- **위치**: `src/renderer/src/components/Sidebar/RepoAddModal.tsx`
- **문제**: 레포 등록 시 `baselineSha: ''`로 저장 → 첫 웹훅 수신 시 diff 추출 불가
- **해결**: 등록 시 API 호출로 HEAD SHA를 조회해 자동 설정, 또는 UI에서 입력 필드 제공

#### M-3. CLAUDE.md 구현 현황 미갱신
- **위치**: `/CLAUDE.md` — "미구현 모듈" 섹션
- **문제**: DB CRUD, IPC, diff, AI, webhook 등이 "미구현"으로 표시되어 있으나 실제 구현 완료
- **해결**: 현황 테이블을 실제 상태로 업데이트, 배포 준비도를 85/100으로 수정

---

### LOW

#### L-1. 암호화 키 하드코딩
- **위치**: `src/main/secure.ts:5`
- **문제**: `ENCRYPTION_KEY = 'sosik-secure-store-v1'` 고정값
- **해결**: 프로덕션에서는 머신별 엔트로피(시리얼 번호 등) 조합 권장 (현재 주석에 TODO 명시됨)

#### L-2. AI 모델 하드코딩
- **위치**: `src/ai/claude.ts`
- **문제**: `DEFAULT_MODEL = 'claude-sonnet-4-6'` 고정
- **해결**: `global_settings`에서 모델을 설정 가능하게 하거나, 적어도 상수를 named export로 분리

#### L-3. diff 대용량 처리 시 UI 블로킹 가능성
- **위치**: `src/diff/localGit.ts`
- **문제**: 로컬 git CLI 실행이 main process에서 동기 블로킹될 수 있음
- **해결**: `child_process.exec` 대신 `execFile` + async/await 패턴 확인

#### L-4. GitGraph 컴포넌트 단순 테이블
- **위치**: `src/renderer/src/components/`
- **문제**: GitGraph가 실제 DAG 시각화 없이 테이블로만 표시
- **해결**: 기획서에 시각화 요구사항이 있다면 `gitgraph.js` 같은 라이브러리 검토

---

## 3. 보안 평가

### IPC 보안 (양호)
| 항목 | 상태 |
|------|------|
| `contextIsolation: true` | ✅ |
| `nodeIntegration: false` | ✅ |
| `sandbox: true` | ✅ |
| preload 채널 화이트리스트 | ✅ |

### 데이터 저장 보안 (양호)
| 저장소 | 데이터 | 암호화 |
|--------|--------|--------|
| electron-store | API Key, Access Token, Webhook Secret | ✅ OS 키체인 수준 |
| SQLite | 메타데이터, 릴리즈 노트 | 민감 정보 없음 |

### diff 보안 (양호)
- 보안 필터가 AI 전달 **이전**에 반드시 적용됨 (`extractor.ts:115`) ✅

### 웹훅 보안 (미흡)
- 로컬 전용 바인딩(127.0.0.1)으로 외부 위협은 낮음
- 그러나 서명 검증이 없어 로컬 프로세스 악용 시 무단 AI 호출 가능 → C-2 참조

---

## 4. 코드 품질

### 강점
- TypeScript strict 100% 준수, `any` 타입 0건
- 커스텀 에러 타입 체계 (`AppError` > `DatabaseError`, `AIError` 등) 잘 구성
- 모든 SQL 쿼리가 parameterized (SQL Injection 방지)
- 함수당 50줄 미만으로 가독성 양호
- `console.log` 미사용, 전용 `logger.ts` 사용

### 개선 필요
- 테스트 파일 전무 (jest 설정만 있고 케이스 없음)
- 일부 상수 하드코딩 (API 버전, 모델명, 암호화 키)

---

## 5. 배포 전 체크리스트

```
필수 (배포 차단)
[ ] OpenAI 제공자 구현 (src/ai/openai.ts)
[ ] 웹훅 서명 검증 추가 (src/main/webhook/server.ts)

권장 (품질)
[ ] Anthropic API 버전 갱신 (src/ai/claude.ts:17)
[ ] baselineSha 초기화 자동화 (RepoAddModal.tsx)
[ ] 핵심 모듈 단위 테스트 최소 3개 작성 (securityFilter, claude, repository)

확인
[ ] Windows/macOS 빌드 성공
[ ] 레포 추가 → 웹훅 수신 → AI 요약 → DB 저장 전체 플로우 수동 검증
[ ] 액세스 토큰 암호화 저장/조회 확인
[ ] 보안 파일 제외 규칙 동작 확인
```

---

## 6. 개선 우선순위 요약

| 순위 | 항목 | 예상 작업량 |
|------|------|------------|
| 1 | OpenAI 제공자 구현 (C-1) | 2시간 |
| 2 | 웹훅 서명 검증 (C-2) | 1시간 |
| 3 | Anthropic API 버전 갱신 (H-1) | 10분 |
| 4 | IPC 입력 검증 (H-3) | 1시간 |
| 5 | baselineSha 자동 초기화 (M-2) | 1시간 |
| 6 | CLAUDE.md 현황 업데이트 (M-3) | 30분 |
| 7 | 단위 테스트 작성 (M-1) | 3시간 |
