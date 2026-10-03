import socket
import ipaddress
from urllib.parse import urlparse

PRIVATE_IP_RANGES = [
    ipaddress.ip_network("0.0.0.0/8"),
    ipaddress.ip_network("10.0.0.0/8"),
    ipaddress.ip_network("100.64.0.0/10"),
    ipaddress.ip_network("127.0.0.0/8"),
    ipaddress.ip_network("169.254.0.0/16"),
    ipaddress.ip_network("172.16.0.0/12"),
    ipaddress.ip_network("192.0.0.0/24"),
    ipaddress.ip_network("192.0.2.0/24"),
    ipaddress.ip_network("192.168.0.0/16"),
    ipaddress.ip_network("198.18.0.0/15"),
    ipaddress.ip_network("198.51.100.0/24"),
    ipaddress.ip_network("203.0.113.0/24"),
    ipaddress.ip_network("224.0.0.0/4"),
    ipaddress.ip_network("240.0.0.0/4"),
    ipaddress.ip_network("::1/128"),
    ipaddress.ip_network("fc00::/7"),
    ipaddress.ip_network("fe80::/10"),
]

BLOCKED_HOSTNAMES = {
    "localhost", "localhost.localdomain", "local", "internal",
    "metadata.google.internal", "169.254.169.254"
}

def is_ssrf_safe(url: str) -> tuple[bool, str]:
    """
    Validates if a URL is safe against SSRF attacks.
    Returns (is_safe, reason_if_unsafe).
    """
    if not url or not isinstance(url, str):
        return False, "Empty or invalid URL type"
    
    parsed = urlparse(url)
    if parsed.scheme not in ("http", "https"):
        return False, f"Unsupported scheme: '{parsed.scheme}'. Only http and https are allowed."
    
    hostname = parsed.hostname
    if not hostname:
        return False, "Missing hostname in URL"
    
    hostname_lower = hostname.lower()
    if hostname_lower in BLOCKED_HOSTNAMES or hostname_lower.endswith(".local") or hostname_lower.endswith(".internal"):
        return False, f"Access to restricted host '{hostname}' is blocked."
    
    # Try resolving IP address
    try:
        ip_list = socket.getaddrinfo(hostname, parsed.port or (443 if parsed.scheme == "https" else 80))
        for item in ip_list:
            ip_str = item[4][0]
            ip_obj = ipaddress.ip_address(ip_str)
            for private_range in PRIVATE_IP_RANGES:
                if ip_obj in private_range:
                    return False, f"URL resolves to private/internal IP address ({ip_str})."
    except socket.gaierror:
        # DNS resolution failure will be caught during crawling attempt
        pass
    except Exception as e:
        return False, f"Security verification error: {str(e)}"
    
    return True, ""
