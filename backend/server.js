const {
  authenticateGoogleToken,
} = require('./auth');

const {
  createSession,
  getSession,
  deleteSession,
} = require('./sessionStore');

require('dotenv').config();
const http = require('http');
const { urlencoded } = require('stream/consumers');

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



const PORT = process.env.PORT || 3000;
const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || '').trim().toLowerCase();

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

    // ── 2. GET /api/health/fabric ───────────────────────────────────────
    // Public endpoint used by the frontend network indicator.
    if (req.method === 'GET' && pathname === '/api/health/fabric') {
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
    }

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
          fabricIdentity: user.fabricIdentity,
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
      const cookies = parseCookies(req);
      const session = getSession(cookies.session_token);

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
        fabricIdentity: session.fabricIdentity,
      }));
    }

    

    // ── Protected API authentication ───────────────────────────────────
    const cookies = parseCookies(req);
    const session = getSession(cookies.session_token);

    if (!session) {
      res.writeHead(401, {
        'Content-Type': 'application/json',
      });

      return res.end(JSON.stringify({
        error: 'Authentication required.',
      }));
    }

    const identity = session.fabricIdentity;

    console.log(
      `[${new Date().toISOString()}] ${req.method} ${pathname} ` +
      `(Fabric Identity: ${identity})`
    );


    // ── Admin user and role management ─────────────────────────────────
    if (pathname.startsWith('/api/admin/users')) {
      if (!ADMIN_EMAIL) {
        res.writeHead(503, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({
          error: 'Admin account is not configured.',
        }));
      }

      if (session.email?.trim().toLowerCase() !== ADMIN_EMAIL) {
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

    // ── 3. GET /api/overview ───────────────────────────────────────────
    if (req.method === 'GET' && pathname === '/api/overview') {
      try {
        const health = await checkFabricConnection();

        const componentsOutput = await queryChaincode(
          'GetAllComponents',
          [],
          identity
        );

        const components = JSON.parse(componentsOutput);

        res.writeHead(200, { 'Content-Type': 'application/json' });

        return res.end(JSON.stringify({
          registeredCount: Array.isArray(components) ? components.length : 0,
          networkStatus: health.connected ? 'connected' : 'disconnected',
          network: 'mychannel',
          chaincode: 'bmsprovenance',
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

    // ── 4. POST /api/components - Register Component ───────────────────
    if (req.method === 'POST' && pathname === '/api/components') {
      const body = await parseJsonBody(req);
      const { componentID, componentType, manufacturer, manufactureDate, location } = body;

      if (!componentID || !componentType || !manufacturer || !manufactureDate || !location) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ error: 'All fields are required: componentID, componentType, manufacturer, manufactureDate, location' }));
      }

      try {
        const result = await createComponentOnLedger({
          componentID, componentType, manufacturer, manufactureDate, location
        }, identity);

        res.writeHead(201, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify(result));
      } catch (err) {
        console.error('Error creating component:', err);
        const msg = cleanFabricError(err);
        const code = msg.includes('already exists') ? 409 : 500;
        res.writeHead(code, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ error: msg }));
      }
    }

    // ── 5. GET /api/components/:id - Get Component ─────────────────────
    if (req.method === 'GET' && pathname.startsWith('/api/components/')) {
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
    if (req.method === 'POST' && pathname.match(/\/api\/components\/[^\/]+\/certify$/)) {
      const id = decodeURIComponent(pathname.split('/')[3]);
      const body = await parseJsonBody(req);

      try {
        const { output, txId } = await invokeChaincode(
          'CertifyComponent',
          [
            id,
            body.certificateID || 'CERT-001',
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

    if (req.method === 'POST' && pathname.match(/\/api\/components\/[^\/]+\/ship$/)) {
      const id = decodeURIComponent(pathname.split('/')[3]);
      const body = await parseJsonBody(req);

      try {
        const { output, txId } = await invokeChaincode(
          'ShipComponent',
          [
            id,
            body.from,
            body.to,
            body.shipmentID,
            body.shipmentDate
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
          message: `Component ${id} shipped successfully`,
          component,
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

    if (req.method === 'POST' && pathname.match(/\/api\/components\/[^\/]+\/receive$/)) {
      const id = decodeURIComponent(pathname.split('/')[3]);
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

    if (req.method === 'POST' && pathname.match(/\/api\/components\/[^\/]+\/transfer$/)) {
      const id = decodeURIComponent(pathname.split('/')[3]);
      const body = await parseJsonBody(req);

      try {
        const { output, txId } = await invokeChaincode(
          'TransferCustody',
          [
            id,
            body.to,
            body.location,
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

    if (req.method === 'POST' && pathname.match(/\/api\/components\/[^\/]+\/assemble$/)) {
      const id = decodeURIComponent(pathname.split('/')[3]);
      const body = await parseJsonBody(req);

      try {
        const { output, txId } = await invokeChaincode(
          'AssembleComponent',
          [
            id,
            body.assemblyID,
            body.location
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

    if (req.method === 'GET' && pathname.match(/\/api\/components\/[^\/]+\/history$/)) {
      const id = decodeURIComponent(pathname.split('/')[3]);

      try {
        const historyStr = await queryChaincode(
          'GetComponentHistory',
          [id],
          identity
        );

        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(historyStr);
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
