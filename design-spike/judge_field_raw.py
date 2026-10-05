#!/usr/bin/env python3
"""Field-raw gate: FULL-BODY + visual-identity checks that machine gates can't do.

Uses a vision judge to answer structured questions about a raw field sprite:
1. is_full_body: standing character with head AND legs/feet visible
2. has_multiple_characters_or_props: any second figure/large prop (reject)
3. facing: front/left/right/back

Exit 0 = usable, 1 = reject. Written for the Soren Phase-9 rebuild after
soren_side.png (head-only bust) and soren_back.png (different person, dress)
slipped through the numeric gates into the game.

Usage: python3 judge_field_raw.py <path> [expected_facing]
Requires OLLAMA_URL + OLLAMA_MODEL in env (default qwen3-vl:8b-instruct @ localhost:11434).
"""
import os, sys, json, base64, subprocess, tempfile

MODEL = os.environ.get('OLLAMA_MODEL', 'qwen3-vl:8b-instruct')
URL = os.environ.get('OLLAMA_URL', 'http://localhost:11434')

PROMPT = """Look at this image. It should be ONE full-body standing video-game character on a plain background. Answer ONLY with JSON:
{"is_full_body": true/false,   // true ONLY if head AND torso AND legs/feet all visible, standing
 "figure_count": <int>,        // how many characters/figures visible (1 = good)
 "facing": "front|left|right|back",
 "outfit_color": "<one word>",
 "ready_for_downscale": true/false}  // false if blurry garbage, partial body, or multiple figures
No other text."""

def judge(path):
    with open(path, 'rb') as f:
        b64 = base64.b64encode(f.read()).decode()
    body = json.dumps({
        'model': MODEL,
        'messages': [{'role': 'user', 'content': PROMPT, 'images': [b64]}],
        'stream': False,
        'format': 'json',
        'options': {'temperature': 0},
    }).encode()
    with tempfile.NamedTemporaryFile(suffix='.json', delete=False, dir='/tmp') as f:
        f.write(body); fpath = f.name
    out = subprocess.run(['curl', '-s', '--max-time', '120', f'{URL}/api/chat',
                          '-d', f'@{fpath}'], capture_output=True, text=True, timeout=130)
    os.unlink(fpath)
    try:
        resp = json.loads(out.stdout)
        verdict = json.loads(resp['message']['content'])
    except Exception:
        return None, f"judge error: {out.stdout[:200]} / {out.stderr[:100]}"
    return verdict, None

def main():
    path = sys.argv[1]
    expected = sys.argv[2] if len(sys.argv) > 2 else None
    verdict, err = judge(path)
    if err:
        print(f"FAIL {path}: {err}"); return 1
    ok = bool(verdict.get('ready_for_downscale')) and bool(verdict.get('is_full_body')) \
        and verdict.get('figure_count') == 1
    if expected:
        ok = ok and verdict.get('facing') == expected
    print(f"{'OK  ' if ok else 'FAIL'} {path}: {json.dumps(verdict)}")
    return 0 if ok else 1

if __name__ == '__main__':
    sys.exit(main())