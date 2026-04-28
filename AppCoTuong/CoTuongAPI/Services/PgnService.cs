using CoTuongAPI.Engine;
using System.Text;

namespace CoTuongAPI.Services
{
    /// <summary>Export/Import ván cờ theo định dạng PGN (Portable Game Notation)</summary>
    public static class PgnService
    {
        public static string ExportPgn(GameSession session)
        {
            var sb = new StringBuilder();
            sb.AppendLine("[Event \"Cờ Tướng Online\"]");
            sb.AppendLine($"[Date \"{DateTime.UtcNow:yyyy.MM.dd}\"]");
            sb.AppendLine($"[Mode \"{session.Mode}\"]");
            sb.AppendLine($"[Result \"{(session.IsGameOver ? session.Winner : "*")}\"]");
            sb.AppendLine();

            for (int i = 0; i < session.MoveHistory.Count; i++)
            {
                var m = session.MoveHistory[i];
                if (i % 2 == 0) sb.Append($"{i / 2 + 1}. ");
                sb.Append(FormatMove(m.Move));
                if (m.Captured != null) sb.Append($"x{m.Captured}");
                if (m.IsCheck) sb.Append('+');
                sb.Append(' ');
            }
            return sb.ToString().Trim();
        }

        private static string FormatMove(Move m)
            => $"{(char)('a' + m.FromCol)}{9 - m.FromRow}-{(char)('a' + m.ToCol)}{9 - m.ToRow}";
    }
}
