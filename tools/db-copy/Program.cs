// One-off: copies the AI Planner data from the old SQL Server database into the
// new PostgreSQL one (2026-10-06 switch). The PostgreSQL schema must already
// exist (dotnet ef database update) and be empty.
//
//   dotnet run --project tools/db-copy -- "<sql server connection>" "<postgres connection>"
//
// Every column of every PostgreSQL table is read from the same-named SQL Server
// table and converted where the two differ: datetime2 -> timestamptz (UTC),
// JSON-in-nvarchar lists -> native arrays, JSON documents -> jsonb. The old
// RowVersion column has no counterpart (PostgreSQL uses its own xmin).
// Nothing is printed except table names and row counts (no user content).
using System.Data;
using System.Text.Json;
using Microsoft.Data.SqlClient;
using Npgsql;
using NpgsqlTypes;

if (args.Length < 2)
{
    Console.Error.WriteLine("Usage: DbCopy <sql server connection> <postgres connection>");
    return 1;
}

await using var source = new SqlConnection(args[0]);
await using var target = new NpgsqlConnection(args[1]);
await source.OpenAsync();
await target.OpenAsync();

// Columns of every table in the new schema.
var columns = new List<(string Table, string Column, string Type)>();
await using (var cmd = new NpgsqlCommand("""
    SELECT table_name, column_name, udt_name FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name <> '__EFMigrationsHistory'
    ORDER BY table_name, ordinal_position
    """, target))
await using (var r = await cmd.ExecuteReaderAsync())
{
    while (await r.ReadAsync()) columns.Add((r.GetString(0), r.GetString(1), r.GetString(2)));
}

await using var tx = await target.BeginTransactionAsync();
// Load in any order: foreign keys are checked by nothing during the copy (it's a faithful copy).
await new NpgsqlCommand("SET LOCAL session_replication_role = replica", target, tx).ExecuteNonQueryAsync();

foreach (var table in columns.GroupBy(c => c.Table))
{
    var existing = (long)(await new NpgsqlCommand($"SELECT count(*) FROM \"{table.Key}\"", target, tx).ExecuteScalarAsync())!;
    if (existing > 0)
    {
        Console.Error.WriteLine($"{table.Key}: already has {existing} rows - the target must be empty. Nothing was copied.");
        return 2;
    }

    var cols = table.ToList();
    var copied = 0;
    await using var read = new SqlCommand($"SELECT {string.Join(", ", cols.Select(c => $"[{c.Column}]"))} FROM [{table.Key}]", source);
    await using var rows = await read.ExecuteReaderAsync();
    var insert = $"INSERT INTO \"{table.Key}\" ({string.Join(", ", cols.Select(c => $"\"{c.Column}\""))}) VALUES ({string.Join(", ", cols.Select((_, i) => $"@p{i}"))})";
    while (await rows.ReadAsync())
    {
        await using var write = new NpgsqlCommand(insert, target, tx);
        for (var i = 0; i < cols.Count; i++)
        {
            write.Parameters.Add(Convert(cols[i].Type, rows.IsDBNull(i) ? null : rows.GetValue(i), $"@p{i}"));
        }
        await write.ExecuteNonQueryAsync();
        copied++;
    }
    Console.WriteLine($"{table.Key}: {copied}");
}

await tx.CommitAsync();
Console.WriteLine("Done.");
return 0;

static NpgsqlParameter Convert(string type, object? value, string name)
{
    if (value is null) return new NpgsqlParameter(name, DBNull.Value);
    return type switch
    {
        "timestamptz" => new NpgsqlParameter(name, NpgsqlDbType.TimestampTz) { Value = Utc((DateTime)value) },
        "jsonb" => new NpgsqlParameter(name, NpgsqlDbType.Jsonb) { Value = (string)value },
        "_text" => new NpgsqlParameter(name, NpgsqlDbType.Array | NpgsqlDbType.Text) { Value = JsonSerializer.Deserialize<string[]>((string)value) ?? [] },
        "_int4" => new NpgsqlParameter(name, NpgsqlDbType.Array | NpgsqlDbType.Integer) { Value = JsonSerializer.Deserialize<int[]>((string)value) ?? [] },
        "_timestamptz" => new NpgsqlParameter(name, NpgsqlDbType.Array | NpgsqlDbType.TimestampTz)
        {
            Value = (JsonSerializer.Deserialize<DateTime[]>((string)value) ?? []).Select(Utc).ToArray(),
        },
        "citext" => new NpgsqlParameter(name, NpgsqlDbType.Citext) { Value = value },
        "date" => new NpgsqlParameter(name, NpgsqlDbType.Date) { Value = value is DateTime d ? DateOnly.FromDateTime(d) : value },
        "time" => new NpgsqlParameter(name, NpgsqlDbType.Time) { Value = value is TimeSpan t ? TimeOnly.FromTimeSpan(t) : value },
        "interval" => new NpgsqlParameter(name, NpgsqlDbType.Interval) { Value = value },
        _ => new NpgsqlParameter(name, value),
    };
}

static DateTime Utc(DateTime d) => d.Kind == DateTimeKind.Utc ? d : DateTime.SpecifyKind(d, DateTimeKind.Utc);
