using CoTuongAPI.Hubs;
using CoTuongAPI.Services;

var builder = WebApplication.CreateBuilder(args);

var port = Environment.GetEnvironmentVariable("PORT") ?? "8080";
builder.WebHost.UseUrls($"http://0.0.0.0:{port}");

builder.Services.AddControllers()
    .AddJsonOptions(o =>
        o.JsonSerializerOptions.Converters.Add(
            new System.Text.Json.Serialization.JsonStringEnumConverter()));

// Services
builder.Services.AddSingleton<GameManager>();
builder.Services.AddSingleton<AuthService>();
builder.Services.AddSingleton<RoomManager>();

// SignalR
builder.Services.AddSignalR();

// CORS
builder.Services.AddCors(opt => opt.AddDefaultPolicy(p =>
    p.AllowAnyOrigin().AllowAnyHeader().AllowAnyMethod()));

var app = builder.Build();

app.UseCors();
app.UseDefaultFiles();
app.UseStaticFiles();
app.UseAuthorization();
app.MapControllers();

// SignalR Hub
app.MapHub<GameHub>("/hubs/game");

app.MapFallbackToFile("index.html");
app.Run();
