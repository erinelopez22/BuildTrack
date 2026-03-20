using BuildTrack.API.DTOs.Common;
using BuildTrack.API.Services.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace BuildTrack.API.Controllers;

[ApiController]
[Route("api/audit-logs")]
[Authorize]
public class AuditLogsController(IAuditLogService auditLogService) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<ApiResponse<List<object>>>> GetAll(
        [FromQuery] string? tableName = null,
        [FromQuery] Guid? recordId = null,
        [FromQuery] Guid? userId = null,
        [FromQuery] int limit = 100)
    {
        var logs = await auditLogService.GetLogsAsync(tableName, recordId, userId, limit);
        return Ok(ApiResponse<List<object>>.Ok(logs));
    }

    [HttpPost]
    [AllowAnonymous] // Internal calls from frontend
    public async Task<ActionResult<ApiResponse<object>>> Create([FromBody] CreateAuditLogRequest request)
    {
        await auditLogService.LogAsync(
            request.TableName, request.RecordId, request.Action,
            request.OldValues, request.NewValues, request.UserId);
        return Ok(ApiResponse<object>.Ok(null));
    }
}

public class CreateAuditLogRequest
{
    public string TableName { get; set; } = string.Empty;
    public Guid? RecordId { get; set; }
    public string Action { get; set; } = string.Empty;
    public string? OldValues { get; set; }
    public string? NewValues { get; set; }
    public Guid? UserId { get; set; }
}
