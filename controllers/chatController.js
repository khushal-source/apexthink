/**
 * ──────────────────────────────────────────────────
 *  Chat Controller – POST /api/chat
 * ──────────────────────────────────────────────────
 */
const parseRepoURL = require('../utils/parseRepoURL');
const github = require('../services/githubService');
const gemini = require('../services/geminiService');
const { ValidationError } = require('../utils/errors');

const userCooldowns = new Map();

async function chat(req, res, next) {
  try {
    const { query, repoUrl } = req.body;

    if (!query || typeof query !== 'string') {
      throw new ValidationError('query (string) is required');
    }
    if (!repoUrl) {
      throw new ValidationError('repoUrl is required for context');
    }

    // 5. Add Cooldown (3 seconds) to prevent rapid repeated requests
    const now = Date.now();
    const lastRequest = userCooldowns.get(repoUrl) || 0;
    if (now - lastRequest < 3000) {
      return res.json({ success: true, data: { query, answer: "⚠️ Please slow down! Wait a few seconds before asking another question.", filesAnalysed: 0 }});
    }
    userCooldowns.set(repoUrl, now);

    // 6. Predefined Answers Logic (Saves API Quota)
    const qLower = query.toLowerCase();
    if (qLower.includes('auth') || qLower.includes('login')) {
       return res.json({ success: true, data: { query, answer: "**Authentication Context:** Usually managed inside `middleware.js` or standard routing files. It typically handles JWT tokens or session cookies. Check your backend routes.", filesAnalysed: 0 }});
    }
    if (qLower.includes('flow') || qLower.includes('architecture')) {
       return res.json({ success: true, data: { query, answer: "**Architectural Flow:** Code execution propagates from Entry Files down to Core Logic components. Use the Execution Trace feature to map exactly how files communicate.", filesAnalysed: 0 }});
    }
    if (qLower.includes('entry') || qLower.includes('start')) {
       return res.json({ success: true, data: { query, answer: "**Entry Points:** Execution generally starts at `index.js`, `app.js`, or `main.js`. Go to the **Onboarding Path** tab to get a deterministic generated starting point.", filesAnalysed: 0 }});
    }

    const { owner, repo } = parseRepoURL(repoUrl);

    // Fetch minimal context
    const files = await github.fetchAnalysableFiles(owner, repo);
    const structure = files.map((f) => f.path).join('\n');
    
    // Severely restrict summary payload to only 5 files to reduce Token Weight
    const summaries = files
      .slice(0, 5) 
      .map((f) => {
        const snippet = f.content.slice(0, 250);
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
