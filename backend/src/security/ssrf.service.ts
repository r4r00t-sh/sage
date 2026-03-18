import { Injectable, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * SSRF (Server-Side Request Forgery) protection for outbound requests.
 * Use this when fetching user-supplied or untrusted URLs to block access to
 * internal services, cloud metadata, or private networks.
 *
 * OWASP A10:2021 – Server-Side Request Forgery (SSRF)
 */
@Injectable()
export class SsrfService {
  /** Allowed URL schemes (default: https only for user-supplied URLs). */
  private readonly allowedSchemes: Set<string>;

  /** Blocked hostnames (localhost, metadata, internal). */
  private readonly blockedHostnames = new Set([
    'localhost',
    '127.0.0.1',
    '0.0.0.0',
    '::1',
    'metadata.google.internal',
    '169.254.169.254', // AWS/GCP/Azure metadata
    'metadata',
    'internal',
  ]);

  /** Private/internal IP ranges (CIDR-style checks). */
  private readonly privateRanges = [
    { name: '10.0.0.0/8', check: (parts: number[]) => parts[0] === 10 },
    { name: '172.16.0.0/12', check: (parts: number[]) => parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31 },
    { name: '192.168.0.0/16', check: (parts: number[]) => parts[0] === 192 && parts[1] === 168 },
    { name: '127.0.0.0/8', check: (parts: number[]) => parts[0] === 127 },
    { name: '169.254.0.0/16', check: (parts: number[]) => parts[0] === 169 && parts[1] === 254 },
  ];

  constructor(private configService: ConfigService) {
    const schemes = this.configService.get<string>('SSRF_ALLOWED_SCHEMES', 'https');
    this.allowedSchemes = new Set(schemes.split(',').map((s) => s.trim().toLowerCase()));
  }

  /**
   * Validates a URL for SSRF-safe outbound requests.
   * - Only allows configured schemes (default: https).
   * - Blocks localhost, metadata, and private IPs.
   * @param urlString User-supplied or untrusted URL
   * @param options.allowHttp Allow http in addition to https (default false)
   * @param options.allowedHosts If set, only these hosts are allowed (allowlist)
   * @throws BadRequestException if URL is not safe
   * @returns Parsed URL (use for fetch/axios)
   */
  validateUrl(
    urlString: string,
    options?: { allowHttp?: boolean; allowedHosts?: string[] },
  ): URL {
    if (!urlString || typeof urlString !== 'string') {
      throw new BadRequestException('Invalid or missing URL');
    }

    let parsed: URL;
    try {
      parsed = new URL(urlString.trim());
    } catch {
      throw new BadRequestException('Invalid URL format');
    }

    const scheme = parsed.protocol.replace(':', '').toLowerCase();
    const allowedSchemes = new Set(this.allowedSchemes);
    if (options?.allowHttp) {
      allowedSchemes.add('http');
    }
    if (!allowedSchemes.has(scheme)) {
      throw new BadRequestException(
        `URL scheme "${scheme}" is not allowed. Allowed: ${[...allowedSchemes].join(', ')}`,
      );
    }

    const hostname = parsed.hostname.toLowerCase();

    if (options?.allowedHosts?.length) {
      const allowlist = options.allowedHosts.map((h) => h.toLowerCase());
      if (!allowlist.includes(hostname)) {
        throw new BadRequestException(
          `URL host "${hostname}" is not in the allowlist`,
        );
      }
    } else {
      if (this.blockedHostnames.has(hostname)) {
        throw new BadRequestException(
          `URL host "${hostname}" is not allowed for security reasons`,
        );
      }

      const isPrivate = this.isPrivateOrResolved(hostname);
      if (isPrivate) {
        throw new BadRequestException(
          `URL host "${hostname}" is a private or internal address`,
        );
      }
    }

    return parsed;
  }

  /**
   * Resolves hostname to IP and checks if it is private/internal.
   * Use in async context (e.g. before fetch).
   */
  private isPrivateOrResolved(hostname: string): boolean {
    // Check by hostname first
    if (this.blockedHostnames.has(hostname)) {
      return true;
    }

    // Check IPv4
    const ipv4Match = hostname.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
    if (ipv4Match) {
      const parts = ipv4Match.slice(1, 5).map(Number);
      if (parts.some((p) => p < 0 || p > 255)) return true;
      if (this.privateRanges.some((r) => r.check(parts))) return true;
    }

    // IPv6 loopback
    if (hostname === '::1' || hostname.startsWith('0:0:0:0:0:0:0:1')) {
      return true;
    }

    return false;
  }

  /**
   * Safe fetch: validates URL then fetches. Use for any user-supplied URL.
   * Example: await this.ssrfService.safeFetch(userProvidedUrl, { allowedHosts: ['api.example.com'] });
   */
  async safeFetch(
    urlString: string,
    options?: { allowHttp?: boolean; allowedHosts?: string[]; fetchOptions?: RequestInit },
  ): Promise<Response> {
    const url = this.validateUrl(urlString, options);
    return fetch(url.toString(), options?.fetchOptions ?? {});
  }
}
