using StackExchange.Redis;
using System.Text;

namespace ChatServer.Services;

public interface IRedisPublisher
{
    Task PublishMessageAsync(string roomCode, string message);
}

public class RedisPublisher : IRedisPublisher
{
    private readonly IConnectionMultiplexer _redis;
    private readonly IConfiguration _configuration;
    private readonly ILogger<RedisPublisher> _logger;
    private readonly string _channelPrefix;

    public RedisPublisher(
        IConnectionMultiplexer redis,
        IConfiguration configuration,
        ILogger<RedisPublisher> logger)
    {
        _redis = redis;
        _configuration = configuration;
        _logger = logger;
        var baseChannel = _configuration["Redis:ChannelName"] ?? "chat-messages";
        _channelPrefix = $"{baseChannel}:";
    }

    public async Task PublishMessageAsync(string roomCode, string message)
    {
        try
        {
            var subscriber = _redis.GetSubscriber();
            var channel = RedisChannel.Literal($"{_channelPrefix}{roomCode}");
            await subscriber.PublishAsync(channel, message);
            _logger.LogInformation("Published message to Redis channel: {Channel}", channel);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error publishing message to Redis");
            throw;
        }
    }
}

public class RedisSubscriber : IHostedService
{
    private readonly IConnectionMultiplexer _redis;
    private readonly ChatRoomService _chatRoomService;
    private readonly IConfiguration _configuration;
    private readonly ILogger<RedisSubscriber> _logger;
    private ISubscriber? _subscriber;
    private readonly string _channelPattern;

    public RedisSubscriber(
        IConnectionMultiplexer redis,
        ChatRoomService chatRoomService,
        IConfiguration configuration,
        ILogger<RedisSubscriber> logger)
    {
        _redis = redis;
        _chatRoomService = chatRoomService;
        _configuration = configuration;
        _logger = logger;
        var baseChannel = _configuration["Redis:ChannelName"] ?? "chat-messages";
        _channelPattern = $"{baseChannel}:*";
    }

    public async Task StartAsync(CancellationToken cancellationToken)
    {
        _subscriber = _redis.GetSubscriber();
        var pattern = RedisChannel.Pattern(_channelPattern);
        
        await _subscriber.SubscribeAsync(pattern, async (channel, message) =>
        {
            try
            {
                if (message.HasValue)
                {
                    var messageText = Encoding.UTF8.GetString(message!);
                    var channelName = channel.ToString();
                    
                    // room codeformat: "chat-messages:ABC123"
                    var parts = channelName.Split(':');
                    var roomCode = parts.Length > 1 ? parts[^1] : "default";
                    
                    _logger.LogInformation("Received message from Redis channel {Channel} for room {RoomCode}", 
                        channelName, roomCode);
                    
                    // Broadcast to all local clients in this room
                    // This ensures messages are delivered across different server instances/ports
                    await _chatRoomService.BroadcastToLocalClientsAsync(roomCode, messageText);
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error processing message from Redis");
            }
        });

        _logger.LogInformation("Redis subscriber started on pattern: {Pattern}", _channelPattern);
    }

    public async Task StopAsync(CancellationToken cancellationToken)
    {
        if (_subscriber != null)
        {
            var pattern = RedisChannel.Pattern(_channelPattern);
            await _subscriber.UnsubscribeAsync(pattern);
            _logger.LogInformation("Redis subscriber stopped");
        }
    }
}

public class ChatHistoryService
{
    private readonly IConnectionMultiplexer _redis;
    private const int MaxHistoryLength = 20;

    public ChatHistoryService(IConnectionMultiplexer redis)
    {
        _redis = redis;
    }

    public async Task AddMessageAsync(string roomCode, string messageJson)
    {
        var db = _redis.GetDatabase();
        var key = $"room:history:{roomCode}";
        
        // Transaction to add message and trim list atomically
        var trans = db.CreateTransaction();
        _ = trans.ListRightPushAsync(key, messageJson);
        _ = trans.ListTrimAsync(key, -MaxHistoryLength, -1); // Keep only last N messages
        _ = trans.KeyExpireAsync(key, TimeSpan.FromHours(24)); // Auto-cleanup room history after 24h
        await trans.ExecuteAsync();
    }

    public async Task<IEnumerable<string>> GetMessagesAsync(string roomCode)
    {
        var db = _redis.GetDatabase();
        var key = $"room:history:{roomCode}";
        var messages = await db.ListRangeAsync(key);
        return messages.Select(m => m.ToString());
    }
}
