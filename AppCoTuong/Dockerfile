FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src

# Copy toàn bộ context vào /src
COPY . .

# Debug: xem toàn bộ cấu trúc
RUN find /src -name "index.html" 2>/dev/null || echo "No index.html found"
RUN find /src -name "*.csproj" 2>/dev/null

RUN dotnet restore CoTuongAPI/CoTuongAPI.csproj
RUN dotnet publish CoTuongAPI/CoTuongAPI.csproj -c Release -o /publish

# Copy wwwroot
RUN cp -r CoTuongAPI/wwwroot /publish/wwwroot

FROM mcr.microsoft.com/dotnet/aspnet:10.0
WORKDIR /app
COPY --from=build /publish ./

ENV ASPNETCORE_ENVIRONMENT=Production
EXPOSE 8080
ENTRYPOINT ["dotnet", "CoTuongAPI.dll"]
