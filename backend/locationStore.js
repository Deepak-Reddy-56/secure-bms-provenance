'use strict';

const crypto = require('node:crypto');
const { getDb } = require('./db/mongo');

function publicRecord(document) {
  if (!document) return null;

  const { _id, nameKey, ...record } = document;
  return record;
}

function normalizeName(value) {
  const name = String(value || '').trim();

  if (!name) {
    throw new Error('Location name is required.');
  }

  return name;
}

function normalizeCode(value) {
  const code = String(value || '').trim().toUpperCase();

  if (!/^[A-Z]{2,4}$/.test(code)) {
    throw new Error('Location code must be 2 to 4 uppercase letters.');
  }

  return code;
}

function normalizePincode(value) {
  const pincode = String(value || '').trim();

  if (!/^\d{6}$/.test(pincode)) {
    throw new Error('Pincode must be exactly 6 digits.');
  }

  return pincode;
}

function translateDuplicateError(error, values) {
  if (error?.code !== 11000) return error;

  const field = Object.keys(error.keyPattern || {})[0];

  if (field === 'code') {
    return new Error(`Location code '${values.code}' is already assigned.`);
  }

  if (field === 'nameKey') {
    return new Error(`Location '${values.name}' already exists.`);
  }

  return new Error('A location with these details already exists.');
}

async function listLocations({ includeInactive = false } = {}) {
  const db = await getDb();
  const filter = includeInactive ? {} : { active: true };

  const documents = await db.collection('locations')
    .find(filter)
    .sort({ createdAt: 1 })
    .toArray();

  return documents.map(publicRecord);
}

async function getLocation(id, { includeInactive = true } = {}) {
  const db = await getDb();
  const filter = { id };

  if (!includeInactive) filter.active = true;

  return publicRecord(
    await db.collection('locations').findOne(filter)
  );
}

async function createLocation({ name, code, pincode }) {
  const normalizedName = normalizeName(name);
  const normalizedCode = normalizeCode(code);
  const normalizedPincode = normalizePincode(pincode);

  const location = {
    id: crypto.randomUUID(),
    name: normalizedName,
    nameKey: normalizedName.toLowerCase(),
    code: normalizedCode,
    pincode: normalizedPincode,
    active: true,
    createdAt: new Date().toISOString(),
  };

  const db = await getDb();

  try {
    await db.collection('locations').insertOne(location);
    return publicRecord(location);
  } catch (error) {
    throw translateDuplicateError(error, {
      name: normalizedName,
      code: normalizedCode,
    });
  }
}

async function setLocationStatus(id, active) {
  if (typeof active !== 'boolean') {
    throw new Error('Active status must be boolean.');
  }

  const db = await getDb();
  const collection = db.collection('locations');

  const result = await collection.updateOne(
    { id },
    { $set: { active } }
  );

  if (result.matchedCount === 0) {
    throw new Error(`Location '${id}' not found.`);
  }

  return publicRecord(await collection.findOne({ id }));
}

module.exports = {
  listLocations,
  getLocation,
  createLocation,
  setLocationStatus,
};
