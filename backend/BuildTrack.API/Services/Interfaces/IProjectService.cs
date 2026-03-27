using BuildTrack.API.DTOs.Projects;

namespace BuildTrack.API.Services.Interfaces;

public interface IProjectService
{
    Task<List<ProjectDto>> GetAllAsync(bool includeHidden, string? status, string? search, Guid currentUserId, Guid? companyId = null, bool isSuperAdmin = false, bool isAdmin = false);
    Task<ProjectDto?> GetByIdAsync(Guid id, Guid currentUserId, bool isAdmin = false);
    Task<ProjectDto> CreateAsync(CreateProjectRequest request, Guid createdBy, Guid? companyId = null);
    Task<ProjectDto?> UpdateAsync(Guid id, UpdateProjectRequest request, Guid updatedBy);
    Task<bool> DeleteAsync(Guid id);
    Task<List<ProjectMemberDto>> GetMembersAsync(Guid projectId);
    Task<ProjectMemberDto> AddMemberAsync(Guid projectId, AddProjectMemberRequest request, Guid addedBy);
    Task<bool> RemoveMemberAsync(Guid projectId, Guid userId);
    Task<ProjectProgressDto> GetProgressAsync(Guid projectId);
    Task<List<object>> GetActivityAsync(Guid projectId, int limit);
}
