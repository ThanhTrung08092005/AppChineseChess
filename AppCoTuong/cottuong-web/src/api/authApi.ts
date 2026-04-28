const BASE = import.meta.env.VITE_API_URL ?? '';

export interface UserInfo {
  id:      string;
  username: string;
  wins:    number;
  losses:  number;
  winRate: number;
}

export interface LeaderboardEntry {
  username:   string;
  wins:       number;
  losses:     number;
  draws:      number;
  winRate:    number;
  totalGames: number;
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

export const authApi = {
  register: (username: string, password: string) =>
    req<{ token: string; user: UserInfo }>('/api/auth/register', {
      method: 'POST', body: JSON.stringify({ username, password })
    }),
  login: (username: string, password: string) =>
    req<{ token: string; user: UserInfo }>('/api/auth/login', {
      method: 'POST', body: JSON.stringify({ username, password })
    }),
  leaderboard: () =>
    req<LeaderboardEntry[]>('/api/auth/leaderboard'),
};

export const roomApi = {
  list: () =>
    req<any[]>('/api/room'),
  create: (playerId: string, playerName: string, timePerSide = 600) =>
    req<any>('/api/room', { method: 'POST', body: JSON.stringify({ playerId, playerName, timePerSide }) }),
  get: (id: string) =>
    req<any>(`/api/room/${id}`),
};
