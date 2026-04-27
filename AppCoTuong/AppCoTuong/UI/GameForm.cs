using System.Drawing;
using System.Drawing.Drawing2D;
using System.Windows.Forms;
using AppCoTuong.Engine;
using AppCoTuong.AI;

namespace AppCoTuong.UI
{
    // Panel tùy chỉnh bật double buffering — loại bỏ hoàn toàn nhấp nháy
    internal sealed class BoardPanel : Panel
    {
        public BoardPanel()
        {
            DoubleBuffered = true;
            SetStyle(
                ControlStyles.AllPaintingInWmPaint |
                ControlStyles.UserPaint |
                ControlStyles.OptimizedDoubleBuffer, true);
            UpdateStyles();
        }
    }

    public class GameForm : Form
    {
        // ── Hằng số giao diện ─────────────────────────────────────────────────
        private const int CellSize    = 64;
        private const int BoardMargin = 48;
        private const int PieceR      = 26;

        private static readonly Color BoardBg      = Color.FromArgb(0xDE, 0xB8, 0x87);
        private static readonly Color LineCol      = Color.FromArgb(0x8B, 0x45, 0x13);
        private static readonly Color RedPiece     = Color.FromArgb(0xC0, 0x39, 0x2B);
        private static readonly Color BlackPiece   = Color.FromArgb(0x1A, 0x1A, 0x2E);
        private static readonly Color SelectRing   = Color.FromArgb(0xF3, 0x9C, 0x12);
        private static readonly Color HintDot      = Color.FromArgb(140, 0x27, 0xAE, 0x60);

        // ── Font dùng chung (tạo 1 lần, tránh GC liên tục) ───────────────────
        private static readonly Font PieceFont  = new("Arial Unicode MS", 15f, FontStyle.Bold);
        private static readonly Font RiverFont  = new("Arial Unicode MS", 18f, FontStyle.Bold);

        // ── Trạng thái game ───────────────────────────────────────────────────
        private readonly Board   _board = new();
        private readonly Minimax _ai    = new(depth: 3);
        private readonly object  _lock  = new();   // bảo vệ _board khi AI chạy nền

        private (int row, int col) _selected = (-1, -1);
        private List<Move> _legalMoves = [];
        private List<Move> _hints      = [];
        private bool _gameOver         = false;
        private bool _aiThinking       = false;
        private readonly bool _vsAI    = true;

        // ── Controls ──────────────────────────────────────────────────────────
        private readonly Label       _lblStatus;
        private readonly Button      _btnUndo;
        private readonly Button      _btnAI;
        private readonly Button      _btnNew;
        private readonly BoardPanel  _boardPanel;
        private readonly Stack<Move> _history = new();

        public GameForm()
        {
            Text            = "象棋 · Cờ Tướng";
            BackColor       = Color.FromArgb(0x2C, 0x3E, 0x50);
            FormBorderStyle = FormBorderStyle.FixedSingle;
            MaximizeBox     = false;
            StartPosition   = FormStartPosition.CenterScreen;
            Font            = new Font("Segoe UI", 10f);

            int boardW = CellSize * (Board.Cols - 1) + BoardMargin * 2;
            int boardH = CellSize * (Board.Rows - 1) + BoardMargin * 2;

            // ── Bàn cờ (double-buffered) ──────────────────────────────────────
            _boardPanel = new BoardPanel
            {
                Location  = new Point(10, 50),
                Size      = new Size(boardW, boardH),
                BackColor = BoardBg,
                Cursor    = Cursors.Hand
            };
            _boardPanel.Paint      += BoardPanel_Paint;
            _boardPanel.MouseClick += BoardPanel_MouseClick;

            // ── Label trạng thái ──────────────────────────────────────────────
            _lblStatus = new Label
            {
                Location  = new Point(10, 10),
                Size      = new Size(boardW, 34),
                ForeColor = Color.White,
                Font      = new Font("Segoe UI", 13f, FontStyle.Bold),
                Text      = "Lượt: ĐỎ  |  Bạn chơi Đỏ, AI chơi Đen",
                TextAlign = ContentAlignment.MiddleLeft
            };

            // ── Nút điều khiển ────────────────────────────────────────────────
            int btnY = boardH + 60;
            _btnNew  = MakeButton("🎮 Ván mới",  10,           btnY, Color.FromArgb(0x27, 0xAE, 0x60));
            _btnUndo = MakeButton("↩ Hoàn tác",  10 + 140,     btnY, Color.FromArgb(0x8E, 0x44, 0xAD));
            _btnAI   = MakeButton("🤖 AI đi",    10 + 140 * 2, btnY, Color.FromArgb(0x29, 0x80, 0xB9));

            _btnNew.Click  += (_, _) => NewGame();
            _btnUndo.Click += (_, _) => UndoMove();
            _btnAI.Click   += (_, _) => DoAiMove();

            ClientSize = new Size(boardW + 20, btnY + 50);
            Controls.AddRange([_lblStatus, _boardPanel, _btnNew, _btnUndo, _btnAI]);
        }

