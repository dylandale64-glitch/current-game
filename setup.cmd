@echo off
setlocal
cd /d "%~dp0"
echo Installing dependencies...
call npm install || goto :err
echo.
echo Downloading the test browser (one time, ~170MB)...
call npx playwright install chromium || goto :err
echo.
echo Running tests...
call npm test || goto :err
echo.
echo Done. Run play.cmd to open the game.
pause
exit /b 0
:err
echo.
echo Something failed above. Copy the error and ask Claude.
pause
exit /b 1
