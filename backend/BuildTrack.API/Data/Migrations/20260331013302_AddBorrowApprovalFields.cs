using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace BuildTrack.API.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddBorrowApprovalFields : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "CompanyId",
                table: "SKUs",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "CompanyId",
                table: "Projects",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "CompanyId",
                table: "Profiles",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "ApprovedByName",
                table: "Orders",
                type: "nvarchar(max)",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "DeliveredAt",
                table: "Orders",
                type: "datetime2",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "OnTransitAt",
                table: "Orders",
                type: "datetime2",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "CompanyId",
                table: "CompanyAssets",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "ApprovalStatus",
                table: "BorrowTransactions",
                type: "nvarchar(50)",
                maxLength: 50,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<DateTime>(
                name: "ApprovedAt",
                table: "BorrowTransactions",
                type: "datetime2",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "ApprovedBy",
                table: "BorrowTransactions",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "RejectionRemarks",
                table: "BorrowTransactions",
                type: "nvarchar(1000)",
                maxLength: 1000,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "RequestType",
                table: "BorrowTransactions",
                type: "nvarchar(50)",
                maxLength: 50,
                nullable: true);

            migrationBuilder.CreateTable(
                name: "Companies",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Name = table.Column<string>(type: "nvarchar(256)", maxLength: 256, nullable: false),
                    Address = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    Phone = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    Email = table.Column<string>(type: "nvarchar(256)", maxLength: 256, nullable: true),
                    IsActive = table.Column<bool>(type: "bit", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Companies", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "OrderTrackingAssignments",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    OrderId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    DriverUserId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    PlateNumber = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    TrackingReference = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    Notes = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    TrackingStatus = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    ArrivedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    HoldRemarks = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    HeldAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    ResumeRemarks = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    ResumedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    CreatedBy = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    EvidenceJson = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    ReceiverEvidenceJson = table.Column<string>(type: "nvarchar(max)", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_OrderTrackingAssignments", x => x.Id);
                    table.ForeignKey(
                        name: "FK_OrderTrackingAssignments_Orders_OrderId",
                        column: x => x.OrderId,
                        principalTable: "Orders",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_OrderTrackingAssignments_Profiles_CreatedBy",
                        column: x => x.CreatedBy,
                        principalTable: "Profiles",
                        principalColumn: "Id");
                    table.ForeignKey(
                        name: "FK_OrderTrackingAssignments_Profiles_DriverUserId",
                        column: x => x.DriverUserId,
                        principalTable: "Profiles",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "OrderTrackingMaterials",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    AssignmentId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    OrderItemId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    AssignedQuantity = table.Column<decimal>(type: "decimal(18,2)", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_OrderTrackingMaterials", x => x.Id);
                    table.ForeignKey(
                        name: "FK_OrderTrackingMaterials_OrderItems_OrderItemId",
                        column: x => x.OrderItemId,
                        principalTable: "OrderItems",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_OrderTrackingMaterials_OrderTrackingAssignments_AssignmentId",
                        column: x => x.AssignmentId,
                        principalTable: "OrderTrackingAssignments",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_SKUs_CompanyId",
                table: "SKUs",
                column: "CompanyId");

            migrationBuilder.CreateIndex(
                name: "IX_Projects_CompanyId",
                table: "Projects",
                column: "CompanyId");

            migrationBuilder.CreateIndex(
                name: "IX_Profiles_CompanyId",
                table: "Profiles",
                column: "CompanyId");

            migrationBuilder.CreateIndex(
                name: "IX_CompanyAssets_CompanyId",
                table: "CompanyAssets",
                column: "CompanyId");

            migrationBuilder.CreateIndex(
                name: "IX_BorrowTransactions_ApprovedBy",
                table: "BorrowTransactions",
                column: "ApprovedBy");

            migrationBuilder.CreateIndex(
                name: "IX_Companies_Name",
                table: "Companies",
                column: "Name",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_OrderTrackingAssignments_CreatedBy",
                table: "OrderTrackingAssignments",
                column: "CreatedBy");

            migrationBuilder.CreateIndex(
                name: "IX_OrderTrackingAssignments_DriverUserId",
                table: "OrderTrackingAssignments",
                column: "DriverUserId");

            migrationBuilder.CreateIndex(
                name: "IX_OrderTrackingAssignments_OrderId",
                table: "OrderTrackingAssignments",
                column: "OrderId");

            migrationBuilder.CreateIndex(
                name: "IX_OrderTrackingMaterials_AssignmentId",
                table: "OrderTrackingMaterials",
                column: "AssignmentId");

            migrationBuilder.CreateIndex(
                name: "IX_OrderTrackingMaterials_OrderItemId",
                table: "OrderTrackingMaterials",
                column: "OrderItemId");

            migrationBuilder.AddForeignKey(
                name: "FK_BorrowTransactions_Profiles_ApprovedBy",
                table: "BorrowTransactions",
                column: "ApprovedBy",
                principalTable: "Profiles",
                principalColumn: "Id");

            migrationBuilder.AddForeignKey(
                name: "FK_CompanyAssets_Companies_CompanyId",
                table: "CompanyAssets",
                column: "CompanyId",
                principalTable: "Companies",
                principalColumn: "Id");

            migrationBuilder.AddForeignKey(
                name: "FK_Profiles_Companies_CompanyId",
                table: "Profiles",
                column: "CompanyId",
                principalTable: "Companies",
                principalColumn: "Id");

            migrationBuilder.AddForeignKey(
                name: "FK_Projects_Companies_CompanyId",
                table: "Projects",
                column: "CompanyId",
                principalTable: "Companies",
                principalColumn: "Id");

            migrationBuilder.AddForeignKey(
                name: "FK_SKUs_Companies_CompanyId",
                table: "SKUs",
                column: "CompanyId",
                principalTable: "Companies",
                principalColumn: "Id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_BorrowTransactions_Profiles_ApprovedBy",
                table: "BorrowTransactions");

            migrationBuilder.DropForeignKey(
                name: "FK_CompanyAssets_Companies_CompanyId",
                table: "CompanyAssets");

            migrationBuilder.DropForeignKey(
                name: "FK_Profiles_Companies_CompanyId",
                table: "Profiles");

            migrationBuilder.DropForeignKey(
                name: "FK_Projects_Companies_CompanyId",
                table: "Projects");

            migrationBuilder.DropForeignKey(
                name: "FK_SKUs_Companies_CompanyId",
                table: "SKUs");

            migrationBuilder.DropTable(
                name: "Companies");

            migrationBuilder.DropTable(
                name: "OrderTrackingMaterials");

            migrationBuilder.DropTable(
                name: "OrderTrackingAssignments");

            migrationBuilder.DropIndex(
                name: "IX_SKUs_CompanyId",
                table: "SKUs");

            migrationBuilder.DropIndex(
                name: "IX_Projects_CompanyId",
                table: "Projects");

            migrationBuilder.DropIndex(
                name: "IX_Profiles_CompanyId",
                table: "Profiles");

            migrationBuilder.DropIndex(
                name: "IX_CompanyAssets_CompanyId",
                table: "CompanyAssets");

            migrationBuilder.DropIndex(
                name: "IX_BorrowTransactions_ApprovedBy",
                table: "BorrowTransactions");

            migrationBuilder.DropColumn(
                name: "CompanyId",
                table: "SKUs");

            migrationBuilder.DropColumn(
                name: "CompanyId",
                table: "Projects");

            migrationBuilder.DropColumn(
                name: "CompanyId",
                table: "Profiles");

            migrationBuilder.DropColumn(
                name: "ApprovedByName",
                table: "Orders");

            migrationBuilder.DropColumn(
                name: "DeliveredAt",
                table: "Orders");

            migrationBuilder.DropColumn(
                name: "OnTransitAt",
                table: "Orders");

            migrationBuilder.DropColumn(
                name: "CompanyId",
                table: "CompanyAssets");

            migrationBuilder.DropColumn(
                name: "ApprovalStatus",
                table: "BorrowTransactions");

            migrationBuilder.DropColumn(
                name: "ApprovedAt",
                table: "BorrowTransactions");

            migrationBuilder.DropColumn(
                name: "ApprovedBy",
                table: "BorrowTransactions");

            migrationBuilder.DropColumn(
                name: "RejectionRemarks",
                table: "BorrowTransactions");

            migrationBuilder.DropColumn(
                name: "RequestType",
                table: "BorrowTransactions");
        }
    }
}
