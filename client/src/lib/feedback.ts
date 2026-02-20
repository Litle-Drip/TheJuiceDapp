let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext {
  if (!audioCtx) {
    audioCtx = new AudioContext();
  }
  return audioCtx;
}

function unlockAudio() {
  const ctx = getAudioContext();
  if (ctx.state === 'suspended') {
    ctx.resume();
  }
  const silent = ctx.createBufferSource();
  silent.buffer = ctx.createBuffer(1, 1, 22050);
  silent.connect(ctx.destination);
  silent.start(0);
}

if (typeof window !== 'undefined') {
  const events = ['touchstart', 'touchend', 'click'];
  const handler = () => {
    unlockAudio();
    events.forEach(e => document.removeEventListener(e, handler, true));
  };
  events.forEach(e => document.addEventListener(e, handler, true));
}

function playTone(
  ctx: AudioContext,
  freq: number,
  startTime: number,
  duration: number,
  volume: number,
  type: OscillatorType = 'sine'
) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = type;
  osc.frequency.setValueAtTime(freq, startTime);

  gain.gain.setValueAtTime(0, startTime);
  gain.gain.linearRampToValueAtTime(volume, startTime + 0.015);
  gain.gain.setValueAtTime(volume * 0.8, startTime + duration * 0.3);
  gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.start(startTime);
  osc.stop(startTime + duration);
}

export async function playSoundGentleChime() {
  try {
    const ctx = getAudioContext();
    if (ctx.state === 'suspended') await ctx.resume();
    const t = ctx.currentTime;
    const vol = 0.12;
    playTone(ctx, 523.25, t, 0.35, vol);
    playTone(ctx, 659.25, t + 0.12, 0.35, vol);
    playTone(ctx, 783.99, t + 0.24, 0.5, vol * 0.9);
    playTone(ctx, 1046.50, t + 0.38, 0.7, vol * 0.6);
  } catch {}
}

export async function playSoundCoinDrop() {
  try {
    const ctx = getAudioContext();
    if (ctx.state === 'suspended') await ctx.resume();
    const t = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(1800, t);
    osc.frequency.exponentialRampToValueAtTime(900, t + 0.08);
    osc.frequency.setValueAtTime(1400, t + 0.08);
    osc.frequency.exponentialRampToValueAtTime(1200, t + 0.4);

    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(0.15, t + 0.005);
    gain.gain.setValueAtTime(0.12, t + 0.08);
    gain.gain.linearRampToValueAtTime(0.1, t + 0.1);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.5);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 0.5);

    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(2600, t + 0.08);
    osc2.frequency.exponentialRampToValueAtTime(2200, t + 0.5);
    gain2.gain.setValueAtTime(0, t + 0.08);
    gain2.gain.linearRampToValueAtTime(0.06, t + 0.09);
    gain2.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(t + 0.08);
    osc2.stop(t + 0.5);
  } catch {}
}

export async function playSoundWarmHarp() {
  try {
    const ctx = getAudioContext();
    if (ctx.state === 'suspended') await ctx.resume();
    const t = ctx.currentTime;

    const notes = [392, 523.25];
    notes.forEach((freq, i) => {
      const start = t + i * 0.15;
      playTone(ctx, freq, start, 0.8, 0.14, 'triangle');
      playTone(ctx, freq * 2, start, 0.5, 0.04, 'sine');
      playTone(ctx, freq * 3, start, 0.3, 0.02, 'sine');
    });
  } catch {}
}

export async function playSoundSoftBell() {
  try {
    const ctx = getAudioContext();
    if (ctx.state === 'suspended') await ctx.resume();
    const t = ctx.currentTime;

    const fundamental = 880;
    const harmonics = [1, 2.76, 5.4, 8.93];
    const volumes = [0.12, 0.04, 0.02, 0.008];
    const durations = [1.5, 0.8, 0.4, 0.2];

    harmonics.forEach((h, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(fundamental * h, t);
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(volumes[i], t + 0.003);
      gain.gain.exponentialRampToValueAtTime(0.001, t + durations[i]);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t);
      osc.stop(t + durations[i]);
    });
  } catch {}
}

