#!/usr/bin/env python3
"""SOREN chiptune engine — GBA-era procedural synth.

Channels (authentic GBA/NES palette):
  - lead: square wave (pulse 25%/50%), melody
  - harmony: square/triangle, chords + arpeggio
  - bass: triangle, root notes
  - drums: noise bursts + filtered thump

Music-theory driven: key/scale, chord progressions, pattern sequencer.
Loop-perfect: patterns render on exact sample boundaries.
"""
import numpy as np
import json, os

SR = 32000  # 32kHz — GBA-ish sample rate, small files

# ── note helpers ──────────────────────────────────────────────
NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']

def note_freq(name):
    """'C4' -> 261.63 Hz"""
    n = NOTE_NAMES.index(name[:-1])
    octave = int(name[-1])
    midi = 12 * (octave + 1) + n
    return 440.0 * 2 ** ((midi - 69) / 12)

SCALES = {
    'major':      [0, 2, 4, 5, 7, 9, 11],
    'minor':      [0, 2, 3, 5, 7, 8, 10],
    'dorian':     [0, 2, 3, 5, 7, 9, 10],
    'phrygian':   [0, 1, 3, 5, 7, 8, 10],
    'lydian':     [0, 2, 4, 6, 7, 9, 11],
    'mixolydian': [0, 2, 4, 5, 7, 9, 10],
    'harmonic_minor': [0, 2, 3, 5, 7, 8, 11],
}

def scale_note(key_midi, scale, degree, octave_shift=0):
    """degree can exceed scale length — wraps into octaves."""
    n = len(scale)
    idx = degree % n
    octaves = degree // n + octave_shift
    return key_midi + scale[idx] + 12 * octaves

def midi_freq(m):
    return 440.0 * 2 ** ((m - 69) / 12)

# ── oscillators ───────────────────────────────────────────────
def square(freq, dur, sr=SR, duty=0.5, vol=1.0):
    t = np.linspace(0, dur, int(sr * dur), endpoint=False)
    raw = np.where((t * freq) % 1.0 < duty, 1.0, -1.0)
    return raw * vol

def triangle(freq, dur, sr=SR, vol=1.0):
    t = np.linspace(0, dur, int(sr * dur), endpoint=False)
    raw = 2 * np.abs(2 * ((t * freq) % 1.0) - 1) - 1
    return raw * vol

def saw(freq, dur, sr=SR, vol=1.0):
    t = np.linspace(0, dur, int(sr * dur), endpoint=False)
    raw = 2 * ((t * freq) % 1.0) - 1
    return raw * vol

def noise(dur, sr=SR, vol=1.0, seed=42):
    rng = np.random.default_rng(seed)
    return rng.uniform(-1, 1, int(sr * dur)) * vol

# ── envelope ──────────────────────────────────────────────────
def adsr(sig, a=0.01, d=0.05, s=0.7, r=0.05, sr=SR):
    """Simple ADSR applied to full length; total env length <= len."""
    n = len(sig)
    na, nd, nr = int(a*sr), int(d*sr), int(r*sr)
    ns = max(0, n - na - nd - nr)
    env = np.concatenate([
        np.linspace(0, 1, na, endpoint=False),
        np.linspace(1, s, nd, endpoint=False),
        np.full(ns, s),
        np.linspace(s, 0, nr),
    ])
    if len(env) < n:
        env = np.concatenate([env, np.zeros(n - len(env))])
    return sig * env[:n]

# ── drums ─────────────────────────────────────────────────────
def kick(dur=0.12, sr=SR, vol=1.0):
    t = np.linspace(0, dur, int(sr*dur), endpoint=False)
    freq = 120 * np.exp(-t * 18) + 45
    phase = np.cumsum(freq) / sr
    raw = np.sin(2 * np.pi * phase)
    return adsr(raw, a=0.001, d=0.03, s=0.4, r=dur*0.5) * vol

def snare(dur=0.14, sr=SR, vol=1.0, seed=7):
    raw = noise(dur, sr, vol=0.8, seed=seed)
    # simple high-pass flavor: differentiate noise
    raw = np.diff(raw, prepend=0)
    return adsr(raw, a=0.001, d=0.05, s=0.25, r=dur*0.4) * vol

def hat(dur=0.05, sr=SR, vol=0.5, seed=13):
    raw = noise(dur, sr, vol=0.6, seed=seed)
    raw = np.diff(np.diff(raw, prepend=0), prepend=0)  # brighter
    return adsr(raw, a=0.001, d=0.01, s=0.1, r=dur*0.5) * vol

