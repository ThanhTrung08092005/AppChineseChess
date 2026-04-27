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
            return Ok(session.ToDto());
        }

        // GET /api/game/{id}
        [HttpGet("{id}")]
        public IActionResult GetState(string id)
        {
            var session = _manager.GetSession(id);
            if (session == null) return NotFound(new { error = "Game not found" });
            return Ok(session.ToDto());
        }

        // POST /api/game/{id}/move
        [HttpPost("{id}/move")]
        public IActionResult MakeMove(string id, [FromBody] MoveRequest req)
        {
            var session = _manager.GetSession(id);
            if (session == null) return NotFound(new { error = "Game not found" });
            if (session.IsGameOver) return BadRequest(new { error = "Game is over" });

            // Kiểm tra nước đi có hợp lệ không
            var legal = session.CurrentLegalMoves.FirstOrDefault(m =>
                m.FromRow == req.FromRow && m.FromCol == req.FromCol &&
                m.ToRow   == req.ToRow   && m.ToCol   == req.ToCol);

            if (legal == null)
                return BadRequest(new { error = "Illegal move" });

            session.Board.ApplyMove(legal);
            session.History.Push(legal);
            session.RefreshLegalMoves();

            return Ok(session.ToDto());
        }

        // POST /api/game/{id}/ai-move
        [HttpPost("{id}/ai-move")]
        public IActionResult AiMove(string id, [FromQuery] int depth = 5)
        {
            var session = _manager.GetSession(id);
            if (session == null) return NotFound(new { error = "Game not found" });
            if (session.IsGameOver) return BadRequest(new { error = "Game is over" });

            depth = Math.Clamp(depth, 1, 7);
            var ai    = new Minimax(depth, maxTimeMs: 8000);
            var clone = session.Board.Clone();
            var move  = ai.FindBestMove(clone);

            if (move == null)
                return BadRequest(new { error = "No legal moves" });

            // Apply nước đi sạch lên board gốc
            var cleanMove = new Move(move.FromRow, move.FromCol, move.ToRow, move.ToCol);
            session.Board.ApplyMove(cleanMove);
            session.History.Push(cleanMove);
            session.RefreshLegalMoves();

            return Ok(new AiMoveDto
            {
                Move          = new MoveDto(move.FromRow, move.FromCol, move.ToRow, move.ToCol),
                State         = session.ToDto(),
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
                session.Board.UndoMove(session.History.Pop());

            session.IsGameOver = false; // reset
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
    }
}
