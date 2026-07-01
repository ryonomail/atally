import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import api from '../api';
import SEO from '../components/SEO';
import { formatSalary } from '../utils/salary';
import { ArrowLeft, Bookmark, BookmarkCheck, FileText, MapPin } from 'lucide-react';

// 残業表記の正規化：重複（月平均月平均…時間時間）を圧縮し、数字のみには単位を補う
function formatOvertime(v) {
    if (v == null || v === '') return v;
    let s = String(v).trim().replace(/(月平均)+/g, '月平均').replace(/(時間)+/g, '時間');
    if (/^\d+(\.\d+)?$/.test(s)) s = s + '時間';
    return s;
}

// 地図ピンのクエリを決定（誤ピン・複数ピン・未ピンを防ぐ）:
//  1) office_address が都道府県から始まらない断片なら location(都道府県+市区町村) を前置
//  2) 建物名・階・「」( )補足を除去
//  3) 物流拠点・施設名など複数ピンになりやすい語が残る/詳細住所が無い場合は 市区町村にフォールバック
const HARD_FACILITY_RE = /(ロジスティクス|ターミナル|工業団地|物流|倉庫|流通|パーク|マルシェ|モール|アリーナ|スタジアム|キャンパス)/;
const BLDG_STRIP_RE = /(ビル|ビルディング|マンション|ハイツ|コーポ|タワー|プラザ|スクエア|ゲート|号室|Ｆ|階).*$/;
function mapPinQuery(job) {
    const region = [job.prefecture, job.city].filter(Boolean).join('') || String(job.location || '').trim();
    let a = String(job.office_address || '').trim();
    if (!a) return region || null;
    a = a.split(/[\s　「（(【]/)[0].replace(BLDG_STRIP_RE, '').trim();
    if (!a) return region || null;
    const startsWithPref = /^(北海道|東京都|京都府|大阪府|..県|...県)/.test(a);
    const full = (!startsWithPref && region) ? region + a : a;
    if (HARD_FACILITY_RE.test(full)) return region || null;
    return full || region || null;
}

function SectionHeader({ title }) {
    return (
        <div style={{
            display: 'flex', alignItems: 'center', gap: 'var(--space-sm)',
            padding: 'var(--space-md) var(--space-xl)',
            borderBottom: '1px solid var(--color-border)',
            background: 'var(--color-bg-secondary)',
        }}>
            <span style={{ width: 3, height: 14, background: 'var(--color-accent)', borderRadius: 2, flexShrink: 0 }} />
            <h3 style={{
                fontSize: 'var(--font-size-sm)', fontWeight: 700, margin: 0,
                color: 'var(--color-navy)', letterSpacing: 0.2,
            }}>
                {title}
            </h3>
        </div>
    );
}

function InfoRow({ label, value }) {
    if (!value) return null;
    return (
        <div style={{
            display: 'flex', gap: 'var(--space-md)',
            padding: '10px var(--space-xl)',
            borderBottom: '1px solid var(--color-border)',
        }}>
            <div style={{
                flex: '0 0 110px', paddingTop: 1,
                fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)', fontWeight: 600,
            }}>{label}</div>
            <div style={{
                flex: 1,
                fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)',
                whiteSpace: 'pre-wrap', lineHeight: 1.7,
            }}>{value}</div>
        </div>
    );
}

