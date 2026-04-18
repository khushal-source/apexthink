/**
 * ──────────────────────────────────────────────────
 *  Chat Controller – POST /api/chat
 * ──────────────────────────────────────────────────
 */
const parseRepoURL = require('../utils/parseRepoURL');
const github = require('../services/githubService');
const gemini = require('../services/geminiService');
const { ValidationError } = require('../utils/errors');

async function chat(req, res, next) {
  try {
    const { query, repoUrl } = req.body;

    if (!query || typeof query !== 'string') {
      throw new ValidationError('query (string) is required');
    }
    if (!repoUrl) {
      throw new ValidationError('repoUrl is required for context');
    }

    const { owner, repo } = parseRepoURL(repoUrl);

    // Fetch files for context
    const files = await github.fetchAnalysableFiles(owner, repo);

    // Build compact context
    const structure = files.map((f) => f.path).join('\n');
    const summaries = files
      .slice(0, 30) // limit context size
      .map((f) => {
        const snippet = f.content.slice(0, 500);
        return `### ${f.path}\n\`\`\`\n${snippet}\n\`\`\``;
      })
      .join('\n\n');

    const answer = await gemini.chatWithRepo(query, { structure, summaries });

    res.json({
      success: true,
      data: {
        query,
        answer,
        filesAnalysed: files.length,
      },
    });
  } catch (err) {
    next(err);
  }
}

module.exports = { chat };
