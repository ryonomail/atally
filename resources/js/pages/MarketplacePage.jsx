import React, { useState, useEffect, useCallback } from 'react';
import { Handshake, TrendingUp, CheckCircle2, XCircle, Building2, BadgeCheck, Link2, Copy, Users } from 'lucide-react';
import api from '../api';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../hooks/useToast';

const yen = n => '¥' + Number(n || 0).toLocaleString();
const FEE_CAP = 100000;

/*
 * パートナー（代理店）制度:
 *  - パートナーが顧客企業を紹介リンクで連れてくる → 企業は通常どおり自分で求人を掲載・運用
 *  - その企業の求人課金の25%がパートナーへ自動還元される
 *  - 運用代行（求人作成等の代行）はパートナーが任意で提供する自分の商売（料金も自由・上限あり）
 *  - 求職者側にはパートナー経由であることは一切表示しない
 */
export default function MarketplacePage() {
    const { user } = useAuth();
    const toast = useToast();
    const [companyType, setCompanyType] = useState(user?.company?.company_type ?? null);
    const [loading, setLoading] = useState(true);
    const [view, setView] = useState(null); // 'partner' | 'client'

    useEffect(() => {
        api.get('/company').then(res => {
            const c = res.data.company || res.data;
            setCompanyType(c?.company_type ?? null);
            // 人材会社はパートナービュー、一般企業は企業ビューを初期表示（どちらもタブで切替可能）
            setView((c?.company_type === 'recruitment_agency') ? 'partner' : 'client');
        }).catch(() => setView('client')).finally(() => setLoading(false));
    }, []);

    if (loading || !view) {
        return <div className="container" style={{ padding: '40px 0', textAlign: 'center', opacity: 0.6 }}>読み込み中…</div>;
    }

    return (
        <div className="container" style={{ padding: '24px 0 60px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                <Handshake size={24} style={{ color: 'var(--color-accent, #c8952e)' }} />
                <h1 style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 700, color: 'var(--color-navy, #121c34)', margin: 0 }}>
                    パートナー制度（代理店）
                </h1>
            </div>
            <p style={{ color: 'var(--color-text-secondary, #6b7280)', fontSize: 'var(--font-size-sm)', marginBottom: 16 }}>
                企業をAtallyに紹介すると、その企業の求人課金の<strong>25%が継続的に還元</strong>されます。
                紹介した企業は通常どおり自分で求人を掲載・運用できます（運用代行はパートナーの任意サービス）。
            </p>

            {/* ビュー切替（どの会社でもパートナーになれる） */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
                {[{ key: 'partner', label: 'パートナーとして使う' }, { key: 'client', label: '企業として使う（担当を探す）' }].map(t => (
                    <button key={t.key} onClick={() => setView(t.key)}
                        style={{
                            padding: '7px 14px', borderRadius: 999, cursor: 'pointer', fontSize: 'var(--font-size-sm)',
                            border: view === t.key ? '1.5px solid var(--color-navy, #121c34)' : '1px solid var(--color-border, #e5e7eb)',
                            background: view === t.key ? 'rgba(18,28,52,0.06)' : 'transparent',
                            fontWeight: view === t.key ? 700 : 400, color: 'var(--color-navy, #121c34)',
                        }}>
                        {t.label}
                    </button>
                ))}
            </div>

            {view === 'partner' ? <PartnerView toast={toast} /> : <ClientView toast={toast} />}
        </div>
    );
}

/* ========================= パートナー（代理店）ビュー ========================= */
function PartnerView({ toast }) {
    const [partner, setPartner] = useState(null);   // { referral_code, referral_url, ... }
    const [profile, setProfile] = useState({ marketplace_listed: false, service_fee: '', service_description: '', service_specialties: '' });
    const [reviewStatus, setReviewStatus] = useState(null);
    const [engagements, setEngagements] = useState([]);
    const [payouts, setPayouts] = useState(null);
    const [saving, setSaving] = useState(false);
    const [feeInputs, setFeeInputs] = useState({});

    const load = useCallback(() => {
        api.get('/marketplace/partner-status').then(r => setPartner(r.data)).catch(() => {});
        api.get('/company').then(res => {
            const c = res.data.company || res.data;
            setProfile({
                marketplace_listed: !!c.marketplace_listed,
                service_fee: c.service_fee ?? '',
                service_description: c.service_description ?? '',
                service_specialties: c.service_specialties ?? '',
            });
            setReviewStatus(c.marketplace_status ?? null);
        }).catch(() => {});
        api.get('/marketplace/engagements').then(res => setEngagements(res.data.engagements || [])).catch(() => {});
        api.get('/marketplace/payouts').then(res => setPayouts(res.data)).catch(() => {});
    }, []);
    useEffect(load, [load]);

    const copyLink = () => {
        if (!partner?.referral_url) return;
        navigator.clipboard?.writeText(partner.referral_url)
            .then(() => toast.success('紹介リンクをコピーしました'))
            .catch(() => toast.error('コピーに失敗しました'));
    };

    const saveProfile = () => {
        setSaving(true);
        api.post('/marketplace/profile', {
            marketplace_listed: profile.marketplace_listed,
            service_fee: profile.service_fee === '' ? null : Number(profile.service_fee),
            service_description: profile.service_description || null,
            service_specialties: profile.service_specialties || null,
        }).then(res => {
            const st = res.data?.company?.marketplace_status;
            if (st) setReviewStatus(st);
            toast.success(profile.marketplace_listed && st !== 'approved'
                ? '保存しました。運営審査の通過後に掲載されます。'
                : '保存しました');
        }).catch(err => toast.error(err.response?.data?.message || '保存に失敗しました'))
          .finally(() => setSaving(false));
    };

    const respond = (eng, action) => {
        const monthly_fee = action === 'accept' ? Number(feeInputs[eng.id] ?? profile.service_fee ?? 0) : undefined;
        api.post(`/marketplace/engagements/${eng.id}/respond`, { action, monthly_fee })
            .then(() => { toast.success(action === 'accept' ? '担当を開始しました' : '辞退しました'); load(); })
            .catch(err => toast.error(err.response?.data?.message || '処理に失敗しました'));
    };

    const statusLabel = { requested: '依頼中', active: '担当中', declined: '辞退', ended: '終了' };

    // 申請（審査制）: 承認されるまで紹介リンク等は非表示
    const [applyForm, setApplyForm] = useState({ service_specialties: '', service_description: '' });
    const [applying, setApplying] = useState(false);
    const apply = () => {
        setApplying(true);
        api.post('/marketplace/apply', applyForm)
            .then(() => { toast.success('申請を受け付けました。審査結果をお待ちください。'); load(); })
            .catch(err => toast.error(err.response?.data?.message || '申請に失敗しました'))
            .finally(() => setApplying(false));
    };

    if (partner && !partner.approved) {
        return (
            <div className="card" style={{ padding: 24, borderRadius: 12, border: '1px solid var(--color-border, #e5e7eb)', maxWidth: 640 }}>
                <h2 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 700, marginTop: 0, marginBottom: 8 }}>パートナー申請</h2>
                <ul style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary, #6b7280)', lineHeight: 1.9, paddingLeft: 18, marginBottom: 16 }}>
                    <li>専用の<strong>紹介リンク</strong>から企業が登録すると、あなたの担当になります</li>
                    <li>担当企業の<strong>求人課金の25%が継続的に還元</strong>されます</li>
                    <li>企業は通常どおり自分で求人を掲載・運用できます（運用代行はあなたの任意サービス）</li>
                    <li>利用には<strong>運営審査</strong>があります（結果は通知でお知らせします）</li>
                </ul>
                {partner.status === 'pending' && (
                    <div style={{ padding: '12px 14px', borderRadius: 8, background: '#fbf3e0', color: '#8a6314', fontSize: 'var(--font-size-sm)' }}>
                        審査中です。承認されると紹介リンクが発行されます。
                    </div>
                )}
                {partner.status === 'rejected' && (
                    <div style={{ padding: '12px 14px', borderRadius: 8, background: '#fbecec', color: '#a3312f', fontSize: 'var(--font-size-sm)', marginBottom: 14 }}>
                        今回は見送りとなりました。内容を見直して再申請できます。
                    </div>
                )}
                {partner.status !== 'pending' && (
                    <>
                        <div className="form-group">
                            <label className="form-label">得意領域（任意・審査の参考）</label>
                            <input className="form-input" value={applyForm.service_specialties}
                                onChange={e => setApplyForm(f => ({ ...f, service_specialties: e.target.value }))}
                                placeholder="例: 介護, 製造, 沖縄県の企業" />
                        </div>
                        <div className="form-group">
                            <label className="form-label">紹介できる企業・事業の概要（任意）</label>
                            <textarea className="form-textarea" rows={3} value={applyForm.service_description}
                                onChange={e => setApplyForm(f => ({ ...f, service_description: e.target.value }))}
                                placeholder="例: 営業代行として県内の中小企業50社と取引があります。" />
                        </div>
                        <button className="btn btn-primary" onClick={apply} disabled={applying}>
                            {applying ? '送信中…' : (partner.status === 'rejected' ? '再申請する' : 'パートナー申請する')}
                        </button>
                    </>
                )}
            </div>
        );
    }

    return (
        <>
            {/* 還元サマリー */}
            {payouts && (
                <div className="grid grid-3" style={{ gap: 14, marginBottom: 20 }}>
                    <StatCard label="今月の還元（25%）" value={yen(payouts.this_month)} accent />
                    <StatCard label="累計還元" value={yen(payouts.total)} />
                    <StatCard label="担当企業" value={`${engagements.filter(e => e.status === 'active').length}社`} />
                </div>
            )}

            {/* 紹介リンク＝制度の中心 */}
            <div className="card" style={{ padding: 20, borderRadius: 12, border: '1.5px solid var(--color-accent, #c8952e)', background: 'linear-gradient(180deg, #fbf6ea 0%, #fdfbf5 100%)', marginBottom: 20 }}>
                <h2 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 700, marginTop: 0, marginBottom: 6, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Link2 size={18} style={{ color: 'var(--color-accent, #c8952e)' }} /> あなたの紹介リンク
                </h2>
                <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary, #6b7280)', marginBottom: 10 }}>
                    このリンクから企業が登録すると自動であなたの担当になり、その企業の求人課金の<strong>25%が毎月あなたに還元</strong>されます。
                </p>
                {partner?.referral_url ? (
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                        <code style={{ padding: '8px 12px', background: '#fff', border: '1px solid var(--color-border, #e5e7eb)', borderRadius: 8, fontSize: 'var(--font-size-xs)', wordBreak: 'break-all', flex: '1 1 300px' }}>
                            {partner.referral_url}
                        </code>
                        <button className="btn btn-primary" onClick={copyLink} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                            <Copy size={15} /> コピー
                        </button>
                    </div>
                ) : <div className="skeleton" style={{ height: 38 }} />}
            </div>

            {/* 担当企業一覧（自社の求人とは別物であることを明確に） */}
            <div className="card" style={{ padding: 20, borderRadius: 12, border: '1px solid var(--color-border, #e5e7eb)', marginBottom: 20 }}>
                <h2 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 700, marginTop: 0, marginBottom: 4, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Users size={18} /> 担当企業（紹介した企業）
                </h2>
                <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted, #9ca3af)', marginBottom: 14 }}>
                    ここに並ぶのは紹介・担当している<strong>顧客企業</strong>です。自社の求人は従来どおり「求人管理」で管理してください。
                </p>
                {engagements.length === 0 && (
                    <div style={{ opacity: 0.6, fontSize: 'var(--font-size-sm)' }}>
                        まだ担当企業がありません。上の紹介リンクを顧客企業に送るところから始めましょう。
                    </div>
                )}
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
                        {eng.status === 'active' && (
                            <div style={{ display: 'flex', gap: 16, fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary, #6b7280)', marginTop: 6, flexWrap: 'wrap' }}>
                                <span>掲載中求人 <strong>{eng.client_active_jobs ?? 0}</strong>件</span>
                                <span>今月の課金 <strong>{yen(eng.client_billed_this_month)}</strong></span>
                                <span style={{ color: 'var(--color-accent, #c8952e)', fontWeight: 700 }}>あなたの還元 {yen(eng.share_this_month)}</span>
                                {eng.monthly_fee != null && eng.monthly_fee > 0 && <span>運用代行料 {yen(eng.monthly_fee)}/月（企業へ直接請求）</span>}
                            </div>
                        )}
                        {eng.note && <p style={{ fontSize: 'var(--font-size-xs)', margin: '6px 0 0', color: 'var(--color-text-muted, #9ca3af)' }}>{eng.note}</p>}
                        {eng.status === 'requested' && (
                            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10, marginTop: 10, flexWrap: 'wrap' }}>
                                <div className="form-group" style={{ margin: 0 }}>
                                    <label className="form-label" style={{ fontSize: 'var(--font-size-xs)' }}>運用代行も行う場合の料金（月額・任意）</label>
                                    <input className="form-input" type="number" style={{ width: 160 }} max={FEE_CAP}
                                        value={feeInputs[eng.id] ?? ''}
                                        onChange={e => setFeeInputs(f => ({ ...f, [eng.id]: e.target.value }))}
                                        placeholder="0（紹介のみ）" />
                                </div>
                                <button className="btn btn-primary" onClick={() => respond(eng, 'accept')}>
                                    <CheckCircle2 size={16} style={{ marginRight: 4 }} />担当する
                                </button>
                                <button className="btn btn-secondary" onClick={() => respond(eng, 'decline')}>
                                    <XCircle size={16} style={{ marginRight: 4 }} />辞退
                                </button>
                            </div>
                        )}
                    </div>
                ))}
            </div>

            {/* 掲載プロフィール（任意）: 企業側から「担当を探す」で見つけてもらう用 */}
            <div className="card" style={{ padding: 20, borderRadius: 12, border: '1px solid var(--color-border, #e5e7eb)' }}>
                <h2 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 700, marginTop: 0, marginBottom: 4 }}>パートナー掲載（任意・審査制）</h2>
                <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted, #9ca3af)', marginBottom: 14 }}>
                    掲載すると、Atally上の企業から担当依頼を受けられます（紹介リンクだけで使う場合、掲載は不要です）。
                </p>
                {profile.marketplace_listed && reviewStatus && reviewStatus !== 'approved' && (
                    <div style={{ marginBottom: 14, padding: '10px 12px', borderRadius: 8, fontSize: 'var(--font-size-sm)',
                        background: reviewStatus === 'rejected' ? '#fbecec' : '#fbf3e0',
                        color: reviewStatus === 'rejected' ? '#a3312f' : '#8a6314' }}>
                        {reviewStatus === 'rejected' ? '今回は掲載を見送りとなりました。内容を見直して再度申請できます。' : '運営審査中です。承認されると企業に公開されます。'}
                    </div>
                )}
                {profile.marketplace_listed && reviewStatus === 'approved' && (
                    <div style={{ marginBottom: 14, padding: '10px 12px', borderRadius: 8, fontSize: 'var(--font-size-sm)', background: '#eaf6ee', color: '#1b7a3d' }}>
                        掲載中です。企業に公開されています。
                    </div>
                )}
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14, cursor: 'pointer' }}>
                    <input type="checkbox" checked={profile.marketplace_listed}
                        onChange={e => setProfile(p => ({ ...p, marketplace_listed: e.target.checked }))} />
                    <span style={{ fontWeight: 600 }}>パートナーとして掲載する</span>
                </label>
                <div className="grid grid-2" style={{ gap: 14 }}>
                    <div className="form-group">
                        <label className="form-label">運用代行も提供する場合の料金目安（月額・任意）</label>
                        <input className="form-input" type="number" value={profile.service_fee}
                            onChange={e => setProfile(p => ({ ...p, service_fee: e.target.value }))}
                            placeholder="例: 30000（紹介のみなら空欄）" max={FEE_CAP} />
                        <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary, #6b7280)', marginTop: 4 }}>
                            上限 {yen(FEE_CAP)}/月。企業への請求はパートナーが直接行います
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
                    <label className="form-label">紹介文</label>
                    <textarea className="form-textarea" rows={3} value={profile.service_description}
                        onChange={e => setProfile(p => ({ ...p, service_description: e.target.value }))}
                        placeholder="例: 沖縄県の企業を中心に採用支援を行っています。掲載から応募対応まで代行も可能です。" />
                </div>
                <button className="btn btn-primary" onClick={saveProfile} disabled={saving}>
                    {saving ? '保存中…' : '保存する'}
                </button>
            </div>
        </>
    );
}

