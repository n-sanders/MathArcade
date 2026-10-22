# Pod Racer (React/Vite app in podracer/)
FROM node:22-alpine AS podracer
WORKDIR /podracer
COPY podracer/package.json podracer/package-lock.json ./
RUN npm ci
COPY podracer/ .
RUN npm test
RUN npm run build

# Build
FROM mcr.microsoft.com/dotnet/sdk:9.0 AS build
WORKDIR /src
COPY MathArcade.csproj .
RUN dotnet restore
COPY . .
RUN dotnet publish -c Release -o /app/publish --no-restore

# Runtime
FROM mcr.microsoft.com/dotnet/aspnet:9.0 AS final
WORKDIR /app
COPY --from=build /app/publish .
COPY --from=podracer /podracer/dist ./wwwroot/games/podracer
ENV ASPNETCORE_URLS=http://+:8080
ENV ConnectionStrings__Default="Data Source=/data/matharcade.db"
EXPOSE 8080
VOLUME /data
ENTRYPOINT ["dotnet", "MathArcade.dll"]
