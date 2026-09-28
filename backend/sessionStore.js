const crypto = require('crypto');

const SESSION_TTL_MS = 8 * 60 * 60 * 1000;

const sessions = new Map();

function createSession(user) {
  const token = crypto.randomBytes(32).toString('hex');

  sessions.set(token, {
    ...user,
    createdAt: Date.now(),
    expiresAt: Date.now() + SESSION_TTL_MS,
  });

  return token;
}

function getSession(token) {
  if (!token) {
    return null;
  }

  const session = sessions.get(token);

  if (!session) {
    return null;
  }

  if (Date.now() > session.expiresAt) {
    sessions.delete(token);
    return null;
  }

  return session;
}

function updateSession(token, user) {
  const session = getSession(token);

  if (!session) {
    return null;
  }

  const updatedSession = {
    ...session,
    ...user,
  };

  sessions.set(token, updatedSession);

  return updatedSession;
}

function deleteSession(token) {
  if (token) {
    sessions.delete(token);
  }
}

function cleanupExpiredSessions() {
  const now = Date.now();

  for (const [token, session] of sessions.entries()) {
    if (now > session.expiresAt) {
      sessions.delete(token);
    }
  }
}

const cleanupTimer = setInterval(cleanupExpiredSessions, 15 * 60 * 1000);
cleanupTimer.unref();

module.exports = {
  createSession,
  getSession,
  updateSession,
  deleteSession,
};
