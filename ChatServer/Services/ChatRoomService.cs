using System.Collections.Concurrent;
using System.Net.WebSockets;
using System.Text;
using StackExchange.Redis;

namespace ChatServer.Services;

public class ChatRoomService
{
    private sealed record ConnectedClient(WebSocket Socket, SemaphoreSlim SendLock);

    private readonly ConcurrentDictionary<string, ConcurrentDictionary<string, ConnectedClient>> _rooms = new();
    private readonly ConcurrentDictionary<string, string> _clientToRoom = new();
    private readonly ConcurrentDictionary<string, string> _clientToUsername = new();
    private readonly ILogger<ChatRoomService> _logger;
    private readonly string _instanceId;
    private readonly IConnectionMultiplexer _redis;
    private readonly IDatabase _redisDb;

    public ChatRoomService(ILogger<ChatRoomService> logger, string instanceId, IConnectionMultiplexer redis)
    {
        _logger = logger;
        _instanceId = instanceId;
        _redis = redis;
        _redisDb = redis.GetDatabase();
    }

    public string GenerateRoomCode()
    {
        const string chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
        string code;
        int attempts = 0;
        
        do
        {
            int length = Random.Shared.Next(4, 7);
            code = new string(Enumerable.Repeat(chars, length)
                .Select(s => s[Random.Shared.Next(s.Length)]).ToArray());
            attempts++;
        } while (_redisDb.KeyExists($"room:{code}") && attempts < 100);

        if (attempts >= 100)
        {
            throw new InvalidOperationException("Unable to generate unique room code");
        }

        return code;
    }

    public string CreateRoom()
    {
        var roomCode = GenerateRoomCode();
        var room = new ConcurrentDictionary<string, ConnectedClient>();
        _rooms.TryAdd(roomCode, room);
        _redisDb.StringSet($"room:{roomCode}", "created", TimeSpan.FromHours(24));
        _logger.LogInformation("Created room with code: {RoomCode}", roomCode);
        return roomCode;
    }

    public List<string> GetRooms()
    {
        return _rooms.Keys.ToList();
    }

    public RoomInfo? GetRoomInfo(string roomCode)
    {
        if (_redisDb.KeyExists($"room:{roomCode}"))
        {
            var localClientCount = _rooms.TryGetValue(roomCode, out var room) ? room.Count : 0;
            return new RoomInfo
            {
                RoomCode = roomCode,
                ClientCount = localClientCount
            };
        }
        return null;
    }

    public void AddClient(string roomCode, string clientId, string username, WebSocket webSocket)
    {
        var room = _rooms.GetOrAdd(roomCode, _ => new ConcurrentDictionary<string, ConnectedClient>());
        var client = new ConnectedClient(webSocket, new SemaphoreSlim(1, 1));
        room.TryAdd(clientId, client);
        _clientToRoom.TryAdd(clientId, roomCode);
        _clientToUsername.TryAdd(clientId, username);
        
        _redisDb.StringSet($"room:{roomCode}", "active", TimeSpan.FromHours(24));
        
        _logger.LogInformation("Client {ClientId} ({Username}) joined room {RoomCode}. Total clients in room: {Count}", 
            clientId, username, roomCode, room.Count);
    }

    public void RemoveClient(string clientId)
    {
        if (_clientToRoom.TryRemove(clientId, out var roomCode))
        {
            _clientToUsername.TryRemove(clientId, out _);
            
            if (_rooms.TryGetValue(roomCode, out var room))
            {
                if (room.TryRemove(clientId, out var client))
                {
                    client.SendLock.Dispose();
                    _logger.LogInformation("Client {ClientId} left room {RoomCode}. Total clients in room: {Count}", 
                        clientId, roomCode, room.Count);
                    
                    if (room.IsEmpty)
                    {
                        _rooms.TryRemove(roomCode, out _);
                        _logger.LogInformation("Room {RoomCode} removed (empty)", roomCode);
                    }
                }
            }
        }
    }

    public async Task BroadcastToLocalClientsAsync(string roomCode, string messageJson, string? excludeClientId = null)
    {
        if (!_rooms.TryGetValue(roomCode, out var room))
            return;

        var tasks = new List<Task>();

        foreach (var (clientId, client) in room)
        {
            if (clientId == excludeClientId)
                continue;

            if (client.Socket.State == WebSocketState.Open)
            {
                var buffer = Encoding.UTF8.GetBytes(messageJson);
                tasks.Add(SendMessageAsync(client, buffer));
            }
            else
            {
                RemoveClient(clientId);
            }
        }

        await Task.WhenAll(tasks);
    }

    private async Task SendMessageAsync(ConnectedClient client, byte[] message)
    {
        await client.SendLock.WaitAsync();
        try
        {
            if (client.Socket.State == WebSocketState.Open)
            {
                await client.Socket.SendAsync(
                    new ArraySegment<byte>(message),
                    WebSocketMessageType.Text,
                    true,
                    CancellationToken.None);
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error sending message to client");
        }
        finally
        {
            client.SendLock.Release();
        }
    }

    public int GetClientCount(string roomCode)
    {
        return _rooms.TryGetValue(roomCode, out var room) ? room.Count : 0;
    }

    public string? GetUsername(string clientId)
    {
        return _clientToUsername.TryGetValue(clientId, out var username) ? username : null;
    }

    public string GetInstanceId()
    {
        return _instanceId;
    }
}

public class RoomInfo
{
    public string RoomCode { get; set; } = string.Empty;
    public int ClientCount { get; set; }
}
