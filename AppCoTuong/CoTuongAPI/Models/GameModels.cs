namespace CoTuongAPI.Models
{
    public record MoveRequest(int FromRow, int FromCol, int ToRow, int ToCol);

    public record NewGameRequest(string Mode = "pvai", int TimePerSide = 600); // giây

    public class GameStateDto
    {
        public string   GameId      { get; set; } = "";
        public string   CurrentTurn { get; set; } = "red";
        public string   Status      { get; set; } = "playing";
        public string   Winner      { get; set; } = "";
        public string   Mode        { get; set; } = "pvai";
        public List<List<CellDto>> Board { get; set; } = [];
        public List<MoveDto>  LegalMoves   { get; set; } = [];
        public MoveDto?       LastMove     { get; set; }
        public List<MoveHistoryDto> MoveHistory { get; set; } = [];
        public List<CapturedDto>    CapturedRed   { get; set; } = []; // quân đỏ bị ăn
        public List<CapturedDto>    CapturedBlack { get; set; } = []; // quân đen bị ăn
        public int  RedTimeLeft   { get; set; }  // giây còn lại
        public int  BlackTimeLeft { get; set; }
        public int  MoveCount     { get; set; }
    }

    public class CellDto
    {
        public string? Symbol { get; set; }
        public string? Color  { get; set; }
        public string? Type   { get; set; }
    }

    public record MoveDto(int FromRow, int FromCol, int ToRow, int ToCol);

    public class MoveHistoryDto
    {
        public int     Number   { get; set; }
        public string  Color    { get; set; } = "";
        public MoveDto Move     { get; set; } = null!;
        public string? Captured { get; set; }  // symbol quân bị ăn
        public bool    IsCheck  { get; set; }
    }

    public class CapturedDto
    {
        public string Symbol { get; set; } = "";
        public string Type   { get; set; } = "";
    }

    public class AiMoveDto
    {
        public MoveDto?      Move          { get; set; }
        public GameStateDto? State         { get; set; }
        public int           NodesSearched { get; set; }
    }

    public class HintDto
    {
        public MoveDto?      BestMove      { get; set; }
        public int           Score         { get; set; }
        public int           NodesSearched { get; set; }
    }
}
