@echo off
rem Pausa a atualizacao automatica do mapa (para voltar: riprendi-aggiornamento.bat)
schtasks /change /tn "UK3D - update map" /disable
schtasks /change /tn "UK3D - full update" /disable
echo Atualizacao automatica PAUSADA.
pause
