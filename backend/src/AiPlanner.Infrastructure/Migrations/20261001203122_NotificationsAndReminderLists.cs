using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace AiPlanner.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class NotificationsAndReminderLists : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "ReminderAtUtc",
                table: "AIExtractionItems");

            migrationBuilder.DropColumn(
                name: "ReminderDays",
                table: "AIExtractionItems");

            migrationBuilder.DropColumn(
                name: "ReminderKind",
                table: "AIExtractionItems");

            migrationBuilder.DropColumn(
                name: "ReminderMinutesBefore",
                table: "AIExtractionItems");

            migrationBuilder.DropColumn(
                name: "ReminderTime",
                table: "AIExtractionItems");

            migrationBuilder.AddColumn<bool>(
                name: "PausedWithItem",
                table: "Reminders",
                type: "bit",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<Guid>(
                name: "NoteId",
                table: "Notifications",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "ProposedReminders",
                table: "AIExtractionItems",
                type: "nvarchar(max)",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_Notifications_NoteId",
                table: "Notifications",
                column: "NoteId");

            migrationBuilder.AddForeignKey(
                name: "FK_Notifications_Notes_NoteId",
                table: "Notifications",
                column: "NoteId",
                principalTable: "Notes",
                principalColumn: "Id");

            // Existing capture items: no proposed reminders (an empty JSON list).
            migrationBuilder.Sql("UPDATE AIExtractionItems SET ProposedReminders = N'[]' WHERE ProposedReminders IS NULL;");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Notifications_Notes_NoteId",
                table: "Notifications");

            migrationBuilder.DropIndex(
                name: "IX_Notifications_NoteId",
                table: "Notifications");

            migrationBuilder.DropColumn(
                name: "PausedWithItem",
                table: "Reminders");

            migrationBuilder.DropColumn(
                name: "NoteId",
                table: "Notifications");

            migrationBuilder.DropColumn(
                name: "ProposedReminders",
                table: "AIExtractionItems");

            migrationBuilder.AddColumn<DateTime>(
                name: "ReminderAtUtc",
                table: "AIExtractionItems",
                type: "datetime2",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "ReminderDays",
                table: "AIExtractionItems",
                type: "int",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<int>(
                name: "ReminderKind",
                table: "AIExtractionItems",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "ReminderMinutesBefore",
                table: "AIExtractionItems",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<TimeOnly>(
                name: "ReminderTime",
                table: "AIExtractionItems",
                type: "time",
                nullable: true);
        }
    }
}
