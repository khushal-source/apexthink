/**
 * ──────────────────────────────────────────────────
 *  Onboarding Controller – POST /api/onboarding
 * ──────────────────────────────────────────────────
 */
const parseRepoURL = require('../utils/parseRepoURL');
const github = require('../services/githubService');
const gemini = require('../services/geminiService');
const { ValidationError } = require('../utils/errors');

// ── Static fallback: categorizes raw file paths by name pattern ──
function buildFallbackPath(fileList) {
  const files = fileList.map(f => (typeof f === 'string' ? f : f.id || f.path || '').trim()).filter(Boolean);

  const entryFiles    = files.filter(f => /\b(index|main|app|server|start)\b.*\.(js|ts|jsx|tsx|py)$/i.test(f));
  const controllers   = files.filter(f => /controller|route|router/i.test(f));
  const services      = files.filter(f => /service|provider/i.test(f));
  const models        = files.filter(f => /model|schema|entity/i.test(f));
  const utils         = files.filter(f => /util|helper|common|shared|middleware/i.test(f));
  const config        = files.filter(f => /config|env|setting/i.test(f));

  // Build ordered groups, skipping empties
  const groups = [
    { title: 'Entry Points',       role: 'entry',      files: entryFiles.slice(0, 3),    description: 'These files bootstrap the application. Start here to understand how everything kicks off.' },
    { title: 'Controllers / Routes', role: 'core',     files: controllers.slice(0, 3),   description: 'Route handlers orchestrate incoming requests and call the right services.' },
    { title: 'Services / Business Logic', role: 'service', files: services.slice(0, 3), description: 'Services contain the core business logic and external API integrations.' },
    { title: 'Models / Schemas',   role: 'model',      files: models.slice(0, 3),        description: 'Data models define the structure stored in the database.' },
    { title: 'Utilities & Helpers', role: 'utility',   files: utils.slice(0, 3),         description: 'Shared helper functions used across the codebase.' },
    { title: 'Configuration',      role: 'config',     files: config.slice(0, 2),        description: 'Environment variables and app-wide configuration live here.' },
  ].filter(g => g.files.length > 0);

  // If nothing matched patterns, just bucket files evenly into 4 steps
  if (groups.length === 0) {
    const chunk = Math.ceil(files.length / 4);
    return [
      { step: 1, title: 'First Files',  files: files.slice(0, chunk),           role: 'entry',   description: 'Start exploring these initial files.' },
      { step: 2, title: 'Core Files',   files: files.slice(chunk, chunk * 2),   role: 'core',    description: 'These form the core of the project.' },
      { step: 3, title: 'More Logic',   files: files.slice(chunk * 2, chunk * 3), role: 'utility', description: 'Supporting modules and helpers.' },
      { step: 4, title: 'Remaining',    files: files.slice(chunk * 3),           role: 'utility', description: 'Remaining files to explore.' },
    ].filter(g => g.files.length > 0);
  }

  return groups.map((g, i) => ({
    step: i + 1,
    title: g.title,
    files: g.files,
    role: g.role,
    description: g.description,
    why_next: i < groups.length - 1 ? `Knowing "${g.title}" helps you understand "${groups[i + 1].title}" next.` : 'You now have a full picture of this codebase!'
  }));
}

const onboardingCache = new Map();

async function generateOnboarding(req, res, next) {
  try {
    const { repoUrl, nodes, edges, bust } = req.body;

    if (!repoUrl) throw new ValidationError('repoUrl is required');

    // Cache check — skip if bust param present (user clicked Regenerate)
    if (!bust && onboardingCache.has(repoUrl)) {
      return res.json({ success: true, data: { path: onboardingCache.get(repoUrl), cached: true } });
    }

    // Build flat file list from nodes or GitHub
    let fileList = [];
    if (nodes && nodes.length > 0) {
      // nodes are raw string IDs from the frontend graph
      fileList = nodes.map(n => (typeof n === 'string' ? n : n.id || n.path || '')).filter(Boolean);
    } else {
      const { owner, repo } = parseRepoURL(repoUrl);
      const files = await github.fetchAnalysableFiles(owner, repo);
      fileList = files.map(f => f.path);
    }

    // Build compact context for AI
    const edgeList = (edges || []).slice(0, 40).map(e => `${e.source || e.from} -> ${e.target || e.to}`).join(', ');
    const structure = `Files: ${fileList.slice(0, 60).join(', ')}\n\nDependencies: ${edgeList}`;

    let finalPath = null;

    try {
      const aiPath = await gemini.generateOnboardingPath({ structure, repoUrl });
      console.log('AI Onboarding response:', JSON.stringify(aiPath).slice(0, 300));

      // Validate AI response: must be array with steps and real file/title fields
      if (Array.isArray(aiPath) && aiPath.length >= 3 && aiPath[0].file) {
        // Normalise single-file AI response into grouped format
        finalPath = aiPath.map((step, i) => ({
          step: step.step || i + 1,
          title: step.title || step.file,
          files: [step.file],
          role: (step.role || 'core').toLowerCase().replace('unknown', 'core'),
          description: step.reason || step.explanation || 'Explore this file.',
          why_next: step.why_next || ''
        }));
      } else if (Array.isArray(aiPath) && aiPath.length >= 1 && aiPath[0].title) {
        finalPath = aiPath; // already grouped
      }
    } catch (aiErr) {
      console.error('AI Onboarding failed, using static fallback:', aiErr.message);
    }

    // Always fall back to static analysis if AI gave nothing usable
    if (!finalPath || finalPath.length < 2) {
      finalPath = buildFallbackPath(fileList);
    }

    onboardingCache.set(repoUrl, finalPath);

    res.json({ success: true, data: { path: finalPath } });

  } catch (err) {
    next(err);
  }
}

module.exports = { generateOnboarding };
