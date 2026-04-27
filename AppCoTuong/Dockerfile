# ── Stage 1: Build React frontend ────────────────────────────────────────────
FROM node:20-alpine AS frontend-build
WORKDIR /frontend

COPY cottuong-web/package*.json ./
RUN npm ci

COPY cottuong-web/ ./

# Trỏ API về cùng origin (không cần URL tuyệt đối khi deploy)
ENV VITE_API_URL=""
RUN npm run build
# Output: /frontend/dist

# ── Stage 2: Build .NET API ───────────────────────────────────────────────────
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS backend-build
WORKDIR /api

COPY CoTuongAPI/CoTuongAPI.csproj ./
RUN dotnet restore

COPY CoTuongAPI/ ./

# Copy React build vào wwwroot để API serve luôn
COPY --from=frontend-build /frontend/dist ./wwwroot

RUN dotnet publish -c Release -o /publish

# ── Stage 3: Runtime image (nhỏ gọn) ─────────────────────────────────────────
FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS runtime
WORKDIR /app

COPY --from=backend-build /publish ./

# Railway inject PORT tự động qua biến môi trường
ENV ASPNETCORE_URLS=http://+:${PORT:-8080}
ENV ASPNETCORE_ENVIRONMENT=Production

EXPOSE 8080
ENTRYPOINT ["dotnet", "CoTuongAPI.dll"]
