import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js';
import api from '../api';
import { useToast } from '../hooks/useToast';
import { useUnsavedChanges } from '../hooks/useUnsavedChanges';
import { useAuth } from '../hooks/useAuth';
import AgencyDashboardPage from './AgencyDashboardPage';

const stripePromise = window.__STRIPE_KEY__ ? loadStripe(window.__STRIPE_KEY__) : null;

/* ────────────────────────────────────────────
   カード登録フォーム（Stripe Elements）
   ──────────────────────────────────────────── */
function CardRegistrationForm({ onCardRegistered }) {
    const stripe = useStripe();
    const elements = useElements();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!stripe || !elements) return;
        setLoading(true);
        setError('');

        try {
            // 1. SetupIntent を取得
            const { data } = await api.post('/payment/setup-intent');
            const clientSecret = data.client_secret;

            // 2. カード情報を確認
            const { error: stripeError, setupIntent } = await stripe.confirmCardSetup(clientSecret, {
                payment_method: { card: elements.getElement(CardElement) },
            });

            if (stripeError) {
                setError(stripeError.message);
                return;
            }

            // 3. バックエンドにデフォルト支払い方法として登録
            await api.post('/payment/confirm-card', {
                payment_method_id: setupIntent.payment_method,
            });

            onCardRegistered();
        } catch (err) {
            setError(err.response?.data?.message || 'カード登録に失敗しました');
        } finally {
            setLoading(false);
        }
    };

    return (
        <form onSubmit={handleSubmit}>
            <div style={{
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-md)',
                padding: 'var(--space-md)',
                marginBottom: 'var(--space-md)',
                background: '#fff',
            }}>
                <CardElement options={{
                    style: {
                        base: { fontSize: '16px', color: '#333', '::placeholder': { color: '#aab7c4' } },
                        invalid: { color: '#e74c3c' },
                    },
                    hidePostalCode: true,
                }} />
            </div>
            {error && <p style={{ color: 'var(--color-error)', fontSize: 'var(--font-size-sm)', marginBottom: 'var(--space-sm)' }}>{error}</p>}
            <button type="submit" className="btn btn-primary" disabled={!stripe || loading}>
                {loading ? '登録中...' : 'カードを登録する'}
            </button>
        </form>
    );
}

/* ────────────────────────────────────────────
   カード情報セクション
   ──────────────────────────────────────────── */
function CardSection() {
    const toast = useToast();
    const [card, setCard] = useState(null);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [deleting, setDeleting] = useState(false);

    const fetchCard = async () => {
        setLoading(true);
        try {
            const { data } = await api.get('/payment/method');
            setCard(data.card);
        } catch {
            setCard(null);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchCard(); }, []);

    const handleDelete = async (skipConfirm = false) => {
        if (!skipConfirm && !confirm('登録済みカードを削除しますか？')) return false;
        setDeleting(true);
        try {
            await api.delete('/payment/method');
            setCard(null);
            return true;
        } catch (err) {
            toast.error('カード削除に失敗しました');
            return false;
        } finally {
            setDeleting(false);
        }
    };

    const handleCardRegistered = () => {
        setShowForm(false);
        fetchCard();
    };

    if (loading) return <div className="skeleton" style={{ height: 60 }} />;

    return (
        <div>
            {card ? (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 'var(--space-md)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-md)' }}>
                        <span style={{ fontSize: '1.5rem' }}>💳</span>
                        <div>
                            <p style={{ fontWeight: 600 }}>{card.brand.toUpperCase()} **** {card.last4}</p>
                            <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
                                有効期限: {card.exp_month}/{card.exp_year}
                            </p>
                        </div>
                    </div>
                    <div style={{ display: 'flex', gap: 'var(--space-sm)' }}>
                        <button className="btn btn-secondary" style={{ fontSize: 'var(--font-size-xs)' }}
                            onClick={async () => { const ok = await handleDelete(true); if (ok) setShowForm(true); }}>
                            カード変更
                        </button>
                        <button className="btn btn-secondary" style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-error)' }}
                            onClick={handleDelete} disabled={deleting}>
                            {deleting ? '削除中...' : '削除'}
                        </button>
                    </div>
                </div>
            ) : (
                <>
                    {!showForm ? (
                        <div style={{ textAlign: 'center', padding: 'var(--space-lg)' }}>
                            <p style={{ color: 'var(--color-text-secondary)', marginBottom: 'var(--space-md)' }}>
                                クレジットカードが登録されていません。求人を掲載するにはカード登録が必要です。
                            </p>
                            <button className="btn btn-primary" onClick={() => setShowForm(true)}>
                                カードを登録する
                            </button>
                        </div>
                    ) : (
                        stripePromise ? (
                            <Elements stripe={stripePromise}>
                                <CardRegistrationForm onCardRegistered={handleCardRegistered} />
                            </Elements>
                        ) : (
                            <div style={{
                                padding: 'var(--space-md)',
                                background: 'rgba(245,158,11,0.06)',
                                border: '1px solid rgba(245,158,11,0.15)',
                                borderRadius: 'var(--radius-md)',
                                fontSize: 'var(--font-size-sm)',
                                color: 'var(--color-text-secondary)',
                                lineHeight: 1.8,
                            }}>
                                <strong style={{ color: '#d97706' }}>Stripe APIキー未設定</strong><br />
                                カード決済を有効にするには、サーバーの <code>.env</code> に以下を設定してください：<br />
                                <code style={{ background: 'rgba(0,0,0,0.05)', padding: '2px 6px', borderRadius: 4 }}>STRIPE_KEY=pk_test_...</code><br />
                                <code style={{ background: 'rgba(0,0,0,0.05)', padding: '2px 6px', borderRadius: 4 }}>STRIPE_SECRET=sk_test_...</code>
                            </div>
                        )
                    )}
                </>
            )}
        </div>
    );
}

/* ────────────────────────────────────────────
   利用履歴セクション
   ──────────────────────────────────────────── */
