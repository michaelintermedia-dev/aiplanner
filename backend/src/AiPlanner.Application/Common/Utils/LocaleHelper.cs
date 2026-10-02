using System.Globalization;

namespace AiPlanner.Application.Common.Utils;

/// <summary>User.Locale is a BCP 47 tag ("en-US", "ru", "he-IL") the clients use for language and formatting.</summary>
public static class LocaleHelper
{
    public static bool IsValid(string? locale)
    {
        if (string.IsNullOrWhiteSpace(locale) || locale.Length > 20) return false;
        try
        {
            CultureInfo.GetCultureInfo(locale, predefinedOnly: true);
            return true;
        }
        catch (CultureNotFoundException)
        {
            return false;
        }
    }
}
