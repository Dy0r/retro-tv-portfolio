// Original sound effects, synthesised live with the Web Audio API (no audio files,
// nothing sampled). Browsers only allow sound after the visitor has clicked, tapped
// or pressed a key, so the audio engine starts on the first such gesture; anything
// played before that is silently skipped.
//
//  powerOn   CRT thunk + rising whine + crackle     (TV switching on)
//  powerOff  falling blip + short crackle           (zooming out)
//  blip      short square-wave tick                 (moving through the menu)
//  insert    plastic clack + low thump              (cartridge seated in the slot)
//  eject     spring click + rising clack            (cartridge popping out)
//  static    a burst of filtered noise              (switching projects)
//  open/close soft ticks                            (reader, resume, image)

const MASTER = 0.32;

export function createSfx() {
  let ctx = null;
  let master = null;
  let noise = null;

  function start() {
    if (ctx) {
      if (ctx.state === 'suspended') ctx.resume();
      return;
    }
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    ctx = new AudioCtx();
    master = ctx.createGain();
    master.gain.value = MASTER;
    master.connect(ctx.destination);
    // One second of white noise, reused for every crackle and burst of static.
    noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const data = noise.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  }
  for (const type of ['pointerdown', 'keydown', 'touchstart']) {
    window.addEventListener(type, start, { capture: true, passive: true });
  }

  const ready = () => ctx && ctx.state === 'running';

  // A tone with a quick attack and an exponential fade.
  function tone({ type = 'square', from, to = from, at = 0, dur, gain = 0.3, filter }) {
    const t = ctx.currentTime + at;
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(from, t);
    if (to !== from) osc.frequency.exponentialRampToValueAtTime(to, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    let node = osc;
    if (filter) {
      const f = ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = filter;
      osc.connect(f);
      node = f;
    }
    node.connect(g).connect(master);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  // Filtered noise: crackles, clacks and static.
  function hiss({ at = 0, dur, gain = 0.2, type = 'bandpass', freq = 3000, q = 0.8 }) {
    const t = ctx.currentTime + at;
    const src = ctx.createBufferSource();
    src.buffer = noise;
    src.loop = true;
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = q;
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g).connect(master);
    src.start(t, Math.random() * 0.5);
    src.stop(t + dur + 0.02);
  }

  return {
    powerOn() {
      if (!ready()) return;
      tone({ type: 'sine', from: 70, to: 40, dur: 0.25, gain: 0.5 });
      hiss({ dur: 0.08, gain: 0.25, freq: 1800 });
      tone({ type: 'sine', from: 2200, to: 7800, at: 0.12, dur: 0.6, gain: 0.025 });
      hiss({ at: 0.36, dur: 0.35, gain: 0.12, type: 'highpass', freq: 4000 });
    },
    powerOff() {
      if (!ready()) return;
      tone({ type: 'sine', from: 900, to: 60, dur: 0.3, gain: 0.18 });
      hiss({ dur: 0.12, gain: 0.12, freq: 2500 });
    },
    blip(direction = 1) {
      if (!ready()) return;
      tone({ from: direction > 0 ? 660 : 520, dur: 0.06, gain: 0.08, filter: 2400 });
    },
    insert() {
      if (!ready()) return;
      hiss({ dur: 0.05, gain: 0.35, freq: 1200, q: 1.5 });
      tone({ type: 'triangle', from: 140, to: 70, dur: 0.12, gain: 0.35 });
      hiss({ at: 0.05, dur: 0.03, gain: 0.2, freq: 2600, q: 2 });
    },
    eject() {
      if (!ready()) return;
      tone({ type: 'triangle', from: 90, to: 160, dur: 0.08, gain: 0.25 });
      hiss({ at: 0.02, dur: 0.06, gain: 0.3, freq: 1600, q: 1.5 });
    },
    static(dur = 0.18) {
      if (!ready()) return;
      hiss({ dur, gain: 0.07, type: 'highpass', freq: 3000 });
    },
    open() {
      if (!ready()) return;
      tone({ from: 880, to: 1320, dur: 0.07, gain: 0.05, filter: 3000 });
    },
    close() {
      if (!ready()) return;
      tone({ from: 1100, to: 660, dur: 0.07, gain: 0.05, filter: 3000 });
    },
  };
}
