# ── Build .NET API ────────────────────────────────────────────────────────────
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src

COPY CoTuongAPI/ ./CoTuongAPI/
RUN dotnet restore CoTuongAPI/CoTuongAPI.csproj
RUN dotnet publish CoTuongAPI/CoTuongAPI.csproj -c Release -o /publish

# Copy wwwroot vào publish nếu chưa có
RUN cp -r /src/CoTuongAPI/wwwroot /publish/wwwroot 2>/dev/null || true
RUN ls /publish/wwwroot && echo "wwwroot OK" || echo "wwwroot MISSING"

# ── Runtime ───────────────────────────────────────────────────────────────────
FROM mcr.microsoft.com/dotnet/aspnet:10.0
WORKDIR /app
COPY --from=build /publish ./

ENV ASPNETCORE_ENVIRONMENT=Production
EXPOSE 8080
ENTRYPOINT ["dotnet", "CoTuongAPI.dll"]
