#!/usr/bin/env node

// MoodBored AI Bridge
// A lightweight local proxy that allows the web app to connect to local AI providers
// Run this script locally, then connect from the web app

const http = require('http');
const https = require('https');
const { URL } = require('url');

const PORT = process.env.BRIDGE_PORT || 3001;
const ALLOWED_ORIGINS = [
  'http://localhost:3000',
  'http://localhost:5173',
  'http://localhost:1420',
  'https://moodbored-production.up.railway.app',
  'https://moodbored.app',
];

// Local AI provider configurations
const PROVIDERS = {
  lmstudio: {
    name: 'LM Studio',
    defaultUrl: 'http://localhost:1234',
    endpoints: {
      chat: '/v1/chat/completions',
      models: '/v1/models',
    },
  },
  ollama: {
    name: 'Ollama',
    defaultUrl: 'http://localhost:11434',
    endpoints: {
      chat: '/api/chat',
      models: '/api/tags',
    },
  },
  automatic1111: {
    name: 'Automatic1111',
    defaultUrl: 'http://localhost:7860',
    endpoints: {
      generate: '/sdapi/v1/txt2img',
      models: '/sdapi/v1/sd-models',
    },
  },
  comfyui: {
    name: 'ComfyUI',
    defaultUrl: 'http://localhost:8188',
    endpoints: {
      prompt: '/prompt',
      history: '/history',
    },
  },
  invokeai: {
    name: 'Invoke AI',
    defaultUrl: 'http://localhost:9090',
    endpoints: {
      sessions: '/api/v1/sessions/',
      queue: '/api/v1/queue/default/enqueue',
      images: '/api/v1/images/',
    },
  },
};

// Create HTTP server
const server = http.createServer((req, res) => {
  // CORS headers
  const origin = req.headers.origin;
  if (ALLOWED_ORIGINS.includes(origin) || !origin) {
    res.setHeader('Access-Control-Allow-Origin', origin || '*');
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Credentials', 'true');

  // Handle preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // Parse URL
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const path = url.pathname;

  // Health check
  if (path === '/health' || path === '/') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'ok',
      message: 'MoodBored AI Bridge is running',
      providers: Object.keys(PROVIDERS),
      usage: 'POST /proxy/:provider/:endpoint to proxy requests',
    }));
    return;
  }

  // List available providers
  if (path === '/providers') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(PROVIDERS));
    return;
  }

  // Check provider status
  if (path.startsWith('/status/')) {
    const provider = path.split('/')[2];
    checkProviderStatus(provider, res);
    return;
  }

  // Proxy requests to local AI providers
  if (path.startsWith('/proxy/')) {
    const parts = path.split('/');
    const provider = parts[2];
    const endpoint = parts.slice(3).join('/');

    if (!PROVIDERS[provider]) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: `Unknown provider: ${provider}` }));
      return;
    }

    proxyRequest(req, res, provider, endpoint);
    return;
  }

  // 404
  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Not found' }));
});

// Check if a provider is running
async function checkProviderStatus(provider, res) {
  const config = PROVIDERS[provider];
  if (!config) {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: `Unknown provider: ${provider}` }));
    return;
  }

  const url = config.defaultUrl;

  try {
    const response = await fetch(url, { method: 'GET', signal: AbortSignal.timeout(3000) });
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      provider,
      name: config.name,
      url,
      status: 'connected',
      httpStatus: response.status,
    }));
  } catch (err) {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      provider,
      name: config.name,
      url,
      status: 'disconnected',
      error: err.message,
    }));
  }
}

// Proxy request to local AI provider
async function proxyRequest(req, res, provider, endpoint) {
  const config = PROVIDERS[provider];
  const targetUrl = `${config.defaultUrl}/${endpoint}`;

  // Read request body
  let body = '';
  for await (const chunk of req) {
    body += chunk;
  }

  try {
    const url = new URL(targetUrl);
    const isHttps = url.protocol === 'https:';
    const httpModule = isHttps ? https : http;

    const options = {
      hostname: url.hostname,
      port: url.port || (isHttps ? 443 : 80),
      path: url.pathname + url.search,
      method: req.method,
      headers: {
        'Content-Type': req.headers['content-type'] || 'application/json',
        'Accept': 'application/json',
      },
    };

    const proxyReq = httpModule.request(options, (proxyRes) => {
      // Copy response headers
      const headers = { ...proxyRes.headers };
      headers['access-control-Allow-Origin'] = req.headers.origin || '*';

      res.writeHead(proxyRes.statusCode, headers);
      proxyRes.pipe(res);
    });

    proxyReq.on('error', (err) => {
      console.error(`[Bridge] Proxy error for ${provider}:`, err.message);
      res.writeHead(502, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        error: `Failed to connect to ${config.name}`,
        details: err.message,
        suggestion: `Make sure ${config.name} is running on ${config.defaultUrl}`,
      }));
    });

    if (body) {
      proxyReq.write(body);
    }
    proxyReq.end();
  } catch (err) {
    console.error(`[Bridge] Error proxying to ${provider}:`, err);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: err.message }));
  }
}

// Start server
server.listen(PORT, () => {
  console.log(`
╔═══════════════════════════════════════════════════════════════╗
║                  MoodBored AI Bridge                         ║
║                  Running on port ${PORT}                          ║
╚═══════════════════════════════════════════════════════════════╝

Available providers:
${Object.entries(PROVIDERS).map(([key, config]) => `  • ${config.name} (${config.defaultUrl})`).join('\n')}

Usage:
  GET  /                     - Health check
  GET  /providers            - List providers
  GET  /status/:provider     - Check provider status
  POST /proxy/:provider/*    - Proxy requests

Example:
  curl http://localhost:${PORT}/status/lmstudio
  curl -X POST http://localhost:${PORT}/proxy/lmstudio/v1/chat/completions \\
    -H "Content-Type: application/json" \\
    -d '{"model":"llama3","messages":[{"role":"user","content":"Hello"}]}'

Connect from MoodBored web app:
  1. Open MoodBored in browser
  2. Go to Settings → AI Provider
  3. Select "Custom Endpoint"
  4. Set URL to: http://localhost:${PORT}/proxy/lmstudio
  `);
});