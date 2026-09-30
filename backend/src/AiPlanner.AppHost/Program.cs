var builder = DistributedApplication.CreateBuilder(args);

var sql = builder.AddSqlServer("sql")
    .WithEnvironment("MSSQL_PID", "Express")
    .WithDataVolume("aiplanner-sql-data")
    .WithLifetime(ContainerLifetime.Persistent);

var aiPlannerDb = sql.AddDatabase("aiplannerdb");

var api = builder.AddProject<Projects.AiPlanner_Api>("api")
    .WithReference(aiPlannerDb)
    .WaitFor(aiPlannerDb)
    .WithExternalHttpEndpoints();

// React web app (repo-root web/). Runs `npm run dev`; Aspire sets PORT and
// injects the API URL (services__api__*), which vite.config.ts uses for its
// /api proxy.
builder.AddViteApp("web", "../../../web")
    .WithReference(api)
    .WaitFor(api)
    .WithExternalHttpEndpoints();

builder.Build().Run();
