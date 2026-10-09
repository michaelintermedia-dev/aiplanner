using System.Collections.Generic;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace AiPlanner.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class UniformItemAttributes : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "Location",
                table: "TaskItems",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<List<string>>(
                name: "People",
                table: "TaskItems",
                type: "text[]",
                nullable: false,
                defaultValueSql: "'{}'::text[]");

            migrationBuilder.AddColumn<string>(
                name: "Location",
                table: "Notes",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<List<string>>(
                name: "People",
                table: "Notes",
                type: "text[]",
                nullable: false,
                defaultValueSql: "'{}'::text[]");

            migrationBuilder.AddColumn<int>(
                name: "Priority",
                table: "Notes",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<int>(
                name: "Priority",
                table: "Appointments",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            // One text field (user's call, 2026-10-09): "Notes" text moves into the details, so nothing is lost.
            migrationBuilder.Sql("UPDATE \"TaskItems\" SET \"Description\" = CASE WHEN coalesce(\"Description\", '') = '' THEN \"Notes\" ELSE \"Description\" || E'\n\n' || \"Notes\" END, \"Notes\" = NULL WHERE coalesce(\"Notes\", '') <> '';");
            migrationBuilder.Sql("UPDATE \"Appointments\" SET \"Description\" = CASE WHEN coalesce(\"Description\", '') = '' THEN \"Notes\" ELSE \"Description\" || E'\n\n' || \"Notes\" END, \"Notes\" = NULL WHERE coalesce(\"Notes\", '') <> '';");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "Location",
                table: "TaskItems");

            migrationBuilder.DropColumn(
                name: "People",
                table: "TaskItems");

            migrationBuilder.DropColumn(
                name: "Location",
                table: "Notes");

            migrationBuilder.DropColumn(
                name: "People",
                table: "Notes");

            migrationBuilder.DropColumn(
                name: "Priority",
                table: "Notes");

            migrationBuilder.DropColumn(
                name: "Priority",
                table: "Appointments");
        }
    }
}
