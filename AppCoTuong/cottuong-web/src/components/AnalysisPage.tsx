import { useState, useCallback, useRef, useEffect } from "react";
import Board, { type ArrowDef } from "./Board";
import ScoreGraph, { type ScorePoint } from "./ScoreGraph";
import type { CellDto, MoveDto } from "../api/gameApi";
import { usePikafish } from "../hooks/usePikafish";

// ── Types ─────────────────────────────────────────────────────────────────────
interface InfoLine { depth:number; score:number; isMate:boolean; mateIn:number; nodes:number; nps:number; timeMs:number; pvLine:string; }
interface AnalysisResult {
  bestMove:string; bestMoveCoord:{fromRow:number;fromCol:number;toRow:number;toCol:number}|null;
  score:number; isMate:boolean; mateIn:number; depth:number; nodes:number; nps:number;
  pvLine:string; engine:string; lines:InfoLine[];
  pvLines?:PVLine[]; multiPvCount?:number; openingName?:string; bookMoves?:BookMove[];
}
interface PVLine { rank:number; bestMove:string; bestMoveCoord:{fromRow:number;fromCol:number;toRow:number;toCol:number}|null; score:number; isMate:boolean; mateIn:number; depth:number; nodes:number; nps:number; pvLine:string; inBook:boolean; bookName?:string; }
interface BookMove { ucci:string; name:string; nameVi:string; weight:number; }
interface HistEntry { fen:string; move:MoveDto|null; score?:number; isMate?:boolean; label?:string; }

// ── FEN helpers ───────────────────────────────────────────────────────────────
const START_FEN = "rnbakabnr/9/1c5c1/p1p1p1p1p/9/9/P1P1P1P1P/1C5C1/9/RNBAKABNR w - - 0 1";
const FEN_MAP: Record<string,{color:"red"|"black";symbol:string;type:string}> = {
  K:{color:"red",symbol:"帥",type:"general"},A:{color:"red",symbol:"仕",type:"advisor"},
  B:{color:"red",symbol:"相",type:"elephant"},N:{color:"red",symbol:"傌",type:"horse"},
  R:{color:"red",symbol:"俥",type:"chariot"},C:{color:"red",symbol:"炮",type:"cannon"},
  P:{color:"red",symbol:"兵",type:"soldier"},
  k:{color:"black",symbol:"將",type:"general"},a:{color:"black",symbol:"士",type:"advisor"},
  b:{color:"black",symbol:"象",type:"elephant"},n:{color:"black",symbol:"馬",type:"horse"},
  r:{color:"black",symbol:"車",type:"chariot"},c:{color:"black",symbol:"砲",type:"cannon"},
  p:{color:"black",symbol:"卒",type:"soldier"},
};
const SYM_TO_FEN: Record<string,string> = {
  "帥":"K","仕":"A","相":"B","傌":"N","俥":"R","炮":"C","兵":"P",
  "將":"k","士":"a","象":"b","馬":"n","車":"r","砲":"c","卒":"p",
};
function fenToBoard(fen:string):CellDto[][] {
  return fen.split(" ")[0].split("/").map(row=>{
    const cells:CellDto[]=[];
    for(const ch of row){
      if(/\d/.test(ch)){for(let i=0;i<+ch;i++)cells.push({symbol:null,color:null,type:null});}
      else{const p=FEN_MAP[ch];cells.push(p?{symbol:p.symbol,color:p.color,type:p.type}:{symbol:null,color:null,type:null});}
    }
    return cells;
  });
}
function boardToFen(board:CellDto[][],turn:"red"|"black"):string {
  const rows=board.map(row=>{let s="",e=0;for(const c of row){if(!c.symbol)e++;else{if(e){s+=e;e=0;}s+=SYM_TO_FEN[c.symbol]??"?";}};if(e)s+=e;return s;});
  return `${rows.join("/")} ${turn==="red"?"w":"b"} - - 0 1`;
}
function fenTurn(fen:string):"red"|"black"{return fen.split(" ")[1]==="b"?"black":"red";}
function parseUcci(mv:string):MoveDto|null{
  if(!mv||mv.length<4)return null;
  try{return{fromCol:mv[0].charCodeAt(0)-97,fromRow:9-+mv[1],toCol:mv[2].charCodeAt(0)-97,toRow:9-+mv[3]};}
  catch{return null;}
}
function fmtScore(score:number,isMate:boolean,mateIn:number):string{
  if(isMate)return mateIn>0?`M${mateIn}`:`M${Math.abs(mateIn)}`;
  const v=score/100;return(v>0?"+":"")+v.toFixed(2);
}
function fmtNodes(n:number):string{
  if(n>=1_000_000)return`${(n/1_000_000).toFixed(1)}M`;
  if(n>=1_000)return`${(n/1_000).toFixed(0)}K`;
  return`${n}`;
}
function fmtTime(ms:number):string{return ms>=1000?`${(ms/1000).toFixed(1)}s`:`${ms}ms`;}
function scoreColor(score:number,isMate:boolean,mateIn:number):string{
  if(isMate)return mateIn>0?"#27ae60":"#e74c3c";
  if(score>50)return"#27ae60";if(score<-50)return"#e74c3c";return"#888";
}

