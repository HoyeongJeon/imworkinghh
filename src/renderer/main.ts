const api = window.imworking
api.onCloseRequested(() => api.closeWindowNow())
document.getElementById('app')!.textContent = `imworkinghh (${api.platform})`
