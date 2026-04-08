import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import api from '../api';
import SEO from '../components/SEO';

function SectionHeader({ icon, title }) {
    return (
        <h3 style={{
            fontSize: 'var(--font-size-base)', fontWeight: 700, marginBottom: 'var(--space-md)',
            color: 'var(--color-text-primary)', display: 'flex', alignItems: 'center', gap: 8,
            paddingBottom: 'var(--space-xs)', borderBottom: '2px solid var(--color-accent)',
        }}>
            <span style={{ fontSize: 16 }}>{icon}</span> {title}
        </h3>
    );
}

function InfoRow({ label, value }) {
    if (!value) return null;
    return (
        <div style={{ display: 'flex', gap: 'var(--space-md)', padding: 'var(--space-sm) 0', borderBottom: '1px solid rgba(0,0,0,0.04)' }}>
            <span style={{ flex: '0 0 120px', fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)', fontWeight: 600 }}>{label}</span>
            <span style={{ flex: 1, fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', whiteSpace: 'pre-wrap', lineHeight: 1.7 }}>{value}</span>
        </div>
    );
}

/* ============================================
   通報モーダル
   ============================================ */
const REPORT_REASONS = [
    { value: 'misleading', label: '虚偽・誤解を招く内容' },
    { value: 'discrimination', label: '差別的な内容' },
    { value: 'illegal', label: '違法な内容' },
    { value: 'duplicate', label: '重複求人' },
    { value: 'spam', label: 'スパム・迷惑行為' },
    { value: 'other', label: 'その他' },
];

function ReportModal({ jobId, onClose }) {
    const [reason, setReason] = useState('');
    const [description, setDescription] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [done, setDone] = useState(false);
    const [error, setError] = useState(null);

    const handleSubmit = async () => {
        if (!reason) { setError('通報理由を選択してください'); return; }
        setSubmitting(true);
        setError(null);
        try {
            await api.post('/reports', {
                reported_job_id: jobId,
                reason,
                description: description || undefined,
            });
            setDone(true);
        } catch (err) {
            setError(err.response?.data?.message || '通報に失敗しました');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div style={{
            position: 'fixed', inset: 0, zIndex: 1000,
            background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: 'var(--space-md)',
        }} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
            <div className="card animate-fade-in" style={{
                width: '100%', maxWidth: 480, padding: 'var(--space-xl)',
            }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-lg)' }}>
                    <h2 style={{ fontSize: 'var(--font-size-xl)', margin: 0 }}>求人を通報する</h2>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: 'var(--color-text-muted)' }}>✕</button>
                </div>

                {done ? (
                    <div style={{ textAlign: 'center', padding: 'var(--space-xl) 0' }}>
                        <p style={{ fontSize: '2rem', marginBottom: 'var(--space-sm)' }}>✓</p>
                        <p style={{ fontWeight: 600, marginBottom: 'var(--space-xs)' }}>通報を受け付けました</p>
                        <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-sm)', marginBottom: 'var(--space-lg)' }}>
                            運営にて確認いたします。ご協力ありがとうございます。
                        </p>
                        <button className="btn btn-secondary" onClick={onClose}>閉じる</button>
                    </div>
                ) : (
                    <>
                        <div className="form-group">
                            <label className="form-label">通報理由 *</label>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-xs)' }}>
                                {REPORT_REASONS.map(r => (
                                    <label key={r.value} style={{
                                        display: 'flex', alignItems: 'center', gap: 'var(--space-sm)',
                                        padding: '8px 12px', borderRadius: 'var(--radius-md)', cursor: 'pointer',
                                        border: reason === r.value ? '2px solid var(--color-accent)' : '1px solid var(--color-border)',
                                        background: reason === r.value ? 'rgba(18,28,52,0.06)' : 'transparent',
                                        fontSize: 'var(--font-size-sm)',
                                    }}>
                                        <input type="radio" name="report_reason" value={r.value}
                                            checked={reason === r.value}
                                            onChange={() => { setReason(r.value); setError(null); }} />
                                        {r.label}
                                    </label>
                                ))}
                            </div>
                        </div>

                        <div className="form-group">
                            <label className="form-label">
                                詳細
                                <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', marginLeft: 8 }}>任意</span>
                            </label>
                            <textarea className="form-textarea" rows={3} value={description}
                                onChange={e => setDescription(e.target.value)}
                                placeholder="具体的な問題点があればご記入ください..." />
                        </div>

                        {error && (
                            <div style={{
                                padding: 'var(--space-sm) var(--space-md)',
                                background: 'rgba(239,68,68,0.08)', borderRadius: 'var(--radius-md)',
                                color: 'var(--color-danger)', fontSize: 'var(--font-size-sm)',
                                marginBottom: 'var(--space-md)',
                            }}>
                                {error}
                            </div>
                        )}

                        <div style={{ display: 'flex', gap: 'var(--space-sm)', justifyContent: 'flex-end' }}>
                            <button className="btn btn-secondary" onClick={onClose}>キャンセル</button>
                            <button className="btn btn-primary" onClick={handleSubmit} disabled={submitting}
                                style={{ background: '#ef4444', borderColor: '#ef4444' }}>
                                {submitting ? '送信中...' : '通報する'}
                            </button>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}

/* ============================================
   応募モーダル
   ============================================ */
function ApplyModal({ job, onClose, onApplied }) {
    const [resumes, setResumes] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedResumeId, setSelectedResumeId] = useState(null);
    const [coverLetter, setCoverLetter] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState(null);
    const navigate = useNavigate();

    useEffect(() => {
        api.get('/resumes').then(res => {
            const list = res.data.resumes || [];
            setResumes(list);
            if (list.length === 1) {
                setSelectedResumeId(list[0].id);
            } else {
                const defaultId = Number(localStorage.getItem('default_resume_id'));
                if (defaultId && list.some(r => r.id === defaultId)) {
                    setSelectedResumeId(defaultId);
                }
            }
        }).catch(() => {}).finally(() => setLoading(false));
    }, []);

    const handleSubmit = async () => {
        if (!selectedResumeId) {
            setError('送信する履歴書を選択してください');
            return;
        }
        setSubmitting(true);
        setError(null);
        try {
            await api.post(`/jobs/${job.id}/apply`, {
                resume_id: selectedResumeId,
                cover_letter: coverLetter || undefined,
            });
            onApplied();
        } catch (err) {
            const msg = err.response?.data?.message;
            if (err.response?.status === 422 && msg?.includes('already')) {
                setError('この求人には既に応募済みです');
            } else {
                setError(msg || '応募に失敗しました。もう一度お試しください。');
            }
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div style={{
            position: 'fixed', inset: 0, zIndex: 1000,
            background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: 'var(--space-md)',
        }} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
            <div className="card animate-fade-in" style={{
                width: '100%', maxWidth: 520, maxHeight: '90vh', overflow: 'auto',
                padding: 'var(--space-xl)',
            }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-lg)' }}>
                    <h2 style={{ fontSize: 'var(--font-size-xl)', margin: 0 }}>応募する</h2>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: 'var(--color-text-muted)' }}>✕</button>
                </div>

                <div style={{
                    padding: 'var(--space-md)', background: 'var(--color-bg-secondary)',
                    borderRadius: 'var(--radius-md)', marginBottom: 'var(--space-lg)',
                }}>
                    <p style={{ fontWeight: 600, margin: 0 }}>{job.title}</p>
                    <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)', margin: 0 }}>
                        {job.company?.company_name}
                    </p>
                </div>

                {loading ? (
                    <div className="skeleton" style={{ height: 100 }} />
                ) : resumes.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: 'var(--space-xl) 0' }}>
                        <p style={{ fontSize: '2rem', marginBottom: 'var(--space-sm)' }}>📄</p>
                        <p style={{ fontWeight: 600, marginBottom: 'var(--space-xs)' }}>履歴書がありません</p>
                        <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-sm)', marginBottom: 'var(--space-lg)' }}>
                            応募するには履歴書を作成してください
                        </p>
                        <button className="btn btn-primary" onClick={() => navigate('/resumes')}>
                            履歴書を作成する
                        </button>
                    </div>
                ) : (
                    <>
                        <div className="form-group">
                            <label className="form-label">送信する履歴書を選択 *</label>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-xs)' }}>
                                {resumes.map(r => (
                                    <label key={r.id} style={{
                                        display: 'flex', alignItems: 'center', gap: 'var(--space-sm)',
                                        padding: '10px 14px', borderRadius: 'var(--radius-md)', cursor: 'pointer',
                                        border: selectedResumeId === r.id ? '2px solid var(--color-accent)' : '1px solid var(--color-border)',
                                        background: selectedResumeId === r.id ? 'rgba(18,28,52,0.06)' : 'transparent',
                                    }}>
                                        <input type="radio" name="resume" value={r.id}
                                            checked={selectedResumeId === r.id}
                                            onChange={() => { setSelectedResumeId(r.id); setError(null); }} />
                                        <div>
                                            <span style={{ fontWeight: 600, fontSize: 'var(--font-size-sm)' }}>{r.title}</span>
                                            <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', marginLeft: 8 }}>
                                                更新: {new Date(r.updated_at).toLocaleDateString('ja-JP')}
                                            </span>
                                        </div>
                                    </label>
                                ))}
                            </div>
                        </div>

                        <div className="form-group">
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 'var(--space-xs)' }}>
                                <label className="form-label" style={{ margin: 0 }}>
                                    志望動機・メッセージ
                                    <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', marginLeft: 8 }}>任意</span>
                                </label>
                                <span style={{
                                    fontSize: 'var(--font-size-xs)',
                                    color: coverLetter.length > 800 ? '#ef4444' : coverLetter.length > 600 ? '#f59e0b' : 'var(--color-text-muted)',
                                    transition: 'color 0.2s',
                                }}>
                                    {coverLetter.length} / 1000文字
                                </span>
                            </div>
                            <textarea className="form-textarea" rows={4} value={coverLetter}
                                onChange={e => { if (e.target.value.length <= 1000) setCoverLetter(e.target.value); }}
                                placeholder="この求人に応募する理由やアピールポイントを記入できます..." />
                            {coverLetter.length === 0 && (
                                <div style={{ display: 'flex', gap: 'var(--space-xs)', flexWrap: 'wrap', marginTop: 'var(--space-xs)' }}>
                                    {['御社の〇〇に魅力を感じ応募しました', 'これまでの経験を活かしたい', '成長できる環境を求めています'].map((hint, i) => (
                                        <button key={i}
                                            type="button"
                                            onClick={() => setCoverLetter(hint)}
                                            style={{
                                                padding: '3px 10px', borderRadius: 'var(--radius-full)',
                                                border: '1px dashed var(--color-border)',
                                                background: 'transparent', cursor: 'pointer',
                                                fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)',
                                                transition: 'all 0.15s',
                                            }}
                                            onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--color-accent)'; e.currentTarget.style.color = 'var(--color-text-accent)'; }}
                                            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--color-border)'; e.currentTarget.style.color = 'var(--color-text-muted)'; }}
                                        >
                                            {hint}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>

                        {error && (
                            <div style={{
                                padding: 'var(--space-sm) var(--space-md)',
                                background: 'rgba(239,68,68,0.08)', borderRadius: 'var(--radius-md)',
                                color: 'var(--color-danger)', fontSize: 'var(--font-size-sm)',
                                marginBottom: 'var(--space-md)',
                            }}>
                                {error}
                            </div>
                        )}

                        <div style={{
                            padding: 'var(--space-sm) var(--space-md)',
                            background: 'rgba(18,28,52,0.05)', borderRadius: 'var(--radius-md)',
                            fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)',
                            marginBottom: 'var(--space-lg)', lineHeight: 1.6,
                        }}>
                            応募すると、選択した履歴書の内容が企業に送信されます。
                            応募後もメッセージ機能で企業とやり取りできます。
                        </div>

                        <div style={{ display: 'flex', gap: 'var(--space-sm)', justifyContent: 'flex-end' }}>
                            <button className="btn btn-secondary" onClick={onClose}>キャンセル</button>
                            <button className="btn btn-primary" onClick={handleSubmit} disabled={submitting}>
                                {submitting ? '送信中...' : '応募する'}
                            </button>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}

