import React from 'react';
import { Link, useNavigate } from 'react-router-dom';

export default function ForbiddenPage() {
    const navigate = useNavigate();
    return (
        <div className="page container animate-fade-in" style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            minHeight: '60vh', textAlign: 'center',
        }}>
            <div style={{ fontSize: '6rem', marginBottom: 'var(--space-md)', opacity: 0.3 }}>403</div>
            <h1 style={{ fontSize: 'var(--font-size-2xl)', marginBottom: 'var(--space-sm)' }}>
                アクセスが拒否されました
            </h1>
            <p style={{ color: 'var(--color-text-secondary)', marginBottom: 'var(--space-xl)', maxWidth: 400, lineHeight: 1.8 }}>
                このページを閲覧する権限がありません。<br />
                ログインしていない場合はログインをお試しください。
            </p>
            <div style={{ display: 'flex', gap: 'var(--space-md)', flexWrap: 'wrap', justifyContent: 'center' }}>
                <button className="btn btn-secondary" onClick={() => navigate(-1)}>← 前のページへ戻る</button>
                <Link to="/login" className="btn btn-primary">ログイン</Link>
                <Link to="/" className="btn btn-secondary">トップへ</Link>
            </div>
        </div>
    );
}
