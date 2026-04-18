# 🧠 CodeMap AI – Advanced Repository Intelligence Platform

> Analyse any GitHub repository with AI-powered code understanding, dependency graphs, consistency scoring, and more.

---

## 🚀 Quick Start

```bash
# 1. Install dependencies
npm install

          # 2. Create your .env file
          cp .env.example .env
          # Then edit .env with your API keys

          # 3. Start the server
          npm start

          # Or with auto-reload (development)
          npm run dev
          ```

          The server will start at **http://localhost:5000**

          ---

          ## 🔑 Environment Variables

          | Variable | Required | Description |
          |---|---|---|
          | `GITHUB_TOKEN` | ✅ | GitHub Personal Access Token ([create one](https://github.com/settings/tokens)) |
          | `GEMINI_API_KEY` | ✅ | Google Gemini API key ([get one](https://aistudio.google.com/apikey)) |
          | `PORT` | ❌ | Server port (default: 5000) |
          | `SUPABASE_URL` | ❌ | Supabase project URL (optional caching) |
          | `SUPABASE_KEY` | ❌ | Supabase anon key (optional caching) |

          ---

          ## 📡 API Endpoints

          ### Health Check
          ```
          GET /api/health
          ```

          ### 1️⃣ Repository Analysis
          ```
          GET /api/repo?url=https://github.com/owner/repo
          ```
          Returns: repo metadata, file structure, dependency graph, high-impact files.

          ### 2️⃣ AI Chat (Context-Aware)
          ```
          POST /api/chat
          Content-Type: application/json

          {
            "query": "Where is authentication handled?",
            "repoUrl": "https://github.com/owner/repo"
          }
          ```
          Returns: AI-generated answer grounded in the repository's code.

          ### 3️⃣ Git History Timeline
          ```
          GET /api/history?url=https://github.com/owner/repo&count=20
          ```
          Returns: chronological list of recent commits.

          ### 4️⃣ Execution Trace
          ```
          POST /api/trace
          Content-Type: application/json

          {
            "entry": "index.js",
            "repoUrl": "https://github.com/owner/repo"
          }
          ```
          Returns: simulated execution flow following imports from the entry file.

          ### 5️⃣ Code Consistency Score
          ```
          GET /api/score?url=https://github.com/owner/repo
          ```
          Returns: 0-100 consistency score with detailed issues and stats.

          ### 6️⃣ Code Search
          ```
          GET /api/search?url=https://github.com/owner/repo&q=auth
          ```
          Returns: files matching the search query by name and content.

          ### 7️⃣ AI Code Explanation
          ```
          POST /api/explain
          Content-Type: application/json

          {
            "code": "function authenticate(user) { ... }",
            "filename": "auth.js"
          }
          ```
          Returns: AI-generated explanation of the code.

          ---

          ## 📁 Architecture

          ```
          backend/
          ├── app.js                  # Express entry point
          ├── config/
          │   └── index.js            # Centralised configuration
          ├── controllers/
          │   ├── repoController.js   # Repository analysis
          │   ├── chatController.js   # AI chat
          │   ├── historyController.js# Git history
          │   ├── traceController.js  # Execution tracing
          │   ├── scoreController.js  # Consistency scoring
          │   ├── searchController.js # Code search
          │   └── explainController.js# AI explanation
          ├── routes/
          │   └── index.js            # Route registry
          ├── services/
          │   ├── githubService.js    # GitHub API wrapper
          │   ├── geminiService.js    # Gemini AI wrapper
          │   └── analysisService.js  # Analysis engine
          └── utils/
              ├── parseRepoURL.js     # URL parser
              ├── cache.js            # In-memory TTL cache
              └── errors.js           # Custom error classes
          ```

          ---

          ## ⚡ Features

          | Feature | Description |
          |---|---|
          | 🔍 **Repo Analysis** | Full file tree, metadata, and structure overview |
          | 🕸️ **Dependency Graph** | Parses imports/requires to build `nodes` + `edges` |
          | 🤖 **AI Chat** | Gemini-powered Q&A grounded in repository context |
          | 📊 **Git Timeline** | Chronological commit history with authors |
          | ⚡ **Exec Tracing** | Simulated execution flow from any entry point |
          | 📈 **Quality Score** | 0-100 consistency score with actionable issues |
          | 🔎 **Code Search** | Search by filename and content across the repo |
          | 🧠 **AI Explain** | Plain-English explanation of any code snippet |
          | ⭐ **High-Impact** | Detects most-imported files in the codebase |
          | 💾 **Smart Cache** | In-memory TTL cache for fast repeat queries |

          ---

          ## 🛡️ Error Handling

          All errors return a consistent JSON envelope:

          ```json
          {
            "success": false,
            "error": {
              "code": "VALIDATION_ERROR",
              "message": "Descriptive error message"
            }
          }
          ```

          | Code | HTTP | Meaning |
          |---|---|---|
          | `VALIDATION_ERROR` | 400 | Bad input |
          | `NOT_FOUND` | 404 | Repo or file not found |
          | `RATE_LIMIT` | 429 | GitHub API rate limit hit |
          | `GITHUB_API_ERROR` | 502 | GitHub API failure |
          | `GEMINI_API_ERROR` | 502 | Gemini API failure |
          | `INTERNAL_ERROR` | 500 | Unexpected server error |

---

## 📜 License

MIT
