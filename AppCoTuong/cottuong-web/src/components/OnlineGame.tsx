import { useState } from 'react';
import Board from './Board';
import MoveHistory from './MoveHistory';
import { useOnlineGame } from '../hooks/useOnlineGame';
import { useClock } from '../hooks/useClock';

interface Props { roomId: string; playerId: string; playerName: string; onLeave: () => void; }

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
    sendChat(chatInput.trim()); setChatInput('');
  };

  const statusText = () => {
    if (!state) return 'Đang kết nối...';
    if (state.status === 'checkmate') return `${state.winner === 'red' ? '🔴 ĐỎ' : '⚫ ĐEN'} THẮNG!`;
    if (state.status === 'check')     return `⚠ ${state.currentTurn === 'red' ? 'ĐỎ' : 'ĐEN'} bị CHIẾU`;
    return `Lượt: ${state.currentTurn === 'red' ? '🔴 ĐỎ' : '⚫ ĐEN'}`;
  };
  const statusCls = state?.status === 'checkmate' ? 'win' : state?.status === 'check' ? 'check' : '';

  return (
    <div className="online-game-screen">
      <div className="online-topbar">
        <span className="badge badge-gray">Phòng: <strong style={{ color: 'var(--red)' }}>{roomId}</strong></span>
        <span className={`badge ${connected ? 'badge-green' : 'badge-red'}`}>
          {connected ? '● Kết nối' : '● Mất kết nối'}
        </span>
        {myColor && (
          <span className="badge badge-red">
            Bạn: {myColor === 'red' ? '🔴 ĐỎ' : '⚫ ĐEN'}
          </span>
        )}
        <button className="btn btn-white btn-sm" style={{ marginLeft: 'auto' }} onClick={onLeave}>
          ← Rời phòng
        </button>
      </div>

      <div className="online-body">
        {/* Board */}
        <div className="board-col">
          <div className={`player-strip${state?.currentTurn === 'black' && state?.status !== 'checkmate' ? ' active' : ''}${blackTime <= 30 && state?.currentTurn === 'black' ? ' urgent' : ''}`}>
            <div className="ps-avatar black">將</div>
            <div className="ps-name">⚫ ĐEN {myColor === 'black' ? '(Bạn)' : ''}</div>
            <div className="ps-captured">
              {(state?.capturedBlack ?? []).map((p, i) => <span key={i} className="ps-piece">{p.symbol}</span>)}
            </div>
            <div className={`ps-clock black-c${blackTime <= 30 && state?.currentTurn === 'black' ? ' urgent' : ''}`}>
              {fmt(blackTime)}
            </div>
          </div>

          <div className="board-wrap">
            {waiting ? (
              <div className="waiting-box">
                <div style={{ fontSize: '2.5rem' }}>⏳</div>
                <h3>Đang chờ người chơi thứ 2...</h3>
                <p>Chia sẻ mã phòng cho bạn bè</p>
                <div className="room-code-big">{roomId}</div>
              </div>
            ) : state ? (
              <Board board={state.board} legalMoves={state.legalMoves} lastMove={state.lastMove}
                selected={selected} hintMove={null} onCellClick={handleCellClick} disabled={isDisabled} />
            ) : (
              <div className="waiting-box"><div style={{ color: '#5c3317' }}>Đang kết nối...</div></div>
            )}
          </div>

          <div className={`player-strip${state?.currentTurn === 'red' && state?.status !== 'checkmate' ? ' active' : ''}${redTime <= 30 && state?.currentTurn === 'red' ? ' urgent' : ''}`}>
            <div className="ps-avatar red">帥</div>
            <div className="ps-name">🔴 ĐỎ {myColor === 'red' ? '(Bạn)' : ''}</div>
            <div className="ps-captured">
              {(state?.capturedRed ?? []).map((p, i) => <span key={i} className="ps-piece">{p.symbol}</span>)}
            </div>
            <div className={`ps-clock red-c${redTime <= 30 && state?.currentTurn === 'red' ? ' urgent' : ''}`}>
              {fmt(redTime)}
            </div>
          </div>
        </div>

        {/* Panel */}
        <div className="online-panel">
          <div className={`status-badge ${statusCls}`}>{statusText()}</div>

          {state && state.moveHistory.length > 0 && (
            <div className="panel-card" style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
              <h4>📋 Lịch sử ({state.moveCount})</h4>
              <div className="history-scroll">
                <MoveHistory history={state.moveHistory} />
              </div>
            </div>
          )}

          {/* Chat */}
          <div className="panel-card" style={{ display: 'flex', flexDirection: 'column', gap: 0, padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border)', fontSize: '.78rem', fontWeight: 700, color: '#555' }}>
              💬 Chat
            </div>
            <div className="chat-msgs" style={{ maxHeight: 160 }}>
              {chat.map((m, i) => (
                <div key={i} className="chat-msg">
                  <span className="chat-name">{m.playerName}</span>
                  <span style={{ color: 'var(--muted)', fontSize: '.7rem', marginRight: 4 }}>{m.time}</span>
                  {m.message}
                </div>
              ))}
            </div>
            <div className="chat-input-row">
              <input className="chat-input" placeholder="Nhắn tin..." value={chatInput}
                onChange={e => setChatInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && sendMsg()} />
              <button className="btn btn-red btn-sm" onClick={sendMsg}>Gửi</button>
            </div>
          </div>

          {error && <div style={{ fontSize: '.78rem', color: 'var(--red)', padding: '8px 12px', background: '#fdf0ee', borderRadius: 8 }}>⚠ {error}</div>}
        </div>
      </div>
    </div>
  );
}