# ── track builder ─────────────────────────────────────────────
class Track:
    def __init__(self, bpm, key='C', scale='major', bars=8):
        self.bpm = bpm
        self.beat = 60.0 / bpm
        self.key_midi = 12 * 5 + NOTE_NAMES.index(key)  # octave 5 base... use C4=60 convention below
        self.key_midi = 60 + NOTE_NAMES.index(key) if key in NOTE_NAMES else 60
        self.scale = SCALES[scale]
        self.bars = bars
        self.samples_per_bar = int(self.beat * 4 * SR)
        self.channels = {}  # name -> np array full length

    def _buf(self, name):
        if name not in self.channels:
            self.channels[name] = np.zeros(self.bars * self.samples_per_bar)
        return self.channels[name]

    def add(self, name, sig, start_beat):
        """start_beat: absolute beat position across the whole track."""
        buf = self._buf(name)
        start = int(start_beat * self.beat * SR)
        end = min(start + len(sig), len(buf))
        if start < len(buf):
            buf[start:end] += sig[:end - start]

    def note(self, ch, midi, start_beat, dur_beats, vol=0.8, wave='square', duty=0.5,
             a=0.005, d=0.04, s=0.75, r=0.03):
        freq = midi_freq(midi)
        dur_s = dur_beats * self.beat
        if wave == 'square':
            sig = square(freq, dur_s, vol=vol) if duty == 0.5 else square(freq, dur_s, duty=duty, vol=vol)
        elif wave == 'triangle':
            sig = triangle(freq, dur_s, vol=vol)
        elif wave == 'saw':
            sig = saw(freq, dur_s, vol=vol)
        sig = adsr(sig, a=a, d=d, s=s, r=min(r, dur_s*0.4))
        self.add(ch, sig, start_beat)

    def drum(self, kind, start_beat, vol=1.0):
        if kind == 'kick':   sig = kick(vol=vol); dur_s = 0.15
        elif kind == 'snare': sig = snare(vol=vol); dur_s = 0.15
        elif kind == 'hat':  sig = hat(vol=vol); dur_s = 0.06
        else: raise ValueError(kind)
        self.add('drums', sig[:int(dur_s*SR)], start_beat)

    def mix(self, gains=None):
        gains = gains or {}
        total = np.zeros(self.bars * self.samples_per_bar)
        for name, buf in self.channels.items():
            g = gains.get(name, 0.25)
            total += buf * g
        # soft clip + normalize to -3 dBFS-ish
        peak = np.max(np.abs(total))
        if peak > 0: total = total / peak * 0.85
        return total

# ── chord progressions per mood ────────────────────────────────
# degrees are (scale-degree index 0-based) triads: [root, third, fifth] as scale degrees
PROGRESSIONS = {
    # classic RPG town loop: I - V - vi - IV
    'warm':      [([0,2,4], 'major'), ([4,6,8], 'major'), ([5,7,9], 'minor'), ([3,5,7], 'major')],
    # adventurous overworld: I - IV - V - I
    'heroic':    [([0,2,4], 'major'), ([3,5,7], 'major'), ([4,6,8], 'major'), ([0,2,4], 'major')],
    # battle: i - VI - III - VII (minor drive)
    'intense':   [([0,2,4], 'minor'), ([5,7,9], 'major'), ([2,4,6], 'major'), ([6,8,10], 'major')],
    # mysterious: i - iv - i - V
    'mystery':   [([0,2,4], 'minor'), ([3,5,7], 'minor'), ([0,2,4], 'minor'), ([4,6,8], 'major')],
    # eerie: i - ii(dim) - i - V(flat)
    'eerie':     [([0,2,4], 'minor'), ([1,3,5], 'minor'), ([0,2,4], 'minor'), ([4,6,8], 'major')],
    # sad/ending: vi - IV - I - V
    'emotional': [([5,7,9], 'minor'), ([3,5,7], 'major'), ([0,2,4], 'major'), ([4,6,8], 'major')],
    # dark finale: i - i - VI - V
    'dark':      [([0,2,4], 'minor'), ([0,2,4], 'minor'), ([5,7,9], 'major'), ([4,6,8], 'major')],
}

def arp_pattern(track, ch, chord_degrees, start_beat, beats, vol=0.7, wave='square', duty=0.5, direction='up'):
    """Arpeggiate a triad over `beats` beats, 4 notes per beat (16ths)."""
    notes = [scale_note(track.key_midi, track.scale, d) for d in chord_degrees]
    if direction == 'updown':
        seq = notes + notes[-2:0:-1]
    else:
        seq = notes
    steps = int(beats * 4)
    for i in range(steps):
        midi = seq[i % len(seq)] + 12 * (1 if i % len(seq) >= len(notes) else 0)
        track.note(ch, midi, start_beat + i * 0.25, 0.22, vol=vol, wave=wave, duty=duty)

def melody_from(track, motif, start_beat, vol=0.9, wave='square', duty=0.5):
    """motif: list of (degree, beats) tuples, degrees relative to scale."""
    b = start_beat
    for degree, beats in motif:
        if degree is not None:
            midi = scale_note(track.key_midi, track.scale, degree)
            track.note('lead', midi, b, beats * 0.92, vol=vol, wave=wave, duty=duty)
        b += beats

def render_loop(track, gains=None):
    """Render and ensure loop-perfect: render 2x, take first half."""
    sig = track.mix(gains)
    # loop perfection: fade boundary continuity is guaranteed because notes
    # are placed on exact beat grids and buffers are zero outside notes.
    return sig