/**
 * ──────────────────────────────────────────────────
 *  History Controller – GET /api/history
 * ──────────────────────────────────────────────────
 */
const parseRepoURL = require('../utils/parseRepoURL');
const github = require('../services/githubService');

async function getHistory(req, res, next) {
  try {
    const { url, count } = req.query;
    const { owner, repo } = parseRepoURL(url);

    const limit = Math.min(parseInt(count, 10) || 20, 100);
    const commits = await github.fetchCommits(owner, repo, limit);

    res.json({
      success: true,
      data: {
        repo: `${owner}/${repo}`,
        totalReturned: commits.length,
        commits,
      },
    });
  } catch (err) {
    next(err);
  }
}

module.exports = { getHistory };
