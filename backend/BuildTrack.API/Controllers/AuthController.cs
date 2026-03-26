using BuildTrack.API.DTOs.Auth;
using BuildTrack.API.DTOs.Common;
using BuildTrack.API.Services.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace BuildTrack.API.Controllers;

[ApiController]
[Route("api/auth")]
public class AuthController(IAuthService authService) : ControllerBase
{
    [HttpPost("login")]
    [AllowAnonymous]
    public async Task<ActionResult<ApiResponse<AuthResponse>>> Login([FromBody] LoginRequest request)
    {
        var result = await authService.LoginAsync(request.LoginId, request.Password, request.CompanyId);
        if (result == null)
            return Unauthorized(ApiResponse<AuthResponse>.Fail("Invalid credentials."));

        return Ok(ApiResponse<AuthResponse>.Ok(result));
    }

    [HttpPost("refresh")]
    [AllowAnonymous]
    public async Task<ActionResult<ApiResponse<AuthResponse>>> Refresh([FromBody] RefreshTokenRequest request)
    {
        var result = await authService.RefreshTokenAsync(request.RefreshToken);
        if (result == null)
            return Unauthorized(ApiResponse<AuthResponse>.Fail("Invalid or expired refresh token."));

        return Ok(ApiResponse<AuthResponse>.Ok(result));
    }

    [HttpPost("logout")]
    [Authorize]
    public async Task<ActionResult<ApiResponse<object>>> Logout()
    {
        var userId = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;
        if (userId != null)
            await authService.LogoutAsync(Guid.Parse(userId));

        return Ok(ApiResponse<object>.Ok(null, "Logged out successfully."));
    }

    [HttpGet("me")]
    [Authorize]
    public async Task<ActionResult<ApiResponse<UserSessionDto>>> Me()
    {
        var userId = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;
        if (userId == null) return Unauthorized();

        var user = await authService.GetSessionUserAsync(Guid.Parse(userId));
        if (user == null) return NotFound(ApiResponse<UserSessionDto>.Fail("User not found."));

        return Ok(ApiResponse<UserSessionDto>.Ok(user));
    }

    [HttpPost("change-password")]
    [Authorize]
    public async Task<ActionResult<ApiResponse<object>>> ChangePassword([FromBody] ChangePasswordRequest request)
    {
        var userId = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;
        if (userId == null) return Unauthorized();

        var success = await authService.ChangePasswordAsync(Guid.Parse(userId), request.CurrentPassword, request.NewPassword);
        if (!success)
            return BadRequest(ApiResponse<object>.Fail("Current password is incorrect."));

        return Ok(ApiResponse<object>.Ok(null, "Password changed successfully."));
    }
}
