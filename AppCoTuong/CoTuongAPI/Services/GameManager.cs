using System.Collections.Concurrent;

namespace CoTuongAPI.Services
{
    /// <summary>Quản lý tất cả game session trong memory</summary>
    public class GameManager
    {
        private readonly ConcurrentDictionary<string, GameSession> _sessions = new();

        public GameSession CreateSession(string mode = "pvai")
        {
            var session = new GameSession { Mode = mode };
            _sessions[session.Id] = session;
            CleanupOldSessions();
            return session;
        }

        public GameSession? GetSession(string id)
        {
            _sessions.TryGetValue(id, out var s);
            return s;
        }

        public void RemoveSession(string id) => _sessions.TryRemove(id, out _);

        // Xóa session không hoạt động quá 2 giờ
        private void CleanupOldSessions()
        {
            var cutoff = DateTime.UtcNow.AddHours(-2);
            foreach (var kv in _sessions)
                if (kv.Value.LastActive < cutoff)
                    _sessions.TryRemove(kv.Key, out _);
        }
    }
}
