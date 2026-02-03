namespace StockwellApi.Models;

public class Sku
{
    public Guid Id { get; set; }
    public string SkuCode { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public string? Category { get; set; }
    public string UnitOfMeasure { get; set; } = "EA";
    public string? Brand { get; set; }
    public string? Specifications { get; set; } // JSON
    public int DefaultMinThreshold { get; set; } = 10;
    public bool IsActive { get; set; } = true;
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset UpdatedAt { get; set; }
    public Guid? CreatedBy { get; set; }

    public ICollection<ProjectInventory> ProjectInventory { get; set; } = new List<ProjectInventory>();
    public ICollection<OrderItem> OrderItems { get; set; } = new List<OrderItem>();
}
