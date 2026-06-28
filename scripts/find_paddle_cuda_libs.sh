#!/bin/bash
# Find PaddlePaddle's bundled CUDA libraries
export DNNL_MAX_CPU_ISA=SSE41
cd /mnt/e/exam-pilot/.paddle-venv

SITE=$(bin/python -c "import sysconfig; print(sysconfig.get_paths()['purelib'])")
echo "Site-packages: $SITE"

echo "=== Paddle libs directory ==="
ls -la "$SITE/paddle/libs/" 2>/dev/null || echo "No paddle/libs dir"

echo "=== All .so files in paddle ==="
find "$SITE/paddle" -name "*.so*" 2>/dev/null | head -30

echo "=== CUDA-related .so files ==="
find "$SITE/paddle" -name "*cuda*" -o -name "*cudnn*" -o -name "*cublas*" -o -name "*curand*" -o -name "*cusolver*" 2>/dev/null | head -20

echo "=== LD_LIBRARY_PATH candidate ==="
echo "$SITE/paddle/libs/"
echo "$SITE/paddle/"

echo "=== Test with custom LD_LIBRARY_PATH ==="
export LD_LIBRARY_PATH="$SITE/paddle/libs/:$SITE/paddle/:$LD_LIBRARY_PATH"
bin/python -c "
import os
os.environ['DNNL_MAX_CPU_ISA'] = 'SSE41'
import paddle
print('Paddle version:', paddle.__version__)
print('CUDA available:', paddle.is_compiled_with_cuda())
try:
    paddle.device.set_device('gpu:0')
    print('GPU device set successfully')
except Exception as e:
    print(f'GPU error: {e}')
import paddle.base.core as core
print('GPU count:', core.get_cuda_device_count())
"
