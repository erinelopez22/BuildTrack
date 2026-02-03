using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.IdentityModel.Tokens;
using StockwellApi.Data;
using StockwellApi.Models;
using StockwellApi.Services;

namespace StockwellApi.Controllers;

[ApiController]
[Route("api/[controller]")]
public class AuthController : ControllerBase
{
    private readonly IAuthService _authService;
    private readonly ApplicationDbContext _db;
    private readonly IConfiguration _config;

    public AuthController(IAuthService authService, ApplicationDbContext db, IConfiguration config)
    {
        _authService = authService;
        _db = db;
        _config = config;
    }

    [HttpPost("login")]
    [AllowAnonymous]
    public async Task<ActionResult<LoginResponse>> Login([FromBody] LoginRequest request, CancellationToken ct)
    {
        var profile = await _authService.GetProfileByEmailAsync(request.Email, ct);
        if (profile == null || string.IsNullOrEmpty(profile.PasswordHash))
            return Unauthorized(new { message = "Invalid email or password." });

        if (!_authService.VerifyPassword(request.Password, profile.PasswordHash))
            return Unauthorized(new { message = "Invalid email or password." });

        if (!profile.IsActive)
            return Unauthorized(new { message = "Account is inactive." });

        var roles = await _authService.GetUserRolesAsync(profile.Id, ct);
        var token = GenerateJwt(profile.Id.ToString(), profile.Email, roles);
        return Ok(new LoginResponse(
           token,
           "Bearer",
           int.Parse(_config["Jwt:ExpiryMinutes"] ?? "60") * 60,
           new UserInfo(
               profile.Id,
               profile.Email,
               profile.FullName,
               roles
           )
));
        //return Ok(new LoginResponse
        //{
        //    AccessToken = token,
        //    TokenType = "Bearer",
        //    ExpiresIn = int.Parse(_config["Jwt:ExpiryMinutes"] ?? "60") * 60,
        //    //User = new UserInfo
        //    //{
        //    //    Id = profile.Id,
        //    //    Email = profile.Email,
        //    //    FullName = profile.FullName,
        //    //    Roles = roles
        //    //}
        //    User = new UserInfo(
        //    profile.Id,
        //    profile.Email,
        //    profile.FullName,
        //    roles
        //    )
        //});
    }

    [HttpPost("register")]
    [AllowAnonymous]
    public async Task<ActionResult<LoginResponse>> Register([FromBody] RegisterRequest request, CancellationToken ct)
    {
        var existing = await _authService.GetProfileByEmailAsync(request.Email, ct);
        if (existing != null)
            return BadRequest(new { message = "Email already registered." });

        var hash = _authService.HashPassword(request.Password);
        var profile = await _authService.CreateProfileAsync(request.Email, hash, request.FullName, ct);

        // Assign default role
        using var scope = HttpContext.RequestServices.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<Data.ApplicationDbContext>();
        db.UserRoles.Add(new UserRole
        {
            Id = Guid.NewGuid(),
            UserId = profile.Id,
            Role = "viewer",
            CreatedAt = DateTimeOffset.UtcNow
        });
        await _db.SaveChangesAsync(ct);

        var roles = await _authService.GetUserRolesAsync(profile.Id, ct);
        var token = GenerateJwt(profile.Id.ToString(), profile.Email, roles);
        return Ok(new LoginResponse(
            token,
            "Bearer",
            int.Parse(_config["Jwt:ExpiryMinutes"] ?? "60") * 60,
            new UserInfo(
                profile.Id,
                profile.Email,
                profile.FullName,
                roles
            )
));
        //return Ok(new LoginResponse
        //{
        //    AccessToken = token,
        //    TokenType = "Bearer",
        //    ExpiresIn = int.Parse(_config["Jwt:ExpiryMinutes"] ?? "60") * 60,
        //    //User = new UserInfo
        //    //{
        //    //    Id = profile.Id,
        //    //    Email = profile.Email,
        //    //    FullName = profile.FullName,
        //    //    Roles = roles
        //    //}
        //    User = new UserInfo(
        //    profile.Id,
        //    profile.Email,
        //    profile.FullName,
        //    roles
        //    )
        //});
    }

    [HttpGet("me")]
    [Authorize]
    public async Task<ActionResult<ProfileResponse>> Me(CancellationToken ct)
    {
        var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value ?? User.FindFirst("sub")?.Value;
        if (string.IsNullOrEmpty(userIdClaim) || !Guid.TryParse(userIdClaim, out var userId))
            return Unauthorized();

        var profile = await _authService.GetProfileByIdAsync(userId, ct);
        if (profile == null) return NotFound();

        var roles = await _authService.GetUserRolesAsync(userId, ct);
        //return Ok(new ProfileResponse
        //{
        //    Id = profile.Id,
        //    Email = profile.Email,
        //    FullName = profile.FullName,
        //    Phone = profile.Phone,
        //    AvatarUrl = profile.AvatarUrl,
        //    IsActive = profile.IsActive,
        //    Roles = roles,
        //    CreatedAt = profile.CreatedAt,
        //    UpdatedAt = profile.UpdatedAt
        //});
        return Ok(new ProfileResponse(
                profile.Id,
                profile.Email,
                profile.FullName,
                profile.Phone,
                profile.AvatarUrl,
                profile.IsActive,
                roles,
                profile.CreatedAt,
                profile.UpdatedAt
            ));
    }

    private string GenerateJwt(string userId, string email, List<string> roles)
    {
        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_config["Jwt:Key"]!));
        var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);
        var claims = new List<Claim>
        {
            new(ClaimTypes.NameIdentifier, userId),
            new(ClaimTypes.Email, email),
            new(JwtRegisteredClaimNames.Sub, userId),
            new(JwtRegisteredClaimNames.Email, email)
        };
        foreach (var role in roles)
            claims.Add(new Claim(ClaimTypes.Role, role));

        var token = new JwtSecurityToken(
            issuer: _config["Jwt:Issuer"],
            audience: _config["Jwt:Audience"],
            claims: claims,
            expires: DateTime.UtcNow.AddMinutes(int.Parse(_config["Jwt:ExpiryMinutes"] ?? "60")),
            signingCredentials: creds
        );
        return new JwtSecurityTokenHandler().WriteToken(token);
    }
}

public record LoginRequest(string Email, string Password);
public record RegisterRequest(string Email, string Password, string? FullName);
//public record LoginResponse(string AccessToken, string TokenType, int ExpiresIn, UserInfo User);
  public record LoginResponse(string AccessToken, string TokenType, int ExpiresIn, UserInfo User);
public record UserInfo(Guid Id, string Email, string? FullName, List<string> Roles);
public partial record ProfileResponse
{
    // additional methods, properties, or helpers
}
//public record ProfileResponse(Guid Id, string Email, string? FullName, string? Phone, string? AvatarUrl, bool IsActive, List<string> Roles, DateTimeOffset CreatedAt, DateTimeOffset UpdatedAt);