// ── Server analyze (fallback khi WASM chưa sẵn sàng) ─────────────────────────
async function serverAnalyze(fen:string,timeMs:number,multiPV:number):Promise<AnalysisResult>{
  const base=import.meta.env.VITE_API_URL??"";
  const res=await fetch(`${base}/api/analyze`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({fen,timeMs,multiPV})});
  if(!res.ok){const err=await res.json().catch(()=>({}));throw new Error((err as any).error??`HTTP ${res.status}`);}
  return res.json();
}

export default function AnalysisPage() {
  const [fen,         setFen]         = useState(START_FEN);
  const [fenInput,    setFenInput]    = useState(START_FEN);
  const [board,       setBoard]       = useState<CellDto[][]>(()=>fenToBoard(START_FEN));
  const [result,      setResult]      = useState<AnalysisResult|null>(null);
  const [loading,     setLoading]     = useState(false);
  const [error,       setError]       = useState("");
  const [timeMs,      setTimeMs]      = useState(3000);
  const [selLine,     setSelLine]     = useState<InfoLine|null>(null);
  const [selected,    setSelected]    = useState<[number,number]|null>(null);
  const [legalMoves,  setLegalMoves]  = useState<MoveDto[]>([]);
  const [lastMove,    setLastMove]    = useState<MoveDto|null>(null);
  const [currentTurn, setCurrentTurn] = useState<"red"|"black">(fenTurn(START_FEN));
  const [arrows,      setArrows]      = useState<ArrowDef[]>([]);
  const [flipped,     setFlipped]     = useState(false);
  const [activeTab,   setActiveTab]   = useState<"book"|"moves"|"graph">("book");
  const [history,     setHistory]     = useState<HistEntry[]>([{fen:START_FEN,move:null}]);
  const [histIdx,     setHistIdx]     = useState(0);
  const [useWasm,     setUseWasm]     = useState(true);
  const [multiPv,     setMultiPv]     = useState(5);
  const analyzing = useRef(false);

  // Pikafish WASM
  const pikafish = usePikafish();

  // Auto-analyze khi WASM sẵn sàng
  useEffect(() => {
    if (pikafish.ready && useWasm) {
      // Không auto-analyze, chờ user nhấn
    }
  }, [pikafish.ready]);

  // ── Phân tích ──────────────────────────────────────────────────────────────
  const analyze = useCallback(async (fenStr: string) => {
    if (analyzing.current) return;
    analyzing.current = true;
    setLoading(true); setError(""); setSelLine(null);
    try {
      let r: AnalysisResult;

      if (useWasm && pikafish.ready) {
        // Dùng Pikafish WASM (chạy trên browser)
        const wasmResult = await pikafish.analyze(fenStr, { timeMs, multiPv });
        // Convert sang AnalysisResult format
        const bm = parseUcci(wasmResult.bestMove);
        r = {
          bestMove:      wasmResult.bestMove,
          bestMoveCoord: bm ? { fromRow: bm.fromRow, fromCol: bm.fromCol, toRow: bm.toRow, toCol: bm.toCol } : null,
          score:         wasmResult.score,
          isMate:        wasmResult.isMate,
          mateIn:        wasmResult.mateIn,
          depth:         wasmResult.depth,
          nodes:         wasmResult.nodes,
          nps:           wasmResult.nps,
          pvLine:        wasmResult.lines[0]?.pvLine ?? "",
          engine:        pikafish.engineName || "pikafish-wasm",
          lines:         wasmResult.lines.filter(l => l.multipv === 1).map(l => ({
            depth: l.depth, score: l.score, isMate: l.isMate, mateIn: l.mateIn,
            nodes: l.nodes, nps: l.nps, timeMs: l.timeMs, pvLine: l.pvLine,
          })),
          pvLines: wasmResult.lines
            .filter((l, i, arr) => arr.findIndex(x => x.multipv === l.multipv) === i)
            .map((l, i) => {
              const mv = parseUcci(l.pvLine.split(" ")[0]);
              return {
                rank: i + 1, bestMove: l.pvLine.split(" ")[0],
                bestMoveCoord: mv ? { fromRow: mv.fromRow, fromCol: mv.fromCol, toRow: mv.toRow, toCol: mv.toCol } : null,
                score: l.score, isMate: l.isMate, mateIn: l.mateIn,
                depth: l.depth, nodes: l.nodes, nps: l.nps, pvLine: l.pvLine,
                inBook: false,
              };
            }),
          multiPvCount: multiPv,
        };
      } else {
        // Fallback: server API
        r = await serverAnalyze(fenStr, timeMs, multiPv);
      }

      setResult(r);

      // Cập nhật score vào history
      setHistory(prev => {
        const next = [...prev];
        if (next[histIdx]) {
          next[histIdx] = { ...next[histIdx], score: r.score, isMate: r.isMate };
        }
        return next;
      });

      // Vẽ mũi tên bestmove (đỏ) + ponder (xanh)
      const newArrows: ArrowDef[] = [];
      const bm = parseUcci(r.bestMove);
      if (bm) newArrows.push({ ...bm, color: "rgba(231,76,60,0.85)" });
      const pvArr = r.pvLine.split(" ").filter(Boolean);
      if (pvArr[1]) { const pm = parseUcci(pvArr[1]); if (pm) newArrows.push({ ...pm, color: "rgba(33,150,243,0.75)" }); }
      setArrows(newArrows);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
      analyzing.current = false;
    }
  }, [timeMs, multiPv, useWasm, pikafish, histIdx]);

  // ── Load FEN ───────────────────────────────────────────────────────────────
  const loadFen = (f: string) => {
    try {
      const b = fenToBoard(f);
      setFen(f); setBoard(b); setResult(null); setArrows([]);
      setError(""); setSelLine(null); setSelected(null); setLegalMoves([]);
      setLastMove(null); setCurrentTurn(fenTurn(f));
      setHistory([{ fen: f, move: null }]); setHistIdx(0);
      setFenInput(f);
    } catch { setError("FEN không hợp lệ"); }
  };

  // ── PGN Import ─────────────────────────────────────────────────────────────
  const importPgn = (pgn: string) => {
    // Parse PGN đơn giản: lấy các nước đi dạng UCCI
    const moves = pgn.match(/[a-i][0-9][a-i][0-9]/g) ?? [];
    if (moves.length === 0) { setError("Không tìm thấy nước đi trong PGN"); return; }
    let curFen = START_FEN;
    let curBoard = fenToBoard(curFen);
    let curTurn: "red" | "black" = "red";
    const newHistory: HistEntry[] = [{ fen: curFen, move: null }];
    for (const mv of moves) {
      const m = parseUcci(mv);
      if (!m) continue;
      const newBoard = curBoard.map(r => r.map(c => ({ ...c })));
      newBoard[m.toRow][m.toCol] = newBoard[m.fromRow][m.fromCol];
      newBoard[m.fromRow][m.fromCol] = { symbol: null, color: null, type: null };
      curTurn = curTurn === "red" ? "black" : "red";
      curFen = boardToFen(newBoard, curTurn);
      newHistory.push({ fen: curFen, move: m, label: mv });
      curBoard = newBoard;
    }
    setHistory(newHistory);
    const last = newHistory[newHistory.length - 1];
    setHistIdx(newHistory.length - 1);
    setFen(last.fen); setFenInput(last.fen);
    setBoard(fenToBoard(last.fen)); setCurrentTurn(fenTurn(last.fen));
    setLastMove(last.move); setResult(null); setArrows([]);
  };

  // ── PGN Export ─────────────────────────────────────────────────────────────
  const exportPgn = () => {
    const moves = history.slice(1).map((h, i) => {
      const num = Math.floor(i / 2) + 1;
      const prefix = i % 2 === 0 ? `${num}. ` : "";
      return `${prefix}${h.label ?? "?"}`;
    }).join(" ");
    const pgn = `[Event "Phân tích"]\n[Date "${new Date().toISOString().slice(0,10)}"]\n\n${moves}`;
    const blob = new Blob([pgn], { type: "text/plain" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href = url; a.download = "analysis.pgn"; a.click();
    URL.revokeObjectURL(url);
  };

  // ── Click bàn cờ ──────────────────────────────────────────────────────────
  const handleCellClick = useCallback((rowRaw: number, colRaw: number) => {
    const row = flipped ? 9 - rowRaw : rowRaw;
    const col = flipped ? 8 - colRaw : colRaw;
    const cell = board[row]?.[col];
    if (!selected) {
      if (cell?.color === currentTurn) {
        setSelected([row, col]);
        const moves: MoveDto[] = [];
        for (let r = 0; r < 10; r++)
          for (let c = 0; c < 9; c++)
            if (!(r === row && c === col) && board[r]?.[c]?.color !== currentTurn)
              moves.push({ fromRow: row, fromCol: col, toRow: r, toCol: c });
        setLegalMoves(moves);
      }
      return;
    }
    const [fr, fc] = selected;
    if (fr === row && fc === col) { setSelected(null); setLegalMoves([]); return; }
    if (cell?.color === currentTurn) {
      setSelected([row, col]);
      const moves: MoveDto[] = [];
      for (let r = 0; r < 10; r++)
        for (let c = 0; c < 9; c++)
          if (!(r === row && c === col) && board[r]?.[c]?.color !== currentTurn)
            moves.push({ fromRow: row, fromCol: col, toRow: r, toCol: c });
      setLegalMoves(moves); return;
    }
    const newBoard = board.map(r => r.map(c => ({ ...c })));
    newBoard[row][col] = newBoard[fr][fc];
    newBoard[fr][fc] = { symbol: null, color: null, type: null };
    const mv: MoveDto = { fromRow: fr, fromCol: fc, toRow: row, toCol: col };
    const nextTurn = currentTurn === "red" ? "black" : "red";
    const newFen = boardToFen(newBoard, nextTurn);
    const ucciLabel = `${String.fromCharCode(97+fc)}${9-fr}${String.fromCharCode(97+col)}${9-row}`;
    setBoard(newBoard); setLastMove(mv); setSelected(null); setLegalMoves([]);
    setCurrentTurn(nextTurn); setResult(null); setArrows([]);
    setFen(newFen); setFenInput(newFen);
    const newHist = [...history.slice(0, histIdx + 1), { fen: newFen, move: mv, label: ucciLabel }];
    setHistory(newHist); setHistIdx(newHist.length - 1);
  }, [board, selected, currentTurn, history, histIdx, flipped]);

  // ── Điều hướng lịch sử ────────────────────────────────────────────────────
  const goHist = useCallback((idx: number) => {
    const h = history[idx];
    if (!h) return;
    setHistIdx(idx); setFen(h.fen); setBoard(fenToBoard(h.fen));
    setCurrentTurn(fenTurn(h.fen)); setLastMove(h.move);
    setResult(null); setArrows([]); setSelected(null); setLegalMoves([]);
    setFenInput(h.fen);
  }, [history]);

  // Keyboard navigation
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft")  goHist(Math.max(0, histIdx - 1));
      if (e.key === "ArrowRight") goHist(Math.min(history.length - 1, histIdx + 1));
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [histIdx, history.length, goHist]);

  // ── Score graph data ───────────────────────────────────────────────────────
  const scorePoints: ScorePoint[] = history.map((h, i) => ({
    moveNum: i,
    color:   i % 2 === 0 ? "red" : "black",
    score:   h.score ?? 0,
    isMate:  h.isMate ?? false,
    label:   h.label ?? "start",
  }));

  const lines      = result?.lines ?? [];
  const activeLine = selLine ?? lines[lines.length - 1] ?? null;
  const pvMoves    = activeLine?.pvLine.split(" ").filter(Boolean) ?? [];

  // Flip board display
  const displayBoard = flipped
    ? [...board].reverse().map(row => [...row].reverse())
    : board;
  const displayLegal = legalMoves.map(m => flipped
    ? { fromRow: 9-m.fromRow, fromCol: 8-m.fromCol, toRow: 9-m.toRow, toCol: 8-m.toCol }
    : m);
  const displayLast = lastMove && flipped
    ? { fromRow: 9-lastMove.fromRow, fromCol: 8-lastMove.fromCol, toRow: 9-lastMove.toRow, toCol: 8-lastMove.toCol }
    : lastMove;
  const displaySelected = selected && flipped
    ? [9-selected[0], 8-selected[1]] as [number,number]
    : selected;
  const displayArrows = arrows.map(a => flipped
    ? { ...a, fromRow: 9-a.fromRow, fromCol: 8-a.fromCol, toRow: 9-a.toRow, toCol: 8-a.toCol }
    : a);

  return (
    <div style={{flex:1,display:"flex",flexDirection:"column",minHeight:0,overflow:"hidden"}}>
      {/* ── Topbar ── */}
      <div className="topbar" style={{flexWrap:"nowrap",gap:6,padding:"8px 14px"}}>
        <span className="topbar-title" style={{flexShrink:0}}>🔍 Phân tích</span>

        {/* Engine badge */}
        <span style={{fontSize:".68rem",padding:"2px 8px",borderRadius:99,background:pikafish.ready&&useWasm?"#e8f5e9":"#fff3e0",color:pikafish.ready&&useWasm?"#27ae60":"#e67e22",border:"1px solid",borderColor:pikafish.ready&&useWasm?"#a8e6c0":"#f9e4a0",flexShrink:0,fontWeight:700}}>
          {pikafish.ready && useWasm ? "⚡ WASM" : "🌐 Server"}
        </span>

        <input value={fenInput} onChange={e=>setFenInput(e.target.value)}
          onKeyDown={e=>e.key==="Enter"&&loadFen(fenInput.trim())}
          style={{flex:1,minWidth:0,background:"#fafafa",border:"1px solid var(--border)",borderRadius:6,padding:"5px 10px",fontSize:".73rem",fontFamily:"monospace",color:"#333"}}
          placeholder="Nhập FEN..." />

        <button className="btn btn-white btn-sm" onClick={()=>loadFen(fenInput.trim())}>Tải</button>
        <button className="btn btn-white btn-sm" onClick={()=>{loadFen(START_FEN);setFenInput(START_FEN);}}>Reset</button>

        {/* PGN import */}
        <label className="btn btn-white btn-sm" style={{cursor:"pointer"}}>
          📂 PGN
          <input type="file" accept=".pgn,.txt" style={{display:"none"}} onChange={e=>{
            const f=e.target.files?.[0];if(!f)return;
            const reader=new FileReader();
            reader.onload=ev=>importPgn(ev.target?.result as string);
            reader.readAsText(f);
          }} />
        </label>
        <button className="btn btn-white btn-sm" onClick={exportPgn} disabled={history.length<2}>💾 PGN</button>

        <select value={timeMs} onChange={e=>setTimeMs(+e.target.value)}
          style={{background:"#fafafa",border:"1px solid var(--border)",borderRadius:6,padding:"5px 8px",fontSize:".75rem",flexShrink:0}}>
          {[1000,2000,3000,5000,8000].map(t=><option key={t} value={t}>{t/1000}s</option>)}
        </select>

        <select value={multiPv} onChange={e=>setMultiPv(+e.target.value)}
          style={{background:"#fafafa",border:"1px solid var(--border)",borderRadius:6,padding:"5px 8px",fontSize:".75rem",flexShrink:0}}>
          {[1,3,5,10].map(n=><option key={n} value={n}>PV {n}</option>)}
        </select>

        <button className="btn btn-red btn-sm" onClick={()=>analyze(fen)} disabled={loading} style={{flexShrink:0}}>
          {loading?"⏳...":"▶ Phân tích"}
        </button>
      </div>

      {/* ── Body ── */}
      <div style={{display:"flex",flex:1,overflow:"hidden",minHeight:0}}>

        {/* ── Col 1: Bàn cờ ── */}
        <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:6,padding:"10px 10px",flexShrink:0,borderRight:"1px solid var(--border)",overflowY:"auto"}}>

          {/* Score bar */}
          <div style={{width:"100%",maxWidth:520}}>
            <div style={{height:6,background:"#222",borderRadius:3,overflow:"hidden"}}>
              <div style={{height:"100%",borderRadius:3,background:"var(--red)",transition:"width .4s",
                width:result?`${Math.min(100,Math.max(0,50+result.score/20))}%`:"50%"}} />
            </div>
            <div style={{display:"flex",justifyContent:"space-between",fontSize:".65rem",color:"var(--muted)",marginTop:2}}>
              <span>⚫ ĐEN</span>
              {result&&<span style={{fontWeight:700,color:scoreColor(result.score,result.isMate,result.mateIn)}}>
                {fmtScore(result.score,result.isMate,result.mateIn)}
              </span>}
              <span>🔴 ĐỎ</span>
            </div>
          </div>

          {/* Board controls */}
          <div style={{display:"flex",gap:6,width:"100%",maxWidth:520}}>
            <button className="btn btn-white btn-sm" onClick={()=>setFlipped(v=>!v)} title="Lật bàn cờ">
              🔄 {flipped?"Đỏ dưới":"Đen dưới"}
            </button>
            <div style={{marginLeft:"auto",display:"flex",gap:4}}>
              {["«","‹","›","»"].map((s,i)=>(
                <button key={i} className="btn btn-white btn-sm" style={{padding:"3px 8px",fontSize:".85rem"}}
                  onClick={()=>{
                    const targets=[0,histIdx-1,histIdx+1,history.length-1];
                    goHist(Math.max(0,Math.min(history.length-1,targets[i])));
                  }}>{s}</button>
              ))}
            </div>
          </div>

          {/* Board */}
          <div className="board-wrap" style={{position:"relative"}}>
            <Board board={displayBoard} legalMoves={displayLegal} lastMove={displayLast}
              selected={displaySelected} hintMove={null} arrows={displayArrows}
              onCellClick={handleCellClick} disabled={loading} />
            {loading&&<div className="board-spin">🔍 {useWasm&&pikafish.ready?"Pikafish WASM":"Server"} đang phân tích...</div>}
          </div>

          {/* Turn indicator */}
          <div style={{display:"flex",alignItems:"center",gap:8,width:"100%",maxWidth:520}}>
            <div style={{width:10,height:10,borderRadius:"50%",background:currentTurn==="red"?"var(--red)":"#222",flexShrink:0}} />
            <span style={{fontSize:".78rem",fontWeight:600}}>Lượt: {currentTurn==="red"?"�� ĐỎ":"⚫ ĐEN"}</span>
            <span style={{marginLeft:"auto",fontSize:".68rem",color:"var(--muted)"}}>
              Nước {histIdx}/{history.length-1}
            </span>
          </div>

          {error&&<div style={{fontSize:".75rem",color:"var(--red)",padding:"6px 10px",background:"#fdf0ee",borderRadius:6,width:"100%",maxWidth:520}}>⚠ {error}</div>}
        </div>

        {/* ── Col 2: Engine output ── */}
        <div style={{flex:1,display:"flex",flexDirection:"column",borderRight:"1px solid var(--border)",minWidth:0}}>
          <div style={{padding:"8px 14px",background:"#fafafa",borderBottom:"1px solid var(--border)",display:"flex",alignItems:"center",gap:8,flexShrink:0}}>
            <span style={{fontSize:".82rem",fontWeight:700,color:"var(--red)"}}>
              {result?.engine==="pikafish-wasm"||result?.engine?.includes("wasm")?"⚡ Pikafish WASM":"🌐 "+( result?.engine??"Engine")}
            </span>
            {result&&<span style={{fontSize:".7rem",color:"var(--muted)",marginLeft:"auto"}}>
              depth {result.depth} · {fmtNodes(result.nodes)} nodes · {fmtNodes(result.nps)}/s
            </span>}
            <label style={{display:"flex",alignItems:"center",gap:4,fontSize:".7rem",color:"var(--muted)",cursor:"pointer",marginLeft:8}}>
              <input type="checkbox" checked={useWasm} onChange={e=>setUseWasm(e.target.checked)} />
              WASM
            </label>
          </div>

          {/* MultiPV top moves */}
          {result?.pvLines && result.pvLines.length > 1 && (
            <div style={{padding:"8px 14px",borderBottom:"1px solid var(--border)",background:"#fff8f7",flexShrink:0}}>
              <div style={{fontSize:".68rem",color:"var(--muted)",fontWeight:700,marginBottom:6,textTransform:"uppercase",letterSpacing:".5px"}}>
                Top {result.pvLines.length} nước tốt nhất
              </div>
              <div style={{display:"flex",flexDirection:"column",gap:4}}>
                {result.pvLines.map((pv,i)=>{
                  const mv=parseUcci(pv.bestMove);
                  return(
                    <div key={i} onClick={()=>{
                      if(mv)setArrows([{...mv,color:i===0?"rgba(231,76,60,0.85)":"rgba(33,150,243,0.72)"}]);
                    }} style={{display:"flex",alignItems:"center",gap:8,padding:"5px 8px",borderRadius:6,
                      background:i===0?"#fdf0ee":"#fafafa",cursor:"pointer",border:"1px solid",
                      borderColor:i===0?"#f5c6c0":"var(--border)",transition:"all .15s"}}
                      onMouseEnter={e=>(e.currentTarget.style.borderColor="var(--red)")}
                      onMouseLeave={e=>(e.currentTarget.style.borderColor=i===0?"#f5c6c0":"var(--border)")}>
                      <span style={{fontSize:".68rem",color:"var(--muted)",minWidth:14,fontWeight:700}}>{i+1}.</span>
                      <span style={{fontFamily:"monospace",fontWeight:700,color:i===0?"var(--red)":"#333",fontSize:".82rem",flex:1}}>
                        {pv.bestMove}
                        {pv.inBook&&<span style={{marginLeft:4,fontSize:".62rem",color:"#27ae60"}}>📚</span>}
                      </span>
                      <span style={{fontSize:".75rem",fontWeight:700,color:scoreColor(pv.score,pv.isMate,pv.mateIn)}}>
                        {fmtScore(pv.score,pv.isMate,pv.mateIn)}
                      </span>
                      <span style={{fontSize:".65rem",color:"var(--muted)"}}>d{pv.depth}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Depth lines */}
          <div style={{flex:1,overflowY:"auto"}}>
            {lines.length===0&&!loading&&(
              <div style={{padding:24,textAlign:"center",color:"var(--muted)",fontSize:".82rem"}}>
                Nhấn <strong>▶ Phân tích</strong> để bắt đầu<br/>
                <span style={{fontSize:".72rem",marginTop:8,display:"block"}}>
                  {pikafish.ready?"⚡ Pikafish WASM sẵn sàng":"⏳ Đang tải engine..."}
                </span>
              </div>
            )}
            {[...lines].reverse().map((line,i)=>{
              const isSel=selLine?.depth===line.depth;
              const pvArr=line.pvLine.split(" ").filter(Boolean);
              return(
                <div key={line.depth} onClick={()=>{setSelLine(line);
                  const pa=line.pvLine.split(" ").filter(Boolean);
                  const na:ArrowDef[]=[];
                  const bm=parseUcci(pa[0]);if(bm)na.push({...bm,color:"rgba(231,76,60,0.82)"});
                  if(pa[1]){const pm=parseUcci(pa[1]);if(pm)na.push({...pm,color:"rgba(33,150,243,0.72)"});}
                  setArrows(na);
                }} style={{padding:"8px 14px",borderBottom:"1px solid #f5f5f5",cursor:"pointer",
                  background:isSel?"#fdf0ee":i%2===0?"#fff":"#fafafa",transition:"background .1s"}}>
                  <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:3,flexWrap:"wrap"}}>
                    <span style={{fontSize:".7rem",color:"var(--muted)",minWidth:60}}>
                      d<strong style={{color:"#333"}}>{line.depth}</strong>
                    </span>
                    <span style={{fontSize:".8rem",fontWeight:700,color:scoreColor(line.score,line.isMate,line.mateIn),minWidth:70}}>
                      {line.isMate?(line.mateIn>0?`Đỏ M${line.mateIn}`:`Đen M${Math.abs(line.mateIn)}`):fmtScore(line.score,false,0)}
                    </span>
                    <span style={{fontSize:".65rem",color:"var(--muted)"}}>{fmtTime(line.timeMs)}</span>
                    <span style={{fontSize:".65rem",color:"var(--muted)",marginLeft:"auto"}}>{fmtNodes(line.nodes)}</span>
                  </div>
                  <div style={{fontSize:".7rem",fontFamily:"monospace",color:"#555",lineHeight:1.7}}>
                    {pvArr.slice(0,12).map((m,j)=>(
                      <span key={j} style={{marginRight:4,color:j===0?"var(--red)":"#666",fontWeight:j===0?700:400}}>
                        {j%2===0&&<span style={{color:"#bbb",marginRight:2}}>{Math.floor(j/2)+1}.</span>}
                        {m}
                      </span>
                    ))}
                    {pvArr.length>12&&<span style={{color:"#bbb"}}>...</span>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Col 3: Tabs ── */}
        <div style={{width:230,flexShrink:0,display:"flex",flexDirection:"column",overflow:"hidden"}}>
          {/* Tabs */}
          <div style={{display:"flex",borderBottom:"1px solid var(--border)",background:"#fafafa",flexShrink:0}}>
            {(["book","moves","graph"] as const).map(tab=>(
              <div key={tab} onClick={()=>setActiveTab(tab)} style={{
                flex:1,padding:"8px 4px",textAlign:"center",fontSize:".7rem",fontWeight:700,cursor:"pointer",
                color:activeTab===tab?"var(--red)":"var(--muted)",
                borderBottom:activeTab===tab?"2px solid var(--red)":"2px solid transparent",transition:"all .15s",
              }}>
                {tab==="book"?"📚 Khai cuộc":tab==="moves"?"♟ Nước cờ":"📈 Biểu đồ"}
              </div>
            ))}
          </div>

          {/* Tab: Khai cuộc */}
          {activeTab==="book"&&(
            <div style={{flex:1,overflowY:"auto"}}>
              {result?.openingName&&(
                <div style={{padding:"8px 10px",background:"#fdf0ee",borderBottom:"1px solid #f5c6c0",fontSize:".75rem",fontWeight:700,color:"var(--red)"}}>
                  📖 {result.openingName}
                </div>
              )}
              {result?.bookMoves&&result.bookMoves.length>0?(
                result.bookMoves.map((bm,i)=>{
                  const mv=parseUcci(bm.ucci);
                  return(
                    <div key={i} onClick={()=>{if(mv)setArrows([{...mv,color:"rgba(231,76,60,0.85)"}]);}}
                      style={{display:"grid",gridTemplateColumns:"1fr 50px 36px",padding:"7px 10px",
                        borderBottom:"1px solid #f5f5f5",background:i%2===0?"#fff":"#fafafa",cursor:"pointer"}}
                      onMouseEnter={e=>(e.currentTarget.style.background="#fdf0ee")}
                      onMouseLeave={e=>(e.currentTarget.style.background=i%2===0?"#fff":"#fafafa")}>
                      <span style={{fontFamily:"monospace",fontWeight:700,color:"var(--red)",fontSize:".78rem"}}>{bm.ucci}</span>
                      <span style={{fontSize:".65rem",color:"var(--muted)",textAlign:"center",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{bm.nameVi}</span>
                      <span style={{textAlign:"center",fontSize:".72rem"}}>{"★".repeat(Math.ceil(bm.weight/34)).slice(0,3)}</span>
                    </div>
                  );
                })
              ):(
                <div style={{padding:16,textAlign:"center",color:"var(--muted)",fontSize:".78rem"}}>
                  {result?"Không có trong sách khai cuộc":"Nhấn Phân tích để tra cứu"}
                </div>
              )}
            </div>
          )}

          {/* Tab: Nước cờ PV */}
          {activeTab==="moves"&&(
            <div style={{flex:1,overflowY:"auto"}}>
              <div style={{display:"grid",gridTemplateColumns:"1fr 50px 50px",padding:"6px 10px",background:"#fafafa",borderBottom:"1px solid var(--border)",fontSize:".65rem",color:"var(--muted)",fontWeight:600,flexShrink:0}}>
                <span>Nước cờ</span><span style={{textAlign:"center"}}>Bên</span><span style={{textAlign:"center"}}>Điểm</span>
              </div>
              {pvMoves.length===0?(
                <div style={{padding:16,textAlign:"center",color:"var(--muted)",fontSize:".78rem"}}>Chọn một dòng phân tích</div>
              ):pvMoves.map((mv,i)=>{
                const isRed=currentTurn==="red"?i%2===0:i%2!==0;
                return(
                  <div key={i} style={{display:"grid",gridTemplateColumns:"1fr 50px 50px",padding:"5px 10px",borderBottom:"1px solid #f5f5f5",background:i%2===0?"#fff":"#fafafa",fontSize:".75rem"}}>
                    <span style={{fontFamily:"monospace",fontWeight:i===0?700:400,color:i===0?"var(--red)":"#333"}}>
                      {Math.floor(i/2)+1}. {mv}
                    </span>
                    <span style={{textAlign:"center",color:isRed?"var(--red)":"#333",fontWeight:600}}>{isRed?"🔴":"⚫"}</span>
                    <span style={{textAlign:"center",fontSize:".68rem",color:"var(--muted)"}}>{i===0?fmtScore(activeLine?.score??0,activeLine?.isMate??false,activeLine?.mateIn??0):""}</span>
                  </div>
                );
              })}
            </div>
          )}

          {/* Tab: Biểu đồ điểm số */}
          {activeTab==="graph"&&(
            <div style={{flex:1,overflowY:"auto",padding:10,display:"flex",flexDirection:"column",gap:8}}>
              <div style={{fontSize:".72rem",fontWeight:700,color:"var(--muted)",textTransform:"uppercase",letterSpacing:".5px"}}>
                Biểu đồ điểm số
              </div>
              {scorePoints.length>1?(
                <ScoreGraph points={scorePoints} currentIdx={histIdx} onClickMove={goHist} height={100} />
              ):(
                <div style={{padding:16,textAlign:"center",color:"var(--muted)",fontSize:".78rem"}}>
                  Chơi và phân tích để xem biểu đồ
                </div>
              )}
              {/* Move list */}
              <div style={{fontSize:".68rem",fontWeight:700,color:"var(--muted)",textTransform:"uppercase",letterSpacing:".5px",marginTop:4}}>
                Lịch sử nước đi
              </div>
              <div style={{display:"flex",flexDirection:"column",gap:2}}>
                {history.slice(1).map((h,i)=>{
                  const isRed=i%2===0;
                  const num=Math.floor(i/2)+1;
                  return(
                    <div key={i} onClick={()=>goHist(i+1)}
                      style={{display:"flex",alignItems:"center",gap:6,padding:"4px 8px",borderRadius:5,
                        background:histIdx===i+1?"#fdf0ee":"transparent",cursor:"pointer",
                        border:"1px solid",borderColor:histIdx===i+1?"#f5c6c0":"transparent"}}
                      onMouseEnter={e=>(e.currentTarget.style.background="#fdf0ee")}
                      onMouseLeave={e=>(e.currentTarget.style.background=histIdx===i+1?"#fdf0ee":"transparent")}>
                      <span style={{fontSize:".65rem",color:"var(--muted)",minWidth:20}}>{num}{isRed?".":""}</span>
                      <span style={{fontFamily:"monospace",fontSize:".75rem",fontWeight:600,color:isRed?"var(--red)":"#333",flex:1}}>
                        {h.label??"?"}
                      </span>
                      {h.score!==undefined&&(
                        <span style={{fontSize:".65rem",color:scoreColor(h.score,h.isMate??false,0)}}>
                          {fmtScore(h.score,h.isMate??false,0)}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Engine info footer */}
          <div style={{padding:"8px 10px",borderTop:"1px solid var(--border)",fontSize:".65rem",color:"var(--muted)",background:"#fafafa",flexShrink:0}}>
            <div style={{fontWeight:700,color:"var(--red)",marginBottom:3}}>
              {pikafish.ready&&useWasm?"⚡ Pikafish WASM":"🌐 Server Engine"}
            </div>
            {result?(
              <>
                <div>Depth: <strong>{result.depth}</strong> · MultiPV: <strong>{result.multiPvCount??multiPv}</strong></div>
                <div>Nodes: <strong>{fmtNodes(result.nodes)}</strong> · NPS: <strong>{fmtNodes(result.nps)}/s</strong></div>
              </>
            ):<div>{pikafish.ready?"Sẵn sàng phân tích":"Đang tải engine..."}</div>}
          </div>
        </div>
      </div>
    </div>
  );
}
