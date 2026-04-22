/**
 * AI 제공자 추상화 레이어
 *
 * Claude / OpenAI 간 교체가 가능하도록 인터페이스를 정의합니다.
 * 새 AI 제공자 추가 방법:
 *   1. AIProvider 인터페이스를 구현하는 클래스 작성
 *   2. createAIProvider() switch에 케이스 추가
 */

import type { Repository, ChangeType } from '../shared/types'
import { ClaudeProvider } from './claude'
import { OpenAIProvider } from './openai'
import { AIError } from '../shared/error'

/** AI 요약 생성 결과 */
export interface SummaryResult {
  /** 한국어 업데이트 노트 (summaryLanguage='en'이면 undefined) */
  ko?: string
  /** 영어 업데이트 노트 (summaryLanguage='ko'이면 undefined) */
  en?: string
  /** 변경 유형 분류 — diff에 해당하는 항목만 포함 */
  changeTypes: ChangeType[]
}

/**
 * 모든 AI 제공자가 구현해야 하는 인터페이스
 *
 * 새 제공자 추가 시 이 인터페이스를 구현하고 createAIProvider()에 등록하세요.
 */
export interface AIProvider {
  /**
   * diff를 분석하여 릴리즈 노트를 생성합니다.
   *
   * @param diff    보안 필터가 적용된 diff 텍스트 (민감 파일 제거됨)
   * @param repo    레포지토리 정보 — 요약 언어, 스타일 설정 포함
   * @param apiKey  해당 AI 서비스의 API 키
   */
  generateSummary(diff: string, repo: Repository, apiKey: string): Promise<SummaryResult>
}

/**
 * 레포 설정의 aiProvider 값에 따라 AI 제공자 인스턴스를 반환합니다.
 *
 * 의존성 주입 없이 팩토리 패턴으로 구현합니다.
 */
export function createAIProvider(aiProvider: Repository['aiProvider']): AIProvider {
  switch (aiProvider) {
    case 'claude':
      return new ClaudeProvider()
    case 'openai':
      return new OpenAIProvider()
    default: {
      // TypeScript exhaustive check — 새 AIProvider 타입 추가 시 여기서 컴파일 오류 발생
      const _never: never = aiProvider
      throw new AIError(`지원하지 않는 AI 제공자입니다: ${_never}`)
    }
  }
}
