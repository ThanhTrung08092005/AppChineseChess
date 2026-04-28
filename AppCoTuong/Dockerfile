# Build trigger: UI redesign - xiangqi.com style lobby v2
# ── Stage 1: Build React ─────────────────────────────────────────────────────
FROM node:20-alpine AS frontend
WORKDIR /frontend
COPY AppCoTuong/cottuong-web/package*.json ./
RUN npm ci --prefer-offline
COPY AppCoTuong/cottuong-web/ ./
RUN npm run build
# Output: /frontend/dist

# ── Stage 2: Build .NET ───────────────────────────────────────────────────────
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS backend
WORKDIR /src
COPY AppCoTuong/CoTuongAPI/ ./
RUN dotnet restore CoTuongAPI.csproj
RUN dotnet publish CoTuongAPI.csproj -c Release -o /publish

# ── Stage 3: Runtime ──────────────────────────────────────────────────────────
FROM mcr.microsoft.com/dotnet/aspnet:10.0
WORKDIR /app
COPY --from=backend /publish ./
COPY --from=frontend /frontend/dist ./wwwroot

ENV ASPNETCORE_ENVIRONMENT=Production
EXPOSE 8080
ENTRYPOINT ["dotnet", "CoTuongAPI.dll"]
