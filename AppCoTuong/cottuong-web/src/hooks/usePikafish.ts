/**
 * usePikafish — Pikafish WASM hook
 *
 * Chạy Pikafish engine hoàn toàn trên browser qua Web Worker + WASM.
 * Không cần server. Tải file WASM từ CDN lần đầu (~6MB), sau đó cache.
 *
 * Cách dùng:
 *   const { ready, analyze, stop } = usePikafish();
 *   const result = await analyze(fen, { timeMs: 3000, multiPv: 5 });
 */

import { useEffect, useRef, useState, useCallback } from 'react';

export interface PikafishLine {
  depth:  number;
  score:  number;
  isMate: boolean;
  mateIn: number;
  nodes:  number;
  nps:    number;
  timeMs: number;
  pvLine: string;
  multipv: number;
}

export interface PikafishResult {
  bestMove:  string;   // UCCI format e.g. "b2e2"
  ponder:    string;
  lines:     PikafishLine[];
  depth:     number;
  score:     number;
  isMate:    boolean;
  mateIn:    number;
  nodes:     number;
  nps:       number;
}

// ── Worker script (inline blob) ──────────────────────────────────────────────
// Pikafish WASM được load từ CDN (pikafish.org cung cấp public WASM build)
// Fallback: dùng Stockfish WASM nếu Pikafish WASM chưa có public CDN
const WORKER_SCRIPT = `
// Pikafish WASM Worker
// Load engine từ CDN
const PIKAFISH_JS_URL = 'https://cdn.jsdelivr.net/npm/pikafish-wasm@latest/pikafish.js';
const STOCKFISH_JS_URL = 'https://cdn.jsdelivr.net/npm/stockfish.wasm@0.10.0/stockfish.js';

let engine = null;
let engineReady = false;
let resolveReady = null;
const readyPromise = new Promise(r => { resolveReady = r; });

// Thử load Pikafish WASM, fallback về Stockfish nếu fail
async function loadEngine() {
  // Thử Pikafish WASM trước
  try {
    importScripts(PIKAFISH_JS_URL);
    engine = await Pikafish();
    engine.addMessageListener(onMessage);
    engine.postMessage('ucci');
    return 'pikafish';
  } catch(e) {
    // Fallback: dùng Stockfish (UCI, không phải UCCI — chỉ để test)
    try {
      importScripts(STOCKFISH_JS_URL);
      engine = STOCKFISH();
      engine.onmessage = (e) => onMessage(typeof e === 'string' ? e : e.data);
      engine.postMessage('uci');
      return 'stockfish-fallback';
    } catch(e2) {
      self.postMessage({ type: 'error', msg: 'Cannot load engine: ' + e2.message });
      return null;
    }
  }
}

function onMessage(line) {
  if (typeof line !== 'string') return;
  self.postMessage({ type: 'raw', line });

  if (line === 'ucciok' || line === 'uciok' || line.startsWith('id name')) {
    engineReady = true;
    resolveReady();
    self.postMessage({ type: 'ready' });
  }
}

loadEngine().then(name => {
  self.postMessage({ type: 'engine', name });
});

self.onmessage = async (e) => {
  const { cmd, fen, timeMs, multiPv, depth } = e.data;
  if (cmd === 'analyze') {
    await readyPromise;
    if (!engine) return;
    engine.postMessage('setoption name MultiPV value ' + (multiPv || 1));
    engine.postMessage('position fen ' + fen);
    if (depth) {
      engine.postMessage('go depth ' + depth);
    } else {
      engine.postMessage('go movetime ' + (timeMs || 2000));
    }
  } else if (cmd === 'stop') {
    if (engine) engine.postMessage('stop');
  } else if (cmd === 'quit') {
    if (engine) engine.postMessage('quit');
  }
};
`;

// ── Parse UCCI/UCI info line ──────────────────────────────────────────────────
function parseInfoLine(line: string): Partial<PikafishLine> | null {
  if (!line.startsWith('info')) return null;
  const tokens = line.split(' ');
  const r: Partial<PikafishLine> = {};
  for (let i = 0; i < tokens.length - 1; i++) {
    switch (tokens[i]) {
      case 'depth':   r.depth  = +tokens[i+1]; break;
      case 'multipv': r.multipv = +tokens[i+1]; break;
      case 'nodes':   r.nodes  = +tokens[i+1]; break;
      case 'nps':     r.nps    = +tokens[i+1]; break;
      case 'time':    r.timeMs = +tokens[i+1]; break;
      case 'cp':      r.score  = +tokens[i+1]; r.isMate = false; break;
      case 'mate':
        r.isMate = true; r.mateIn = +tokens[i+1];
        r.score  = r.mateIn > 0 ? 100000 : -100000;
        break;
      case 'pv':
        r.pvLine = tokens.slice(i+1).join(' ');
        break;
    }
  }
  return r;
}

