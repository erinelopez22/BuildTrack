namespace BuildTrack.API.Models.Enums;

public static class OrderStatusValues
{
    public const string Draft             = "draft";
    public const string ForApproval       = "for_approval";
    public const string Approved          = "approved";
    public const string Submitted         = "submitted";
    public const string Preparing         = "preparing";
    public const string Ordered           = "ordered";
    public const string InTransit         = "in_transit";
    public const string Delivered         = "delivered";
    public const string PartiallyReceived = "partially_received";
    public const string FullyReceived     = "fully_received";
    public const string Closed            = "closed";
    public const string Cancelled         = "cancelled";
    public const string Rejected          = "rejected";
    public const string OnHold            = "on_hold";
}
