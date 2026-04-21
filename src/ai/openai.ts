/**
 * OpenAI 제공자 구현 (스텁)
 *
 * 현재는 미구현 상태입니다. P2에서 완성 예정.
 * claude.ts와 동일한 AIProvider 인터페이스를 구현합니다.
 *
 * 구현 예정 엔드포인트:
 *   POST https://api.openai.com/v1/chat/completions
 *   model: gpt-4o 또는 gpt-4-turbo
 */

import type { AIProvider, SummaryResult } from './provider'
import type { Repository } from '../shared/types'
import { AIError } from '../shared/error'

export class OpenAIProvider implements AIProvider {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async generateSummary(_diff: string, _repo: Repository, _apiKey: string): Promise<SummaryResult> {
    // TODO(P2): OpenAI Chat Completions API 구현
    throw new AIError(
      'OpenAI 제공자는 아직 구현되지 않았습니다. 레포 설정에서 AI 제공자를 Claude로 변경하세요.',
      'openai'
    )
  }
}
