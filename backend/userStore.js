'use strict';

const crypto = require('node:crypto');
const { getDb } = require('./db/mongo');

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

function publicUser(document) {
  if (!document) return null;

  const { _id, ...user } = document;
  return user;
}

function normalizeEmail(email) {
  return typeof email === 'string'
    ? email.trim().toLowerCase()
    : '';
}

function validateRole(role) {
  if (!VALID_ROLES.includes(role)) {
    throw new Error(
      `Invalid role. Allowed roles: ${VALID_ROLES.join(', ')}`
    );
  }
}

function translateDuplicateError(error) {
  if (error?.code !== 11000) return error;

  const field = Object.keys(error.keyPattern || {})[0];

  if (field === 'email') {
    return new Error('User with this email already exists.');
  }

  if (field === 'role' || field === 'fabricIdentity') {
    return new Error('Role is already assigned to another user.');
  }

  if (field === 'googleSub') {
    return new Error('This Google account is already linked to another user.');
  }

  return new Error('A user with these details already exists.');
}

async function ensureRoleAvailable(collection, role, ignoredUserId = null) {
  const filter = { role };

  if (ignoredUserId) {
    filter.id = { $ne: ignoredUserId };
  }

  const assignedUser = await collection.findOne(filter);

  if (assignedUser) {
    throw new Error('Role is already assigned to another user.');
  }
}

async function addUser({ email, name = '', role }) {
  const normalizedEmail = normalizeEmail(email);

  if (!normalizedEmail) {
    throw new Error('Email is required.');
  }

  validateRole(role);

  const user = {
    id: crypto.randomUUID(),
    email: normalizedEmail,
    name: String(name || '').trim(),
    role,
    fabricIdentity: ROLE_TO_FABRIC_IDENTITY[role],
    googleSub: null,
    active: true,
  };

  const db = await getDb();
  const collection = db.collection('users');

  try {
    await ensureRoleAvailable(collection, role);

    const existing = await collection.findOne({
      email: normalizedEmail,
    });

    if (existing) {
      throw new Error('User with this email already exists.');
    }

    await collection.insertOne(user);
    return publicUser(user);
  } catch (error) {
    throw translateDuplicateError(error);
  }
}

async function listUsers() {
  const db = await getDb();

  const users = await db.collection('users')
    .find({})
    .toArray();

  return users.map(publicUser);
}

async function findUserById(id) {
  if (!id) return null;

  const db = await getDb();

  return publicUser(
    await db.collection('users').findOne({ id })
  );
}

async function findUserByEmail(email) {
  const normalizedEmail = normalizeEmail(email);

  if (!normalizedEmail) return null;

  const db = await getDb();

  return publicUser(
    await db.collection('users').findOne({
      email: normalizedEmail,
    })
  );
}

async function updateUserRole(id, role) {
  validateRole(role);

  const db = await getDb();
  const collection = db.collection('users');

  try {
    const existing = await collection.findOne({ id });

    if (!existing) {
      throw new Error('User not found.');
    }

    await ensureRoleAvailable(collection, role, id);

    await collection.updateOne(
      { id },
      {
        $set: {
          role,
          fabricIdentity: ROLE_TO_FABRIC_IDENTITY[role],
        },
      }
    );

    return publicUser(await collection.findOne({ id }));
  } catch (error) {
    throw translateDuplicateError(error);
  }
}

async function setUserActive(id, active) {
  if (typeof active !== 'boolean') {
    throw new Error('Active status must be boolean.');
  }

  const db = await getDb();
  const collection = db.collection('users');

  const result = await collection.updateOne(
    { id },
    { $set: { active } }
  );

  if (result.matchedCount === 0) {
    throw new Error('User not found.');
  }

  return publicUser(await collection.findOne({ id }));
}

async function updateGoogleSub(id, googleSub) {
  if (!googleSub || typeof googleSub !== 'string') {
    throw new Error('Google subject is required.');
  }

  const db = await getDb();
  const collection = db.collection('users');

  try {
    const result = await collection.updateOne(
      { id },
      { $set: { googleSub } }
    );

    if (result.matchedCount === 0) {
      throw new Error('User not found.');
    }

    return publicUser(await collection.findOne({ id }));
  } catch (error) {
    throw translateDuplicateError(error);
  }
}

async function removeUser(id) {
  const db = await getDb();
  const collection = db.collection('users');

  const user = await collection.findOne({ id });

  if (!user) {
    throw new Error('User not found.');
  }

  await collection.deleteOne({ id });

  return publicUser(user);
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
