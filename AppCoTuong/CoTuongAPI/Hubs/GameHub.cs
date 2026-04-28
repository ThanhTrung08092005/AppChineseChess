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

            // Host vào phòng lần đầu — chờ khách
            if (room.HostId == playerId && !room.IsFull)
            {
                // Thông báo cho host biết màu của mình là đỏ
                await Clients.Caller.SendAsync("ColorAssigned", new { color = "red", waiting = true });
                return;
            }

            // Khách vào phòng lần đầu
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

                // Gửi cho khách biết màu đen
                await Clients.Caller.SendAsync("ColorAssigned", new
                {
                    color   = "black",
                    waiting = false,
                    gameId  = session.Id,
                    gameState = session.ToDto()
                });

                // Gửi cho host biết game đã bắt đầu
                await Clients.OthersInGroup(roomId).SendAsync("GameStarted", new
                {
                    color   = "red",
                    gameId  = session.Id,
                    gameState = session.ToDto(),
                    guestName = playerName
                });
                return;
            }

            // Reconnect — gửi lại trạng thái hiện tại
            if (!string.IsNullOrEmpty(room.GameId))
            {
                var session = _games.GetSession(room.GameId);
                if (session != null)
                {
                    var myColor = room.HostId == playerId ? "red" : "black";
                    await Clients.Caller.SendAsync("ColorAssigned", new
                    {
                        color   = myColor,
                        waiting = false,
                        gameId  = room.GameId,
                        gameState = session.ToDto()
                    });
                }
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
