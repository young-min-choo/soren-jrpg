#!/usr/bin/env python3
"""Compose the SOREN soundtrack — 15 loop-able chiptune themes.

Renders via chiptune_engine (procedural GBA-style synth) to WAV
(32kHz 16-bit mono), then a later step converts to OGG for Phaser.
"""
import numpy as np, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from chiptune_engine import (Track, PROGRESSIONS, arp_pattern, melody_from,
                             scale_note, SR, note_freq, NOTE_NAMES)

OUT = '/home/min/dev/soren-jrpg/public/audio'
os.makedirs(OUT, exist_ok=True)

def save_wav(name, sig):
    """16-bit PCM mono WAV."""
    data = (np.clip(sig, -1, 1) * 32767).astype('<i2').tobytes()
    import wave
    with wave.open(f'{OUT}/{name}.wav', 'wb') as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(data)
    print(f"{name}: {len(sig)/SR:.1f}s")

def build_track(bpm, key, scale, bars, prog_key, melody=None, arp_ch=None,
                drums=None, bass=True, harmony_vol=0.5, lead_vol=0.9):
    """Standard 4/4 loop builder: chord pads + arp + bass + optional melody/drums."""
    t = Track(bpm, key, scale, bars)
    prog = PROGRESSIONS[prog_key]
    beats_per_chord = (bars * 4) / len(prog)
    # chord pads + bass roots + arp
    for i, (degrees, quality) in enumerate(prog):
        start = i * beats_per_chord
        for d in degrees:
            midi = scale_note(t.key_midi, t.scale, d)
            t.note('harmony', midi, start, beats_per_chord * 0.95, vol=harmony_vol, wave='triangle')
        # bass: root, octave down, on beats 1 and 3
        root = scale_note(t.key_midi, t.scale, degrees[0]) - 24
        for b in np.arange(0, beats_per_chord, 2):
            t.note('bass', root, start + b, 1.6, vol=0.9, wave='triangle')
            t.note('bass', root + 12, start + b + 1, 0.9, vol=0.7, wave='triangle')
        if arp_ch:
            arp_pattern(t, 'arp', degrees, start, beats_per_chord, vol=0.5, wave='square', duty=0.25)
    if melody:
        melody_from(t, melody, 0, vol=lead_vol)
    if drums:
        total_beats = bars * 4
        for b in np.arange(0, total_beats, 1):
            t.drum('kick', b, vol=0.9)
            if drums == 'full' and b % 1 in (0.5,):
                t.drum('snare', b + 0.5, vol=0.7)
            if drums == 'full':
                t.drum('hat', b + 0.75, vol=0.3)
    return t

# ── The 15 tracks ──────────────────────────────────────────────
# 1. Title — slow, mysterious minor
t = build_track(72, 'A', 'minor', 8, 'mystery', arp_ch=True, harmony_vol=0.4)
melody_from(t, [(4, 2), (2, 1), (3, 1), (2, 2), (0, 2), (None, 1), (2, 1)], 0, vol=0.8)
save_wav('title_theme', t.mix({'lead': 0.3, 'harmony': 0.22, 'bass': 0.25, 'arp': 0.12, 'drums': 0.2}))

# 2. Village — warm major, gentle
t = build_track(96, 'C', 'major', 8, 'warm', arp_ch=True, harmony_vol=0.45)
melody_from(t, [(0, 1), (2, 1), (4, 2), (7, 1), (4, 1), (2, 2), (4, 1), (2, 1), (0, 2)], 0, vol=0.75)
save_wav('village_theme', t.mix({'lead': 0.28, 'harmony': 0.2, 'bass': 0.22, 'arp': 0.14, 'drums': 0.15}))

# 3. Overworld — heroic, driving
t = build_track(120, 'C', 'major', 8, 'heroic', arp_ch=True, drums='full', harmony_vol=0.4)
melody_from(t, [(0, 1), (4, 1), (7, 1), (4, 1), (2, 2), (0, 1), (2, 1), (4, 2), (7, 2)], 0, vol=0.85)
save_wav('overworld_theme', t.mix({'lead': 0.3, 'harmony': 0.18, 'bass': 0.22, 'arp': 0.12, 'drums': 0.3}))

# 4. Battle — fast minor drive
t = build_track(152, 'A', 'minor', 8, 'intense', arp_ch=True, drums='full', harmony_vol=0.35)
melody_from(t, [(0, 0.5), (0, 0.5), (2, 0.5), (3, 0.5), (4, 1), (2, 1), (0, 1), (7, 1), (5, 1), (4, 1)], 0, vol=0.9)
save_wav('battle_theme', t.mix({'lead': 0.32, 'harmony': 0.15, 'bass': 0.25, 'arp': 0.15, 'drums': 0.35}))

