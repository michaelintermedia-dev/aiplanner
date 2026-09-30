using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace AiPlanner.Infrastructure.Migrations
{
    /// <summary>
    /// VoiceCapture.AudioStorageKey (one file) -> AudioStorageKeys (JSON array,
    /// one file per recorded segment). Existing keys are carried over.
    /// </summary>
    public partial class VoiceCaptureAudioSegments : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "AudioStorageKeys",
                table: "VoiceCaptures",
                type: "nvarchar(4000)",
                maxLength: 4000,
                nullable: false,
                defaultValue: "[]");

            migrationBuilder.Sql(
                """
                UPDATE VoiceCaptures
                SET AudioStorageKeys = N'[' + QUOTENAME(AudioStorageKey, '"') + N']'
                WHERE AudioStorageKey IS NOT NULL
                """);

            migrationBuilder.DropColumn(
                name: "AudioStorageKey",
                table: "VoiceCaptures");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "AudioStorageKey",
                table: "VoiceCaptures",
                type: "nvarchar(1000)",
                maxLength: 1000,
                nullable: true);

            // Only the first segment fits the old single-key column.
            migrationBuilder.Sql(
                """
                UPDATE VoiceCaptures
                SET AudioStorageKey = JSON_VALUE(AudioStorageKeys, '$[0]')
                """);

            migrationBuilder.DropColumn(
                name: "AudioStorageKeys",
                table: "VoiceCaptures");
        }
    }
}
