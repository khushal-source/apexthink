import axios from 'axios';

// Use the env variable if available, otherwise fallback to the production backend
const BASE_URL = import.meta.env.VITE_API_URL || 'https://apexthink.onrender.com';
axios.defaults.baseURL = BASE_URL;

// Base API wrapper to make calls cleaner in components
export const fetchRepoData = async (url) => {
  const res = await axios.get('/api/repo?url=' + encodeURIComponent(url));
  return res.data;
};

export const fetchHistory = async (url) => {
  const res = await axios.get('/api/history?url=' + encodeURIComponent(url));
  return res.data;
};

export const fetchScore = async (url) => {
  const res = await axios.get('/api/score?url=' + encodeURIComponent(url));
  return res.data;
};

export const fetchChat = async (query, repoUrl) => {
  const res = await axios.post('/api/chat', { query, repoUrl });
  return res.data;
};

export const fetchExplanation = async (filename, repoUrl) => {
  const res = await axios.post('/api/explain', { filename, repoUrl });
  return res.data;
};

export const fetchLearningPath = async (repoUrl, nodes, edges) => {
  const res = await axios.post('/api/onboarding', { repoUrl, nodes, edges, bust: Date.now() });
  return res.data;
};

export const fetchTrace = async (entry, repoUrl) => {
  const res = await axios.post('/api/trace', { entry, repoUrl });
  return res.data;
};
