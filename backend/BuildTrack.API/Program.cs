using System.Text;
using BuildTrack.API.Data;
using BuildTrack.API.Middleware;
using BuildTrack.API.Services.Implementations;
using BuildTrack.API.Services.Interfaces;
using BuildTrack.API.Hubs;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Microsoft.OpenApi.Models;

var builder = WebApplication.CreateBuilder(args);

// ── Database ────────────────────────────────────────────────────────────────
builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseSqlServer(builder.Configuration.GetConnectionString("DefaultConnection"),
        sql => sql.EnableRetryOnFailure(3)));

// ── JWT ──────────────────────────────────────────────────────────────────────
var jwtSecret = builder.Configuration["Jwt:Secret"]
    ?? throw new InvalidOperationException("Jwt:Secret is not configured.");

builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidateAudience = true,
            ValidateLifetime = true,
            ValidateIssuerSigningKey = true,
            ValidIssuer = builder.Configuration["Jwt:Issuer"],
            ValidAudience = builder.Configuration["Jwt:Audience"],
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtSecret)),
            ClockSkew = TimeSpan.Zero
        };

        // Allow SignalR to pass token via query string
        options.Events = new JwtBearerEvents
        {
            OnMessageReceived = ctx =>
            {
                var accessToken = ctx.Request.Query["access_token"];
                var path = ctx.HttpContext.Request.Path;
                if (!string.IsNullOrEmpty(accessToken) && path.StartsWithSegments("/hubs"))
                    ctx.Token = accessToken;
                return Task.CompletedTask;
            }
        };
    });

builder.Services.AddAuthorizationBuilder()
    .AddPolicy("RequireAdmin", policy => policy.RequireRole("super_admin", "admin"))
    .AddPolicy("RequireOfficeAdmin", policy => policy.RequireRole("super_admin", "admin", "office_admin"))
    .AddPolicy("RequireApprover", policy => policy.RequireRole("super_admin", "admin", "office_admin", "approver", "approval_admin"))
    .AddPolicy("RequireWarehouseAdmin", policy => policy.RequireRole("super_admin", "admin", "warehouse_admin"))
    .AddPolicy("RequireProjectManager", policy => policy.RequireRole("super_admin", "admin", "project_manager", "project_engineer"))
    .AddPolicy("RequireLogistics", policy => policy.RequireRole("super_admin", "admin", "logistics_admin", "tracking_driver", "driver"))
    .AddPolicy("RequireReceiver", policy => policy.RequireRole("super_admin", "admin", "receiver"));

// ── Application Services ─────────────────────────────────────────────────────
builder.Services.AddScoped<IJwtService, JwtService>();
builder.Services.AddScoped<IAuthService, AuthService>();
builder.Services.AddScoped<ICompanyService, CompanyService>();
builder.Services.AddScoped<IUserService, UserService>();
builder.Services.AddScoped<IProjectService, ProjectService>();
builder.Services.AddScoped<IOrderService, OrderService>();
builder.Services.AddScoped<ISkuService, SkuService>();
builder.Services.AddScoped<IInventoryService, InventoryService>();
builder.Services.AddScoped<ICompanyAssetService, CompanyAssetService>();
builder.Services.AddScoped<IQuotationService, QuotationService>();
builder.Services.AddScoped<INotificationService, NotificationService>();
builder.Services.AddScoped<IDashboardService, DashboardService>();
builder.Services.AddScoped<IAuditLogService, AuditLogService>();
builder.Services.AddScoped<ITrackingService, TrackingService>();

// ── SignalR ───────────────────────────────────────────────────────────────────
builder.Services.AddSignalR();

// ── CORS ──────────────────────────────────────────────────────────────────────
builder.Services.AddCors(options =>
{
    options.AddPolicy("FrontendPolicy", policy =>
    {
        var configOrigins = builder.Configuration.GetSection("Cors:AllowedOrigins").Get<string[]>();
        var origins = new HashSet<string>(configOrigins ?? [])
        {
            "http://localhost:8080",
            "http://localhost:5173",
            "https://orange-ocean-0e1833300.7.azurestaticapps.net"
        };
        policy.WithOrigins(origins.ToArray())
            .AllowAnyMethod()
            .AllowAnyHeader()
            .AllowCredentials(); // required for SignalR
    });
});

