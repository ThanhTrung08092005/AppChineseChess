using CoTuongAPI.Engine;

namespace CoTuongAPI.AI
{
    public static class Evaluation
    {
        // ── Giá trị quân ──────────────────────────────────────────────────────
        public static readonly Dictionary<PieceType, int> PieceValue = new()
        {
            { PieceType.General,  100000 },
            { PieceType.Chariot,    900 },
            { PieceType.Cannon,     450 },
            { PieceType.Horse,      400 },
            { PieceType.Elephant,   200 },
            { PieceType.Advisor,    200 },
            { PieceType.Soldier,    100 },
        };

        // ── Bảng vị trí (PST) — góc nhìn từ phía Đỏ (row 9 = hàng đáy Đỏ) ──

        private static readonly int[,] ChariotPST =
        {
            { 14, 14, 12, 18, 16, 18, 12, 14, 14 },
            { 16, 20, 18, 24, 26, 24, 18, 20, 16 },
            { 12, 12, 12, 18, 18, 18, 12, 12, 12 },
            { 12, 18, 16, 22, 22, 22, 16, 18, 12 },
            { 12, 14, 12, 18, 18, 18, 12, 14, 12 },
            { 12, 16, 14, 20, 20, 20, 14, 16, 12 },
            { 6,  10,  8, 14, 14, 14,  8, 10,  6 },
            { 6,   8,  6, 14, 12, 14,  6,  8,  6 },
            { 6,   6,  6, 12, 10, 12,  6,  6,  6 },
            { 0,   6,  6, 14,  0, 14,  6,  6,  0 },
        };

        private static readonly int[,] HorsePST =
        {
            {  4,  8,  16, 12,  4, 12, 16,  8,  4 },
            {  4, 10,  28, 16,  8, 16, 28, 10,  4 },
            {  8, 24,  18, 24, 20, 24, 18, 24,  8 },
            { 12, 14,  16, 20, 18, 20, 16, 14, 12 },
            {  8, 18,  16, 18, 16, 18, 16, 18,  8 },
            {  4, 12,  14, 18, 16, 18, 14, 12,  4 },
            {  4,  8,  12, 12,  4, 12, 12,  8,  4 },
            {  0,  4,   8,  4,  0,  4,  8,  4,  0 },
            {  0,  2,   4,  4, -2,  4,  4,  2,  0 },
            {  0,  0,   0,  0,  0,  0,  0,  0,  0 },
        };

        private static readonly int[,] CannonPST =
        {
            {  6,  4,  0, -10,  0, -10,  0,  4,  6 },
            {  2,  2,  0,  -4, -4,  -4,  0,  2,  2 },
            {  2,  6,  4,   0,  0,   0,  4,  6,  2 },
            {  0,  0,  0,   0,  0,   0,  0,  0,  0 },
            {  0,  0,  0,   0,  0,   0,  0,  0,  0 },
            { -2,  0,  4,   2,  6,   2,  4,  0, -2 },
            {  0,  0,  0,   2,  6,   2,  0,  0,  0 },
            {  4,  0,  8,   6,  0,   6,  8,  0,  4 },
            {  0,  2,  4,   6,  6,   6,  4,  2,  0 },
            {  0,  0,  2,   6,  6,   6,  2,  0,  0 },
        };

        private static readonly int[,] SoldierPST =
        {
            {  0,  0,  0,  0,  0,  0,  0,  0,  0 },
            {  0,  0,  0,  0,  0,  0,  0,  0,  0 },
            {  0,  0,  0,  0,  0,  0,  0,  0,  0 },
            {  0,  0,  0,  0,  0,  0,  0,  0,  0 },
            {  0,  0,  0,  0,  0,  0,  0,  0,  0 },
            {  4,  0,  4,  0,  4,  0,  4,  0,  4 },
            {  8,  8, 12, 12, 14, 12, 12,  8,  8 },
            { 16, 22, 22, 26, 30, 26, 22, 22, 16 },
            { 16, 22, 22, 26, 30, 26, 22, 22, 16 },
            {  0,  0,  0,  0,  0,  0,  0,  0,  0 },
        };

        // ── Đánh giá tổng thể ─────────────────────────────────────────────────
        public static int Evaluate(Board board)
        {
            int score = 0;
            for (int r = 0; r < Board.Rows; r++)
                for (int c = 0; c < Board.Cols; c++)
                {
                    var p = board.GetPiece(r, c);
                    if (p == null) continue;

                    int baseVal = PieceValue.TryGetValue(p.Type, out int v) ? v : 0;
                    int pst     = GetPST(p, r, c);
                    int total   = baseVal + pst;

                    score += p.Color == PieceColor.Red ? total : -total;
                }
            return score;
        }

        private static int GetPST(Piece p, int r, int c)
        {
            // Đỏ nhìn từ dưới lên (row 9 = đáy), Đen nhìn từ trên xuống (row 0 = đáy)
            int tr = p.Color == PieceColor.Red ? r : (Board.Rows - 1 - r);
            int tc = p.Color == PieceColor.Red ? c : (Board.Cols - 1 - c);

            return p.Type switch
            {
                PieceType.Chariot => ChariotPST[tr, tc],
                PieceType.Horse   => HorsePST  [tr, tc],
                PieceType.Cannon  => CannonPST [tr, tc],
                PieceType.Soldier => SoldierPST[tr, tc],
                _ => 0
            };
        }
    }
}
