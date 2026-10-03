using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace AiPlanner.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class ContinueTargetAndUnrelated : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "ContinuesItemId",
                table: "AIExtractionItems",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "ContinuesItemType",
                table: "AIExtractionItems",
                type: "nvarchar(20)",
                maxLength: 20,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Unrelated",
                table: "AIExtractionItems",
                type: "nvarchar(4000)",
                maxLength: 4000,
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "ContinuesItemId",
                table: "AIExtractionItems");

            migrationBuilder.DropColumn(
                name: "ContinuesItemType",
                table: "AIExtractionItems");

            migrationBuilder.DropColumn(
                name: "Unrelated",
                table: "AIExtractionItems");
        }
    }
}
