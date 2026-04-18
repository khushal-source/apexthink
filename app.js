/**
 * ══════════════════════════════════════════════════
 *  CodeMap AI – Advanced Repository Intelligence
 *  Main Application Entry Point
 * ══════════════════════════════════════════════════
 */
const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const config = require('./config');
const routes = require('./routes');

const app = express();

// ─── Global Middleware ───
app.use(cors());
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));

// ─── Rate Limiting ───
const limiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: {
      code: 'RATE_LIMIT',
      message: 'Too many requests – please slow down',
    },
  },
});
app.use('/api', limiter);

// ─── Request Logger ───
app.use((req, _res, next) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${req.method} ${req.originalUrl}`);
  next();
});

// ─── Routes ───
app.use('/api', routes);

// ─── Root ───
app.get('/', (_req, res) => {
  res.json({
    name: 'CodeMap AI',
    tagline: 'Advanced Repository Intelligence Platform',
    version: '1.0.0',
    endpoints: {
      health: 'GET  /api/health',
      repo:   'GET  /api/repo?url=<github_url>',
      chat:   'POST /api/chat          { query, repoUrl }',
      history:'GET  /api/history?url=<github_url>&count=20',
      trace:  'POST /api/trace         { entry, repoUrl }',
      score:  'GET  /api/score?url=<github_url>',
      search: 'GET  /api/search?url=<github_url>&q=<search_term>',
      explain:'POST /api/explain       { code, filename }',
    },
    docs: 'See README.md for full documentation',
  });
});

// ─── 404 Handler ───
app.use((_req, res) => {
  res.status(404).json({
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: 'Endpoint not found',
    },
  });
});

// ─── Global Error Handler ───
app.use((err, _req, res, _next) => {
  const statusCode = err.statusCode || 500;
  const code = err.code || 'INTERNAL_ERROR';

  // Log the full error server-side
  if (statusCode >= 500) {
    console.error('🔴 Server Error:', err);
  } else {
    console.warn(`⚠️  ${code}: ${err.message}`);
  }

  res.status(statusCode).json({
    success: false,
    error: {
      code,
      message: err.message || 'Something went wrong',
      ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
    },
  });
});

// ─── Start Server ───
app.listen(config.port, () => {
  console.log(`
  ╔══════════════════════════════════════════════════╗
  ║                                                  ║
  ║   🧠  CodeMap AI – Repository Intelligence       ║
  ║                                                  ║
  ║   🚀  Server running on port ${String(config.port).padEnd(5)}              ║
  ║   📡  http://localhost:${config.port}                     ║
  ║                                                  ║
  ║   🔑  GitHub Token: ${config.github.token ? '✅ Configured' : '❌ Missing'}            ║
  ║   🤖  Gemini Key:   ${config.gemini.apiKey ? '✅ Configured' : '❌ Missing'}            ║
  ║                                                  ║
  ╚══════════════════════════════════════════════════╝
  `);
});

module.exports = app;
