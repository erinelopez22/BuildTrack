using System.ComponentModel.DataAnnotations;

namespace BuildTrack.API.DTOs.Inventory;

public class ProjectInventoryDto
{
    public Guid Id { get; set; }
    public Guid ProjectId { get; set; }
    public string? ProjectName { get; set; }
    public Guid SkuId { get; set; }
    public string? SkuCode { get; set; }
    public string? SkuName { get; set; }
    public string? Unit { get; set; }
    public decimal OnHand { get; set; }
    public decimal Reserved { get; set; }
    public decimal MinThreshold { get; set; }
    public string? LocationInSite { get; set; }
    public DateTime UpdatedAt { get; set; }
}

public class InventoryTransactionDto
{
    public Guid Id { get; set; }
    public Guid ProjectId { get; set; }
    public string? ProjectName { get; set; }
    public Guid SkuId { get; set; }
    public string? SkuName { get; set; }
    public string? SkuCode { get; set; }
    public string TransactionType { get; set; } = string.Empty;
    public decimal Quantity { get; set; }
    public decimal QuantityBefore { get; set; }
    public decimal QuantityAfter { get; set; }
    public string? ReferenceType { get; set; }
    public Guid? ReferenceId { get; set; }
    public string? Notes { get; set; }
    public Guid? CreatedBy { get; set; }
    public string? CreatedByName { get; set; }
    public DateTime CreatedAt { get; set; }
}

public class CreateInventoryTransactionRequest
{
    [Required]
    public Guid ProjectId { get; set; }

    [Required]
    public Guid SkuId { get; set; }

    [Required]
    public string TransactionType { get; set; } = string.Empty;

    [Range(0.0001, double.MaxValue)]
    public decimal Quantity { get; set; }

    public Guid? TransferProjectId { get; set; }
    public string? ReferenceType { get; set; }
    public Guid? ReferenceId { get; set; }
    public string? Notes { get; set; }
}
