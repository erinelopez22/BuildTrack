using BuildTrack.API.Data;
using BuildTrack.API.DTOs.Users;
using BuildTrack.API.Models.Entities;
using BuildTrack.API.Services.Interfaces;
using Microsoft.EntityFrameworkCore;

namespace BuildTrack.API.Services.Implementations;

public class UserService(AppDbContext db) : IUserService
{
    public async Task<List<UserDto>> GetAllAsync(Guid? companyId = null, bool isSuperAdmin = false)
    {
        var query = db.Profiles
            .Include(p => p.UserRoles)
            .Include(p => p.Company)
            .AsQueryable();

        // Super admin sees all; others see only their company
        if (!isSuperAdmin && companyId.HasValue)
            query = query.Where(p => p.CompanyId == companyId.Value);

        var profiles = await query.OrderBy(p => p.FullName).ToListAsync();
        return profiles.Select(Map).ToList();
    }

    public async Task<UserDto?> GetByIdAsync(Guid id)
    {
        var profile = await db.Profiles
            .Include(p => p.UserRoles)
            .Include(p => p.Company)
            .FirstOrDefaultAsync(p => p.Id == id);
        return profile == null ? null : Map(profile);
    }

    public async Task<(UserDto? user, string? error)> CreateAsync(CreateUserRequest request, Guid createdBy, Guid? companyId = null)
    {
        if (await db.Profiles.AnyAsync(p => p.Email.ToLower() == request.Email.ToLower()))
            return (null, "Email already in use.");

        if (request.Username != null &&
            await db.Profiles.AnyAsync(p => p.Username != null && p.Username.ToLower() == request.Username.ToLower()))
            return (null, "Username already in use.");

        var profile = new Profile
        {
            Email = request.Email.ToLower(),
            PasswordHash = BCrypt.Net.BCrypt.HashPassword(request.Password),
            FullName = request.FullName,
            Username = request.Username,
            Phone = request.Phone,
            Address = request.Address,
            SmsOptIn = request.SmsOptIn,
            CompanyId = request.CompanyId ?? companyId,
            CreatedBy = createdBy
        };
        db.Profiles.Add(profile);

        if (!string.IsNullOrEmpty(request.Role))
        {
            db.UserRoles.Add(new UserRole
            {
                UserId = profile.Id,
                Role = request.Role,
                CreatedBy = createdBy
            });
        }

        await db.SaveChangesAsync();
        await db.Entry(profile).Collection(p => p.UserRoles).LoadAsync();
        await db.Entry(profile).Reference(p => p.Company).LoadAsync();
        return (Map(profile), null);
    }

    public async Task<UserDto?> UpdateAsync(Guid id, UpdateUserRequest request)
    {
        var profile = await db.Profiles
            .Include(p => p.UserRoles)
            .Include(p => p.Company)
            .FirstOrDefaultAsync(p => p.Id == id);
        if (profile == null) return null;

        if (request.FullName != null) profile.FullName = request.FullName;
        if (request.Username != null) profile.Username = request.Username;
        if (request.Phone != null) profile.Phone = request.Phone;
        if (request.Address != null) profile.Address = request.Address;
        if (request.AvatarUrl != null) profile.AvatarUrl = request.AvatarUrl;
        if (request.SmsOptIn.HasValue) profile.SmsOptIn = request.SmsOptIn.Value;
        if (request.IsActive.HasValue) profile.IsActive = request.IsActive.Value;
        if (request.CompanyId.HasValue) profile.CompanyId = request.CompanyId.Value;
        profile.UpdatedAt = DateTime.UtcNow;

        await db.SaveChangesAsync();
        return Map(profile);
    }

    public async Task<bool> DeleteAsync(Guid id)
    {
        var profile = await db.Profiles.FindAsync(id);
        if (profile == null) return false;
        // Soft-delete
        profile.IsActive = false;
        profile.UpdatedAt = DateTime.UtcNow;
        await db.SaveChangesAsync();
        return true;
    }

    public async Task<List<string>> GetRolesAsync(Guid userId)
    {
        return await db.UserRoles
            .Where(r => r.UserId == userId)
            .Select(r => r.Role)
            .ToListAsync();
    }

    public async Task AssignRoleAsync(Guid userId, string role, Guid assignedBy)
    {
        if (await db.UserRoles.AnyAsync(r => r.UserId == userId && r.Role == role))
            return;

        db.UserRoles.Add(new UserRole
        {
            UserId = userId,
            Role = role,
            CreatedBy = assignedBy
        });
        await db.SaveChangesAsync();
    }

    public async Task RemoveRoleAsync(Guid userId, string role)
    {
        var userRole = await db.UserRoles
            .FirstOrDefaultAsync(r => r.UserId == userId && r.Role == role);
        if (userRole != null)
        {
            db.UserRoles.Remove(userRole);
            await db.SaveChangesAsync();
        }
    }

    private static UserDto Map(Profile p) => new()
    {
        Id = p.Id,
        Email = p.Email,
        FullName = p.FullName,
        Username = p.Username,
        Address = p.Address,
        Phone = p.Phone,
        AvatarUrl = p.AvatarUrl,
        SmsOptIn = p.SmsOptIn,
        IsActive = p.IsActive,
        CreatedAt = p.CreatedAt,
        UpdatedAt = p.UpdatedAt,
        CreatedBy = p.CreatedBy,
        Roles = p.UserRoles.Select(r => r.Role).ToList(),
        CompanyId = p.CompanyId,
        CompanyName = p.Company?.Name
    };
}
