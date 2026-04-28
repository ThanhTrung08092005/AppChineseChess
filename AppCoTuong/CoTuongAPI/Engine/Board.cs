namespace CoTuongAPI.Engine
{
    public class Board
    {
        public const int Rows = 10;
        public const int Cols = 9;

        private readonly Piece?[,] _grid = new Piece?[Rows, Cols];
        public PieceColor CurrentTurn { get; private set; } = PieceColor.Red;

        public Board() => SetupInitialPosition();

        private Board(bool _) { } // constructor nội bộ cho Clone

        /// <summary>Constructor cho FenConverter — không setup vị trí ban đầu</summary>
        public Board(bool skipSetup = false)
        {
            if (!skipSetup) SetupInitialPosition();
        }

        // ── Ghi quân (dùng cho FEN parser) ───────────────────────────────────
        public void SetPiece(int row, int col, Piece? piece) => _grid[row, col] = piece;
        public void SetTurn(PieceColor color) => CurrentTurn = color;

        // ── Setup ─────────────────────────────────────────────────────────────
        public void SetupInitialPosition()
        {
            Array.Clear(_grid, 0, _grid.Length);

            PlaceRow(0, PieceColor.Black,
                PieceType.Chariot, PieceType.Horse, PieceType.Elephant,
                PieceType.Advisor, PieceType.General,
                PieceType.Advisor, PieceType.Elephant,
                PieceType.Horse,   PieceType.Chariot);

            _grid[2, 1] = new Piece(PieceType.Cannon, PieceColor.Black);
            _grid[2, 7] = new Piece(PieceType.Cannon, PieceColor.Black);
            foreach (int c in new[] { 0, 2, 4, 6, 8 })
                _grid[3, c] = new Piece(PieceType.Soldier, PieceColor.Black);

            _grid[7, 1] = new Piece(PieceType.Cannon, PieceColor.Red);
            _grid[7, 7] = new Piece(PieceType.Cannon, PieceColor.Red);
            foreach (int c in new[] { 0, 2, 4, 6, 8 })
                _grid[6, c] = new Piece(PieceType.Soldier, PieceColor.Red);

            PlaceRow(9, PieceColor.Red,
                PieceType.Chariot, PieceType.Horse, PieceType.Elephant,
                PieceType.Advisor, PieceType.General,
                PieceType.Advisor, PieceType.Elephant,
                PieceType.Horse,   PieceType.Chariot);

            CurrentTurn = PieceColor.Red;
        }

        private void PlaceRow(int row, PieceColor color, params PieceType[] types)
        {
            for (int c = 0; c < types.Length; c++)
                _grid[row, c] = new Piece(types[c], color);
        }

        // ── Truy cập ──────────────────────────────────────────────────────────
        public Piece? GetPiece(int row, int col) => _grid[row, col];
        public bool   IsEmpty(int row, int col)  => _grid[row, col] == null;

        public static bool InBounds(int r, int c)
            => r >= 0 && r < Rows && c >= 0 && c < Cols;

        // ── Apply / Undo ──────────────────────────────────────────────────────
        public void ApplyMove(Move move)
        {
            move.CapturedPiece            = _grid[move.ToRow,   move.ToCol];
            _grid[move.ToRow,   move.ToCol]   = _grid[move.FromRow, move.FromCol];
            _grid[move.FromRow, move.FromCol] = null;
            CurrentTurn = CurrentTurn == PieceColor.Red ? PieceColor.Black : PieceColor.Red;
        }

        public void UndoMove(Move move)
        {
            _grid[move.FromRow, move.FromCol] = _grid[move.ToRow, move.ToCol];
            _grid[move.ToRow,   move.ToCol]   = move.CapturedPiece;
            CurrentTurn = CurrentTurn == PieceColor.Red ? PieceColor.Black : PieceColor.Red;
        }

        // ── Kiểm tra chiếu ────────────────────────────────────────────────────
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

        public bool IsInCheck(PieceColor color)
        {
            var (gr, gc) = FindGeneral(color);
            if (gr < 0) return true;
            var opp = color == PieceColor.Red ? PieceColor.Black : PieceColor.Red;
            return MoveGenerator.GeneratePseudoMoves(this, opp)
                                .Any(m => m.ToRow == gr && m.ToCol == gc);
        }

        // ── Clone (AI dùng bản sao, không đụng board gốc) ────────────────────
        public Board Clone()
        {
            var copy = new Board(false);
            for (int r = 0; r < Rows; r++)
                for (int c = 0; c < Cols; c++)
                {
                    var p = _grid[r, c];
                    copy._grid[r, c] = p == null ? null : new Piece(p.Type, p.Color);
                }
            copy.CurrentTurn = CurrentTurn;
            return copy;
        }

        // ── Serialize sang mảng 2D cho API response ───────────────────────────
        public string?[,] ToSymbolGrid()
        {
            var grid = new string?[Rows, Cols];
            for (int r = 0; r < Rows; r++)
                for (int c = 0; c < Cols; c++)
                    grid[r, c] = _grid[r, c]?.Symbol;
            return grid;
        }
    }
}
