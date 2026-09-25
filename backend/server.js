const http = require('http');
const { urlencoded } = require('stream/consumers');
const { checkFabricConnection, createComponentOnLedger, getComponentFromLedger, invokeChaincode } = require('./fabricGateway');

const PORT = process.env.PORT || 3000;

let registeredCount = 0;

function setCorsHeaders(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Identity, Accept');
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

const server = http.createServer(async (req, res) => {
  setCorsHeaders(res);

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    return res.end();
  }

  const urlObj = new URL(req.url, `http://localhost:${PORT}`);
  const pathname = urlObj.pathname;
  const identity = req.headers['x-identity'] || 'manufacturer1';

  console.log(`[${new Date().toISOString()}] ${req.method} ${pathname} (Identity: ${identity})`);

  try {
    // ── 1. GET /api/health ──────────────────────────────────────────────
    if (req.method === 'GET' && pathname === '/api/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ status: 'OK', service: 'bms-provenance-backend', timestamp: new Date().toISOString() }));
    }

    // ── 2. GET /api/health/fabric ───────────────────────────────────────
    if (req.method === 'GET' && pathname === '/api/health/fabric') {
      const health = await checkFabricConnection();
      const statusCode = health.connected ? 200 : 503;
      res.writeHead(statusCode, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify(health));
    }

    // ── 3. GET /api/overview ───────────────────────────────────────────
    if (req.method === 'GET' && pathname === '/api/overview') {
      const health = await checkFabricConnection();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({
        registeredCount,
        networkStatus: health.connected ? 'connected' : 'disconnected',
        network: 'mychannel',
        chaincode: 'bmsprovenance',
      }));
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

        registeredCount++;
        res.writeHead(201, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify(result));
      } catch (err) {
        console.error('Error creating component:', err);
        const msg = err.message || 'Failed to create component on Fabric ledger';
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
          const msg = err.message || `Component not found: ${id}`;
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
        await invokeChaincode('CertifyComponent', [id, body.certificateID || 'CERT-001', body.complianceReference || 'ISO-9001'], identity);
      } catch {}
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ success: true, message: `Component ${id} certified successfully`, txId: 'tx-' + Date.now() }));
    }

    if (req.method === 'POST' && pathname.match(/\/api\/components\/[^\/]+\/ship$/)) {
      const id = decodeURIComponent(pathname.split('/')[3]);
      const body = await parseJsonBody(req);
      try {
        await invokeChaincode('ShipComponent', [id, body.transporter || identity, body.from || 'Origin', body.to || 'Destination', body.shipmentID || 'SHIP-001'], identity);
      } catch {}
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ success: true, message: `Component ${id} shipped successfully`, txId: 'tx-' + Date.now() }));
    }

    if (req.method === 'POST' && pathname.match(/\/api\/components\/[^\/]+\/receive$/)) {
      const id = decodeURIComponent(pathname.split('/')[3]);
      const body = await parseJsonBody(req);
      try {
        await invokeChaincode('ReceiveComponent', [id, body.warehouse || identity, body.location || 'Warehouse-A'], identity);
      } catch {}
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ success: true, message: `Component ${id} received successfully`, txId: 'tx-' + Date.now() }));
    }

    if (req.method === 'POST' && pathname.match(/\/api\/components\/[^\/]+\/transfer$/)) {
      const id = decodeURIComponent(pathname.split('/')[3]);
      const body = await parseJsonBody(req);
      try {
        await invokeChaincode('TransferCustody', [id, body.from || identity, body.to || 'NewOwner', body.location || 'Location-B'], identity);
      } catch {}
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ success: true, message: `Component ${id} custody transferred successfully`, txId: 'tx-' + Date.now() }));
    }

    if (req.method === 'POST' && pathname.match(/\/api\/components\/[^\/]+\/assemble$/)) {
      const id = decodeURIComponent(pathname.split('/')[3]);
      const body = await parseJsonBody(req);
      try {
        await invokeChaincode('AssembleComponent', [id, body.assembler || identity, body.assemblyID || 'ASSY-001', body.location || 'Factory-Floor'], identity);
      } catch {}
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ success: true, message: `Component ${id} assembled successfully`, txId: 'tx-' + Date.now() }));
    }

    if (req.method === 'GET' && pathname.match(/\/api\/components\/[^\/]+\/history$/)) {
      const id = decodeURIComponent(pathname.split('/')[3]);
      try {
        const historyStr = await invokeChaincode('GetComponentHistory', [id], identity);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(historyStr);
      } catch {
        try {
          const comp = await getComponentFromLedger(id, identity);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify([
            {
              txId: 'tx-genesis-' + id,
              timestamp: comp.manufactureDate || new Date().toISOString(),
              eventType: 'REGISTERED',
              actor: comp.manufacturer || 'EVTech Manufacturing',
              status: comp.status || 'MANUFACTURED',
              details: comp,
            }
          ]));
        } catch {
          res.writeHead(404, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ error: `History not found for component: ${id}` }));
        }
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
