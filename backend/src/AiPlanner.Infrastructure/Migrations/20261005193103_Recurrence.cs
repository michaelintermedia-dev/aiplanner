using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace AiPlanner.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class Recurrence : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "SkippedOccurrencesUtc",
                table: "Appointments",
                type: "nvarchar(max)",
                nullable: false,
                defaultValue: "[]");

            migrationBuilder.AddColumn<int>(
                name: "RecurrenceDays",
                table: "AIExtractionItems",
                type: "int",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<int>(
                name: "RecurrenceInterval",
                table: "AIExtractionItems",
                type: "int",
                nullable: false,
                defaultValue: 0);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "SkippedOccurrencesUtc",
                table: "Appointments");

            migrationBuilder.DropColumn(
                name: "RecurrenceDays",
                table: "AIExtractionItems");

            migrationBuilder.DropColumn(
                name: "RecurrenceInterval",
                table: "AIExtractionItems");
        }
    }
}
