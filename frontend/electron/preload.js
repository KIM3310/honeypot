const { contextBridge, ipcRenderer } = require('electron');

// 안전하게 렌더러 프로세스에 API 노출
contextBridge.exposeInMainWorld('electronAPI', {
  // 백엔드 상태 확인
  checkBackend: () => ipcRenderer.invoke('check-backend'),

  // 환경 정보
  platform: process.platform,
  isElectron: true
});
