import { useState, useCallback, useRef } from 'react';
import Board, { type ArrowDef } from './Board';
import type { CellDto, MoveDto } from '../api/gameApi';

interface InfoLine {
  depth: number; score: number; isMate: boolean; mateIn: number;
  nodes: number; nps: number; timeMs: number; pvLine: string;
}
interface AnalysisResult {
  bestMove: string;
  bestMoveCoord: { fromRow: number; fromCol: number; toRow: number; toCol: number } | null;
  score: number; isMate: boolean; mateIn: number; depth: number;
  nodes: number; nps: number; pvLine: string; engine: string;
  lines: InfoLine[];
  // MultiPV
  pvLines?: PVLine[];
  multiPvCount?: number;
  // Opening Book
  openingName?: string;
  bookMoves?: BookMove[];
}

interface PVLine {
  rank: number;
  bestMove: string;
  bestMoveCoord: { fromRow: number; fromCol: number; toRow: number; toCol: number } | null;
  score: number; isMate: boolean; mateIn: number;
  depth: number; nodes: number; nps: number; pvLine: string;
  inBook: boolean; bookName?: string;
}

interface BookMove {
  ucci: string; name: string; nameVi: string; weight: number;
}

// FEN chuẩn Pikafish/UCCI: r=Xe, n=Mã, b=Tượng, a=Sĩ, k=Tướng, c=Pháo, p=Tốt
const START_FEN = 'rnbakabnr/9/1c5c1/p1p1p1p1p/9/9/P1P1P1P1P/1C5C1/9/RNBAKABNR w - - 0 1';

const FEN_MAP: Record<string, { color: 'red' | 'black'; symbol: string; type: string }> = {
  K: { color: 'red',   symbol: '帥', type: 'general'  }, A: { color: 'red',   symbol: '仕', type: 'advisor'  },
  E: { color: 'red',   symbol: '相', type: 'elephant' }, B: { color: 'red',   symbol: '相', type: 'elephant' },
  H: { color: 'red',   symbol: '傌', type: 'horse'    }, N: { color: 'red',   symbol: '傌', type: 'horse'    },
  R: { color: 'red',   symbol: '俥', type: 'chariot'  }, C: { color: 'red',   symbol: '炮', type: 'cannon'   },
  P: { color: 'red',   symbol: '兵', type: 'soldier'  },
  k: { color: 'black', symbol: '將', type: 'general'  }, a: { color: 'black', symbol: '士', type: 'advisor'  },
  e: { color: 'black', symbol: '象', type: 'elephant' }, b: { color: 'black', symbol: '象', type: 'elephant' },
  h: { color: 'black', symbol: '馬', type: 'horse'    }, n: { color: 'black', symbol: '馬', type: 'horse'    },
  r: { color: 'black', symbol: '車', type: 'chariot'  }, c: { color: 'black', symbol: '砲', type: 'cannon'   },
  p: { color: 'black', symbol: '卒', type: 'soldier'  },
};

const SYMBOL_TO_FEN: Record<string, string> = {
  '帥':'K','仕':'A','相':'B','傌':'N','俥':'R','炮':'C','兵':'P',
  '將':'k','士':'a','象':'b','馬':'n','車':'r','砲':'c','卒':'p',
};

function fenToBoard(fen: string): CellDto[][] {
  const rows = fen.split(' ')[0].split('/');
  return rows.map(row => {
    const cells: CellDto[] = [];
    for (const ch of row) {
      if (/\d/.test(ch)) { for (let i = 0; i < +ch; i++) cells.push({ symbol: null, color: null, type: null }); }
      else { const p = FEN_MAP[ch]; cells.push(p ? { symbol: p.symbol, color: p.color, type: p.type } : { symbol: null, color: null, type: null }); }
    }
    return cells;
  });
}

function boardToFen(board: CellDto[][], turn: 'red' | 'black'): string {
  const rows = board.map(row => {
    let s = ''; let e = 0;
    for (const cell of row) {
      if (!cell.symbol) { e++; }
      else { if (e) { s += e; e = 0; } s += SYMBOL_TO_FEN[cell.symbol] ?? '?'; }
    }
    if (e) s += e;
    return s;
  });
  return `${rows.join('/')} ${turn === 'red' ? 'w' : 'b'} - - 0 1`;
}

