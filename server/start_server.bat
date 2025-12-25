@echo off
echo Installing dependencies...
call npm install

echo.
echo Starting ESP32 IoT Gateway Server...
echo.
node server.js
pause
