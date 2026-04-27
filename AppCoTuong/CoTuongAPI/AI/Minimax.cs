using CoTuongAPI.Engine;

namespace CoTuongAPI.AI
{
    /// <summary>
    /// Minimax với:
    ///   - Alpha-Beta pruning
    ///   - Iterative Deepening (tìm sâu dần, dùng kết quả nông để sắp xếp nước đi)
    ///   - Move Ordering (ăn quân trước, killer moves, history heuristic)
    ///   - Transposition Table (Zobrist hashing)
    ///   - Quiescence Search (tránh horizon effect)
    /// </summary>
    public class Minimax
    {
        private readonly int _maxDepth;
        private readonly int _maxTimeMs;

        public int NodesSearched { get; private set; }

        // ── Transposition Table ───────────────────────────────────────────────
        private const int TT_SIZE = 1 << 20; // 1M entries
        private readonly TTEntry[] _tt = new TTEntry[TT_SIZE];

        // ── Killer Moves (2 killer per ply) ───────────────────────────────────
        private readonly Move?[,] _killers = new Move?[64, 2];

        // ── History Heuristic ─────────────────────────────────────────────────
        private readonly int[,,,] _history = new int[2, Board.Rows, Board.Cols, Board.Rows * Board.Cols];

        public Minimax(int depth = 5, int maxTimeMs = 5000)
        {
            _maxDepth  = depth;
            _maxTimeMs = maxTimeMs;
        }

        // ── Entry point ───────────────────────────────────────────────────────
        public Move? FindBestMove(Board board)
        {
            NodesSearched = 0;
            Array.Clear(_killers, 0, _killers.Length);
            Array.Clear(_history, 0, _history.Length);

            var deadline = DateTime.UtcNow.AddMilliseconds(_maxTimeMs);
            bool isMax   = board.CurrentTurn == PieceColor.Red;

            Move? bestMove  = null;
            int   bestScore = isMax ? int.MinValue : int.MaxValue;

            // Iterative Deepening
            for (int depth = 1; depth <= _maxDepth; depth++)
            {
                if (DateTime.UtcNow > deadline) break;

                var (move, score) = SearchRoot(board, depth, isMax, deadline);
                if (move != null)
                {
                    bestMove  = move;
                    bestScore = score;
                }

                // Mate found — không cần tìm sâu hơn
                if (Math.Abs(bestScore) > 90000) break;
            }

            return bestMove;
        }

        private (Move? move, int score) SearchRoot(Board board, int depth, bool isMax, DateTime deadline)
        {
            var moves = MoveGenerator.GenerateLegalMoves(board, board.CurrentTurn);
            if (moves.Count == 0) return (null, isMax ? int.MinValue + 1 : int.MaxValue - 1);

            OrderMoves(moves, board, 0);

            Move? best  = null;
            int alpha   = int.MinValue + 1;
            int beta    = int.MaxValue - 1;
            int bestVal = isMax ? int.MinValue + 1 : int.MaxValue - 1;

            foreach (var m in moves)
            {
                if (DateTime.UtcNow > deadline) break;

                board.ApplyMove(m);
                int val = AlphaBeta(board, depth - 1, alpha, beta, !isMax, 1, deadline);
                board.UndoMove(m);

                if (isMax ? val > bestVal : val < bestVal)
                {
                    bestVal = val;
                    best    = m;
                }
                if (isMax) alpha = Math.Max(alpha, val);
                else       beta  = Math.Min(beta,  val);
            }

            return (best, bestVal);
        }

