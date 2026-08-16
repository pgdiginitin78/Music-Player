@echo off
setlocal enabledelayedexpansion

cd /d "%~dp0"
echo ===================================================
echo   Starting PARO Python Voice Microservice
echo ===================================================
echo Working Directory: %CD%
echo.

if not exist venv (
    echo Creating Python Virtual Environment...
    python -m venv venv
    if errorlevel 1 (
        echo [ERROR] Failed to create virtual environment. Ensure Python is installed and added to PATH.
        pause
        exit /b 1
    )
)

echo Activating Virtual Environment...
call venv\Scripts\activate.bat

echo Installing required Python packages...
pip install -r requirements.txt
if errorlevel 1 (
    echo [WARNING] Retrying dependency installation with base packages...
    pip install fastapi uvicorn websockets SpeechRecognition pyttsx3 numpy
)

echo.
echo Starting PARO Voice Microservice on http://127.0.0.1:5050 ...
python main.py

if errorlevel 1 (
    echo.
    echo [ERROR] PARO Voice Microservice exited with an error.
    pause
    exit /b 1
)

pause
