const http2 = require('http2');             
const PORT = process.env.PORT || 3002;

// crea il server con limiti stretti
const server = http2.createServer({allowHTTP1: false,
  maxSessionMemory: Number(process.env.MAX_SESSION_MEMORY || 3), 
  // ⤷ Limite di memoria per lo stato di sessione HTTP/2 (buffer header parziali, tabelle, ecc.)
  //    Valore molto basso per ridurre lo "stato parziale" a disposizione dell'attaccante

  maxHeaderListPairs: Number(process.env.MAX_HEADER_LIST_PAIRS || 50),
  // ⤷ Numero massimo di coppie header (chiave:valore) accettate; blocca richieste eccessive o abusive

  maxSendHeaderBlockLength: Number(process.env.MAX_SEND_HEADER_BLOCK_LENGTH || 32 * 1024),
  // ⤷ Limita la dimensione del blocco di header IN USCITA; non è la difesa principale,
  //    ma evita di contribuire a pressioni di memoria lato server

  maxSessionInvalidFrames: Number(process.env.MAX_SESSION_INVALID_FRAMES || 5)
  // ⤷ Dopo un numero ridotto di frame invalidi la sessione viene considerata compromessa e si chiude
}, (req, res) => {
  res.setHeader('content-type', 'text/plain'); 
  res.end('ok\n');  
});

// 4) mitigazioni a livello di sessione
server.on('session', (session) => {
  let openStreams = 0; // Contatore stream aperti nella stessa sessione (per limitare il multiplexing)

  // timeout di sessione molto corto: chiudi se il peer resta "appeso"
  try { session.setTimeout(1000, () => { try { session.close(); } catch {} }); } catch {}
  // ⤷ Se entro 1s non si conclude niente di significativo, chiude l'intera sessione.
  //    Riduce la finestra temporale utile per mantenere header parziali nei buffer nativi.

  // invia GOAWAY presto (limita nuove stream)
  try { session.goaway(http2.constants.NGHTTP2_NO_ERROR); } catch {}
  // ⤷ Indica al client che non saranno accettati nuovi stream su questa connessione (no long-lived session)

  session.on('stream', (stream) => {
    // consenti al massimo 1 stream per sessione; rifiuta le altre
    if (++openStreams > 1) {
      try { stream.close(http2.constants.NGHTTP2_REFUSED_STREAM); } catch {}
      // ⤷ Niente multiplexing: lo stream extra viene rifiutato. Semplifica lo stato interno.
      return;
    }

    // timeout breve per completare gli header/body
    const t = setTimeout(() => {
      try { stream.close(http2.constants.NGHTTP2_CANCEL); } catch {}
    }, Number(process.env.HEADER_TIMEOUT_MS || 1000));
    // ⤷ Se gli header/il body non arrivano in fretta, chiude lo stream.
    //    Accorcia la durata di possibili blocchi HEADERS/CONTINUATION incompleti.

    const clear = () => { clearTimeout(t); if (openStreams > 0) openStreams--; };
    // ⤷ Utility per sganciare il timeout e decrementare il contatore stream

    stream.on('end', clear);

    stream.on('close', () => {
      clear();
      // dopo il primo stream, chiudi la sessione (no keep-alive su h2)
      try { session.close(); } catch {}
      // ⤷ Chiude l'intera sessione subito dopo il primo stream completato:
      //    impedisce all'attaccante di mantenere la connessione viva per orchestrare la race
    });

    stream.on('error', () => { clear(); try { stream.close(); } catch {} });
    // ⤷ Errori sullo stream => chiudi lo stream (fail-fast)
  });

  // se arrivano SETTINGS (il PoC ne manda tanti), ribadisci GOAWAY
  session.on('remoteSettings', () => { try { session.goaway(); } catch {} });

  // errori → chiudi la sessione
  session.on('error', () => { try { session.close(); } catch {} });
  // ⤷ Qualsiasi errore di sessione porta alla chiusura immediata (evita stati intermedi)
});

server.on('error', (err) => console.error('Server error:', err?.message));
server.listen(PORT, () => {
  console.log(`Fixed (aggressive) HTTP/2 server listening on ${PORT}`);
});