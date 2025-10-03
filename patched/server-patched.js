const http2 = require('http2');
const PORT = process.env.PORT || 3001;

console.log('Starting PATCHED HTTP/2 server (no TLS) on port', PORT);
const server = http2.createServer({ allowHTTP1: false }, (req, res) => {
  // log breve della richiesta ricevuta
  console.log(`[${new Date().toISOString()}] Request`, { method: req.method, url: req.url, headers: req.headers });
  // imposta header di risposta Content-Type
  res.setHeader('content-type', 'text/plain');
  // scrive il body e chiude la risposta
  res.end('ok\n');
});

 // quando si crea una nuova sessione (connessione HTTP/2)
server.on('session', (session) => {
  // logga errori specifici di sessione
  session.on('error', (err) => {
    console.error('Session error:', err && err.message);
  });
  // logga quando la sessione viene chiusa
  session.on('close', () => {
    console.log('Session closed');
  });
});

 // log errori a livello di server
server.on('error', (err) => {
  console.error('Server error:', err && err.message);
});

 
server.listen(PORT, () => {
  console.log(`PATCHED HTTP/2 server listening on port ${PORT}`);
});

 // cattura SIGINT (Ctrl+C / stop) per shutdown pulito
process.on('SIGINT', () => {
  console.log('SIGINT: shutting down');
  // chiude il server e poi termina il processo
  server.close(() => process.exit(0));
});
