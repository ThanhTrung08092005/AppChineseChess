namespace CoTuongAPI.Models
{
    public record MoveRequest(int FromRow, int FromCol, int ToRow, int ToCol);

    public record NewGameRequest(string Mode = "pvai"); // "pvai" | "pvp"

    public class GameStateDto
    {
        public string   GameId      { get; set; } = "";
        public string   CurrentTurn { get; set; } = "red";
        public string   Status      { get; set; } = "playing"; // playing | check | checkmate | draw
        public string   Winner      { get; set; } = "";
        public string   Mode        { get; set; } = "pvai";
        public List<List<CellDto>> Board { get; set; } = [];
        public List<MoveDto> LegalMoves  { get; set; } = [];
        public MoveDto? LastMove    { get; set; }
    }

    public class CellDto
    {
        public string? Symbol { get; set; }
        public string? Color  { get; set; }  // "red" | "black" | null
        public string? Type   { get; set; }  // "general" | "chariot" | ...
    }

    public record MoveDto(int FromRow, int FromCol, int ToRow, int ToCol);

    public class AiMoveDto
    {
        public MoveDto?      Move       { get; set; }
        public GameStateDto? State      { get; set; }
        public int           NodesSearched { get; set; }
    }
}
