using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace AiPlanner.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class ItemAudioSnippets : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "AudioPartDurationsMs",
                table: "VoiceCaptures",
                type: "nvarchar(max)",
                nullable: false,
                defaultValue: "[]");

            migrationBuilder.AddColumn<int>(
                name: "AudioEndMs",
                table: "AIExtractionItems",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "AudioStartMs",
                table: "AIExtractionItems",
                type: "int",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "AudioPartDurationsMs",
                table: "VoiceCaptures");

            migrationBuilder.DropColumn(
                name: "AudioEndMs",
                table: "AIExtractionItems");

            migrationBuilder.DropColumn(
                name: "AudioStartMs",
                table: "AIExtractionItems");
        }
    }
}
