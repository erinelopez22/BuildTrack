using System.Net;
using System.Text.Json;
using BuildTrack.API.DTOs.Common;

namespace BuildTrack.API.Middleware;

public class ErrorHandlingMiddleware(RequestDelegate next, ILogger<ErrorHandlingMiddleware> logger, IWebHostEnvironment env)
{
    public async Task InvokeAsync(HttpContext context)
    {
        try
        {
            await next(context);
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Unhandled exception: {Message}", ex.Message);
            await HandleExceptionAsync(context, ex, env.IsDevelopment());
        }
    }

    private static async Task HandleExceptionAsync(HttpContext context, Exception exception, bool isDev)
    {
        context.Response.ContentType = "application/json";

        var (statusCode, message) = exception switch
        {
            ArgumentNullException => (HttpStatusCode.BadRequest, "A required argument was null."),
            InvalidOperationException => (HttpStatusCode.BadRequest, exception.Message),
            UnauthorizedAccessException => (HttpStatusCode.Unauthorized, "Unauthorized."),
            KeyNotFoundException => (HttpStatusCode.NotFound, "Resource not found."),
            _ => (HttpStatusCode.InternalServerError, isDev
                ? $"{exception.GetType().Name}: {exception.Message}{(exception.InnerException != null ? $" | Inner: {exception.InnerException.Message}" : "")}"
                : "An unexpected error occurred.")
        };

        context.Response.StatusCode = (int)statusCode;

        var response = ApiResponse<object>.Fail(message);
        var json = JsonSerializer.Serialize(response, new JsonSerializerOptions
        {
            PropertyNamingPolicy = JsonNamingPolicy.CamelCase
        });

        await context.Response.WriteAsync(json);
    }
}
