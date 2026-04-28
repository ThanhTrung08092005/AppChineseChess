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

type Screen = 'lobby' | 'local' | 'online';

const TIME_OPTIONS = [
  { label: '1+0',  sub: '1 min',   val: 60  },
  { label: '3+0',  sub: '3 min',   val: 180 },
  { label: '5+0',  sub: '5 min',   val: 300 },
  { label: '10+0', sub: '10 min',  val: 600 },
  { label: '15+0', sub: '15 min',  val: 900 },
  { label: '∞',    sub: 'No limit',val: 9999},
];

function fmt(s: number) {
  if (s >= 9999) return '∞';
  const m = Math.floor(s / 60), sec = s % 60;
  return `${m}:${sec.toString().padStart(2,'0')}`;
}

export default function App() {
  const [screen,    setScreen]    = useState<Screen>('lobby');
  const [user,      setUser]      = useState<UserInfo | null>(null);
  const [showAuth,  setShowAuth]  = useState(false);
  const [showLb,    setShowLb]    = useState(false);
  const [roomId,    setRoomId]    = useState('');
  const [timeVal,   setTimeVal]   = useState(600);
  const [gameMode,  setGameMode]  = useState<'pvai'|'pvp'>('pvai');
  const [showHist,  setShowHist]  = useState(true);

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

  const startGame = (mode: 'pvai'|'pvp') => {
    setGameMode(mode);
    setScreen('local');
    newGame(mode, timeVal);
  };

  const joinRoom = (id: string) => { setRoomId(id); setScreen('online'); };

  const logout = () => {
    localStorage.removeItem('ct_token');
    localStorage.removeItem('ct_user');
    setUser(null);
  };

  // ── Status text ──
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

  // ── Shared header ──
  const Header = () => (
    <header className="site-header">
      <a className="site-logo" href="#" onClick={e=>{e.preventDefault();setScreen('lobby')}}>
        象棋<span>·</span>
      </a>
      <nav className="site-nav">
        <a className={screen==='lobby'?'active':''} onClick={()=>setScreen('lobby')} href="#">Lobby</a>
        <a onClick={()=>startGame('pvai')} href="#">vs AI</a>
        <a onClick={()=>startGame('pvp')}  href="#">vs Người</a>
        <a onClick={()=>setShowLb(true)}   href="#">Bảng xếp hạng</a>
      </nav>
      <div className="site-header-right">
        <span className="online-count">
          <span className="online-dot"/>
          Online
        </span>
        {user ? (
          <div className="user-chip">
            <div className="user-avatar">{user.username[0].toUpperCase()}</div>
            <span>{user.username}</span>
            <button className="btn btn-ghost btn-sm" onClick={logout}>Thoát</button>
          </div>
        ) : (
          <button className="btn btn-red btn-sm" onClick={()=>setShowAuth(true)}>Đăng nhập</button>
        )}
      </div>
    </header>
  );

  // ══════════════════════════════════════════════════════
  // LOBBY SCREEN
  // ══════════════════════════════════════════════════════
  if (screen === 'lobby') return (
    <>
      <Header/>
      <div className="lobby-page">
        {/* Quick-play bar */}
        <div className="quickplay-bar">
          <h2>⚡ Chơi nhanh</h2>
          <div className="qp-times">
            {TIME_OPTIONS.map(t => (
              <button key={t.val}
                className={`qp-chip${timeVal===t.val?' active':''}`}
                onClick={()=>setTimeVal(t.val)}>
                {t.label}
              </button>
            ))}
          </div>
          <button className="qp-play-btn" onClick={()=>startGame('pvai')}>
            ▶ Chơi
          </button>
        </div>

        {/* 3-column body */}
        <div className="lobby-body">

          {/* ── Col 1: Create + Open challenges ── */}
          <div className="lobby-col">
            <div className="lobby-col-header">
              <h3>Tạo ván cờ</h3>
            </div>
            <div className="lobby-col-body">
              <div className="create-card">
                <h4>Thời gian</h4>
                <div className="time-grid">
                  {TIME_OPTIONS.map(t => (
                    <button key={t.val}
                      className={`time-btn${timeVal===t.val?' active':''}`}
                      onClick={()=>setTimeVal(t.val)}>
                      {t.label}
                      <small>{t.sub}</small>
                    </button>
                  ))}
                </div>
                <div className="create-actions">
                  <button className="btn btn-red" onClick={()=>startGame('pvai')}>🤖 vs AI</button>
                  <button className="btn btn-blue" onClick={()=>startGame('pvp')}>👥 2 người</button>
                </div>
              </div>

              {/* Online lobby link */}
              <div className="create-card">
                <h4>Chơi Online</h4>
                <p style={{fontSize:'.82rem',color:'var(--muted)',marginBottom:12}}>
                  Tạo phòng hoặc tham gia phòng có sẵn để chơi với người thật.
                </p>
                <button className="btn btn-green" style={{width:'100%'}}
                  onClick={()=>setScreen('online' as any)}>
                  🌐 Vào Lobby Online
                </button>
              </div>
            </div>
          </div>

          {/* ── Col 2: Active games / recent ── */}
          <div className="lobby-col">
            <div className="lobby-col-header">
              <h3>Ván đang diễn ra</h3>
              <span className="badge badge-green">Live</span>
            </div>
            <div className="lobby-col-body">
              <div className="empty-state">
                <div className="empty-icon">♟</div>
                <p>Chưa có ván nào đang diễn ra</p>
                <p style={{fontSize:'.78rem'}}>Tạo ván mới để bắt đầu!</p>
                <button className="btn btn-red" onClick={()=>startGame('pvai')}>Chơi ngay</button>
              </div>
            </div>
          </div>

          {/* ── Col 3: Community chat ── */}
          <div className="lobby-col">
            <div className="lobby-col-header">
              <h3>💬 Chat</h3>
            </div>
            <div className="lobby-col-body" style={{padding:0,display:'flex',flexDirection:'column',height:'100%'}}>
              <div className="lobby-chat">
                <div className="chat-msgs">
                  <div className="chat-msg chat-msg-system">Chào mừng đến với Cờ Tướng!</div>
                  <div className="chat-msg chat-msg-system">Tạo ván hoặc tham gia phòng online để bắt đầu.</div>
                </div>
                <div className="chat-input-area">
                  <input className="chat-input" placeholder="Nhắn tin..." disabled={!user}/>
                  <button className="btn btn-blue btn-sm" disabled={!user}>Gửi</button>
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>

      {showAuth && <AuthModal onClose={u=>{setShowAuth(false);if(u)setUser(u)}}/>}
      {showLb   && <Leaderboard onClose={()=>setShowLb(false)}/>}
    </>
  );

  // ══════════════════════════════════════════════════════
  // ONLINE SCREEN
  // ══════════════════════════════════════════════════════
  if (screen === 'online') {
    if (roomId) return (
      <>
        <Header/>
        <OnlineGame
          roomId={roomId}
          playerId={user?.id ?? `guest_${Math.random().toString(36).slice(2,8)}`}
          playerName={user?.username ?? 'Khách'}
          onLeave={()=>{setRoomId('');setScreen('online')}}
        />
        {showAuth && <AuthModal onClose={u=>{setShowAuth(false);if(u)setUser(u)}}/>}
      </>
    );
    return (
      <>
        <Header/>
        <OnlineLobbyScreen
          user={user}
          onJoin={joinRoom}
          onBack={()=>setScreen('lobby')}
          onNeedAuth={()=>setShowAuth(true)}
        />
        {showAuth && <AuthModal onClose={u=>{setShowAuth(false);if(u)setUser(u)}}/>}
      </>
    );
  }

  // ══════════════════════════════════════════════════════
  // LOCAL GAME SCREEN
  // ══════════════════════════════════════════════════════
  const redCaptured  = state?.capturedRed   ?? [];
  const blackCaptured= state?.capturedBlack ?? [];

  return (
    <>
      <Header/>
      <div className="game-page">
        <div className="game-header">
          <span className="game-header-title">
            {gameMode === 'pvai' ? '🤖 Người vs AI' : '👥 Người vs Người'}
          </span>
          <div className="game-header-right">
            <button className="btn btn-ghost btn-sm"
              onClick={()=>api.getState(state?.gameId??'').then(()=>window.open(`/api/game/${state?.gameId}/pgn`,'_blank')).catch(()=>{})}
              disabled={!state}>
              💾 PGN
            </button>
            <button className="btn btn-ghost btn-sm" onClick={()=>setScreen('lobby')}>← Lobby</button>
          </div>
        </div>

        <div className="game-body">
          {/* ── Board area ── */}
          <div className="board-area">
            {/* Black player panel */}
            <div className={`player-panel${state?.currentTurn==='black'&&state?.status!=='checkmate'?' active':''}${blackTime<=30&&state?.currentTurn==='black'?' urgent':''}`}>
              <div className="pp-avatar black">將</div>
              <div className="pp-name">⚫ ĐEN {gameMode==='pvai'?'(Bạn)':''}</div>
              <div className="pp-captured">
                {blackCaptured.map((p,i)=><span key={i} className="pp-piece">{p.symbol}</span>)}
              </div>
              <div className={`pp-clock black-time${blackTime<=30&&state?.currentTurn==='black'?' urgent':''}`}>
                {fmt(blackTime)}
              </div>
            </div>

            {/* Canvas board */}
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

            {/* Red player panel */}
            <div className={`player-panel${state?.currentTurn==='red'&&state?.status!=='checkmate'?' active':''}${redTime<=30&&state?.currentTurn==='red'?' urgent':''}`}>
              <div className="pp-avatar red">帥</div>
              <div className="pp-name">🔴 ĐỎ {gameMode==='pvai'?'(AI)':''}</div>
              <div className="pp-captured">
                {redCaptured.map((p,i)=><span key={i} className="pp-piece">{p.symbol}</span>)}
              </div>
              <div className={`pp-clock red-time${redTime<=30&&state?.currentTurn==='red'?' urgent':''}`}>
                {fmt(redTime)}
              </div>
            </div>
          </div>

          {/* ── Right panel ── */}
          <div className="game-panel">
            {/* Status */}
            <div className="game-panel-section">
              <div className={`status-badge ${statusCls}`}>{statusText()}</div>
            </div>

            {/* Controls */}
            <div className="game-panel-section">
              <h4>Điều khiển</h4>
              <div className="ctrl-grid">
                <button className="btn btn-ghost" onClick={undo} disabled={loading||!state}>↩ Hoàn tác</button>
                <button className="btn btn-red"   onClick={requestAiMove} disabled={isDisabled}>🤖 AI đi</button>
                <button className="btn btn-gold"  onClick={requestHint}   disabled={loading||hinting||!state||state.status==='checkmate'}>
                  {hinting?'💭...':'💡 Gợi ý'}
                </button>
                <button className="btn btn-blue"  onClick={()=>newGame(gameMode,timeVal)} disabled={loading}>🔄 Ván mới</button>
              </div>
            </div>

            {/* AI depth */}
            {gameMode==='pvai' && (
              <div className="game-panel-section">
                <h4>Độ khó AI</h4>
                <div className="depth-row">
                  <label>Độ sâu: <strong>{aiDepth}</strong></label>
                  <span style={{fontSize:'.72rem',color:'var(--muted)'}}>
                    {aiDepth<=3?'Dễ':aiDepth<=5?'TB':'Khó'}
                  </span>
                </div>
                <input type="range" min={1} max={7} value={aiDepth}
                  onChange={e=>setAiDepth(+e.target.value)}/>
                {nodesInfo!=null && <div className="ai-nodes">🔍 {nodesInfo.toLocaleString()} nút</div>}
              </div>
            )}

            {/* Move history */}
            <div className="game-panel-section" style={{flex:1,overflow:'hidden',display:'flex',flexDirection:'column'}}>
              <h4 style={{cursor:'pointer'}} onClick={()=>setShowHist(v=>!v)}>
                📋 Lịch sử {state?`(${state.moveCount})`:''} {showHist?'▲':'▼'}
              </h4>
              {showHist && state && (
                <div className="history-scroll">
                  <MoveHistory history={state.moveHistory}/>
                </div>
              )}
            </div>

            {error && (
              <div className="game-panel-section">
                <div style={{fontSize:'.78rem',color:'#ff8a80'}}>⚠ {error}</div>
              </div>
            )}

            {/* Guide */}
            <div className="game-panel-section">
              <h4>Chú thích</h4>
              <div style={{fontSize:'.72rem',color:'var(--muted)',lineHeight:1.8}}>
                🟢 Ô có thể đi &nbsp;|&nbsp; 🔴 Ăn quân<br/>
                🟡 Nước vừa đi &nbsp;|&nbsp; 🟣 Gợi ý AI
              </div>
            </div>
          </div>
        </div>
      </div>

      {showAuth && <AuthModal onClose={u=>{setShowAuth(false);if(u)setUser(u)}}/>}
      {showLb   && <Leaderboard onClose={()=>setShowLb(false)}/>}
    </>
  );
}
