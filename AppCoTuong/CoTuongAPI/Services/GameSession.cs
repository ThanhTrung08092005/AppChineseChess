using CoTuongAPI.Engine;
using CoTuongAPI.Models;

namespace CoTuongAPI.Services
{
    public class GameSession
    {
        public string      Id          { get; } = Guid.NewGuid().ToString("N")[..8];
        public Board       Board       { get; } = new();
        public string      Mode        { get; set; } = "pvai";
        public Stack<Move> History     { get; } = new();
        public DateTime    LastActive  { get; set; } = DateTime.UtcNow;

        public List<Move> CurrentLegalMoves { get; private set; } = [];
        public bool       IsGameOver        { get; set; }
        public string     Winner            { get; private set; } = "";

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
                    row.Add(p == null
                        ? new CellDto()
                        : new CellDto
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

            return new GameStateDto
            {
                GameId      = Id,
                CurrentTurn = Board.CurrentTurn == PieceColor.Red ? "red" : "black",
                Status      = status,
                Winner      = Winner,
                Mode        = Mode,
                Board       = boardDto,
                LegalMoves  = CurrentLegalMoves
                    .Select(m => new MoveDto(m.FromRow, m.FromCol, m.ToRow, m.ToCol))
                    .ToList(),
                LastMove    = lastMove == null ? null
                    : new MoveDto(lastMove.FromRow, lastMove.FromCol,
                                  lastMove.ToRow,   lastMove.ToCol)
            };
        }
    }
}
