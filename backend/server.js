const {
  authenticateGoogleToken,
} = require('./auth');

const {
  createSession,
  getSession,
  updateSession,
  deleteSession,
} = require('./sessionStore');

require('dotenv').config();
const http = require('http');

const {
  checkFabricConnection,
  createComponentOnLedger,
  getComponentFromLedger,
  invokeChaincode,
  queryChaincode
} = require('./fabricGateway');

const {
  getUsers,
  createUser,
  getUser,
  changeUserRole,
  changeUserStatus,
  deleteUser,
} = require('./userAdminService');

const {
  VALID_ROLES,
  findUserById,
  listUsers,
} = require('./userStore');

const {
  listComponentTypes,
  createComponentType,
  setComponentTypeStatus,
  resolveComponentType,
  findComponentTypeByCode,
} = require('./componentTypeStore');

const {
  listLocations,
  getLocation,
  createLocation,
  setLocationStatus,
} = require('./locationStore');

const {
  buildShipmentId,
  validateShipmentId,
} = require('./shipmentId');

const {
  buildComponentId,
  parseComponentId,
  validateComponentIdFormat,
} = require('./componentId');

const {
  buildAssemblyId,
} = require('./assemblyId');

const {
  validateProvenance,
} = require('./provenanceValidator');

const {
  getCurrentHolder,
} = require('./currentHolder');

const OPERATIONAL_ROLES = new Set(VALID_ROLES);



const PORT = process.env.PORT || 3000;

function setCorsHeaders(req, res) {
  const allowedOrigins = [
    'http://localhost:5173',
    'http://127.0.0.1:5173',
  ];

  const origin = req.headers.origin;

  if (origin && allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
  }

  res.setHeader(
    'Access-Control-Allow-Methods',
    'GET, POST, PUT, DELETE, OPTIONS'
  );

  res.setHeader(
    'Access-Control-Allow-Headers',
    'Content-Type, Accept'
  );
}

function parseJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => { body += chunk.toString(); });
    req.on('end', () => {
      const trimmed = body ? body.trim() : '';
      if (!trimmed) return resolve({});
      try {
        resolve(JSON.parse(trimmed));
      } catch (err) {
        console.error('JSON parse error on raw body:', JSON.stringify(body));
        reject(new Error('Invalid JSON payload'));
      }
    });
    req.on('error', reject);
  });
}

function parseCookies(req) {
  const cookieHeader = req.headers.cookie;

  if (!cookieHeader) {
    return {};
  }

  return Object.fromEntries(
    cookieHeader.split(';').map(cookie => {
      const index = cookie.indexOf('=');

      if (index === -1) {
        return [cookie.trim(), ''];
      }

      const key = cookie.slice(0, index).trim();
      const value = cookie.slice(index + 1).trim();

      return [key, value];
    })
  );
}

function getAuthenticatedSession(req) {
  const token = parseCookies(req).session_token;
  const session = getSession(token);

  if (!session) {
    return null;
  }

  if (session.isAdmin === true) {
    return { token, session };
  }

  if (!session.userId) {
    deleteSession(token);
    return null;
  }

  const user = findUserById(session.userId);

  if (!user || !user.active) {
    deleteSession(token);
    return null;
  }

  const refreshed = updateSession(token, {
    ...user,
    sub: session.sub,
    picture: session.picture,
    isAdmin: false,
  });

  return refreshed
    ? { token, session: refreshed }
    : null;
}

function hasOperationalAccess(session) {
  return (
    session.isAdmin !== true &&
    OPERATIONAL_ROLES.has(session.role) &&
    Boolean(session.fabricIdentity)
  );
}

function hasRole(session, role) {
  return hasOperationalAccess(session) && session.role === role;
}

function getFabricReadIdentity(session) {
  return session.isAdmin === true ? 'auditor1' : session.fabricIdentity;
}

function getActiveAssembler() {
  const assembler = listUsers().find(
    user => user.role === 'ASSEMBLER' && user.active
  );

  if (!assembler) {
    return null;
  }

  return {
    id: assembler.id,
    name: assembler.name,
    fabricIdentity: assembler.fabricIdentity,
  };
}

function getComponentTypeFromComponentId(componentID) {
  const parsed = parseComponentId(componentID);

  if (!parsed || !parsed.validDate) {
    throw new Error(
      'Shipment ID generation requires a canonical BMS component ID.'
    );
  }

  const typeConfig = findComponentTypeByCode(
    parsed.typeCode,
    { includeInactive: true }
  );

  if (!typeConfig) {
    throw new Error(
      `Component type code '${parsed.typeCode}' is not registered.`
    );
  }

  if (typeConfig.componentNumber !== parsed.componentNumber) {
    throw new Error(
      'Component ID type code and component number do not match the administrator registry.'
    );
  }

  return {
    parsed,
    typeConfig,
  };
}

