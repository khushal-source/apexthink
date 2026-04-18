/**
 * ──────────────────────────────────────────
 *  CodeMap AI – Centralised Configuration
 * ──────────────────────────────────────────
 */
require('dotenv').config();

const config = {
  port: process.env.PORT || 5000,

  github: {
    token: process.env.GITHUB_TOKEN,
    apiBase: 'https://api.github.com',
    /** File extensions we care about for analysis */
    supportedExtensions: [
      '.js', '.jsx', '.ts', '.tsx', '.py', '.java',
      '.go', '.rb', '.rs', '.c', '.cpp', '.h', '.hpp',
      '.cs', '.php', '.vue', '.svelte', '.json', '.yaml',
      '.yml', '.md', '.html', '.css', '.scss',
    ],
    /** Paths to always skip */
    ignoredPaths: [
      'node_modules', '.git', 'dist', 'build', '__pycache__',
      '.next', '.nuxt', 'vendor', 'coverage', '.cache',
      'package-lock.json', 'yarn.lock', 'pnpm-lock.yaml',
    ],
    /** Max file size in bytes we'll fetch content for (100 KB) */
    maxFileSize: 100_000,
    /** Max number of files to analyse per repo */
    maxFiles: 200,
  },

  gemini: {
    apiKey: process.env.GEMINI_API_KEY,
    model: 'gemini-2.0-flash',
    apiBase: 'https://generativelanguage.googleapis.com/v1beta',
  },

  supabase: {
    url: process.env.SUPABASE_URL,
    key: process.env.SUPABASE_KEY,
  },

  /** In-memory cache TTL in ms (10 minutes) */
  cacheTTL: 10 * 60 * 1000,
};

module.exports = config;
