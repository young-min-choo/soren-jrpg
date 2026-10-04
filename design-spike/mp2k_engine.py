#!/usr/bin/env python3
"""SOREN music engine v2 — GBA MP2K-style sample-based synthesis.

The v1 raw-oscillator engine sounded like 1985 NES. Real GBA JRPGs (FF Advance,
Fire Emblem) used the MP2K/Sappy driver: PCM instrument samples through
sequenced channels. Recreating that with additive synthesis:

Instruments (the FF GBA orchestral palette):
  - strings: detuned saw stack + slow vibrato + ensemble chorus (5 voices)
  - brass: saw with formant boost + pitch envelope swell
  - flute: sine + breath noise + slight vibrato
  - ocarina: pure sine + 2nd harmonic
  - harp: Karplus-Strong plucked string, bright decay
  - choir: filtered saw formants (aah) with slow attack
  - timpani: pitched membrane (sine with pitch drop + noise burst)
  - percussion: orchestral bass drum, snare brush, suspended cymbal shimmer

Space: Schroeder reverb (4 combs + 2 allpass), stereo haas width.
Form: A/B sections (8+8 bars), dynamics, counter-melody in thirds/sixths.
"""
import numpy as np
from math import exp

SR = 44100  # CD-quality render; downsample at export

def midi(m): return 440.0 * 2 ** ((m - 69) / 12)

# ── core DSP blocks ────────────────────────────────────────────
def env_exp(n, attack, decay, sustain_level, release, sr=SR):
    """Exponential ADSR as float array."""
    t = np.arange(n) / sr
    a = np.clip(t / max(attack, 1e-4), 0, 1)
    d = np.where(t > attack, np.exp(-(t - attack) / max(decay, 1e-3)), 1.0)
    env = a * np.maximum(d, sustain_level)
    rel_start = max(0, n / sr - release)
    rel = np.clip((t - rel_start) / max(release, 1e-4), 0, 1)
    return env * (1 - rel)

def saw(freq, n, sr=SR):
    t = np.arange(n) / sr
    return 2 * ((t * freq) % 1.0) - 1

def sine(freq, n, sr=SR):
    t = np.arange(n) / sr
    return np.sin(2 * np.pi * freq * t)

def vibrato(sig, rate_hz, depth_semis, sr=SR):
    n = len(sig)
    t = np.arange(n) / sr
    # delay modulation: linear interp pitch wobble
    delay = (depth_semis / 12.0) * sr / 440.0 * np.sin(2 * np.pi * rate_hz * t)
    out = np.zeros(n)
    idx = np.arange(n) + delay
    i0 = np.clip(idx.astype(int), 0, n - 2)
    frac = np.clip(idx - i0, 0, 1)
    out = sig[i0] * (1 - frac) + sig[i0 + 1] * frac
    return out

def one_pole_lp(sig, alpha):
    """Simple lowpass: alpha 0-1, lower = darker."""
    out = np.empty_like(sig)
    acc = 0.0
    for i, s in enumerate(sig):
        acc += alpha * (s - acc)
        out[i] = acc
    return out

def lowpass_fft(sig, cutoff_hz, sr=SR):
    """FFT brick-wall-ish lowpass (smooth rolloff)."""
    n = len(sig)
    spec = np.fft.rfft(sig)
    freqs = np.fft.rfftfreq(n, 1 / sr)
    # soft rolloff: 1/(1+(f/c)^4)
    gain = 1 / (1 + (freqs / max(cutoff_hz, 1)) ** 4)
    return np.fft.irfft(spec * gain, n)

def highpass_fft(sig, cutoff_hz, sr=SR):
    n = len(sig)
    spec = np.fft.rfft(sig)
    freqs = np.fft.rfftfreq(n, 1 / sr)
    gain = 1 - 1 / (1 + (freqs / max(cutoff_hz, 1)) ** 4)
    return np.fft.irfft(spec * gain, n)

def karplus_strong(freq, dur, sr=SR, damping=0.996, brightness=0.5):
    """Plucked string — harp/guitar."""
    n = int(dur * sr)
    period = max(2, int(sr / freq))
    rng = np.random.default_rng(int(freq * 1000) % 2**31)
    buf = rng.uniform(-1, 1, period)
    # brightness: filter the initial noise
    buf = lowpass_fft(buf, 2000 + brightness * 6000, sr)
    out = np.zeros(n)
    for i in range(n):
        out[i] = buf[i % period]
        buf[i % period] = damping * 0.5 * (buf[i % period] + buf[(i + 1) % period])
    return out

