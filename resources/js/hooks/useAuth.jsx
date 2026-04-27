import React, { createContext, useContext, useState, useEffect } from 'react';
import api from '../api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
    const [user, setUser] = useState(() => {
        const saved = localStorage.getItem('user');
        return saved ? JSON.parse(saved) : null;
    });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const authCode = params.get('auth_code');
        const authError = params.get('auth_error');

        // Google OAuth コールバック: 一時コードをトークンに交換
        if (authCode) {
            window.history.replaceState({}, '', window.location.pathname);
            api.post('/auth/exchange-code', { code: authCode })
                .then(res => {
                    localStorage.setItem('auth_token', res.data.token);
                    localStorage.setItem('user', JSON.stringify(res.data.user));
                    setUser(res.data.user);
                })
                .catch(() => {
                    // 交換失敗（期限切れ等）
                })
                .finally(() => setLoading(false));
            return;
        }

        if (authError) {
            window.history.replaceState({}, '', window.location.pathname);
        }

        const token = localStorage.getItem('auth_token');
        if (token) {
            api.get('/me')
                .then(res => {
                    setUser(res.data.user);
                    localStorage.setItem('user', JSON.stringify(res.data.user));
                })
                .catch(() => {
                    localStorage.removeItem('auth_token');
                    localStorage.removeItem('user');
                    setUser(null);
                })
                .finally(() => setLoading(false));
        } else {
            setLoading(false);
        }
    }, []);

    const login = async (email, password) => {
        const res = await api.post('/login', { email, password });
        localStorage.setItem('auth_token', res.data.token);
        localStorage.setItem('user', JSON.stringify(res.data.user));
        setUser(res.data.user);
        return res.data;
    };

    const register = async (data) => {
        const res = await api.post('/register', data);
        localStorage.setItem('auth_token', res.data.token);
        localStorage.setItem('user', JSON.stringify(res.data.user));
        setUser(res.data.user);
        return res.data;
    };

    const logout = async () => {
        try {
            await api.post('/logout');
        } finally {
            localStorage.removeItem('auth_token');
            localStorage.removeItem('user');
            setUser(null);
        }
    };

    const updateUser = (updatedUser) => {
        localStorage.setItem('user', JSON.stringify(updatedUser));
        setUser(updatedUser);
    };

    return (
        <AuthContext.Provider value={{ user, login, register, logout, loading, updateUser }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
}
