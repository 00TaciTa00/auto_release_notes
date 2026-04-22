import { useApp } from '../contexts/AppContext'
import { translations } from './translations'

/**
 * 현재 앱 언어 설정에 맞는 번역 객체를 반환합니다.
 *
 * settings.appLanguage 가 변경되면 번역도 즉시 반응합니다.
 *
 * 사용 예:
 *   const t = useTranslation()
 *   <Button>{t.common.save}</Button>
 */
export function useTranslation() {
  const { settings } = useApp()
  return translations[settings.appLanguage] ?? translations.ko
}
