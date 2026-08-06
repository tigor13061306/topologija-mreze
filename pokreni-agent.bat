@echo off
chcp 65001 >nul
title Topologija - Nadzor agent
cd /d "%~dp0"
echo ============================================================
echo   Topologija mreze - Nadzor agent
echo   Adresa: http://localhost:8765   (ostavi ovaj prozor otvoren)
echo ============================================================
echo.

REM 1) provjeri da li Python postoji
python --version >nul 2>&1
if errorlevel 1 (
  echo [GRESKA] Python nije pronadjen.
  echo Instaliraj Python 3 sa https://www.python.org/downloads/  ^(cekiraj "Add to PATH"^)
  echo pa ponovo pokreni ovaj fajl.
  echo.
  pause
  exit /b 1
)

REM 2) provjeri pakete; ako fale, instaliraj (treba internet samo prvi put)
python -c "import fastapi, uvicorn" >nul 2>&1
if errorlevel 1 (
  echo Instaliram potrebne pakete jednokratno ^(treba internet^)...
  python -m pip install --disable-pip-version-check fastapi uvicorn icmplib
  echo.
)

REM 3) pokreni agenta
echo Pokrecem agenta...  ^(za izlaz zatvori prozor ili pritisni Ctrl+C^)
echo.
python agent.py

echo.
echo Agent je zaustavljen.
pause