// ── Hook ──────────────────────────────────────────────────────────────────────
export function usePikafish() {
  const [ready,      setReady]      = useState(false);
  const [engineName, setEngineName] = useState('');
  const [analyzing,  setAnalyzing]  = useState(false);

  const workerRef  = useRef<Worker | null>(null);
  const resolveRef = useRef<((r: PikafishResult) => void) | null>(null);
  const linesRef   = useRef<Map<number, PikafishLine>>(new Map());

  // Khởi tạo worker
  useEffect(() => {
    const blob   = new Blob([WORKER_SCRIPT], { type: 'application/javascript' });
    const url    = URL.createObjectURL(blob);
    const worker = new Worker(url);

    worker.onmessage = (e) => {
      const { type, line, name } = e.data;

      if (type === 'ready') {
        setReady(true);
      } else if (type === 'engine') {
        setEngineName(name ?? 'unknown');
      } else if (type === 'raw' && line) {
        // Parse info lines
        if (line.startsWith('info') && line.includes('depth')) {
          const parsed = parseInfoLine(line);
          if (parsed?.depth) {
            const pvIdx = parsed.multipv ?? 1;
            const existing = linesRef.current.get(pvIdx * 1000 + (parsed.depth ?? 0));
            const merged: PikafishLine = {
              depth:   parsed.depth   ?? existing?.depth   ?? 0,
              score:   parsed.score   ?? existing?.score   ?? 0,
              isMate:  parsed.isMate  ?? existing?.isMate  ?? false,
              mateIn:  parsed.mateIn  ?? existing?.mateIn  ?? 0,
              nodes:   parsed.nodes   ?? existing?.nodes   ?? 0,
              nps:     parsed.nps     ?? existing?.nps     ?? 0,
              timeMs:  parsed.timeMs  ?? existing?.timeMs  ?? 0,
              pvLine:  parsed.pvLine  ?? existing?.pvLine  ?? '',
              multipv: pvIdx,
            };
            linesRef.current.set(pvIdx * 1000 + merged.depth, merged);
          }
        }

        // bestmove → kết thúc phân tích
        if (line.startsWith('bestmove')) {
          const parts  = line.split(' ');
          const bm     = parts[1] ?? '';
          const ponder = parts[3] ?? '';

          // Gom tất cả lines, lấy line sâu nhất cho mỗi multipv
          const byPv = new Map<number, PikafishLine>();
          for (const l of linesRef.current.values()) {
            const existing = byPv.get(l.multipv);
            if (!existing || l.depth > existing.depth) byPv.set(l.multipv, l);
          }
          const sortedLines = [...byPv.values()].sort((a, b) => a.multipv - b.multipv);
          const best = sortedLines[0];

          const result: PikafishResult = {
            bestMove:  bm,
            ponder,
            lines:     sortedLines,
            depth:     best?.depth  ?? 0,
            score:     best?.score  ?? 0,
            isMate:    best?.isMate ?? false,
            mateIn:    best?.mateIn ?? 0,
            nodes:     best?.nodes  ?? 0,
            nps:       best?.nps    ?? 0,
          };

          setAnalyzing(false);
          resolveRef.current?.(result);
          resolveRef.current = null;
        }
      }
    };

    workerRef.current = worker;
    return () => {
      worker.postMessage({ cmd: 'quit' });
      worker.terminate();
      URL.revokeObjectURL(url);
    };
  }, []);

  // Phân tích một FEN
  const analyze = useCallback((
    fen: string,
    opts: { timeMs?: number; multiPv?: number; depth?: number } = {}
  ): Promise<PikafishResult> => {
    return new Promise((resolve) => {
      linesRef.current.clear();
      resolveRef.current = resolve;
      setAnalyzing(true);
      workerRef.current?.postMessage({
        cmd:     'analyze',
        fen,
        timeMs:  opts.timeMs  ?? 3000,
        multiPv: opts.multiPv ?? 5,
        depth:   opts.depth,
      });
    });
  }, []);

  const stop = useCallback(() => {
    workerRef.current?.postMessage({ cmd: 'stop' });
  }, []);

  return { ready, engineName, analyzing, analyze, stop };
}
