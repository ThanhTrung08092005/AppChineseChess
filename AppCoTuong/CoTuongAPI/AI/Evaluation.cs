using CoTuongAPI.Engine;

namespace CoTuongAPI.AI
{
    /// <summary>
    /// Evaluation nâng cấp:
    /// - Giá trị quân chuẩn theo lý thuyết cờ tướng
    /// - PST (Position Score Table) chi tiết cho tất cả 7 loại quân
    /// - Mobility bonus (số nước đi hợp lệ)
    /// - King safety (tướng bị lộ)
    /// - Pawn structure (tốt qua sông)
    /// - Endgame detection (điều chỉnh theo giai đoạn ván cờ)
    /// </summary>
    public static class Evaluation
    {
        // ── Giá trị quân (centipawns) ─────────────────────────────────────────
        // Nguồn: lý thuyết cờ tướng chuẩn + tham khảo Pikafish piece values
        public static readonly Dictionary<PieceType, int> PieceValue = new()
        {
            { PieceType.General,  100000 }, // Tướng — vô giá
            { PieceType.Chariot,    1000 }, // Xe — mạnh nhất
            { PieceType.Cannon,      450 }, // Pháo
            { PieceType.Horse,       400 }, // Mã
            { PieceType.Elephant,    200 }, // Tượng
            { PieceType.Advisor,     200 }, // Sĩ
            { PieceType.Soldier,     100 }, // Tốt (chưa qua sông)
        };

        // ── PST: Xe (Chariot) ─────────────────────────────────────────────────
        // Xe mạnh nhất ở hàng 2 (tấn công), yếu ở góc
        private static readonly int[,] ChariotPST =
        {
            { 14, 14, 12, 18, 16, 18, 12, 14, 14 },
            { 16, 20, 18, 24, 26, 24, 18, 20, 16 },
            { 12, 12, 12, 18, 18, 18, 12, 12, 12 },
            { 12, 18, 16, 22, 22, 22, 16, 18, 12 },
            { 12, 14, 12, 18, 18, 18, 12, 14, 12 },
            { 12, 16, 14, 20, 20, 20, 14, 16, 12 },
            {  6, 10,  8, 14, 14, 14,  8, 10,  6 },
            {  6,  8,  6, 14, 12, 14,  6,  8,  6 },
            {  6,  6,  6, 12, 10, 12,  6,  6,  6 },
            {  0,  6,  6, 14,  0, 14,  6,  6,  0 },
        };

        // ── PST: Mã (Horse) ───────────────────────────────────────────────────
        // Mã mạnh ở trung tâm, yếu ở góc và hàng đáy
        private static readonly int[,] HorsePST =
        {
            {  4,  8, 16, 12,  4, 12, 16,  8,  4 },
            {  4, 10, 28, 16,  8, 16, 28, 10,  4 },
            {  8, 24, 18, 24, 20, 24, 18, 24,  8 },
            { 12, 14, 16, 20, 18, 20, 16, 14, 12 },
            {  8, 18, 16, 18, 16, 18, 16, 18,  8 },
            {  4, 12, 14, 18, 16, 18, 14, 12,  4 },
            {  4,  8, 12, 12,  4, 12, 12,  8,  4 },
            {  0,  4,  8,  4,  0,  4,  8,  4,  0 },
            {  0,  2,  4,  4, -2,  4,  4,  2,  0 },
            {  0,  0,  0,  0,  0,  0,  0,  0,  0 },
        };

        // ── PST: Pháo (Cannon) ────────────────────────────────────────────────
        // Pháo mạnh ở hàng 3 (tấn công qua bình phong), yếu ở trung tâm khai cuộc
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

        // ── PST: Tốt (Soldier) ────────────────────────────────────────────────
        // Tốt chưa qua sông = 0 bonus, qua sông tăng mạnh
        private static readonly int[,] SoldierPST =
        {
            {  0,  0,  0,  0,  0,  0,  0,  0,  0 },
            {  0,  0,  0,  0,  0,  0,  0,  0,  0 },
            {  0,  0,  0,  0,  0,  0,  0,  0,  0 },
            {  0,  0,  0,  0,  0,  0,  0,  0,  0 },
            {  0,  0,  0,  0,  0,  0,  0,  0,  0 },
            {  4,  0,  4,  0,  4,  0,  4,  0,  4 }, // vừa qua sông
            {  8,  8, 12, 12, 14, 12, 12,  8,  8 },
            { 16, 22, 22, 26, 30, 26, 22, 22, 16 },
            { 16, 22, 22, 26, 30, 26, 22, 22, 16 },
            {  0,  0,  0,  0,  0,  0,  0,  0,  0 }, // hàng đáy — không thể ở đây
        };

        // ── PST: Tướng (General) ──────────────────────────────────────────────
        // Tướng nên ở trung tâm cung điện, tránh bị lộ
        private static readonly int[,] GeneralPST =
        {
            {  0,  0,  0,  0,  0,  0,  0,  0,  0 },
            {  0,  0,  0,  0,  0,  0,  0,  0,  0 },
            {  0,  0,  0,  0,  0,  0,  0,  0,  0 },
            {  0,  0,  0,  0,  0,  0,  0,  0,  0 },
            {  0,  0,  0,  0,  0,  0,  0,  0,  0 },
            {  0,  0,  0,  0,  0,  0,  0,  0,  0 },
            {  0,  0,  0,  0,  0,  0,  0,  0,  0 },
            {  0,  0,  0, 10, 10, 10,  0,  0,  0 },
            {  0,  0,  0, 10, 20, 10,  0,  0,  0 },
            {  0,  0,  0, 10, 10, 10,  0,  0,  0 },
        };

