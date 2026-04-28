# deploy: fa4cc9f - sidebar UI
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

# ── Stage 3: Runtime ──────────────────────────────────────────────────────────
FROM mcr.microsoft.com/dotnet/aspnet:10.0
WORKDIR /app
COPY --from=backend /publish ./
# Xóa wwwroot cũ từ publish, thay bằng React build mới
RUN rm -rf ./wwwroot
COPY --from=frontend /frontend/dist ./wwwroot

ENV ASPNETCORE_ENVIRONMENT=Production
EXPOSE 8080
ENTRYPOINT ["dotnet", "CoTuongAPI.dll"]
