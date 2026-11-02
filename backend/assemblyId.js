'use strict';

const { parseComponentId } = require('./componentId');

/**
 * Canonical Assembly ID format mirrors the component identifier structure:
 *   ASSY-{TYPE_CODE}-{COMPONENT_NUMBER}{DDMMYY}{SERIAL}
 *
 * Example:
 *   Component: BMS-MOTH-01300926001
 *   Assembly:  ASSY-MOTH-01300926001
 *
 * The assembly identifier is derived exclusively from the component ID.
 * It is never user-entered.
 */
const ASSEMBLY_ID_PATTERN = /^ASSY-([A-Z]{4})-(\d{2})(\d{6})(\d{3})$/;

function buildAssemblyId(componentID) {
  const parsed = parseComponentId(componentID);

  if (
    !parsed ||
    !parsed.validDate ||
    parsed.componentNumber === '00' ||
    parsed.serial === '000'
  ) {
    throw new Error(
      'Assembly ID generation requires a canonical BMS component ID.'
    );
  }

  return `ASSY-${parsed.typeCode}-${parsed.componentNumber}${parsed.datePart}${parsed.serial}`;
}

function validateAssemblyId({ componentID, assemblyID }) {
  const expected = buildAssemblyId(componentID);
  const actual = String(assemblyID || '').trim().toUpperCase();

  if (!ASSEMBLY_ID_PATTERN.test(actual) || actual !== expected) {
    throw new Error(
      `Assembly ID is system-generated and must be ${expected}.`
    );
  }

  return expected;
}

module.exports = {
  ASSEMBLY_ID_PATTERN,
  buildAssemblyId,
  validateAssemblyId,
};
