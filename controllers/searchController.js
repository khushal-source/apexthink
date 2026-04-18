/**
 * ──────────────────────────────────────────────────
 *  Search Controller – GET /api/search
 * ──────────────────────────────────────────────────
 */
const parseRepoURL = require('../utils/parseRepoURL');
const github = require('../services/githubService');
const analysis = require('../services/analysisService');
const { ValidationError } = require('../utils/errors');

async function search(req, res, next) {
  try {
    const { q, url } = req.query;

    if (!q || typeof q !== 'string') {
      throw new ValidationError('q (search query) is required');
    }
    if (!url) {
      throw new ValidationError('url (repository URL) is required');
    }

    const { owner, repo } = parseRepoURL(url);
    const files = await github.fetchAnalysableFiles(owner, repo);
    const results = analysis.searchFiles(files, q);

    res.json({
      success: true,
      data: {
        query: q,
        totalResults: results.length,
        results: results.slice(0, 20),
      },
    });
  } catch (err) {
    next(err);
  }
}

module.exports = { search };
