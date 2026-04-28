interface Props {
  time:    number;   // giây
  active:  boolean;
  color:   'red' | 'black';
  label:   string;
}

function fmt(s: number) {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${sec.toString().padStart(2, '0')}`;
}

export default function Clock({ time, active, color, label }: Props) {
  const urgent = time <= 30 && active;
  return (
    <div className={`clock ${active ? 'clock-active' : ''} ${urgent ? 'clock-urgent' : ''} clock-${color}`}>
      <span className="clock-label">{label}</span>
      <span className="clock-time">{fmt(time)}</span>
    </div>
  );
}
