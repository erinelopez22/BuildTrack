using BuildTrack.API.Data;
using BuildTrack.API.DTOs.Auth;
using BuildTrack.API.Models.Entities;
using BuildTrack.API.Services.Interfaces;
using Microsoft.EntityFrameworkCore;

namespace BuildTrack.API.Services.Implementations;

public class AuthService(AppDbContext db, IJwtService jwtService, IConfiguration config) : IAuthService
{
    public async Task<AuthResponse?> LoginAsync(string loginId, string password)
    {
        // Allow login by email or username
        var profile = await db.Profiles
            .Include(p => p.UserRoles)
            .FirstOrDefaultAsync(p =>
                p.Email.ToLower() == loginId.ToLower() ||
                (p.Username != null && p.Username.ToLower() == loginId.ToLower()));

        if (profile == null || !profile.IsActive) return null;
        if (!BCrypt.Net.BCrypt.Verify(password, profile.PasswordHash)) return null;

        return await BuildAuthResponseAsync(profile);
    }

    public async Task<AuthResponse?> RefreshTokenAsync(string refreshToken)
    {
        var stored = await db.RefreshTokens
            .Include(rt => rt.User)
            .ThenInclude(u => u.UserRoles)
            .FirstOrDefaultAsync(rt => rt.Token == refreshToken && !rt.IsRevoked);

        if (stored == null || stored.ExpiresAt < DateTime.UtcNow) return null;

        // Rotate refresh token
        stored.IsRevoked = true;
        await db.SaveChangesAsync();

        return await BuildAuthResponseAsync(stored.User);
    }

    public async Task LogoutAsync(Guid userId)
    {
        var tokens = await db.RefreshTokens
            .Where(rt => rt.UserId == userId && !rt.IsRevoked)
            .ToListAsync();
        foreach (var t in tokens) t.IsRevoked = true;
        await db.SaveChangesAsync();
    }

    public async Task<UserSessionDto?> GetSessionUserAsync(Guid userId)
    {
        var profile = await db.Profiles
            .Include(p => p.UserRoles)
            .FirstOrDefaultAsync(p => p.Id == userId);

        if (profile == null) return null;
        return MapToSession(profile);
    }

    public async Task<bool> ChangePasswordAsync(Guid userId, string currentPassword, string newPassword)
    {
        var profile = await db.Profiles.FindAsync(userId);
        if (profile == null) return false;
        if (!BCrypt.Net.BCrypt.Verify(currentPassword, profile.PasswordHash)) return false;

        profile.PasswordHash = BCrypt.Net.BCrypt.HashPassword(newPassword);
        profile.UpdatedAt = DateTime.UtcNow;
        await db.SaveChangesAsync();
        return true;
    }

    // ── Private helpers ───────────────────────────────────────────────────────

    private async Task<AuthResponse> BuildAuthResponseAsync(Profile profile)
    {
        var roles = profile.UserRoles.Select(r => r.Role).ToList();
        var accessToken = jwtService.GenerateAccessToken(profile.Id, profile.Email, roles);
        var refreshTokenStr = jwtService.GenerateRefreshToken();

        var expirationDays = config.GetValue<int>("Jwt:RefreshTokenExpirationDays", 30);
        var refreshToken = new RefreshToken
        {
            UserId = profile.Id,
            Token = refreshTokenStr,
            ExpiresAt = DateTime.UtcNow.AddDays(expirationDays)
        };

        db.RefreshTokens.Add(refreshToken);
        await db.SaveChangesAsync();

        var expirationMinutes = config.GetValue<int>("Jwt:AccessTokenExpirationMinutes", 60);
        return new AuthResponse
        {
            AccessToken = accessToken,
            RefreshToken = refreshTokenStr,
            ExpiresAt = DateTime.UtcNow.AddMinutes(expirationMinutes),
            User = MapToSession(profile)
        };
    }

    private static UserSessionDto MapToSession(Profile profile) => new()
    {
        Id = profile.Id,
        Email = profile.Email,
        FullName = profile.FullName,
        Username = profile.Username,
        AvatarUrl = profile.AvatarUrl,
        Phone = profile.Phone,
        SmsOptIn = profile.SmsOptIn,
        IsActive = profile.IsActive,
        Roles = profile.UserRoles.Select(r => r.Role).ToList()
    };
}
