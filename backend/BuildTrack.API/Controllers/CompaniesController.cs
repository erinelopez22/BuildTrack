using BuildTrack.API.DTOs.Common;
using BuildTrack.API.DTOs.Companies;
using BuildTrack.API.Services.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace BuildTrack.API.Controllers;

[ApiController]
[Route("api/companies")]
public class CompaniesController(ICompanyService companyService) : ControllerBase
{
    // Public endpoint - used by login page company selector
    [HttpGet("list")]
    [AllowAnonymous]
    public async Task<ActionResult<ApiResponse<List<CompanyListItem>>>> GetList()
    {
        var list = await companyService.GetListAsync();
        return Ok(ApiResponse<List<CompanyListItem>>.Ok(list));
    }

    [HttpGet]
    [Authorize(Policy = "RequireAdmin")]
    public async Task<ActionResult<ApiResponse<List<CompanyDto>>>> GetAll()
    {
        // Only super_admin can see all companies
        if (!User.IsInRole("super_admin"))
            return Forbid();

        var companies = await companyService.GetAllAsync();
        return Ok(ApiResponse<List<CompanyDto>>.Ok(companies));
    }

    [HttpGet("{id:guid}")]
    [Authorize(Policy = "RequireAdmin")]
    public async Task<ActionResult<ApiResponse<CompanyDto>>> GetById(Guid id)
    {
        if (!User.IsInRole("super_admin"))
            return Forbid();

        var company = await companyService.GetByIdAsync(id);
        if (company == null) return NotFound(ApiResponse<CompanyDto>.Fail("Company not found."));
        return Ok(ApiResponse<CompanyDto>.Ok(company));
    }

    [HttpPost]
    [Authorize(Policy = "RequireAdmin")]
    public async Task<ActionResult<ApiResponse<CompanyDto>>> Create([FromBody] CreateCompanyRequest request)
    {
        if (!User.IsInRole("super_admin"))
            return Forbid();

        var (company, error) = await companyService.CreateAsync(request);
        if (error != null) return BadRequest(ApiResponse<CompanyDto>.Fail(error));
        return CreatedAtAction(nameof(GetById), new { id = company!.Id }, ApiResponse<CompanyDto>.Ok(company));
    }

    [HttpPut("{id:guid}")]
    [Authorize(Policy = "RequireAdmin")]
    public async Task<ActionResult<ApiResponse<CompanyDto>>> Update(Guid id, [FromBody] UpdateCompanyRequest request)
    {
        if (!User.IsInRole("super_admin"))
            return Forbid();

        var company = await companyService.UpdateAsync(id, request);
        if (company == null) return NotFound(ApiResponse<CompanyDto>.Fail("Company not found."));
        return Ok(ApiResponse<CompanyDto>.Ok(company));
    }

    [HttpDelete("{id:guid}")]
    [Authorize(Policy = "RequireAdmin")]
    public async Task<ActionResult<ApiResponse<object>>> Delete(Guid id)
    {
        if (!User.IsInRole("super_admin"))
            return Forbid();

        var success = await companyService.DeleteAsync(id);
        if (!success) return NotFound(ApiResponse<object>.Fail("Company not found."));
        return Ok(ApiResponse<object>.Ok(null, "Company deactivated."));
    }
}
