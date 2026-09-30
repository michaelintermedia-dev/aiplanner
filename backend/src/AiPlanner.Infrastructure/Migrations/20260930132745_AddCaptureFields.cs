using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace AiPlanner.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddCaptureFields : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AlterColumn<string>(
                name: "AudioStorageKey",
                table: "VoiceCaptures",
                type: "nvarchar(1000)",
                maxLength: 1000,
                nullable: true,
                oldClrType: typeof(string),
                oldType: "nvarchar(1000)",
                oldMaxLength: 1000);

            migrationBuilder.AddColumn<string>(
                name: "Summary",
                table: "AIExtractions",
                type: "nvarchar(2000)",
                maxLength: 2000,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Title",
                table: "AIExtractions",
                type: "nvarchar(300)",
                maxLength: 300,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Clarification",
                table: "AIExtractionItems",
                type: "nvarchar(500)",
                maxLength: 500,
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "HasTime",
                table: "AIExtractionItems",
                type: "bit",
                nullable: false,
                defaultValue: false);

            migrationBuilder.CreateIndex(
                name: "IX_AIExtractions_UserId_CreatedAtUtc",
                table: "AIExtractions",
                columns: new[] { "UserId", "CreatedAtUtc" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_AIExtractions_UserId_CreatedAtUtc",
                table: "AIExtractions");

            migrationBuilder.DropColumn(
                name: "Summary",
                table: "AIExtractions");

            migrationBuilder.DropColumn(
                name: "Title",
                table: "AIExtractions");

            migrationBuilder.DropColumn(
                name: "Clarification",
                table: "AIExtractionItems");

            migrationBuilder.DropColumn(
                name: "HasTime",
                table: "AIExtractionItems");

            migrationBuilder.AlterColumn<string>(
                name: "AudioStorageKey",
                table: "VoiceCaptures",
                type: "nvarchar(1000)",
                maxLength: 1000,
                nullable: false,
                defaultValue: "",
                oldClrType: typeof(string),
                oldType: "nvarchar(1000)",
                oldMaxLength: 1000,
                oldNullable: true);
        }
    }
}
