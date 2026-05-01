/**
 * ──────────────────────────────────────────
 *  Parses a GitHub URL into { owner, repo }
 * ──────────────────────────────────────────
 *  Supported formats:
 *    https://github.com/owner/repo
 *    https://github.com/owner/repo.git
 *    github.com/owner/repo
 *    owner/repo
 */
function parseRepoURL(url) {
  if (!url || typeof url !== 'string') {
    throw new Error('Repository URL is required');
  }

  let cleaned = url.trim().replace(/\/+$/, '').replace(/\.git$/, '');

  // Handle full URLs
  const urlPattern = /(?:https?:\/\/)?(?:www\.)?github\.com\/([^/]+)\/([^/]+)/i;
  const match = cleaned.match(urlPattern);

  if (match) {
    return { owner: match[1], repo: match[2] };
  }

  // Handle shorthand  owner/repo
  const shortPattern = /^([^/\s]+)\/([^/\s]+)$/;
  const shortMatch = cleaned.match(shortPattern);

  if (shortMatch) {
    return { owner: shortMatch[1], repo: shortMatch[2] };
  }

  throw new Error(
    `Invalid GitHub URL: "${url}". Expected format: https://github.com/owner/repo`
  );
}

module.exports = parseRepoURL;
