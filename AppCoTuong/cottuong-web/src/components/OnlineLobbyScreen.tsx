import { useState, useEffect, useCallback } from 'react';
import { roomApi } from '../api/authApi';
import type { UserInfo } from '../api/authApi';

interface Room {
  id:          string;
  hostName:    string;
  timePerSide: number;
  createdAt:   string;
  isFull:      boolean;
}

interface Props {
  user:       UserInfo | null;
  onJoin:     (roomId: string) => void;
  onBack:     () => void;
  onNeedAuth: () => void;
}

const TIME_OPTIONS = [
  { label: '3+0',  val: 180 },
  { label: '5+0',  val: 300 },
  { label: '10+0', val: 600 },
  { label: '15+0', val: 900 },
];

function timeLabel(s: number) {
  if (s >= 9999) return '∞';
  return `${Math.floor(s / 60)} phút`;
}

function timeAgo(iso: string) {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60) return `${diff}s`;
  return `${Math.floor(diff / 60)}m`;
}

export default function OnlineLobbyScreen({ user, onJoin, onBack, onNeedAuth }: Props) {
  const [rooms,      setRooms]      = useState<Room[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [joinCode,   setJoinCode]   = useState('');
  const [timeOption, setTimeOption] = useState(600);
  const [error,      setError]      = useState('');
  const [creating,   setCreating]   = useState(false);
  const [chat,       setChat]       = useState<string[]>(['Chào mừng đến Lobby Online!']);

  const playerId   = user?.id       ?? `guest_${Math.random().toString(36).slice(2, 8)}`;
  const playerName = user?.username ?? 'Khách';

  const fetchRooms = useCallback(async (silent = false) => {
    if (!silent) setRefreshing(true);
    try { setRooms(await roomApi.list()); } catch { /* ignore */ }
    finally { setRefreshing(false); }
  }, []);

  useEffect(() => {
    fetchRooms();
    const t = setInterval(() => fetchRooms(true), 5000);
    return () => clearInterval(t);
  }, [fetchRooms]);

  const createRoom = async () => {
    if (!user) { onNeedAuth(); return; }
    setCreating(true); setError('');
    try {
      const room = await roomApi.create(playerId, playerName, timeOption);
      onJoin(room.id);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setCreating(false);
    }
  };

  const joinByCode = () => {
    const code = joinCode.trim().toUpperCase();
    if (code.length < 4) { setError('Nhập mã phòng hợp lệ'); return; }
    setError('');
    onJoin(code);
  };

  return (
    <div className="lobby-page">
      {/* Quick-play bar */}
      <div className="quickplay-bar">
        <h2>🌐 Lobby Online</h2>
        <div className="qp-times">
          {TIME_OPTIONS.map(t => (
            <button key={t.val}
              className={`qp-chip${timeOption === t.val ? ' active' : ''}`}
              onClick={() => setTimeOption(t.val)}>
              {t.label}
            </button>
          ))}
        </div>
        <button className="qp-play-btn" onClick={createRoom} disabled={creating}>
          {creating ? '⏳' : '+ Tạo phòng'}
        </button>
      </div>

      <div className="lobby-body">
        {/* ── Col 1: Create + Join by code ── */}
        <div className="lobby-col">
          <div className="lobby-col-header">
            <h3>Tạo / Tham gia</h3>
            <button className="btn btn-ghost btn-sm" onClick={onBack}>← Quay lại</button>
          </div>
          <div className="lobby-col-body">
            {/* Create room */}
            <div className="create-card">
              <h4>Tạo phòng mới</h4>
              <div className="time-grid">
                {TIME_OPTIONS.map(t => (
                  <button key={t.val}
                    className={`time-btn${timeOption === t.val ? ' active' : ''}`}
                    onClick={() => setTimeOption(t.val)}>
                    {t.label}
                    <small>{timeLabel(t.val)}</small>
                  </button>
                ))}
              </div>
              <button className="btn btn-red" style={{ width: '100%' }}
                onClick={createRoom} disabled={creating}>
                {creating ? '⏳ Đang tạo...' : '🚀 Tạo phòng'}
              </button>
              {!user && (
                <p style={{ fontSize: '.75rem', color: 'var(--muted)', marginTop: 8, textAlign: 'center' }}>
                  <button style={{ background: 'none', border: 'none', color: 'var(--gold)', cursor: 'pointer', fontSize: 'inherit' }}
                    onClick={onNeedAuth}>Đăng nhập</button>
                  {' '}để lưu kết quả
                </p>
              )}
            </div>

            {/* Join by code */}
            <div className="create-card">
              <h4>Vào phòng bằng mã</h4>
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  className="modal-input"
                  style={{ flex: 1, textTransform: 'uppercase', letterSpacing: 4, fontFamily: 'monospace', fontSize: '1rem' }}
                  placeholder="ABC123"
                  value={joinCode}
                  onChange={e => setJoinCode(e.target.value.toUpperCase().slice(0, 6))}
                  onKeyDown={e => e.key === 'Enter' && joinByCode()}
                  maxLength={6}
                />
                <button className="btn btn-blue" onClick={joinByCode}
                  disabled={joinCode.trim().length < 4}>
                  Vào →
                </button>
              </div>
            </div>

            {error && <div style={{ fontSize: '.8rem', color: '#ff8a80', padding: '4px 0' }}>⚠ {error}</div>}
          </div>
        </div>

        {/* ── Col 2: Room list ── */}
        <div className="lobby-col">
          <div className="lobby-col-header">
            <h3>Phòng đang chờ ({rooms.length})</h3>
            <button
              className={`btn btn-ghost btn-sm${refreshing ? ' spinning' : ''}`}
              onClick={() => fetchRooms()}
              style={{ fontSize: '1rem', padding: '4px 8px' }}>
              ↻
            </button>
          </div>
          <div className="lobby-col-body">
            {rooms.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">🏠</div>
                <p>Chưa có phòng nào</p>
                <p style={{ fontSize: '.78rem' }}>Hãy tạo phòng đầu tiên!</p>
              </div>
            ) : (
              <div className="games-grid">
                {rooms.map(r => (
                  <div key={r.id} className="challenge-item" onClick={() => onJoin(r.id)}>
                    <div className="ch-avatar" style={{ background: 'var(--bg3)' }}>
                      {r.hostName[0]?.toUpperCase() ?? '?'}
                    </div>
                    <div className="ch-info">
                      <div className="ch-name">{r.hostName}</div>
                      <div className="ch-meta">
                        ⏱ {timeLabel(r.timePerSide)} &nbsp;·&nbsp;
                        <span style={{ fontFamily: 'monospace', color: 'var(--gold)' }}>{r.id}</span>
                        &nbsp;·&nbsp; {timeAgo(r.createdAt)} trước
                      </div>
                    </div>
                    <button className="ch-join-btn" onClick={e => { e.stopPropagation(); onJoin(r.id); }}>
                      Vào
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── Col 3: Chat ── */}
        <div className="lobby-col">
          <div className="lobby-col-header">
            <h3>💬 Chat</h3>
          </div>
          <div className="lobby-col-body" style={{ padding: 0, display: 'flex', flexDirection: 'column', height: '100%' }}>
            <div className="lobby-chat">
              <div className="chat-msgs">
                {chat.map((m, i) => (
                  <div key={i} className="chat-msg chat-msg-system">{m}</div>
                ))}
              </div>
              <div className="chat-input-area">
                <input className="chat-input" placeholder="Nhắn tin..." disabled={!user}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && (e.target as HTMLInputElement).value.trim()) {
                      setChat(prev => [...prev.slice(-49), `${playerName}: ${(e.target as HTMLInputElement).value.trim()}`]);
                      (e.target as HTMLInputElement).value = '';
                    }
                  }} />
                <button className="btn btn-blue btn-sm" disabled={!user}>Gửi</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
