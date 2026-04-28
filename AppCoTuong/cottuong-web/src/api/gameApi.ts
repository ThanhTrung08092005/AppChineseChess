const BASE = import.meta.env.VITE_API_URL ?? '';

export interface CellDto {
  symbol: string | null;
  color:  'red' | 'black' | null;
  type:   string | null;
}

export interface MoveDto {
  fromRow: number; fromCol: number;
  toRow:   number; toCol:   number;
}

export interface MoveHistoryDto {
  number:   number;
  color:    'red' | 'black';
  move:     MoveDto;
  captured: string | null;
  isCheck:  boolean;
}

export interface CapturedDto {
  symbol: string;
  type:   string;
}

export interface GameStateDto {
  gameId:        string;
  currentTurn:   'red' | 'black';
  status:        'playing' | 'check' | 'checkmate' | 'draw';
  winner:        string;
  mode:          string;
  board:         CellDto[][];
  legalMoves:    MoveDto[];
  lastMove:      MoveDto | null;
  moveHistory:   MoveHistoryDto[];
  capturedRed:   CapturedDto[];   // quân đỏ bị ăn
  capturedBlack: CapturedDto[];   // quân đen bị ăn
  redTimeLeft:   number;
  blackTimeLeft: number;
  moveCount:     number;
}

export interface AiMoveDto {
  move:          MoveDto;
  state:         GameStateDto;
  nodesSearched: number;
}

export interface HintDto {
  bestMove:      MoveDto | null;
  nodesSearched: number;
}

async function req<T>(path: string, opts?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...opts,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as any).error ?? `HTTP ${res.status}`);
  }
  return res.json();
}

export const api = {
  newGame:  (mode = 'pvai', timePerSide = 600) =>
    req<GameStateDto>('/api/game/new', { method: 'POST', body: JSON.stringify({ mode, timePerSide }) }),
  getState: (id: string) =>
    req<GameStateDto>(`/api/game/${id}`),
  move:     (id: string, m: MoveDto) =>
    req<GameStateDto>(`/api/game/${id}/move`, { method: 'POST', body: JSON.stringify({ fromRow: m.fromRow, fromCol: m.fromCol, toRow: m.toRow, toCol: m.toCol }) }),
  aiMove:   (id: string, depth = 6) =>
    req<AiMoveDto>(`/api/game/${id}/ai-move?depth=${depth}`, { method: 'POST' }),
  hint:     (id: string, depth = 4) =>
    req<HintDto>(`/api/game/${id}/hint?depth=${depth}`, { method: 'POST' }),
  undo:     (id: string, steps = 2) =>
    req<GameStateDto>(`/api/game/${id}/undo?steps=${steps}`, { method: 'POST' }),
};
