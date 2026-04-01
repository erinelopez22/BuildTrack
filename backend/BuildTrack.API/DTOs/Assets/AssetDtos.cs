using System.ComponentModel.DataAnnotations;

namespace BuildTrack.API.DTOs.Assets;

public class CompanyAssetDto
{
    public Guid Id { get; set; }
    public string AssetName { get; set; } = string.Empty;
    public string? AssetType { get; set; }
    public string? AssetCode { get; set; }
    public string? Unit { get; set; }
    public decimal TotalQuantity { get; set; }
    public string? Condition { get; set; }
    public string? Notes { get; set; }
    public Guid? CreatedBy { get; set; }
    public DateTime CreatedAt { get; set; }
    public decimal BorrowedQuantity { get; set; }
    public decimal AvailableQuantity { get; set; }
}

public class CreateCompanyAssetRequest
{
    [Required, MinLength(2)]
    public string AssetName { get; set; } = string.Empty;

    public string? AssetType { get; set; }
    public string? AssetCode { get; set; }
    public string? Unit { get; set; }

    [Range(0, double.MaxValue)]
    public decimal TotalQuantity { get; set; } = 0;

    public string? Condition { get; set; } = "Available";
    public string? Notes { get; set; }
}

public class UpdateCompanyAssetRequest
{
    public string? AssetName { get; set; }
    public string? AssetType { get; set; }
    public string? AssetCode { get; set; }
    public string? Unit { get; set; }
    public decimal? TotalQuantity { get; set; }
    public string? Condition { get; set; }
    public string? Notes { get; set; }
}

public class BorrowTransactionDto
{
    public Guid Id { get; set; }
    public Guid AssetId { get; set; }
    public string? AssetName { get; set; }
    public Guid? ProjectId { get; set; }
    public string? ProjectName { get; set; }
    public decimal BorrowedQty { get; set; }
    public Guid? BorrowedBy { get; set; }
    public string? BorrowedByName { get; set; }
    public DateTime BorrowedAt { get; set; }
    public DateTime? ExpectedReturnDate { get; set; }
    public decimal ReturnedQty { get; set; }
    public DateTime? ReturnedAt { get; set; }
    public string? ReturnRemarks { get; set; }
    public string Status { get; set; } = string.Empty;
    public string? RequestType { get; set; }
    public string ApprovalStatus { get; set; } = "approved";
    public Guid? ApprovedBy { get; set; }
    public string? ApprovedByName { get; set; }
    public DateTime? ApprovedAt { get; set; }
    public string? RejectionRemarks { get; set; }
    public DateTime CreatedAt { get; set; }
}

public class BorrowAssetRequest
{
    [Required]
    public Guid AssetId { get; set; }

    public Guid? ProjectId { get; set; }

    [Range(0.0001, double.MaxValue)]
    public decimal Quantity { get; set; }

    public DateTime? ExpectedReturnDate { get; set; }
}

public class ReturnAssetRequest
{
    [Range(0.0001, double.MaxValue)]
    public decimal ReturnedQty { get; set; }
    public string? Remarks { get; set; }
}

public class RejectBorrowRequest
{
    public string? Remarks { get; set; }
}
