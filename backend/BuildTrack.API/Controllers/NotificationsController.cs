using BuildTrack.API.DTOs.Common;
using BuildTrack.API.DTOs.Notifications;
using BuildTrack.API.Services.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace BuildTrack.API.Controllers;

[ApiController]
[Route("api/notifications")]
[Authorize]
public class NotificationsController(INotificationService notificationService) : ControllerBase
{
    private Guid CurrentUserId =>
        Guid.Parse(User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)!.Value);

    [HttpGet]
    public async Task<ActionResult<ApiResponse<List<NotificationDto>>>> GetAll(
        [FromQuery] bool unreadOnly = false)
    {
        var notifications = await notificationService.GetForUserAsync(CurrentUserId, unreadOnly);
        return Ok(ApiResponse<List<NotificationDto>>.Ok(notifications));
    }

    [HttpPut("{id:guid}/read")]
    public async Task<ActionResult<ApiResponse<object>>> MarkRead(Guid id)
    {
        await notificationService.MarkReadAsync(id, CurrentUserId);
        return Ok(ApiResponse<object>.Ok(null));
    }

    [HttpPut("read-all")]
    public async Task<ActionResult<ApiResponse<object>>> MarkAllRead()
    {
        await notificationService.MarkAllReadAsync(CurrentUserId);
        return Ok(ApiResponse<object>.Ok(null, "All notifications marked as read."));
    }

    [HttpDelete("{id:guid}")]
    public async Task<ActionResult<ApiResponse<object>>> Delete(Guid id)
    {
        await notificationService.DeleteAsync(id, CurrentUserId);
        return Ok(ApiResponse<object>.Ok(null));
    }
}