        // ── PST: Sĩ (Advisor) ─────────────────────────────────────────────────
        private static readonly int[,] AdvisorPST =
        {
            {  0,  0,  0,  0,  0,  0,  0,  0,  0 },
            {  0,  0,  0,  0,  0,  0,  0,  0,  0 },
            {  0,  0,  0,  0,  0,  0,  0,  0,  0 },
            {  0,  0,  0,  0,  0,  0,  0,  0,  0 },
            {  0,  0,  0,  0,  0,  0,  0,  0,  0 },
            {  0,  0,  0,  0,  0,  0,  0,  0,  0 },
            {  0,  0,  0,  0,  0,  0,  0,  0,  0 },
            {  0,  0,  0, 20,  0, 20,  0,  0,  0 },
            {  0,  0,  0,  0, 23,  0,  0,  0,  0 },
            {  0,  0,  0, 20,  0, 20,  0,  0,  0 },
        };

        // ── PST: Tượng (Elephant) ─────────────────────────────────────────────
        private static readonly int[,] ElephantPST =
        {
            {  0,  0,  0,  0,  0,  0,  0,  0,  0 },
            {  0,  0,  0,  0,  0,  0,  0,  0,  0 },
            {  0,  0,  0,  0,  0,  0,  0,  0,  0 },
            {  0,  0,  0,  0,  0,  0,  0,  0,  0 },
            {  0,  0,  0,  0,  0,  0,  0,  0,  0 },
            {  0,  0, 20,  0,  0,  0, 20,  0,  0 },
            {  0,  0,  0,  0,  0,  0,  0,  0,  0 },
            { 18,  0,  0,  0, 23,  0,  0,  0, 18 },
            {  0,  0,  0,  0,  0,  0,  0,  0,  0 },
            {  0,  0, 20,  0,  0,  0, 20,  0,  0 },
        };

        // ── Đánh giá tổng thể ─────────────────────────────────────────────────
        public static int Evaluate(Board board)
        {
            int score = 0;
            int redMaterial   = 0;
            int blackMaterial = 0;

            // Pass 1: tính material để detect endgame
            for (int r = 0; r < Board.Rows; r++)
                for (int c = 0; c < Board.Cols; c++)
                {
                    var p = board.GetPiece(r, c);
                    if (p == null || p.Type == PieceType.General) continue;
                    int v = PieceValue.TryGetValue(p.Type, out int pv) ? pv : 0;
                    if (p.Color == PieceColor.Red)   redMaterial   += v;
                    else                              blackMaterial += v;
                }

            // Endgame factor: 0 = opening/midgame, 1 = endgame
            int totalMaterial = redMaterial + blackMaterial;
            int maxMaterial   = 2 * (1000 + 450 + 400 + 200 + 200 + 5 * 100); // ~4700
            float endgame     = 1.0f - Math.Min(1.0f, totalMaterial / (float)maxMaterial);

            // Pass 2: tính điểm
            for (int r = 0; r < Board.Rows; r++)
                for (int c = 0; c < Board.Cols; c++)
                {
                    var p = board.GetPiece(r, c);
                    if (p == null) continue;

                    int baseVal = PieceValue.TryGetValue(p.Type, out int v) ? v : 0;
                    int pst     = GetPST(p, r, c);

                    // Tốt qua sông bonus (tăng theo endgame)
                    if (p.Type == PieceType.Soldier)
                    {
                        bool crossed = p.Color == PieceColor.Red ? r < 5 : r > 4;
                        if (crossed) baseVal += (int)(50 * endgame);
                    }

                    int total = baseVal + pst;
                    score += p.Color == PieceColor.Red ? total : -total;
                }

            // ── Mobility bonus ────────────────────────────────────────────────
            // Bên có nhiều nước đi hơn = lợi thế nhỏ
            var redMoves   = MoveGenerator.GeneratePseudoMoves(board, PieceColor.Red).Count;
            var blackMoves = MoveGenerator.GeneratePseudoMoves(board, PieceColor.Black).Count;
            score += (redMoves - blackMoves) * 2;

            // ── King safety ───────────────────────────────────────────────────
            // Tướng bị chiếu = penalty
            if (board.IsInCheck(PieceColor.Red))   score -= 30;
            if (board.IsInCheck(PieceColor.Black))  score += 30;

            return score;
        }

        private static int GetPST(Piece p, int r, int c)
        {
            // Đỏ nhìn từ dưới lên (row 9 = đáy), Đen nhìn từ trên xuống (row 0 = đáy)
            int tr = p.Color == PieceColor.Red ? r : (Board.Rows - 1 - r);
            int tc = p.Color == PieceColor.Red ? c : (Board.Cols - 1 - c);

            return p.Type switch
            {
                PieceType.General  => GeneralPST [tr, tc],
                PieceType.Advisor  => AdvisorPST [tr, tc],
                PieceType.Elephant => ElephantPST[tr, tc],
                PieceType.Chariot  => ChariotPST [tr, tc],
                PieceType.Horse    => HorsePST   [tr, tc],
                PieceType.Cannon   => CannonPST  [tr, tc],
                PieceType.Soldier  => SoldierPST [tr, tc],
                _ => 0
            };
        }
    }
}