function BillingHistorySection() {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [expanded, setExpanded] = useState(false);

    useEffect(() => {
        api.get('/company/billing-history')
            .then(res => setData(res.data))
            .catch(() => setData(null))
            .finally(() => setLoading(false));
    }, []);

    if (loading) return <div className="card" style={{ marginBottom: 'var(--space-lg)' }}><div className="skeleton" style={{ height: 80 }} /></div>;
    if (!data) return null;

    const { daily_usages, summary } = data;

    return (
        <div className="card" style={{ marginBottom: 'var(--space-lg)' }}>
            <div
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}
                onClick={() => setExpanded(!expanded)}
            >
                <h3 style={{ margin: 0 }}>利用履歴</h3>
                <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)' }}>
                    {expanded ? '▲ 閉じる' : '▼ 詳細を表示'}
                </span>
            </div>

            {/* 月別サマリー（常に表示） */}
            <div className="grid grid-3" style={{ marginTop: 'var(--space-md)', gap: 'var(--space-md)' }}>
                <div style={{
                    padding: 'var(--space-md)',
                    background: 'rgba(200,149,46,0.05)',
                    borderRadius: 'var(--radius-md)',
                    textAlign: 'center',
                }}>
                    <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--font-size-xs)', marginBottom: 'var(--space-xs)' }}>今月の利用額</p>
                    <p style={{ fontSize: 'var(--font-size-xl)', fontWeight: 700 }}>
                        ¥{Number(summary.this_month_total).toLocaleString()}
                    </p>
                </div>
                <div style={{
                    padding: 'var(--space-md)',
                    background: 'rgba(107,114,128,0.05)',
                    borderRadius: 'var(--radius-md)',
                    textAlign: 'center',
                }}>
                    <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--font-size-xs)', marginBottom: 'var(--space-xs)' }}>先月の利用額</p>
                    <p style={{ fontSize: 'var(--font-size-xl)', fontWeight: 700 }}>
                        ¥{Number(summary.last_month_total).toLocaleString()}
                    </p>
                </div>
                <div style={{
                    padding: 'var(--space-md)',
                    background: 'rgba(16,185,129,0.05)',
                    borderRadius: 'var(--radius-md)',
                    textAlign: 'center',
                }}>
                    <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--font-size-xs)', marginBottom: 'var(--space-xs)' }}>アクティブ求人数</p>
                    <p style={{ fontSize: 'var(--font-size-xl)', fontWeight: 700 }}>
                        {summary.active_job_count}件
                    </p>
                </div>
            </div>

            {/* 日別テーブル（展開時のみ表示） */}
            {expanded && (
                <div style={{ marginTop: 'var(--space-lg)' }}>
                    {daily_usages.length === 0 ? (
                        <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--font-size-sm)', textAlign: 'center', padding: 'var(--space-lg)' }}>
                            利用履歴がありません。
                        </p>
                    ) : (
                        <table style={{ width: '100%', fontSize: 'var(--font-size-sm)', borderCollapse: 'collapse' }}>
                            <thead>
                                <tr style={{ borderBottom: '2px solid var(--color-border)', textAlign: 'left' }}>
                                    <th style={{ padding: 'var(--space-xs) var(--space-sm)', color: 'var(--color-text-muted)', fontWeight: 600 }}>日付</th>
                                    <th style={{ padding: 'var(--space-xs) var(--space-sm)', color: 'var(--color-text-muted)', fontWeight: 600, textAlign: 'right' }}>基本予算</th>
                                    <th style={{ padding: 'var(--space-xs) var(--space-sm)', color: 'var(--color-text-muted)', fontWeight: 600, textAlign: 'center' }}>ブースト</th>
                                    <th style={{ padding: 'var(--space-xs) var(--space-sm)', color: 'var(--color-text-muted)', fontWeight: 600, textAlign: 'right' }}>利用額</th>
                                    <th style={{ padding: 'var(--space-xs) var(--space-sm)', color: 'var(--color-text-muted)', fontWeight: 600, textAlign: 'center' }}>請求済</th>
                                </tr>
                            </thead>
                            <tbody>
                                {daily_usages.map(row => (
                                    <tr key={row.date} style={{ borderBottom: '1px solid var(--color-border)' }}>
                                        <td style={{ padding: 'var(--space-xs) var(--space-sm)' }}>{row.date}</td>
                                        <td style={{ padding: 'var(--space-xs) var(--space-sm)', textAlign: 'right' }}>
                                            ¥{Number(row.base_budget).toLocaleString()}
                                        </td>
                                        <td style={{ padding: 'var(--space-xs) var(--space-sm)', textAlign: 'center' }}>
                                            <span className={Number(row.boost_factor) > 1.0 ? 'badge badge-warning' : 'badge badge-info'} style={{ fontSize: 10 }}>
                                                {row.boost_factor}x
                                            </span>
                                        </td>
                                        <td style={{ padding: 'var(--space-xs) var(--space-sm)', textAlign: 'right', fontWeight: 600 }}>
                                            ¥{Number(row.budget_amount).toLocaleString()}
                                        </td>
                                        <td style={{ padding: 'var(--space-xs) var(--space-sm)', textAlign: 'center' }}>
                                            <span className={row.billed ? 'badge badge-success' : 'badge badge-warning'} style={{ fontSize: 10 }}>
                                                {row.billed ? '済' : '未'}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            )}
        </div>
    );
}

/* ────────────────────────────────────────────
   チーム管理セクション
   ──────────────────────────────────────────── */
function TeamSection() {
    const toast = useToast();
    const [members, setMembers] = useState([]);
    const [invitations, setInvitations] = useState([]);
    const [loading, setLoading] = useState(true);
    const [expanded, setExpanded] = useState(false);
    const [inviteEmail, setInviteEmail] = useState('');
    const [inviteRole, setInviteRole] = useState('member');
    const [inviting, setInviting] = useState(false);
    const [inviteResult, setInviteResult] = useState(null);
    const [error, setError] = useState('');

    const currentUser = JSON.parse(localStorage.getItem('user') || '{}');

    const fetchTeam = async () => {
        setLoading(true);
        try {
            const { data } = await api.get('/company/team');
            setMembers(data.members);
            setInvitations(data.invitations || []);
        } catch {
            setMembers([]);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchTeam(); }, []);

    const handleInvite = async (e) => {
        e.preventDefault();
        setInviting(true);
        setError('');
        setInviteResult(null);
        try {
            const { data } = await api.post('/company/team/invite', {
                email: inviteEmail,
                role: inviteRole,
            });
            setInviteResult(data);
            setInviteEmail('');
            setInviteRole('member');
            fetchTeam();
        } catch (err) {
            setError(err.response?.data?.message || '招待に失敗しました');
        } finally {
            setInviting(false);
        }
    };

    const handleRoleChange = async (userId, newRole) => {
        try {
            await api.put(`/company/team/${userId}`, { role: newRole });
            fetchTeam();
        } catch (err) {
            toast.error(err.response?.data?.message || 'ロール変更に失敗しました');
        }
    };

    const handleRemove = async (userId, name) => {
        if (!confirm(`${name} をチームから削除しますか？`)) return;
        try {
            await api.delete(`/company/team/${userId}`);
            fetchTeam();
        } catch (err) {
            toast.error(err.response?.data?.message || 'メンバー削除に失敗しました');
        }
    };

    const handleCancelInvitation = async (invitationId) => {
        if (!confirm('この招待をキャンセルしますか？')) return;
        try {
            await api.delete(`/company/team/invitations/${invitationId}`);
            fetchTeam();
        } catch (err) {
            toast.error(err.response?.data?.message || '招待キャンセルに失敗しました');
        }
    };

    const roleBadge = {
        owner: { class: 'badge-primary', text: 'オーナー' },
        admin: { class: 'badge-warning', text: '管理者' },
        member: { class: 'badge-info', text: 'メンバー' },
    };

    const isOwner = currentUser?.company_role === 'owner';
    const isAdmin = ['owner', 'admin'].includes(currentUser?.company_role);

    if (loading) return <div className="card" style={{ marginBottom: 'var(--space-lg)' }}><div className="skeleton" style={{ height: 80 }} /></div>;

    return (
        <div className="card" style={{ marginBottom: 'var(--space-lg)' }}>
            <div
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}
                onClick={() => setExpanded(!expanded)}
            >
                <h3 style={{ margin: 0 }}>チーム管理</h3>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)' }}>
                    <span className="badge badge-info" style={{ fontSize: 10 }}>{members.length}名</span>
                    <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)' }}>
                        {expanded ? '▲ 閉じる' : '▼ 詳細を表示'}
                    </span>
                </div>
            </div>

            {expanded && (
                <div style={{ marginTop: 'var(--space-lg)' }}>
                    {/* メンバー一覧 */}
                    <table style={{ width: '100%', fontSize: 'var(--font-size-sm)', borderCollapse: 'collapse', marginBottom: 'var(--space-lg)' }}>
                        <thead>
                            <tr style={{ borderBottom: '2px solid var(--color-border)', textAlign: 'left' }}>
                                <th style={{ padding: 'var(--space-xs) var(--space-sm)', color: 'var(--color-text-muted)', fontWeight: 600 }}>名前</th>
                                <th style={{ padding: 'var(--space-xs) var(--space-sm)', color: 'var(--color-text-muted)', fontWeight: 600 }}>メールアドレス</th>
                                <th style={{ padding: 'var(--space-xs) var(--space-sm)', color: 'var(--color-text-muted)', fontWeight: 600, textAlign: 'center' }}>ロール</th>
                                {isAdmin && (
                                    <th style={{ padding: 'var(--space-xs) var(--space-sm)', color: 'var(--color-text-muted)', fontWeight: 600, textAlign: 'center' }}>操作</th>
                                )}
                            </tr>
                        </thead>
                        <tbody>
                            {members.map(member => (
                                <tr key={member.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                                    <td style={{ padding: 'var(--space-xs) var(--space-sm)', fontWeight: member.id === currentUser?.id ? 600 : 400 }}>
                                        {member.name}
                                        {member.id === currentUser?.id && (
                                            <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', marginLeft: 'var(--space-xs)' }}>（自分）</span>
                                        )}
                                    </td>
                                    <td style={{ padding: 'var(--space-xs) var(--space-sm)', color: 'var(--color-text-secondary)' }}>
                                        {member.email}
                                    </td>
                                    <td style={{ padding: 'var(--space-xs) var(--space-sm)', textAlign: 'center' }}>
                                        {isOwner && member.company_role !== 'owner' && member.id !== currentUser?.id ? (
                                            <select
                                                value={member.company_role}
                                                onChange={(e) => handleRoleChange(member.id, e.target.value)}
                                                style={{
                                                    padding: '2px 8px',
                                                    fontSize: 'var(--font-size-xs)',
                                                    borderRadius: 'var(--radius-sm)',
                                                    border: '1px solid var(--color-border)',
                                                    background: '#fff',
                                                    cursor: 'pointer',
                                                }}
                                            >
                                                <option value="admin">管理者</option>
                                                <option value="member">メンバー</option>
                                            </select>
                                        ) : (
                                            <span className={`badge ${roleBadge[member.company_role]?.class || 'badge-info'}`} style={{ fontSize: 10 }}>
                                                {roleBadge[member.company_role]?.text || member.company_role}
                                            </span>
                                        )}
                                    </td>
                                    {isAdmin && (
                                        <td style={{ padding: 'var(--space-xs) var(--space-sm)', textAlign: 'center' }}>
                                            {member.company_role !== 'owner' && member.id !== currentUser?.id && (
                                                (isOwner || member.company_role !== 'admin') && (
                                                    <button
                                                        className="btn btn-secondary"
                                                        style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-error)', padding: '2px 8px' }}
                                                        onClick={() => handleRemove(member.id, member.name)}
                                                    >
                                                        削除
                                                    </button>
                                                )
                                            )}
                                        </td>
                                    )}
                                </tr>
                            ))}
                        </tbody>
                    </table>

                    {/* 保留中の招待 */}
                    {invitations.length > 0 && (
                        <div style={{ marginBottom: 'var(--space-lg)' }}>
                            <h4 style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)', marginBottom: 'var(--space-sm)' }}>保留中の招待</h4>
                            {invitations.map(inv => (
                                <div key={inv.id} style={{
                                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                    padding: 'var(--space-xs) var(--space-sm)',
                                    borderBottom: '1px solid var(--color-border)',
                                    fontSize: 'var(--font-size-sm)',
                                }}>
                                    <div>
                                        <span>{inv.email}</span>
                                        <span className={`badge ${roleBadge[inv.role]?.class || 'badge-info'}`} style={{ fontSize: 10, marginLeft: 'var(--space-sm)' }}>
                                            {roleBadge[inv.role]?.text || inv.role}
                                        </span>
                                    </div>
                                    {isAdmin && (
                                        <button
                                            className="btn btn-secondary"
                                            style={{ fontSize: 'var(--font-size-xs)', padding: '2px 8px' }}
                                            onClick={() => handleCancelInvitation(inv.id)}
                                        >
                                            キャンセル
                                        </button>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}

                    {/* 招待フォーム */}
                    {isAdmin && (
                        <div style={{
                            padding: 'var(--space-md)',
                            background: 'rgba(200,149,46,0.03)',
                            borderRadius: 'var(--radius-md)',
                            border: '1px solid rgba(200,149,46,0.1)',
                        }}>
                            <h4 style={{ fontSize: 'var(--font-size-sm)', marginBottom: 'var(--space-sm)' }}>メンバーを招待</h4>
                            <form onSubmit={handleInvite} style={{ display: 'flex', gap: 'var(--space-sm)', alignItems: 'flex-end', flexWrap: 'wrap' }}>
                                <div style={{ flex: 1, minWidth: 200 }}>
                                    <label style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', display: 'block', marginBottom: 2 }}>メールアドレス</label>
                                    <input
                                        className="form-input"
                                        type="email"
                                        required
                                        value={inviteEmail}
                                        onChange={(e) => setInviteEmail(e.target.value)}
                                        placeholder="example@company.com"
                                        style={{ fontSize: 'var(--font-size-sm)' }}
                                    />
                                </div>
                                <div style={{ minWidth: 120 }}>
                                    <label style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', display: 'block', marginBottom: 2 }}>ロール</label>
                                    <select
                                        className="form-select"
                                        value={inviteRole}
                                        onChange={(e) => setInviteRole(e.target.value)}
                                        style={{ fontSize: 'var(--font-size-sm)' }}
                                    >
                                        <option value="admin">管理者</option>
                                        <option value="member">メンバー</option>
                                    </select>
                                </div>
                                <button type="submit" className="btn btn-primary" disabled={inviting} style={{ fontSize: 'var(--font-size-sm)' }}>
                                    {inviting ? '送信中...' : '招待する'}
                                </button>
                            </form>
                            {error && (
                                <p style={{ color: 'var(--color-error)', fontSize: 'var(--font-size-xs)', marginTop: 'var(--space-sm)' }}>{error}</p>
                            )}
                            {inviteResult && (
                                <div style={{ marginTop: 'var(--space-sm)', fontSize: 'var(--font-size-xs)', color: 'var(--color-success)' }}>
                                    <p>{inviteResult.message}</p>
                                    {inviteResult.temporary_password && (
                                        <p style={{ color: 'var(--color-text-secondary)', marginTop: 'var(--space-xs)' }}>
                                            仮パスワード: <code style={{ background: 'rgba(0,0,0,0.05)', padding: '2px 6px', borderRadius: 4, userSelect: 'all' }}>{inviteResult.temporary_password}</code>
                                            <br />
                                            <span style={{ color: 'var(--color-text-muted)' }}>※ このパスワードを招待するメンバーにお伝えください</span>
                                        </p>
                                    )}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

/* ────────────────────────────────────────────
   概要統計セクション
   ──────────────────────────────────────────── */
function OverviewStatsSection() {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        api.get('/my-jobs/analytics')
            .then(res => setData(res.data))
            .catch(() => setData(null))
            .finally(() => setLoading(false));
    }, []);

    if (loading) return <div className="skeleton" style={{ height: 100, marginBottom: 'var(--space-lg)' }} />;

    const jobs = data?.jobs || (Array.isArray(data) ? data : []);
    const funnel = data?.funnel || [];
    if (jobs.length === 0) return null;

    const totalViews = jobs.reduce((s, j) => s + (j.view_count || 0), 0);
    const views7d = jobs.reduce((s, j) => s + (j.view_count_7d || 0), 0);
    const totalApps = jobs.reduce((s, j) => s + (j.application_count || 0), 0);
    const avgRate = jobs.length > 0
        ? (jobs.reduce((s, j) => s + (j.application_rate || 0), 0) / jobs.length).toFixed(1)
        : '0.0';

    const maxFunnel = funnel.length > 0 ? Math.max(...funnel.map(s => s.count), 1) : 1;

    return (
        <div style={{ marginBottom: 'var(--space-xl)' }}>
            <h3 style={{ marginBottom: 'var(--space-md)', fontSize: 'var(--font-size-lg)' }}>パフォーマンス概要</h3>
            <div className="grid grid-4" style={{ marginBottom: 'var(--space-lg)' }}>
                {[
                    { label: '総閲覧数', value: totalViews.toLocaleString(), color: '#121c34' },
                    { label: '7日間閲覧数', value: views7d.toLocaleString(), color: '#3b82f6' },
                    { label: '総応募数', value: totalApps.toLocaleString(), color: '#10b981' },
                    { label: '平均応募率', value: `${avgRate}%`, color: '#f59e0b' },
                ].map(c => (
                    <div key={c.label} className="card" style={{ textAlign: 'center', borderTop: `3px solid ${c.color}` }}>
                        <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--font-size-xs)', marginBottom: 'var(--space-xs)' }}>{c.label}</p>
                        <p style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 700, color: c.color, margin: 0 }}>{c.value}</p>
                    </div>
                ))}
            </div>

            {funnel.length > 0 && (
                <div className="card" style={{ padding: 'var(--space-lg)' }}>
                    <h4 style={{ marginBottom: 'var(--space-md)', fontSize: 'var(--font-size-md)' }}>採用ファネル</h4>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
                        {funnel.map((stage, i) => {
                            const pct = (stage.count / maxFunnel) * 100;
                            const prevCount = i > 0 ? funnel[i - 1].count : null;
                            const convRate = prevCount && prevCount > 0
                                ? ((stage.count / prevCount) * 100).toFixed(1)
                                : null;
                            return (
                                <div key={stage.stage} style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-md)' }}>
                                    <span style={{ width: 80, flexShrink: 0, fontSize: 'var(--font-size-sm)', fontWeight: 600, textAlign: 'right', color: 'var(--color-text-secondary)' }}>
                                        {stage.stage}
                                    </span>
                                    <div style={{ flex: 1, background: 'var(--color-bg-surface)', borderRadius: 'var(--radius-sm)', height: 24, overflow: 'hidden' }}>
                                        <div style={{
                                            width: `${Math.max(pct, 2)}%`, height: '100%',
                                            background: stage.color, borderRadius: 'var(--radius-sm)',
                                            transition: 'width 0.5s ease', opacity: 0.85,
                                        }} />
                                    </div>
                                    <span style={{ width: 60, flexShrink: 0, fontWeight: 700, fontSize: 'var(--font-size-sm)', fontVariantNumeric: 'tabular-nums' }}>
                                        {stage.count.toLocaleString()}
                                    </span>
                                    <span style={{ width: 50, flexShrink: 0, fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
                                        {convRate ? `${convRate}%` : ''}
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
}

/* ────────────────────────────────────────────
   メインダッシュボード
   ──────────────────────────────────────────── */
export default function CompanyDashboard() {
    const { user, updateUser } = useAuth();
    const [resolvedType, setResolvedType] = useState(user?.company?.company_type ?? null);

    useEffect(() => {
        // user.company が未ロード（登録直後など）の場合はAPIから会社情報を取得してルーティングを確定する
        if (!user?.company) {
            api.get('/company').then(res => {
                const company = res.data?.company;
                if (company) {
                    updateUser({ ...user, company, company_id: company.id });
                    setResolvedType(company.company_type);
                }
            }).catch(() => {});
        }
    }, []);

    if (resolvedType === 'recruitment_agency') {
        return <AgencyDashboardPage />;
    }

    return <DirectEmployerDashboard />;
}

function DirectEmployerDashboard() {
    const { user, updateUser } = useAuth();
    const [company, setCompany] = useState(null);
    const [loading, setLoading] = useState(true);
    const [rankingScore, setRankingScore] = useState(0);
    const [effectiveBudget, setEffectiveBudget] = useState(0);
    const [avgBoost, setAvgBoost] = useState(1.0);
    const [boostBreakdown, setBoostBreakdown] = useState([]);
    const [showRegister, setShowRegister] = useState(false);
    const [registerForm, setRegisterForm] = useState({
        company_name: '', representative_name: '', company_type: 'direct_employer', description: '',
        website: '', phone: '', address: '', permit_number: '',
    });
    const [licenseFile, setLicenseFile] = useState(null);
    const [saving, setSaving] = useState(false);
    const toast = useToast();
    const navigate = useNavigate();

    const initialRegForm = showRegister ? {
        company_name: '', representative_name: '', company_type: 'direct_employer', description: '',
        website: '', phone: '', address: '', permit_number: '',
    } : null;
    const { isDirty, confirmNavigation } = useUnsavedChanges(initialRegForm, registerForm);

    useEffect(() => {
        api.get('/company').then(res => {
            setCompany(res.data.company);
            setRankingScore(res.data.ranking_score);
            setEffectiveBudget(res.data.effective_daily_budget ?? 0);
            setAvgBoost(res.data.average_boost_factor ?? 1.0);
            setBoostBreakdown(res.data.boost_breakdown ?? []);
        }).catch(() => {}).finally(() => setLoading(false));
    }, []);

    const handleRegister = async (e) => {
        e.preventDefault();
        setSaving(true);
        try {
            const formData = new FormData();
            Object.entries(registerForm).forEach(([key, val]) => {
                if (val !== '' && val != null) formData.append(key, val);
            });
            if (licenseFile) formData.append('license_document', licenseFile);

            const res = await api.post('/company', formData);
            const newCompany = res.data.company;
            setCompany(newCompany);
            setRankingScore(0);
            setShowRegister(false);
            // userオブジェクトを更新してCompanyDashboardが正しくルーティングするようにする
            updateUser({ ...user, company: newCompany, company_id: newCompany.id });
        } catch (err) {
            const errors = err.response?.data?.errors;
            const msg = errors
                ? Object.values(errors).flat().join(' / ')
                : err.response?.data?.message || '登録に失敗しました';
            toast.error(msg);
        } finally {
            setSaving(false);
        }
    };

    if (loading) return <div className="page container"><div className="skeleton" style={{ height: 400 }} /></div>;

    if (!company) {
        return (
            <div className="page container animate-fade-in">
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-md)', marginBottom: 'var(--space-xl)' }}>
                    <h1 style={{ fontSize: 'var(--font-size-3xl)' }}>企業情報登録</h1>
                </div>

                {!showRegister ? (
                    <div className="card" style={{ textAlign: 'center', padding: 'var(--space-3xl)' }}>
                        <div style={{ fontSize: '3rem', marginBottom: 'var(--space-md)' }}>🏢</div>
                        <h2 style={{ marginBottom: 'var(--space-md)' }}>企業情報を登録してください</h2>
                        <p style={{ color: 'var(--color-text-secondary)', marginBottom: 'var(--space-xl)' }}>
                            求人の公開やスカウト機能を利用するには、企業情報の登録が必要です。
                        </p>
                        <button className="btn btn-primary btn-lg" onClick={() => setShowRegister(true)}>企業情報を登録する</button>
                    </div>
                ) : (
                    <form onSubmit={handleRegister} style={{ maxWidth: 600 }}>
                        <div className="card" style={{ marginBottom: 'var(--space-lg)' }}>
                            <h3 style={{ marginBottom: 'var(--space-md)' }}>企業基本情報</h3>
                            <div className="form-group">
                                <label className="form-label">企業名 *</label>
                                <input className="form-input" required value={registerForm.company_name}
                                    onChange={e => setRegisterForm({...registerForm, company_name: e.target.value})}
                                    placeholder="例: 株式会社〇〇" />
                            </div>
                            <div className="form-group">
                                <label className="form-label">代表者名 *</label>
                                <input className="form-input" required value={registerForm.representative_name}
                                    onChange={e => setRegisterForm({...registerForm, representative_name: e.target.value})}
                                    placeholder="例: 山田 太郎" />
                            </div>
                            <div className="form-group">
                                <label className="form-label">企業種別 *</label>
                                <select className="form-select" value={registerForm.company_type}
                                    onChange={e => setRegisterForm({...registerForm, company_type: e.target.value})}>
                                    <option value="direct_employer">一般企業（自社採用）</option>
                                    <option value="recruitment_agency">人材紹介・派遣会社</option>
                                </select>
                            </div>
                            {registerForm.company_type === 'recruitment_agency' && (
                                <>
                                    <div className="form-group">
                                        <label className="form-label">職業紹介事業許可番号 *</label>
                                        <input className="form-input" required value={registerForm.permit_number}
                                            onChange={e => setRegisterForm({...registerForm, permit_number: e.target.value})}
                                            placeholder="例: 13-ユ-123456" />
                                        <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', marginTop: 4 }}>
                                            厚生労働大臣から発行された許可番号を入力してください
                                        </p>
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">職業紹介事業許可証（画像・PDF） *</label>
                                        <input
                                            className="form-input"
                                            type="file"
                                            required
                                            accept=".pdf,.jpg,.jpeg,.png"
                                            onChange={e => setLicenseFile(e.target.files[0] || null)}
                                            style={{ padding: 'var(--space-sm)' }}
                                        />
                                        <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', marginTop: 4 }}>
                                            PDF, JPG, PNG形式 / 最大10MB。許可番号と照合して審査します。
                                        </p>
                                    </div>
                                </>
                            )}
                            <div className="form-group">
                                <label className="form-label">企業概要</label>
                                <textarea className="form-textarea" value={registerForm.description} rows={3}
                                    onChange={e => setRegisterForm({...registerForm, description: e.target.value})}
                                    placeholder="企業の事業内容をお書きください" />
                            </div>
                            <div className="grid grid-2">
                                <div className="form-group">
                                    <label className="form-label">ウェブサイト</label>
                                    <input className="form-input" value={registerForm.website}
                                        onChange={e => setRegisterForm({...registerForm, website: e.target.value})}
                                        placeholder="https://example.com" />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">電話番号</label>
                                    <input className="form-input" value={registerForm.phone}
                                        onChange={e => setRegisterForm({...registerForm, phone: e.target.value})}
                                        placeholder="03-1234-5678" />
                                </div>
                            </div>
                            <div className="form-group">
                                <label className="form-label">住所</label>
                                <input className="form-input" value={registerForm.address}
                                    onChange={e => setRegisterForm({...registerForm, address: e.target.value})}
                                    placeholder="東京都渋谷区..." />
                            </div>
                        </div>
                        <div style={{ display: 'flex', gap: 'var(--space-md)' }}>
                            <button type="button" className="btn btn-secondary" onClick={() => setShowRegister(false)}>キャンセル</button>
                            <button type="submit" className="btn btn-primary" disabled={saving}>
                                {saving ? '登録中...' : '🏢 企業情報を登録'}
                            </button>
                        </div>
                    </form>
                )}
            </div>
        );
    }

    const statusBadge = {
        active: { class: 'badge-success', text: 'アクティブ' },
        needs_attention: { class: 'badge-warning', text: '要確認（未払い）' },
        suspended: { class: 'badge-error', text: '利用停止' },
    };
    const verificationBadge = {
        pending: { class: 'badge-warning', text: '審査中' },
        approved: { class: 'badge-success', text: '承認済み' },
        rejected: { class: 'badge-error', text: '却下' },
    };

    return (
        <div className="page container animate-fade-in">
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-md)', marginBottom: 'var(--space-xl)' }}>
                <h1 style={{ fontSize: 'var(--font-size-3xl)' }}>企業管理画面</h1>
            </div>

            {/* ステータスカード */}
            <div className="grid grid-4" style={{ marginBottom: 'var(--space-xl)' }}>
                <div className="card" style={{ textAlign: 'center' }}>
                    <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--font-size-xs)', marginBottom: 'var(--space-xs)' }}>ステータス</p>
                    <span className={`badge ${statusBadge[company.status]?.class}`}>{statusBadge[company.status]?.text}</span>
                </div>
                <div className="card" style={{ textAlign: 'center' }}>
                    <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--font-size-xs)', marginBottom: 'var(--space-xs)' }}>審査状況</p>
                    <span className={`badge ${verificationBadge[company.verification_status]?.class}`}>{verificationBadge[company.verification_status]?.text}</span>
                </div>
                <div className="card" style={{ textAlign: 'center' }}>
                    <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--font-size-xs)', marginBottom: 'var(--space-xs)' }}>日額予算（全求人合計）</p>
                    <div
                        onClick={() => navigate('/company/jobs')}
                        style={{ cursor: 'pointer' }}
                        title="求人管理で各求人の予算を設定"
                    >
                        <p style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 700 }}>¥{Number(effectiveBudget).toLocaleString()}</p>
                        {avgBoost > 1.0 && (
                            <p style={{ fontSize: 'var(--font-size-xs)', color: '#d97706', marginTop: 'var(--space-xs)' }}>
                                ブースト込み実効額
                            </p>
                        )}
                        <p style={{ fontSize: 10, color: 'var(--color-accent)', marginTop: 4 }}>求人管理で個別設定 →</p>
                    </div>
                </div>
                <div className="card" style={{ textAlign: 'center' }}>
                    <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--font-size-xs)', marginBottom: 'var(--space-xs)' }}>ランキングスコア</p>
                    <p style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 700, background: 'var(--gradient-accent)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                        {rankingScore.toFixed(1)}
                    </p>
                </div>
            </div>

            {/* オンボーディングチェックリスト */}
            {(company.verification_status === 'pending' || !boostBreakdown.length) ? (() => {
                const steps = [
                    { label: '企業情報を登録する', done: true, icon: '🏢' },
                    { label: '審査を通過する', done: company.verification_status === 'approved', icon: '✅' },
                    { label: 'クレジットカードを登録する', done: company.stripe_customer_id, icon: '💳' },
                    { label: '最初の求人を作成する', done: boostBreakdown.length > 0, icon: '📋', link: '/company/jobs' },
                    { label: '企業プロフィールを充実させる', done: company.description && company.industry && company.company_culture, icon: '✏️' },
                ];
                const doneCount = steps.filter(s => s.done).length;
                if (doneCount === steps.length) return null;
                return (
                    <div className="card" style={{ marginBottom: 'var(--space-lg)', borderLeft: '3px solid var(--color-accent)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-md)' }}>
                            <h3 style={{ margin: 0 }}>スタートガイド</h3>
                            <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>{doneCount}/{steps.length} 完了</span>
                        </div>
                        <div style={{
                            width: '100%', height: 6, background: 'var(--color-bg-surface)',
                            borderRadius: 3, marginBottom: 'var(--space-md)', overflow: 'hidden',
                        }}>
                            <div style={{ width: `${(doneCount / steps.length) * 100}%`, height: '100%', background: 'var(--color-accent)', borderRadius: 3, transition: 'width 0.3s' }} />
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-xs)' }}>
                            {steps.map((step, i) => (
                                <div key={i} style={{
                                    display: 'flex', alignItems: 'center', gap: 'var(--space-sm)',
                                    padding: 'var(--space-sm) var(--space-md)',
                                    background: step.done ? 'rgba(16,185,129,0.06)' : 'var(--color-bg-secondary)',
                                    borderRadius: 'var(--radius-md)', opacity: step.done ? 0.6 : 1,
                                    cursor: step.link ? 'pointer' : 'default',
                                }} onClick={() => step.link && navigate(step.link)}>
                                    <span style={{ fontSize: 18 }}>{step.done ? '✅' : step.icon}</span>
                                    <span style={{
                                        fontSize: 'var(--font-size-sm)', fontWeight: step.done ? 400 : 600,
                                        textDecoration: step.done ? 'line-through' : 'none',
                                    }}>{step.label}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                );
            })() : null}

            {/* パフォーマンス概要 */}
            <OverviewStatsSection />

            {/* 求人別予算内訳 */}
            {boostBreakdown.length > 0 && (
                <div className="card" style={{ marginBottom: 'var(--space-lg)' }}>
                    <h3 style={{ marginBottom: 'var(--space-md)' }}>求人別 日額予算内訳</h3>
                    <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--font-size-xs)', marginBottom: 'var(--space-md)' }}>
                        各求人の予算は求人管理ページで個別に設定できます
                    </p>
                    <table style={{ width: '100%', fontSize: 'var(--font-size-sm)', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr style={{ borderBottom: '2px solid var(--color-border)', textAlign: 'left' }}>
                                <th style={{ padding: 'var(--space-xs) var(--space-sm)', color: 'var(--color-text-muted)', fontWeight: 600 }}>求人</th>
                                <th style={{ padding: 'var(--space-xs) var(--space-sm)', color: 'var(--color-text-muted)', fontWeight: 600, textAlign: 'right' }}>日額予算</th>
                                <th style={{ padding: 'var(--space-xs) var(--space-sm)', color: 'var(--color-text-muted)', fontWeight: 600, textAlign: 'center' }}>ブースト</th>
                                <th style={{ padding: 'var(--space-xs) var(--space-sm)', color: 'var(--color-text-muted)', fontWeight: 600, textAlign: 'right' }}>実効コスト</th>
                            </tr>
                        </thead>
                        <tbody>
                            {boostBreakdown.map(item => (
                                <tr key={item.job_id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                                    <td style={{ padding: 'var(--space-xs) var(--space-sm)', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                        {item.title}
                                    </td>
                                    <td style={{ padding: 'var(--space-xs) var(--space-sm)', textAlign: 'right' }}>
                                        ¥{Number(item.daily_budget ?? 0).toLocaleString()}
                                    </td>
                                    <td style={{ padding: 'var(--space-xs) var(--space-sm)', textAlign: 'center' }}>
                                        <span className={item.boost_factor > 1.0 ? 'badge badge-warning' : 'badge badge-info'} style={{ fontSize: 10 }}>
                                            {item.boost_factor}x
                                        </span>
                                    </td>
                                    <td style={{ padding: 'var(--space-xs) var(--space-sm)', textAlign: 'right', fontWeight: 600, color: item.boost_factor > 1.0 ? '#d97706' : 'var(--color-text-primary)' }}>
                                        ¥{Number(item.daily_cost).toLocaleString()}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                        <tfoot>
                            <tr style={{ borderTop: '2px solid var(--color-border)' }}>
                                <td style={{ padding: 'var(--space-xs) var(--space-sm)', fontWeight: 700 }}>合計</td>
                                <td></td>
                                <td></td>
                                <td style={{ padding: 'var(--space-xs) var(--space-sm)', textAlign: 'right', fontWeight: 700 }}>
                                    ¥{Number(effectiveBudget).toLocaleString()}
                                </td>
                            </tr>
                        </tfoot>
                    </table>
                </div>
            )}

            {/* クレジットカード */}
            <div className="card" style={{ marginBottom: 'var(--space-lg)' }}>
                <h3 style={{ marginBottom: 'var(--space-md)' }}>💳 クレジットカード</h3>
                <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-sm)', marginBottom: 'var(--space-md)' }}>
                    求人を掲載（有料）するにはクレジットカードの登録が必要です。
                </p>
                <CardSection />
            </div>

            {/* 利用履歴 */}
            <BillingHistorySection />

            {/* チーム管理はMVP期間中は無効化中 */}
            {false && <TeamSection />}

            {/* 品質スコア */}
            <div className="card" style={{ marginBottom: 'var(--space-lg)' }}>
                <h3 style={{ marginBottom: 'var(--space-md)' }}>品質スコア詳細</h3>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-lg)', marginBottom: 'var(--space-lg)' }}>
                    <div style={{
                        width: 100, height: 100, borderRadius: '50%',
                        background: `conic-gradient(${Number(company.quality_score) >= 1.0 ? '#10b981' : '#ef4444'} ${Math.min(Number(company.quality_score), 1.5) / 1.5 * 360}deg, var(--color-bg-surface) 0deg)`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                    }}>
                        <div style={{
                            width: 76, height: 76, borderRadius: '50%', background: 'var(--color-bg-primary)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column',
                        }}>
                            <span style={{ fontSize: 'var(--font-size-xl)', fontWeight: 700 }}>{Number(company.quality_score).toFixed(2)}</span>
                            <span style={{ fontSize: 9, color: 'var(--color-text-muted)' }}>品質係数</span>
                        </div>
                    </div>
                    <div style={{ flex: 1 }}>
                        <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', marginBottom: 'var(--space-sm)' }}>
                            品質スコアは求人のランキング順位に影響します。<br />
                            <strong>ランキングスコア = 日額予算 × 品質係数 × ブースト倍率</strong>
                        </p>
                        <p style={{ fontSize: 'var(--font-size-xs)', color: Number(company.quality_score) >= 1.0 ? '#10b981' : '#ef4444' }}>
                            {Number(company.quality_score) >= 1.05 ? '優秀: 高い品質スコアで上位表示されやすくなっています' :
                             Number(company.quality_score) >= 1.0 ? '良好: 標準的な品質スコアです' :
                             '要改善: 品質スコアが低下しています。下記の改善ポイントをご確認ください'}
                        </p>
                    </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-md)' }}>
                    <div style={{ padding: 'var(--space-md)', borderRadius: 'var(--radius-md)', background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.15)' }}>
                        <h4 style={{ fontSize: 'var(--font-size-sm)', fontWeight: 600, color: '#10b981', marginBottom: 'var(--space-sm)' }}>📈 加点要因</h4>
                        <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', display: 'flex', flexDirection: 'column', gap: 4 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>24時間以内の返信</span><span style={{ fontWeight: 600, color: '#10b981' }}>×1.10</span></div>
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>プロフィール完全入力</span><span style={{ fontWeight: 600, color: '#10b981' }}>×1.05</span></div>
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>高い応募承諾率</span><span style={{ fontWeight: 600, color: '#10b981' }}>×1.03</span></div>
                        </div>
                    </div>
                    <div style={{ padding: 'var(--space-md)', borderRadius: 'var(--radius-md)', background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.15)' }}>
                        <h4 style={{ fontSize: 'var(--font-size-sm)', fontWeight: 600, color: '#ef4444', marginBottom: 'var(--space-sm)' }}>📉 減点要因</h4>
                        <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', display: 'flex', flexDirection: 'column', gap: 4 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>3日以上未読メッセージ</span><span style={{ fontWeight: 600, color: '#ef4444' }}>×0.80</span></div>
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>7日未対応応募</span><span style={{ fontWeight: 600, color: '#ef4444' }}>×0.90</span></div>
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>14日ログインなし</span><span style={{ fontWeight: 600, color: '#ef4444' }}>圏外</span></div>
                        </div>
                    </div>
                </div>
            </div>

            {/* 企業情報 */}
            <CompanyProfileCard company={company} onUpdate={setCompany} />
        </div>
    );
}

/* ────── 企業プロフィール編集カード ────── */
const INDUSTRY_OPTIONS = [
    'IT・通信・インターネット', 'メーカー（電気・電子・機械）', 'メーカー（素材・化学・食品）',
    '商社（総合・専門）', '金融・保険', '不動産・建設', 'コンサルティング・士業',
    '人材サービス', '広告・メディア・エンタメ', '小売・流通・外食', '運輸・物流',
    '医療・福祉・介護', '教育・学習支援', '公務員・団体・NPO', 'エネルギー・インフラ',
    '旅行・宿泊・レジャー', '農林水産', 'その他',
];

const EMPLOYEE_RANGES = [
    '1〜10名', '11〜50名', '51〜100名', '101〜300名',
    '301〜500名', '501〜1000名', '1001〜5000名', '5001名以上',
];

function CompanyProfileCard({ company, onUpdate }) {
    const toast = useToast();
    const [editing, setEditing] = useState(false);
    const [saving, setSaving] = useState(false);
    const [form, setForm] = useState({});

    const startEdit = () => {
        setForm({
            company_name: company.company_name || '',
            representative_name: company.representative_name || '',
            description: company.description || '',
            website: company.website || '',
            phone: company.phone || '',
            address: company.address || '',
            industry: company.industry || '',
            number_of_employees: company.number_of_employees || '',
            founded_year: company.founded_year || '',
            revenue: company.revenue || '',
            capital: company.capital || '',
            office_address: company.office_address || '',
            nearest_station: company.nearest_station || '',
            company_culture: company.company_culture || '',
            work_environment: company.work_environment || '',
            benefits_default: company.benefits_default || '',
        });
        setEditing(true);
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            const res = await api.put('/company', form);
            onUpdate(res.data.company);
            setEditing(false);
        } catch (err) {
            toast.error('保存に失敗しました');
        } finally {
            setSaving(false);
        }
    };

    const set = (key, val) => setForm(prev => ({ ...prev, [key]: val }));

    if (!editing) {
        return (
            <div className="card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-md)' }}>
                    <h3 style={{ margin: 0 }}>企業プロフィール</h3>
                    <button className="btn btn-secondary" style={{ fontSize: 'var(--font-size-xs)' }} onClick={startEdit}>
                        編集
                    </button>
                </div>
                <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-sm) var(--space-xl)' }}>
                    <p><strong>企業名:</strong> {company.company_name}</p>
                    {company.representative_name && <p><strong>代表者名:</strong> {company.representative_name}</p>}
                    <p><strong>種別:</strong> {company.company_type === 'recruitment_agency' ? '人材紹介・派遣会社' : '一般企業'}</p>
                    {company.industry && <p><strong>業界:</strong> {company.industry}</p>}
                    {company.number_of_employees && <p><strong>従業員数:</strong> {company.number_of_employees}</p>}
                    {company.founded_year && <p><strong>設立年:</strong> {company.founded_year}</p>}
                    {company.revenue && <p><strong>売上高:</strong> {company.revenue}</p>}
                    {company.capital && <p><strong>資本金:</strong> {company.capital}</p>}
                    {company.website && <p><strong>Web:</strong> <a href={company.website} target="_blank" rel="noopener noreferrer">{company.website}</a></p>}
                    {company.phone && <p><strong>電話:</strong> {company.phone}</p>}
                    {company.address && <p><strong>本社住所:</strong> {company.address}</p>}
                    {company.office_address && <p><strong>勤務地住所:</strong> {company.office_address}</p>}
                    {company.nearest_station && <p><strong>最寄駅:</strong> {company.nearest_station}</p>}
                    {company.permit_number && <p><strong>許可番号:</strong> {company.permit_number}</p>}
                </div>
                {(company.description || company.company_culture || company.work_environment) && (
                    <div style={{ marginTop: 'var(--space-md)', fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>
                        {company.description && <p><strong>企業概要:</strong> {company.description}</p>}
                        {company.company_culture && <p><strong>社風・文化:</strong> {company.company_culture}</p>}
                        {company.work_environment && <p><strong>職場環境:</strong> {company.work_environment}</p>}
                        {company.benefits_default && <p><strong>福利厚生（デフォルト）:</strong> {company.benefits_default}</p>}
                    </div>
                )}
                {!company.industry && !company.number_of_employees && (
                    <div style={{
                        marginTop: 'var(--space-md)', padding: 'var(--space-md)',
                        background: 'rgba(200,149,46,0.06)', borderRadius: 'var(--radius-md)',
                        border: '1px solid rgba(200,149,46,0.15)', fontSize: 'var(--font-size-xs)',
                    }}>
                        企業プロフィールを充実させると、求人作成時に業界・従業員数・社風などが自動入力されます。
                        <button className="btn btn-primary" style={{ marginLeft: 'var(--space-sm)', fontSize: 'var(--font-size-xs)', padding: '2px 10px' }} onClick={startEdit}>
                            設定する
                        </button>
                    </div>
                )}
            </div>
        );
    }

    return (
        <div className="card">
            <h3 style={{ marginBottom: 'var(--space-md)' }}>企業プロフィール編集</h3>
            <div className="grid grid-2" style={{ gap: 'var(--space-md)' }}>
                <div className="form-group">
                    <label className="form-label">企業名</label>
                    <input className="form-input" value={form.company_name} onChange={e => set('company_name', e.target.value)} />
                </div>
                <div className="form-group">
                    <label className="form-label">代表者名 *</label>
                    <input className="form-input" required value={form.representative_name || ''} onChange={e => set('representative_name', e.target.value)} placeholder="例: 山田 太郎" />
                </div>
                <div className="form-group">
                    <label className="form-label">業界・業種</label>
                    <select className="form-select" value={form.industry} onChange={e => set('industry', e.target.value)}>
                        <option value="">選択してください</option>
                        {INDUSTRY_OPTIONS.map(ind => <option key={ind} value={ind}>{ind}</option>)}
                    </select>
                </div>
                <div className="form-group">
                    <label className="form-label">従業員数</label>
                    <select className="form-select" value={form.number_of_employees} onChange={e => set('number_of_employees', e.target.value)}>
                        <option value="">選択してください</option>
                        {EMPLOYEE_RANGES.map(r => <option key={r} value={r}>{r}</option>)}
                    </select>
                </div>
                <div className="form-group">
                    <label className="form-label">設立年</label>
                    <input className="form-input" value={form.founded_year} onChange={e => set('founded_year', e.target.value)} placeholder="例: 1989年11月28日" />
                </div>
                <div className="form-group">
                    <label className="form-label">売上高</label>
                    <input className="form-input" value={form.revenue || ''} onChange={e => set('revenue', e.target.value)} placeholder="例: 連結:593億24百万円（2023年12月期）" />
                </div>
                <div className="form-group">
                    <label className="form-label">資本金</label>
                    <input className="form-input" value={form.capital || ''} onChange={e => set('capital', e.target.value)} placeholder="例: 4,000百万円" />
                </div>
                <div className="form-group">
                    <label className="form-label">ウェブサイト</label>
                    <input className="form-input" value={form.website} onChange={e => set('website', e.target.value)} placeholder="https://example.com" />
                </div>
                <div className="form-group">
                    <label className="form-label">電話番号</label>
                    <input className="form-input" value={form.phone} onChange={e => set('phone', e.target.value)} placeholder="03-1234-5678" />
                </div>
                <div className="form-group">
                    <label className="form-label">本社住所</label>
                    <input className="form-input" value={form.address} onChange={e => set('address', e.target.value)} placeholder="東京都渋谷区..." />
                </div>
                <div className="form-group">
                    <label className="form-label">勤務地住所（デフォルト）</label>
                    <input className="form-input" value={form.office_address} onChange={e => set('office_address', e.target.value)} placeholder="求人作成時に自動入力されます" />
                </div>
                <div className="form-group">
                    <label className="form-label">最寄駅（デフォルト）</label>
                    <input className="form-input" value={form.nearest_station} onChange={e => set('nearest_station', e.target.value)} placeholder="例: 渋谷駅 徒歩5分" />
                </div>
            </div>
            <div className="form-group" style={{ marginTop: 'var(--space-md)' }}>
                <label className="form-label">企業概要</label>
                <textarea className="form-textarea" rows={3} value={form.description} onChange={e => set('description', e.target.value)} placeholder="事業内容をお書きください" />
            </div>
            <div className="grid grid-2" style={{ gap: 'var(--space-md)' }}>
                <div className="form-group">
                    <label className="form-label">社風・文化（デフォルト）</label>
                    <textarea className="form-textarea" rows={2} value={form.company_culture} onChange={e => set('company_culture', e.target.value)} placeholder="求人作成時に自動入力されます" />
                </div>
                <div className="form-group">
                    <label className="form-label">職場環境（デフォルト）</label>
                    <textarea className="form-textarea" rows={2} value={form.work_environment} onChange={e => set('work_environment', e.target.value)} placeholder="求人作成時に自動入力されます" />
                </div>
            </div>
            <div className="form-group">
                <label className="form-label">福利厚生（デフォルト）</label>
                <textarea className="form-textarea" rows={2} value={form.benefits_default} onChange={e => set('benefits_default', e.target.value)} placeholder="求人作成時に自動入力されます" />
            </div>
            <div style={{ display: 'flex', gap: 'var(--space-sm)', marginTop: 'var(--space-lg)' }}>
                <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
                    {saving ? '保存中...' : '保存'}
                </button>
                <button className="btn btn-secondary" onClick={() => setEditing(false)}>キャンセル</button>
            </div>
        </div>
    );
}