# 5. Boss — darker, half-step menace
t = build_track(140, 'D', 'harmonic_minor', 8, 'dark', arp_ch=True, drums='full', harmony_vol=0.4)
melody_from(t, [(0, 1), (1, 1), (0, 1), (4, 1), (3, 2), (2, 2), (0, 2), (None, 2)], 0, vol=0.85)
save_wav('boss_theme', t.mix({'lead': 0.3, 'harmony': 0.2, 'bass': 0.28, 'arp': 0.16, 'drums': 0.34}))

# 6. Dungeon (ruins) — eerie sparse
t = build_track(80, 'E', 'phrygian', 8, 'eerie', arp_ch=True, harmony_vol=0.3)
save_wav('dungeon_theme', t.mix({'lead': 0.25, 'harmony': 0.18, 'bass': 0.22, 'arp': 0.15, 'drums': 0.1}))

# 7. Cave of Embers — dark + rhythmic
t = build_track(104, 'C', 'minor', 8, 'dark', arp_ch=True, drums='full', harmony_vol=0.35)
save_wav('embers_theme', t.mix({'lead': 0.26, 'harmony': 0.18, 'bass': 0.26, 'arp': 0.14, 'drums': 0.28}))

# 8. Tide Temple — flowing, lydian brightness
t = build_track(88, 'G', 'lydian', 8, 'mystery', arp_ch=True, harmony_vol=0.4)
melody_from(t, [(0, 2), (3, 1), (2, 1), (4, 2), (6, 1), (4, 1), (2, 2)], 0, vol=0.7)
save_wav('tide_theme', t.mix({'lead': 0.26, 'harmony': 0.2, 'bass': 0.2, 'arp': 0.16, 'drums': 0.12}))

# 9. Hollow Deep — slow heavy minor
t = build_track(76, 'D', 'minor', 8, 'dark', arp_ch=True, harmony_vol=0.45)
save_wav('hollow_theme', t.mix({'lead': 0.24, 'harmony': 0.2, 'bass': 0.3, 'arp': 0.14, 'drums': 0.18}))

# 10. Storm Spire — driving dorian
t = build_track(128, 'E', 'dorian', 8, 'intense', arp_ch=True, drums='full', harmony_vol=0.4)
melody_from(t, [(0, 1), (3, 1), (4, 1), (3, 1), (2, 2), (0, 2), (6, 2)], 0, vol=0.8)
save_wav('spire_theme', t.mix({'lead': 0.3, 'harmony': 0.18, 'bass': 0.24, 'arp': 0.15, 'drums': 0.3}))

# 11. Port Meridian — bright sea shanty feel
t = build_track(112, 'F', 'major', 8, 'warm', arp_ch=True, drums='full', harmony_vol=0.4)
melody_from(t, [(4, 1), (4, 1), (5, 1), (7, 1), (5, 2), (4, 2), (2, 2)], 0, vol=0.8)
save_wav('port_theme', t.mix({'lead': 0.3, 'harmony': 0.2, 'bass': 0.22, 'arp': 0.13, 'drums': 0.26}))

# 12. Stonewatch — steady, grounded
t = build_track(100, 'G', 'mixolydian', 8, 'heroic', arp_ch=True, harmony_vol=0.42)
save_wav('stonewatch_theme', t.mix({'lead': 0.27, 'harmony': 0.2, 'bass': 0.24, 'arp': 0.14, 'drums': 0.2}))

# 13. Skyhold — airy, suspended
t = build_track(84, 'A', 'lydian', 8, 'mystery', arp_ch=True, harmony_vol=0.38)
save_wav('skyhold_theme', t.mix({'lead': 0.26, 'harmony': 0.22, 'bass': 0.18, 'arp': 0.17, 'drums': 0.1}))

# 14. Betrayal — emotional minor
t = build_track(70, 'A', 'minor', 8, 'emotional', arp_ch=True, harmony_vol=0.42)
melody_from(t, [(5, 2), (4, 1), (2, 1), (0, 2), (2, 2), (4, 4)], 0, vol=0.75)
save_wav('betrayal_theme', t.mix({'lead': 0.3, 'harmony': 0.22, 'bass': 0.2, 'arp': 0.12, 'drums': 0.1}))

# 15. Ending — warm resolution
t = build_track(78, 'C', 'major', 8, 'emotional', arp_ch=True, harmony_vol=0.45)
melody_from(t, [(0, 2), (2, 1), (4, 1), (7, 2), (4, 2), (2, 1), (0, 1), (0, 4)], 0, vol=0.8)
save_wav('ending_theme', t.mix({'lead': 0.3, 'harmony': 0.24, 'bass': 0.22, 'arp': 0.14, 'drums': 0.12}))

print("\nAll 15 themes rendered.")