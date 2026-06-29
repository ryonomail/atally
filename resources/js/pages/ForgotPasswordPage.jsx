import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Eye, EyeOff } from 'lucide-react';
import api from '../api';

export default function ForgotPasswordPage() {
    const [step, setStep] = useState(1);
    const [email, setEmail] = useState('');
    const [code, setCode] = useState('');
    const [password, setPassword] = useState('');
    const [passwordConfirmation, setPasswordConfirmation] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(false);
    const [fieldErrors, setFieldErrors] = useState({});
    const [showPassword, setShowPassword] = useState(false);
    const [showPasswordConfirm, setShowPasswordConfirm] = useState(false);

    const fieldErrorStyle = { color: '#ef4444', fontSize: 'var(--font-size-xs)', marginTop: 2 };

    const handleBlur = (name) => {
        let err = '';
        switch (name) {
            case 'password':
                if (password && password.length < 8) err = 'パスワードは8文字以上で入力してください';
                break;
            case 'passwordConfirmation':
                if (passwordConfirmation && passwordConfirmation !== password) err = 'パスワードが一致しません';
                break;
            case 'code':
                if (code && code.length < 6) err = '6桁のコードを入力してください';
                break;
        }
        setFieldErrors(prev => ({ ...prev, [name]: err }));
    };

    const handleSendCode = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        try {
            await api.post('/forgot-password', { email });
            setStep(2);
        } catch (err) {
            setError(err.response?.data?.message || 'エラーが発生しました。');
        } finally {
            setLoading(false);
        }
    };

    const handleResetPassword = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        try {
            await api.post('/reset-password', {
                email,
                code,
                password,
                password_confirmation: passwordConfirmation,
            });
            setSuccess(true);
        } catch (err) {
            setError(err.response?.data?.message || 'エラーが発生しました。');
        } finally {
            setLoading(false);
        }
    };

    if (success) {
        return (
            <div className="page" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div className="card animate-fade-in" style={{ maxWidth: 440, width: '100%', textAlign: 'center' }}>
                    <div style={{ fontSize: 48, marginBottom: 'var(--space-md)' }}>&#10003;</div>
                    <h1 style={{ fontSize: 'var(--font-size-2xl)', marginBottom: 'var(--space-md)' }}>
                        パスワードをリセットしました
                    </h1>
                    <p style={{ color: 'var(--color-text-secondary)', marginBottom: 'var(--space-xl)', fontSize: 'var(--font-size-sm)' }}>
                        新しいパスワードでログインしてください。
                    </p>
                    <Link to="/login" className="btn btn-primary btn-lg" style={{ width: '100%', display: 'inline-block', textAlign: 'center', textDecoration: 'none' }}>
                        ログインページへ
                    </Link>
                </div>
            </div>
        );
    }

    return (
        <div className="page" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div className="card animate-fade-in" style={{ maxWidth: 440, width: '100%' }}>
                <h1 style={{ fontSize: 'var(--font-size-2xl)', marginBottom: 'var(--space-sm)', textAlign: 'center' }}>
                    パスワードリセット
                </h1>
                <p style={{ textAlign: 'center', color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-sm)', marginBottom: 'var(--space-xl)' }}>
                    {step === 1
                        ? '登録済みのメールアドレスを入力してください。リセットコードをお送りします。'
                        : 'メールに届いた6桁のコードと新しいパスワードを入力してください。'}
                </p>

                {error && (
                    <div className="badge badge-error" style={{ display: 'block', textAlign: 'center', marginBottom: 'var(--space-md)', padding: 'var(--space-sm) var(--space-md)' }}>
                        {error}
                    </div>
                )}

                {step === 1 && (
                    <form onSubmit={handleSendCode}>
                        <div className="form-group">
                            <label className="form-label">メールアドレス</label>
                            <input
                                type="email"
                                className="form-input"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                            />
                        </div>
                        <button type="submit" className="btn btn-primary btn-lg" style={{ width: '100%' }} disabled={loading}>
                            {loading ? '送信中...' : 'リセットコードを送信'}
                        </button>
                    </form>
                )}

                {step === 2 && (
                    <form onSubmit={handleResetPassword}>
                        <div className="form-group">
                            <label className="form-label">メールアドレス</label>
                            <input
                                type="email"
                                className="form-input"
                                value={email}
                                disabled
                                style={{ opacity: 0.7 }}
                            />
                        </div>
                        <div className="form-group">
                            <label className="form-label">リセットコード（6桁）</label>
                            <input
                                type="text"
                                className="form-input"
                                value={code}
                                onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                                onBlur={() => handleBlur('code')}
                                placeholder="000000"
                                maxLength={6}
                                required
                                style={{ letterSpacing: '4px', fontSize: 'var(--font-size-lg)', textAlign: 'center', ...(fieldErrors.code ? { borderColor: '#ef4444' } : {}) }}
                            />
                            {fieldErrors.code && <div style={fieldErrorStyle}>{fieldErrors.code}</div>}
                        </div>
                        <div className="form-group">
                            <label className="form-label">新しいパスワード</label>
                            <div style={{ position: 'relative' }}>
                                <input
                                    type={showPassword ? 'text' : 'password'}
                                    className="form-input"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    onBlur={() => handleBlur('password')}
                                    minLength={8}
                                    required
                                    style={{ paddingRight: 42, ...(fieldErrors.password ? { borderColor: '#ef4444' } : {}) }}
                                />
                                <button type="button" onClick={() => setShowPassword(v => !v)}
                                    style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)', lineHeight: 1, padding: 0, display: 'inline-flex' }}>
                                    {showPassword ? <EyeOff size={18} strokeWidth={2} /> : <Eye size={18} strokeWidth={2} />}
                                </button>
                            </div>
                            <span style={{ fontSize: 'var(--font-size-xs)', color: fieldErrors.password ? '#ef4444' : 'var(--color-text-muted)' }}>8文字以上</span>
                            {fieldErrors.password && <div style={fieldErrorStyle}>{fieldErrors.password}</div>}
                        </div>
                        <div className="form-group">
                            <label className="form-label">新しいパスワード（確認）</label>
                            <div style={{ position: 'relative' }}>
                                <input
                                    type={showPasswordConfirm ? 'text' : 'password'}
                                    className="form-input"
                                    value={passwordConfirmation}
                                    onChange={(e) => setPasswordConfirmation(e.target.value)}
                                    onBlur={() => handleBlur('passwordConfirmation')}
                                    minLength={8}
                                    required
                                    style={{ paddingRight: 42, ...(fieldErrors.passwordConfirmation ? { borderColor: '#ef4444' } : {}) }}
                                />
                                <button type="button" onClick={() => setShowPasswordConfirm(v => !v)}
                                    style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)', lineHeight: 1, padding: 0, display: 'inline-flex' }}>
                                    {showPasswordConfirm ? <EyeOff size={18} strokeWidth={2} /> : <Eye size={18} strokeWidth={2} />}
                                </button>
                            </div>
                            {fieldErrors.passwordConfirmation && <div style={fieldErrorStyle}>{fieldErrors.passwordConfirmation}</div>}
                        </div>
                        <button type="submit" className="btn btn-primary btn-lg" style={{ width: '100%', marginBottom: 'var(--space-sm)' }} disabled={loading}>
                            {loading ? '処理中...' : 'パスワードをリセット'}
                        </button>
                        <button
                            type="button"
                            onClick={() => { setStep(1); setError(''); setCode(''); setPassword(''); setPasswordConfirmation(''); }}
                            style={{
                                width: '100%', background: 'none', border: 'none', cursor: 'pointer',
                                color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-sm)', padding: 'var(--space-sm)',
                            }}
                        >
                            コードを再送信する
                        </button>
                    </form>
                )}

                <p style={{ textAlign: 'center', marginTop: 'var(--space-lg)', color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-sm)' }}>
                    <Link to="/login">ログインに戻る</Link>
                </p>
            </div>
        </div>
    );
}