        private static Button MakeButton(string text, int x, int y, Color bg) => new()
        {
            Text      = text,
            Location  = new Point(x, y),
            Size      = new Size(130, 36),
            BackColor = bg,
            ForeColor = Color.White,
            FlatStyle = FlatStyle.Flat,
            Font      = new Font("Segoe UI", 10f, FontStyle.Bold),
            Cursor    = Cursors.Hand
        };

        // ── Vẽ bàn cờ ────────────────────────────────────────────────────────
        private void BoardPanel_Paint(object? sender, PaintEventArgs e)
        {
            var g = e.Graphics;
            g.SmoothingMode      = SmoothingMode.AntiAlias;
            g.TextRenderingHint  = System.Drawing.Text.TextRenderingHint.AntiAliasGridFit;

            DrawGrid(g);
            DrawRiver(g);
            DrawHints(g);
            DrawPieces(g);
        }

        private static void DrawGrid(Graphics g)
        {
            using var pen = new Pen(LineCol, 1.5f);

            // Đường ngang
            for (int r = 0; r < Board.Rows; r++)
            {
                int y = BoardMargin + r * CellSize;
                g.DrawLine(pen, BoardMargin, y,
                                BoardMargin + (Board.Cols - 1) * CellSize, y);
            }

            // Đường dọc — ngắt ở sông (row 4→5)
            for (int c = 0; c < Board.Cols; c++)
            {
                int x = BoardMargin + c * CellSize;
                if (c == 0 || c == Board.Cols - 1)
                {
                    g.DrawLine(pen, x, BoardMargin,
                                    x, BoardMargin + (Board.Rows - 1) * CellSize);
                }
                else
                {
                    g.DrawLine(pen, x, BoardMargin,
                                    x, BoardMargin + 4 * CellSize);
                    g.DrawLine(pen, x, BoardMargin + 5 * CellSize,
                                    x, BoardMargin + 9 * CellSize);
                }
            }

            // Cung điện
            g.DrawLine(pen, BoardMargin + 3 * CellSize, BoardMargin,
                            BoardMargin + 5 * CellSize, BoardMargin + 2 * CellSize);
            g.DrawLine(pen, BoardMargin + 5 * CellSize, BoardMargin,
                            BoardMargin + 3 * CellSize, BoardMargin + 2 * CellSize);
            g.DrawLine(pen, BoardMargin + 3 * CellSize, BoardMargin + 7 * CellSize,
                            BoardMargin + 5 * CellSize, BoardMargin + 9 * CellSize);
            g.DrawLine(pen, BoardMargin + 5 * CellSize, BoardMargin + 7 * CellSize,
                            BoardMargin + 3 * CellSize, BoardMargin + 9 * CellSize);
        }

        private static void DrawRiver(Graphics g)
        {
            int ry     = BoardMargin + 4 * CellSize;
            int rh     = CellSize;
            int boardW = (Board.Cols - 1) * CellSize;

            using var bg = new SolidBrush(Color.FromArgb(35, 0x21, 0x96, 0xF3));
            g.FillRectangle(bg, BoardMargin, ry, boardW, rh);

            using var brush = new SolidBrush(Color.FromArgb(0x1A, 0x5C, 0x8A));
            var fmt = new StringFormat
            {
                Alignment     = StringAlignment.Center,
                LineAlignment = StringAlignment.Center
            };
            g.DrawString("楚 河", RiverFont, brush,
                new RectangleF(BoardMargin,                  ry, boardW / 2f, rh), fmt);
            g.DrawString("漢 界", RiverFont, brush,
                new RectangleF(BoardMargin + boardW / 2f,    ry, boardW / 2f, rh), fmt);
        }

