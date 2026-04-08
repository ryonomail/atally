import React, { createContext, useContext, useState, useCallback } from 'react';
import Toast from '../components/Toast';

const ToastContext = createContext(null);

export function ToastProvider({ children }) {
    const [toasts, setToasts] = useState([]);

    const show = useCallback((message, type = 'info') => {
        const id = Date.now() + Math.random();
        setToasts(prev => [...prev, { id, message, type }]);
    }, []);

    const success = useCallback((message) => show(message, 'success'), [show]);
    const error = useCallback((message) => show(message, 'error'), [show]);
    const info = useCallback((message) => show(message, 'info'), [show]);

    const remove = useCallback((id) => {
        setToasts(prev => prev.filter(t => t.id !== id));
    }, []);

    return (
        <ToastContext.Provider value={{ show, success, error, info }}>
            {children}
            <div style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 10000, display: 'flex', flexDirection: 'column-reverse', gap: 8 }}>
                {toasts.map((t, i) => (
                    <div key={t.id} style={{ transform: `translateY(${-i * 0}px)` }}>
                        <Toast message={t.message} type={t.type} onClose={() => remove(t.id)} />
                    </div>
                ))}
            </div>
        </ToastContext.Provider>
    );
}

export function useToast() {
    const context = useContext(ToastContext);
    if (!context) {
        throw new Error('useToast must be used within a ToastProvider');
    }
    return context;
}
