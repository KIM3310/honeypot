const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const fs = require('fs');

let mainWindow;
let backendProcess = null;
const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;
const BACKEND_PORT = 8000;

// Python 백엔드 시작
function startBackend() {
  return new Promise((resolve, reject) => {
    try {
      let pythonPath;
      let backendScriptPath;

      if (isDev) {
        // 개발 모드: 소스 코드에서 직접 실행
        pythonPath = 'python3';
        backendScriptPath = path.join(__dirname, '../../app/main.py');

        console.log('Starting backend in development mode...');
        console.log('Python path:', pythonPath);
        console.log('Backend script path:', backendScriptPath);

        // uvicorn으로 FastAPI 실행
        backendProcess = spawn('uvicorn', [
          'app.main:app',
          '--host', '0.0.0.0',
          '--port', BACKEND_PORT.toString(),
          '--reload'
        ], {
          cwd: path.join(__dirname, '../..'),
          env: { ...process.env }
        });
      } else {
        // 프로덕션 모드: 번들된 백엔드 실행
        const platform = process.platform;
        const backendDir = path.join(process.resourcesPath, 'backend');

        if (platform === 'win32') {
          pythonPath = path.join(backendDir, 'backend.exe');
        } else {
          pythonPath = path.join(backendDir, 'backend');
        }

        console.log('Starting backend in production mode...');
        console.log('Backend executable:', pythonPath);

        if (!fs.existsSync(pythonPath)) {
          console.error('Backend executable not found:', pythonPath);
          reject(new Error('Backend executable not found'));
          return;
        }

        backendProcess = spawn(pythonPath, [], {
          env: { ...process.env }
        });
      }

      backendProcess.stdout.on('data', (data) => {
        console.log(`[Backend] ${data.toString()}`);
      });

      backendProcess.stderr.on('data', (data) => {
        console.error(`[Backend Error] ${data.toString()}`);
      });

      backendProcess.on('error', (error) => {
        console.error('Failed to start backend:', error);
        reject(error);
      });

      backendProcess.on('close', (code) => {
        console.log(`Backend process exited with code ${code}`);
        backendProcess = null;
      });

      // 백엔드가 준비될 때까지 대기
      setTimeout(() => {
        console.log('Backend should be ready');
        resolve();
      }, 3000);

    } catch (error) {
      console.error('Error starting backend:', error);
      reject(error);
    }
  });
}

// 백엔드 종료
function stopBackend() {
  if (backendProcess) {
    console.log('Stopping backend process...');
    backendProcess.kill();
    backendProcess = null;
  }
}

// 메인 윈도우 생성
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    },
    title: '꿀단지 - RAG Chatbot',
    icon: path.join(__dirname, '../public/icon.png')
  });

  // 개발 모드에서는 Vite dev 서버 로드
  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    // 프로덕션에서는 빌드된 파일 로드
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// 앱 준비 완료
app.whenReady().then(async () => {
  try {
    console.log('App is ready, starting backend...');
    await startBackend();
    console.log('Backend started, creating window...');
    createWindow();
  } catch (error) {
    console.error('Failed to start application:', error);
    app.quit();
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

// 모든 윈도우가 닫혔을 때
app.on('window-all-closed', () => {
  stopBackend();
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// 앱 종료 전
app.on('will-quit', () => {
  stopBackend();
});

// IPC 핸들러 - 백엔드 상태 확인
ipcMain.handle('check-backend', async () => {
  return {
    running: backendProcess !== null,
    port: BACKEND_PORT
  };
});
