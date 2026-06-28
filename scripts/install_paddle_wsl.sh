#!/bin/bash
set -e
export PATH=/mnt/e/exam-pilot/.paddle-venv/bin:$PATH

# Try Aliyun mirror first (faster in China)
echo "[$(date)] Trying Aliyun mirror..."
pip install --no-cache-dir paddlepaddle-gpu==2.6.2 \
  -i https://mirrors.aliyun.com/pypi/simple/ \
  --trusted-host mirrors.aliyun.com \
  --progress-bar off 2>&1
INSTALL_EXIT=$?
echo "[$(date)] Install exit code: $INSTALL_EXIT"

if [ $INSTALL_EXIT -eq 0 ]; then
  python -c "import paddle; print('Paddle:', paddle.__version__); print('GPU:', paddle.is_compiled_with_cuda())" 2>&1
  echo "[$(date)] SUCCESS"
else
  echo "[$(date)] FAILED - trying official PaddlePaddle wheel..."
  pip install paddlepaddle-gpu==2.6.2 \
    -f https://www.paddlepaddle.org.cn/whl/linux/cuda12/stable.whl \
    --progress-bar off 2>&1
  python -c "import paddle; print('Paddle:', paddle.__version__); print('GPU:', paddle.is_compiled_with_cuda())" 2>&1
  echo "[$(date)] DONE"
fi
