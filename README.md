# Apex Think (My Final Project)

A tool to analyze GitHub repositories and visualize the code architecture. It also has an AI chatbot to ask questions about the code. I built this to help understand large codebases faster.

## Features

- **Graph View**: Shows a node graph of how files import each other.
- **AI Chat**: Ask questions about the repo (uses Google Gemini).
- **Onboarding Path**: Step-by-step guide to reading the code.
- **Git History**: Simple timeline of commits.
- **Execution Trace**: Shows how functions might call each other.
- **Code Score**: Rates the code quality (WIP, sometimes inaccurate).

## Analytics
Integrated Google Analytics to track user engagement and usage patterns.

## Tech Stack
- **Frontend**: React, Vite, Three.js (for the landing page), React Flow (for the graph)
- **Backend**: Node.js, Express
- **APIs**: GitHub API, Gemini API

## Setup Instructions

1. Clone this repo
2. Install dependencies:
   ```bash
   npm install
   ```
3. Set up the `.env` file. You need:
   - `GITHUB_TOKEN` (your personal access token)
   - `GEMINI_API_KEY` (from Google AI Studio)

   *Note: I removed Supabase caching for now because it was causing issues with the free tier.*

4. Run the app:
   ```bash
   npm start
   ```
   This starts both the backend server and frontend Vite app concurrently. 
   Go to `http://localhost:5173` to see it.

## Future Improvements (TODO)
- Fix the trace execution, it sometimes gets stuck in infinite loops on circular dependencies.
- Make the Three.js landing page load faster (it lags on older laptops).
- Add support for GitLab/Bitbucket.
- Improve the code quality scoring to actually look at linting rules.

---
*Built for the 2026 Hackathon.*
