import axios from 'axios';

const rawApiUrl = import.meta.env.VITE_API_URL || 'https://room-4-biqo.onrender.com/api/v1/';
const BASE_URL = rawApiUrl.endsWith('/') ? rawApiUrl : rawApiUrl + '/';

export const api = axios.create({
  baseURL: BASE_URL,
  headers: { 'Content-Type': 'application/json' },
});

// Attach access token and strip leading slashes
api.interceptors.request.use((config) => {
  if (config.url && config.url.startsWith('/')) {
    config.url = config.url.substring(1);
  }
  const token = localStorage.getItem('access_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Auto-refresh on 401
api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config;
    if (error.response?.status === 401 && !original._retry) {
      original._retry = true;
      const refresh = localStorage.getItem('refresh_token');
      if (refresh) {
        try {
          const sanitizedBase = BASE_URL.replace(/\/+$/, '');
          const res = await axios.post(`${sanitizedBase}/auth/refresh`, { refresh_token: refresh });
          const { access_token } = res.data;
          localStorage.setItem('access_token', access_token);
          original.headers.Authorization = `Bearer ${access_token}`;
          return api(original);
        } catch {
          localStorage.clear();
          window.location.href = '/login';
        }
      }
    }
    return Promise.reject(error);
  }
);

export default api;
