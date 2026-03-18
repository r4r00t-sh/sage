# Security Configuration Guide

This document outlines the security features implemented in the E-Filing System backend.

## Security Features

### 1. Rate Limiting

Rate limiting is implemented using `@nestjs/throttler` to prevent abuse and DoS attacks.

#### Default Rate Limits
- **Default**: 100 requests per minute (configurable via `RATE_LIMIT_DEFAULT`)
- **Strict** (Auth endpoints): 5 requests per minute
- **Moderate**: 50 requests per minute
- **Lenient**: 200 requests per minute

#### Usage
```typescript
import { StrictThrottle, ModerateThrottle, LenientThrottle } from './security/throttle.decorator';

@StrictThrottle()
@Post('login')
async login() { ... }
```

### 2. Helmet Security Headers

Helmet is configured to set various HTTP security headers:

- **Content Security Policy (CSP)**: Restricts resource loading
- **HSTS**: Forces HTTPS connections
- **XSS Protection**: Enables browser XSS filter
- **No Sniff**: Prevents MIME type sniffing
- **Referrer Policy**: Controls referrer information

### 3. CORS Configuration

Enhanced CORS configuration with:
- Origin validation against allowed origins list
- Credential support for authenticated requests
- Configurable allowed methods and headers
- 24-hour preflight cache

**Environment Variables:**
- `ALLOWED_ORIGINS`: Comma-separated list of allowed origins (default: `http://localhost:3000`)

### 4. Request Size Limits

Request body size is limited to prevent DoS attacks:

**Environment Variables:**
- `MAX_REQUEST_SIZE`: Maximum request body size (default: `10mb`)

### 5. Input Sanitization (Global – A03 Injection)

**SanitizeInterceptor** is registered globally in `SecurityModule` and runs on every request. It sanitizes:
- Query parameters
- Request body parameters (string values only; Buffers left unchanged for file uploads)
- Response data (optional)

Removes:
- Script tags
- JavaScript protocol handlers
- Event handlers (onclick, onerror, etc.)

### 6. File Upload Security

File upload guard validates:
- File size limits (configurable via `MAX_FILE_SIZE`)
- Allowed MIME types (configurable via `ALLOWED_FILE_TYPES`)
- Dangerous file extensions (.exe, .bat, .cmd, etc.)

**Environment Variables:**
- `MAX_FILE_SIZE`: Maximum file size in bytes (default: 10MB)
- `ALLOWED_FILE_TYPES`: Comma-separated list of allowed MIME types

**Default Allowed Types:**
- PDF: `application/pdf`
- Images: `image/jpeg`, `image/png`, `image/jpg`
- Word: `application/msword`, `application/vnd.openxmlformats-officedocument.wordprocessingml.document`
- Excel: `application/vnd.ms-excel`, `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`

### 7. Validation Pipe

Enhanced validation pipe configuration:
- **Whitelist**: Strips properties without decorators
- **Forbid Non-Whitelisted**: Throws error for unknown properties
- **Transform**: Automatically transforms payloads to DTOs
- **Error Messages**: Hidden in production for security

### 8. SSRF Protection (A10)

**SsrfService** (`src/security/ssrf.service.ts`) validates URLs before outbound requests. Use it for any user-supplied URL:
- `validateUrl(url, options?)` – throws if URL is not safe (private IPs, localhost, metadata, disallowed scheme).
- `safeFetch(url, options?)` – validates then fetches.
- Optional `allowedHosts` allowlist; default blocks private/internal addresses.
- Env: `SSRF_ALLOWED_SCHEMES` (default: `https`).

### 9. Dependency Audits (A06, A08)

- Run `npm run audit` and `npm run audit:fix` in backend (and frontend) regularly.
- See repo root `docs/DEPENDENCY_INTEGRITY.md` for using `npm ci` in CI and audit process.

### 10. JWT Authentication

JWT-based authentication with:
- Configurable expiration (default: 7 days)
- Secret key validation
- User active status check
- Role-based access control

**Environment Variables:**
- `JWT_SECRET`: Secret key for JWT signing
- `JWT_EXPIRES_IN`: Token expiration time (default: `7d`)

## Environment Variables

Add these to your `.env` file:

```env
# Security Configuration
RATE_LIMIT_DEFAULT=100
RATE_LIMIT_MAX=100
MAX_REQUEST_SIZE=10mb
MAX_FILE_SIZE=10485760
ALLOWED_FILE_TYPES=application/pdf,image/jpeg,image/png,image/jpg,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet
ALLOWED_ORIGINS=http://localhost:3000,https://yourdomain.com

# JWT Configuration
JWT_SECRET=your-super-secret-jwt-key-change-in-production
JWT_EXPIRES_IN=7d

# Node Environment
NODE_ENV=production
```

## Security Best Practices

1. **Always use HTTPS in production**
2. **Change default JWT_SECRET** to a strong, random value
3. **Configure ALLOWED_ORIGINS** to only include trusted domains
4. **Set appropriate rate limits** based on your application needs
5. **Regularly update dependencies** to patch security vulnerabilities
6. **Monitor rate limit violations** for potential attacks
7. **Use strong passwords** and implement password policies
8. **Enable audit logging** for sensitive operations
9. **Regular security audits** and penetration testing
10. **Keep security headers** up to date

## Testing Security

### Test Rate Limiting
```bash
# Make multiple rapid requests
for i in {1..10}; do curl http://localhost:3001/api/auth/login; done
```

### Test File Upload Security
```bash
# Try uploading a dangerous file type
curl -X POST http://localhost:3001/api/files \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "file=@malicious.exe"
```

### Test CORS
```bash
# Test from unauthorized origin
curl -X GET http://localhost:3001/api/files \
  -H "Origin: http://evil.com"
```

## Monitoring

Monitor these metrics:
- Rate limit violations (429 responses)
- Failed authentication attempts
- File upload rejections
- Input sanitization warnings
- CORS violations

## Incident Response

If a security incident occurs:
1. Review logs for suspicious activity
2. Check rate limit violations
3. Verify file uploads for malicious content
4. Review authentication failures
5. Check for unusual API usage patterns
6. Update security configurations if needed
7. Notify security team and stakeholders

