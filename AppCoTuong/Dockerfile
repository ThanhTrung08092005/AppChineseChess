FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src

# Copy toàn bộ CoTuongAPI (bao gồm wwwroot)
COPY CoTuongAPI/ ./CoTuongAPI/

RUN dotnet restore CoTuongAPI/CoTuongAPI.csproj
RUN dotnet publish CoTuongAPI/CoTuongAPI.csproj -c Release -o /publish

# Verify
RUN echo "=== /publish contents ===" && ls /publish
RUN echo "=== wwwroot ===" && ls /publish/wwwroot 2>/dev/null || echo "NOT FOUND - copying manually"
RUN cp -rn /src/CoTuongAPI/wwwroot /publish/wwwroot 2>/dev/null || true
RUN echo "=== wwwroot after copy ===" && ls /publish/wwwroot

FROM mcr.microsoft.com/dotnet/aspnet:10.0
WORKDIR /app
COPY --from=build /publish ./

ENV ASPNETCORE_ENVIRONMENT=Production
EXPOSE 8080
ENTRYPOINT ["dotnet", "CoTuongAPI.dll"]