export default function JobDetailPage() {
    const { id } = useParams();
    const { user } = useAuth();
    const navigate = useNavigate();
    const [job, setJob] = useState(null);
    const [loading, setLoading] = useState(true);
    const [showApplyModal, setShowApplyModal] = useState(false);
    const [applied, setApplied] = useState(false);
    const [saved, setSaved] = useState(false);
    const [savingJob, setSavingJob] = useState(false);
    const [showReportModal, setShowReportModal] = useState(false);
    const [defaultResume, setDefaultResume] = useState(null);
    const [quickApplying, setQuickApplying] = useState(false);
    const [applySuccess, setApplySuccess] = useState(false);
    const [relatedJobs, setRelatedJobs] = useState([]);

    useEffect(() => {
        api.get(`/jobs/${id}`).then(res => {
            const j = res.data;
            setJob(j);
            // similar_jobsがAPIから来ない場合はクライアント側でフェッチ
            if (!j.similar_jobs || j.similar_jobs.length === 0) {
                const params = { per_page: 4 };
                if (j.job_category_major) params.job_category_major = j.job_category_major;
                else if (j.location) params.location = j.location;
                api.get('/jobs', { params }).then(r => {
                    const list = (r.data.data || []).filter(rj => rj.id !== j.id).slice(0, 3);
                    setRelatedJobs(list);
                }).catch(() => {});
            }
        }).catch(() => navigate('/jobs')).finally(() => setLoading(false));
    }, [id]);

    // 既に応募済みかチェック + 保存済みかチェック + デフォルト履歴書取得
    useEffect(() => {
        if (user?.role === 'jobseeker') {
            api.get('/my-applications').then(res => {
                const found = res.data.some(a => a.job_id === Number(id) && a.type === 'standard');
                setApplied(found);
            }).catch(() => {});
            api.get('/saved-jobs').then(res => {
                const ids = (res.data || []).map(j => typeof j === 'object' ? j.id : j);
                setSaved(ids.includes(Number(id)));
            }).catch(() => {});
            api.get('/resumes').then(res => {
                const list = res.data.resumes || [];
                if (list.length > 0) {
                    const defaultId = Number(localStorage.getItem('default_resume_id'));
                    const found = defaultId && list.find(r => r.id === defaultId);
                    setDefaultResume(found || list[0]);
                }
            }).catch(() => {});
        }
    }, [user, id]);

    const handleQuickApply = async () => {
        if (!defaultResume || quickApplying) return;
        setQuickApplying(true);
        try {
            await api.post(`/jobs/${job.id}/apply`, { resume_id: defaultResume.id });
            setApplied(true);
            setApplySuccess(true);
            setTimeout(() => setApplySuccess(false), 4000);
        } catch (err) {
            if (err.response?.status === 422 && err.response?.data?.message?.includes('already')) {
                setApplied(true);
            } else {
                setShowApplyModal(true);
            }
        } finally {
            setQuickApplying(false);
        }
    };

    const toggleSave = async () => {
        if (savingJob) return;
        setSavingJob(true);
        try {
            if (saved) {
                await api.delete(`/saved-jobs/${id}`);
                setSaved(false);
            } else {
                await api.post(`/saved-jobs/${id}`);
                setSaved(true);
            }
        } catch {
        } finally {
            setSavingJob(false);
        }
    };

    if (loading) return <div className="page container"><div className="skeleton" style={{ height: 400 }} /></div>;
    if (!job) return null;

    // SEO: JSON-LD JobPosting (Google しごと検索対応)
    const jobJsonLd = {
        '@context': 'https://schema.org/',
        '@type': 'JobPosting',
        title: job.title,
        description: job.description?.substring(0, 5000) || '',
        datePosted: job.published_at || job.created_at,
        employmentType: (() => {
            const map = { '正社員': 'FULL_TIME', '契約社員': 'CONTRACTOR', 'パート': 'PART_TIME', '派遣': 'TEMPORARY', '業務委託': 'OTHER', 'インターン': 'INTERN' };
            return map[job.employment_type] || 'OTHER';
        })(),
        hiringOrganization: {
            '@type': 'Organization',
            name: job.company?.company_name || '',
            sameAs: job.company?.website || undefined,
        },
        jobLocation: {
            '@type': 'Place',
            address: {
                '@type': 'PostalAddress',
                addressRegion: job.location || '',
                addressCountry: 'JP',
            },
        },
        ...(job.salary_min || job.salary_max ? {
            baseSalary: {
                '@type': 'MonetaryAmount',
                currency: 'JPY',
                value: {
                    '@type': 'QuantitativeValue',
                    ...(job.salary_min ? { minValue: job.salary_min } : {}),
                    ...(job.salary_max ? { maxValue: job.salary_max } : {}),
                    unitText: 'YEAR',
                },
            },
        } : {}),
    };

    const seoTitle = `${job.title} - ${job.company?.company_name || ''}`;
    const seoDesc = `${job.company?.company_name || ''}の${job.title}。${job.location || ''}${job.employment_type ? ' / ' + job.employment_type : ''}${job.salary_min ? ' / 年収' + Math.round(job.salary_min / 10000) + '万円〜' : ''}`;

    const insuranceText = Array.isArray(job.insurance) ? job.insurance.join(' / ') : job.insurance;
    const benefitsText = (() => {
        if (!job.benefits) return null;
        if (Array.isArray(job.benefits)) return job.benefits.join(' / ');
        if (typeof job.benefits === 'string') return job.benefits;
        return null;
    })();

    const handleApplied = () => {
        setShowApplyModal(false);
        setApplied(true);
    };

    return (
        <div className="page container animate-fade-in">
            <SEO title={seoTitle} description={seoDesc} type="website" jsonLd={jobJsonLd} />
            <div style={{ marginBottom: 'var(--space-md)' }}>
                <button className="btn btn-secondary" onClick={() => navigate('/jobs')} style={{ fontSize: 'var(--font-size-sm)' }}>← 求人一覧に戻る</button>
            </div>

            <div style={{ maxWidth: 800, margin: '0 auto' }}>

                {/* ヘッダーカード */}
                <div className="card" style={{ marginBottom: 'var(--space-md)', padding: 'var(--space-xl)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--space-lg)' }}>
                        <div>
                            <h1 style={{ fontSize: 'var(--font-size-2xl)', marginBottom: 'var(--space-sm)', lineHeight: 1.4 }}>{job.title}</h1>
                            <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-base)' }}>
                                🏢 <Link to={`/companies/${job.company?.id}`} style={{ color: 'var(--color-text-secondary)', textDecoration: 'underline', textUnderlineOffset: 3 }}>{job.company?.company_name}</Link>
                                {job.industry && <span style={{ marginLeft: 8, opacity: 0.7 }}>({job.industry})</span>}
                            </p>
                            <span title="職業安定法・労働基準法に準拠した求人です" style={{
                                display: 'inline-flex', alignItems: 'center', gap: 4,
                                padding: '3px 10px',
                                borderRadius: 'var(--radius-full)',
                                background: 'rgba(52,199,89,0.1)',
                                border: '1px solid rgba(52,199,89,0.3)',
                                fontSize: 'var(--font-size-xs)',
                                color: '#1d8f42',
                                fontWeight: 500,
                                marginTop: 'var(--space-xs)',
                                cursor: 'default',
                            }}>
                                ⚖️ 職業安定法準拠
                            </span>
                        </div>
                        {user?.role === 'jobseeker' ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)', alignItems: 'flex-end' }}>
                                {applied ? (
                                    <span className="badge badge-success" style={{ fontSize: 'var(--font-size-sm)', padding: '8px 16px' }}>
                                        応募済み
                                    </span>
                                ) : defaultResume ? (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-end' }}>
                                        <button className="btn btn-primary btn-lg" onClick={handleQuickApply} disabled={quickApplying}>
                                            {quickApplying ? '送信中...' : 'かんたん応募'}
                                        </button>
                                        <button onClick={() => setShowApplyModal(true)}
                                            style={{ background: 'none', border: 'none', cursor: 'pointer',
                                                fontSize: 'var(--font-size-xs)', color: 'var(--color-text-accent)',
                                                textDecoration: 'underline', padding: 0 }}>
                                            志望動機を添えて応募
                                        </button>
                                    </div>
                                ) : (
                                    <button className="btn btn-primary btn-lg" onClick={() => setShowApplyModal(true)}>
                                        応募する
                                    </button>
                                )}
                                <button
                                    onClick={toggleSave}
                                    disabled={savingJob}
                                    style={{
                                        background: 'none', border: '1px solid var(--color-border)',
                                        borderRadius: 'var(--radius-md)', padding: '6px 14px',
                                        cursor: 'pointer', fontSize: 'var(--font-size-sm)',
                                        color: saved ? 'var(--color-accent)' : 'var(--color-text-secondary)',
                                        fontWeight: saved ? 600 : 400,
                                        transition: 'all 0.2s',
                                    }}
                                >
                                    {saved ? '★ 保存済み' : '☆ 保存する'}
                                </button>
                            </div>
                        ) : !user && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-xs)', alignItems: 'flex-end' }}>
                                <button className="btn btn-primary btn-lg" onClick={() => navigate('/register')}>
                                    登録して応募する
                                </button>
                                <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
                                    Googleアカウントで30秒 /{' '}
                                    <a href="/login" onClick={e => { e.preventDefault(); navigate('/login'); }} style={{ color: 'var(--color-text-accent)' }}>ログイン</a>
                                </span>
                            </div>
                        )}
                    </div>

                    {/* カテゴリ */}
                    {(job.job_category_major || job.job_category_minor) && (
                        <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)', marginBottom: 'var(--space-sm)' }}>
                            {[job.job_category_major, job.job_category_minor].filter(Boolean).join(' > ')}
                        </p>
                    )}

                    {/* バッジ */}
                    <div style={{ display: 'flex', gap: 'var(--space-sm)', flexWrap: 'wrap' }}>
                        {job.is_agency_job && <span className="badge badge-warning">人材紹介</span>}
                        {job.application_type && <span className="badge badge-info">{job.application_type}</span>}
                        {job.employment_type && <span className="badge badge-info">👔 {job.employment_type}</span>}
                        {job.remote_policy && <span className="badge badge-info">🏠 {job.remote_policy}</span>}
                        {job.location && <span className="badge badge-info">📍 {job.location}</span>}
                        {(job.salary_min || job.salary_max) && (
                            <span className="badge badge-success">
                                💰 {job.salary_min ? `${Math.round(job.salary_min / 10000)}万` : ''}
                                {job.salary_min && job.salary_max ? '〜' : ''}
                                {job.salary_max ? `${Math.round(job.salary_max / 10000)}万円` : ''}
                            </span>
                        )}
                        {job.positions_available && <span className="badge badge-info">採用{job.positions_available}名</span>}
                        {job.work_hours && <span className="badge badge-info">🕐 {job.work_hours}</span>}
                        {job.overtime_average && <span className="badge badge-info">⏱ 残業{job.overtime_average}</span>}
                        {job.holidays && <span className="badge badge-info">📅 {job.holidays.includes('年間') ? job.holidays.match(/年間休日\d+日/)?.[0] || job.holidays : job.holidays}</span>}
                        {job.dormitory && job.dormitory !== 'なし' && <span className="badge badge-info">🏠 寮あり</span>}
                    </div>

                    {/* 特徴タグ */}
                    {job.feature_tags?.length > 0 && (
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 'var(--space-sm)' }}>
                            {job.feature_tags.map(tag => (
                                <span key={tag} style={{
                                    padding: '2px 10px', borderRadius: 20, fontSize: 'var(--font-size-xs)',
                                    background: 'rgba(200,149,46,0.08)', color: 'var(--color-accent)',
                                    border: '1px solid rgba(200,149,46,0.2)',
                                }}>{tag}</span>
                            ))}
                        </div>
                    )}
                </div>

                {/* 応募済みバナー */}
                {applied && (
                    <div className="card" style={{
                        marginBottom: 'var(--space-md)', padding: 'var(--space-md) var(--space-lg)',
                        background: 'rgba(34,197,94,0.06)', border: '1px solid rgba(34,197,94,0.2)',
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    }}>
                        <p style={{ margin: 0, fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>
                            この求人に応募済みです
                        </p>
                        <button className="btn btn-secondary" style={{ fontSize: 'var(--font-size-xs)' }}
                            onClick={() => navigate('/applications')}>
                            応募状況を確認
                        </button>
                    </div>
                )}

                {/* アピールポイント */}
                {job.appeal_points && (
                    <div className="card" style={{ marginBottom: 'var(--space-md)', padding: 'var(--space-lg)', background: 'rgba(245,158,11,0.04)', border: '1px solid rgba(245,158,11,0.15)' }}>
                        <p style={{ fontSize: 'var(--font-size-sm)', fontWeight: 700, color: '#d97706', marginBottom: 'var(--space-sm)' }}>
                            この求人のポイント
                        </p>
                        <p style={{ color: 'var(--color-text-secondary)', whiteSpace: 'pre-wrap', lineHeight: 1.7, fontSize: 'var(--font-size-sm)', margin: 0 }}>
                            {job.appeal_points}
                        </p>
                    </div>
                )}

                {/* 写真ギャラリー */}
                {job.photos?.length > 0 && (
                    <div className="card" style={{ marginBottom: 'var(--space-md)', padding: 'var(--space-lg)' }}>
                        <SectionHeader icon="📷" title="写真" />
                        <div style={{
                            display: 'grid',
                            gridTemplateColumns: job.photos.length === 1 ? '1fr' : 'repeat(auto-fill, minmax(220px, 1fr))',
                            gap: 'var(--space-sm)',
                        }}>
                            {job.photos.map(photo => (
                                <div key={photo.id} style={{
                                    borderRadius: 'var(--radius-md)',
                                    overflow: 'hidden',
                                    border: '1px solid var(--color-border)',
                                    position: 'relative',
                                }}>
                                    <img
                                        src={photo.url}
                                        alt={photo.caption || '求人写真'}
                                        style={{ width: '100%', height: 200, objectFit: 'cover', display: 'block' }}
                                    />
                                    {photo.caption && (
                                        <p style={{
                                            padding: '6px 10px',
                                            margin: 0,
                                            fontSize: 'var(--font-size-xs)',
                                            color: 'var(--color-text-muted)',
                                            background: 'var(--color-bg-surface)',
                                        }}>
                                            {photo.caption}
                                        </p>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* 募集背景 */}
                {job.recruitment_background && (
                    <div className="card" style={{ marginBottom: 'var(--space-md)', padding: 'var(--space-lg)', background: 'rgba(18,28,52,0.02)' }}>
                        <p style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: 4 }}>募集背景</p>
                        <p style={{ color: 'var(--color-text-secondary)', whiteSpace: 'pre-wrap', lineHeight: 1.7, fontSize: 'var(--font-size-sm)', margin: 0 }}>
                            {job.recruitment_background}
                        </p>
                    </div>
                )}

                {/* 仕事内容 */}
                <div className="card" style={{ marginBottom: 'var(--space-md)', padding: 'var(--space-xl)' }}>
                    <SectionHeader icon="📋" title="仕事内容" />
                    <p style={{ color: 'var(--color-text-secondary)', whiteSpace: 'pre-wrap', lineHeight: 1.8 }}>
                        {job.description}
                    </p>
                    {job.scope_of_change && (
                        <div style={{ marginTop: 'var(--space-md)', padding: 'var(--space-sm) var(--space-md)', background: 'var(--color-bg-secondary)', borderRadius: 'var(--radius-sm)' }}>
                            <InfoRow label="変更の範囲" value={job.scope_of_change} />
                        </div>
                    )}
                </div>

                {/* 応募要件 */}
                {(job.requirements || job.preferred_qualifications) && (
                    <div className="card" style={{ marginBottom: 'var(--space-md)', padding: 'var(--space-xl)' }}>
                        <SectionHeader icon="✅" title="応募要件" />
                        {job.requirements && (
                            <p style={{ color: 'var(--color-text-secondary)', whiteSpace: 'pre-wrap', lineHeight: 1.8 }}>
                                {job.requirements}
                            </p>
                        )}
                        {job.preferred_qualifications && (
                            <div style={{ marginTop: 'var(--space-md)' }}>
                                <p style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: 4 }}>歓迎条件</p>
                                <p style={{ color: 'var(--color-text-secondary)', whiteSpace: 'pre-wrap', lineHeight: 1.8, margin: 0 }}>
                                    {job.preferred_qualifications}
                                </p>
                            </div>
                        )}
                    </div>
                )}

                {/* 給与・待遇 */}
                <div className="card" style={{ marginBottom: 'var(--space-md)', padding: 'var(--space-xl)' }}>
                    <SectionHeader icon="💰" title="給与・待遇" />
                    <InfoRow label="給与" value={
                        job.salary_details || (job.salary_min || job.salary_max
                            ? `${job.salary_type || '年収'} ${job.salary_min ? `${(job.salary_min / 10000).toLocaleString()}万` : ''}${job.salary_min && job.salary_max ? '〜' : ''}${job.salary_max ? `${(job.salary_max / 10000).toLocaleString()}万円` : ''}`
                            : null)
                    } />
                    <InfoRow label="昇給" value={job.raise_frequency} />
                    <InfoRow label="賞与" value={job.bonus} />
                    <InfoRow label="手当" value={job.allowances} />
                    <InfoRow label="福利厚生" value={benefitsText} />
                    <InfoRow label="社会保険" value={insuranceText} />
                </div>

                {/* 勤務条件 */}
                <div className="card" style={{ marginBottom: 'var(--space-md)', padding: 'var(--space-xl)' }}>
                    <SectionHeader icon="🏢" title="勤務条件" />
                    <InfoRow label="勤務時間" value={job.work_hours} />
                    <InfoRow label="残業" value={job.overtime_average} />
                    <InfoRow label="休日・休暇" value={job.holidays} />
                    <InfoRow label="休暇詳細" value={job.holiday_details} />
                    <InfoRow label="リモート" value={job.remote_policy} />
                    <InfoRow label="勤務地" value={job.location} />
                    {job.office_address && <InfoRow label="詳細住所" value={job.office_address} />}
                    {job.nearest_station && <InfoRow label="最寄り駅" value={job.nearest_station} />}
                    {job.access_info && <InfoRow label="アクセス" value={job.access_info} />}
                    {job.transfer_policy && <InfoRow label="転勤" value={job.transfer_policy} />}
                    {job.contract_period && <InfoRow label="契約期間" value={job.contract_period} />}
                    {job.location_scope_of_change && <InfoRow label="勤務地変更の範囲" value={job.location_scope_of_change} />}
                    {job.dormitory && <InfoRow label="寮" value={job.dormitory} />}
                    {job.smoking_policy && <InfoRow label="受動喫煙対策" value={job.smoking_policy} />}
                </div>

                {/* 試用期間 */}
                {job.probation_period && (
                    <div className="card" style={{ marginBottom: 'var(--space-md)', padding: 'var(--space-xl)' }}>
                        <SectionHeader icon="📝" title="試用期間" />
                        <InfoRow label="期間" value={job.probation_period} />
                        <InfoRow label="条件" value={job.probation_conditions} />
                    </div>
                )}

                {/* 職場環境・社風 */}
                {(job.work_environment || job.company_culture) && (
                    <div className="card" style={{ marginBottom: 'var(--space-md)', padding: 'var(--space-xl)' }}>
                        <SectionHeader icon="👥" title="職場環境・社風" />
                        {job.work_environment && (
                            <>
                                <p style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: 4 }}>チーム構成</p>
                                <p style={{ color: 'var(--color-text-secondary)', whiteSpace: 'pre-wrap', lineHeight: 1.8, marginBottom: 'var(--space-lg)' }}>
                                    {job.work_environment}
                                </p>
                            </>
                        )}
                        {job.company_culture && (
                            <>
                                <p style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: 4 }}>社風・カルチャー</p>
                                <p style={{ color: 'var(--color-text-secondary)', whiteSpace: 'pre-wrap', lineHeight: 1.8, margin: 0 }}>
                                    {job.company_culture}
                                </p>
                            </>
                        )}
                    </div>
                )}

                {/* 選考について */}
                {(job.selection_process || job.required_documents || job.estimated_timeline) && (
                    <div className="card" style={{ marginBottom: 'var(--space-md)', padding: 'var(--space-xl)' }}>
                        <SectionHeader icon="📊" title="選考について" />
                        {job.selection_process && (
                            <p style={{ color: 'var(--color-text-secondary)', whiteSpace: 'pre-wrap', lineHeight: 1.8, marginBottom: 'var(--space-md)' }}>
                                {job.selection_process}
                            </p>
                        )}
                        <InfoRow label="必要書類" value={job.required_documents} />
                        <InfoRow label="選考期間" value={job.estimated_timeline} />
                    </div>
                )}

                {/* 企業情報（人材紹介の場合は紹介先・紹介元両方表示） */}
                {job.is_agency_job && job.client_company ? (
                    <>
                        {/* 紹介先企業（求人元） */}
                        <div className="card" style={{ marginBottom: 'var(--space-md)', padding: 'var(--space-xl)' }}>
                            <SectionHeader icon="🏢" title="求人企業（紹介先）" />
                            <InfoRow label="会社名" value={job.client_company.name} />
                            <InfoRow label="業界" value={job.client_company.industry} />
                            <InfoRow label="従業員数" value={job.client_company.employees} />
                            <InfoRow label="所在地" value={job.client_company.address} />
                            {job.client_company.description && (
                                <div style={{ marginTop: 'var(--space-md)' }}>
                                    <p style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: 4 }}>企業概要</p>
                                    <p style={{ color: 'var(--color-text-secondary)', whiteSpace: 'pre-wrap', lineHeight: 1.7, fontSize: 'var(--font-size-sm)', margin: 0 }}>
                                        {job.client_company.description}
                                    </p>
                                </div>
                            )}
                        </div>
                        {/* 紹介元（人材紹介会社） */}
                        <div className="card" style={{ marginBottom: 'var(--space-md)', padding: 'var(--space-xl)', background: 'var(--color-bg-surface)' }}>
                            <SectionHeader icon="🤝" title="紹介会社" />
                            <InfoRow label="会社名" value={job.agency_company?.name} />
                            <InfoRow label="許可番号" value={job.agency_company?.permit_number} />
                            <InfoRow label="所在地" value={job.agency_company?.address} />
                            <InfoRow label="電話番号" value={job.agency_company?.phone} />
                            <InfoRow label="HP" value={job.agency_company?.website} />
                        </div>
                    </>
                ) : (job.number_of_employees || job.founded_year || job.industry) && (
                    <div className="card" style={{ marginBottom: 'var(--space-md)', padding: 'var(--space-xl)' }}>
                        <SectionHeader icon="🏛" title="企業情報" />
                        <InfoRow label="会社名" value={job.company?.company_name} />
                        <InfoRow label="業界" value={job.industry} />
                        <InfoRow label="設立" value={job.founded_year} />
                        <InfoRow label="従業員数" value={job.number_of_employees} />
                        {job.company?.website && <InfoRow label="HP" value={job.company.website} />}
                    </div>
                )}

                {/* 備考 */}
                {job.notes && (
                    <div className="card" style={{ marginBottom: 'var(--space-md)', padding: 'var(--space-lg)', background: 'var(--color-bg-surface)' }}>
                        <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)', lineHeight: 1.7, margin: 0 }}>
                            {job.notes}
                        </p>
                    </div>
                )}

                {job.agency_display && (
                    <div className="card" style={{ marginBottom: 'var(--space-md)', padding: 'var(--space-md)', background: 'var(--color-bg-surface)' }}>
                        <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
                            ⚖️ {job.agency_display}
                        </p>
                    </div>
                )}

                {/* 応募成功通知 */}
                {applySuccess && (
                    <div style={{
                        position: 'fixed', top: 80, left: '50%', transform: 'translateX(-50%)',
                        padding: 'var(--space-md) var(--space-xl)',
                        background: '#10b981', color: '#fff', borderRadius: 'var(--radius-lg)',
                        fontSize: 'var(--font-size-sm)', fontWeight: 600,
                        boxShadow: '0 4px 20px rgba(16,185,129,0.3)', zIndex: 200,
                        animation: 'fadeIn 0.3s ease',
                    }}>
                        応募が完了しました！ 企業からの連絡をお待ちください。
                    </div>
                )}

                {/* 固定フッター応募ボタン（求職者・未応募時） */}
                {user?.role === 'jobseeker' && !applied && (
                    <div style={{
                        position: 'fixed', bottom: 0, left: 0, right: 0,
                        padding: 'var(--space-md) var(--space-xl)',
                        background: 'var(--color-bg-primary)',
                        borderTop: '1px solid var(--color-border)',
                        display: 'flex', justifyContent: 'center', gap: 'var(--space-md)',
                        alignItems: 'center', zIndex: 100,
                        boxShadow: '0 -2px 10px rgba(0,0,0,0.08)',
                    }}>
                        {defaultResume ? (
                            <>
                                <button className="btn btn-primary btn-lg" style={{ minWidth: 220 }}
                                    onClick={handleQuickApply} disabled={quickApplying}>
                                    {quickApplying ? '送信中...' : 'かんたん応募'}
                                </button>
                                <button className="btn btn-secondary" style={{ fontSize: 'var(--font-size-sm)' }}
                                    onClick={() => setShowApplyModal(true)}>
                                    志望動機を添える
                                </button>
                            </>
                        ) : (
                            <button className="btn btn-primary btn-lg" style={{ minWidth: 280 }}
                                onClick={() => setShowApplyModal(true)}>
                                この求人に応募する
                            </button>
                        )}
                    </div>
                )}

                {/* ゲスト向け応募CTA */}
                {!user && (
                    <div className="card" style={{
                        padding: 'var(--space-xl)',
                        background: 'linear-gradient(135deg, rgba(18,28,52,0.08) 0%, rgba(168,85,247,0.05) 100%)',
                        border: '1px solid rgba(18,28,52,0.2)',
                        textAlign: 'center',
                    }}>
                        <h3 style={{ marginBottom: 'var(--space-sm)' }}>この求人に応募しますか？</h3>
                        <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-sm)', marginBottom: 'var(--space-lg)', lineHeight: 1.7 }}>
                            無料登録（30秒）するだけで応募できます。<br />
                            Googleアカウントがあれば今すぐ始められます。
                        </p>
                        <div style={{ display: 'flex', gap: 'var(--space-md)', justifyContent: 'center', flexWrap: 'wrap' }}>
                            <button className="btn btn-primary btn-lg" onClick={() => navigate('/register')}>
                                無料登録して応募する
                            </button>
                            <button className="btn btn-secondary btn-lg" onClick={() => navigate('/login')}>
                                ログインして応募する
                            </button>
                        </div>
                    </div>
                )}

                {/* 通報ボタン */}
                {user && (
                    <div style={{ textAlign: 'right', marginBottom: 'var(--space-md)' }}>
                        <button
                            onClick={() => setShowReportModal(true)}
                            style={{
                                background: 'none', border: 'none', cursor: 'pointer',
                                fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)',
                                textDecoration: 'underline', padding: '4px 0',
                            }}
                        >
                            この求人を通報する
                        </button>
                    </div>
                )}

                {/* 似ている求人 */}
                {(() => {
                    const list = (job.similar_jobs?.length > 0 ? job.similar_jobs : relatedJobs);
                    if (list.length === 0) return null;
                    return (
                        <div className="card" style={{ marginBottom: 'var(--space-md)', padding: 'var(--space-xl)' }}>
                            <SectionHeader icon="🔗" title="関連する求人" />
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
                                {list.map(sj => (
                                    <Link key={sj.id} to={`/jobs/${sj.id}`} style={{
                                        display: 'block', textDecoration: 'none', color: 'inherit',
                                        padding: 'var(--space-md)', borderRadius: 'var(--radius-md)',
                                        border: '1px solid var(--color-border)', transition: 'all 0.15s',
                                    }} onMouseEnter={e => { e.currentTarget.style.background = 'var(--color-bg-secondary)'; e.currentTarget.style.borderColor = 'var(--color-accent)'; }}
                                       onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = 'var(--color-border)'; }}>
                                        <p style={{ fontWeight: 600, fontSize: 'var(--font-size-sm)', margin: '0 0 4px 0' }}>{sj.title}</p>
                                        <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', margin: '0 0 6px 0' }}>
                                            🏢 {sj.company?.company_name}
                                        </p>
                                        <div style={{ display: 'flex', gap: 'var(--space-sm)', flexWrap: 'wrap' }}>
                                            {sj.employment_type && <span className="badge badge-info" style={{ fontSize: 'var(--font-size-xs)' }}>{sj.employment_type}</span>}
                                            {sj.location && <span className="badge badge-info" style={{ fontSize: 'var(--font-size-xs)' }}>📍 {sj.location}</span>}
                                            {(sj.salary_min || sj.salary_max) && (
                                                <span className="badge badge-success" style={{ fontSize: 'var(--font-size-xs)' }}>
                                                    💰 {sj.salary_min ? `${Math.round(sj.salary_min / 10000)}万` : ''}
                                                    {sj.salary_min && sj.salary_max ? '〜' : ''}
                                                    {sj.salary_max ? `${Math.round(sj.salary_max / 10000)}万円` : ''}
                                                </span>
                                            )}
                                        </div>
                                    </Link>
                                ))}
                            </div>
                            <div style={{ marginTop: 'var(--space-md)', textAlign: 'center' }}>
                                <Link to={`/jobs${job.job_category_major ? `?job_category_major=${encodeURIComponent(job.job_category_major)}` : ''}`}
                                    style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-accent)' }}>
                                    {job.job_category_major ? `${job.job_category_major}の求人をもっと見る →` : '求人一覧を見る →'}
                                </Link>
                            </div>
                        </div>
                    );
                })()}

                {/* 固定フッターの分のスペーサー */}
                {user?.role === 'jobseeker' && !applied && <div style={{ height: 80 }} />}
            </div>

            {/* 応募モーダル */}
            {showApplyModal && (
                <ApplyModal job={job} onClose={() => setShowApplyModal(false)} onApplied={handleApplied} />
            )}

            {/* 通報モーダル */}
            {showReportModal && (
                <ReportModal jobId={job.id} onClose={() => setShowReportModal(false)} />
            )}
        </div>
    );
}
