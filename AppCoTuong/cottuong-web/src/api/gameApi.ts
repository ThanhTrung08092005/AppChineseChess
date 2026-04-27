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

export interface GameStateDto {
  gameId:      string;
  currentTurn: 'red' | 'black';
  status:      'playing' | 'check' | 'checkmate' | 'draw';
  winner:      string;
  mode:        string;
  board:       CellDto[][];
  legalMoves:  MoveDto[];
  lastMove:    MoveDto | null;
}

export interface AiMoveDto {
  move:          MoveDto;
  state:         GameStateDto;
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
  newGame:  (mode = 'pvai')                  => req<GameStateDto>('/api/game/new', { method: 'POST', body: JSON.stringify({ mode }) }),
  getState: (id: string)                     => req<GameStateDto>(`/api/game/${id}`),
  move:     (id: string, m: MoveDto)         => req<GameStateDto>(`/api/game/${id}/move`, { method: 'POST', body: JSON.stringify({ fromRow: m.fromRow, fromCol: m.fromCol, toRow: m.toRow, toCol: m.toCol }) }),
  aiMove:   (id: string, depth = 5)          => req<AiMoveDto>(`/api/game/${id}/ai-move?depth=${depth}`, { method: 'POST' }),
  undo:     (id: string, steps = 2)          => req<GameStateDto>(`/api/game/${id}/undo?steps=${steps}`, { method: 'POST' }),
};
