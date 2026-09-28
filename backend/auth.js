require('dotenv').config({
  path: require('path').join(__dirname, '.env'),
});

const { OAuth2Client } = require('google-auth-library');

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_WORKSPACE_DOMAIN =
  process.env.GOOGLE_WORKSPACE_DOMAIN;

if (!GOOGLE_CLIENT_ID) {
  throw new Error('GOOGLE_CLIENT_ID is not configured.');
}

if (!GOOGLE_WORKSPACE_DOMAIN) {
  throw new Error(
    'GOOGLE_WORKSPACE_DOMAIN is not configured.'
  );
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

  if (payload.hd !== GOOGLE_WORKSPACE_DOMAIN) {
    throw new Error(
      'Only authorized Google Workspace accounts are allowed.'
    );
  }

  if (!payload.sub) {
    throw new Error('Google account subject is missing.');
  }

  return payload;
}

function getFabricIdentityFromGoogleSub(sub) {
  const mappings = [
    ['GOOGLE_SUB_MANUFACTURER1', 'manufacturer1'],
    ['GOOGLE_SUB_CERTIFIER1', 'certifier1'],
    ['GOOGLE_SUB_TRANSPORTER1', 'transporter1'],
    ['GOOGLE_SUB_WAREHOUSE1', 'warehouse1'],
    ['GOOGLE_SUB_ASSEMBLER1', 'assembler1'],
    ['GOOGLE_SUB_AUDITOR1', 'auditor1'],
  ];

  for (const [envName, fabricIdentity] of mappings) {
    const configuredSub = process.env[envName];

    if (configuredSub && configuredSub === sub) {
      return fabricIdentity;
    }
  }

  return null;
}

async function authenticateGoogleToken(idToken) {
  const payload = await verifyGoogleIdToken(idToken);
  const email = (payload.email || '').trim().toLowerCase();
  const adminEmail = (process.env.ADMIN_EMAIL || '').trim().toLowerCase();

  if (adminEmail && email === adminEmail) {
    return {
      sub: payload.sub,
      email: payload.email || null,
      name: payload.name || null,
      picture: payload.picture || null,
      fabricIdentity: null,
      isAdmin: true,
    };
  }

  const fabricIdentity =
    getFabricIdentityFromGoogleSub(payload.sub);

  if (!fabricIdentity) {
    const error = new Error(
      'Google account is authenticated but not provisioned.'
    );

    error.code = 'PROVISIONING_REQUIRED';
    error.sub = payload.sub;
    error.email = payload.email || null;
    error.name = payload.name || null;

    throw error;
  }

  return {
    sub: payload.sub,
    email: payload.email || null,
    name: payload.name || null,
    picture: payload.picture || null,
    fabricIdentity,
    isAdmin: false,
  };
}

module.exports = {
  verifyGoogleIdToken,
  getFabricIdentityFromGoogleSub,
  authenticateGoogleToken,
};