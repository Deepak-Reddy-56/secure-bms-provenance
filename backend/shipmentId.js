'use strict';

const { parseComponentId } = require('./componentId');

const SHIPMENT_ID_PATTERN =
  /^SHIP-([A-Z]{4})-(\d{2})(\d{6})-([A-Z]{2,4})-([A-Z]{2,4})$/;

function dateToDDMMYY(dateValue) {
  const value = String(dateValue || '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error('Shipment date must use YYYY-MM-DD format.');
  }

  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));

  if (
    Number.isNaN(date.getTime()) ||
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    throw new Error('Shipment date is invalid.');
  }

  return String(day).padStart(2, '0') +
    String(month).padStart(2, '0') +
    String(year).slice(-2);
}

function buildShipmentId({ componentID, shipmentDate, fromCode, toCode }) {
  const parsedComponent = parseComponentId(componentID);

  if (!parsedComponent || !parsedComponent.validDate) {
    throw new Error(
      'Shipment ID generation requires a canonical BMS component ID.'
    );
  }

  const normalizedFrom = String(fromCode || '').trim().toUpperCase();
  const normalizedTo = String(toCode || '').trim().toUpperCase();

  if (!/^[A-Z]{2,4}$/.test(normalizedFrom)) {
    throw new Error('Origin location code must be 2 to 4 uppercase letters.');
  }
  if (!/^[A-Z]{2,4}$/.test(normalizedTo)) {
    throw new Error('Destination location code must be 2 to 4 uppercase letters.');
  }
  if (normalizedFrom === normalizedTo) {
    throw new Error('Origin and destination locations must be different.');
  }

  const datePart = dateToDDMMYY(shipmentDate);

  return 'SHIP-' +
    parsedComponent.typeCode + '-' +
    parsedComponent.componentNumber +
    datePart + '-' +
    normalizedFrom + '-' +
    normalizedTo;
}

function validateShipmentId({ shipmentID, componentID, shipmentDate, fromCode, toCode }) {
  const expected = buildShipmentId({
    componentID,
    shipmentDate,
    fromCode,
    toCode,
  });

  if (String(shipmentID || '').trim().toUpperCase() !== expected) {
    throw new Error('Shipment ID must be system-generated as ' + expected + '.');
  }

  return expected;
}

module.exports = {
  SHIPMENT_ID_PATTERN,
  buildShipmentId,
  validateShipmentId,
};
