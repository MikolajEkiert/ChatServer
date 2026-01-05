namespace ChatServer.Models;

public class ChatMessage
{
    public string Username { get; set; } = string.Empty;
    public string Message { get; set; } = string.Empty;
    public DateTime Timestamp { get; set; }
    public string RoomCode { get; set; } = string.Empty;
    public string InstanceId { get; set; } = string.Empty;
}

