import { useState, useCallback, useRef } from 'react';
import Board from './Board';
import type { CellDto, MoveDto } from '../api/gameApi';

// ── Types ─────────────────────────────────────────────────────────────────────
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
}

// ── FEN ban đầu (vị trí khai cuộc) ───────────────────────────────────────────
const START_FEN = 'rnbakabnr/9/1c5c1/p1p1p1p1p/9/9/P1P1P1P1P/1C5C1/9/RNBAKABNR w - - 0 1';

// ── Gọi API phân tích ─────────────────────────────────────────────────────────
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

// ── Parse FEN → CellDto[][] (hiển thị bàn cờ) ────────────────────────────────
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
        cells.push(p ? { symbol: p.symbol, color: p.color, type: p.type } : { symbol: null, color: null, type: null });
      }
    }
    return cells;
  });
}

function fenTurn(fen: string): 'red' | 'black' {
  return fen.split(' ')[1] === 'b' ? 'black' : 'red';
}

function scoreLabel(r: AnalysisResult): string {
  if (r.isMate) return r.mateIn > 0 ? `Chiếu hết trong ${r.mateIn} nước` : `Bị chiếu hết trong ${Math.abs(r.mateIn)} nước`;
  const cp = r.score / 100;
  const sign = cp > 0 ? '+' : '';
  return `${sign}${cp.toFixed(2)}`;
}