async function getNextComponentSerial(typeConfig, manufactureDate, identity) {
  const sampleId = buildComponentId({
    typeCode: typeConfig.code,
    componentNumber: typeConfig.componentNumber,
    manufactureDate,
    serialNumber: '001',
  });
  const parsedSample = parseComponentId(sampleId);

  const output = await queryChaincode(
    'GetAllComponents',
    [],
    identity
  );

  let components;
  try {
    components = JSON.parse(output);
  } catch {
    components = [];
  }

  let maxSerial = 0;

  if (Array.isArray(components)) {
    for (const component of components) {
      const parsed = parseComponentId(component?.componentID);
      if (
        parsed &&
        parsed.validDate &&
        parsed.typeCode === typeConfig.code &&
        parsed.componentNumber === typeConfig.componentNumber &&
        parsed.datePart === parsedSample.datePart
      ) {
        maxSerial = Math.max(maxSerial, Number(parsed.serial));
      }
    }
  }

  const nextSerial = maxSerial + 1;

  if (nextSerial > 999) {
    throw new Error(
      `No serial numbers remain for ${typeConfig.name} on ${manufactureDate}.`
    );
  }

  return String(nextSerial).padStart(3, '0');
}

function normalizeProvenanceHistory(history) {
  if (!Array.isArray(history)) {
    return [];
  }

  return history
    .filter(entry => entry && entry.data && !entry.isDelete)
    .map(entry => {
      const data = entry.data;
      const status = data.status;

      const base = {
        eventType: status,
        timestamp: entry.timestamp,
        txId: entry.txId,
        actor: 'Unknown',
      };

      switch (status) {
        case 'MANUFACTURED':
          return {
            ...base,
            eventType: 'MANUFACTURED',
            actor: data.manufacturerActor || data.manufacturer || 'Unknown',
            manufacturer: data.manufacturer || 'Unknown',
            location: data.location || 'Unknown',
          };

        case 'CERTIFIED':
          return {
            ...base,
            eventType: 'CERTIFIED',
            actor: data.certifier || 'Unknown',
            certificateID: data.certificateID || 'Unknown',
            certificationDate: data.certificationDate || entry.timestamp,
            complianceReference: data.complianceReference || 'Unknown',
            location: data.location || 'Unknown',
          };

        case 'SHIPPED':
          return {
            ...base,
            eventType: 'SHIPPED',
            actor: data.transporter || 'Unknown',
            transporter: data.transporter || 'Unknown',
            from: data.from || 'Unknown',
            fromCode: data.fromCode || 'Unknown',
            fromPincode: data.fromPincode || 'Unknown',
            to: data.to || 'Unknown',
            toCode: data.toCode || 'Unknown',
            toPincode: data.toPincode || 'Unknown',
            shipmentID: data.shipmentID || 'Unknown',
            shipmentDate: data.shipmentDate || entry.timestamp,
          };

        case 'RECEIVED':
          return {
            ...base,
            eventType: 'RECEIVED',
            actor: data.warehouse || 'Unknown',
            warehouse: data.warehouse || 'Unknown',
            location: data.receivedLocation || 'Unknown',
            locationCode: data.receivedLocationCode || 'Unknown',
            locationPincode: data.receivedLocationPincode || 'Unknown',
            receivedDate: data.receiptDate || entry.timestamp,
          };

        case 'TRANSFERRED':
          return {
            ...base,
            eventType: 'TRANSFERRED',
            actor: data.custodyFrom || 'Unknown',
            from: data.custodyFrom || 'Unknown',
            to: data.custodyTo || 'Unknown',
            location: data.custodyLocation || 'Unknown',
            locationCode: data.custodyLocationCode || 'Unknown',
            locationPincode: data.custodyLocationPincode || 'Unknown',
            transferDate: data.transferDate || entry.timestamp,
          };

        case 'ASSEMBLED':
          return {
            ...base,
            eventType: 'ASSEMBLED',
            actor: data.assembler || 'Unknown',
            assembler: data.assembler || 'Unknown',
            assemblyID: data.assemblyID || 'Unknown',
            location: data.assemblyLocation || 'Unknown',
            locationCode: data.assemblyLocationCode || 'Unknown',
            locationPincode: data.assemblyLocationPincode || 'Unknown',
          };

        default:
          return null;
      }
    })
    .filter(Boolean)
    .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
}

function cleanFabricError(err) {
  let msg = err?.message || String(err);

  // Fabric Gateway often wraps the chaincode error like:
  // Error: endorsement failure ... message:"Unauthorized role."
  const fabricMessage = msg.match(/message:"([^"]+)"/);

  if (fabricMessage) {
    msg = fabricMessage[1];
  }

  // Remove a redundant leading "Error:"
  msg = msg.replace(/^Error:\s*/, '').trim();

  // Normalize common lifecycle messages
  if (msg.includes('already assembled')) {
    return 'Component already assembled.';
  }

  if (msg.includes('already certified')) {
    return 'Component already certified.';
  }

  if (msg.includes('already exists')) {
    return 'Component already exists.';
  }

  if (msg.includes('not found')) {
    return 'Component not found.';
  }

  if (msg.includes('Unauthorized role')) {
    return 'Unauthorized role.';
  }

  return msg || 'Operation failed.';
}

