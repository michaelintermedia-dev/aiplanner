using System.Net;
using System.Net.Sockets;

namespace AiPlanner.Application.Common.Utils;

/// <summary>
/// Whether an IP address is on the public internet (pure - unit tested). The
/// server looks up links people share; it must never be pointed at itself or
/// the private network around it (SSRF) - loopback, private ranges, link-local
/// (cloud metadata at 169.254.169.254), carrier NAT, multicast, reserved.
/// </summary>
public static class PublicAddress
{
    public static bool IsPublic(IPAddress address)
    {
        if (address.IsIPv4MappedToIPv6) address = address.MapToIPv4();
        if (IPAddress.IsLoopback(address)) return false;
        if (address.AddressFamily == AddressFamily.InterNetwork)
        {
            var b = address.GetAddressBytes();
            return !(b[0] == 0 // "this network"
                || b[0] == 10
                || b[0] == 127
                || (b[0] == 100 && b[1] >= 64 && b[1] <= 127) // carrier NAT
                || (b[0] == 169 && b[1] == 254) // link-local, cloud metadata
                || (b[0] == 172 && b[1] >= 16 && b[1] <= 31)
                || (b[0] == 192 && b[1] == 168)
                || (b[0] == 192 && b[1] == 0 && b[2] == 0) // IETF protocol assignments
                || (b[0] == 198 && (b[1] == 18 || b[1] == 19)) // benchmarking
                || b[0] >= 224); // multicast and reserved
        }
        if (address.AddressFamily == AddressFamily.InterNetworkV6)
        {
            if (address.IsIPv6LinkLocal || address.IsIPv6SiteLocal || address.IsIPv6Multicast || address.Equals(IPAddress.IPv6None)) return false;
            var b = address.GetAddressBytes();
            if ((b[0] & 0xFE) == 0xFC) return false; // unique local fc00::/7
            return true;
        }
        return false;
    }
}
