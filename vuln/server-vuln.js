// server-vuln.js
// Server vulnerabile HTTP/2 + server HTTP/1.1 separato nello stesso processo.
// HTTP/2: porta configurabile (default 3000) — LOGICA INALTERATA.
// HTTP/1: ascolta su porta fissa 3004 (per evitare conflitti con 3000..3003).

const http2 = require('http2');   // HTTP/2 (h2/h2c)
const http = require('http');     // HTTP/1

// porta principale per HTTP/2 (configurabile)
const PORT = Number(process.env.PORT || 3000);

// porta fissa per HTTP/1 (usa 3004 per non collidere con 3000..3003)
const PORT_HTTP1 = Number(process.env.PORT_HTTP1 || 3004);

// ---------- HTTP/2 server (LOGICA VULNERABILE INALTERATA) ----------
console.log('Starting VULNERABLE HTTP/2 server on port', PORT);

// crea il server HTTP/2 (mantieni allowHTTP1 come preferisci)
const server = http2.createServer({ allowHTTP1: true }, (req, res) => {
  // log breve della richiesta ricevuta
  console.log(`[${new Date().toISOString()}] H2 Request`, { method: req.method, url: req.url, headers: req.headers });
  // header di risposta
  res.setHeader('content-type', 'text/plain');
  // rispondi e chiudi
  res.end('ok\n');
});

// session handlers (non toccare)
server.on('session', (session) => {
  session.on('error', (err) => { console.error('H2 Session error:', err && err.message); });
  session.on('close', () => { console.log('H2 Session closed'); });
});

server.on('error', (err) => { console.error('H2 Server error:', err && err.message); });

// avvia H2 su porta 3000 (o quella in env)
server.listen(PORT, () => { console.log(`VULNERABLE HTTP/2 server listening on port ${PORT}`); });

// ---------- HTTP/1 server (aggiunto) ----------
console.log('Starting companion HTTP/1 server on port', PORT_HTTP1);

const server1 = http.createServer((req, res) => {
  // log minimale per H1
  console.log(`[${new Date().toISOString()}] H1 Request`, { method: req.method, url: req.url, headers: req.headers });
  // rispondi OK
  res.writeHead(200, { 'content-type': 'text/plain' });
  res.end('ok\n');
});

server1.on('error', (err) => { console.error('H1 Server error:', err && err.message); });

server1.listen(PORT_HTTP1, () => {
  console.log(`Minimal HTTP/1 server listening on port ${PORT_HTTP1}`);
});

// ---------- graceful shutdown ----------
process.on('SIGINT', () => {
  console.log('SIGINT: shutting down servers');
  try { server.close(); } catch (e) {}
  try { server1.close(); } catch (e) {}
  process.exit(0);
});
