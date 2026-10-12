namespace AiPlanner.Infrastructure.Identity;

/// <summary>
/// The "ExternalAuth" section: the app's ids at Google and Apple (public, not
/// secrets). A provider with no ids is off - its button isn't shown and its
/// tokens are refused. Lists are separated by commas or spaces.
/// </summary>
public class ExternalAuthOptions
{
    public const string SectionName = "ExternalAuth";

    public GoogleOptions Google { get; set; } = new();
    public AppleOptions Apple { get; set; } = new();

    /// <summary>
    /// Local QA only (Development + this flag): accepts the unsigned "test"
    /// provider ("test|subject|email|name") so the flow can be tested without
    /// real Google/Apple accounts. Never on in production.
    /// </summary>
    public bool AllowTestProvider { get; set; }

    public class GoogleOptions
    {
        /// <summary>The web OAuth client id - the web button uses it, and the phone asks for tokens for it (webClientId).</summary>
        public string WebClientId { get; set; } = string.Empty;

        /// <summary>Other client ids whose tokens are accepted too (e.g. an iOS client).</summary>
        public string OtherClientIds { get; set; } = string.Empty;
    }

    public class AppleOptions
    {
        /// <summary>The Services ID for Sign in with Apple on the web (e.g. "com.aiplanner.web").</summary>
        public string ServicesId { get; set; } = string.Empty;

        /// <summary>The return URL registered for the Services ID (the web page itself with the JS popup).</summary>
        public string RedirectUri { get; set; } = string.Empty;

        /// <summary>The iPhone app's bundle id (native Sign in with Apple), e.g. "com.aiplanner.app".</summary>
        public string BundleId { get; set; } = string.Empty;
    }

    internal static IReadOnlyList<string> Ids(params string?[] values) =>
        values.SelectMany(v => (v ?? "").Split([',', ';', ' ', '\n'], StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries))
            .Distinct(StringComparer.Ordinal)
            .ToList();
}
