/**
 * ──────────────────────────────────────────
 *  Custom error classes for clean error flow
 * ──────────────────────────────────────────
 */

class AppError extends Error {
  constructor(message, statusCode = 500, code = 'INTERNAL_ERROR') {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = true;
  }
}

class ValidationError extends AppError {
  constructor(message) {
    super(message, 400, 'VALIDATION_ERROR');
  }
}

class NotFoundError extends AppError {
  constructor(message = 'Resource not found') {
    super(message, 404, 'NOT_FOUND');
  }
}

class RateLimitError extends AppError {
  constructor(message = 'GitHub API rate limit exceeded. Please try again later.') {
    super(message, 429, 'RATE_LIMIT');
  }
}

class GitHubAPIError extends AppError {
  constructor(message, statusCode = 502) {
    super(message, statusCode, 'GITHUB_API_ERROR');
  }
}

class GeminiAPIError extends AppError {
  constructor(message) {
    super(message, 502, 'GEMINI_API_ERROR');
  }
}

module.exports = {
  AppError,
  ValidationError,
  NotFoundError,
  RateLimitError,
  GitHubAPIError,
  GeminiAPIError,
};
