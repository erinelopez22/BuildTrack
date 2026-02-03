using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace StockwellApi.Migrations
{
    /// <inheritdoc />
    public partial class InitialCreate : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_delivery_items_order_items_order_item_id",
                table: "delivery_items");

            migrationBuilder.AddColumn<Guid>(
                name: "DeliveryId",
                table: "order_items",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "OrderItemId1",
                table: "delivery_items",
                type: "uniqueidentifier",
                nullable: false,
                defaultValue: new Guid("00000000-0000-0000-0000-000000000000"));

            migrationBuilder.CreateIndex(
                name: "IX_order_items_DeliveryId",
                table: "order_items",
                column: "DeliveryId");

            migrationBuilder.CreateIndex(
                name: "IX_delivery_items_OrderItemId1",
                table: "delivery_items",
                column: "OrderItemId1");

            migrationBuilder.AddForeignKey(
                name: "FK_delivery_items_order_items_OrderItemId1",
                table: "delivery_items",
                column: "OrderItemId1",
                principalTable: "order_items",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_delivery_items_orders_order_item_id",
                table: "delivery_items",
                column: "order_item_id",
                principalTable: "orders",
                principalColumn: "Id");

            migrationBuilder.AddForeignKey(
                name: "FK_order_items_deliveries_DeliveryId",
                table: "order_items",
                column: "DeliveryId",
                principalTable: "deliveries",
                principalColumn: "Id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_delivery_items_order_items_OrderItemId1",
                table: "delivery_items");

            migrationBuilder.DropForeignKey(
                name: "FK_delivery_items_orders_order_item_id",
                table: "delivery_items");

            migrationBuilder.DropForeignKey(
                name: "FK_order_items_deliveries_DeliveryId",
                table: "order_items");

            migrationBuilder.DropIndex(
                name: "IX_order_items_DeliveryId",
                table: "order_items");

            migrationBuilder.DropIndex(
                name: "IX_delivery_items_OrderItemId1",
                table: "delivery_items");

            migrationBuilder.DropColumn(
                name: "DeliveryId",
                table: "order_items");

            migrationBuilder.DropColumn(
                name: "OrderItemId1",
                table: "delivery_items");

            migrationBuilder.AddForeignKey(
                name: "FK_delivery_items_order_items_order_item_id",
                table: "delivery_items",
                column: "order_item_id",
                principalTable: "order_items",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);
        }
    }
}
