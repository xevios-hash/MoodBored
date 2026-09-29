# Security Policy

## Reporting a Vulnerability

If you discover a security vulnerability in MoodBored, please report it responsibly:

1. **Do NOT** create a public GitHub issue
2. Email security concerns to: [security@example.com]
3. Include:
   - Description of the vulnerability
   - Steps to reproduce
   - Potential impact
   - Suggested fix (if any)

## Response Timeline

- Initial response: Within 48 hours
- Status update: Within 7 days
- Fix deployment: Depends on severity

## Security Measures

MoodBored implements several security measures:

- **Helmet** for HTTP security headers
- **CORS** restricted to known origins
- **Rate limiting** on API endpoints
- **Atomic file writes** to prevent corruption
- **API keys server-side** (not in client bundle)
- **Input validation** on project imports
- **No arbitrary file writes**

## Known Limitations

- Client-side share role enforcement (not server-enforced)
- Service worker cache (may serve stale content)
- Iframe embedding restricted by X-Frame-Options (by design)

## Supported Versions

| Version | Supported |
|---------|-----------|
| 1.x     | Yes       |
| < 1.0   | No        |
