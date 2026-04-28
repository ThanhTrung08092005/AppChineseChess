import { useState } from 'react';
import Board from './Board';
import MoveHistory from './MoveHistory';
import { useOnlineGame } from '../hooks/useOnlineGame';
import { useClock } from '../hooks/useClock';

interface Props {
  roomId:     string;
  playerId:   string;
  playerName: string;
  onLeave:    () => void;
}

function fmt(s: number) {
  if (s >= 9999) return '∞';
  const m = Math.floor(s / 60), sec = s % 60;
  return `${m}:${sec.toString().padStart(2, '0')}`;
}

export default function OnlineGame({ roomId, playerId, playerName, onLeave }: Props) {
  const { state, connected, waiting, error, chat, myColor, selected, handleCellClick, sendChat }
    = useOnlineGame(roomId, playerId, playerName);
  const { redTime, blackTime } = useClock(state);
  const [chatInput, setChatInput] = useState('');

  const isDisabled = !state || state.status === 'checkmate'
    || state.currentTurn !== myColor || !connected;

  const sendMsg = () => {
    if (!chatInput.trim()) return;
    sendChat(chatInput.trim());
    setChatInput('');
  };

  const statusText = () => {
    if (!state) return 'Đang kết nối...';
    if (state.status === 'checkmate') return `${state.winner === 'red' ? '🔴 ĐỎ' : '⚫ ĐEN'} THẮNG!`;
    if (state.status === 'check')     return `⚠ ${state.currentTurn === 'red' ? 'ĐỎ' : 'ĐEN'} bị CHIẾU`;
    return `Lượt: ${state.currentTurn === 'red' ? '🔴 ĐỎ' : '⚫ ĐEN'}`;
  };
  const statusCls = state?.status === 'checkmate' ? 'win' : state?.status === 'check' ? 'check' : '';

  const redCaptured   = state?.capturedRed   ?? [];
  const blackCaptured = state?.capturedBlack ?? [];

  return (
    <div className="online-game-page">
      {/* Header */}
      <div className="game-header">
        <span className="badge badge-gold">Phòng: {roomId}</span>
        <span className={`badge ${connected ? 'badge-green' : 'badge-red'}`}>
          {connected ? '● Kết nối' : '● Mất kết nối'}
        </span>
        {myColor && (
          <span className={`badge ${myColor === 'red' ? 'badge-red' : 'badge-blue'}`}>
            Bạn: {myColor === 'red' ? '🔴 ĐỎ' : '⚫ ĐEN'}
          </span>
        )}
        <button className="btn btn-ghost btn-sm" style={{ marginLeft: 'auto' }} onClick={onLeave}>
          ← Rời phòng
        </button>
      </div>

      <div className="online-body">
        {/* Board column */}
        <div className="online-board-col">
          {/* Black panel */}
          <div className={`player-panel${state?.currentTurn === 'black' && state?.status !== 'checkmate' ? ' active' : ''}${blackTime <= 30 && state?.currentTurn === 'black' ? ' urgent' : ''}`}>
            <div className="pp-avatar black">將</div>
            <div className="pp-name">⚫ ĐEN {myColor === 'black' ? '(Bạn)' : ''}</div>
            <div className="pp-captured">
              {blackCaptured.map((p, i) => <span key={i} className="pp-piece">{p.symbol}</span>)}
            </div>
            <div className={`pp-clock black-time${blackTime <= 30 && state?.currentTurn === 'black' ? ' urgent' : ''}`}>
              {fmt(blackTime)}
            </div>
          </div>

          {/* Board */}
          <div className="board-wrap">
            {waiting ? (
              <div className="waiting-screen">
                <div style={{ fontSize: '2.5rem' }}>⏳</div>
                <h3>Đang chờ người chơi thứ 2...</h3>
                <p>Chia sẻ mã phòng cho bạn bè</p>
                <div className="room-code-display">{roomId}</div>
              </div>
            ) : state ? (
              <Board
                board={state.board}
                legalMoves={state.legalMoves}
                lastMove={state.lastMove}
                selected={selected}
                hintMove={null}
                onCellClick={handleCellClick}
                disabled={isDisabled}
              />
            ) : (
              <div className="waiting-screen">
                <div style={{ fontSize: '1.5rem', color: '#5c3317' }}>Đang kết nối...</div>
              </div>
            )}
          </div>

          {/* Red panel */}
          <div className={`player-panel${state?.currentTurn === 'red' && state?.status !== 'checkmate' ? ' active' : ''}${redTime <= 30 && state?.currentTurn === 'red' ? ' urgent' : ''}`}>
            <div className="pp-avatar red">帥</div>
            <div className="pp-name">🔴 ĐỎ {myColor === 'red' ? '(Bạn)' : ''}</div>
            <div className="pp-captured">
              {redCaptured.map((p, i) => <span key={i} className="pp-piece">{p.symbol}</span>)}
            </div>
            <div className={`pp-clock red-time${redTime <= 30 && state?.currentTurn === 'red' ? ' urgent' : ''}`}>
              {fmt(redTime)}
            </div>
          </div>
        </div>

        {/* Right panel */}
        <div className="online-panel">
          {/* Status */}
          <div className="game-panel-section">
            <div className={`status-badge ${statusCls}`}>{statusText()}</div>
          </div>

          {/* Move history */}
          {state && state.moveHistory.length > 0 && (
            <div className="game-panel-section" style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
              <h4>📋 Lịch sử ({state.moveCount})</h4>
              <div className="history-scroll">
                <MoveHistory history={state.moveHistory} />
              </div>
            </div>
          )}

          {/* Chat */}
          <div className="chat-panel">
            <div style={{ padding: '8px 14px', borderBottom: '1px solid var(--border)', fontSize: '.78rem', color: 'var(--muted)', fontWeight: 600 }}>
              💬 Chat
            </div>
            <div className="chat-panel-msgs">
              {chat.map((m, i) => (
                <div key={i} className="chat-msg">
                  <span className="chat-msg-name">{m.playerName}</span>
                  <span style={{ color: 'var(--muted)', fontSize: '.7rem', marginRight: 4 }}>{m.time}</span>
                  {m.message}
                </div>
              ))}
            </div>
            <div className="chat-panel-input">
              <input
                className="chat-input"
                placeholder="Nhắn tin..."
                value={chatInput}
                onChange={e => setChatInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && sendMsg()}
              />
              <button className="btn btn-blue btn-sm" onClick={sendMsg}>Gửi</button>
            </div>
          </div>

          {error && (
            <div className="game-panel-section">
              <div style={{ fontSize: '.78rem', color: '#ff8a80' }}>⚠ {error}</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
