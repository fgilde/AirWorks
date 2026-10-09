using System.Collections.Concurrent;
using System.Security.Claims;
using System.Text.Json;
using AirWorks.Demo.Api;
using Microsoft.AspNetCore.Authentication.JwtBearer;

var builder = WebApplication.CreateBuilder(args);

builder.AddServiceDefaults();
builder.Services.AddProblemDetails();
builder.Services.AddSingleton<IdentityService>();

var keycloak = builder.Configuration["services:keycloak:https:0"] ?? builder.Configuration["services:keycloak:http:0"] ?? "https://localhost:8080";
var authority = builder.Configuration["Authentication:Authority"] ?? $"{keycloak}/realms/airworks";

builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.Authority = authority;
        options.Audience = builder.Configuration["Authentication:Audience"] ?? "airworks-api";
        options.RequireHttpsMetadata = false;
        options.MapInboundClaims = false;
        options.TokenValidationParameters.NameClaimType = "preferred_username";
        options.Events = new JwtBearerEvents
        {
            OnTokenValidated = context =>
            {
                if (context.Principal?.Identity is not ClaimsIdentity identity) return Task.CompletedTask;
                var realmAccess = identity.FindFirst("realm_access")?.Value;
                if (string.IsNullOrWhiteSpace(realmAccess)) return Task.CompletedTask;
                using var document = JsonDocument.Parse(realmAccess);
                if (document.RootElement.TryGetProperty("roles", out var roles))
                    foreach (var role in roles.EnumerateArray())
                        identity.AddClaim(new Claim("role", role.GetString() ?? ""));
                return Task.CompletedTask;
            }
        };
    });
builder.Services.AddAuthorization();

var app = builder.Build();
app.UseExceptionHandler();
app.UseAuthentication();
app.UseAuthorization();

var api = app.MapGroup("/api").RequireAuthorization();

api.MapGet("/me", (ClaimsPrincipal principal, IdentityService identity) => identity.Describe(principal));

var profiles = new ConcurrentDictionary<string, JsonElement>(StringComparer.OrdinalIgnoreCase);
api.MapGet("/profile", (ClaimsPrincipal user) => profiles.TryGetValue(user.Identity!.Name!, out var profile) ? Results.Ok(profile) : Results.NoContent());
api.MapPut("/profile", (ClaimsPrincipal user, JsonElement profile) =>
{
    profiles[user.Identity!.Name!] = profile;
    return Results.NoContent();
});

api.MapGet("/reports", () => new[]
{
    new { department = "North", actual = 1_284_000, plan = 1_200_000 },
    new { department = "South", actual = 1_092_000, plan = 1_150_000 },
    new { department = "International", actual = 1_736_000, plan = 1_600_000 },
}).RequirePermission("reports.read");

var admin = api.MapGroup("/identity").RequirePermission(IdentityService.ManageIdentity);
admin.MapGet("/users", (IdentityService identity) => identity.Users.Values.OrderBy(user => user.UserName));
admin.MapPut("/users/{id}", (string id, UserRecord user, IdentityService identity) =>
{
    if (string.IsNullOrWhiteSpace(user.UserName)) return Results.ValidationProblem(new Dictionary<string, string[]> { ["userName"] = ["Required"] });
    identity.Users[id] = user with { Id = id };
    return Results.NoContent();
});
admin.MapDelete("/users/{id}", (string id, IdentityService identity) => identity.Users.TryRemove(id, out _) ? Results.NoContent() : Results.NotFound());
admin.MapGet("/roles", (IdentityService identity) => identity.Roles.Values.OrderBy(role => role.Id));
admin.MapPut("/roles/{id}", (string id, RoleDefinition role, IdentityService identity) =>
{
    identity.Roles[id] = role with { Id = id };
    return Results.NoContent();
});
admin.MapDelete("/roles/{id}", (string id, IdentityService identity) => identity.Roles.TryRemove(id, out _) ? Results.NoContent() : Results.NotFound());
admin.MapGet("/permissions", () => IdentityService.Permissions);

app.MapDefaultEndpoints();
app.Run();
