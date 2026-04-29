import { useEffect, useState } from 'react';
import Board from './components/Board';
import MoveHistory from './components/MoveHistory';
import AuthModal from './components/AuthModal';
import Leaderboard from './components/Leaderboard';
import OnlineLobbyScreen from './components/OnlineLobbyScreen';
import OnlineGame from './components/OnlineGame';
import AnalysisPage from './components/AnalysisPage';
import { useGame } from './hooks/useGame';
import { useClock } from './hooks/useClock';
import { api } from './api/gameApi';
import type { UserInfo } from './api/authApi';
import './App.css';

type Screen = 'home' | 'local' | 'online' | 'online-game' | 'analysis';

const TIMES = [
  { l: '1+0',  s: '1 phút',  v: 60   },
  { l: '3+0',  s: '3 phút',  v: 180  },
  { l: '5+0',  s: '5 phút',  v: 300  },
  { l: '10+0', s: '10 phút', v: 600  },
  { l: '15+0', s: '15 phút', v: 900  },
  { l: '∞',    s: 'Vô hạn',  v: 9999 },
];

function fmt(s: number) {
  if (s >= 9999) return '∞';
  return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;
}

export default function App() {
  const [screen,   setScreen]   = useState<Screen>('home');
  const [user,     setUser]     = useState<UserInfo | null>(null);
  const [showAuth, setShowAuth] = useState(false);
  const [showLb,   setShowLb]   = useState(false);
  const [roomId,   setRoomId]   = useState('');
  const [tv,       setTv]       = useState(600);
  const [mode,     setMode]     = useState<'pvai' | 'pvp'>('pvai');
  const [showH,    setShowH]    = useState(true);
  const [flipped,  setFlipped]  = useState(false);

  const {
    state, selected, loading, hinting, error,
    aiDepth, setAiDepth, nodesInfo, hintMove,
    newGame, handleCellClick, undo, requestAiMove, requestHint,
  } = useGame();

  const { redTime, blackTime } = useClock(state);

  useEffect(() => {
    try { const s = localStorage.getItem('ct_user'); if (s) setUser(JSON.parse(s)); } catch {}
  }, []);

  const play = (m: 'pvai' | 'pvp') => { setMode(m); setScreen('local'); newGame(m, tv); };
  const logout = () => { localStorage.removeItem('ct_token'); localStorage.removeItem('ct_user'); setUser(null); };

  const stText = () => {
    if (!state) return '...';
    if (state.status === 'checkmate') return `${state.winner === 'red' ? '🔴 ĐỎ' : '⚫ ĐEN'} THẮNG!`;
    if (state.status === 'check')     return `⚠ ${state.currentTurn === 'red' ? 'ĐỎ' : 'ĐEN'} bị CHIẾU`;
    if (loading)                      return '🤖 AI đang suy nghĩ...';
    return `Lượt: ${state.currentTurn === 'red' ? '🔴 ĐỎ' : '⚫ ĐEN'}`;
  };
  const stCls = state?.status === 'checkmate' ? 'win' : state?.status === 'check' ? 'check' : loading ? 'thinking' : '';
  const disabled = loading || !state || state.status === 'checkmate' || (state.mode === 'pvai' && state.currentTurn === 'black');

  /* ── Sidebar ── */
  const SB = () => (
    <aside className="sidebar">
      <div className="sb-logo" onClick={() => setScreen('home')}>
        <div className="sb-logo-icon">象</div>
        <span className="sb-logo-text">Cờ Tướng</span>
      </div>
      <nav className="sb-nav">
        <button className={`sb-item${screen === 'home' ? ' active' : ''}`} onClick={() => setScreen('home')}>
          <span className="sb-item-icon">🏠</span>
          <span className="sb-item-label">Trang chủ</span>
        </button>
        <button className={`sb-item${screen === 'online' || screen === 'online-game' ? ' active' : ''}`}
          onClick={() => setScreen('online')}>
          <span className="sb-item-icon">🌐</span>
          <span className="sb-item-label">Chơi trực tuyến</span>
          <span className="sb-item-chevron">›</span>
        </button>
        <button className={`sb-item${screen === 'local' && mode === 'pvai' ? ' active' : ''}`} onClick={() => play('pvai')}>
          <span className="sb-item-icon">🤖</span>
          <span className="sb-item-label">Chơi với máy tính</span>
          <span className="sb-item-chevron">›</span>
        </button>
        <button className={`sb-item${screen === 'local' && mode === 'pvp' ? ' active' : ''}`} onClick={() => play('pvp')}>
          <span className="sb-item-icon">👥</span>
          <span className="sb-item-label">Chơi 2 người</span>
          <span className="sb-item-chevron">›</span>
        </button>
        <div className="sb-divider" />
        <button className={`sb-item${screen === 'analysis' ? ' active' : ''}`}
          onClick={() => setScreen('analysis')}>
          <span className="sb-item-icon">🔍</span>
          <span className="sb-item-label">Phân tích</span>
          <span className="sb-item-chevron">›</span>
        </button>
        <div className="sb-divider" />
        <button className="sb-item" onClick={() => setShowLb(true)}>
          <span className="sb-item-icon">🏆</span>
          <span className="sb-item-label">Bảng xếp hạng</span>
        </button>
      </nav>
      <div className="sb-bottom">
        <button className="sb-item" style={{ width: '100%' }} onClick={() => setShowAuth(true)}>
          <span className="sb-item-icon">⚙</span>
          <span className="sb-item-label">Cài đặt</span>
        </button>
        {user ? (
          <div className="sb-user" onClick={logout} title="Nhấn để đăng xuất">
            <div className="sb-avatar">{user.username[0].toUpperCase()}</div>
            <span className="sb-username">{user.username}</span>
            <span className="sb-wins">{user.wins}W</span>
          </div>
        ) : (
          <button className="sb-item" style={{ width: '100%' }} onClick={() => setShowAuth(true)}>
            <span className="sb-item-icon">👤</span>
            <span className="sb-item-label">Đăng nhập</span>
          </button>
        )}
      </div>
    </aside>
  );

  /* ══════════════════════════════════════════════
     HOME
     ══════════════════════════════════════════════ */
  if (screen === 'home') return (
    <div className="shell">
      <SB />
      <main className="main">
        <div className="home">
          <div className="home-inner">
            <h1 className="home-heading">
              Chào mừng đến với<br /><strong>Cờ Tướng Online!</strong>
            </h1>

            <button className="home-card" onClick={() => setScreen('online')}>
              <div className="home-card-icon">🌐</div>
              <div className="home-card-body">
                <div className="home-card-title">Chơi trực tuyến</div>
                <div className="home-card-desc">Chơi cờ với các bạn cờ trên thế giới</div>
              </div>
              <span className="home-card-arrow">›</span>
            </button>

            <button className="home-card" onClick={() => play('pvai')}>
              <div className="home-card-icon">🤖</div>
              <div className="home-card-body">
                <div className="home-card-title">Chơi với máy tính</div>
                <div className="home-card-desc">Thi đấu với AI kiểm tra năng lực của bạn</div>
              </div>
              <span className="home-card-arrow">›</span>
            </button>

            <button className="home-card" onClick={() => play('pvp')}>
              <div className="home-card-icon">👥</div>
              <div className="home-card-body">
                <div className="home-card-title">Chơi 2 người (cùng máy)</div>
                <div className="home-card-desc">Chơi cờ với bạn bè trên cùng thiết bị</div>
              </div>
              <span className="home-card-arrow">›</span>
            </button>

            <button className="home-card" onClick={() => setShowLb(true)}>
              <div className="home-card-icon">🏆</div>
              <div className="home-card-body">
                <div className="home-card-title">Bảng xếp hạng</div>
                <div className="home-card-desc">Xem top người chơi giỏi nhất</div>
              </div>
              <span className="home-card-arrow">›</span>
            </button>

            <button className="home-card" onClick={() => setScreen('analysis')}>
              <div className="home-card-icon">🔍</div>
              <div className="home-card-body">
                <div className="home-card-title">Phân tích ván cờ</div>
                <div className="home-card-desc">Phân tích thế cờ bằng Pikafish Engine</div>
              </div>
              <span className="home-card-arrow">›</span>
            </button>

            <div className="home-time">
              <label>Thời gian:</label>
              {TIMES.map(t => (
                <button key={t.v} className={`tc${tv === t.v ? ' on' : ''}`} onClick={() => setTv(t.v)}>{t.l}</button>
              ))}
            </div>
          </div>
        </div>
      </main>
      {showAuth && <AuthModal onClose={u => { setShowAuth(false); if (u) setUser(u); }} />}
      {showLb   && <Leaderboard onClose={() => setShowLb(false)} />}
    </div>
  );

  /* ══════════════════════════════════════════════
     ONLINE
     ══════════════════════════════════════════════ */
  if (screen === 'online') return (
    <div className="shell">
      <SB />
      <main className="main">
        <OnlineLobbyScreen user={user}
          onJoin={id => { setRoomId(id); setScreen('online-game'); }}
          onBack={() => setScreen('home')}
          onNeedAuth={() => setShowAuth(true)} />
      </main>
      {showAuth && <AuthModal onClose={u => { setShowAuth(false); if (u) setUser(u); }} />}
    </div>
  );

  if (screen === 'online-game') return (
    <div className="shell">
      <SB />
      <main className="main">
        <OnlineGame roomId={roomId}
          playerId={user?.id ?? `guest_${Math.random().toString(36).slice(2, 8)}`}
          playerName={user?.username ?? 'Khách'}
          onLeave={() => { setRoomId(''); setScreen('online'); }} />
      </main>
      {showAuth && <AuthModal onClose={u => { setShowAuth(false); if (u) setUser(u); }} />}
    </div>
  );

  if (screen === 'analysis') return (
    <div className="shell">
      <SB />
      <main className="main">
        <AnalysisPage />
      </main>
    </div>
  );

  /* ══════════════════════════════════════════════
     LOCAL GAME
     ══════════════════════════════════════════════ */
  const rc = state?.capturedRed   ?? [];
  const bc = state?.capturedBlack ?? [];

  // Flip board helpers
  const displayBoard    = flipped ? [...(state?.board ?? [])].reverse().map(r => [...r].reverse()) : (state?.board ?? []);
  const displayLegal    = (state?.legalMoves ?? []).map(m => flipped ? { fromRow: 9-m.fromRow, fromCol: 8-m.fromCol, toRow: 9-m.toRow, toCol: 8-m.toCol } : m);
  const displayLast     = state?.lastMove && flipped ? { fromRow: 9-state.lastMove.fromRow, fromCol: 8-state.lastMove.fromCol, toRow: 9-state.lastMove.toRow, toCol: 8-state.lastMove.toCol } : (state?.lastMove ?? null);
  const displaySelected = selected && flipped ? [9-selected[0], 8-selected[1]] as [number,number] : selected;
  const displayHint     = hintMove && flipped ? { fromRow: 9-hintMove.fromRow, fromCol: 8-hintMove.fromCol, toRow: 9-hintMove.toRow, toCol: 8-hintMove.toCol } : hintMove;
  const handleFlippedClick = (row: number, col: number) => handleCellClick(flipped ? 9-row : row, flipped ? 8-col : col);

  return (
    <div className="shell">
      <SB />
      <main className="main">
        <div className="game-page">
          <div className="topbar">
            <span className="topbar-title">{mode === 'pvai' ? '🤖 Chơi với máy tính' : '👥 Chơi 2 người'}</span>
            <div className="topbar-right">
              <button className="btn btn-white btn-sm"
                onClick={() => api.getState(state?.gameId ?? '').then(() =>
                  window.open(`/api/game/${state?.gameId}/pgn`, '_blank')).catch(() => {})}
                disabled={!state}>💾 PGN</button>
              <button className="btn btn-white btn-sm" onClick={() => setFlipped(v => !v)}>🔄 Lật bàn</button>
              <button className="btn btn-white btn-sm" onClick={() => setScreen('home')}>← Trang chủ</button>
            </div>
          </div>

          <div className="game-body">
            {/* Board col */}
            <div className="board-col">
              <div className={`pstrip${state?.currentTurn === 'black' && state?.status !== 'checkmate' ? ' on' : ''}${blackTime <= 30 && state?.currentTurn === 'black' ? ' urg' : ''}`}>
                <div className="pstrip-av b">將</div>
                <div className="pstrip-name">⚫ ĐEN</div>
                <div className="pstrip-cap">{bc.map((p, i) => <span key={i} className="pstrip-pc">{p.symbol}</span>)}</div>
                <div className={`pstrip-clk b${blackTime <= 30 && state?.currentTurn === 'black' ? ' urg' : ''}`}>{fmt(blackTime)}</div>
              </div>

              <div className="board-wrap">
                {state && <Board board={displayBoard} legalMoves={displayLegal} lastMove={displayLast}
                  selected={displaySelected} hintMove={displayHint} onCellClick={handleFlippedClick} disabled={disabled} />}
                {loading && <div className="board-spin">🤖 AI đang suy nghĩ...</div>}
              </div>

              <div className={`pstrip${state?.currentTurn === 'red' && state?.status !== 'checkmate' ? ' on' : ''}${redTime <= 30 && state?.currentTurn === 'red' ? ' urg' : ''}`}>
                <div className="pstrip-av r">帥</div>
                <div className="pstrip-name">🔴 ĐỎ {mode === 'pvai' ? '(Bạn)' : ''}</div>
                <div className="pstrip-cap">{rc.map((p, i) => <span key={i} className="pstrip-pc">{p.symbol}</span>)}</div>
                <div className={`pstrip-clk r${redTime <= 30 && state?.currentTurn === 'red' ? ' urg' : ''}`}>{fmt(redTime)}</div>
              </div>
            </div>

            {/* Right panel */}
            <div className="gpanel">
              <div className={`sbadge ${stCls}`}>{stText()}</div>

              <div className="pcard">
                <h4>Điều khiển</h4>
                <div className="cgrid">
                  <button className="btn btn-white" onClick={undo} disabled={loading || !state}>↩ Hoàn tác</button>
                  <button className="btn btn-red"   onClick={requestAiMove} disabled={disabled}>🤖 AI đi</button>
                  <button className="btn btn-white" onClick={requestHint} disabled={loading || hinting || !state || state.status === 'checkmate'}>
                    {hinting ? '💭...' : '💡 Gợi ý'}
                  </button>
                  <button className="btn btn-red"   onClick={() => newGame(mode, tv)} disabled={loading}>🔄 Ván mới</button>
                </div>
              </div>

              {mode === 'pvai' && (
                <div className="pcard">
                  <h4>Độ khó AI</h4>
                  <div className="drow">
                    <label>Độ sâu: <strong>{aiDepth}</strong></label>
                    <span style={{ fontSize: '.7rem', color: 'var(--muted)' }}>{aiDepth <= 3 ? 'Dễ' : aiDepth <= 5 ? 'TB' : 'Khó'}</span>
                  </div>
                  <input type="range" min={1} max={7} value={aiDepth} onChange={e => setAiDepth(+e.target.value)} />
                  {nodesInfo != null && <div className="ai-info">🔍 {nodesInfo.toLocaleString()} nút</div>}
                </div>
              )}

              <div className="pcard" style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                <h4 onClick={() => setShowH(v => !v)}>📋 Lịch sử {state ? `(${state.moveCount})` : ''} {showH ? '▲' : '▼'}</h4>
                {showH && state && <div className="hscroll"><MoveHistory history={state.moveHistory} /></div>}
              </div>

              {error && <div style={{ fontSize: '.76rem', color: 'var(--red)', padding: '8px 12px', background: '#fdf0ee', borderRadius: 8 }}>⚠ {error}</div>}

              <div className="pcard">
                <h4>Chú thích</h4>
                <div style={{ fontSize: '.7rem', color: 'var(--muted)', lineHeight: 2 }}>
                  🟢 Ô có thể đi &nbsp;|&nbsp; 🔴 Ăn quân<br />
                  🟡 Nước vừa đi &nbsp;|&nbsp; 🟣 Gợi ý AI
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
      {showAuth && <AuthModal onClose={u => { setShowAuth(false); if (u) setUser(u); }} />}
      {showLb   && <Leaderboard onClose={() => setShowLb(false)} />}
    </div>
  );
}
