using Microsoft.AspNetCore.Mvc;
using CoTuongAPI.AI;
using CoTuongAPI.Engine;
using CoTuongAPI.Services;

namespace CoTuongAPI.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class AnalyzeController : ControllerBase
    {
        private readonly PikafishService     _pikafish;
        private readonly OpeningBookService  _book;

        public AnalyzeController(PikafishService pikafish, OpeningBookService book)
        {
            _pikafish = pikafish;
            _book     = book;
        }

        /// POST /api/analyze
        /// Tích hợp: Opening Book + Pikafish MultiPV (fallback về Minimax nếu Pikafish không có)
        [HttpPost]
        public async Task<IActionResult> Analyze([FromBody] AnalyzeRequest req)
        {
            if (string.IsNullOrWhiteSpace(req.Fen))
                return BadRequest(new { error = "FEN is required" });

            Board board;
            try { board = FenConverter.FromFen(req.Fen); }
            catch (Exception ex) { return BadRequest(new { error = $"Invalid FEN: {ex.Message}" }); }

            int timeMs  = Math.Clamp(req.TimeMs,  500, 10000);
            int multiPv = Math.Clamp(req.MultiPV, 1,   10);

            // ── 1. Tra cứu Opening Book ───────────────────────────────────────
            var bookMoves   = _book.Lookup(req.Fen);
            var openingName = _book.GetOpeningName(req.Fen);

            // ── 2. Thử Pikafish MultiPV ───────────────────────────────────────
            bool usedPikafish = false;
            List<AnalysisResult>? pvResults = null;

            bool started = await _pikafish.StartAsync();
            if (started)
            {
                pvResults    = await _pikafish.AnalyzeMultiPVAsync(board, timeMs, multiPv);
                usedPikafish = pvResults != null && pvResults.Count > 0;
            }

            // ── 3. Fallback về Minimax nếu Pikafish không có ──────────────────
            if (!usedPikafish)
            {
                Console.WriteLine("[AnalyzeController] Pikafish unavailable, falling back to Minimax");
                int depth  = Math.Clamp(req.TimeMs / 500, 3, 6); // ước tính depth từ timeMs
                var ai     = new Minimax(depth, maxTimeMs: timeMs);
                var clone  = board.Clone();
                var move   = ai.FindBestMove(clone);

                if (move == null)
                    return BadRequest(new { error = "No legal moves in this position" });

                // Tạo kết quả giả lập theo format Pikafish để frontend không cần thay đổi
                var ucci = MoveToUcci(move);
                var fakeResult = new AnalysisResult
                {
                    BestMove     = move,
                    BestMoveUcci = ucci,
                    Score        = Evaluation.Evaluate(clone),
                    Depth        = depth,
                    Nodes        = ai.NodesSearched,
                    PvLine       = ucci,
                };
                fakeResult.Lines.Add(new InfoLine
                {
                    Depth  = depth,
                    Score  = fakeResult.Score,
                    Nodes  = ai.NodesSearched,
                    PvLine = ucci,
                });
                pvResults = [fakeResult];
            }

            if (pvResults == null || pvResults.Count == 0)
                return StatusCode(503, new { error = "Analysis failed" });

            var best = pvResults[0];

            // ── 3. Merge: Book moves được đánh dấu riêng ─────────────────────
            var pvLines = pvResults.Select((r, i) => new
            {
                rank         = i + 1,
                bestMove     = r.BestMoveUcci,
                bestMoveCoord = r.BestMove == null ? null : new
                {
                    fromRow = r.BestMove.FromRow, fromCol = r.BestMove.FromCol,
                    toRow   = r.BestMove.ToRow,   toCol   = r.BestMove.ToCol,
                },
                score    = r.Score,
                isMate   = r.IsMate,
                mateIn   = r.MateIn,
                depth    = r.Depth,
                nodes    = r.Nodes,
                nps      = r.Nps,
                pvLine   = r.PvLine,
                // Kiểm tra nước này có trong book không
                inBook   = bookMoves?.Any(bm => bm.Ucci == r.BestMoveUcci) ?? false,
                bookName = bookMoves?.FirstOrDefault(bm => bm.Ucci == r.BestMoveUcci)?.NameVi,
            }).ToList();

            return Ok(new
            {
                // Kết quả tổng hợp
                bestMove      = best.BestMoveUcci,
                bestMoveCoord = best.BestMove == null ? null : new
                {
                    fromRow = best.BestMove.FromRow, fromCol = best.BestMove.FromCol,
                    toRow   = best.BestMove.ToRow,   toCol   = best.BestMove.ToCol,
                },
                score         = best.Score,
                isMate        = best.IsMate,
                mateIn        = best.MateIn,
                depth         = best.Depth,
                nodes         = best.Nodes,
                nps           = best.Nps,
                pvLine        = best.PvLine,
                engine        = usedPikafish ? "pikafish" : "minimax",
                multiPvCount  = pvResults.Count,

                // Tất cả PV lines (MultiPV)
                pvLines       = pvLines,

                // Opening Book
                openingName   = openingName,
                bookMoves     = bookMoves?.Select(bm => new
                {
                    ucci   = bm.Ucci,
                    name   = bm.Name,
                    nameVi = bm.NameVi,
                    weight = bm.Weight,
                }),

                // Depth lines (cho panel Pikafish)
                lines = best.Lines.OrderByDescending(l => l.Depth).Select(l => new
                {
                    depth  = l.Depth,  score  = l.Score,
                    isMate = l.IsMate, mateIn = l.MateIn,
                    nodes  = l.Nodes,  nps    = l.Nps,
                    timeMs = l.TimeMs, pvLine = l.PvLine,
                }),
            });
        }

        // ── Helper: chuyển Move sang UCCI string (vd: "b2e2") ────────────────
        // UCCI: cột a-i, hàng 0-9 (0 = đáy Đỏ = board row 9)
        private static string MoveToUcci(Move m)
        {
            char fc = (char)('a' + m.FromCol);
            int  fr = 9 - m.FromRow;
            char tc = (char)('a' + m.ToCol);
            int  tr = 9 - m.ToRow;
            return $"{fc}{fr}{tc}{tr}";
        }
    }

    public record AnalyzeRequest(string Fen, int TimeMs = 2000, int MultiPV = 5);
}
