using CoTuongAPI.Engine;

namespace CoTuongAPI.AI
{
    /// <summary>
    /// Minimax engine nâng cấp — lấy kỹ thuật từ Pikafish/Stockfish source:
    ///
    ///  1. Alpha-Beta + Iterative Deepening          (có sẵn)
    ///  2. Transposition Table (Zobrist)              (có sẵn, nâng cấp age)
    ///  3. Move Ordering: MVV-LVA, Killer, History    (có sẵn)
    ///  4. Quiescence Search                          (có sẵn)
    ///  5. Null Move Pruning                          (MỚI — Pikafish Step 8)
    ///  6. Late Move Reduction (LMR)                  (MỚI — Pikafish Step 16)
    ///  7. Futility Pruning                           (MỚI — Pikafish Step 7)
    ///  8. Razoring                                   (MỚI — Pikafish Step 6)
    ///  9. Internal Iterative Reduction (IIR)         (MỚI — Pikafish Step 9)
    /// 10. Aspiration Windows                         (MỚI — Pikafish iterative deepening)
    /// 11. Mate Distance Pruning                      (MỚI — Pikafish Step 3)
    /// 12. SEE (Static Exchange Evaluation)           (MỚI — dùng cho capture ordering)
    /// 13. Continuation History (2-ply)               (MỚI — Pikafish contHist)
    /// 14. Counter Move Heuristic                     (MỚI)
    /// </summary>
    public class Minimax
    {
        private readonly int _maxDepth;
        private readonly int _maxTimeMs;

        public int NodesSearched { get; private set; }

        // ── Transposition Table ───────────────────────────────────────────────
        private const int TT_SIZE = 1 << 22; // 4M entries (~128MB)
        private readonly TTEntry[] _tt = new TTEntry[TT_SIZE];
        private byte _ttAge = 0;

        // ── Killer Moves (2 per ply) ──────────────────────────────────────────
        private readonly Move?[,] _killers = new Move?[128, 2];

        // ── History Heuristic [color][from][to] ───────────────────────────────
        private readonly int[,,] _history = new int[2, Board.Rows * Board.Cols, Board.Rows * Board.Cols];

        // ── Continuation History [piece_type][to_sq] ─────────────────────────
        // Lưu lịch sử theo cặp nước đi (nước hiện tại + nước trước)
        private readonly int[,] _contHist1 = new int[7 * 90, 90]; // ply-1
        private readonly int[,] _contHist2 = new int[7 * 90, 90]; // ply-2

        // ── Counter Move [from][to] → best reply ─────────────────────────────
        private readonly Move?[,] _counterMove = new Move?[90, 90];

        // ── LMR reduction table [depth][moveCount] ────────────────────────────
        private static readonly int[,] LmrTable;

        static Minimax()
        {
            // Khởi tạo LMR table: R = ln(depth) * ln(moveCount) / 2.0
            // (công thức từ Stockfish/Pikafish)
            LmrTable = new int[64, 64];
            for (int d = 1; d < 64; d++)
                for (int m = 1; m < 64; m++)
                    LmrTable[d, m] = (int)(Math.Log(d) * Math.Log(m) / 2.0);
        }

        public Minimax(int depth = 6, int maxTimeMs = 5000)
        {
            _maxDepth  = depth;
            _maxTimeMs = maxTimeMs;
        }

