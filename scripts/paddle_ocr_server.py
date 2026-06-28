#!/usr/bin/env python
"""PaddleOCR FastAPI service - Phase 20A-R baseline experiment (WSL/GPU)"""
import os, sys, json, time
from fastapi import FastAPI, UploadFile, File
from fastapi.responses import JSONResponse
import uvicorn
from paddleocr import PaddleOCR

app = FastAPI(title="PaddleOCR Service (GPU)", version="2.0.0")
ocr = None

def get_ocr():
    global ocr
    if ocr is None:
        print("[PaddleOCR] Initializing GPU...", flush=True)
        ocr = PaddleOCR(lang='ch')
    return ocr

@app.get("/health")
async def health():
    return {"status": "ok", "service": "PaddleOCR-GPU", "gpu": True}

@app.post("/ocr")
async def ocr_image(file: UploadFile = File(...)):
    contents = await file.read()
    print(f"[PaddleOCR] Processing ({len(contents)} bytes)...", flush=True)
    start = time.time()
    engine = get_ocr()
    result = engine.ocr(contents)
    elapsed = time.time() - start

    blocks = []
    full_text = ""
    if result and result[0]:
        for line in result[0]:
            text, conf = line[1]
            blocks.append({"text": text, "confidence": round(float(conf), 4)})
            full_text += text + "\n"

    num_blocks = len(blocks)
    print(f"[PaddleOCR] Done in {elapsed:.2f}s, {num_blocks} blocks", flush=True)

    return JSONResponse(content={
        "status": "success",
        "processing_time": round(elapsed, 3),
        "num_blocks": num_blocks,
        "blocks": blocks,
        "full_text": full_text,
    })

if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument("--port", type=int, default=8000)
    parser.add_argument("--host", type=str, default="0.0.0.0")
    args = parser.parse_args()
    print(f"[PaddleOCR] Starting GPU server on {args.host}:{args.port}", flush=True)
    uvicorn.run(app, host=args.host, port=args.port, log_level="info")
