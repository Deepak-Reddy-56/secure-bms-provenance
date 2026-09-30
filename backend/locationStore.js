'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const STORE_PATH = path.join(__dirname, 'data', 'locations.json');

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function ensureStore() {
  const dir = path.dirname(STORE_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  if (!fs.existsSync(STORE_PATH)) {
    fs.writeFileSync(STORE_PATH, '[]\\n', 'utf8');
  }
}

function readStore() {
  ensureStore();

  const raw = fs.readFileSync(STORE_PATH, 'utf8').trim();

  if (!raw) {
    return [];
  }

  const normalized = raw.replace(/\\\\n$/, '').trim();

  try {
    const parsed = JSON.parse(normalized);
    if (!Array.isArray(parsed)) {
      throw new Error('Location configuration must be a JSON array.');
    }
    return parsed;
  } catch (err) {
    throw new Error('Location configuration is unreadable: ' + err.message);
  }
}

function writeStore(locations) {
  ensureStore();
  fs.writeFileSync(STORE_PATH, JSON.stringify(locations, null, 2) + '\n', 'utf8');
}

function listLocations({ includeInactive = false } = {}) {
  const locations = readStore();
  return clone(includeInactive ? locations : locations.filter(item => item.active));
}

function getLocation(id, { includeInactive = true } = {}) {
  const location = readStore().find(item => item.id === id);
  if (!location || (!includeInactive && !location.active)) {
    return null;
  }
  return clone(location);
}

function createLocation({ name, code, pincode }) {
  const normalizedName = String(name || '').trim();
  const normalizedCode = String(code || '').trim().toUpperCase();
  const normalizedPincode = String(pincode || '').trim();

  if (!normalizedName) {
    throw new Error('Location name is required.');
  }
  if (!/^[A-Z]{2,4}$/.test(normalizedCode)) {
    throw new Error('Location code must be 2 to 4 uppercase letters.');
  }
  if (!/^\d{6}$/.test(normalizedPincode)) {
    throw new Error('Pincode must be exactly 6 digits.');
  }

  const locations = readStore();
  if (locations.some(item => item.code === normalizedCode)) {
    throw new Error("Location code '" + normalizedCode + "' is already assigned.");
  }
  if (locations.some(item => item.name.trim().toLowerCase() === normalizedName.toLowerCase())) {
    throw new Error("Location '" + normalizedName + "' already exists.");
  }

  const location = {
    id: crypto.randomUUID(),
    name: normalizedName,
    code: normalizedCode,
    pincode: normalizedPincode,
    active: true,
    createdAt: new Date().toISOString(),
  };

  locations.push(location);
  writeStore(locations);
  return clone(location);
}

function setLocationStatus(id, active) {
  if (typeof active !== 'boolean') {
    throw new Error('Active status must be boolean.');
  }

  const locations = readStore();
  const index = locations.findIndex(item => item.id === id);
  if (index === -1) {
    throw new Error("Location '" + id + "' not found.");
  }

  locations[index].active = active;
  writeStore(locations);
  return clone(locations[index]);
}

module.exports = {
  listLocations,
  getLocation,
  createLocation,
  setLocationStatus,
};
