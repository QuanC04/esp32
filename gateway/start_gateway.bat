@echo off
echo ======================================
echo   Wokwi IoT Gateway v2.0.1
echo ======================================
echo.

REM Run wokwigw with port forwarding
REM ESP32 web server on 10.13.37.2:80 -> localhost:8080
"%~dp0wokwigw.exe" --forward 8080:10.13.37.2:80

pause
