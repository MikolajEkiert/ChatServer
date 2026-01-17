using ChatServer.Models;
using ChatServer.Services;
using StackExchange.Redis;
using System.Net.WebSockets;
using System.Text;
using System.Text.Json;

var instanceId = Guid.NewGuid().ToString();
Console.WriteLine($"Server instance ID: {instanceId}");

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

var redisConnectionString = builder.Configuration["Redis:ConnectionString"] ?? "localhost:6379";
builder.Services.AddSingleton<IConnectionMultiplexer>(sp =>
{
    return ConnectionMultiplexer.Connect(redisConnectionString);
});

// register chat services
builder.Services.AddSingleton(sp => new ChatRoomService(
    sp.GetRequiredService<ILogger<ChatRoomService>>(), 
    instanceId, 
    sp.GetRequiredService<IConnectionMultiplexer>()));
builder.Services.AddSingleton<IRedisPublisher, RedisPublisher>();
builder.Services.AddSingleton<ChatHistoryService>();
builder.Services.AddHostedService<RedisSubscriber>();

var app = builder.Build();

// DO NOT REMOVE (disable HTTPS redirection)
app.Use(async (context, next) =>
{
    await next();
});

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

//static files for React frontend
app.UseStaticFiles();
app.UseDefaultFiles();

app.UseWebSockets();

app.Use(async (context, next) =>
{
    if (context.Request.Path.StartsWithSegments("/ws"))
    {
        if (context.WebSockets.IsWebSocketRequest)
        {
            var webSocket = await context.WebSockets.AcceptWebSocketAsync();
            var chatRoomService = context.RequestServices.GetRequiredService<ChatRoomService>();
            var redisPublisher = context.RequestServices.GetRequiredService<IRedisPublisher>();
            
            var roomCode = context.Request.Query["room"].ToString();
            var username = context.Request.Query["username"].ToString();
            
            if (string.IsNullOrEmpty(roomCode) || string.IsNullOrEmpty(username))
            {
                await webSocket.CloseAsync(
                    WebSocketCloseStatus.InvalidPayloadData,
                    "Room code and username are required",
                    CancellationToken.None);
                return;
            }

            var roomInfo = chatRoomService.GetRoomInfo(roomCode);
            if (roomInfo == null)
            {
                await webSocket.CloseAsync(
                    WebSocketCloseStatus.InvalidPayloadData,
                    "Room does not exist",
                    CancellationToken.None);
                return;
            }
            
            var clientId = Guid.NewGuid().ToString();
            var historyService = context.RequestServices.GetRequiredService<ChatHistoryService>();
            chatRoomService.AddClient(roomCode, clientId, username, webSocket);

            try
            {
                await HandleWebSocketAsync(webSocket, roomCode, clientId, username, chatRoomService, redisPublisher, historyService);
            }
            finally
            {
                chatRoomService.RemoveClient(clientId);
            }
        }
        else
        {
            context.Response.StatusCode = StatusCodes.Status400BadRequest;
            context.Response.ContentType = "text/html; charset=utf-8";
            await context.Response.WriteAsync(@"
<!DOCTYPE html>
<html>
<head>
    <title>WebSocket Endpoint</title>
    <meta charset='utf-8'>
</head>
<body>
    <h1>WebSocket Endpoint</h1>
    <p>This endpoint requires a WebSocket connection.</p>
</body>
</html>");
        }
        return;
    }
    await next();
});

app.MapPost("/api/rooms", (ChatRoomService chatRoomService) =>
{
    try
    {
        var roomCode = chatRoomService.CreateRoom();
        return Results.Ok(new
        {
            roomCode = roomCode,
            message = "Room created successfully"
        });
    }
    catch (Exception ex)
    {
        return Results.Problem(
            detail: ex.Message,
            statusCode: StatusCodes.Status500InternalServerError);
    }
});

app.MapGet("/api/rooms/{roomCode}", (string roomCode, ChatRoomService chatRoomService) =>
{
    var roomInfo = chatRoomService.GetRoomInfo(roomCode);
    if (roomInfo == null)
    {
        return Results.NotFound(new { message = "Room not found" });
    }
    
    return Results.Ok(roomInfo);
});

app.MapGet("/api/rooms/{roomCode}/messages", async (string roomCode, ChatHistoryService historyService) =>
{
    var messages = await historyService.GetMessagesAsync(roomCode);
    // Return raw JSON strings as a JSON array
    var jsonArrayString = $"[{string.Join(",", messages)}]";
    return Results.Content(jsonArrayString, "application/json");
});

app.MapGet("/api/rooms", (ChatRoomService chatRoomService) =>
{
    var rooms = chatRoomService.GetRooms();
    var roomsInfo = rooms.Select(roomCode =>
    {
        var info = chatRoomService.GetRoomInfo(roomCode);
        return new
        {
            roomCode = roomCode,
            clientCount = info?.ClientCount ?? 0
        };
    }).ToList();
    
    return Results.Ok(new { rooms = roomsInfo });
});

app.MapGet("/health", () =>
{
    return Results.Ok(new
    {
        status = "healthy",
        timestamp = DateTime.UtcNow
    });
});

app.MapFallbackToFile("index.html");

app.Run();

static async Task HandleWebSocketAsync(
    WebSocket webSocket,
    string roomCode,
    string clientId,
    string username,
    ChatRoomService chatRoomService,
    IRedisPublisher redisPublisher,
    ChatHistoryService historyService)
{
    var buffer = new byte[1024 * 4];
    var jsonOptions = new JsonSerializerOptions
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase
    };
    
    while (webSocket.State == WebSocketState.Open)
    {
        try
        {
            var result = await webSocket.ReceiveAsync(new ArraySegment<byte>(buffer), CancellationToken.None);
            
            if (result.MessageType == WebSocketMessageType.Close)
            {
                await webSocket.CloseAsync(
                    WebSocketCloseStatus.NormalClosure,
                    "Connection closed",
                    CancellationToken.None);
                break;
            }

            if (result.MessageType == WebSocketMessageType.Text)
            {
                var messageText = Encoding.UTF8.GetString(buffer, 0, result.Count);
                
                ChatMessage chatMessage;
                try
                {
                    chatMessage = JsonSerializer.Deserialize<ChatMessage>(messageText, jsonOptions) 
                        ?? new ChatMessage();
                    
                    if (string.IsNullOrEmpty(chatMessage.Username))
                        chatMessage.Username = username;
                    if (string.IsNullOrEmpty(chatMessage.RoomCode))
                        chatMessage.RoomCode = roomCode;
                    if (chatMessage.Timestamp == default)
                        chatMessage.Timestamp = DateTime.UtcNow;
                    chatMessage.InstanceId = chatRoomService.GetInstanceId();
                }
                catch
                {
                    chatMessage = new ChatMessage
                    {
                        Username = username,
                        Message = messageText,
                        Timestamp = DateTime.UtcNow,
                        RoomCode = roomCode,
                        InstanceId = chatRoomService.GetInstanceId()
                    };
                }

                var messageJson = JsonSerializer.Serialize(chatMessage, jsonOptions);
                Console.WriteLine($"Received from {username} in room {roomCode}: {chatMessage.Message}");

                // Save to Redis History
                await historyService.AddMessageAsync(roomCode, messageJson);

                // Publish to Redis only - all instances (including this one) will receive via RedisSubscriber
                await redisPublisher.PublishMessageAsync(roomCode, messageJson);
            }
        }
        catch (Exception ex)
        {
            Console.WriteLine($"Error handling WebSocket for client {clientId}: {ex.Message}");
            break;
        }
    }
}
