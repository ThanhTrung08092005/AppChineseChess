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
        /// <param name="board">Board hiện tại</param>
        /// <param name="timeLimitMs">Thời gian suy nghĩ (ms)</param>
        /// <returns>Move hoặc null nếu lỗi</returns>
        public async Task<Move?> GetBestMoveAsync(Board board, int timeLimitMs = 2000)
        {
            if (!_ready) return null;

            await _lock.WaitAsync();
            try
            {
                string fen = FenConverter.ToFen(board);

                await _in!.WriteLineAsync($"position fen {fen}");
                await _in.WriteLineAsync($"go movetime {timeLimitMs}");
                await _in.FlushAsync();

                // Đọc đến khi nhận "bestmove"
                var cts = new CancellationTokenSource(TimeSpan.FromMilliseconds(timeLimitMs + 5000));
                while (!cts.Token.IsCancellationRequested)
                {
                    var line = await _out!.ReadLineAsync(cts.Token);
                    if (line == null) break;

                    if (line.StartsWith("bestmove", StringComparison.OrdinalIgnoreCase))
                    {
                        // "bestmove a0b2" hoặc "bestmove (none)"
                        var parts = line.Split(' ', StringSplitOptions.RemoveEmptyEntries);
                        if (parts.Length < 2 || parts[1] == "(none)") return null;

                        var (fr, fc, tr, tc) = FenConverter.ParseUcciMove(parts[1]);
                        Console.WriteLine($"[Pikafish] bestmove {parts[1]} → ({fr},{fc})→({tr},{tc})");
                        return new Move(fr, fc, tr, tc);
                    }
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[Pikafish] GetBestMove error: {ex.Message}");
            }
            finally
            {
                _lock.Release();
            }

            return null;
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
}
