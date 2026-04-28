using CoTuongAPI.Services;

var builder = WebApplication.CreateBuilder(args);

// Railway inject PORT qua biến môi trường
var port = Environment.GetEnvironmentVariable("PORT") ?? "8080";
builder.WebHost.UseUrls($"http://0.0.0.0:{port}");

builder.Services.AddControllers()
    .AddJsonOptions(o =>
    {
        o.JsonSerializerOptions.Converters.Add(
            new System.Text.Json.Serialization.JsonStringEnumConverter());
    });

builder.Services.AddSingleton<GameManager>();

builder.Services.AddCors(opt => opt.AddDefaultPolicy(p =>
    p.AllowAnyOrigin().AllowAnyHeader().AllowAnyMethod()));

var app = builder.Build();

// Log để debug trên Railway
var wwwroot = Path.Combine(app.Environment.ContentRootPath, "wwwroot");
Console.WriteLine($"[STARTUP] ContentRootPath: {app.Environment.ContentRootPath}");
Console.WriteLine($"[STARTUP] wwwroot path: {wwwroot}");
Console.WriteLine($"[STARTUP] wwwroot exists: {Directory.Exists(wwwroot)}");
if (Directory.Exists(wwwroot))
{
    foreach (var f in Directory.GetFiles(wwwroot))
        Console.WriteLine($"[STARTUP] file: {f}");
}

app.UseCors();

// Static files TRƯỚC controllers
app.UseDefaultFiles();
app.UseStaticFiles();

app.UseAuthorization();
app.MapControllers();
app.MapFallbackToFile("index.html");

app.Run();
