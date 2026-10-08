#!/usr/bin/env python3
"""Seal interior pinholes in a 48x96 12-frame sheet (16x24 frames).
Interior = transparent region not touching the frame border, <= max_px cells.
Larger regions (legit leg/arm concavities) are preserved."""
import sys
from collections import deque
import numpy as np
from PIL import Image

def seal(path, max_px=6):
    im = Image.open(path).convert('RGBA')
    a = np.array(im)
    alpha = a[:, :, 3] > 0
    filled = 0
    for fr in range(12):
        r, c = divmod(fr, 3)
        y0, x0 = r * 24, c * 16
        f = alpha[y0:y0+24, x0:x0+16]
        seen = np.zeros_like(f, bool)
        for sy in range(24):
            for sx in range(16):
                if f[sy, sx] or seen[sy, sx]:
                    continue
                q = deque([(sy, sx)])
                seen[sy, sx] = True
                cells = []
                touches = False
                while q:
                    y, x = q.popleft()
                    cells.append((y, x))
                    if y in (0, 23) or x in (0, 15):
                        touches = True
                    for dy, dx in ((1,0),(-1,0),(0,1),(0,-1),(1,1),(-1,-1),(1,-1),(-1,1)):
                        ny, nx = y + dy, x + dx
                        if 0 <= ny < 24 and 0 <= nx < 16 and not f[ny, nx] and not seen[ny, nx]:
                            seen[ny, nx] = True
                            q.append((ny, nx))
                if not touches and len(cells) <= max_px:
                    for y, x in cells:
                        a[y0+y, x0+x, 3] = 255
                    filled += len(cells)
    Image.fromarray(a).save(path)
    print(f"sealed {filled}px in {path}")

if __name__ == "__main__":
    for p in sys.argv[1:]:
        seal(p)
