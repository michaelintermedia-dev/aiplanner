using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace AiPlanner.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AttachmentSearchText : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "SearchText",
                table: "Attachments",
                type: "text",
                nullable: false,
                defaultValue: "");

            // Existing attachments: file name + description, lower case, letters and digits only (Attachment.SearchKey).
            migrationBuilder.Sql(
                """UPDATE "Attachments" SET "SearchText" = lower(regexp_replace(coalesce("FileName", '') || coalesce("Description", ''), '[^[:alnum:]]', '', 'g'));""");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "SearchText",
                table: "Attachments");
        }
    }
}
