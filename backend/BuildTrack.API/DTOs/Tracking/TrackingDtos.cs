using System.ComponentModel.DataAnnotations;

namespace BuildTrack.API.DTOs.Tracking;

public class TrackingEvidenceItem
{
    public string FileUrl { get; set; } = string.Empty;
    public string FileName { get; set; } = string.Empty;
    public string? UploadedBy { get; set; }
    public string? UploadedAt { get; set; }
}

public class TrackingAssignmentDto
{
    public Guid Id { get; set; }
    public Guid OrderId { get; set; }
    public Guid DriverUserId { get; set; }
    public string? DriverName { get; set; }
    public string DriverEmail { get; set; } = string.Empty;
    public string PlateNumber { get; set; } = string.Empty;
    public string? TrackingReference { get; set; }
    public string? Notes { get; set; }
    public string TrackingStatus { get; set; } = "on_transit";
    public DateTime? ArrivedAt { get; set; }
    public string? HoldRemarks { get; set; }
    public DateTime? HeldAt { get; set; }
    public string? ResumeRemarks { get; set; }
    public DateTime? ResumedAt { get; set; }
    public Guid? CreatedBy { get; set; }
    public string? CreatedByName { get; set; }
    public DateTime CreatedAt { get; set; }
    public List<TrackingMaterialDto> Materials { get; set; } = [];
    public List<TrackingEvidenceItem> Evidence { get; set; } = [];
    public List<TrackingEvidenceItem> ReceiverEvidence { get; set; } = [];
}

public class TrackingMaterialDto
{
    public Guid Id { get; set; }
    public Guid OrderItemId { get; set; }
    public string? SkuName { get; set; }
    public string? Unit { get; set; }
    public decimal AssignedQuantity { get; set; }
    public decimal QuantityOrdered { get; set; }
}

public class SaveTrackingRequest
{
    [Required]
    public List<SaveTrackingAssignmentItem> Assignments { get; set; } = [];
}

public class SaveTrackingAssignmentItem
{
    [Required]
    public Guid DriverUserId { get; set; }
    [Required]
    public string PlateNumber { get; set; } = string.Empty;
    public string? TrackingReference { get; set; }
    public string? Notes { get; set; }
    public List<SaveTrackingMaterialItem> Materials { get; set; } = [];
    public List<TrackingEvidenceItem> Evidence { get; set; } = [];
}

public class SaveTrackingMaterialItem
{
    [Required]
    public Guid OrderItemId { get; set; }
    public decimal AssignedQuantity { get; set; }
}

public class HoldResumeRequest
{
    public string? Remarks { get; set; }
}

public class SaveRemarksRequest
{
    public string? Remarks { get; set; }
}

public class SaveReceiverEvidenceRequest
{
    public List<TrackingEvidenceItem> Evidence { get; set; } = [];
}