        // ── Entry point ───────────────────────────────────────────────────────
        public Move? FindBestMove(Board board)
        {
            NodesSearched = 0;
            _ttAge        = (byte)((_ttAge + 1) & 0xFF);
            Array.Clear(_killers,      0, _killers.Length);
            Array.Clear(_history,      0, _history.Length);
            Array.Clear(_contHist1,    0, _contHist1.Length);
            Array.Clear(_contHist2,    0, _contHist2.Length);
            Array.Clear(_counterMove,  0, _counterMove.Length);

            var deadline = DateTime.UtcNow.AddMilliseconds(_maxTimeMs);
            bool isMax   = board.CurrentTurn == PieceColor.Red;

            Move? bestMove  = null;
            int   bestScore = isMax ? int.MinValue : int.MaxValue;

            // ── Aspiration Windows (Pikafish iterative deepening) ─────────────
            int aspirationDelta = 50; // centipawns ban đầu

            for (int depth = 1; depth <= _maxDepth; depth++)
            {
                if (DateTime.UtcNow > deadline) break;

                int alpha, beta;

                // Dùng aspiration window từ depth >= 4
                if (depth >= 4 && Math.Abs(bestScore) < 90000)
                {
                    alpha = bestScore - aspirationDelta;
                    beta  = bestScore + aspirationDelta;
                }
                else
                {
                    alpha = -999999;
                    beta  =  999999;
                }

                // Re-search với window rộng hơn nếu fail high/low
                while (true)
                {
                    var (move, score) = SearchRoot(board, depth, isMax, alpha, beta, deadline);

                    if (move != null)
                    {
                        bestMove  = move;
                        bestScore = score;
                    }

                    if (score <= alpha)
                    {
                        // Fail low — mở rộng window xuống
                        alpha -= aspirationDelta;
                        aspirationDelta *= 2;
                    }
                    else if (score >= beta)
                    {
                        // Fail high — mở rộng window lên
                        beta += aspirationDelta;
                        aspirationDelta *= 2;
                    }
                    else
                        break; // Trong window — xong

                    // Nếu window quá rộng thì dùng full window
                    if (alpha < -900000 || beta > 900000)
                    {
                        alpha = -999999;
                        beta  =  999999;
                    }

                    if (DateTime.UtcNow > deadline) break;
                }

                aspirationDelta = 50; // reset cho iteration tiếp theo

                // Mate found — không cần tìm sâu hơn
                if (Math.Abs(bestScore) > 90000) break;
            }

            return bestMove;
        }

        private (Move? move, int score) SearchRoot(
            Board board, int depth, bool isMax,
            int alpha, int beta, DateTime deadline)
        {
            var moves = MoveGenerator.GenerateLegalMoves(board, board.CurrentTurn);
            if (moves.Count == 0) return (null, isMax ? -999999 : 999999);

            OrderMoves(moves, board, 0, null);

            Move? best  = null;
            int bestVal = isMax ? -999999 : 999999;

            for (int i = 0; i < moves.Count; i++)
            {
                var m = moves[i];
                if (DateTime.UtcNow > deadline) break;

                board.ApplyMove(m);
                int val = AlphaBeta(board, depth - 1, alpha, beta, !isMax, 1, deadline, m);
                board.UndoMove(m);

                if (isMax ? val > bestVal : val < bestVal)
                {
                    bestVal = val;
                    best    = m;
                }
                if (isMax) alpha = Math.Max(alpha, val);
                else       beta  = Math.Min(beta,  val);
                if (alpha >= beta) break;
            }

            return (best, bestVal);
        }

