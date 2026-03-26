using BuildTrack.API.DTOs.Common;
using BuildTrack.API.DTOs.Projects;
using BuildTrack.API.Services.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace BuildTrack.API.Controllers;

[ApiController]
[Route("api/projects")]
[Authorize]
public class ProjectsController(IProjectService projectService) : BaseApiController
{
    [HttpGet]
    public async Task<ActionResult<ApiResponse<List<ProjectDto>>>> GetAll(
        [FromQuery] bool includeHidden = false,
        [FromQuery] string? status = null,
        [FromQuery] string? search = null)
    {
        var projects = await projectService.GetAllAsync(includeHidden, status, search, CurrentUserId, CurrentCompanyId, IsSuperAdmin);
        return Ok(ApiResponse<List<ProjectDto>>.Ok(projects));
    }

    [HttpGet("{id:guid}")]
    public async Task<ActionResult<ApiResponse<ProjectDto>>> GetById(Guid id)
    {
        var project = await projectService.GetByIdAsync(id);
        if (project == null) return NotFound(ApiResponse<ProjectDto>.Fail("Project not found."));
        return Ok(ApiResponse<ProjectDto>.Ok(project));
    }

    [HttpPost]
    [Authorize(Policy = "RequireProjectManager")]
    public async Task<ActionResult<ApiResponse<ProjectDto>>> Create([FromBody] CreateProjectRequest request)
    {
        var project = await projectService.CreateAsync(request, CurrentUserId, CurrentCompanyId);
        return CreatedAtAction(nameof(GetById), new { id = project.Id }, ApiResponse<ProjectDto>.Ok(project));
    }

    [HttpPut("{id:guid}")]
    [Authorize(Policy = "RequireProjectManager")]
    public async Task<ActionResult<ApiResponse<ProjectDto>>> Update(Guid id, [FromBody] UpdateProjectRequest request)
    {
        var project = await projectService.UpdateAsync(id, request, CurrentUserId);
        if (project == null) return NotFound(ApiResponse<ProjectDto>.Fail("Project not found."));
        return Ok(ApiResponse<ProjectDto>.Ok(project));
    }

    [HttpDelete("{id:guid}")]
    [Authorize(Policy = "RequireAdmin")]
    public async Task<ActionResult<ApiResponse<object>>> Delete(Guid id)
    {
        var success = await projectService.DeleteAsync(id);
        if (!success) return NotFound(ApiResponse<object>.Fail("Project not found."));
        return Ok(ApiResponse<object>.Ok(null, "Project deleted."));
    }

    // ── Members ───────────────────────────────────────────────────────────────

    [HttpGet("{id:guid}/members")]
    public async Task<ActionResult<ApiResponse<List<ProjectMemberDto>>>> GetMembers(Guid id)
    {
        var members = await projectService.GetMembersAsync(id);
        return Ok(ApiResponse<List<ProjectMemberDto>>.Ok(members));
    }

    [HttpPost("{id:guid}/members")]
    [Authorize(Policy = "RequireProjectManager")]
    public async Task<ActionResult<ApiResponse<ProjectMemberDto>>> AddMember(
        Guid id, [FromBody] AddProjectMemberRequest request)
    {
        var member = await projectService.AddMemberAsync(id, request, CurrentUserId);
        return Ok(ApiResponse<ProjectMemberDto>.Ok(member));
    }

    [HttpDelete("{id:guid}/members/{userId:guid}")]
    [Authorize(Policy = "RequireProjectManager")]
    public async Task<ActionResult<ApiResponse<object>>> RemoveMember(Guid id, Guid userId)
    {
        var success = await projectService.RemoveMemberAsync(id, userId);
        if (!success) return NotFound(ApiResponse<object>.Fail("Member not found."));
        return Ok(ApiResponse<object>.Ok(null, "Member removed."));
    }

    // ── Progress ──────────────────────────────────────────────────────────────

    [HttpGet("{id:guid}/progress")]
    public async Task<ActionResult<ApiResponse<ProjectProgressDto>>> GetProgress(Guid id)
    {
        var progress = await projectService.GetProgressAsync(id);
        return Ok(ApiResponse<ProjectProgressDto>.Ok(progress));
    }

    // ── Activity Log ──────────────────────────────────────────────────────────

    [HttpGet("{id:guid}/activity")]
    public async Task<ActionResult<ApiResponse<List<object>>>> GetActivity(
        Guid id, [FromQuery] int limit = 50)
    {
        var logs = await projectService.GetActivityAsync(id, limit);
        return Ok(ApiResponse<List<object>>.Ok(logs));
    }
}
