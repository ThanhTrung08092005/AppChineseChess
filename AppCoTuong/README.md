# 象棋 · Cờ Tướng — Web App

## Cấu trúc

```
AppCoTuong/          ← WinForms app (cũ)
CoTuongAPI/          ← ASP.NET Core Web API (backend)
cottuong-web/        ← React + TypeScript (frontend)
```

## Chạy development (2 terminal)

### Terminal 1 — Backend API
```bash
cd CoTuongAPI
dotnet run
# API chạy tại http://localhost:5000
```

### Terminal 2 — Frontend React
```bash
cd cottuong-web
npm run dev
# Web chạy tại http://localhost:5173
```

Mở trình duyệt: **http://localhost:5173**

---

## Build production (1 file duy nhất)

```bash
# Build React vào wwwroot của API
cd cottuong-web
npm run build

# Chạy API (tự serve cả frontend)
cd ../CoTuongAPI
dotnet run
# Mở http://localhost:5000
```

---

## API Endpoints

| Method | URL | Mô tả |
|--------|-----|-------|
| POST | `/api/game/new` | Tạo ván mới (`{ mode: "pvai" \| "pvp" }`) |
| GET  | `/api/game/{id}` | Lấy trạng thái ván |
| POST | `/api/game/{id}/move` | Đi nước (`{ fromRow, fromCol, toRow, toCol }`) |
| POST | `/api/game/{id}/ai-move?depth=5` | AI đi (depth 1-7) |
| POST | `/api/game/{id}/undo?steps=2` | Hoàn tác |
| DELETE | `/api/game/{id}` | Xóa ván |

---

## AI — Các kỹ thuật

- **Iterative Deepening** — tìm sâu dần từ depth 1 → maxDepth
- **Alpha-Beta Pruning** — cắt tỉa nhánh không cần thiết
- **Transposition Table** (Zobrist Hash, 1M entries) — tránh tính lại vị trí đã gặp
- **Move Ordering** — ăn quân (MVV-LVA) → killer moves → history heuristic
- **Quiescence Search** — tránh horizon effect khi có nước ăn quân
- **Piece-Square Tables** — đánh giá vị trí quân trên bàn cờ
- Depth 5 mặc định, tối đa depth 7 (~8 giây)
