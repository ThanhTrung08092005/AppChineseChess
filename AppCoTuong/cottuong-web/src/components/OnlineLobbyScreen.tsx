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

export default function OnlineLobbyScreen({ user, onJoin, onBack, onNeedAuth }: Props) {
  const [rooms,      setRooms]      = useState<Room[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [joinCode,   setJoinCode]   = useState('');
  const [timeOption, setTimeOption] = useState(600);
  const [error,      setError]      = useState('');
  const [creating,   setCreating]   = useState(false);

  const playerId   = user?.id       ?? `guest_${Math.random().toString(36).slice(2,8)}`;
  const playerName = user?.username ?? 'Khách';

  const fetchRooms = useCallback(async (silent = false) => {
    if (!silent) setRefreshing(true);
    try {
      const list = await roomApi.list();
      setRooms(list);
    } catch { /* ignore */ }
    finally { setRefreshing(false); }
  }, []);

  // Auto-refresh mỗi 5 giây
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

  const timeLabel = (s: number) => {
    if (s >= 9999) return '∞';
    return `${Math.floor(s / 60)} phút`;
  };

  const timeAgo = (iso: string) => {
    const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
    if (diff < 60) return `${diff}s trước`;
    return `${Math.floor(diff / 60)}m trước`;
  };

  return (
    <div className="lobby-screen">
      {/* ── Header ── */}
      <header className="lobby-header">
        <button className="btn btn-ghost" onClick={onBack}>
          ← Quay lại
        </button>
        <div className="lobby-title">
          <span className="lobby-title-icon">🌐</span>
          <span>Chơi Online</span>
        </div>
        {user ? (
          <span className="lobby-user">👤 {user.username}</span>
        ) : (
          <button className="btn btn-orange btn-sm" onClick={onNeedAuth}>Đăng nhập</button>
        )}
      </header>

      <div className="lobby-body">

        {/* ── Cột trái: Tạo phòng + Nhập mã ── */}
        <div className="lobby-left">

          {/* Card tạo phòng */}
          <div className="lobby-card">
            <div className="lobby-card-header">
              <span className="lobby-card-icon">➕</span>
              <h2>Tạo phòng mới</h2>
            </div>
            <p className="lobby-card-desc">
              Tạo phòng và chia sẻ mã cho bạn bè để chơi cùng
            </p>

            <div className="lobby-form-row">
              <label>Thời gian mỗi bên</label>
              <div className="time-options">
                {[180, 300, 600, 900, 9999].map(t => (
                  <button
                    key={t}
                    className={`time-chip ${timeOption === t ? 'active' : ''}`}
                    onClick={() => setTimeOption(t)}
                  >
                    {timeLabel(t)}
                  </button>
                ))}
              </div>
            </div>

            <button
              className="btn btn-green lobby-create-btn"
              onClick={createRoom}
              disabled={creating}
            >
              {creating ? '⏳ Đang tạo...' : '🚀 Tạo phòng'}
            </button>

            {!user && (
              <p className="lobby-note">
                💡 <button className="link-btn" onClick={onNeedAuth}>Đăng nhập</button> để lưu kết quả vào bảng xếp hạng
              </p>
            )}
          </div>

          {/* Card nhập mã */}
          <div className="lobby-card">
            <div className="lobby-card-header">
              <span className="lobby-card-icon">🔑</span>
              <h2>Vào phòng bằng mã</h2>
            </div>
            <p className="lobby-card-desc">
              Nhập mã 6 ký tự do bạn bè chia sẻ
            </p>

            <div className="lobby-code-row">
              <input
                className="lobby-code-input"
                placeholder="ABC123"
                value={joinCode}
                onChange={e => setJoinCode(e.target.value.toUpperCase().slice(0, 6))}
                onKeyDown={e => e.key === 'Enter' && joinByCode()}
                maxLength={6}
                spellCheck={false}
              />
              <button
                className="btn btn-blue"
                onClick={joinByCode}
                disabled={joinCode.trim().length < 4}
              >
                Vào →
              </button>
            </div>
          </div>

          {error && <div className="error-box">{error}</div>}
        </div>

        {/* ── Cột phải: Danh sách phòng ── */}
        <div className="lobby-right">
          <div className="lobby-card lobby-rooms-card">
            <div className="lobby-card-header">
              <span className="lobby-card-icon">🏠</span>
              <h2>Phòng đang chờ</h2>
              <button
                className={`refresh-btn ${refreshing ? 'spinning' : ''}`}
                onClick={() => fetchRooms()}
                title="Làm mới"
              >↻</button>
            </div>

            {rooms.length === 0 ? (
              <div className="lobby-empty">
                <div className="lobby-empty-icon">🎭</div>
                <p>Chưa có phòng nào đang chờ</p>
                <p className="lobby-empty-sub">Hãy tạo phòng và mời bạn bè!</p>
              </div>
            ) : (
              <div className="room-grid">
                {rooms.map(r => (
                  <div key={r.id} className="room-card">
                    <div className="room-card-top">
                      <span className="room-card-host">👤 {r.hostName}</span>
                      <span className="room-card-badge">Chờ đối thủ</span>
                    </div>
                    <div className="room-card-info">
                      <span>⏱ {timeLabel(r.timePerSide)}</span>
                      <span className="room-card-code">{r.id}</span>
                      <span className="room-card-time">{timeAgo(r.createdAt)}</span>
                    </div>
                    <button
                      className="btn btn-teal room-card-join"
                      onClick={() => onJoin(r.id)}
                    >
                      Tham gia →
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
