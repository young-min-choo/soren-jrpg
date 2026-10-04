#!/usr/bin/env python3
"""MUSIC GATES v3 per ART-BIBLE — honest, two-level battery:

AUDIO level (all 15 OGGs):
  SEAM-ENERGY: rms(last 2s)/rms(first 2s) >= 0.30 (no fade-then-bang loop)
  SEAM-CLICK: |x[-1]-x[0]|/peak <= 0.10 (no wrap click)
  THICKNESS: >=4 concurrent spectral peaks at the busiest of 4 windows

COMPOSITION level (from compose_soundtrack_v2 — the actual note data):
  VARIETY-MELODY: A vs B pitch-sequence similarity <= 0.85
      (B must be new material — a transposed copy fails: contour identical)
  VARIETY-RHYTHM: A vs B duration-sequence similarity <= 0.85
  VARIETY-CONTOUR: A vs B melodic contour correlation <= 0.90
      (contour = sign of intervals; catches transposed/restated copies)

(The v2 chroma gate is retired: it measured key identity, which stays
constant within a theme BY DESIGN — every FF/FE theme would fail it.)
"""
import os, sys, subprocess
import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
os.environ.setdefault('PYTHONDONTWRITEBYTECODE', '1')

AUDIO = '/home/min/dev/soren-jrpg/public/audio'

def load_mono(path):
    r = subprocess.run(['ffmpeg', '-i', path, '-f', 'f32le', '-ac', '1', '-ar', '44100', '-'],
                       capture_output=True, timeout=60)
    return np.frombuffer(r.stdout, dtype=np.float32)

def rms(x):
    return float(np.sqrt(np.mean(x ** 2) + 1e-12))

def seq_sim(a, b):
    """Normalized similarity between equal-length numeric sequences."""
    if len(a) != len(b):
        n = min(len(a), len(b))
        a, b = a[:n], b[:n]
    a = np.asarray(a, float); b = np.asarray(b, float)
    if len(a) < 2:
        return 1.0
    # 1 - mean abs diff / scale, clamped
    scale = max(np.abs(a).max(), np.abs(b).max(), 1e-9)
    return float(1 - min(1.0, np.mean(np.abs(a - b)) / scale))

def pitch_seq(notes):
    return [m for (_, _, m, _) in notes if m is not None]

def interval_seq(pitches):
    """Interval sequence — identical for a transposed copy, the honest test."""
    p = [x for x in pitches if x is not None]
    return [b - a for a, b in zip(p, p[1:])]

def dur_seq(notes):
    return [d for (_, d, _, _) in notes]

def contour(pitches):
    p = np.asarray(pitches, float)
    if len(p) < 2: return [0]
    return list(np.sign(np.diff(p)))

def corr(x, y):
    x, y = np.asarray(x, float), np.asarray(y, float)
    n = min(len(x), len(y))
    x, y = x[:n], y[:n]
    sx, sy = x.std(), y.std()
    if sx < 1e-9 or sy < 1e-9:
        return 1.0 if abs(x.mean() - y.mean()) < 1e-9 else 0.0
    return float(np.corrcoef(x, y)[0, 1])

def clip_sim(notes):
    """Fraction of A's notes that also appear (same pitch, similar time) in B."""
    return notes

# ── audio gates ────────────────────────────────────────────────
audio_results = []
for f in sorted(os.listdir(AUDIO)):
    if not f.endswith('.ogg'): continue
    name = f[:-4]
    a = load_mono(os.path.join(AUDIO, f))
    n = len(a)
    t2 = 88200
    e = rms(a[n - t2:]) / (rms(a[:t2]) + 1e-9)
    seam_ok = e >= 0.30
    peak = np.abs(a).max() + 1e-9
    wrap = abs(float(a[-1]) - float(a[0])) / peak
    click_ok = wrap <= 0.10
    best_peaks = 0
    for frac in (0.25, 0.4, 0.6, 0.75):
        c = int(n * frac)
        win = a[c:c + 88200]
        if len(win) < 88200: break
        spec = np.abs(np.fft.rfft(win * np.hanning(len(win))))
        freqs = np.fft.rfftfreq(len(win), 1 / 44100)
        band = (freqs > 100) & (freqs < 4000)
        sb = spec[band]
        pk = (sb[1:-1] > sb[:-2]) & (sb[1:-1] > sb[2:]) & (sb[1:-1] > sb.max() * 0.2)
        best_peaks = max(best_peaks, int(pk.sum()))
    thick_ok = best_peaks >= 4
    audio_results.append((name, seam_ok, e, click_ok, wrap, thick_ok, best_peaks))

