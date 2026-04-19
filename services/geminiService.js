/**
 * ──────────────────────────────────────────────────
 *  Gemini AI Service – Chat & Explanation features
 * ──────────────────────────────────────────────────
 */
const axios = require('axios');
const config = require('../config');
const { getCache, setCache, aiCache } = require('../utils/cache');
const { GeminiAPIError } = require('../utils/errors');

/**
 * Call Gemini generateContent endpoint with built-in retry mechanism.
 */
async function callGemini(prompt, maxTokens = 1024, retries = 1) {
  if (!config.gemini.apiKey) {
    throw new GeminiAPIError('GEMINI_API_KEY is not configured');
  }

  const url = `${config.gemini.apiBase}/models/${config.gemini.model}:generateContent?key=${config.gemini.apiKey}`;

  try {
    const { data } = await axios.post(
      url,
      {
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          maxOutputTokens: maxTokens,
          temperature: 0.3,
        },
      },
      { timeout: 60_000 }
    );

    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
    if (!text) throw new GeminiAPIError('Empty response from Gemini');
    return text;
  } catch (err) {
    if (err.response?.status === 429 && retries > 0) {
      console.warn('Gemini API rate limited (429). Retrying in 3 seconds...');
      await new Promise(resolve => setTimeout(resolve, 3000));
      return callGemini(prompt, maxTokens, retries - 1);
    }
    if (err instanceof GeminiAPIError) throw err;
    throw new GeminiAPIError(
      err.response?.data?.error?.message || err.message || 'Gemini API request failed'
    );
  }
}

/**
 * Context-aware chat – sends repo structure + query to Gemini.
 */
async function chatWithRepo(query, repoContext) {
  const repoUrl = repoContext.repoUrl || 'unknown';

  // Unified cache check (memory → Supabase)
  const cached = await getCache(repoUrl, query.slice(0, 80), 'chat');
  if (cached) return cached;

  const prompt = `You are a codebase expert.
Repo:
${repoContext.structure.slice(0, 1500)}

User: ${query}

Rules:
* Respond in exactly 2 to 3 very short lines. No more.
* Use markdown formatting.`;

  try {
    const answer = await callGemini(prompt, 512);
    await setCache(repoUrl, query.slice(0, 80), 'chat', answer);
    return answer;
  } catch (err) {
    // On rate limit: try returning any stale cache before giving fallback
    const stale = aiCache.getRaw(`chat_stale:${repoUrl}:${query.slice(0,40)}`);
    if (stale) {
      console.warn('[Chat] Returning stale cache due to API error');
      return stale;
    }

    const isRateLimit = err.message.includes('429') || err.message.toLowerCase().includes('quota');
    if (isRateLimit) {
      return `**API Quota Exceeded**\n\nThe AI cannot process custom queries right now. Please try again in a minute.`;
    }
    throw err;
  }
}

/**
 * Explain a single code file / snippet.
 */
async function explainCode(code, filename = 'unknown', repoUrl = 'unknown') {
  // Unified cache check (memory → Supabase)
  const cached = await getCache(repoUrl, filename, 'summary');
  if (cached) return cached;

  const prompt = `Explain this file in a codebase:

File: ${filename}
Code:
${code.slice(0, 3000)}

Give:
* purpose
* role in system
* what it connects to

Use markdown formatting. Keep it extremely brief.`;

  try {
    const summary = await callGemini(prompt, 512);
    await setCache(repoUrl, filename, 'summary', summary);
    return summary;
  } catch (err) {
    const isRateLimit = err.message.includes('429') || err.message.toLowerCase().includes('quota');
    if (isRateLimit) {
      console.warn(`[Explain] Fallback triggered for ${filename}`);
      return `**API Quota Exceeded**\n\nThis file (\`${filename}\`) is a standard architectural component. Please try again later.`;
    }
    throw err;
  }
}

/**
 * Generate intelligent onboarding path.
 */
async function generateOnboardingPath(repoContext) {
  const repoUrl = repoContext.repoUrl || 'unknown';

  // Unified cache check (memory → Supabase)
  const cached = await getCache(repoUrl, '_', 'onboarding');
  if (cached) {
    return typeof cached === 'string' ? JSON.parse(cached) : cached;
  }

  const prompt = `Analyze this codebase graph.

${repoContext.structure.slice(0, 3000)}

Generate an onboarding path.
For each step (max 6):
* file
* role (entry/core/utility)
* reason
* why_next

Return ONLY a raw JSON array.
[{"step":1,"file":"index.js","role":"entry","reason":"Start here","why_next":"next step"}]`;

  try {
    const responseText = await callGemini(prompt, 1024);
    const cleanJson = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
    const result = JSON.parse(cleanJson);
    await setCache(repoUrl, '_', 'onboarding', result);
    return result;
  } catch (err) {
    throw new Error('AI Onboarding error: ' + err.message);
  }
}

module.exports = { callGemini, chatWithRepo, explainCode, generateOnboardingPath };
