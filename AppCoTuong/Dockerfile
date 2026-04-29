# ── Stage 1: Build React ─────────────────────────────────────────────────────
FROM node:20-alpine AS frontend
WORKDIR /frontend
COPY cottuong-web/package*.json ./
RUN npm ci
COPY cottuong-web/ ./
RUN npm run build

# ── Stage 2: Build .NET ───────────────────────────────────────────────────────
FROM mcr.microsoft.com/dotnet/sdk:9.0 AS backend
WORKDIR /src
COPY CoTuongAPI/ ./
RUN dotnet restore CoTuongAPI.csproj
RUN dotnet publish CoTuongAPI.csproj -c Release -o /publish

# ── Stage 3: Download Pikafish pre-built + NNUE ───────────────────────────────
# Dùng pre-built binary thay vì compile từ source:
#   - Nhanh hơn ~15 phút → ~30 giây
#   - Không tốn RAM compile C++
#   - Không bị timeout Railway
FROM debian:bookworm-slim AS pikafish-download

RUN apt-get update && apt-get install -y \
    wget p7zip-full ca-certificates \
    --no-install-recommends \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /tmp/pikafish

# Download Pikafish 2026-01-02 release bundle (.7z)
RUN wget -q --tries=3 --timeout=120 \
    "https://github.com/official-pikafish/Pikafish/releases/download/Pikafish-2026-01-02/Pikafish.2026-01-02.7z" \
    -O pikafish.7z \
 && 7z x pikafish.7z -o./extracted \
 && echo "=== Files extracted ===" \
 && find ./extracted -type f | sort

# Lấy binary Linux x86-64 (sse41-popcnt = tương thích rộng nhất)
# Tên file trong archive thường là: pikafish-{version}-{arch}
RUN BINARY=$(find ./extracted -type f \( -name "*x86-64-sse41*" -o -name "*linux*x86*" \) \
      ! -name "*.exe" ! -name "*.dll" ! -name "*.txt" ! -name "*.md" | head -1) \
 && if [ -z "$BINARY" ]; then \
      echo "sse41 not found, trying any non-Windows binary..." ; \
      BINARY=$(find ./extracted -type f ! -name "*.exe" ! -name "*.dll" \
               ! -name "*.txt" ! -name "*.md" ! -name "*.7z" | head -1) ; \
    fi \
 && echo "Using binary: $BINARY" \
 && cp "$BINARY" /pikafish \
 && chmod +x /pikafish \
 && file /pikafish

# Download NNUE weights (~49MB, file đơn)
RUN wget -q --tries=3 --timeout=120 \
    "https://github.com/official-pikafish/Networks/releases/download/master-net/pikafish.nnue" \
    -O /pikafish.nnue \
 && ls -lh /pikafish.nnue

# ── Stage 4: Runtime ──────────────────────────────────────────────────────────
FROM mcr.microsoft.com/dotnet/aspnet:9.0
WORKDIR /app

COPY --from=backend           /publish          ./
COPY --from=frontend          /frontend/dist    ./wwwroot
COPY --from=pikafish-download /pikafish         /usr/local/bin/pikafish
COPY --from=pikafish-download /pikafish.nnue    /usr/local/share/pikafish.nnue

RUN chmod +x /usr/local/bin/pikafish

ENV ASPNETCORE_ENVIRONMENT=Production
ENV PIKAFISH_PATH=/usr/local/bin/pikafish
ENV PIKAFISH_NNUE=/usr/local/share/pikafish.nnue

EXPOSE 8080
ENTRYPOINT ["dotnet", "CoTuongAPI.dll"]
