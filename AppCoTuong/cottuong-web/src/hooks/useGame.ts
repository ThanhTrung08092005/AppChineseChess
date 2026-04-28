import { useState, useCallback, useRef } from 'react';
import { api, type GameStateDto, type MoveDto } from '../api/gameApi';
import { useSound } from './useSound';

export type GameMode = 'pvai' | 'pvp';

export function useGame() {
  const [state,     setState]     = useState<GameStateDto | null>(null);
  const [selected,  setSelected]  = useState<[number, number] | null>(null);
  const [loading,   setLoading]   = useState(false);
  const [hinting,   setHinting]   = useState(false);
  const [error,     setError]     = useState<string | null>(null);
  const [aiDepth,   setAiDepth]   = useState(6);
  const [nodesInfo, setNodesInfo] = useState<number | null>(null);
  const [hintMove,  setHintMove]  = useState<MoveDto | null>(null);

  const prevStatusRef = useRef<string>('');
  const sound = useSound();

  const wrap = async (fn: () => Promise<void>) => {
    setLoading(true); setError(null);
    try { await fn(); }
    catch (e: any) { setError(e.message ?? 'Lỗi không xác định'); }
    finally { setLoading(false); }
  };

  const applyState = useCallback((s: GameStateDto, capturedSymbol?: string | null) => {
    // Âm thanh
    if (s.status === 'checkmate' && prevStatusRef.current !== 'checkmate') {
      s.winner === 'red' ? sound.playWin() : sound.playLose();
    } else if (s.status === 'check') {
      sound.playCheck();
    } else if (capturedSymbol) {
      sound.playCapture();
    } else {
      sound.playMove();
    }
    prevStatusRef.current = s.status;
    setState(s);
    setHintMove(null);
  }, [sound]);

  const newGame = useCallback((mode: GameMode = 'pvai', timePerSide = 600) => wrap(async () => {
    const s = await api.newGame(mode, timePerSide);
    prevStatusRef.current = '';
    setState(s); setSelected(null); setNodesInfo(null); setHintMove(null);
  }), []);

  const handleCellClick = useCallback((row: number, col: number) => {
    if (!state || loading) return;
    if (state.status === 'checkmate') return;
    if (state.mode === 'pvai' && state.currentTurn === 'black') return;

    const cell = state.board[row]?.[col];

    if (!selected) {
      if (cell?.color === state.currentTurn)
        setSelected([row, col]);
      return;
    }

    const move: MoveDto = { fromRow: selected[0], fromCol: selected[1], toRow: row, toCol: col };
    const isLegal = state.legalMoves.some(
      m => m.fromRow === move.fromRow && m.fromCol === move.fromCol &&
           m.toRow   === move.toRow   && m.toCol   === move.toCol
    );

    if (isLegal) {
      setSelected(null);
      const captured = state.board[row]?.[col]?.symbol ?? null;
      wrap(async () => {
        const newState = await api.move(state.gameId, move);
        applyState(newState, captured);

        if (newState.mode === 'pvai' && newState.currentTurn === 'black'
            && newState.status !== 'checkmate') {
          const aiRes = await api.aiMove(newState.gameId, aiDepth);
          const aiCaptured = aiRes.move
            ? state.board[aiRes.move.toRow]?.[aiRes.move.toCol]?.symbol ?? null
            : null;
          applyState(aiRes.state, aiCaptured);
          setNodesInfo(aiRes.nodesSearched);
        }
      });
    } else if (cell?.color === state.currentTurn) {
      setSelected([row, col]);
    } else {
      setSelected(null);
    }
  }, [state, selected, loading, aiDepth, applyState]);

  const undo = useCallback(() => {
    if (!state) return;
    wrap(async () => {
      const steps = state.mode === 'pvai' ? 2 : 1;
      const s = await api.undo(state.gameId, steps);
      setState(s); setSelected(null); setHintMove(null);
    });
  }, [state]);

  const requestAiMove = useCallback(() => {
    if (!state || loading) return;
    wrap(async () => {
      const res = await api.aiMove(state.gameId, aiDepth);
      const captured = res.move
        ? state.board[res.move.toRow]?.[res.move.toCol]?.symbol ?? null
        : null;
      applyState(res.state, captured);
      setNodesInfo(res.nodesSearched);
    });
  }, [state, loading, aiDepth, applyState]);

  const requestHint = useCallback(() => {
    if (!state || loading || hinting) return;
    setHinting(true);
    api.hint(state.gameId, Math.min(aiDepth, 4))
      .then(h => { setHintMove(h.bestMove); setNodesInfo(h.nodesSearched); })
      .catch(e => setError(e.message))
      .finally(() => setHinting(false));
  }, [state, loading, hinting, aiDepth]);

  return {
    state, selected, loading, hinting, error,
    aiDepth, setAiDepth,
    nodesInfo, hintMove,
    newGame, handleCellClick, undo, requestAiMove, requestHint,
  };
}
