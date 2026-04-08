import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../hooks/useToast';

export default function SettingsPage() {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const [passwordForm, setPasswordForm] = useState({
        current_password: '',
        new_password: '',
        new_password_confirmation: '',
    });
    const [passwordSaving, setPasswordSaving] = useState(false);
    const [passwordErrors, setPasswordErrors] = useState({});
    const [showCurrentPw, setShowCurrentPw] = useState(false);
    const [showNewPw, setShowNewPw] = useState(false);
    const [showNewPwConfirm, setShowNewPwConfirm] = useState(false);

    const [notifications, setNotifications] = useState({
        email_on_new_application: true,
        email_on_message: true,
        email_on_scout: true,
        email_on_job_alert: true,
    });
    const [notifLoading, setNotifLoading] = useState(true);
    const [notifSaving, setNotifSaving] = useState(false);

    const toast = useToast();

    useEffect(() => {
        api.get('/settings/notifications')
            .then(res => setNotifications(res.data.notifications))
            .catch(() => {})
            .finally(() => setNotifLoading(false));
    }, []);

    const [fieldErrors, setFieldErrors] = useState({});

    const handlePasswordBlur = (name) => {
        let err = '';
        switch (name) {
            case 'new_password':
                if (passwordForm.new_password && passwordForm.new_password.length < 8)
                    err = 'パスワードは8文字以上で入力してください';
                break;
            case 'new_password_confirmation':
                if (passwordForm.new_password_confirmation && passwordForm.new_password_confirmation !== passwordForm.new_password)
                    err = 'パスワードが一致しません';
                break;
        }
        setFieldErrors(prev => ({ ...prev, [name]: err }));
    };

    const handlePasswordChange = async () => {
        setPasswordErrors({});
        setFieldErrors({});
        setPasswordSaving(true);
        try {
            await api.put('/settings/password', passwordForm);
            toast.success('パスワードを変更しました');
            setPasswordForm({ current_password: '', new_password: '', new_password_confirmation: '' });
        } catch (err) {
            const errors = err.response?.data?.errors;
            if (errors) {
                setPasswordErrors(errors);
            } else {
                toast.error('パスワードの変更に失敗しました');
            }
        } finally {
            setPasswordSaving(false);
        }
    };

    const handleNotifSave = async () => {
        setNotifSaving(true);
        try {
            const res = await api.put('/settings/notifications', notifications);
            setNotifications(res.data.notifications);
            toast.success('通知設定を更新しました');
        } catch {
            toast.error('通知設定の更新に失敗しました');
        } finally {
            setNotifSaving(false);
        }
    };

    const toggleStyle = (enabled) => ({
        position: 'relative',
        width: 48,
        height: 26,
        borderRadius: 13,
        background: enabled ? 'var(--color-primary, #2563eb)' : 'var(--color-border, #d1d5db)',
        cursor: 'pointer',
        transition: 'background 0.2s',
        flexShrink: 0,
        border: 'none',
        padding: 0,
    });

    const toggleKnobStyle = (enabled) => ({
        position: 'absolute',
        top: 3,
        left: enabled ? 25 : 3,
        width: 20,
        height: 20,
        borderRadius: '50%',
        background: '#fff',
        transition: 'left 0.2s',
        boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
    });

    const isCompany = user?.role === 'company' || user?.role === 'agency';
    const notifItems = [
        // 企業のみ: 新規応募通知
        ...(isCompany ? [{ key: 'email_on_new_application', label: '新規応募の通知', desc: '求人に新しい応募があった場合にメールで通知' }] : []),
        { key: 'email_on_message', label: 'メッセージの通知', desc: '新しいメッセージを受信した場合にメールで通知' },
        // 求職者のみ: スカウト・求人アラート
        ...(!isCompany ? [
            { key: 'email_on_scout', label: 'スカウトの通知', desc: 'スカウトを受信した場合にメールで通知' },
            { key: 'email_on_job_alert', label: '求人アラートの通知', desc: '条件に合う新着求人がある場合にメールで通知' },
        ] : []),
    ];

    const errorStyle = { color: '#ef4444', fontSize: 'var(--font-size-xs)', marginTop: 2 };

    return (
        <div className="page container animate-fade-in">
            <h1 style={{ fontSize: 'var(--font-size-3xl)', marginBottom: 'var(--space-xl)' }}>設定</h1>

            <div style={{ maxWidth: 600 }}>
                {/* パスワード変更 */}
                <div className="card" style={{ marginBottom: 'var(--space-lg)' }}>
                    <h3 style={{ marginBottom: 'var(--space-md)' }}>パスワード変更</h3>

                    <div className="form-group">
                        <label className="form-label">現在のパスワード</label>
                        <div style={{ position: 'relative' }}>
                            <input
                                type={showCurrentPw ? 'text' : 'password'}
                                className="form-input"
                                value={passwordForm.current_password}
                                onChange={e => setPasswordForm({ ...passwordForm, current_password: e.target.value })}
                                placeholder="現在のパスワードを入力"
                                style={{ paddingRight: 42, ...(passwordErrors.current_password ? { borderColor: '#ef4444' } : {}) }}
                            />
                            <button type="button" onClick={() => setShowCurrentPw(v => !v)}
                                style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)', fontSize: 16, lineHeight: 1, padding: 0 }}>
                                {showCurrentPw ? '🙈' : '👁'}
                            </button>
                        </div>
                        {passwordErrors.current_password && (
                            <div style={errorStyle}>{passwordErrors.current_password[0]}</div>
                        )}
                    </div>

                    <div className="form-group">
                        <label className="form-label">新しいパスワード</label>
                        <div style={{ position: 'relative' }}>
                            <input
                                type={showNewPw ? 'text' : 'password'}
                                className="form-input"
                                value={passwordForm.new_password}
                                onChange={e => setPasswordForm({ ...passwordForm, new_password: e.target.value })}
                                onBlur={() => handlePasswordBlur('new_password')}
                                placeholder="8文字以上で入力"
                                style={{ paddingRight: 42, ...((passwordErrors.new_password || fieldErrors.new_password) ? { borderColor: '#ef4444' } : {}) }}
                            />
                            <button type="button" onClick={() => setShowNewPw(v => !v)}
                                style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)', fontSize: 16, lineHeight: 1, padding: 0 }}>
                                {showNewPw ? '🙈' : '👁'}
                            </button>
                        </div>
                        {fieldErrors.new_password && (
                            <div style={errorStyle}>{fieldErrors.new_password}</div>
                        )}
                        {passwordErrors.new_password && (
                            <div style={errorStyle}>{passwordErrors.new_password[0]}</div>
                        )}
                    </div>

                    <div className="form-group">
                        <label className="form-label">新しいパスワード（確認）</label>
                        <div style={{ position: 'relative' }}>
                            <input
                                type={showNewPwConfirm ? 'text' : 'password'}
                                className="form-input"
                                value={passwordForm.new_password_confirmation}
                                onChange={e => setPasswordForm({ ...passwordForm, new_password_confirmation: e.target.value })}
                                onBlur={() => handlePasswordBlur('new_password_confirmation')}
                                placeholder="もう一度入力"
                                style={{ paddingRight: 42, ...(fieldErrors.new_password_confirmation ? { borderColor: '#ef4444' } : {}) }}
                            />
                            <button type="button" onClick={() => setShowNewPwConfirm(v => !v)}
                                style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)', fontSize: 16, lineHeight: 1, padding: 0 }}>
                                {showNewPwConfirm ? '🙈' : '👁'}
                            </button>
                        </div>
                        {fieldErrors.new_password_confirmation && (
                            <div style={errorStyle}>{fieldErrors.new_password_confirmation}</div>
                        )}
                    </div>

                    <button
                        className="btn btn-primary"
                        onClick={handlePasswordChange}
                        disabled={passwordSaving || !passwordForm.current_password || !passwordForm.new_password || !passwordForm.new_password_confirmation}
                    >
                        {passwordSaving ? '変更中...' : 'パスワードを変更'}
                    </button>
                </div>

                {/* 通知設定 */}
                <div className="card" style={{ marginBottom: 'var(--space-lg)' }}>
                    <h3 style={{ marginBottom: 'var(--space-md)' }}>通知設定</h3>

                    {notifLoading ? (
                        <div className="skeleton" style={{ height: 160 }} />
                    ) : (
                        <>
                            {notifItems.map(item => (
                                <div
                                    key={item.key}
                                    style={{
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        alignItems: 'center',
                                        padding: 'var(--space-md) 0',
                                        borderBottom: '1px solid var(--color-border, #e5e7eb)',
                                    }}
                                >
                                    <div style={{ marginRight: 'var(--space-md)' }}>
                                        <div style={{ fontWeight: 500, marginBottom: 2 }}>{item.label}</div>
                                        <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
                                            {item.desc}
                                        </div>
                                    </div>
                                    <button
                                        style={toggleStyle(notifications[item.key])}
                                        onClick={() => setNotifications({ ...notifications, [item.key]: !notifications[item.key] })}
                                        aria-label={item.label}
                                        role="switch"
                                        aria-checked={notifications[item.key]}
                                    >
                                        <span style={toggleKnobStyle(notifications[item.key])} />
                                    </button>
                                </div>
                            ))}

                            <div style={{ marginTop: 'var(--space-lg)' }}>
                                <button
                                    className="btn btn-primary"
                                    onClick={handleNotifSave}
                                    disabled={notifSaving}
                                >
                                    {notifSaving ? '保存中...' : '通知設定を保存'}
                                </button>
                            </div>
                        </>
                    )}
                </div>
                {/* 個人データ（求職者のみ） */}
                {user?.role === 'jobseeker' && (
                    <div className="card" style={{ marginBottom: 'var(--space-lg)' }}>
                        <h3 style={{ marginBottom: 'var(--space-md)' }}>個人データ</h3>
                        <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', marginBottom: 'var(--space-md)' }}>
                            あなたのアカウントに保存されている個人情報をJSON形式でダウンロードできます。
                        </p>
                        <button
                            className="btn btn-secondary"
                            onClick={async () => {
                                try {
                                    const res = await api.get('/settings/export-data', { responseType: 'blob' });
                                    const url = window.URL.createObjectURL(new Blob([res.data]));
                                    const a = document.createElement('a');
                                    a.href = url;
                                    a.download = 'my_data_export.json';
                                    a.click();
                                    window.URL.revokeObjectURL(url);
                                    toast.success('データをエクスポートしました');
                                } catch {
                                    toast.error('エクスポートに失敗しました');
                                }
                            }}
                        >
                            個人データをダウンロード
                        </button>
                    </div>
                )}

                {/* アカウント退会 */}
                {user?.role !== 'admin' && (
                    <div className="card" style={{ marginBottom: 'var(--space-lg)', border: '1px solid rgba(239,68,68,0.3)' }}>
                        <h3 style={{ marginBottom: 'var(--space-sm)', color: '#dc2626' }}>退会</h3>
                        <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', marginBottom: 'var(--space-md)', lineHeight: 1.7 }}>
                            退会するとログインできなくなります。アカウントデータは運営側に保持され、公開情報（求人・プロフィール等）は非公開になります。
                            再登録は可能ですが、以前のデータは引き継がれません。
                        </p>
                        <button
                            className="btn"
                            style={{ color: '#dc2626', border: '1px solid #dc2626', background: 'transparent' }}
                            onClick={async () => {
                                if (!confirm('退会しますか？\n\nこの操作によりログインできなくなります。')) return;
                                try {
                                    await api.post('/settings/deactivate');
                                    await logout();
                                    navigate('/');
                                    toast.info('退会処理が完了しました');
                                } catch {
                                    toast.error('退会処理に失敗しました');
                                }
                            }}
                        >
                            退会する
                        </button>
                    </div>
                )}
            </div>

        </div>
    );
}
