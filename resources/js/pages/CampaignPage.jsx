import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { BarChart3, CreditCard } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import api from '../api';

const STATUS_LABELS = { active: '配信中', paused: '一時停止', ended: '終了' };
const STATUS_COLORS = {
    active: 'var(--color-success, #22c55e)',
    paused: 'var(--color-warning, #f59e0b)',
    ended: 'var(--color-text-muted)',
};
const ALLOCATION_LABELS = { even: '均等配分', weighted: 'パフォーマンス比' };

export default function CampaignPage() {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [campaigns, setCampaigns] = useState([]);
    const [companyJobs, setCompanyJobs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedCampaign, setSelectedCampaign] = useState(null);
    const [detailData, setDetailData] = useState(null);
    const [detailLoading, setDetailLoading] = useState(false);
    const [showForm, setShowForm] = useState(false);
    const [editId, setEditId] = useState(null);
    const [saving, setSaving] = useState(false);
    const [toast, setToast] = useState(null);
    const [confirmPayment, setConfirmPayment] = useState(null);
    const [form, setForm] = useState({
        name: '', daily_budget: 5000, budget_allocation: 'even',
        billing_period: 'daily',
        start_date: '', end_date: '', job_ids: [],
    });

    // キャンペーン一覧を取得
    const fetchCampaigns = useCallback(async () => {
        try {
            const res = await api.get('/campaigns');
            setCampaigns(res.data);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    }, []);

    // 自社求人の一覧を取得（キャンペーン追加用）
    const fetchJobs = useCallback(async () => {
        try {
            const res = await api.get('/my-jobs');
            setCompanyJobs(res.data.data || res.data || []);
        } catch (err) {
            console.error(err);
        }
    }, []);

    useEffect(() => { fetchCampaigns(); fetchJobs(); }, []);

    // キャンペーン詳細を取得
    useEffect(() => {
        if (!selectedCampaign) { setDetailData(null); return; }
        setDetailLoading(true);
        api.get(`/campaigns/${selectedCampaign}`)
            .then(res => setDetailData(res.data))
            .catch(console.error)
            .finally(() => setDetailLoading(false));
    }, [selectedCampaign]);

    const showToast = (message, type = 'success') => {
        setToast({ message, type });
        setTimeout(() => setToast(null), 3000);
    };

    // フォームリセット
    const resetForm = () => {
        setForm({ name: '', daily_budget: 5000, budget_allocation: 'even', billing_period: 'daily', start_date: '', end_date: '', job_ids: [] });
        setEditId(null);
        setShowForm(false);
    };

    // 作成 or 更新（作成時・再開時は決済確認ダイアログ）
    const handleSubmit = async (e) => {
        e.preventDefault();

        const budget = Number(form.daily_budget) || 0;
        const jobCount = form.job_ids.length || 1;
        const periodLabel = form.billing_period === 'monthly' ? '月額' : '日額';
        const perJobLabel = form.billing_period === 'monthly'
            ? `1件あたり ¥${fmt(Math.round(budget / jobCount))}/月 (日額換算 ¥${fmt(Math.round(budget / jobCount / 30))})`
            : `1件あたり ¥${fmt(Math.round(budget / jobCount))}/日`;

        if (!editId) {
            // 新規作成: 決済確認
            const confirmed = await new Promise(resolve => {
                setConfirmPayment({
                    title: 'キャンペーン開始・決済確認',
                    lines: [
                        `${periodLabel}予算: ¥${fmt(budget)}`,
                        `対象求人: ${form.job_ids.length}件`,
                        form.job_ids.length > 0 ? perJobLabel : null,
                        `今すぐ ¥${fmt(budget)} を決済してキャンペーンを開始します。`,
                    ].filter(Boolean),
                    confirmText: `¥${fmt(budget)} を決済して開始`,
                    onConfirm: () => { setConfirmPayment(null); resolve(true); },
                    onCancel: () => { setConfirmPayment(null); resolve(false); },
                });
            });
            if (!confirmed) return;
        }

        setSaving(true);
        try {
            if (editId) {
                await api.put(`/campaigns/${editId}`, form);
                showToast('キャンペーンを更新しました');
            } else {
                await api.post('/campaigns', form);
                showToast('キャンペーンを作成・決済しました');
            }
            resetForm();
            fetchCampaigns();
            if (selectedCampaign) {
                const res = await api.get(`/campaigns/${selectedCampaign}`);
                setDetailData(res.data);
            }
        } catch (err) {
            showToast(err.response?.data?.message || 'エラーが発生しました', 'error');
        } finally {
            setSaving(false);
        }
    };

    // 編集モードに入る
    const startEdit = (campaign) => {
        setForm({
            name: campaign.name,
            daily_budget: campaign.daily_budget,
            budget_allocation: campaign.budget_allocation,
            billing_period: campaign.billing_period || 'daily',
            start_date: campaign.start_date || '',
            end_date: campaign.end_date || '',
            job_ids: [],
        });
        setEditId(campaign.id);
        setShowForm(true);
    };

    // ステータス変更
    const handleStatusChange = async (campaignId, newStatus) => {
        try {
            await api.put(`/campaigns/${campaignId}`, { status: newStatus });
            showToast(`キャンペーンを${STATUS_LABELS[newStatus]}に変更しました`);
            fetchCampaigns();
            if (selectedCampaign === campaignId) {
                const res = await api.get(`/campaigns/${campaignId}`);
                setDetailData(res.data);
            }
        } catch (err) {
            showToast(err.response?.data?.message || 'エラーが発生しました', 'error');
        }
    };

    // キャンペーン削除
    const handleDelete = async (campaignId) => {
        if (!confirm('このキャンペーンを削除しますか？求人は保持されますが、キャンペーンとの紐付けが解除されます。')) return;
        try {
            await api.delete(`/campaigns/${campaignId}`);
            showToast('キャンペーンを削除しました');
            if (selectedCampaign === campaignId) {
                setSelectedCampaign(null);
                setDetailData(null);
            }
            fetchCampaigns();
        } catch (err) {
            showToast(err.response?.data?.message || 'エラーが発生しました', 'error');
        }
    };

    // 求人をキャンペーンに追加
    const [addJobIds, setAddJobIds] = useState([]);
    const handleAddJobs = async () => {
        if (!selectedCampaign || addJobIds.length === 0) return;
        try {
            await api.post(`/campaigns/${selectedCampaign}/jobs`, { job_ids: addJobIds });
            showToast(`${addJobIds.length}件の求人を追加しました`);
            setAddJobIds([]);
            fetchCampaigns();
            const res = await api.get(`/campaigns/${selectedCampaign}`);
            setDetailData(res.data);
        } catch (err) {
            showToast(err.response?.data?.message || 'エラーが発生しました', 'error');
        }
    };

    // 求人をキャンペーンから除外
    const handleRemoveJob = async (jobId) => {
        if (!selectedCampaign) return;
        try {
            await api.delete(`/campaigns/${selectedCampaign}/jobs`, { data: { job_ids: [jobId] } });
            showToast('求人をキャンペーンから除外しました');
            fetchCampaigns();
            const res = await api.get(`/campaigns/${selectedCampaign}`);
            setDetailData(res.data);
        } catch (err) {
            showToast(err.response?.data?.message || 'エラーが発生しました', 'error');
        }
    };

    // 予算再配分
    const handleRedistribute = async () => {
        if (!selectedCampaign) return;
        try {
            await api.post(`/campaigns/${selectedCampaign}/redistribute`);
            showToast('予算を再配分しました');
            const res = await api.get(`/campaigns/${selectedCampaign}`);
            setDetailData(res.data);
        } catch (err) {
            showToast(err.response?.data?.message || 'エラーが発生しました', 'error');
        }
    };

    // キャンペーンに未所属の自社求人
    const unassignedJobs = companyJobs.filter(j =>
        !j.campaign_id || (detailData && j.campaign_id !== detailData.id)
    );

    const fmt = (n) => Number(n || 0).toLocaleString();

    return (
        <>
        <div className="page" style={{ padding: 'var(--space-xl) 0' }}>
            <div className="container" style={{ maxWidth: 1100 }}>
                {/* ヘッダー */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-lg)' }}>
                    <div>
                        <h1 style={{ fontSize: 'var(--font-size-2xl)', margin: 0, color: 'var(--color-navy)' }}>
                            キャンペーン管理
                        </h1>
                        <p style={{ color: 'var(--color-text-secondary)', margin: 'var(--space-xs) 0 0', fontSize: 'var(--font-size-sm)' }}>
                            複数の求人をグループ化し、日額予算をまとめて管理できます
                        </p>
                    </div>
                    <button onClick={() => { resetForm(); setShowForm(true); }} style={btnPrimary}>
                        + 新規キャンペーン
                    </button>
                </div>

                {/* トースト */}
                {toast && (
                    <div style={{
                        position: 'fixed', top: 20, right: 20, zIndex: 9999,
                        padding: 'var(--space-md) var(--space-lg)',
                        borderRadius: 'var(--radius-md)',
                        background: toast.type === 'error' ? 'var(--color-error, #ef4444)' : 'var(--color-success, #22c55e)',
                        color: '#fff', fontWeight: 600, fontSize: 'var(--font-size-sm)',
                        boxShadow: 'var(--shadow-lg)',
                    }}>
                        {toast.message}
                    </div>
                )}

                {/* 作成・編集フォーム */}
                {showForm && (
                    <div style={{
                        background: 'var(--color-bg-surface)', border: '1px solid var(--color-border)',
                        borderRadius: 'var(--radius-lg)', padding: 'var(--space-xl)', marginBottom: 'var(--space-xl)',
                    }}>
                        <h2 style={{ fontSize: 'var(--font-size-lg)', marginTop: 0, color: 'var(--color-text)' }}>
                            {editId ? 'キャンペーンを編集' : '新規キャンペーン作成'}
                        </h2>
                        <form onSubmit={handleSubmit}>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-md)' }}>
                                <div style={{ gridColumn: '1/-1' }}>
                                    <label style={labelStyle}>キャンペーン名 *</label>
                                    <input type="text" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
                                        placeholder="例: エンジニア採用強化" required style={inputStyle} />
                                </div>
                                <div style={{ gridColumn: '1/-1' }}>
                                    <label style={labelStyle}>課金サイクル</label>
                                    <div style={{ display: 'flex', gap: 'var(--space-xs)' }}>
                                        {[{ value: 'daily', label: '日額', desc: '設定金額を毎日請求' }, { value: 'monthly', label: '月額', desc: '設定金額を毎月請求（日割り配分）' }].map(opt => (
                                            <button key={opt.value} type="button"
                                                onClick={() => setForm(f => ({ ...f, billing_period: opt.value }))}
                                                style={{
                                                    flex: 1, padding: 'var(--space-sm) var(--space-md)',
                                                    borderRadius: 'var(--radius-md)', cursor: 'pointer',
                                                    border: form.billing_period === opt.value ? '1.5px solid var(--color-navy)' : '1px solid var(--color-border)',
                                                    background: form.billing_period === opt.value ? 'rgba(18,28,52,0.05)' : 'var(--color-bg)',
                                                    color: form.billing_period === opt.value ? 'var(--color-navy)' : 'var(--color-text-secondary)',
                                                    fontWeight: form.billing_period === opt.value ? 700 : 400,
                                                    textAlign: 'left',
                                                }}>
                                                <div style={{ fontWeight: 600, marginBottom: 2 }}>{opt.label}</div>
                                                <div style={{ fontSize: 'var(--font-size-xs)', opacity: 0.8 }}>{opt.desc}</div>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                                <div>
                                    <label style={labelStyle}>{form.billing_period === 'monthly' ? '月額予算（キャンペーン全体）' : '日額予算（キャンペーン全体）'}</label>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)' }}>
                                        <span style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-sm)' }}>¥</span>
                                        <input type="range" min={500} max={100000} step={500}
                                            value={form.daily_budget} onChange={e => setForm({ ...form, daily_budget: Number(e.target.value) })}
                                            style={{ flex: 1 }} />
                                        <input type="number" value={form.daily_budget}
                                            onChange={e => setForm({ ...form, daily_budget: Math.max(500, Number(e.target.value)) })}
                                            style={{ ...inputStyle, width: 120, textAlign: 'right' }} />
                                    </div>
                                    {form.billing_period === 'monthly' ? (
                                        <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', margin: 'var(--space-xs) 0 0' }}>
                                            日額換算: ¥{fmt(Math.round(form.daily_budget / 30))}/日
                                        </p>
                                    ) : (
                                        <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', margin: 'var(--space-xs) 0 0' }}>
                                            月額見積もり: ¥{fmt(form.daily_budget * 30)}
                                        </p>
                                    )}
                                </div>
                                <div>
                                    <label style={labelStyle}>配分方法</label>
                                    <select value={form.budget_allocation}
                                        onChange={e => setForm({ ...form, budget_allocation: e.target.value })} style={inputStyle}>
                                        <option value="even">均等配分 — 全求人に同じ日額</option>
                                        <option value="weighted">パフォーマンス比 — 閲覧数に応じて配分</option>
                                    </select>
                                </div>
                                <div>
                                    <label style={labelStyle}>開始日</label>
                                    <input type="date" value={form.start_date}
                                        onChange={e => setForm({ ...form, start_date: e.target.value })} style={inputStyle} />
                                </div>
                                <div>
                                    <label style={labelStyle}>終了日</label>
                                    <input type="date" value={form.end_date}
                                        onChange={e => setForm({ ...form, end_date: e.target.value })} style={inputStyle} />
                                </div>
                                {/* 新規作成時のみ求人選択 */}
                                {!editId && (
                                    <div style={{ gridColumn: '1/-1' }}>
                                        <label style={labelStyle}>求人を追加（任意 — 後から追加可）</label>
                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-xs)', maxHeight: 200, overflowY: 'auto', padding: 'var(--space-sm)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', background: 'var(--color-bg)' }}>
                                            {companyJobs.filter(j => !j.campaign_id && j.status === 'active').length === 0 && (
                                                <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--font-size-sm)', margin: 0 }}>
                                                    キャンペーン未所属のアクティブ求人がありません
                                                </p>
                                            )}
                                            {companyJobs.filter(j => !j.campaign_id).map(job => (
                                                <label key={job.id} style={{
                                                    display: 'flex', alignItems: 'center', gap: 6,
                                                    padding: '6px 12px', borderRadius: 'var(--radius-sm)',
                                                    background: form.job_ids.includes(job.id) ? 'var(--color-accent)' : 'var(--color-bg-surface)',
                                                    color: form.job_ids.includes(job.id) ? '#fff' : 'var(--color-text)',
                                                    border: '1px solid var(--color-border)', cursor: 'pointer',
                                                    fontSize: 'var(--font-size-sm)', transition: 'all 0.15s',
                                                }}>
                                                    <input type="checkbox" checked={form.job_ids.includes(job.id)}
                                                        onChange={() => {
                                                            setForm(f => ({
                                                                ...f,
                                                                job_ids: f.job_ids.includes(job.id)
                                                                    ? f.job_ids.filter(id => id !== job.id)
                                                                    : [...f.job_ids, job.id],
                                                            }));
                                                        }}
                                                        style={{ display: 'none' }}
                                                    />
                                                    {job.title}
                                                    <span style={{ opacity: 0.6, fontSize: 'var(--font-size-xs)' }}>
                                                        ({job.status === 'active' ? '掲載中' : job.status})
                                                    </span>
                                                </label>
                                            ))}
                                        </div>
                                        {form.job_ids.length > 0 && (
                                            <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-accent)', margin: 'var(--space-xs) 0 0', fontWeight: 600, padding: '8px 12px', background: 'var(--color-accent)10', borderRadius: 'var(--radius-sm)' }}>
                                                {form.job_ids.length}件選択 × {form.billing_period === 'monthly'
                                                    ? `¥${fmt(Math.round(form.daily_budget / form.job_ids.length))}/月 (日額換算 ¥${fmt(Math.round(form.daily_budget / form.job_ids.length / 30))})`
                                                    : `¥${fmt(Math.round(form.daily_budget / form.job_ids.length))}/日`
                                                } = 合計 ¥{fmt(form.daily_budget)}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                            <div style={{ display: 'flex', gap: 'var(--space-sm)', marginTop: 'var(--space-lg)', justifyContent: 'flex-end' }}>
                                <button type="button" onClick={resetForm} style={btnSecondary}>キャンセル</button>
                                <button type="submit" disabled={saving} style={btnPrimary}>
                                    {saving ? '保存中...' : editId ? '更新する' : '作成する'}
                                </button>
                            </div>
                        </form>
                    </div>
                )}

                {/* メインコンテンツ */}
                <div style={{ display: 'grid', gridTemplateColumns: '380px 1fr', gap: 'var(--space-lg)', alignItems: 'start' }}>
                    {/* キャンペーン一覧 */}
                    <div>
                        {loading ? (
                            <div style={{ textAlign: 'center', padding: 'var(--space-xl)', color: 'var(--color-text-muted)' }}>読込中...</div>
                        ) : campaigns.length === 0 ? (
                            <div style={{
                                textAlign: 'center', padding: 'var(--space-2xl)',
                                background: 'var(--color-bg-surface)', borderRadius: 'var(--radius-lg)',
                                border: '1px solid var(--color-border)',
                            }}>
                                <div style={{ marginBottom: 'var(--space-md)', display: 'flex', justifyContent: 'center' }}>
                                    <BarChart3 size={40} strokeWidth={1.5} color="var(--color-text-accent)" style={{ opacity: 0.7 }} />
                                </div>
                                <h3 style={{ color: 'var(--color-navy)', margin: '0 0 var(--space-sm)' }}>キャンペーンを作成しましょう</h3>
                                <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-sm)', margin: 0 }}>
                                    複数の求人をまとめて日額予算を管理できます。<br />
                                    パフォーマンスに応じた自動配分も可能です。
                                </p>
                            </div>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
                                {campaigns.map(c => (
                                    <div key={c.id} onClick={() => setSelectedCampaign(c.id)} style={{
                                        background: 'var(--color-bg-surface)',
                                        border: selectedCampaign === c.id ? '1.5px solid var(--color-navy)' : '1px solid var(--color-border)',
                                        borderRadius: 'var(--radius-lg)', padding: 'var(--space-md)',
                                        cursor: 'pointer', transition: 'all 0.15s',
                                    }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-xs)' }}>
                                            <h3 style={{ margin: 0, fontSize: 'var(--font-size-md)', color: 'var(--color-text)' }}>{c.name}</h3>
                                            <span style={{
                                                fontSize: 'var(--font-size-xs)', fontWeight: 600,
                                                padding: '2px 8px', borderRadius: 'var(--radius-full)',
                                                background: `${STATUS_COLORS[c.status]}20`, color: STATUS_COLORS[c.status],
                                            }}>
                                                {STATUS_LABELS[c.status]}
                                            </span>
                                        </div>
                                        <div style={{ display: 'flex', gap: 'var(--space-lg)', fontSize: 'var(--font-size-sm)', flexWrap: 'wrap' }}>
                                            <div>
                                                <span style={{ color: 'var(--color-text-muted)' }}>{c.billing_period === 'monthly' ? '月額' : '日額'}</span>
                                                <span style={{ color: 'var(--color-accent)', fontWeight: 700, marginLeft: 4 }}>¥{fmt(c.daily_budget)}</span>
                                            </div>
                                            <div>
                                                <span style={{ color: 'var(--color-text-muted)' }}>求人</span>
                                                <span style={{ color: 'var(--color-text)', fontWeight: 600, marginLeft: 4 }}>{c.active_jobs_count}/{c.jobs_count}件</span>
                                            </div>
                                            <div>
                                                <span style={{ color: 'var(--color-text-muted)' }}>配分</span>
                                                <span style={{ color: 'var(--color-text-secondary)', marginLeft: 4, fontSize: 'var(--font-size-xs)' }}>
                                                    {ALLOCATION_LABELS[c.budget_allocation]}
                                                </span>
                                            </div>
                                        </div>
                                        {c.billing_period === 'monthly' && c.next_billing_date && (
                                            <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', margin: 'var(--space-xs) 0 0' }}>
                                                次回請求: {c.next_billing_date}
                                            </p>
                                        )}
                                        {c.end_date && (
                                            <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', margin: 'var(--space-xs) 0 0' }}>
                                                終了日: {c.end_date}
                                            </p>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* 詳細パネル */}
                    <div>
                        {!selectedCampaign ? (
                            <div style={{
                                textAlign: 'center', padding: 'var(--space-2xl)',
                                background: 'var(--color-bg-surface)', borderRadius: 'var(--radius-lg)',
                                border: '1px solid var(--color-border)', color: 'var(--color-text-muted)',
                            }}>
                                左のキャンペーンを選択すると詳細が表示されます
                            </div>
                        ) : detailLoading ? (
                            <div style={{ textAlign: 'center', padding: 'var(--space-2xl)', color: 'var(--color-text-muted)' }}>読込中...</div>
                        ) : detailData && (
                            <div style={{
                                background: 'var(--color-bg-surface)', borderRadius: 'var(--radius-lg)',
                                border: '1px solid var(--color-border)', overflow: 'hidden',
                            }}>
                                {/* 詳細ヘッダー */}
                                <div style={{ padding: 'var(--space-lg)', borderBottom: '1px solid var(--color-border)' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                        <div>
                                            <h2 style={{ margin: 0, fontSize: 'var(--font-size-xl)', color: 'var(--color-text)' }}>{detailData.name}</h2>
                                            <p style={{ color: 'var(--color-text-secondary)', margin: 'var(--space-xs) 0 0', fontSize: 'var(--font-size-sm)' }}>
                                                {ALLOCATION_LABELS[detailData.budget_allocation]}
                                                {' | '}{detailData.billing_period === 'monthly' ? '月額プラン' : '日額プラン'}
                                                {detailData.start_date && ` | ${detailData.start_date}`}
                                                {detailData.end_date && ` 〜 ${detailData.end_date}`}
                                            </p>
                                            {detailData.billing_period === 'monthly' && detailData.next_billing_date && (
                                                <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', margin: 'var(--space-xs) 0 0' }}>
                                                    次回請求日: {detailData.next_billing_date}
                                                </p>
                                            )}
                                        </div>
                                        <div style={{ display: 'flex', gap: 'var(--space-xs)' }}>
                                            <button onClick={() => startEdit(detailData)} style={btnSmall}>編集</button>
                                            {detailData.status === 'active' && (
                                                <button onClick={() => handleStatusChange(detailData.id, 'paused')} style={{ ...btnSmall, background: 'var(--color-warning, #f59e0b)' }}>
                                                    一時停止
                                                </button>
                                            )}
                                            {detailData.status === 'paused' && (
                                                <button onClick={() => handleStatusChange(detailData.id, 'active')} style={{ ...btnSmall, background: 'var(--color-success, #22c55e)' }}>
                                                    再開
                                                </button>
                                            )}
                                            <button onClick={() => handleDelete(detailData.id)} style={{ ...btnSmall, background: 'var(--color-error, #ef4444)' }}>削除</button>
                                        </div>
                                    </div>

                                    {/* 予算サマリー */}
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--space-md)', marginTop: 'var(--space-lg)' }}>
                                        <StatCard label="キャンペーン日額" value={`¥${fmt(detailData.daily_budget)}`} accent />
                                        <StatCard label="実際の配分合計" value={`¥${fmt(detailData.actual_daily_spend)}`} />
                                        <StatCard label="月額見積もり" value={`¥${fmt(detailData.monthly_estimate)}`} />
                                    </div>
                                </div>

                                {/* 所属求人一覧 */}
                                <div style={{ padding: 'var(--space-lg)' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-md)' }}>
                                        <h3 style={{ margin: 0, fontSize: 'var(--font-size-md)', color: 'var(--color-text)' }}>
                                            所属求人（{detailData.jobs?.length || 0}件）
                                        </h3>
                                        {detailData.status === 'active' && (
                                            <button onClick={handleRedistribute} style={btnSmall}>予算を再配分</button>
                                        )}
                                    </div>

                                    {detailData.jobs?.length > 0 ? (
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
                                            {detailData.jobs.map(job => (
                                                <div key={job.id} style={{
                                                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                                    padding: 'var(--space-md)', border: '1px solid var(--color-border)',
                                                    borderRadius: 'var(--radius-md)', background: 'var(--color-bg)',
                                                }}>
                                                    <div style={{ flex: 1, minWidth: 0 }}>
                                                        <div style={{ fontWeight: 600, color: 'var(--color-text)', fontSize: 'var(--font-size-sm)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                            {job.title}
                                                        </div>
                                                        <div style={{ display: 'flex', gap: 'var(--space-md)', marginTop: 4, fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
                                                            <span>日額: ¥{fmt(job.daily_budget)}</span>
                                                            <span>閲覧(7日): {job.recent_views_count || 0}</span>
                                                            <span>応募: {job.applications_count || 0}</span>
                                                            <span style={{
                                                                color: job.status === 'active' ? 'var(--color-success, #22c55e)' : 'var(--color-text-muted)',
                                                            }}>
                                                                {job.status === 'active' ? '掲載中' : job.status}
                                                            </span>
                                                        </div>
                                                    </div>
                                                    <button onClick={() => handleRemoveJob(job.id)} style={{
                                                        ...btnSmall, background: 'transparent', color: 'var(--color-error, #ef4444)',
                                                        border: '1px solid var(--color-error, #ef4444)', marginLeft: 'var(--space-sm)',
                                                    }}>
                                                        除外
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--font-size-sm)' }}>求人がまだ追加されていません</p>
                                    )}

                                    {/* 求人追加セクション */}
                                    {detailData.status !== 'ended' && (
                                        <div style={{ marginTop: 'var(--space-lg)', paddingTop: 'var(--space-lg)', borderTop: '1px solid var(--color-border)' }}>
                                            <h4 style={{ margin: '0 0 var(--space-sm)', fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>
                                                求人を追加
                                            </h4>
                                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-xs)', marginBottom: 'var(--space-sm)' }}>
                                                {companyJobs.filter(j => j.campaign_id !== detailData.id).map(job => (
                                                    <label key={job.id} style={{
                                                        display: 'flex', alignItems: 'center', gap: 4,
                                                        padding: '4px 10px', borderRadius: 'var(--radius-sm)',
                                                        background: addJobIds.includes(job.id) ? 'var(--color-accent)' : 'var(--color-bg)',
                                                        color: addJobIds.includes(job.id) ? '#fff' : 'var(--color-text)',
                                                        border: '1px solid var(--color-border)', cursor: 'pointer',
                                                        fontSize: 'var(--font-size-xs)', transition: 'all 0.15s',
                                                    }}>
                                                        <input type="checkbox" checked={addJobIds.includes(job.id)}
                                                            onChange={() => setAddJobIds(ids => ids.includes(job.id) ? ids.filter(id => id !== job.id) : [...ids, job.id])}
                                                            style={{ display: 'none' }} />
                                                        {job.title}
                                                    </label>
                                                ))}
                                                {companyJobs.filter(j => j.campaign_id !== detailData.id).length === 0 && (
                                                    <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--font-size-xs)', margin: 0 }}>
                                                        追加可能な求人がありません
                                                    </p>
                                                )}
                                            </div>
                                            {addJobIds.length > 0 && (
                                                <button onClick={handleAddJobs} style={btnPrimary}>
                                                    {addJobIds.length}件を追加
                                                </button>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>

        {/* 決済確認ダイアログ */}
        {confirmPayment && (
            <div style={{
                position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000,
            }}>
                <div style={{
                    background: 'var(--color-bg-surface)', borderRadius: 'var(--radius-lg)',
                    padding: 'var(--space-xl)', maxWidth: 440, width: '90%',
                    boxShadow: 'var(--shadow-xl)',
                }}>
                    <h3 style={{ margin: '0 0 var(--space-md)', color: 'var(--color-navy)', fontSize: 'var(--font-size-lg)', display: 'flex', alignItems: 'center', gap: 8 }}>
                        <CreditCard size={18} strokeWidth={2} color="var(--color-text-accent)" />
                        {confirmPayment.title}
                    </h3>
                    <div style={{
                        background: 'var(--color-bg)', borderRadius: 'var(--radius-md)',
                        padding: 'var(--space-md)', marginBottom: 'var(--space-lg)',
                    }}>
                        {confirmPayment.lines.map((line, i) => (
                            <p key={i} style={{
                                margin: i === 0 ? 0 : 'var(--space-xs) 0 0',
                                fontSize: i === confirmPayment.lines.length - 1 ? 'var(--font-size-md)' : 'var(--font-size-sm)',
                                fontWeight: i === confirmPayment.lines.length - 1 ? 700 : 400,
                                color: i === confirmPayment.lines.length - 1 ? 'var(--color-accent)' : 'var(--color-text-secondary)',
                            }}>{line}</p>
                        ))}
                    </div>
                    <div style={{ display: 'flex', gap: 'var(--space-sm)', justifyContent: 'flex-end' }}>
                        <button onClick={confirmPayment.onCancel} style={btnSecondary}>キャンセル</button>
                        <button onClick={confirmPayment.onConfirm} style={{ ...btnPrimary, background: 'var(--color-accent)' }}>
                            {confirmPayment.confirmText}
                        </button>
                    </div>
                </div>
            </div>
        )}
        </>
    );
}

function StatCard({ label, value, accent }) {
    return (
        <div style={{
            padding: 'var(--space-md)', borderRadius: 'var(--radius-md)',
            background: accent ? 'var(--color-accent)' : 'var(--color-bg)',
            border: accent ? 'none' : '1px solid var(--color-border)',
            textAlign: 'center',
        }}>
            <div style={{ fontSize: 'var(--font-size-xs)', color: accent ? 'rgba(255,255,255,0.8)' : 'var(--color-text-muted)', marginBottom: 4 }}>
                {label}
            </div>
            <div style={{ fontSize: 'var(--font-size-lg)', fontWeight: 700, color: accent ? '#fff' : 'var(--color-text)' }}>
                {value}
            </div>
        </div>
    );
}

// スタイル定数
const inputStyle = {
    width: '100%', padding: '10px 12px', borderRadius: 'var(--radius-md)',
    border: '1px solid var(--color-border)', background: 'var(--color-bg)',
    color: 'var(--color-text)', fontSize: 'var(--font-size-sm)',
    boxSizing: 'border-box',
};
const labelStyle = {
    display: 'block', fontSize: 'var(--font-size-sm)', fontWeight: 600,
    color: 'var(--color-text-secondary)', marginBottom: 'var(--space-xs)',
};
const btnPrimary = {
    padding: '10px 20px', background: 'var(--color-accent)', color: '#fff',
    border: 'none', borderRadius: 'var(--radius-md)', fontWeight: 600,
    cursor: 'pointer', fontSize: 'var(--font-size-sm)',
};
const btnSecondary = {
    padding: '10px 20px', background: 'transparent', color: 'var(--color-text)',
    border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)',
    fontWeight: 500, cursor: 'pointer', fontSize: 'var(--font-size-sm)',
};
const btnSmall = {
    padding: '6px 12px', background: 'var(--color-accent)', color: '#fff',
    border: 'none', borderRadius: 'var(--radius-sm)', fontWeight: 600,
    cursor: 'pointer', fontSize: 'var(--font-size-xs)',
};
