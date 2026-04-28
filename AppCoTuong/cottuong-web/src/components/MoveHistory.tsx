import { useEffect, useRef } from 'react';
import type { MoveHistoryDto } from '../api/gameApi';

const COL_NAMES = ['a','b','c','d','e','f','g','h','i'];

function moveLabel(m: MoveHistoryDto) {
  const from = `${COL_NAMES[m.move.fromCol]}${9 - m.move.fromRow}`;
  const to   = `${COL_NAMES[m.move.toCol]}${9 - m.move.toRow}`;
  const cap  = m.captured ? `×${m.captured}` : '';
  const chk  = m.isCheck  ? '+' : '';
  return `${from}-${to}${cap}${chk}`;
}

interface Props {
  history: MoveHistoryDto[];
}

export default function MoveHistory({ history }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [history.length]);

  if (history.length === 0)
    return <div style={{ padding: 12, color: 'var(--muted)', fontSize: '.76rem', textAlign: 'center' }}>Chưa có nước đi</div>;

  // Ghép từng cặp (đỏ + đen) thành 1 hàng
  const pairs: [MoveHistoryDto, MoveHistoryDto | null][] = [];
  for (let i = 0; i < history.length; i += 2)
    pairs.push([history[i], history[i + 1] ?? null]);

  return (
    <>
      <table className="htable">
        <thead>
          <tr><th>#</th><th>🔴 Đỏ</th><th>⚫ Đen</th></tr>
        </thead>
        <tbody>
          {pairs.map(([red, black], i) => (
            <tr key={i}>
              <td className="ht-n">{i + 1}</td>
              <td className={`ht-r${red.isCheck ? ' ht-ck' : ''}`}>{moveLabel(red)}</td>
              <td className={`ht-b${black?.isCheck ? ' ht-ck' : ''}`}>{black ? moveLabel(black) : ''}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div ref={bottomRef} />
    </>
  );
}
