import { useEffect, useState } from 'react';
import Board from './components/Board';
import Clock from './components/Clock';
import MoveHistory from './components/MoveHistory';
import CapturedPieces from './components/CapturedPieces';
import AuthModal from './components/AuthModal';
import Leaderboard from './components/Leaderboard';
import RoomLobby from './components/RoomLobby';
import OnlineGame from './components/OnlineGame';
import { useGame } from './hooks/useGame';
import { useClock } from './hooks/useClock';
import { api } from './api/gameApi';
import type { UserInfo } from './api/authApi';
import './App.css';

type Screen = 'menu' | 'local' | 'online';

export default function App() {
  const [screen, setScreen] = useState<Screen>('menu');
  const [user,   setUser]   = useState<UserInfo | null>(null);
  const [showAuth, setShowAuth] = useState(false);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [showLobby, setShowLobby] = useState(false);
  const [onlineRoomId, setOnlineRoomId] = useState('');

  const {
    state, selected, loading, hinting, error,
    aiDepth, setAiDepth, nodesInfo, hintMove,
    newGame, handleCellClick, undo, requestAiMove, requestHint,
  } = useGame();

  const { redTime, blackTime } = useClock(state);
  const [showHistory, setShowHistory] = useState(false);
  const [timeOption, setTimeOption]   = useState(600);

  // Load user từ localStorage
  useEffect(() => {
    const saved = localStorage.getItem('ct_user');
    if (saved) setUser(JSON.parse(saved));
  }, []);

  const startLocal = (mode: 'pvai' | 'pvp') => {
    setScreen('local');
    newGame(mode, timeOption);
  };

  const startOnline = () => {
    if (!user) { setShowAuth(true); return; }
    setShowLobby(true);
  };

  const joinRoom = (roomId: string) => {
    setOnlineRoomId(roomId);
    setShowLobby(false);
    setScreen('online');
  };

  const leaveOnline = () => {
    setOnlineRoomId('');
    setScreen('menu');
  };

  const exportPgn = () => {
    if (!state) return;
    api.getState(state.gameId)
      .then(() => window.open(`/api/game/${state.gameId}/pgn`, '_blank'))
      .catch(console.error);
  };

  // ── Menu Screen ────────────────────────────────────────────────────────────
  if (screen === 'menu') {
    return (
      <div className="app menu-screen">
        <div className="menu-container">
          <h1 className="menu-title">象棋 · Cờ Tướng</h1>
          <p className="menu-subtitle">Chinese Chess</p>

          <div className="menu-buttons">
            <button className="menu-btn btn-green" onClick={() => startLocal('pvai')}>
              <span className="menu-icon">🎮</span>
              <span>Chơi với AI</span>
            </button>
            <button className="menu-btn btn-blue" onClick={() => startLocal('pvp')}>
              <span className="menu-icon">👥</span>
              <span>Chơi 2 người (cùng máy)</span>
            </button>
            <button className="menu-btn btn-teal" onClick={startOnline}>
              <span className="menu-icon">🌐</span>
              <span>Chơi Online</span>
            </button>
            <button className="menu-btn btn-purple" onClick={() => setShowLeaderboard(true)}>
              <span className="menu-icon">🏆</span>
              <span>Bảng xếp hạng</span>
            </button>
          </div>

          {/* Time selector */}
          <div className="menu-time">
            <label>Thời gian mỗi bên:</label>
            <select className="time-select" value={timeOption} onChange={e => setTimeOption(+e.target.value)}>
              <option value={180}>3 phút</option>
              <option value={300}>5 phút</option>
              <option value={600}>10 phút</option>
              <option value={900}>15 phút</option>
              <option value={9999}>Không giới hạn</option>
            </select>
          </div>

          {/* User info */}
          <div className="menu-user">
            {user ? (
              <div className="user-info-row">
                <span>👤 {user.username} ({user.wins}W-{user.losses}L)</span>
                <button className="btn btn-red btn-sm" onClick={() => {
                  localStorage.removeItem('ct_token');
                  localStorage.removeItem('ct_user');
                  setUser(null);
                }}>Đăng xuất</button>
              </div>
            ) : (
              <button className="btn btn-orange" onClick={() => setShowAuth(true)}>Đăng nhập / Đăng ký</button>
            )}
          </div>
        </div>

        {showAuth && <AuthModal onClose={u => { setShowAuth(false); if (u) setUser(u); }} />}
        {showLeaderboard && <Leaderboard onClose={() => setShowLeaderboard(false)} />}
      </div>
    );
  }

  // ── Online Screen ──────────────────────────────────────────────────────────
  if (screen === 'online' && onlineRoomId) {
    return (
      <>
        <OnlineGame
          roomId={onlineRoomId}
          playerId={user?.id ?? 'guest'}
          playerName={user?.username ?? 'Khách'}
          onLeave={leaveOnline}
        />
        {showLobby && <RoomLobby playerId={user?.id ?? 'guest'} playerName={user?.username ?? 'Khách'} onJoin={joinRoom} onClose={() => setShowLobby(false)} />}
      </>
    );
  }

  // ── Local Game Screen ──────────────────────────────────────────────────────
  const statusText = () => {
    if (!state) return 'Đang tải...';
    if (state.status === 'checkmate')
      return `🏆 ${state.winner === 'red' ? 'ĐỎ' : 'ĐEN'} THẮNG!`;
    if (state.status === 'check')
      return `⚠ ${state.currentTurn === 'red' ? 'ĐỎ' : 'ĐEN'} bị CHIẾU!`;
    if (loading) return 'AI đang suy nghĩ...';
    return `Lượt: ${state.currentTurn === 'red' ? '🔴 ĐỎ' : '⚫ ĐEN'}`;
  };

  const isDisabled = loading || !state || state.status === 'checkmate'
    || (state.mode === 'pvai' && state.currentTurn === 'black');

  const statusClass = state?.status === 'checkmate' ? 'win'
    : state?.status === 'check' ? 'check'
    : loading ? 'thinking' : '';

  return (
    <div className="app">
      <header className="header">
        <h1>象棋 · Cờ Tướng</h1>
        <div className="header-right">
          <button className="btn btn-purple" onClick={() => setScreen('menu')}>← Menu</button>
          <button className="btn btn-orange" onClick={exportPgn} disabled={!state}>💾 Lưu PGN</button>
        </div>
      </header>

      <div className="main">
        <div className="board-col">
          <Clock time={blackTime} active={state?.currentTurn === 'black' && state?.status !== 'checkmate'} color="black" label="⚫ ĐEN" />
          {state && <CapturedPieces pieces={state.capturedBlack} label="Bị ăn" />}
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
            {loading && <div className="loading-overlay">🤖 AI đang suy nghĩ...</div>}
          </div>
          {state && <CapturedPieces pieces={state.capturedRed} label="Bị ăn" />}
          <Clock time={redTime} active={state?.currentTurn === 'red' && state?.status !== 'checkmate'} color="red" label="🔴 ĐỎ" />
        </div>

        <aside className="sidebar">
          <div className={`status-box ${statusClass}`}>{statusText()}</div>

          <div className="controls">
            <button onClick={undo}          className="btn btn-purple" disabled={loading || !state}>↩ Hoàn tác</button>
            <button onClick={requestAiMove} className="btn btn-teal"   disabled={isDisabled}>🤖 AI đi</button>
            <button onClick={requestHint}   className="btn btn-orange" disabled={loading || hinting || !state || state.status === 'checkmate'}>
              {hinting ? '💭...' : '💡 Gợi ý'}
            </button>
          </div>

          <div className="depth-control">
            <label>Độ sâu AI: <strong>{aiDepth}</strong>
              <span className="depth-hint"> ({aiDepth <= 3 ? 'Dễ' : aiDepth <= 5 ? 'TB' : 'Khó'})</span>
            </label>
            <input type="range" min={1} max={7} value={aiDepth} onChange={e => setAiDepth(+e.target.value)} />
            <div className="depth-labels"><span>1</span><span>7</span></div>
          </div>

          {nodesInfo != null && <div className="ai-info">🔍 {nodesInfo.toLocaleString()} nút</div>}

          <div className="history-section">
            <button className="history-toggle" onClick={() => setShowHistory(v => !v)}>
              📋 Lịch sử {state ? `(${state.moveCount})` : ''} {showHistory ? '▲' : '▼'}
            </button>
            {showHistory && state && <MoveHistory history={state.moveHistory} />}
          </div>

          {error && <div className="error-box">⚠ {error}</div>}

          <div className="guide">
            <h3>Hướng dẫn</h3>
            <ul>
              <li>Chấm xanh = ô có thể đi</li>
              <li>Vòng đỏ = ô có thể ăn quân</li>
              <li>Vàng = nước đi cuối</li>
              <li>Tím = gợi ý AI</li>
            </ul>
          </div>
        </aside>
      </div>

      {showLobby && <RoomLobby playerId={user?.id ?? 'guest'} playerName={user?.username ?? 'Khách'} onJoin={joinRoom} onClose={() => setShowLobby(false)} />}
    </div>
  );
}
