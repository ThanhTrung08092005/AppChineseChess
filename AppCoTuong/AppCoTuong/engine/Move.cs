namespace AppCoTuong.Engine
{
    /// <summary>
    /// Đại diện một nước đi trên bàn cờ
    /// </summary>
    public class Move
    {
        public int FromRow { get; }
        public int FromCol { get; }
        public int ToRow { get; }
        public int ToCol { get; }

        /// <summary>Quân bị ăn (null nếu không ăn quân nào)</summary>
        public Piece? CapturedPiece { get; set; }

        public Move(int fromRow, int fromCol, int toRow, int toCol, Piece? captured = null)
        {
            FromRow = fromRow;
            FromCol = fromCol;
            ToRow = toRow;
            ToCol = toCol;
            CapturedPiece = captured;
        }

        public override string ToString()
            => $"({FromRow},{FromCol}) -> ({ToRow},{ToCol})"
               + (CapturedPiece != null ? $" x{CapturedPiece.Symbol}" : string.Empty);
    }
}
