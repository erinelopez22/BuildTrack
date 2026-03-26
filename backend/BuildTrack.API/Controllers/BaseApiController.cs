using BuildTrack.API.Services.Implementations;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;

namespace BuildTrack.API.Controllers;

public abstract class BaseApiController : ControllerBase
{
    protected Guid CurrentUserId =>
        Guid.Parse(User.FindFirst(ClaimTypes.NameIdentifier)!.Value);

    protected Guid? CurrentCompanyId
    {
        get
        {
            var claim = User.FindFirst(JwtService.CompanyIdClaimType)?.Value;
            return claim != null ? Guid.Parse(claim) : null;
        }
    }

    protected bool IsSuperAdmin => User.IsInRole("super_admin");
}
