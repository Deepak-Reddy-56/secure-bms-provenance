'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DATA_DIR = path.join(__dirname, 'data');
const DATA_FILE = path.join(DATA_DIR, 'componentTypes.json');

function ensureStore() {
  fs.mkdirSync(DATA_DIR, { recursive: true });

  if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, '[]\n', 'utf8');
  }
}

function readStore() {
  ensureStore();

  try {
    const parsed = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    throw new Error(`Component type configuration is unreadable: ${err.message}`);
  }
}

function writeStore(types) {
  ensureStore();
  fs.writeFileSync(
    DATA_FILE,
    `${JSON.stringify(types, null, 2)}\n`,
    'utf8'
  );
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

  if (!/^\d{2}$/.test(number) || number === '00') {
    throw new Error('Component number must be a unique two-digit value from 01 to 99.');
  }

  return number;
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function listComponentTypes({ includeInactive = false } = {}) {
  const types = readStore();

  return clone(
    includeInactive ? types : types.filter(type => type.active)
  );
}

function getComponentType(id) {
  const value = readStore().find(type => type.id === id);
  return value ? clone(value) : null;
}

function findComponentTypeById(id, { includeInactive = false } = {}) {
  const value = readStore().find(type => type.id === id);

  if (!value || (!includeInactive && !value.active)) {
    return null;
  }

  return clone(value);
}

function findComponentTypeByCode(code, { includeInactive = true } = {}) {
  const normalized = String(code || '').trim().toUpperCase();
  const value = readStore().find(type => type.code === normalized);

  if (!value || (!includeInactive && !value.active)) {
    return null;
  }

  return clone(value);
}

function findComponentTypeByName(name, { includeInactive = true } = {}) {
  const normalized = String(name || '').trim().toLowerCase();
  const value = readStore().find(
    type => type.name.trim().toLowerCase() === normalized
  );

  if (!value || (!includeInactive && !value.active)) {
    return null;
  }

  return clone(value);
}

function createComponentType({ name, code, componentNumber }) {
  const normalizedName = normalizeName(name);
  const normalizedCode = normalizeTypeCode(code);
  const normalizedComponentNumber = normalizeComponentNumber(componentNumber);

  const types = readStore();

  if (types.some(type => type.code === normalizedCode)) {
    throw new Error(`Component type code '${normalizedCode}' is already assigned.`);
  }

  if (types.some(type => type.componentNumber === normalizedComponentNumber)) {
    throw new Error(
      `Component number '${normalizedComponentNumber}' is already assigned.`
    );
  }

  if (
    types.some(
      type => type.name.trim().toLowerCase() === normalizedName.toLowerCase()
    )
  ) {
    throw new Error(`Component type '${normalizedName}' already exists.`);
  }

  const componentType = {
    id: crypto.randomUUID(),
    name: normalizedName,
    code: normalizedCode,
    componentNumber: normalizedComponentNumber,
    active: true,
    createdAt: new Date().toISOString(),
  };

  types.push(componentType);
  writeStore(types);

  return clone(componentType);
}

function setComponentTypeStatus(id, active) {
  if (typeof active !== 'boolean') {
    throw new Error('Active status must be boolean.');
  }

  const types = readStore();
  const index = types.findIndex(type => type.id === id);

  if (index === -1) {
    throw new Error('Component type not found.');
  }

  types[index].active = active;
  writeStore(types);

  return clone(types[index]);
}

function resolveComponentType(value) {
  if (!value) {
    return null;
  }

  return (
    findComponentTypeById(String(value), { includeInactive: false }) ||
    findComponentTypeByCode(String(value), { includeInactive: false }) ||
    findComponentTypeByName(String(value), { includeInactive: false })
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
