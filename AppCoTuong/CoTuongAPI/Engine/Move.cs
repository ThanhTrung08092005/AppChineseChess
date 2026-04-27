namespace CoTuongAPI.Engine
{
    public class Move
    {
        public int    FromRow       { get; }
        public int    FromCol       { get; }
        public int    ToRow         { get; }
        public int    ToCol         { get; }
        public Piece? CapturedPiece { get; set; }

        /// Điểm ưu tiên dùng cho Move Ordering trong AI
        public int Score { get; set; }

        public Move(int fromRow, int fromCol, int toRow, int toCol, Piece? captured = null)
        {
            FromRow       = fromRow;
            FromCol       = fromCol;
            ToRow         = toRow;
            ToCol         = toCol;
            CapturedPiece = captured;
        }
    }
}
