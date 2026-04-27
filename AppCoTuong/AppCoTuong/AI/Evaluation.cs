using AppCoTuong.Engine;

namespace AppCoTuong.AI
{
    /// <summary>
    /// Đánh giá thế cờ theo điểm số (dương = lợi cho Đỏ, âm = lợi cho Đen)
    /// </summary>
    public static class Evaluation
    {
        // ── Giá trị cơ bản của từng loại quân ────────────────────────────────
        private static readonly Dictionary<PieceType, int> PieceValue = new()
        {
            { PieceType.General,  10000 },
            { PieceType.Chariot,   900 },
            { PieceType.Cannon,    450 },
            { PieceType.Horse,     400 },
            { PieceType.Elephant,  200 },
            { PieceType.Advisor,   200 },
            { PieceType.Soldier,   100 },
        };

        // ── Bảng điểm vị trí cho Tốt Đỏ (row 0 = phía Đen) ──────────────────
        private static readonly int[,] SoldierRedTable =
        {
            { 0,  0,  0,  0,  0,  0,  0,  0,  0 },
            { 0,  0,  0,  0,  0,  0,  0,  0,  0 },
            { 0,  0,  0,  0,  0,  0,  0,  0,  0 },
            { 0,  0,  0,  0,  0,  0,  0,  0,  0 },
            { 0,  0,  0,  0,  0,  0,  0,  0,  0 },
            { 4,  0,  4,  0,  4,  0,  4,  0,  4 }, // vừa qua sông
            { 8,  8, 12, 12, 14, 12, 12,  8,  8 },
            {16, 22, 22, 26, 30, 26, 22, 22, 16 },
            {16, 22, 22, 26, 30, 26, 22, 22, 16 },
            { 0,  0,  0,  0,  0,  0,  0,  0,  0 },
        };

        // ── Đánh giá tổng thể ─────────────────────────────────────────────────

        public static int Evaluate(Board board)
        {
            int score = 0;

            for (int r = 0; r < Board.Rows; r++)
                for (int c = 0; c < Board.Cols; c++)
                {
                    var piece = board.GetPiece(r, c);
                    if (piece == null) continue;

                    int value = PieceValue.TryGetValue(piece.Type, out int v) ? v : 0;

                    // Bonus vị trí cho Tốt
                    if (piece.Type == PieceType.Soldier)
                    {
                        int tableRow = piece.Color == PieceColor.Red ? r : (Board.Rows - 1 - r);
                        value += SoldierRedTable[tableRow, c];
                    }

                    score += piece.Color == PieceColor.Red ? value : -value;
                }

            return score;
        }
    }
}
