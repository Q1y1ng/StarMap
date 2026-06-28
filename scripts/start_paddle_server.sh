#!/bin/bash
# Start PaddleOCR GPU server
VENV=/mnt/e/exam-pilot/.paddle-venv
SITE=$VENV/lib/python3.12/site-packages
export DNNL_MAX_CPU_ISA=SSE41
export LD_LIBRARY_PATH="$SITE/paddle/libs/:$SITE/paddle/:$SITE/nvidia/cudnn/lib/:$SITE/nvidia/cublas/lib/:$SITE/nvidia/cuda_nvrtc/lib/:/usr/lib/wsl/lib/"
export PYTHONPATH="/mnt/e/exam-pilot/scripts:$PYTHONPATH"

cd /mnt/e/exam-pilot/scripts
echo "[start] Starting PaddleOCR GPU server on port 8000..."
$VENV/bin/python3 -m uvicorn paddle_ocr_server:app --host 0.0.0.0 --port 8000 --log-level info
