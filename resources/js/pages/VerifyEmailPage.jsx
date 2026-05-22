import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import api from '../api';

export default function VerifyEmailPage() {
    const navigate = useNavigate();
    const location = useLocation();
    const email = location.state?.email || '';
    const returnJob = location.state?.returnJob || null;

    const [code, setCode] = useState('');
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [loading, setLoading] = useState(false);
    const [resending, setResending] = useState(false);

    const handleVerify = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        setSuccess('');
        try {
            await api.post('/verify-email', { email, code });
            localStorage.removeItem('atally_return_job');
            localStorage.removeItem('guest_resume_draft');
            navigate(returnJob ? `/jobs/${returnJob}` : '/dashboard');
        } catch (err) {
            setError(err.response?.data?.message || '確認に失敗しました。');
        } finally {
            setLoading(false);
        }
    };

    const handleResend = async () => {
        setResending(true);
        setError('');
        setSuccess('');
        try {
            const res = await api.post('/resend-verification', { email });
            setSuccess(res.data.message);
        } catch (err) {
            setError(err.response?.data?.message || '再送信に失敗しました。');
        } finally {
            setResending(false);
        }
    };

    const handleCodeChange = (e) => {
        const value = e.target.value.replace(/[^0-9]/g, '').slice(0, 6);
        setCode(value);
    };

    return (
        <div className="page" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div className="card animate-fade-in" style={{ maxWidth: 480, width: '100%' }}>
                <h1 style={{ fontSize: 'var(--font-size-2xl)', marginBottom: 'var(--space-sm)', textAlign: 'center' }}>
                    メールアドレス確認
                </h1>
                <p style={{ textAlign: 'center', color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-sm)', marginBottom: 'var(--space-xl)' }}>
                    <strong>{email}</strong> に送信された6桁の確認コードを入力してください。
                </p>

                {error && (
                    <div className="badge badge-error" style={{ display: 'block', textAlign: 'center', marginBottom: 'var(--space-md)', padding: 'var(--space-sm) var(--space-md)' }}>
                        {error}
                    </div>
                )}
                {success && (
                    <div className="badge badge-success" style={{ display: 'block', textAlign: 'center', marginBottom: 'var(--space-md)', padding: 'var(--space-sm) var(--space-md)' }}>
                        {success}
                    </div>
                )}

                <form onSubmit={handleVerify}>
                    <div className="form-group">
                        <label className="form-label">確認コード</label>
                        <input
                            type="text"
                            className="form-input"
                            value={code}
                            onChange={handleCodeChange}
                            placeholder="000000"
                            maxLength={6}
                            required
                            style={{ textAlign: 'center', fontSize: 'var(--font-size-xl)', letterSpacing: '8px' }}
                            autoFocus
                        />
                    </div>

                    <button
                        type="submit"
                        className="btn btn-primary btn-lg"
                        style={{ width: '100%' }}
                        disabled={loading || code.length !== 6}
                    >
                        {loading ? '確認中...' : '確認'}
                    </button>
                </form>

                <p style={{ textAlign: 'center', marginTop: 'var(--space-lg)', fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>
                    コードが届かない場合は{' '}
                    <button
                        onClick={handleResend}
                        disabled={resending}
                        style={{
                            background: 'none',
                            border: 'none',
                            color: 'var(--color-text-accent)',
                            cursor: resending ? 'not-allowed' : 'pointer',
                            padding: 0,
                            fontSize: 'inherit',
                            textDecoration: 'underline',
                        }}
                    >
                        {resending ? '送信中...' : 'コードを再送信'}
                    </button>
                </p>
            </div>
        </div>
    );
}
