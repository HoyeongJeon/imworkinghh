import './styles.css'
import { startApp } from './app'

const api = window.imworking

startApp(api, document).catch((error: unknown) => {
  // 시작에 실패해도 창은 닫을 수 있어야 한다. 닫기 확인에 답할 화면이 없으면 창이 닫히지 않는다.
  document.body.textContent = `failed to start: ${String(error)}`
  api.onCloseRequested(() => api.closeWindowNow())
})
