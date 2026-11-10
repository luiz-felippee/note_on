/**
 * NoteOn - Servidor Local Open-WA (@open-wa/wa-automate)
 *
 * Para iniciar:
 * 1. npm install @open-wa/wa-automate
 * 2. node server/openwa-server.js
 *
 * Ele abrirá um QR Code no terminal. Escaneie pelo WhatsApp no celular (Aparelhos conectados).
 * Uma vez conectado, seu NoteOn enviará mensagens 100% automáticas e silenciosas para você!
 */

import { create, Client } from '@open-wa/wa-automate';
import http from 'http';

const PORT = process.env.PORT || 8080;
const API_KEY = process.env.API_KEY || ''; // Opcional, defina para proteger

console.log('Iniciando cliente Open-WA para NoteOn...');

create({
  sessionId: 'NOTEON_BOT',
  multiDevice: true,
  authTimeout: 60,
  blockCrashLogs: true,
  disableSpins: true,
  headless: true,
  hostNotificationIndicators: false,
  logConsole: false,
  popup: false,
  qrTimeout: 0,
})
  .then((client) => startServer(client))
  .catch((err) => console.error('Erro ao iniciar Open-WA:', err));

function startServer(client) {
  const server = http.createServer(async (req, res) => {
    // Enable CORS para permitir chamadas do NoteOn (localhost ou Vercel)
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, api_key, apikey, Authorization');

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    // Ping / Healthcheck
    if (req.url === '/ping' || req.url === '/check') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'ok', online: true, time: Date.now() }));
      return;
    }

    // Obter número conectado
    if (req.url === '/getHostNumber') {
      try {
        const hostNum = await client.getHostNumber();
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'ok', response: hostNum }));
      } catch (e) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: e.message }));
      }
      return;
    }

    // Endpoint de envio de mensagem
    if (req.method === 'POST' && (req.url === '/sendText' || req.url === '/api/send-message')) {
      // Validação de API Key se configurada
      if (API_KEY) {
        const reqKey = req.headers['api_key'] || req.headers['apikey'];
        if (reqKey !== API_KEY) {
          res.writeHead(401, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'API Key inválida' }));
          return;
        }
      }

      let body = '';
      req.on('data', (chunk) => {
        body += chunk;
      });

      req.on('end', async () => {
        try {
          const parsed = JSON.parse(body);
          const chatId =
            parsed?.args?.to ||
            parsed?.to ||
            parsed?.chatId ||
            (parsed?.phone ? `${parsed.phone}@c.us` : null) ||
            (parsed?.number ? `${parsed.number}@c.us` : null);

          const content =
            parsed?.args?.content ||
            parsed?.content ||
            parsed?.text ||
            parsed?.message;

          if (!chatId || !content) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'chatId ou content ausente' }));
            return;
          }

          console.log(`[Open-WA] Enviando mensagem de estudo para ${chatId}...`);
          const sendResult = await client.sendText(chatId, content);

          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true, result: sendResult }));
        } catch (err) {
          console.error('[Open-WA] Erro ao enviar mensagem:', err);
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: err.message }));
        }
      });
      return;
    }

    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Rota não encontrada' }));
  });

  server.listen(PORT, () => {
    console.log(`\n======================================================`);
    console.log(`🤖 NoteOn Open-WA Bot Server RODANDO na porta ${PORT}!`);
    console.log(`Endpoint: http://localhost:${PORT}/sendText`);
    console.log(`No NoteOn, coloque no campo Open-WA URL: http://localhost:${PORT}`);
    console.log(`======================================================\n`);
  });
}

