using BuildTrack.API.DTOs.Users;

namespace BuildTrack.API.Services.Interfaces;

public interface IUserService
{
    Task<List<UserDto>> GetAllAsync(Guid? companyId = null, bool isSuperAdmin = false);
    Task<UserDto?> GetByIdAsync(Guid id);
    Task<(UserDto? user, string? error)> CreateAsync(CreateUserRequest request, Guid createdBy, Guid? companyId = null);
    Task<UserDto?> UpdateAsync(Guid id, UpdateUserRequest request);
    Task<bool> DeleteAsync(Guid id);
    Task<List<string>> GetRolesAsync(Guid userId);
    Task AssignRoleAsync(Guid userId, string role, Guid assignedBy);
    Task RemoveRoleAsync(Guid userId, string role);
}
