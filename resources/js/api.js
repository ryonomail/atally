import axios from 'axios';

const api = axios.create({
    baseURL: '/api',
    headers: {
        'Accept': 'application/json',
    },
});

// ── ブラウザ側レスポンスキャッシュ ─────────────────────────────────────
// GET リクエストをsessionStorageにキャッシュし、同じURLへの再リクエストを即返却する
// TTL: 3分（求人データは数分で変わらない）
// ログイン済みユーザー（Authorizationヘッダーあり）はキャッシュしない（個人情報保護）
const BROWSER_CACHE_TTL = 3 * 60 * 1000; // 3分
const BROWSER_CACHE_PREFIX = 'api_cache_';

function getBrowserCache(key) {
    try {
        const raw = sessionStorage.getItem(BROWSER_CACHE_PREFIX + key);
        if (!raw) return null;
        const { data, expiry } = JSON.parse(raw);
        if (Date.now() > expiry) {
            sessionStorage.removeItem(BROWSER_CACHE_PREFIX + key);
            return null;
        }
        return data;
    } catch { return null; }
}

function setBrowserCache(key, data) {
    try {
        sessionStorage.setItem(BROWSER_CACHE_PREFIX + key, JSON.stringify({
            data,
            expiry: Date.now() + BROWSER_CACHE_TTL,
        }));
    } catch { /* sessionStorage容量超過時は無視 */ }
}

// Token injection & FormData handling
api.interceptors.request.use((config) => {
    const token = localStorage.getItem('auth_token');
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    // FormData の場合は multipart/form-data を明示設定（axiosが自動でboundaryを付与する）
    if (config.data instanceof FormData) {
        config.headers['Content-Type'] = 'multipart/form-data';
    }

    // GETリクエスト & 非ログイン時のみキャッシュ適用
    if (config.method === 'get' && !token) {
        const cacheKey = config.url + JSON.stringify(config.params || {});
        const cached = getBrowserCache(cacheKey);
        if (cached) {
            // キャッシュヒット: リクエストをキャンセルしてキャッシュを返す
            config.adapter = () => Promise.resolve({
                data: cached,
                status: 200,
                statusText: 'OK (cache)',
                headers: {},
                config,
            });
        }
    }
    return config;
});

// レスポンスをsessionStorageにキャッシュ保存
api.interceptors.response.use(
    (response) => {
        const token = localStorage.getItem('auth_token');
        if (response.config.method === 'get' && !token && response.status === 200) {
            const cacheKey = response.config.url + JSON.stringify(response.config.params || {});
            // キャッシュから返ってきたレスポンスは再保存しない
            if (response.statusText !== 'OK (cache)') {
                setBrowserCache(cacheKey, response.data);
            }
        }
        return response;
    },
    (error) => Promise.reject(error),
);

// Handle 401 → clear token (do NOT force redirect on public pages)
api.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response?.status === 401) {
            localStorage.removeItem('auth_token');
            localStorage.removeItem('user');
            // Only redirect if user is on a protected page (not public job pages, landing, etc.)
            const publicPaths = ['/', '/jobs', '/login', '/register', '/resumes/guest'];
            const isPublic = publicPaths.some(p =>
                window.location.pathname === p || window.location.pathname.startsWith('/jobs/')
            );
            if (!isPublic) {
                window.location.href = '/login';
            }
        }
        return Promise.reject(error);
    }
);

export default api;
