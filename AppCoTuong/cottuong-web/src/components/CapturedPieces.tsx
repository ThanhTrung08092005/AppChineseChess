import type { CapturedDto } from '../api/gameApi';

interface Props {
  pieces: CapturedDto[];
  label:  string;
}

export default function CapturedPieces({ pieces, label }: Props) {
  if (pieces.length === 0) return null;
  return (
    <div className="captured">
      <span className="captured-label">{label}:</span>
      <span className="captured-pieces">
        {pieces.map((p, i) => (
          <span key={i} className="captured-piece" title={p.type}>{p.symbol}</span>
        ))}
      </span>
    </div>
  );
}
