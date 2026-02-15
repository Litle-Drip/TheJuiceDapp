export function playSuccessSound() {
  try {
    const ctx = new AudioContext();
    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const gain = ctx.createGain();

    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(523.25, ctx.currentTime);
    osc1.frequency.setValueAtTime(659.25, ctx.currentTime + 0.1);
    osc1.frequency.setValueAtTime(783.99, ctx.currentTime + 0.2);

    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(523.25 * 2, ctx.currentTime);
    osc2.frequency.setValueAtTime(659.25 * 2, ctx.currentTime + 0.1);
    osc2.frequency.setValueAtTime(783.99 * 2, ctx.currentTime + 0.2);

    gain.gain.setValueAtTime(0.08, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.12, ctx.currentTime + 0.15);
    gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.4);

    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(ctx.destination);

    osc1.start(ctx.currentTime);
    osc2.start(ctx.currentTime);
    osc1.stop(ctx.currentTime + 0.4);
    osc2.stop(ctx.currentTime + 0.4);

    setTimeout(() => ctx.close(), 500);
  } catch {}
}

export function triggerHaptic() {
  try {
    if ('vibrate' in navigator) {
      navigator.vibrate([50, 30, 50]);
    }
  } catch {}
}

export function onTransactionSuccess() {
  playSuccessSound();
  triggerHaptic();
}
