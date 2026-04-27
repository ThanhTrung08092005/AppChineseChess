namespace AppCoTuong.Engine
{
    /// <summary>
    /// Bàn cờ tướng 10 hàng x 9 cột (row 0-9, col 0-8).
    /// Hàng 0-4: phía Đen (Black), hàng 5-9: phía Đỏ (Red).
    /// </summary>
    public class Board
    {
        public const int Rows = 10;
        public const int Cols = 9;

        private readonly Piece?[,] _grid = new Piece?[Rows, Cols];

        public PieceColor CurrentTurn { get; private set; } = PieceColor.Red;

        // ── Khởi tạo ──────────────────────────────────────────────────────────

        public Board()
        {
            SetupInitialPosition();
        }

        // Constructor nội bộ dùng cho Clone — không gọi SetupInitialPosition
        private Board(bool empty)
        {
            if (!empty) SetupInitialPosition();
        }

        /// <summary>Đặt quân về vị trí ban đầu</summary>
        public void SetupInitialPosition()
        {
            Array.Clear(_grid, 0, _grid.Length);

            // Quân Đen (hàng trên, row 0-4)
            PlaceRow(0, PieceColor.Black,
                PieceType.Chariot, PieceType.Horse, PieceType.Elephant,
                PieceType.Advisor, PieceType.General,
                PieceType.Advisor, PieceType.Elephant,
                PieceType.Horse,   PieceType.Chariot);

            _grid[2, 1] = new Piece(PieceType.Cannon, PieceColor.Black);
            _grid[2, 7] = new Piece(PieceType.Cannon, PieceColor.Black);

            foreach (int col in new[] { 0, 2, 4, 6, 8 })
                _grid[3, col] = new Piece(PieceType.Soldier, PieceColor.Black);

            // Quân Đỏ (hàng dưới, row 5-9)
            _grid[7, 1] = new Piece(PieceType.Cannon, PieceColor.Red);
            _grid[7, 7] = new Piece(PieceType.Cannon, PieceColor.Red);

            foreach (int col in new[] { 0, 2, 4, 6, 8 })
                _grid[6, col] = new Piece(PieceType.Soldier, PieceColor.Red);

            PlaceRow(9, PieceColor.Red,
                PieceType.Chariot, PieceType.Horse, PieceType.Elephant,
                PieceType.Advisor, PieceType.General,
                PieceType.Advisor, PieceType.Elephant,
                PieceType.Horse,   PieceType.Chariot);

            CurrentTurn = PieceColor.Red;
        }

        private void PlaceRow(int row, PieceColor color, params PieceType[] types)
        {
            for (int col = 0; col < types.Length; col++)
                _grid[row, col] = new Piece(types[col], color);
        }

        // ── Truy cập ô ────────────────────────────────────────────────────────

        public Piece? GetPiece(int row, int col) => _grid[row, col];

        public bool IsEmpty(int row, int col) => _grid[row, col] == null;

        public static bool InBounds(int row, int col)
            => row >= 0 && row < Rows && col >= 0 && col < Cols;

        // ── Thực hiện / hoàn tác nước đi ──────────────────────────────────────

        /// <summary>Thực hiện nước đi (không kiểm tra hợp lệ)</summary>
        public void ApplyMove(Move move)
        {
            move.CapturedPiece = _grid[move.ToRow, move.ToCol];
            _grid[move.ToRow, move.ToCol]     = _grid[move.FromRow, move.FromCol];
            _grid[move.FromRow, move.FromCol] = null;
            CurrentTurn = CurrentTurn == PieceColor.Red ? PieceColor.Black : PieceColor.Red;
        }

        /// <summary>Hoàn tác nước đi</summary>
        public void UndoMove(Move move)
        {
            _grid[move.FromRow, move.FromCol] = _grid[move.ToRow, move.ToCol];
            _grid[move.ToRow, move.ToCol]     = move.CapturedPiece;
            CurrentTurn = CurrentTurn == PieceColor.Red ? PieceColor.Black : PieceColor.Red;
        }

        // ── Kiểm tra chiếu tướng ──────────────────────────────────────────────

        /// <summary>Tìm vị trí Tướng của màu chỉ định</summary>
        public (int row, int col) FindGeneral(PieceColor color)
        {
            for (int r = 0; r < Rows; r++)
                for (int c = 0; c < Cols; c++)
                {
                    var p = _grid[r, c];
                    if (p?.Type == PieceType.General && p.Color == color)
                        return (r, c);
                }
            return (-1, -1);
        }

        /// <summary>Kiểm tra màu <paramref name="color"/> có đang bị chiếu không</summary>
        public bool IsInCheck(PieceColor color)
        {
            var (gr, gc) = FindGeneral(color);
            if (gr < 0) return true; // Tướng đã bị ăn

            var opponent = color == PieceColor.Red ? PieceColor.Black : PieceColor.Red;
            var opponentMoves = MoveGenerator.GeneratePseudoMoves(this, opponent);
            return opponentMoves.Any(m => m.ToRow == gr && m.ToCol == gc);
        }

        // ── Clone ─────────────────────────────────────────────────────────────

        /// <summary>
        /// Tạo bản sao độc lập của bàn cờ.
        /// AI dùng bản sao này để tính toán, không đụng vào board gốc.
        /// </summary>
        public Board Clone()
        {
            var copy = new Board(empty: true);

            for (int r = 0; r < Rows; r++)
                for (int c = 0; c < Cols; c++)
                {
                    var p = _grid[r, c];
                    copy._grid[r, c] = p == null ? null : new Piece(p.Type, p.Color);
                }

            copy.CurrentTurn = CurrentTurn;
            return copy;
        }

        // ── Hiển thị console ──────────────────────────────────────────────────

        public void Print()
        {
            Console.WriteLine("  0 1 2 3 4 5 6 7 8");
            for (int r = 0; r < Rows; r++)
            {
                Console.Write($"{r} ");
                for (int c = 0; c < Cols; c++)
                {
                    var p = _grid[r, c];
                    Console.Write(p != null ? p.Symbol : "·");
                    if (c < Cols - 1) Console.Write(" ");
                }
                Console.WriteLine();
            }
        }
    }
}
