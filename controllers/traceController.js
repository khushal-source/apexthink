/**
 * ──────────────────────────────────────────────────
 *  Trace Controller – POST /api/trace
 * ──────────────────────────────────────────────────
 */
const parseRepoURL = require('../utils/parseRepoURL');
const github = require('../services/githubService');
const analysis = require('../services/analysisService');
const { ValidationError, NotFoundError } = require('../utils/errors');

async function traceExecution(req, res, next) {
  try {
    const { entry, repoUrl } = req.body;

    if (!entry || typeof entry !== 'string') {
      throw new ValidationError('entry (string) is required – the entry-point file path');
    }
    if (!repoUrl) {
      throw new ValidationError('repoUrl is required');
    }

    const { owner, repo } = parseRepoURL(repoUrl);
    const files = await github.fetchAnalysableFiles(owner, repo);
    const graph = analysis.buildDependencyGraph(files);

    // Find the entry file (flexible matching)
    const entryPath = graph.nodes.find(
      (n) =>
        n === entry ||
        n.endsWith(`/${entry}`) ||
        n.endsWith(`\\${entry}`)
    );

    if (!entryPath) {
      throw new NotFoundError(
        `Entry file "${entry}" not found. Available files: ${graph.nodes.slice(0, 10).join(', ')}...`
      );
    }

    const flow = analysis.traceExecution(entryPath, graph.adjacency);

    res.json({
      success: true,
      data: {
        entry: entryPath,
        flow,
        depth: flow.length,
      },
    });
  } catch (err) {
    next(err);
  }
}

module.exports = { traceExecution };
