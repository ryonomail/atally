import axios from 'axios';

const api = axios.create({
    baseURL: '/api',
    headers: {
        'Accept': 'application/json',
    },
});

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
    return config;
});

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
