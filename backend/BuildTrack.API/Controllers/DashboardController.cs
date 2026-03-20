using BuildTrack.API.DTOs.Common;
using BuildTrack.API.DTOs.Notifications;
using BuildTrack.API.Services.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace BuildTrack.API.Controllers;

[ApiController]
[Route("api/dashboard")]
[Authorize]
public class DashboardController(IDashboardService dashboardService) : ControllerBase
{
    private Guid CurrentUserId =>
        Guid.Parse(User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)!.Value);

    [HttpGet("stats")]
    public async Task<ActionResult<ApiResponse<DashboardStatsDto>>> GetStats()
    {
        var stats = await dashboardService.GetStatsAsync(CurrentUserId);
        return Ok(ApiResponse<DashboardStatsDto>.Ok(stats));
    }
}
