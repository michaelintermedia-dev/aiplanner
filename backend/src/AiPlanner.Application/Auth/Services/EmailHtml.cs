using System.Net;
using System.Text;
using System.Text.RegularExpressions;

namespace AiPlanner.Application.Auth.Services;

/// <summary>
/// The HTML version of the app's emails (pure, unit tested; 2026-10-18): made
/// from the plain text, so every language gets it for free - the cat and the
/// name on top, a 6-digit code set large on its own, right-to-left for Hebrew
/// and Arabic. The plain text still goes along for mail apps without HTML.
/// Simple table layout and inline styles: what email clients understand.
/// </summary>
public static partial class EmailHtml
{
    public const string LogoUrl = "https://app.gatazee.com/icon-192.png";

    [GeneratedRegex(@"\b\d{6}\b")]
    private static partial Regex Code();

    [GeneratedRegex(@"[֐-׿؀-ۿ]")]
    private static partial Regex RightToLeft();

    public static string From(string subject, string text)
    {
        var rtl = RightToLeft().IsMatch(text);
        var code = Code().Match(text) is { Success: true } m ? m.Value : null;
        var body = new StringBuilder();
        foreach (var line in text.Replace("\r", "").Split('\n'))
        {
            if (string.IsNullOrWhiteSpace(line)) continue;
            body.Append("<p style=\"margin:0 0 12px;font-size:16px;line-height:1.5;color:#1c1f2e\">")
                .Append(WebUtility.HtmlEncode(line))
                .Append("</p>");
            if (code is not null && line.Contains(code))
            {
                body.Append("<p style=\"margin:8px 0 20px;font-size:34px;font-weight:700;letter-spacing:8px;color:#3f48b8;font-family:Consolas,Menlo,monospace\">")
                    .Append(code)
                    .Append("</p>");
                code = null; // once
            }
        }

        var dir = rtl ? "rtl" : "ltr";
        var align = rtl ? "right" : "left";
        return $"""
            <!doctype html>
            <html dir="{dir}"><head><meta charset="utf-8"><title>{WebUtility.HtmlEncode(subject)}</title></head>
            <body style="margin:0;padding:0;background:#f6f7fb">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f6f7fb;padding:24px 12px">
            <tr><td align="center">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:16px;padding:28px;text-align:{align};font-family:-apple-system,'Segoe UI',Roboto,Arial,sans-serif" dir="{dir}">
            <tr><td style="padding-bottom:20px">
            <img src="{LogoUrl}" width="40" height="40" alt="" style="border-radius:10px;vertical-align:middle">
            <span style="font-size:20px;font-weight:700;color:#1c1f2e;vertical-align:middle;padding:0 10px">Gatazee</span>
            </td></tr>
            <tr><td>{body}</td></tr>
            <tr><td style="padding-top:16px;border-top:1px solid #dfe2ec;font-size:13px;color:#5d6276">
            <a href="https://gatazee.com" style="color:#4f5bd5;text-decoration:none">gatazee.com</a>
            </td></tr>
            </table>
            </td></tr>
            </table>
            </body></html>
            """;
    }
}
