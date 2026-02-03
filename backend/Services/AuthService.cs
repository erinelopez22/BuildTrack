using Microsoft.EntityFrameworkCore;
using StockwellApi.Data;
using StockwellApi.Models;

namespace StockwellApi.Services;

public class AuthService : IAuthService
{
    private readonly ApplicationDbContext _db;

    public AuthService(ApplicationDbContext db)
    {
        _db = db;
    }

    public async Task<Profile?> GetProfileByEmailAsync(string email, CancellationToken ct = default)
    {
        return await _db.Profiles
            .AsNoTracking()
            .FirstOrDefaultAsync(p => p.Email == email, ct);
    }

    public async Task<Profile?> GetProfileByIdAsync(Guid id, CancellationToken ct = default)
    {
        return await _db.Profiles
            .AsNoTracking()
            .FirstOrDefaultAsync(p => p.Id == id, ct);
    }

    public async Task<Profile> CreateProfileAsync(string email, string passwordHash, string? fullName, CancellationToken ct = default)
    {
        var profile = new Profile
        {
            Id = Guid.NewGuid(),
            Email = email,
            PasswordHash = passwordHash,
            FullName = fullName,
            IsActive = true,
            SmsOptIn = false,
            NotificationPreferences = "{\"email\":true,\"sms\":false,\"push\":true}",
            CreatedAt = DateTimeOffset.UtcNow,
            UpdatedAt = DateTimeOffset.UtcNow
        };
        _db.Profiles.Add(profile);
        await _db.SaveChangesAsync(ct);
        return profile;
    }

    public bool VerifyPassword(string password, string hash) => BCrypt.Net.BCrypt.Verify(password, hash);
    public string HashPassword(string password) => BCrypt.Net.BCrypt.HashPassword(password, 10);

    public async Task<List<string>> GetUserRolesAsync(Guid userId, CancellationToken ct = default)
    {
        return await _db.UserRoles
            .AsNoTracking()
            .Where(ur => ur.UserId == userId)
            .Select(ur => ur.Role)
            .ToListAsync(ct);
    }
}
