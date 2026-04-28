import { useRef, useCallback } from 'react';

// Tạo âm thanh bằng Web Audio API — không cần file mp3
export function useSound() {
  const ctxRef = useRef<AudioContext | null>(null);

  const getCtx = () => {
    if (!ctxRef.current)
      ctxRef.current = new AudioContext();
    return ctxRef.current;
  };

  const playTone = useCallback((freq: number, duration: number, type: OscillatorType = 'sine', vol = 0.3) => {
    try {
      const ctx  = getCtx();
      const osc  = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type      = type;
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      gain.gain.setValueAtTime(vol, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + duration);
    } catch { /* ignore */ }
  }, []);

  return {
    playMove:    () => playTone(440, 0.08, 'square', 0.2),
    playCapture: () => { playTone(300, 0.1, 'sawtooth', 0.25); playTone(200, 0.15, 'sawtooth', 0.2); },
    playCheck:   () => { playTone(600, 0.1, 'square', 0.3); playTone(500, 0.15, 'square', 0.25); },
    playWin:     () => {
      [523, 659, 784, 1047].forEach((f, i) =>
        setTimeout(() => playTone(f, 0.3, 'sine', 0.3), i * 150));
    },
    playLose:    () => {
      [400, 350, 300].forEach((f, i) =>
        setTimeout(() => playTone(f, 0.3, 'sawtooth', 0.25), i * 200));
    },
  };
}
