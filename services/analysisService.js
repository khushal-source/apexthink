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
  const issues = [];
  let totalScore = 100;

  if (files.length === 0) {
    return { score: 0, issues: ['Repository has no analysable files'] };
  }

  // 1. Naming convention check
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
    totalScore -= 10;
    issues.push(
      `Inconsistent file naming: mixed conventions detected (${Object.entries(namingStyles)
        .filter(([, v]) => v > 0)
        .map(([k, v]) => `${k}: ${v}`)
        .join(', ')})`
    );
  }

  // 2. Comment density
  let totalLines = 0;
  let commentLines = 0;
  for (const f of files) {
    const lines = f.content.split('\n');
    totalLines += lines.length;
    for (const line of lines) {
      const trimmed = line.trim();
      if (
        trimmed.startsWith('//') ||
        trimmed.startsWith('#') ||
        trimmed.startsWith('/*') ||
        trimmed.startsWith('*')
      ) {
        commentLines++;
      }
    }
  }

  const commentRatio = totalLines > 0 ? commentLines / totalLines : 0;
  if (commentRatio < 0.05) {
    totalScore -= 10;
    issues.push(
      `Low comment density (${(commentRatio * 100).toFixed(1)}%) – consider adding documentation`
    );
  } else if (commentRatio > 0.4) {
    totalScore -= 5;
    issues.push(
      `Very high comment density (${(commentRatio * 100).toFixed(1)}%) – may indicate commented-out code`
    );
  }

  // 3. File size uniformity
  const sizes = files.map((f) => f.content.length);
  const avgSize = sizes.reduce((a, b) => a + b, 0) / sizes.length;
  const oversizedFiles = files.filter((f) => f.content.length > avgSize * 4);
  if (oversizedFiles.length > 0) {
    totalScore -= 8;
    issues.push(
      `${oversizedFiles.length} file(s) are significantly larger than average – consider splitting: ${oversizedFiles
        .slice(0, 3)
        .map((f) => f.path)
        .join(', ')}`
    );
  }

  // 4. Duplicate / near-duplicate detection (simple hash-based)
  const contentHashes = new Map();
  for (const f of files) {
    // Simple hash: first 200 chars normalised
    const hash = f.content.replace(/\s+/g, ' ').slice(0, 200);
    if (contentHashes.has(hash)) {
      totalScore -= 5;
      issues.push(
        `Possible duplicate: ${f.path} ↔ ${contentHashes.get(hash)}`
      );
    } else {
      contentHashes.set(hash, f.path);
    }
  }

  // 5. Empty files
  const emptyFiles = files.filter((f) => f.content.trim().length === 0);
  if (emptyFiles.length > 0) {
    totalScore -= 3;
    issues.push(
      `${emptyFiles.length} empty file(s) detected: ${emptyFiles
        .slice(0, 3)
        .map((f) => f.path)
        .join(', ')}`
    );
  }

  // 6. Console.log / print statement check
  let debugStatements = 0;
  for (const f of files) {
    const matches = f.content.match(/console\.(log|debug|warn|error)|print\(/g);
    if (matches) debugStatements += matches.length;
  }
  if (debugStatements > 20) {
    totalScore -= 5;
    issues.push(
      `${debugStatements} debug/print statements found – consider using a proper logger`
    );
  }

  // 7. TODO / FIXME / HACK check
  let todoCount = 0;
  for (const f of files) {
    const matches = f.content.match(/TODO|FIXME|HACK|XXX/gi);
    if (matches) todoCount += matches.length;
  }
  if (todoCount > 10) {
    totalScore -= 4;
    issues.push(`${todoCount} TODO/FIXME/HACK markers found – technical debt detected`);
  }

  if (issues.length === 0) {
    issues.push('No major consistency issues detected – great job! 🎉');
  }

  return {
    score: Math.max(0, Math.min(100, totalScore)),
    issues,
    stats: {
      totalFiles: files.length,
      totalLines,
      commentLines,
      commentRatio: `${(commentRatio * 100).toFixed(1)}%`,
      avgFileSize: Math.round(avgSize),
      debugStatements,
      todoCount,
    },
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
