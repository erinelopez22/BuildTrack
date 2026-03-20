using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace BuildTrack.API.Models.Entities;

[Table("NotificationSettings")]
public class NotificationSettings
{
    [Key]
    public Guid Id { get; set; } = Guid.NewGuid();

    public Guid UserId { get; set; }
    public bool EmailEnabled { get; set; } = true;
    public bool SmsEnabled { get; set; } = false;
    public bool OrderUpdates { get; set; } = true;
    public bool InventoryUpdates { get; set; } = true;

    // Navigation
    [ForeignKey(nameof(UserId))]
    public Profile User { get; set; } = null!;
}
