using System.Collections.Concurrent;
using System.Security.Claims;

namespace AirWorks.Demo.Api;

public sealed record UserRecord(string Id, string UserName, string DisplayName, string? Email, string[] Roles);
public sealed record RoleDefinition(string Id, string Title, string[] Permissions);
public sealed record PermissionDefinition(string Id, string Title, string? Group = null, string? Description = null);

public sealed class IdentityService
{
    public const string ManageIdentity = "airworks.identity.manage";

    public static readonly PermissionDefinition[] Permissions =
    [
        new("reports.read", "Read reports", "Reports"),
        new("reports.export", "Export reports", "Reports"),
        new(ManageIdentity, "Manage users and roles", "AirWorks"),
    ];

    public ConcurrentDictionary<string, RoleDefinition> Roles { get; } = new(new Dictionary<string, RoleDefinition>
    {
        ["airworks-user"] = new("airworks-user", "User", ["reports.read"]),
        ["airworks-admin"] = new("airworks-admin", "Administrator", ["reports.read", "reports.export", ManageIdentity]),
        ["controller"] = new("controller", "Controller", ["reports.read", "reports.export"]),
    });

    public ConcurrentDictionary<string, UserRecord> Users { get; } = new(StringComparer.OrdinalIgnoreCase);

    public string[] RolesOf(ClaimsPrincipal principal)
    {
        var tokenRoles = principal.FindAll("role").Select(claim => claim.Value);
        var assigned = Users.TryGetValue(principal.Identity?.Name ?? "", out var user) ? user.Roles : [];
        return tokenRoles.Concat(assigned).Distinct().ToArray();
    }

    public string[] PermissionsOf(ClaimsPrincipal principal) =>
        RolesOf(principal).SelectMany(role => Roles.TryGetValue(role, out var definition) ? definition.Permissions : []).Distinct().ToArray();

    public object Describe(ClaimsPrincipal principal)
    {
        var userName = principal.Identity?.Name ?? principal.FindFirstValue("sub") ?? "unknown";
        var displayName = principal.FindFirstValue("name") ?? userName;
        var email = principal.FindFirstValue("email");
        Users.GetOrAdd(userName, _ => new UserRecord(userName, userName, displayName, email, []));
        return new
        {
            identity = new { id = userName, displayName, email },
            roles = RolesOf(principal),
            permissions = PermissionsOf(principal),
        };
    }
}

public static class PermissionEndpointExtensions
{
    public static TBuilder RequirePermission<TBuilder>(this TBuilder builder, string permission) where TBuilder : IEndpointConventionBuilder =>
        builder.AddEndpointFilter(async (context, next) =>
        {
            var identity = context.HttpContext.RequestServices.GetRequiredService<IdentityService>();
            return identity.PermissionsOf(context.HttpContext.User).Contains(permission)
                ? await next(context)
                : Results.Problem(statusCode: StatusCodes.Status403Forbidden, title: $"Missing permission '{permission}'");
        });
}