export async function playSoundLevelUp() {
  try {
    const ctx = getAudioContext();
    if (ctx.state === 'suspended') await ctx.resume();
    const t = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(440, t);
    osc.frequency.linearRampToValueAtTime(880, t + 0.15);
    osc.frequency.setValueAtTime(660, t + 0.15);
    osc.frequency.linearRampToValueAtTime(1320, t + 0.3);

    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(0.06, t + 0.01);
    gain.gain.setValueAtTime(0.05, t + 0.14);
    gain.gain.linearRampToValueAtTime(0.06, t + 0.16);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.5);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 0.5);

    playTone(ctx, 1320, t + 0.3, 0.4, 0.04, 'sine');
  } catch {}
}

export async function playSoundGoodResult() {
  try {
    const ctx = getAudioContext();
    if (ctx.state === 'suspended') await ctx.resume();
    const t = ctx.currentTime;
    const vol = 0.1;

    playTone(ctx, 587.33, t, 0.2, vol, 'triangle');
    playTone(ctx, 587.33 * 2, t, 0.15, vol * 0.3, 'sine');

    playTone(ctx, 783.99, t + 0.12, 0.2, vol, 'triangle');
    playTone(ctx, 783.99 * 2, t + 0.12, 0.15, vol * 0.3, 'sine');

    playTone(ctx, 987.77, t + 0.24, 0.25, vol * 0.95, 'triangle');
    playTone(ctx, 987.77 * 2, t + 0.24, 0.18, vol * 0.25, 'sine');

    playTone(ctx, 1174.66, t + 0.38, 0.8, vol * 0.7, 'triangle');
    playTone(ctx, 1174.66 * 2, t + 0.38, 0.5, vol * 0.2, 'sine');
    playTone(ctx, 1174.66 * 3, t + 0.38, 0.3, vol * 0.08, 'sine');

    const shimmer = ctx.createOscillator();
    const shimmerGain = ctx.createGain();
    shimmer.type = 'sine';
    shimmer.frequency.setValueAtTime(3500, t + 0.5);
    shimmer.frequency.exponentialRampToValueAtTime(2800, t + 1.0);
    shimmerGain.gain.setValueAtTime(0, t + 0.5);
    shimmerGain.gain.linearRampToValueAtTime(0.015, t + 0.55);
    shimmerGain.gain.exponentialRampToValueAtTime(0.001, t + 1.0);
    shimmer.connect(shimmerGain);
    shimmerGain.connect(ctx.destination);
    shimmer.start(t + 0.5);
    shimmer.stop(t + 1.0);
  } catch {}
}

export const SOUND_OPTIONS = [
  { id: 'gentle-chime', name: 'Gentle Chime', description: 'Soft ascending C-E-G-C', play: playSoundGentleChime },
  { id: 'coin-drop', name: 'Coin Drop', description: 'Bright metallic ding', play: playSoundCoinDrop },
  { id: 'warm-harp', name: 'Warm Harp', description: 'Two-note pluck', play: playSoundWarmHarp },
  { id: 'soft-bell', name: 'Soft Bell', description: 'Mellow bell with fade', play: playSoundSoftBell },
  { id: 'level-up', name: 'Level Up', description: 'Quick upward sweep', play: playSoundLevelUp },
  { id: 'good-result', name: 'Good Result', description: 'Victory sparkle chime', play: playSoundGoodResult },
] as const;

export type SoundId = typeof SOUND_OPTIONS[number]['id'];

export async function playSuccessSound() {
  const selected = (typeof localStorage !== 'undefined' && localStorage.getItem('juice-sound')) || 'gentle-chime';
  const option = SOUND_OPTIONS.find(o => o.id === selected);
  if (option) {
    await option.play();
  } else {
    await playSoundGentleChime();
  }
}

export function triggerHaptic() {
  try {
    if ('vibrate' in navigator) {
      navigator.vibrate([40, 20, 40]);
    }
  } catch {}
}

export async function onTransactionSuccess() {
  await playSuccessSound();
  triggerHaptic();
}
