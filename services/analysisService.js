/**
 * ──────────────────────────────────────────────────
 *  Analysis Service – Dependency graph, scoring,
 *  execution tracing, high-impact detection
 * ──────────────────────────────────────────────────
 */
const path = require('path');

// ───────── Import / Require extraction ─────────

const IMPORT_PATTERNS = [
  // ES6:  import X from './foo'  |  import { X } from './foo'
  /import\s+(?:[\w*{}\s,]+)\s+from\s+['"]([^'"]+)['"]/g,
  // ES6:  import './foo'
  /import\s+['"]([^'"]+)['"]/g,
  // CommonJS:  require('./foo')
  /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
  // Python:  from foo import bar  |  import foo
  /(?:from\s+([\w.]+)\s+import|import\s+([\w.]+))/g,
];

/**
 * Extract dependency imports from source code.
 * Returns array of raw import specifiers.
 */
function extractImports(code) {
  const imports = new Set();

  for (const pattern of IMPORT_PATTERNS) {
    // Reset lastIndex for global regexes
    pattern.lastIndex = 0;
    let m;
    while ((m = pattern.exec(code)) !== null) {
      const specifier = m[1] || m[2];
      if (specifier) imports.add(specifier);
    }
  }

  return [...imports];
}

/**
 * Resolve a relative import specifier to a repo-relative path.
 */
function resolveImport(specifier, fromFile, allPaths) {
  // Skip bare specifiers (npm packages / stdlib)
  if (!specifier.startsWith('.') && !specifier.startsWith('/')) {
    return null;
  }

  const dir = path.posix.dirname(fromFile);
  let resolved = path.posix.normalize(path.posix.join(dir, specifier));

  // Try exact match first
  if (allPaths.has(resolved)) return resolved;

  // Try common extensions
  const extensions = ['.js', '.jsx', '.ts', '.tsx', '.json', '.py'];
  for (const ext of extensions) {
    if (allPaths.has(resolved + ext)) return resolved + ext;
  }

  // Try index files
  for (const ext of extensions) {
    const indexPath = path.posix.join(resolved, `index${ext}`);
    if (allPaths.has(indexPath)) return indexPath;
  }

  return null;
}

// ───────── Dependency Graph ─────────

/**
 * Build dependency graph from analysed files.
 * @param {Array<{path: string, content: string}>} files
 * @returns {{ nodes: string[], edges: Array<{from, to}>, adjacency: Object }}
 */
function buildDependencyGraph(files) {
  const allPaths = new Set(files.map((f) => f.path));
  const edges = [];
  const adjacency = {}; // path -> [dependencies]
  const reverseAdj = {}; // path -> [dependents]

  for (const file of files) {
    const imports = extractImports(file.content);
    adjacency[file.path] = [];

    for (const specifier of imports) {
      const resolved = resolveImport(specifier, file.path, allPaths);
      if (resolved) {
        edges.push({ from: file.path, to: resolved });
        adjacency[file.path].push(resolved);

        if (!reverseAdj[resolved]) reverseAdj[resolved] = [];
        reverseAdj[resolved].push(file.path);
      }
    }
  }

  return {
    nodes: [...allPaths],
    edges,
    adjacency,
    reverseAdjacency: reverseAdj,
  };
}

// ───────── Execution Trace ─────────

/**
 * Simulate execution flow starting from an entry file
 * by following imports depth-first.
 */
function traceExecution(entryPath, adjacency, maxDepth = 30) {
  const visited = new Set();
  const flow = [];

  function dfs(filePath, depth) {
    if (depth > maxDepth || visited.has(filePath)) return;
    visited.add(filePath);
    flow.push(filePath);

    const deps = adjacency[filePath] || [];
    for (const dep of deps) {
      dfs(dep, depth + 1);
    }
  }

  dfs(entryPath, 0);
  return flow;
}

// ───────── High-Impact Detection ─────────

/**
 * Returns files sorted by number of dependents (most-imported first).
 */
function detectHighImpactFiles(reverseAdjacency, threshold = 3) {
  return Object.entries(reverseAdjacency)
    .map(([filePath, dependents]) => ({
      file: filePath,
      dependents: dependents.length,
      dependentFiles: dependents,
      highImpact: dependents.length >= threshold,
    }))
    .sort((a, b) => b.dependents - a.dependents);
}

// ───────── Code Consistency Score ─────────

/**
 * Analyse code quality / consistency and return a score 0-100.
 */
