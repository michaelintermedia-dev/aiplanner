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

builder.Build().Run();
