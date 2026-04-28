# ── Stage 1: Build React ─────────────────────────────────────────────────────
FROM node:20-alpine AS frontend
WORKDIR /frontend
COPY cottuong-web/package*.json ./
RUN npm ci --prefer-offline
COPY cottuong-web/ ./
RUN npm run build

# ── Stage 2: Build .NET ───────────────────────────────────────────────────────
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS backend
WORKDIR /src
COPY CoTuongAPI/ ./
RUN dotnet restore CoTuongAPI.csproj
RUN dotnet publish CoTuongAPI.csproj -c Release -o /publish

# ── Stage 3: Download & extract Pikafish ─────────────────────────────────────
FROM debian:bookworm-slim AS pikafish-dl
RUN apt-get update \
 && apt-get install -y wget p7zip-full ca-certificates --no-install-recommends \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /pf

RUN wget -q \
    "https://github.com/official-pikafish/Pikafish/releases/download/Pikafish-2026-01-02/Pikafish.2026-01-02.7z" \
    -O pikafish.7z \
 && 7z x pikafish.7z -o./extracted

# Cấu trúc thực tế: ./extracted/Linux/pikafish-avx2, pikafish-bmi2, ...
# Ưu tiên: avx2 > bmi2 > sse41-popcnt > avxvnni
RUN set -e; \
    for VARIANT in avx2 bmi2 sse41-popcnt avxvnni avx512 vnni512; do \
        BIN="./extracted/Linux/pikafish-${VARIANT}"; \
        if [ -f "$BIN" ]; then \
            echo "Found: $BIN"; \
            cp "$BIN" /pikafish; \
            chmod +x /pikafish; \
            echo "Pikafish installed: $VARIANT"; \
            exit 0; \
        fi; \
    done; \
    echo "Fallback: any Linux binary"; \
    BIN=$(find ./extracted/Linux -type f | head -1); \
    if [ -z "$BIN" ]; then echo "ERROR: No Linux binary found"; exit 1; fi; \
    cp "$BIN" /pikafish; \
    chmod +x /pikafish; \
    echo "Installed: $BIN"

# ── Stage 4: Runtime ──────────────────────────────────────────────────────────
FROM mcr.microsoft.com/dotnet/aspnet:10.0
WORKDIR /app

COPY --from=backend     /publish         ./
COPY --from=pikafish-dl /pikafish        /usr/local/bin/pikafish
RUN rm -rf ./wwwroot
COPY --from=frontend    /frontend/dist   ./wwwroot

ENV ASPNETCORE_ENVIRONMENT=Production
ENV PIKAFISH_PATH=/usr/local/bin/pikafish
EXPOSE 8080
ENTRYPOINT ["dotnet", "CoTuongAPI.dll"]