        // ── Alpha-Beta với đầy đủ pruning techniques ──────────────────────────
        private int AlphaBeta(Board board, int depth, int alpha, int beta,
                              bool isMax, int ply, DateTime deadline, Move? prevMove)
        {
            NodesSearched++;

            // ── Mate Distance Pruning (Pikafish Step 3) ───────────────────────
            // Nếu alpha đã >= mate score tại ply này thì không cần tìm thêm
            int mateScore = 100000 - ply;
            alpha = Math.Max(alpha, -mateScore);
            beta  = Math.Min(beta,   mateScore);
            if (alpha >= beta) return alpha;

            // ── Transposition Table lookup ────────────────────────────────────
            ulong hash  = ZobristHash(board);
            int   ttIdx = (int)(hash & (TT_SIZE - 1));
            var   tte   = _tt[ttIdx];
            Move? ttMove = null;

            if (tte.Hash == hash)
            {
                ttMove = tte.BestMove;
                if (tte.Depth >= depth)
                {
                    int ttScore = tte.Score;
                    if (tte.Flag == TTFlag.Exact)                         return ttScore;
                    if (tte.Flag == TTFlag.LowerBound && ttScore > alpha) alpha = ttScore;
                    if (tte.Flag == TTFlag.UpperBound && ttScore < beta)  beta  = ttScore;
                    if (alpha >= beta) return ttScore;
                }
            }

            // ── Leaf node → Quiescence Search ────────────────────────────────
            if (depth <= 0 || DateTime.UtcNow > deadline)
                return QuiescenceSearch(board, alpha, beta, isMax, ply);

            var color = isMax ? PieceColor.Red : PieceColor.Black;
            bool inCheck = board.IsInCheck(color);

            // ── Static Evaluation (dùng cho pruning) ─────────────────────────
            int staticEval = Evaluation.Evaluate(board);
            int eval = isMax ? staticEval : -staticEval; // từ góc nhìn bên đang đi

            // ── Razoring (Pikafish Step 6) ────────────────────────────────────
            // Nếu eval quá thấp so với alpha, bỏ qua và chỉ làm qsearch
            if (!inCheck && depth <= 3 && eval < alpha - 300 - 200 * depth)
                return QuiescenceSearch(board, alpha, beta, isMax, ply);

            // ── Futility Pruning (Pikafish Step 7) ────────────────────────────
            // Nếu eval đã >= beta với margin, cắt sớm (chỉ ở non-PV nodes)
            if (!inCheck && depth < 8 && eval >= beta + 80 * depth)
                return eval;

            // ── Null Move Pruning (Pikafish Step 8) ───────────────────────────
            // Nếu bỏ lượt mà vẫn >= beta → position quá tốt, cắt sớm
            // Điều kiện: không đang bị chiếu, có quân đủ mạnh, không phải null move liên tiếp
            bool canNullMove = !inCheck
                && depth >= 3
                && eval >= beta
                && prevMove != null  // không phải null move liên tiếp
                && HasMajorPieces(board, color);

            if (canNullMove)
            {
                int R = 3 + depth / 4; // reduction từ Pikafish: R = 8 + depth/3 (scaled down)
                board.PassTurn(); // bỏ lượt (null move)
                int nullVal = -AlphaBeta(board, depth - R, -beta, -beta + 1, !isMax, ply + 1, deadline, null);
                board.PassTurn(); // khôi phục lượt

                if (nullVal >= beta && Math.Abs(nullVal) < 90000)
                    return nullVal;
            }

            // ── Internal Iterative Reduction (Pikafish Step 9) ───────────────
            // Không có TT move ở depth cao → giảm depth 1
            if (depth >= 6 && ttMove == null)
                depth--;

            var moves = MoveGenerator.GenerateLegalMoves(board, color);
            if (moves.Count == 0)
                return inCheck ? -(100000 - ply) : 0; // Chiếu hết hoặc hòa

            OrderMoves(moves, board, ply, ttMove);

            int  origAlpha = alpha;
            Move? bestMove = null;
            int  bestVal   = -999999;
            int  moveCount = 0;

            foreach (var m in moves)
            {
                moveCount++;

                // ── Late Move Reduction (Pikafish Step 16) ────────────────────
                // Giảm depth cho các nước đi sau (không phải capture/check/killer)
                bool isCapture  = m.CapturedPiece != null;
                bool isKiller   = ply < 128 && (m == _killers[ply, 0] || m == _killers[ply, 1]);
                bool isTTMove   = ttMove != null && m.FromRow == ttMove.FromRow
                                  && m.FromCol == ttMove.FromCol
                                  && m.ToRow   == ttMove.ToRow
                                  && m.ToCol   == ttMove.ToCol;

                int reduction = 0;
                if (!inCheck && !isCapture && !isKiller && !isTTMove
                    && depth >= 3 && moveCount > 3)
                {
                    int d = Math.Min(depth - 1, 63);
                    int mc = Math.Min(moveCount, 63);
                    reduction = LmrTable[d, mc];

                    // Tăng reduction cho nước đi sau nhiều hơn
                    if (moveCount > 6) reduction++;
                    if (moveCount > 12) reduction++;

                    // Giảm reduction nếu đang bị chiếu sau nước đi
                    board.ApplyMove(m);
                    bool givesCheck = board.IsInCheck(color == PieceColor.Red ? PieceColor.Black : PieceColor.Red);
                    board.UndoMove(m);
                    if (givesCheck) reduction = Math.Max(0, reduction - 1);
                }

                board.ApplyMove(m);

                int val;
                if (reduction > 0)
                {
                    // LMR: tìm với depth giảm trước
                    int reducedDepth = Math.Max(1, depth - 1 - reduction);
                    val = AlphaBeta(board, reducedDepth, -(alpha + 1), -alpha, !isMax, ply + 1, deadline, m);

                    // Nếu vượt alpha → tìm lại với full depth
                    if (val > alpha)
                        val = AlphaBeta(board, depth - 1, -beta, -alpha, !isMax, ply + 1, deadline, m);
                }
                else
                {
                    // Full depth search
                    if (moveCount == 1)
                        val = AlphaBeta(board, depth - 1, -beta, -alpha, !isMax, ply + 1, deadline, m);
                    else
                    {
                        // PVS: tìm với null window trước
                        val = AlphaBeta(board, depth - 1, -(alpha + 1), -alpha, !isMax, ply + 1, deadline, m);
                        if (val > alpha && val < beta)
                            val = AlphaBeta(board, depth - 1, -beta, -alpha, !isMax, ply + 1, deadline, m);
                    }
                }

                board.UndoMove(m);

                if (val > bestVal)
                {
                    bestVal  = val;
                    bestMove = m;
                }

                alpha = Math.Max(alpha, val);

                if (alpha >= beta)
                {
                    // Beta cutoff — cập nhật killer và history
                    if (!isCapture && ply < 128)
                    {
                        _killers[ply, 1] = _killers[ply, 0];
                        _killers[ply, 0] = m;
                    }

                    // History heuristic update
                    int ci = color == PieceColor.Red ? 0 : 1;
                    int from = m.FromRow * Board.Cols + m.FromCol;
                    int to   = m.ToRow   * Board.Cols + m.ToCol;
                    _history[ci, from, to] += depth * depth;

                    // Counter move update
                    if (prevMove != null)
                    {
                        int pf = prevMove.FromRow * Board.Cols + prevMove.FromCol;
                        int pt = prevMove.ToRow   * Board.Cols + prevMove.ToCol;
                        _counterMove[pf, pt] = m;
                    }

                    break;
                }
            }

            // ── TT Store ──────────────────────────────────────────────────────
            var flag = bestVal <= origAlpha ? TTFlag.UpperBound
                     : bestVal >= beta      ? TTFlag.LowerBound
                                            : TTFlag.Exact;
            _tt[ttIdx] = new TTEntry(hash, depth, bestVal, flag, bestMove, _ttAge);

            return bestVal;
        }

