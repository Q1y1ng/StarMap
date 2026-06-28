#!/bin/bash
# Wrapper to run PaddleOCR test with correct environment
VENV=/mnt/e/exam-pilot/.paddle-venv
SITE=$VENV/lib/python3.12/site-packages
export DNNL_MAX_CPU_ISA=SSE41
export LD_LIBRARY_PATH="$SITE/paddle/libs/:$SITE/paddle/:$SITE/nvidia/cudnn/lib/:$SITE/nvidia/cublas/lib/:$SITE/nvidia/cuda_nvrtc/lib/:/usr/lib/wsl/lib/"

exec $VENV/bin/python3 /mnt/e/exam-pilot/scripts/test_ocr_real.py
