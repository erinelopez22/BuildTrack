using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;

namespace BuildTrack.API.Hubs;

[Authorize]
public class NotificationHub : Hub
{
    public override async Task OnConnectedAsync()
    {
        var userId = Context.UserIdentifier;
        if (userId != null)
            await Groups.AddToGroupAsync(Context.ConnectionId, $"user-{userId}");
        await base.OnConnectedAsync();
    }

    public override async Task OnDisconnectedAsync(Exception? exception)
    {
        var userId = Context.UserIdentifier;
        if (userId != null)
            await Groups.RemoveFromGroupAsync(Context.ConnectionId, $"user-{userId}");
        await base.OnDisconnectedAsync(exception);
    }

    // Called by client to join notification group
    public async Task JoinUserGroup(string userId)
    {
        await Groups.AddToGroupAsync(Context.ConnectionId, $"user-{userId}");
    }
}
