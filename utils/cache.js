/**
 * ──────────────────────────────────────────
 *  Simple in-memory TTL cache
 * ──────────────────────────────────────────
 */
const config = require('../config');

class MemoryCache {
  constructor(ttl = config.cacheTTL) {
    this._store = new Map();
    this._ttl = ttl;
  }

  get(key) {
    const entry = this._store.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiry) {
      this._store.delete(key);
      return null;
    }
    return entry.value;
  }

  set(key, value, ttl) {
    this._store.set(key, {
      value,
      expiry: Date.now() + (ttl || this._ttl),
    });
  }

  has(key) {
    return this.get(key) !== null;
  }

  delete(key) {
    this._store.delete(key);
  }

  clear() {
    this._store.clear();
  }

  get size() {
    return this._store.size;
  }
}

// Singleton caches for different concerns
const repoCache = new MemoryCache();
const aiCache = new MemoryCache(30 * 60 * 1000); // 30 min for AI responses

module.exports = { MemoryCache, repoCache, aiCache };
