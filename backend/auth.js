require('dotenv').config({
  path: require('path').join(__dirname, '.env'),
});

const { OAuth2Client } = require('google-auth-library');

const {
  findUserByEmail,
  listUsers,
  updateGoogleSub,
} = require('./userStore');

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || '').trim().toLowerCase();

if (!GOOGLE_CLIENT_ID) {
  throw new Error('GOOGLE_CLIENT_ID is not configured.');
}

if (!ADMIN_EMAIL) {
  throw new Error('ADMIN_EMAIL is not configured.');
}

const googleClient = new OAuth2Client(GOOGLE_CLIENT_ID);

async function verifyGoogleIdToken(idToken) {
  if (!idToken) {
    throw new Error('Google ID token is required.');
  }

  const ticket = await googleClient.verifyIdToken({
    idToken,
    audience: GOOGLE_CLIENT_ID,
  });

  const payload = ticket.getPayload();

  if (!payload) {
    throw new Error('Google token payload is missing.');
  }

  if (!payload.sub) {
    throw new Error('Google account subject is missing.');
  }

  if (!payload.email) {
    throw new Error('Google account email is missing.');
  }

  if (payload.email_verified !== true) {
    throw new Error('Google account email is not verified.');
  }

  return payload;
}

function createProvisioningError(message, payload) {
  const error = new Error(message);

  error.code = 'PROVISIONING_REQUIRED';
  error.sub = payload.sub;
  error.email = payload.email;
  error.name = payload.name || null;

  return error;
}

async function authenticateGoogleToken(idToken) {
  const payload = await verifyGoogleIdToken(idToken);
  const email = payload.email.trim().toLowerCase();

  if (email === ADMIN_EMAIL) {
    return {
      sub: payload.sub,
      email: payload.email,
      name: payload.name || null,
      picture: payload.picture || null,
      fabricIdentity: null,
      role: null,
      isAdmin: true,
    };
  }

  const user = findUserByEmail(email);

  if (!user || !user.active) {
    throw createProvisioningError(
      user
        ? 'This account is disabled.'
        : 'Google account is not provisioned.',
      payload
    );
  }

  const linkedUser = listUsers().find(
    candidate => candidate.googleSub === payload.sub
  );

  if (linkedUser && linkedUser.id !== user.id) {
    throw createProvisioningError(
      'This Google account is already linked to another user.',
      payload
    );
  }

  if (user.googleSub && user.googleSub !== payload.sub) {
    throw createProvisioningError(
      'This user account is linked to a different Google account.',
      payload
    );
  }

  if (!user.googleSub) {
    updateGoogleSub(user.id, payload.sub);
  }

  return {
    sub: payload.sub,
    email: user.email,
    name: user.name || payload.name || null,
    picture: payload.picture || null,
    fabricIdentity: user.fabricIdentity,
    role: user.role,
    isAdmin: false,
    userId: user.id,
  };
}

module.exports = {
  verifyGoogleIdToken,
  authenticateGoogleToken,
};
