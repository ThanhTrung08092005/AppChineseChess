import { useRef, useEffect, useCallback } from 'react';
import type { CellDto, MoveDto } from '../api/gameApi';

interface Props {
  board:       CellDto[][];
  legalMoves:  MoveDto[];
  lastMove:    MoveDto | null;
  selected:    [number, number] | null;
  onCellClick: (row: number, col: number) => void;
  disabled:    boolean;
}

const ROWS = 10, COLS = 9;
const CELL  = 64;
const MARG  = 48;
const PR    = 26;   // piece radius
const W     = CELL * (COLS - 1) + MARG * 2;
const H     = CELL * (ROWS - 1) + MARG * 2;

const BOARD_BG   = '#DEB887';
const LINE_COLOR = '#8B4513';
const RED_PIECE  = '#C0392B';
const BLK_PIECE  = '#1A1A2E';

export default function Board({ board, legalMoves, lastMove, selected, onCellClick, disabled }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Tính hints từ selected
  const hints = selected
    ? legalMoves.filter(m => m.fromRow === selected[0] && m.fromCol === selected[1])
    : [];

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const g = canvas.getContext('2d')!;
    g.clearRect(0, 0, W, H);

    // ── Nền bàn cờ ──────────────────────────────────────────────────────────
    g.fillStyle = BOARD_BG;
    g.fillRect(0, 0, W, H);

    // ── Lưới ────────────────────────────────────────────────────────────────
    g.strokeStyle = LINE_COLOR;
    g.lineWidth   = 1.5;

    // Đường ngang
    for (let r = 0; r < ROWS; r++) {
      const y = MARG + r * CELL;
      g.beginPath(); g.moveTo(MARG, y); g.lineTo(MARG + (COLS-1)*CELL, y); g.stroke();
    }
    // Đường dọc (ngắt ở sông)
    for (let c = 0; c < COLS; c++) {
      const x = MARG + c * CELL;
      if (c === 0 || c === COLS - 1) {
        g.beginPath(); g.moveTo(x, MARG); g.lineTo(x, MARG + (ROWS-1)*CELL); g.stroke();
      } else {
        g.beginPath(); g.moveTo(x, MARG);              g.lineTo(x, MARG + 4*CELL); g.stroke();
        g.beginPath(); g.moveTo(x, MARG + 5*CELL);     g.lineTo(x, MARG + 9*CELL); g.stroke();
      }
    }
    // Cung điện
    const pd = (x1:number,y1:number,x2:number,y2:number) => {
      g.beginPath(); g.moveTo(x1,y1); g.lineTo(x2,y2); g.stroke();
    };
    pd(MARG+3*CELL, MARG,        MARG+5*CELL, MARG+2*CELL);
    pd(MARG+5*CELL, MARG,        MARG+3*CELL, MARG+2*CELL);
    pd(MARG+3*CELL, MARG+7*CELL, MARG+5*CELL, MARG+9*CELL);
    pd(MARG+5*CELL, MARG+7*CELL, MARG+3*CELL, MARG+9*CELL);

    // ── Sông ────────────────────────────────────────────────────────────────
    const ry = MARG + 4*CELL;
    g.fillStyle = 'rgba(33,150,243,0.12)';
    g.fillRect(MARG, ry, (COLS-1)*CELL, CELL);
    g.fillStyle = '#1A5C8A';
    g.font = 'bold 18px "Noto Serif CJK SC", serif';
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText('楚 河', MARG + (COLS-1)*CELL/4,     ry + CELL/2);
    g.fillText('漢 界', MARG + (COLS-1)*CELL*3/4,   ry + CELL/2);

    // ── Tô sáng nước đi cuối ────────────────────────────────────────────────
    if (lastMove) {
      for (const pos of [[lastMove.fromRow, lastMove.fromCol],[lastMove.toRow, lastMove.toCol]]) {
        const cx = MARG + pos[1]*CELL, cy = MARG + pos[0]*CELL;
        g.fillStyle = 'rgba(255,235,59,0.35)';
        g.beginPath(); g.arc(cx, cy, PR+2, 0, Math.PI*2); g.fill();
      }
    }

    // ── Tô sáng ô đang chọn ─────────────────────────────────────────────────
    if (selected) {
      const cx = MARG + selected[1]*CELL, cy = MARG + selected[0]*CELL;
      g.fillStyle = 'rgba(243,156,18,0.4)';
      g.beginPath(); g.arc(cx, cy, PR+2, 0, Math.PI*2); g.fill();
      g.strokeStyle = '#F39C12'; g.lineWidth = 3;
      g.beginPath(); g.arc(cx, cy, PR+2, 0, Math.PI*2); g.stroke();
    }

    // ── Gợi ý nước đi ───────────────────────────────────────────────────────
    for (const h of hints) {
      const cx = MARG + h.toCol*CELL, cy = MARG + h.toRow*CELL;
      const hasEnemy = board[h.toRow]?.[h.toCol]?.color != null;
      if (hasEnemy) {
        g.strokeStyle = 'rgba(231,76,60,0.85)'; g.lineWidth = 3;
        g.beginPath(); g.arc(cx, cy, PR+2, 0, Math.PI*2); g.stroke();
      } else {
        g.fillStyle = 'rgba(39,174,96,0.65)';
        g.beginPath(); g.arc(cx, cy, 9, 0, Math.PI*2); g.fill();
      }
    }

    // ── Quân cờ ─────────────────────────────────────────────────────────────
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const cell = board[r]?.[c];
        if (!cell?.color) continue;

        const cx = MARG + c*CELL, cy = MARG + r*CELL;
        const isRed = cell.color === 'red';

        // Bóng
        g.fillStyle = 'rgba(0,0,0,0.2)';
        g.beginPath(); g.arc(cx+3, cy+3, PR, 0, Math.PI*2); g.fill();

        // Nền
        g.fillStyle = isRed ? RED_PIECE : BLK_PIECE;
        g.beginPath(); g.arc(cx, cy, PR, 0, Math.PI*2); g.fill();

        // Viền trong
        g.strokeStyle = isRed ? '#FFD700' : '#95A5A6';
        g.lineWidth   = 2.5;
        g.beginPath(); g.arc(cx, cy, PR-3, 0, Math.PI*2); g.stroke();

        // Chữ
        g.fillStyle    = '#FFFFFF';
        g.font         = `bold 16px "Noto Serif CJK SC", "Arial Unicode MS", serif`;
        g.textAlign    = 'center';
        g.textBaseline = 'middle';
        g.fillText(cell.symbol ?? '', cx, cy + 1);
      }
    }
  }, [board, hints, lastMove, selected]);

  useEffect(() => { draw(); }, [draw]);

  const handleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (disabled) return;
    const rect = canvasRef.current!.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const col = Math.round((x - MARG) / CELL);
    const row = Math.round((y - MARG) / CELL);
    if (row >= 0 && row < ROWS && col >= 0 && col < COLS)
      onCellClick(row, col);
  };

  return (
    <canvas
      ref={canvasRef}
      width={W}
      height={H}
      onClick={handleClick}
      style={{ cursor: disabled ? 'default' : 'pointer', display: 'block' }}
    />
  );
}