        private void DrawHints(Graphics g)
        {
            if (_selected.row >= 0)
            {
                int x = BoardMargin + _selected.col * CellSize;
                int y = BoardMargin + _selected.row * CellSize;
                using var fill = new SolidBrush(Color.FromArgb(70, 0xF3, 0x9C, 0x12));
                g.FillEllipse(fill, x - PieceR, y - PieceR, PieceR * 2, PieceR * 2);
                using var ring = new Pen(SelectRing, 3f);
                g.DrawEllipse(ring, x - PieceR, y - PieceR, PieceR * 2, PieceR * 2);
            }

            using var dot = new SolidBrush(HintDot);
            foreach (var h in _hints)
            {
                int x = BoardMargin + h.ToCol * CellSize;
                int y = BoardMargin + h.ToRow * CellSize;

                // Nếu ô đích có quân địch → vẽ vòng tròn thay vì chấm
                if (_board.GetPiece(h.ToRow, h.ToCol) != null)
                {
                    using var capPen = new Pen(Color.FromArgb(200, 0xE7, 0x4C, 0x3C), 3f);
                    g.DrawEllipse(capPen, x - PieceR, y - PieceR, PieceR * 2, PieceR * 2);
                }
                else
                {
                    g.FillEllipse(dot, x - 9, y - 9, 18, 18);
                }
            }
        }

        private void DrawPieces(Graphics g)
        {
            var fmt = new StringFormat
            {
                Alignment     = StringAlignment.Center,
                LineAlignment = StringAlignment.Center
            };

            for (int r = 0; r < Board.Rows; r++)
                for (int c = 0; c < Board.Cols; c++)
                {
                    var piece = _board.GetPiece(r, c);
                    if (piece == null) continue;

                    int cx = BoardMargin + c * CellSize;
                    int cy = BoardMargin + r * CellSize;

                    bool isRed   = piece.Color == PieceColor.Red;
                    var bgColor  = isRed ? RedPiece   : BlackPiece;
                    var rimColor = isRed ? Color.FromArgb(0xFF, 0xD7, 0x00)
                                        : Color.FromArgb(0x95, 0xA5, 0xA6);

                    // Bóng đổ nhẹ
                    using var shadow = new SolidBrush(Color.FromArgb(50, 0, 0, 0));
                    g.FillEllipse(shadow,
                        cx - PieceR + 3, cy - PieceR + 3, PieceR * 2, PieceR * 2);

                    // Nền quân
                    using var bg = new SolidBrush(bgColor);
                    g.FillEllipse(bg, cx - PieceR, cy - PieceR, PieceR * 2, PieceR * 2);

                    // Viền trong
                    using var rim = new Pen(rimColor, 2.5f);
                    g.DrawEllipse(rim,
                        cx - PieceR + 3, cy - PieceR + 3,
                        (PieceR - 3) * 2, (PieceR - 3) * 2);

                    // Chữ Hán
                    using var fg = new SolidBrush(Color.White);
                    g.DrawString(piece.Symbol, PieceFont, fg,
                        new RectangleF(cx - PieceR, cy - PieceR, PieceR * 2, PieceR * 2), fmt);
                }
        }

        // ── Xử lý click chuột ────────────────────────────────────────────────
        private void BoardPanel_MouseClick(object? sender, MouseEventArgs e)
        {
            if (_gameOver || _aiThinking) return;
            if (_vsAI && _board.CurrentTurn == PieceColor.Black) return;

            // Snap về giao điểm gần nhất
            int col = (int)Math.Round((e.X - BoardMargin) / (float)CellSize);
            int row = (int)Math.Round((e.Y - BoardMargin) / (float)CellSize);
            if (!Board.InBounds(row, col)) return;

            if (_selected.row < 0)
            {
                // Chọn quân của mình
                var piece = _board.GetPiece(row, col);
                if (piece != null && piece.Color == _board.CurrentTurn)
                {
                    _selected = (row, col);
                    _hints    = _legalMoves
                        .Where(m => m.FromRow == row && m.FromCol == col)
                        .ToList();
                }
            }
            else
            {
                var move = _hints.FirstOrDefault(m => m.ToRow == row && m.ToCol == col);
                if (move != null)
                {
                    ExecutePlayerMove(move);
                    return; // ExecutePlayerMove gọi Invalidate rồi
                }

                // Chọn lại quân khác hoặc bỏ chọn
                var piece = _board.GetPiece(row, col);
                if (piece != null && piece.Color == _board.CurrentTurn)
                {
                    _selected = (row, col);
                    _hints    = _legalMoves
                        .Where(m => m.FromRow == row && m.FromCol == col)
                        .ToList();
                }
                else
                {
                    _selected = (-1, -1);
                    _hints    = [];
                }
            }

            _boardPanel.Invalidate();
        }

