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

function playTone(ctx: AudioContext, freq: number, startTime: number, duration: number, volume: number) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = 'sine';
  osc.frequency.setValueAtTime(freq, startTime);

  gain.gain.setValueAtTime(0, startTime);
  gain.gain.linearRampToValueAtTime(volume, startTime + 0.02);
  gain.gain.setValueAtTime(volume, startTime + duration * 0.3);
  gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.start(startTime);
  osc.stop(startTime + duration);
}

export async function playSuccessSound() {
  try {
    const ctx = getAudioContext();
    if (ctx.state === 'suspended') {
      await ctx.resume();
    }

    const t = ctx.currentTime;
    const vol = 0.12;

    playTone(ctx, 523.25, t, 0.35, vol);
    playTone(ctx, 659.25, t + 0.12, 0.35, vol);
    playTone(ctx, 783.99, t + 0.24, 0.5, vol * 0.9);
    playTone(ctx, 1046.50, t + 0.38, 0.7, vol * 0.6);
  } catch {}
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
