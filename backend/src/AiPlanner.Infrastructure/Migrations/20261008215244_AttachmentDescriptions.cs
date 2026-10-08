using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace AiPlanner.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AttachmentDescriptions : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "DescribeAttempts",
                table: "Attachments",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<DateTime>(
                name: "DescribedAtUtc",
                table: "Attachments",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Description",
                table: "Attachments",
                type: "text",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "DescribeAttempts",
                table: "Attachments");

            migrationBuilder.DropColumn(
                name: "DescribedAtUtc",
                table: "Attachments");

            migrationBuilder.DropColumn(
                name: "Description",
                table: "Attachments");
        }
    }
}
