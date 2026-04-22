import { useState } from 'react'
import { useApp } from '../../contexts/AppContext'
import { Modal } from '../common/Modal'
import { Button } from '../common/Button'
import { useToast } from '../common/Toast'
import { api } from '../../lib/api'
import styles from './GlobalSettingsModal.module.css'

interface GlobalSettingsModalProps {
  isOpen: boolean
  onClose: () => void
}

export function GlobalSettingsModal({ isOpen, onClose }: GlobalSettingsModalProps) {
  const { settings, setSettings } = useApp()
  const { showToast } = useToast()

  const [claudeKey, setClaudeKey] = useState('')
  const [openaiKey, setOpenaiKey] = useState('')
  const [naverWorksKey, setNaverWorksKey] = useState('')
  const [theme, setTheme] = useState(settings.appTheme)
  const [language, setLanguage] = useState(settings.appLanguage)
  const [startupLaunch, setStartupLaunch] = useState(settings.startupLaunch)
  const [webhookEnabled, setWebhookEnabled] = useState(settings.webhookEnabled)
  const [webhookPort, setWebhookPort] = useState(String(settings.webhookPort))
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    setSaving(true)
    try {
      const patch = {
        appTheme: theme,
        appLanguage: language,
        startupLaunch,
        webhookEnabled,
        webhookPort: Number(webhookPort) || 45678,
      }

      await api.settings.update(patch)

      const keyOps: Promise<void>[] = []
      if (claudeKey.trim()) keyOps.push(api.secure.setApiKey('claudeApiKey', claudeKey.trim()))
      if (openaiKey.trim()) keyOps.push(api.secure.setApiKey('openaiApiKey', openaiKey.trim()))
      if (naverWorksKey.trim())
        keyOps.push(api.secure.setApiKey('naverWorksApiKey', naverWorksKey.trim()))
      await Promise.all(keyOps)

      setSettings(patch)
      showToast('설정이 저장되었습니다', 'success')
      onClose()
    } catch {
      showToast('설정 저장에 실패했습니다', 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="전역 설정" width={520}>
      <div className={styles.sections}>
        <section className={styles.section}>
          <h3 className={styles.sectionTitle}>AI API 설정</h3>
          <div className={styles.field}>
            <label className={styles.label}>Claude API Key</label>
            <input
              type="password"
              value={claudeKey}
              onChange={(e) => setClaudeKey(e.target.value)}
              placeholder="sk-ant-..."
              className={styles.input}
              autoComplete="off"
            />
          </div>
          <div className={styles.field}>
            <label className={styles.label}>OpenAI API Key</label>
            <input
              type="password"
              value={openaiKey}
              onChange={(e) => setOpenaiKey(e.target.value)}
              placeholder="sk-..."
              className={styles.input}
              autoComplete="off"
            />
          </div>
        </section>

        <section className={styles.section}>
          <h3 className={styles.sectionTitle}>Naver Works</h3>
          <div className={styles.field}>
            <label className={styles.label}>Naver Works API Key</label>
            <input
              type="password"
              value={naverWorksKey}
              onChange={(e) => setNaverWorksKey(e.target.value)}
              placeholder="API Key 입력..."
              className={styles.input}
              autoComplete="off"
            />
          </div>
        </section>

        <section className={styles.section}>
          <h3 className={styles.sectionTitle}>앱 설정</h3>
          <div className={styles.row}>
            <div className={styles.field}>
              <label className={styles.label}>테마</label>
              <select
                value={theme}
                onChange={(e) => setTheme(e.target.value as 'light' | 'dark')}
                className={styles.select}
              >
                <option value="light">라이트</option>
                <option value="dark">다크</option>
              </select>
            </div>
            <div className={styles.field}>
              <label className={styles.label}>언어</label>
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value as 'ko' | 'en')}
                className={styles.select}
              >
                <option value="ko">한국어</option>
                <option value="en">English</option>
              </select>
            </div>
          </div>
          <label className={styles.checkboxRow}>
            <input
              type="checkbox"
              checked={startupLaunch}
              onChange={(e) => setStartupLaunch(e.target.checked)}
            />
            <span>시작 프로그램으로 등록</span>
          </label>
        </section>

        <section className={styles.section}>
          <h3 className={styles.sectionTitle}>웹훅 설정</h3>
          <label className={styles.checkboxRow}>
            <input
              type="checkbox"
              checked={webhookEnabled}
              onChange={(e) => setWebhookEnabled(e.target.checked)}
            />
            <span>웹훅 수신 활성화</span>
          </label>
          {webhookEnabled && (
            <div className={styles.field}>
              <label className={styles.label}>포트</label>
              <input
                type="number"
                value={webhookPort}
                onChange={(e) => setWebhookPort(e.target.value)}
                min={1024}
                max={65535}
                className={styles.input}
                style={{ width: 120 }}
              />
            </div>
          )}
        </section>
      </div>

      <div className={styles.actions}>
        <Button variant="ghost" onClick={onClose} disabled={saving}>
          취소
        </Button>
        <Button variant="primary" onClick={handleSave} loading={saving}>
          저장
        </Button>
      </div>
    </Modal>
  )
}
