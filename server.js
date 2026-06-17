const http = require('http');
const fs = require('fs');
const path = require('path');

const HOST = '127.0.0.1';
const PORT = 3000;
const API_BASE = 'http://172.21.82.18:8081';
const ROOT = __dirname;

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.css': 'text/css; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8'
};

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, authorization, token, userName'
  });
  res.end(JSON.stringify(payload));
}

function sendFile(res, filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';

  fs.readFile(filePath, (error, data) => {
    if (error) {
      sendJson(res, 404, { message: 'File not found' });
      return;
    }

    res.writeHead(200, {
      'Content-Type': contentType,
      'Access-Control-Allow-Origin': '*'
    });
    res.end(data);
  });
}

async function proxyPods(req, res) {
  try {
    let rawBody = '';

    req.on('data', chunk => {
      rawBody += chunk;
    });

    req.on('end', async () => {
      const upstreamResponse = await fetch(`${API_BASE}/rest/pods`, {
        method: 'POST',
        headers: {
          authorization: 'mrbase64 mrrest:YWRtaW4mYWRtaW4=',
          token: 'root:eyJhbGciOiJIUzI1NiJ9.eyJjbGllbnRUeXBlIjoiIiwicm9sZUNvZGVzIjoiIiwidXNlckNvZGUiOiJyb290IiwiaWF0IjoxNzgxNjYzMzU2LCJleHAiOjE3ODE2NzY5MzR9.9HkdQHh3DsvnFKP5cCOHHp5aSlt3LQ5hDWd-WLH15CY',
          userName: 'root',
          'Content-Type': 'application/json'
        },
        body: rawBody
      });

      const responseText = await upstreamResponse.text();
      res.writeHead(upstreamResponse.status, {
        'Content-Type': upstreamResponse.headers.get('content-type') || 'application/json; charset=utf-8',
        'Access-Control-Allow-Origin': '*'
      });
      res.end(responseText);
    });
  } catch (error) {
    sendJson(res, 500, {
      message: 'Proxy request failed',
      error: error.message
    });
  }
}

const server = http.createServer((req, res) => {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, authorization, token, userName'
    });
    res.end();
    return;
  }

  if (req.url === '/rest/pods' && req.method === 'POST') {
    proxyPods(req, res);
    return;
  }

  const requestPath = req.url === '/' ? '/index.html' : req.url;
  const safePath = path.normalize(requestPath).replace(/^(\.\.[/\\])+/, '');
  const filePath = path.join(ROOT, safePath);

  if (!filePath.startsWith(ROOT)) {
    sendJson(res, 403, { message: 'Forbidden' });
    return;
  }

  sendFile(res, filePath);
});

server.listen(PORT, HOST, () => {
  console.log(`Server running at http://${HOST}:${PORT}`);
});
