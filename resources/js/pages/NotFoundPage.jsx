import React from 'react';
import { Link } from 'react-router-dom';

export default function NotFoundPage() {
    return (
        <div className="page container animate-fade-in" style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            minHeight: '60vh', textAlign: 'center',
        }}>
            <div style={{ fontSize: '6rem', marginBottom: 'var(--space-md)', opacity: 0.3 }}>404</div>
            <h1 style={{ fontSize: 'var(--font-size-2xl)', marginBottom: 'var(--space-sm)' }}>
                ページが見つかりません
            </h1>
            <p style={{ color: 'var(--color-text-secondary)', marginBottom: 'var(--space-xl)', maxWidth: 400 }}>
                お探しのページは移動または削除された可能性があります。URLをご確認ください。
            </p>
            <div style={{ display: 'flex', gap: 'var(--space-md)' }}>
                <Link to="/" className="btn btn-primary">トップページへ</Link>
                <Link to="/jobs" className="btn btn-secondary">求人を探す</Link>
            </div>
        </div>
    );
}
