/**
 * ──────────────────────────────────────────────────
 *  Explain Controller – POST /api/explain
 * ──────────────────────────────────────────────────
 */
const gemini = require('../services/geminiService');
const { ValidationError } = require('../utils/errors');
const parseRepoURL = require('../utils/parseRepoURL');
const github = require('../services/githubService');

async function explain(req, res, next) {
  try {
    const { code, filename, repoUrl } = req.body;

    if (!code && (!repoUrl || !filename)) {
      throw new ValidationError('Either code OR (repoUrl and filename) must be provided.');
    }

    let fileContent = code;
    if (!fileContent) {
      const { owner, repo } = parseRepoURL(repoUrl);
      fileContent = await github.fetchFileContent(owner, repo, filename);
    }

    if (!fileContent || typeof fileContent !== 'string') {
      throw new ValidationError('Could not extract file content.');
    }

    const summary = await gemini.explainCode(fileContent, filename || 'unknown', repoUrl || 'unknown');

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