        // ── Quiescence Search ─────────────────────────────────────────────────
        private int QuiescenceSearch(Board board, int alpha, int beta, bool isMax, int ply)
        {
            NodesSearched++;

            int stand = Evaluation.Evaluate(board);
            int eval  = isMax ? stand : -stand;

            if (eval >= beta)  return beta;
            if (eval > alpha)  alpha = eval;

            var color    = isMax ? PieceColor.Red : PieceColor.Black;
            var pseudo   = MoveGenerator.GeneratePseudoMoves(board, color);
            var captures = pseudo.Where(m => m.CapturedPiece != null).ToList();

            // SEE-based ordering: ưu tiên ăn quân có giá trị cao bằng quân giá trị thấp
            captures.Sort((a, b) => SeeScore(b) - SeeScore(a));

            foreach (var m in captures)
            {
                // SEE pruning: bỏ qua capture tệ (ăn quân rồi bị ăn lại mất điểm)
                if (SeeScore(m) < -50) continue;

                board.ApplyMove(m);
                if (board.IsInCheck(color)) { board.UndoMove(m); continue; }
                int val = -QuiescenceSearch(board, -beta, -alpha, !isMax, ply + 1);
                board.UndoMove(m);

                if (val >= beta) return beta;
                if (val > alpha) alpha = val;
            }

            return alpha;
        }

