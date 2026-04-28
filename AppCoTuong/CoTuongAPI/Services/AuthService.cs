using System.Collections.Concurrent;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using Microsoft.IdentityModel.Tokens;

namespace CoTuongAPI.Services
{
    public class UserProfile
    {
        public string Id           { get; set; } = Guid.NewGuid().ToString("N")[..8];
        public string Username     { get; set; } = "";
        public string PasswordHash { get; set; } = "";
        public int    Wins         { get; set; }
        public int    Losses       { get; set; }
        public int    Draws        { get; set; }
        public DateTime CreatedAt  { get; set; } = DateTime.UtcNow;

        public int TotalGames => Wins + Losses + Draws;
        public double WinRate => TotalGames == 0 ? 0 : Math.Round(Wins * 100.0 / TotalGames, 1);
    }

    public class AuthService
    {
        private readonly ConcurrentDictionary<string, UserProfile> _users = new();
        private const string JwtSecret = "CoTuong_SuperSecret_Key_2024_XYZ!";

        public (bool ok, string msg, string? token, UserProfile? user) Register(string username, string password)
        {
            if (string.IsNullOrWhiteSpace(username) || username.Length < 3)
                return (false, "Tên đăng nhập phải có ít nhất 3 ký tự", null, null);
            if (string.IsNullOrWhiteSpace(password) || password.Length < 4)
                return (false, "Mật khẩu phải có ít nhất 4 ký tự", null, null);
            if (_users.Values.Any(u => u.Username.Equals(username, StringComparison.OrdinalIgnoreCase)))
                return (false, "Tên đăng nhập đã tồn tại", null, null);

            var user = new UserProfile
            {
                Username     = username,
                PasswordHash = HashPassword(password)
            };
            _users[user.Id] = user;
            return (true, "Đăng ký thành công", GenerateToken(user), user);
        }

        public (bool ok, string msg, string? token, UserProfile? user) Login(string username, string password)
        {
            var user = _users.Values.FirstOrDefault(u =>
                u.Username.Equals(username, StringComparison.OrdinalIgnoreCase));
            if (user == null || user.PasswordHash != HashPassword(password))
                return (false, "Tên đăng nhập hoặc mật khẩu không đúng", null, null);
            return (true, "Đăng nhập thành công", GenerateToken(user), user);
        }

        public UserProfile? GetById(string id)
        {
            _users.TryGetValue(id, out var u);
            return u;
        }

        public List<UserProfile> GetLeaderboard()
            => _users.Values
                .Where(u => u.TotalGames > 0)
                .OrderByDescending(u => u.Wins)
                .ThenByDescending(u => u.WinRate)
                .Take(20)
                .ToList();

        public void RecordResult(string userId, string result)
        {
            if (!_users.TryGetValue(userId, out var user)) return;
            if (result == "win")   user.Wins++;
            else if (result == "loss") user.Losses++;
            else user.Draws++;
        }

        private static string HashPassword(string password)
        {
            var bytes = SHA256.HashData(Encoding.UTF8.GetBytes(password + "CoTuongSalt"));
            return Convert.ToHexString(bytes);
        }

        private static string GenerateToken(UserProfile user)
        {
            var key     = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(JwtSecret));
            var creds   = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);
            var claims  = new[]
            {
                new Claim(ClaimTypes.NameIdentifier, user.Id),
                new Claim(ClaimTypes.Name, user.Username)
            };
            var token = new JwtSecurityToken(
                claims:   claims,
                expires:  DateTime.UtcNow.AddDays(7),
                signingCredentials: creds);
            return new JwtSecurityTokenHandler().WriteToken(token);
        }
    }
}
