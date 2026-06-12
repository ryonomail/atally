import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import api from '../api';
import { useToast } from '../hooks/useToast';

const TABS = [
    { key: 'overview', label: '概要', icon: '📊' },
    { key: 'revenue', label: '売上', icon: '💰' },
    { key: 'jobseekers', label: '求職者', icon: '👤' },
    { key: 'all-companies', label: '企業一覧', icon: '🏢' },
    { key: 'all-jobs', label: '求人一覧', icon: '📋' },
    { key: 'companies', label: '企業審査', icon: '✅' },
    { key: 'jobs', label: '求人審査', icon: '📝' },
    { key: 'licenses', label: 'ライセンス', icon: '📜' },
    { key: 'reports', label: '通報', icon: '🚨' },
    { key: 'audit', label: '監査ログ', icon: '📜' },
    { key: 'settings', label: '設定', icon: '⚙' },
];

/* ============================================
   概要タブ
   ============================================ */
function OverviewTab({ stats, statsError, onTabChange, revenueSummary }) {
    const revenue = revenueSummary || null;

    if (statsError) return (
        <div className="card" style={{ textAlign: 'center', padding: 'var(--space-3xl)', color: '#ef4444' }}>
            概要の読み込みに失敗しました: {statsError}
        </div>
    );
    if (!stats) return <div className="skeleton" style={{ height: 200 }} />;

    const cards = [
        { label: '求職者数', value: stats.total_jobseekers, color: '#121c34', tab: 'jobseekers' },
        { label: '企業数', value: stats.total_companies, color: '#8b5cf6', tab: 'all-companies' },
        { label: 'アクティブ求人', value: stats.active_jobs, color: '#22c55e', tab: 'all-jobs' },
        { label: '企業審査待ち', value: stats.pending_verifications, color: stats.pending_verifications > 0 ? '#f59e0b' : '#94a3b8', alert: stats.pending_verifications > 0, tab: 'companies' },
        { label: '求人審査待ち', value: stats.pending_job_reviews, color: stats.pending_job_reviews > 0 ? '#f59e0b' : '#94a3b8', alert: stats.pending_job_reviews > 0, tab: 'jobs' },
        { label: '未対応通報', value: stats.open_reports, color: stats.open_reports > 0 ? '#ef4444' : '#94a3b8', alert: stats.open_reports > 0, tab: 'reports' },
        { label: 'ライセンス審査待ち', value: stats.pending_licenses, color: stats.pending_licenses > 0 ? '#f59e0b' : '#94a3b8', alert: stats.pending_licenses > 0, tab: 'licenses' },
    ];

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-lg)' }}>
            {/* 売上サマリー */}
            {revenue && (
                <div className="card" style={{ cursor: 'pointer', transition: 'transform 0.15s, box-shadow 0.15s' }}
                    onClick={() => onTabChange('revenue')}
                    onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)'; }}
                    onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = ''; }}
                >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-sm)' }}>
                        <h3 style={{ margin: 0, fontSize: 'var(--font-size-base)' }}>💰 今月の売上</h3>
                        <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>詳細を見る →</span>
                    </div>
                    <div style={{ display: 'flex', gap: 'var(--space-xl)', alignItems: 'baseline' }}>
                        <span style={{ fontSize: 'var(--font-size-3xl)', fontWeight: 700, color: '#22c55e' }}>
                            ¥{revenue.this_month?.toLocaleString() || '0'}
                        </span>
                        <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)' }}>
                            先月: ¥{revenue.last_month?.toLocaleString() || '0'}
                        </span>
                        {revenue.last_month > 0 && (() => {
                            const growth = Math.round((((revenue.this_month || 0) - revenue.last_month) / revenue.last_month) * 100);
                            return (
                                <span style={{ fontSize: 'var(--font-size-sm)', fontWeight: 600, color: growth >= 0 ? '#22c55e' : '#ef4444' }}>
                                    {growth >= 0 ? '+' : ''}{growth}%
                                </span>
                            );
                        })()}
                    </div>
                </div>
            )}

            <div className="grid grid-4" style={{ gap: 'var(--space-md)' }}>
                {cards.map(c => (
                    <div key={c.label} className="card" style={{
                        textAlign: 'center', position: 'relative',
                        border: c.alert ? `2px solid ${c.color}` : undefined,
                        cursor: 'pointer',
                        transition: 'transform 0.15s, box-shadow 0.15s',
                    }}
                    onClick={() => onTabChange(c.tab)}
                    onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)'; }}
                    onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = ''; }}
                    >
                        <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--font-size-xs)', marginBottom: 'var(--space-xs)' }}>{c.label}</p>
                        <p style={{ fontSize: 'var(--font-size-3xl)', fontWeight: 700, color: c.color, margin: 0 }}>{c.value}</p>
                        <p style={{ fontSize: 10, color: 'var(--color-text-muted)', margin: '4px 0 0' }}>クリックで一覧へ →</p>
                    </div>
                ))}
            </div>
        </div>
    );
}

/* ============================================
   売上タブ
   ============================================ */
