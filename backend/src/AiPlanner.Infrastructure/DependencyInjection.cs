using AiPlanner.Application.Auth.Interfaces;
using AiPlanner.Application.Auth.Services;
using AiPlanner.Application.Common.Interfaces;
using AiPlanner.Infrastructure.Identity;
using AiPlanner.Infrastructure.Persistence;
using AiPlanner.Infrastructure.Services;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace AiPlanner.Infrastructure;

public static class DependencyInjection
{
    public static IServiceCollection AddInfrastructure(this IServiceCollection services, IConfiguration configuration)
    {
        services.AddScoped<IApplicationDbContext>(sp => sp.GetRequiredService<ApplicationDbContext>());

        services.Configure<JwtSettings>(configuration.GetSection("Jwt"));
        services.Configure<RefreshTokenOptions>(configuration.GetSection("Jwt"));

        services.AddHttpContextAccessor();
        services.AddScoped<ICurrentUserService, CurrentUserService>();
        services.AddSingleton<IDateTime, DateTimeService>();
        services.AddSingleton<IPasswordHasher, PasswordHasher>();
        services.AddSingleton<ITokenService, TokenService>();

        services.AddScoped<IAuthService, AuthService>();

        return services;
    }
}
