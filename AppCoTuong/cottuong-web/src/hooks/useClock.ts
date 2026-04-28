import { useState, useEffect, useRef } from 'react';
import type { GameStateDto } from '../api/gameApi';

export function useClock(state: GameStateDto | null) {
  const [redTime,   setRedTime]   = useState(600);
  const [blackTime, setBlackTime] = useState(600);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Sync từ server khi state thay đổi
  useEffect(() => {
    if (!state) return;
    setRedTime(state.redTimeLeft);
    setBlackTime(state.blackTimeLeft);
  }, [state?.redTimeLeft, state?.blackTimeLeft, state?.moveCount]);

  // Đếm ngược phía client (giảm mỗi giây)
  useEffect(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (!state || state.status === 'checkmate') return;

    intervalRef.current = setInterval(() => {
      if (state.currentTurn === 'red')
        setRedTime(t => Math.max(0, t - 1));
      else
        setBlackTime(t => Math.max(0, t - 1));
    }, 1000);

    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [state?.currentTurn, state?.status, state?.moveCount]);

  const fmt = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  return { redTime, blackTime, fmt };
}
