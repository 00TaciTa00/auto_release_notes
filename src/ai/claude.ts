/**
 * Claude AI 제공자 구현
 *
 * Anthropic Messages API (v1)를 직접 fetch로 호출합니다.
 * SDK 없이 구현하여 의존성을 최소화합니다.
 *
 * 모델 변경: DEFAULT_MODEL 상수만 수정하면 됩니다.
 * API 문서: https://docs.anthropic.com/en/api/messages
 */

import type { AIProvider, SummaryResult } from './provider'
import type { Repository, ChangeType } from '../shared/types'
import { AIError } from '../shared/error'
import { logger } from '../shared/logger'

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages'
const ANTHROPIC_VERSION = '2023-06-01'
// 속도/품질/비용 균형: claude-sonnet-4-6
// 고품질 원할 시 claude-opus-4-7로 변경 가능
const DEFAULT_MODEL = 'claude-sonnet-4-6'

// diff가 너무 크면 AI 응답이 불안정해지므로 잘라냄 (약 50K 토큰)
const MAX_DIFF_CHARS = 200_000

/** 요약 스타일별 지침 */
const STYLE_GUIDE: Record<string, string> = {
  detailed: '각 변경사항을 상세히 설명하고 영향 범위를 포함하세요.',
  concise: '핵심 변경사항만 간결하게 요약하세요.',
  technical: '함수명, 클래스명, API 변경사항 등 기술적 관점에서 작성하세요.',
}

/** 요약 언어 설정에 따른 프롬프트 지침 */
const LANG_GUIDE: Record<string, string> = {
  ko: '한국어로만 작성하세요. 응답 JSON에 "ko" 필드만 포함하세요.',
  en: 'Write in English only. Include only the "en" field in the response JSON.',
  both: '한국어("ko")와 영어("en") 모두 작성하세요.',
}

/** Claude에 전달할 프롬프트 구성 */
function buildPrompt(diff: string, repo: Repository): string {
  const truncatedDiff =
    diff.length > MAX_DIFF_CHARS
      ? diff.slice(0, MAX_DIFF_CHARS) + '\n\n... (diff가 너무 길어 잘렸습니다)'
      : diff

  const style = STYLE_GUIDE[repo.summaryStyle] ?? STYLE_GUIDE.detailed
  const lang = LANG_GUIDE[repo.summaryLanguage] ?? LANG_GUIDE.ko

  return `아래 Git diff를 분석하여 소프트웨어 업데이트 노트를 작성해주세요.

**레포지토리**: ${repo.name}
**요약 스타일**: ${style}
**언어 지침**: ${lang}

**Git diff**:
\`\`\`diff
${truncatedDiff}
\`\`\`

다음 JSON 형식으로만 응답하세요. 마크다운 코드 블록 없이 JSON만 출력하세요:
{
  "ko": "한국어 업데이트 노트 (마크다운 형식)",
  "en": "English release notes (markdown format)",
  "changeTypes": ["bug_fix", "feature", "ui", "performance"]
}

changeTypes는 실제 변경 내용에 해당하는 항목만 포함하세요:
- bug_fix: 버그 수정
- feature: 새 기능 추가
- ui: UI/UX 변경
- performance: 성능 개선`
}

/** Anthropic API 응답 타입 */
interface AnthropicResponse {
  content: Array<{ type: string; text: string }>
}

export class ClaudeProvider implements AIProvider {
  async generateSummary(diff: string, repo: Repository, apiKey: string): Promise<SummaryResult> {
    if (!apiKey) throw new AIError('Claude API 키가 설정되지 않았습니다. 전역 설정에서 입력하세요.', 'claude')
    if (!diff.trim()) throw new AIError('diff가 비어 있습니다. 새 커밋이 없거나 보안 필터로 모두 제거됐을 수 있습니다.', 'claude')

    const prompt = buildPrompt(diff, repo)
    logger.info('Claude API 호출', { model: DEFAULT_MODEL, repo: repo.name, diffLen: diff.length })

    const res = await fetch(ANTHROPIC_API_URL, {
      method: 'POST',
      headers: {
        'anthropic-version': ANTHROPIC_VERSION,
        'x-api-key': apiKey,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: DEFAULT_MODEL,
        max_tokens: 4096,
        messages: [{ role: 'user', content: prompt }],
      }),
    })

    if (!res.ok) {
      const errText = await res.text()
      throw new AIError(
        `Claude API 오류: ${res.status} — ${errText}`,
        'claude',
        res.status
      )
    }

    const data = (await res.json()) as AnthropicResponse
    const rawText = data.content[0]?.text ?? ''
    logger.debug('Claude 응답 수신', { chars: rawText.length })

    // 모델이 마크다운 코드 블록으로 감싸는 경우 제거
    const jsonStr = rawText.replace(/^```(?:json)?\n?|```$/gm, '').trim()

    let parsed: { ko?: string; en?: string; changeTypes?: unknown[] }
    try {
      parsed = JSON.parse(jsonStr) as typeof parsed
    } catch {
      throw new AIError(`Claude 응답 JSON 파싱 실패: ${rawText.slice(0, 300)}`, 'claude')
    }

    // changeTypes 유효성 검사 — 허용 값 외의 항목 제거
    const validTypes: ChangeType[] = ['bug_fix', 'feature', 'ui', 'performance']
    const changeTypes = (parsed.changeTypes ?? []).filter((t): t is ChangeType =>
      validTypes.includes(t as ChangeType)
    )

    return {
      ko: repo.summaryLanguage !== 'en' ? parsed.ko : undefined,
      en: repo.summaryLanguage !== 'ko' ? parsed.en : undefined,
      changeTypes,
    }
  }
}
