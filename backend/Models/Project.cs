namespace StockwellApi.Models;

public class Project
{
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? Code { get; set; }
    public string? Location { get; set; }
    public string? Description { get; set; }
    public string Status { get; set; } = "active"; // project_status
    public DateTime? StartDate { get; set; }
    public DateTime? EndDate { get; set; }
    public Guid? ProjectManagerId { get; set; }
    public decimal? EstimatedCost { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset UpdatedAt { get; set; }
    public Guid? CreatedBy { get; set; }

    public ICollection<ProjectMember> ProjectMembers { get; set; } = new List<ProjectMember>();
    public ICollection<ProjectInventory> ProjectInventory { get; set; } = new List<ProjectInventory>();
    public ICollection<Order> Orders { get; set; } = new List<Order>();
    public ProjectQuotation? Quotation { get; set; }
}
