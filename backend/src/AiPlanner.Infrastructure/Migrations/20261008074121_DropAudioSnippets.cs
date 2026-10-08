using System.Collections.Generic;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace AiPlanner.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class DropAudioSnippets : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
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

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<List<int>>(
                name: "AudioPartDurationsMs",
                table: "VoiceCaptures",
                type: "integer[]",
                nullable: false);

            migrationBuilder.AddColumn<int>(
                name: "AudioEndMs",
                table: "AIExtractionItems",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "AudioStartMs",
                table: "AIExtractionItems",
                type: "integer",
                nullable: true);
        }
    }
}
