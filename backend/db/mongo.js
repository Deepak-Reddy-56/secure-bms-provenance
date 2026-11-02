
'use strict';

const path = require('node:path');

require('dotenv').config({
  path: path.join(__dirname, '..', '.env'),
});

const { MongoClient } = require('mongodb');

let clientPromise;

async function getClient() {
  if (!process.env.MONGODB_URI) {
    throw new Error('MONGODB_URI is not configured.');
  }

  if (!clientPromise) {
    const client = new MongoClient(process.env.MONGODB_URI, {
      appName: 'BMS-Provenance',
      maxPoolSize: 20,
      minPoolSize: 0,
      serverSelectionTimeoutMS: 10000,
    });

    clientPromise = client.connect().catch((error) => {
      clientPromise = null;
      throw error;
    });
  }

  return clientPromise;
}

async function getDb() {
  const client = await getClient();

  return client.db(
    process.env.MONGODB_DB || 'bms_provenance_dev'
  );
}

async function closeMongo() {
  if (!clientPromise) return;

  const promise = clientPromise;
  clientPromise = null;

  const client = await promise;
  await client.close();
}

module.exports = {
  getDb,
  closeMongo,
};
