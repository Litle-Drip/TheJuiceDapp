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

export async function playSoundCallToPost() {
  try {
    const ctx = getAudioContext();
    if (ctx.state === 'suspended') await ctx.resume();
    const t = ctx.currentTime;
    const vol = 0.07;

    const trumpetNote = (freq: number, start: number, dur: number, v: number) => {
      playTone(ctx, freq, start, dur, v, 'triangle');
      playTone(ctx, freq * 2, start, dur * 0.6, v * 0.25, 'sine');
      playTone(ctx, freq * 3, start, dur * 0.35, v * 0.1, 'sine');
    };

    trumpetNote(523.25, t, 0.18, vol);
    trumpetNote(523.25, t + 0.18, 0.08, vol * 0.7);
    trumpetNote(523.25, t + 0.26, 0.08, vol * 0.7);
    trumpetNote(659.25, t + 0.38, 0.15, vol);
    trumpetNote(783.99, t + 0.55, 0.2, vol * 1.1);
    trumpetNote(1046.50, t + 0.75, 0.7, vol * 0.8);
  } catch {}
}

export async function playSoundPhotoFinish() {
  try {
    const ctx = getAudioContext();
    if (ctx.state === 'suspended') await ctx.resume();
    const t = ctx.currentTime;
    const vol = 0.06;

    const trumpetNote = (freq: number, start: number, dur: number, v: number) => {
      playTone(ctx, freq, start, dur, v, 'triangle');
      playTone(ctx, freq * 2, start, dur * 0.5, v * 0.3, 'sine');
      playTone(ctx, freq * 3, start, dur * 0.3, v * 0.1, 'sine');
    };

    trumpetNote(392, t, 0.1, vol);
    trumpetNote(523.25, t + 0.08, 0.1, vol);
    trumpetNote(659.25, t + 0.16, 0.1, vol * 1.1);
    trumpetNote(783.99, t + 0.24, 0.12, vol * 1.1);
    trumpetNote(1046.50, t + 0.36, 0.15, vol * 1.2);
    trumpetNote(1318.51, t + 0.5, 0.8, vol * 0.6);
  } catch {}
}

export async function playSoundWinnerCircle() {
  try {
    const ctx = getAudioContext();
    if (ctx.state === 'suspended') await ctx.resume();
    const t = ctx.currentTime;
    const vol = 0.065;

    const brassNote = (freq: number, start: number, dur: number, v: number) => {
      playTone(ctx, freq, start, dur, v, 'triangle');
      playTone(ctx, freq * 2, start, dur * 0.7, v * 0.35, 'sine');
      playTone(ctx, freq * 3, start, dur * 0.4, v * 0.15, 'sine');
      playTone(ctx, freq * 0.5, start, dur * 0.5, v * 0.12, 'triangle');
    };

    brassNote(523.25, t, 0.3, vol);
    brassNote(659.25, t + 0.25, 0.3, vol);
    brassNote(783.99, t + 0.5, 0.3, vol * 1.1);
    brassNote(1046.50, t + 0.75, 0.8, vol * 0.8);
  } catch {}
}

export async function playSoundTripleCrown() {
  try {
    const ctx = getAudioContext();
    if (ctx.state === 'suspended') await ctx.resume();
    const t = ctx.currentTime;
    const vol = 0.06;

    const horn = (freq: number, start: number, dur: number, v: number) => {
      playTone(ctx, freq, start, dur, v, 'triangle');
      playTone(ctx, freq * 2, start, dur * 0.6, v * 0.28, 'sine');
      playTone(ctx, freq * 3, start, dur * 0.35, v * 0.1, 'sine');
    };

    horn(392, t, 0.2, vol);
    horn(523.25, t + 0.15, 0.2, vol);
    horn(783.99, t + 0.3, 0.15, vol * 1.15);
    horn(659.25, t + 0.45, 0.12, vol * 0.9);
    horn(783.99, t + 0.57, 0.15, vol * 1.1);
    horn(1046.50, t + 0.72, 0.5, vol * 0.85);
    horn(1046.50, t + 0.95, 0.6, vol * 0.5);
  } catch {}
}

export async function playSoundHomeStretch() {
  try {
    const ctx = getAudioContext();
    if (ctx.state === 'suspended') await ctx.resume();
    const t = ctx.currentTime;
    const vol = 0.065;

    const bugle = (freq: number, start: number, dur: number, v: number) => {
      playTone(ctx, freq, start, dur, v, 'triangle');
      playTone(ctx, freq * 2, start, dur * 0.55, v * 0.3, 'sine');
    };

    bugle(523.25, t, 0.1, vol);
    bugle(659.25, t + 0.08, 0.1, vol);
    bugle(783.99, t + 0.16, 0.1, vol * 1.05);
    bugle(1046.50, t + 0.26, 0.18, vol * 1.1);
    bugle(783.99, t + 0.42, 0.1, vol * 0.8);
    bugle(1046.50, t + 0.52, 0.18, vol * 1.1);
    bugle(1318.51, t + 0.7, 0.7, vol * 0.6);
  } catch {}
}

export const SOUND_OPTIONS = [
  { id: 'victory-trumpet', name: 'Victory Trumpet', description: 'Gentle race-day fanfare', play: playSoundVictoryTrumpet },
  { id: 'call-to-post', name: 'Call to Post', description: 'Classic derby bugle call', play: playSoundCallToPost },
  { id: 'photo-finish', name: 'Photo Finish', description: 'Quick triumphant burst', play: playSoundPhotoFinish },
  { id: 'winner-circle', name: 'Winner\'s Circle', description: 'Majestic brass crescendo', play: playSoundWinnerCircle },
  { id: 'triple-crown', name: 'Triple Crown', description: 'Grand champion fanfare', play: playSoundTripleCrown },
  { id: 'home-stretch', name: 'Home Stretch', description: 'Galloping finish line bugle', play: playSoundHomeStretch },
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
