import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

function GoogleRoleModal({ onSelect, onClose }) {
    return (
        <div style={{
            position: 'fixed', inset: 0, zIndex: 1000,
            background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: 'var(--space-md)',
        }} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
            <div className="card animate-fade-in" style={{ width: '100%', maxWidth: 400, padding: 'var(--space-xl)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-lg)' }}>
                    <h2 style={{ fontSize: 'var(--font-size-lg)', margin: 0 }}>どちらとして利用しますか？</h2>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: 'var(--color-text-muted)' }}>✕</button>
                </div>
                <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', marginBottom: 'var(--space-lg)' }}>
                    すでにアカウントをお持ちの方は、登録時の種別が自動的に引き継がれます。
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
                    <button className="btn btn-primary" style={{ padding: 'var(--space-md)', fontSize: 'var(--font-size-base)' }}
                        onClick={() => onSelect('jobseeker')}>
                        👤 求職者として登録・ログイン
                    </button>
                    <button className="btn btn-secondary" style={{ padding: 'var(--space-md)', fontSize: 'var(--font-size-base)' }}
                        onClick={() => onSelect('company')}>
                        🏢 企業担当者として登録・ログイン
                    </button>
                </div>
            </div>
        </div>
    );
}

export default function LoginPage() {
    const { login } = useAuth();
    const navigate = useNavigate();
    const [form, setForm] = useState({ email: '', password: '' });
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [fieldErrors, setFieldErrors] = useState({});
    const [showPassword, setShowPassword] = useState(false);
    const [showGoogleModal, setShowGoogleModal] = useState(false);

    const handleBlur = (name) => {
        let err = '';
        if (name === 'email' && form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
            err = 'メールアドレスの形式が正しくありません';
        }
        if (name === 'password' && form.password && form.password.length < 8) {
            err = 'パスワードは8文字以上です';
        }
        setFieldErrors(prev => ({ ...prev, [name]: err }));
    };

    const fieldErrorStyle = { color: '#ef4444', fontSize: 'var(--font-size-xs)', marginTop: 2 };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        try {
            const res = await login(form.email, form.password);
            const role = res.user?.role;
            const companyType = res.user?.company?.company_type;
            const dest = role === 'admin' ? '/admin'
                : role === 'company' ? '/company'
                : '/jobs';
            navigate(dest);
        } catch (err) {
            setError(err.response?.data?.message || 'ログインに失敗しました。');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="page" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {showGoogleModal && (
                <GoogleRoleModal
                    onSelect={role => { window.location.href = `/auth/google/redirect?role=${role}`; }}
                    onClose={() => setShowGoogleModal(false)}
                />
            )}
            <div className="card animate-fade-in" style={{ maxWidth: 440, width: '100%' }}>
                <h1 style={{ fontSize: 'var(--font-size-2xl)', marginBottom: 'var(--space-xl)', textAlign: 'center' }}>
                    ログイン
                </h1>

                {/* SNSログイン */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)', marginBottom: 'var(--space-lg)' }}>
                    <SnsButton icon="G" color="#4285F4" label="Googleでログイン" onClick={() => setShowGoogleModal(true)} />
                    <SnsButton icon="" color="#06C755" label="LINEでログイン" comingSoon />
                    <SnsButton icon="" color="#000000" label="Appleでログイン" comingSoon />
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)', marginBottom: 'var(--space-lg)' }}>
                    <div style={{ flex: 1, height: 1, background: 'var(--color-border)' }} />
                    <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>またはメールでログイン</span>
                    <div style={{ flex: 1, height: 1, background: 'var(--color-border)' }} />
                </div>

                {error && <div className="badge badge-error" style={{ display: 'block', textAlign: 'center', marginBottom: 'var(--space-md)', padding: 'var(--space-sm) var(--space-md)' }}>{error}</div>}

                <form onSubmit={handleSubmit}>
                    <div className="form-group">
                        <label className="form-label">メールアドレス</label>
                        <input type="email" className="form-input" value={form.email}
                            onChange={e => setForm({...form, email: e.target.value})}
                            onBlur={() => handleBlur('email')}
                            required
                            style={fieldErrors.email ? { borderColor: '#ef4444' } : {}} />
                        {fieldErrors.email && <div style={fieldErrorStyle}>{fieldErrors.email}</div>}
                    </div>
                    <div className="form-group">
                        <label className="form-label">パスワード</label>
                        <div style={{ position: 'relative' }}>
                            <input type={showPassword ? 'text' : 'password'} className="form-input" value={form.password}
                                onChange={e => setForm({...form, password: e.target.value})}
                                onBlur={() => handleBlur('password')}
                                required
                                style={{ paddingRight: 42, ...(fieldErrors.password ? { borderColor: '#ef4444' } : {}) }} />
                            <button type="button" onClick={() => setShowPassword(v => !v)}
                                style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)', fontSize: 16, lineHeight: 1, padding: 0 }}
                                aria-label={showPassword ? 'パスワードを隠す' : 'パスワードを表示'}>
                                {showPassword ? '🙈' : '👁'}
                            </button>
                        </div>
                        {fieldErrors.password && <div style={fieldErrorStyle}>{fieldErrors.password}</div>}
                    </div>
                    <button type="submit" className="btn btn-primary btn-lg" style={{ width: '100%' }} disabled={loading}>
                        {loading ? 'ログイン中...' : 'ログイン'}
                    </button>
                </form>

                <p style={{ textAlign: 'center', marginTop: 'var(--space-md)', fontSize: 'var(--font-size-sm)' }}>
                    <Link to="/forgot-password" style={{ color: 'var(--color-text-secondary)' }}>パスワードをお忘れの方</Link>
                </p>
                <p style={{ textAlign: 'center', marginTop: 'var(--space-sm)', color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-sm)' }}>
                    アカウントをお持ちでない方は <Link to="/register">新規登録</Link>
                </p>
            </div>
        </div>
    );
}

function SnsButton({ icon, color, label, onClick, comingSoon }) {
    const content = (
        <div style={{
            display: 'flex', alignItems: 'center', gap: 'var(--space-md)',
            padding: 'var(--space-sm) var(--space-lg)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-md)',
            background: 'var(--color-bg-surface)',
            cursor: comingSoon ? 'not-allowed' : 'pointer',
            opacity: comingSoon ? 0.65 : 1,
        }}>
            <div style={{
                width: 32, height: 32, borderRadius: '50%', background: color,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: '#fff', fontWeight: 700, fontSize: 14, flexShrink: 0,
            }}>{icon}</div>
            <span style={{ flex: 1, fontWeight: 600, fontSize: 'var(--font-size-sm)' }}>{label}</span>
            {comingSoon && (
                <span style={{ fontSize: 10, padding: '2px 6px', background: 'rgba(245,158,11,0.15)', color: '#d97706', borderRadius: 'var(--radius-sm)', fontWeight: 600 }}>
                    近日公開
                </span>
            )}
        </div>
    );
    if (comingSoon) return <div>{content}</div>;
    return <div onClick={onClick} style={{ cursor: 'pointer', color: 'inherit' }}>{content}</div>;
}
