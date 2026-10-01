using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace AiPlanner.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class NoteReminders : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropCheckConstraint(
                name: "CK_Reminders_ExactlyOneParent",
                table: "Reminders");

            migrationBuilder.AddColumn<Guid>(
                name: "NoteId",
                table: "Reminders",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_Reminders_NoteId",
                table: "Reminders",
                column: "NoteId");

            migrationBuilder.AddCheckConstraint(
                name: "CK_Reminders_ExactlyOneParent",
                table: "Reminders",
                sql: "(CASE WHEN [TaskItemId] IS NULL THEN 0 ELSE 1 END + CASE WHEN [AppointmentId] IS NULL THEN 0 ELSE 1 END + CASE WHEN [NoteId] IS NULL THEN 0 ELSE 1 END) = 1");

            migrationBuilder.AddForeignKey(
                name: "FK_Reminders_Notes_NoteId",
                table: "Reminders",
                column: "NoteId",
                principalTable: "Notes",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Reminders_Notes_NoteId",
                table: "Reminders");

            migrationBuilder.DropIndex(
                name: "IX_Reminders_NoteId",
                table: "Reminders");

            migrationBuilder.DropCheckConstraint(
                name: "CK_Reminders_ExactlyOneParent",
                table: "Reminders");

            migrationBuilder.DropColumn(
                name: "NoteId",
                table: "Reminders");

            migrationBuilder.AddCheckConstraint(
                name: "CK_Reminders_ExactlyOneParent",
                table: "Reminders",
                sql: "([TaskItemId] IS NOT NULL AND [AppointmentId] IS NULL) OR ([TaskItemId] IS NULL AND [AppointmentId] IS NOT NULL)");
        }
    }
}
