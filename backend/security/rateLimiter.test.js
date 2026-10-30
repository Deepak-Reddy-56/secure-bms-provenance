'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  createFixedWindowRateLimiter,
  getClientAddress,
} = require('./rateLimiter');

test('allows requests up to the configured limit', () => {
  const limiter = createFixedWindowRateLimiter({
    windowMs: 60_000,
    maxRequests: 2,
  });

  assert.equal(limiter.consume('client-a').allowed, true);
  assert.equal(limiter.consume('client-a').allowed, true);

  const blocked = limiter.consume('client-a');
  assert.equal(blocked.allowed, false);
  assert.equal(blocked.remaining, 0);
  assert.equal(blocked.retryAfterSeconds, 60);
});

test('resets a client bucket after the fixed window', () => {
  let timestamp = 1_000;
  const limiter = createFixedWindowRateLimiter({
    windowMs: 1_000,
    maxRequests: 1,
    now: () => timestamp,
  });

  assert.equal(limiter.consume('client-a').allowed, true);
  assert.equal(limiter.consume('client-a').allowed, false);

  timestamp += 1_001;

  assert.equal(limiter.consume('client-a').allowed, true);
});

test('keeps limits isolated between client keys', () => {
  const limiter = createFixedWindowRateLimiter({
    windowMs: 60_000,
    maxRequests: 1,
  });

  assert.equal(limiter.consume('client-a').allowed, true);
  assert.equal(limiter.consume('client-b').allowed, true);
  assert.equal(limiter.consume('client-a').allowed, false);
});

test('caps stored client buckets and fails closed when full', () => {
  let timestamp = 1_000;
  const limiter = createFixedWindowRateLimiter({
    windowMs: 10_000,
    maxRequests: 2,
    maxKeys: 1,
    now: () => timestamp,
  });

  assert.equal(limiter.consume('client-a').allowed, true);
  assert.equal(limiter.consume('client-b').allowed, false);
  assert.equal(limiter.size, 1);

  timestamp += 10_001;

  assert.equal(limiter.consume('client-b').allowed, true);
  assert.equal(limiter.size, 1);
});

test('uses the socket address unless proxy trust is enabled', () => {
  const req = {
    socket: { remoteAddress: '127.0.0.1' },
    headers: { 'x-forwarded-for': '203.0.113.5, 127.0.0.1' },
  };

  assert.equal(getClientAddress(req), '127.0.0.1');
  assert.equal(getClientAddress(req, true), '203.0.113.5');
});
