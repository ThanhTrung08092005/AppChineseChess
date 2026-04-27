import { useState, useCallback } from 'react';
import { api, type GameStateDto, type MoveDto } from '../api/gameApi';

export type GameMode = 'pvai' | 'pvp';

export function useGame() {
  const [state,    setState]    = useState<GameStateDto | null>(null);
  const [selected, setSelected] = useState<[number, number] | null>(null);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState<string | null>(null);
  const [aiDepth,  setAiDepth]  = useState(5);
  const [nodesInfo, setNodesInfo] = useState<number | null>(null);

  const wrap = async (fn: () => Promise<void>) => {
    setLoading(true); setError(null);
    try { await fn(); }
    catch (e: any) { setError(e.message ?? 'Lỗi không xác định'); }
    finally { setLoading(false); }
  };

  const newGame = useCallback((mode: GameMode = 'pvai') => wrap(async () => {
    const s = await api.newGame(mode);
    setState(s); setSelected(null); setNodesInfo(null);
  }), []);

  const handleCellClick = useCallback((row: number, col: number) => {
    if (!state || loading) return;
    if (state.status === 'checkmate') return;

    const cell = state.board[row]?.[col];

    // Nếu chưa chọn quân
    if (!selected) {
      if (cell?.color === state.currentTurn) {
        setSelected([row, col]);
      }
      return;
    }

    // Kiểm tra nước đi hợp lệ
    const move: MoveDto = { fromRow: selected[0], fromCol: selected[1], toRow: row, toCol: col };
    const isLegal = state.legalMoves.some(
      m => m.fromRow === move.fromRow && m.fromCol === move.fromCol &&
           m.toRow   === move.toRow   && m.toCol   === move.toCol
    );

    if (isLegal) {
      setSelected(null);
      wrap(async () => {
        const newState = await api.move(state.gameId, move);
        setState(newState);

        // Nếu pvai và đến lượt AI
        if (newState.mode === 'pvai' && newState.currentTurn === 'black'
            && newState.status !== 'checkmate') {
          const aiRes = await api.aiMove(newState.gameId, aiDepth);
          setState(aiRes.state);
          setNodesInfo(aiRes.nodesSearched);
        }
      });
    } else if (cell?.color === state.currentTurn) {
      // Chọn lại quân khác
      setSelected([row, col]);
    } else {
      setSelected(null);
    }
  }, [state, selected, loading, aiDepth]);

  const undo = useCallback(() => {
    if (!state) return;
    wrap(async () => {
      const steps = state.mode === 'pvai' ? 2 : 1;
      const s = await api.undo(state.gameId, steps);
      setState(s); setSelected(null);
    });
  }, [state]);

  const requestAiMove = useCallback(() => {
    if (!state || loading) return;
    wrap(async () => {
      const res = await api.aiMove(state.gameId, aiDepth);
      setState(res.state);
      setNodesInfo(res.nodesSearched);
    });
  }, [state, loading, aiDepth]);

  return {
    state, selected, loading, error,
    aiDepth, setAiDepth,
    nodesInfo,
    newGame, handleCellClick, undo, requestAiMove,
  };
}
