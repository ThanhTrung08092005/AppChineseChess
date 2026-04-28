import { useState, useEffect } from 'react';
import { roomApi } from '../api/authApi';

interface Props {
  playerId:   string;
  playerName: string;
  onJoin:     (roomId: string) => void;
  onClose:    () => void;
}

export default function RoomLobby({ playerId, playerName, onJoin, onClose }: Props) {
  const [rooms,      setRooms]      = useState<any[]>([]);
  const [loading,    setLoading]    = useState(false);
  const [joinCode,   setJoinCode]   = useState('');
  const [timeOption, setTimeOption] = useState(600);

  const refresh = () => {
    roomApi.list().then(setRooms).catch(console.error);
  };

  useEffect(() => { refresh(); }, []);

  const createRoom = async () => {
    setLoading(true);
    try {
      const room = await roomApi.create(playerId, playerName, timeOption);
      onJoin(room.id);
    } catch (e: any) {
      alert(e.message);
    } finally {
      setLoading(false);
    }
  };

  const joinByCode = () => {
    if (joinCode.trim().length < 4) { alert('Nhập mã phòng'); return; }
    onJoin(joinCode.trim().toUpperCase());
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-wide" onClick={e => e.stopPropagation()}>
        <h2>🌐 Chơi Online</h2>

        {/* Tạo phòng */}
        <div className="lobby-section">
          <h3>Tạo phòng mới</h3>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <select className="time-select" value={timeOption} onChange={e => setTimeOption(+e.target.value)}>
              <option value={180}>3 phút</option>
              <option value={300}>5 phút</option>
              <option value={600}>10 phút</option>
              <option value={900}>15 phút</option>
            </select>
            <button className="btn btn-green" onClick={createRoom} disabled={loading}>
              {loading ? '...' : '+ Tạo phòng'}
            </button>
          </div>
        </div>

        {/* Nhập mã phòng */}
        <div className="lobby-section">
          <h3>Vào phòng bằng mã</h3>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              className="modal-input" style={{ flex: 1, textTransform: 'uppercase' }}
              placeholder="Mã phòng (VD: ABC123)"
              value={joinCode} onChange={e => setJoinCode(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && joinByCode()}
            />
            <button className="btn btn-blue" onClick={joinByCode}>Vào</button>
          </div>
        </div>

        {/* Danh sách phòng */}
        <div className="lobby-section">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3>Phòng đang chờ ({rooms.length})</h3>
            <button className="btn btn-teal" style={{ padding: '4px 10px', fontSize: '0.8rem' }} onClick={refresh}>↻</button>
          </div>
          {rooms.length === 0 ? (
            <p style={{ color: '#888', fontSize: '0.85rem' }}>Không có phòng nào đang chờ</p>
          ) : (
            <div className="room-list">
              {rooms.map(r => (
                <div key={r.id} className="room-item">
                  <span className="room-host">{r.hostName}</span>
                  <span className="room-time">{Math.floor(r.timePerSide / 60)} phút</span>
                  <span className="room-code">{r.id}</span>
                  <button className="btn btn-green" style={{ padding: '4px 12px', fontSize: '0.82rem' }}
                    onClick={() => onJoin(r.id)}>Vào</button>
                </div>
              ))}
            </div>
          )}
        </div>

        <button className="btn btn-purple" onClick={onClose}>Đóng</button>
      </div>
    </div>
  );
}
