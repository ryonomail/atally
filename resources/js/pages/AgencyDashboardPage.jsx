import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';
import { useToast } from '../hooks/useToast';
import PaymentCardSection from '../components/PaymentCardSection';

// MVP期間中は無効化された機能（収益分析・紹介の送受信）のタブは出さない。
// 「求人一覧」は外部求人データベースの閲覧機能のため実態に合わせて改称。
// 自社が掲載した求人の管理は「求人管理」(/company/jobs) で行う。
const TABS = [
    { key: 'overview', label: '概要' },
    { key: 'jobs', label: '求人データベース' },
    { key: 'companies', label: '企業一覧' },
    { key: 'license', label: '許可証' },
];

/* ============================================
   ステータスバッジ
   ============================================ */
function StatusBadge({ status }) {
    const map = {
        pending:  { bg: 'rgba(245,158,11,0.12)', color: '#d97706', text: '保留中' },
        approved: { bg: 'rgba(34,197,94,0.12)',  color: '#16a34a', text: '承認済' },
        rejected: { bg: 'rgba(239,68,68,0.12)',  color: '#dc2626', text: '拒否' },
        placed:   { bg: 'rgba(200,149,46,0.12)', color: '#2563eb', text: '成約' },
    };
    const s = map[status] || { bg: 'var(--color-bg-secondary)', color: 'var(--color-text-muted)', text: status };
    return (
        <span style={{
            display: 'inline-block',
            padding: '2px 10px',
            borderRadius: 'var(--radius-md)',
            fontSize: 'var(--font-size-xs)',
            fontWeight: 600,
            background: s.bg,
            color: s.color,
        }}>
            {s.text}
        </span>
    );
}

/* ============================================
   紹介パターンバッジ
   ============================================ */
function ReferralPatternBadge({ pattern }) {
    if (pattern === 'direct') {
        return (
            <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 'var(--radius-md)', fontSize: 10, fontWeight: 600, background: 'rgba(34,197,94,0.1)', color: '#15803d' }}>
                直接紹介
            </span>
        );
    }
    return (
        <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 'var(--radius-md)', fontSize: 10, fontWeight: 600, background: 'rgba(18,28,52,0.08)', color: 'var(--color-navy)' }}>
            レベニューシェア
        </span>
    );
}

/* ============================================
   手数料サマリー表示
   ============================================ */
function ReferralFeeSummary({ referral: r }) {
    if (r.referral_pattern === 'direct') {
        // パターン1: 料率 or 固定金額、シェアなし
        if (r.referral_fee_type === 'fixed' && r.referral_fee_amount) {
            return <span>¥{Number(r.referral_fee_amount).toLocaleString()} 固定</span>;
        }
        return <span>{r.fee_percentage != null ? `${r.fee_percentage}%` : '-'}</span>;
    }
    // パターン2: 料率 or 固定 + シェア分配
    const feeStr = r.referral_fee_type === 'fixed' && r.referral_fee_amount
        ? `¥${Number(r.referral_fee_amount).toLocaleString()} 固定`
        : r.fee_percentage != null ? `${r.fee_percentage}%` : '-';
    const shareStr = (r.source_share != null && r.referrer_share != null)
        ? ` (${r.source_share}:${r.referrer_share})`
        : '';
    return <span>{feeStr}<span style={{ color: 'var(--color-text-muted)' }}>{shareStr}</span></span>;
}

/* ============================================
   概要タブ
   ============================================ */