        private void ExecutePlayerMove(Move move)
        {
            _board.ApplyMove(move);
            _history.Push(move);
            _selected = (-1, -1);
            _hints    = [];

            RefreshLegalMoves();
            UpdateStatus();
            _boardPanel.Invalidate();

            if (_vsAI && !_gameOver && _board.CurrentTurn == PieceColor.Black)
                StartAiMove();
        }

        private void StartAiMove()
        {
            _aiThinking = true;
            _lblStatus.Text      = "AI đang suy nghĩ...";
            _lblStatus.ForeColor = Color.FromArgb(0xF3, 0x9C, 0x12);

            // Clone board TRƯỚC khi đưa sang thread khác
            // → AI tính hoàn toàn trên bản sao, board gốc không bị đụng
            var boardSnapshot = _board.Clone();

            Task.Run(() =>
            {
                // Toàn bộ tính toán trên bản sao — thread-safe
                var aiMove = _ai.FindBestMove(boardSnapshot);

                // Chỉ apply kết quả (Move) về UI thread, không truyền board
                Invoke(() =>
                {
                    _aiThinking = false;
                    if (aiMove != null)
                    {
                        // Tạo move mới sạch (không mang CapturedPiece từ bản sao)
                        var cleanMove = new Move(
                            aiMove.FromRow, aiMove.FromCol,
                            aiMove.ToRow,   aiMove.ToCol);

                        _board.ApplyMove(cleanMove);
                        _history.Push(cleanMove);
                    }
                    RefreshLegalMoves();
                    UpdateStatus();
                    _boardPanel.Invalidate();
                });
            });
        }

        // ── Nút điều khiển ────────────────────────────────────────────────────
        private void NewGame()
        {
            if (_aiThinking) return;
            _board.SetupInitialPosition();
            _history.Clear();
            _selected = (-1, -1);
            _hints    = [];
            _gameOver = false;
            RefreshLegalMoves();
            UpdateStatus();
            _boardPanel.Invalidate();
        }

        private void UndoMove()
        {
            if (_aiThinking || _history.Count == 0) return;

            _board.UndoMove(_history.Pop());
            // Hoàn tác thêm nước AI nếu cần
            if (_vsAI && _history.Count > 0 && _board.CurrentTurn == PieceColor.Black)
                _board.UndoMove(_history.Pop());

            _selected = (-1, -1);
            _hints    = [];
            _gameOver = false;
            RefreshLegalMoves();
            UpdateStatus();
            _boardPanel.Invalidate();
        }

        private void DoAiMove()
        {
            if (_gameOver || _aiThinking) return;
            StartAiMove();
        }

        // ── Trạng thái ────────────────────────────────────────────────────────
        private void RefreshLegalMoves()
        {
            _legalMoves = MoveGenerator.GenerateLegalMoves(_board, _board.CurrentTurn);
            if (_legalMoves.Count == 0)
                _gameOver = true;
        }

        private void UpdateStatus()
        {
            if (_gameOver)
            {
                var winner = _board.CurrentTurn == PieceColor.Red ? "ĐEN" : "ĐỎ";
                _lblStatus.Text      = $"🏆  {winner} THẮNG!";
                _lblStatus.ForeColor = Color.FromArgb(0xFF, 0xD7, 0x00);
                return;
            }

            bool inCheck = _board.IsInCheck(_board.CurrentTurn);
            string turn  = _board.CurrentTurn == PieceColor.Red ? "ĐỎ" : "ĐEN";
            string check = inCheck ? "  ⚠ CHIẾU!" : "";
            _lblStatus.Text      = $"Lượt: {turn}{check}";
            _lblStatus.ForeColor = _board.CurrentTurn == PieceColor.Red
                ? Color.FromArgb(0xFF, 0x6B, 0x6B)
                : Color.FromArgb(0xA8, 0xD8, 0xFF);
        }

        protected override void OnLoad(EventArgs e)
        {
            base.OnLoad(e);
            RefreshLegalMoves();
            UpdateStatus();
        }

        protected override void Dispose(bool disposing)
        {
            if (disposing)
            {
                PieceFont.Dispose();
                RiverFont.Dispose();
            }
            base.Dispose(disposing);
        }
    }
}
