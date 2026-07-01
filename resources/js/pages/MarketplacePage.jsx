import React, { useState, useEffect, useCallback } from 'react';
import { Store, Handshake, TrendingUp, CheckCircle2, XCircle, Building2, BadgeCheck } from 'lucide-react';
import api from '../api';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../hooks/useToast';

const yen = n => '¥' + Number(n || 0).toLocaleString();
const FEE_CAP = 100000;

export default function MarketplacePage() {
    const { user } = useAuth();
    const toast = useToast();
    const [companyType, setCompanyType] = useState(user?.company?.company_type ?? null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        api.get('/company').then(res => {
            const c = res.data.company || res.data;
            setCompanyType(c?.company_type ?? null);
        }).catch(() => {}).finally(() => setLoading(false));
    }, []);

    if (loading) {
        return <div className="container" style={{ padding: '40px 0', textAlign: 'center', opacity: 0.6 }}>読み込み中…</div>;
    }

    return (
        <div className="container" style={{ padding: '24px 0 60px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                <Store size={24} style={{ color: 'var(--color-accent, #c8952e)' }} />
                <h1 style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 700, color: 'var(--color-navy, #121c34)', margin: 0 }}>
                    運用代行マーケットプレイス
                </h1>
            </div>
            <p style={{ color: 'var(--color-text-secondary, #6b7280)', fontSize: 'var(--font-size-sm)', marginBottom: 24 }}>
                {companyType === 'recruitment_agency'
                    ? '運用代行サービスを掲載し、求人企業の運用を受託できます。求人課金の25%がレベニューシェアとして還元されます。'
                    : '採用の運用を代理店に任せられます。求人課金はAtallyへ、管理料は代理店へ（分離型）。'}
            </p>

            {companyType === 'recruitment_agency'
                ? <AgencyView toast={toast} />
                : <ClientView toast={toast} />}
        </div>
    );
}

