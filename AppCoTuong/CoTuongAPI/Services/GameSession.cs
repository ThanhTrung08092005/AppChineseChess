using CoTuongAPI.Engine;
using CoTuongAPI.Models;

namespace CoTuongAPI.Services
{
    public class MoveRecord
    {
        public Move     Move      { get; set; } = null!;
        public string   Color     { get; set; } = "";
        public string?  Captured  { get; set; }
        public string?  CapturedType { get; set; }
        public bool     IsCheck   { get; set; }
    }

    public class GameSession
    {
        public string   Id         { get; } = Guid.NewGuid().ToString("N")[..8];
        public Board    Board      { get; } = new();
        public string   Mode       { get; set; } = "pvai";
        public DateTime LastActive { get; set; } = DateTime.UtcNow;

        public Stack<Move>        History     { get; } = new();
        public List<MoveRecord>   MoveHistory { get; } = [];

        public bool   IsGameOver { get; set; }
        public string Winner     { get; private set; } = "";

        // Đồng hồ
        public int      TimePerSide  { get; set; } = 600; // giây
        public int      RedTimeLeft  { get; set; } = 600;
        public int      BlackTimeLeft{ get; set; } = 600;
        public DateTime TurnStarted  { get; set; } = DateTime.UtcNow;

        public List<Move> CurrentLegalMoves { get; private set; } = [];

        public GameSession() => RefreshLegalMoves();

        public void RefreshLegalMoves()
        {
            CurrentLegalMoves = MoveGenerator.GenerateLegalMoves(Board, Board.CurrentTurn);
            if (CurrentLegalMoves.Count == 0)
            {
                IsGameOver = true;
                Winner     = Board.CurrentTurn == PieceColor.Red ? "black" : "red";
            }
        }

        /// <summary>Tính thời gian còn lại của lượt hiện tại</summary>
        public (int red, int black) GetCurrentTimes()
        {
            var elapsed = (int)(DateTime.UtcNow - TurnStarted).TotalSeconds;
            int red   = RedTimeLeft;
            int black = BlackTimeLeft;

            if (Board.CurrentTurn == PieceColor.Red)
                red   = Math.Max(0, red   - elapsed);
            else
                black = Math.Max(0, black - elapsed);

            return (red, black);
        }

        /// <summary>Ghi nhận nước đi vào lịch sử</summary>
        public void RecordMove(Move move, string color, Piece? captured)
        {
            // Cập nhật đồng hồ
            var elapsed = (int)(DateTime.UtcNow - TurnStarted).TotalSeconds;
            if (color == "red")
                RedTimeLeft   = Math.Max(0, RedTimeLeft   - elapsed);
            else
                BlackTimeLeft = Math.Max(0, BlackTimeLeft - elapsed);
            TurnStarted = DateTime.UtcNow;

            MoveHistory.Add(new MoveRecord
            {
                Move         = move,
                Color        = color,
                Captured     = captured?.Symbol,
                CapturedType = captured?.Type.ToString().ToLower(),
                IsCheck      = Board.IsInCheck(Board.CurrentTurn)
            });
        }

        public GameStateDto ToDto()
        {
            LastActive = DateTime.UtcNow;

            var boardDto = new List<List<CellDto>>();
            for (int r = 0; r < Board.Rows; r++)
            {
                var row = new List<CellDto>();
                for (int c = 0; c < Board.Cols; c++)
                {
                    var p = Board.GetPiece(r, c);
                    row.Add(p == null ? new CellDto() : new CellDto
                    {
                        Symbol = p.Symbol,
                        Color  = p.Color == PieceColor.Red ? "red" : "black",
                        Type   = p.Type.ToString().ToLower()
                    });
                }
                boardDto.Add(row);
            }

            string status = "playing";
            if (IsGameOver)
                status = "checkmate";
            else if (Board.IsInCheck(Board.CurrentTurn))
                status = "check";

            var lastMove = History.Count > 0 ? History.Peek() : null;
            var (redT, blackT) = GetCurrentTimes();

            // Quân bị ăn
            var capturedRed   = MoveHistory
                .Where(m => m.Captured != null && m.Color == "black")
                .Select(m => new CapturedDto { Symbol = m.Captured!, Type = m.CapturedType ?? "" })
                .ToList();
            var capturedBlack = MoveHistory
                .Where(m => m.Captured != null && m.Color == "red")
                .Select(m => new CapturedDto { Symbol = m.Captured!, Type = m.CapturedType ?? "" })
                .ToList();

            return new GameStateDto
            {
                GameId        = Id,
                CurrentTurn   = Board.CurrentTurn == PieceColor.Red ? "red" : "black",
                Status        = status,
                Winner        = Winner,
                Mode          = Mode,
                Board         = boardDto,
                LegalMoves    = CurrentLegalMoves
                    .Select(m => new MoveDto(m.FromRow, m.FromCol, m.ToRow, m.ToCol))
                    .ToList(),
                LastMove      = lastMove == null ? null
                    : new MoveDto(lastMove.FromRow, lastMove.FromCol, lastMove.ToRow, lastMove.ToCol),
                MoveHistory   = MoveHistory.Select((m, i) => new MoveHistoryDto
                {
                    Number   = i + 1,
                    Color    = m.Color,
                    Move     = new MoveDto(m.Move.FromRow, m.Move.FromCol, m.Move.ToRow, m.Move.ToCol),
                    Captured = m.Captured,
                    IsCheck  = m.IsCheck
                }).ToList(),
                CapturedRed   = capturedRed,
                CapturedBlack = capturedBlack,
                RedTimeLeft   = redT,
                BlackTimeLeft = blackT,
                MoveCount     = MoveHistory.Count
            };
        }
    }
}