// ── Controllers + Swagger ─────────────────────────────────────────────────────
builder.Services.AddControllers()
    .AddJsonOptions(opts =>
    {
        opts.JsonSerializerOptions.Converters.Add(new System.Text.Json.Serialization.JsonStringEnumConverter());
    });

builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(c =>
{
    c.SwaggerDoc("v1", new OpenApiInfo
    {
        Title = "BuildTrack API",
        Version = "v1",
        Description = "Construction Inventory & Order Tracking REST API"
    });
    c.AddSecurityDefinition("Bearer", new OpenApiSecurityScheme
    {
        Name = "Authorization",
        Type = SecuritySchemeType.ApiKey,
        Scheme = "Bearer",
        BearerFormat = "JWT",
        In = ParameterLocation.Header,
        Description = "Enter: Bearer {token}"
    });
    c.AddSecurityRequirement(new OpenApiSecurityRequirement
    {
        {
            new OpenApiSecurityScheme { Reference = new OpenApiReference { Type = ReferenceType.SecurityScheme, Id = "Bearer" } },
            Array.Empty<string>()
        }
    });
});

builder.Services.AddHttpContextAccessor();

// ── Build ──────────────────────────────────────────────────────────────────────
var app = builder.Build();

// if (app.Environment.IsDevelopment())
// {
//     app.UseSwagger();
//     app.UseSwaggerUI(c => c.SwaggerEndpoint("/swagger/v1/swagger.json", "BuildTrack API v1"));
// }
app.UseSwagger();
app.UseSwaggerUI(c => c.SwaggerEndpoint("/swagger/v1/swagger.json", "BuildTrack API v1"));

app.UseMiddleware<ErrorHandlingMiddleware>();
app.UseCors("FrontendPolicy");
app.UseStaticFiles();
app.UseAuthentication();
app.UseAuthorization();
app.MapControllers();
app.MapHub<NotificationHub>("/hubs/notifications");

// Auto-migrate and seed on startup (dev convenience)
// if (app.Environment.IsDevelopment())
// {