/* ========================= 企業（求人主）ビュー ========================= */
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
            .then(() => { toast.success('担当を依頼しました。パートナーの承認をお待ちください。'); setNote(''); load(); })
            .catch(err => toast.error(err.response?.data?.message || '依頼に失敗しました'))
            .finally(() => setBusyId(null));
    };

    const end = () => {
        if (!engagement) return;
        if (!confirm('このパートナーとの担当関係を解除しますか？')) return;
        api.post(`/marketplace/engagements/${engagement.id}/end`)
            .then(() => { toast.success('解除しました'); load(); })
            .catch(() => toast.error('解除に失敗しました'));
    };

    return (
        <>
            <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary, #6b7280)', marginBottom: 16 }}>
                採用のプロ（代理店・コンサル等）に担当についてもらえます。担当がついても、求人の掲載・管理は御社が通常どおり行えます。
            </p>

            {engagement && (
                <div style={{ marginBottom: 24, padding: '16px 18px', borderRadius: 12, border: '1px solid var(--color-navy, #121c34)', background: '#f7f9fc' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700, color: 'var(--color-navy, #121c34)', marginBottom: 6 }}>
                        <Handshake size={18} />
                        {engagement.status === 'active' ? '担当パートナー' : '依頼中（承認待ち）'}
                    </div>
                    <div style={{ fontSize: 'var(--font-size-sm)' }}>
                        <strong>{engagement.agency?.company_name}</strong>
                        {engagement.status === 'active' && engagement.monthly_fee != null && engagement.monthly_fee > 0 &&
                            <span style={{ marginLeft: 8 }}>運用代行料 {yen(engagement.monthly_fee)}/月</span>}
                        {engagement.status === 'requested' &&
                            <span style={{ marginLeft: 8, color: 'var(--color-accent, #c8952e)' }}>承認待ち</span>}
                    </div>
                    <button className="btn btn-secondary" style={{ marginTop: 10 }} onClick={end}>担当を解除</button>
                </div>
            )}

            {!engagement && (
                <div className="form-group" style={{ maxWidth: 520, marginBottom: 20 }}>
                    <label className="form-label">依頼メモ（任意・パートナーへ共有）</label>
                    <textarea className="form-textarea" rows={2} value={note} onChange={e => setNote(e.target.value)}
                        placeholder="例: 介護職の採用を強化したい。運用も相談したい。" />
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
                            運用代行を頼む場合: <strong>{a.service_fee != null ? `${yen(a.service_fee)}/月〜` : '要相談'}</strong>
                        </div>
                        <button className="btn btn-primary" disabled={!!engagement || busyId === a.id}
                            onClick={() => request(a)}>
                            {busyId === a.id ? '送信中…' : engagement ? '依頼済み' : 'このパートナーに依頼'}
                        </button>
                    </div>
                ))}
                {agencies.length === 0 && (
                    <div style={{ opacity: 0.6, padding: 20 }}>現在掲載中のパートナーはいません。</div>
                )}
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