        // ── Alpha-Beta ────────────────────────────────────────────────────────
        private int AlphaBeta(Board board, int depth, int alpha, int beta,
                              bool isMax, int ply, DateTime deadline)
        {
            NodesSearched++;

            // Transposition Table lookup
            ulong hash  = ZobristHash(board);
            int   ttIdx = (int)(hash % TT_SIZE);
            var   tte   = _tt[ttIdx];
            if (tte.Hash == hash && tte.Depth >= depth)
            {
                if (tte.Flag == TTFlag.Exact)                        return tte.Score;
                if (tte.Flag == TTFlag.LowerBound && tte.Score > alpha) alpha = tte.Score;
                if (tte.Flag == TTFlag.UpperBound && tte.Score < beta)  beta  = tte.Score;
                if (alpha >= beta) return tte.Score;
            }

            if (depth == 0 || DateTime.UtcNow > deadline)
                return QuiescenceSearch(board, alpha, beta, isMax);

            var color = isMax ? PieceColor.Red : PieceColor.Black;
            var moves = MoveGenerator.GenerateLegalMoves(board, color);

            if (moves.Count == 0)
                return isMax ? int.MinValue + ply : int.MaxValue - ply;

            OrderMoves(moves, board, ply);

            int  origAlpha = alpha;
            Move? bestMove = null;
            int  bestVal   = isMax ? int.MinValue + 1 : int.MaxValue - 1;

            foreach (var m in moves)
            {
                board.ApplyMove(m);
                int val = AlphaBeta(board, depth - 1, alpha, beta, !isMax, ply + 1, deadline);
                board.UndoMove(m);

                if (isMax ? val > bestVal : val < bestVal)
                {
                    bestVal  = val;
                    bestMove = m;
                }

                if (isMax) { alpha = Math.Max(alpha, val); }
                else       { beta  = Math.Min(beta,  val); }

                if (alpha >= beta)
                {
                    // Killer move update
                    if (m.CapturedPiece == null && ply < 64)
                    {
                        _killers[ply, 1] = _killers[ply, 0];
                        _killers[ply, 0] = m;
                    }
                    // History heuristic update
                    int ci = color == PieceColor.Red ? 0 : 1;
                    _history[ci, m.FromRow, m.FromCol, m.ToRow * Board.Cols + m.ToCol]
                        += depth * depth;
                    break;
                }
            }

            // TT store
            var flag = bestVal <= origAlpha ? TTFlag.UpperBound
                     : bestVal >= beta      ? TTFlag.LowerBound
                                            : TTFlag.Exact;
            _tt[ttIdx] = new TTEntry(hash, depth, bestVal, flag);

            return bestVal;
        }

        // ── Quiescence Search ─────────────────────────────────────────────────
        private int QuiescenceSearch(Board board, int alpha, int beta, bool isMax)
        {
            NodesSearched++;
            int stand = Evaluation.Evaluate(board);

            if (isMax)
            {
                if (stand >= beta)  return beta;
                if (stand > alpha)  alpha = stand;
            }
            else
            {
                if (stand <= alpha) return alpha;
                if (stand < beta)   beta = stand;
            }

            var color   = isMax ? PieceColor.Red : PieceColor.Black;
            var pseudo  = MoveGenerator.GeneratePseudoMoves(board, color);
            var captures = pseudo.Where(m => m.CapturedPiece != null).ToList();

            // Sắp xếp captures theo MVV-LVA
            captures.Sort((a, b2) => MvvLva(b2) - MvvLva(a));

            foreach (var m in captures)
            {
                board.ApplyMove(m);
                if (board.IsInCheck(color)) { board.UndoMove(m); continue; }
                int val = QuiescenceSearch(board, alpha, beta, !isMax);
                board.UndoMove(m);

                if (isMax) { alpha = Math.Max(alpha, val); if (alpha >= beta) return beta; }
                else       { beta  = Math.Min(beta,  val); if (alpha >= beta) return alpha; }
            }

            return isMax ? alpha : beta;
        }

        // ── Move Ordering ─────────────────────────────────────────────────────
        private void OrderMoves(List<Move> moves, Board board, int ply)
        {
            foreach (var m in moves)
            {
                int s = 0;
                if (m.CapturedPiece != null)
                    s += 10000 + MvvLva(m);                    // ăn quân: ưu tiên cao nhất
                else if (ply < 64 && (m == _killers[ply, 0] || m == _killers[ply, 1]))
                    s += 9000;                                  // killer move
                else
                {
                    int ci = board.CurrentTurn == PieceColor.Red ? 0 : 1;
                    s += _history[ci, m.FromRow, m.FromCol, m.ToRow * Board.Cols + m.ToCol];
                }
                m.Score = s;
            }
            moves.Sort((a, b) => b.Score - a.Score);
        }

        // MVV-LVA: Most Valuable Victim - Least Valuable Attacker
        private static int MvvLva(Move m)
        {
            if (m.CapturedPiece == null) return 0;
            int victim   = Evaluation.PieceValue.TryGetValue(m.CapturedPiece.Type, out int v) ? v : 0;
            return victim;
        }

        // ── Zobrist Hash (đơn giản) ───────────────────────────────────────────
        private static readonly ulong[,,,] ZobristTable;
        private static readonly ulong ZobristBlackTurn;

        static Minimax()
        {
            var rng = new Random(12345678); // fixed seed cho Zobrist
            ZobristTable    = new ulong[Board.Rows, Board.Cols, 2, 8];
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

    // ── Transposition Table types ─────────────────────────────────────────────
    internal enum TTFlag : byte { Exact, LowerBound, UpperBound }

    internal record struct TTEntry(ulong Hash, int Depth, int Score, TTFlag Flag);
}
