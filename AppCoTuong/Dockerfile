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
RUN apt-get update && apt-get install -y wget p7zip-full ca-certificates --no-install-recommends \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /pf
RUN wget -q \
    "https://github.com/official-pikafish/Pikafish/releases/download/Pikafish-2026-01-02/Pikafish.2026-01-02.7z" \
    -O pikafish.7z \
 && 7z x pikafish.7z -o./extracted \
 # Tìm binary linux x86-64 (ưu tiên avx2, fallback bmi2, fallback generic)
 && find ./extracted -name "*linux*x86-64*avx2*" -type f | head -1 | xargs -I{} cp {} /pikafish \
 || find ./extracted -name "*linux*x86-64*bmi2*" -type f | head -1 | xargs -I{} cp {} /pikafish \
 || find ./extracted -name "*linux*x86-64*"      -type f | head -1 | xargs -I{} cp {} /pikafish \
 && chmod +x /pikafish \
 && ls -la /pikafish

# ── Stage 4: Runtime ──────────────────────────────────────────────────────────
FROM mcr.microsoft.com/dotnet/aspnet:10.0
WORKDIR /app

COPY --from=backend  /publish    ./
COPY --from=pikafish-dl /pikafish /usr/local/bin/pikafish
RUN rm -rf ./wwwroot
COPY --from=frontend /frontend/dist ./wwwroot

ENV ASPNETCORE_ENVIRONMENT=Production
ENV PIKAFISH_PATH=/usr/local/bin/pikafish
EXPOSE 8080
ENTRYPOINT ["dotnet", "CoTuongAPI.dll"]
