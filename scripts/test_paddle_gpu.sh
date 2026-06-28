#!/bin/bash
# Comprehensive PaddlePaddle GPU test
export DNNL_MAX_CPU_ISA=SSE41
export LD_LIBRARY_PATH=/mnt/e/exam-pilot/.paddle-venv/lib/python3.12/site-packages/paddle/libs/:/mnt/e/exam-pilot/.paddle-venv/lib/python3.12/site-packages/paddle/
cd /mnt/e/exam-pilot/.paddle-venv

echo "=== Step 1: GPU Tensor Test ==="
bin/python -c "
import os
os.environ['DNNL_MAX_CPU_ISA'] = 'SSE41'
import paddle

# Set GPU device
paddle.device.set_device('gpu:0')
print('Device:', paddle.get_device())
print('GPU count:', paddle.device.cuda.device_count())

# Simple tensor on GPU
t = paddle.to_tensor([1.0, 2.0, 3.0])
print('Tensor:', t.numpy())
print('Tensor place:', t.place)
print('GPU test: PASS')
" 2>&1

echo ""
echo "=== Step 2: Actual PaddleOCR test with image ==="
bin/python -c "
import os
os.environ['DNNL_MAX_CPU_ISA'] = 'SSE41'
from paddleocr import PaddleOCR

# Use an image that exists
import glob
sample_dir = '/mnt/e/exam-pilot/sample/'
images = glob.glob(sample_dir + '*.jpg') + glob.glob(sample_dir + '*.png')
if images:
    test_img = images[0]
else:
    # Create a simple test image
    print('No sample images found, creating test image...')
    from PIL import Image, ImageDraw, ImageFont
    img = Image.new('RGB', (400, 100), color='white')
    d = ImageDraw.Draw(img)
    d.text((10, 10), 'Hello OCR Test 你好世界', fill='black')
    test_img = '/tmp/test_ocr.png'
    img.save(test_img)
    print(f'Created test image: {test_img}')

print(f'Testing OCR on: {test_img}')
print('Initializing PaddleOCR (this may take a moment)...')
ocr = PaddleOCR(lang='ch', use_gpu=True, show_log=False)
result = ocr.ocr(test_img)
print(f'OCR result: {result}')
if result and result[0]:
    for line in result[0]:
        print(f'  Text: {line[1][0]}, Conf: {line[1][1]:.4f}')
    print('PaddleOCR GPU test: PASS')
else:
    print('No text found or OCR returned empty')
print('PaddleOCR GPU test: DONE')
" 2>&1
