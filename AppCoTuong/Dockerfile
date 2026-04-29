# ── Stage 1: Compile Pikafish từ source ──────────────────────────────────────
# Đặt stage này đầu tiên để Railway cache layer sau khi build lần đầu.
# Chỉ rebuild khi thay đổi tag Pikafish.
FROM debian:bookworm-slim AS pikafish-build

RUN apt-get update && apt-get install -y \
    git make g++ wget ca-certificates \
    --no-install-recommends \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /build

# Clone tag cụ thể (không dùng master để tránh thay đổi bất ngờ)
RUN git clone --depth=1 --branch Pikafish-2026-01-02 \
    https://github.com/official-pikafish/Pikafish.git .

WORKDIR /build/src

# Download NNUE weights (tách riêng khỏi make net để kiểm soát tốt hơn)
RUN wget -q \
    "https://github.com/official-pikafish/Networks/releases/download/master-net/pikafish.nnue" \
    -O pikafish.nnue \
 && ls -lh pikafish.nnue

# Compile với SSE4.1+POPCNT — tương thích với Railway (x86-64 Linux)
# -j$(nproc) dùng tất cả CPU cores có sẵn trong build container
RUN make -j$(nproc) build ARCH=x86-64-sse41-popcnt COMP=gcc \
 && make strip \
 && ls -lh pikafish

# ── Stage 2: Build React ──────────────────────────────────────────────────────
FROM node:20-alpine AS frontend
WORKDIR /frontend
COPY cottuong-web/package*.json ./
RUN npm ci
COPY cottuong-web/ ./
RUN npm run build

# ── Stage 3: Build .NET ───────────────────────────────────────────────────────
FROM mcr.microsoft.com/dotnet/sdk:9.0 AS backend
WORKDIR /src
COPY CoTuongAPI/ ./
RUN dotnet restore CoTuongAPI.csproj
RUN dotnet publish CoTuongAPI.csproj -c Release -o /publish

# ── Stage 4: Runtime ──────────────────────────────────────────────────────────
FROM mcr.microsoft.com/dotnet/aspnet:9.0
WORKDIR /app

COPY --from=backend      /publish              ./
COPY --from=frontend     /frontend/dist        ./wwwroot
COPY --from=pikafish-build /build/src/pikafish      /usr/local/bin/pikafish
COPY --from=pikafish-build /build/src/pikafish.nnue  /usr/local/share/pikafish.nnue

RUN chmod +x /usr/local/bin/pikafish

ENV ASPNETCORE_ENVIRONMENT=Production
ENV PIKAFISH_PATH=/usr/local/bin/pikafish
ENV PIKAFISH_NNUE=/usr/local/share/pikafish.nnue

EXPOSE 8080
ENTRYPOINT ["dotnet", "CoTuongAPI.dll"]
