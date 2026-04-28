using Microsoft.AspNetCore.Mvc;
using CoTuongAPI.Services;

namespace CoTuongAPI.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class RoomController : ControllerBase
    {
        private readonly RoomManager _rooms;
        public RoomController(RoomManager rooms) => _rooms = rooms;

        // GET /api/room — danh sách phòng đang chờ
        [HttpGet]
        public IActionResult GetRooms()
        {
            var rooms = _rooms.GetWaitingRooms();
            return Ok(rooms.Select(r => new
            {
                r.Id, r.HostName, r.Status, r.TimePerSide,
                r.CreatedAt, isFull = r.IsFull
            }));
        }

        // POST /api/room — tạo phòng mới
        [HttpPost]
        public IActionResult CreateRoom([FromBody] CreateRoomRequest req)
        {
            if (string.IsNullOrWhiteSpace(req.PlayerName))
                return BadRequest(new { error = "Cần nhập tên người chơi" });

            var room = _rooms.CreateRoom(req.PlayerId, req.PlayerName, req.TimePerSide);
            return Ok(new { room.Id, room.HostName, room.Status, room.TimePerSide });
        }

        // GET /api/room/{id}
        [HttpGet("{id}")]
        public IActionResult GetRoom(string id)
        {
            var room = _rooms.GetRoom(id);
            if (room == null) return NotFound(new { error = "Phòng không tồn tại" });
            return Ok(new { room.Id, room.HostName, room.GuestName, room.Status, room.GameId, room.TimePerSide });
        }

        // DELETE /api/room/{id}
        [HttpDelete("{id}")]
        public IActionResult DeleteRoom(string id)
        {
            _rooms.RemoveRoom(id);
            return NoContent();
        }
    }

    public record CreateRoomRequest(string PlayerId, string PlayerName, int TimePerSide = 600);
}
