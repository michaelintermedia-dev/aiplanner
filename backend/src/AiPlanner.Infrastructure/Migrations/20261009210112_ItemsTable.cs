using System;
using System.Collections.Generic;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace AiPlanner.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class ItemsTable : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_AppointmentParticipants_Appointments_AppointmentId",
                table: "AppointmentParticipants");

            migrationBuilder.DropForeignKey(
                name: "FK_AppointmentTags_Appointments_AppointmentId",
                table: "AppointmentTags");

            migrationBuilder.DropForeignKey(
                name: "FK_NoteTags_Notes_NoteId",
                table: "NoteTags");

            migrationBuilder.DropForeignKey(
                name: "FK_Notifications_Appointments_AppointmentId",
                table: "Notifications");

            migrationBuilder.DropForeignKey(
                name: "FK_Notifications_Notes_NoteId",
                table: "Notifications");

            migrationBuilder.DropForeignKey(
                name: "FK_Notifications_TaskItems_TaskItemId",
                table: "Notifications");

            migrationBuilder.DropForeignKey(
                name: "FK_Reminders_Appointments_AppointmentId",
                table: "Reminders");

            migrationBuilder.DropForeignKey(
                name: "FK_Reminders_Notes_NoteId",
                table: "Reminders");

            migrationBuilder.DropForeignKey(
                name: "FK_Reminders_TaskItems_TaskItemId",
                table: "Reminders");

            migrationBuilder.DropForeignKey(
                name: "FK_TaskItems_AIExtractions_SourceAiExtractionId",
                table: "TaskItems");

            migrationBuilder.DropForeignKey(
                name: "FK_TaskItems_RecurrenceRules_RecurrenceRuleId",
                table: "TaskItems");

            migrationBuilder.DropForeignKey(
                name: "FK_TaskTags_TaskItems_TaskItemId",
                table: "TaskTags");

            migrationBuilder.DropPrimaryKey(
                name: "PK_TaskItems",
                table: "TaskItems");

            migrationBuilder.DropIndex(
                name: "IX_TaskItems_UserId_DueDateUtc",
                table: "TaskItems");

            migrationBuilder.DropIndex(
                name: "IX_TaskItems_UserId_Status",
                table: "TaskItems");

            migrationBuilder.RenameTable(
                name: "TaskItems",
                newName: "Items");

            migrationBuilder.RenameColumn(
                name: "HasDueTime",
                table: "Items",
                newName: "HasTime");

            migrationBuilder.RenameColumn(
                name: "DueDateUtc",
                table: "Items",
                newName: "DateUtc");

            migrationBuilder.RenameColumn(
                name: "Description",
                table: "Items",
                newName: "Text");

            migrationBuilder.RenameIndex(
                name: "IX_TaskItems_SourceAiExtractionId",
                table: "Items",
                newName: "IX_Items_SourceAiExtractionId");

            migrationBuilder.RenameIndex(
                name: "IX_TaskItems_RecurrenceRuleId",
                table: "Items",
                newName: "IX_Items_RecurrenceRuleId");

            migrationBuilder.AlterColumn<string>(
                name: "Title",
                table: "Items",
                type: "character varying(300)",
                maxLength: 300,
                nullable: true,
                oldClrType: typeof(string),
                oldType: "character varying(300)",
                oldMaxLength: 300);

            migrationBuilder.AlterColumn<int>(
                name: "Status",
                table: "Items",
                type: "integer",
                nullable: true,
                oldClrType: typeof(int),
                oldType: "integer");

            migrationBuilder.AlterColumn<int>(
                name: "Priority",
                table: "Items",
                type: "integer",
                nullable: true,
                oldClrType: typeof(int),
                oldType: "integer");

            migrationBuilder.AlterColumn<List<string>>(
                name: "People",
                table: "Items",
                type: "text[]",
                nullable: true,
                oldClrType: typeof(List<string>),
                oldType: "text[]");

            migrationBuilder.AlterColumn<string>(
                name: "Location",
                table: "Items",
                type: "character varying(300)",
                maxLength: 300,
                nullable: true,
                oldClrType: typeof(string),
                oldType: "text",
                oldNullable: true);

            migrationBuilder.AlterColumn<bool>(
                name: "HasTime",
                table: "Items",
                type: "boolean",
                nullable: true,
                oldClrType: typeof(bool),
                oldType: "boolean");

            migrationBuilder.AlterColumn<string>(
                name: "Text",
                table: "Items",
                type: "text",
                nullable: true,
                oldClrType: typeof(string),
                oldType: "character varying(4000)",
                oldMaxLength: 4000,
                oldNullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "EndUtc",
                table: "Items",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "Kind",
                table: "Items",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<List<DateTime>>(
                name: "SkippedOccurrencesUtc",
                table: "Items",
                type: "timestamp with time zone[]",
                nullable: true);

            // Tasks, events and notes become one table (user's call, 2026-10-09): the tasks
            // table became "Items" (Kind 0); events (Kind 1) and notes (Kind 2) are copied in
            // with the same ids, every field kept - before their old tables go.
            migrationBuilder.Sql("""
                INSERT INTO "Items" ("Id", "UserId", "CreatedAtUtc", "UpdatedAtUtc", "IsDeleted", "Kind",
                    "Title", "Text", "Notes", "AiSummary", "DateUtc", "EndUtc", "Location", "Status",
                    "RecurrenceRuleId", "SkippedOccurrencesUtc", "SourceAiExtractionId", "Priority")
                SELECT "Id", "UserId", "CreatedAtUtc", "UpdatedAtUtc", "IsDeleted", 1,
                    "Title", "Description", "Notes", "AiSummary", "StartUtc", "EndUtc", "Location", "Status",
                    "RecurrenceRuleId", "SkippedOccurrencesUtc", "SourceAiExtractionId", "Priority"
                FROM "Appointments";
                """);
            migrationBuilder.Sql("""
                INSERT INTO "Items" ("Id", "UserId", "CreatedAtUtc", "UpdatedAtUtc", "IsDeleted", "Kind",
                    "Title", "Text", "AiSummary", "SourceAiExtractionId", "Priority", "Location", "People")
                SELECT "Id", "UserId", "CreatedAtUtc", "UpdatedAtUtc", "IsDeleted", 2,
                    "Title", "Content", "AiSummary", "SourceAiExtractionId", "Priority", "Location", "People"
                FROM "Notes";
                """);

            migrationBuilder.DropTable(
                name: "Appointments");

            migrationBuilder.DropTable(
                name: "Notes");

            migrationBuilder.AddPrimaryKey(
                name: "PK_Items",
                table: "Items",
                column: "Id");

            migrationBuilder.CreateIndex(
                name: "IX_Items_UserId_Kind",
                table: "Items",
                columns: new[] { "UserId", "Kind" });

            migrationBuilder.AddForeignKey(
                name: "FK_AppointmentParticipants_Items_AppointmentId",
                table: "AppointmentParticipants",
                column: "AppointmentId",
                principalTable: "Items",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_AppointmentTags_Items_AppointmentId",
                table: "AppointmentTags",
                column: "AppointmentId",
                principalTable: "Items",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_Items_AIExtractions_SourceAiExtractionId",
                table: "Items",
                column: "SourceAiExtractionId",
                principalTable: "AIExtractions",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);

            migrationBuilder.AddForeignKey(
                name: "FK_Items_RecurrenceRules_RecurrenceRuleId",
                table: "Items",
                column: "RecurrenceRuleId",
                principalTable: "RecurrenceRules",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);

            migrationBuilder.AddForeignKey(
                name: "FK_NoteTags_Items_NoteId",
                table: "NoteTags",
                column: "NoteId",
                principalTable: "Items",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_Notifications_Items_AppointmentId",
                table: "Notifications",
                column: "AppointmentId",
                principalTable: "Items",
                principalColumn: "Id");

            migrationBuilder.AddForeignKey(
                name: "FK_Notifications_Items_NoteId",
                table: "Notifications",
                column: "NoteId",
                principalTable: "Items",
                principalColumn: "Id");

            migrationBuilder.AddForeignKey(
                name: "FK_Notifications_Items_TaskItemId",
                table: "Notifications",
                column: "TaskItemId",
                principalTable: "Items",
                principalColumn: "Id");

            migrationBuilder.AddForeignKey(
                name: "FK_Reminders_Items_AppointmentId",
                table: "Reminders",
                column: "AppointmentId",
                principalTable: "Items",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_Reminders_Items_NoteId",
                table: "Reminders",
                column: "NoteId",
                principalTable: "Items",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_Reminders_Items_TaskItemId",
                table: "Reminders",
                column: "TaskItemId",
                principalTable: "Items",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_TaskTags_Items_TaskItemId",
                table: "TaskTags",
                column: "TaskItemId",
                principalTable: "Items",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_AppointmentParticipants_Items_AppointmentId",
                table: "AppointmentParticipants");

            migrationBuilder.DropForeignKey(
                name: "FK_AppointmentTags_Items_AppointmentId",
                table: "AppointmentTags");

            migrationBuilder.DropForeignKey(
                name: "FK_Items_AIExtractions_SourceAiExtractionId",
                table: "Items");

            migrationBuilder.DropForeignKey(
                name: "FK_Items_RecurrenceRules_RecurrenceRuleId",
                table: "Items");

            migrationBuilder.DropForeignKey(
                name: "FK_NoteTags_Items_NoteId",
                table: "NoteTags");

            migrationBuilder.DropForeignKey(
                name: "FK_Notifications_Items_AppointmentId",
                table: "Notifications");

            migrationBuilder.DropForeignKey(
                name: "FK_Notifications_Items_NoteId",
                table: "Notifications");

            migrationBuilder.DropForeignKey(
                name: "FK_Notifications_Items_TaskItemId",
                table: "Notifications");

            migrationBuilder.DropForeignKey(
                name: "FK_Reminders_Items_AppointmentId",
                table: "Reminders");

            migrationBuilder.DropForeignKey(
                name: "FK_Reminders_Items_NoteId",
                table: "Reminders");

            migrationBuilder.DropForeignKey(
                name: "FK_Reminders_Items_TaskItemId",
                table: "Reminders");

            migrationBuilder.DropForeignKey(
                name: "FK_TaskTags_Items_TaskItemId",
                table: "TaskTags");

            migrationBuilder.DropPrimaryKey(
                name: "PK_Items",
                table: "Items");

            migrationBuilder.DropIndex(
                name: "IX_Items_UserId_Kind",
                table: "Items");

            migrationBuilder.DropColumn(
                name: "EndUtc",
                table: "Items");

            migrationBuilder.DropColumn(
                name: "Kind",
                table: "Items");

            migrationBuilder.DropColumn(
                name: "SkippedOccurrencesUtc",
                table: "Items");

            migrationBuilder.RenameTable(
                name: "Items",
                newName: "TaskItems");

            migrationBuilder.RenameColumn(
                name: "Text",
                table: "TaskItems",
                newName: "Description");

            migrationBuilder.RenameColumn(
                name: "HasTime",
                table: "TaskItems",
                newName: "HasDueTime");

            migrationBuilder.RenameColumn(
                name: "DateUtc",
                table: "TaskItems",
                newName: "DueDateUtc");

            migrationBuilder.RenameIndex(
                name: "IX_Items_SourceAiExtractionId",
                table: "TaskItems",
                newName: "IX_TaskItems_SourceAiExtractionId");

            migrationBuilder.RenameIndex(
                name: "IX_Items_RecurrenceRuleId",
                table: "TaskItems",
                newName: "IX_TaskItems_RecurrenceRuleId");

            migrationBuilder.AlterColumn<string>(
                name: "Title",
                table: "TaskItems",
                type: "character varying(300)",
                maxLength: 300,
                nullable: false,
                defaultValue: "",
                oldClrType: typeof(string),
                oldType: "character varying(300)",
                oldMaxLength: 300,
                oldNullable: true);

            migrationBuilder.AlterColumn<int>(
                name: "Status",
                table: "TaskItems",
                type: "integer",
                nullable: false,
                defaultValue: 0,
                oldClrType: typeof(int),
                oldType: "integer",
                oldNullable: true);

            migrationBuilder.AlterColumn<int>(
                name: "Priority",
                table: "TaskItems",
                type: "integer",
                nullable: false,
                defaultValue: 0,
                oldClrType: typeof(int),
                oldType: "integer",
                oldNullable: true);

            migrationBuilder.AlterColumn<List<string>>(
                name: "People",
                table: "TaskItems",
                type: "text[]",
                nullable: false,
                oldClrType: typeof(List<string>),
                oldType: "text[]",
                oldNullable: true);

            migrationBuilder.AlterColumn<string>(
                name: "Location",
                table: "TaskItems",
                type: "text",
                nullable: true,
                oldClrType: typeof(string),
                oldType: "character varying(300)",
                oldMaxLength: 300,
                oldNullable: true);

            migrationBuilder.AlterColumn<string>(
                name: "Description",
                table: "TaskItems",
                type: "character varying(4000)",
                maxLength: 4000,
                nullable: true,
                oldClrType: typeof(string),
                oldType: "text",
                oldNullable: true);

            migrationBuilder.AlterColumn<bool>(
                name: "HasDueTime",
                table: "TaskItems",
                type: "boolean",
                nullable: false,
                defaultValue: false,
                oldClrType: typeof(bool),
                oldType: "boolean",
                oldNullable: true);

            migrationBuilder.AddPrimaryKey(
                name: "PK_TaskItems",
                table: "TaskItems",
                column: "Id");

            migrationBuilder.CreateTable(
                name: "Appointments",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    RecurrenceRuleId = table.Column<Guid>(type: "uuid", nullable: true),
                    SourceAiExtractionId = table.Column<Guid>(type: "uuid", nullable: true),
                    AiSummary = table.Column<string>(type: "text", nullable: true),
                    CreatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    Description = table.Column<string>(type: "text", nullable: true),
                    EndUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    IsDeleted = table.Column<bool>(type: "boolean", nullable: false),
                    Location = table.Column<string>(type: "character varying(300)", maxLength: 300, nullable: true),
                    Notes = table.Column<string>(type: "text", nullable: true),
                    Priority = table.Column<int>(type: "integer", nullable: false),
                    xmin = table.Column<uint>(type: "xid", rowVersion: true, nullable: false),
                    SkippedOccurrencesUtc = table.Column<List<DateTime>>(type: "timestamp with time zone[]", nullable: false),
                    StartUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    Status = table.Column<int>(type: "integer", nullable: false),
                    Title = table.Column<string>(type: "character varying(300)", maxLength: 300, nullable: false),
                    UpdatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UserId = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Appointments", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Appointments_AIExtractions_SourceAiExtractionId",
                        column: x => x.SourceAiExtractionId,
                        principalTable: "AIExtractions",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_Appointments_RecurrenceRules_RecurrenceRuleId",
                        column: x => x.RecurrenceRuleId,
                        principalTable: "RecurrenceRules",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateTable(
                name: "Notes",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    SourceAiExtractionId = table.Column<Guid>(type: "uuid", nullable: true),
                    AiSummary = table.Column<string>(type: "text", nullable: true),
                    Content = table.Column<string>(type: "text", nullable: false),
                    CreatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    IsDeleted = table.Column<bool>(type: "boolean", nullable: false),
                    Location = table.Column<string>(type: "text", nullable: true),
                    People = table.Column<List<string>>(type: "text[]", nullable: false),
                    Priority = table.Column<int>(type: "integer", nullable: false),
                    xmin = table.Column<uint>(type: "xid", rowVersion: true, nullable: false),
                    Title = table.Column<string>(type: "character varying(300)", maxLength: 300, nullable: true),
                    UpdatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UserId = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Notes", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Notes_AIExtractions_SourceAiExtractionId",
                        column: x => x.SourceAiExtractionId,
                        principalTable: "AIExtractions",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateIndex(
                name: "IX_TaskItems_UserId_DueDateUtc",
                table: "TaskItems",
                columns: new[] { "UserId", "DueDateUtc" });

            migrationBuilder.CreateIndex(
                name: "IX_TaskItems_UserId_Status",
                table: "TaskItems",
                columns: new[] { "UserId", "Status" });

            migrationBuilder.CreateIndex(
                name: "IX_Appointments_RecurrenceRuleId",
                table: "Appointments",
                column: "RecurrenceRuleId");

            migrationBuilder.CreateIndex(
                name: "IX_Appointments_SourceAiExtractionId",
                table: "Appointments",
                column: "SourceAiExtractionId");

            migrationBuilder.CreateIndex(
                name: "IX_Appointments_UserId_StartUtc",
                table: "Appointments",
                columns: new[] { "UserId", "StartUtc" });

            migrationBuilder.CreateIndex(
                name: "IX_Notes_SourceAiExtractionId",
                table: "Notes",
                column: "SourceAiExtractionId");

            migrationBuilder.AddForeignKey(
                name: "FK_AppointmentParticipants_Appointments_AppointmentId",
                table: "AppointmentParticipants",
                column: "AppointmentId",
                principalTable: "Appointments",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_AppointmentTags_Appointments_AppointmentId",
                table: "AppointmentTags",
                column: "AppointmentId",
                principalTable: "Appointments",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_NoteTags_Notes_NoteId",
                table: "NoteTags",
                column: "NoteId",
                principalTable: "Notes",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_Notifications_Appointments_AppointmentId",
                table: "Notifications",
                column: "AppointmentId",
                principalTable: "Appointments",
                principalColumn: "Id");

            migrationBuilder.AddForeignKey(
                name: "FK_Notifications_Notes_NoteId",
                table: "Notifications",
                column: "NoteId",
                principalTable: "Notes",
                principalColumn: "Id");

            migrationBuilder.AddForeignKey(
                name: "FK_Notifications_TaskItems_TaskItemId",
                table: "Notifications",
                column: "TaskItemId",
                principalTable: "TaskItems",
                principalColumn: "Id");

            migrationBuilder.AddForeignKey(
                name: "FK_Reminders_Appointments_AppointmentId",
                table: "Reminders",
                column: "AppointmentId",
                principalTable: "Appointments",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_Reminders_Notes_NoteId",
                table: "Reminders",
                column: "NoteId",
                principalTable: "Notes",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_Reminders_TaskItems_TaskItemId",
                table: "Reminders",
                column: "TaskItemId",
                principalTable: "TaskItems",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_TaskItems_AIExtractions_SourceAiExtractionId",
                table: "TaskItems",
                column: "SourceAiExtractionId",
                principalTable: "AIExtractions",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);

            migrationBuilder.AddForeignKey(
                name: "FK_TaskItems_RecurrenceRules_RecurrenceRuleId",
                table: "TaskItems",
                column: "RecurrenceRuleId",
                principalTable: "RecurrenceRules",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);

            migrationBuilder.AddForeignKey(
                name: "FK_TaskTags_TaskItems_TaskItemId",
                table: "TaskTags",
                column: "TaskItemId",
                principalTable: "TaskItems",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);
        }
    }
}
