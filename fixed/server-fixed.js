const http2 = require('http2');
const PORT = process.env.PORT || 3002;

// 3) crea il server con limiti stretti
const server = http2.createServer({
  allowHTTP1: false,
  maxSessionMemory: Number(process.env.MAX_SESSION_MEMORY || 3),          // MB
  maxHeaderListPairs: Number(process.env.MAX_HEADER_LIST_PAIRS || 50),
  maxSendHeaderBlockLength: Number(process.env.MAX_SEND_HEADER_BLOCK_LENGTH || 32 * 1024),
  maxSessionInvalidFrames: Number(process.env.MAX_SESSION_INVALID_FRAMES || 5)
}, (req, res) => {
  res.setHeader('content-type', 'text/plain');
  res.end('ok\n');
});

// 4) mitigazioni a livello di sessione (chiusura rapida)
server.on('session', (session) => {
  let openStreams = 0;

  // timeout di sessione molto corto: chiudi se il peer resta "appeso"
  try { session.setTimeout(1000, () => { try { session.close(); } catch {} }); } catch {}

  // invia GOAWAY presto (limita nuove stream)
  try { session.goaway(http2.constants.NGHTTP2_NO_ERROR); } catch {}

  session.on('stream', (stream) => {
    // consenti al massimo 1 stream per sessione; rifiuta le altre
    if (++openStreams > 1) {
      try { stream.close(http2.constants.NGHTTP2_REFUSED_STREAM); } catch {}
      return;
    }

    // timeout breve per completare gli header/body
    const t = setTimeout(() => {
      try { stream.close(http2.constants.NGHTTP2_CANCEL); } catch {}
    }, Number(process.env.HEADER_TIMEOUT_MS || 1000));

    const clear = () => { clearTimeout(t); if (openStreams > 0) openStreams--; };

    stream.on('end', clear);
    stream.on('close', () => {
      clear();
      // dopo il primo stream, chiudi la sessione (no keep-alive su h2)
      try { session.close(); } catch {}
    });
    stream.on('error', () => { clear(); try { stream.close(); } catch {} });
  });

  // se arrivano SETTINGS (il PoC ne manda tanti), ribadisci GOAWAY
  session.on('remoteSettings', () => { try { session.goaway(); } catch {} });

  // errori → chiudi la sessione
  session.on('error', () => { try { session.close(); } catch {} });
});

server.on('error', (err) => console.error('Server error:', err?.message));

server.listen(PORT, () => {
  console.log(`Fixed (aggressive) HTTP/2 server listening on ${PORT}`);
});
