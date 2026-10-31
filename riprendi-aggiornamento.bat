@echo off
rem Liga de novo a atualizacao automatica do mapa
schtasks /change /tn "UK3D - update map" /enable
schtasks /change /tn "UK3D - full update" /enable
echo Atualizacao automatica LIGADA (a cada 10 minutos).
pause
