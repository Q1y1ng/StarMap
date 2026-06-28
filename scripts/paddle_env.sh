#!/bin/bash
# PaddleOCR GPU environment setup for WSL2
# Source this script before running any PaddleOCR commands:
#   source scripts/paddle_env.sh

VENV=/mnt/e/exam-pilot/.paddle-venv
SITE=$VENV/lib/python3.12/site-packages

# Core env
export DNNL_MAX_CPU_ISA=SSE41
export LD_LIBRARY_PATH="$SITE/paddle/libs/:$SITE/paddle/:$SITE/nvidia/cudnn/lib/:$SITE/nvidia/cublas/lib/:$SITE/nvidia/cuda_nvrtc/lib/:/usr/lib/wsl/lib/"
export PATH="$VENV/bin:$PATH"

echo "[paddle_env] DNNL_MAX_CPU_ISA=SSE41"
echo "[paddle_env] LD_LIBRARY_PATH set (paddle + nvidia/cudnn + nvidia/cublas + wsl lib)"
echo "[paddle_env] Python: $VENV/bin/python3"
echo "[paddle_env] PaddlePaddle GPU ready"
