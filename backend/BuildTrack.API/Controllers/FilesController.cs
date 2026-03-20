using BuildTrack.API.DTOs.Common;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace BuildTrack.API.Controllers;

[ApiController]
[Route("api/files")]
[Authorize]
public class FilesController(IWebHostEnvironment env) : ControllerBase
{
    private static readonly string[] AllowedExtensions = [".jpg", ".jpeg", ".png", ".gif", ".webp", ".pdf"];
    private const long MaxFileSize = 10 * 1024 * 1024; // 10 MB

    [HttpPost("upload")]
    public async Task<ActionResult<ApiResponse<UploadedFileDto>>> Upload(IFormFile file)
    {
        if (file == null || file.Length == 0)
            return BadRequest(ApiResponse<UploadedFileDto>.Fail("No file provided."));

        if (file.Length > MaxFileSize)
            return BadRequest(ApiResponse<UploadedFileDto>.Fail("File exceeds 10 MB limit."));

        var ext = Path.GetExtension(file.FileName).ToLowerInvariant();
        if (!AllowedExtensions.Contains(ext))
            return BadRequest(ApiResponse<UploadedFileDto>.Fail("File type not allowed."));

        var uploadsDir = Path.Combine(env.WebRootPath, "uploads");
        Directory.CreateDirectory(uploadsDir);

        var fileName = $"{Guid.NewGuid()}{ext}";
        var filePath = Path.Combine(uploadsDir, fileName);

        await using var stream = System.IO.File.Create(filePath);
        await file.CopyToAsync(stream);

        var fileUrl = $"/uploads/{fileName}";
        return Ok(ApiResponse<UploadedFileDto>.Ok(new UploadedFileDto
        {
            FileUrl = fileUrl,
            FileName = file.FileName,
        }));
    }
}

public class UploadedFileDto
{
    public string FileUrl { get; set; } = string.Empty;
    public string FileName { get; set; } = string.Empty;
}
