'use strict';

function getCurrentHolder(component) {
  if (!component || typeof component !== 'object') {
    return null;
  }

  switch (component.status) {
    case 'MANUFACTURED':
    case 'CERTIFIED':
      return component.manufacturerActor || component.manufacturer || null;
    case 'SHIPPED':
      return component.transporter || null;
    case 'RECEIVED':
      return component.warehouse || null;
    case 'TRANSFERRED':
      return component.custodyTo || null;
    case 'ASSEMBLED':
      return component.assembler || null;
    default:
      return null;
  }
}

module.exports = {
  getCurrentHolder,
};
