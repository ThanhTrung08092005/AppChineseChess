/**
 * ScoreGraph — Biểu đồ điểm số theo từng nước đi (giống Lichess/xiangqiai.com)
 * Trục X = số nước, Trục Y = điểm (dương = Đỏ lợi, âm = Đen lợi)
 */

import { useRef, useEffect } from 'react';

export interface ScorePoint {
  moveNum: number;
  color:   'red' | 'black';
  score:   number;   // centipawns, capped ±2000
  isMate:  boolean;
  label:   string;   // e.g. "b2e2"
}

interface Props {
  points:      ScorePoint[];
  currentIdx:  number;
  onClickMove: (idx: number) => void;
  height?:     number;
}

const CAP = 1500; // cap điểm để graph không bị quá lệch

function capScore(s: number, isMate: boolean): number {
  if (isMate) return s > 0 ? CAP : -CAP;
  return Math.max(-CAP, Math.min(CAP, s));
}

export default function ScoreGraph({ points, currentIdx, onClickMove, height = 80 }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const g = canvas.getContext('2d')!;
    const W = canvas.width;
    const H = canvas.height;

    g.clearRect(0, 0, W, H);

    // Nền
    g.fillStyle = '#1a1a2e';
    g.fillRect(0, 0, W, H);

    // Đường giữa (score = 0)
    const mid = H / 2;
    g.strokeStyle = 'rgba(255,255,255,0.15)';
    g.lineWidth = 1;
    g.setLineDash([4, 4]);
    g.beginPath(); g.moveTo(0, mid); g.lineTo(W, mid); g.stroke();
    g.setLineDash([]);

    if (points.length < 2) return;

    const xStep = W / Math.max(points.length - 1, 1);

    // Vẽ vùng tô màu
    const toY = (s: number) => mid - (capScore(s, false) / CAP) * (H / 2 - 4);

    // Vùng Đỏ (trên đường giữa)
    g.beginPath();
    g.moveTo(0, mid);
    points.forEach((p, i) => {
      const x = i * xStep;
      const y = toY(capScore(p.score, p.isMate));
      if (i === 0) g.lineTo(x, y);
      else g.lineTo(x, y);
    });
    g.lineTo((points.length - 1) * xStep, mid);
    g.closePath();
    g.fillStyle = 'rgba(192,57,43,0.55)';
    g.fill();

    // Vùng Đen (dưới đường giữa)
    g.beginPath();
    g.moveTo(0, mid);
    points.forEach((p, i) => {
      const x = i * xStep;
      const y = toY(capScore(p.score, p.isMate));
      if (i === 0) g.lineTo(x, y);
      else g.lineTo(x, y);
    });
    g.lineTo((points.length - 1) * xStep, mid);
    g.closePath();
    g.fillStyle = 'rgba(30,30,50,0.7)';
    g.fill();

    // Đường line chính
    g.beginPath();
    points.forEach((p, i) => {
      const x = i * xStep;
      const y = toY(capScore(p.score, p.isMate));
      if (i === 0) g.moveTo(x, y);
      else g.lineTo(x, y);
    });
    g.strokeStyle = 'rgba(255,255,255,0.7)';
    g.lineWidth = 1.5;
    g.stroke();

    // Điểm hiện tại
    if (currentIdx >= 0 && currentIdx < points.length) {
      const x = currentIdx * xStep;
      const y = toY(capScore(points[currentIdx].score, points[currentIdx].isMate));
      // Đường dọc
      g.strokeStyle = 'rgba(255,215,0,0.8)';
      g.lineWidth = 1.5;
      g.setLineDash([3, 3]);
      g.beginPath(); g.moveTo(x, 0); g.lineTo(x, H); g.stroke();
      g.setLineDash([]);
      // Chấm tròn
      g.fillStyle = '#FFD700';
      g.beginPath(); g.arc(x, y, 4, 0, Math.PI * 2); g.fill();
    }
  }, [points, currentIdx, height]);

  const handleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas || points.length < 2) return;
    const rect   = canvas.getBoundingClientRect();
    const x      = (e.clientX - rect.left) * (canvas.width / rect.width);
    const xStep  = canvas.width / Math.max(points.length - 1, 1);
    const idx    = Math.round(x / xStep);
    if (idx >= 0 && idx < points.length) onClickMove(idx);
  };

  return (
    <canvas
      ref={canvasRef}
      width={600}
      height={height}
      onClick={handleClick}
      style={{
        width: '100%', height, display: 'block',
        cursor: 'pointer', borderRadius: 6,
      }}
    />
  );
}