function OverviewTab({ stats, licenseVerified, licenseDocSubmitted, verificationStatus, onTabChange }) {
    const navigate = useNavigate();
    if (!stats) return <div className="skeleton" style={{ height: 200 }} />;

    // MVP期間中は紹介・収益機能を無効化しているため、関連統計は表示しない
    const cards = [
        { label: 'アクティブ求人', value: stats.active_jobs, color: '#22c55e' },
        { label: '全求人', value: stats.total_jobs, color: '#121c34' },
    ];

    const licenseStatusLabel = licenseVerified
        ? { text: '認証済み', bg: 'rgba(34,197,94,0.12)', color: '#16a34a' }
        : licenseDocSubmitted
            ? { text: '審査中（書類提出済み）', bg: 'rgba(245,158,11,0.12)', color: '#d97706' }
            : { text: '未提出', bg: 'rgba(239,68,68,0.12)', color: '#dc2626' };

    // 文脈に応じた「次にやること」を1つ提示（離脱防止のナビゲーション）
    const nextStep = !licenseVerified
        ? { text: 'まず職業紹介事業の許可証を提出して、審査を通しましょう。', cta: '許可証を提出する', action: () => onTabChange('license') }
        : (stats.total_jobs || 0) === 0
            ? { text: '最初の求人を作成しましょう。掲載は無料で、問題がなければ自動公開されます。', cta: '求人を作成する', action: () => navigate('/company/jobs') }
            : { text: '求人をブーストすると上位表示されます。下のカード登録を済ませると設定できます。', cta: '求人管理を開く', action: () => navigate('/company/jobs') };

    return (
        <div>
            {/* スタートガイド（次にやること） */}
            <div className="card" style={{ marginBottom: 'var(--space-lg)', borderLeft: '3px solid var(--color-accent)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 'var(--space-md)' }}>
                <div>
                    <p style={{ fontWeight: 700, margin: '0 0 4px' }}>🚀 次にやること</p>
                    <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', margin: 0 }}>{nextStep.text}</p>
                </div>
                <button className="btn btn-primary" style={{ whiteSpace: 'nowrap' }} onClick={nextStep.action}>{nextStep.cta}</button>
            </div>

            {/* 許可証状態 */}
            <div className="card" style={{ marginBottom: 'var(--space-lg)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 'var(--space-md)' }}>
                <div>
                    <p style={{ fontWeight: 600, marginBottom: 'var(--space-xs)' }}>職業紹介事業許可証</p>
                    <span style={{
                        display: 'inline-block', padding: '2px 12px', borderRadius: 'var(--radius-md)',
                        fontSize: 'var(--font-size-xs)', fontWeight: 600,
                        background: licenseStatusLabel.bg, color: licenseStatusLabel.color,
                    }}>{licenseStatusLabel.text}</span>
                    {verificationStatus && !licenseVerified && (
                        <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', marginTop: 4, marginBottom: 0 }}>
                            企業審査: {verificationStatus === 'verified' ? '承認済み' : verificationStatus === 'pending' ? '審査中' : verificationStatus === 'rejected' ? '却下' : verificationStatus}
                        </p>
                    )}
                </div>
                {!licenseVerified && (
                    <button className="btn btn-primary" style={{ fontSize: 'var(--font-size-sm)' }}
                        onClick={() => onTabChange('license')}>
                        {licenseDocSubmitted ? '審査状況を確認' : '許可証を提出する'}
                    </button>
                )}
            </div>

            {/* 統計カード */}
            <div className="grid grid-4" style={{ gap: 'var(--space-md)' }}>
                {cards.map(c => (
                    <div key={c.label} className="card" style={{ textAlign: 'center' }}>
                        <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--font-size-xs)', marginBottom: 'var(--space-xs)' }}>{c.label}</p>
                        <p style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 700, color: c.color, margin: 0 }}>{c.value}</p>
                    </div>
                ))}
            </div>

            {/* 自社が掲載した求人の管理導線 */}
            <div className="card" style={{ marginTop: 'var(--space-lg)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 'var(--space-md)' }}>
                <div>
                    <p style={{ fontWeight: 600, marginBottom: 4 }}>📋 自社が掲載した求人の管理</p>
                    <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', margin: 0 }}>
                        投稿した求人の確認・編集・ブースト設定は「求人管理」から行えます。
                    </p>
                </div>
                <button className="btn btn-primary" onClick={() => navigate('/company/jobs')}>求人管理を開く</button>
            </div>

            {/* クレジットカード（ブースト課金用） */}
            <div className="card" style={{ marginTop: 'var(--space-lg)' }}>
                <h3 style={{ marginBottom: 'var(--space-sm)' }}>💳 クレジットカード</h3>
                <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', marginBottom: 'var(--space-md)' }}>
                    求人を上位表示（ブースト）するにはカード登録が必要です。掲載自体は無料です。
                </p>
                <PaymentCardSection />
            </div>
        </div>
    );
}

/* ============================================
   受けた紹介タブ
   ============================================ */
function ReceivedReferralsTab() {
    const toast = useToast();
    const [referrals, setReferrals] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [actionLoading, setActionLoading] = useState(null);
    const [placementForm, setPlacementForm] = useState(null); // referral id
    const [placementSalary, setPlacementSalary] = useState('');
    const [placementError, setPlacementError] = useState('');

    const fetchReferrals = async () => {
        setLoading(true);
        try {
            const { data } = await api.get('/agency/referrals/received');
            setReferrals(Array.isArray(data) ? data : data.data || []);
        } catch (err) {
            setError(err.response?.data?.message || '紹介データの取得に失敗しました');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchReferrals(); }, []);

    const handleStatusChange = async (referralId, status) => {
        if (!confirm(status === 'approved' ? 'この紹介を承認しますか？' : 'この紹介を拒否しますか？')) return;
        setActionLoading(referralId);
        try {
            await api.put(`/agency/referrals/${referralId}/status`, { status });
            await fetchReferrals();
        } catch (err) {
            toast.error(err.response?.data?.message || 'ステータス更新に失敗しました');
        } finally {
            setActionLoading(null);
        }
    };

    const handlePlacement = async (referral) => {
        const isFixedDirect = referral.referral_pattern === 'direct' && referral.referral_fee_type === 'fixed';
        if (!isFixedDirect && (!placementSalary || isNaN(Number(placementSalary)))) {
            setPlacementError('有効な年収を入力してください');
            return;
        }
        setActionLoading(referral.id);
        setPlacementError('');
        try {
            const payload = isFixedDirect
                ? { placement_salary: 0 }  // 固定金額の場合、バックエンドでreferral_fee_amountを使用
                : { placement_salary: Number(placementSalary) };
            await api.post(`/agency/referrals/${referral.id}/placement`, payload);
            setPlacementForm(null);
            setPlacementSalary('');
            await fetchReferrals();
        } catch (err) {
            setPlacementError(err.response?.data?.message || '成約報告に失敗しました');
        } finally {
            setActionLoading(null);
        }
    };

    if (loading) return <div className="skeleton" style={{ height: 300 }} />;
    if (error) return <div className="card" style={{ textAlign: 'center', padding: 'var(--space-2xl)', color: 'var(--color-text-muted)' }}>{error}</div>;
    if (referrals.length === 0) return <div className="card" style={{ textAlign: 'center', padding: 'var(--space-2xl)', color: 'var(--color-text-muted)' }}>受けた紹介はまだありません</div>;

    return (
        <div className="card" style={{ overflowX: 'auto' }}>
            <h3 style={{ marginBottom: 'var(--space-md)' }}>受けた紹介一覧</h3>
            <table style={{ width: '100%', fontSize: 'var(--font-size-sm)', borderCollapse: 'collapse' }}>
                <thead>
                    <tr style={{ borderBottom: '2px solid var(--color-border)', textAlign: 'left' }}>
                        <th style={{ padding: 'var(--space-xs) var(--space-sm)', color: 'var(--color-text-muted)', fontWeight: 600 }}>求人タイトル</th>
                        <th style={{ padding: 'var(--space-xs) var(--space-sm)', color: 'var(--color-text-muted)', fontWeight: 600 }}>紹介元企業</th>
                        <th style={{ padding: 'var(--space-xs) var(--space-sm)', color: 'var(--color-text-muted)', fontWeight: 600 }}>候補者概要</th>
                        <th style={{ padding: 'var(--space-xs) var(--space-sm)', color: 'var(--color-text-muted)', fontWeight: 600, textAlign: 'center' }}>紹介パターン</th>
                        <th style={{ padding: 'var(--space-xs) var(--space-sm)', color: 'var(--color-text-muted)', fontWeight: 600, textAlign: 'center' }}>手数料</th>
                        <th style={{ padding: 'var(--space-xs) var(--space-sm)', color: 'var(--color-text-muted)', fontWeight: 600, textAlign: 'center' }}>ステータス</th>
                        <th style={{ padding: 'var(--space-xs) var(--space-sm)', color: 'var(--color-text-muted)', fontWeight: 600 }}>日付</th>
                        <th style={{ padding: 'var(--space-xs) var(--space-sm)', color: 'var(--color-text-muted)', fontWeight: 600 }}>アクション</th>
                    </tr>
                </thead>
                <tbody>
                    {referrals.map(r => (
                        <React.Fragment key={r.id}>
                            <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
                                <td style={{ padding: 'var(--space-xs) var(--space-sm)', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                    {r.job?.title || '-'}
                                </td>
                                <td style={{ padding: 'var(--space-xs) var(--space-sm)' }}>
                                    {r.referrer_company?.company_name || r.referrerCompany?.company_name || '-'}
                                </td>
                                <td style={{ padding: 'var(--space-xs) var(--space-sm)', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--color-text-secondary)' }}>
                                    {r.candidate_summary || '-'}
                                </td>
                                <td style={{ padding: 'var(--space-xs) var(--space-sm)', textAlign: 'center' }}>
                                    <ReferralPatternBadge pattern={r.referral_pattern} />
                                </td>
                                <td style={{ padding: 'var(--space-xs) var(--space-sm)', textAlign: 'center', fontSize: 'var(--font-size-xs)' }}>
                                    <ReferralFeeSummary referral={r} />
                                </td>
                                <td style={{ padding: 'var(--space-xs) var(--space-sm)', textAlign: 'center' }}>
                                    <StatusBadge status={r.status} />
                                </td>
                                <td style={{ padding: 'var(--space-xs) var(--space-sm)', fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
                                    {r.created_at ? new Date(r.created_at).toLocaleDateString('ja-JP') : '-'}
                                </td>
                                <td style={{ padding: 'var(--space-xs) var(--space-sm)' }}>
                                    <div style={{ display: 'flex', gap: 'var(--space-xs)', flexWrap: 'wrap' }}>
                                        {r.status === 'pending' && (
                                            <>
                                                <button className="btn btn-primary" style={{ fontSize: 'var(--font-size-xs)', padding: '4px 10px' }}
                                                    disabled={actionLoading === r.id}
                                                    onClick={() => handleStatusChange(r.id, 'approved')}>
                                                    {actionLoading === r.id ? '...' : '承認'}
                                                </button>
                                                <button className="btn btn-secondary" style={{ fontSize: 'var(--font-size-xs)', padding: '4px 10px', color: '#dc2626' }}
                                                    disabled={actionLoading === r.id}
                                                    onClick={() => handleStatusChange(r.id, 'rejected')}>
                                                    拒否
                                                </button>
                                            </>
                                        )}
                                        {r.status === 'approved' && (
                                            <button className="btn btn-secondary" style={{ fontSize: 'var(--font-size-xs)', padding: '4px 10px' }}
                                                onClick={() => { setPlacementForm(r.id); setPlacementSalary(''); setPlacementError(''); }}>
                                                成約報告
                                            </button>
                                        )}
                                    </div>
                                </td>
                            </tr>
                            {/* 成約報告インラインフォーム */}
                            {placementForm === r.id && (
                                <tr style={{ background: 'var(--color-bg-secondary)' }}>
                                    <td colSpan={8} style={{ padding: 'var(--space-md) var(--space-sm)' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-md)', flexWrap: 'wrap' }}>
                                            {r.referral_pattern === 'direct' && r.referral_fee_type === 'fixed' ? (
                                                <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', padding: 'var(--space-sm)', background: 'rgba(34,197,94,0.06)', border: '1px solid rgba(34,197,94,0.2)', borderRadius: 'var(--radius-sm)' }}>
                                                    固定金額 ¥{Number(r.referral_fee_amount).toLocaleString()} で成約を報告します
                                                </div>
                                            ) : (
                                            <div className="form-group" style={{ margin: 0, flex: '0 0 auto' }}>
                                                <label className="form-label" style={{ fontSize: 'var(--font-size-xs)', marginBottom: 'var(--space-xs)' }}>成約年収 (円)</label>
                                                <input
                                                    className="form-input"
                                                    type="number"
                                                    placeholder="例: 5000000"
                                                    value={placementSalary}
                                                    onChange={e => setPlacementSalary(e.target.value)}
                                                    style={{ width: 200 }}
                                                />
                                            </div>
                                            )}
                                            <div style={{ display: 'flex', gap: 'var(--space-sm)', alignItems: 'flex-end', paddingTop: 'var(--space-md)' }}>
                                                <button className="btn btn-primary" style={{ fontSize: 'var(--font-size-xs)' }}
                                                    disabled={actionLoading === r.id}
                                                    onClick={() => handlePlacement(r)}>
                                                    {actionLoading === r.id ? '送信中...' : '成約を報告'}
                                                </button>
                                                <button className="btn btn-secondary" style={{ fontSize: 'var(--font-size-xs)' }}
                                                    onClick={() => { setPlacementForm(null); setPlacementError(''); }}>
                                                    キャンセル
                                                </button>
                                            </div>
                                            {placementError && (
                                                <p style={{ color: '#dc2626', fontSize: 'var(--font-size-xs)', margin: 0 }}>{placementError}</p>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            )}
                        </React.Fragment>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

/* ============================================
   送った紹介タブ
   ============================================ */
function SentReferralsTab() {
    const [referrals, setReferrals] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        api.get('/agency/referrals/sent')
            .then(res => {
                setReferrals(Array.isArray(res.data) ? res.data : res.data.data || []);
            })
            .catch(err => {
                setError(err.response?.data?.message || '紹介データの取得に失敗しました');
            })
            .finally(() => setLoading(false));
    }, []);

    if (loading) return <div className="skeleton" style={{ height: 300 }} />;
    if (error) return <div className="card" style={{ textAlign: 'center', padding: 'var(--space-2xl)', color: 'var(--color-text-muted)' }}>{error}</div>;
    if (referrals.length === 0) return <div className="card" style={{ textAlign: 'center', padding: 'var(--space-2xl)', color: 'var(--color-text-muted)' }}>送った紹介はまだありません</div>;

    return (
        <div className="card" style={{ overflowX: 'auto' }}>
            <h3 style={{ marginBottom: 'var(--space-md)' }}>送った紹介一覧</h3>
            <table style={{ width: '100%', fontSize: 'var(--font-size-sm)', borderCollapse: 'collapse' }}>
                <thead>
                    <tr style={{ borderBottom: '2px solid var(--color-border)', textAlign: 'left' }}>
                        <th style={{ padding: 'var(--space-xs) var(--space-sm)', color: 'var(--color-text-muted)', fontWeight: 600 }}>求人タイトル</th>
                        <th style={{ padding: 'var(--space-xs) var(--space-sm)', color: 'var(--color-text-muted)', fontWeight: 600 }}>求人元企業</th>
                        <th style={{ padding: 'var(--space-xs) var(--space-sm)', color: 'var(--color-text-muted)', fontWeight: 600 }}>候補者概要</th>
                        <th style={{ padding: 'var(--space-xs) var(--space-sm)', color: 'var(--color-text-muted)', fontWeight: 600, textAlign: 'center' }}>紹介パターン</th>
                        <th style={{ padding: 'var(--space-xs) var(--space-sm)', color: 'var(--color-text-muted)', fontWeight: 600, textAlign: 'center' }}>手数料</th>
                        <th style={{ padding: 'var(--space-xs) var(--space-sm)', color: 'var(--color-text-muted)', fontWeight: 600, textAlign: 'center' }}>ステータス</th>
                        <th style={{ padding: 'var(--space-xs) var(--space-sm)', color: 'var(--color-text-muted)', fontWeight: 600 }}>日付</th>
                        <th style={{ padding: 'var(--space-xs) var(--space-sm)', color: 'var(--color-text-muted)', fontWeight: 600, textAlign: 'right' }}>紹介報酬</th>
                    </tr>
                </thead>
                <tbody>
                    {referrals.map(r => (
                        <tr key={r.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                            <td style={{ padding: 'var(--space-xs) var(--space-sm)', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {r.job?.title || '-'}
                            </td>
                            <td style={{ padding: 'var(--space-xs) var(--space-sm)' }}>
                                {r.source_company?.company_name || r.sourceCompany?.company_name || '-'}
                            </td>
                            <td style={{ padding: 'var(--space-xs) var(--space-sm)', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--color-text-secondary)' }}>
                                {r.candidate_summary || '-'}
                            </td>
                            <td style={{ padding: 'var(--space-xs) var(--space-sm)', textAlign: 'center' }}>
                                <ReferralPatternBadge pattern={r.referral_pattern} />
                            </td>
                            <td style={{ padding: 'var(--space-xs) var(--space-sm)', textAlign: 'center', fontSize: 'var(--font-size-xs)' }}>
                                <ReferralFeeSummary referral={r} />
                            </td>
                            <td style={{ padding: 'var(--space-xs) var(--space-sm)', textAlign: 'center' }}>
                                <StatusBadge status={r.status} />
                            </td>
                            <td style={{ padding: 'var(--space-xs) var(--space-sm)', fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
                                {r.created_at ? new Date(r.created_at).toLocaleDateString('ja-JP') : '-'}
                            </td>
                            <td style={{ padding: 'var(--space-xs) var(--space-sm)', textAlign: 'right', fontWeight: 600 }}>
                                {r.status === 'placed' && r.referrer_fee != null
                                    ? <span style={{ color: '#22c55e' }}>¥{Number(r.referrer_fee).toLocaleString()}</span>
                                    : <span style={{ color: 'var(--color-text-muted)' }}>-</span>
                                }
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

/* ============================================
   ライセンスタブ
   ============================================ */
function LicenseTab({ licenseVerified, permitNumber, licenseDocSubmitted, verificationStatus, onLicenseSubmitted }) {
    const [file, setFile] = useState(null);
    const [permit, setPermit] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!file) {
            setError('職業紹介事業許可証を選択してください');
            return;
        }
        if (!permit.trim()) {
            setError('許可番号を入力してください');
            return;
        }
        setSubmitting(true);
        setError('');
        setSuccess('');
        try {
            const formData = new FormData();
            formData.append('license_document', file);
            formData.append('permit_number', permit.trim());
            await api.post('/agency/license', formData);
            setSuccess('職業紹介事業許可証を提出しました。審査完了までお待ちください。');
            setFile(null);
            setPermit('');
            if (onLicenseSubmitted) onLicenseSubmitted();
        } catch (err) {
            setError(err.response?.data?.message || '許可証の提出に失敗しました');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div style={{ maxWidth: 600 }}>
            {/* 現在のステータス */}
            <div className="card" style={{ marginBottom: 'var(--space-lg)' }}>
                <h3 style={{ marginBottom: 'var(--space-md)' }}>職業紹介事業許可証の認証状態</h3>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-md)', flexWrap: 'wrap' }}>
                    {licenseVerified ? (
                        <span style={{
                            display: 'inline-block', padding: '4px 16px', borderRadius: 'var(--radius-md)',
                            fontSize: 'var(--font-size-sm)', fontWeight: 600,
                            background: 'rgba(34,197,94,0.12)', color: '#16a34a',
                        }}>認証済み</span>
                    ) : licenseDocSubmitted ? (
                        <span style={{
                            display: 'inline-block', padding: '4px 16px', borderRadius: 'var(--radius-md)',
                            fontSize: 'var(--font-size-sm)', fontWeight: 600,
                            background: 'rgba(245,158,11,0.12)', color: '#d97706',
                        }}>審査中（書類提出済み）</span>
                    ) : (
                        <span style={{
                            display: 'inline-block', padding: '4px 16px', borderRadius: 'var(--radius-md)',
                            fontSize: 'var(--font-size-sm)', fontWeight: 600,
                            background: 'rgba(239,68,68,0.12)', color: '#dc2626',
                        }}>未提出</span>
                    )}
                </div>
                {permitNumber && (
                    <p style={{ marginTop: 'var(--space-md)', fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>
                        許可番号: <strong>{permitNumber}</strong>
                    </p>
                )}
                {verificationStatus && (
                    <p style={{ marginTop: 'var(--space-xs)', fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
                        企業審査状況: {verificationStatus === 'verified' ? '承認済み' : verificationStatus === 'pending' ? '審査中' : verificationStatus === 'rejected' ? '却下' : verificationStatus}
                    </p>
                )}
            </div>

            {/* アップロードフォーム */}
            {!licenseVerified && (
                <div className="card">
                    <h3 style={{ marginBottom: 'var(--space-md)' }}>職業紹介事業許可証の提出</h3>
                    <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', marginBottom: 'var(--space-lg)' }}>
                        厚生労働大臣発行の職業紹介事業許可証を提出してください。審査完了後に認証されます。
                    </p>

                    {success && (
                        <div style={{
                            padding: 'var(--space-md)', marginBottom: 'var(--space-md)',
                            background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)',
                            borderRadius: 'var(--radius-md)', fontSize: 'var(--font-size-sm)', color: '#16a34a',
                        }}>
                            {success}
                        </div>
                    )}

                    {error && (
                        <div style={{
                            padding: 'var(--space-md)', marginBottom: 'var(--space-md)',
                            background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)',
                            borderRadius: 'var(--radius-md)', fontSize: 'var(--font-size-sm)', color: '#dc2626',
                        }}>
                            {error}
                        </div>
                    )}

                    <form onSubmit={handleSubmit}>
                        <div className="form-group">
                            <label className="form-label">許可番号</label>
                            <input
                                className="form-input"
                                type="text"
                                placeholder="例: 13-ユ-123456"
                                value={permit}
                                onChange={e => setPermit(e.target.value)}
                                required
                            />
                        </div>
                        <div className="form-group">
                            <label className="form-label">職業紹介事業許可証（画像・PDF）</label>
                            <input
                                className="form-input"
                                type="file"
                                accept=".pdf,.jpg,.jpeg,.png"
                                onChange={e => setFile(e.target.files[0] || null)}
                                style={{ padding: 'var(--space-sm)' }}
                            />
                            <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', marginTop: 'var(--space-xs)' }}>
                                PDF, JPG, PNG形式 (最大10MB)
                            </p>
                        </div>
                        <button type="submit" className="btn btn-primary" disabled={submitting}>
                            {submitting ? '送信中...' : '許可証を提出する'}
                        </button>
                    </form>
                </div>
            )}
        </div>
    );
}

/* ============================================
   求人一覧タブ
   ============================================ */
function JobDatabaseTab() {
    const [jobs, setJobs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [page, setPage] = useState(1);
    const [lastPage, setLastPage] = useState(1);
    const [expandedId, setExpandedId] = useState(null);
    const navigate = useNavigate();

    const fetchJobs = async (p = 1) => {
        setLoading(true);
        try {
            const params = { page: p, per_page: 20 };
            if (search.trim()) params.keyword = search.trim();
            const { data } = await api.get('/agency/job-database', { params });
            setJobs(data.data || []);
            setPage(data.current_page || 1);
            setLastPage(data.last_page || 1);
        } catch {
            setJobs([]);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchJobs(); }, []);

    const handleSearch = (e) => {
        e.preventDefault();
        fetchJobs(1);
    };

    return (
        <div>
            <form onSubmit={handleSearch} style={{ display: 'flex', gap: 'var(--space-sm)', marginBottom: 'var(--space-lg)' }}>
                <input className="form-input" placeholder="キーワードで検索..." value={search}
                    onChange={e => setSearch(e.target.value)} style={{ flex: 1 }} />
                <button type="submit" className="btn btn-primary">検索</button>
            </form>

            {loading ? <div className="skeleton" style={{ height: 300 }} /> : jobs.length === 0 ? (
                <div className="card" style={{ textAlign: 'center', padding: 'var(--space-2xl)', color: 'var(--color-text-muted)' }}>
                    求人が見つかりませんでした
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
                    {jobs.map(job => (
                        <div key={job.id} className="card" style={{ cursor: 'pointer' }}
                            onClick={() => setExpandedId(expandedId === job.id ? null : job.id)}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 'var(--space-md)' }}>
                                <div style={{ flex: 1 }}>
                                    <h4 style={{ margin: 0, marginBottom: 'var(--space-xs)' }}>{job.title}</h4>
                                    <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', margin: 0 }}>
                                        {job.company?.company_name || '企業名非公開'} | {job.location || job.prefecture || '-'}
                                    </p>
                                </div>
                                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                                    <p style={{ fontWeight: 600, margin: 0, color: '#22c55e' }}>
                                        {job.salary_min ? `¥${Number(job.salary_min).toLocaleString()}` : '-'}
                                        {job.salary_max ? ` ~ ¥${Number(job.salary_max).toLocaleString()}` : ''}
                                    </p>
                                    <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', margin: 0 }}>
                                        {job.employment_type || '-'}
                                    </p>
                                    {job.allow_referral && (
                                        <span style={{
                                            display: 'inline-block', marginTop: 4, padding: '2px 8px',
                                            borderRadius: 'var(--radius-sm)', fontSize: 'var(--font-size-xs)',
                                            fontWeight: 600, background: 'rgba(139,92,246,0.12)', color: '#7c3aed',
                                        }}>紹介可</span>
                                    )}
                                </div>
                            </div>
                            {expandedId === job.id && (
                                <div style={{ marginTop: 'var(--space-md)', paddingTop: 'var(--space-md)', borderTop: '1px solid var(--color-border)', fontSize: 'var(--font-size-sm)' }}>
                                    <p style={{ color: 'var(--color-text-secondary)', whiteSpace: 'pre-line' }}>{job.description?.slice(0, 300)}{job.description?.length > 300 ? '...' : ''}</p>
                                    {job.referral_fee && <p><strong>紹介手数料:</strong> {job.referral_fee}%</p>}
                                    <button className="btn btn-secondary" style={{ fontSize: 'var(--font-size-xs)', marginTop: 'var(--space-sm)' }}
                                        onClick={(e) => { e.stopPropagation(); navigate(`/jobs/${job.id}`); }}>
                                        詳細を見る
                                    </button>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}

            {lastPage > 1 && (
                <div style={{ display: 'flex', justifyContent: 'center', gap: 'var(--space-sm)', marginTop: 'var(--space-lg)' }}>
                    <button className="btn btn-secondary" disabled={page <= 1} onClick={() => fetchJobs(page - 1)}>前へ</button>
                    <span style={{ padding: 'var(--space-sm)', fontSize: 'var(--font-size-sm)' }}>{page} / {lastPage}</span>
                    <button className="btn btn-secondary" disabled={page >= lastPage} onClick={() => fetchJobs(page + 1)}>次へ</button>
                </div>
            )}
        </div>
    );
}

/* ============================================
   収益分析タブ
   ============================================ */
function AnalyticsTab() {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        api.get('/agency/revenue-analytics')
            .then(res => setData(res.data))
            .catch(() => {})
            .finally(() => setLoading(false));
    }, []);

    if (loading) return <div className="skeleton" style={{ height: 400 }} />;
    if (!data) return <div className="card" style={{ textAlign: 'center', padding: 'var(--space-2xl)', color: 'var(--color-text-muted)' }}>データの取得に失敗しました</div>;

    const { monthly, by_client, performance } = data;
    const maxEarnings = Math.max(...monthly.map(m => m.earnings), 1);

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-lg)' }}>
            {/* パフォーマンス指標 */}
            <div className="grid grid-4" style={{ gap: 'var(--space-md)' }}>
                {[
                    { label: '総紹介数', value: performance.total_sent, color: '#121c34' },
                    { label: '承認率', value: `${performance.approval_rate}%`, color: '#22c55e' },
                    { label: '成約率', value: `${performance.placement_rate}%`, color: '#c8952e' },
                    { label: '平均報酬', value: `¥${performance.avg_fee.toLocaleString()}`, color: '#8b5cf6' },
                ].map(c => (
                    <div key={c.label} className="card" style={{ textAlign: 'center' }}>
                        <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--font-size-xs)', marginBottom: 'var(--space-xs)' }}>{c.label}</p>
                        <p style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 700, color: c.color, margin: 0 }}>{c.value}</p>
                    </div>
                ))}
            </div>

            {/* 月別収益グラフ */}
            <div className="card">
                <h3 style={{ marginBottom: 'var(--space-lg)' }}>月別収益（過去12ヶ月）</h3>
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 200 }}>
                    {monthly.map(m => (
                        <div key={m.month} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                            <span style={{ fontSize: 10, color: 'var(--color-text-muted)' }}>
                                {m.earnings > 0 ? `¥${(m.earnings / 10000).toFixed(0)}万` : ''}
                            </span>
                            <div style={{
                                width: '100%', maxWidth: 40,
                                height: `${Math.max((m.earnings / maxEarnings) * 160, 4)}px`,
                                background: m.earnings > 0 ? 'var(--color-accent)' : 'var(--color-border)',
                                borderRadius: '4px 4px 0 0',
                                transition: 'height 0.3s',
                            }} />
                            <span style={{ fontSize: 9, color: 'var(--color-text-muted)', whiteSpace: 'nowrap' }}>
                                {m.month.slice(5)}月
                            </span>
                        </div>
                    ))}
                </div>
            </div>

            {/* クライアント別収益 */}
            <div className="card">
                <h3 style={{ marginBottom: 'var(--space-md)' }}>クライアント別収益（Top 10）</h3>
                {by_client.length === 0 ? (
                    <p style={{ color: 'var(--color-text-muted)', textAlign: 'center', padding: 'var(--space-lg)' }}>成約データがありません</p>
                ) : (
                    <table style={{ width: '100%', fontSize: 'var(--font-size-sm)', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr style={{ borderBottom: '2px solid var(--color-border)', textAlign: 'left' }}>
                                <th style={{ padding: 'var(--space-xs) var(--space-sm)', color: 'var(--color-text-muted)', fontWeight: 600 }}>企業名</th>
                                <th style={{ padding: 'var(--space-xs) var(--space-sm)', color: 'var(--color-text-muted)', fontWeight: 600, textAlign: 'center' }}>成約数</th>
                                <th style={{ padding: 'var(--space-xs) var(--space-sm)', color: 'var(--color-text-muted)', fontWeight: 600, textAlign: 'right' }}>合計報酬</th>
                            </tr>
                        </thead>
                        <tbody>
                            {by_client.map((c, i) => (
                                <tr key={i} style={{ borderBottom: '1px solid var(--color-border)' }}>
                                    <td style={{ padding: 'var(--space-xs) var(--space-sm)' }}>{c.company_name}</td>
                                    <td style={{ padding: 'var(--space-xs) var(--space-sm)', textAlign: 'center' }}>{c.count}件</td>
                                    <td style={{ padding: 'var(--space-xs) var(--space-sm)', textAlign: 'right', fontWeight: 600, color: '#22c55e' }}>
                                        ¥{c.total_fee.toLocaleString()}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>

            {/* ファネル */}
            <div className="card">
                <h3 style={{ marginBottom: 'var(--space-md)' }}>紹介ファネル</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
                    {[
                        { label: '紹介送信', value: performance.total_sent, color: '#94a3b8' },
                        { label: '承認済み', value: performance.total_approved, color: '#3b82f6' },
                        { label: '成約', value: performance.total_placed, color: '#22c55e' },
                    ].map(step => {
                        const pct = performance.total_sent > 0 ? (step.value / performance.total_sent * 100) : 0;
                        return (
                            <div key={step.label} style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-md)' }}>
                                <span style={{ width: 80, fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)' }}>{step.label}</span>
                                <div style={{ flex: 1, background: 'var(--color-bg-secondary)', borderRadius: 'var(--radius-md)', height: 28, overflow: 'hidden' }}>
                                    <div style={{
                                        width: `${Math.max(pct, 2)}%`, height: '100%', background: step.color,
                                        borderRadius: 'var(--radius-md)', display: 'flex', alignItems: 'center', justifyContent: 'flex-end',
                                        paddingRight: 8, transition: 'width 0.5s',
                                    }}>
                                        <span style={{ fontSize: 11, fontWeight: 600, color: '#fff' }}>{step.value}</span>
                                    </div>
                                </div>
                                <span style={{ width: 50, fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', textAlign: 'right' }}>
                                    {pct.toFixed(0)}%
                                </span>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}

/* ============================================
   企業一覧タブ
   ============================================ */
function CompaniesTab() {
    const [companies, setCompanies] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        api.get('/agency/clients')
            .then(res => setCompanies(Array.isArray(res.data) ? res.data : res.data.data || []))
            .catch(() => setCompanies([]))
            .finally(() => setLoading(false));
    }, []);

    if (loading) return <div className="skeleton" style={{ height: 300 }} />;
    if (companies.length === 0) return (
        <div className="card" style={{ textAlign: 'center', padding: 'var(--space-2xl)', color: 'var(--color-text-muted)' }}>
            パートナー企業はまだありません
        </div>
    );

    return (
        <div className="grid grid-3" style={{ gap: 'var(--space-md)' }}>
            {companies.map(c => (
                <div key={c.id} className="card">
                    <h4 style={{ margin: 0, marginBottom: 'var(--space-xs)' }}>{c.company_name || '企業名不明'}</h4>
                    {c.industry && <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', margin: 0, marginBottom: 'var(--space-sm)' }}>{c.industry}</p>}
                    {c.contact_email && (
                        <p style={{ fontSize: 'var(--font-size-sm)', margin: 0, marginBottom: 'var(--space-xs)' }}>
                            <span style={{ color: 'var(--color-text-muted)' }}>Email:</span> {c.contact_email}
                        </p>
                    )}
                    {c.contact_phone && (
                        <p style={{ fontSize: 'var(--font-size-sm)', margin: 0, marginBottom: 'var(--space-xs)' }}>
                            <span style={{ color: 'var(--color-text-muted)' }}>Tel:</span> {c.contact_phone}
                        </p>
                    )}
                    {c.jobs_count != null && (
                        <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', margin: 0, marginTop: 'var(--space-sm)' }}>
                            求人数: {c.jobs_count}件
                        </p>
                    )}
                </div>
            ))}
        </div>
    );
}

/* ============================================
   メインコンポーネント
   ============================================ */
export default function AgencyDashboardPage() {
    const [activeTab, setActiveTab] = useState('overview');
    const [stats, setStats] = useState(null);
    const [fetchError, setFetchError] = useState('');
    const [licenseVerified, setLicenseVerified] = useState(false);
    const [permitNumber, setPermitNumber] = useState('');
    const [licenseDocSubmitted, setLicenseDocSubmitted] = useState(false);
    const [verificationStatus, setVerificationStatus] = useState('');
    const [loading, setLoading] = useState(true);
    const navigate = useNavigate();

    const fetchDashboard = async () => {
        try {
            const { data } = await api.get('/agency/dashboard');
            setStats({
                active_jobs: data.active_jobs ?? 0,
                total_jobs: data.total_jobs ?? 0,
                sent_referrals: data.sent_referrals ?? 0,
                received_referrals: data.received_referrals ?? 0,
                pending_referrals: data.pending_referrals ?? 0,
                placements: data.placements ?? 0,
                total_earnings: data.total_earnings ?? 0,
            });
            setLicenseVerified(!!data.license_verified);
            setPermitNumber(data.permit_number || '');
            setLicenseDocSubmitted(!!data.license_document_path);
            setVerificationStatus(data.verification_status || '');
            setFetchError('');
        } catch (err) {
            setFetchError(err.response?.data?.message || 'ダッシュボードの読み込みに失敗しました');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchDashboard(); }, []);

    if (loading) return <div className="page container"><div className="skeleton" style={{ height: 400 }} /></div>;

    if (fetchError) return (
        <div className="page container animate-fade-in">
            <h1 style={{ fontSize: 'var(--font-size-2xl)', marginBottom: 'var(--space-xl)' }}>管理画面（人材紹介）</h1>
            <div className="card" style={{ textAlign: 'center', padding: 'var(--space-3xl)', color: '#dc2626' }}>
                <p style={{ marginBottom: 'var(--space-md)' }}>{fetchError}</p>
                <button className="btn btn-primary" onClick={() => { setLoading(true); setFetchError(''); fetchDashboard(); }}>
                    再読み込み
                </button>
            </div>
        </div>
    );

    // 許可証未提出の場合は提出画面を優先表示（審査完了前に必須）
    if (!licenseDocSubmitted && !licenseVerified) {
        return (
            <div className="page container animate-fade-in">
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-md)', marginBottom: 'var(--space-xl)' }}>
                    <h1 style={{ fontSize: 'var(--font-size-2xl)', margin: 0 }}>管理画面（人材紹介）</h1>
                </div>
                <div className="card" style={{
                    maxWidth: 620,
                    borderLeft: '4px solid #f59e0b',
                    marginBottom: 'var(--space-xl)',
                }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--space-md)' }}>
                        <span style={{ fontSize: '2rem', lineHeight: 1 }}>📋</span>
                        <div>
                            <h3 style={{ margin: '0 0 var(--space-xs)' }}>職業紹介事業許可証のご提出をお願いします</h3>
                            <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', margin: 0 }}>
                                企業審査を進めるには、厚生労働大臣発行の<strong>職業紹介事業許可証</strong>のアップロードが必要です。
                                提出後、運営が内容を確認します。
                            </p>
                        </div>
                    </div>
                </div>
                <LicenseTab
                    licenseVerified={false}
                    permitNumber={permitNumber}
                    licenseDocSubmitted={false}
                    verificationStatus={verificationStatus}
                    onLicenseSubmitted={fetchDashboard}
                />
            </div>
        );
    }

    const renderTab = () => {
        switch (activeTab) {
            case 'overview':
                return <OverviewTab stats={stats} licenseVerified={licenseVerified} licenseDocSubmitted={licenseDocSubmitted} verificationStatus={verificationStatus} onTabChange={setActiveTab} />;
            case 'analytics':
                return <AnalyticsTab />;
            case 'received':
                return <ReceivedReferralsTab />;
            case 'sent':
                return <SentReferralsTab />;
            case 'jobs':
                return <JobDatabaseTab />;
            case 'companies':
                return <CompaniesTab />;
            case 'license':
                return <LicenseTab licenseVerified={licenseVerified} permitNumber={permitNumber} licenseDocSubmitted={licenseDocSubmitted} verificationStatus={verificationStatus} onLicenseSubmitted={fetchDashboard} />;
            default:
                return null;
        }
    };

    return (
        <div className="page container animate-fade-in">
            {/* ヘッダー */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-md)', marginBottom: 'var(--space-xl)' }}>
                <h1 style={{ fontSize: 'var(--font-size-2xl)', margin: 0 }}>管理画面（人材紹介）</h1>
            </div>

            {/* タブナビゲーション */}
            <div style={{
                display: 'flex', gap: 'var(--space-xs)',
                borderBottom: '2px solid var(--color-border)',
                marginBottom: 'var(--space-xl)',
                overflowX: 'auto',
            }}>
                {TABS.map(tab => (
                    <button
                        key={tab.key}
                        onClick={() => setActiveTab(tab.key)}
                        style={{
                            padding: 'var(--space-sm) var(--space-lg)',
                            border: 'none',
                            background: 'none',
                            cursor: 'pointer',
                            fontSize: 'var(--font-size-sm)',
                            fontWeight: activeTab === tab.key ? 700 : 400,
                            color: activeTab === tab.key ? 'var(--color-primary, #121c34)' : 'var(--color-text-secondary)',
                            borderBottom: activeTab === tab.key ? '2px solid var(--color-primary, #121c34)' : '2px solid transparent',
                            marginBottom: '-2px',
                            whiteSpace: 'nowrap',
                            transition: 'color 0.15s, border-color 0.15s',
                        }}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* タブコンテンツ */}
            {renderTab()}
        </div>
    );
}
