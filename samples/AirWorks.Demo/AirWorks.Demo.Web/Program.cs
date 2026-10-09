using System.Net.Http.Headers;

var builder = WebApplication.CreateBuilder(args);
builder.AddServiceDefaults();
builder.Services.AddHttpClient("api", client => client.BaseAddress = new Uri("http://api"));

var app = builder.Build();
app.UseDefaultFiles();
app.UseStaticFiles();

app.MapGet("/airworks-config", (IConfiguration configuration) =>
{
    var keycloak = configuration["services:keycloak:https:0"] ?? configuration["services:keycloak:http:0"] ?? "https://localhost:8080";
    var providers = configuration.GetSection("AirWorks:Providers").GetChildren()
        .Where(provider => provider.GetValue("Enabled", true))
        .Select(provider => new
        {
            id = provider["Id"],
            title = provider["Title"],
            icon = provider["Icon"],
            authority = provider["Authority"]?.Replace("{keycloak}", keycloak),
            clientId = provider["ClientId"],
            scope = provider["Scope"],
            extraParams = provider.GetSection("ExtraParams").GetChildren().ToDictionary(param => param.Key, param => param.Value),
        });
    return Results.Ok(new { apiBaseUrl = "/api", providers });
});

app.MapMethods("/api/{**path}", ["GET", "POST", "PUT", "PATCH", "DELETE"], async (HttpContext context, IHttpClientFactory clients) =>
{
    using var request = new HttpRequestMessage(new HttpMethod(context.Request.Method), $"{context.Request.Path}{context.Request.QueryString}");
    if (context.Request.ContentLength > 0 || context.Request.Headers.TransferEncoding.Count > 0)
    {
        request.Content = new StreamContent(context.Request.Body);
        if (!string.IsNullOrWhiteSpace(context.Request.ContentType))
            request.Content.Headers.ContentType = MediaTypeHeaderValue.Parse(context.Request.ContentType);
    }
    if (context.Request.Headers.Authorization.Count > 0)
        request.Headers.TryAddWithoutValidation("Authorization", context.Request.Headers.Authorization.ToArray());

    using var response = await clients.CreateClient("api").SendAsync(request, HttpCompletionOption.ResponseHeadersRead, context.RequestAborted);
    context.Response.StatusCode = (int)response.StatusCode;
    if (response.Content.Headers.ContentType is not null)
        context.Response.ContentType = response.Content.Headers.ContentType.ToString();
    await response.Content.CopyToAsync(context.Response.Body, context.RequestAborted);
});

app.MapDefaultEndpoints();
app.MapFallbackToFile("index.html");
app.Run();
