#!/usr/bin/env python3
"""SOREN soundtrack v2 — MP2K-orchestral, FF/FE-style composition.

v2.2: 32-bar A/A'/B/B' form (128-beat frame), auto motif development,
distinct B melodies (variety gate), circular reverb (loop-perfect),
counter-melodies in thirds, harp arpeggios, orchestral percussion.
"""
import os, sys, math
import numpy as np
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from mp2k_engine import Song, midi, INSTRUMENTS, SR

OUT = '/home/min/dev/soren-jrpg/public/audio'
os.makedirs(OUT, exist_ok=True)

MAJOR = [0, 2, 4, 5, 7, 9, 11]
MINOR = [0, 2, 3, 5, 7, 8, 10]
DORIAN = [0, 2, 3, 5, 7, 9, 10]
PHRYG = [0, 1, 3, 5, 7, 8, 10]
LYDIAN = [0, 2, 4, 6, 7, 9, 11]
MIXO = [0, 2, 4, 5, 7, 9, 10]
HMINOR = [0, 2, 3, 5, 7, 8, 11]

def deg(key, scale, d, octaves=0):
    n = len(scale)
    return key + scale[d % n] + 12 * (d // n + octaves)

def melody_from_motif(key, scale, motif, octave=1):
    """Motif auto-development into a full 32-beat section: statement, answer
    (+2 scale degrees), restatement, cadence. No dead air, real development."""
    def place(m, start, shift):
        out, b = [], start
        for d, dur, vel in m:
            if d is not None:
                out.append((b, dur * 0.92, deg(key, scale, d + shift, octave), vel))
            b += dur
        return out, b
    notes, L = place(motif, 0, 0)
    step = math.ceil(L / 4) * 4
    shifts = [2, 0, -3, 2]
    si = 0
    while step + L <= 32 - 4:
        ns, _ = place(motif, step, shifts[si % len(shifts)])
        notes += ns
        si += 1
        step += max(4, math.ceil(L / 4) * 4)
    cad_start = min(max(step, 32 - 8), 32)
    rem = 32 - cad_start
    if rem >= 8:
        notes += place([(4, 2, 0.85), (2, 2, 0.8), (0, 4, 0.9)], cad_start, 0)[0]
    elif rem >= 4:
        notes += place([(2, 1, 0.8), (0, 3, 0.85)], cad_start, 0)[0]
    elif rem > 0:
        notes += place([(0, rem, 0.85)], cad_start, 0)[0]
    return notes

def counter_thirds(mel, shift=-3):
    return [(s, d, m + shift, v * 0.6) for (s, d, m, v) in mel]

def repeat_at(mel, start):
    return [(s + start, d, m, v) for (s, d, m, v) in mel]

def bass_line(key, scale, prog, start=0, bars=8):
    out = []
    per = bars * 4 // len(prog)
    for ci, triad in enumerate(prog):
        root = triad[0]
        s0 = start + ci * per
        for b in range(0, per, 2):
            out.append((s0 + b, 1.8, deg(key, scale, root, -2), 0.9))
    return out

def build_theme(bpm, key, scale, prog_a, prog_b, mel_a, mel_b,
                lead='flute', counter='strings', pad='choir',
                harp_arp=False, drums=None, timpani=False):
    """32-bar / 128-beat form: A (0-31) A' (32-63) B (64-95) B' (96-127)."""
    s = Song(bpm, bars=32)
    # pads (low voicing + soft upper)
    for start, prog, vel in ((0, prog_a, 0.7), (32, prog_a, 0.65),
                             (64, prog_b, 0.75), (96, prog_b, 0.7)):
        for ci, triad in enumerate(prog):
            s.add(pad, 0.9, [(start + ci * 8, 8, deg(key, scale, t, -1), vel * 0.8)
                             for t in triad])
            s.add(pad, 0.5, [(start + ci * 8, 8, deg(key, scale, t, 0), vel * 0.6)
                             for t in triad])
    # bass — roots through all four sections
    bass = []
    for start, prog in ((0, prog_a), (32, prog_a), (64, prog_b), (96, prog_b)):
        bass += bass_line(key, scale, prog, start)
    s.add('strings', 0.5, bass)
    # lead melody: A A' B B'
    s.add(lead, 1.0, mel_a + repeat_at(mel_a, 32) + repeat_at(mel_b, 64) + repeat_at(mel_b, 96))
    # counter-melody in thirds (B' uses sixths for variety)
    s.add(counter, 0.55, counter_thirds(mel_a) + repeat_at(counter_thirds(mel_a), 32) +
          counter_thirds(mel_b) + repeat_at(counter_thirds(mel_b), 64) +
          counter_thirds(mel_b, -5) + repeat_at(counter_thirds(mel_b, -5), 96))
    # harp arpeggio — eighths cycling chord degrees
    if harp_arp:
        arp = []
        for start, prog in ((0, prog_a), (32, prog_a), (64, prog_b), (96, prog_b)):
            for ci, triad in enumerate(prog):
                b = start + ci * 8
                while b < start + (ci + 1) * 8:
                    for t in triad:
                        arp.append((b, 0.45, deg(key, scale, t, 1), 0.5))
                        b += 0.5
        s.add('harp', 0.5, arp)
    # drums
    if drums:
        s.add('bd', 0.6, [(b, 1, 36, 0.7) for b in range(0, 128, 2)])
        if drums == 'full':
            s.add('snare', 0.45, [(b, 1, 38, 0.55) for b in range(1, 128, 2)])
        s.add('cymbal', 0.3, [(b, 2, 38, 0.4) for b in range(0, 128, 8)])
    # timpani accents at section heads
    if timpani:
        tp = [(0, 4, deg(key, scale, prog_a[0][0], -2), 1.0),
              (32, 4, deg(key, scale, prog_a[0][0], -2), 0.8),
              (64, 4, deg(key, scale, prog_b[0][0], -2), 1.0),
              (96, 4, deg(key, scale, prog_b[0][0], -2), 0.9)]
        s.add('timpani', 0.7, tp)
    return s

def M(key, scale, motif, octave=1):
    return melody_from_motif(key, scale, motif, octave)

# ═══ 1. TITLE — slow wonder, ocarina + choir + harp ═══
title = build_theme(
    bpm=76, key=69, scale=MINOR,
    prog_a=[[0,2,4],[5,7,9],[3,5,7],[4,6,8]],
    prog_b=[[0,2,4],[2,4,6],[3,5,7],[4,6,8]],
    mel_a=M(69, MINOR, [
        (4,2,0.9),(2,1,0.8),(3,1,0.75),(4,2,0.85),(7,1.5,0.95),(4,1,0.8),
        (2,2,0.7),(0,2,0.75),(None,2,0),(4,1,0.7),(5,1,0.75),
        (7,2,0.9),(9,2,0.85),(7,2,0.8),(4,2,0.7)]),
    mel_b=M(69, MINOR, [
        (7,1.5,0.95),(9,0.5,0.9),(11,2,0.95),(9,1,0.85),(7,1,0.85),
        (4,2,0.8),(5,1,0.8),(7,3,0.9),(None,1,0),
        (11,2,0.95),(9,1,0.9),(7,2,0.85),(4,1,0.8),(2,3,0.85)]),
    lead='ocarina', counter='strings', pad='choir', harp_arp=True, timpani=True)

# ═══ 2. VILLAGE — warm, flute + harp ═══
village = build_theme(
    bpm=96, key=60, scale=MAJOR,
    prog_a=[[0,2,4],[4,6,8],[5,7,9],[3,5,7]],
    prog_b=[[0,2,4],[5,7,9],[1,3,5],[4,6,8]],
    mel_a=M(60, MAJOR, [
        (0,1,0.8),(2,1,0.85),(4,2,0.9),(7,1,0.95),(4,1,0.8),(2,2,0.85),
        (4,1,0.8),(2,1,0.75),(0,2,0.8),(None,2,0),
        (5,1,0.8),(7,1,0.85),(9,2,0.9),(7,1,0.8),(4,2,0.85)]),
    mel_b=M(60, MAJOR, [
        (9,3,0.9),(7,3,0.85),(5,2,0.85),(4,4,0.85),
        (2,3,0.8),(0,3,0.85),(4,2,0.85),(None,2,0),
        (11,4,0.9),(7,4,0.85),(5,2,0.8),(0,4,0.85)]),
    lead='flute', counter='strings', pad='strings', harp_arp=True)

# ═══ 3. OVERWORLD — heroic brass march ═══
overworld = build_theme(
    bpm=116, key=60, scale=MAJOR,
    prog_a=[[0,2,4],[3,5,7],[4,6,8],[0,2,4]],
    prog_b=[[5,7,9],[3,5,7],[4,6,8],[4,6,8]],
    mel_a=M(60, MAJOR, [
        (0,1,0.95),(4,1,1.0),(7,1,1.0),(4,1,0.9),(2,2,0.9),
        (0,1,0.85),(2,1,0.85),(4,2,0.9),(7,2,1.0)]),
    mel_b=M(60, MAJOR, [
        (5,1,0.95),(7,1,1.0),(9,2,1.0),(7,1,0.9),(5,1,0.9),
        (4,2,0.9),(5,1,0.9),(7,1,0.95),(9,2,1.0),(None,2,0),
        (11,2,1.0),(9,1,0.95),(7,2,0.95),(5,2,0.9)]),
    lead='brass', counter='strings', pad='strings', harp_arp=True,
    drums='full', timpani=True)

# ═══ 4. BATTLE — driving harmonic minor ═══
battle = build_theme(
    bpm=148, key=57, scale=HMINOR,
    prog_a=[[0,2,4],[5,7,9],[3,5,7],[4,6,8]],
    prog_b=[[0,2,4],[1,3,5],[5,7,9],[4,6,8]],
    mel_a=M(57, HMINOR, [
        (0,0.5,0.9),(0,0.5,0.85),(2,0.5,0.9),(3,0.5,0.9),
        (4,1,1.0),(2,1,0.9),(0,1,0.9),(7,1,1.0),(5,1,0.9),(4,1,0.95)]),
    mel_b=M(57, HMINOR, [
        (7,0.75,1.0),(11,0.25,1.0),(12,1.5,1.0),(11,0.5,0.95),(9,1,0.95),
        (7,1.5,0.95),(5,0.5,0.9),(4,1,0.95),(2,2,0.9),(0,1.5,0.95),(None,0.5,0),
        (4,0.75,0.95),(5,0.25,0.95),(7,1.5,1.0),(9,0.5,0.95),(7,1,0.9),(4,2.5,0.9)]),
    lead='brass', counter='strings', pad='strings', drums='full', timpani=True)

# ═══ 5. BOSS — phrygian menace ═══
boss = build_theme(
    bpm=136, key=50, scale=PHRYG,
    prog_a=[[0,2,4],[1,3,5],[0,2,4],[4,6,8]],
    prog_b=[[0,2,4],[5,7,9],[1,3,5],[4,6,8]],
    mel_a=M(50, PHRYG, [
        (0,1,1.0),(1,1,0.95),(0,1,0.9),(4,1,1.0),(3,2,0.95),
        (2,1,0.9),(0,2,0.9),(None,2,0)]),
    mel_b=M(50, PHRYG, [
        (7,0.25,1.0),(8,0.25,1.0),(7,0.5,1.0),(4,3,1.0),
        (0,0.25,0.95),(1,0.25,0.95),(0,0.5,0.95),(3,3,0.95),
        (7,0.25,1.0),(8,0.25,1.0),(10,0.5,1.0),(7,3,0.95),
        (1,1,0.95),(0,3,0.9)]),
    lead='brass', counter='strings', pad='choir', drums='full', timpani=True)

# ═══ 6. DUNGEON — eerie phrygian ═══
dungeon = build_theme(
    bpm=80, key=64, scale=PHRYG,
    prog_a=[[0,2,4],[1,3,5],[0,2,4],[4,6,8]],
    prog_b=[[0,2,4],[3,5,7],[1,3,5],[0,2,4]],
    mel_a=M(64, PHRYG, [
        (0,3,0.7),(1,1,0.65),(3,2,0.7),(4,3,0.75),(None,4,0),
        (7,2,0.7),(4,2,0.65),(3,4,0.6)]),
    mel_b=M(64, PHRYG, [
        (4,2,0.75),(3,1,0.7),(2,1,0.7),(0,2,0.75),(None,2,0),
        (7,3,0.8),(5,1,0.75),(4,2,0.75),(3,2,0.7),(0,4,0.7)]),
    lead='flute', counter='strings', pad='choir')

# ═══ 7. EMBERS — dark rhythmic ═══
embers = build_theme(
    bpm=104, key=48, scale=MINOR,
    prog_a=[[0,2,4],[0,2,4],[5,7,9],[4,6,8]],
    prog_b=[[3,5,7],[0,2,4],[4,6,8],[5,7,9]],
    mel_a=M(48, MINOR, [
        (0,1,0.85),(0,0.5,0.8),(0,0.5,0.8),(2,1,0.85),(3,1,0.9),
        (4,1.5,0.9),(2,1,0.85),(0,1.5,0.8),(None,2,0)]),
    mel_b=M(48, MINOR, [
        (7,1,0.9),(8,1,0.9),(7,1,0.9),(5,1,0.85),
        (4,2,0.9),(2,1,0.85),(0,2,0.85),(None,2,0),
        (0,1,0.9),(3,1,0.9),(4,2,0.95),(7,2,0.9)]),
    lead='brass', counter='strings', pad='choir', drums='full', timpani=True)

# ═══ 8. TIDE TEMPLE — lydian water ═══
tide = build_theme(
    bpm=88, key=67, scale=LYDIAN,
    prog_a=[[0,2,4],[3,5,7],[1,3,5],[4,6,8]],
    prog_b=[[0,2,4],[5,7,9],[3,5,7],[4,6,8]],
    mel_a=M(67, LYDIAN, [
        (0,2,0.8),(3,1,0.75),(2,1,0.8),(4,2,0.85),(6,1,0.9),(4,1,0.8),
        (2,2,0.75),(None,2,0),(7,2,0.85),(6,2,0.8),(4,2,0.75)]),
    mel_b=M(67, LYDIAN, [
        (4,3,0.85),(7,0.5,0.85),(6,0.5,0.8),(4,2,0.8),(None,2,0),
        (9,3,0.9),(7,0.5,0.85),(6,1,0.85),(4,2,0.8),(2,2.5,0.8)]),
    lead='flute', counter='strings', pad='strings', harp_arp=True)

# ═══ 9. HOLLOW DEEP — heavy dark low ═══
hollow = build_theme(
    bpm=72, key=50, scale=MINOR,
    prog_a=[[0,2,4],[5,7,9],[0,2,4],[3,5,7]],
    prog_b=[[4,6,8],[5,7,9],[0,2,4],[4,6,8]],
    mel_a=M(50, MINOR, [
        (0,4,0.8),(2,2,0.75),(0,2,0.7),(5,4,0.85),(4,4,0.8),(None,4,0)]),
    mel_b=M(50, MINOR, [
        (7,2,0.8),(5,2,0.75),(4,4,0.8),(None,4,0),
        (8,4,0.85),(7,2,0.8),(5,2,0.75),(4,4,0.8)]),
    lead='strings', counter='flute', pad='choir', timpani=True)

# ═══ 10. STORM SPIRE — dorian drive ═══
spire = build_theme(
    bpm=126, key=64, scale=DORIAN,
    prog_a=[[0,2,4],[3,5,7],[0,2,4],[4,6,8]],
    prog_b=[[5,7,9],[3,5,7],[4,6,8],[0,2,4]],
    mel_a=M(64, DORIAN, [
        (0,1,0.9),(3,1,0.9),(4,1,0.95),(3,1,0.85),(2,2,0.9),
        (0,2,0.85),(6,2,0.9)]),
    mel_b=M(64, DORIAN, [
        (7,1,0.95),(6,1,0.9),(4,1,0.9),(3,1,0.9),
        (4,2,0.95),(None,2,0),(0,1,0.9),(3,1,0.9),(4,2,0.95),(6,2,0.9)]),
    lead='brass', counter='strings', pad='strings', drums='full', harp_arp=True)

# ═══ 11. PORT MERIDIAN — bright mixolydian dance ═══
port = build_theme(
    bpm=112, key=65, scale=MIXO,
    prog_a=[[0,2,4],[4,6,8],[5,7,9],[4,6,8]],
    prog_b=[[0,2,4],[2,4,6],[5,7,9],[4,6,8]],
    mel_a=M(65, MIXO, [
        (4,1,0.85),(4,1,0.8),(5,1,0.85),(7,1,0.9),(5,2,0.85),
        (4,2,0.8),(2,2,0.85),(None,2,0)]),
    mel_b=M(65, MIXO, [
        (0,1.5,0.85),(2,0.5,0.85),(4,1,0.9),(2,2,0.8),(0,1.5,0.85),
        (7,0.5,0.9),(5,1,0.85),(4,2.5,0.85),(None,1,0),
        (4,1.5,0.85),(2,0.5,0.85),(0,3,0.85),(0,2,0.8)]),
    lead='flute', counter='brass', pad='strings', harp_arp=True, drums='full')

# ═══ 12. STONEWATCH — steady march ═══
stonewatch = build_theme(
    bpm=100, key=67, scale=MIXO,
    prog_a=[[0,2,4],[4,6,8],[5,7,9],[0,2,4]],
    prog_b=[[3,5,7],[4,6,8],[5,7,9],[4,6,8]],
    mel_a=M(67, MIXO, [
        (0,2,0.85),(4,1,0.8),(2,1,0.85),(4,2,0.9),(7,2,0.85),
        (5,1,0.8),(4,1,0.85),(2,2,0.8)]),
    mel_b=M(67, MIXO, [
        (7,1.5,0.9),(5,0.5,0.85),(4,2,0.9),(2,2,0.85),(0,1.5,0.85),
        (4,0.5,0.85),(5,1,0.9),(7,2.5,0.9),(None,1.5,0),
        (9,3,0.9),(7,0.5,0.85),(5,1.5,0.85),(4,2.5,0.8)]),
    lead='brass', counter='strings', pad='strings', drums='full', timpani=True)

# ═══ 13. SKYHOLD — airy lydian suspension ═══
skyhold = build_theme(
    bpm=84, key=69, scale=LYDIAN,
    prog_a=[[0,2,4],[4,6,8],[1,3,5],[5,7,9]],
    prog_b=[[0,2,4],[3,5,7],[4,6,8],[5,7,9]],
    mel_a=M(69, LYDIAN, [
        (0,2,0.75),(2,1,0.7),(4,1,0.8),(6,2,0.85),(7,2,0.8),
        (4,2,0.75),(None,4,0)]),
    mel_b=M(69, LYDIAN, [
        (11,2,0.85),(9,1,0.8),(7,1,0.8),(9,2,0.8),(None,2,0),
        (6,3,0.85),(4,1,0.75),(2,2,0.75),(0,4,0.8)]),
    lead='flute', counter='ocarina', pad='choir', harp_arp=True)

# ═══ 14. BETRAYAL — emotional strings ═══
betrayal = build_theme(
    bpm=70, key=69, scale=MINOR,
    prog_a=[[5,7,9],[3,5,7],[0,2,4],[4,6,8]],
    prog_b=[[5,7,9],[2,4,6],[3,5,7],[4,6,8]],
    mel_a=M(69, MINOR, [
        (5,2,0.85),(4,1,0.8),(2,1,0.75),(0,2,0.8),(2,2,0.75),
        (4,4,0.85),(None,4,0)]),
    mel_b=M(69, MINOR, [
        (0,3,0.85),(2,1,0.8),(3,2,0.85),(4,2,0.8),(5,4,0.85),
        (None,2,0),(7,3,0.9),(5,1,0.8),(4,4,0.85)]),
    lead='strings', counter='flute', pad='choir', harp_arp=True)

# ═══ 15. ENDING — warm resolution ═══
ending = build_theme(
    bpm=78, key=60, scale=MAJOR,
    prog_a=[[0,2,4],[4,6,8],[5,7,9],[3,5,7]],
    prog_b=[[5,7,9],[4,6,8],[0,2,4],[0,2,4]],
    mel_a=M(60, MAJOR, [
        (0,2,0.8),(2,1,0.75),(4,1,0.8),(7,2,0.85),(4,2,0.8),
        (2,1,0.75),(0,1,0.8),(0,4,0.85)]),
    mel_b=M(60, MAJOR, [
        (7,3,0.85),(9,0.5,0.8),(7,0.5,0.8),(4,2,0.8),
        (5,1.5,0.8),(4,0.5,0.8),(2,2,0.85),(None,1.5,0),
        (0,3,0.85),(2,0.5,0.8),(4,0.5,0.8),(7,3.5,0.9)]),
    lead='ocarina', counter='strings', pad='choir', harp_arp=True, timpani=True)

# ════════════════════════════════════════════════════════════════
# RENDER + EXPORT
# ════════════════════════════════════════════════════════════════
import wave
import subprocess

def save_ogg(stereo, name):
    wav = f'/tmp/{name}.wav'
    data = (np.clip(stereo, -1, 1) * 32767).astype('<i2')
    with wave.open(wav, 'wb') as w:
        w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
        w.writeframes(data.tobytes())
    out = f'{OUT}/{name}.ogg'
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', wav,
                    '-c:a', 'libvorbis', '-qscale:a', '4', out], check=True, timeout=120)
    print(f"{name}: {len(stereo)/SR:.0f}s", flush=True)

THEMES = {
    'title_theme': title, 'village_theme': village, 'overworld_theme': overworld,
    'battle_theme': battle, 'boss_theme': boss, 'dungeon_theme': dungeon,
    'embers_theme': embers, 'tide_theme': tide, 'hollow_theme': hollow,
    'spire_theme': spire, 'port_theme': port, 'stonewatch_theme': stonewatch,
    'skyhold_theme': skyhold, 'betrayal_theme': betrayal, 'ending_theme': ending,
}

if __name__ == '__main__':
    for name, song in THEMES.items():
        st = song.render()
        save_ogg(st, name)
    print("\nAll 15 themes rendered (v2.2).")