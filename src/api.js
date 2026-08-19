import axios from 'axios';
import { useAuthStore } from './store/auth';
import { demoAdapter } from './mocks/demoApi';

const demoMode = String(import.meta.env.VITE_DEMO_MODE ?? 'true').toLowerCase() !== 'false';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api',
  ...(demoMode ? { adapter: demoAdapter } : {}),
});
let refreshPromise = null;

api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  // Always tag with the active tenant subdomain so backend resolves correctly in dev
  config.headers['X-Tenant'] = useAuthStore.getState().tenant || 'bmwindia';
  return config;
});

api.interceptors.response.use(
  (r) => r,
  async (err) => {
    const status = err.response?.status;
    const original = err.config || {};
    const isRefreshCall = String(original.url || '').includes('/auth/refresh');
    const isLoginCall = String(original.url || '').includes('/auth/login');
    const isPublicAuthCall = [
      '/auth/login', '/auth/register-company', '/auth/refresh',
      '/auth/activate', '/auth/verify-email', '/auth/forgot-password',
      '/auth/reset-password',
    ].some((path) => String(original.url || '').includes(path));

    if (status !== 401 || original._retry || isRefreshCall || isLoginCall || isPublicAuthCall) {
      if (status === 401 && isRefreshCall) useAuthStore.getState().logout();
      return Promise.reject(err);
    }

    const { refreshToken, setTokens, logout } = useAuthStore.getState();
    if (!refreshToken) {
      logout();
      return Promise.reject(err);
    }

    try {
      if (!refreshPromise) {
        if (demoMode) {
          const nextToken = `demo-access-${Date.now()}`;
          setTokens({ accessToken: nextToken, refreshToken });
          refreshPromise = Promise.resolve(nextToken).finally(() => {
            refreshPromise = null;
          });
        } else {
        refreshPromise = axios
          .post(
            '/api/auth/refresh',
            { refreshToken },
            {
              headers: {
                'X-Tenant': useAuthStore.getState().tenant || 'bmwindia',
              },
            },
          )
          .then((res) => {
            setTokens({
              accessToken: res.data?.accessToken,
              refreshToken: res.data?.refreshToken,
            });
            return res.data?.accessToken;
          })
          .finally(() => {
            refreshPromise = null;
          });
        }
      }

      const nextToken = await refreshPromise;
      if (!nextToken) throw new Error('No access token from refresh');
      original._retry = true;
      original.headers = { ...(original.headers || {}), Authorization: `Bearer ${nextToken}` };
      return api(original);
    } catch (refreshErr) {
      logout();
      return Promise.reject(refreshErr);
    }
  },
);

export default api;
