/**
 * ──────────────────────────────────────────────────
 *  Repo Controller – GET /api/repo
 * ──────────────────────────────────────────────────
 */
const parseRepoURL = require('../utils/parseRepoURL');
const github = require('../services/githubService');
const analysis = require('../services/analysisService');

/**
 * Full repository analysis endpoint.
 * Query params: url (required)
 */
async function analyseRepo(req, res, next) {
  try {
    const { url } = req.query;
    const { owner, repo } = parseRepoURL(url);

    // Parallel fetch: meta + tree + files
    const [meta, tree, files] = await Promise.all([
      github.fetchRepoMeta(owner, repo),
      github.fetchRepoTree(owner, repo),
      github.fetchAnalysableFiles(owner, repo),
    ]);

    // Build dependency graph
    const graph = analysis.buildDependencyGraph(files);

    // Detect high-impact files
    const highImpact = analysis.detectHighImpactFiles(graph.reverseAdjacency);

    // File-level summary (without full content to keep response light)
    const fileSummaries = files.map((f) => ({
      path: f.path,
      size: f.size,
      lines: f.content.split('\n').length,
      imports: analysis.extractImports(f.content).length,
      highImpact: highImpact.some((h) => h.file === f.path && h.highImpact),
    }));

    res.json({
      success: true,
      data: {
        meta,
        structure: {
          totalItems: tree.length,
          files: tree.filter((t) => t.type === 'blob').length,
          directories: tree.filter((t) => t.type === 'tree').length,
        },
        fileSummaries,
        dependencyGraph: {
          nodes: graph.nodes,
          edges: graph.edges,
          totalNodes: graph.nodes.length,
          totalEdges: graph.edges.length,
        },
        highImpactFiles: highImpact.filter((h) => h.highImpact),
      },
    });
  } catch (err) {
    next(err);
  }
}

module.exports = { analyseRepo };
