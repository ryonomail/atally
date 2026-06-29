import React, { useEffect, useState } from 'react';

const TYPE_STYLES = {
    success: {
        background: 'linear-gradient(135deg, #10b981, #059669)',
        borderColor: '#059669',
        icon: '\u2713',
    },
    error: {
        background: 'linear-gradient(135deg, #ef4444, #dc2626)',
        borderColor: '#dc2626',
        icon: '\u2717',
    },
    info: {
        background: 'linear-gradient(135deg, #1a2744, #121c34)',
        borderColor: '#121c34',
        icon: '\u2139',
    },
};

export default function Toast({ message, type = 'info', onClose }) {
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        // Trigger slide-in
        requestAnimationFrame(() => setVisible(true));

        const timer = setTimeout(() => {
            setVisible(false);
            setTimeout(() => onClose(), 300);
        }, 3000);

        return () => clearTimeout(timer);
    }, [onClose]);

    const styles = TYPE_STYLES[type] || TYPE_STYLES.info;

    return (
        <div style={{
            transform: visible ? 'translateX(0)' : 'translateX(120%)',
            opacity: visible ? 1 : 0,
            transition: 'transform 0.3s ease, opacity 0.3s ease',
            maxWidth: 400,
            minWidth: 280,
            background: styles.background,
            color: '#fff',
            borderRadius: 'var(--radius-lg, 12px)',
            padding: 'var(--space-md, 16px) var(--space-lg, 20px)',
            boxShadow: '0 8px 32px rgba(0,0,0,0.25)',
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-sm, 10px)',
            fontSize: 'var(--font-size-sm, 14px)',
            lineHeight: 1.5,
        }}>
            <span style={{
                fontSize: '1.2rem',
                fontWeight: 700,
                flexShrink: 0,
                width: 24,
                height: 24,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: '50%',
                background: 'rgba(255,255,255,0.2)',
            }}>
                {styles.icon}
            </span>
            <span style={{ flex: 1, whiteSpace: 'pre-wrap' }}>{message}</span>
            <button
                onClick={() => { setVisible(false); setTimeout(() => onClose(), 300); }}
                style={{
                    background: 'none', border: 'none', color: '#fff',
                    cursor: 'pointer', fontSize: '1rem', padding: 4,
                    opacity: 0.7, flexShrink: 0,
                }}
            >
                \u2715
            </button>
        </div>
    );
}
