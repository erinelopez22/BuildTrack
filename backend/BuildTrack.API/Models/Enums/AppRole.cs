namespace BuildTrack.API.Models.Enums;

public static class AppRoles
{
    public const string SuperAdmin     = "super_admin";
    public const string Admin          = "admin";
    public const string OfficeAdmin    = "office_admin";
    public const string WarehouseAdmin = "warehouse_admin";
    public const string ProjectManager = "project_manager";
    public const string Approver       = "approver";
    public const string ApprovalAdmin  = "approval_admin";
    public const string LogisticsAdmin = "logistics_admin";
    public const string ProjectEngineer = "project_engineer";
    public const string Receiver       = "receiver";
    public const string TrackingDriver = "tracking_driver";
    public const string Checker        = "checker";
    public const string Driver         = "driver";

    public static readonly string[] All =
    [
        SuperAdmin, Admin, OfficeAdmin, WarehouseAdmin, ProjectManager,
        Approver, ApprovalAdmin, LogisticsAdmin, ProjectEngineer, Receiver,
        TrackingDriver, Checker, Driver
    ];

    public static bool IsValid(string role) => All.Contains(role);
}
