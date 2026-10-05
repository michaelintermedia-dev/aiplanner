using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace AiPlanner.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class EditFormProposals : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "AddedAudioKeys",
                table: "AIExtractionItems",
                type: "nvarchar(max)",
                nullable: false,
                defaultValue: "[]");

            migrationBuilder.AddColumn<bool>(
                name: "AddedRecording",
                table: "AIExtractionItems",
                type: "bit",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<string>(
                name: "AddedText",
                table: "AIExtractionItems",
                type: "nvarchar(max)",
                maxLength: 12000,
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "HeldByEditForm",
                table: "AIExtractionItems",
                type: "bit",
                nullable: false,
                defaultValue: false);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "AddedAudioKeys",
                table: "AIExtractionItems");

            migrationBuilder.DropColumn(
                name: "AddedRecording",
                table: "AIExtractionItems");

            migrationBuilder.DropColumn(
                name: "AddedText",
                table: "AIExtractionItems");

            migrationBuilder.DropColumn(
                name: "HeldByEditForm",
                table: "AIExtractionItems");
        }
    }
}
