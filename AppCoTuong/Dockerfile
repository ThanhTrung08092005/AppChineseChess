# ── Build .NET API ────────────────────────────────────────────────────────────
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src

COPY CoTuongAPI/CoTuongAPI.csproj ./CoTuongAPI/
RUN dotnet restore CoTuongAPI/CoTuongAPI.csproj

COPY CoTuongAPI/ ./CoTuongAPI/

RUN dotnet publish CoTuongAPI/CoTuongAPI.csproj -c Release -o /publish

# ── Runtime ───────────────────────────────────────────────────────────────────
FROM mcr.microsoft.com/dotnet/aspnet:10.0
WORKDIR /app

COPY --from=build /publish ./

# Đảm bảo wwwroot được copy (dotnet publish đã include nhưng copy thêm cho chắc)
COPY --from=build /src/CoTuongAPI/wwwroot ./wwwroot

ENV ASPNETCORE_ENVIRONMENT=Production
EXPOSE 8080

ENTRYPOINT ["dotnet", "CoTuongAPI.dll"]