function RevenueTab({ initialData }) {
    const [data, setData] = useState(initialData || null);
    const [loading, setLoading] = useState(!initialData);

    useEffect(() => {
        if (initialData) return;
        api.get('/admin/revenue').then(res => setData(res.data)).finally(() => setLoading(false));
    }, []);

    if (loading) return <div className="skeleton" style={{ height: 300 }} />;
    if (!data) return <div className="card" style={{ textAlign: 'center', padding: 'var(--space-3xl)', color: 'var(--color-text-muted)' }}>売上データがありません</div>;

    const growth = data.last_month > 0
        ? Math.round(((data.this_month - data.last_month) / data.last_month) * 100)
        : null;

    const maxDaily = Math.max(...(data.daily || []).map(d => d.total), 1);

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-lg)' }}>
            {/* サマリーカード */}
            <div className="grid grid-3" style={{ gap: 'var(--space-md)' }}>
                <div className="card" style={{ textAlign: 'center' }}>
                    <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--font-size-xs)', marginBottom: 'var(--space-xs)' }}>今月の売上</p>
                    <p style={{ fontSize: 'var(--font-size-3xl)', fontWeight: 700, color: '#22c55e', margin: 0 }}>
                        ¥{data.this_month.toLocaleString()}
                    </p>
                </div>
                <div className="card" style={{ textAlign: 'center' }}>
                    <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--font-size-xs)', marginBottom: 'var(--space-xs)' }}>先月の売上</p>
                    <p style={{ fontSize: 'var(--font-size-3xl)', fontWeight: 700, color: '#121c34', margin: 0 }}>
                        ¥{data.last_month.toLocaleString()}
                    </p>
                </div>
                <div className="card" style={{ textAlign: 'center' }}>
                    <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--font-size-xs)', marginBottom: 'var(--space-xs)' }}>前月比</p>
                    <p style={{ fontSize: 'var(--font-size-3xl)', fontWeight: 700, color: growth > 0 ? '#22c55e' : growth < 0 ? '#ef4444' : '#94a3b8', margin: 0 }}>
                        {growth !== null ? `${growth > 0 ? '+' : ''}${growth}%` : '—'}
                    </p>
                </div>
            </div>

            {/* 日別売上チャート（バー） */}
            {data.daily?.length > 0 && (
                <div className="card">
                    <h3 style={{ marginBottom: 'var(--space-md)' }}>直近30日の日別売上</h3>
                    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 160 }}>
                        {data.daily.map(d => (
                            <div key={d.date} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                <div style={{
                                    width: '100%', background: '#121c34', borderRadius: '2px 2px 0 0',
                                    height: `${Math.max((d.total / maxDaily) * 140, 2)}px`,
                                    transition: 'height 0.3s',
                                }} title={`${d.date}: ¥${Number(d.total).toLocaleString()}`} />
                            </div>
                        ))}
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4, fontSize: 10, color: 'var(--color-text-muted)' }}>
                        <span>{data.daily[0]?.date?.slice(5)}</span>
                        <span>{data.daily[data.daily.length - 1]?.date?.slice(5)}</span>
                    </div>
                </div>
            )}

            {/* 月別推移 */}
            {data.monthly?.length > 0 && (
                <div className="card">
                    <h3 style={{ marginBottom: 'var(--space-md)' }}>月別推移</h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
                        {data.monthly.map(m => {
                            const maxMonthly = Math.max(...data.monthly.map(x => x.total), 1);
                            return (
                                <div key={m.month} style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-md)' }}>
                                    <span style={{ width: 70, fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)', flexShrink: 0 }}>{m.month}</span>
                                    <div style={{ flex: 1, background: 'var(--color-bg-secondary)', borderRadius: 'var(--radius-sm)', height: 24, overflow: 'hidden' }}>
                                        <div style={{
                                            width: `${(m.total / maxMonthly) * 100}%`,
                                            height: '100%', background: '#121c34', borderRadius: 'var(--radius-sm)',
                                            transition: 'width 0.5s',
                                        }} />
                                    </div>
                                    <span style={{ width: 100, textAlign: 'right', fontSize: 'var(--font-size-sm)', fontWeight: 600 }}>
                                        ¥{Number(m.total).toLocaleString()}
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* 企業別ランキング */}
            {data.top_companies?.length > 0 && (
                <div className="card">
                    <h3 style={{ marginBottom: 'var(--space-md)' }}>今月の企業別売上 TOP10</h3>
                    <table style={{ width: '100%', fontSize: 'var(--font-size-sm)' }}>
                        <thead>
                            <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
                                <th style={{ textAlign: 'left', padding: '8px 0', color: 'var(--color-text-muted)', fontWeight: 500 }}>#</th>
                                <th style={{ textAlign: 'left', padding: '8px 0', color: 'var(--color-text-muted)', fontWeight: 500 }}>企業名</th>
                                <th style={{ textAlign: 'right', padding: '8px 0', color: 'var(--color-text-muted)', fontWeight: 500 }}>売上</th>
                            </tr>
                        </thead>
                        <tbody>
                            {data.top_companies.map((c, i) => (
                                <tr key={c.company_id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                                    <td style={{ padding: '8px 0', fontWeight: 600, color: i < 3 ? '#f59e0b' : 'var(--color-text-secondary)' }}>{i + 1}</td>
                                    <td style={{ padding: '8px 0' }}>{c.company_name || `ID: ${c.company_id}`}</td>
                                    <td style={{ padding: '8px 0', textAlign: 'right', fontWeight: 600 }}>¥{Number(c.total || 0).toLocaleString()}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}

/* ============================================
   求職者一覧タブ
   ============================================ */
/* ============================================
   履歴書閲覧モーダル（管理者用）
   ============================================ */
function ResumeViewModal({ user, onClose }) {
    const [resumes, setResumes] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeIdx, setActiveIdx] = useState(0);

    useEffect(() => {
        api.get(`/admin/jobseekers/${user.id}/resumes`)
            .then(res => setResumes(res.data.resumes || []))
            .catch(() => {})
            .finally(() => setLoading(false));
    }, [user.id]);

    const r = resumes[activeIdx];

    const Section = ({ title, children }) => (
        <div style={{ marginBottom: 'var(--space-lg)' }}>
            <div style={{
                fontSize: 'var(--font-size-xs)', fontWeight: 700,
                color: 'var(--color-text-muted)', letterSpacing: 1,
                textTransform: 'uppercase', marginBottom: 'var(--space-sm)',
                paddingBottom: 6, borderBottom: '1px solid var(--color-border)',
            }}>{title}</div>
            {children}
        </div>
    );

    const Row = ({ label, value }) => value ? (
        <div style={{ display: 'flex', gap: 'var(--space-md)', padding: '6px 0', borderBottom: '1px solid var(--color-border)' }}>
            <span style={{ flex: '0 0 110px', fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', fontWeight: 600, paddingTop: 1 }}>{label}</span>
            <span style={{ flex: 1, fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>{value}</span>
        </div>
    ) : null;

    return (
        <div style={{
            position: 'fixed', inset: 0, zIndex: 1000,
            background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
            display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
            padding: 'var(--space-lg)', overflowY: 'auto',
        }} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
            <div className="card animate-fade-in" style={{ width: '100%', maxWidth: 680, marginTop: 20 }}>
                {/* ヘッダー */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-lg)' }}>
                    <div>
                        <h2 style={{ fontSize: 'var(--font-size-xl)', margin: 0 }}>{user.name} の履歴書</h2>
                        <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', margin: '4px 0 0' }}>{user.email}</p>
                    </div>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: 'var(--color-text-muted)' }}>✕</button>
                </div>

                {loading ? <div className="skeleton" style={{ height: 300 }} /> : resumes.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: 'var(--space-2xl)' }}>
                        <p style={{ fontSize: '2.5rem', marginBottom: 'var(--space-sm)' }}>📄</p>
                        <p style={{ fontSize: 'var(--font-size-base)', fontWeight: 600, color: 'var(--color-text-primary)', marginBottom: 4 }}>履歴書が登録されていません</p>
                        <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>このユーザーはまだ履歴書を作成していません</p>
                    </div>
                ) : (
                    <>
                        {/* 複数履歴書タブ */}
                        {resumes.length > 1 && (
                            <div style={{ display: 'flex', gap: 4, marginBottom: 'var(--space-lg)', borderBottom: '1px solid var(--color-border)', overflowX: 'auto' }}>
                                {resumes.map((res, i) => (
                                    <button key={i} onClick={() => setActiveIdx(i)} style={{
                                        padding: '6px 14px', background: 'none', border: 'none',
                                        borderBottom: activeIdx === i ? '2px solid var(--color-accent)' : '2px solid transparent',
                                        color: activeIdx === i ? 'var(--color-text-accent)' : 'var(--color-text-muted)',
                                        fontWeight: activeIdx === i ? 700 : 400,
                                        cursor: 'pointer', fontSize: 'var(--font-size-sm)', whiteSpace: 'nowrap',
                                        marginBottom: -1,
                                    }}>
                                        {res.title || `履歴書${i + 1}`}
                                        {res.is_default && <span style={{ marginLeft: 4, fontSize: 10, color: 'var(--color-accent)' }}>●既定</span>}
                                    </button>
                                ))}
                            </div>
                        )}

                        {r && (
                            <div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-md)' }}>
                                    <span style={{ fontSize: 'var(--font-size-sm)', fontWeight: 600 }}>{r.title || '履歴書'}</span>
                                    <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>更新: {r.updated_at}</span>
                                </div>

                                <Section title="基本情報">
                                    <Row label="氏名" value={r.full_name && `${r.full_name}（${r.full_name_kana || ''}）`} />
                                    <Row label="生年月日" value={r.birth_date} />
                                    <Row label="電話番号" value={r.phone} />
                                    <Row label="住所" value={r.address} />
                                </Section>

                                {r.education?.length > 0 && (
                                    <Section title="学歴">
                                        {r.education.map((e, i) => (
                                            <div key={i} style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', padding: '4px 0', borderBottom: '1px solid var(--color-border)' }}>
                                                {e.start && <span style={{ color: 'var(--color-text-muted)', marginRight: 8, fontSize: 'var(--font-size-xs)' }}>{e.start}</span>}
                                                {e.school}{e.faculty && `　${e.faculty}`}
                                                {e.end && <span style={{ color: 'var(--color-text-muted)', marginLeft: 8, fontSize: 'var(--font-size-xs)' }}>〜{e.end}</span>}
                                            </div>
                                        ))}
                                    </Section>
                                )}

                                {r.work_history?.length > 0 && (
                                    <Section title="職歴">
                                        {r.work_history.map((w, i) => (
                                            <div key={i} style={{ padding: '6px 0', borderBottom: '1px solid var(--color-border)' }}>
                                                <div style={{ display: 'flex', gap: 8, alignItems: 'baseline' }}>
                                                    <span style={{ fontSize: 'var(--font-size-sm)', fontWeight: 600, color: 'var(--color-text-primary)' }}>{w.company}</span>
                                                    {w.position && <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>{w.position}</span>}
                                                </div>
                                                {(w.start || w.end) && (
                                                    <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', marginTop: 2 }}>
                                                        {w.start}〜{w.end || '現在'}
                                                    </div>
                                                )}
                                                {w.description && <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', margin: '4px 0 0', whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>{w.description}</p>}
                                            </div>
                                        ))}
                                    </Section>
                                )}

                                {r.licenses?.length > 0 && (
                                    <Section title="免許・資格">
                                        {r.licenses.map((l, i) => (
                                            <div key={i} style={{ display: 'flex', gap: 8, fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', padding: '4px 0', borderBottom: '1px solid var(--color-border)' }}>
                                                {l.date && <span style={{ color: 'var(--color-text-muted)', fontSize: 'var(--font-size-xs)' }}>{l.date}</span>}
                                                <span>{l.name}</span>
                                            </div>
                                        ))}
                                    </Section>
                                )}

                                {(r.self_pr || r.motivation) && (
                                    <Section title="自己PR・志望動機">
                                        {r.self_pr && <Row label="自己PR" value={r.self_pr} />}
                                        {r.motivation && <Row label="志望動機" value={r.motivation} />}
                                    </Section>
                                )}

                                {(r.desired_salary || r.desired_location || r.available_date) && (
                                    <Section title="希望条件">
                                        <Row label="希望年収" value={r.desired_salary} />
                                        <Row label="希望勤務地" value={r.desired_location} />
                                        <Row label="入社可能日" value={r.available_date} />
                                    </Section>
                                )}
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
}

function JobseekersTab({ initialData, onViewUser }) {
    const [users, setUsers] = useState(initialData?.data || []);
    const [loading, setLoading] = useState(!initialData);
    const [search, setSearch] = useState('');
    const [page, setPage] = useState(1);
    const [meta, setMeta] = useState(initialData ? { current_page: initialData.current_page, last_page: initialData.last_page, total: initialData.total } : null);
    const [resumeUser, setResumeUser] = useState(null);

    const fetchData = (p = 1, q = '') => {
        setLoading(true);
        api.get('/admin/jobseekers', { params: { page: p, q: q || undefined } }).then(res => {
            setUsers(res.data.data || []);
            setMeta({ current_page: res.data.current_page, last_page: res.data.last_page, total: res.data.total });
            setPage(p);
        }).finally(() => setLoading(false));
    };

    useEffect(() => { if (!initialData) fetchData(); }, []);

    return (
        <div>
            <div style={{ display: 'flex', gap: 'var(--space-sm)', marginBottom: 'var(--space-md)' }}>
                <input className="form-input" placeholder="名前・メールで検索..." value={search}
                    onChange={e => setSearch(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && fetchData(1, search)}
                    style={{ maxWidth: 300 }} />
                <button className="btn btn-secondary" onClick={() => fetchData(1, search)}>検索</button>
                {search && <button className="btn btn-secondary" onClick={() => { setSearch(''); fetchData(1, ''); }}>クリア</button>}
            </div>

            {loading ? <div className="skeleton" style={{ height: 200 }} /> : (
                <>
                    {meta && <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', marginBottom: 'var(--space-sm)' }}>{meta.total}件</p>}
                    <div className="card" style={{ overflow: 'auto' }}>
                        <table style={{ width: '100%', fontSize: 'var(--font-size-sm)' }}>
                            <thead>
                                <tr style={{ borderBottom: '2px solid var(--color-border)' }}>
                                    <th style={{ textAlign: 'left', padding: '8px', color: 'var(--color-text-muted)', fontWeight: 500 }}>ID</th>
                                    <th style={{ textAlign: 'left', padding: '8px', color: 'var(--color-text-muted)', fontWeight: 500 }}>名前</th>
                                    <th style={{ textAlign: 'left', padding: '8px', color: 'var(--color-text-muted)', fontWeight: 500 }}>メール</th>
                                    <th style={{ textAlign: 'right', padding: '8px', color: 'var(--color-text-muted)', fontWeight: 500 }}>応募数</th>
                                    <th style={{ textAlign: 'left', padding: '8px', color: 'var(--color-text-muted)', fontWeight: 500 }}>登録日</th>
                                    <th style={{ textAlign: 'center', padding: '8px', color: 'var(--color-text-muted)', fontWeight: 500 }}>状態</th>
                                    <th style={{ textAlign: 'center', padding: '8px', color: 'var(--color-text-muted)', fontWeight: 500 }}>操作</th>
                                </tr>
                            </thead>
                            <tbody>
                                {users.map(u => (
                                    <tr key={u.id} style={{ borderBottom: '1px solid var(--color-border)', opacity: u.suspended_at ? 0.6 : 1 }}>
                                        <td style={{ padding: '8px', color: 'var(--color-text-muted)' }}>{u.id}</td>
                                        <td style={{ padding: '8px' }}>{u.name}</td>
                                        <td style={{ padding: '8px', color: 'var(--color-text-secondary)' }}>{u.email}</td>
                                        <td style={{ padding: '8px', textAlign: 'right' }}>{u.applications_count}</td>
                                        <td style={{ padding: '8px', color: 'var(--color-text-muted)', fontSize: 'var(--font-size-xs)' }}>
                                            {new Date(u.created_at).toLocaleDateString('ja-JP')}
                                        </td>
                                        <td style={{ padding: '8px', textAlign: 'center' }}>
                                            {u.suspended_at ? (
                                                <span style={{ fontSize: 'var(--font-size-xs)', color: '#ef4444', fontWeight: 600 }}>停止中</span>
                                            ) : (
                                                <span style={{ fontSize: 'var(--font-size-xs)', color: '#22c55e' }}>有効</span>
                                            )}
                                        </td>
                                        <td style={{ padding: '8px', textAlign: 'center' }}>
                                            <div style={{ display: 'flex', gap: 4, justifyContent: 'center' }}>
                                                {onViewUser && (
                                                    <button className="btn btn-secondary" style={{ fontSize: 'var(--font-size-xs)', padding: '2px 8px' }}
                                                        onClick={() => onViewUser(u.id)}>詳細</button>
                                                )}
                                                <button className="btn btn-secondary" style={{ fontSize: 'var(--font-size-xs)', padding: '2px 8px' }}
                                                    onClick={() => setResumeUser(u)}>履歴書</button>
                                                {u.suspended_at ? (
                                                    <button className="btn btn-secondary" style={{ fontSize: 'var(--font-size-xs)', padding: '2px 8px' }}
                                                        onClick={() => {
                                                            if (!confirm('このユーザーの停止を解除しますか？')) return;
                                                            api.put(`/admin/users/${u.id}/unsuspend`).then(() => fetchData(page, search));
                                                        }}>解除</button>
                                                ) : (
                                                    <button className="btn" style={{ fontSize: 'var(--font-size-xs)', padding: '2px 8px', color: '#ef4444', border: '1px solid #ef4444', background: 'transparent' }}
                                                        onClick={() => {
                                                            const reason = prompt('停止理由を入力してください:');
                                                            if (!reason) return;
                                                            api.put(`/admin/users/${u.id}/suspend`, { reason }).then(() => fetchData(page, search));
                                                        }}>停止</button>
                                                )}
                                                <button className="btn" style={{ fontSize: 'var(--font-size-xs)', padding: '2px 8px', color: '#7f1d1d', border: '1px solid #fca5a5', background: 'rgba(254,202,202,0.3)' }}
                                                    onClick={() => {
                                                        if (!confirm(`「${u.name}」を完全に削除します。この操作は取り消せません。\n\n本当に削除しますか？`)) return;
                                                        api.delete(`/admin/users/${u.id}`).then(() => fetchData(page, search));
                                                    }}>削除</button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    {meta && meta.last_page > 1 && (
                        <div style={{ display: 'flex', justifyContent: 'center', gap: 'var(--space-sm)', marginTop: 'var(--space-md)' }}>
                            <button className="btn btn-secondary" disabled={page <= 1} onClick={() => fetchData(page - 1, search)}>前へ</button>
                            <span style={{ fontSize: 'var(--font-size-sm)', alignSelf: 'center' }}>{page} / {meta.last_page}</span>
                            <button className="btn btn-secondary" disabled={page >= meta.last_page} onClick={() => fetchData(page + 1, search)}>次へ</button>
                        </div>
                    )}
                </>
            )}

            {resumeUser && (
                <ResumeViewModal user={resumeUser} onClose={() => setResumeUser(null)} />
            )}
        </div>
    );
}

/* ============================================
   全企業一覧タブ
   ============================================ */
function AllCompaniesTab({ initialData }) {
    const [companies, setCompanies] = useState(initialData?.data || []);
    const [loading, setLoading] = useState(!initialData);
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState('');
    const [page, setPage] = useState(1);
    const [meta, setMeta] = useState(initialData ? { current_page: initialData.current_page, last_page: initialData.last_page, total: initialData.total } : null);

    const fetchData = (p = 1, q = '', status = '') => {
        setLoading(true);
        api.get('/admin/companies/all', { params: { page: p, q: q || undefined, status: status || undefined } }).then(res => {
            setCompanies(res.data.data || []);
            setMeta({ current_page: res.data.current_page, last_page: res.data.last_page, total: res.data.total });
            setPage(p);
        }).finally(() => setLoading(false));
    };

    useEffect(() => { if (!initialData) fetchData(); }, []);

    const VSTATUS = { unverified: { label: '未申請', cls: 'badge-info' }, pending: { label: '審査中', cls: 'badge-warning' }, verified: { label: '承認済', cls: 'badge-success' }, rejected: { label: '却下', cls: 'badge-danger' } };

    return (
        <div>
            <div style={{ display: 'flex', gap: 'var(--space-sm)', marginBottom: 'var(--space-md)', flexWrap: 'wrap' }}>
                <input className="form-input" placeholder="企業名で検索..." value={search}
                    onChange={e => setSearch(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && fetchData(1, search, statusFilter)}
                    style={{ maxWidth: 300 }} />
                <select className="form-input" value={statusFilter} onChange={e => { setStatusFilter(e.target.value); fetchData(1, search, e.target.value); }}
                    style={{ maxWidth: 150 }}>
                    <option value="">全ステータス</option>
                    <option value="unverified">未申請</option>
                    <option value="pending">審査中</option>
                    <option value="verified">承認済</option>
                    <option value="rejected">却下</option>
                </select>
                <button className="btn btn-secondary" onClick={() => fetchData(1, search, statusFilter)}>検索</button>
            </div>

            {loading ? <div className="skeleton" style={{ height: 200 }} /> : (
                <>
                    {meta && <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', marginBottom: 'var(--space-sm)' }}>{meta.total}件</p>}
                    <div className="card" style={{ overflow: 'auto' }}>
                        <table style={{ width: '100%', fontSize: 'var(--font-size-sm)' }}>
                            <thead>
                                <tr style={{ borderBottom: '2px solid var(--color-border)' }}>
                                    <th style={{ textAlign: 'left', padding: '8px', color: 'var(--color-text-muted)', fontWeight: 500 }}>企業名</th>
                                    <th style={{ textAlign: 'left', padding: '8px', color: 'var(--color-text-muted)', fontWeight: 500 }}>種別</th>
                                    <th style={{ textAlign: 'left', padding: '8px', color: 'var(--color-text-muted)', fontWeight: 500 }}>ステータス</th>
                                    <th style={{ textAlign: 'right', padding: '8px', color: 'var(--color-text-muted)', fontWeight: 500 }}>求人数</th>
                                    <th style={{ textAlign: 'left', padding: '8px', color: 'var(--color-text-muted)', fontWeight: 500 }}>担当者</th>
                                    <th style={{ textAlign: 'left', padding: '8px', color: 'var(--color-text-muted)', fontWeight: 500 }}>登録日</th>
                                    <th style={{ textAlign: 'center', padding: '8px', color: 'var(--color-text-muted)', fontWeight: 500 }}>操作</th>
                                </tr>
                            </thead>
                            <tbody>
                                {companies.map(c => (
                                    <tr key={c.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                                        <td style={{ padding: '8px', fontWeight: 600 }}>{c.company_name}</td>
                                        <td style={{ padding: '8px' }}>
                                            <span className="badge badge-info" style={{ fontSize: 10 }}>
                                                {c.company_type === 'recruitment_agency' ? '紹介会社' : '一般企業'}
                                            </span>
                                        </td>
                                        <td style={{ padding: '8px' }}>
                                            <span className={`badge ${VSTATUS[c.verification_status]?.cls || 'badge-info'}`} style={{ fontSize: 10 }}>
                                                {VSTATUS[c.verification_status]?.label || c.verification_status}
                                            </span>
                                        </td>
                                        <td style={{ padding: '8px', textAlign: 'right' }}>{c.jobs_count}</td>
                                        <td style={{ padding: '8px', fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
                                            {c.user?.name}
                                        </td>
                                        <td style={{ padding: '8px', color: 'var(--color-text-muted)', fontSize: 'var(--font-size-xs)' }}>
                                            {new Date(c.created_at).toLocaleDateString('ja-JP')}
                                        </td>
                                        <td style={{ padding: '8px', textAlign: 'center' }}>
                                            <div style={{ display: 'flex', gap: 4, justifyContent: 'center' }}>
                                                <button className="btn btn-secondary" style={{ fontSize: 'var(--font-size-xs)', padding: '2px 8px' }}
                                                    onClick={() => window.open(`/companies/${c.id}`, '_blank')}>
                                                    詳細
                                                </button>
                                                {c.user && (
                                                    c.user.suspended_at ? (
                                                        <button className="btn btn-secondary" style={{ fontSize: 'var(--font-size-xs)', padding: '2px 8px' }}
                                                            onClick={() => {
                                                                if (!confirm('この企業オーナーの停止を解除しますか？')) return;
                                                                api.put(`/admin/users/${c.user.id}/unsuspend`).then(() => fetchData(page, search, statusFilter));
                                                            }}>解除</button>
                                                    ) : (
                                                        <button className="btn" style={{ fontSize: 'var(--font-size-xs)', padding: '2px 8px', color: '#ef4444', border: '1px solid #ef4444', background: 'transparent' }}
                                                            onClick={() => {
                                                                const reason = prompt('停止理由を入力してください:');
                                                                if (!reason) return;
                                                                api.put(`/admin/users/${c.user.id}/suspend`, { reason }).then(() => fetchData(page, search, statusFilter));
                                                            }}>停止</button>
                                                    )
                                                )}
                                                {c.user && (
                                                    <button className="btn" style={{ fontSize: 'var(--font-size-xs)', padding: '2px 8px', color: '#7f1d1d', border: '1px solid #fca5a5', background: 'rgba(254,202,202,0.3)' }}
                                                        onClick={() => {
                                                            if (!confirm(`「${c.company_name}」のオーナーを完全に削除します。この操作は取り消せません。\n\n本当に削除しますか？`)) return;
                                                            api.delete(`/admin/users/${c.user.id}`).then(() => fetchData(page, search, statusFilter));
                                                        }}>削除</button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    {meta && meta.last_page > 1 && (
                        <div style={{ display: 'flex', justifyContent: 'center', gap: 'var(--space-sm)', marginTop: 'var(--space-md)' }}>
                            <button className="btn btn-secondary" disabled={page <= 1} onClick={() => fetchData(page - 1, search, statusFilter)}>前へ</button>
                            <span style={{ fontSize: 'var(--font-size-sm)', alignSelf: 'center' }}>{page} / {meta.last_page}</span>
                            <button className="btn btn-secondary" disabled={page >= meta.last_page} onClick={() => fetchData(page + 1, search, statusFilter)}>次へ</button>
                        </div>
                    )}
                </>
            )}
        </div>
    );
}

/* ============================================
   全求人一覧タブ
   ============================================ */
function AllJobsTab({ initialData }) {
    const toast = useToast();
    const [jobs, setJobs] = useState(initialData?.data || []);
    const [loading, setLoading] = useState(!initialData);
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState('');
    const [page, setPage] = useState(1);
    const [meta, setMeta] = useState(initialData ? { current_page: initialData.current_page, last_page: initialData.last_page, total: initialData.total } : null);
    const [processing, setProcessing] = useState(null);

    const fetchData = (p = 1, q = '', status = '') => {
        setLoading(true);
        api.get('/admin/jobs/all', { params: { page: p, q: q || undefined, status: status || undefined } }).then(res => {
            setJobs(res.data.data || []);
            setMeta({ current_page: res.data.current_page, last_page: res.data.last_page, total: res.data.total });
            setPage(p);
        }).finally(() => setLoading(false));
    };

    useEffect(() => { if (!initialData) fetchData(); }, []);

    const handleJobAction = async (jobId, status) => {
        const msg = status === 'suspended' ? 'この求人を停止しますか？' : 'この求人を公開に戻しますか？';
        if (!confirm(msg)) return;
        setProcessing(jobId);
        try {
            await api.put(`/admin/jobs/${jobId}/review`, { status });
            fetchData(page, search, statusFilter);
        } catch {
            toast.error('処理に失敗しました');
        } finally {
            setProcessing(null);
        }
    };

    const JSTATUS = {
        draft: { label: '下書き', cls: 'badge-info' },
        pending_review: { label: '審査中', cls: 'badge-warning' },
        active: { label: '公開中', cls: 'badge-success' },
        paused: { label: '一時停止', cls: 'badge-warning' },
        suspended: { label: '停止', cls: 'badge-danger' },
        closed: { label: '終了', cls: 'badge-info' },
    };

    return (
        <div>
            <div style={{ marginBottom: 'var(--space-md)' }}>
                <HelloWorkSyncCard />
            </div>
            <div style={{ display: 'flex', gap: 'var(--space-sm)', marginBottom: 'var(--space-md)', flexWrap: 'wrap' }}>
                <input className="form-input" placeholder="求人タイトルで検索..." value={search}
                    onChange={e => setSearch(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && fetchData(1, search, statusFilter)}
                    style={{ maxWidth: 300 }} />
                <select className="form-input" value={statusFilter} onChange={e => { setStatusFilter(e.target.value); fetchData(1, search, e.target.value); }}
                    style={{ maxWidth: 150 }}>
                    <option value="">全ステータス</option>
                    <option value="active">公開中</option>
                    <option value="pending_review">審査中</option>
                    <option value="paused">一時停止</option>
                    <option value="draft">下書き</option>
                    <option value="suspended">停止</option>
                    <option value="closed">終了</option>
                </select>
                <button className="btn btn-secondary" onClick={() => fetchData(1, search, statusFilter)}>検索</button>
            </div>

            {loading ? <div className="skeleton" style={{ height: 200 }} /> : (
                <>
                    {meta && <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', marginBottom: 'var(--space-sm)' }}>{meta.total}件</p>}
                    <div className="card" style={{ overflow: 'auto' }}>
                        <table style={{ width: '100%', fontSize: 'var(--font-size-sm)' }}>
                            <thead>
                                <tr style={{ borderBottom: '2px solid var(--color-border)' }}>
                                    <th style={{ textAlign: 'left', padding: '8px', color: 'var(--color-text-muted)', fontWeight: 500 }}>タイトル</th>
                                    <th style={{ textAlign: 'left', padding: '8px', color: 'var(--color-text-muted)', fontWeight: 500 }}>企業</th>
                                    <th style={{ textAlign: 'left', padding: '8px', color: 'var(--color-text-muted)', fontWeight: 500 }}>ステータス</th>
                                    <th style={{ textAlign: 'right', padding: '8px', color: 'var(--color-text-muted)', fontWeight: 500 }}>応募数</th>
                                    <th style={{ textAlign: 'left', padding: '8px', color: 'var(--color-text-muted)', fontWeight: 500 }}>掲載日</th>
                                    <th style={{ textAlign: 'center', padding: '8px', color: 'var(--color-text-muted)', fontWeight: 500 }}>操作</th>
                                </tr>
                            </thead>
                            <tbody>
                                {jobs.map(j => (
                                    <tr key={j.id} style={{ borderBottom: '1px solid var(--color-border)', opacity: j.status === 'suspended' ? 0.7 : 1 }}>
                                        <td style={{ padding: '8px', fontWeight: 600 }}>{j.title}</td>
                                        <td style={{ padding: '8px', color: 'var(--color-text-secondary)' }}>{j.company?.company_name || '—'}</td>
                                        <td style={{ padding: '8px' }}>
                                            <span className={`badge ${JSTATUS[j.status]?.cls || 'badge-info'}`} style={{ fontSize: 10 }}>
                                                {JSTATUS[j.status]?.label || j.status}
                                            </span>
                                        </td>
                                        <td style={{ padding: '8px', textAlign: 'right' }}>{j.applications_count}</td>
                                        <td style={{ padding: '8px', color: 'var(--color-text-muted)', fontSize: 'var(--font-size-xs)' }}>
                                            {j.published_at ? new Date(j.published_at).toLocaleDateString('ja-JP') : '—'}
                                        </td>
                                        <td style={{ padding: '8px', textAlign: 'center' }}>
                                            <div style={{ display: 'flex', gap: 4, justifyContent: 'center' }}>
                                                <button className="btn btn-secondary" style={{ fontSize: 'var(--font-size-xs)', padding: '2px 8px' }}
                                                    onClick={() => window.open(`/jobs/${j.id}`, '_blank')}>
                                                    確認
                                                </button>
                                                {j.status === 'suspended' ? (
                                                    <button className="btn btn-secondary" style={{ fontSize: 'var(--font-size-xs)', padding: '2px 8px' }}
                                                        disabled={processing === j.id}
                                                        onClick={() => handleJobAction(j.id, 'active')}>
                                                        公開
                                                    </button>
                                                ) : (j.status === 'active' || j.status === 'paused') && (
                                                    <button className="btn" style={{ fontSize: 'var(--font-size-xs)', padding: '2px 8px', color: '#ef4444', border: '1px solid #ef4444', background: 'transparent' }}
                                                        disabled={processing === j.id}
                                                        onClick={() => handleJobAction(j.id, 'suspended')}>
                                                        停止
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    {meta && meta.last_page > 1 && (
                        <div style={{ display: 'flex', justifyContent: 'center', gap: 'var(--space-sm)', marginTop: 'var(--space-md)' }}>
                            <button className="btn btn-secondary" disabled={page <= 1} onClick={() => fetchData(page - 1, search, statusFilter)}>前へ</button>
                            <span style={{ fontSize: 'var(--font-size-sm)', alignSelf: 'center' }}>{page} / {meta.last_page}</span>
                            <button className="btn btn-secondary" disabled={page >= meta.last_page} onClick={() => fetchData(page + 1, search, statusFilter)}>次へ</button>
                        </div>
                    )}
                </>
            )}
        </div>
    );
}

/* ============================================
   企業審査タブ
   ============================================ */
function CompaniesTab({ initialData }) {
    const toast = useToast();
    const [companies, setCompanies] = useState(initialData?.data || []);
    const [loading, setLoading] = useState(!initialData);
    const [processing, setProcessing] = useState(null);
    const [page, setPage] = useState(1);
    const [meta, setMeta] = useState(initialData ? { current_page: initialData.current_page, last_page: initialData.last_page, total: initialData.total } : null);

    const fetchData = (p = 1) => {
        setLoading(true);
        api.get('/admin/companies/pending', { params: { page: p } }).then(res => {
            setCompanies(res.data.data || []);
            setMeta({ current_page: res.data.current_page, last_page: res.data.last_page, total: res.data.total });
            setPage(p);
        }).finally(() => setLoading(false));
    };

    useEffect(() => { if (!initialData) fetchData(); }, []);

    const handleReview = async (companyId, status) => {
        const action = status === 'verified' ? '承認' : '却下';
        let note = '';
        if (status === 'rejected') {
            note = prompt('却下理由を入力してください（企業に通知されます）');
            if (note === null) return; // cancelled
        } else {
            if (!confirm(`この企業を${action}しますか？`)) return;
        }
        setProcessing(companyId);
        try {
            await api.put(`/admin/companies/${companyId}/review`, { status, note: note || null });
            setCompanies(companies.filter(c => c.id !== companyId));
            toast.success(status === 'verified' ? '企業を承認しました' : '企業を却下しました');
        } catch (err) {
            const msg = err.response?.data?.message || err.response?.data?.errors
                ? (Object.values(err.response.data.errors || {}).flat().join(' / ') || err.response.data.message)
                : err.message || '処理に失敗しました';
            toast.error(msg);
        } finally {
            setProcessing(null);
        }
    };

    if (loading) return <div className="skeleton" style={{ height: 200 }} />;

    if (companies.length === 0) {
        return (
            <div className="card" style={{ textAlign: 'center', padding: 'var(--space-3xl)', color: 'var(--color-text-muted)' }}>
                審査待ちの企業はありません
            </div>
        );
    }

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
            {companies.map(c => (
                <div key={c.id} className="card">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div style={{ flex: 1 }}>
                            <h3 style={{ marginBottom: 'var(--space-xs)' }}>{c.company_name}</h3>
                            <div style={{ display: 'flex', gap: 'var(--space-sm)', flexWrap: 'wrap', marginBottom: 'var(--space-sm)' }}>
                                <span className="badge badge-info">{c.company_type === 'recruitment_agency' ? '人材紹介会社' : '一般企業'}</span>
                                {c.user && <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>登録者: {c.user.name} ({c.user.email})</span>}
                            </div>
                            {c.description && <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', margin: 0 }}>{c.description}</p>}
                            <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', marginTop: 'var(--space-xs)', display: 'flex', flexWrap: 'wrap', gap: '4px 12px' }}>
                                {c.website && (
                                    <span>Web: <a href={c.website.startsWith('http') ? c.website : `https://${c.website}`} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--color-accent)' }}>{c.website}</a></span>
                                )}
                                {c.phone && <span>Tel: {c.phone}</span>}
                                {c.address && <span>{c.address}</span>}
                                {c.permit_number && (
                                    <span style={{ fontWeight: 600, color: 'var(--color-text-primary)' }}>免許番号: {c.permit_number}</span>
                                )}
                            </div>
                            {c.documents?.length > 0 && (
                                <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-accent)', marginTop: 'var(--space-xs)' }}>
                                    提出書類: {c.documents.length}件
                                </p>
                            )}
                        </div>
                        <div style={{ display: 'flex', gap: 'var(--space-sm)' }}>
                            <button className="btn btn-primary" style={{ fontSize: 'var(--font-size-sm)' }}
                                disabled={processing === c.id}
                                onClick={() => handleReview(c.id, 'verified')}>
                                承認
                            </button>
                            <button className="btn btn-danger" style={{ fontSize: 'var(--font-size-sm)' }}
                                disabled={processing === c.id}
                                onClick={() => handleReview(c.id, 'rejected')}>
                                却下
                            </button>
                        </div>
                    </div>
                </div>
            ))}
            {meta && meta.last_page > 1 && (
                <div style={{ display: 'flex', justifyContent: 'center', gap: 'var(--space-sm)', marginTop: 'var(--space-md)' }}>
                    <button className="btn btn-secondary" disabled={page <= 1} onClick={() => fetchData(page - 1)}>前へ</button>
                    <span style={{ fontSize: 'var(--font-size-sm)', alignSelf: 'center' }}>{page} / {meta.last_page}</span>
                    <button className="btn btn-secondary" disabled={page >= meta.last_page} onClick={() => fetchData(page + 1)}>次へ</button>
                </div>
            )}
        </div>
    );
}

/* ============================================
   求人審査タブ
   ============================================ */
function HelloWorkSyncCard() {
    const toast = useToast();
    const [status, setStatus] = useState(null);
    const [loading, setLoading] = useState(true);
    const [syncing, setSyncing] = useState(false);

    const load = () => {
        api.get('/admin/hellowork-status')
            .then(res => setStatus(res.data))
            .catch(() => {})
            .finally(() => setLoading(false));
    };
    useEffect(() => { load(); }, []);

    const handleSync = async () => {
        if (!confirm('ハローワーク求人を今すぐ同期しますか？（完了まで数分かかります）')) return;
        setSyncing(true);
        try {
            const res = await api.post('/admin/hellowork-sync');
            toast.success(res.data.message);
            setTimeout(load, 5000); // キュー投入後しばらくして状況を再取得
        } catch (err) {
            toast.error('同期の実行に失敗しました');
        } finally {
            setSyncing(false);
        }
    };

    const last = status?.last_sync;
    const hasError = last && last.errors > 0;

    return (
        <div className="card" style={{ padding: 'var(--space-lg)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 'var(--space-md)' }}>
                <div>
                    <p style={{ fontSize: 'var(--font-size-base)', fontWeight: 700, margin: '0 0 6px' }}>
                        🔄 ハローワーク同期状況
                    </p>
                    {loading ? (
                        <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)', margin: 0 }}>読み込み中...</p>
                    ) : (
                        <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', lineHeight: 1.7 }}>
                            <p style={{ margin: 0 }}>
                                有効なハローワーク求人数: <strong style={{ color: 'var(--color-text-primary)' }}>{(status?.active_count ?? 0).toLocaleString()}</strong> 件
                            </p>
                            {last ? (
                                <>
                                    <p style={{ margin: 0 }}>最終同期: {last.at}</p>
                                    <p style={{ margin: 0 }}>
                                        新規 {last.inserted} ／ 更新 {last.updated} ／ 締切 {last.deleted} ／ エラー {last.errors}
                                    </p>
                                    {hasError && (
                                        <p style={{ margin: '4px 0 0', color: 'var(--color-danger)', fontWeight: 600 }}>
                                            ⚠️ {last.note || '同期でエラーが発生しています'}
                                        </p>
                                    )}
                                </>
                            ) : (
                                <p style={{ margin: '4px 0 0', color: 'var(--color-danger)', fontWeight: 600 }}>
                                    ⚠️ まだ同期記録がありません（同期がまだ走っていない可能性があります）
                                </p>
                            )}
                        </div>
                    )}
                </div>
                <button className="btn btn-primary" onClick={handleSync} disabled={syncing} style={{ whiteSpace: 'nowrap' }}>
                    {syncing ? '投入中...' : '今すぐ同期'}
                </button>
            </div>
        </div>
    );
}

function JobsTab({ initialData }) {
    const toast = useToast();
    const [jobs, setJobs] = useState(initialData?.data || []);
    const [loading, setLoading] = useState(!initialData);
    const [processing, setProcessing] = useState(null);
    const [bulkProcessing, setBulkProcessing] = useState(false);
    const [expandedId, setExpandedId] = useState(null);
    const [page, setPage] = useState(1);
    const [meta, setMeta] = useState(initialData ? { current_page: initialData.current_page, last_page: initialData.last_page, total: initialData.total } : null);
    const [selectedIds, setSelectedIds] = useState([]);

    const fetchData = (p = 1) => {
        setLoading(true);
        api.get('/admin/jobs/pending', { params: { page: p } }).then(res => {
            setJobs(res.data.data || []);
            setMeta({ current_page: res.data.current_page, last_page: res.data.last_page, total: res.data.total });
            setPage(p);
            setSelectedIds([]);
        }).finally(() => setLoading(false));
    };

    useEffect(() => { if (!initialData) fetchData(); }, []);

    const toggleSelect = (id) => {
        setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
    };

    const allSelected = jobs.length > 0 && selectedIds.length === jobs.length;
    const toggleSelectAll = () => {
        setSelectedIds(allSelected ? [] : jobs.map(j => j.id));
    };

    const handleBulkReview = async (status) => {
        if (selectedIds.length === 0) return;
        const action = status === 'active' ? '公開' : '停止';
        if (!confirm(`選択した ${selectedIds.length} 件の求人を${action}しますか？`)) return;
        setBulkProcessing(true);
        try {
            const res = await api.put('/admin/jobs/bulk-review', { job_ids: selectedIds, status });
            toast.success(res.data.message);
            setJobs(prev => prev.filter(j => !selectedIds.includes(j.id)));
            setSelectedIds([]);
        } catch (err) {
            toast.error('処理に失敗しました');
        } finally {
            setBulkProcessing(false);
        }
    };

    const handleReview = async (jobId, status) => {
        const action = status === 'active' ? '公開' : '停止';
        let note = '';
        if (status === 'suspended') {
            note = prompt('停止理由を入力してください（企業に通知されます）');
            if (note === null) return;
        } else {
            if (!confirm(`この求人を${action}しますか？`)) return;
        }
        setProcessing(jobId);
        try {
            await api.put(`/admin/jobs/${jobId}/review`, { status, note });
            setJobs(jobs.filter(j => j.id !== jobId));
            setSelectedIds(prev => prev.filter(i => i !== jobId));
        } catch (err) {
            toast.error('処理に失敗しました');
        } finally {
            setProcessing(null);
        }
    };

    if (loading) return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
            <HelloWorkSyncCard />
            <div className="skeleton" style={{ height: 200 }} />
        </div>
    );

    if (jobs.length === 0) {
        return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
                <HelloWorkSyncCard />
                <div className="card" style={{ textAlign: 'center', padding: 'var(--space-3xl)', color: 'var(--color-text-muted)' }}>
                    審査待ちの求人はありません
                </div>
            </div>
        );
    }

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
            <HelloWorkSyncCard />
            {/* 一括操作ツールバー */}
            <div style={{
                display: 'flex', alignItems: 'center', gap: 'var(--space-md)',
                padding: 'var(--space-sm) var(--space-md)',
                background: 'var(--color-bg-secondary)',
                borderRadius: 'var(--radius-md)',
                flexWrap: 'wrap',
            }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-xs)', cursor: 'pointer', fontSize: 'var(--font-size-sm)', userSelect: 'none' }}>
                    <input
                        type="checkbox"
                        checked={allSelected}
                        onChange={toggleSelectAll}
                        style={{ width: 16, height: 16, cursor: 'pointer' }}
                    />
                    全て選択（{jobs.length}件）
                </label>
                {selectedIds.length > 0 && (
                    <>
                        <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-accent)', fontWeight: 600 }}>
                            {selectedIds.length}件選択中
                        </span>
                        <button
                            className="btn btn-primary"
                            style={{ fontSize: 'var(--font-size-sm)' }}
                            disabled={bulkProcessing}
                            onClick={() => handleBulkReview('active')}
                        >
                            {bulkProcessing ? '処理中…' : `一括公開（${selectedIds.length}件）`}
                        </button>
                        <button
                            className="btn btn-danger"
                            style={{ fontSize: 'var(--font-size-sm)' }}
                            disabled={bulkProcessing}
                            onClick={() => handleBulkReview('suspended')}
                        >
                            {bulkProcessing ? '処理中…' : `一括停止（${selectedIds.length}件）`}
                        </button>
                    </>
                )}
            </div>

            {jobs.map(j => (
                <div key={j.id} className="card" style={{
                    borderLeft: selectedIds.includes(j.id)
                        ? '4px solid var(--color-primary)'
                        : j.ng_word_flagged ? '4px solid #ef4444' : undefined,
                }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--space-sm)', flex: 1, minWidth: 0 }}>
                            <input
                                type="checkbox"
                                checked={selectedIds.includes(j.id)}
                                onChange={() => toggleSelect(j.id)}
                                style={{ width: 16, height: 16, marginTop: 4, flexShrink: 0, cursor: 'pointer' }}
                            />
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)', marginBottom: 'var(--space-xs)' }}>
                                    <h3 style={{ margin: 0 }}>{j.title}</h3>
                                    {j.ng_word_flagged && <span className="badge badge-danger" style={{ fontSize: 10 }}>NGワード検出</span>}
                                </div>
                                <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)', marginBottom: 'var(--space-xs)' }}>
                                    {j.company?.company_name || '企業名不明'}
                                    {j.agency_client?.client_name && ` (代理: ${j.agency_client.client_name})`}
                                </p>
                                <div style={{ display: 'flex', gap: 'var(--space-xs)', flexWrap: 'wrap', marginBottom: 'var(--space-xs)' }}>
                                    {j.employment_type && <span className="badge badge-info" style={{ fontSize: 10 }}>{j.employment_type}</span>}
                                    {j.location && <span className="badge badge-info" style={{ fontSize: 10 }}>{j.location}</span>}
                                    {(j.salary_min || j.salary_max) && (
                                        <span className="badge badge-info" style={{ fontSize: 10 }}>
                                            {j.salary_min ? `${Math.round(j.salary_min / 10000)}万` : ''}〜{j.salary_max ? `${Math.round(j.salary_max / 10000)}万円` : ''}
                                        </span>
                                    )}
                                </div>
                                <button style={{
                                    background: 'none', border: 'none', color: 'var(--color-text-accent)',
                                    fontSize: 'var(--font-size-xs)', cursor: 'pointer', padding: 0,
                                }} onClick={() => setExpandedId(expandedId === j.id ? null : j.id)}>
                                    {expandedId === j.id ? '詳細を閉じる ▲' : '詳細を見る ▼'}
                                </button>
                            </div>
                        </div>
                        <div style={{ display: 'flex', gap: 'var(--space-sm)', flexShrink: 0, marginLeft: 'var(--space-sm)' }}>
                            <button className="btn btn-primary" style={{ fontSize: 'var(--font-size-sm)' }}
                                disabled={processing === j.id || bulkProcessing}
                                onClick={() => handleReview(j.id, 'active')}>
                                公開
                            </button>
                            <button className="btn btn-danger" style={{ fontSize: 'var(--font-size-sm)' }}
                                disabled={processing === j.id || bulkProcessing}
                                onClick={() => handleReview(j.id, 'suspended')}>
                                停止
                            </button>
                        </div>
                    </div>

                    {expandedId === j.id && (
                        <div style={{
                            marginTop: 'var(--space-md)', padding: 'var(--space-md)',
                            background: 'var(--color-bg-secondary)', borderRadius: 'var(--radius-md)',
                            fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)',
                        }}>
                            <p style={{ fontWeight: 600, marginBottom: 'var(--space-xs)' }}>仕事内容:</p>
                            <p style={{ whiteSpace: 'pre-wrap', lineHeight: 1.7, marginBottom: 'var(--space-md)' }}>{j.description}</p>
                            {j.requirements && (
                                <>
                                    <p style={{ fontWeight: 600, marginBottom: 'var(--space-xs)' }}>応募要件:</p>
                                    <p style={{ whiteSpace: 'pre-wrap', lineHeight: 1.7, marginBottom: 'var(--space-md)' }}>{j.requirements}</p>
                                </>
                            )}
                            {j.benefits && (
                                <>
                                    <p style={{ fontWeight: 600, marginBottom: 'var(--space-xs)' }}>福利厚生:</p>
                                    <p style={{ whiteSpace: 'pre-wrap', lineHeight: 1.7, marginBottom: 'var(--space-md)' }}>{j.benefits}</p>
                                </>
                            )}
                            {j.working_hours && (
                                <>
                                    <p style={{ fontWeight: 600, marginBottom: 'var(--space-xs)' }}>勤務時間:</p>
                                    <p style={{ whiteSpace: 'pre-wrap', lineHeight: 1.7, marginBottom: 'var(--space-md)' }}>{j.working_hours}</p>
                                </>
                            )}
                            {j.ng_words_detected?.length > 0 && (
                                <div style={{ padding: 'var(--space-sm)', background: 'rgba(239,68,68,0.1)', borderRadius: 'var(--radius-sm)', marginTop: 'var(--space-sm)' }}>
                                    <p style={{ fontWeight: 600, color: '#ef4444', marginBottom: 'var(--space-xs)', fontSize: 'var(--font-size-xs)' }}>検出されたNGワード:</p>
                                    <div style={{ display: 'flex', gap: 'var(--space-xs)', flexWrap: 'wrap' }}>
                                        {j.ng_words_detected.map((w, i) => (
                                            <span key={i} className="badge badge-danger" style={{ fontSize: 10 }}>{w}</span>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            ))}
            {meta && meta.last_page > 1 && (
                <div style={{ display: 'flex', justifyContent: 'center', gap: 'var(--space-sm)', marginTop: 'var(--space-md)' }}>
                    <button className="btn btn-secondary" disabled={page <= 1} onClick={() => fetchData(page - 1)}>前へ</button>
                    <span style={{ fontSize: 'var(--font-size-sm)', alignSelf: 'center' }}>{page} / {meta.last_page}</span>
                    <button className="btn btn-secondary" disabled={page >= meta.last_page} onClick={() => fetchData(page + 1)}>次へ</button>
                </div>
            )}
        </div>
    );
}

/* ============================================
   ライセンス審査タブ
   ============================================ */
function LicenseFileModal({ path, onClose }) {
    const url = `/storage/${path}`;
    const ext = path.split('.').pop().toLowerCase();
    const isImage = ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext);

    React.useEffect(() => {
        const onKey = e => { if (e.key === 'Escape') onClose(); };
        document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
    }, [onClose]);

    return (
        <div
            onClick={onClose}
            style={{
                position: 'fixed', inset: 0, zIndex: 1000,
                background: 'rgba(0,0,0,0.7)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                padding: 'var(--space-lg)',
            }}
        >
            <div
                onClick={e => e.stopPropagation()}
                style={{
                    background: 'var(--color-bg-surface)',
                    borderRadius: 'var(--radius-lg)',
                    width: '100%', maxWidth: 860,
                    maxHeight: '90vh',
                    display: 'flex', flexDirection: 'column',
                    overflow: 'hidden',
                    boxShadow: '0 20px 60px rgba(0,0,0,0.4)',
                }}
            >
                <div style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: 'var(--space-md) var(--space-lg)',
                    borderBottom: '1px solid var(--color-border)',
                }}>
                    <span style={{ fontWeight: 600, fontSize: 'var(--font-size-sm)' }}>提出書類プレビュー</span>
                    <div style={{ display: 'flex', gap: 'var(--space-sm)', alignItems: 'center' }}>
                        <a href={url} download target="_blank" rel="noopener noreferrer"
                            style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-accent)', textDecoration: 'none' }}>
                            ダウンロード
                        </a>
                        <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, lineHeight: 1, color: 'var(--color-text-muted)', padding: '0 4px' }}>×</button>
                    </div>
                </div>
                <div style={{ flex: 1, overflow: 'auto', padding: isImage ? 'var(--space-lg)' : 0, display: 'flex', justifyContent: 'center', alignItems: isImage ? 'flex-start' : 'stretch' }}>
                    {isImage ? (
                        <img src={url} alt="提出書類" style={{ maxWidth: '100%', borderRadius: 'var(--radius-md)', display: 'block' }} />
                    ) : (
                        <iframe
                            src={url}
                            title="提出書類"
                            style={{ width: '100%', height: '75vh', border: 'none', display: 'block' }}
                        />
                    )}
                </div>
            </div>
        </div>
    );
}

function LicensesTab({ initialData }) {
    const toast = useToast();
    const [agencies, setAgencies] = useState(initialData || []);
    const [loading, setLoading] = useState(!initialData);
    const [processing, setProcessing] = useState(null);
    const [previewPath, setPreviewPath] = useState(null);

    const fetchLicenses = () => {
        setLoading(true);
        api.get('/admin/licenses/pending').then(res => {
            setAgencies(res.data || []);
        }).finally(() => setLoading(false));
    };

    useEffect(() => {
        if (initialData) return;
        fetchLicenses();
    }, []);

    const handleReview = async (companyId, approved) => {
        const action = approved ? '承認' : '却下';
        if (!confirm(`このライセンスを${action}しますか？`)) return;
        setProcessing(companyId);
        try {
            await api.put(`/admin/licenses/${companyId}/review`, { approved });
            setAgencies(agencies.filter(a => a.id !== companyId));
        } catch (err) {
            toast.error('処理に失敗しました');
        } finally {
            setProcessing(null);
        }
    };

    if (loading) return <div className="skeleton" style={{ height: 200 }} />;

    if (agencies.length === 0) {
        return (
            <div className="card" style={{ textAlign: 'center', padding: 'var(--space-3xl)', color: 'var(--color-text-muted)' }}>
                <p>ライセンス審査待ちの人材紹介会社はありません</p>
                <button className="btn btn-secondary" style={{ fontSize: 'var(--font-size-sm)', marginTop: 'var(--space-sm)' }} onClick={fetchLicenses}>再読み込み</button>
            </div>
        );
    }

    return (
        <>
            {previewPath && <LicenseFileModal path={previewPath} onClose={() => setPreviewPath(null)} />}
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 'var(--space-sm)' }}>
                <button className="btn btn-secondary" style={{ fontSize: 'var(--font-size-sm)' }} onClick={fetchLicenses} disabled={loading}>
                    {loading ? '読み込み中…' : '再読み込み'}
                </button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
                {agencies.map(a => (
                    <div key={a.id} className="card">
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 'var(--space-md)' }}>
                            <div style={{ flex: 1 }}>
                                <h3 style={{ marginBottom: 'var(--space-xs)' }}>{a.company_name}</h3>
                                <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', marginBottom: 'var(--space-sm)' }}>
                                    {a.user && <p style={{ margin: '0 0 4px' }}>登録者: {a.user.name} ({a.user.email})</p>}
                                    {a.permit_number && <p style={{ margin: '0 0 4px' }}>許可番号: <strong>{a.permit_number}</strong></p>}
                                    {a.created_at && <p style={{ margin: '0 0 4px' }}>申請日: {new Date(a.created_at).toLocaleDateString('ja-JP')}</p>}
                                </div>
                                {a.license_document_path && (
                                    <button
                                        onClick={() => setPreviewPath(a.license_document_path)}
                                        style={{
                                            display: 'inline-flex', alignItems: 'center', gap: 6,
                                            padding: '6px 14px',
                                            background: 'var(--color-bg-muted)',
                                            border: '1px solid var(--color-border)',
                                            borderRadius: 'var(--radius-md)',
                                            cursor: 'pointer',
                                            fontSize: 'var(--font-size-sm)',
                                            fontWeight: 500,
                                            color: 'var(--color-text-primary)',
                                        }}
                                    >
                                        📄 提出書類を確認
                                    </button>
                                )}
                                {!a.license_document_path && (
                                    <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)' }}>書類未提出</span>
                                )}
                            </div>
                            <div style={{ display: 'flex', gap: 'var(--space-sm)', flexShrink: 0 }}>
                                <button className="btn btn-primary" style={{ fontSize: 'var(--font-size-sm)' }}
                                    disabled={processing === a.id}
                                    onClick={() => handleReview(a.id, true)}>
                                    承認
                                </button>
                                <button className="btn btn-danger" style={{ fontSize: 'var(--font-size-sm)' }}
                                    disabled={processing === a.id}
                                    onClick={() => handleReview(a.id, false)}>
                                    却下
                                </button>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </>
    );
}

/* ============================================
   通報管理タブ
   ============================================ */
function ReportsTab({ initialData }) {
    const toast = useToast();
    const [reports, setReports] = useState(initialData?.data || []);
    const [loading, setLoading] = useState(!initialData);
    const [noteForm, setNoteForm] = useState({});
    const [statusFilter, setStatusFilter] = useState('open');

    const fetchData = () => {
        setLoading(true);
        api.get('/admin/reports', { params: statusFilter ? { status: statusFilter } : {} }).then(res => {
            setReports(res.data.data || []);
        }).finally(() => setLoading(false));
    };

    const skipFirstFetch = useRef(!!initialData);
    useEffect(() => {
        if (skipFirstFetch.current) { skipFirstFetch.current = false; return; }
        fetchData();
    }, [statusFilter]);

    const handleResolve = async (reportId, status) => {
        const note = noteForm[reportId];
        if (!note?.trim()) {
            toast.info('管理者メモを入力してください');
            return;
        }
        try {
            const res = await api.put(`/admin/reports/${reportId}/resolve`, {
                status,
                admin_note: note,
            });
            setReports(reports.map(r => r.id === reportId ? res.data.report : r));
            setNoteForm({ ...noteForm, [reportId]: '' });
        } catch (err) {
            toast.error('処理に失敗しました');
        }
    };

    const STATUS_BADGE = { open: 'badge-warning', reviewing: 'badge-info', resolved: 'badge-success' };
    const STATUS_LABEL = { open: '未対応', reviewing: '対応中', resolved: '解決済み' };

    if (loading) return <div className="skeleton" style={{ height: 200 }} />;

    if (reports.length === 0) {
        return (
            <div className="card" style={{ textAlign: 'center', padding: 'var(--space-3xl)', color: 'var(--color-text-muted)' }}>
                通報はありません
            </div>
        );
    }

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
            <div style={{ display: 'flex', gap: 'var(--space-sm)', marginBottom: 'var(--space-sm)' }}>
                <select className="form-select" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
                    style={{ width: 'auto', minWidth: 150, fontSize: 'var(--font-size-sm)' }}>
                    <option value="">全ステータス</option>
                    <option value="open">未対応</option>
                    <option value="reviewing">対応中</option>
                    <option value="resolved">解決済み</option>
                </select>
                <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', alignSelf: 'center' }}>
                    {reports.length}件
                </span>
            </div>
            {reports.map(r => (
                <div key={r.id} className="card" style={{
                    borderLeft: r.status === 'open' ? '4px solid #ef4444' : r.status === 'reviewing' ? '4px solid #f59e0b' : undefined,
                }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--space-sm)' }}>
                        <div>
                            <div style={{ display: 'flex', gap: 'var(--space-sm)', alignItems: 'center', marginBottom: 'var(--space-xs)' }}>
                                <span className={`badge ${STATUS_BADGE[r.status]}`}>{STATUS_LABEL[r.status]}</span>
                                <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
                                    {new Date(r.created_at).toLocaleString('ja-JP')}
                                </span>
                            </div>
                            <p style={{ fontWeight: 600, marginBottom: 'var(--space-xs)' }}>
                                理由: {r.reason}
                            </p>
                            <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', marginBottom: 'var(--space-xs)' }}>
                                {r.description}
                            </p>
                            <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
                                通報者: {r.reporter?.name || '不明'}
                                {r.reported_user && <> | 対象ユーザー: {r.reported_user.name}</>}
                                {r.reported_job && <> | 対象求人: <a href={`/jobs/${r.reported_job.id}`} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--color-text-accent)' }}>{r.reported_job.title}</a></>}
                            </div>
                        </div>
                    </div>

                    {r.admin_note && (
                        <div style={{
                            padding: 'var(--space-sm) var(--space-md)',
                            background: 'rgba(18,28,52,0.05)', borderRadius: 'var(--radius-sm)',
                            fontSize: 'var(--font-size-sm)', marginBottom: 'var(--space-sm)',
                        }}>
                            <span style={{ fontWeight: 600, fontSize: 'var(--font-size-xs)' }}>管理者メモ: </span>
                            {r.admin_note}
                        </div>
                    )}

                    {r.status !== 'resolved' && (
                        <div style={{ display: 'flex', gap: 'var(--space-sm)', alignItems: 'flex-end' }}>
                            <div style={{ flex: 1 }}>
                                <textarea className="form-textarea" rows={2}
                                    value={noteForm[r.id] || ''}
                                    onChange={e => setNoteForm({ ...noteForm, [r.id]: e.target.value })}
                                    placeholder="対応内容を記入..."
                                    style={{ fontSize: 'var(--font-size-sm)' }} />
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-xs)' }}>
                                {r.status === 'open' && (
                                    <button className="btn btn-secondary" style={{ fontSize: 'var(--font-size-xs)' }}
                                        onClick={() => handleResolve(r.id, 'reviewing')}>
                                        対応中にする
                                    </button>
                                )}
                                <button className="btn btn-primary" style={{ fontSize: 'var(--font-size-xs)' }}
                                    onClick={() => handleResolve(r.id, 'resolved')}>
                                    解決済み
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            ))}
        </div>
    );
}

/* ============================================
   監査ログタブ
   ============================================ */
const ACTION_LABELS = {
    'company.approved': '企業承認', 'company.rejected': '企業却下',
    'job.active': '求人公開', 'job.suspended': '求人停止',
    'license.approved': 'ライセンス承認', 'license.rejected': 'ライセンス却下',
    'report.resolved': '通報解決', 'report.reviewing': '通報対応中',
    'user.suspend': 'ユーザー停止', 'user.unsuspend': '停止解除',
    'settings.update': '設定変更',
    'daily_billing_charged': '日額課金成功', 'daily_billing_failed': '日額課金失敗',
    'campaign_billing_charged': 'キャンペーン課金成功', 'campaign_billing_failed': 'キャンペーン課金失敗',
    'job_activation_charged': '求人有効化課金', 'job_billing_failed_webhook': '課金失敗（Webhook）',
    'campaign_billing_failed_webhook': 'キャンペーン課金失敗（Webhook）',
    'stripe_customer_created': 'Stripeカスタマー作成',
    'payment_method_registered': '支払方法登録', 'payment_method_deleted': '支払方法削除',
    'user.deleted': 'ユーザー削除',
};

function AuditLogTab({ initialData }) {
    const [logs, setLogs] = useState(initialData?.data || []);
    const [loading, setLoading] = useState(!initialData);
    const [page, setPage] = useState(initialData?.current_page || 1);
    const [lastPage, setLastPage] = useState(initialData?.last_page || 1);
    const [actionFilter, setActionFilter] = useState('');

    const fetchLogs = (p = 1) => {
        setLoading(true);
        const params = { page: p };
        if (actionFilter) params.action = actionFilter;
        api.get('/admin/audit-logs', { params })
            .then(res => {
                setLogs(res.data.data || []);
                setPage(res.data.current_page || 1);
                setLastPage(res.data.last_page || 1);
            })
            .catch(() => {})
            .finally(() => setLoading(false));
    };

    const skipFirstFetchAudit = useRef(!!initialData);
    useEffect(() => {
        if (skipFirstFetchAudit.current) { skipFirstFetchAudit.current = false; return; }
        fetchLogs();
    }, [actionFilter]);

    return (
        <div>
            <div style={{ display: 'flex', gap: 'var(--space-sm)', marginBottom: 'var(--space-lg)', flexWrap: 'wrap' }}>
                <select className="form-select" value={actionFilter}
                    onChange={e => setActionFilter(e.target.value)}
                    style={{ width: 'auto', minWidth: 150, fontSize: 'var(--font-size-sm)' }}>
                    <option value="">全アクション</option>
                    <option value="company">企業審査</option>
                    <option value="job">求人審査</option>
                    <option value="license">ライセンス</option>
                    <option value="report">通報</option>
                    <option value="user">ユーザー</option>
                    <option value="settings">設定</option>
                </select>
            </div>

            {loading ? <div className="skeleton" style={{ height: 300 }} /> : logs.length === 0 ? (
                <div className="card" style={{ textAlign: 'center', padding: 'var(--space-2xl)', color: 'var(--color-text-muted)' }}>
                    監査ログがありません
                </div>
            ) : (
                <div className="card" style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', fontSize: 'var(--font-size-sm)', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr style={{ borderBottom: '2px solid var(--color-border)', textAlign: 'left' }}>
                                <th style={{ padding: 'var(--space-xs) var(--space-sm)', color: 'var(--color-text-muted)', fontWeight: 600 }}>日時</th>
                                <th style={{ padding: 'var(--space-xs) var(--space-sm)', color: 'var(--color-text-muted)', fontWeight: 600 }}>管理者</th>
                                <th style={{ padding: 'var(--space-xs) var(--space-sm)', color: 'var(--color-text-muted)', fontWeight: 600 }}>操作</th>
                                <th style={{ padding: 'var(--space-xs) var(--space-sm)', color: 'var(--color-text-muted)', fontWeight: 600 }}>対象</th>
                                <th style={{ padding: 'var(--space-xs) var(--space-sm)', color: 'var(--color-text-muted)', fontWeight: 600 }}>詳細</th>
                                <th style={{ padding: 'var(--space-xs) var(--space-sm)', color: 'var(--color-text-muted)', fontWeight: 600 }}>IP</th>
                            </tr>
                        </thead>
                        <tbody>
                            {logs.map(log => (
                                <tr key={log.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                                    <td style={{ padding: 'var(--space-xs) var(--space-sm)', fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', whiteSpace: 'nowrap' }}>
                                        {log.created_at ? new Date(log.created_at).toLocaleString('ja-JP') : '-'}
                                    </td>
                                    <td style={{ padding: 'var(--space-xs) var(--space-sm)' }}>{log.admin?.name || '-'}</td>
                                    <td style={{ padding: 'var(--space-xs) var(--space-sm)' }}>
                                        <span className="badge badge-info">{ACTION_LABELS[log.action] || log.action}</span>
                                    </td>
                                    <td style={{ padding: 'var(--space-xs) var(--space-sm)', fontSize: 'var(--font-size-xs)' }}>
                                        {log.target_type ? (() => {
                                            const typeLabels = { company: '企業', job: '求人', user: 'ユーザー', report: '通報', license: 'ライセンス' };
                                            const label = typeLabels[log.target_type] || log.target_type;
                                            const name = log.target_name || `#${log.target_id}`;
                                            return `${label}: ${name}`;
                                        })() : '-'}
                                    </td>
                                    <td style={{ padding: 'var(--space-xs) var(--space-sm)', fontSize: 'var(--font-size-xs)', maxWidth: 250, cursor: 'pointer' }}
                                        title={log.details || ''}
                                        onClick={e => { const el = e.currentTarget; el.style.whiteSpace = el.style.whiteSpace === 'normal' ? 'nowrap' : 'normal'; }}>
                                        <span style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                            {log.details || '-'}
                                        </span>
                                    </td>
                                    <td style={{ padding: 'var(--space-xs) var(--space-sm)', fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
                                        {log.ip_address || '-'}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {lastPage > 1 && (
                <div style={{ display: 'flex', justifyContent: 'center', gap: 'var(--space-sm)', marginTop: 'var(--space-lg)' }}>
                    <button className="btn btn-secondary" disabled={page <= 1} onClick={() => fetchLogs(page - 1)}>前へ</button>
                    <span style={{ padding: 'var(--space-sm)', fontSize: 'var(--font-size-sm)' }}>{page} / {lastPage}</span>
                    <button className="btn btn-secondary" disabled={page >= lastPage} onClick={() => fetchLogs(page + 1)}>次へ</button>
                </div>
            )}
        </div>
    );
}

/* ============================================
   システム設定タブ
   ============================================ */
const SETTING_LABELS = {
    site_name: { label: 'サイト名', type: 'text' },
    maintenance_mode: { label: 'メンテナンスモード', type: 'select', options: ['false', 'true'] },
    max_jobs_per_company: { label: '企業あたり最大求人数', type: 'number' },
    auto_approve_companies: { label: '企業自動承認', type: 'select', options: ['false', 'true'] },
    default_job_expiry_days: { label: 'デフォルト掲載期限（日）', type: 'number' },
    support_email: { label: 'サポートメール', type: 'text' },
};

function SettingsTab({ initialData }) {
    const [settings, setSettings] = useState(initialData || {});
    const [loading, setLoading] = useState(!initialData);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState(null);

    useEffect(() => {
        if (initialData) return;
        api.get('/admin/settings')
            .then(res => setSettings(res.data || {}))
            .catch(() => {})
            .finally(() => setLoading(false));
    }, []);

    const handleSave = async () => {
        setSaving(true);
        setMessage(null);
        try {
            await api.put('/admin/settings', { settings });
            setMessage({ type: 'success', text: '設定を保存しました' });
        } catch {
            setMessage({ type: 'error', text: '保存に失敗しました' });
        } finally {
            setSaving(false);
        }
    };

    if (loading) return <div className="skeleton" style={{ height: 300 }} />;

    return (
        <div style={{ maxWidth: 600 }}>
            <div className="card">
                <h3 style={{ marginBottom: 'var(--space-lg)' }}>システム設定</h3>

                {message && (
                    <div style={{
                        padding: 'var(--space-sm) var(--space-md)', marginBottom: 'var(--space-md)',
                        borderRadius: 'var(--radius-md)', fontSize: 'var(--font-size-sm)',
                        background: message.type === 'success' ? 'rgba(34,197,94,0.08)' : 'rgba(239,68,68,0.08)',
                        color: message.type === 'success' ? '#16a34a' : '#dc2626',
                    }}>
                        {message.text}
                    </div>
                )}

                {Object.entries(SETTING_LABELS).map(([key, config]) => (
                    <div key={key} className="form-group">
                        <label className="form-label">{config.label}</label>
                        {config.type === 'select' ? (
                            <select className="form-select" value={settings[key] || ''}
                                onChange={e => setSettings(s => ({ ...s, [key]: e.target.value }))}>
                                {config.options.map(o => (
                                    <option key={o} value={o}>{o === 'true' ? '有効' : o === 'false' ? '無効' : o}</option>
                                ))}
                            </select>
                        ) : (
                            <input className="form-input" type={config.type}
                                value={settings[key] || ''}
                                onChange={e => setSettings(s => ({ ...s, [key]: e.target.value }))} />
                        )}
                    </div>
                ))}

                <button className="btn btn-primary" onClick={handleSave} disabled={saving}
                    style={{ marginTop: 'var(--space-md)' }}>
                    {saving ? '保存中...' : '設定を保存'}
                </button>
            </div>
        </div>
    );
}

/* ============================================
   ユーザー詳細モーダル
   ============================================ */
const ROLE_LABELS = { admin: '管理者', company: '企業', jobseeker: '求職者' };
const APP_STATUS_LABELS = {
    pending: '審査中', reviewing: '選考中', interview_scheduled: '面接調整中',
    accepted: '採用', rejected: '不採用', withdrawn: '辞退',
};
const VERIFICATION_LABELS = { unverified: '未申請', pending: '審査中', verified: '承認済', rejected: '却下' };

function UserDetailModal({ userId, onClose }) {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        api.get(`/admin/users/${userId}/detail`)
            .then(res => setData(res.data))
            .catch(() => {})
            .finally(() => setLoading(false));
    }, [userId]);

    return (
        <div style={{
            position: 'fixed', inset: 0, zIndex: 1000,
            background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: 'var(--space-md)',
        }} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
            <div className="card animate-fade-in" style={{
                width: '100%', maxWidth: 600, maxHeight: '85vh', overflow: 'auto',
                padding: 'var(--space-xl)',
            }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-lg)' }}>
                    <h2 style={{ fontSize: 'var(--font-size-xl)', margin: 0 }}>ユーザー詳細</h2>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: 'var(--color-text-muted)' }}>✕</button>
                </div>

                {loading ? <div className="skeleton" style={{ height: 200 }} /> : !data ? (
                    <p style={{ color: 'var(--color-text-muted)' }}>データの取得に失敗しました</p>
                ) : (
                    <>
                        {/* 基本情報 */}
                        <div style={{ marginBottom: 'var(--space-lg)' }}>
                            <h3 style={{ fontSize: 'var(--font-size-base)', marginBottom: 'var(--space-sm)', borderBottom: '2px solid var(--color-accent)', paddingBottom: 4 }}>基本情報</h3>
                            <div style={{ display: 'grid', gridTemplateColumns: '100px 1fr', gap: '4px 12px', fontSize: 'var(--font-size-sm)' }}>
                                <span style={{ color: 'var(--color-text-muted)' }}>名前</span><span>{data.name}</span>
                                <span style={{ color: 'var(--color-text-muted)' }}>メール</span><span>{data.email}</span>
                                <span style={{ color: 'var(--color-text-muted)' }}>役割</span><span>{ROLE_LABELS[data.role] || data.role}</span>
                                <span style={{ color: 'var(--color-text-muted)' }}>登録日</span><span>{new Date(data.created_at).toLocaleDateString('ja-JP')}</span>
                                <span style={{ color: 'var(--color-text-muted)' }}>停止</span>
                                <span>{data.suspended_at ? `${new Date(data.suspended_at).toLocaleDateString('ja-JP')} - ${data.suspension_reason}` : 'なし'}</span>
                                <span style={{ color: 'var(--color-text-muted)' }}>応募数</span><span>{data.applications_count}</span>
                            </div>
                        </div>

                        {/* 企業情報 */}
                        {data.company && (
                            <div style={{ marginBottom: 'var(--space-lg)' }}>
                                <h3 style={{ fontSize: 'var(--font-size-base)', marginBottom: 'var(--space-sm)', borderBottom: '2px solid var(--color-accent)', paddingBottom: 4 }}>企業情報</h3>
                                <div style={{ display: 'grid', gridTemplateColumns: '100px 1fr', gap: '4px 12px', fontSize: 'var(--font-size-sm)' }}>
                                    <span style={{ color: 'var(--color-text-muted)' }}>企業名</span><span>{data.company.company_name}</span>
                                    <span style={{ color: 'var(--color-text-muted)' }}>審査状態</span><span>{VERIFICATION_LABELS[data.company.verification_status] || data.company.verification_status}</span>
                                </div>
                            </div>
                        )}

                        {/* 最近の応募 */}
                        {data.recent_applications?.length > 0 && (
                            <div style={{ marginBottom: 'var(--space-lg)' }}>
                                <h3 style={{ fontSize: 'var(--font-size-base)', marginBottom: 'var(--space-sm)', borderBottom: '2px solid var(--color-accent)', paddingBottom: 4 }}>最近の応募</h3>
                                {data.recent_applications.map(a => (
                                    <div key={a.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: 'var(--font-size-sm)', borderBottom: '1px solid var(--color-border)' }}>
                                        <span>{a.job?.title || `Job #${a.job_id}`}</span>
                                        <span className="badge badge-info" style={{ fontSize: 10 }}>{APP_STATUS_LABELS[a.status] || a.status}</span>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* 管理操作ログ */}
                        {data.audit_logs?.length > 0 && (
                            <div>
                                <h3 style={{ fontSize: 'var(--font-size-base)', marginBottom: 'var(--space-sm)', borderBottom: '2px solid var(--color-accent)', paddingBottom: 4 }}>管理操作履歴</h3>
                                {data.audit_logs.map(log => (
                                    <div key={log.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: 'var(--font-size-xs)', borderBottom: '1px solid var(--color-border)' }}>
                                        <span>{ACTION_LABELS[log.action] || log.action}</span>
                                        <span style={{ color: 'var(--color-text-muted)' }}>
                                            {log.admin?.name} - {log.created_at ? new Date(log.created_at).toLocaleDateString('ja-JP') : ''}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
}

/* ============================================
   メインコンポーネント
   ============================================ */
export default function AdminDashboard() {
    const [searchParams, setSearchParams] = useSearchParams();
    const initialTab = TABS.find(t => t.key === searchParams.get('tab'))?.key || 'overview';
    const [tab, setTabState] = useState(initialTab);
    const [stats, setStats] = useState(null);
    const [statsError, setStatsError] = useState(null);
    const [prefetched, setPrefetched] = useState({});
    const [userDetailId, setUserDetailId] = useState(null);
    const navigate = useNavigate();

    const setTab = (newTab) => {
        setTabState(newTab);
        setSearchParams({ tab: newTab }, { replace: true });
    };

    useEffect(() => {
        // 概要 (stats + 売上サマリー) を1リクエストで取得
        api.get('/admin/overview').then(res => {
            setStats(res.data.stats);
            setPrefetched(p => ({ ...p, revenueSummary: res.data.revenue_summary }));
        }).catch(err => {
            if (err.response?.status === 403 || err.response?.status === 401) {
                navigate('/');
            } else {
                setStatsError(err.response?.data?.message || err.message || '読み込みエラー');
            }
        });
        // 軽量なタブのみ遅延プリフェッチ（重い all-companies / all-jobs はタブ開時にオンデマンドで取得）
        setTimeout(() => {
            api.get('/admin/revenue').then(r => setPrefetched(p => ({ ...p, revenue: r.data }))).catch(() => {});
        }, 1500);
        setTimeout(() => {
            api.get('/admin/companies/pending').then(r => setPrefetched(p => ({ ...p, pendingCompanies: r.data }))).catch(() => {});
            api.get('/admin/licenses/pending').then(r => setPrefetched(p => ({ ...p, pendingLicenses: r.data }))).catch(() => {});
        }, 2500);
        setTimeout(() => {
            api.get('/admin/jobs/pending').then(r => setPrefetched(p => ({ ...p, pendingJobs: r.data }))).catch(() => {});
            api.get('/admin/reports', { params: { status: 'open' } }).then(r => setPrefetched(p => ({ ...p, reports: r.data }))).catch(() => {});
        }, 4000);
        setTimeout(() => {
            api.get('/admin/audit-logs').then(r => setPrefetched(p => ({ ...p, auditLogs: r.data }))).catch(() => {});
            api.get('/admin/settings').then(r => setPrefetched(p => ({ ...p, settings: r.data }))).catch(() => {});
        }, 5500);
    }, []);

    const prefetchTab = (key) => {
        const map = {
            revenue:        () => !prefetched.revenue         && api.get('/admin/revenue').then(r => setPrefetched(p => ({ ...p, revenue: r.data }))).catch(() => {}),
            jobseekers:     () => !prefetched.jobseekers      && api.get('/admin/jobseekers').then(r => setPrefetched(p => ({ ...p, jobseekers: r.data }))).catch(() => {}),
            'all-companies':() => !prefetched.companies       && api.get('/admin/companies/all').then(r => setPrefetched(p => ({ ...p, companies: r.data }))).catch(() => {}),
            'all-jobs':     () => !prefetched.jobs            && api.get('/admin/jobs/all').then(r => setPrefetched(p => ({ ...p, jobs: r.data }))).catch(() => {}),
            companies:      () => !prefetched.pendingCompanies && api.get('/admin/companies/pending').then(r => setPrefetched(p => ({ ...p, pendingCompanies: r.data }))).catch(() => {}),
            jobs:           () => !prefetched.pendingJobs     && api.get('/admin/jobs/pending').then(r => setPrefetched(p => ({ ...p, pendingJobs: r.data }))).catch(() => {}),
            licenses:       () => !prefetched.pendingLicenses && api.get('/admin/licenses/pending').then(r => setPrefetched(p => ({ ...p, pendingLicenses: r.data }))).catch(() => {}),
            reports:        () => !prefetched.reports         && api.get('/admin/reports', { params: { status: 'open' } }).then(r => setPrefetched(p => ({ ...p, reports: r.data }))).catch(() => {}),
            audit:          () => !prefetched.auditLogs       && api.get('/admin/audit-logs').then(r => setPrefetched(p => ({ ...p, auditLogs: r.data }))).catch(() => {}),
            settings:       () => !prefetched.settings        && api.get('/admin/settings').then(r => setPrefetched(p => ({ ...p, settings: r.data }))).catch(() => {}),
        };
        map[key]?.();
    };

    const alertCount = stats
        ? (stats.pending_verifications || 0) + (stats.pending_job_reviews || 0) + (stats.open_reports || 0) + (stats.pending_licenses || 0)
        : 0;

    return (
        <div className="page container animate-fade-in">
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-md)', marginBottom: 'var(--space-xl)' }}>
                <h1 style={{ fontSize: 'var(--font-size-3xl)', margin: 0 }}>運営管理画面</h1>
                {alertCount > 0 && (
                    <span className="badge badge-warning" style={{ fontSize: 'var(--font-size-sm)' }}>
                        {alertCount}件の対応待ち
                    </span>
                )}
            </div>

            {/* タブナビ */}
            <div style={{
                display: 'flex', gap: 'var(--space-xs)', marginBottom: 'var(--space-xl)',
                borderBottom: '2px solid var(--color-border)', paddingBottom: 'var(--space-sm)',
                overflowX: 'auto',
            }}>
                {TABS.map(t => {
                    let badge = null;
                    if (stats) {
                        if (t.key === 'companies' && stats.pending_verifications > 0) badge = stats.pending_verifications;
                        if (t.key === 'jobs' && stats.pending_job_reviews > 0) badge = stats.pending_job_reviews;
                        if (t.key === 'licenses' && stats.pending_licenses > 0) badge = stats.pending_licenses;
                        if (t.key === 'reports' && stats.open_reports > 0) badge = stats.open_reports;
                    }
                    return (
                        <button key={t.key}
                            onClick={() => setTab(t.key)}
                            onMouseEnter={() => prefetchTab(t.key)}
                            style={{
                                padding: '8px 18px', border: 'none', cursor: 'pointer',
                                borderRadius: 'var(--radius-md) var(--radius-md) 0 0',
                                background: tab === t.key ? 'var(--color-accent)' : 'transparent',
                                color: tab === t.key ? '#fff' : 'var(--color-text-secondary)',
                                fontWeight: tab === t.key ? 600 : 400, fontSize: 'var(--font-size-sm)',
                                position: 'relative', whiteSpace: 'nowrap',
                            }}>
                            {t.icon} {t.label}
                            {badge > 0 && (
                                <span style={{
                                    position: 'absolute', top: -4, right: -4,
                                    background: 'var(--color-danger)', color: '#fff', borderRadius: '50%',
                                    width: 18, height: 18, fontSize: 10,
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                }}>{badge}</span>
                            )}
                        </button>
                    );
                })}
            </div>

            {/* タブコンテンツ */}
            {tab === 'overview' && <OverviewTab stats={stats} statsError={statsError} onTabChange={setTab} revenueSummary={prefetched.revenueSummary} />}
            {tab === 'revenue' && <RevenueTab initialData={prefetched.revenue} />}
            {tab === 'jobseekers' && <JobseekersTab initialData={prefetched.jobseekers} onViewUser={setUserDetailId} />}
            {tab === 'all-companies' && <AllCompaniesTab initialData={prefetched.companies} />}
            {tab === 'all-jobs' && <AllJobsTab initialData={prefetched.jobs} />}
            {tab === 'companies' && <CompaniesTab initialData={prefetched.pendingCompanies} />}
            {tab === 'jobs' && <JobsTab initialData={prefetched.pendingJobs} />}
            {tab === 'licenses' && <LicensesTab initialData={prefetched.pendingLicenses} />}
            {tab === 'reports' && <ReportsTab initialData={prefetched.reports} />}
            {tab === 'audit' && <AuditLogTab initialData={prefetched.auditLogs} />}
            {tab === 'settings' && <SettingsTab initialData={prefetched.settings} />}

            {/* ユーザー詳細モーダル */}
            {userDetailId && (
                <UserDetailModal userId={userDetailId} onClose={() => setUserDetailId(null)} />
            )}
        </div>
    );
}
