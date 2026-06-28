#!/bin/bash
# Test PaddlePaddle GPU with correct LD_LIBRARY_PATH
SITE=/mnt/e/exam-pilot/.paddle-venv/lib/python3.12/site-packages/paddle
export DNNL_MAX_CPU_ISA=SSE41
export LD_LIBRARY_PATH=$SITE/libs/:$SITE/:/usr/lib/wsl/lib/
export PATH=/mnt/e/exam-pilot/.paddle-venv/bin:$PATH

echo "=== Test 1: GPU tensor ==="
python3 << 'PYEOF'
import os
os.environ["DNNL_MAX_CPU_ISA"] = "SSE41"
import paddle

paddle.device.set_device("gpu:0")
print("Device:", paddle.get_device())
t = paddle.to_tensor([1.0, 2.0, 3.0])
print("Tensor:", t.numpy())
print("GPU tensor: PASS")
PYEOF
echo "Exit: $?"

echo ""
echo "=== Test 2: PaddleOCR ==="
python3 << 'PYEOF'
import os
os.environ["DNNL_MAX_CPU_ISA"] = "SSE41"
from paddleocr import PaddleOCR

print("Initializing PaddleOCR (GPU)...")
ocr = PaddleOCR(lang='ch', use_gpu=True, show_log=False)

# Find a test image
import glob
sample_dir = '/mnt/e/exam-pilot/sample/'
images = sorted(glob.glob(sample_dir + '*.jpg') + glob.glob(sample_dir + '*.png'))
if images:
    test_img = images[0]
    print(f"Testing on: {test_img}")
    result = ocr.ocr(test_img)
    if result and result[0]:
        for line in result[0][:5]:
            print(f"  Text: {line[1][0]}, Conf: {line[1][1]:.4f}")
        print("PaddleOCR GPU: PASS")
    else:
        print("No text found")
else:
    print("No sample images found")
print("Done")
PYEOF
echo "Exit: $?"
