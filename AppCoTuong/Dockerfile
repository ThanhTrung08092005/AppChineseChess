# ── Build .NET API ────────────────────────────────────────────────────────────
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src

COPY CoTuongAPI/CoTuongAPI.csproj ./CoTuongAPI/
RUN dotnet restore CoTuongAPI/CoTuongAPI.csproj

COPY CoTuongAPI/ ./CoTuongAPI/

RUN dotnet publish CoTuongAPI/CoTuongAPI.csproj -c Release -o /publish

# Kiểm tra wwwroot có trong publish không
RUN ls /publish/wwwroot || echo "wwwroot missing from publish"

# ── Runtime ───────────────────────────────────────────────────────────────────
FROM mcr.microsoft.com/dotnet/aspnet:10.0
WORKDIR /app

COPY --from=build /publish ./

ENV ASPNETCORE_ENVIRONMENT=Production
EXPOSE 8080

ENTRYPOINT ["dotnet", "CoTuongAPI.dll"]
