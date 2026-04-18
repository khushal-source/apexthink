/**
 * ──────────────────────────────────────────────────
 *  Score Controller – GET /api/score
 * ──────────────────────────────────────────────────
 */
const parseRepoURL = require('../utils/parseRepoURL');
const github = require('../services/githubService');
const analysis = require('../services/analysisService');

async function getScore(req, res, next) {
  try {
    const { url } = req.query;
    const { owner, repo } = parseRepoURL(url);

    const files = await github.fetchAnalysableFiles(owner, repo);
    const result = analysis.calculateConsistencyScore(files);

    res.json({
      success: true,
      data: {
        repo: `${owner}/${repo}`,
        ...result,
      },
    });
  } catch (err) {
    next(err);
  }
}

module.exports = { getScore };
