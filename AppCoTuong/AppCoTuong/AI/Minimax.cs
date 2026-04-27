using AppCoTuong.Engine;

namespace AppCoTuong.AI
{
    /// <summary>
    /// Thuật toán Minimax với Alpha-Beta pruning
    /// </summary>
    public class Minimax
    {
        private readonly int _maxDepth;

        public int NodesSearched { get; private set; }

        public Minimax(int depth = 4)
        {
            _maxDepth = depth;
        }

        /// <summary>
        /// Tìm nước đi tốt nhất cho màu hiện tại
        /// </summary>
        public Move? FindBestMove(Board board)
        {
            NodesSearched = 0;
            bool isMaximizing = board.CurrentTurn == PieceColor.Red;

            Move? bestMove = null;
            int bestScore = isMaximizing ? int.MinValue : int.MaxValue;

            var moves = MoveGenerator.GenerateLegalMoves(board, board.CurrentTurn);

            foreach (var move in moves)
            {
                board.ApplyMove(move);
                int score = AlphaBeta(board, _maxDepth - 1, int.MinValue, int.MaxValue, !isMaximizing);
                board.UndoMove(move);

                if (isMaximizing ? score > bestScore : score < bestScore)
                {
                    bestScore = score;
                    bestMove = move;
                }
            }

            return bestMove;
        }

        // ── Alpha-Beta ────────────────────────────────────────────────────────

        private int AlphaBeta(Board board, int depth, int alpha, int beta, bool isMaximizing)
        {
            NodesSearched++;

            if (depth == 0)
                return Evaluation.Evaluate(board);

            var color = isMaximizing ? PieceColor.Red : PieceColor.Black;
            var moves = MoveGenerator.GenerateLegalMoves(board, color);

            if (moves.Count == 0)
            {
                // Không còn nước đi hợp lệ → thua
                return isMaximizing ? int.MinValue + 1 : int.MaxValue - 1;
            }

            if (isMaximizing)
            {
                int maxEval = int.MinValue;
                foreach (var move in moves)
                {
                    board.ApplyMove(move);
                    int eval = AlphaBeta(board, depth - 1, alpha, beta, false);
                    board.UndoMove(move);

                    maxEval = Math.Max(maxEval, eval);
                    alpha = Math.Max(alpha, eval);
                    if (beta <= alpha) break; // Beta cut-off
                }
                return maxEval;
            }
            else
            {
                int minEval = int.MaxValue;
                foreach (var move in moves)
                {
                    board.ApplyMove(move);
                    int eval = AlphaBeta(board, depth - 1, alpha, beta, true);
                    board.UndoMove(move);

                    minEval = Math.Min(minEval, eval);
                    beta = Math.Min(beta, eval);
                    if (beta <= alpha) break; // Alpha cut-off
                }
                return minEval;
            }
        }
    }
}
