import { useState, useCallback, useRef } from 'react';
import Board from './Board';
import type { CellDto, MoveDto } from '../api/gameApi';

// ── Types ─────────────────────────────────────────────────────────────────────
interface InfoLine {
  depth:  number;
  score:  number;
  isMate: boolean;
  mateIn: number;
  nodes:  number;
  nps:    number;
  timeMs: number;
  pvLine: string;
}

interface AnalysisResult {
  bestMove:      string;
  bestMoveCoord: { fromRow: number; fromCol: number; toRow: number; toCol: number } | null;
  score:         number;
  isMate:        boolean;
  mateIn:        number;
  depth:         number;
  nodes:         number;
  nps:           number;
  pvLine:        string;
  engine:        string;
  lines:         InfoLine[];
}

const START_FEN = 'rnbakabnr/9/1c5c1/p1p1p1p1p/9/9/P1P1P1P1P/1C5C1/9/RNBAKABNR w - - 0 1';

const FEN_MAP: Record<string, { color: 'red' | 'black'; symbol: string; type: string }> = {
  K: { color: 'red',   symbol: '帥', type: 'general'  },
  A: { color: 'red',   symbol: '仕', type: 'advisor'  },
  E: { color: 'red',   symbol: '相', type: 'elephant' },
  H: { color: 'red',   symbol: '傌', type: 'horse'    },
  R: { color: 'red',   symbol: '俥', type: 'chariot'  },
  C: { color: 'red',   symbol: '炮', type: 'cannon'   },
  P: { color: 'red',   symbol: '兵', type: 'soldier'  },
  k: { color: 'black', symbol: '將', type: 'general'  },
  a: { color: 'black', symbol: '士', type: 'advisor'  },
  e: { color: 'black', symbol: '象', type: 'elephant' },
  h: { color: 'black', symbol: '馬', type: 'horse'    },
  r: { color: 'black', symbol: '車', type: 'chariot'  },
  c: { color: 'black', symbol: '砲', type: 'cannon'   },
  p: { color: 'black', symbol: '卒', type: 'soldier'  },
};

function fenToBoard(fen: string): CellDto[][] {
  const rows = fen.split(' ')[0].split('/');
  return rows.map(row => {
    const cells: CellDto[] = [];
    for (const ch of row) {
      if (/\d/.test(ch)) {
        for (let i = 0; i < +ch; i++) cells.push({ symbol: null, color: null, type: null });
      } else {
        const p = FEN_MAP[ch];
        cells.push(p ? { symbol: p.symbol, color: p.color, type: p.type }
                     : { symbol: null, color: null, type: null });
      }
    }
    return cells;
  });
}

function fenTurn(fen: string): 'red' | 'black' {
  return fen.split(' ')[1] === 'b' ? 'black' : 'red';
}

function fmtScore(line: InfoLine): string {
  if (line.isMate) return line.mateIn > 0 ? `M${line.mateIn}` : `M${line.mateIn}`;
  const v = line.score / 100;
  return (v > 0 ? '+' : '') + v.toFixed(2);
}

function fmtNodes(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `${(n / 1_000).toFixed(0)}K`;
  return `${n}`;
}

function fmtTime(ms: number): string {
  if (ms >= 1000) return `${(ms / 1000).toFixed(1)}s`;
  return `${ms}ms`;
}

function scoreColor(score: number, isMate: boolean, mateIn: number): string {
  if (isMate) return mateIn > 0 ? '#27ae60' : '#e74c3c';
  if (score > 50)  return '#27ae60';
  if (score < -50) return '#e74c3c';
  return '#888';
}