# ── instruments ────────────────────────────────────────────────
def inst_strings(freq, dur, vel=1.0):
    """Section strings: 4 detuned saws + vibrato + slow attack."""
    n = int(dur * SR)
    total = np.zeros(n)
    for det in (-7, -3, 0, 4, 8):  # cents detune
        f = freq * 2 ** (det / 1200)
        total += saw(f, n)
    total /= 5
    total = vibrato(total, 5.2, 0.12)
    total = lowpass_fft(total, 3800)
    env = env_exp(n, attack=min(0.12, dur*0.3), decay=dur*0.5, sustain_level=0.6, release=0.25)
    return total * env * vel * 0.7

def inst_brass(freq, dur, vel=1.0):
    """Horn/brass: saw + formant + pitch swell."""
    n = int(dur * SR)
    s = saw(freq, n) * 0.8 + saw(freq * 2, n) * 0.2
    # formant boost ~1kHz
    formant = highpass_fft(s, 700)
    s = s * 0.6 + lowpass_fft(formant, 1400) * 0.5
    # pitch swell at attack: freq*0.97 -> freq
    t = np.arange(n) / SR
    swell = np.clip(t / 0.04, 0, 1)
    # resample trick: apply swell as slight ring-mod of phase — simpler: env
    env = env_exp(n, attack=min(0.05, dur*0.15), decay=dur*0.7, sustain_level=0.75, release=0.12)
    return lowpass_fft(s, 4500) * env * vel * 0.55

def inst_flute(freq, dur, vel=1.0):
    n = int(dur * SR)
    s = sine(freq, n) * 0.9 + sine(freq * 2, n) * 0.08 + sine(freq * 3, n) * 0.03
    s = vibrato(s, 5.5, 0.09)
    rng = np.random.default_rng(7)
    breath = rng.uniform(-1, 1, n) * 0.015
    s += lowpass_fft(breath, 6000)
    env = env_exp(n, attack=min(0.06, dur*0.2), decay=dur*0.8, sustain_level=0.85, release=0.15)
    return s * env * vel * 0.5

def inst_ocarina(freq, dur, vel=1.0):
    n = int(dur * SR)
    s = sine(freq, n) * 0.95 + sine(freq * 2, n) * 0.05
    s = vibrato(s, 4.8, 0.06)
    env = env_exp(n, attack=0.03, decay=dur*0.8, sustain_level=0.9, release=0.12)
    return s * env * vel * 0.45

def inst_harp(freq, dur, vel=1.0):
    n = int(dur * SR)
    s = karplus_strong(freq, dur, brightness=0.7, damping=0.994)
    env = env_exp(n, attack=0.002, decay=dur*0.6, sustain_level=0.0, release=0.05)
    return s * env * vel * 0.8

def inst_choir(freq, dur, vel=1.0):
    """Aah choir: filtered saws at formant frequencies."""
    n = int(dur * SR)
    s = saw(freq, n) * 0.4 + saw(freq * 1.005, n) * 0.3 + saw(freq * 0.997, n) * 0.3
    s = lowpass_fft(s, 900) * 0.5 + lowpass_fft(s, 2600) * 0.3  # aah formants
    s = vibrato(s, 4.5, 0.15)
    env = env_exp(n, attack=min(0.25, dur*0.4), decay=dur*0.7, sustain_level=0.7, release=0.4)
    return s * env * vel * 0.4

def inst_timpani(freq, dur=1.2, vel=1.0):
    """Pitched drum: sine with downward pitch bend + noise thump."""
    n = int(dur * SR)
    t = np.arange(n) / SR
    bend = freq * (1 + 0.6 * np.exp(-t * 30))  # pitch drop
    phase = np.cumsum(bend) / SR
    s = np.sin(2 * np.pi * phase)
    rng = np.random.default_rng(3)
    thump = lowpass_fft(rng.uniform(-1, 1, n), 300)
    s = s * 0.7 + thump * 0.4
    env = env_exp(n, attack=0.001, decay=0.5, sustain_level=0.1, release=0.3)
    return s * env * vel * 0.9

def inst_bass_drum(vel=1.0, dur=0.5):
    n = int(dur * SR)
    t = np.arange(n) / SR
    f = 90 * np.exp(-t * 20) + 40
    phase = np.cumsum(f) / SR
    s = np.sin(2 * np.pi * phase)
    env = env_exp(n, attack=0.001, decay=0.18, sustain_level=0.0, release=0.1)
    return s * env * vel

def inst_snare(vel=1.0, dur=0.3):
    n = int(dur * SR)
    rng = np.random.default_rng(11)
    s = rng.uniform(-1, 1, n)
    s = highpass_fft(s, 900) * 0.7 + lowpass_fft(s, 250) * 0.4
    env = env_exp(n, attack=0.001, decay=0.09, sustain_level=0.0, release=0.06)
    return s * env * vel * 0.7

