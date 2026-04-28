FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src

# Copy toàn bộ CoTuongAPI (bao gồm wwwroot đã build sẵn)
COPY CoTuongAPI/ ./CoTuongAPI/

# Verify wwwroot có trong source - dùng find thay vì ls
RUN find /src/CoTuongAPI/wwwroot -type f 2>/dev/null || echo "wwwroot NOT FOUND in source"

RUN dotnet restore CoTuongAPI/CoTuongAPI.csproj
RUN dotnet publish CoTuongAPI/CoTuongAPI.csproj -c Release -o /publish

# Force copy wwwroot vào publish
RUN rm -rf /publish/wwwroot && cp -r /src/CoTuongAPI/wwwroot /publish/wwwroot

# Verify
RUN find /publish/wwwroot -type f

FROM mcr.microsoft.com/dotnet/aspnet:10.0
WORKDIR /app
COPY --from=build /publish ./

# Verify trong runtime image
RUN echo "=== RUNTIME wwwroot ===" && ls /app/wwwroot

ENV ASPNETCORE_ENVIRONMENT=Production
EXPOSE 8080
ENTRYPOINT ["dotnet", "CoTuongAPI.dll"]
