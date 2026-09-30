'use strict';

/**
 * Canonical Component ID format:
 *   BMS-{TYPE_CODE}-{COMPONENT_NUMBER}{DDMMYY}{SERIAL}
 *
 * Example:
 *   BMS-MOTH-01300926001
 *
 * TYPE_CODE        = 4 uppercase letters assigned by the administrator
 * COMPONENT_NUMBER = 2 digits assigned by the administrator
 * DDMMYY           = manufacture date
 * SERIAL           = 3-digit sequence beginning at 001
 */

const COMPONENT_ID_PATTERN = /^BMS-([A-Z]{4})-(\d{2})(\d{6})(\d{3})$/;

function assertDate(dateValue) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateValue)) {
    throw new Error('Manufacture date must use YYYY-MM-DD format.');
  }

  const [year, month, day] = dateValue.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));

  if (
    Number.isNaN(date.getTime()) ||
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    throw new Error('Manufacture date is invalid.');
  }
}

function dateToDDMMYY(dateValue) {
  assertDate(dateValue);

  const [year, month, day] = dateValue.split('-');

  return (
    day.padStart(2, '0') +
    month.padStart(2, '0') +
    year.slice(-2)
  );
}

function buildComponentId({
  typeCode,
  componentNumber,
  manufactureDate,
  serialNumber,
}) {
  const normalizedTypeCode = String(typeCode || '').trim().toUpperCase();
  const normalizedComponentNumber = String(componentNumber || '').trim();
  const normalizedSerial = String(serialNumber || '').trim().padStart(3, '0');

  if (!/^[A-Z]{4}$/.test(normalizedTypeCode)) {
    throw new Error('Component type code must be exactly 4 uppercase letters.');
  }

  if (!/^\d{2}$/.test(normalizedComponentNumber) || normalizedComponentNumber === '00') {
    throw new Error('Component number must be a unique two-digit value from 01 to 99.');
  }

  if (!/^\d{3}$/.test(normalizedSerial) || normalizedSerial === '000') {
    throw new Error('Component serial must be a three-digit value from 001 to 999.');
  }

  const datePart = dateToDDMMYY(manufactureDate);

  return `BMS-${normalizedTypeCode}-${normalizedComponentNumber}${datePart}${normalizedSerial}`;
}

function parseComponentId(componentID) {
  const value = String(componentID || '').trim().toUpperCase();
  const match = value.match(COMPONENT_ID_PATTERN);

  if (!match) {
    return null;
  }

  const [, typeCode, componentNumber, datePart, serial] = match;
  const day = Number(datePart.slice(0, 2));
  const month = Number(datePart.slice(2, 4));
  const year = 2000 + Number(datePart.slice(4, 6));

  const date = new Date(Date.UTC(year, month - 1, day));
  const validDate =
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day;

  return {
    componentID: value,
    typeCode,
    componentNumber,
    datePart,
    serial,
    validDate,
  };
}

function validateComponentIdFormat(componentID) {
  const value = String(componentID || '').trim().toUpperCase();
  const parsed = parseComponentId(value);

  if (!parsed) {
    return {
      valid: false,
      status: 'LEGACY_OR_INVALID',
      message: 'Component ID does not follow the BMS-{TYPE}-{NUMBER}{DDMMYY}{SERIAL} format.',
    };
  }

  if (!parsed.validDate) {
    return {
      valid: false,
      status: 'INVALID_DATE',
      message: 'Component ID contains an invalid manufacture date.',
      parsed,
    };
  }

  return {
    valid: true,
    status: 'VALID',
    message: 'Component ID format is valid.',
    parsed,
  };
}

module.exports = {
  COMPONENT_ID_PATTERN,
  buildComponentId,
  parseComponentId,
  validateComponentIdFormat,
};
