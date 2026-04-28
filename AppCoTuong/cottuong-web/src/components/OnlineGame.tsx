import { useState } from 'react';
import Board from './Board';
import MoveHistory from './MoveHistory';
import { useOnlineGame } from '../hooks/useOnlineGame';
import { useClock } from '../hooks/useClock';

interface Props { roomId: string; playerId: string; playerName: string; onLeave: () => void; }

function fmt(s: number) {
  if (s >= 9999) return '∞';
  return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;
}

export default function OnlineGame({ roomId, playerId, playerName, onLeave }: Props) {
  const { state, connected, waiting, error, chat, myColor, selected, handleCellClick, sendChat }
    = useOnlineGame(roomId, playerId, playerName);
  const { redTime, blackTime } = useClock(state);
  const [msg, setMsg] = useState('');

  const send = () => { if (!msg.trim()) return; sendChat(msg.trim()); setMsg(''); };
  const dis  = !state || state.status === 'checkmate' || state.currentTurn !== myColor || !connected;

  const stText = () => {
    if (!state) return 'Đang kết nối...';
    if (state.status === 'checkmate') return `${state.winner === 'red' ? '🔴 ĐỎ' : '⚫ ĐEN'} THẮNG!`;
    if (state.status === 'check')     return `⚠ ${state.currentTurn === 'red' ? 'ĐỎ' : 'ĐEN'} bị CHIẾU`;
    return `Lượt: ${state.currentTurn === 'red' ? '🔴 ĐỎ' : '⚫ ĐEN'}`;
  };
  const stCls = state?.status === 'checkmate' ? 'win' : state?.status === 'check' ? 'check' : '';

  return (
    <div className="og-page">
      <div className="topbar">
        <span className="badge badge-y">Phòng: <strong>{roomId}</strong></span>
        <span className={`badge ${connected ? 'badge-g' : 'badge-r'}`}>{connected ? '● Kết nối' : '● Mất kết nối'}</span>
        {myColor && <span className="badge badge-r">Bạn: {myColor === 'red' ? '🔴 ĐỎ' : '⚫ ĐEN'}</span>}
        <button className="btn btn-white btn-sm" style={{ marginLeft: 'auto' }} onClick={onLeave}>← Rời phòng</button>
      </div>

      <div className="og-body">
        <div className="board-col">
          {/* Black */}
          <div className={`pstrip${state?.currentTurn === 'black' && state?.status !== 'checkmate' ? ' on' : ''}${blackTime <= 30 && state?.currentTurn === 'black' ? ' urg' : ''}`}>
            <div className="pstrip-av b">將</div>
            <div className="pstrip-name">⚫ ĐEN {myColor === 'black' ? '(Bạn)' : ''}</div>
            <div className="pstrip-cap">{(state?.capturedBlack ?? []).map((p, i) => <span key={i} className="pstrip-pc">{p.symbol}</span>)}</div>
            <div className={`pstrip-clk b${blackTime <= 30 && state?.currentTurn === 'black' ? ' urg' : ''}`}>{fmt(blackTime)}</div>
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
                selected={selected} hintMove={null} onCellClick={handleCellClick} disabled={dis} />
            ) : (
              <div className="waiting-box"><div style={{ color: '#5c3317' }}>Đang kết nối...</div></div>
            )}
          </div>

          {/* Red */}
          <div className={`pstrip${state?.currentTurn === 'red' && state?.status !== 'checkmate' ? ' on' : ''}${redTime <= 30 && state?.currentTurn === 'red' ? ' urg' : ''}`}>
            <div className="pstrip-av r">帥</div>
            <div className="pstrip-name">🔴 ĐỎ {myColor === 'red' ? '(Bạn)' : ''}</div>
            <div className="pstrip-cap">{(state?.capturedRed ?? []).map((p, i) => <span key={i} className="pstrip-pc">{p.symbol}</span>)}</div>
            <div className={`pstrip-clk r${redTime <= 30 && state?.currentTurn === 'red' ? ' urg' : ''}`}>{fmt(redTime)}</div>
          </div>
        </div>

        <div className="og-panel">
          <div className={`sbadge ${stCls}`}>{stText()}</div>

          {state && state.moveHistory.length > 0 && (
            <div className="pcard" style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
              <h4>📋 Lịch sử ({state.moveCount})</h4>
              <div className="hscroll"><MoveHistory history={state.moveHistory} /></div>
            </div>
          )}

          <div className="pcard" style={{ padding: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border)', fontSize: '.72rem', fontWeight: 700, color: '#555', textTransform: 'uppercase', letterSpacing: '.5px' }}>
              💬 Chat
            </div>
            <div className="chatmsgs" style={{ maxHeight: 150 }}>
              {chat.map((m, i) => (
                <div key={i} className="chatmsg">
                  <span className="chatname">{m.playerName}</span>
                  <span style={{ color: 'var(--muted)', fontSize: '.68rem', marginRight: 4 }}>{m.time}</span>
                  {m.message}
                </div>
              ))}
            </div>
            <div className="chatrow">
              <input className="chatinput" placeholder="Nhắn tin..." value={msg}
                onChange={e => setMsg(e.target.value)} onKeyDown={e => e.key === 'Enter' && send()} />
              <button className="btn btn-red btn-sm" onClick={send}>Gửi</button>
            </div>
          </div>

          {error && <div style={{ fontSize: '.76rem', color: 'var(--red)', padding: '8px 12px', background: '#fdf0ee', borderRadius: 8 }}>⚠ {error}</div>}
        </div>
      </div>
    </div>
  );
}
