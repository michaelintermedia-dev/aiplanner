using AiPlanner.Application.Auth.DTOs;
using AiPlanner.Application.Common.Models;
using AiPlanner.Application.Users.DTOs;

namespace AiPlanner.Application.Users.Interfaces;

public interface IUserProfileService
{
    Task<Result<UserDto>> UpdateAsync(UpdateProfileRequest request, CancellationToken ct = default);
}
