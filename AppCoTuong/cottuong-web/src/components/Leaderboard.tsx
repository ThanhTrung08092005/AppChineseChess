import { useEffect, useState } from 'react';
import { authApi, type LeaderboardEntry } from '../api/authApi';

export default function Leaderboard({ onClose }: { onClose: () => void }) {
  const [data,    setData]    = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    authApi.leaderboard()
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-wide" onClick={e => e.stopPropagation()}>
        <h2>🏆 Bảng xếp hạng</h2>
        {loading ? <p>Đang tải...</p> : data.length === 0 ? (
          <p style={{ color: '#888', textAlign: 'center', padding: '20px' }}>Chưa có dữ liệu</p>
        ) : (
          <table className="lb-table">
            <thead>
              <tr><th>#</th><th>Tên</th><th>Thắng</th><th>Thua</th><th>Tỉ lệ</th><th>Ván</th></tr>
            </thead>
            <tbody>
              {data.map((u, i) => (
                <tr key={i} className={i < 3 ? 'top-row' : ''}>
                  <td>{i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : i + 1}</td>
                  <td>{u.username}</td>
                  <td style={{ color: '#27AE60' }}>{u.wins}</td>
                  <td style={{ color: '#e74c3c' }}>{u.losses}</td>
                  <td>{u.winRate}%</td>
                  <td>{u.totalGames}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <button className="btn btn-purple" style={{ marginTop: 12 }} onClick={onClose}>Đóng</button>
      </div>
    </div>
  );
}
