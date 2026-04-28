using CoTuongAPI.Engine;

namespace CoTuongAPI.Services
{
    /// <summary>
    /// Chuyển đổi Board ↔ FEN chuẩn UCCI (dùng cho Pikafish).
    ///
    /// Quy ước tọa độ UCCI:
    ///   - Cột: a–i  (a=col 0, i=col 8)
    ///   - Hàng: 0–9 (0=row 9 phía Đỏ, 9=row 0 phía Đen)
    ///     → hàng UCCI = 9 - row_board
    ///
    /// Ký hiệu FEN UCCI:
    ///   Đỏ  (uppercase): R=Xe, H=Mã, E=Tượng, A=Sĩ, K=Tướng, C=Pháo, P=Tốt
    ///   Đen (lowercase): r, h, e, a, k, c, p
    /// </summary>
    public static class FenConverter
    {
        // ── Board → FEN ───────────────────────────────────────────────────────
        public static string ToFen(Board board)
        {
            var rows = new List<string>();

            // FEN đọc từ hàng 0 (phía Đen, top) xuống hàng 9 (phía Đỏ, bottom)
            for (int r = 0; r < Board.Rows; r++)
            {
                int empty = 0;
                var sb = new System.Text.StringBuilder();

                for (int c = 0; c < Board.Cols; c++)
                {
                    var p = board.GetPiece(r, c);
                    if (p == null)
                    {
                        empty++;
                    }
                    else
                    {
                        if (empty > 0) { sb.Append(empty); empty = 0; }
                        sb.Append(PieceToFenChar(p));
                    }
                }
                if (empty > 0) sb.Append(empty);
                rows.Add(sb.ToString());
            }

            string boardStr = string.Join("/", rows);
            string turn     = board.CurrentTurn == PieceColor.Red ? "w" : "b";

            return $"{boardStr} {turn} - - 0 1";
        }

        // ── UCCI move string → (fromRow, fromCol, toRow, toCol) ──────────────
        /// <summary>
        /// Parse nước đi UCCI dạng "a0b2" hoặc "h9g7".
        /// UCCI: cột a-i, hàng 0-9 (0=đáy Đỏ).
        /// Board: row 0=top(Đen), row 9=bottom(Đỏ).
        /// → board_row = 9 - ucci_rank
        /// </summary>
        public static (int fromRow, int fromCol, int toRow, int toCol) ParseUcciMove(string move)
        {
            // move = "a0b2" → from=(col=0,rank=0) to=(col=1,rank=2)
            int fromCol  = move[0] - 'a';
            int fromRank = move[1] - '0';
            int toCol    = move[2] - 'a';
            int toRank   = move[3] - '0';

            int fromRow = 9 - fromRank;
            int toRow   = 9 - toRank;

            return (fromRow, fromCol, toRow, toCol);
        }

        // ── Helpers ───────────────────────────────────────────────────────────
        private static char PieceToFenChar(Piece p)
        {
            char c = p.Type switch
            {
                PieceType.General  => 'k',
                PieceType.Advisor  => 'a',
                PieceType.Elephant => 'e',
                PieceType.Horse    => 'h',
                PieceType.Chariot  => 'r',
                PieceType.Cannon   => 'c',
                PieceType.Soldier  => 'p',
                _                  => '?'
            };
            return p.Color == PieceColor.Red ? char.ToUpper(c) : c;
        }
    }
}
