#!/usr/bin/env python3
"""Battle sprite post-processing: chroma-key magenta -> transparent,
quantize to true pixel grid, remap to master palette, deploy to public/.

Input: raw_battle/{key}.png (512px, magenta bg)
Output: public/sprites/battle/{key}.png (transparent, native px size)

Run: venv python3 process_battle_sprites.py
"""
import subprocess, os, json, sys
from PIL import Image

os.chdir(os.path.dirname(os.path.abspath(__file__)))

VENV_MAGICK = 'magick'  # system
RAW, OUT = 'raw_battle', 'processed_battle'
PUB = '/home/min/dev/soren-jrpg/public/sprites/battle'
os.makedirs(OUT, exist_ok=True)
os.makedirs(PUB, exist_ok=True)

# Native sizes: party 32, regular 32, bosses 48
BOSS_KEYS = {'boss_goblin', 'boss_tide', 'boss_hollow', 'boss_storm',
             'boss_disgraced', 'boss_aldric_p1', 'boss_aldric_p2', 'boss_magma'}

def native_size(key):
    return 48 if key in BOSS_KEYS else 32

def chroma_key(img, tolerance=48):
    """Auto-detect background color from corners (majority vote), flood-remove
    from edges. Robust to whatever bg color the model actually rendered."""
    img = img.convert('RGBA')
    w, h = img.size
    px = img.load()
    # sample corner region colors (8px inset grid)
    corner_colors = []
    step = max(1, w // 64)
    for cx, cy in [(0,0), (w-1,0), (0,h-1), (w-1,h-1)]:
        for dx in range(0, step*4, step):
            for dy in range(0, step*4, step):
                x = min(w-1, max(0, cx + (dx if cx == 0 else -dx)))
                y = min(h-1, max(0, cy + (dy if cy == 0 else -dy)))
                corner_colors.append(px[x, y][:3])
    # majority-vote quantized color
    quant = [(r//16*16, g//16*16, b//16*16) for r, g, b in corner_colors]
    bg = max(set(quant), key=quant.count)
    from collections import deque
    visited = [[False]*w for _ in range(h)]
    q = deque()
    for x in range(w): q.extend([(x, 0), (x, h-1)])
    for y in range(h): q.extend([(0, y), (w-1, y)])
    def is_bg(r, g, b, a):
        if a == 0: return True
        return (abs(r-bg[0]) <= tolerance and abs(g-bg[1]) <= tolerance
                and abs(b-bg[2]) <= tolerance)
    while q:
        x, y = q.popleft()
        if x < 0 or y < 0 or x >= w or y >= h or visited[y][x]: continue
        visited[y][x] = True
        r, g, b, a = px[x, y]
        if is_bg(r, g, b, a):
            px[x, y] = (0, 0, 0, 0)
            for dx, dy in ((1,0),(-1,0),(0,1),(0,-1)):
                q.append((x+dx, y+dy))
    return img

def palette_snap(img, pal_rgb):
    """Map each pixel to nearest master-palette color. Pure PIL, preserves alpha."""
    img = img.convert('RGBA')
    out = img.copy()
    px = out.load()
    w, h = img.size
    # cache unique colors -> nearest palette color
    cache = {}
    for x in range(w):
        for y in range(h):
            r, g, b, a = px[x, y]
            if a == 0:
                continue
            key = (r, g, b)
            if key not in cache:
                best = min(pal_rgb, key=lambda c: (c[0]-r)**2 + (c[1]-g)**2 + (c[2]-b)**2)
                cache[key] = best
            nr, ng, nb = cache[key]
            px[x, y] = (nr, ng, nb, a)
    return out

def process(key, pal_rgb):
    src = f'{RAW}/{key}.png'
    if not os.path.exists(src):
        return f'{key}: MISSING raw'
    # skip in-progress/invalid downloads (generator may be mid-write)
    try:
        test = Image.open(src)
        test.verify()
    except Exception:
        return f'{key}: INVALID raw (skip — generator mid-write?)'
    nat = native_size(key)
    # 1. chroma-key at 512 (flood fill from edges)
    img = chroma_key(Image.open(src))
    tmp = f'{OUT}/{key}_keyed.png'
    img.save(tmp)
    # 2. quantize to native pixel grid (magick handles point-resample + color reduction)
    subprocess.run([VENV_MAGICK, tmp, '-filter', 'point', '-resize', f'{nat}x{nat}!',
                    '+dither', '-colors', '24', f'{OUT}/{key}_quant.png'], check=True)
    # 3. palette snap in Python (magick -remap destroys alpha)
    snapped = palette_snap(Image.open(f'{OUT}/{key}_quant.png'), pal_rgb)
    snapped.save(f'{OUT}/{key}.png')
    # 4. trim transparent borders (keep square canvas: paste centered)
    q = snapped
    bbox = q.getbbox()
    if bbox:
        trimmed = q.crop(bbox)
        # paste centered on square canvas of native size
        canvas = Image.new('RGBA', (nat, nat), (0, 0, 0, 0))
        off_x = (nat - trimmed.width) // 2
        off_y = (nat - trimmed.height) // 2
        canvas.paste(trimmed, (off_x, off_y))
        canvas.save(f'{PUB}/{key}.png')
        return f'{key}: OK {nat}px (content {trimmed.width}x{trimmed.height})'
    return f'{key}: BBOX EMPTY (fully transparent?)'

if __name__ == '__main__':
    import json as _json
    palette = _json.load(open('palette/master_palette.json'))
    pal_rgb = [tuple(v) for v in palette.values()]
    keys = sorted(os.listdir(RAW))
    if len(sys.argv) > 1: keys = sys.argv[1:]
    results = [process(k.replace('.png',''), pal_rgb) for k in keys if k.endswith('.png')]
    for r in results: print(r)