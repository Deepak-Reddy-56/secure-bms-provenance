
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const { getDb, closeMongo } = require('../db/mongo');

const DATA_DIR = path.join(__dirname, '..', 'data');
const APPLY = process.argv.includes('--apply');

const ROLES = [
  'MANUFACTURER',
  'CERTIFIER',
  'TRANSPORTER',
  'WAREHOUSE',
  'ASSEMBLER',
  'AUDITOR',
];


function readJsonIfPresent(filename, fallback) {
  const file = path.join(DATA_DIR, filename);

  if (!fs.existsSync(file)) {
    console.log(`${filename} not present; using an empty seed.`);
    return fallback;
  }

  return readJson(filename);
}


function readJson(filename) {
  const file = path.join(DATA_DIR, filename);

  if (!fs.existsSync(file)) {
    throw new Error(`Missing source file: ${filename}`);
  }

  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function assertUnique(label, values) {
  const filtered = values.filter(
    value => value !== undefined && value !== null && value !== ''
  );

  if (new Set(filtered).size !== filtered.length) {
    throw new Error(`Duplicate values found in ${label}.`);
  }
}

function validateRecords(users, types, locations) {
  for (const user of users) {
    if (
      !user.id ||
      !user.email ||
      !user.fabricIdentity ||
      !ROLES.includes(user.role) ||
      typeof user.active !== 'boolean'
    ) {
      throw new Error('Invalid user record detected.');
    }
  }

  assertUnique('user IDs', users.map(x => x.id));
  assertUnique(
    'user emails',
    users.map(x => String(x.email).trim().toLowerCase())
  );
  assertUnique('user roles', users.map(x => x.role));
  assertUnique(
    'Fabric identities',
    users.map(x => x.fabricIdentity)
  );
  assertUnique(
    'Google subjects',
    users.map(x => x.googleSub)
  );

  for (const type of types) {
    if (
      !type.id ||
      !type.name ||
      !type.code ||
      !type.componentNumber ||
      typeof type.active !== 'boolean'
    ) {
      throw new Error('Invalid component type record detected.');
    }
  }

  assertUnique('component type IDs', types.map(x => x.id));
  assertUnique('component type codes', types.map(x => x.code));
  assertUnique(
    'component numbers',
    types.map(x => x.componentNumber)
  );
  assertUnique(
    'component type names',
    types.map(x => x.name.trim().toLowerCase())
  );

  for (const location of locations) {
    if (
      !location.id ||
      !location.name ||
      !location.code ||
      !/^\d{6}$/.test(String(location.pincode)) ||
      typeof location.active !== 'boolean'
    ) {
      throw new Error('Invalid location record detected.');
    }
  }

  assertUnique('location IDs', locations.map(x => x.id));
  assertUnique('location codes', locations.map(x => x.code));
  assertUnique(
    'location names',
    locations.map(x => x.name.trim().toLowerCase())
  );
}


async function ensureCollectionsAndValidators(db) {
  const roleValues = [
    'MANUFACTURER',
    'CERTIFIER',
    'TRANSPORTER',
    'WAREHOUSE',
    'ASSEMBLER',
    'AUDITOR',
  ];

  const fabricIdentities = [
    'manufacturer1',
    'certifier1',
    'transporter1',
    'warehouse1',
    'assembler1',
    'auditor1',
  ];

  const definitions = {
    users: {
      bsonType: 'object',
      required: [
        'id',
        'email',
        'name',
        'role',
        'fabricIdentity',
        'active',
      ],
      properties: {
        id: { bsonType: 'string', minLength: 1 },
        email: { bsonType: 'string', minLength: 3 },
        name: { bsonType: 'string' },
        role: { enum: roleValues },
        fabricIdentity: { enum: fabricIdentities },
        googleSub: { bsonType: ['string', 'null'] },
        active: { bsonType: 'bool' },
      },
    },

    componentTypes: {
      bsonType: 'object',
      required: [
        'id',
        'name',
        'nameKey',
        'code',
        'componentNumber',
        'active',
        'createdAt',
      ],
      properties: {
        id: { bsonType: 'string', minLength: 1 },
        name: {
          bsonType: 'string',
          minLength: 2,
          maxLength: 80,
        },
        nameKey: { bsonType: 'string', minLength: 2 },
        code: {
          bsonType: 'string',
          pattern: '^[A-Z]{4}$',
        },
        componentNumber: {
          bsonType: 'string',
          pattern: '^(0[1-9]|[1-9][0-9])$',
        },
        active: { bsonType: 'bool' },
        createdAt: { bsonType: 'string' },
      },
    },

    locations: {
      bsonType: 'object',
      required: [
        'id',
        'name',
        'nameKey',
        'code',
        'pincode',
        'active',
        'createdAt',
      ],
      properties: {
        id: { bsonType: 'string', minLength: 1 },
        name: { bsonType: 'string', minLength: 1 },
        nameKey: { bsonType: 'string', minLength: 1 },
        code: {
          bsonType: 'string',
          pattern: '^[A-Z]{2,4}$',
        },
        pincode: {
          bsonType: 'string',
          pattern: '^[0-9]{6}$',
        },
        active: { bsonType: 'bool' },
        createdAt: { bsonType: 'string' },
      },
    },

    sessions: {
      bsonType: 'object',
      required: ['tokenHash', 'data', 'createdAt', 'expiresAt'],
      properties: {
        tokenHash: {
          bsonType: 'string',
          pattern: '^[a-f0-9]{64}$',
        },
        data: { bsonType: 'object' },
        createdAt: { bsonType: 'date' },
        expiresAt: { bsonType: 'date' },
      },
    },
  };

  for (const [name, schema] of Object.entries(definitions)) {
    try {
      await db.createCollection(name, {
        validator: { $jsonSchema: schema },
        validationLevel: 'strict',
        validationAction: 'error',
      });
    } catch (error) {
      // Existing collections need their validators updated.
      if (error.code !== 48 && error.codeName !== 'NamespaceExists') {
        throw error;
      }

      await db.command({
        collMod: name,
        validator: { $jsonSchema: schema },
        validationLevel: 'strict',
        validationAction: 'error',
      });
    }

    console.log(`Schema validator configured: ${name}`);
  }
}


async function ensureIndexes(db) {
  await db.collection('users').createIndexes([
    {
      key: { id: 1 },
      name: 'uniq_user_id',
      unique: true,
    },
    {
      key: { email: 1 },
      name: 'uniq_user_email',
      unique: true,
    },
    {
      key: { role: 1 },
      name: 'uniq_user_role',
      unique: true,
    },
    {
      key: { fabricIdentity: 1 },
      name: 'uniq_fabric_identity',
      unique: true,
    },
    {
      key: { googleSub: 1 },
      name: 'uniq_google_subject',
      unique: true,
      partialFilterExpression: {
        googleSub: { $type: 'string' },
      },
    },
  ]);

  await db.collection('componentTypes').createIndexes([
    {
      key: { id: 1 },
      name: 'uniq_component_type_id',
      unique: true,
    },
    {
      key: { code: 1 },
      name: 'uniq_component_type_code',
      unique: true,
    },
    {
      key: { componentNumber: 1 },
      name: 'uniq_component_number',
      unique: true,
    },
    {
      key: { nameKey: 1 },
      name: 'uniq_component_type_name',
      unique: true,
    },
  ]);

  await db.collection('locations').createIndexes([
    {
      key: { id: 1 },
      name: 'uniq_location_id',
      unique: true,
    },
    {
      key: { code: 1 },
      name: 'uniq_location_code',
      unique: true,
    },
    {
      key: { nameKey: 1 },
      name: 'uniq_location_name',
      unique: true,
    },
  ]);

  await db.collection('sessions').createIndexes([
    {
      key: { tokenHash: 1 },
      name: 'uniq_session_token_hash',
      unique: true,
    },
    {
      key: { expiresAt: 1 },
      name: 'ttl_session_expiry',
      expireAfterSeconds: 0,
    },
  ]);
}

async function importRecords(collection, records) {
  if (records.length === 0) {
    return { inserted: 0, alreadyPresent: 0 };
  }

  const result = await collection.bulkWrite(
    records.map(record => ({
      updateOne: {
        filter: { id: record.id },
        update: {
          $setOnInsert: record,
        },
        upsert: true,
      },
    })),
    { ordered: true }
  );

  return {
    inserted: result.upsertedCount,
    alreadyPresent: result.matchedCount,
  };
}

async function main() {
  const usersFile = path.join(DATA_DIR, 'users.json');
  const userData = fs.existsSync(usersFile)
    ? readJson('users.json')
    : { users: [] };

  if (!fs.existsSync(usersFile)) {
    console.log('No users.json source found; user import will be skipped.');
  }

  if (!userData || !Array.isArray(userData.users)) {
    throw new Error('Invalid users.json structure.');
  }

  const users = userData.users.map(user => ({
    ...user,
    email: String(user.email).trim().toLowerCase(),
  }));

  const types = readJsonIfPresent('componentTypes.json', []).map(type => ({
    ...type,
    code: String(type.code).trim().toUpperCase(),
    nameKey: String(type.name).trim().toLowerCase(),
  }));

  const locations = readJsonIfPresent('locations.json', []).map(location => ({
    ...location,
    code: String(location.code).trim().toUpperCase(),
    nameKey: String(location.name).trim().toLowerCase(),
  }));

  validateRecords(users, types, locations);

  console.log('Source data validation passed.');
  console.log(`Users: ${users.length}`);
  console.log(`Component types: ${types.length}`);
  console.log(`Locations: ${locations.length}`);

  const db = await getDb();

  const names = ['users', 'componentTypes', 'locations', 'sessions'];

  for (const name of names) {
    const count = await db.collection(name).countDocuments();
    console.log(`${name} currently contains ${count} documents.`);
  }

  if (!APPLY) {
    console.log('\nDRY RUN ONLY. No database records were written.');
    console.log('Run with --apply after reviewing the result.');
    return;
  }

  // Configure MongoDB document schemas first.
await ensureCollectionsAndValidators(db);

// Create unique indexes.
await ensureIndexes(db);

  const userResult = await importRecords(
    db.collection('users'),
    users
  );

  const typeResult = await importRecords(
    db.collection('componentTypes'),
    types
  );

  const locationResult = await importRecords(
    db.collection('locations'),
    locations
  );

  console.log('\nMigration completed.');
  console.log('Users:', userResult);
  console.log('Component types:', typeResult);
  console.log('Locations:', locationResult);
}

main()
  .catch(error => {
    console.error('Migration failed:', error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closeMongo();
  });
