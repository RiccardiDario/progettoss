// Server HTTP/2 minimale

 // importa il modulo http2 di Node
const http2 = require('http2');

 // prendi la porta da env o usa 3000
const PORT = process.env.PORT || 3000;

 // log avvio server
console.log('Starting VULNERABLE HTTP/2 server on port', PORT);

 // crea il server HTTP/2 (solo h2, no HTTP/1.1)
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
  session.on('error', (err) => {console.error('Session error:', err && err.message);});
  // logga quando la sessione viene chiusa
  session.on('close', () => { console.log('Session closed');});
});

 // log errori a livello di server
server.on('error', (err) => {console.error('Server error:', err && err.message);});

 // metti il server in ascolto sulla porta configurata
server.listen(PORT, () => {console.log(`VULNERABLE HTTP/2 server listening on port ${PORT}`);});

 // cattura SIGINT (Ctrl+C / stop) per shutdown pulito
process.on('SIGINT', () => {
  console.log('SIGINT: shutting down');
  // chiude il server e poi termina il processo
  server.close(() => process.exit(0));
});
