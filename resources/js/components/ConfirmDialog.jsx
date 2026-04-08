import React from 'react';

export default function ConfirmDialog({
    title = '',
    message = '',
    onConfirm,
    onCancel,
    confirmText = '\u78ba\u8a8d',
    cancelText = '\u30ad\u30e3\u30f3\u30bb\u30eb',
}) {
    return (
        <div
            onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}
            style={{
                position: 'fixed',
                top: 0, left: 0, right: 0, bottom: 0,
                background: 'rgba(0,0,0,0.5)',
                zIndex: 10000,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: 'var(--space-lg, 24px)',
            }}
        >
            <div
                className="card"
                style={{
                    maxWidth: 420,
                    width: '100%',
                    padding: 'var(--space-xl, 24px)',
                    animation: 'fade-in 0.2s ease',
                }}
            >
                {title && (
                    <h3 style={{
                        fontSize: 'var(--font-size-lg, 18px)',
                        marginBottom: 'var(--space-sm, 8px)',
                    }}>
                        {title}
                    </h3>
                )}
                <p style={{
                    color: 'var(--color-text-secondary)',
                    fontSize: 'var(--font-size-sm, 14px)',
                    marginBottom: 'var(--space-lg, 20px)',
                    whiteSpace: 'pre-wrap',
                    lineHeight: 1.6,
                }}>
                    {message}
                </p>
                <div style={{
                    display: 'flex',
                    justifyContent: 'flex-end',
                    gap: 'var(--space-sm, 8px)',
                }}>
                    <button className="btn btn-secondary" onClick={onCancel}>
                        {cancelText}
                    </button>
                    <button className="btn btn-primary" onClick={onConfirm}>
                        {confirmText}
                    </button>
                </div>
            </div>
        </div>
    );
}
