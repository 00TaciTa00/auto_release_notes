/**
 * 웹훅 HTTP 서버
 *
 * GitLab/GitHub에서 배포 이벤트를 수신하고 자동으로
 * diff 추출 및 AI 요약을 트리거합니다.
 *
 * URL 형식: POST http://localhost:{port}/webhook/{repoId}
 * 응답: 202 Accepted (즉시 반환, 처리는 비동기)
 */

import * as http from 'http'
import { getRepoById } from '../../db/repository'
import { getPatternsByRepo } from '../../db/securityRule'
import { getSettings } from '../../db/settings'
import { getSecureKey } from '../secure'
import { extractDiff } from '../../diff/extractor'
import { createAIProvider } from '../../ai/provider'
import { createNote } from '../../db/releaseNote'
import { logger } from '../../shared/logger'

let server: http.Server | null = null

/**
 * 웹훅 서버를 시작합니다.
 *
 * settings.webhookEnabled가 false면 시작하지 않습니다.
 * 127.0.0.1(루프백)에만 바인딩하여 외부 접근을 차단합니다.
 */
export function startWebhookServer(): void {
  const settings = getSettings()
  if (!settings.webhookEnabled) {
    logger.info('웹훅 서버 비활성화 상태 — 시작 건너뜀')
    return
  }

  const port = settings.webhookPort

  server = http.createServer((req, res) => {
    handleRequest(req, res).catch((err) => {
      logger.error('웹훅 요청 처리 오류', { err: String(err) })
      if (!res.headersSent) {
        res.writeHead(500, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: 'internal server error' }))
      }
    })
  })

  server.listen(port, '127.0.0.1', () => {
    logger.info(`웹훅 서버 시작: http://127.0.0.1:${port}/webhook/{repoId}`)
  })

  server.on('error', (err) => {
    logger.error('웹훅 서버 오류', { err: String(err) })
  })
}

/** 웹훅 서버를 종료합니다. */
export function stopWebhookServer(): void {
  if (server) {
    server.close()
    server = null
    logger.info('웹훅 서버 종료')
  }
}

/**
 * HTTP 요청 핸들러
 *
 * POST /webhook/{repoId} 만 처리하고 나머지는 404 반환합니다.
 * GitLab/GitHub 타임아웃 방지를 위해 202를 즉시 반환 후 비동기 처리합니다.
 */
async function handleRequest(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
  const match = req.url?.match(/^\/webhook\/([^/]+)$/)
  if (req.method !== 'POST' || !match) {
    res.writeHead(404, { 'Content-Type': 'text/plain' })
    res.end('Not Found')
    return
  }

  const repoId = decodeURIComponent(match[1]!)
  logger.info(`웹훅 수신: repoId=${repoId}`)

  // 즉시 202 응답 — GitLab/GitHub는 응답이 느리면 재전송하므로 먼저 반환
  res.writeHead(202, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify({ status: 'accepted' }))

  processWebhook(repoId).catch((err) => {
    logger.error(`웹훅 처리 실패: repoId=${repoId}`, { err: String(err) })
  })
}

/**
 * 웹훅 이벤트를 처리합니다.
 *
 * 흐름: 레포 조회 → diff 추출 → 보안 필터 → AI 요약 → DB 저장
 * baselineSha 미설정이거나 diff가 비어 있으면 조용히 종료합니다.
 */
async function processWebhook(repoId: string): Promise<void> {
  const repo = getRepoById(repoId)
  if (!repo) {
    logger.error(`웹훅: 레포를 찾을 수 없음 — repoId=${repoId}`)
    return
  }

  if (!repo.baselineSha) {
    logger.info(`웹훅: baselineSha 미설정 — repoId=${repoId}, 건너뜀`)
    return
  }

  const token = getSecureKey(`repo:${repoId}:access_token`) ?? ''
  const securityPatterns = getPatternsByRepo(repoId)

  const { diff, fromSha, toSha } = await extractDiff(repo, token, securityPatterns)

  if (!diff.trim()) {
    logger.info(`웹훅: 추출된 diff 없음 (보안 필터 이후) — repoId=${repoId}`)
    return
  }

  const keyName = repo.aiProvider === 'claude' ? 'claudeApiKey' : 'openaiApiKey'
  const apiKey = getSecureKey(keyName) ?? ''

  const provider = createAIProvider(repo.aiProvider)
  const summary = await provider.generateSummary(diff, repo, apiKey)

  createNote({
    repoId,
    fromSha,
    toSha,
    rawDiff: diff,
    aiDraftKo: summary.ko,
    aiDraftEn: summary.en,
    changeTypes: summary.changeTypes,
  })

  logger.info(
    `웹훅: 릴리즈 노트 생성 완료 — repoId=${repoId}, ${fromSha.slice(0, 7)}..${toSha.slice(0, 7)}`
  )
}
