import { useState, useEffect, useCallback } from 'react';
import { roomApi } from '../api/authApi';
import type { UserInfo } from '../api/authApi';

interface Room { id: string; hostName: string; timePerSide: number; createdAt: string; isFull: boolean; }
interface Props { user: UserInfo | null; onJoin: (id: string) => void; onBack: () => void; onNeedAuth: () => void; }

const TIME_OPTIONS = [
  { label: '3+0',  sub: '3 phút',  val: 180 },
  { label: '5+0',  sub: '5 phút',  val: 300 },
  { label: '10+0', sub: '10 phút', val: 600 },
  { label: '15+0', sub: '15 phút', val: 900 },
];

function timeLabel(s: number) { return s >= 9999 ? '∞' : `${Math.floor(s / 60)} phút`; }
function timeAgo(iso: string) {
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  return d < 60 ? `${d}s` : `${Math.floor(d / 60)}m`;
}

export default function OnlineLobbyScreen({ user, onJoin, onBack, onNeedAuth }: Props) {
  const [rooms,      setRooms]      = useState<Room[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [joinCode,   setJoinCode]   = useState('');
  const [timeOption, setTimeOption] = useState(600);
  const [error,      setError]      = useState('');
  const [creating,   setCreating]   = useState(false);

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
    try { const r = await roomApi.create(playerId, playerName, timeOption); onJoin(r.id); }
    catch (e: any) { setError(e.message); }
    finally { setCreating(false); }
  };

  const joinByCode = () => {
    const code = joinCode.trim().toUpperCase();
    if (code.length < 4) { setError('Nhập mã phòng hợp lệ'); return; }
    setError(''); onJoin(code);
  };

  return (
    <div className="lobby-screen">
      <div className="lobby-topbar">
        <h2>🌐 Chơi trực tuyến</h2>
        <div className="lobby-topbar-right">
          <button className="btn btn-white btn-sm" onClick={onBack}>← Quay lại</button>
        </div>
      </div>

      <div className="lobby-body">
        {/* Col 1: Create + Join */}
        <div className="lobby-col">
          <div className="lobby-col-head"><h3>Tạo / Tham gia phòng</h3></div>
          <div className="lobby-col-body">
            <div className="create-card">
              <h4>Tạo phòng mới</h4>
              <div className="time-grid">
                {TIME_OPTIONS.map(t => (
                  <button key={t.val} className={`time-btn${timeOption === t.val ? ' active' : ''}`}
                    onClick={() => setTimeOption(t.val)}>
                    {t.label}<small>{t.sub}</small>
                  </button>
                ))}
              </div>
              <button className="btn btn-red" style={{ width: '100%' }}
                onClick={createRoom} disabled={creating}>
                {creating ? '⏳ Đang tạo...' : '🚀 Tạo phòng'}
              </button>
              {!user && (
                <p style={{ fontSize: '.75rem', color: 'var(--muted)', marginTop: 8, textAlign: 'center' }}>
                  <button style={{ background: 'none', border: 'none', color: 'var(--red)', cursor: 'pointer', fontSize: 'inherit', textDecoration: 'underline' }}
                    onClick={onNeedAuth}>Đăng nhập</button> để lưu kết quả
                </p>
              )}
            </div>

            <div className="create-card">
              <h4>Vào phòng bằng mã</h4>
              <div style={{ display: 'flex', gap: 8 }}>
                <input className="modal-input"
                  style={{ flex: 1, textTransform: 'uppercase', letterSpacing: 4, fontFamily: 'monospace', fontSize: '1rem' }}
                  placeholder="ABC123" value={joinCode}
                  onChange={e => setJoinCode(e.target.value.toUpperCase().slice(0, 6))}
                  onKeyDown={e => e.key === 'Enter' && joinByCode()} maxLength={6} />
                <button className="btn btn-red" onClick={joinByCode} disabled={joinCode.trim().length < 4}>Vào →</button>
              </div>
            </div>

            {error && <div style={{ fontSize: '.8rem', color: 'var(--red)', padding: '4px 0' }}>⚠ {error}</div>}
          </div>
        </div>

        {/* Col 2: Room list */}
        <div className="lobby-col">
          <div className="lobby-col-head">
            <h3>Phòng đang chờ ({rooms.length})</h3>
            <button className="btn btn-white btn-sm" onClick={() => fetchRooms()}
              style={{ fontSize: '1rem', padding: '3px 8px' }}>
              {refreshing ? '⏳' : '↻'}
            </button>
          </div>
          <div className="lobby-col-body">
            {rooms.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">🏠</div>
                <p>Chưa có phòng nào đang chờ</p>
                <p style={{ fontSize: '.78rem' }}>Hãy tạo phòng đầu tiên!</p>
              </div>
            ) : rooms.map(r => (
              <div key={r.id} className="room-item" onClick={() => onJoin(r.id)}>
                <div className="room-avatar">{r.hostName[0]?.toUpperCase() ?? '?'}</div>
                <div className="room-info">
                  <div className="room-host">{r.hostName}</div>
                  <div className="room-meta">
                    ⏱ {timeLabel(r.timePerSide)} &nbsp;·&nbsp;
                    <span style={{ fontFamily: 'monospace', color: 'var(--red)', fontWeight: 700 }}>{r.id}</span>
                    &nbsp;·&nbsp; {timeAgo(r.createdAt)} trước
                  </div>
                </div>
                <button className="room-join" onClick={e => { e.stopPropagation(); onJoin(r.id); }}>Vào</button>
              </div>
            ))}
          </div>
        </div>

        {/* Col 3: Chat */}
        <div className="lobby-col">
          <div className="lobby-col-head"><h3>💬 Chat</h3></div>
          <div className="lobby-col-body" style={{ padding: 0, display: 'flex', flexDirection: 'column', height: '100%' }}>
            <div className="chat-wrap">
              <div className="chat-msgs">
                <div className="chat-msg chat-sys">Chào mừng đến Lobby Online!</div>
                <div className="chat-msg chat-sys">Tạo phòng hoặc tham gia để bắt đầu.</div>
              </div>
              <div className="chat-input-row">
                <input className="chat-input" placeholder={user ? 'Nhắn tin...' : 'Đăng nhập để chat'} disabled={!user} />
                <button className="btn btn-red btn-sm" disabled={!user}>Gửi</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
