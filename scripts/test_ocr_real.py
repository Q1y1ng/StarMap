#!/usr/bin/env python3
"""Test PaddleOCR GPU with real exam images"""
import os, sys, glob

os.environ["DNNL_MAX_CPU_ISA"] = "SSE41"

from paddleocr import PaddleOCR

base = "/mnt/e/exam-pilot/sample"
imgs = sorted(glob.glob(base + "/**/*.jpg", recursive=True) + glob.glob(base + "/**/*.png", recursive=True))
print(f"Total images: {len(imgs)}")

if not imgs:
    print("No images found!")
    sys.exit(0)

ocr = PaddleOCR(lang="ch", use_gpu=True, show_log=False)

for img_path in imgs[:5]:
    fname = os.path.basename(img_path)
    fsize = os.path.getsize(img_path) // 1024
    print(f"\n--- {fname} ({fsize}KB) ---")
    try:
        result = ocr.ocr(img_path)
        if result and result[0]:
            print(f"  Blocks: {len(result[0])}")
            for line in result[0][:8]:
                print(f"  '{line[1][0]}' (conf: {line[1][1]:.4f})")
        else:
            print("  No text detected")
    except Exception as e:
        print(f"  Error: {type(e).__name__}: {e}")

print("\nDone")
