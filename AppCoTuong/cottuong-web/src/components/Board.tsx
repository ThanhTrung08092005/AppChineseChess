import { useRef, useEffect, useCallback, useState } from 'react';
import type { CellDto, MoveDto } from '../api/gameApi';

interface Props {
  board:       CellDto[][];
  legalMoves:  MoveDto[];
  lastMove:    MoveDto | null;
  selected:    [number, number] | null;
  hintMove:    MoveDto | null;
  onCellClick: (row: number, col: number) => void;
  disabled:    boolean;
}

const ROWS = 10, COLS = 9;
const BOARD_BG   = '#DEB887';
const LINE_COLOR = '#8B4513';
const RED_PIECE  = '#C0392B';
const BLK_PIECE  = '#1A1A2E';

// Tính kích thước bàn cờ theo chiều rộng màn hình
function calcSize() {
  const maxW = Math.min(window.innerWidth - 32, 580);  // tối đa 580px, trừ padding
  const cell = Math.floor((maxW - 96) / (COLS - 1));   // 96 = margin*2
  const marg = Math.floor((maxW - cell * (COLS - 1)) / 2);
  const pr   = Math.max(12, Math.floor(cell * 0.38));  // bán kính quân
  const w    = cell * (COLS - 1) + marg * 2;
  const h    = cell * (ROWS - 1) + marg * 2;
  return { cell, marg, pr, w, h };
}

