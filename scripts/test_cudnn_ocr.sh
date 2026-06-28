#!/bin/bash
# Test cuDNN + PaddleOCR GPU inference
VENV=/mnt/e/exam-pilot/.paddle-venv
SITE=$VENV/lib/python3.12/site-packages
export DNNL_MAX_CPU_ISA=SSE41
export LD_LIBRARY_PATH="$SITE/paddle/libs/:$SITE/paddle/:$SITE/nvidia/cudnn/lib/:$SITE/nvidia/cublas/lib/:$SITE/nvidia/cuda_nvrtc/lib/:/usr/lib/wsl/lib/"

echo "=== 1. Python ==="
$VENV/bin/python3 -c "import paddleocr; print('paddleocr:', paddleocr.__file__)" 2>&1

echo ""
echo "=== 2. GPU Tensor ==="
$VENV/bin/python3 -c "
import os; os.environ['DNNL_MAX_CPU_ISA'] = 'SSE41'
import paddle
paddle.device.set_device('gpu:0')
print('Device:', paddle.get_device())
t = paddle.to_tensor([1.0, 2.0])
print('GPU Tensor:', t.numpy())
print('GPU: OK')
" 2>&1

echo ""
echo "=== 3. PaddleOCR GPU Inference ==="
$VENV/bin/python3 -c "
import os; os.environ['DNNL_MAX_CPU_ISA'] = 'SSE41'
from paddleocr import PaddleOCR
from PIL import Image, ImageDraw

img = Image.new('RGB', (600, 200), 'white')
draw = ImageDraw.Draw(img)
draw.text((10, 10), 'Hello OCR Test 你好世界', fill='black')
draw.text((10, 60), '姓名: 张三  总分: 95', fill='black')
img.save('/tmp/test_ocr.png')

print('Initializing PaddleOCR (GPU)...')
ocr = PaddleOCR(lang='ch', use_gpu=True, show_log=False)
print('Running inference...')
result = ocr.ocr('/tmp/test_ocr.png')

if result and result[0]:
    print('Found ' + str(len(result[0])) + ' text blocks:')
    for i, line in enumerate(result[0][:10]):
        print('  [' + str(i) + '] \"' + line[1][0] + '\" (conf: ' + str(line[1][1]) + ')')
    print('OCR GPU Inference: SUCCESS')
else:
    print('No text found')
" 2>&1

echo ""
echo "Exit: $?"
