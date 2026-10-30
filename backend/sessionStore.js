'use strict';

const crypto = require('node:crypto');
const { getDb } = require('./db/mongo');

const SESSION_TTL_MS = 8 * 60 * 60 * 1000;
const SESSION_TOKEN_PATTERN = /^[a-f0-9]{64}$/i;

let indexesPromise;

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function isValidToken(token) {
  return typeof token === 'string' && SESSION_TOKEN_PATTERN.test(token);
}

async function getSessionCollection() {
  const db = await getDb();
  const collection = db.collection('sessions');

  if (!indexesPromise) {
    indexesPromise = Promise.all([
      collection.createIndex(
        { tokenHash: 1 },
        { unique: true, name: 'uniq_session_token_hash' }
      ),
      collection.createIndex(
        { expiresAt: 1 },
        { expireAfterSeconds: 0, name: 'ttl_session_expiry' }
      ),
    ]).catch(error => {
      indexesPromise = null;
      throw error;
    });
  }

  await indexesPromise;
  return collection;
}

function toPublicSession(document) {
  if (!document) return null;

  return {
    ...document.data,
    createdAt: document.createdAt.getTime(),
    expiresAt: document.expiresAt.getTime(),
  };
}

async function createSession(user) {
  if (!user || typeof user !== 'object' || Array.isArray(user)) {
    throw new Error('A valid session user payload is required.');
  }

  const token = crypto.randomBytes(32).toString('hex');
  const now = Date.now();

  const document = {
    tokenHash: hashToken(token),
    data: user,
    createdAt: new Date(now),
    expiresAt: new Date(now + SESSION_TTL_MS),
  };

  const collection = await getSessionCollection();
  await collection.insertOne(document);

  return token;
}

async function getSession(token) {
  if (!isValidToken(token)) {
    return null;
  }

  const collection = await getSessionCollection();
  const now = new Date();

  const document = await collection.findOne({
    tokenHash: hashToken(token),
    expiresAt: { $gt: now },
  });

  return toPublicSession(document);
}

async function updateSession(token, user) {
  if (!isValidToken(token)) {
    return null;
  }

  if (!user || typeof user !== 'object' || Array.isArray(user)) {
    throw new Error('A valid session update payload is required.');
  }

  const collection = await getSessionCollection();
  const tokenHash = hashToken(token);
  const now = new Date();

  const current = await collection.findOne({
    tokenHash,
    expiresAt: { $gt: now },
  });

  if (!current) {
    return null;
  }

  const updatedData = {
    ...current.data,
    ...user,
  };

  const result = await collection.updateOne(
    {
      tokenHash,
      expiresAt: { $gt: now },
    },
    {
      $set: { data: updatedData },
    }
  );

  if (result.matchedCount === 0) {
    return null;
  }

  return toPublicSession({
    ...current,
    data: updatedData,
  });
}

async function deleteSession(token) {
  if (!isValidToken(token)) {
    return;
  }

  const collection = await getSessionCollection();

  await collection.deleteOne({
    tokenHash: hashToken(token),
  });
}

module.exports = {
  createSession,
  getSession,
  updateSession,
  deleteSession,
};
