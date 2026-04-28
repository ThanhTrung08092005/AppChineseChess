# ── Build .NET API ────────────────────────────────────────────────────────────
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src

COPY CoTuongAPI/CoTuongAPI.csproj ./CoTuongAPI/
RUN dotnet restore CoTuongAPI/CoTuongAPI.csproj

COPY CoTuongAPI/ ./CoTuongAPI/

# Debug: kiểm tra wwwroot có trong source không
RUN ls /src/CoTuongAPI/wwwroot && echo "wwwroot OK in source" || echo "wwwroot MISSING in source"

RUN dotnet publish CoTuongAPI/CoTuongAPI.csproj -c Release -o /publish

# Debug: kiểm tra wwwroot có trong publish không
RUN ls /publish/wwwroot && echo "wwwroot OK in publish" || echo "wwwroot MISSING in publish"

# ── Runtime ───────────────────────────────────────────────────────────────────
FROM mcr.microsoft.com/dotnet/aspnet:10.0
WORKDIR /app

COPY --from=build /publish ./

# Copy wwwroot trực tiếp để chắc chắn
COPY --from=build /src/CoTuongAPI/wwwroot ./wwwroot

ENV ASPNETCORE_ENVIRONMENT=Production
EXPOSE 8080

ENTRYPOINT ["dotnet", "CoTuongAPI.dll"]
