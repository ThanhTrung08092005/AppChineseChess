namespace CoTuongAPI.Engine
{
    public static class MoveGenerator
    {
        private static bool InRedPalace(int r, int c)   => r >= 7 && r <= 9 && c >= 3 && c <= 5;
        private static bool InBlackPalace(int r, int c) => r >= 0 && r <= 2 && c >= 3 && c <= 5;

        public static List<Move> GeneratePseudoMoves(Board board, PieceColor color)
        {
            var moves = new List<Move>(64);
            for (int r = 0; r < Board.Rows; r++)
                for (int c = 0; c < Board.Cols; c++)
                {
                    var piece = board.GetPiece(r, c);
                    if (piece == null || piece.Color != color) continue;
                    moves.AddRange(piece.Type switch
                    {
                        PieceType.General  => GeneralMoves (board, r, c, color),
                        PieceType.Advisor  => AdvisorMoves (board, r, c, color),
                        PieceType.Elephant => ElephantMoves(board, r, c, color),
                        PieceType.Horse    => HorseMoves   (board, r, c, color),
                        PieceType.Chariot  => ChariotMoves (board, r, c, color),
                        PieceType.Cannon   => CannonMoves  (board, r, c, color),
                        PieceType.Soldier  => SoldierMoves (board, r, c, color),
                        _ => []
                    });
                }
            return moves;
        }

        public static List<Move> GenerateLegalMoves(Board board, PieceColor color)
        {
            var pseudo = GeneratePseudoMoves(board, color);
            var legal  = new List<Move>(pseudo.Count);
            foreach (var m in pseudo)
            {
                board.ApplyMove(m);
                if (!board.IsInCheck(color)) legal.Add(m);
                board.UndoMove(m);
            }
            return legal;
        }

        // ── Tướng ─────────────────────────────────────────────────────────────
        private static IEnumerable<Move> GeneralMoves(Board b, int r, int c, PieceColor color)
        {
            bool InPalace(int nr, int nc) => color == PieceColor.Red
                ? InRedPalace(nr, nc) : InBlackPalace(nr, nc);

            foreach (var (dr, dc) in new[]{(1,0),(-1,0),(0,1),(0,-1)})
            {
                int nr = r+dr, nc = c+dc;
                if (!Board.InBounds(nr,nc) || !InPalace(nr,nc)) continue;
                var t = b.GetPiece(nr,nc);
                if (t == null || t.Color != color) yield return new Move(r,c,nr,nc,t);
            }
        }

        // ── Sĩ ────────────────────────────────────────────────────────────────
        private static IEnumerable<Move> AdvisorMoves(Board b, int r, int c, PieceColor color)
        {
            bool InPalace(int nr, int nc) => color == PieceColor.Red
                ? InRedPalace(nr, nc) : InBlackPalace(nr, nc);

            foreach (var (dr, dc) in new[]{(1,1),(1,-1),(-1,1),(-1,-1)})
            {
                int nr = r+dr, nc = c+dc;
                if (!Board.InBounds(nr,nc) || !InPalace(nr,nc)) continue;
                var t = b.GetPiece(nr,nc);
                if (t == null || t.Color != color) yield return new Move(r,c,nr,nc,t);
            }
        }

        // ── Tượng ─────────────────────────────────────────────────────────────
        private static IEnumerable<Move> ElephantMoves(Board b, int r, int c, PieceColor color)
        {
            (int dr, int dc, int br, int bc)[] moves =
            [
                ( 2, 2, 1, 1),( 2,-2, 1,-1),
                (-2, 2,-1, 1),(-2,-2,-1,-1)
            ];
            foreach (var (dr,dc,bdr,bdc) in moves)
            {
                int nr = r+dr, nc = c+dc;
                if (!Board.InBounds(nr,nc)) continue;
                if (color == PieceColor.Red   && nr < 5) continue;
                if (color == PieceColor.Black && nr > 4) continue;
                if (!b.IsEmpty(r+bdr, c+bdc)) continue;
                var t = b.GetPiece(nr,nc);
                if (t == null || t.Color != color) yield return new Move(r,c,nr,nc,t);
            }
        }

        // ── Mã ────────────────────────────────────────────────────────────────
        private static IEnumerable<Move> HorseMoves(Board b, int r, int c, PieceColor color)
        {
            (int dr, int dc, int br, int bc)[] moves =
            [
                ( 2, 1, 1, 0),( 2,-1, 1, 0),
                (-2, 1,-1, 0),(-2,-1,-1, 0),
                ( 1, 2, 0, 1),(-1, 2, 0, 1),
                ( 1,-2, 0,-1),(-1,-2, 0,-1)
            ];
            foreach (var (dr,dc,bdr,bdc) in moves)
            {
                int nr = r+dr, nc = c+dc;
                if (!Board.InBounds(nr,nc)) continue;
                if (!b.IsEmpty(r+bdr, c+bdc)) continue;
                var t = b.GetPiece(nr,nc);
                if (t == null || t.Color != color) yield return new Move(r,c,nr,nc,t);
            }
        }

        // ── Xe ────────────────────────────────────────────────────────────────
        private static IEnumerable<Move> ChariotMoves(Board b, int r, int c, PieceColor color)
        {
            foreach (var (dr,dc) in new[]{(1,0),(-1,0),(0,1),(0,-1)})
            {
                int nr = r+dr, nc = c+dc;
                while (Board.InBounds(nr,nc))
                {
                    var t = b.GetPiece(nr,nc);
                    if (t == null) { yield return new Move(r,c,nr,nc); }
                    else
                    {
                        if (t.Color != color) yield return new Move(r,c,nr,nc,t);
                        break;
                    }
                    nr += dr; nc += dc;
                }
            }
        }

        // ── Pháo ──────────────────────────────────────────────────────────────
        private static IEnumerable<Move> CannonMoves(Board b, int r, int c, PieceColor color)
        {
            foreach (var (dr,dc) in new[]{(1,0),(-1,0),(0,1),(0,-1)})
            {
                int nr = r+dr, nc = c+dc;
                bool screen = false;
                while (Board.InBounds(nr,nc))
                {
                    var t = b.GetPiece(nr,nc);
                    if (!screen)
                    {
                        if (t == null) yield return new Move(r,c,nr,nc);
                        else screen = true;
                    }
                    else
                    {
                        if (t != null)
                        {
                            if (t.Color != color) yield return new Move(r,c,nr,nc,t);
                            break;
                        }
                    }
                    nr += dr; nc += dc;
                }
            }
        }

        // ── Tốt ───────────────────────────────────────────────────────────────
        private static IEnumerable<Move> SoldierMoves(Board b, int r, int c, PieceColor color)
        {
            bool crossed = color == PieceColor.Red ? r < 5 : r > 4;
            int  fwd     = color == PieceColor.Red ? -1 : 1;

            int nr = r+fwd, nc = c;
            if (Board.InBounds(nr,nc))
            {
                var t = b.GetPiece(nr,nc);
                if (t == null || t.Color != color) yield return new Move(r,c,nr,nc,t);
            }
            if (crossed)
            {
                foreach (int dc in new[]{-1,1})
                {
                    nc = c+dc;
                    if (!Board.InBounds(r,nc)) continue;
                    var t = b.GetPiece(r,nc);
                    if (t == null || t.Color != color) yield return new Move(r,c,r,nc,t);
                }
            }
        }
    }
}
