@echo off
cd /d "%~dp0"
echo.
echo ========================================
echo   Pepe Star Bot - Starting...
echo ========================================
echo.

echo [1/2] Installing packages (this may take a minute)...
npm install
echo.

echo [2/2] Creating database...
node setup-db.mjs
echo.

echo ========================================
echo   Bot is starting...
echo   Send /start to your bot in Telegram
echo   Press Ctrl+C to stop
echo ========================================
echo.
node bot.mjs
pause
