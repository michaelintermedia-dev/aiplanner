using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace AiPlanner.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class ReminderSchedules : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "DaysOfWeek",
                table: "Reminders",
                type: "int",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<int>(
                name: "Kind",
                table: "Reminders",
                type: "int",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<int>(
                name: "MinutesBefore",
                table: "Reminders",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<TimeOnly>(
                name: "TimeOfDay",
                table: "Reminders",
                type: "time",
                nullable: true);

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

            migrationBuilder.AddColumn<TimeOnly>(
                name: "ReminderTime",
                table: "AIExtractionItems",
                type: "time",
                nullable: true);

            // Reminders on tasks/appointments used to be "N minutes before"; keep them that way.
            migrationBuilder.Sql(@"
UPDATE r SET Kind = 1, MinutesBefore = DATEDIFF(minute, r.TriggerAtUtc, t.DueDateUtc)
FROM Reminders r JOIN TaskItems t ON t.Id = r.TaskItemId WHERE t.DueDateUtc IS NOT NULL;
UPDATE r SET Kind = 1, MinutesBefore = DATEDIFF(minute, r.TriggerAtUtc, a.StartUtc)
FROM Reminders r JOIN Appointments a ON a.Id = r.AppointmentId;
UPDATE AIExtractionItems SET ReminderKind = 1 WHERE ReminderMinutesBefore IS NOT NULL;");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "DaysOfWeek",
                table: "Reminders");

            migrationBuilder.DropColumn(
                name: "Kind",
                table: "Reminders");

            migrationBuilder.DropColumn(
                name: "MinutesBefore",
                table: "Reminders");

            migrationBuilder.DropColumn(
                name: "TimeOfDay",
                table: "Reminders");

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
                name: "ReminderTime",
                table: "AIExtractionItems");
        }
    }
}
