import { useState } from 'react';
import { authApi, type UserInfo } from '../api/authApi';

interface Props {
  onClose: (user: UserInfo | null) => void;
}

export default function AuthModal({ onClose }: Props) {
  const [tab,      setTab]      = useState<'login' | 'register'>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error,    setError]    = useState('');
  const [loading,  setLoading]  = useState(false);

  const submit = async () => {
    if (!username.trim() || !password.trim()) { setError('Vui lòng điền đầy đủ'); return; }
    setLoading(true); setError('');
    try {
      const fn = tab === 'login' ? authApi.login : authApi.register;
      const res = await fn(username.trim(), password.trim());
      localStorage.setItem('ct_token', res.token);
      localStorage.setItem('ct_user', JSON.stringify(res.user));
      onClose(res.user);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={() => onClose(null)}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <h2>🎮 Tài khoản</h2>
        <div className="modal-tabs">
          <button className={tab === 'login' ? 'active' : ''} onClick={() => setTab('login')}>Đăng nhập</button>
          <button className={tab === 'register' ? 'active' : ''} onClick={() => setTab('register')}>Đăng ký</button>
        </div>
        <input placeholder="Tên đăng nhập" value={username} onChange={e => setUsername(e.target.value)} className="modal-input" />
        <input placeholder="Mật khẩu" type="password" value={password} onChange={e => setPassword(e.target.value)} className="modal-input"
          onKeyDown={e => e.key === 'Enter' && submit()} />
        {error && <div className="modal-error">{error}</div>}
        <div className="modal-actions">
          <button className="btn btn-green" onClick={submit} disabled={loading}>
            {loading ? '...' : tab === 'login' ? 'Đăng nhập' : 'Đăng ký'}
          </button>
          <button className="btn btn-purple" onClick={() => onClose(null)}>Chơi ẩn danh</button>
        </div>
      </div>
    </div>
  );
}
