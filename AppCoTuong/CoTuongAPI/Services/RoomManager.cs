using System.Collections.Concurrent;

namespace CoTuongAPI.Services
{
    public class GameRoom
    {
        public string  Id          { get; } = GenerateCode();
        public string  HostId      { get; set; } = "";
        public string  HostName    { get; set; } = "";
        public string? GuestId     { get; set; }
        public string? GuestName   { get; set; }
        public string  GameId      { get; set; } = "";  // GameSession ID
        public string  Status      { get; set; } = "waiting"; // waiting | playing | finished
        public int     TimePerSide { get; set; } = 600;
        public DateTime CreatedAt  { get; set; } = DateTime.UtcNow;

        public bool IsFull => GuestId != null;

        private static string GenerateCode()
        {
            const string chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
            var rng = new Random();
            return new string(Enumerable.Range(0, 6).Select(_ => chars[rng.Next(chars.Length)]).ToArray());
        }
    }

    public class RoomManager
    {
        private readonly ConcurrentDictionary<string, GameRoom> _rooms = new();

        public GameRoom CreateRoom(string hostId, string hostName, int timePerSide = 600)
        {
            var room = new GameRoom
            {
                HostId      = hostId,
                HostName    = hostName,
                TimePerSide = timePerSide
            };
            _rooms[room.Id] = room;
            CleanupOldRooms();
            return room;
        }

        public GameRoom? GetRoom(string id)
        {
            _rooms.TryGetValue(id, out var r);
            return r;
        }

        public List<GameRoom> GetWaitingRooms()
            => _rooms.Values
                .Where(r => r.Status == "waiting")
                .OrderByDescending(r => r.CreatedAt)
                .Take(20)
                .ToList();

        public void RemoveRoom(string id) => _rooms.TryRemove(id, out _);

        private void CleanupOldRooms()
        {
            var cutoff = DateTime.UtcNow.AddHours(-1);
            foreach (var kv in _rooms)
                if (kv.Value.CreatedAt < cutoff)
                    _rooms.TryRemove(kv.Key, out _);
        }
    }
}
