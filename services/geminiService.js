/**
 * ──────────────────────────────────────────────────
 *  Gemini AI Service – Chat & Explanation features
 * ──────────────────────────────────────────────────
 */
const axios = require('axios');
const config = require('../config');
const { aiCache } = require('../utils/cache');
const { GeminiAPIError } = require('../utils/errors');

/**
 * Call Gemini generateContent endpoint.
 */
async function callGemini(prompt, maxTokens = 2048) {
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
          temperature: 0.4,
        },
      },
      { timeout: 60_000 }
    );

    const text =
      data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
    if (!text) throw new GeminiAPIError('Empty response from Gemini');
    return text;
  } catch (err) {
    if (err instanceof GeminiAPIError) throw err;
    throw new GeminiAPIError(
      err.response?.data?.error?.message ||
        err.message ||
        'Gemini API request failed'
    );
  }
}

/**
 * Context-aware chat – sends repo structure + query to Gemini.
 */
async function chatWithRepo(query, repoContext) {
  const cacheKey = `chat:${Buffer.from(query).toString('base64').slice(0, 40)}`;
  const cached = aiCache.get(cacheKey);
  if (cached) return cached;

  const prompt = `You are CodeMap AI, an expert code analyst. You are analyzing a GitHub repository.

## Repository Structure
${repoContext.structure}

## File Summaries
${repoContext.summaries}

## User Question
${query}

Instructions:
- Answer based ONLY on the repository context above.
- Reference specific file names and paths.
- Be concise but thorough.
- If unsure, say so honestly.
- Use markdown formatting for readability.`;

  const answer = await callGemini(prompt, 2048);

  aiCache.set(cacheKey, answer);
  return answer;
}

/**
 * Explain a single code file / snippet.
 */
async function explainCode(code, filename = 'unknown') {
  const cacheKey = `explain:${Buffer.from(code).toString('base64').slice(0, 60)}`;
  const cached = aiCache.get(cacheKey);
  if (cached) return cached;

  const prompt = `You are CodeMap AI. Explain the following code file (${filename}) clearly and concisely.

\`\`\`
${code.slice(0, 8000)}
\`\`\`

Provide:
1. **Purpose** – What this file does (1-2 sentences)
2. **Key Components** – Main functions / classes / exports
3. **Dependencies** – What it imports / relies on
4. **Architecture Role** – How it fits in the larger codebase

Use markdown formatting.`;

  const summary = await callGemini(prompt, 1024);

  aiCache.set(cacheKey, summary);
  return summary;
}

module.exports = { callGemini, chatWithRepo, explainCode };
