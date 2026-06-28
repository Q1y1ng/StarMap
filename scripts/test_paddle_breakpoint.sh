#!/bin/bash
# Precise GPU breakpoint test
SITE=/mnt/e/exam-pilot/.paddle-venv/lib/python3.12/site-packages/paddle
export DNNL_MAX_CPU_ISA=SSE41
export LD_LIBRARY_PATH=$SITE/libs/:$SITE/
cd /mnt/e/exam-pilot/.paddle-venv

echo "=== Test 1: Just import and check ==="
bin/python -c "
import os, sys
os.environ['DNNL_MAX_CPU_ISA'] = 'SSE41'
import paddle
print('import OK')
print('paddle.__version__:', paddle.__version__)
sys.stdout.flush()
print('CUDA:', paddle.is_compiled_with_cuda())
sys.stdout.flush()
" 2>&1
echo "Exit: $?"

echo "=== Test 2: set_device + device_count ==="
bin/python -c "
import os, sys
os.environ['DNNL_MAX_CPU_ISA'] = 'SSE41'
import paddle
print('a', flush=True)
paddle.device.set_device('gpu:0')
print('b', flush=True)
print('cuda count:', paddle.device.cuda.device_count(), flush=True)
print('c', flush=True)
" 2>&1
echo "Exit: $?"

echo "=== Test 3: to_tensor on CPU ==="
bin/python -c "
import os, sys
os.environ['DNNL_MAX_CPU_ISA'] = 'SSE41'
import paddle
paddle.device.set_device('gpu:0')
t = paddle.to_tensor([1.0, 2.0, 3.0], place='cpu')
print('CPU tensor OK:', t.numpy(), flush=True)
" 2>&1
echo "Exit: $?"

echo "=== Test 4: to_tensor on GPU ==="
bin/python -c "
import os, sys
os.environ['DNNL_MAX_CPU_ISA'] = 'SSE41'
import paddle
print('step1', flush=True)
paddle.device.set_device('gpu:0')
print('step2', flush=True)
t = paddle.to_tensor([1.0, 2.0])
print('step3', flush=True)
print(t.numpy(), flush=True)
" 2>&1
echo "Exit: $?"

echo "=== Test 5: empty GPU tensor ==="
bin/python -c "
import os, sys
os.environ['DNNL_MAX_CPU_ISA'] = 'SSE41'
import paddle
paddle.device.set_device('gpu:0')
t = paddle.empty([2, 3])
print('GPU empty tensor OK:', t.numpy(), flush=True)
" 2>&1
echo "Exit: $?"
