@echo off
REM 设置 fnm Node 环境的 PATH
set "PATH=C:\Users\86134\AppData\Roaming\fnm\node-versions\v24.14.0\installation;%PATH%"

REM 切换到项目目录
cd /d D:\youxi-ts\pet

REM 执行传入的命令
%*
