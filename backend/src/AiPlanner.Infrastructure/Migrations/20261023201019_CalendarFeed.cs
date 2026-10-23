using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace AiPlanner.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class CalendarFeed : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "CalendarFeedToken",
                table: "UserSettings",
                type: "character varying(64)",
                maxLength: 64,
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_UserSettings_CalendarFeedToken",
                table: "UserSettings",
                column: "CalendarFeedToken",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_UserSettings_CalendarFeedToken",
                table: "UserSettings");

            migrationBuilder.DropColumn(
                name: "CalendarFeedToken",
                table: "UserSettings");
        }
    }
}
