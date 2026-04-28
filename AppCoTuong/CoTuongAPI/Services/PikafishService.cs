using System.Diagnostics;
using CoTuongAPI.Engine;

namespace CoTuongAPI.Services
{
    /// <summary>
    /// Wrapper giao tiếp với Pikafish qua UCCI protocol (stdin/stdout).
    ///
    /// UCCI handshake:
    ///   → ucci
    ///   ← ucciok
    ///   → position fen &lt;FEN&gt;
    ///   → go movetime &lt;ms&gt;
    ///   ← bestmove &lt;move&gt;
    /// </summary>
    public class PikafishService : IDisposable
    {
        private Process?     _proc;
        private StreamWriter? _in;
        private StreamReader? _out;
        private readonly SemaphoreSlim _lock = new(1, 1);
        private bool _ready = false;

        private static readonly string BinaryPath =
            Environment.GetEnvironmentVariable("PIKAFISH_PATH")
            ?? "/usr/local/bin/pikafish";

        // ── Khởi động process ─────────────────────────────────────────────────
        public async Task<bool> StartAsync()
        {
            if (_ready) return true;
            if (!File.Exists(BinaryPath))
            {
                Console.WriteLine($"[Pikafish] Binary not found at {BinaryPath}");
                return false;
            }

            try
            {
                _proc = new Process
                {
                    StartInfo = new ProcessStartInfo
                    {
                        FileName               = BinaryPath,
                        UseShellExecute        = false,
                        RedirectStandardInput  = true,
                        RedirectStandardOutput = true,
                        RedirectStandardError  = true,
                        CreateNoWindow         = true,
                    }
                };
                _proc.Start();
                _in  = _proc.StandardInput;
                _out = _proc.StandardOutput;

                // UCCI handshake
                await _in.WriteLineAsync("ucci");
                await _in.FlushAsync();

                // Đọc đến khi nhận "ucciok"
                var cts = new CancellationTokenSource(TimeSpan.FromSeconds(10));
                while (!cts.Token.IsCancellationRequested)
                {
                    var line = await _out.ReadLineAsync(cts.Token);
                    if (line == null) break;
                    if (line.StartsWith("ucciok", StringComparison.OrdinalIgnoreCase))
                    {
                        _ready = true;
                        Console.WriteLine("[Pikafish] Ready.");
                        break;
                    }
                }

                // Cấu hình: giới hạn RAM hash table
                if (_ready)
                {
                    await _in.WriteLineAsync("setoption name Hash value 32");
                    await _in.WriteLineAsync("setoption name Threads value 1");
                    await _in.FlushAsync();
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[Pikafish] Start failed: {ex.Message}");
                _ready = false;
            }

            return _ready;
        }

        // ── Lấy nước đi tốt nhất ─────────────────────────────────────────────
        /// <returns>Move hoặc null nếu lỗi</returns>
        public async Task<Move?> GetBestMoveAsync(Board board, int timeLimitMs = 2000)
        {
            var result = await AnalyzeAsync(board, timeLimitMs);
            return result?.BestMove;
        }

        // ── Phân tích thế cờ (trả về bestmove + score + depth) ───────────────
        public async Task<AnalysisResult?> AnalyzeAsync(Board board, int timeLimitMs = 2000)
        {
            if (!_ready) return null;

            await _lock.WaitAsync();
            try
            {
                string fen = FenConverter.ToFen(board);

                await _in!.WriteLineAsync($"position fen {fen}");
                await _in.WriteLineAsync($"go movetime {timeLimitMs}");
                await _in.FlushAsync();

                var result = new AnalysisResult();
                var cts    = new CancellationTokenSource(TimeSpan.FromMilliseconds(timeLimitMs + 5000));

                while (!cts.Token.IsCancellationRequested)
                {
                    var line = await _out!.ReadLineAsync(cts.Token);
                    if (line == null) break;

                    // "info depth 12 score cp 45 ..."
                    if (line.StartsWith("info", StringComparison.OrdinalIgnoreCase))
                    {
                        ParseInfoLine(line, result);
                        continue;
                    }

                    // "bestmove a0b2 ponder ..."
                    if (line.StartsWith("bestmove", StringComparison.OrdinalIgnoreCase))
                    {
                        var parts = line.Split(' ', StringSplitOptions.RemoveEmptyEntries);
                        if (parts.Length >= 2 && parts[1] != "(none)")
                        {
                            var (fr, fc, tr, tc) = FenConverter.ParseUcciMove(parts[1]);
                            result.BestMove = new Move(fr, fc, tr, tc);
                            result.BestMoveUcci = parts[1];
                        }
                        Console.WriteLine($"[Pikafish] bestmove={result.BestMoveUcci} score={result.Score} depth={result.Depth}");
                        return result;
                    }
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[Pikafish] Analyze error: {ex.Message}");
            }
            finally
            {
                _lock.Release();
            }

            return null;
        }

        private static void ParseInfoLine(string line, AnalysisResult r)
        {
            // info depth 10 seldepth 14 multipv 1 score cp 45 nodes 12345 nps 500000 time 100 pv a0b2 ...
            var tokens = line.Split(' ');
            for (int i = 0; i < tokens.Length - 1; i++)
            {
                switch (tokens[i])
                {
                    case "depth":
                        if (int.TryParse(tokens[i + 1], out int d)) r.Depth = d;
                        break;
                    case "cp":
                        if (int.TryParse(tokens[i + 1], out int cp)) r.Score = cp;
                        break;
                    case "mate":
                        if (int.TryParse(tokens[i + 1], out int m))
                        {
                            r.Score    = m > 0 ? 100000 : -100000;
                            r.MateIn   = m;
                            r.IsMate   = true;
                        }
                        break;
                    case "nodes":
                        if (long.TryParse(tokens[i + 1], out long n)) r.Nodes = n;
                        break;
                    case "nps":
                        if (long.TryParse(tokens[i + 1], out long nps)) r.Nps = nps;
                        break;
                    case "pv":
                        // Lấy toàn bộ PV line
                        r.PvLine = string.Join(" ", tokens[(i + 1)..]);
                        break;
                }
            }
        }

        // ── Cleanup ───────────────────────────────────────────────────────────
        public void Dispose()
        {
            try
            {
                _in?.WriteLine("quit");
                _in?.Flush();
                _proc?.WaitForExit(2000);
                _proc?.Kill();
            }
            catch { /* ignore */ }
            _proc?.Dispose();
            _in?.Dispose();
            _out?.Dispose();
            _lock.Dispose();
        }
    }

    public class AnalysisResult
    {
        public Move?  BestMove     { get; set; }
        public string BestMoveUcci { get; set; } = "";
        public int    Score        { get; set; }   // centipawns (cp), dương = lợi Đỏ
        public int    Depth        { get; set; }
        public bool   IsMate       { get; set; }
        public int    MateIn       { get; set; }
        public long   Nodes        { get; set; }
        public long   Nps          { get; set; }
        public string PvLine       { get; set; } = "";
    }
}
