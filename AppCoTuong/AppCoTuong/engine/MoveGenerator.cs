namespace AppCoTuong.Engine
{
    /// <summary>
    /// Sinh tất cả nước đi hợp lệ (pseudo-legal và legal) cho cờ tướng
    /// </summary>
    public static class MoveGenerator
    {
        // ── Cung điện (palace) ────────────────────────────────────────────────
        private static bool InRedPalace(int r, int c)   => r >= 7 && r <= 9 && c >= 3 && c <= 5;
        private static bool InBlackPalace(int r, int c) => r >= 0 && r <= 2 && c >= 3 && c <= 5;

        // ── API chính ─────────────────────────────────────────────────────────

        /// <summary>Sinh tất cả nước đi pseudo-legal (chưa lọc chiếu tướng)</summary>
        public static List<Move> GeneratePseudoMoves(Board board, PieceColor color)
        {
            var moves = new List<Move>();
            for (int r = 0; r < Board.Rows; r++)
                for (int c = 0; c < Board.Cols; c++)
                {
                    var piece = board.GetPiece(r, c);
                    if (piece == null || piece.Color != color) continue;

                    moves.AddRange(piece.Type switch
                    {
                        PieceType.General  => GeneralMoves(board, r, c, color),
                        PieceType.Advisor  => AdvisorMoves(board, r, c, color),
                        PieceType.Elephant => ElephantMoves(board, r, c, color),
                        PieceType.Horse    => HorseMoves(board, r, c, color),
                        PieceType.Chariot  => ChariotMoves(board, r, c, color),
                        PieceType.Cannon   => CannonMoves(board, r, c, color),
                        PieceType.Soldier  => SoldierMoves(board, r, c, color),
                        _ => []
                    });
                }
            return moves;
        }

        /// <summary>Sinh nước đi legal (đã lọc bỏ nước đi khiến mình bị chiếu)</summary>
        public static List<Move> GenerateLegalMoves(Board board, PieceColor color)
        {
            var pseudo = GeneratePseudoMoves(board, color);
            var legal = new List<Move>();
            foreach (var move in pseudo)
            {
                board.ApplyMove(move);
                if (!board.IsInCheck(color))
                    legal.Add(move);
                board.UndoMove(move);
            }
            return legal;
        }

        // ── Tướng (General) ───────────────────────────────────────────────────
        private static IEnumerable<Move> GeneralMoves(Board board, int r, int c, PieceColor color)
        {
            int[][] dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
            bool inPalace(int nr, int nc) => color == PieceColor.Red
                ? InRedPalace(nr, nc) : InBlackPalace(nr, nc);

            foreach (var d in dirs)
            {
                int nr = r + d[0], nc = c + d[1];
                if (!Board.InBounds(nr, nc) || !inPalace(nr, nc)) continue;
                var target = board.GetPiece(nr, nc);
                if (target == null || target.Color != color)
                    yield return new Move(r, c, nr, nc, target);
            }

            // Tướng đối mặt (flying general)
            yield break;
        }

        // ── Sĩ (Advisor) ──────────────────────────────────────────────────────
        private static IEnumerable<Move> AdvisorMoves(Board board, int r, int c, PieceColor color)
        {
            int[][] dirs = [[1, 1], [1, -1], [-1, 1], [-1, -1]];
            bool inPalace(int nr, int nc) => color == PieceColor.Red
                ? InRedPalace(nr, nc) : InBlackPalace(nr, nc);

            foreach (var d in dirs)
            {
                int nr = r + d[0], nc = c + d[1];
                if (!Board.InBounds(nr, nc) || !inPalace(nr, nc)) continue;
                var target = board.GetPiece(nr, nc);
                if (target == null || target.Color != color)
                    yield return new Move(r, c, nr, nc, target);
            }
        }

        // ── Tượng (Elephant) ──────────────────────────────────────────────────
        private static IEnumerable<Move> ElephantMoves(Board board, int r, int c, PieceColor color)
        {
            // Di chuyển chéo 2 ô, không qua sông
            int[][] steps = [[2, 2], [2, -2], [-2, 2], [-2, -2]];
            int[][] blocks = [[1, 1], [1, -1], [-1, 1], [-1, -1]];

            for (int i = 0; i < steps.Length; i++)
            {
                int nr = r + steps[i][0], nc = c + steps[i][1];
                int br = r + blocks[i][0], bc = c + blocks[i][1];

                if (!Board.InBounds(nr, nc)) continue;
                // Không qua sông
                if (color == PieceColor.Red && nr < 5) continue;
                if (color == PieceColor.Black && nr > 4) continue;
                // Kiểm tra chân tượng
                if (!board.IsEmpty(br, bc)) continue;

                var target = board.GetPiece(nr, nc);
                if (target == null || target.Color != color)
                    yield return new Move(r, c, nr, nc, target);
            }
        }

        // ── Mã (Horse) ────────────────────────────────────────────────────────
        private static IEnumerable<Move> HorseMoves(Board board, int r, int c, PieceColor color)
        {
            // (bước thẳng 1, chéo 1) — kiểm tra chân mã
            int[][] moves =
            [
                [1, 0, 2, 1], [1, 0, 2, -1],
                [-1, 0, -2, 1], [-1, 0, -2, -1],
                [0, 1, 1, 2], [0, 1, -1, 2],
                [0, -1, 1, -2], [0, -1, -1, -2]
            ];

            foreach (var m in moves)
            {
                int br = r + m[0], bc = c + m[1]; // chân mã
                int nr = r + m[2], nc = c + m[3]; // đích

                if (!Board.InBounds(nr, nc)) continue;
                if (!board.IsEmpty(br, bc)) continue; // bị cản chân

                var target = board.GetPiece(nr, nc);
                if (target == null || target.Color != color)
                    yield return new Move(r, c, nr, nc, target);
            }
        }

        // ── Xe (Chariot) ──────────────────────────────────────────────────────
        private static IEnumerable<Move> ChariotMoves(Board board, int r, int c, PieceColor color)
        {
            int[][] dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
            foreach (var d in dirs)
            {
                int nr = r + d[0], nc = c + d[1];
                while (Board.InBounds(nr, nc))
                {
                    var target = board.GetPiece(nr, nc);
                    if (target == null)
                    {
                        yield return new Move(r, c, nr, nc);
                    }
                    else
                    {
                        if (target.Color != color)
                            yield return new Move(r, c, nr, nc, target);
                        break; // bị chặn
                    }
                    nr += d[0]; nc += d[1];
                }
            }
        }

        // ── Pháo (Cannon) ─────────────────────────────────────────────────────
        private static IEnumerable<Move> CannonMoves(Board board, int r, int c, PieceColor color)
        {
            int[][] dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
            foreach (var d in dirs)
            {
                int nr = r + d[0], nc = c + d[1];
                bool foundScreen = false;

                while (Board.InBounds(nr, nc))
                {
                    var target = board.GetPiece(nr, nc);
                    if (!foundScreen)
                    {
                        if (target == null)
                            yield return new Move(r, c, nr, nc); // di chuyển bình thường
                        else
                            foundScreen = true; // gặp bình phong
                    }
                    else
                    {
                        if (target != null)
                        {
                            if (target.Color != color)
                                yield return new Move(r, c, nr, nc, target); // ăn qua bình phong
                            break;
                        }
                    }
                    nr += d[0]; nc += d[1];
                }
            }
        }

        // ── Tốt (Soldier) ─────────────────────────────────────────────────────
        private static IEnumerable<Move> SoldierMoves(Board board, int r, int c, PieceColor color)
        {
            bool crossedRiver = color == PieceColor.Red ? r < 5 : r > 4;

            // Tiến thẳng
            int forward = color == PieceColor.Red ? -1 : 1;
            int nr = r + forward, nc = c;
            if (Board.InBounds(nr, nc))
            {
                var target = board.GetPiece(nr, nc);
                if (target == null || target.Color != color)
                    yield return new Move(r, c, nr, nc, target);
            }

            // Sang ngang (chỉ sau khi qua sông)
            if (crossedRiver)
            {
                foreach (int dc in new[] { -1, 1 })
                {
                    nc = c + dc;
                    if (Board.InBounds(r, nc))
                    {
                        var target = board.GetPiece(r, nc);
                        if (target == null || target.Color != color)
                            yield return new Move(r, c, r, nc, target);
                    }
                }
            }
        }
    }
}
