using Microsoft.AspNetCore.SignalR;
using CoTuongAPI.Engine;
using CoTuongAPI.Models;
using CoTuongAPI.Services;

namespace CoTuongAPI.Hubs
{
    /// <summary>
    /// SignalR Hub cho chơi cờ online realtime.
    /// Client events: JoinRoom, LeaveRoom, MakeMove, SendMessage
    /// Server events: RoomUpdated, GameStateUpdated, PlayerJoined, PlayerLeft, ChatMessage, Error
    /// </summary>
    public class GameHub : Hub
    {
        private readonly RoomManager   _rooms;
        private readonly GameManager   _games;
        private readonly AuthService   _auth;

        public GameHub(RoomManager rooms, GameManager games, AuthService auth)
        {
            _rooms = rooms;
            _games = games;
            _auth  = auth;
        }

        // ── Tham gia phòng ────────────────────────────────────────────────────
        public async Task JoinRoom(string roomId, string playerId, string playerName)
        {
            var room = _rooms.GetRoom(roomId);
            if (room == null)
            {
                await Clients.Caller.SendAsync("Error", "Phòng không tồn tại");
                return;
            }

            if (room.IsFull && room.GuestId != playerId && room.HostId != playerId)
            {
                await Clients.Caller.SendAsync("Error", "Phòng đã đầy");
                return;
            }

            await Groups.AddToGroupAsync(Context.ConnectionId, roomId);

            // Nếu là khách mới
            if (!room.IsFull && room.HostId != playerId)
            {
                room.GuestId   = playerId;
                room.GuestName = playerName;
                room.Status    = "playing";

                // Tạo game session
                var session = _games.CreateSession("pvp");
                session.TimePerSide   = room.TimePerSide;
                session.RedTimeLeft   = room.TimePerSide;
                session.BlackTimeLeft = room.TimePerSide;
                room.GameId = session.Id;

                await Clients.Group(roomId).SendAsync("PlayerJoined", new
                {
                    playerId, playerName,
                    color    = "black",
                    gameId   = session.Id,
                    gameState = session.ToDto()
                });
            }
            else
            {
                // Host reconnect hoặc guest reconnect
                var session = _games.GetSession(room.GameId);
                if (session != null)
                    await Clients.Caller.SendAsync("RoomUpdated", new { room, gameState = session.ToDto() });
            }
        }

        // ── Đi nước ───────────────────────────────────────────────────────────
        public async Task MakeMove(string roomId, string playerId, int fromRow, int fromCol, int toRow, int toCol)
        {
            var room = _rooms.GetRoom(roomId);
            if (room == null || string.IsNullOrEmpty(room.GameId)) return;

            var session = _games.GetSession(room.GameId);
            if (session == null || session.IsGameOver) return;

            // Kiểm tra đúng lượt
            var expectedColor = session.Board.CurrentTurn == PieceColor.Red ? room.HostId : room.GuestId;
            if (playerId != expectedColor)
            {
                await Clients.Caller.SendAsync("Error", "Chưa đến lượt của bạn");
                return;
            }

            var legal = session.CurrentLegalMoves.FirstOrDefault(m =>
                m.FromRow == fromRow && m.FromCol == fromCol &&
                m.ToRow   == toRow   && m.ToCol   == toCol);
            if (legal == null)
            {
                await Clients.Caller.SendAsync("Error", "Nước đi không hợp lệ");
                return;
            }

            var color    = session.Board.CurrentTurn == PieceColor.Red ? "red" : "black";
            var captured = session.Board.GetPiece(toRow, toCol);

            session.Board.ApplyMove(legal);
            session.History.Push(legal);
            session.RecordMove(legal, color, captured);
            session.RefreshLegalMoves();

            if (session.IsGameOver) room.Status = "finished";

            await Clients.Group(roomId).SendAsync("GameStateUpdated", session.ToDto());
        }

        // ── Chat ──────────────────────────────────────────────────────────────
        public async Task SendMessage(string roomId, string playerName, string message)
        {
            if (string.IsNullOrWhiteSpace(message) || message.Length > 200) return;
            await Clients.Group(roomId).SendAsync("ChatMessage", new
            {
                playerName,
                message = message.Trim(),
                time    = DateTime.UtcNow.ToString("HH:mm")
            });
        }

        // ── Rời phòng ─────────────────────────────────────────────────────────
        public override async Task OnDisconnectedAsync(Exception? exception)
        {
            await base.OnDisconnectedAsync(exception);
        }
    }
}
