using CoTuongAPI.Engine;

namespace CoTuongAPI.Services
{
    /// <summary>
    /// Chuyển đổi Board ↔ FEN chuẩn Pikafish/UCCI.
    ///
    /// Ký hiệu FEN chính thức (từ wiki Pikafish):
    ///   Đỏ  (uppercase): R=Xe, N=Mã, B=Tượng, A=Sĩ, K=Tướng, C=Pháo, P=Tốt
    ///   Đen (lowercase): r, n, b, a, k, c, p
    ///
    /// Tọa độ UCCI: cột a-i, hàng 0-9 (0=đáy Đỏ → board row 9)
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

        // ── FEN → Board ───────────────────────────────────────────────────────
        public static Board FromFen(string fen)
        {
            // FEN: "rnbakabnr/9/.../... w - - 0 1"
            var parts    = fen.Trim().Split(' ');
            var rows     = parts[0].Split('/');
            var turn     = parts.Length > 1 ? parts[1] : "w";

            if (rows.Length != Board.Rows)
                throw new ArgumentException($"FEN must have {Board.Rows} rows, got {rows.Length}");

            var board = new Board(skipSetup: true);

            for (int r = 0; r < Board.Rows; r++)
            {
                int c = 0;
                foreach (char ch in rows[r])
                {
                    if (char.IsDigit(ch))
                    {
                        c += ch - '0';
                    }
                    else
                    {
                        var piece = FenCharToPiece(ch);
                        board.SetPiece(r, c, piece);
                        c++;
                    }
                }
            }

            board.SetTurn(turn == "b" ? PieceColor.Black : PieceColor.Red);
            return board;
        }

        private static Piece FenCharToPiece(char ch)
        {
            var color = char.IsUpper(ch) ? PieceColor.Red : PieceColor.Black;
            var type  = char.ToLower(ch) switch
            {
                'k' => PieceType.General,
                'a' => PieceType.Advisor,
                'b' => PieceType.Elephant,  // b = Bishop/Tượng (chuẩn Pikafish)
                'e' => PieceType.Elephant,  // alias cũ
                'n' => PieceType.Horse,     // n = kNight/Mã (chuẩn Pikafish)
                'h' => PieceType.Horse,     // alias cũ
                'r' => PieceType.Chariot,
                'c' => PieceType.Cannon,
                'p' => PieceType.Soldier,
                _   => throw new ArgumentException($"Unknown FEN char: {ch}")
            };
            return new Piece(type, color);
        }
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
            // Dùng ký hiệu chuẩn Pikafish: n=Mã, b=Tượng
            char c = p.Type switch
            {
                PieceType.General  => 'k',
                PieceType.Advisor  => 'a',
                PieceType.Elephant => 'b',
                PieceType.Horse    => 'n',
                PieceType.Chariot  => 'r',
                PieceType.Cannon   => 'c',
                PieceType.Soldier  => 'p',
                _                  => '?'
            };
            return p.Color == PieceColor.Red ? char.ToUpper(c) : c;
        }
    }
}