function InfoTable({ children }) {
    return <div>{children}</div>;
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
                                        border: reason === r.value ? '1.5px solid var(--color-navy)' : '1px solid var(--color-border)',
                                        background: reason === r.value ? 'rgba(18,28,52,0.05)' : 'transparent',
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
                        <FileText size={28} strokeWidth={1.75} style={{ color: 'var(--color-text-muted)', marginBottom: 'var(--space-sm)' }} />
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
                                        border: selectedResumeId === r.id ? '1.5px solid var(--color-navy)' : '1px solid var(--color-border)',
                                        background: selectedResumeId === r.id ? 'rgba(18,28,52,0.05)' : 'transparent',
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
    const salaryUnitMap = { '時給': 'HOUR', '日給': 'DAY', '月給': 'MONTH', '年収': 'YEAR' };
    const salaryUnit = salaryUnitMap[job.salary_type] || 'MONTH';
    const jobJsonLd = {
        '@context': 'https://schema.org/',
        '@type': 'JobPosting',
        title: job.title,
        description: (() => {
            const raw = job.description || '';
            // 【】ヘッダーを除去してプレーンテキストに
            return raw.replace(/【[^】]+】\n?/g, '').trim().substring(0, 5000) || job.title;
        })(),
        datePosted: job.published_at || job.created_at,
        validThrough: job.expires_at || undefined,
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
                addressRegion: job.prefecture || job.location || '',
                addressLocality: job.city || undefined,
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
                    unitText: salaryUnit,
                },
            },
        } : {}),
    };

    const seoTitle = `${job.title} - ${job.company?.company_name || ''}`;
    const seoDesc = (() => {
        const parts = [job.company?.company_name, job.title].filter(Boolean).join('の') + '。';
        const info = [
            job.location,
            job.employment_type,
            formatSalary(job),
            job.work_hours,
            job.holidays?.split(/[、,]/)[0],
        ].filter(Boolean).join(' / ');
        const bodyRaw = (job.description || '').replace(/【[^】]+】\n?/g, '').trim();
        const body = bodyRaw.substring(0, 80);
        return (parts + (info ? info + '。' : '') + body).substring(0, 160);
    })();

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
                <button className="btn btn-secondary" onClick={() => navigate('/jobs')} style={{ fontSize: 'var(--font-size-sm)', gap: 6 }}>
                    <ArrowLeft size={15} strokeWidth={2} /> 求人一覧に戻る
                </button>
            </div>

            <div style={{ maxWidth: 800, margin: '0 auto' }}>

                {/* ヘッダーカード */}
                <div className="card" style={{ marginBottom: 'var(--space-md)', padding: 'var(--space-xl)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--space-lg)' }}>
                        <div>
                            <h1 style={{ fontSize: 'var(--font-size-2xl)', marginBottom: 'var(--space-sm)', lineHeight: 1.4, color: 'var(--color-navy)' }}>{job.title}</h1>
                            <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-base)' }}>
                                {job.source === 'hellowork'
                                    ? <span>{job.employer_name || job.company?.company_name}</span>
                                    : <Link to={`/companies/${job.company?.id}`} style={{ color: 'var(--color-text-secondary)', textDecoration: 'underline', textUnderlineOffset: 3 }}>{job.company?.company_name}</Link>}
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
                                職業安定法準拠
                            </span>
                        </div>
                        {job.source === 'hellowork' ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-xs)', alignItems: 'flex-end' }}>
                                <span style={{
                                    display: 'inline-flex', alignItems: 'center', gap: 6,
                                    padding: '6px 14px', borderRadius: 'var(--radius-full)',
                                    background: 'rgba(0,112,185,0.08)', border: '1px solid rgba(0,112,185,0.25)',
                                    fontSize: 'var(--font-size-xs)', color: '#0070b9', fontWeight: 600,
                                }}>
                                    ハローワーク掲載求人
                                </span>
                                {job.hellowork_id && (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                        <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>求人番号：</span>
                                        <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: 700, color: 'var(--color-text-primary)', letterSpacing: 1 }}>{job.hellowork_id}</span>
                                        <button
                                            onClick={() => navigator.clipboard.writeText(job.hellowork_id)}
                                            style={{ background: 'none', border: '1px solid var(--color-border)', borderRadius: 4, padding: '1px 6px', fontSize: 10, cursor: 'pointer', color: 'var(--color-text-muted)' }}
                                        >コピー</button>
                                    </div>
                                )}
                            </div>
                        ) : user?.role === 'jobseeker' ? (
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
                                        display: 'inline-flex', alignItems: 'center', gap: 6,
                                    }}
                                >
                                    {saved ? <><BookmarkCheck size={15} strokeWidth={2} /> 保存済み</> : <><Bookmark size={15} strokeWidth={2} /> 保存する</>}
                                </button>
                            </div>
                        ) : !user && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-xs)', alignItems: 'flex-end' }}>
                                <button className="btn btn-primary btn-lg" onClick={() => navigate(`/resumes/guest?from_job=${job.id}`)} style={{ gap: 8 }}>
                                    <FileText size={17} strokeWidth={2} /> 履歴書を作って応募する
                                </button>
                                <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
                                    登録不要・無料 /{' '}
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
                        {job.source === 'hellowork' && (
                            <span style={{
                                display: 'inline-flex', alignItems: 'center', gap: 4,
                                padding: '3px 10px', borderRadius: 'var(--radius-full)',
                                background: 'rgba(0,112,185,0.08)', border: '1px solid rgba(0,112,185,0.25)',
                                fontSize: 'var(--font-size-xs)', color: '#0070b9', fontWeight: 600,
                            }}>
                                ハローワーク掲載
                            </span>
                        )}
                        {job.listing_type === 'referral' && job.source !== 'hellowork' && <span className="badge badge-warning">人材紹介</span>}
                        {job.listing_type === 'dispatch' && job.source !== 'hellowork' && <span className="badge badge-warning">派遣</span>}
                        {job.application_type && <span className="badge badge-info">{job.application_type}</span>}
                        {job.employment_type && <span className="badge badge-info">{job.employment_type}</span>}
                        {job.remote_policy && <span className="badge badge-info">{job.remote_policy}</span>}
                        {job.location && <span className="badge badge-info">{job.location}</span>}
                        <span className="badge badge-success">
                            {(job.salary_min || job.salary_max)
                                ? `${job.salary_min ? `${Math.round(job.salary_min / 10000)}万` : ''}${job.salary_min && job.salary_max ? '〜' : ''}${job.salary_max ? `${Math.round(job.salary_max / 10000)}万円` : ''}`
                                : '給与非公開'}
                        </span>
                        {job.positions_available && <span className="badge badge-info">採用{job.positions_available}名</span>}
                        {job.work_hours && <span className="badge badge-info">{job.work_hours}</span>}
                        {job.overtime_average && <span className="badge badge-info">残業 {formatOvertime(job.overtime_average)}</span>}
                        {job.holidays && <span className="badge badge-info">{job.holidays.includes('年間') ? job.holidays.match(/年間休日\d+日/)?.[0] || job.holidays : job.holidays}</span>}
                        {job.dormitory && job.dormitory !== 'なし' && <span className="badge badge-info">寮あり</span>}
                    </div>

                    {/* 特徴タグ */}
                    {job.feature_tags?.length > 0 && (
                        <div style={{ marginTop: 'var(--space-sm)' }}>
                            <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', marginBottom: 6 }}>この求人の特徴</p>
                            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                                {job.feature_tags.map(tag => (
                                    <span key={tag} style={{
                                        padding: '4px 12px', borderRadius: 20, fontSize: 'var(--font-size-xs)',
                                        background: 'rgba(200,149,46,0.1)', color: 'var(--color-accent)',
                                        border: '1px solid rgba(200,149,46,0.25)', fontWeight: 600,
                                    }}>✓ {tag}</span>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* 派遣: 派遣元情報（労働者派遣法の明示）＝会社設定から自動表示。ハローワーク等の外部求人は対象外 */}
                {job.listing_type === 'dispatch' && job.source !== 'hellowork' && (
                    <div className="card" style={{ marginBottom: 'var(--space-md)', padding: 0, overflow: 'hidden', borderLeft: '3px solid var(--color-navy)' }}>
                        <SectionHeader title="派遣元情報（労働者派遣）" />
                        <div style={{ padding: 'var(--space-md) var(--space-xl) 0' }}>
                            <span style={{ display: 'inline-block', fontSize: 'var(--font-size-xs)', fontWeight: 700, color: 'var(--color-navy)', background: 'rgba(18,28,52,0.08)', borderRadius: 'var(--radius-full)', padding: '3px 12px' }}>
                                これは派遣労働者の募集です
                            </span>
                        </div>
                        <InfoTable>
                            <InfoRow label="派遣元事業主" value={job.company?.company_name} />
                            <InfoRow label="所在地" value={job.company?.address || job.company?.office_address} />
                            <InfoRow label="電話番号" value={job.company?.phone} />
                            <InfoRow label="派遣事業許可番号" value={job.company?.dispatch_license_number} />
                            <InfoRow label="派遣先" value={job.show_dispatch_client && job.dispatch_client_name ? job.dispatch_client_name : '非公開'} />
                        </InfoTable>
                    </div>
                )}

                {/* 紹介: 紹介元（職業紹介事業者）の明示＝会社設定から自動表示。ハローワーク等の外部求人は対象外 */}
                {job.listing_type === 'referral' && job.source !== 'hellowork' && (
                    <div className="card" style={{ marginBottom: 'var(--space-md)', padding: 0, overflow: 'hidden', borderLeft: '3px solid var(--color-navy)' }}>
                        <SectionHeader title="紹介元（職業紹介事業者）" />
                        <div style={{ padding: 'var(--space-md) var(--space-xl) 0' }}>
                            <span style={{ display: 'inline-block', fontSize: 'var(--font-size-xs)', fontWeight: 700, color: 'var(--color-navy)', background: 'rgba(18,28,52,0.08)', borderRadius: 'var(--radius-full)', padding: '3px 12px' }}>
                                これは職業紹介です
                            </span>
                            {job.employment_type?.includes('派遣') && (
                                <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', margin: 'var(--space-sm) 0 0', lineHeight: 1.7 }}>
                                    就業形態は<strong>{job.employment_type}</strong>です。実際の雇用主は紹介先（派遣元となる企業）となります。
                                </p>
                            )}
                        </div>
                        <InfoTable>
                            <InfoRow label="紹介事業者（紹介元）" value={job.company?.company_name} />
                            <InfoRow label="所在地" value={job.company?.address || job.company?.office_address} />
                            <InfoRow label="電話番号" value={job.company?.phone} />
                            <InfoRow label="職業紹介事業 許可番号" value={job.company?.permit_number} />
                            {job.employment_type?.includes('派遣') && (
                                <InfoRow label="派遣元（雇用主）" value={job.dispatch_client_name || job.client_company?.name} />
                            )}
                        </InfoTable>
                    </div>
                )}

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

                {/* ハローワーク求人：応募方法ガイド */}
                {job.source === 'hellowork' && (
                    <div className="card" style={{ marginBottom: 'var(--space-md)', overflow: 'hidden', padding: 0 }}>
                        <SectionHeader icon="📌" title="応募方法（ハローワーク経由）" />
                        <div style={{ padding: 'var(--space-lg) var(--space-xl)' }}>
                            {/* 求人番号 + 紹介期限 */}
                            <div style={{
                                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                flexWrap: 'wrap', gap: 12,
                                padding: 'var(--space-md) var(--space-lg)', marginBottom: 'var(--space-lg)',
                                background: 'rgba(0,112,185,0.05)',
                                border: '1px solid rgba(0,112,185,0.2)',
                                borderRadius: 'var(--radius-md)',
                            }}>
                                <div>
                                    <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', margin: '0 0 4px' }}>求人番号（照会番号）</p>
                                    <p style={{ fontSize: 'var(--font-size-xl)', fontWeight: 700, color: 'var(--color-text-primary)', letterSpacing: 2, margin: 0, fontFamily: 'monospace' }}>
                                        {job.hellowork_id || '—'}
                                    </p>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-md)' }}>
                                    {job.expires_at && (
                                        <div style={{ textAlign: 'right' }}>
                                            <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', margin: '0 0 4px' }}>紹介期限日</p>
                                            <p style={{ fontSize: 'var(--font-size-sm)', fontWeight: 700, color: 'var(--color-error)', margin: 0 }}>
                                                {new Date(job.expires_at).toLocaleDateString('ja-JP')}
                                            </p>
                                        </div>
                                    )}
                                    {job.hellowork_id && (
                                        <button
                                            onClick={() => navigator.clipboard.writeText(job.hellowork_id)}
                                            className="btn btn-secondary"
                                            style={{ fontSize: 'var(--font-size-xs)', whiteSpace: 'nowrap' }}
                                        >番号をコピー</button>
                                    )}
                                </div>
                            </div>

                            {/* 横並びステップフロー */}
                            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 0, overflowX: 'auto', paddingBottom: 4 }}>
                                {[
                                    { num: '①', label: '求人番号を\n控える' },
                                    { num: '②', label: 'ハローワークに\n求職登録' },
                                    { num: '③', label: '窓口で番号を\n伝える' },
                                    { num: '④', label: '紹介状を\n受け取る' },
                                    { num: '⑤', label: '企業へ\n応募・面接' },
                                ].map(({ num, label }, i, arr) => (
                                    <React.Fragment key={num}>
                                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 80, flex: 1 }}>
                                            <div style={{
                                                width: 40, height: 40, borderRadius: '50%',
                                                background: 'var(--color-text-primary)', color: '#fff',
                                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                fontSize: 'var(--font-size-sm)', fontWeight: 700, marginBottom: 8,
                                                flexShrink: 0,
                                            }}>{num}</div>
                                            <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', textAlign: 'center', lineHeight: 1.5, margin: 0, whiteSpace: 'pre-line' }}>{label}</p>
                                        </div>
                                        {i < arr.length - 1 && (
                                            <div style={{ fontSize: 18, color: 'var(--color-text-muted)', paddingTop: 10, flexShrink: 0 }}>›</div>
                                        )}
                                    </React.Fragment>
                                ))}
                            </div>
                        </div>
                    </div>
                )}

                {/* 仕事内容 */}
                <div className="card" style={{ marginBottom: 'var(--space-md)', overflow: 'hidden', padding: 0 }}>
                    <SectionHeader icon="📋" title="仕事内容" />
                    <div style={{ padding: 'var(--space-lg) var(--space-xl)' }}>
                        <p style={{ color: 'var(--color-text-secondary)', whiteSpace: 'pre-wrap', lineHeight: 1.8, margin: 0 }}>
                            {job.description}
                        </p>
                        {job.scope_of_change && (
                            <div style={{ marginTop: 'var(--space-md)', borderTop: '1px solid #e5e7eb', paddingTop: 'var(--space-md)' }}>
                                <InfoTable><InfoRow label="変更の範囲" value={job.scope_of_change} /></InfoTable>
                            </div>
                        )}
                    </div>
                </div>

                {/* 応募要件 */}
                {(job.requirements || job.preferred_qualifications) && (
                    <div className="card" style={{ marginBottom: 'var(--space-md)', overflow: 'hidden', padding: 0 }}>
                        <SectionHeader icon="✅" title="応募要件" />
                        <div style={{ padding: 'var(--space-lg) var(--space-xl)' }}>
                            {job.requirements && (
                                <p style={{ color: 'var(--color-text-secondary)', whiteSpace: 'pre-wrap', lineHeight: 1.8, marginBottom: job.preferred_qualifications ? 'var(--space-lg)' : 0 }}>
                                    {job.requirements}
                                </p>
                            )}
                            {job.preferred_qualifications && (
                                <>
                                    <p style={{ fontSize: 'var(--font-size-xs)', fontWeight: 700, color: 'var(--color-text-muted)', marginBottom: 4 }}>歓迎条件</p>
                                    <p style={{ color: 'var(--color-text-secondary)', whiteSpace: 'pre-wrap', lineHeight: 1.8, margin: 0 }}>
                                        {job.preferred_qualifications}
                                    </p>
                                </>
                            )}
                        </div>
                    </div>
                )}

                {/* 給与・待遇 */}
                <div className="card" style={{ marginBottom: 'var(--space-md)', overflow: 'hidden', padding: 0 }}>
                    <SectionHeader icon="💰" title="給与・待遇" />
                    <InfoTable>
                        <InfoRow label="給与" value={job.salary_details || formatSalary(job) || '非公開'} />
                        <InfoRow label="昇給" value={job.raise_frequency} />
                        <InfoRow label="賞与" value={job.bonus} />
                        <InfoRow label="手当" value={job.allowances} />
                        <InfoRow label="福利厚生" value={benefitsText} />
                        <InfoRow label="社会保険" value={insuranceText} />
                    </InfoTable>
                </div>

                {/* 勤務条件 */}
                <div className="card" style={{ marginBottom: 'var(--space-md)', overflow: 'hidden', padding: 0 }}>
                    <SectionHeader icon="🏢" title="勤務条件" />
                    <InfoTable>
                        <InfoRow label="勤務時間" value={job.work_hours} />
                        <InfoRow label="残業" value={formatOvertime(job.overtime_average)} />
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
                        {(job.age_min || job.age_max) && (
                            <InfoRow label="応募年齢" value={
                                job.age_min && job.age_max ? `${job.age_min}歳〜${job.age_max}歳`
                                : job.age_min ? `${job.age_min}歳以上`
                                : `${job.age_max}歳以下`
                            } />
                        )}
                        {job.positions_available && <InfoRow label="募集人数" value={`${job.positions_available}名`} />}
                    </InfoTable>

                    {/* 勤務地の地図（住所があるときのみ・APIキー不要のGoogleマップ埋め込み） */}
                    {(() => {
                        const mapQuery = mapPinQuery(job);
                        if (!mapQuery) return null;
                        return (
                            <div style={{ padding: 'var(--space-lg) var(--space-xl) var(--space-xl)' }}>
                                <p style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: 'var(--space-sm)' }}>
                                    地図
                                </p>
                                <div style={{ borderRadius: 'var(--radius-md)', overflow: 'hidden', border: '1px solid var(--color-border)' }}>
                                    <iframe
                                        title="勤務地の地図"
                                        src={`https://maps.google.com/maps?q=${encodeURIComponent(mapQuery)}&z=15&hl=ja&output=embed`}
                                        width="100%"
                                        height="280"
                                        style={{ border: 0, display: 'block' }}
                                        loading="lazy"
                                        referrerPolicy="no-referrer-when-downgrade"
                                    />
                                </div>
                                <a
                                    href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(mapQuery)}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    style={{ display: 'inline-block', marginTop: 'var(--space-sm)', fontSize: 'var(--font-size-sm)', color: 'var(--color-accent)' }}
                                >
                                    Googleマップで開く →
                                </a>
                            </div>
                        );
                    })()}
                </div>

                {/* 試用期間 */}
                {job.probation_period && (
                    <div className="card" style={{ marginBottom: 'var(--space-md)', overflow: 'hidden', padding: 0 }}>
                        <SectionHeader icon="📝" title="試用期間" />
                        <InfoTable>
                            <InfoRow label="期間" value={job.probation_period} />
                            <InfoRow label="条件" value={job.probation_conditions} />
                        </InfoTable>
                    </div>
                )}

                {/* 職場環境・社風 */}
                {(job.work_environment || job.company_culture) && (
                    <div className="card" style={{ marginBottom: 'var(--space-md)', overflow: 'hidden', padding: 0 }}>
                        <SectionHeader icon="👥" title="職場環境・社風" />
                        <InfoTable>
                            {job.work_environment && <InfoRow label="チーム構成" value={job.work_environment} />}
                            {job.company_culture && <InfoRow label="社風・カルチャー" value={job.company_culture} />}
                        </InfoTable>
                    </div>
                )}

                {/* 選考について */}
                {(job.selection_process || job.required_documents || job.estimated_timeline) && (
                    <div className="card" style={{ marginBottom: 'var(--space-md)', overflow: 'hidden', padding: 0 }}>
                        <SectionHeader icon="📊" title="選考について" />
                        <InfoTable>
                            {job.selection_process && <InfoRow label="選考フロー" value={job.selection_process} />}
                            <InfoRow label="必要書類" value={job.required_documents} />
                            <InfoRow label="選考期間" value={job.estimated_timeline} />
                        </InfoTable>
                    </div>
                )}

                {/* 企業情報（人材紹介の場合は紹介先・紹介元両方表示） */}
                {job.is_agency_job && job.client_company ? (
                    <>
                        <div className="card" style={{ marginBottom: 'var(--space-md)', overflow: 'hidden', padding: 0 }}>
                            <SectionHeader icon="🏢" title="求人企業（紹介先）" />
                            <InfoTable>
                                <InfoRow label="会社名" value={job.client_company.name} />
                                <InfoRow label="業界" value={job.client_company.industry} />
                                <InfoRow label="従業員数" value={job.client_company.employees} />
                                <InfoRow label="所在地" value={job.client_company.address} />
                                {job.client_company.description && <InfoRow label="企業概要" value={job.client_company.description} />}
                            </InfoTable>
                        </div>
                        <div className="card" style={{ marginBottom: 'var(--space-md)', overflow: 'hidden', padding: 0 }}>
                            <SectionHeader icon="🤝" title="紹介会社" />
                            <InfoTable>
                                <InfoRow label="会社名" value={job.agency_company?.name} />
                                <InfoRow label="許可番号" value={job.agency_company?.permit_number} />
                                <InfoRow label="所在地" value={job.agency_company?.address} />
                                <InfoRow label="電話番号" value={job.agency_company?.phone} />
                                <InfoRow label="HP" value={job.agency_company?.website} />
                            </InfoTable>
                        </div>
                    </>
                ) : job.source === 'hellowork' ? (
                    (job.employer_name || job.business_content || job.industry || job.number_of_employees) && (
                        <div className="card" style={{ marginBottom: 'var(--space-md)', overflow: 'hidden', padding: 0 }}>
                            <SectionHeader icon="🏢" title="会社情報" />
                            {/* 事業内容 */}
                            {job.business_content && (
                                <div style={{
                                    padding: 'var(--space-lg) var(--space-xl)',
                                    borderBottom: '1px solid var(--color-border)',
                                    background: 'rgba(18,28,52,0.015)',
                                }}>
                                    <p style={{
                                        fontSize: 'var(--font-size-xs)', fontWeight: 600,
                                        color: 'var(--color-text-muted)', marginBottom: 6,
                                    }}>事業内容</p>
                                    <p style={{
                                        color: 'var(--color-text-secondary)',
                                        whiteSpace: 'pre-wrap', lineHeight: 1.8,
                                        fontSize: 'var(--font-size-sm)', margin: 0,
                                    }}>
                                        {job.business_content}
                                    </p>
                                </div>
                            )}
                            <InfoTable>
                                <InfoRow label="事業所名" value={job.employer_name} />
                                <InfoRow label="代表者" value={job.representative_name} />
                                <InfoRow label="業界" value={job.industry} />
                                <InfoRow label="設立" value={job.founded_year} />
                                <InfoRow label="従業員数" value={job.number_of_employees} />
                                <InfoRow label="資本金" value={job.capital} />
                                <InfoRow label="所在地" value={[job.postal_code && `〒${job.postal_code}`, job.office_address].filter(Boolean).join(' ') || null} />
                                <InfoRow label="最寄り駅" value={job.nearest_station} />
                                {job.homepage_url && (
                                    <div style={{
                                        display: 'flex', gap: 'var(--space-md)',
                                        padding: '10px var(--space-xl)',
                                        borderBottom: '1px solid var(--color-border)',
                                    }}>
                                        <div style={{
                                            flex: '0 0 110px', paddingTop: 1,
                                            fontSize: 'var(--font-size-sm)',
                                            color: 'var(--color-text-muted)', fontWeight: 600,
                                        }}>企業HP</div>
                                        <a
                                            href={job.homepage_url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            style={{
                                                flex: 1, fontSize: 'var(--font-size-sm)',
                                                color: 'var(--color-accent)', wordBreak: 'break-all',
                                            }}
                                        >
                                            {job.homepage_url}
                                        </a>
                                    </div>
                                )}
                            </InfoTable>
                        </div>
                    )
                ) : (job.listing_type === 'referral' || job.listing_type === 'dispatch') ? (
                    /* 紹介/派遣: 就業先（紹介先/派遣先）の情報のみ。紹介元/派遣元の連絡先・許可番号は上部に表示済み */
                    (job.industry || job.number_of_employees || (job.show_dispatch_client && job.dispatch_client_name)) && (
                        <div className="card" style={{ marginBottom: 'var(--space-md)', overflow: 'hidden', padding: 0 }}>
                            <SectionHeader title={job.listing_type === 'dispatch' ? '就業先（派遣先）情報' : '就業先（紹介先）情報'} />
                            <div style={{ padding: 'var(--space-md) var(--space-xl) 0' }}>
                                <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', margin: 0 }}>
                                    {job.listing_type === 'dispatch' ? '派遣元' : '紹介元'}（会社名・所在地・電話番号・許可番号）は上部に記載しています。
                                </p>
                            </div>
                            <InfoTable>
                                {(job.show_dispatch_client && job.dispatch_client_name) && (
                                    <InfoRow label={job.listing_type === 'dispatch' ? '派遣先' : '紹介先'} value={job.dispatch_client_name} />
                                )}
                                <InfoRow label="業界" value={job.industry} />
                                <InfoRow label="従業員数" value={job.number_of_employees} />
                            </InfoTable>
                        </div>
                    )
                ) : job.company && (
                    <div className="card" style={{ marginBottom: 'var(--space-md)', overflow: 'hidden', padding: 0 }}>
                        <SectionHeader icon="🏢" title="会社情報" />
                        {/* 事業内容 */}
                        {job.company?.description && (
                            <div style={{
                                padding: 'var(--space-lg) var(--space-xl)',
                                borderBottom: '1px solid var(--color-border)',
                                background: 'rgba(18,28,52,0.015)',
                            }}>
                                <p style={{
                                    fontSize: 'var(--font-size-xs)', fontWeight: 600,
                                    color: 'var(--color-text-muted)', marginBottom: 6,
                                }}>事業内容</p>
                                <p style={{
                                    color: 'var(--color-text-secondary)',
                                    whiteSpace: 'pre-wrap', lineHeight: 1.8,
                                    fontSize: 'var(--font-size-sm)', margin: 0,
                                }}>
                                    {job.company.description}
                                </p>
                            </div>
                        )}
                        <InfoTable>
                            <InfoRow label="代表者" value={job.company?.representative_name} />
                            <InfoRow label="業界" value={job.industry || job.company?.industry} />
                            <InfoRow label="設立" value={job.founded_year || job.company?.founded_year} />
                            <InfoRow label="従業員数" value={job.number_of_employees || job.company?.number_of_employees} />
                            <InfoRow label="資本金" value={job.company?.capital} />
                            <InfoRow label="所在地" value={job.company?.office_address || job.company?.address} />
                            <InfoRow label="最寄り駅" value={job.company?.nearest_station} />
                            <InfoRow label="電話番号" value={job.company?.phone} />
                            {job.company?.website && (
                                <div style={{
                                    display: 'flex', gap: 'var(--space-md)',
                                    padding: '10px var(--space-xl)',
                                    borderBottom: '1px solid var(--color-border)',
                                }}>
                                    <div style={{
                                        flex: '0 0 110px', paddingTop: 1,
                                        fontSize: 'var(--font-size-sm)',
                                        color: 'var(--color-text-muted)', fontWeight: 600,
                                    }}>企業HP</div>
                                    <a
                                        href={job.company.website}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        style={{
                                            flex: 1, fontSize: 'var(--font-size-sm)',
                                            color: 'var(--color-accent)', wordBreak: 'break-all',
                                        }}
                                    >
                                        {job.company.website}
                                    </a>
                                </div>
                            )}
                        </InfoTable>
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
                            {job.agency_display}
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

                {/* 固定フッター応募ボタン（求職者・未応募時・ハローワーク求人以外） */}
                {user?.role === 'jobseeker' && !applied && job.source !== 'hellowork' && (
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

                {/* ゲスト向け応募CTA（ハローワーク求人には表示しない） */}
                {!user && job.source !== 'hellowork' && (
                    <div className="card" style={{
                        padding: 'var(--space-xl)',
                        background: 'var(--color-accent-light)',
                        border: '1px solid var(--color-border)',
                        textAlign: 'center',
                    }}>
                        <FileText size={28} strokeWidth={1.75} style={{ color: 'var(--color-text-accent)', marginBottom: 'var(--space-sm)' }} />
                        <h3 style={{ marginBottom: 'var(--space-sm)', color: 'var(--color-navy)' }}>この求人に応募するには履歴書が必要です</h3>
                        <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-sm)', marginBottom: 'var(--space-md)', lineHeight: 1.7 }}>
                            Atallyでは登録不要・無料で履歴書が作成できます。<br />
                            作成後そのままこの求人に応募できます。
                        </p>
                        <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginBottom: 'var(--space-md)', flexWrap: 'wrap' }}>
                            {['履歴書を無料で作る', 'この求人に応募する'].map((step, i) => (
                                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
                                    {i > 0 && <span style={{ color: 'var(--color-border)' }}>→</span>}
                                    <span style={{ background: 'var(--color-bg-secondary)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', padding: '4px 10px' }}>{step}</span>
                                </div>
                            ))}
                        </div>
                        <div style={{ display: 'flex', gap: 'var(--space-md)', justifyContent: 'center', flexWrap: 'wrap' }}>
                            <button className="btn btn-primary btn-lg" onClick={() => navigate(`/resumes/guest?from_job=${job.id}`)} style={{ gap: 8 }}>
                                <FileText size={17} strokeWidth={2} /> 履歴書を無料で作る
                            </button>
                            <button className="btn btn-secondary" onClick={() => navigate('/login')}>
                                ログインして応募
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
                            <h3 style={{ fontSize: 'var(--font-size-base)', fontWeight: 700, margin: '0 0 var(--space-md)', color: 'var(--color-text-primary)' }}>関連する求人</h3>
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
                                            {sj.company?.company_name}
                                        </p>
                                        <div style={{ display: 'flex', gap: 'var(--space-sm)', flexWrap: 'wrap' }}>
                                            {sj.employment_type && <span className="badge badge-info" style={{ fontSize: 'var(--font-size-xs)' }}>{sj.employment_type}</span>}
                                            {sj.location && <span className="badge badge-info" style={{ fontSize: 'var(--font-size-xs)' }}>{sj.location}</span>}
                                            {(sj.salary_min || sj.salary_max) && (
                                                <span className="badge badge-success" style={{ fontSize: 'var(--font-size-xs)' }}>
                                                    {sj.salary_min ? `${Math.round(sj.salary_min / 10000)}万` : ''}
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
                {user?.role === 'jobseeker' && !applied && job.source !== 'hellowork' && <div style={{ height: 80 }} />}
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
