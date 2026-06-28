#!/usr/bin/env python3
"""Load and test PaddleOCR model directly"""
import os, sys, numpy as np
os.environ["DNNL_MAX_CPU_ISA"] = "SSE41"

import paddle
print("Paddle version:", paddle.__version__)
print("CUDA:", paddle.is_compiled_with_cuda())

# Check model files
model_dir = os.path.expanduser("~/.paddleocr/whl/det/ch/ch_PP-OCRv4_det_infer")
print(f"\nModel dir: {model_dir}")
if not os.path.exists(model_dir):
    print("Model directory not found!")
    sys.exit(1)

files = os.listdir(model_dir)
print(f"Files: {files}")

from paddle.inference import Config, create_predictor

# Create config
config = Config(
    os.path.join(model_dir, "inference.pdmodel"),
    os.path.join(model_dir, "inference.pdiparams")
)
config.enable_memory_optim()
config.disable_glog_info()
config.switch_ir_optim(True)
config.switch_use_feed_fetch_ops(False)

# Try GPU
config.enable_use_gpu(500, 0)
predictor = create_predictor(config)
print(f"\nPredictor created")
print(f"Input names: {predictor.get_input_names()}")
print(f"Output names: {predictor.get_output_names()}")

# Run inference with dummy input
input_name = predictor.get_input_names()[0]
input_tensor = predictor.get_input_handle(input_name)
dummy = np.random.randn(1, 3, 640, 640).astype(np.float32)
input_tensor.copy_from_cpu(dummy)
predictor.run()

output_name = predictor.get_output_names()[0]
output_tensor = predictor.get_output_handle(output_name)
output_data = output_tensor.copy_to_cpu()
print(f"\nModel output shape: {output_data.shape}")
print(f"Model output range: [{output_data.min():.4f}, {output_data.max():.4f}]")
print("Model inference: OK")