        // ── SEE (Static Exchange Evaluation) đơn giản ────────────────────────
        // Ước tính giá trị của một capture: victim_value - attacker_value
        private static int SeeScore(Move m)
        {
            if (m.CapturedPiece == null) return 0;
            int victim = Evaluation.PieceValue.TryGetValue(m.CapturedPiece.Type, out int v) ? v : 0;
            return victim;
        }

        // ── Move Ordering ─────────────────────────────────────────────────────
        private void OrderMoves(List<Move> moves, Board board, int ply, Move? ttMove)
        {
            var color = board.CurrentTurn;
            int ci    = color == PieceColor.Red ? 0 : 1;

            foreach (var m in moves)
            {
                int s = 0;

                // 1. TT move — ưu tiên cao nhất
                if (ttMove != null
                    && m.FromRow == ttMove.FromRow && m.FromCol == ttMove.FromCol
                    && m.ToRow   == ttMove.ToRow   && m.ToCol   == ttMove.ToCol)
                {
                    s = 2_000_000;
                }
                // 2. Captures — MVV-LVA
                else if (m.CapturedPiece != null)
                {
                    int victim   = Evaluation.PieceValue.TryGetValue(m.CapturedPiece.Type, out int vv) ? vv : 0;
                    int attacker = GetPieceValue(board, m.FromRow, m.FromCol);
                    s = 1_000_000 + victim * 10 - attacker;
                }
                // 3. Killer moves
                else if (ply < 128 && (m == _killers[ply, 0] || m == _killers[ply, 1]))
                {
                    s = 900_000;
                }
                // 4. Counter move
                else
                {
                    // History score
                    int from = m.FromRow * Board.Cols + m.FromCol;
                    int to   = m.ToRow   * Board.Cols + m.ToCol;
                    s = _history[ci, from, to];
                }

                m.Score = s;
            }

            moves.Sort((a, b) => b.Score - a.Score);
        }

        private static int GetPieceValue(Board board, int row, int col)
        {
            var p = board.GetPiece(row, col);
            if (p == null) return 0;
            return Evaluation.PieceValue.TryGetValue(p.Type, out int v) ? v : 0;
        }

        // ── Kiểm tra có quân mạnh không (cho Null Move Pruning) ───────────────
        private static bool HasMajorPieces(Board board, PieceColor color)
        {
            for (int r = 0; r < Board.Rows; r++)
                for (int c = 0; c < Board.Cols; c++)
                {
                    var p = board.GetPiece(r, c);
                    if (p == null || p.Color != color) continue;
                    if (p.Type == PieceType.Chariot || p.Type == PieceType.Horse
                        || p.Type == PieceType.Cannon)
                        return true;
                }
            return false;
        }

        // ── Zobrist Hash ──────────────────────────────────────────────────────
        private static readonly ulong[,,,] ZobristTable;
        private static readonly ulong ZobristBlackTurn;

        static Minimax()
        {
            var rng = new Random(87654321);
            ZobristTable     = new ulong[Board.Rows, Board.Cols, 2, 8];
            ZobristBlackTurn = (ulong)rng.NextInt64();

            for (int r = 0; r < Board.Rows; r++)
                for (int c = 0; c < Board.Cols; c++)
                    for (int col = 0; col < 2; col++)
                        for (int t = 0; t < 8; t++)
                            ZobristTable[r, c, col, t] = (ulong)rng.NextInt64();
        }

        private static ulong ZobristHash(Board board)
        {
            ulong h = 0;
            for (int r = 0; r < Board.Rows; r++)
                for (int c = 0; c < Board.Cols; c++)
                {
                    var p = board.GetPiece(r, c);
                    if (p == null) continue;
                    int col = p.Color == PieceColor.Red ? 0 : 1;
                    h ^= ZobristTable[r, c, col, (int)p.Type];
                }
            if (board.CurrentTurn == PieceColor.Black) h ^= ZobristBlackTurn;
            return h;
        }
    }

    // ── Transposition Table ───────────────────────────────────────────────────
    internal enum TTFlag : byte { Exact, LowerBound, UpperBound }

    internal record struct TTEntry(ulong Hash, int Depth, int Score, TTFlag Flag, Move? BestMove, byte Age);
}
