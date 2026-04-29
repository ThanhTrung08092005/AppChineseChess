namespace CoTuongAPI.Services
{
    /// <summary>
    /// Opening Book cho cờ tướng — các thế khai cuộc phổ biến.
    /// FEN chuẩn Pikafish: r=Xe, n=Mã, b=Tượng, a=Sĩ, k=Tướng, c=Pháo, p=Tốt
    /// Nguồn: tổng hợp từ lý thuyết khai cuộc cờ tướng chuẩn.
    /// </summary>
    public class OpeningBookService
    {
        public record BookMove(string Ucci, string Name, string NameVi, int Weight);
        public record BookEntry(string FenPrefix, string OpeningName, string OpeningNameVi, List<BookMove> Moves);

        private readonly List<BookEntry> _book;

        public OpeningBookService()
        {
            _book = BuildBook();
        }

        /// <summary>Tra cứu nước đi khai cuộc cho FEN hiện tại</summary>
        public List<BookMove>? Lookup(string fen)
        {
            // Chỉ dùng phần board + lượt đi (bỏ halfmove/fullmove)
            var fenKey = NormalizeFen(fen);
            var entry  = _book.FirstOrDefault(e => NormalizeFen(e.FenPrefix) == fenKey);
            return entry?.Moves;
        }

        public string? GetOpeningName(string fen)
        {
            var fenKey = NormalizeFen(fen);
            return _book.FirstOrDefault(e => NormalizeFen(e.FenPrefix) == fenKey)?.OpeningNameVi;
        }

        private static string NormalizeFen(string fen)
        {
            var parts = fen.Trim().Split(' ');
            // Chỉ giữ board + lượt
            return parts.Length >= 2 ? $"{parts[0]} {parts[1]}" : parts[0];
        }

        private static List<BookEntry> BuildBook() => new()
        {
            // ── Vị trí khai cuộc ─────────────────────────────────────────────
            new("rnbakabnr/9/1c5c1/p1p1p1p1p/9/9/P1P1P1P1P/1C5C1/9/RNBAKABNR w",
                "Starting Position", "Vị trí ban đầu",
                new()
                {
                    new("b2e2", "Central Cannon",       "Trung Pháo",        100),
                    new("h2e2", "Central Cannon (alt)", "Trung Pháo (phải)", 90),
                    new("h0g2", "Horse Opening",        "Khai Mã",           70),
                    new("b0c2", "Horse Opening (left)", "Khai Mã trái",      65),
                    new("g3g4", "Soldier Advance",      "Tiến Tốt",          40),
                    new("c3c4", "Soldier Advance (c)",  "Tiến Tốt c",        35),
                }),

            // ── Sau Trung Pháo ────────────────────────────────────────────────
            new("rnbakabnr/9/1c5c1/p1p1p1p1p/9/9/P1P1P1P1P/1C2C4/9/RNBAKABNR b",
                "After Central Cannon", "Sau Trung Pháo",
                new()
                {
                    new("h9g7", "Horse Defense",         "Bình Phong Mã",     100),
                    new("b9c7", "Horse Defense (left)",  "Bình Phong Mã trái",90),
                    new("b7e7", "Cannon Counter",        "Đối Pháo",          80),
                    new("h7e7", "Cannon Counter (alt)",  "Đối Pháo phải",     75),
                    new("c6c5", "Soldier Counter",       "Tiến Tốt đối",      50),
                }),

            // ── Bình Phong Mã (Đen đáp h9g7) ─────────────────────────────────
            new("rnbakabnr/9/1c5c1/p1p1p1p1p/9/9/P1P1P1P1P/1C2C4/9/RNBAKAB1R w",
                "Screen Horse Defense", "Bình Phong Mã",
                new()
                {
                    new("h0g2", "Horse Development",    "Phát triển Mã",     100),
                    new("b0c2", "Horse Development L",  "Phát triển Mã trái",85),
                    new("i0h0", "Rook to h",            "Xe lên h",          70),
                    new("a0b0", "Rook to b",            "Xe lên b",          65),
                }),

            // ── Đối Pháo (Đen đáp b7e7) ──────────────────────────────────────
            new("rnbakabnr/9/1c2c4/p1p1p1p1p/9/9/P1P1P1P1P/1C2C4/9/RNBAKABNR w",
                "Cannon vs Cannon", "Đối Pháo",
                new()
                {
                    new("h0g2", "Horse Development",    "Phát triển Mã",     100),
                    new("b0c2", "Horse Development L",  "Phát triển Mã trái",90),
                    new("a0b0", "Rook Lift",            "Xe lên",            75),
                    new("i0h0", "Rook Lift R",          "Xe phải lên",       70),
                }),

            // ── Khai Mã (h0g2) ────────────────────────────────────────────────
            new("rnbakabnr/9/1c5c1/p1p1p1p1p/9/9/P1P1P1P1P/1C5C1/2N6/R1BAKABNR b",
                "Horse Opening", "Khai Mã",
                new()
                {
                    new("h9g7", "Mirror Horse",         "Mã đối Mã",         100),
                    new("b9c7", "Horse Counter L",      "Mã trái đối",       85),
                    new("b7e7", "Cannon Attack",        "Pháo tấn công",     75),
                    new("h7e7", "Cannon Attack R",      "Pháo phải tấn",     70),
                    new("c6c5", "Soldier Push",         "Tiến Tốt",          45),
                }),

            // ── Tiến Tốt (g3g4) ───────────────────────────────────────────────
            new("rnbakabnr/9/1c5c1/p1p1p1p1p/9/9/P1P1P3P/1C3P1C1/9/RNBAKABNR b",
                "Soldier Opening", "Khai Tốt",
                new()
                {
                    new("h9g7", "Horse Defense",        "Mã phòng thủ",      100),
                    new("c6c5", "Soldier Counter",      "Tốt đối Tốt",       90),
                    new("b7e7", "Cannon Attack",        "Pháo tấn công",     70),
                }),

            // ── Sau Trung Pháo + Bình Phong Mã + Phát triển Mã ───────────────
            new("r1bakabnr/9/1cn4c1/p1p1p1p1p/9/9/P1P1P1P1P/1C2C4/2N6/R1BAKABNR w",
                "Central Cannon vs Screen Horse", "Trung Pháo đối Bình Phong Mã",
                new()
                {
                    new("b0c2", "Horse Development",    "Phát triển Mã trái",100),
                    new("a0b0", "Rook Lift",            "Xe lên b",          85),
                    new("i0h0", "Rook Lift R",          "Xe lên h",          80),
                    new("g3g4", "Soldier Advance",      "Tiến Tốt",          60),
                }),
        };
    }
}
