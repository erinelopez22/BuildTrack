using BuildTrack.API.DTOs.Common;
using BuildTrack.API.DTOs.Users;
using BuildTrack.API.Models.Enums;
using BuildTrack.API.Services.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace BuildTrack.API.Controllers;

[ApiController]
[Route("api/users")]
[Authorize]
public class UsersController(IUserService userService) : BaseApiController
{
    [HttpGet]
    public async Task<ActionResult<ApiResponse<List<UserDto>>>> GetAll()
    {
        var users = await userService.GetAllAsync(CurrentCompanyId, IsSuperAdmin);
        return Ok(ApiResponse<List<UserDto>>.Ok(users));
    }

    [HttpGet("{id:guid}")]
    public async Task<ActionResult<ApiResponse<UserDto>>> GetById(Guid id)
    {
        var user = await userService.GetByIdAsync(id);
        if (user == null) return NotFound(ApiResponse<UserDto>.Fail("User not found."));
        return Ok(ApiResponse<UserDto>.Ok(user));
    }

    [HttpGet("me")]
    public async Task<ActionResult<ApiResponse<UserDto>>> GetMe()
    {
        var user = await userService.GetByIdAsync(CurrentUserId);
        if (user == null) return NotFound();
        return Ok(ApiResponse<UserDto>.Ok(user));
    }

    [HttpPost]
    [Authorize(Policy = "RequireAdmin")]
    public async Task<ActionResult<ApiResponse<UserDto>>> Create([FromBody] CreateUserRequest request)
    {
        // Non-super-admin: force CompanyId to their own company
        var companyId = IsSuperAdmin ? request.CompanyId ?? CurrentCompanyId : CurrentCompanyId;
        var (user, error) = await userService.CreateAsync(request, CurrentUserId, companyId);
        if (error != null) return BadRequest(ApiResponse<UserDto>.Fail(error));
        return CreatedAtAction(nameof(GetById), new { id = user!.Id }, ApiResponse<UserDto>.Ok(user));
    }

    [HttpPut("{id:guid}")]
    public async Task<ActionResult<ApiResponse<UserDto>>> Update(Guid id, [FromBody] UpdateUserRequest request)
    {
        // Non-admins can only update themselves
        if (!User.IsInRole(AppRoles.Admin) && !User.IsInRole(AppRoles.SuperAdmin) && CurrentUserId != id)
            return Forbid();

        // Only super_admin can change CompanyId — strip it for everyone else
        if (!IsSuperAdmin)
            request.CompanyId = null;

        var user = await userService.UpdateAsync(id, request);
        if (user == null) return NotFound(ApiResponse<UserDto>.Fail("User not found."));
        return Ok(ApiResponse<UserDto>.Ok(user));
    }

    [HttpDelete("{id:guid}")]
    [Authorize(Policy = "RequireAdmin")]
    public async Task<ActionResult<ApiResponse<object>>> Delete(Guid id)
    {
        var success = await userService.DeleteAsync(id);
        if (!success) return NotFound(ApiResponse<object>.Fail("User not found."));
        return Ok(ApiResponse<object>.Ok(null, "User deleted."));
    }

    [HttpGet("{id:guid}/roles")]
    public async Task<ActionResult<ApiResponse<List<string>>>> GetRoles(Guid id)
    {
        var roles = await userService.GetRolesAsync(id);
        return Ok(ApiResponse<List<string>>.Ok(roles));
    }

    [HttpPost("{id:guid}/roles")]
    [Authorize(Policy = "RequireAdmin")]
    public async Task<ActionResult<ApiResponse<object>>> AssignRole(Guid id, [FromBody] AssignRoleRequest request)
    {
        if (!AppRoles.IsValid(request.Role))
            return BadRequest(ApiResponse<object>.Fail($"Invalid role: {request.Role}"));

        await userService.AssignRoleAsync(id, request.Role, CurrentUserId);
        return Ok(ApiResponse<object>.Ok(null, "Role assigned."));
    }

    [HttpDelete("{id:guid}/roles/{role}")]
    [Authorize(Policy = "RequireAdmin")]
    public async Task<ActionResult<ApiResponse<object>>> RemoveRole(Guid id, string role)
    {
        await userService.RemoveRoleAsync(id, role);
        return Ok(ApiResponse<object>.Ok(null, "Role removed."));
    }
}
