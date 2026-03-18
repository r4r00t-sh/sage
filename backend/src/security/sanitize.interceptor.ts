import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  StreamableFile,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { SecurityService } from './security.service';

@Injectable()
export class SanitizeInterceptor implements NestInterceptor {
  constructor(private securityService: SecurityService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();

    // Sanitize query parameters
    if (request.query) {
      Object.keys(request.query).forEach((key) => {
        if (typeof request.query[key] === 'string') {
          request.query[key] = this.securityService.sanitizeInput(
            request.query[key],
          );
        }
      });
    }

    // Sanitize body parameters
    if (request.body && typeof request.body === 'object') {
      this.sanitizeObject(request.body);
    }

    return next.handle().pipe(
      map((data) => {
        // Do not sanitize file/binary responses – would corrupt PDF/downloads
        if (Buffer.isBuffer(data) || data instanceof StreamableFile) {
          return data;
        }
        // Sanitize response data if needed
        if (data && typeof data === 'object') {
          return this.sanitizeResponse(data);
        }
        return data;
      }),
    );
  }

  private sanitizeObject(obj: any): void {
    if (typeof obj !== 'object' || obj === null) {
      return;
    }
    // Skip Buffer/Uint8Array (e.g. file upload bodies) – do not mutate binary data
    if (Buffer.isBuffer(obj) || obj instanceof Uint8Array) {
      return;
    }

    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        const val = obj[key];
        if (typeof val === 'string') {
          obj[key] = this.securityService.sanitizeInput(val);
        } else if (typeof val === 'object' && val !== null && !Buffer.isBuffer(val) && !(val instanceof Uint8Array)) {
          this.sanitizeObject(val);
        }
      }
    }
  }

  private sanitizeResponse(data: any): any {
    // Only sanitize string fields in response, avoid modifying complex objects
    if (typeof data === 'string') {
      return this.securityService.sanitizeInput(data);
    }
    if (Array.isArray(data)) {
      return data.map((item) => this.sanitizeResponse(item));
    }
    if (data && typeof data === 'object') {
      const sanitized = { ...data };
      for (const key in sanitized) {
        if (typeof sanitized[key] === 'string') {
          sanitized[key] = this.securityService.sanitizeInput(sanitized[key]);
        }
      }
      return sanitized;
    }
    return data;
  }
}
