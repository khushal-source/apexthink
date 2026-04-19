/**
 * ══════════════════════════════════════════════════
 *  Apex Think – Unified Cache Layer
 *  Strategy: Supabase (persistent) → In-Memory (TTL fallback)
 *  Covers: AI Summary, Chat, Onboarding, Code Score
 * ══════════════════════════════════════════════════
 */

const config = require('../config');

/* ─── TTLs ─────────────────────────────────────── */
const TTL = {
  summary:    24 * 60 * 60 * 1000,  // 24 hours  (file summaries)
  chat:        1 * 60 * 60 * 1000,  //  1 hour   (chat answers)
  onboarding: 24 * 60 * 60 * 1000,  // 24 hours  (onboarding paths)
  score:       6 * 60 * 60 * 1000,  //  6 hours  (code scores)
  repo:        5 * 60 * 1000,       //  5 min    (repo graph)
};

/* ════════════════════════════════════════════════
   IN-MEMORY CACHE (always available)
   ════════════════════════════════════════════════ */
class MemoryCache {
  constructor(defaultTTL = 30 * 60 * 1000) {
    this._store = new Map();
    this._defaultTTL = defaultTTL;
  }

  _key(repoUrl, filePath, featureType) {
    return `${repoUrl}||${filePath || '_'}||${featureType}`;
  }

  get(repoUrl, filePath, featureType) {
    const key = this._key(repoUrl, filePath, featureType);
    const entry = this._store.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiry) {
      this._store.delete(key);
      return null;
    }
    console.log(`[Cache HIT] ${featureType} | ${filePath || repoUrl}`);
    return entry.value;
  }

  set(repoUrl, filePath, featureType, value) {
    const key = this._key(repoUrl, filePath, featureType);
    const ttl = TTL[featureType] || this._defaultTTL;
    this._store.set(key, {
      value,
      expiry: Date.now() + ttl,
      createdAt: new Date().toISOString()
    });
    console.log(`[Cache SET] ${featureType} | ${filePath || repoUrl} | TTL: ${ttl / 60000}min`);
  }

  // Legacy compatibility: get/set by raw string key
  getRaw(key) {
    const entry = this._store.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiry) { this._store.delete(key); return null; }
    return entry.value;
  }

  setRaw(key, value, ttl) {
    this._store.set(key, { value, expiry: Date.now() + (ttl || this._defaultTTL) });
  }

  has(key) { return this.getRaw(key) !== null; }
  delete(key) { this._store.delete(key); }
  clear() { this._store.clear(); }
  get size() { return this._store.size; }
}

/* ════════════════════════════════════════════════
   SUPABASE CACHE (optional, persistent, 24hr TTL)
   ════════════════════════════════════════════════ */
let supabase = null;

function initSupabase() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_KEY;
  if (!url || !key) return false;

  try {
    const { createClient } = require('@supabase/supabase-js');
    supabase = createClient(url, key);
    console.log('[Cache] ✅ Supabase cache initialized');
    return true;
  } catch {
    console.warn('[Cache] ⚠️  @supabase/supabase-js not installed — using memory cache only');
    return false;
  }
}

const supabaseAvailable = initSupabase();

/* ════════════════════════════════════════════════
   UNIFIED CACHE API
   Auto-selects Supabase if available, else memory
   ════════════════════════════════════════════════ */
const memoryCache = new MemoryCache();

async function getCache(repoUrl, filePath, featureType) {
  // 1. Always check memory first (fastest)
  const memHit = memoryCache.get(repoUrl, filePath, featureType);
  if (memHit !== null) return memHit;

  // 2. Try Supabase if configured
  if (supabaseAvailable && supabase) {
    try {
      const { data, error } = await supabase
        .from('ai_cache')
        .select('response, created_at')
        .eq('repo_url', repoUrl)
        .eq('file_path', filePath || '_')
        .eq('feature_type', featureType)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (error || !data) return null;

      // Check if within TTL
      const age = Date.now() - new Date(data.created_at).getTime();
      const ttl = TTL[featureType] || 24 * 60 * 60 * 1000;
      if (age > ttl) return null;

      console.log(`[Supabase Cache HIT] ${featureType} | ${filePath || repoUrl}`);

      // Promote to memory cache for next request
      memoryCache.set(repoUrl, filePath, featureType, data.response);
      return data.response;
    } catch (err) {
      console.warn('[Supabase Cache] Read error:', err.message);
    }
  }

  return null;
}

async function setCache(repoUrl, filePath, featureType, response) {
  // Always write to memory
  memoryCache.set(repoUrl, filePath, featureType, response);

  // Also write to Supabase if configured
  if (supabaseAvailable && supabase) {
    try {
      await supabase.from('ai_cache').upsert({
        repo_url:     repoUrl,
        file_path:    filePath || '_',
        feature_type: featureType,
        response,
        created_at:   new Date().toISOString()
      }, {
        onConflict: 'repo_url,file_path,feature_type'
      });
      console.log(`[Supabase Cache SET] ${featureType} | ${filePath || repoUrl}`);
    } catch (err) {
      console.warn('[Supabase Cache] Write error:', err.message);
    }
  }
}

/* ─── Legacy exports (used by existing code) ─── */
const repoCache = memoryCache;  // backward compat
const aiCache   = memoryCache;  // backward compat — uses .getRaw/.setRaw

module.exports = {
  MemoryCache,
  repoCache,
  aiCache,           // legacy compat for old code
  memoryCache,
  getCache,          // new unified API
  setCache,          // new unified API
  TTL
};
