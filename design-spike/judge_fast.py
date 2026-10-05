#!/usr/bin/env python3
"""Fast vision pre-check via moondream:1.8b (works under VRAM pressure)."""
import json, subprocess, sys, os, base64

img_path = os.path.abspath(sys.argv[1])
prompt = sys.argv[2]
with open(img_path, 'rb') as f:
    img_b64 = base64.b64encode(f.read()).decode()

payload = {
    "model": "moondream:1.8b",
    "messages": [{
        "role": "user",
        "content": [
            {"type": "image_url", "image_url": {"url": f"data:image/png;base64,{img_b64}"}},
            {"type": "text", "text": prompt},
        ],
    }],
    "max_tokens": 500,
    "temperature": 0.2,
}
with open('/tmp/vision_payload2.json', 'w') as f:
    json.dump(payload, f)
r = subprocess.run(
    ['curl', '-s', '--max-time', '240', 'http://localhost:11434/v1/chat/completions',
     '-H', 'Content-Type: application/json', '-d', '@/tmp/vision_payload2.json'],
    capture_output=True, text=True, timeout=250)
out = json.loads(r.stdout)
print(out['choices'][0]['message']['content'])