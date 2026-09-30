'use strict';

const EXPECTED_SEQUENCE = [
  'MANUFACTURED',
  'CERTIFIED',
  'SHIPPED',
  'RECEIVED',
  'TRANSFERRED',
  'ASSEMBLED',
];

function hasValue(value) {
  return value !== undefined && value !== null &&
    String(value).trim() !== '' &&
    String(value).trim() !== 'Unknown' &&
    String(value).trim() !== 'unknown';
}

function validTimestamp(value) {
  if (!hasValue(value)) return false;
  return !Number.isNaN(new Date(value).getTime());
}

function validateProvenance(history) {
  const events = Array.isArray(history) ? history : [];
  const actualSequence = events.map(event => event?.eventType || 'UNKNOWN');
  const issues = [];

  if (events.length === 0) {
    issues.push('No provenance events were returned from the ledger.');
  }

  if (events.length !== EXPECTED_SEQUENCE.length) {
    const missing = EXPECTED_SEQUENCE.filter(stage => !actualSequence.includes(stage));
    if (missing.length > 0) {
      issues.push('Missing lifecycle events: ' + missing.join(', ') + '.');
    }
    if (events.length > EXPECTED_SEQUENCE.length) {
      issues.push('Unexpected additional lifecycle events were recorded.');
    }
  }

  const compareLength = Math.min(actualSequence.length, EXPECTED_SEQUENCE.length);
  for (let index = 0; index < compareLength; index += 1) {
    if (actualSequence[index] !== EXPECTED_SEQUENCE[index]) {
      issues.push(
        'Lifecycle sequence mismatch at position ' +
        (index + 1) + ': expected ' + EXPECTED_SEQUENCE[index] +
        ', found ' + actualSequence[index] + '.'
      );
      break;
    }
  }

  for (let index = 1; index < events.length; index += 1) {
    const previous = new Date(events[index - 1]?.timestamp).getTime();
    const current = new Date(events[index]?.timestamp).getTime();
    if (Number.isFinite(previous) && Number.isFinite(current) && current < previous) {
      issues.push(
        'Event timestamps are not chronological between events ' +
        index + ' and ' + (index + 1) + '.'
      );
    }
  }

  events.forEach((event, index) => {
    const eventNumber = index + 1;
    const eventName = event?.eventType || 'UNKNOWN';

    if (!hasValue(event?.actor)) {
      issues.push('Event ' + eventNumber + ' (' + eventName + ') is missing its actor.');
    }
    if (!validTimestamp(event?.timestamp)) {
      issues.push('Event ' + eventNumber + ' (' + eventName + ') has a missing or invalid timestamp.');
    }
    switch (eventName) {
      case 'MANUFACTURED':
        if (!hasValue(event?.location)) {
          issues.push('Event ' + eventNumber + ' (MANUFACTURED) is missing its location.');
        }
        if (!hasValue(event?.manufacturer)) {
          issues.push('Manufactured event is missing the manufacturer.');
        }
        break;
      case 'CERTIFIED':
        if (!hasValue(event?.location)) {
          issues.push('Event ' + eventNumber + ' (CERTIFIED) is missing its location.');
        }
        if (!hasValue(event?.certificateID)) {
          issues.push('Certified event is missing the certificate reference.');
        }
        if (!hasValue(event?.complianceReference)) {
          issues.push('Certified event is missing the compliance reference.');
        }
        break;
      case 'SHIPPED':
        // A shipment is location-bearing through its origin and destination.
        if (!hasValue(event?.from) || !hasValue(event?.to)) {
          issues.push('Shipped event is missing the origin or destination.');
        }
        if (!hasValue(event?.shipmentID)) {
          issues.push('Shipped event is missing the shipment reference.');
        }
        if (!validTimestamp(event?.shipmentDate)) {
          issues.push('Shipped event has a missing or invalid shipment date.');
        }
        break;
      case 'RECEIVED':
        if (!hasValue(event?.location)) {
          issues.push('Event ' + eventNumber + ' (RECEIVED) is missing its location.');
        }
        if (!validTimestamp(event?.receivedDate)) {
          issues.push('Received event has a missing or invalid receipt date.');
        }
        break;
      case 'TRANSFERRED':
        if (!hasValue(event?.location)) {
          issues.push('Event ' + eventNumber + ' (TRANSFERRED) is missing its location.');
        }
        if (!hasValue(event?.from) || !hasValue(event?.to)) {
          issues.push('Transferred event is missing the custody origin or destination.');
        }
        if (!validTimestamp(event?.transferDate)) {
          issues.push('Transferred event has a missing or invalid transfer date.');
        }
        break;
      case 'ASSEMBLED':
        if (!hasValue(event?.location)) {
          issues.push('Event ' + eventNumber + ' (ASSEMBLED) is missing its location.');
        }
        if (!hasValue(event?.assemblyID)) {
          issues.push('Assembled event is missing the assembly reference.');
        }
        break;
      default:
        issues.push('Unknown provenance event type: ' + eventName + '.');
        break;
    }
  });

  const uniqueIssues = [...new Set(issues)];
  const sequenceValid =
    actualSequence.length === EXPECTED_SEQUENCE.length &&
    actualSequence.every((eventType, index) => eventType === EXPECTED_SEQUENCE[index]);

  return {
    valid: uniqueIssues.length === 0,
    status: uniqueIssues.length === 0 ? 'PROVENANCE VALID' : 'PROVENANCE INVALID',
    message: uniqueIssues.length === 0
      ? 'All required lifecycle events are present and in the expected sequence.'
      : 'Provenance consistency checks failed.',
    expectedSequence: [...EXPECTED_SEQUENCE],
    actualSequence,
    completedStages: EXPECTED_SEQUENCE.filter(stage => actualSequence.includes(stage)).length,
    issues: uniqueIssues,
    checks: {
      sequenceValid,
      requiredEventsPresent: EXPECTED_SEQUENCE.every(stage => actualSequence.includes(stage)),
      actorDataComplete: events.every(event => hasValue(event?.actor)),
      timestampsValid: events.every(event => validTimestamp(event?.timestamp)),
      locationsComplete: events.every(event => {
        switch (event?.eventType) {
          case 'SHIPPED':
            return hasValue(event?.from) && hasValue(event?.to);
          case 'MANUFACTURED':
          case 'CERTIFIED':
          case 'RECEIVED':
          case 'TRANSFERRED':
          case 'ASSEMBLED':
            return hasValue(event?.location);
          default:
            return false;
        }
      }),
    },
  };
}

module.exports = {
  EXPECTED_SEQUENCE,
  validateProvenance,
};
