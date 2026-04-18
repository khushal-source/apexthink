/**
 * ──────────────────────────────────────────
 *  API Routes – Central route registry
 * ──────────────────────────────────────────
 */
const { Router } = require('express');

const repoController = require('../controllers/repoController');
const chatController = require('../controllers/chatController');
const historyController = require('../controllers/historyController');
const traceController = require('../controllers/traceController');
const scoreController = require('../controllers/scoreController');
const searchController = require('../controllers/searchController');
const explainController = require('../controllers/explainController');

const router = Router();

// ─── Health check ───
router.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'CodeMap AI',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
  });
});

// ─── Core Endpoints ───
router.get('/repo', repoController.analyseRepo);
router.post('/chat', chatController.chat);
router.get('/history', historyController.getHistory);
router.post('/trace', traceController.traceExecution);
router.get('/score', scoreController.getScore);
router.get('/search', searchController.search);
router.post('/explain', explainController.explain);

module.exports = router;