const server = http.createServer(async (req, res) => {
  setCorsHeaders(req, res);

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    return res.end();
  }

  const urlObj = new URL(req.url, `http://localhost:${PORT}`);
  const pathname = urlObj.pathname;

  try {
    // ── 1. GET /api/health ──────────────────────────────────────────────
    // Public endpoint used for basic service health.
    if (req.method === 'GET' && pathname === '/api/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({
        status: 'OK',
        service: 'bms-provenance-backend',
        timestamp: new Date().toISOString()
      }));
    }

    // Fabric health is administrator-only and is handled after session authentication.

    // ── Google authentication ────────────────────────────────────────────
    if (req.method === 'POST' && pathname === '/api/auth/google') {
      try {
        const body = await parseJsonBody(req);

        if (!body.idToken) {
          res.writeHead(400, {
            'Content-Type': 'application/json',
          });

          return res.end(JSON.stringify({
            error: 'Google ID token is required.',
          }));
        }

        const user = await authenticateGoogleToken(body.idToken);

        const sessionToken = createSession(user);

        res.writeHead(200, {
          'Content-Type': 'application/json',
          'Set-Cookie':
            `session_token=${sessionToken}; HttpOnly; Path=/; SameSite=Lax; Max-Age=28800`,
        });

        return res.end(JSON.stringify({
          authenticated: true,
          user: {
            email: user.email,
            name: user.name,
            picture: user.picture,
          },
          role: user.role,
          fabricIdentity: user.fabricIdentity,
          isAdmin: user.isAdmin === true,
        }));
      } catch (err) {
        if (err.code === 'PROVISIONING_REQUIRED') {
          res.writeHead(403, {
            'Content-Type': 'application/json',
          });

          return res.end(JSON.stringify({
            error: err.message,
            provisioningRequired: true,
            sub: err.sub,
            email: err.email,
            name: err.name,
          }));
        }

        console.error(
          'Google authentication failed:',
          err.message
        );

        res.writeHead(401, {
          'Content-Type': 'application/json',
        });

        return res.end(JSON.stringify({
          error: err.message || 'Google authentication failed.',
        }));
      }
    }

    // ── Logout ──────────────────────────────────────────────────────────
    if (
      req.method === 'POST' &&
      pathname === '/api/auth/logout'
    ) {
      const cookies = parseCookies(req);

      deleteSession(cookies.session_token);

      res.writeHead(200, {
        'Content-Type': 'application/json',
        'Set-Cookie':
          'session_token=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0',
      });

      return res.end(
        JSON.stringify({
          authenticated: false,
        })
      );
    }


    // ── Current authenticated user ──────────────────────────────────────
    if (
      req.method === 'GET' &&
      pathname === '/api/auth/me'
    ) {
      const authenticated = getAuthenticatedSession(req);
      const session = authenticated?.session;

      if (!session) {
        res.writeHead(401, {
          'Content-Type': 'application/json',
        });

        return res.end(JSON.stringify({
          authenticated: false,
        }));
      }

      res.writeHead(200, {
        'Content-Type': 'application/json',
      });

      return res.end(JSON.stringify({
        authenticated: true,
        user: {
          email: session.email,
          name: session.name,
          picture: session.picture,
        },
        role: session.role,
        fabricIdentity: session.fabricIdentity,
        isAdmin: session.isAdmin === true,
      }));
    }

    

    // ── Protected API authentication ───────────────────────────────────
    const authenticated = getAuthenticatedSession(req);
    const session = authenticated?.session;

    if (!session) {
      res.writeHead(401, {
        'Content-Type': 'application/json',
      });

      return res.end(JSON.stringify({
        error: 'Authentication required.',
      }));
    }

    const identity = session.fabricIdentity;

    if (
      session.isAdmin === true &&
      !pathname.startsWith('/api/admin/') &&
      pathname !== '/api/health/fabric'
    ) {
      res.writeHead(403, {
        'Content-Type': 'application/json',
      });

      return res.end(JSON.stringify({
        error: 'Administrator account cannot perform operational Fabric actions.',
      }));
    }

    if (req.method === 'GET' && pathname === '/api/health/fabric') {
      if (session.isAdmin !== true) {
        res.writeHead(403, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({
          error: 'Administrator access required.',
        }));
      }

      try {
        const health = await checkFabricConnection();

        res.writeHead(
          health.connected ? 200 : 503,
          { 'Content-Type': 'application/json' }
        );

        return res.end(JSON.stringify({
          connected: health.connected,
          network: health.network,
          chaincode: health.chaincode
        }));
      } catch (err) {
        res.writeHead(503, { 'Content-Type': 'application/json' });

        return res.end(JSON.stringify({
          connected: false,
          error: cleanFabricError(err)
        }));
      }
    }

    console.log(
      `[${new Date().toISOString()}] ${req.method} ${pathname} ` +
      `(Fabric Identity: ${identity})`
    );


    // ── Admin user and role management ─────────────────────────────────
    if (pathname.startsWith('/api/admin/users')) {
      if (session.isAdmin !== true) {
        res.writeHead(403, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({
          error: 'Administrator access required.',
        }));
      }

      try {
        if (req.method === 'GET' && pathname === '/api/admin/users') {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ users: getUsers() }));
        }

        if (req.method === 'POST' && pathname === '/api/admin/users') {
          const body = await parseJsonBody(req);

          const user = createUser({
            email: body.email,
            name: body.name,
            role: body.role,
          });

          res.writeHead(201, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ user }));
        }

        const match = pathname.match(
          /^\/api\/admin\/users\/([^/]+)(?:\/(role|status))?$/
        );

        if (!match) {
          res.writeHead(404, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ error: 'Endpoint not found' }));
        }

        const userId = decodeURIComponent(match[1]);
        const action = match[2];

        if (req.method === 'GET' && !action) {
          const user = getUser(userId);

          if (!user) {
            res.writeHead(404, { 'Content-Type': 'application/json' });
            return res.end(JSON.stringify({ error: 'User not found.' }));
          }

          res.writeHead(200, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ user }));
        }

        if (req.method === 'PUT' && action === 'role') {
          const body = await parseJsonBody(req);
          const user = changeUserRole(userId, body.role);

          res.writeHead(200, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ user }));
        }

        if (req.method === 'PUT' && action === 'status') {
          const body = await parseJsonBody(req);
          const user = changeUserStatus(userId, body.active);

          res.writeHead(200, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ user }));
        }

        if (req.method === 'DELETE' && !action) {
          const user = deleteUser(userId);

          res.writeHead(200, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ user }));
        }

        res.writeHead(405, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ error: 'Method not allowed' }));
      } catch (err) {
        console.error(
          'Admin user-management request failed:',
          err.message
        );

        const msg = err.message || 'Admin user-management operation failed.';
        let code = 500;

        if (msg.includes('already exists') || msg.includes('Invalid role')) {
          code = 409;
        } else if (msg.includes('not found')) {
          code = 404;
        } else if (
          msg.includes('Email is required') ||
          msg.includes('Active status must be boolean')
        ) {
          code = 400;
        }

        res.writeHead(code, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ error: msg }));
      }
    }

    // ── Admin component type configuration ───────────────────────────────
    if (pathname.startsWith('/api/admin/component-types')) {
      if (session.isAdmin !== true) {
        res.writeHead(403, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({
          error: 'Administrator access required.',
        }));
      }

      try {
        if (req.method === 'GET' && pathname === '/api/admin/component-types') {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({
            componentTypes: listComponentTypes({ includeInactive: true }),
          }));
        }

        if (req.method === 'POST' && pathname === '/api/admin/component-types') {
          const body = await parseJsonBody(req);
          const componentType = createComponentType({
            name: body.name,
            code: body.code,
            componentNumber: body.componentNumber,
          });

          res.writeHead(201, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ componentType }));
        }

        const match = pathname.match(
          /^\/api\/admin\/component-types\/([^/]+)\/status$/
        );

        if (req.method === 'PUT' && match) {
          const body = await parseJsonBody(req);
          const componentType = setComponentTypeStatus(
            decodeURIComponent(match[1]),
            body.active
          );

          res.writeHead(200, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ componentType }));
        }

        res.writeHead(405, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ error: 'Method not allowed' }));
      } catch (err) {
        console.error('Admin component-type request failed:', err.message);

        const msg = err.message || 'Component type operation failed.';
        let code = 500;

        if (
          msg.includes('already assigned') ||
          msg.includes('already exists')
        ) {
          code = 409;
        } else if (
          msg.includes('must be') ||
          msg.includes('required') ||
          msg.includes('Active status must')
        ) {
          code = 400;
        } else if (msg.includes('not found')) {
          code = 404;
        }

        res.writeHead(code, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ error: msg }));
      }
    }

    // ── Admin location registry ───────────────────────────────────────────
    if (pathname.startsWith('/api/admin/locations')) {
      if (session.isAdmin !== true) {
        res.writeHead(403, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({
          error: 'Administrator access required.',
        }));
      }

      try {
        if (req.method === 'GET' && pathname === '/api/admin/locations') {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({
            locations: listLocations({ includeInactive: true }),
          }));
        }

        if (req.method === 'POST' && pathname === '/api/admin/locations') {
          const body = await parseJsonBody(req);
          const location = createLocation({
            name: body.name,
            code: body.code,
            pincode: body.pincode,
          });

          res.writeHead(201, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ location }));
        }

        const match = pathname.match(
          /^\/api\/admin\/locations\/([^/]+)\/status$/
        );

        if (req.method === 'PUT' && match) {
          const body = await parseJsonBody(req);
          const location = setLocationStatus(
            decodeURIComponent(match[1]),
            body.active
          );

          res.writeHead(200, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ location }));
        }

        res.writeHead(405, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ error: 'Method not allowed' }));
      } catch (err) {
        console.error('Admin location request failed:', err.message);

        const msg = err.message || 'Location operation failed.';
        let code = 500;

        if (msg.includes('already assigned') || msg.includes('already exists')) {
          code = 409;
        } else if (msg.includes('required') || msg.includes('must be')) {
          code = 400;
        } else if (msg.includes('not found')) {
          code = 404;
        }

        res.writeHead(code, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ error: msg }));
      }
    }

    // ── Authenticated location catalog ─────────────────────────────────
    if (req.method === 'GET' && pathname === '/api/locations') {
      if (!hasOperationalAccess(session)) {
        res.writeHead(403, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({
          error: 'Operational role required.',
        }));
      }

      try {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({
          locations: listLocations({ includeInactive: false }),
        }));
      } catch (err) {
        console.error('Location catalog read failed:', err.message);

        res.writeHead(503, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({
          error: 'Location configuration is unavailable.',
        }));
      }
    }

    // ── Warehouse assembler assignment catalog ───────────────────────────
    if (req.method === 'GET' && pathname === '/api/warehouse/assembler') {
      if (!hasRole(session, 'WAREHOUSE')) {
        res.writeHead(403, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({
          error: 'Warehouse role required.',
        }));
      }

      try {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({
          assembler: getActiveAssembler(),
        }));
      } catch (err) {
        console.error('Assembler assignment read failed:', err.message);

        res.writeHead(503, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({
          error: 'Assembler configuration is unavailable.',
        }));
      }
    }

    // ── Authenticated component type catalog ─────────────────────────────
    if (req.method === 'GET' && pathname === '/api/component-types') {
      if (!hasOperationalAccess(session)) {
        res.writeHead(403, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({
          error: 'Operational role required.',
        }));
      }

      try {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({
          componentTypes: listComponentTypes({ includeInactive: false }),
        }));
      } catch (err) {
        console.error('Component type catalog read failed:', err);

        if (!res.headersSent) {
          res.writeHead(503, { 'Content-Type': 'application/json' });
        }

        return res.end(JSON.stringify({
          error: 'Component type configuration is unavailable.',
        }));
      }
    }

    // ── 3. GET /api/overview ───────────────────────────────────────────
    if (req.method === 'GET' && pathname === '/api/overview') {
      if (!hasOperationalAccess(session)) {
        res.writeHead(403, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({
          error: 'Operational role required.',
        }));
      }
      try {
        const componentsOutput = await queryChaincode(
          'GetAllComponents',
          [],
          identity
        );

        const components = JSON.parse(componentsOutput);

        res.writeHead(200, { 'Content-Type': 'application/json' });

        return res.end(JSON.stringify({
          registeredCount: Array.isArray(components) ? components.length : 0,
        }));
      } catch (err) {
        console.error('Overview query failed:', err);

        const msg = cleanFabricError(err);

        res.writeHead(503, { 'Content-Type': 'application/json' });

        return res.end(JSON.stringify({
          error: msg
        }));
      }
    }

    // ── 4. POST /api/manufacturer/components - Register Component ───────
    if (req.method === 'POST' && pathname === '/api/manufacturer/components') {
      if (!hasRole(session, 'MANUFACTURER')) {
        res.writeHead(403, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({
          error: 'Manufacturer role required.',
        }));
      }

      const body = await parseJsonBody(req);
      const {
        componentTypeId,
        manufacturer,
        manufactureDate,
        location,
      } = body;

      if (!componentTypeId || !manufacturer || !manufactureDate || !location) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({
          error: 'All fields are required: componentTypeId, manufacturer, manufactureDate, location',
        }));
      }

      try {
        const typeConfig = resolveComponentType(componentTypeId);

        if (!typeConfig) {
          res.writeHead(409, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({
            error: 'Selected component type is unavailable. Ask an administrator to activate it.',
          }));
        }

        const serialNumber = await getNextComponentSerial(
          typeConfig,
          manufactureDate,
          identity
        );

        const componentID = buildComponentId({
          typeCode: typeConfig.code,
          componentNumber: typeConfig.componentNumber,
          manufactureDate,
          serialNumber,
        });

        const result = await createComponentOnLedger({
          componentID,
          componentType: typeConfig.name,
          manufacturer: manufacturer.trim(),
          manufactureDate,
          location: location.trim(),
        }, identity);

        res.writeHead(201, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({
          ...result,
          componentTypeCode: typeConfig.code,
          componentNumber: typeConfig.componentNumber,
          serialNumber,
          generatedComponentID: componentID,
        }));
      } catch (err) {
        console.error('Error creating component:', err);
        const msg = cleanFabricError(err);
        const code = (
          msg.includes('already exists') ||
          msg.includes('unavailable') ||
          msg.includes('serial numbers remain')
        ) ? 409 : 400;

        res.writeHead(code, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ error: msg }));
      }
    }

    // ── Component Verification ───────────────────────────────────────────
    if (
      req.method === 'GET' &&
      pathname.match(/^\/api\/components\/[^/]+\/verify$/)
    ) {
      if (!hasOperationalAccess(session)) {
        res.writeHead(403, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({
          error: 'Operational role required.',
        }));
      }

      const match = pathname.match(/^\/api\/components\/([^/]+)\/verify$/);
      const id = decodeURIComponent(match[1]).trim().toUpperCase();

      if (!id) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({
          error: 'Component ID is required.',
        }));
      }

      const idFormat = validateComponentIdFormat(id);
      const readIdentity = getFabricReadIdentity(session);

      try {
        const component = await getComponentFromLedger(id, readIdentity);

        let provenanceAvailable = false;
        let provenanceEventCount = 0;
        let provenanceStatus = 'PROVENANCE UNAVAILABLE';
        let provenanceCondition = 'UNAVAILABLE';

        try {
          const historyStr = await queryChaincode(
            'GetComponentHistory',
            [id],
            readIdentity
          );
          const history = JSON.parse(historyStr);
          const normalizedHistory = normalizeProvenanceHistory(history);
          provenanceEventCount = normalizedHistory.length;
          provenanceAvailable = provenanceEventCount > 0;

          if (provenanceAvailable) {
            const provenanceValidation = validateProvenance(normalizedHistory);
            provenanceStatus = provenanceValidation.status;
            provenanceCondition = provenanceValidation.condition;
          }
        } catch (historyError) {
          console.warn(
            `Verification history lookup failed for ${id}:`,
            historyError.message
          );
        }

        let typeConfiguration = null;
        let typeConfigurationStatus = 'NOT_CHECKED';

        if (idFormat.valid && idFormat.parsed) {
          typeConfiguration = findComponentTypeByCode(
            idFormat.parsed.typeCode,
            { includeInactive: true }
          );
          typeConfigurationStatus = typeConfiguration
            ? 'REGISTERED'
            : 'UNKNOWN_TYPE_CODE';

          if (
            typeConfiguration &&
            typeConfiguration.componentNumber !== idFormat.parsed.componentNumber
          ) {
            typeConfigurationStatus = 'TYPE_NUMBER_MISMATCH';
          }
        }

        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({
          verified: true,
          verificationStatus: 'COMPONENT VERIFIED',
          component,
          idFormat: {
            valid: idFormat.valid,
            status: idFormat.status,
            message: idFormat.message,
          },
          typeConfiguration: typeConfiguration
            ? {
                id: typeConfiguration.id,
                name: typeConfiguration.name,
                code: typeConfiguration.code,
                componentNumber: typeConfiguration.componentNumber,
                active: typeConfiguration.active,
              }
            : null,
          typeConfigurationStatus,
          currentHolder: getCurrentHolder(component),
          provenanceAvailable,
          provenanceEventCount,
          provenanceStatus,
          provenanceCondition,
        }));
      } catch (err) {
        const msg = cleanFabricError(err);

        if (msg.includes('not found')) {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({
            verified: false,
            verificationStatus: 'COMPONENT NOT VERIFIED',
            component: null,
            componentID: id,
            idFormat: {
              valid: idFormat.valid,
              status: idFormat.status,
              message: idFormat.message,
            },
            typeConfiguration: null,
            typeConfigurationStatus: 'NOT_FOUND',
            currentHolder: null,
            provenanceAvailable: false,
            provenanceEventCount: 0,
            provenanceStatus: 'PROVENANCE UNAVAILABLE',
            provenanceCondition: 'UNAVAILABLE',
          }));
        }

        res.writeHead(503, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ error: msg }));
      }
    }

    // ── Task 5: Provenance consistency validation ────────────────────────
    if (
      req.method === 'GET' &&
      pathname.match(/^\/api\/components\/[^/]+\/provenance\/validate$/)
    ) {
      if (!hasOperationalAccess(session)) {
        res.writeHead(403, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({
          error: 'Operational role required.',
        }));
      }

      const match = pathname.match(
        /^\/api\/components\/([^/]+)\/provenance\/validate$/
      );
      const id = decodeURIComponent(match[1]);

      try {
        const historyStr = await queryChaincode(
          'GetComponentHistory',
          [id],
          getFabricReadIdentity(session)
        );

        const rawHistory = JSON.parse(historyStr);
        const normalizedHistory = normalizeProvenanceHistory(rawHistory);
        const validation = validateProvenance(normalizedHistory);

        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({
          componentID: id,
          ...validation,
        }));
      } catch (err) {
        const msg = cleanFabricError(err);

        if (msg.includes('not found')) {
          res.writeHead(404, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({
            error: 'Component not found: ' + id,
          }));
        }

        res.writeHead(503, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({
          error: msg,
        }));
      }
    }

    // ── 5. GET /api/components/:id - Get Component ─────────────────────
    if (req.method === 'GET' && pathname.startsWith('/api/components/')) {
      if (!hasOperationalAccess(session)) {
        res.writeHead(403, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({
          error: 'Operational role required.',
        }));
      }
      const parts = pathname.split('/');
      if (parts.length === 4 && parts[3] !== 'overview') {
        const id = decodeURIComponent(parts[3]);
        try {
          const result = await getComponentFromLedger(id, identity);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify(result));
        } catch (err) {
          const msg = cleanFabricError(err);
          const code = (msg.includes('not found') || msg.includes('does not exist')) ? 404 : 500;
          res.writeHead(code, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ error: msg }));
        }
      }
    }

    // ── 6. Day 2 Lifecycle Endpoints ─────────────────────────────────────
    if (req.method === 'POST' && pathname.match(/^\/api\/certifier\/components\/[^\/]+\/certify$/)) {
      if (!hasRole(session, 'CERTIFIER')) {
        res.writeHead(403, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({
          error: 'Certifier role required.',
        }));
      }
      const match = pathname.match(/^\/api\/certifier\/components\/([^/]+)\/certify$/);
      const id = decodeURIComponent(match[1]);
      const body = await parseJsonBody(req);
      const certificateID = `CERT-${id}`;

      try {
        const { output, txId } = await invokeChaincode(
          'CertifyComponent',
          [
            id,
            certificateID,
            body.certificationDate || new Date().toISOString().split('T')[0],
            body.complianceReference || 'ISO-9001'
          ],
          identity
        );

        let component;

        try {
          component = JSON.parse(output);
        } catch {
          component = await getComponentFromLedger(id, identity);
        }

        res.writeHead(200, { 'Content-Type': 'application/json' });

        return res.end(JSON.stringify({
          success: true,
          message: `Component ${id} certified successfully`,
          component,
          txId
        }));

      } catch (err) {
        console.error('Certification failed:', err);

        const msg = cleanFabricError(err);

        let code = 500;

        if (msg.includes('Unauthorized role')) {
          code = 403;
        } else if (msg.includes('not found')) {
          code = 404;
        } else if (
          msg.includes('already certified') ||
          msg.includes('Invalid component status')
        ) {
          code = 409;
        }

        res.writeHead(code, { 'Content-Type': 'application/json' });

        return res.end(JSON.stringify({
          error: msg
        }));
      }
    }

    if (req.method === 'POST' && pathname.match(/^\/api\/transporter\/components\/[^\/]+\/ship$/)) {
      if (!hasRole(session, 'TRANSPORTER')) {
        res.writeHead(403, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({
          error: 'Transporter role required.',
        }));
      }
      const match = pathname.match(/^\/api\/transporter\/components\/([^/]+)\/ship$/);
      const id = decodeURIComponent(match[1]);
      const body = await parseJsonBody(req);

      try {
        const fromLocation = getLocation(body.fromLocationId, { includeInactive: false });
        const toLocation = getLocation(body.toLocationId, { includeInactive: false });

        if (!fromLocation || !toLocation) {
          throw new Error('Origin and destination must be selected from active administrator-configured locations.');
        }

        if (fromLocation.id === toLocation.id) {
          throw new Error('Origin and destination locations must be different.');
        }

        const component = await getComponentFromLedger(id, identity);
        const { typeConfig } = getComponentTypeFromComponentId(component.componentID);
        const shipmentDate = body.shipmentDate || new Date().toISOString().split('T')[0];

        const shipmentID = buildShipmentId({
          componentID: component.componentID,
          shipmentDate,
          fromCode: fromLocation.code,
          toCode: toLocation.code,
        });

        validateShipmentId({
          shipmentID,
          componentID: component.componentID,
          shipmentDate,
          fromCode: fromLocation.code,
          toCode: toLocation.code,
        });

        const { output, txId } = await invokeChaincode(
          'ShipComponent',
          [
            id,
            fromLocation.name,
            toLocation.name,
            shipmentID,
            shipmentDate,
            fromLocation.code,
            toLocation.code,
            fromLocation.pincode,
            toLocation.pincode
          ],
          identity
        );

        let updatedComponent;

        try {
          updatedComponent = JSON.parse(output);
        } catch {
          updatedComponent = await getComponentFromLedger(id, identity);
        }

        res.writeHead(200, { 'Content-Type': 'application/json' });

        return res.end(JSON.stringify({
          success: true,
          message: 'Component ' + id + ' shipped successfully',
          component: updatedComponent,
          componentType: typeConfig.name,
          componentTypeCode: typeConfig.code,
          componentNumber: typeConfig.componentNumber,
          shipmentID,
          shipmentDate,
          fromLocation,
          toLocation,
          txId
        }));

      } catch (err) {
        console.error('Shipment failed:', err);

        const msg = cleanFabricError(err);
        let code = 500;

        if (msg.includes('Unauthorized role')) {
          code = 403;
        } else if (msg.includes('not found')) {
          code = 404;
        } else if (
          msg.includes('cannot be shipped') ||
          msg.includes('Missing required input') ||
          msg.includes('must be selected') ||
          msg.includes('must be different') ||
          msg.includes('Shipment ID') ||
          msg.includes('canonical BMS component ID') ||
          msg.includes('component number')
        ) {
          code = 409;
        }

        res.writeHead(code, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ error: msg }));
      }
    }
    if (req.method === 'POST' && pathname.match(/^\/api\/warehouse\/components\/[^\/]+\/receive$/)) {
      if (!hasRole(session, 'WAREHOUSE')) {
        res.writeHead(403, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({
          error: 'Warehouse role required.',
        }));
      }
      const match = pathname.match(/^\/api\/warehouse\/components\/([^/]+)\/receive$/);
      const id = decodeURIComponent(match[1]);
      const body = await parseJsonBody(req);

      try {
        const { output, txId } = await invokeChaincode(
          'ReceiveComponent',
          [
            id,
            body.location,
            body.receivedDate
          ],
          identity
        );

        let component;

        try {
          component = JSON.parse(output);
        } catch {
          component = await getComponentFromLedger(id, identity);
        }

        res.writeHead(200, { 'Content-Type': 'application/json' });

        return res.end(JSON.stringify({
          success: true,
          message: `Component ${id} received successfully`,
          component,
          txId
        }));

      } catch (err) {
        console.error('Receipt failed:', err);

        const msg = cleanFabricError(err);
        let code = 500;

        if (msg.includes('Unauthorized role')) {
          code = 403;
        } else if (msg.includes('not found')) {
          code = 404;
        } else if (
          msg.includes('cannot be received') ||
          msg.includes('Missing required input')
        ) {
          code = 409;
        }

        res.writeHead(code, { 'Content-Type': 'application/json' });

        return res.end(JSON.stringify({
          error: msg
        }));
      }
    }

    if (req.method === 'POST' && pathname.match(/^\/api\/warehouse\/components\/[^\/]+\/transfer$/)) {
      if (!hasRole(session, 'WAREHOUSE')) {
        res.writeHead(403, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({
          error: 'Warehouse role required.',
        }));
      }
      const match = pathname.match(/^\/api\/warehouse\/components\/([^/]+)\/transfer$/);
      const id = decodeURIComponent(match[1]);
      const body = await parseJsonBody(req);

      try {
        const assembler = getActiveAssembler();

        if (!assembler) {
          throw new Error(
            'No active assembler is configured. Ask the administrator to configure the assembler.'
          );
        }

        const location = getLocation(body.locationId, {
          includeInactive: false,
        });

        if (!location) {
          throw new Error(
            'A valid active transfer location must be selected.'
          );
        }

        if (!body.transferDate) {
          throw new Error('Transfer date is required.');
        }

        const { output, txId } = await invokeChaincode(
          'TransferCustody',
          [
            id,
            assembler.fabricIdentity,
            location.name,
            location.code,
            location.pincode,
            body.transferDate
          ],
          identity
        );

        let component;

        try {
          component = JSON.parse(output);
        } catch {
          component = await getComponentFromLedger(id, identity);
        }

        res.writeHead(200, { 'Content-Type': 'application/json' });

        return res.end(JSON.stringify({
          success: true,
          message: `Component ${id} custody transferred successfully`,
          component,
          txId
        }));

      } catch (err) {
        console.error('Custody transfer failed:', err);

        const msg = cleanFabricError(err);
        let code = 500;

        if (msg.includes('Unauthorized role')) {
          code = 403;
        } else if (msg.includes('not found')) {
          code = 404;
        } else if (
          msg.includes('cannot be transferred') ||
          msg.includes('Missing required input')
        ) {
          code = 409;
        }

        res.writeHead(code, { 'Content-Type': 'application/json' });

        return res.end(JSON.stringify({
          error: msg
        }));
      }
    }

    if (req.method === 'POST' && pathname.match(/^\/api\/assembler\/components\/[^\/]+\/assemble$/)) {
      if (!hasRole(session, 'ASSEMBLER')) {
        res.writeHead(403, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({
          error: 'Assembler role required.',
        }));
      }
      const match = pathname.match(/^\/api\/assembler\/components\/([^/]+)\/assemble$/);
      const id = decodeURIComponent(match[1]);
      const body = await parseJsonBody(req);

      try {
        const location = getLocation(body.locationId, {
          includeInactive: false,
        });

        if (!location) {
          throw new Error(
            'A valid active assembly location must be selected.'
          );
        }

        const assemblyID = buildAssemblyId(id);

        const { output, txId } = await invokeChaincode(
          'AssembleComponent',
          [
            id,
            assemblyID,
            location.name,
            location.code,
            location.pincode
          ],
          identity
        );

        let component;

        try {
          component = JSON.parse(output);
        } catch {
          component = await getComponentFromLedger(id, identity);
        }

        res.writeHead(200, { 'Content-Type': 'application/json' });

        return res.end(JSON.stringify({
          success: true,
          message: `Component ${id} assembled successfully`,
          component,
          txId
        }));

      } catch (err) {
        console.error('Assembly failed:', err);

        const msg = cleanFabricError(err);
        let code = 500;

        if (msg.includes('Unauthorized role')) {
          code = 403;
        } else if (msg.includes('not found')) {
          code = 404;
        } else if (
          msg.includes('cannot be assembled') ||
          msg.includes('Missing required input')
        ) {
          code = 409;
        }

        res.writeHead(code, { 'Content-Type': 'application/json' });

        return res.end(JSON.stringify({
          error: msg
        }));
      }
    }

    if (req.method === 'GET' && pathname.match(/^\/api\/auditor\/components\/([^/]+)\/history$/)) {
      if (!hasRole(session, 'AUDITOR')) {
        res.writeHead(403, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({
          error: 'Auditor role required.',
        }));
      }

      const match = pathname.match(/^\/api\/auditor\/components\/([^/]+)\/history$/);
      const id = decodeURIComponent(match[1]);

      try {
        const historyStr = await queryChaincode(
          'GetComponentHistory',
          [id],
          identity
        );
        const history = JSON.parse(historyStr);
        const normalizedHistory = normalizeProvenanceHistory(history);

        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify(normalizedHistory));
      } catch (err) {
        const msg = cleanFabricError(err);
        const code = msg.includes('not found') ? 404 : 500;

        res.writeHead(code, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ error: msg }));
      }
    }

    if (req.method === 'GET' && pathname.match(/\/api\/components\/[^\/]+\/history$/)) {
      if (!hasOperationalAccess(session)) {
        res.writeHead(403, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({
          error: 'Operational role required.',
        }));
      }
      const id = decodeURIComponent(pathname.split('/')[3]);

      try {
        const historyStr = await queryChaincode(
          'GetComponentHistory',
          [id],
          identity
        );
        const history = JSON.parse(historyStr);
        const normalizedHistory = normalizeProvenanceHistory(history);

        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify(normalizedHistory));
      } catch (err) {
        const msg = cleanFabricError(err);

        const code = msg.includes('not found') ? 404 : 500;

        res.writeHead(code, { 'Content-Type': 'application/json' });

        return res.end(JSON.stringify({
          error: msg
        }));
      }
    }

    // 404 Route handler
    res.writeHead(404, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ error: 'Endpoint not found' }));

  } catch (err) {
    console.error('Unhandled request error:', err);

    if (res.headersSent) {
      return;
    }

    res.writeHead(500, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ error: err.message || 'Internal server error' }));
  }
});

server.listen(PORT, () => {
  console.log(`\n==================================================`);
  console.log(` Provenance Backend API running on port ${PORT}`);
  console.log(` Health endpoint: http://localhost:${PORT}/api/health`);
  console.log(` Fabric health check: http://localhost:${PORT}/api/health/fabric`);
  console.log(`==================================================\n`);
});