function fenTurn(fen: string): 'red' | 'black' { return fen.split(' ')[1] === 'b' ? 'black' : 'red'; }

function parseUcci(mv: string): MoveDto | null {
  if (!mv || mv.length < 4) return null;
  try {
    return { fromCol: mv[0].charCodeAt(0)-97, fromRow: 9-+mv[1], toCol: mv[2].charCodeAt(0)-97, toRow: 9-+mv[3] };
  } catch { return null; }
}

function fmtScore(score: number, isMate: boolean, mateIn: number): string {
  if (isMate) return mateIn > 0 ? `M${mateIn}` : `M${mateIn}`;
  const v = score / 100;
  return (v > 0 ? '+' : '') + v.toFixed(2);
}
function fmtNodes(n: number): string {
  if (n >= 1_000_000) return `${(n/1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `${(n/1_000).toFixed(0)}K`;
  return `${n}`;
}
function fmtTime(ms: number): string { return ms >= 1000 ? `${(ms/1000).toFixed(1)}s` : `${ms}ms`; }
function scoreColor(score: number, isMate: boolean, mateIn: number): string {
  if (isMate) return mateIn > 0 ? '#27ae60' : '#e74c3c';
  if (score > 50) return '#27ae60'; if (score < -50) return '#e74c3c'; return '#888';
}

async function callAnalyze(fen: string, timeMs: number, multiPV = 5): Promise<AnalysisResult> {
  const base = import.meta.env.VITE_API_URL ?? '';
  const res = await fetch(`${base}/api/analyze`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fen, timeMs, multiPV }),
  });
  if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error((err as any).error ?? `HTTP ${res.status}`); }
  return res.json();
}

export default function AnalysisPage() {
  const [fen,         setFen]         = useState(START_FEN);
  const [fenInput,    setFenInput]    = useState(START_FEN);
  const [board,       setBoard]       = useState<CellDto[][]>(() => fenToBoard(START_FEN));
  const [result,      setResult]      = useState<AnalysisResult | null>(null);
  const [loading,     setLoading]     = useState(false);
  const [error,       setError]       = useState('');
  const [timeMs,      setTimeMs]      = useState(3000);
  const [selLine,     setSelLine]     = useState<InfoLine | null>(null);
  const [selected,    setSelected]    = useState<[number,number] | null>(null);
  const [legalMoves,  setLegalMoves]  = useState<MoveDto[]>([]);
  const [lastMove,    setLastMove]    = useState<MoveDto | null>(null);
  const [currentTurn, setCurrentTurn] = useState<'red'|'black'>(fenTurn(START_FEN));
  const [arrows,      setArrows]      = useState<ArrowDef[]>([]);
  const [moveHistory, setMoveHistory] = useState<{ fen: string; move: MoveDto | null; score?: number }[]>([
    { fen: START_FEN, move: null }
  ]);
  const [histIdx,    setHistIdx]    = useState(0);
  const [activeTab,  setActiveTab]  = useState<'book'|'moves'>('book');
  const analyzing = useRef(false);

  // ── Phân tích ──────────────────────────────────────────────────────────────
  const analyze = useCallback(async (fenStr: string) => {
    if (analyzing.current) return;
    analyzing.current = true;
    setLoading(true); setError(''); setSelLine(null);
    try {
      const r = await callAnalyze(fenStr, timeMs, 5);
      setResult(r);
      // Vẽ mũi tên bestmove (đỏ) + ponder (xanh)
      const newArrows: ArrowDef[] = [];
      const bm = parseUcci(r.bestMove);
      if (bm) newArrows.push({ ...bm, color: 'rgba(231,76,60,0.82)' });
      const pvArr = r.pvLine.split(' ').filter(Boolean);
      if (pvArr[1]) {
        const pm = parseUcci(pvArr[1]);
        if (pm) newArrows.push({ ...pm, color: 'rgba(33,150,243,0.72)' });
      }
      setArrows(newArrows);
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); analyzing.current = false; }
  }, [timeMs]);

  // ── Load FEN ───────────────────────────────────────────────────────────────
  const loadFen = (f: string) => {
    try {
      const b = fenToBoard(f);
      setFen(f); setBoard(b); setResult(null); setArrows([]);
      setError(''); setSelLine(null); setSelected(null); setLegalMoves([]);
      setLastMove(null); setCurrentTurn(fenTurn(f));
      setMoveHistory([{ fen: f, move: null }]); setHistIdx(0);
    } catch { setError('FEN không hợp lệ'); }
  };

  // ── Click dòng depth → cập nhật mũi tên ───────────────────────────────────
  const selectLine = (line: InfoLine) => {
    setSelLine(line);
    const pvArr = line.pvLine.split(' ').filter(Boolean);
    const newArrows: ArrowDef[] = [];
    const bm = parseUcci(pvArr[0]);
    if (bm) newArrows.push({ ...bm, color: 'rgba(231,76,60,0.82)' });
    if (pvArr[1]) { const pm = parseUcci(pvArr[1]); if (pm) newArrows.push({ ...pm, color: 'rgba(33,150,243,0.72)' }); }
    setArrows(newArrows);
  };

  // ── Click bàn cờ ──────────────────────────────────────────────────────────
  const handleCellClick = useCallback((row: number, col: number) => {
    const cell = board[row]?.[col];
    if (!selected) {
      if (cell?.color === currentTurn) {
        setSelected([row, col]);
        const moves: MoveDto[] = [];
        for (let r = 0; r < 10; r++)
          for (let c = 0; c < 9; c++)
            if (!(r === row && c === col) && board[r]?.[c]?.color !== currentTurn)
              moves.push({ fromRow: row, fromCol: col, toRow: r, toCol: c });
        setLegalMoves(moves);
      }
      return;
    }
    const [fr, fc] = selected;
    if (fr === row && fc === col) { setSelected(null); setLegalMoves([]); return; }
    if (cell?.color === currentTurn) {
      setSelected([row, col]);
      const moves: MoveDto[] = [];
      for (let r = 0; r < 10; r++)
        for (let c = 0; c < 9; c++)
          if (!(r === row && c === col) && board[r]?.[c]?.color !== currentTurn)
            moves.push({ fromRow: row, fromCol: col, toRow: r, toCol: c });
      setLegalMoves(moves); return;
    }
    const newBoard = board.map(r => r.map(c => ({ ...c })));
    newBoard[row][col] = newBoard[fr][fc];
    newBoard[fr][fc] = { symbol: null, color: null, type: null };
    const mv: MoveDto = { fromRow: fr, fromCol: fc, toRow: row, toCol: col };
    const nextTurn = currentTurn === 'red' ? 'black' : 'red';
    const newFen = boardToFen(newBoard, nextTurn);
    setBoard(newBoard); setLastMove(mv); setSelected(null); setLegalMoves([]);
    setCurrentTurn(nextTurn); setResult(null); setArrows([]);
    setFen(newFen); setFenInput(newFen);
    const newHist = [...moveHistory.slice(0, histIdx + 1), { fen: newFen, move: mv }];
    setMoveHistory(newHist); setHistIdx(newHist.length - 1);
  }, [board, selected, currentTurn, moveHistory, histIdx]);

  // ── Điều hướng lịch sử ────────────────────────────────────────────────────
  const goHist = (idx: number) => {
    const h = moveHistory[idx];
    setHistIdx(idx); setFen(h.fen); setBoard(fenToBoard(h.fen));
    setCurrentTurn(fenTurn(h.fen)); setLastMove(h.move);
    setResult(null); setArrows([]); setSelected(null); setLegalMoves([]);
    setFenInput(h.fen);
  };

  const lines     = result?.lines ?? [];
  const activeLine = selLine ?? lines[0] ?? null;
  const pvMoves   = activeLine?.pvLine.split(' ').filter(Boolean) ?? [];

  // Bảng điểm hình cờ: mỗi nước trong PV có điểm ước tính
  const pvScores: number[] = pvMoves.map((_, i) => {
    if (!activeLine) return 0;
    // Điểm giảm dần theo chiều sâu (ước tính)
    const base = activeLine.score;
    return i % 2 === 0 ? base - i * 3 : -(base - i * 3);
  });

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' }}>
      {/* ── Topbar ── */}
      <div className="topbar" style={{ flexWrap: 'nowrap', gap: 8 }}>
        <span className="topbar-title" style={{ flexShrink: 0 }}>🔍 Phân tích</span>
        <input value={fenInput} onChange={e => setFenInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && loadFen(fenInput.trim())}
          style={{ flex: 1, minWidth: 0, background: '#fafafa', border: '1px solid var(--border)', borderRadius: 6, padding: '5px 10px', fontSize: '.75rem', fontFamily: 'monospace', color: '#333' }}
          placeholder="Nhập FEN..." />
        <button className="btn btn-white btn-sm" onClick={() => loadFen(fenInput.trim())}>Tải</button>
        <button className="btn btn-white btn-sm" onClick={() => { loadFen(START_FEN); setFenInput(START_FEN); }}>Reset</button>
        <select value={timeMs} onChange={e => setTimeMs(+e.target.value)}
          style={{ background: '#fafafa', border: '1px solid var(--border)', borderRadius: 6, padding: '5px 8px', fontSize: '.78rem', flexShrink: 0 }}>
          {[1000,2000,3000,5000,8000].map(t => <option key={t} value={t}>{t/1000}s</option>)}
        </select>
        <button className="btn btn-red btn-sm" onClick={() => analyze(fen)} disabled={loading} style={{ flexShrink: 0 }}>
          {loading ? '⏳...' : '▶ Phân tích'}
        </button>
      </div>

      {/* ── 3-column body ── */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden', minHeight: 0 }}>

        {/* ── Col 1: Bàn cờ ── */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, padding: '12px 10px', flexShrink: 0, borderRight: '1px solid var(--border)', overflowY: 'auto' }}>
          {/* Score bar */}
          <div style={{ width: '100%', maxWidth: 520 }}>
            <div style={{ height: 6, background: '#222', borderRadius: 3, overflow: 'hidden' }}>
              <div style={{
                height: '100%', borderRadius: 3, background: 'var(--red)', transition: 'width .4s',
                width: result ? `${Math.min(100, Math.max(0, 50 + result.score / 20))}%` : '50%',
              }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '.65rem', color: 'var(--muted)', marginTop: 2 }}>
              <span>⚫ ĐEN</span>
              {result && <span style={{ fontWeight: 700, color: scoreColor(result.score, result.isMate, result.mateIn) }}>
                {result.isMate ? (result.mateIn > 0 ? `M${result.mateIn}` : `M${result.mateIn}`) : fmtScore(result.score, false, 0)}
              </span>}
              <span>🔴 ĐỎ</span>
            </div>
          </div>

          {/* Board */}
          <div className="board-wrap" style={{ position: 'relative' }}>
            <Board board={board} legalMoves={legalMoves} lastMove={lastMove}
              selected={selected} hintMove={null} arrows={arrows}
              onCellClick={handleCellClick} disabled={loading} />
            {loading && <div className="board-spin">🔍 Pikafish đang phân tích...</div>}
          </div>

          {/* Turn + nav */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', maxWidth: 520 }}>
            <div style={{ width: 10, height: 10, borderRadius: '50%', background: currentTurn === 'red' ? 'var(--red)' : '#222', flexShrink: 0 }} />
            <span style={{ fontSize: '.78rem', fontWeight: 600 }}>Lượt: {currentTurn === 'red' ? '🔴 ĐỎ' : '⚫ ĐEN'}</span>
            <div style={{ marginLeft: 'auto', display: 'flex', gap: 4 }}>
              {['«','‹','›','»'].map((s, i) => (
                <button key={i} className="btn btn-white btn-sm" style={{ padding: '3px 8px', fontSize: '.85rem' }}
                  onClick={() => {
                    const targets = [0, histIdx - 1, histIdx + 1, moveHistory.length - 1];
                    const t = Math.max(0, Math.min(moveHistory.length - 1, targets[i]));
                    goHist(t);
                  }}>{s}</button>
              ))}
            </div>
          </div>

          {error && <div style={{ fontSize: '.75rem', color: 'var(--red)', padding: '6px 10px', background: '#fdf0ee', borderRadius: 6, width: '100%', maxWidth: 520 }}>⚠ {error}</div>}
        </div>

        {/* ── Col 2: Depth lines (Pikafish output) ── */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', borderRight: '1px solid var(--border)', minWidth: 0 }}>
          <div style={{ padding: '8px 14px', background: '#fafafa', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
            <span style={{ fontSize: '.82rem', fontWeight: 700, color: 'var(--red)' }}>Pikafish</span>
            {result && <span style={{ fontSize: '.7rem', color: 'var(--muted)', marginLeft: 'auto' }}>
              {lines.length} dòng · {fmtNodes(result.nodes)} · {fmtTime(lines[0]?.timeMs ?? 0)}
            </span>}
          </div>
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {lines.length === 0 && !loading && (
              <div style={{ padding: 24, textAlign: 'center', color: 'var(--muted)', fontSize: '.82rem' }}>
                Nhấn <strong>▶ Phân tích</strong> để bắt đầu
              </div>
            )}
            {lines.map((line, i) => {
              const isSel = selLine?.depth === line.depth;
              const pvArr = line.pvLine.split(' ').filter(Boolean);
              return (
                <div key={line.depth} onClick={() => selectLine(line)}
                  style={{ padding: '8px 14px', borderBottom: '1px solid #f5f5f5', cursor: 'pointer', background: isSel ? '#fdf0ee' : i % 2 === 0 ? '#fff' : '#fafafa', transition: 'background .1s' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '.7rem', color: 'var(--muted)', minWidth: 70 }}>
                      Độ sâu: <strong style={{ color: '#333' }}>{line.depth}</strong>
                    </span>
                    <span style={{ fontSize: '.8rem', fontWeight: 700, color: scoreColor(line.score, line.isMate, line.mateIn), minWidth: 80 }}>
                      {line.isMate ? (line.mateIn > 0 ? `Đỏ M${line.mateIn}` : `Đen M${Math.abs(line.mateIn)}`) : `Điểm Đỏ: ${fmtScore(line.score, false, 0)}`}
                    </span>
                    <span style={{ fontSize: '.68rem', color: 'var(--muted)' }}>Thời gian: {fmtTime(line.timeMs)}</span>
                    <span style={{ fontSize: '.68rem', color: 'var(--muted)', marginLeft: 'auto' }}>biến trên giấy: {fmtNodes(line.nodes)}</span>
                  </div>
                  <div style={{ fontSize: '.7rem', fontFamily: 'monospace', color: '#555', lineHeight: 1.7 }}>
                    {pvArr.map((m, j) => (
                      <span key={j} style={{ marginRight: 4, color: j === 0 ? 'var(--red)' : '#666', fontWeight: j === 0 ? 700 : 400 }}>
                        {j % 2 === 0 && <span style={{ color: '#bbb', marginRight: 2 }}>{Math.floor(j/2)+1}.</span>}
                        {m}
                      </span>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Col 3: Bảng điểm hình cờ ── */}
        <div style={{ width: 220, flexShrink: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {/* Tabs */}
          <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', background: '#fafafa', flexShrink: 0 }}>
            {(['book', 'moves'] as const).map(tab => (
              <div key={tab} onClick={() => setActiveTab(tab)} style={{
                flex: 1, padding: '9px 10px', textAlign: 'center',
                fontSize: '.78rem', fontWeight: 700, cursor: 'pointer',
                color: activeTab === tab ? 'var(--red)' : 'var(--muted)',
                borderBottom: activeTab === tab ? '2px solid var(--red)' : '2px solid transparent',
                transition: 'all .15s',
              }}>
                {tab === 'book' ? '📚 Khai cuộc' : '♟ Nước cờ'}
              </div>
            ))}
          </div>

          {/* ── Tab: Cơ sở dữ liệu khai cuộc ── */}
          {activeTab === 'book' && (
            <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
              {/* Opening name */}
              {result?.openingName && (
                <div style={{ padding: '8px 10px', background: '#fdf0ee', borderBottom: '1px solid #f5c6c0', fontSize: '.75rem', fontWeight: 700, color: 'var(--red)' }}>
                  📖 {result.openingName}
                </div>
              )}

              {/* Book moves */}
              {result?.bookMoves && result.bookMoves.length > 0 ? (
                <>
                  <div style={{ padding: '6px 10px', background: '#fafafa', borderBottom: '1px solid var(--border)', fontSize: '.68rem', color: 'var(--muted)', fontWeight: 600, display: 'grid', gridTemplateColumns: '1fr 50px 40px' }}>
                    <span>Nước cờ</span><span style={{ textAlign: 'center' }}>Tên</span><span style={{ textAlign: 'center' }}>Độ ưu</span>
                  </div>
                  {result.bookMoves.map((bm, i) => {
                    const mv = parseUcci(bm.ucci);
                    const isRed = currentTurn === 'red';
                    return (
                      <div key={i}
                        onClick={() => {
                          if (mv) {
                            setArrows([{ ...mv, color: 'rgba(231,76,60,0.85)' }]);
                          }
                        }}
                        style={{
                          display: 'grid', gridTemplateColumns: '1fr 50px 40px',
                          padding: '7px 10px', borderBottom: '1px solid #f5f5f5',
                          background: i % 2 === 0 ? '#fff' : '#fafafa',
                          cursor: 'pointer', transition: 'background .1s',
                        }}
                        onMouseEnter={e => (e.currentTarget.style.background = '#fdf0ee')}
                        onMouseLeave={e => (e.currentTarget.style.background = i % 2 === 0 ? '#fff' : '#fafafa')}>
                        <span style={{ fontFamily: 'monospace', fontWeight: 700, color: isRed ? 'var(--red)' : '#333', fontSize: '.78rem' }}>
                          {bm.ucci}
                        </span>
                        <span style={{ fontSize: '.68rem', color: 'var(--muted)', textAlign: 'center', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {bm.nameVi}
                        </span>
                        <span style={{ textAlign: 'center' }}>
                          {'★'.repeat(Math.ceil(bm.weight / 34)).slice(0, 3)}
                        </span>
                      </div>
                    );
                  })}
                </>
              ) : (
                <div style={{ padding: 16, textAlign: 'center', color: 'var(--muted)', fontSize: '.78rem' }}>
                  {result ? 'Không có trong sách khai cuộc' : 'Nhấn Phân tích để tra cứu'}
                </div>
              )}

              {/* MultiPV lines */}
              {result?.pvLines && result.pvLines.length > 0 && (
                <>
                  <div style={{ padding: '6px 10px', background: '#f0f0f0', borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)', fontSize: '.68rem', color: 'var(--muted)', fontWeight: 700 }}>
                    TOP {result.pvLines.length} NƯỚC — PIKAFISH
                  </div>
                  {result.pvLines.map((pv, i) => (
                    <div key={i}
                      onClick={() => {
                        if (pv.bestMoveCoord) {
                          const mv = { fromRow: pv.bestMoveCoord.fromRow, fromCol: pv.bestMoveCoord.fromCol, toRow: pv.bestMoveCoord.toRow, toCol: pv.bestMoveCoord.toCol };
                          setArrows([{ ...mv, color: i === 0 ? 'rgba(231,76,60,0.85)' : 'rgba(33,150,243,0.72)' }]);
                        }
                      }}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 6,
                        padding: '7px 10px', borderBottom: '1px solid #f5f5f5',
                        background: i === 0 ? '#fff8f7' : i % 2 === 0 ? '#fff' : '#fafafa',
                        cursor: 'pointer', transition: 'background .1s',
                      }}
                      onMouseEnter={e => (e.currentTarget.style.background = '#fdf0ee')}
                      onMouseLeave={e => (e.currentTarget.style.background = i === 0 ? '#fff8f7' : i % 2 === 0 ? '#fff' : '#fafafa')}>
                      <span style={{ fontSize: '.68rem', color: 'var(--muted)', minWidth: 14 }}>{i + 1}.</span>
                      <span style={{ fontFamily: 'monospace', fontWeight: i === 0 ? 700 : 500, color: i === 0 ? 'var(--red)' : '#333', fontSize: '.78rem', flex: 1 }}>
                        {pv.bestMove}
                        {pv.inBook && <span style={{ marginLeft: 4, fontSize: '.62rem', color: '#27ae60', fontWeight: 700 }}>📚</span>}
                      </span>
                      <span style={{ fontSize: '.72rem', fontWeight: 600, color: scoreColor(pv.score, pv.isMate, pv.mateIn) }}>
                        {pv.isMate ? `M${pv.mateIn}` : fmtScore(pv.score, false, 0)}
                      </span>
                    </div>
                  ))}
                </>
              )}
            </div>
          )}

          {/* ── Tab: Nước cờ PV ── */}
          {activeTab === 'moves' && (
            <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 60px 60px', padding: '6px 10px', background: '#fafafa', borderBottom: '1px solid var(--border)', fontSize: '.68rem', color: 'var(--muted)', fontWeight: 600, flexShrink: 0 }}>
                <span>Nước cờ</span><span style={{ textAlign: 'center' }}>Bên</span><span style={{ textAlign: 'center' }}>Điểm</span>
              </div>
              {pvMoves.length === 0 ? (
                <div style={{ padding: 16, textAlign: 'center', color: 'var(--muted)', fontSize: '.78rem' }}>Chọn một dòng phân tích</div>
              ) : pvMoves.map((mv, i) => {
                const isRed = currentTurn === 'red' ? i % 2 === 0 : i % 2 !== 0;
                const sc = pvScores[i] ?? 0;
                const scStr = sc === 0 ? '0' : (sc > 0 ? `+${(sc/100).toFixed(2)}` : (sc/100).toFixed(2));
                const scCol = sc > 50 ? '#27ae60' : sc < -50 ? '#e74c3c' : '#888';
                return (
                  <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 60px 60px', padding: '5px 10px', borderBottom: '1px solid #f5f5f5', background: i % 2 === 0 ? '#fff' : '#fafafa', fontSize: '.76rem' }}>
                    <span style={{ fontFamily: 'monospace', fontWeight: i === 0 ? 700 : 400, color: i === 0 ? 'var(--red)' : '#333' }}>
                      {Math.floor(i/2)+1}. {mv}
                    </span>
                    <span style={{ textAlign: 'center', color: isRed ? 'var(--red)' : '#333', fontWeight: 600 }}>{isRed ? '🔴' : '⚫'}</span>
                    <span style={{ textAlign: 'center', color: scCol, fontSize: '.7rem', fontWeight: 600 }}>{i === 0 ? scStr : ''}</span>
                  </div>
                );
              })}
            </div>
          )}

          {/* Engine info */}
          <div style={{ padding: '8px 10px', borderTop: '1px solid var(--border)', fontSize: '.68rem', color: 'var(--muted)', background: '#fafafa', flexShrink: 0 }}>
            <div style={{ fontWeight: 700, color: 'var(--red)', marginBottom: 4 }}>Pikafish 2026</div>
            {result ? (
              <>
                <div>Depth: <strong>{result.depth}</strong> · MultiPV: <strong>{result.multiPvCount ?? 1}</strong></div>
                <div>Nodes: <strong>{fmtNodes(result.nodes)}</strong></div>
                <div>NPS: <strong>{fmtNodes(result.nps)}/s</strong></div>
              </>
            ) : <div>Chưa phân tích</div>}
          </div>
        </div>
      </div>
    </div>
  );
}
