using System.Net.Http.Headers;
using System.Net.Http.Json;
using AiPlanner.Application.Common.Interfaces;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace AiPlanner.Infrastructure.Email;

/// <summary>
/// The "Email" section. ApiKey + From = Resend sends the app's emails (codes).
/// Neither = email is off (the apps hide "Forgot password?" and confirmation).
/// DevLog (Development only) writes the emails to the log instead - for QA.
/// </summary>
public class EmailOptions
{
    public const string SectionName = "Email";

    /// <summary>Resend API key (a secret: user secrets / deploy/.env, never appsettings).</summary>
    public string ApiKey { get; set; } = string.Empty;

    /// <summary>The sender, on a domain verified at Resend: "AI Planner &lt;no-reply@example.com&gt;".</summary>
    public string From { get; set; } = string.Empty;

    public bool DevLog { get; set; }
}

/// <summary>Sends through Resend's HTTP API (https://resend.com/docs/api-reference/emails/send-email).</summary>
public class ResendEmailSender : IEmailSender
{
    private readonly HttpClient _http;
    private readonly EmailOptions _options;
    private readonly ILogger<ResendEmailSender> _logger;

    public ResendEmailSender(HttpClient http, IOptions<EmailOptions> options, ILogger<ResendEmailSender> logger)
    {
        _http = http;
        _options = options.Value;
        _logger = logger;
    }

    public bool IsConfigured => !string.IsNullOrWhiteSpace(_options.ApiKey) && !string.IsNullOrWhiteSpace(_options.From);

    public async Task SendAsync(string to, string subject, string text, CancellationToken ct = default)
    {
        using var request = new HttpRequestMessage(HttpMethod.Post, "https://api.resend.com/emails")
        {
            Content = JsonContent.Create(new { from = _options.From, to = new[] { to }, subject, text }),
        };
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", _options.ApiKey);
        try
        {
            using var response = await _http.SendAsync(request, ct);
            if (!response.IsSuccessStatusCode)
            {
                // The body describes the problem (domain not verified, quota...), not the user's content.
                _logger.LogWarning("Resend refused an email: {Status} {Body}", (int)response.StatusCode, await response.Content.ReadAsStringAsync(ct));
                throw new InvalidOperationException("The email couldn't be sent.");
            }
        }
        catch (HttpRequestException ex)
        {
            _logger.LogWarning(ex, "Resend couldn't be reached");
            throw new InvalidOperationException("The email couldn't be sent.", ex);
        }
    }
}

/// <summary>Development + Email:DevLog: emails go to the log (QA reads the codes there). Otherwise email is off.</summary>
public class LogEmailSender : IEmailSender
{
    private readonly bool _on;
    private readonly ILogger<LogEmailSender> _logger;

    public LogEmailSender(IOptions<EmailOptions> options, IHostEnvironment env, ILogger<LogEmailSender> logger)
    {
        _on = options.Value.DevLog && env.IsDevelopment();
        _logger = logger;
    }

    public bool IsConfigured => _on;

    public Task SendAsync(string to, string subject, string text, CancellationToken ct = default)
    {
        if (!_on) throw new InvalidOperationException("Email isn't set up.");
        _logger.LogInformation("DEV EMAIL to {To}: {Subject}", to, subject);
        return Task.CompletedTask;
    }
}