async function callAnalyze(fen: string, timeMs: number): Promise<AnalysisResult> {
  const base = import.meta.env.VITE_API_URL ?? '';
  const res  = await fetch(`${base}/api/analyze`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ fen, timeMs }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as any).error ?? `HTTP ${res.status}`);
  }
  return res.json();
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function AnalysisPage() {
  const [fen,      setFen]      = useState(START_FEN);
  const [fenInput, setFenInput] = useState(START_FEN);
  const [board,    setBoard]    = useState<CellDto[][]>(() => fenToBoard(START_FEN));
  const [result,   setResult]   = useState<AnalysisResult | null>(null);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState('');
  const [timeMs,   setTimeMs]   = useState(3000);
  const [hintMove, setHintMove] = useState<MoveDto | null>(null);
  const [selLine,  setSelLine]  = useState<InfoLine | null>(null);
  const analyzing = useRef(false);

  const analyze = useCallback(async (fenStr: string) => {
    if (analyzing.current) return;
    analyzing.current = true;
    setLoading(true); setError(''); setHintMove(null); setSelLine(null);
    try {
      const r = await callAnalyze(fenStr, timeMs);
      setResult(r);
      if (r.bestMoveCoord) {
        setHintMove({
          fromRow: r.bestMoveCoord.fromRow, fromCol: r.bestMoveCoord.fromCol,
          toRow:   r.bestMoveCoord.toRow,   toCol:   r.bestMoveCoord.toCol,
        });
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
      analyzing.current = false;
    }
  }, [timeMs]);

  const loadFen = (f: string) => {
    try {
      setFen(f); setBoard(fenToBoard(f));
      setResult(null); setHintMove(null); setError(''); setSelLine(null);
    } catch { setError('FEN không hợp lệ'); }
  };

  // Khi click vào 1 dòng depth → highlight nước đi đầu PV
  const selectLine = (line: InfoLine) => {
    setSelLine(line);
    const mv = line.pvLine.split(' ')[0];
    if (mv && mv.length === 4) {
      try {
        const fc = mv[0].charCodeAt(0) - 97;
        const fr = 9 - +mv[1];
        const tc = mv[2].charCodeAt(0) - 97;
        const tr = 9 - +mv[3];
        setHintMove({ fromRow: fr, fromCol: fc, toRow: tr, toCol: tc });
      } catch { /* ignore */ }
    }
  };

  const lines = result?.lines ?? [];
  const bestLine = lines[0] ?? null;

  // Bảng nước cờ từ PV của dòng được chọn (hoặc bestLine)
  const pvMoves = (selLine ?? bestLine)?.pvLine.split(' ').filter(Boolean) ?? [];

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      {/* ── Topbar ── */}
      <div className="topbar">
        <span className="topbar-title">🔍 Phân tích — Pikafish Engine</span>
        <div className="topbar-right" style={{ gap: 10 }}>
          {/* FEN input inline */}
          <input
            value={fenInput}
            onChange={e => setFenInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && loadFen(fenInput.trim())}
            style={{
              width: 320, background: '#fafafa', border: '1px solid var(--border)',
              borderRadius: 6, padding: '5px 10px', fontSize: '.78rem',
              fontFamily: 'monospace', color: '#333',
            }}
            placeholder="Nhập FEN..."
          />
          <button className="btn btn-white btn-sm" onClick={() => loadFen(fenInput.trim())}>Tải</button>
          <button className="btn btn-white btn-sm" onClick={() => { loadFen(START_FEN); setFenInput(START_FEN); }}>Reset</button>
          <select value={timeMs} onChange={e => setTimeMs(+e.target.value)}
            style={{ background: '#fafafa', border: '1px solid var(--border)', borderRadius: 6, padding: '5px 8px', fontSize: '.78rem' }}>
            {[1000,2000,3000,5000,8000].map(t => (
              <option key={t} value={t}>{t/1000}s</option>
            ))}
          </select>
          <button className="btn btn-red" onClick={() => analyze(fen)} disabled={loading}>
            {loading ? '⏳ Đang phân tích...' : '▶ Phân tích'}
          </button>
        </div>
      </div>

      {/* ── 3-column body ── */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden', minHeight: 0 }}>

        {/* ── Col 1: Bàn cờ ── */}
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          gap: 8, padding: '16px 12px', flexShrink: 0,
          borderRight: '1px solid var(--border)',
        }}>
          {/* Score bar */}
          <div style={{ width: '100%', maxWidth: 540 }}>
            <div style={{ height: 6, background: '#222', borderRadius: 3, overflow: 'hidden' }}>
              <div style={{
                height: '100%', borderRadius: 3,
                background: 'var(--red)', transition: 'width .4s ease',
                width: result
                  ? `${Math.min(100, Math.max(0, 50 + (result.score / 20)))}%`
                  : '50%',
              }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '.65rem', color: 'var(--muted)', marginTop: 2 }}>
              <span>⚫ ĐEN</span>
              {result && (
                <span style={{ fontWeight: 700, color: scoreColor(result.score, result.isMate, result.mateIn) }}>
                  {result.isMate
                    ? (result.mateIn > 0 ? `Chiếu hết M${result.mateIn}` : `Bị chiếu M${Math.abs(result.mateIn)}`)
                    : ((result.score > 0 ? '+' : '') + (result.score / 100).toFixed(2))}
                </span>
              )}
              <span>🔴 ĐỎ</span>
            </div>
          </div>

          {/* Board */}
          <div className="board-wrap" style={{ position: 'relative' }}>
            <Board
              board={board}
              legalMoves={[]}
              lastMove={null}
              selected={null}
              hintMove={hintMove}
              onCellClick={() => {}}
              disabled={true}
            />
            {loading && (
              <div className="board-spin">🔍 Pikafish đang phân tích...</div>
            )}
          </div>

          {/* Turn + FEN info */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '6px 12px', background: '#fff', border: '1px solid var(--border)',
            borderRadius: 'var(--radius)', width: '100%', maxWidth: 540,
            fontSize: '.78rem',
          }}>
            <div style={{
              width: 10, height: 10, borderRadius: '50%', flexShrink: 0,
              background: fenTurn(fen) === 'red' ? 'var(--red)' : '#222',
            }} />
            <span style={{ fontWeight: 600 }}>
              Lượt: {fenTurn(fen) === 'red' ? 'ĐỎ' : 'ĐEN'}
            </span>
            {result && (
              <span style={{ marginLeft: 'auto', color: 'var(--muted)' }}>
                Depth {result.depth} · {fmtNodes(result.nodes)} nodes
              </span>
            )}
          </div>

          {error && (
            <div style={{ fontSize: '.76rem', color: 'var(--red)', padding: '6px 10px', background: '#fdf0ee', borderRadius: 6, width: '100%', maxWidth: 540 }}>
              ⚠ {error}
            </div>
          )}
        </div>

        {/* ── Col 2: Danh sách depth lines (giống mẫu) ── */}
        <div style={{
          flex: 1, display: 'flex', flexDirection: 'column',
          borderRight: '1px solid var(--border)', minWidth: 0,
        }}>
          {/* Header */}
          <div style={{
            padding: '10px 14px', background: '#fafafa',
            borderBottom: '1px solid var(--border)',
            display: 'flex', alignItems: 'center', gap: 8,
            flexShrink: 0,
          }}>
            <span style={{ fontSize: '.82rem', fontWeight: 700, color: 'var(--red)' }}>Pikafish</span>
            {result && (
              <span style={{ fontSize: '.72rem', color: 'var(--muted)', marginLeft: 'auto' }}>
                {lines.length} dòng · {fmtNodes(result.nodes)} nodes · {fmtTime(result.lines[0]?.timeMs ?? 0)}
              </span>
            )}
          </div>

          {/* Lines list */}
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {lines.length === 0 && !loading && (
              <div style={{ padding: 24, textAlign: 'center', color: 'var(--muted)', fontSize: '.82rem' }}>
                Nhấn <strong>▶ Phân tích</strong> để bắt đầu
              </div>
            )}
            {lines.map((line, i) => {
              const isSelected = selLine?.depth === line.depth;
              const pvArr = line.pvLine.split(' ').filter(Boolean);
              return (
                <div key={line.depth}
                  onClick={() => selectLine(line)}
                  style={{
                    padding: '8px 14px',
                    borderBottom: '1px solid #f5f5f5',
                    cursor: 'pointer',
                    background: isSelected ? '#fdf0ee' : i % 2 === 0 ? '#fff' : '#fafafa',
                    transition: 'background .1s',
                  }}>
                  {/* Line 1: depth + score + time + nodes */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                    <span style={{ fontSize: '.72rem', color: 'var(--muted)', minWidth: 60 }}>
                      Độ sâu: <strong style={{ color: '#333' }}>{line.depth}</strong>
                    </span>
                    <span style={{
                      fontSize: '.82rem', fontWeight: 700,
                      color: scoreColor(line.score, line.isMate, line.mateIn),
                      minWidth: 52,
                    }}>
                      {line.isMate
                        ? (line.mateIn > 0 ? `Đỏ M${line.mateIn}` : `Đen M${Math.abs(line.mateIn)}`)
                        : `Điểm Đỏ: ${fmtScore(line)}`}
                    </span>
                    <span style={{ fontSize: '.7rem', color: 'var(--muted)' }}>
                      Thời gian tính toán: {fmtTime(line.timeMs)}
                    </span>
                    <span style={{ fontSize: '.7rem', color: 'var(--muted)', marginLeft: 'auto' }}>
                      biến trên giấy: {fmtNodes(line.nodes)}
                    </span>
                  </div>
                  {/* Line 2: PV moves */}
                  <div style={{ fontSize: '.72rem', fontFamily: 'monospace', color: '#555', lineHeight: 1.6 }}>
                    {pvArr.map((m, j) => (
                      <span key={j} style={{
                        marginRight: 4,
                        color: j === 0 ? 'var(--red)' : '#666',
                        fontWeight: j === 0 ? 700 : 400,
                      }}>
                        {j % 2 === 0 && (
                          <span style={{ color: '#bbb', marginRight: 2 }}>{Math.floor(j/2)+1}.</span>
                        )}
                        {m}
                      </span>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Col 3: Bảng nước cờ PV ── */}
        <div style={{ width: 220, flexShrink: 0, display: 'flex', flexDirection: 'column' }}>
          {/* Tabs */}
          <div style={{
            display: 'flex', borderBottom: '1px solid var(--border)',
            background: '#fafafa', flexShrink: 0,
          }}>
            <div style={{
              flex: 1, padding: '9px 10px', textAlign: 'center',
              fontSize: '.78rem', fontWeight: 700, color: 'var(--red)',
              borderBottom: '2px solid var(--red)',
            }}>Nước cờ</div>
          </div>

          {/* Table header */}
          <div style={{
            display: 'grid', gridTemplateColumns: '1fr 80px 60px',
            padding: '6px 10px', background: '#fafafa',
            borderBottom: '1px solid var(--border)',
            fontSize: '.7rem', color: 'var(--muted)', fontWeight: 600,
            flexShrink: 0,
          }}>
            <span>Nước cờ</span>
            <span style={{ textAlign: 'center' }}>Bên</span>
            <span style={{ textAlign: 'center' }}>Điểm số</span>
          </div>

          {/* PV moves table */}
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {pvMoves.length === 0 ? (
              <div style={{ padding: 16, textAlign: 'center', color: 'var(--muted)', fontSize: '.78rem' }}>
                Chọn một dòng phân tích
              </div>
            ) : pvMoves.map((mv, i) => {
              const isRed = (fenTurn(fen) === 'red') ? (i % 2 === 0) : (i % 2 !== 0);
              return (
                <div key={i} style={{
                  display: 'grid', gridTemplateColumns: '1fr 80px 60px',
                  padding: '6px 10px',
                  borderBottom: '1px solid #f5f5f5',
                  background: i % 2 === 0 ? '#fff' : '#fafafa',
                  fontSize: '.78rem',
                }}>
                  <span style={{
                    fontFamily: 'monospace', fontWeight: i === 0 ? 700 : 400,
                    color: i === 0 ? 'var(--red)' : '#333',
                  }}>
                    {Math.floor(i/2)+1}. {mv}
                  </span>
                  <span style={{ textAlign: 'center', color: isRed ? 'var(--red)' : '#333', fontWeight: 600 }}>
                    {isRed ? '🔴' : '⚫'}
                  </span>
                  <span style={{ textAlign: 'center', color: 'var(--muted)', fontSize: '.7rem' }}>
                    {i === 0 ? fmtScore(selLine ?? bestLine ?? { score: 0, isMate: false, mateIn: 0 } as InfoLine) : ''}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Engine info */}
          <div style={{
            padding: '8px 10px', borderTop: '1px solid var(--border)',
            fontSize: '.68rem', color: 'var(--muted)', background: '#fafafa',
            flexShrink: 0,
          }}>
            <div style={{ fontWeight: 700, color: 'var(--red)', marginBottom: 2 }}>Pikafish 2026</div>
            {result && (
              <>
                <div>Depth: {result.depth}</div>
                <div>Nodes: {fmtNodes(result.nodes)}</div>
                <div>NPS: {fmtNodes(result.nps)}/s</div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
