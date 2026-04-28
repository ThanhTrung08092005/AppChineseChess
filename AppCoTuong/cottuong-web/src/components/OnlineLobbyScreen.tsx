import { useState, useEffect, useCallback } from 'react';
import { roomApi } from '../api/authApi';
import type { UserInfo } from '../api/authApi';

interface Room { id: string; hostName: string; timePerSide: number; createdAt: string; isFull: boolean; }
interface Props { user: UserInfo | null; onJoin: (id: string) => void; onBack: () => void; onNeedAuth: () => void; }

const TOPTS = [
  { l: '3+0',  s: '3 phút',  v: 180 },
  { l: '5+0',  s: '5 phút',  v: 300 },
  { l: '10+0', s: '10 phút', v: 600 },
  { l: '15+0', s: '15 phút', v: 900 },
];
const tl = (s: number) => s >= 9999 ? '∞' : `${Math.floor(s / 60)} phút`;
const ta = (iso: string) => { const d = Math.floor((Date.now() - new Date(iso).getTime()) / 1000); return d < 60 ? `${d}s` : `${Math.floor(d / 60)}m`; };

export default function OnlineLobbyScreen({ user, onJoin, onBack, onNeedAuth }: Props) {
  const [rooms,    setRooms]    = useState<Room[]>([]);
  const [ref,      setRef]      = useState(false);
  const [code,     setCode]     = useState('');
  const [tv,       setTv]       = useState(600);
  const [err,      setErr]      = useState('');
  const [creating, setCreating] = useState(false);

  const pid  = user?.id       ?? `guest_${Math.random().toString(36).slice(2, 8)}`;
  const pname= user?.username ?? 'Khách';

  const fetch = useCallback(async (silent = false) => {
    if (!silent) setRef(true);
    try { setRooms(await roomApi.list()); } catch { /* ignore */ }
    finally { setRef(false); }
  }, []);

  useEffect(() => { fetch(); const t = setInterval(() => fetch(true), 5000); return () => clearInterval(t); }, [fetch]);

  const create = async () => {
    if (!user) { onNeedAuth(); return; }
    setCreating(true); setErr('');
    try { const r = await roomApi.create(pid, pname, tv); onJoin(r.id); }
    catch (e: any) { setErr(e.message); }
    finally { setCreating(false); }
  };

  const joinCode = () => {
    const c = code.trim().toUpperCase();
    if (c.length < 4) { setErr('Nhập mã phòng hợp lệ'); return; }
    setErr(''); onJoin(c);
  };

  return (
    <div className="lobby-page">
      <div className="topbar">
        <span className="topbar-title">🌐 Chơi trực tuyến</span>
        <div className="topbar-right">
          <button className="btn btn-white btn-sm" onClick={onBack}>← Quay lại</button>
        </div>
      </div>

      <div className="lobby-body">
        {/* Col 1 */}
        <div className="lcol">
          <div className="lcol-head"><h3>Tạo / Tham gia phòng</h3></div>
          <div className="lcol-body">
            <div className="ccard">
              <h4>Tạo phòng mới</h4>
              <div className="tgrid">
                {TOPTS.map(t => (
                  <button key={t.v} className={`tbtn${tv === t.v ? ' on' : ''}`} onClick={() => setTv(t.v)}>
                    {t.l}<small>{t.s}</small>
                  </button>
                ))}
              </div>
              <div className="cactions">
                <button className="btn btn-red" onClick={create} disabled={creating}>
                  {creating ? '⏳ Đang tạo...' : '🚀 Tạo phòng'}
                </button>
              </div>
              {!user && (
                <p style={{ fontSize: '.73rem', color: 'var(--muted)', marginTop: 8, textAlign: 'center' }}>
                  <button style={{ background: 'none', border: 'none', color: 'var(--red)', cursor: 'pointer', textDecoration: 'underline', fontSize: 'inherit' }}
                    onClick={onNeedAuth}>Đăng nhập</button> để lưu kết quả
                </p>
              )}
            </div>

            <div className="ccard">
              <h4>Vào phòng bằng mã</h4>
              <div style={{ display: 'flex', gap: 8 }}>
                <input className="minput"
                  style={{ flex: 1, textTransform: 'uppercase', letterSpacing: 4, fontFamily: 'monospace', fontSize: '.95rem' }}
                  placeholder="ABC123" value={code}
                  onChange={e => setCode(e.target.value.toUpperCase().slice(0, 6))}
                  onKeyDown={e => e.key === 'Enter' && joinCode()} maxLength={6} />
                <button className="btn btn-red" onClick={joinCode} disabled={code.trim().length < 4}>Vào →</button>
              </div>
            </div>

            {err && <div style={{ fontSize: '.78rem', color: 'var(--red)', padding: '4px 0' }}>⚠ {err}</div>}
          </div>
        </div>

        {/* Col 2 */}
        <div className="lcol">
          <div className="lcol-head">
            <h3>Phòng đang chờ ({rooms.length})</h3>
            <button className="btn btn-white btn-sm" onClick={() => fetch()} style={{ padding: '3px 8px', fontSize: '1rem' }}>
              {ref ? '⏳' : '↻'}
            </button>
          </div>
          <div className="lcol-body">
            {rooms.length === 0 ? (
              <div className="empty">
                <div className="empty-ico">🏠</div>
                <p>Chưa có phòng nào đang chờ</p>
                <p style={{ fontSize: '.76rem' }}>Hãy tạo phòng đầu tiên!</p>
              </div>
            ) : rooms.map(r => (
              <div key={r.id} className="ritem" onClick={() => onJoin(r.id)}>
                <div className="rav">{r.hostName[0]?.toUpperCase() ?? '?'}</div>
                <div className="rinfo">
                  <div className="rhost">{r.hostName}</div>
                  <div className="rmeta">⏱ {tl(r.timePerSide)} · <span style={{ fontFamily: 'monospace', color: 'var(--red)', fontWeight: 700 }}>{r.id}</span> · {ta(r.createdAt)} trước</div>
                </div>
                <button className="rjoin" onClick={e => { e.stopPropagation(); onJoin(r.id); }}>Vào</button>
              </div>
            ))}
          </div>
        </div>

        {/* Col 3: Chat */}
        <div className="lcol">
          <div className="lcol-head"><h3>💬 Chat</h3></div>
          <div className="lcol-body" style={{ padding: 0, display: 'flex', flexDirection: 'column', height: '100%' }}>
            <div className="chatwrap">
              <div className="chatmsgs">
                <div className="chatmsg chatsys">Chào mừng đến Lobby Online!</div>
                <div className="chatmsg chatsys">Tạo phòng hoặc tham gia để bắt đầu.</div>
              </div>
              <div className="chatrow">
                <input className="chatinput" placeholder={user ? 'Nhắn tin...' : 'Đăng nhập để chat'} disabled={!user} />
                <button className="btn btn-red btn-sm" disabled={!user}>Gửi</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
