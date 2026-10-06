# The API image (built from the repo root: docker compose builds it - see deploy/README.md).
# Multi-arch: builds natively on ARM (Oracle Ampere) and x86.
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src
COPY backend/ backend/
RUN dotnet publish backend/src/AiPlanner.Api/AiPlanner.Api.csproj -c Release -o /app

FROM mcr.microsoft.com/dotnet/aspnet:10.0
# ffmpeg: recordings are compressed and pauses cut with it; curl: the health check.
RUN apt-get update \
    && apt-get install -y --no-install-recommends ffmpeg curl \
    && rm -rf /var/lib/apt/lists/* \
    && mkdir -p /data/voice-captures && chown -R app /data
WORKDIR /app
COPY --from=build /app .
ENV ASPNETCORE_ENVIRONMENT=Production \
    ASPNETCORE_HTTP_PORTS=8080 \
    Hosting__BehindProxy=true \
    Database__MigrateOnStartup=true \
    FileStorage__LocalBasePath=/data/voice-captures
VOLUME /data
EXPOSE 8080
USER app
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s CMD curl -fsS http://localhost:8080/health || exit 1
ENTRYPOINT ["dotnet", "AiPlanner.Api.dll"]
