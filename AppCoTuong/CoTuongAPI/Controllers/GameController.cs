using Microsoft.AspNetCore.Mvc;
using CoTuongAPI.AI;
using CoTuongAPI.Engine;
using CoTuongAPI.Models;
using CoTuongAPI.Services;
namespace CoTuongAPI.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class GameController : ControllerBase
    {
        private readonly GameManager _manager;
        public GameController(GameManager manager) => _manager = manager;

        // POST /api/game/new
        [HttpPost("new")]
        public IActionResult NewGame([FromBody] NewGameRequest req)
        {
            var session = _manager.CreateSession(req.Mode);
            session.TimePerSide   = req.TimePerSide;
            session.RedTimeLeft   = req.TimePerSide;
            session.BlackTimeLeft = req.TimePerSide;
            return Ok(session.ToDto());
        }

        // GET /api/game/{id}
        [HttpGet("{id}")]
        public IActionResult GetState(string id)
        {
            var s = _manager.GetSession(id);
            if (s == null) return NotFound(new { error = "Game not found" });
            return Ok(s.ToDto());
        }

        // POST /api/game/{id}/move
        [HttpPost("{id}/move")]
        public IActionResult MakeMove(string id, [FromBody] MoveRequest req)
        {
            var session = _manager.GetSession(id);
            if (session == null) return NotFound(new { error = "Game not found" });
            if (session.IsGameOver) return BadRequest(new { error = "Game is over" });

            var legal = session.CurrentLegalMoves.FirstOrDefault(m =>
                m.FromRow == req.FromRow && m.FromCol == req.FromCol &&
                m.ToRow   == req.ToRow   && m.ToCol   == req.ToCol);
            if (legal == null) return BadRequest(new { error = "Illegal move" });

            var color    = session.Board.CurrentTurn == PieceColor.Red ? "red" : "black";
            var captured = session.Board.GetPiece(req.ToRow, req.ToCol);

            session.Board.ApplyMove(legal);
            session.History.Push(legal);
            session.RecordMove(legal, color, captured);
            session.RefreshLegalMoves();

            return Ok(session.ToDto());
        }

        // POST /api/game/{id}/ai-move
        [HttpPost("{id}/ai-move")]
        public IActionResult AiMove(string id, [FromQuery] int depth = 6)
        {
            var session = _manager.GetSession(id);
            if (session == null) return NotFound(new { error = "Game not found" });
            if (session.IsGameOver) return BadRequest(new { error = "Game is over" });

            depth = Math.Clamp(depth, 1, 7);
            var ai    = new Minimax(depth, maxTimeMs: 8000);
            var clone = session.Board.Clone();
            var move  = ai.FindBestMove(clone);
            if (move == null) return BadRequest(new { error = "No legal moves" });

            var color    = session.Board.CurrentTurn == PieceColor.Red ? "red" : "black";
            var captured = session.Board.GetPiece(move.ToRow, move.ToCol);

            var cleanMove = new Move(move.FromRow, move.FromCol, move.ToRow, move.ToCol);
            session.Board.ApplyMove(cleanMove);
            session.History.Push(cleanMove);
            session.RecordMove(cleanMove, color, captured);
            session.RefreshLegalMoves();

            return Ok(new AiMoveDto
            {
                Move          = new MoveDto(move.FromRow, move.FromCol, move.ToRow, move.ToCol),
                State         = session.ToDto(),
                NodesSearched = ai.NodesSearched
            });
        }

        // POST /api/game/{id}/hint  — gợi ý nước đi tốt nhất
        [HttpPost("{id}/hint")]
        public IActionResult GetHint(string id, [FromQuery] int depth = 4)
        {
            var session = _manager.GetSession(id);
            if (session == null) return NotFound(new { error = "Game not found" });
            if (session.IsGameOver) return BadRequest(new { error = "Game is over" });

            depth = Math.Clamp(depth, 1, 6);
            var ai    = new Minimax(depth, maxTimeMs: 5000);
            var clone = session.Board.Clone();
            var move  = ai.FindBestMove(clone);

            return Ok(new HintDto
            {
                BestMove      = move == null ? null
                    : new MoveDto(move.FromRow, move.FromCol, move.ToRow, move.ToCol),
                NodesSearched = ai.NodesSearched
            });
        }

        // POST /api/game/{id}/undo
        [HttpPost("{id}/undo")]
        public IActionResult Undo(string id, [FromQuery] int steps = 1)
        {
            var session = _manager.GetSession(id);
            if (session == null) return NotFound(new { error = "Game not found" });

            for (int i = 0; i < steps && session.History.Count > 0; i++)
            {
                session.Board.UndoMove(session.History.Pop());
                if (session.MoveHistory.Count > 0)
                    session.MoveHistory.RemoveAt(session.MoveHistory.Count - 1);
            }

            session.IsGameOver = false;
            session.TurnStarted = DateTime.UtcNow;
            session.RefreshLegalMoves();
            return Ok(session.ToDto());
        }

        // DELETE /api/game/{id}
        [HttpDelete("{id}")]
        public IActionResult DeleteGame(string id)
        {
            _manager.RemoveSession(id);
            return NoContent();
        }

        // GET /api/game/{id}/pgn — export ván cờ
        [HttpGet("{id}/pgn")]
        public IActionResult ExportPgn(string id)
        {
            var session = _manager.GetSession(id);
            if (session == null) return NotFound(new { error = "Game not found" });
            var pgn = PgnService.ExportPgn(session);
            return Content(pgn, "text/plain");
        }
    }
}
