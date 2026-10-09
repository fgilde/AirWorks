var builder = DistributedApplication.CreateBuilder(args);

var keycloak = builder.AddKeycloak("keycloak", 8080)
    .WithRealmImport("./Realms");

var api = builder.AddProject<Projects.AirWorks_Demo_Api>("api")
    .WithReference(keycloak)
    .WaitFor(keycloak);

builder.AddProject<Projects.AirWorks_Demo_Web>("web")
    .WithExternalHttpEndpoints()
    .WithReference(api)
    .WithReference(keycloak)
    .WaitFor(api)
    .WaitFor(keycloak);

builder.Build().Run();
