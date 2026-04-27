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

// CORS — dev only (production: React được serve cùng origin)
builder.Services.AddCors(opt => opt.AddDefaultPolicy(p =>
    p.WithOrigins(
        "http://localhost:3000",
        "http://localhost:5173",
        "http://localhost:5041",
        "https://localhost:7157")
     .AllowAnyHeader()
     .AllowAnyMethod()));

var app = builder.Build();

app.UseCors();
app.UseAuthorization();
app.MapControllers();

// Serve React build từ wwwroot (production)
app.UseDefaultFiles();
app.UseStaticFiles();
app.MapFallbackToFile("index.html");

app.Run();
