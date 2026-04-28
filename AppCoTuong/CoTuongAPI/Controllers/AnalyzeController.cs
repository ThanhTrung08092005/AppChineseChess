using Microsoft.AspNetCore.Mvc;
using CoTuongAPI.Engine;
using CoTuongAPI.Services;

namespace CoTuongAPI.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class AnalyzeController : ControllerBase
    {
        private readonly PikafishService _pikafish;
        public AnalyzeController(PikafishService pikafish) => _pikafish = pikafish;

        /// POST /api/analyze
        /// Body: { "fen": "rnbakabnr/9/1c5c1/p1p1p1p1p/9/9/P1P1P1P1P/1C5C1/9/RNBAKABNR w - - 0 1", "timeMs": 2000 }
        [HttpPost]
        public async Task<IActionResult> Analyze([FromBody] AnalyzeRequest req)
        {
            if (string.IsNullOrWhiteSpace(req.Fen))
                return BadRequest(new { error = "FEN is required" });

            // Parse FEN → Board
            Board? board;
            try { board = FenConverter.FromFen(req.Fen); }
            catch (Exception ex) { return BadRequest(new { error = $"Invalid FEN: {ex.Message}" }); }

            int timeMs = Math.Clamp(req.TimeMs, 500, 10000);

            bool started = await _pikafish.StartAsync();
            if (!started)
                return StatusCode(503, new { error = "Pikafish engine not available" });

            var result = await _pikafish.AnalyzeAsync(board, timeMs);
            if (result == null)
                return StatusCode(503, new { error = "Analysis failed" });

            return Ok(new
            {
                bestMove     = result.BestMoveUcci,
                bestMoveCoord = result.BestMove == null ? null : new
                {
                    fromRow = result.BestMove.FromRow,
                    fromCol = result.BestMove.FromCol,
                    toRow   = result.BestMove.ToRow,
                    toCol   = result.BestMove.ToCol,
                },
                score    = result.Score,
                isMate   = result.IsMate,
                mateIn   = result.MateIn,
                depth    = result.Depth,
                nodes    = result.Nodes,
                nps      = result.Nps,
                pvLine   = result.PvLine,
                engine   = "pikafish",
            });
        }
    }

    public record AnalyzeRequest(string Fen, int TimeMs = 2000);
}
