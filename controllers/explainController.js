/**
 * ──────────────────────────────────────────────────
 *  Explain Controller – POST /api/explain
 * ──────────────────────────────────────────────────
 */
const gemini = require('../services/geminiService');
const { ValidationError } = require('../utils/errors');

async function explain(req, res, next) {
  try {
    const { code, filename } = req.body;

    if (!code || typeof code !== 'string') {
      throw new ValidationError('code (string) is required');
    }

    const summary = await gemini.explainCode(code, filename || 'unknown');

    res.json({
      success: true,
      data: {
        filename: filename || 'unknown',
        summary,
      },
    });
  } catch (err) {
    next(err);
  }
}

module.exports = { explain };
