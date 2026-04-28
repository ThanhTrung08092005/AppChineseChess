import { useEffect, useState } from 'react';
import Board from './components/Board';
import Clock from './components/Clock';
import MoveHistory from './components/MoveHistory';
import CapturedPieces from './components/CapturedPieces';
import { useGame } from './hooks/useGame';
import { useClock } from './hooks/useClock';
import './App.css';

export default function App() {
  const {
    state, selected, loading, hinting, error,
    aiDepth, setAiDepth, nodesInfo, hintMove,
    newGame, handleCellClick, undo, requestAiMove, requestHint,
  } = useGame();

  const { redTime, blackTime } = useClock(state);
  const [showHistory, setShowHistory] = useState(false);
  const [timeOption, setTimeOption]   = useState(600); // giây

  useEffect(() => { newGame('pvai', timeOption); }, []);

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
      {/* ── Header ── */}
      <header className="header">
        <h1>象棋 · Cờ Tướng</h1>
        <div className="header-right">
          <div className="mode-btns">
            <button onClick={() => newGame('pvai', timeOption)} className="btn btn-green">🎮 vs AI</button>
            <button onClick={() => newGame('pvp',  timeOption)} className="btn btn-blue">👥 vs Người</button>
          </div>
          <select
            className="time-select"
            value={timeOption}
            onChange={e => setTimeOption(+e.target.value)}
          >
            <option value={180}>3 phút</option>
            <option value={300}>5 phút</option>
            <option value={600}>10 phút</option>
            <option value={900}>15 phút</option>
            <option value={9999}>Không giới hạn</option>
          </select>
        </div>
      </header>

      <div className="main">
        {/* ── Cột trái: đồng hồ + bàn cờ + quân bị ăn ── */}
        <div className="board-col">

          {/* Đồng hồ Đen (trên) */}
          <Clock time={blackTime} active={state?.currentTurn === 'black' && state?.status !== 'checkmate'} color="black" label="⚫ ĐEN" />

          {/* Quân đen bị ăn */}
          {state && <CapturedPieces pieces={state.capturedBlack} label="Bị ăn" />}

          {/* Bàn cờ */}
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

          {/* Quân đỏ bị ăn */}
          {state && <CapturedPieces pieces={state.capturedRed} label="Bị ăn" />}

          {/* Đồng hồ Đỏ (dưới) */}
          <Clock time={redTime} active={state?.currentTurn === 'red' && state?.status !== 'checkmate'} color="red" label="🔴 ĐỎ" />
        </div>

        {/* ── Sidebar ── */}
        <aside className="sidebar">

          {/* Trạng thái */}
          <div className={`status-box ${statusClass}`}>{statusText()}</div>

          {/* Điều khiển chính */}
          <div className="controls">
            <button onClick={undo}          className="btn btn-purple" disabled={loading || !state}>↩ Hoàn tác</button>
            <button onClick={requestAiMove} className="btn btn-teal"   disabled={isDisabled}>🤖 AI đi</button>
            <button onClick={requestHint}   className="btn btn-orange" disabled={loading || hinting || !state || state.status === 'checkmate'}>
              {hinting ? '💭...' : '💡 Gợi ý'}
            </button>
          </div>

          {/* Độ sâu AI */}
          <div className="depth-control">
            <label>Độ sâu AI: <strong>{aiDepth}</strong>
              <span className="depth-hint"> ({aiDepth <= 3 ? 'Dễ' : aiDepth <= 5 ? 'Trung bình' : 'Khó'})</span>
            </label>
            <input type="range" min={1} max={7} value={aiDepth} onChange={e => setAiDepth(+e.target.value)} />
            <div className="depth-labels"><span>1</span><span>7</span></div>
          </div>

          {/* Thông tin AI */}
          {nodesInfo != null && (
            <div className="ai-info">🔍 {nodesInfo.toLocaleString()} nút đã duyệt</div>
          )}

          {/* Lịch sử nước đi */}
          <div className="history-section">
            <button
              className="history-toggle"
              onClick={() => setShowHistory(v => !v)}
            >
              📋 Lịch sử {state ? `(${state.moveCount})` : ''} {showHistory ? '▲' : '▼'}
            </button>
            {showHistory && state && <MoveHistory history={state.moveHistory} />}
          </div>

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
              <li>Tím = gợi ý AI</li>
            </ul>
          </div>
        </aside>
      </div>
    </div>
  );
}