export default function Board({ board, legalMoves, lastMove, selected, hintMove, onCellClick, disabled }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [size, setSize] = useState(calcSize);

  // Cập nhật kích thước khi resize
  useEffect(() => {
    const onResize = () => setSize(calcSize());
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const { cell: CELL, marg: MARG, pr: PR, w: W, h: H } = size;

  const hints = selected
    ? legalMoves.filter(m => m.fromRow === selected[0] && m.fromCol === selected[1])
    : [];

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const g = canvas.getContext('2d')!;
    g.clearRect(0, 0, W, H);
    g.fillStyle = BOARD_BG;
    g.fillRect(0, 0, W, H);

    // Lưới
    g.strokeStyle = LINE_COLOR;
    g.lineWidth   = Math.max(1, CELL * 0.025);

    for (let r = 0; r < ROWS; r++) {
      const y = MARG + r * CELL;
      g.beginPath(); g.moveTo(MARG, y); g.lineTo(MARG + (COLS-1)*CELL, y); g.stroke();
    }
    for (let c = 0; c < COLS; c++) {
      const x = MARG + c * CELL;
      if (c === 0 || c === COLS - 1) {
        g.beginPath(); g.moveTo(x, MARG); g.lineTo(x, MARG + (ROWS-1)*CELL); g.stroke();
      } else {
        g.beginPath(); g.moveTo(x, MARG);          g.lineTo(x, MARG + 4*CELL); g.stroke();
        g.beginPath(); g.moveTo(x, MARG + 5*CELL); g.lineTo(x, MARG + 9*CELL); g.stroke();
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

    // Sông
    const ry = MARG + 4*CELL;
    g.fillStyle = 'rgba(33,150,243,0.12)';
    g.fillRect(MARG, ry, (COLS-1)*CELL, CELL);
    g.fillStyle = '#1A5C8A';
    const riverFontSize = Math.max(10, Math.floor(CELL * 0.28));
    g.font = `bold ${riverFontSize}px "Noto Serif CJK SC", serif`;
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText('楚 河', MARG + (COLS-1)*CELL/4,   ry + CELL/2);
    g.fillText('漢 界', MARG + (COLS-1)*CELL*3/4, ry + CELL/2);

    // Tô sáng nước đi cuối
    if (lastMove) {
      for (const pos of [[lastMove.fromRow, lastMove.fromCol],[lastMove.toRow, lastMove.toCol]]) {
        const cx = MARG + pos[1]*CELL, cy = MARG + pos[0]*CELL;
        g.fillStyle = 'rgba(255,235,59,0.35)';
        g.beginPath(); g.arc(cx, cy, PR+2, 0, Math.PI*2); g.fill();
      }
    }

    // Tô sáng ô đang chọn
    if (selected) {
      const cx = MARG + selected[1]*CELL, cy = MARG + selected[0]*CELL;
      g.fillStyle = 'rgba(243,156,18,0.4)';
      g.beginPath(); g.arc(cx, cy, PR+2, 0, Math.PI*2); g.fill();
      g.strokeStyle = '#F39C12'; g.lineWidth = Math.max(2, CELL*0.04);
      g.beginPath(); g.arc(cx, cy, PR+2, 0, Math.PI*2); g.stroke();
    }

    // Gợi ý nước đi
    for (const h of hints) {
      const cx = MARG + h.toCol*CELL, cy = MARG + h.toRow*CELL;
      const hasEnemy = board[h.toRow]?.[h.toCol]?.color != null;
      if (hasEnemy) {
        g.strokeStyle = 'rgba(231,76,60,0.85)';
        g.lineWidth = Math.max(2, CELL*0.04);
        g.beginPath(); g.arc(cx, cy, PR+2, 0, Math.PI*2); g.stroke();
      } else {
        g.fillStyle = 'rgba(39,174,96,0.65)';
        const dotR = Math.max(5, Math.floor(CELL * 0.14));
        g.beginPath(); g.arc(cx, cy, dotR, 0, Math.PI*2); g.fill();
      }
    }

    // Hint move (gợi ý)
    if (hintMove) {
      for (const pos of [[hintMove.fromRow, hintMove.fromCol],[hintMove.toRow, hintMove.toCol]]) {
        const cx = MARG + pos[1]*CELL, cy = MARG + pos[0]*CELL;
        g.fillStyle = 'rgba(156,39,176,0.35)';
        g.beginPath(); g.arc(cx, cy, PR+4, 0, Math.PI*2); g.fill();
      }
      g.strokeStyle = '#9C27B0'; g.lineWidth = Math.max(2, CELL*0.05);
      const hcx = MARG + hintMove.toCol*CELL, hcy = MARG + hintMove.toRow*CELL;
      g.beginPath(); g.arc(hcx, hcy, PR+4, 0, Math.PI*2); g.stroke();
    }

    // Quân cờ
    const fontSize = Math.max(10, Math.floor(PR * 1.1));
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const cell = board[r]?.[c];
        if (!cell?.color) continue;

        const cx = MARG + c*CELL, cy = MARG + r*CELL;
        const isRed = cell.color === 'red';

        // Bóng
        g.fillStyle = 'rgba(0,0,0,0.2)';
        g.beginPath(); g.arc(cx+2, cy+2, PR, 0, Math.PI*2); g.fill();

        // Nền
        g.fillStyle = isRed ? RED_PIECE : BLK_PIECE;
        g.beginPath(); g.arc(cx, cy, PR, 0, Math.PI*2); g.fill();

        // Viền trong
        g.strokeStyle = isRed ? '#FFD700' : '#95A5A6';
        g.lineWidth   = Math.max(1.5, CELL*0.035);
        g.beginPath(); g.arc(cx, cy, PR - Math.max(2, CELL*0.04), 0, Math.PI*2); g.stroke();

        // Chữ
        g.fillStyle    = '#FFFFFF';
        g.font         = `bold ${fontSize}px "Noto Serif CJK SC", "Arial Unicode MS", serif`;
        g.textAlign    = 'center';
        g.textBaseline = 'middle';
        g.fillText(cell.symbol ?? '', cx, cy + 1);
      }
    }
  }, [board, hints, lastMove, selected, hintMove, CELL, MARG, PR, W, H]);

  useEffect(() => { draw(); }, [draw]);

  const handleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (disabled) return;
    const rect = canvasRef.current!.getBoundingClientRect();
    // Scale theo devicePixelRatio nếu canvas được scale bởi CSS
    const scaleX = W / rect.width;
    const scaleY = H / rect.height;
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top)  * scaleY;
    const col = Math.round((x - MARG) / CELL);
    const row = Math.round((y - MARG) / CELL);
    if (row >= 0 && row < ROWS && col >= 0 && col < COLS)
      onCellClick(row, col);
  };

  // Touch support cho mobile
  const handleTouch = (e: React.TouchEvent<HTMLCanvasElement>) => {
    if (disabled) return;
    e.preventDefault();
    const touch = e.changedTouches[0];
    const rect  = canvasRef.current!.getBoundingClientRect();
    const scaleX = W / rect.width;
    const scaleY = H / rect.height;
    const x = (touch.clientX - rect.left) * scaleX;
    const y = (touch.clientY - rect.top)  * scaleY;
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
      onTouchEnd={handleTouch}
      style={{
        cursor:      disabled ? 'default' : 'pointer',
        display:     'block',
        maxWidth:    '100%',
        touchAction: 'none',
      }}
    />
  );
}
