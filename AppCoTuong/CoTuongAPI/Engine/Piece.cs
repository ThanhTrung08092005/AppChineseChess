namespace CoTuongAPI.Engine
{
    public class Piece
    {
        public PieceType  Type  { get; set; }
        public PieceColor Color { get; set; }

        public Piece(PieceType type, PieceColor color)
        {
            Type  = type;
            Color = color;
        }

        public string Symbol => (Type, Color) switch
        {
            (PieceType.General,  PieceColor.Red)   => "帥",
            (PieceType.General,  PieceColor.Black) => "將",
            (PieceType.Advisor,  PieceColor.Red)   => "仕",
            (PieceType.Advisor,  PieceColor.Black) => "士",
            (PieceType.Elephant, PieceColor.Red)   => "相",
            (PieceType.Elephant, PieceColor.Black) => "象",
            (PieceType.Horse,    PieceColor.Red)   => "傌",
            (PieceType.Horse,    PieceColor.Black) => "馬",
            (PieceType.Chariot,  PieceColor.Red)   => "俥",
            (PieceType.Chariot,  PieceColor.Black) => "車",
            (PieceType.Cannon,   PieceColor.Red)   => "炮",
            (PieceType.Cannon,   PieceColor.Black) => "砲",
            (PieceType.Soldier,  PieceColor.Red)   => "兵",
            (PieceType.Soldier,  PieceColor.Black) => "卒",
            _ => "·"
        };
    }
}
