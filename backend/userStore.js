const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DATA_DIR = path.join(__dirname, 'data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');

const VALID_ROLES = [
  'MANUFACTURER',
  'CERTIFIER',
  'TRANSPORTER',
  'WAREHOUSE',
  'ASSEMBLER',
  'AUDITOR',
];

const ROLE_TO_FABRIC_IDENTITY = {
  MANUFACTURER: 'manufacturer1',
  CERTIFIER: 'certifier1',
  TRANSPORTER: 'transporter1',
  WAREHOUSE: 'warehouse1',
  ASSEMBLER: 'assembler1',
  AUDITOR: 'auditor1',
};

function ensureStore() {
  fs.mkdirSync(DATA_DIR, { recursive: true });

  if (!fs.existsSync(USERS_FILE)) {
    writeStore({ users: [] });
  }
}

function readStore() {
  ensureStore();

  try {
    const raw = fs.readFileSync(USERS_FILE, 'utf8');
    const data = JSON.parse(raw);

    if (!data || !Array.isArray(data.users)) {
      throw new Error('Invalid users.json structure.');
    }

    return data;
  } catch (err) {
    throw new Error(`Unable to read user store: ${err.message}`);
  }
}

function writeStore(data) {
  const tempFile = `${USERS_FILE}.${process.pid}.tmp`;

  fs.writeFileSync(
    tempFile,
    JSON.stringify(data, null, 2) + '\n',
    'utf8'
  );

  fs.renameSync(tempFile, USERS_FILE);
}

function normalizeEmail(email) {
  if (typeof email !== 'string') {
    return '';
  }

  return email.trim().toLowerCase();
}

function validateRole(role) {
  if (!VALID_ROLES.includes(role)) {
    throw new Error(
      `Invalid role. Allowed roles: ${VALID_ROLES.join(', ')}`
    );
  }
}

function addUser({ email, name = '', role }) {
  const normalizedEmail = normalizeEmail(email);

  if (!normalizedEmail) {
    throw new Error('Email is required.');
  }

  validateRole(role);

  const store = readStore();

  const existing = store.users.find(
    user => user.email === normalizedEmail
  );

  if (existing) {
    throw new Error('User with this email already exists.');
  }

  const user = {
    id: crypto.randomUUID(),
    email: normalizedEmail,
    name: String(name).trim(),
    role,
    fabricIdentity: ROLE_TO_FABRIC_IDENTITY[role],
    googleSub: null,
    active: true,
  };

  store.users.push(user);
  writeStore(store);

  return user;
}

function listUsers() {
  return readStore().users;
}

function findUserById(id) {
  if (!id) {
    return null;
  }

  return readStore().users.find(user => user.id === id) || null;
}

function findUserByEmail(email) {
  const normalizedEmail = normalizeEmail(email);

  if (!normalizedEmail) {
    return null;
  }

  return (
    readStore().users.find(
      user => user.email === normalizedEmail
    ) || null
  );
}

function updateUserRole(id, role) {
  validateRole(role);

  const store = readStore();

  const user = store.users.find(user => user.id === id);

  if (!user) {
    throw new Error('User not found.');
  }

  user.role = role;
  user.fabricIdentity = ROLE_TO_FABRIC_IDENTITY[role];

  writeStore(store);

  return user;
}

function setUserActive(id, active) {
  if (typeof active !== 'boolean') {
    throw new Error('Active status must be boolean.');
  }

  const store = readStore();

  const user = store.users.find(user => user.id === id);

  if (!user) {
    throw new Error('User not found.');
  }

  user.active = active;

  writeStore(store);

  return user;
}

function updateGoogleSub(id, googleSub) {
  if (!googleSub || typeof googleSub !== 'string') {
    throw new Error('Google subject is required.');
  }

  const store = readStore();

  const user = store.users.find(user => user.id === id);

  if (!user) {
    throw new Error('User not found.');
  }

  user.googleSub = googleSub;

  writeStore(store);

  return user;
}

function removeUser(id) {
  const store = readStore();

  const index = store.users.findIndex(
    user => user.id === id
  );

  if (index === -1) {
    throw new Error('User not found.');
  }

  const [removedUser] = store.users.splice(index, 1);

  writeStore(store);

  return removedUser;
}

module.exports = {
  VALID_ROLES,
  ROLE_TO_FABRIC_IDENTITY,
  addUser,
  listUsers,
  findUserById,
  findUserByEmail,
  updateUserRole,
  setUserActive,
  updateGoogleSub,
  removeUser,
};