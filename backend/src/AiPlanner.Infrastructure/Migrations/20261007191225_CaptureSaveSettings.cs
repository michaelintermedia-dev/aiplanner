using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace AiPlanner.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class CaptureSaveSettings : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "KeepRecordings",
                table: "UserSettings",
                type: "boolean",
                nullable: false,
                defaultValue: true); // existing accounts get the new defaults (on)

            migrationBuilder.AddColumn<bool>(
                name: "OneEntryPerMessage",
                table: "UserSettings",
                type: "boolean",
                nullable: false,
                defaultValue: true); // existing accounts get the new defaults (on)
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "KeepRecordings",
                table: "UserSettings");

            migrationBuilder.DropColumn(
                name: "OneEntryPerMessage",
                table: "UserSettings");
        }
    }
}
