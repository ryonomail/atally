import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

export default function RegisterPage() {
    const { register } = useAuth();
    const navigate = useNavigate();
    const [form, setForm] = useState({ name: '', email: '', password: '', password_confirmation: '', role: 'jobseeker', company_name: '', company_type: 'direct_employer' });
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [fieldErrors, setFieldErrors] = useState({});
    const [showPassword, setShowPassword] = useState(false);
    const [showPasswordConfirm, setShowPasswordConfirm] = useState(false);

    const validateField = (name, value) => {
        switch (name) {
            case 'email':
                if (value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value))
                    return 'メールアドレスの形式が正しくありません';
                break;
            case 'password':
                if (value && value.length < 8)
                    return 'パスワードは8文字以上で入力してください';
                break;
            case 'password_confirmation':
                if (value && value !== form.password)
                    return 'パスワードが一致しません';
                break;
            case 'company_name':
                if (form.role === 'company' && !value.trim())
                    return '会社名を入力してください';
                break;
        }
        return '';
    };

    const handleBlur = (name) => {
        const err = validateField(name, form[name]);
        setFieldErrors(prev => ({ ...prev, [name]: err }));
    };

    const fieldErrorStyle = { color: '#ef4444', fontSize: 'var(--font-size-xs)', marginTop: 2 };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        try {
            await register(form);
            const returnJob = localStorage.getItem('atally_return_job');
            navigate('/verify-email', { state: { email: form.email, returnJob: returnJob || null } });
        } catch (err) {
            const msg = err.response?.data?.message || err.response?.data?.errors;
            setError(typeof msg === 'string' ? msg : '登録に失敗しました。入力内容をご確認ください。');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="page" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div className="card animate-fade-in" style={{ maxWidth: 480, width: '100%' }}>
                <h1 style={{ fontSize: 'var(--font-size-2xl)', marginBottom: 'var(--space-xl)', textAlign: 'center' }}>
                    新規登録（無料）
                </h1>

                {/* SNS登録 */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)', marginBottom: 'var(--space-lg)' }}>
                    <SnsButton icon="G" color="#4285F4" label="Googleで登録（30秒）"
                        onClick={() => { window.location.href = `/auth/google/redirect?role=${form.role}`; }} />
                    <SnsButton icon="" color="#06C755" label="LINEで登録" comingSoon />
                    <SnsButton icon="" color="#000000" label="Appleで登録" comingSoon />
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)', marginBottom: 'var(--space-lg)' }}>
                    <div style={{ flex: 1, height: 1, background: 'var(--color-border)' }} />
                    <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>またはメールで登録</span>
                    <div style={{ flex: 1, height: 1, background: 'var(--color-border)' }} />
                </div>

                {error && <div className="badge badge-error" style={{ display: 'block', textAlign: 'center', marginBottom: 'var(--space-md)', padding: 'var(--space-sm) var(--space-md)' }}>{error}</div>}

                <form onSubmit={handleSubmit}>
                    {/* ロール選択 */}
                    <div className="form-group">
                        <label className="form-label">アカウントタイプ</label>
                        <div style={{ display: 'flex', gap: 'var(--space-md)', marginBottom: 'var(--space-sm)' }}>
                            <label className="card" style={{
                                flex: 1, padding: 'var(--space-md)', cursor: 'pointer', textAlign: 'center',
                                borderColor: form.role === 'jobseeker' ? 'var(--color-accent)' : undefined,
                                borderWidth: form.role === 'jobseeker' ? 2 : 1,
                            }}>
                                <input type="radio" name="role" value="jobseeker" checked={form.role === 'jobseeker'}
                                    onChange={e => setForm({...form, role: e.target.value})} style={{ display: 'none' }} />
                                <div style={{ fontSize: '1.5rem' }}>👤</div>
                                <div style={{ fontWeight: 600, fontSize: 'var(--font-size-sm)' }}>求職者</div>
                                <div style={{ fontSize: 10, color: 'var(--color-text-muted)', marginTop: 2 }}>完全無料</div>
                            </label>
                            <label className="card" style={{
                                flex: 1, padding: 'var(--space-md)', cursor: 'pointer', textAlign: 'center',
                                borderColor: form.role === 'company' ? 'var(--color-accent)' : undefined,
                                borderWidth: form.role === 'company' ? 2 : 1,
                            }}>
                                <input type="radio" name="role" value="company" checked={form.role === 'company'}
                                    onChange={e => setForm({...form, role: e.target.value})} style={{ display: 'none' }} />
                                <div style={{ fontSize: '1.5rem' }}>🏢</div>
                                <div style={{ fontWeight: 600, fontSize: 'var(--font-size-sm)' }}>企業</div>
                                <div style={{ fontSize: 10, color: 'var(--color-text-muted)', marginTop: 2 }}>無料掲載あり</div>
                            </label>
                        </div>
                        {/* ロール別メリット */}
                        {form.role === 'jobseeker' ? (
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                                {['ブラック求人排除', '個人情報保護', '求人検索・応募 無料', '履歴書作成 無料', 'メッセージ 無料'].map((t, i) => (
                                    <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 3, padding: '3px 8px', borderRadius: 'var(--radius-full)', background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)', fontSize: 11, color: '#16a34a', fontWeight: 500 }}>✓ {t}</span>
                                ))}
                            </div>
                        ) : (
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                                {['無料掲載あり', '成功報酬¥0', '有料は¥500〜/日', 'いつでも停止可'].map((t, i) => (
                                    <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 3, padding: '3px 8px', borderRadius: 'var(--radius-full)', background: 'rgba(18,28,52,0.06)', border: '1px solid rgba(18,28,52,0.15)', fontSize: 11, color: 'var(--color-text-accent)', fontWeight: 500 }}>✓ {t}</span>
                                ))}
                            </div>
                        )}
                    </div>

                    {form.role === 'company' && (
                        <>
                            <div className="form-group">
                                <label className="form-label">会社名</label>
                                <input type="text" className="form-input" value={form.company_name}
                                    onChange={e => setForm({...form, company_name: e.target.value})}
                                    onBlur={() => handleBlur('company_name')}
                                    required placeholder="例: 株式会社〇〇"
                                    style={fieldErrors.company_name ? { borderColor: '#ef4444' } : {}} />
                                {fieldErrors.company_name && <div style={fieldErrorStyle}>{fieldErrors.company_name}</div>}
                            </div>
                            <div className="form-group">
                                <label className="form-label">企業タイプ</label>
                                <div style={{ display: 'flex', gap: 'var(--space-md)' }}>
                                    <label className="card" style={{
                                        flex: 1, padding: 'var(--space-sm) var(--space-md)', cursor: 'pointer', textAlign: 'center',
                                        borderColor: form.company_type === 'direct_employer' ? 'var(--color-accent)' : undefined,
                                    }}>
                                        <input type="radio" name="company_type" value="direct_employer"
                                            checked={form.company_type === 'direct_employer'}
                                            onChange={e => setForm({...form, company_type: e.target.value})} style={{ display: 'none' }} />
                                        <div style={{ fontWeight: 600, fontSize: 'var(--font-size-sm)' }}>事業会社</div>
                                        <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>自社の求人を掲載</div>
                                    </label>
                                    <label className="card" style={{
                                        flex: 1, padding: 'var(--space-sm) var(--space-md)', cursor: 'pointer', textAlign: 'center',
                                        borderColor: form.company_type === 'recruitment_agency' ? 'var(--color-accent)' : undefined,
                                    }}>
                                        <input type="radio" name="company_type" value="recruitment_agency"
                                            checked={form.company_type === 'recruitment_agency'}
                                            onChange={e => setForm({...form, company_type: e.target.value})} style={{ display: 'none' }} />
                                        <div style={{ fontWeight: 600, fontSize: 'var(--font-size-sm)' }}>人材紹介会社</div>
                                        <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>紹介・仲介業務</div>
                                    </label>
                                </div>
                            </div>
                        </>
                    )}

                    <div className="form-group">
                        <label className="form-label">お名前{form.role === 'company' ? '（担当者名）' : ''}</label>
                        <input type="text" className="form-input" value={form.name}
                            onChange={e => setForm({...form, name: e.target.value})} required />
                    </div>
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
                            required minLength={8}
                            style={{ paddingRight: 42, ...(fieldErrors.password ? { borderColor: '#ef4444' } : {}) }} />
                        <button type="button" onClick={() => setShowPassword(v => !v)}
                            style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)', fontSize: 16, lineHeight: 1, padding: 0 }}
                            aria-label={showPassword ? 'パスワードを隠す' : 'パスワードを表示'}>
                            {showPassword ? '🙈' : '👁'}
                        </button>
                        </div>
                        {form.password && (() => {
                            const len = form.password.length;
                            const hasUpper = /[A-Z]/.test(form.password);
                            const hasNum = /\d/.test(form.password);
                            const hasSpecial = /[^A-Za-z0-9]/.test(form.password);
                            const score = (len >= 8 ? 1 : 0) + (len >= 12 ? 1 : 0) + (hasUpper ? 1 : 0) + (hasNum ? 1 : 0) + (hasSpecial ? 1 : 0);
                            const level = score <= 1 ? { label: '弱い', color: '#ef4444', width: '20%' }
                                : score <= 2 ? { label: 'やや弱い', color: '#f59e0b', width: '40%' }
                                : score <= 3 ? { label: '普通', color: '#eab308', width: '60%' }
                                : score <= 4 ? { label: '強い', color: '#22c55e', width: '80%' }
                                : { label: 'とても強い', color: '#16a34a', width: '100%' };
                            return (
                                <div style={{ marginTop: 4 }}>
                                    <div style={{ height: 3, background: 'rgba(0,0,0,0.06)', borderRadius: 2, overflow: 'hidden' }}>
                                        <div style={{ height: '100%', width: level.width, background: level.color, transition: 'all 0.3s', borderRadius: 2 }} />
                                    </div>
                                    <span style={{ fontSize: 'var(--font-size-xs)', color: level.color }}>{level.label}</span>
                                </div>
                            );
                        })()}
                        {!form.password && <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>8文字以上</span>}
                        {fieldErrors.password && <div style={fieldErrorStyle}>{fieldErrors.password}</div>}
                    </div>
                    <div className="form-group">
                        <label className="form-label">パスワード（確認）</label>
                        <div style={{ position: 'relative' }}>
                        <input type={showPasswordConfirm ? 'text' : 'password'} className="form-input" value={form.password_confirmation}
                            onChange={e => setForm({...form, password_confirmation: e.target.value})}
                            onBlur={() => handleBlur('password_confirmation')}
                            required
                            style={{ paddingRight: 42, ...(fieldErrors.password_confirmation ? { borderColor: '#ef4444' } : {}) }} />
                        <button type="button" onClick={() => setShowPasswordConfirm(v => !v)}
                            style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)', fontSize: 16, lineHeight: 1, padding: 0 }}
                            aria-label={showPasswordConfirm ? 'パスワードを隠す' : 'パスワードを表示'}>
                            {showPasswordConfirm ? '🙈' : '👁'}
                        </button>
                        </div>
                        {fieldErrors.password_confirmation && <div style={fieldErrorStyle}>{fieldErrors.password_confirmation}</div>}
                    </div>

                    <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', margin: 'var(--space-sm) 0', lineHeight: 1.6 }}>
                        登録することで、<Link to="/terms" target="_blank" style={{ color: 'var(--color-text-accent)' }}>利用規約</Link>および
                        <Link to="/privacy" target="_blank" style={{ color: 'var(--color-text-accent)' }}>プライバシーポリシー</Link>に同意したものとみなします。
                    </p>

                    <button type="submit" className="btn btn-primary btn-lg" style={{ width: '100%' }} disabled={loading}>
                        {loading ? '登録中...' : '無料で登録'}
                    </button>

                    {/* 安心シグナル */}
                    <div style={{ display: 'flex', justifyContent: 'center', gap: 'var(--space-sm)', marginTop: 'var(--space-md)', flexWrap: 'wrap' }}>
                        {[
                            { icon: '⚖️', label: '職業安定法準拠' },
                            { icon: '🛡️', label: '個人情報保護方針準拠' },
                            { icon: '🔒', label: 'SSL/TLS暗号化' },
                        ].map((b, i) => (
                            <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 11, color: 'var(--color-text-muted)' }}>
                                {b.icon} {b.label}
                            </span>
                        ))}
                    </div>
                </form>

                <p style={{ textAlign: 'center', marginTop: 'var(--space-lg)', color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-sm)' }}>
                    既にアカウントをお持ちの方は <Link to="/login">ログイン</Link>
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
