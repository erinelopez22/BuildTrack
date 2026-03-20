using BuildTrack.API.DTOs.Auth;

namespace BuildTrack.API.Services.Interfaces;

public interface IAuthService
{
    Task<AuthResponse?> LoginAsync(string loginId, string password);
    Task<AuthResponse?> RefreshTokenAsync(string refreshToken);
    Task LogoutAsync(Guid userId);
    Task<UserSessionDto?> GetSessionUserAsync(Guid userId);
    Task<bool> ChangePasswordAsync(Guid userId, string currentPassword, string newPassword);
}
