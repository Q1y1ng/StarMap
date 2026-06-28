#!/bin/bash
# Test PaddleOCR with real exam images
SITE=/mnt/e/exam-pilot/.paddle-venv/lib/python3.12/site-packages/paddle
export DNNL_MAX_CPU_ISA=SSE41
export LD_LIBRARY_PATH=$SITE/libs/:$SITE/:/usr/lib/wsl/lib/
export PATH=/mnt/e/exam-pilot/.paddle-venv/bin:$PATH

echo "=== Sample images ==="
python3 << 'PYEOF'
import os, glob
os.environ["DNNL_MAX_CPU_ISA"] = "SSE41"

base = '/mnt/e/exam-pilot/sample'
# Recursively find images
images = sorted(glob.glob(base + '/**/*.jpg', recursive=True) +
                glob.glob(base + '/**/*.png', recursive=True))
print(f"Found {len(images)} images:")
for img in images[:10]:
    size = os.path.getsize(img)
    print(f"  {img} ({size/1024:.0f}KB)")

if images:
    # Test first image
    test_img = images[0]
    print(f"\nTesting OCR: {test_img}")
    from paddleocr import PaddleOCR
    ocr = PaddleOCR(lang='ch', use_gpu=True, show_log=False)
    result = ocr.ocr(test_img)
    if result and result[0]:
        print(f"Found {len(result[0])} text blocks:")
        for i, line in enumerate(result[0][:10]):
            print(f"  [{i}] '{line[1][0]}' (conf: {line[1][1]:.4f})")
        print("PaddleOCR GPU real image test: PASS")
    else:
        print("No text blocks found")
PYEOF
echo "Exit: $?"
