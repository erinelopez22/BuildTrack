using BuildTrack.API.DTOs.Common;
using BuildTrack.API.DTOs.Notifications;
using BuildTrack.API.Services.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace BuildTrack.API.Controllers;

[ApiController]
[Route("api/dashboard")]
[Authorize]
public class DashboardController(IDashboardService dashboardService) : BaseApiController
{

    [HttpGet("stats")]
    public async Task<ActionResult<ApiResponse<DashboardStatsDto>>> GetStats()
    {
        var stats = await dashboardService.GetStatsAsync(CurrentUserId, CurrentCompanyId, IsSuperAdmin);
        return Ok(ApiResponse<DashboardStatsDto>.Ok(stats));
    }
}