try
{
    using var scope = app.Services.CreateScope();
    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    db.Database.Migrate();

    // Create tracking tables if they don't exist
    db.Database.ExecuteSqlRaw(@"
        IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'OrderTrackingAssignments')
        BEGIN
            CREATE TABLE [OrderTrackingAssignments] (
                [Id] uniqueidentifier NOT NULL PRIMARY KEY DEFAULT NEWID(),
                [OrderId] uniqueidentifier NOT NULL,
                [DriverUserId] uniqueidentifier NOT NULL,
                [PlateNumber] nvarchar(100) NOT NULL DEFAULT '',
                [TrackingReference] nvarchar(200) NULL,
                [Notes] nvarchar(max) NULL,
                [TrackingStatus] nvarchar(50) NOT NULL DEFAULT 'on_transit',
                [ArrivedAt] datetime2 NULL,
                [HoldRemarks] nvarchar(max) NULL,
                [HeldAt] datetime2 NULL,
                [ResumeRemarks] nvarchar(max) NULL,
                [ResumedAt] datetime2 NULL,
                [CreatedBy] uniqueidentifier NULL,
                [CreatedAt] datetime2 NOT NULL DEFAULT GETUTCDATE(),
                CONSTRAINT [FK_OTA_Orders] FOREIGN KEY ([OrderId]) REFERENCES [Orders]([Id]) ON DELETE CASCADE,
                CONSTRAINT [FK_OTA_Driver] FOREIGN KEY ([DriverUserId]) REFERENCES [Profiles]([Id]),
                CONSTRAINT [FK_OTA_Creator] FOREIGN KEY ([CreatedBy]) REFERENCES [Profiles]([Id])
            )
        END
    ");

    db.Database.ExecuteSqlRaw(@"
        IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'OrderTrackingMaterials')
        BEGIN
            CREATE TABLE [OrderTrackingMaterials] (
                [Id] uniqueidentifier NOT NULL PRIMARY KEY DEFAULT NEWID(),
                [AssignmentId] uniqueidentifier NOT NULL,
                [OrderItemId] uniqueidentifier NOT NULL,
                [AssignedQuantity] decimal(18,2) NOT NULL DEFAULT 0,
                CONSTRAINT [FK_OTM_Assignment] FOREIGN KEY ([AssignmentId]) REFERENCES [OrderTrackingAssignments]([Id]) ON DELETE CASCADE,
                CONSTRAINT [FK_OTM_OrderItem] FOREIGN KEY ([OrderItemId]) REFERENCES [OrderItems]([Id])
            )
        END
    ");

    // Add ApprovedByName column if it doesn't exist
    db.Database.ExecuteSqlRaw(@"
        IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Orders') AND name = 'ApprovedByName')
            ALTER TABLE [Orders] ADD [ApprovedByName] nvarchar(256) NULL
    ");

    // Backfill ApprovedByName from Profiles for existing approved orders
    db.Database.ExecuteSqlRaw(@"
        UPDATE o SET o.[ApprovedByName] = p.[FullName]
        FROM [Orders] o
        INNER JOIN [Profiles] p ON o.[ApprovedBy] = p.[Id]
        WHERE o.[ApprovedBy] IS NOT NULL AND o.[ApprovedByName] IS NULL
    ");

    // Add order timestamp columns if they don't exist
    db.Database.ExecuteSqlRaw(@"
        IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Orders') AND name = 'OnTransitAt')
            ALTER TABLE [Orders] ADD [OnTransitAt] datetime2 NULL
    ");
    db.Database.ExecuteSqlRaw(@"
        IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Orders') AND name = 'DeliveredAt')
            ALTER TABLE [Orders] ADD [DeliveredAt] datetime2 NULL
    ");

    // Add evidence columns if they don't exist
    db.Database.ExecuteSqlRaw(@"
        IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('OrderTrackingAssignments') AND name = 'EvidenceJson')
            ALTER TABLE [OrderTrackingAssignments] ADD [EvidenceJson] nvarchar(max) NULL
    ");
    db.Database.ExecuteSqlRaw(@"
        IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('OrderTrackingAssignments') AND name = 'ReceiverEvidenceJson')
            ALTER TABLE [OrderTrackingAssignments] ADD [ReceiverEvidenceJson] nvarchar(max) NULL
    ");

    // ── Multi-company migration ─────────────────────────────────────────────
    // Create Companies table if it doesn't exist
    db.Database.ExecuteSqlRaw(@"
        IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'Companies')
        BEGIN
            CREATE TABLE [Companies] (
                [Id] uniqueidentifier NOT NULL PRIMARY KEY DEFAULT NEWID(),
                [Name] nvarchar(256) NOT NULL,
                [Address] nvarchar(500) NULL,
                [Phone] nvarchar(100) NULL,
                [Email] nvarchar(256) NULL,
                [IsActive] bit NOT NULL DEFAULT 1,
                [CreatedAt] datetime2 NOT NULL DEFAULT GETUTCDATE(),
                [UpdatedAt] datetime2 NOT NULL DEFAULT GETUTCDATE()
            )
            CREATE UNIQUE INDEX [IX_Companies_Name] ON [Companies] ([Name])
        END
    ");

    // Seed default company "BuildTrack"
    // db.Database.ExecuteSqlRaw(@"
    //     IF NOT EXISTS (SELECT 1 FROM [Companies] WHERE [Name] = 'BuildTrack')
    //         INSERT INTO [Companies] ([Id], [Name], [CreatedAt], [UpdatedAt])
    //         VALUES ('00000000-0000-0000-0000-000000000001', 'BuildTrack', GETUTCDATE(), GETUTCDATE())
    // ");
    db.Database.ExecuteSqlRaw(@"
    IF NOT EXISTS (SELECT 1 FROM [Companies] WHERE [Name] = 'BuildTrack')
        INSERT INTO [Companies] ([Id], [Name], [IsActive], [CreatedAt], [UpdatedAt])
        VALUES ('00000000-0000-0000-0000-000000000001', 'BuildTrack', 1, GETUTCDATE(), GETUTCDATE())
        ");

    // Add CompanyId column to Profiles
    db.Database.ExecuteSqlRaw(@"
        IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Profiles') AND name = 'CompanyId')
        BEGIN
            ALTER TABLE [Profiles] ADD [CompanyId] uniqueidentifier NULL
            ALTER TABLE [Profiles] ADD CONSTRAINT [FK_Profiles_Companies] FOREIGN KEY ([CompanyId]) REFERENCES [Companies]([Id])
        END
    ");

    // Add CompanyId column to Projects
    db.Database.ExecuteSqlRaw(@"
        IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Projects') AND name = 'CompanyId')
        BEGIN
            ALTER TABLE [Projects] ADD [CompanyId] uniqueidentifier NULL
            ALTER TABLE [Projects] ADD CONSTRAINT [FK_Projects_Companies] FOREIGN KEY ([CompanyId]) REFERENCES [Companies]([Id])
        END
    ");

    // Add CompanyId column to SKUs
    db.Database.ExecuteSqlRaw(@"
        IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('SKUs') AND name = 'CompanyId')
        BEGIN
            ALTER TABLE [SKUs] ADD [CompanyId] uniqueidentifier NULL
            ALTER TABLE [SKUs] ADD CONSTRAINT [FK_SKUs_Companies] FOREIGN KEY ([CompanyId]) REFERENCES [Companies]([Id])
        END
    ");

    // Add CompanyId column to CompanyAssets
    db.Database.ExecuteSqlRaw(@"
        IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('CompanyAssets') AND name = 'CompanyId')
        BEGIN
            ALTER TABLE [CompanyAssets] ADD [CompanyId] uniqueidentifier NULL
            ALTER TABLE [CompanyAssets] ADD CONSTRAINT [FK_CompanyAssets_Companies] FOREIGN KEY ([CompanyId]) REFERENCES [Companies]([Id])
        END
    ");

    // Migrate all existing data to BuildTrack company
    db.Database.ExecuteSqlRaw("UPDATE [Profiles] SET [CompanyId] = '00000000-0000-0000-0000-000000000001' WHERE [CompanyId] IS NULL");
    db.Database.ExecuteSqlRaw("UPDATE [Projects] SET [CompanyId] = '00000000-0000-0000-0000-000000000001' WHERE [CompanyId] IS NULL");
    db.Database.ExecuteSqlRaw("UPDATE [SKUs] SET [CompanyId] = '00000000-0000-0000-0000-000000000001' WHERE [CompanyId] IS NULL");
    db.Database.ExecuteSqlRaw("UPDATE [CompanyAssets] SET [CompanyId] = '00000000-0000-0000-0000-000000000001' WHERE [CompanyId] IS NULL");

    // Seed super admin if no users exist
    if (!db.Profiles.Any())
    {
        var adminId = Guid.NewGuid();
        var now = DateTime.UtcNow;
        var admin = new BuildTrack.API.Models.Entities.Profile
        {
            Id       = adminId,
            Email    = "admin@buildtrack.com",
            Username = "superadmin",
            FullName = "System Administrator",
            PasswordHash = BCrypt.Net.BCrypt.HashPassword("Admin@123456"),
            SmsOptIn = false,
            IsActive = true,
            CompanyId = Guid.Parse("00000000-0000-0000-0000-000000000001"),
            CreatedAt = now,
            UpdatedAt = now
        };
        db.Profiles.Add(admin);
        db.UserRoles.AddRange(
            new BuildTrack.API.Models.Entities.UserRole { Id = Guid.NewGuid(), UserId = adminId, Role = "super_admin", CreatedAt = now, CreatedBy = adminId },
            new BuildTrack.API.Models.Entities.UserRole { Id = Guid.NewGuid(), UserId = adminId, Role = "admin",       CreatedAt = now, CreatedBy = adminId }
        );
        db.SaveChanges();
        Console.WriteLine("✓ Default admin seeded: admin@buildtrack.com / Admin@123456");
    }
//}
}
catch (Exception ex)
{
Console.WriteLine($"Migration error: {ex.Message}");
    // Optionally rethrow or handle as needed
}

app.Run();
