import { useEffect, useState } from 'react';
import Board from './components/Board';
import MoveHistory from './components/MoveHistory';
import AuthModal from './components/AuthModal';
import Leaderboard from './components/Leaderboard';
import OnlineLobbyScreen from './components/OnlineLobbyScreen';
import OnlineGame from './components/OnlineGame';
import { useGame } from './hooks/useGame';
import { useClock } from './hooks/useClock';
import { api } from './api/gameApi';
import type { UserInfo } from './api/authApi';
import './App.css';

type Screen = 'home' | 'local' | 'online' | 'online-game';

const TIME_OPTIONS = [
  { label: '1+0',  sub: '1 phút',  val: 60   },
  { label: '3+0',  sub: '3 phút',  val: 180  },
  { label: '5+0',  sub: '5 phút',  val: 300  },
  { label: '10+0', sub: '10 phút', val: 600  },
  { label: '15+0', sub: '15 phút', val: 900  },
  { label: '∞',    sub: 'Vô hạn',  val: 9999 },
];

function fmt(s: number) {
  if (s >= 9999) return '∞';
  const m = Math.floor(s / 60), sec = s % 60;
  return `${m}:${sec.toString().padStart(2, '0')}`;
}

export default function App() {
  const [screen,   setScreen]   = useState<Screen>('home');
  const [user,     setUser]     = useState<UserInfo | null>(null);
  const [showAuth, setShowAuth] = useState(false);
  const [showLb,   setShowLb]   = useState(false);
  const [roomId,   setRoomId]   = useState('');
  const [timeVal,  setTimeVal]  = useState(600);
  const [gameMode, setGameMode] = useState<'pvai' | 'pvp'>('pvai');
  const [showHist, setShowHist] = useState(true);

  const {
    state, selected, loading, hinting, error,
    aiDepth, setAiDepth, nodesInfo, hintMove,
    newGame, handleCellClick, undo, requestAiMove, requestHint,
  } = useGame();

  const { redTime, blackTime } = useClock(state);

  useEffect(() => {
    const saved = localStorage.getItem('ct_user');
    if (saved) try { setUser(JSON.parse(saved)); } catch {}
  }, []);

  const startGame = (mode: 'pvai' | 'pvp') => {
    setGameMode(mode);
    setScreen('local');
    newGame(mode, timeVal);
  };

  const logout = () => {
    localStorage.removeItem('ct_token');
    localStorage.removeItem('ct_user');
    setUser(null);
  };

  const statusText = () => {
    if (!state) return '...';
    if (state.status === 'checkmate') return `${state.winner === 'red' ? '🔴 ĐỎ' : '⚫ ĐEN'} THẮNG!`;
    if (state.status === 'check')     return `⚠ ${state.currentTurn === 'red' ? 'ĐỎ' : 'ĐEN'} bị CHIẾU`;
    if (loading)                      return '🤖 AI đang suy nghĩ...';
    return `Lượt: ${state.currentTurn === 'red' ? '🔴 ĐỎ' : '⚫ ĐEN'}`;
  };
  const statusCls = state?.status === 'checkmate' ? 'win'
    : state?.status === 'check' ? 'check'
    : loading ? 'thinking' : '';

  const isDisabled = loading || !state || state.status === 'checkmate'
    || (state.mode === 'pvai' && state.currentTurn === 'black');

  // ── Sidebar ──────────────────────────────────────────────────────────────
  const Sidebar = () => (
    <aside className="sidebar">
      <a className="sidebar-logo" href="#" onClick={e => { e.preventDefault(); setScreen('home'); }}>
        <div className="sidebar-logo-icon">象</div>
        <span className="sidebar-logo-text">Cờ Tướng</span>
      </a>

      <nav className="sidebar-nav">
        <div className="nav-group">
          <button className={`nav-item${screen === 'home' ? ' active' : ''}`}
            onClick={() => setScreen('home')}>
            <span className="nav-item-icon">🏠</span>
            <span className="nav-item-label">Trang chủ</span>
          </button>
          <button className={`nav-item${screen === 'local' && gameMode === 'pvai' ? ' active' : ''}`}
            onClick={() => startGame('pvai')}>
            <span className="nav-item-icon">🤖</span>
            <span className="nav-item-label">Chơi với máy tính</span>
          </button>
          <button className={`nav-item${screen === 'local' && gameMode === 'pvp' ? ' active' : ''}`}
            onClick={() => startGame('pvp')}>
            <span className="nav-item-icon">👥</span>
            <span className="nav-item-label">Chơi 2 người</span>
          </button>
          <button className={`nav-item${screen === 'online' || screen === 'online-game' ? ' active' : ''}`}
            onClick={() => setScreen('online')}>
            <span className="nav-item-icon">🌐</span>
            <span className="nav-item-label">Chơi trực tuyến</span>
            <span className="nav-item-arrow">›</span>
          </button>
        </div>

        <div className="nav-divider" />

        <div className="nav-group">
          <button className="nav-item" onClick={() => setShowLb(true)}>
            <span className="nav-item-icon">🏆</span>
            <span className="nav-item-label">Bảng xếp hạng</span>
          </button>
        </div>
      </nav>

      <div className="sidebar-bottom">
        <button className="nav-item" style={{ width: '100%' }}
          onClick={() => setShowAuth(true)}>
          <span className="nav-item-icon">⚙</span>
          <span className="nav-item-label">Cài đặt</span>
        </button>
        {user ? (
          <div className="sidebar-user" onClick={logout} title="Đăng xuất">
            <div className="user-avatar">{user.username[0].toUpperCase()}</div>
            <span className="user-name">{user.username}</span>
            <span className="user-badge">{user.wins}W</span>
          </div>
        ) : (
          <button className="nav-item" style={{ width: '100%' }}
            onClick={() => setShowAuth(true)}>
            <span className="nav-item-icon">👤</span>
            <span className="nav-item-label">Đăng nhập</span>
          </button>
        )}
      </div>
    </aside>
  );

  // ══════════════════════════════════════════════════════
  // HOME SCREEN
  // ══════════════════════════════════════════════════════
  if (screen === 'home') return (
    <div className="app-shell">
      <Sidebar />
      <main className="main-content">
        <div className="home-screen">
          <div className="home-inner">
            <div className="home-title">
              <h1>Chào mừng đến với<br /><strong>Cờ Tướng Online!</strong></h1>
            </div>

            <button className="menu-card" onClick={() => setScreen('online')}>
              <div className="menu-card-icon">🌐</div>
              <div className="menu-card-body">
                <div className="menu-card-title">Chơi trực tuyến</div>
                <div className="menu-card-desc">Chơi cờ với các bạn cờ trên thế giới</div>
              </div>
              <span className="menu-card-arrow">›</span>
            </button>

            <button className="menu-card" onClick={() => startGame('pvai')}>
              <div className="menu-card-icon">🤖</div>
              <div className="menu-card-body">
                <div className="menu-card-title">Chơi với máy tính</div>
                <div className="menu-card-desc">Thi đấu với AI kiểm tra năng lực của bạn</div>
              </div>
              <span className="menu-card-arrow">›</span>
            </button>

            <button className="menu-card" onClick={() => startGame('pvp')}>
              <div className="menu-card-icon">👥</div>
              <div className="menu-card-body">
                <div className="menu-card-title">Chơi 2 người (cùng máy)</div>
                <div className="menu-card-desc">Chơi cờ với bạn bè trên cùng thiết bị</div>
              </div>
              <span className="menu-card-arrow">›</span>
            </button>

            <button className="menu-card" onClick={() => setShowLb(true)}>
              <div className="menu-card-icon">🏆</div>
              <div className="menu-card-body">
                <div className="menu-card-title">Bảng xếp hạng</div>
                <div className="menu-card-desc">Xem top người chơi giỏi nhất</div>
              </div>
              <span className="menu-card-arrow">›</span>
            </button>

            {/* Time selector */}
            <div className="home-time-row">
              <label>Thời gian:</label>
              {TIME_OPTIONS.map(t => (
                <button key={t.val}
                  className={`time-chip${timeVal === t.val ? ' active' : ''}`}
                  onClick={() => setTimeVal(t.val)}>
                  {t.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </main>

      {showAuth && <AuthModal onClose={u => { setShowAuth(false); if (u) setUser(u); }} />}
      {showLb   && <Leaderboard onClose={() => setShowLb(false)} />}
    </div>
  );

  // ══════════════════════════════════════════════════════
  // ONLINE SCREENS
  // ══════════════════════════════════════════════════════
  if (screen === 'online') return (
    <div className="app-shell">
      <Sidebar />
      <main className="main-content">
        <OnlineLobbyScreen
          user={user}
          onJoin={id => { setRoomId(id); setScreen('online-game'); }}
          onBack={() => setScreen('home')}
          onNeedAuth={() => setShowAuth(true)}
        />
      </main>
      {showAuth && <AuthModal onClose={u => { setShowAuth(false); if (u) setUser(u); }} />}
    </div>
  );

  if (screen === 'online-game') return (
    <div className="app-shell">
      <Sidebar />
      <main className="main-content">
        <OnlineGame
          roomId={roomId}
          playerId={user?.id ?? `guest_${Math.random().toString(36).slice(2, 8)}`}
          playerName={user?.username ?? 'Khách'}
          onLeave={() => { setRoomId(''); setScreen('online'); }}
        />
      </main>
      {showAuth && <AuthModal onClose={u => { setShowAuth(false); if (u) setUser(u); }} />}
    </div>
  );

  // ══════════════════════════════════════════════════════
  // LOCAL GAME SCREEN
  // ══════════════════════════════════════════════════════
  const redCaptured   = state?.capturedRed   ?? [];
  const blackCaptured = state?.capturedBlack ?? [];

  return (
    <div className="app-shell">
      <Sidebar />
      <main className="main-content">
        <div className="game-screen">
          {/* Topbar */}
          <div className="game-topbar">
            <span className="game-topbar-title">
              {gameMode === 'pvai' ? '🤖 Chơi với máy tính' : '👥 Chơi 2 người'}
            </span>
            <div className="game-topbar-right">
              <button className="btn btn-white btn-sm"
                onClick={() => api.getState(state?.gameId ?? '').then(() =>
                  window.open(`/api/game/${state?.gameId}/pgn`, '_blank')).catch(() => {})}
                disabled={!state}>
                💾 Lưu PGN
              </button>
              <button className="btn btn-white btn-sm" onClick={() => setScreen('home')}>
                ← Trang chủ
              </button>
            </div>
          </div>

          <div className="game-body">
            {/* Board column */}
            <div className="board-col">
              {/* Black player */}
              <div className={`player-strip${state?.currentTurn === 'black' && state?.status !== 'checkmate' ? ' active' : ''}${blackTime <= 30 && state?.currentTurn === 'black' ? ' urgent' : ''}`}>
                <div className="ps-avatar black">將</div>
                <div className="ps-name">⚫ ĐEN {gameMode === 'pvai' ? '' : ''}</div>
                <div className="ps-captured">
                  {blackCaptured.map((p, i) => <span key={i} className="ps-piece">{p.symbol}</span>)}
                </div>
                <div className={`ps-clock black-c${blackTime <= 30 && state?.currentTurn === 'black' ? ' urgent' : ''}`}>
                  {fmt(blackTime)}
                </div>
              </div>

              {/* Board */}
              <div className="board-wrap">
                {state && (
                  <Board
                    board={state.board}
                    legalMoves={state.legalMoves}
                    lastMove={state.lastMove}
                    selected={selected}
                    hintMove={hintMove}
                    onCellClick={handleCellClick}
                    disabled={isDisabled}
                  />
                )}
                {loading && <div className="board-loading">🤖 AI đang suy nghĩ...</div>}
              </div>

              {/* Red player */}
              <div className={`player-strip${state?.currentTurn === 'red' && state?.status !== 'checkmate' ? ' active' : ''}${redTime <= 30 && state?.currentTurn === 'red' ? ' urgent' : ''}`}>
                <div className="ps-avatar red">帥</div>
                <div className="ps-name">🔴 ĐỎ {gameMode === 'pvai' ? '(Bạn)' : ''}</div>
                <div className="ps-captured">
                  {redCaptured.map((p, i) => <span key={i} className="ps-piece">{p.symbol}</span>)}
                </div>
                <div className={`ps-clock red-c${redTime <= 30 && state?.currentTurn === 'red' ? ' urgent' : ''}`}>
                  {fmt(redTime)}
                </div>
              </div>
            </div>

            {/* Right panel */}
            <div className="game-panel">
              {/* Status */}
              <div className={`status-badge ${statusCls}`}>{statusText()}</div>

              {/* Controls */}
              <div className="panel-card">
                <h4>Điều khiển</h4>
                <div className="ctrl-grid">
                  <button className="btn btn-white" onClick={undo} disabled={loading || !state}>↩ Hoàn tác</button>
                  <button className="btn btn-red"   onClick={requestAiMove} disabled={isDisabled}>🤖 AI đi</button>
                  <button className="btn btn-white" onClick={requestHint}
                    disabled={loading || hinting || !state || state.status === 'checkmate'}>
                    {hinting ? '💭...' : '💡 Gợi ý'}
                  </button>
                  <button className="btn btn-red"   onClick={() => newGame(gameMode, timeVal)} disabled={loading}>
                    🔄 Ván mới
                  </button>
                </div>
              </div>

              {/* AI depth */}
              {gameMode === 'pvai' && (
                <div className="panel-card">
                  <h4>Độ khó AI</h4>
                  <div className="depth-row">
                    <label>Độ sâu: <strong>{aiDepth}</strong></label>
                    <span style={{ fontSize: '.72rem', color: 'var(--muted)' }}>
                      {aiDepth <= 3 ? 'Dễ' : aiDepth <= 5 ? 'TB' : 'Khó'}
                    </span>
                  </div>
                  <input type="range" min={1} max={7} value={aiDepth}
                    onChange={e => setAiDepth(+e.target.value)} />
                  {nodesInfo != null && <div className="ai-nodes">🔍 {nodesInfo.toLocaleString()} nút</div>}
                </div>
              )}

              {/* Move history */}
              <div className="panel-card" style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                <h4 style={{ cursor: 'pointer' }} onClick={() => setShowHist(v => !v)}>
                  📋 Lịch sử {state ? `(${state.moveCount})` : ''} {showHist ? '▲' : '▼'}
                </h4>
                {showHist && state && (
                  <div className="history-scroll">
                    <MoveHistory history={state.moveHistory} />
                  </div>
                )}
              </div>

              {error && (
                <div style={{ fontSize: '.78rem', color: 'var(--red)', padding: '8px 12px', background: '#fdf0ee', borderRadius: 8 }}>
                  ⚠ {error}
                </div>
              )}

              {/* Guide */}
              <div className="panel-card">
                <h4>Chú thích</h4>
                <div style={{ fontSize: '.72rem', color: 'var(--muted)', lineHeight: 1.9 }}>
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