function calculateConsistencyScore(files) {
  let issuesData = { critical: 0, warning: 0, good: 0 };
  let suggestions = [];

  let cleanliness = 100;
  let complexity = 100;
  let structure = 100;
  let naming = 100;

  if (files.length === 0) {
    return { overall: 0, cleanliness: 0, complexity: 0, structure: 0, naming: 0, issues: issuesData, suggestions: ['Repository is entirely empty'] };
  }

  // 1. Naming convention
  const namingStyles = { camelCase: 0, snake_case: 0, PascalCase: 0, other: 0 };
  for (const f of files) {
    const basename = path.posix.basename(f.path, path.posix.extname(f.path));
    if (/^[a-z][a-zA-Z0-9]*$/.test(basename)) namingStyles.camelCase++;
    else if (/^[a-z][a-z0-9_]*$/.test(basename)) namingStyles.snake_case++;
    else if (/^[A-Z][a-zA-Z0-9]*$/.test(basename)) namingStyles.PascalCase++;
    else namingStyles.other++;
  }
  const namingValues = Object.values(namingStyles).filter((v) => v > 0);
  if (namingValues.length > 2) {
    naming -= 30;
    issuesData.warning++;
    suggestions.push(`Improve file naming consistency (mixed casing detected)`);
  } else if (namingValues.length === 1) {
    issuesData.good++;
  }

  // 2. Console/Debug 
  let debugStatements = 0;
  for (const f of files) {
    const matches = f.content.match(/console\.(log|debug|warn|error)|print\(/g);
    if (matches) debugStatements += matches.length;
  }
  if (debugStatements > 20) {
    cleanliness -= 25;
    issuesData.warning++;
    suggestions.push(`Remove excessive debug/console.log statements (${debugStatements} found)`);
  } else if (debugStatements === 0) {
    issuesData.good++;
  }

  // 3. TODOs & Technical Debt
  let todoCount = 0;
  for (const f of files) {
    const matches = f.content.match(/TODO|FIXME|HACK|XXX/gi);
    if (matches) todoCount += matches.length;
  }
  if (todoCount > 10) {
    cleanliness -= 15;
    issuesData.critical++;
    suggestions.push(`Resolve ${todoCount} pending TODO/FIXME markers`);
  } else if (todoCount <= 2) {
    issuesData.good++;
  }

  // 4. File Structure & Size
  const sizes = files.map((f) => f.content.length);
  const avgSize = sizes.reduce((a, b) => a + b, 0) / sizes.length;
  const oversizedFiles = files.filter((f) => f.content.length > Math.max(avgSize * 4, 3000));
  if (oversizedFiles.length > 0) {
    structure -= 20;
    complexity -= 15;
    issuesData.critical++;
    suggestions.push(`Refactor monolithic files into smaller modules (e.g. ${oversizedFiles[0].path.split('/').pop()})`);
  }

  // 5. Empty / Duplicate Files
  const emptyFiles = files.filter((f) => f.content.trim().length === 0);
  if (emptyFiles.length > 0) {
    structure -= 10;
    issuesData.warning++;
    suggestions.push(`Delete ${emptyFiles.length} empty files to clean up architecture`);
  }

  const contentHashes = new Set();
  let duplicates = 0;
  for (const f of files) {
    const hash = f.content.replace(/\s+/g, ' ').slice(0, 200);
    if (hash.length > 50) {
      if (contentHashes.has(hash)) duplicates++;
      else contentHashes.add(hash);
    }
  }
  if (duplicates > 0) {
    structure -= 20;
    complexity -= 10;
    issuesData.critical++;
    suggestions.push(`Consolidate ${duplicates} potentially duplicated code blocks`);
  }

  // Determine overall
  const overall = Math.round((cleanliness + complexity + structure + naming) / 4);

  if (suggestions.length === 0) {
    suggestions.push('No major improvements required. Outstanding code quality!');
    issuesData.good += 2;
  }

  return {
    overall: Math.max(0, overall),
    cleanliness: Math.max(0, cleanliness),
    complexity: Math.max(0, complexity),
    structure: Math.max(0, structure),
    naming: Math.max(0, naming),
    issues: issuesData,
    suggestions
  };
}

// ───────── Search ─────────

/**
 * Search files by name or content.
 */
function searchFiles(files, query) {
  const q = query.toLowerCase();

  return files
    .filter(
      (f) =>
        f.path.toLowerCase().includes(q) ||
        f.content.toLowerCase().includes(q)
    )
    .map((f) => {
      const lines = f.content.split('\n');
      const matchingLines = [];

      lines.forEach((line, idx) => {
        if (line.toLowerCase().includes(q)) {
          matchingLines.push({ line: idx + 1, content: line.trim() });
        }
      });

      return {
        path: f.path,
        nameMatch: f.path.toLowerCase().includes(q),
        matchCount: matchingLines.length,
        matches: matchingLines.slice(0, 5), // top 5 line matches
      };
    })
    .sort((a, b) => {
      // Name matches first, then by match count
      if (a.nameMatch !== b.nameMatch) return a.nameMatch ? -1 : 1;
      return b.matchCount - a.matchCount;
    });
}

module.exports = {
  extractImports,
  buildDependencyGraph,
  traceExecution,
  detectHighImpactFiles,
  calculateConsistencyScore,
  searchFiles,
};
