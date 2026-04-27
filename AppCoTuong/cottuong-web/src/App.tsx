import { useEffect } from 'react';
import Board from './components/Board';
import { useGame } from './hooks/useGame';
import './App.css';

export default function App() {
  const {
    state, selected, loading, error,
    aiDepth, setAiDepth, nodesInfo,
    newGame, handleCellClick, undo, requestAiMove,
  } = useGame();

  // Tự động bắt đầu ván mới khi load
  useEffect(() => { newGame('pvai'); }, []);

  const statusText = () => {
    if (!state) return '';
    if (state.status === 'checkmate')
      return `🏆 ${state.winner === 'red' ? 'ĐỎ' : 'ĐEN'} THẮNG!`;
    if (state.status === 'check')
      return `⚠ ${state.currentTurn === 'red' ? 'ĐỎ' : 'ĐEN'} đang bị CHIẾU!`;
    return `Lượt: ${state.currentTurn === 'red' ? '🔴 ĐỎ' : '⚫ ĐEN'}`;
  };

  const isDisabled = loading
    || !state
    || state.status === 'checkmate'
    || (state.mode === 'pvai' && state.currentTurn === 'black');

  return (
    <div className="app">
      {/* ── Header ── */}
      <header className="header">
        <h1>象棋 · Cờ Tướng</h1>
        <div className="mode-btns">
          <button onClick={() => newGame('pvai')} className="btn btn-green">🎮 Người vs AI</button>
          <button onClick={() => newGame('pvp')}  className="btn btn-blue">👥 Người vs Người</button>
        </div>
      </header>

      <div className="main">
        {/* ── Bàn cờ ── */}
        <div className="board-wrap">
          {state && (
            <Board
              board={state.board}
              legalMoves={state.legalMoves}
              lastMove={state.lastMove}
              selected={selected}
              onCellClick={handleCellClick}
              disabled={isDisabled}
            />
          )}
          {loading && <div className="loading-overlay">AI đang suy nghĩ...</div>}
        </div>

        {/* ── Sidebar ── */}
        <aside className="sidebar">
          {/* Trạng thái */}
          <div className={`status-box ${state?.status === 'checkmate' ? 'win' : state?.status === 'check' ? 'check' : ''}`}>
            {statusText()}
          </div>

          {/* Điều khiển */}
          <div className="controls">
            <button onClick={undo}           className="btn btn-purple" disabled={loading || !state}>↩ Hoàn tác</button>
            <button onClick={requestAiMove}  className="btn btn-teal"   disabled={isDisabled}>🤖 AI đi</button>
          </div>

          {/* Độ sâu AI */}
          <div className="depth-control">
            <label>Độ sâu AI: <strong>{aiDepth}</strong></label>
            <input
              type="range" min={1} max={7} value={aiDepth}
              onChange={e => setAiDepth(+e.target.value)}
            />
            <div className="depth-labels">
              <span>Dễ</span><span>Khó</span>
            </div>
          </div>

          {/* Thông tin AI */}
          {nodesInfo != null && (
            <div className="ai-info">
              🔍 Đã duyệt: <strong>{nodesInfo.toLocaleString()}</strong> nút
            </div>
          )}

          {/* Lỗi */}
          {error && <div className="error-box">⚠ {error}</div>}

          {/* Hướng dẫn */}
          <div className="guide">
            <h3>Hướng dẫn</h3>
            <ul>
              <li>Click quân để chọn</li>
              <li>Chấm xanh = ô có thể đi</li>
              <li>Vòng đỏ = ô có thể ăn quân</li>
              <li>Vàng = nước đi cuối</li>
            </ul>
          </div>
        </aside>
      </div>
    </div>
  );
}
