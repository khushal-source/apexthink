/**
 * ──────────────────────────────────────────────────
 *  Score Controller – GET /api/score
 * ──────────────────────────────────────────────────
 */
const parseRepoURL = require('../utils/parseRepoURL');
const github = require('../services/githubService');
const analysis = require('../services/analysisService');
const { getCache, setCache } = require('../utils/cache');

async function getScore(req, res, next) {
  try {
    const { url } = req.query;
    const { owner, repo } = parseRepoURL(url);

    // Cache check — score is expensive (downloads all files)
    const cached = await getCache(url, '_', 'score');
    if (cached) {
      return res.json({ success: true, data: { repo: `${owner}/${repo}`, ...cached, cached: true } });
    }

    const files = await github.fetchAnalysableFiles(owner, repo);
    const result = analysis.calculateConsistencyScore(files);

    // Cache result for 6 hours
    await setCache(url, '_', 'score', result);

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