function scoreColor(r: AnalysisResult): string {
  if (r.isMate) return r.mateIn > 0 ? '#27ae60' : '#e74c3c';
  if (r.score > 50)  return '#27ae60';
  if (r.score < -50) return '#e74c3c';
  return '#888';
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function AnalysisPage() {
  const [fen,       setFen]       = useState(START_FEN);
  const [fenInput,  setFenInput]  = useState(START_FEN);
  const [board,     setBoard]     = useState<CellDto[][]>(() => fenToBoard(START_FEN));
  const [result,    setResult]    = useState<AnalysisResult | null>(null);
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState('');
  const [timeMs,    setTimeMs]    = useState(2000);
  const [hintMove,  setHintMove]  = useState<MoveDto | null>(null);
  const [history,   setHistory]   = useState<string[]>([START_FEN]);
  const [histIdx,   setHistIdx]   = useState(0);
  const analyzing = useRef(false);

  const analyze = useCallback(async (fenStr: string) => {
    if (analyzing.current) return;
    analyzing.current = true;
    setLoading(true); setError(''); setHintMove(null);
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
      const b = fenToBoard(f);
      setFen(f); setBoard(b); setResult(null); setHintMove(null); setError('');
      const newHist = [...history.slice(0, histIdx + 1), f];
      setHistory(newHist); setHistIdx(newHist.length - 1);
    } catch {
      setError('FEN không hợp lệ');
    }
  };

  const reset = () => { loadFen(START_FEN); setFenInput(START_FEN); };

  const goHistory = (idx: number) => {
    const f = history[idx];
    setHistIdx(idx); setFen(f); setBoard(fenToBoard(f));
    setResult(null); setHintMove(null);
  };

  // PV line: parse các nước đi UCCI thành chuỗi dễ đọc
  const pvMoves = result?.pvLine?.split(' ').filter(Boolean) ?? [];

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
      {/* Topbar */}
      <div className="topbar">
        <span className="topbar-title">🔍 Phân tích — Pikafish Engine</span>
        <div className="topbar-right">
          <span style={{ fontSize: '.78rem', color: 'var(--muted)' }}>
            Powered by <strong style={{ color: 'var(--red)' }}>Pikafish 2026</strong>
          </span>
        </div>
      </div>

      <div style={{ display: 'flex', flex: 1, gap: 0, alignItems: 'flex-start', padding: 20, flexWrap: 'wrap', justifyContent: 'center' }}>

        {/* ── Bàn cờ ── */}
        <div className="board-col">
          {/* Turn indicator */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '8px 14px', background: '#fff', border: '1px solid var(--border)',
            borderRadius: 'var(--radius)', width: '100%', maxWidth: 540,
            boxShadow: 'var(--shadow-sm)',
          }}>
            <div style={{
              width: 14, height: 14, borderRadius: '50%',
              background: fenTurn(fen) === 'red' ? 'var(--red)' : '#222',
              flexShrink: 0,
            }} />
            <span style={{ fontSize: '.85rem', fontWeight: 600 }}>
              Lượt: {fenTurn(fen) === 'red' ? '🔴 ĐỎ' : '⚫ ĐEN'}
            </span>
            {result && (
              <span style={{ marginLeft: 'auto', fontSize: '.88rem', fontWeight: 700, color: scoreColor(result) }}>
                {scoreLabel(result)}
              </span>
            )}
          </div>

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
              <div className="board-spin">
                🔍 Pikafish đang phân tích...
              </div>
            )}
          </div>

          {/* Score bar */}
          {result && !result.isMate && (
            <div style={{ width: '100%', maxWidth: 540 }}>
              <div style={{ height: 8, background: '#222', borderRadius: 4, overflow: 'hidden' }}>
                <div style={{
                  height: '100%',
                  width: `${Math.min(100, Math.max(0, 50 + result.score / 20))}%`,
                  background: 'var(--red)', borderRadius: 4,
                  transition: 'width .5s ease',
                }} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '.68rem', color: 'var(--muted)', marginTop: 2 }}>
                <span>⚫ ĐEN</span><span>🔴 ĐỎ</span>
              </div>
            </div>
          )}
        </div>

        {/* ── Panel phải ── */}
        <div className="gpanel">

          {/* FEN input */}
          <div className="pcard">
            <h4>Nhập FEN</h4>
            <textarea
              value={fenInput}
              onChange={e => setFenInput(e.target.value)}
              rows={3}
              style={{
                width: '100%', resize: 'vertical',
                background: '#fafafa', border: '1px solid var(--border)',
                borderRadius: 6, padding: '8px 10px',
                fontSize: '.75rem', fontFamily: 'monospace',
                color: '#333', lineHeight: 1.5,
              }}
              placeholder="Nhập chuỗi FEN..."
            />
            <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
              <button className="btn btn-red" style={{ flex: 1, fontSize: '.78rem' }}
                onClick={() => loadFen(fenInput.trim())}>
                Tải FEN
              </button>
              <button className="btn btn-white" style={{ fontSize: '.78rem' }} onClick={reset}>
                Reset
              </button>
            </div>
          </div>

          {/* Phân tích */}
          <div className="pcard">
            <h4>Cài đặt phân tích</h4>
            <div className="drow">
              <label>Thời gian: <strong>{timeMs / 1000}s</strong></label>
            </div>
            <input type="range" min={500} max={8000} step={500} value={timeMs}
              onChange={e => setTimeMs(+e.target.value)} />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '.68rem', color: 'var(--muted)', marginTop: 2 }}>
              <span>0.5s</span><span>8s</span>
            </div>
            <button className="btn btn-red" style={{ width: '100%', marginTop: 10 }}
              onClick={() => analyze(fen)} disabled={loading}>
              {loading ? '🔍 Đang phân tích...' : '▶ Phân tích'}
            </button>
          </div>

          {/* Kết quả */}
          {result && (
            <div className="pcard">
              <h4>Kết quả Pikafish</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>

                {/* Nước đi tốt nhất */}
                <div style={{
                  background: '#fdf0ee', border: '1px solid #f5c6c0',
                  borderRadius: 8, padding: '10px 12px',
                }}>
                  <div style={{ fontSize: '.7rem', color: 'var(--muted)', marginBottom: 4 }}>NƯỚC ĐI TỐT NHẤT</div>
                  <div style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--red)', fontFamily: 'monospace', letterSpacing: 2 }}>
                    {result.bestMove || '—'}
                  </div>
                </div>

                {/* Điểm số */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                  {[
                    { label: 'Điểm số', value: scoreLabel(result), color: scoreColor(result) },
                    { label: 'Độ sâu',  value: `${result.depth}`,  color: '#333' },
                    { label: 'Nodes',   value: result.nodes > 1000000 ? `${(result.nodes/1000000).toFixed(1)}M` : `${(result.nodes/1000).toFixed(0)}K`, color: '#333' },
                    { label: 'NPS',     value: result.nps > 1000000 ? `${(result.nps/1000000).toFixed(1)}M` : `${(result.nps/1000).toFixed(0)}K`, color: '#333' },
                  ].map(item => (
                    <div key={item.label} style={{
                      background: '#fafafa', border: '1px solid var(--border)',
                      borderRadius: 6, padding: '8px 10px', textAlign: 'center',
                    }}>
                      <div style={{ fontSize: '.65rem', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: .5 }}>{item.label}</div>
                      <div style={{ fontSize: '.95rem', fontWeight: 700, color: item.color }}>{item.value}</div>
                    </div>
                  ))}
                </div>

                {/* PV Line */}
                {pvMoves.length > 0 && (
                  <div>
                    <div style={{ fontSize: '.7rem', color: 'var(--muted)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: .5 }}>
                      Đường đi dự kiến (PV)
                    </div>
                    <div style={{
                      background: '#fafafa', border: '1px solid var(--border)',
                      borderRadius: 6, padding: '8px 10px',
                      fontSize: '.75rem', fontFamily: 'monospace',
                      color: '#444', lineHeight: 1.8, wordBreak: 'break-all',
                    }}>
                      {pvMoves.map((m, i) => (
                        <span key={i} style={{
                          display: 'inline-block', marginRight: 4,
                          color: i === 0 ? 'var(--red)' : '#666',
                          fontWeight: i === 0 ? 700 : 400,
                        }}>
                          {i % 2 === 0 && <span style={{ color: '#bbb', marginRight: 2 }}>{Math.floor(i/2)+1}.</span>}
                          {m}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Lịch sử FEN */}
          {history.length > 1 && (
            <div className="pcard">
              <h4>Lịch sử ({history.length})</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 120, overflowY: 'auto' }}>
                {history.map((f, i) => (
                  <button key={i}
                    onClick={() => goHistory(i)}
                    style={{
                      background: i === histIdx ? '#fdf0ee' : '#fafafa',
                      border: `1px solid ${i === histIdx ? '#f5c6c0' : 'var(--border)'}`,
                      borderRadius: 6, padding: '5px 8px',
                      fontSize: '.68rem', fontFamily: 'monospace',
                      color: i === histIdx ? 'var(--red)' : '#666',
                      cursor: 'pointer', textAlign: 'left',
                      whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                    }}>
                    {i + 1}. {f.split(' ')[0]}
                  </button>
                ))}
              </div>
            </div>
          )}

          {error && (
            <div style={{ fontSize: '.78rem', color: 'var(--red)', padding: '8px 12px', background: '#fdf0ee', borderRadius: 8 }}>
              ⚠ {error}
            </div>
          )}

          {/* Hướng dẫn */}
          <div className="pcard">
            <h4>Hướng dẫn</h4>
            <div style={{ fontSize: '.72rem', color: 'var(--muted)', lineHeight: 1.9 }}>
              1. Nhập FEN hoặc dùng vị trí mặc định<br />
              2. Chọn thời gian phân tích<br />
              3. Nhấn <strong>Phân tích</strong><br />
              🟣 Nước đi tốt nhất được tô tím trên bàn cờ
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
