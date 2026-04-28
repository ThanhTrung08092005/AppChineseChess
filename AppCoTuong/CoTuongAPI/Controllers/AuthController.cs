using Microsoft.AspNetCore.Mvc;
using CoTuongAPI.Services;

namespace CoTuongAPI.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class AuthController : ControllerBase
    {
        private readonly AuthService _auth;
        public AuthController(AuthService auth) => _auth = auth;

        [HttpPost("register")]
        public IActionResult Register([FromBody] LoginRequest req)
        {
            var (ok, msg, token, user) = _auth.Register(req.Username, req.Password);
            if (!ok) return BadRequest(new { error = msg });
            return Ok(new { token, user = new { user!.Id, user.Username, user.Wins, user.Losses, user.WinRate } });
        }

        [HttpPost("login")]
        public IActionResult Login([FromBody] LoginRequest req)
        {
            var (ok, msg, token, user) = _auth.Login(req.Username, req.Password);
            if (!ok) return BadRequest(new { error = msg });
            return Ok(new { token, user = new { user!.Id, user.Username, user.Wins, user.Losses, user.WinRate } });
        }

        [HttpGet("leaderboard")]
        public IActionResult Leaderboard()
        {
            var top = _auth.GetLeaderboard();
            return Ok(top.Select(u => new { u.Username, u.Wins, u.Losses, u.Draws, u.WinRate, u.TotalGames }));
        }
    }

    public record LoginRequest(string Username, string Password);
}
