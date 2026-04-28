FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src

# Copy toàn bộ CoTuongAPI (bao gồm wwwroot đã build sẵn)
COPY CoTuongAPI/ ./CoTuongAPI/

# Verify wwwroot có trong source
RUN echo "=== SOURCE wwwroot ===" && ls /src/CoTuongAPI/wwwroot

RUN dotnet restore CoTuongAPI/CoTuongAPI.csproj
RUN dotnet publish CoTuongAPI/CoTuongAPI.csproj -c Release -o /publish

# Force copy wwwroot vào publish
RUN rm -rf /publish/wwwroot && cp -r /src/CoTuongAPI/wwwroot /publish/wwwroot

# Verify
RUN echo "=== PUBLISH wwwroot ===" && ls /publish/wwwroot

FROM mcr.microsoft.com/dotnet/aspnet:10.0
WORKDIR /app
COPY --from=build /publish ./

# Verify trong runtime image
RUN echo "=== RUNTIME wwwroot ===" && ls /app/wwwroot

ENV ASPNETCORE_ENVIRONMENT=Production
EXPOSE 8080
ENTRYPOINT ["dotnet", "CoTuongAPI.dll"]
