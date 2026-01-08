#!/bin/bash

# Python 백엔드 빌드 스크립트

echo "Building Python backend with PyInstaller..."

# PyInstaller 설치 확인
if ! command -v pyinstaller &> /dev/null
then
    echo "PyInstaller not found. Installing..."
    pip install pyinstaller
fi

# 기존 빌드 정리
rm -rf build dist

# PyInstaller로 백엔드 빌드
pyinstaller backend.spec

# 빌드 결과 확인
if [ -f "dist/backend" ] || [ -f "dist/backend.exe" ]; then
    echo "✓ Backend built successfully!"
    echo "Executable location: dist/backend"

    # Electron 리소스 디렉토리로 복사 (빌드 시)
    mkdir -p frontend/electron/resources/backend
    cp -r dist/backend* frontend/electron/resources/backend/

    echo "✓ Backend copied to electron resources"
else
    echo "✗ Backend build failed!"
    exit 1
fi
