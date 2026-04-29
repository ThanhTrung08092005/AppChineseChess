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

# ── Stage 3: Compile Pikafish từ source ──────────────────────────────────────
FROM debian:bookworm-slim AS pikafish-build

RUN apt-get update && apt-get install -y \
    git make g++ wget ca-certificates \
    --no-install-recommends \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /build

# Clone source code Pikafish (master branch)
RUN git clone --depth=1 https://github.com/official-pikafish/Pikafish.git

WORKDIR /build/Pikafish/src

# Download NNUE weights file (bắt buộc để engine chạy được)
RUN make net

# Compile với ARCH=x86-64-sse41-popcnt — tương thích rộng nhất với Railway
# (Railway dùng x86-64 Linux, hầu hết đều hỗ trợ SSE4.1)
RUN make -j$(nproc) build ARCH=x86-64-sse41-popcnt COMP=gcc \
 && make strip \
 && ls -la pikafish

# Copy binary + NNUE weights ra ngoài
RUN cp pikafish /pikafish \
 && cp *.nnue /pikafish.nnue 2>/dev/null || true

# ── Stage 4: Runtime ──────────────────────────────────────────────────────────
FROM mcr.microsoft.com/dotnet/aspnet:10.0
WORKDIR /app

COPY --from=backend      /publish          ./
COPY --from=pikafish-build /pikafish       /usr/local/bin/pikafish
COPY --from=pikafish-build /pikafish.nnue  /usr/local/share/pikafish.nnue

RUN rm -rf ./wwwroot
COPY --from=frontend     /frontend/dist    ./wwwroot

ENV ASPNETCORE_ENVIRONMENT=Production
ENV PIKAFISH_PATH=/usr/local/bin/pikafish
ENV PIKAFISH_NNUE=/usr/local/share/pikafish.nnue
EXPOSE 8080
ENTRYPOINT ["dotnet", "CoTuongAPI.dll"]