def inst_cymbal(vel=1.0, dur=1.8):
    n = int(dur * SR)
    rng = np.random.default_rng(13)
    s = rng.uniform(-1, 1, n)
    s = highpass_fft(s, 5000)
    env = env_exp(n, attack=0.002, decay=0.9, sustain_level=0.0, release=0.5)
    return s * env * vel * 0.35

INSTRUMENTS = {
    'strings': inst_strings, 'brass': inst_brass, 'flute': inst_flute,
    'ocarina': inst_ocarina, 'harp': inst_harp, 'choir': inst_choir,
}

# ── reverb + stereo ────────────────────────────────────────────
def schroeder_reverb(sig, sr=SR, wet=0.25):
    """Classic Schroeder: 4 parallel combs + 2 series allpass."""
    n = len(sig)
    out = np.zeros(n)
    combs = (1116, 1188, 1277, 1356)  # samples @44.1k
    comb_g = 0.84
    for c in combs:
        d = int(c * sr / 44100)
        buf = np.zeros(n)
        delay = np.zeros(d)
        di = 0
        for i in range(n):
            buf[i] = sig[i] + comb_g * delay[di]
            delay[di] = buf[i]
            di = (di + 1) % d
        out += buf
    out /= len(combs)
    for a_len in (225, 556):
        d = int(a_len * sr / 44100)
        buf = np.zeros(n)
        delay = np.zeros(d)
        di = 0
        g = 0.5
        for i in range(n):
            buf[i] = -g * out[i] + delay[di] + g * (delay[di] if di == 0 else 0)
            # standard allpass: y = -g*x + delayed + g*y_delayed
            delay[di] = out[i] + g * delay[di]
            di = (di + 1) % d
        out = buf
    return sig * (1 - wet) + out * wet

def stereoize(sig, width=0.12):
    """Haas stereo: L = sig, R = sig delayed by width ms, slight decorrelation."""
    d = int(width * 0.001 * SR)
    right = np.roll(sig, d)
    right[:d] = 0
    return sig, right * 0.98

# ── sequencer ──────────────────────────────────────────────────
class Song:
    """Track-based sequencer. Each voice: (instrument, gain, notes)
    where notes = list of (start_beat, dur_beats, midi_note, velocity)."""
    def __init__(self, bpm, bars=16, beats_per_bar=4):
        self.bpm = bpm
        self.spb = 60.0 / bpm
        self.bars = bars
        self.bpb = beats_per_bar
        self.total_beats = bars * beats_per_bar
        self.n = int(self.total_beats * self.spb * SR)
        self.voices = []  # (kind, gain, notes) kind: instrument name or perc

    def add(self, kind, gain, notes):
        self.voices.append((kind, gain, notes))

    def render(self, wet=0.25, width=0.12):
        """Returns stereo float32 (n, 2) — loop-perfect (notes quantized)."""
        mono = np.zeros(self.n)
        for kind, gain, notes in self.voices:
            ch = np.zeros(self.n)
            for start, dur, note, vel in notes:
                s = int(start * self.spb * SR)
                d = dur * self.spb
                if s >= self.n:
                    continue  # note starts past loop end — skip (loop-quantize)
                if kind in INSTRUMENTS:
                    sig = INSTRUMENTS[kind](midi(note), min(d, 12), vel)
                elif kind == 'timpani':
                    sig = inst_timpani(midi(note), min(d, 2.0), vel)
                elif kind == 'bd':
                    sig = inst_bass_drum(vel)
                elif kind == 'snare':
                    sig = inst_snare(vel)
                elif kind == 'cymbal':
                    sig = inst_cymbal(vel)
                else:
                    continue
                e = min(s + len(sig), self.n)
                if e > s:
                    ch[s:e] += sig[:e - s]
            mono += ch * gain
        # normalize pre-reverb
        peak = np.abs(mono).max()
        if peak > 0: mono = mono / peak * 0.8
        # CIRCULAR reverb: process dry+n samples, wrap the tail back to the
        # head — loop-perfect by construction (no chopped reverb at the seam).
        tail = int(1.5 * SR)  # Schroeder effective tail
        ext = np.concatenate([mono, np.zeros(tail)])
        wet_ext = schroeder_reverb(ext, wet=wet)
        mono = wet_ext[:self.n].copy()
        mono[:tail] += wet_ext[self.n:]
        left, right = stereoize(mono, width)
        st = np.stack([left, right], axis=1).astype(np.float32)
        # final normalize
        peak = np.abs(st).max()
        if peak > 0: st = st / peak * 0.85
        return st