/* ========================= 求人企業（求人主）ビュー ========================= */
function ClientView({ toast }) {
    const [agencies, setAgencies] = useState([]);
    const [engagement, setEngagement] = useState(null);
    const [note, setNote] = useState('');
    const [busyId, setBusyId] = useState(null);

    const load = useCallback(() => {
        api.get('/marketplace/agencies').then(res => setAgencies(res.data || [])).catch(() => {});
        api.get('/marketplace/my-engagement').then(res => setEngagement(res.data.engagement || null)).catch(() => {});
    }, []);
    useEffect(load, [load]);

    const request = (agency) => {
        setBusyId(agency.id);
        api.post('/marketplace/engagements', { agency_id: agency.id, note })
            .then(() => { toast.success('運用を依頼しました。代理店の承認をお待ちください。'); setNote(''); load(); })
            .catch(err => toast.error(err.response?.data?.message || '依頼に失敗しました'))
            .finally(() => setBusyId(null));
    };

    const end = () => {
        if (!engagement) return;
        if (!confirm('この代理店との運用契約を解除しますか？')) return;
        api.post(`/marketplace/engagements/${engagement.id}/end`)
            .then(() => { toast.success('契約を解除しました'); load(); })
            .catch(() => toast.error('解除に失敗しました'));
    };

    return (
        <>
            {engagement && (
                <div style={{
                    marginBottom: 24, padding: '16px 18px', borderRadius: 12,
                    border: '1px solid var(--color-navy, #121c34)', background: '#f7f9fc',
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700, color: 'var(--color-navy, #121c34)', marginBottom: 6 }}>
                        <Handshake size={18} />
                        {engagement.status === 'active' ? '運用中の代理店' : '依頼中（承認待ち）'}
                    </div>
                    <div style={{ fontSize: 'var(--font-size-sm)' }}>
                        <strong>{engagement.agency?.company_name}</strong>
                        {engagement.status === 'active' && engagement.monthly_fee != null &&
                            <span style={{ marginLeft: 8 }}>管理料 {yen(engagement.monthly_fee)}/月</span>}
                        {engagement.status === 'requested' &&
                            <span style={{ marginLeft: 8, color: 'var(--color-accent, #c8952e)' }}>承認待ち</span>}
                    </div>
                    <button className="btn btn-secondary" style={{ marginTop: 10 }} onClick={end}>契約を解除</button>
                </div>
            )}

            {!engagement && (
                <div className="form-group" style={{ maxWidth: 520, marginBottom: 20 }}>
                    <label className="form-label">依頼メモ（任意・依頼時に代理店へ共有）</label>
                    <textarea className="form-textarea" rows={2} value={note} onChange={e => setNote(e.target.value)}
                        placeholder="例: 介護職の採用を強化したい。応募対応まで任せたい。" />
                </div>
            )}

            <div className="grid grid-2" style={{ gap: 16 }}>
                {agencies.map(a => (
                    <div key={a.id} className="card" style={{ padding: 18, border: '1px solid var(--color-border, #e5e7eb)', borderRadius: 12 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                            <Building2 size={18} style={{ color: 'var(--color-navy, #121c34)' }} />
                            <strong style={{ fontSize: 'var(--font-size-lg)' }}>{a.company_name}</strong>
                            {a.license_verified && <BadgeCheck size={16} style={{ color: 'var(--color-accent, #c8952e)' }} title="許可番号確認済み" />}
                        </div>
                        {a.service_specialties && (
                            <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary, #6b7280)', marginBottom: 6 }}>
                                得意領域: {a.service_specialties}
                            </div>
                        )}
                        {a.service_description && (
                            <p style={{ fontSize: 'var(--font-size-sm)', lineHeight: 1.6, marginBottom: 10, whiteSpace: 'pre-wrap' }}>{a.service_description}</p>
                        )}
                        <div style={{ fontSize: 'var(--font-size-sm)', marginBottom: 12 }}>
                            管理料の目安: <strong>{a.service_fee != null ? `${yen(a.service_fee)}/月〜` : '要相談'}</strong>
                        </div>
                        <button className="btn btn-primary" disabled={!!engagement || busyId === a.id}
                            onClick={() => request(a)}>
                            {busyId === a.id ? '送信中…' : engagement ? '依頼済み' : 'この代理店に依頼'}
                        </button>
                    </div>
                ))}
                {agencies.length === 0 && (
                    <div style={{ opacity: 0.6, padding: 20 }}>現在掲載中の代理店はありません。</div>
                )}
            </div>
        </>
    );
}

/* ========================= 代理店ビュー ========================= */
function AgencyView({ toast }) {
    const [profile, setProfile] = useState({ marketplace_listed: false, service_fee: '', service_description: '', service_specialties: '' });
    const [engagements, setEngagements] = useState([]);
    const [payouts, setPayouts] = useState(null);
    const [saving, setSaving] = useState(false);
    const [feeInputs, setFeeInputs] = useState({}); // engagementId -> monthly_fee

    const load = useCallback(() => {
        api.get('/company').then(res => {
            const c = res.data.company || res.data;
            setProfile({
                marketplace_listed: !!c.marketplace_listed,
                service_fee: c.service_fee ?? '',
                service_description: c.service_description ?? '',
                service_specialties: c.service_specialties ?? '',
            });
        }).catch(() => {});
        api.get('/marketplace/engagements').then(res => setEngagements(res.data.engagements || [])).catch(() => {});
        api.get('/marketplace/payouts').then(res => setPayouts(res.data)).catch(() => {});
    }, []);
    useEffect(load, [load]);

    const saveProfile = () => {
        setSaving(true);
        api.post('/marketplace/profile', {
            marketplace_listed: profile.marketplace_listed,
            service_fee: profile.service_fee === '' ? null : Number(profile.service_fee),
            service_description: profile.service_description || null,
            service_specialties: profile.service_specialties || null,
        }).then(() => toast.success('掲載プロフィールを保存しました'))
          .catch(err => toast.error(err.response?.data?.message || '保存に失敗しました'))
          .finally(() => setSaving(false));
    };

    const respond = (eng, action) => {
        const monthly_fee = action === 'accept' ? Number(feeInputs[eng.id] ?? profile.service_fee ?? 0) : undefined;
        api.post(`/marketplace/engagements/${eng.id}/respond`, { action, monthly_fee })
            .then(() => { toast.success(action === 'accept' ? '受託しました' : '辞退しました'); load(); })
            .catch(err => toast.error(err.response?.data?.message || '処理に失敗しました'));
    };

    const statusLabel = { requested: '依頼中', active: '運用中', declined: '辞退', ended: '終了' };

    return (
        <>
            {/* payout サマリー */}
            {payouts && (
                <div className="grid grid-3" style={{ gap: 14, marginBottom: 24 }}>
                    <StatCard label="今月のレベニューシェア" value={yen(payouts.this_month)} accent />
                    <StatCard label="累計レベニューシェア" value={yen(payouts.total)} />
                    <StatCard label="求人課金シェア率" value={`${Math.round((payouts.share_rate || 0.25) * 100)}%`} />
                </div>
            )}

            {/* 掲載プロフィール */}
            <div className="card" style={{ padding: 20, borderRadius: 12, border: '1px solid var(--color-border, #e5e7eb)', marginBottom: 24 }}>
                <h2 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 700, marginTop: 0, marginBottom: 14 }}>掲載プロフィール</h2>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14, cursor: 'pointer' }}>
                    <input type="checkbox" checked={profile.marketplace_listed}
                        onChange={e => setProfile(p => ({ ...p, marketplace_listed: e.target.checked }))} />
                    <span style={{ fontWeight: 600 }}>マーケットプレイスに掲載する</span>
                </label>
                <div className="grid grid-2" style={{ gap: 14 }}>
                    <div className="form-group">
                        <label className="form-label">管理料の目安（月額・円）</label>
                        <input className="form-input" type="number" value={profile.service_fee}
                            onChange={e => setProfile(p => ({ ...p, service_fee: e.target.value }))}
                            placeholder="例: 30000" max={FEE_CAP} />
                        <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary, #6b7280)', marginTop: 4 }}>
                            上限 {yen(FEE_CAP)}/月（法外な金額は掲載不可）
                        </div>
                    </div>
                    <div className="form-group">
                        <label className="form-label">得意領域（カンマ区切り）</label>
                        <input className="form-input" value={profile.service_specialties}
                            onChange={e => setProfile(p => ({ ...p, service_specialties: e.target.value }))}
                            placeholder="例: 介護, 製造, IT" />
                    </div>
                </div>
                <div className="form-group">
                    <label className="form-label">サービス紹介</label>
                    <textarea className="form-textarea" rows={3} value={profile.service_description}
                        onChange={e => setProfile(p => ({ ...p, service_description: e.target.value }))}
                        placeholder="求人票作成・応募対応・日程調整・スクリーニングまで一気通貫で代行します。" />
                </div>
                <button className="btn btn-primary" onClick={saveProfile} disabled={saving}>
                    {saving ? '保存中…' : '保存する'}
                </button>
            </div>

            {/* 依頼・契約 */}
            <div className="card" style={{ padding: 20, borderRadius: 12, border: '1px solid var(--color-border, #e5e7eb)' }}>
                <h2 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 700, marginTop: 0, marginBottom: 14 }}>運用依頼・契約</h2>
                {engagements.length === 0 && <div style={{ opacity: 0.6 }}>まだ依頼はありません。</div>}
                {engagements.map(eng => (
                    <div key={eng.id} style={{ padding: '14px 0', borderTop: '1px solid var(--color-border, #eee)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                            <strong>{eng.client_company?.company_name || '（企業）'}</strong>
                            <span style={{
                                fontSize: 'var(--font-size-xs)', padding: '2px 8px', borderRadius: 999,
                                background: eng.status === 'active' ? '#eaf6ee' : eng.status === 'requested' ? '#fbf3e0' : '#f1f1f1',
                                color: eng.status === 'active' ? '#1b7a3d' : eng.status === 'requested' ? '#b5801f' : '#666',
                            }}>{statusLabel[eng.status] || eng.status}</span>
                            {eng.client_company?.industry && <span style={{ fontSize: 'var(--font-size-xs)', opacity: 0.6 }}>{eng.client_company.industry}</span>}
                        </div>
                        {eng.note && <p style={{ fontSize: 'var(--font-size-sm)', margin: '6px 0', color: 'var(--color-text-secondary, #6b7280)' }}>{eng.note}</p>}
                        {eng.status === 'active' && eng.monthly_fee != null &&
                            <div style={{ fontSize: 'var(--font-size-sm)', marginTop: 4 }}>管理料 {yen(eng.monthly_fee)}/月</div>}
                        {eng.status === 'requested' && (
                            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10, marginTop: 10, flexWrap: 'wrap' }}>
                                <div className="form-group" style={{ margin: 0 }}>
                                    <label className="form-label" style={{ fontSize: 'var(--font-size-xs)' }}>管理料（月額・円）</label>
                                    <input className="form-input" type="number" style={{ width: 160 }}
                                        max={FEE_CAP}
                                        value={feeInputs[eng.id] ?? ''}
                                        onChange={e => setFeeInputs(f => ({ ...f, [eng.id]: e.target.value }))}
                                        placeholder={profile.service_fee || '30000'} />
                                </div>
                                <button className="btn btn-primary" onClick={() => respond(eng, 'accept')}>
                                    <CheckCircle2 size={16} style={{ marginRight: 4 }} />受託する
                                </button>
                                <button className="btn btn-secondary" onClick={() => respond(eng, 'decline')}>
                                    <XCircle size={16} style={{ marginRight: 4 }} />辞退
                                </button>
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </>
    );
}

function StatCard({ label, value, accent }) {
    return (
        <div style={{
            padding: '16px 18px', borderRadius: 12,
            border: '1px solid ' + (accent ? 'var(--color-accent-light, #eadfc4)' : 'var(--color-border, #e5e7eb)'),
            background: accent ? 'linear-gradient(180deg, #fbf6ea 0%, #fdfbf5 100%)' : '#fff',
        }}>
            <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary, #6b7280)', marginBottom: 6 }}>{label}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 'var(--font-size-xl)', fontWeight: 700, color: 'var(--color-navy, #121c34)' }}>
                {accent && <TrendingUp size={18} style={{ color: 'var(--color-accent, #c8952e)' }} />}
                {value}
            </div>
        </div>
    );
}
