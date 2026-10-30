'use strict';

function createFixedWindowRateLimiter({
  windowMs,
  maxRequests,
  maxKeys = 10000,
  now = Date.now,
} = {}) {
  if (!Number.isFinite(windowMs) || windowMs <= 0) {
    throw new Error('windowMs must be a positive number.');
  }

  if (!Number.isInteger(maxRequests) || maxRequests <= 0) {
    throw new Error('maxRequests must be a positive integer.');
  }

  if (!Number.isInteger(maxKeys) || maxKeys <= 0) {
    throw new Error('maxKeys must be a positive integer.');
  }

  const buckets = new Map();

  function pruneExpired(timestamp) {
    for (const [key, bucket] of buckets) {
      if (bucket.resetAt <= timestamp) {
        buckets.delete(key);
      }
    }
  }

  function consume(key) {
    if (typeof key !== 'string' || !key) {
      throw new Error('A non-empty rate-limit key is required.');
    }

    const timestamp = now();
    let bucket = buckets.get(key);

    if (!bucket || bucket.resetAt <= timestamp) {
      if (buckets.size >= maxKeys) {
        pruneExpired(timestamp);
      }

      if (buckets.size >= maxKeys) {
        return {
          allowed: false,
          remaining: 0,
          retryAfterSeconds: Math.max(1, Math.ceil(windowMs / 1000)),
        };
      }

      bucket = {
        count: 0,
        resetAt: timestamp + windowMs,
      };
      buckets.set(key, bucket);
    }

    if (bucket.count >= maxRequests) {
      return {
        allowed: false,
        remaining: 0,
        retryAfterSeconds: Math.max(
          1,
          Math.ceil((bucket.resetAt - timestamp) / 1000)
        ),
      };
    }

    bucket.count += 1;

    return {
      allowed: true,
      remaining: maxRequests - bucket.count,
      retryAfterSeconds: 0,
    };
  }

  return {
    consume,
    get size() {
      return buckets.size;
    },
  };
}

function getClientAddress(req, trustProxy = false) {
  if (trustProxy) {
    const forwarded = req.headers?.['x-forwarded-for'];
    const firstForwarded = Array.isArray(forwarded)
      ? forwarded[0]
      : String(forwarded || '').split(',')[0];

    if (firstForwarded && firstForwarded.trim()) {
      return firstForwarded.trim();
    }
  }

  return req.socket?.remoteAddress || 'unknown';
}

module.exports = {
  createFixedWindowRateLimiter,
  getClientAddress,
};
