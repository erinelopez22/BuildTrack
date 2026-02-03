using StockwellApi.Models;

namespace StockwellApi.Services;

public interface IAuthService
{
    Task<Profile?> GetProfileByEmailAsync(string email, CancellationToken ct = default);
    Task<Profile?> GetProfileByIdAsync(Guid id, CancellationToken ct = default);
    Task<Profile> CreateProfileAsync(string email, string passwordHash, string? fullName, CancellationToken ct = default);
    bool VerifyPassword(string password, string hash);
    string HashPassword(string password);
    Task<List<string>> GetUserRolesAsync(Guid userId, CancellationToken ct = default);
}
