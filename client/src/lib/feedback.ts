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

export async function playSoundVictoryTrumpet() {
  try {
    const ctx = getAudioContext();
    if (ctx.state === 'suspended') await ctx.resume();
    const t = ctx.currentTime;
    const vol = 0.07;

    const trumpetNote = (freq: number, start: number, dur: number, v: number) => {
      playTone(ctx, freq, start, dur, v, 'triangle');
      playTone(ctx, freq * 2, start, dur * 0.6, v * 0.3, 'sine');
      playTone(ctx, freq * 3, start, dur * 0.4, v * 0.12, 'sine');
    };

    trumpetNote(392, t, 0.12, vol);
    trumpetNote(523.25, t + 0.1, 0.12, vol);
    trumpetNote(659.25, t + 0.2, 0.15, vol * 1.1);
    trumpetNote(783.99, t + 0.35, 0.25, vol * 0.9);
    trumpetNote(1046.50, t + 0.55, 0.6, vol * 0.7);
  } catch {}
}

export async function playSoundWindChime() {
  try {
    const ctx = getAudioContext();
    if (ctx.state === 'suspended') await ctx.resume();
    const t = ctx.currentTime;

    const notes = [1318.5, 1046.5, 1568, 1174.7, 1396.9];
    notes.forEach((freq, i) => {
      const start = t + i * 0.1 + Math.random() * 0.04;
      const vol = 0.06 + Math.random() * 0.03;
      playTone(ctx, freq, start, 0.8 + Math.random() * 0.4, vol, 'sine');
      playTone(ctx, freq * 2.01, start, 0.4, vol * 0.15, 'sine');
    });
  } catch {}
}

export async function playSoundCeleste() {
  try {
    const ctx = getAudioContext();
    if (ctx.state === 'suspended') await ctx.resume();
    const t = ctx.currentTime;
    const vol = 0.09;

    const celesteNote = (freq: number, start: number, dur: number, v: number) => {
      playTone(ctx, freq, start, dur, v, 'sine');
      playTone(ctx, freq * 4, start, dur * 0.3, v * 0.08, 'sine');
    };

    celesteNote(659.25, t, 0.5, vol);
    celesteNote(783.99, t + 0.18, 0.5, vol * 0.9);
    celesteNote(1046.50, t + 0.36, 0.7, vol * 0.7);
  } catch {}
}

export async function playSoundMusicBox() {
  try {
    const ctx = getAudioContext();
    if (ctx.state === 'suspended') await ctx.resume();
    const t = ctx.currentTime;
    const vol = 0.1;

    const notes = [783.99, 659.25, 783.99, 1046.50, 987.77];
    notes.forEach((freq, i) => {
      const start = t + i * 0.13;
      playTone(ctx, freq, start, 0.35, vol * (1 - i * 0.1), 'sine');
      playTone(ctx, freq * 3, start, 0.15, vol * 0.05, 'sine');
    });
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
  { id: 'victory-trumpet', name: 'Victory Trumpet', description: 'Gentle race-day fanfare', play: playSoundVictoryTrumpet },
  { id: 'wind-chime', name: 'Wind Chime', description: 'Airy sparkling tones', play: playSoundWindChime },
  { id: 'celeste', name: 'Celeste', description: 'Warm three-note glow', play: playSoundCeleste },
  { id: 'music-box', name: 'Music Box', description: 'Playful tinkling melody', play: playSoundMusicBox },
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
