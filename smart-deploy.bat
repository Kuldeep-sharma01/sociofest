@echo off
title SocioFest Smart Deploy
color 0A
cls

echo ========================================
echo  🚀 SocioFest Smart Deployment Assistant
echo ========================================
echo.

REM Check if running as admin
net session >nul 2>&1
if %errorLevel% == 0 (
    echo [OK] Running as Administrator
) else (
    echo [WARN] Not running as Administrator (some features limited)
)

REM Feature prompts
set /p COMPILER="Install Code Compiler (vm2 sandbox)? [y/N]: "
if /i "%COMPILER%"=="y" (
    echo Installing compiler...
    cd server && npm i vm2 axios-retry && cd ..
    echo Compiler installed!
) else (
    echo Compiler skipped.
)

set /p COMPILER_TEST="Deploy compiler test environment (Judge0 Docker)? [y/N]: "
if /i "%COMPILER_TEST%"=="y" (
    echo Starting compiler test env...
    cd server && docker compose -f docker-compose.compiler-test.yml up -d && cd ..
    echo Judge0 test ready at http://localhost:2358
) else (
    echo Test env skipped.
)

REM Continue with other setup...
echo Deployment complete! Run start-all.bat
pause
