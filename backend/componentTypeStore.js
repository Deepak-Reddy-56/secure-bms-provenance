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

  if (name.length < 2 || name.length > 80) {
    throw new Error('Component type name must be between 2 and 80 characters.');
  }

  return name;
}

function normalizeTypeCode(value) {
  const code = String(value || '').trim().toUpperCase();

  if (!/^[A-Z]{4}$/.test(code)) {
    throw new Error('Component type code must be exactly 4 uppercase letters.');
  }

  return code;
}

function normalizeComponentNumber(value) {
  const number = String(value || '').trim();

  if (!/^\\d{2}$/.test(number) || number === '00') {
    throw new Error('Component number must be a unique two-digit value from 01 to 99.');
  }

  return number;
}

function translateDuplicateError(error, values) {
  if (error?.code !== 11000) return error;

  const field = Object.keys(error.keyPattern || {})[0];

  if (field === 'code') {
    return new Error(`Component type code '${values.code}' is already assigned.`);
  }

  if (field === 'componentNumber') {
    return new Error(`Component number '${values.componentNumber}' is already assigned.`);
  }

  if (field === 'nameKey') {
    return new Error(`Component type '${values.name}' already exists.`);
  }

  return new Error('A component type with these details already exists.');
}

async function listComponentTypes({ includeInactive = false } = {}) {
  const db = await getDb();
  const filter = includeInactive ? {} : { active: true };

  const documents = await db.collection('componentTypes')
    .find(filter)
    .sort({ createdAt: 1 })
    .toArray();

  return documents.map(publicRecord);
}

async function getComponentType(id) {
  const db = await getDb();

  return publicRecord(
    await db.collection('componentTypes').findOne({ id })
  );
}

async function findComponentTypeById(
  id,
  { includeInactive = false } = {}
) {
  const db = await getDb();
  const filter = { id };

  if (!includeInactive) filter.active = true;

  return publicRecord(
    await db.collection('componentTypes').findOne(filter)
  );
}

async function findComponentTypeByCode(
  code,
  { includeInactive = true } = {}
) {
  const normalized = String(code || '').trim().toUpperCase();
  const filter = { code: normalized };

  if (!includeInactive) filter.active = true;

  const db = await getDb();

  return publicRecord(
    await db.collection('componentTypes').findOne(filter)
  );
}

async function findComponentTypeByName(
  name,
  { includeInactive = true } = {}
) {
  const normalized = String(name || '').trim().toLowerCase();
  const filter = { nameKey: normalized };

  if (!includeInactive) filter.active = true;

  const db = await getDb();

  return publicRecord(
    await db.collection('componentTypes').findOne(filter)
  );
}

async function createComponentType({ name, code, componentNumber }) {
  const normalizedName = normalizeName(name);
  const normalizedCode = normalizeTypeCode(code);
  const normalizedComponentNumber = normalizeComponentNumber(componentNumber);

  const componentType = {
    id: crypto.randomUUID(),
    name: normalizedName,
    nameKey: normalizedName.toLowerCase(),
    code: normalizedCode,
    componentNumber: normalizedComponentNumber,
    active: true,
    createdAt: new Date().toISOString(),
  };

  const db = await getDb();

  try {
    await db.collection('componentTypes').insertOne(componentType);
    return publicRecord(componentType);
  } catch (error) {
    throw translateDuplicateError(error, {
      name: normalizedName,
      code: normalizedCode,
      componentNumber: normalizedComponentNumber,
    });
  }
}

async function setComponentTypeStatus(id, active) {
  if (typeof active !== 'boolean') {
    throw new Error('Active status must be boolean.');
  }

  const db = await getDb();
  const collection = db.collection('componentTypes');

  const result = await collection.updateOne(
    { id },
    { $set: { active } }
  );

  if (result.matchedCount === 0) {
    throw new Error('Component type not found.');
  }

  return publicRecord(await collection.findOne({ id }));
}

async function resolveComponentType(value) {
  if (!value) return null;

  return (
    await findComponentTypeById(String(value), {
      includeInactive: false,
    }) ||
    await findComponentTypeByCode(String(value), {
      includeInactive: false,
    }) ||
    await findComponentTypeByName(String(value), {
      includeInactive: false,
    })
  );
}

module.exports = {
  listComponentTypes,
  getComponentType,
  findComponentTypeById,
  findComponentTypeByCode,
  findComponentTypeByName,
  createComponentType,
  setComponentTypeStatus,
  resolveComponentType,
};
