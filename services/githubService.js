/**
 * ──────────────────────────────────────────────
 *  GitHub Service – All GitHub API interactions
 * ──────────────────────────────────────────────
 */
const axios = require('axios');
const config = require('../config');
const { repoCache } = require('../utils/cache');
const {
  GitHubAPIError,
  RateLimitError,
  NotFoundError,
} = require('../utils/errors');

const gh = axios.create({
  baseURL: config.github.apiBase,
  headers: {
    Accept: 'application/vnd.github.v3+json',
    ...(config.github.token && {
      Authorization: `Bearer ${config.github.token}`,
    }),
  },
  timeout: 30_000,
});

// ─── Interceptor: catch rate limits & 404s ───
gh.interceptors.response.use(
  (res) => res,
  (err) => {
    if (!err.response) throw new GitHubAPIError('GitHub API unreachable');

    const { status, data } = err.response;
    if (status === 403 && data?.message?.includes('rate limit')) {
      throw new RateLimitError();
    }
    if (status === 404) {
      throw new NotFoundError('Repository not found on GitHub');
    }
    throw new GitHubAPIError(
      data?.message || `GitHub API error (${status})`,
      status >= 500 ? 502 : status
    );
  }
);

// ───────────────── Helpers ─────────────────

function shouldIgnore(path) {
  return config.github.ignoredPaths.some(
    (ignored) => path === ignored || path.startsWith(`${ignored}/`)
  );
}

function isSupportedFile(path) {
  return config.github.supportedExtensions.some((ext) =>
    path.toLowerCase().endsWith(ext)
  );
}

// ─────────── Public API ───────────

/**
 * Fetch the full recursive file tree of a repo.
 * Returns flat array of { path, type, size, sha }.
 */
async function fetchRepoTree(owner, repo) {
  const cacheKey = `tree:${owner}/${repo}`;
  const cached = repoCache.get(cacheKey);
  if (cached) return cached;

  const { data } = await gh.get(
    `/repos/${owner}/${repo}/git/trees/HEAD?recursive=1`
  );

  const tree = (data.tree || [])
    .filter((item) => !shouldIgnore(item.path))
    .map((item) => ({
      path: item.path,
      type: item.type, // 'blob' | 'tree'
      size: item.size || 0,
      sha: item.sha,
    }));

  repoCache.set(cacheKey, tree);
  return tree;
}

/**
 * Fetch raw content of a single file.
 */
async function fetchFileContent(owner, repo, path) {
  const cacheKey = `file:${owner}/${repo}:${path}`;
  const cached = repoCache.get(cacheKey);
  if (cached) return cached;

  const { data } = await gh.get(
    `/repos/${owner}/${repo}/contents/${encodeURIComponent(path)}`,
    { headers: { Accept: 'application/vnd.github.v3.raw' } }
  );

  const content = typeof data === 'string' ? data : JSON.stringify(data, null, 2);
  repoCache.set(cacheKey, content);
  return content;
}

/**
 * Fetch analysable files: filters by extension & size, then
 * batch-fetches content (respecting maxFiles limit).
 */
async function fetchAnalysableFiles(owner, repo) {
  const cacheKey = `analysable:${owner}/${repo}`;
  const cached = repoCache.get(cacheKey);
  if (cached) return cached;

  const tree = await fetchRepoTree(owner, repo);

  const candidates = tree
    .filter(
      (f) =>
        f.type === 'blob' &&
        isSupportedFile(f.path) &&
        f.size <= config.github.maxFileSize
    )
    .slice(0, config.github.maxFiles);

  // Fetch in batches of 10 to avoid hammering the API
  const files = [];
  const batchSize = 10;
  for (let i = 0; i < candidates.length; i += batchSize) {
    const batch = candidates.slice(i, i + batchSize);
    const results = await Promise.allSettled(
      batch.map(async (f) => {
        const content = await fetchFileContent(owner, repo, f.path);
        return { path: f.path, size: f.size, content };
      })
    );
    for (const r of results) {
      if (r.status === 'fulfilled') files.push(r.value);
    }
  }

  repoCache.set(cacheKey, files);
  return files;
}

/**
 * Fetch recent commits (default 20).
 */
async function fetchCommits(owner, repo, count = 20) {
  const cacheKey = `commits:${owner}/${repo}:${count}`;
  const cached = repoCache.get(cacheKey);
  if (cached) return cached;

  const { data } = await gh.get(`/repos/${owner}/${repo}/commits`, {
    params: { per_page: count },
  });

  const commits = data.map((c) => ({
    sha: c.sha.slice(0, 7),
    message: c.commit.message.split('\n')[0],
    author: c.commit.author?.name || c.author?.login || 'Unknown',
    date: c.commit.author?.date?.slice(0, 10) || '',
    avatar: c.author?.avatar_url || null,
  }));

  repoCache.set(cacheKey, commits);
  return commits;
}

/**
 * Fetch basic repo metadata.
 */
async function fetchRepoMeta(owner, repo) {
  const cacheKey = `meta:${owner}/${repo}`;
  const cached = repoCache.get(cacheKey);
  if (cached) return cached;

  const { data } = await gh.get(`/repos/${owner}/${repo}`);

  const meta = {
    name: data.full_name,
    description: data.description,
    language: data.language,
    stars: data.stargazers_count,
    forks: data.forks_count,
    openIssues: data.open_issues_count,
    defaultBranch: data.default_branch,
    updatedAt: data.updated_at,
    topics: data.topics || [],
  };

  repoCache.set(cacheKey, meta);
  return meta;
}

module.exports = {
  fetchRepoTree,
  fetchFileContent,
  fetchAnalysableFiles,
  fetchCommits,
  fetchRepoMeta,
};
