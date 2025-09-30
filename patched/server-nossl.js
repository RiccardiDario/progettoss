// server-nossl.js
// Minimal HTTP/2 server (cleartext/h2c) pensato per laboratorio CVE-2024-27983
// Include opzioni di configurazione per limitare risorse e un semplice timeout sugli header.


const http2 = require('http2');
const { pipeline } = require('stream');


// Configurazione: modifica questi valori per testare diverse mitigazioni
const CONFIG = {
PORT: process.env.PORT || 3000,
// Limiti http2 (valori esempi, adattali alle esigenze del test)
maxSessionMemory: Number(process.env.MAX_SESSION_MEMORY || 5), // MB
maxHeaderListPairs: Number(process.env.MAX_HEADER_LIST_PAIRS || 200),
maxSendHeaderBlockLength: Number(process.env.MAX_SEND_HEADER_BLOCK_LENGTH || 64 * 1024), // bytes
maxSessionInvalidFrames: Number(process.env.MAX_SESSION_INVALID_FRAMES || 50),
HEADER_TIMEOUT_MS: Number(process.env.HEADER_TIMEOUT_MS || 3000), // ms: tempo massimo per completare gli header
};


console.log('Starting HTTP/2 server (no TLS) with config:', CONFIG);


const server = http2.createServer({
allowHTTP1: false,
maxSessionMemory: CONFIG.maxSessionMemory,
maxHeaderListPairs: CONFIG.maxHeaderListPairs,
maxSendHeaderBlockLength: CONFIG.maxSendHeaderBlockLength,
maxSessionInvalidFrames: CONFIG.maxSessionInvalidFrames,
}, (req, res) => {
// Questo callback viene chiamato per ogni request/stream quando gli headers sono già assemblati
console.log(`[${new Date().toISOString()}] Request: `, { method: req.method, url: req.url, headers: req.headers });


// Gestione semplice: rispondi e chiudi
res.setHeader('content-type', 'text/plain');
res.end('ok\n');
});


// Applica timeout sugli header/stream: se un nuovo stream non riceve END_HEADERS entro HEADER_TIMEOUT_MS
// lo distruggiamo per evitare header incompleti che restino in memoria.
server.on('session', (session) => {
// session è un Http2Session
session.on('stream', (stream, headers) => {
// Quando lo stream viene creato, impostiamo un timeout che distrugga lo stream se non arriva
// l'evento 'end' del body (per request con body) entro HEADER_TIMEOUT_MS
let headerTimer = setTimeout(() => {
try {
console.warn('Header timeout - destroying stream');
stream.close(http2.constants.NGHTTP2_CANCEL);
} catch (e) {
// ignore
}
}, CONFIG.HEADER_TIMEOUT_MS);


// Se i dati finiscono o lo stream viene chiuso, cancelliamo il timer
stream.on('end', () => clearTimeout(headerTimer));
stream.on('close', () => clearTimeout(headerTimer));
stream.on('error', (err) => {
console.error('Stream error:', err && err.message);
clearTimeout(headerTimer);
});
});
});