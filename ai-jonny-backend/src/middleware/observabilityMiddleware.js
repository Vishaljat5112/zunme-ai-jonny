import crypto from 'crypto';

/**
 * Kiaan AI Observability & Performance Telemetry Middleware
 * Generates unique Request and Correlation IDs, tracks endpoint latency,
 * and outputs structured, zero-leakage diagnostic metrics.
 */
export function observabilityMiddleware(req, res, next) {
  const requestId = req.headers['x-request-id'] || `req_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`;
  const correlationId = req.headers['x-correlation-id'] || req.headers['x-trace-id'] || requestId;

  req.requestId = requestId;
  req.correlationId = correlationId;

  res.setHeader('X-Request-Id', requestId);
  res.setHeader('X-Correlation-Id', correlationId);

  const start = performance.now();

  res.on('finish', () => {
    const durationMs = Number((performance.now() - start).toFixed(2));
    const softwareId = req.headers['x-software-id'] || req.softwareIdentity?.softwareId || null;
    const tenantId = req.softwareIdentity?.tenantId || req.headers['x-tenant-id'] || null;
    const userId = req.softwareIdentity?.userId || req.user?.id || null;

    // Structured observability record (zero secret leakage)
    const logEntry = {
      requestId,
      correlationId,
      timestamp: new Date().toISOString(),
      method: req.method,
      path: req.originalUrl || req.url,
      statusCode: res.statusCode,
      durationMs,
      softwareId,
      tenantId,
      userId
    };

    // Low-overhead logging
    if (process.env.NODE_ENV !== 'test') {
      if (res.statusCode >= 400) {
        console.warn(`[Observability] [${requestId}] ${req.method} ${req.originalUrl} ${res.statusCode} - ${durationMs}ms`);
      } else if (durationMs > 1000) {
        console.log(`[Latency Alert] [${requestId}] ${req.method} ${req.originalUrl} took ${durationMs}ms`);
      }
    }
  });

  next();
}

/**
 * Sanitizes object by masking sensitive credential keys before logging or reporting.
 */
export function maskSensitive(data) {
  if (!data || typeof data !== 'object') return data;
  const sensitiveKeys = ['password', 'secret', 'token', 'authorization', 'api_key', 'apikey', 'key', 'connector_key'];

  if (Array.isArray(data)) {
    return data.map((item) => maskSensitive(item));
  }

  const masked = {};
  for (const [k, v] of Object.entries(data)) {
    const lowerKey = k.toLowerCase();
    const isSensitive = sensitiveKeys.some((s) => lowerKey.includes(s));
    if (isSensitive && typeof v === 'string') {
      masked[k] = v.length > 8 ? `${v.slice(0, 4)}••••${v.slice(-4)}` : '••••••••';
    } else if (typeof v === 'object' && v !== null) {
      masked[k] = maskSensitive(v);
    } else {
      masked[k] = v;
    }
  }
  return masked;
}