# ── composition gates ─────────────────────────────────────────
import importlib.util
spec = importlib.util.spec_from_file_location(
    'cs', os.path.join(os.path.dirname(os.path.abspath(__file__)), 'compose_soundtrack_v2.py'))
cs = importlib.util.module_from_spec(spec)
spec.loader.exec_module(cs)

comp_results = []
# rebuild mel_a/mel_b per theme by re-deriving from the module's song objects:
# the Song voices carry the lead (gain 1.0) note lists. Voice 0-indexed: find
# the voice whose note count matches mel_a + repeats. Simpler: reconstruct via
# the module's M() on the same motifs is fragile — instead use the Song's lead
# channel: voices[?]. We tag lead as the loudest gain==1.0 instrument voice.
def lead_sections(song):
    """Extract A and B note blocks from the lead voice (gain 1.0)."""
    lead = None
    for kind, gain, notes in song.voices:
        if abs(gain - 1.0) < 1e-6 and lead is None:
            lead = notes
    if lead is None:
        return None, None
    a_notes = [(s, d, m, v) for (s, d, m, v) in lead if s < 32]
    b_notes = [(s, d, m, v) for (s, d, m, v) in lead if 64 <= s < 96]
    return a_notes, b_notes

for name, song in cs.THEMES.items():
    a_notes, b_notes = lead_sections(song)
    if not a_notes or not b_notes:
        comp_results.append((name, False, 'no lead sections found', False, '', False, ''))
        continue
    pa, pb = pitch_seq(a_notes), pitch_seq(b_notes)
    da, db = dur_seq(a_notes), dur_seq(b_notes)
    ia, ib = interval_seq(pa), interval_seq(pb)
    # interval-sequence similarity — catches transposed copies AND near-copies
    mel_sim = seq_sim(ia, ib)
    rhy_sim = seq_sim(da, db)
    ct = abs(corr(contour(pa), contour(pb)))
    mel_ok = mel_sim <= 0.80
    rhy_ok = rhy_sim <= 0.85
    ct_ok = ct <= 0.90
    comp_results.append((name, mel_ok, f"mel {mel_sim:.2f}",
                         rhy_ok, f"rhy {rhy_sim:.2f}", ct_ok, f"ct {ct:.2f}"))

# ── report ────────────────────────────────────────────────────
ar = {r[0]: r for r in audio_results}
cr = {r[0]: r for r in comp_results}
all_pass = True
for name in sorted(ar):
    a_ = ar[name]; c_ = cr.get(name, (None,)*7)
    ok = a_[1] and a_[3] and a_[5] and c_[1] and c_[3] and c_[5]
    all_pass &= ok
    print(f"{name:18s} SEAM:{'PASS' if a_[1] else 'FAIL'}({a_[2]:.2f}) CLICK:{'PASS' if a_[3] else 'FAIL'}({a_[4]:.3f}) "
          f"THICK:{'PASS' if a_[5] else 'FAIL'}(pk {a_[6]}) | MEL:{'PASS' if c_[1] else 'FAIL'}({c_[2]}) "
          f"RHY:{'PASS' if c_[3] else 'FAIL'}({c_[4]}) CT:{'PASS' if c_[5] else 'FAIL'}({c_[6]})")
print(f"\n{'ALL GATES PASS' if all_pass else 'SOME GATES FAIL'}")
sys.exit(0 if all_pass else 1)