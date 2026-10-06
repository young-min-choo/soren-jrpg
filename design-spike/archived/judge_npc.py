#!/usr/bin/env python3
"""Quick vision judge for the NPC sheet via local qwen3-vl:8b."""
import json, subprocess, sys, os, base64

img_path = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else 'sheet_npc.png')
with open(img_path, 'rb') as f:
    img_b64 = base64.b64encode(f.read()).decode()
prompt = sys.argv[2] if len(sys.argv) > 2 else (
    "This is a sprite cohesion sheet for a GBA-style JRPG. "
    "Top row: field sprites (16x24, upscaled 4x). Bottom row: matching dialogue portraits (48x48, upscaled 4x). "
    "Evaluate strictly: 1) Are faces readable - eyes/mouth correct, not scrambled? 2) Coherent people (head/hair/body) or garbled? "
    "3) Artifacts: floating pixels, disconnected parts, misplaced blobs? 4) Visually distinct from each other? "
    "List SPECIFIC problems per character (left to right, numbered). Be harsh - this is pixel art QA."
)

payload = {
    "model": "qwen3-vl:8b",
    "messages": [{
        "role": "user",
        "content": [
            {"type": "image_url", "image_url": {"url": f"data:image/png;base64,{img_b64}"}},
            {"type": "text", "text": prompt},
        ],
    }],
    "max_tokens": 900,
    "temperature": 0.2,
}
with open('/tmp/vision_payload.json', 'w') as f:
    json.dump(payload, f)

r = subprocess.run(
    ['curl', '-s', 'http://localhost:11434/v1/chat/completions',
     '-H', 'Content-Type: application/json', '-d', '@/tmp/vision_payload.json'],
    capture_output=True, text=True, timeout=280)
out = json.loads(r.stdout)
if 'choices' not in out:
    # Log the raw error body (OOM/model-server failures return {"error": ...})
    print('JUDGE RAW RESPONSE:', r.stdout[:400])
    raise SystemExit(1)
print(out['choices'][0]['message']['content'])