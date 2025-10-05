const http2 = require('http2');
const http = require('http');

const PORT = Number(process.env.PORT || 3000);
const PORT_HTTP1 = Number(process.env.PORT_HTTP1 || 3004);
console.log('Starting VULNERABLE HTTP/2 server on port', PORT);
const server = http2.createServer({ allowHTTP1: false }, (req, res) => {
  // log breve della richiesta ricevuta
  console.log(`[${new Date().toISOString()}] H2 Request`, { method: req.method, url: req.url, headers: req.headers });
  // header di risposta
  res.setHeader('content-type', 'text/plain');
  // rispondi e chiudi
  res.end('ok\n');
});

// session handlers 
server.on('session', (session) => {
  session.on('error', (err) => { console.error('H2 Session error:', err && err.message); });
  session.on('close', () => { console.log('H2 Session closed'); });
});
server.on('error', (err) => { console.error('H2 Server error:', err && err.message); });

// avvia H2 su porta 3000
server.listen(PORT, () => { console.log(`VULNERABLE HTTP/2 server listening on port ${PORT}`); });

console.log('Starting companion HTTP/1 server on port', PORT_HTTP1);

const server1 = http.createServer((req, res) => {
  console.log(`[${new Date().toISOString()}] H1 Request`, { method: req.method, url: req.url, headers: req.headers });
  // rispondi OK
  res.writeHead(200, { 'content-type': 'text/plain' });
  res.end('ok\n');
});

server1.on('error', (err) => { console.error('H1 Server error:', err && err.message); });
server1.listen(PORT_HTTP1, () => {
  console.log(`Minimal HTTP/1 server listening on port ${PORT_HTTP1}`);
});

 // cattura SIGINT (Ctrl+C / stop) per shutdown pulito
process.on('SIGINT', () => {
  console.log('SIGINT: shutting down servers');
  try { server.close(); } catch (e) {}
  try { server1.close(); } catch (e) {}
  process.exit(0);
});
