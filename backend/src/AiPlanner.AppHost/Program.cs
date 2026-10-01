var builder = DistributedApplication.CreateBuilder(args);

var sql = builder.AddSqlServer("sql")
    .WithEnvironment("MSSQL_PID", "Express")
    .WithDataVolume("aiplanner-sql-data")
    .WithLifetime(ContainerLifetime.Persistent);

var aiPlannerDb = sql.AddDatabase("aiplannerdb");

var api = builder.AddProject<Projects.AiPlanner_Api>("api")
    .WithReference(aiPlannerDb)
    .WaitFor(aiPlannerDb)
    .WithExternalHttpEndpoints()
    // Listen on all interfaces (not just localhost) so a phone on the same Wi-Fi
    // can reach http://<this PC's IP>:58443. Local development only - the
    // Windows Firewall rule limits it to the local subnet (see mobile/README.md).
    .WithEndpoint("http", endpoint => endpoint.TargetHost = "0.0.0.0");

// React web app (repo-root web/). Runs `npm run dev`; Aspire sets PORT and
// injects the API URL (services__api__*), which vite.config.ts uses for its
// /api proxy. Pinned to http://localhost:5173 and not proxied, so the address
// is the same on every run (otherwise Aspire picks a random port each time).
builder.AddViteApp("web", "../../../web")
    .WithReference(api)
    .WaitFor(api)
    .WithExternalHttpEndpoints()
    .WithEndpoint("http", endpoint =>
    {
        endpoint.Port = 5173;
        endpoint.IsProxied = false;
    });

builder.Build().Run();
