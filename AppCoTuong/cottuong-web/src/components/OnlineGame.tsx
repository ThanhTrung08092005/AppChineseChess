import { useState } from 'react';
import Board from './Board';
import Clock from './Clock';
import MoveHistory from './MoveHistory';
import CapturedPieces from './CapturedPieces';
import { useOnlineGame } from '../hooks/useOnlineGame';
import { useClock } from '../hooks/useClock';

interface Props {
  roomId:     string;
  playerId:   string;
  playerName: string;
  onLeave:    () => void;
}

export default function OnlineGame({ roomId, playerId, playerName, onLeave }: Props) {
  const { state, connected, error, chat, myColor, selected, handleCellClick, sendChat }
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

  return (
    <div className="online-game">
      {/* Header */}
      <div className="online-header">
        <span className="room-badge">Phòng: <strong>{roomId}</strong></span>
        <span className={`conn-badge ${connected ? 'connected' : 'disconnected'}`}>
          {connected ? '🟢 Kết nối' : '🔴 Mất kết nối'}
        </span>
        {myColor && <span className="color-badge">Bạn: {myColor === 'red' ? '🔴 ĐỎ' : '⚫ ĐEN'}</span>}
        <button className="btn btn-red" style={{ marginLeft: 'auto' }} onClick={onLeave}>← Rời phòng</button>
      </div>

      <div className="online-body">
        {/* Bàn cờ */}
        <div className="board-col">
          <Clock time={blackTime} active={state?.currentTurn === 'black' && state?.status !== 'checkmate'} color="black" label="⚫ ĐEN" />
          {state && <CapturedPieces pieces={state.capturedBlack} label="Bị ăn" />}
          <div className="board-wrap">
            {state ? (
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
              <div className="waiting-msg">⏳ Đang chờ người chơi thứ 2...</div>
            )}
          </div>
          {state && <CapturedPieces pieces={state.capturedRed} label="Bị ăn" />}
          <Clock time={redTime} active={state?.currentTurn === 'red' && state?.status !== 'checkmate'} color="red" label="🔴 ĐỎ" />
        </div>

        {/* Sidebar */}
        <div className="online-sidebar">
          {/* Trạng thái */}
          {state && (
            <div className={`status-box ${state.status === 'checkmate' ? 'win' : state.status === 'check' ? 'check' : ''}`}>
              {state.status === 'checkmate'
                ? `🏆 ${state.winner === 'red' ? 'ĐỎ' : 'ĐEN'} THẮNG!`
                : state.status === 'check'
                ? `⚠ ${state.currentTurn === 'red' ? 'ĐỎ' : 'ĐEN'} bị CHIẾU!`
                : `Lượt: ${state.currentTurn === 'red' ? '🔴 ĐỎ' : '⚫ ĐEN'}`}
            </div>
          )}

          {/* Lịch sử */}
          {state && state.moveHistory.length > 0 && (
            <div style={{ flex: 1, minHeight: 0 }}>
              <MoveHistory history={state.moveHistory} />
            </div>
          )}

          {/* Chat */}
          <div className="chat-box">
            <div className="chat-messages">
              {chat.map((m, i) => (
                <div key={i} className="chat-msg">
                  <span className="chat-time">{m.time}</span>
                  <span className="chat-name">{m.playerName}:</span>
                  <span>{m.message}</span>
                </div>
              ))}
            </div>
            <div className="chat-input-row">
              <input
                className="modal-input" style={{ flex: 1, margin: 0 }}
                placeholder="Nhắn tin..."
                value={chatInput}
                onChange={e => setChatInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && sendMsg()}
              />
              <button className="btn btn-blue" style={{ padding: '6px 12px' }} onClick={sendMsg}>Gửi</button>
            </div>
          </div>

          {error && <div className="error-box">⚠ {error}</div>}
        </div>
      </div>
    </div>
  );
}
