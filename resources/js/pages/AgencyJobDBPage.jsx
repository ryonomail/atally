import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Search, MapPin, Briefcase, Banknote, Building2, Target, Users, RefreshCw, Paperclip, FileText, CheckSquare, Zap, Hand } from 'lucide-react';
import api from '../api';
import { formatSalary } from '../utils/salary';

const EMPLOYMENT_TYPES = [
    { value: '', label: 'すべて' },
    { value: '正社員', label: '正社員' },
    { value: '契約社員', label: '契約社員' },
    { value: 'パート', label: 'パート・アルバイト' },
    { value: '派遣', label: '派遣社員' },
    { value: '業務委託', label: '業務委託' },
];

const SALARY_OPTIONS = [
    { value: '', label: '下限なし' },
    { value: '3000000', label: '300万円以上' },
    { value: '4000000', label: '400万円以上' },
    { value: '5000000', label: '500万円以上' },
    { value: '6000000', label: '600万円以上' },
    { value: '8000000', label: '800万円以上' },
    { value: '10000000', label: '1000万円以上' },
];

const AREAS = ['東京都', '大阪府', '愛知県', '神奈川県', '福岡県', '北海道', 'リモート可'];

export default function AgencyJobDBPage() {
    const listRef = useRef(null);

    const [filters, setFilters] = useState({ keyword: '', location: '', employment_type: '', salary_min: '' });
    const [inputKeyword, setInputKeyword] = useState('');
    const [inputLocation, setInputLocation] = useState('');

    const [jobs, setJobs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [lastPage, setLastPage] = useState(1);
    const [total, setTotal] = useState(0);
    const [showFilters, setShowFilters] = useState(false);

    const [selectedJobId, setSelectedJobId] = useState(null);
    const [selectedJob, setSelectedJob] = useState(null);
    const [detailLoading, setDetailLoading] = useState(false);
    const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

    // 紹介申請
    const [showReferral, setShowReferral] = useState(false);
    const [referralForm, setReferralForm] = useState({ candidate_summary: '', message: '', fee_type: 'percentage', fee_percentage: 20, fee_amount: '', source_share: 50, referrer_share: 50, terms_accepted: false });
    const [submitting, setSubmitting] = useState(false);
    const [toast, setToast] = useState(null);

    // 候補者選択・履歴書アップロード
    const [selectedCandidate, setSelectedCandidate] = useState(null);
    const [resumeFile, setResumeFile] = useState(null);
    const [showCandidateModal, setShowCandidateModal] = useState(false);
    const [candidateSearch, setCandidateSearch] = useState({ keyword: '', location: '' });
    const [candidates, setCandidates] = useState([]);
    const [candidateLoading, setCandidateLoading] = useState(false);

    const activeFilterCount = [filters.employment_type, filters.salary_min, filters.location].filter(Boolean).length;

    useEffect(() => {
        const onResize = () => setIsMobile(window.innerWidth < 768);
        window.addEventListener('resize', onResize);
        return () => window.removeEventListener('resize', onResize);
    }, []);

    const fetchJobs = useCallback(async (currentFilters, currentPage) => {
        setLoading(true);
        try {
            const params = { page: currentPage, per_page: 20 };
            if (currentFilters.keyword) params.keyword = currentFilters.keyword;
            if (currentFilters.location) params.location = currentFilters.location;
            if (currentFilters.employment_type) params.employment_type = currentFilters.employment_type;
            if (currentFilters.salary_min) params.salary_min = currentFilters.salary_min;
            const res = await api.get('/agency/job-database', { params });
            const data = res.data.data || [];
            setJobs(data);
            setPage(res.data.current_page || 1);
            setLastPage(res.data.last_page || 1);
            setTotal(res.data.total || data.length);
            if (data.length > 0 && !isMobile) {
                setSelectedJobId(data[0].id);
            }
        } catch (err) {
            setToast({ type: 'error', text: err.response?.data?.message || '取得に失敗しました' });
        } finally {
            setLoading(false);
        }
    }, [isMobile]);

    useEffect(() => { fetchJobs(filters, page); }, [filters, page]);

    // 選択された求人の詳細をjobsリストから取得
    useEffect(() => {
        if (!selectedJobId) { setSelectedJob(null); return; }
        const found = jobs.find(j => j.id === selectedJobId);
        if (found) {
            setSelectedJob(found);
            setDetailLoading(false);
        }
    }, [selectedJobId, jobs]);

    const handleSearch = (e) => {
        e.preventDefault();
        setFilters(prev => ({ ...prev, keyword: inputKeyword, location: inputLocation }));
        setPage(1);
    };

    const updateFilter = (key, value) => {
        setFilters(prev => ({ ...prev, [key]: value }));
        setPage(1);
    };

    const clearFilters = () => {
        setFilters({ keyword: '', location: '', employment_type: '', salary_min: '' });
        setInputKeyword('');
        setInputLocation('');
        setPage(1);
    };

    const handleJobClick = (job) => {
        if (isMobile) {
            setSelectedJob(job);
            setShowReferral(false);
        } else {
            setSelectedJobId(job.id);
            setShowReferral(false);
        }
    };

    const searchCandidates = async () => {
        setCandidateLoading(true);
        try {
            const params = {};
            if (candidateSearch.keyword) params.keyword = candidateSearch.keyword;
            if (candidateSearch.location) params.location = candidateSearch.location;
            const res = await api.get('/agency/candidates', { params });
            setCandidates(res.data.data || []);
        } catch (err) {
            setToast({ type: 'error', text: err.response?.data?.message || '候補者検索に失敗しました' });
        } finally {
            setCandidateLoading(false);
        }
    };

    const handleSelectCandidate = (candidate) => {
        setSelectedCandidate(candidate);
        const summary = [
            candidate.desired_job_type && `希望職種: ${candidate.desired_job_type}`,
            candidate.location && `所在地: ${candidate.location}`,
            candidate.experience_years && `経験年数: ${candidate.experience_years}年`,
            candidate.skills && `スキル: ${candidate.skills}`,
        ].filter(Boolean).join('\n');
        setReferralForm(prev => ({ ...prev, candidate_summary: summary || prev.candidate_summary }));
        setShowCandidateModal(false);
    };

    const handleReferral = async () => {
        if (!referralForm.candidate_summary.trim()) {
            setToast({ type: 'error', text: '候補者の概要を入力してください' });
            return;
        }
        const isDirect = selectedJob?.company?.company_type === 'direct_employer';
        if (!isDirect) {
            if (referralForm.fee_type === 'percentage' && Math.abs(referralForm.source_share + referralForm.referrer_share - 100) > 0.01) {
                setToast({ type: 'error', text: '手数料シェアの合計を100%にしてください' });
                return;
            }
            if (referralForm.fee_type === 'fixed' && (!referralForm.fee_amount || Number(referralForm.fee_amount) <= 0)) {
                setToast({ type: 'error', text: '手数料金額を入力してください' });
                return;
            }
        }
        if (!referralForm.terms_accepted) {
            setToast({ type: 'error', text: '利用規約・免責事項に同意してください' });
            return;
        }
        setSubmitting(true);
        try {
            const formData = new FormData();
            const isDirect = selectedJob?.company?.company_type === 'direct_employer';
            formData.append('candidate_summary', referralForm.candidate_summary);
            formData.append('message', referralForm.message || '');
            if (isDirect) {
                // パターン1: 企業への直接紹介 — 求人の手数料設定をそのまま使用
                formData.append('referral_fee_type', selectedJob.referral_fee_type || 'percentage');
                if ((selectedJob.referral_fee_type || 'percentage') === 'percentage') {
                    formData.append('fee_percentage', selectedJob.referral_fee || 20);
                } else {
                    formData.append('referral_fee', selectedJob.referral_fee || '');
                }
            } else {
                // パターン2: エージェント間レベニューシェア
                formData.append('referral_fee_type', referralForm.fee_type);
                if (referralForm.fee_type === 'percentage') {
                    formData.append('fee_percentage', referralForm.fee_percentage);
                    formData.append('source_share', referralForm.source_share);
                    formData.append('referrer_share', referralForm.referrer_share);
                } else {
                    formData.append('referral_fee', referralForm.fee_amount);
                }
            }
            formData.append('terms_accepted', referralForm.terms_accepted ? '1' : '0');
            if (selectedCandidate) {
                formData.append('candidate_user_id', selectedCandidate.user_id);
            }
            if (resumeFile) {
                formData.append('resume_file', resumeFile);
            }
            await api.post(`/agency/referrals/${selectedJob.id}`, formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
            });
            setToast({ type: 'success', text: '紹介申請を送信しました' });
            setShowReferral(false);
            setReferralForm({ candidate_summary: '', message: '', fee_type: 'percentage', fee_percentage: 20, fee_amount: '', source_share: 50, referrer_share: 50, terms_accepted: false });
            setSelectedCandidate(null);
            setResumeFile(null);
        } catch (err) {
            setToast({ type: 'error', text: err.response?.data?.message || '送信に失敗しました' });
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="page" style={{ background: 'var(--color-bg-primary)' }}>

            {/* 検索ヘッダー（sticky） */}
            <div style={{
                background: 'rgba(255, 255, 255, 0.85)',
                borderBottom: '1px solid var(--color-border)',
                padding: 'var(--space-xl) 0 var(--space-md)',
                position: 'sticky', top: 52, zIndex: 100,
                backdropFilter: 'blur(12px)',
            }}>
                <div className="container">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-md)', marginBottom: 'var(--space-sm)' }}>
                        <h1 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 700, margin: 0 }}>求人データベース</h1>
                        <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>他エージェントの公開求人</span>
                    </div>
                    <form onSubmit={handleSearch} style={{ display: 'flex', gap: 'var(--space-sm)', flexWrap: 'wrap' }}>
                        <div style={{ flex: '2 1 220px', position: 'relative' }}>
                            <span style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', display: 'inline-flex', alignItems: 'center', opacity: 0.5 }}><Search size={16} strokeWidth={2} color="var(--color-text-secondary)" /></span>
                            <input type="text" className="form-input" placeholder="職種・スキル・会社名"
                                value={inputKeyword} onChange={e => setInputKeyword(e.target.value)}
                                style={{ paddingLeft: 40, height: 46 }} />
                        </div>
                        <div style={{ flex: '1 1 160px', position: 'relative' }}>
                            <span style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', display: 'inline-flex', alignItems: 'center', opacity: 0.5 }}><MapPin size={16} strokeWidth={2} color="var(--color-text-secondary)" /></span>
                            <input type="text" className="form-input" placeholder="勤務地"
                                value={inputLocation} onChange={e => setInputLocation(e.target.value)}
                                style={{ paddingLeft: 40, height: 46 }} />
                        </div>
                        <button type="submit" className="btn btn-primary" style={{ height: 46, padding: '0 var(--space-xl)', whiteSpace: 'nowrap' }}>
                            検索
                        </button>
                        <button type="button" className="btn btn-secondary"
                            style={{ height: 46, whiteSpace: 'nowrap', position: 'relative' }}
                            onClick={() => setShowFilters(f => !f)}>
                            絞り込み
                            {activeFilterCount > 0 && (
                                <span style={{
                                    position: 'absolute', top: -6, right: -6,
                                    background: 'var(--color-accent)', color: '#fff',
                                    borderRadius: '50%', width: 18, height: 18,
                                    fontSize: 11, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700,
                                }}>{activeFilterCount}</span>
                            )}
                        </button>
                    </form>

                    {showFilters && (
                        <div className="animate-fade-in" style={{
                            display: 'flex', flexWrap: 'wrap', gap: 'var(--space-md)',
                            marginTop: 'var(--space-md)', paddingTop: 'var(--space-md)',
                            borderTop: '1px solid var(--color-border)', alignItems: 'flex-end',
                        }}>
                            <div style={{ flex: '1 1 160px' }}>
                                <label className="form-label" style={{ fontSize: 'var(--font-size-xs)' }}>雇用形態</label>
                                <select className="form-select" value={filters.employment_type}
                                    onChange={e => updateFilter('employment_type', e.target.value)} style={{ height: 40 }}>
                                    {EMPLOYMENT_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                                </select>
                            </div>
                            <div style={{ flex: '1 1 160px' }}>
                                <label className="form-label" style={{ fontSize: 'var(--font-size-xs)' }}>最低年収</label>
                                <select className="form-select" value={filters.salary_min}
                                    onChange={e => updateFilter('salary_min', e.target.value)} style={{ height: 40 }}>
                                    {SALARY_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                                </select>
                            </div>
                            {activeFilterCount > 0 && (
                                <button className="btn btn-secondary" style={{ height: 40, fontSize: 'var(--font-size-xs)' }} onClick={clearFilters}>
                                    クリア
                                </button>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {toast && (
                <div className="container" style={{ paddingTop: 'var(--space-sm)' }}>
                    <div style={{
                        padding: 'var(--space-sm) var(--space-md)', borderRadius: 'var(--radius-md)', fontSize: 'var(--font-size-sm)',
                        background: toast.type === 'success' ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
                        color: toast.type === 'success' ? 'var(--color-success)' : '#ef4444',
                        cursor: 'pointer',
                    }} onClick={() => setToast(null)}>{toast.text}</div>
                </div>
            )}

            <div className="container" style={{ paddingTop: 'var(--space-lg)' }}>

                {/* エリアタグ */}
                <div style={{ display: 'flex', gap: 'var(--space-xs)', flexWrap: 'wrap', marginBottom: 'var(--space-md)' }}>
                    {AREAS.map(area => (
                        <button key={area}
                            onClick={() => {
                                const val = filters.location === area ? '' : area;
                                setInputLocation(val);
                                updateFilter('location', val);
                            }}
                            style={{
                                padding: '4px 12px', borderRadius: 'var(--radius-full)',
                                border: filters.location === area ? '1.5px solid var(--color-navy)' : '1px solid var(--color-border)',
                                background: filters.location === area ? 'rgba(18,28,52,0.05)' : 'transparent',
                                color: filters.location === area ? 'var(--color-navy)' : 'var(--color-text-secondary)',
                                cursor: 'pointer', fontSize: 'var(--font-size-xs)', transition: 'all var(--transition-fast)',
                            }}>{area}</button>
                    ))}
                </div>

                {/* 件数・フィルターバッジ */}
                <div style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    marginBottom: 'var(--space-md)', paddingBottom: 'var(--space-sm)',
                    borderBottom: '1px solid var(--color-border)', flexWrap: 'wrap', gap: 'var(--space-sm)',
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)', flexWrap: 'wrap' }}>
                        {!loading && (
                            <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', margin: 0 }}>
                                <span style={{ color: 'var(--color-text-accent)', fontWeight: 700, fontSize: 'var(--font-size-xl)' }}>{total}</span> 件
                            </p>
                        )}
                        {filters.keyword && <FilterBadge icon={<Search size={12} strokeWidth={2} />} label={filters.keyword} onRemove={() => { setInputKeyword(''); updateFilter('keyword', ''); }} />}
                        {filters.employment_type && <FilterBadge icon={<Briefcase size={12} strokeWidth={2} />} label={filters.employment_type} onRemove={() => updateFilter('employment_type', '')} />}
                        {filters.salary_min && <FilterBadge icon={<Banknote size={12} strokeWidth={2} />} label={SALARY_OPTIONS.find(o => o.value === filters.salary_min)?.label} color="green" onRemove={() => updateFilter('salary_min', '')} />}
                    </div>
                </div>

                {/* Split-pane レイアウト */}
                <div style={{
                    display: 'flex',
                    gap: 'var(--space-lg)',
                    height: isMobile ? 'auto' : 'calc(100vh - 300px)',
                    minHeight: isMobile ? 'auto' : 400,
                    overflow: isMobile ? 'visible' : 'hidden',
                }}>

                    {/* 左パネル: 求人リスト */}
                    <div style={{
                        flex: isMobile ? '1 1 100%' : '0 0 420px',
                        height: isMobile ? 'auto' : '100%',
                        display: 'flex',
                        flexDirection: 'column',
                    }}>
                    <div ref={listRef} style={{
                        flex: 1,
                        overflowY: isMobile ? 'visible' : 'auto',
                        paddingRight: isMobile ? 0 : 'var(--space-sm)',
                    }}>
                        {loading ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
                                {[1,2,3,4,5].map(i => <div key={i} className="skeleton" style={{ height: 120, borderRadius: 'var(--radius-lg)' }} />)}
                            </div>
                        ) : jobs.length === 0 ? (
                            <div className="card" style={{ textAlign: 'center', padding: 'var(--space-3xl)' }}>
                                <div style={{ marginBottom: 'var(--space-md)', display: 'flex', justifyContent: 'center' }}><Search size={48} strokeWidth={1.5} color="var(--color-text-muted)" /></div>
                                <h3 style={{ marginBottom: 'var(--space-sm)' }}>条件に合う求人が見つかりませんでした</h3>
                                <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-sm)', marginBottom: 'var(--space-lg)' }}>
                                    キーワードや条件を変更してお試しください
                                </p>
                                <button className="btn btn-secondary" onClick={clearFilters}>フィルターをリセット</button>
                            </div>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
                                {jobs.map(job => (
                                    <JobListCard
                                        key={job.id}
                                        job={job}
                                        isSelected={selectedJobId === job.id}
                                        onClick={() => handleJobClick(job)}
                                    />
                                ))}
                            </div>
                        )}
                    </div>

                    {/* ページネーション（常時表示） */}
                    {lastPage > 1 && (
                        <div style={{ display: 'flex', justifyContent: 'center', gap: 'var(--space-xs)', marginTop: 'var(--space-sm)', flexWrap: 'wrap', flexShrink: 0 }}>
                            <button className="btn btn-secondary" disabled={page === 1} style={{ fontSize: 'var(--font-size-xs)' }}
                                onClick={() => { setPage(p => p - 1); if (listRef.current) listRef.current.scrollTop = 0; }}>←</button>
                            {Array.from({ length: Math.min(lastPage, 7) }, (_, i) => {
                                const p = lastPage <= 7 ? i + 1
                                    : page <= 4 ? i + 1
                                    : page >= lastPage - 3 ? lastPage - 6 + i
                                    : page - 3 + i;
                                return (
                                    <button key={p} className={`btn ${p === page ? 'btn-primary' : 'btn-secondary'}`}
                                        onClick={() => { setPage(p); if (listRef.current) listRef.current.scrollTop = 0; }}
                                        style={{ minWidth: 32, fontSize: 'var(--font-size-xs)', padding: '4px 8px' }}>{p}</button>
                                );
                            })}
                            <button className="btn btn-secondary" disabled={page === lastPage} style={{ fontSize: 'var(--font-size-xs)' }}
                                onClick={() => { setPage(p => p + 1); if (listRef.current) listRef.current.scrollTop = 0; }}>→</button>
                        </div>
                    )}
                    </div>

                    {/* 右パネル: 求人詳細（PCのみ） */}
                    {!isMobile && (
                        <div style={{
                            flex: '1 1 0',
                            height: '100%',
                            overflowY: 'auto',
                        }}>
                            {detailLoading ? (
                                <div className="card" style={{ padding: 'var(--space-xl)' }}>
                                    <div className="skeleton" style={{ height: 28, width: '70%', marginBottom: 'var(--space-md)' }} />
                                    <div className="skeleton" style={{ height: 16, width: '40%', marginBottom: 'var(--space-lg)' }} />
                                    <div className="skeleton" style={{ height: 200, marginBottom: 'var(--space-md)' }} />
                                    <div className="skeleton" style={{ height: 120 }} />
                                </div>
                            ) : selectedJob ? (
                                <AgencyJobDetailPanel
                                    job={selectedJob}
                                    showReferral={showReferral}
                                    setShowReferral={setShowReferral}
                                    referralForm={referralForm}
                                    setReferralForm={setReferralForm}
                                    onSubmitReferral={handleReferral}
                                    submitting={submitting}
                                    selectedCandidate={selectedCandidate}
                                    setSelectedCandidate={setSelectedCandidate}
                                    resumeFile={resumeFile}
                                    setResumeFile={setResumeFile}
                                    onOpenCandidateModal={() => { setShowCandidateModal(true); searchCandidates(); }}
                                />
                            ) : (
                                <div className="card" style={{ textAlign: 'center', padding: 'var(--space-3xl)', color: 'var(--color-text-muted)' }}>
                                    <div style={{ marginBottom: 'var(--space-md)', opacity: 0.4, display: 'flex', justifyContent: 'center' }}><Hand size={48} strokeWidth={1.5} /></div>
                                    <p>左のリストから求人をクリックしてください</p>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* 候補者検索モーダル */}
            {showCandidateModal && (
                <div style={{
                    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex',
                    alignItems: 'center', justifyContent: 'center', zIndex: 1100,
                }} onClick={() => setShowCandidateModal(false)}>
                    <div style={{
                        background: 'var(--color-bg-surface)', borderRadius: 'var(--radius-xl)',
                        width: '90%', maxWidth: 600, maxHeight: '80vh', display: 'flex', flexDirection: 'column',
                    }} onClick={e => e.stopPropagation()}>
                        <div style={{ padding: 'var(--space-lg)', borderBottom: '1px solid var(--color-border)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-md)' }}>
                                <h3 style={{ fontSize: 'var(--font-size-base)', fontWeight: 700, margin: 0 }}>候補者を検索</h3>
                                <button onClick={() => setShowCandidateModal(false)}
                                    style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: 'var(--color-text-muted)' }}>✕</button>
                            </div>
                            <form onSubmit={e => { e.preventDefault(); searchCandidates(); }} style={{ display: 'flex', gap: 'var(--space-sm)' }}>
                                <input type="text" className="form-input" placeholder="職種・スキル"
                                    value={candidateSearch.keyword} onChange={e => setCandidateSearch(prev => ({ ...prev, keyword: e.target.value }))}
                                    style={{ flex: 1 }} />
                                <input type="text" className="form-input" placeholder="勤務地"
                                    value={candidateSearch.location} onChange={e => setCandidateSearch(prev => ({ ...prev, location: e.target.value }))}
                                    style={{ flex: 1 }} />
                                <button type="submit" className="btn btn-primary" style={{ whiteSpace: 'nowrap' }}>検索</button>
                            </form>
                        </div>
                        <div style={{ flex: 1, overflowY: 'auto', padding: 'var(--space-md)' }}>
                            {candidateLoading ? (
                                <div style={{ textAlign: 'center', padding: 'var(--space-xl)', color: 'var(--color-text-muted)' }}>検索中...</div>
                            ) : candidates.length === 0 ? (
                                <div style={{ textAlign: 'center', padding: 'var(--space-xl)', color: 'var(--color-text-muted)' }}>
                                    候補者が見つかりませんでした
                                </div>
                            ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
                                    {candidates.map(c => (
                                        <div key={c.user_id} onClick={() => handleSelectCandidate(c)}
                                            style={{
                                                padding: 'var(--space-md)', borderRadius: 'var(--radius-md)',
                                                border: '1px solid var(--color-border)', cursor: 'pointer',
                                                transition: 'all var(--transition-fast)',
                                            }}
                                            onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--color-accent)'; e.currentTarget.style.background = 'rgba(18,28,52,0.04)'; }}
                                            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--color-border)'; e.currentTarget.style.background = 'transparent'; }}
                                        >
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                                                <span style={{ fontWeight: 700, fontSize: 'var(--font-size-sm)' }}>{c.display_name || '匿名ユーザー'}</span>
                                                {c.experience_years && <span className="badge badge-info" style={{ fontSize: 10 }}>経験{c.experience_years}年</span>}
                                            </div>
                                            <div style={{ display: 'flex', gap: 'var(--space-sm)', flexWrap: 'wrap', fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
                                                {c.desired_job_type && <span>希望: {c.desired_job_type}</span>}
                                                {c.location && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><MapPin size={12} strokeWidth={2} style={{ opacity: 0.5 }} /> {c.location}</span>}
                                            </div>
                                            {c.skills && (
                                                <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', margin: '4px 0 0',
                                                    display: '-webkit-box', WebkitLineClamp: 1, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                                                    {c.skills}
                                                </p>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* モバイル: 詳細モーダル */}
            {isMobile && selectedJob && (
                <div style={{
                    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex',
                    alignItems: 'flex-end', justifyContent: 'center', zIndex: 1000,
                }} onClick={() => { setSelectedJob(null); setShowReferral(false); }}>
                    <div style={{
                        background: 'var(--color-bg-surface)', borderRadius: 'var(--radius-xl) var(--radius-xl) 0 0',
                        width: '100%', maxHeight: '90vh', overflowY: 'auto',
                    }} onClick={e => e.stopPropagation()}>
                        <div style={{ padding: 'var(--space-sm)', textAlign: 'center' }}>
                            <div style={{ width: 40, height: 4, background: 'var(--color-border)', borderRadius: 2, margin: '0 auto' }} />
                        </div>
                        <div style={{ padding: '0 var(--space-lg) var(--space-lg)' }}>
                            <AgencyJobDetailPanel
                                job={selectedJob}
                                showReferral={showReferral}
                                setShowReferral={setShowReferral}
                                referralForm={referralForm}
                                setReferralForm={setReferralForm}
                                onSubmitReferral={handleReferral}
                                submitting={submitting}
                            />
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

/* ============================================
   左パネル用コンパクトジョブカード
   ============================================ */
function JobListCard({ job, isSelected, onClick }) {
    return (
        <div
            onClick={onClick}
            style={{
                padding: 'var(--space-md)',
                borderRadius: 'var(--radius-lg)',
                border: isSelected ? '1.5px solid var(--color-navy)' : '1px solid var(--color-border)',
                background: isSelected ? 'rgba(18,28,52,0.05)' : 'var(--color-bg-surface)',
                cursor: 'pointer',
                transition: 'all var(--transition-fast)',
                boxShadow: isSelected ? '0 0 0 1px rgba(18,28,52,0.2)' : 'none',
            }}
            onMouseEnter={e => { if (!isSelected) e.currentTarget.style.borderColor = 'rgba(18,28,52,0.4)'; }}
            onMouseLeave={e => { if (!isSelected) e.currentTarget.style.borderColor = 'var(--color-border)'; }}
        >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-xs)' }}>
                <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', fontWeight: 500, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                    <Building2 size={13} strokeWidth={2} style={{ opacity: 0.6 }} /> {job.company?.company_name || '企業名非公開'}
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-xs)' }}>
                    {job.company?.company_type === 'recruitment_agency'
                        ? <span className="badge" style={{ fontSize: 10, padding: '1px 6px', background: 'rgba(18,28,52,0.08)', color: 'var(--color-navy)', border: '1px solid rgba(18,28,52,0.2)', borderRadius: 'var(--radius-full)' }}>エージェント案件</span>
                        : <span className="badge" style={{ fontSize: 10, padding: '1px 6px', background: 'rgba(18,28,52,0.08)', color: 'var(--color-primary)', border: '1px solid rgba(18,28,52,0.2)', borderRadius: 'var(--radius-full)' }}>直接採用</span>
                    }
                    {job.employment_type && <span className="badge badge-info" style={{ fontSize: 10, padding: '1px 6px' }}>{job.employment_type}</span>}
                    {job.fee_display && <span className="badge badge-accent" style={{ fontSize: 10, padding: '1px 6px' }}>手数料 {job.fee_display}</span>}
                </div>
            </div>

            <h4 style={{
                fontSize: 'var(--font-size-base)', fontWeight: 700,
                marginBottom: 'var(--space-xs)', lineHeight: 1.4,
                display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
            }}>
                {job.title}
            </h4>

            <div style={{ display: 'flex', gap: 'var(--space-sm)', flexWrap: 'wrap', marginBottom: 'var(--space-xs)' }}>
                {job.location && (
                    <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        <MapPin size={12} strokeWidth={2} style={{ opacity: 0.5 }} /> {job.location}
                    </span>
                )}
                {(job.salary_min || job.salary_max) && (
                    <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-success)', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        <Banknote size={12} strokeWidth={2} /> {job.salary_min ? `${Math.round(job.salary_min / 10000)}万` : ''}
                        {job.salary_min && job.salary_max ? '〜' : ''}
                        {job.salary_max ? `${Math.round(job.salary_max / 10000)}万円` : ''}
                    </span>
                )}
            </div>

            {job.description && (
                <p style={{
                    fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', lineHeight: 1.5,
                    display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
                    margin: 0,
                }}>{job.description}</p>
            )}

            {/* ペルソナサマリー */}
            {job.persona && (
                <div style={{
                    display: 'flex', gap: 'var(--space-xs)', flexWrap: 'wrap', marginTop: 'var(--space-sm)',
                    padding: 'var(--space-xs) var(--space-sm)',
                    background: 'rgba(200,149,46,0.06)',
                    border: '1px solid rgba(200,149,46,0.12)',
                    borderRadius: 'var(--radius-md)',
                    fontSize: 11,
                    color: 'var(--color-text-secondary)',
                    alignItems: 'center',
                }}>
                    <span style={{ color: 'var(--color-text-accent)', display: 'inline-flex', alignItems: 'center' }}><Target size={13} strokeWidth={2} /></span>
                    {(job.persona.age_min || job.persona.age_max) && (
                        <span>{job.persona.age_min || '?'}〜{job.persona.age_max || '?'}歳</span>
                    )}
                    {(job.persona.experience_min != null || job.persona.experience_max != null) && (
                        <span>経験{job.persona.experience_min ?? '?'}〜{job.persona.experience_max ?? '?'}年</span>
                    )}
                    {job.persona.target_skills?.length > 0 && (
                        <span style={{ fontWeight: 600 }}>{job.persona.target_skills.slice(0, 4).join(' / ')}{job.persona.target_skills.length > 4 ? ` +${job.persona.target_skills.length - 4}` : ''}</span>
                    )}
                    {job.persona.target_locations?.length > 0 && (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2 }}><MapPin size={11} strokeWidth={2} style={{ opacity: 0.5 }} />{job.persona.target_locations.slice(0, 2).join(',')}{job.persona.target_locations.length > 2 ? '...' : ''}</span>
                    )}
                    {parseFloat(job.persona.boost_factor) > 1.0 && (
                        <span style={{ color: '#d97706', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 2 }}><Zap size={11} strokeWidth={2} />{job.persona.boost_factor}x</span>
                    )}
                </div>
            )}
        </div>
    );
}

/* ============================================
   セクションヘッダー
   ============================================ */
function SectionHeader({ title }) {
    return (
        <h3 style={{
            fontSize: 'var(--font-size-sm)', fontWeight: 700, marginBottom: 'var(--space-sm)',
            color: 'var(--color-navy)', display: 'flex', alignItems: 'center', gap: 8,
            paddingBottom: 'var(--space-xs)', borderBottom: '1px solid var(--color-border)',
        }}>
            <span style={{ width: 3, height: 14, background: 'var(--color-accent)', borderRadius: 2, flexShrink: 0 }} /> {title}
        </h3>
    );
}

function InfoRow({ label, value }) {
    if (!value) return null;
    return (
        <div style={{ display: 'flex', gap: 'var(--space-sm)', padding: 'var(--space-xs) 0', borderBottom: '1px solid rgba(0,0,0,0.04)' }}>
            <span style={{ flex: '0 0 110px', fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', fontWeight: 600 }}>{label}</span>
            <span style={{ flex: 1, fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>{value}</span>
        </div>
    );
}

/* ============================================
   右パネル詳細ビュー（紹介申請フォーム付き）
   ============================================ */
function AgencyJobDetailPanel({ job, showReferral, setShowReferral, referralForm, setReferralForm, onSubmitReferral, submitting, selectedCandidate, setSelectedCandidate, resumeFile, setResumeFile, onOpenCandidateModal }) {
    const isDirect = job?.company?.company_type === 'direct_employer';
    return (
        <div className="card animate-fade-in" style={{ padding: 0, overflow: 'hidden' }}>
            {/* ヘッダー */}
            <div style={{
                padding: 'var(--space-lg) var(--space-xl)',
                borderBottom: '1px solid var(--color-border)',
                background: 'var(--color-bg-secondary)',
            }}>
                <h2 style={{ fontSize: 'var(--font-size-xl)', fontWeight: 700, marginBottom: 'var(--space-xs)', lineHeight: 1.4, color: 'var(--color-navy)' }}>
                    {job.title}
                </h2>
                <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-sm)', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Building2 size={14} strokeWidth={2} style={{ opacity: 0.6 }} /> {job.company?.company_name || '企業名非公開'}
                    {job.industry && <span style={{ marginLeft: 4, opacity: 0.7 }}>({job.industry})</span>}
                </p>

                <div style={{ display: 'flex', gap: 'var(--space-xs)', flexWrap: 'wrap', marginTop: 'var(--space-md)' }}>
                    {isDirect
                        ? <span className="badge" style={{ background: 'rgba(18,28,52,0.08)', color: 'var(--color-navy)', border: '1px solid rgba(18,28,52,0.2)', display: 'inline-flex', alignItems: 'center', gap: 4 }}><Building2 size={13} strokeWidth={2} /> 直接採用（パターン1）</span>
                        : <span className="badge" style={{ background: 'rgba(18,28,52,0.08)', color: 'var(--color-navy)', border: '1px solid rgba(18,28,52,0.2)', display: 'inline-flex', alignItems: 'center', gap: 4 }}><Users size={13} strokeWidth={2} /> エージェント案件（レベニューシェア）</span>
                    }
                    {job.employment_type && <span className="badge badge-info">{job.employment_type}</span>}
                    {job.remote_policy && <span className="badge badge-info">{job.remote_policy}</span>}
                    {job.location && <span className="badge badge-info" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><MapPin size={12} strokeWidth={2} /> {job.location}</span>}
                    {(job.salary_min || job.salary_max) && (
                        <span className="badge badge-success" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                            <Banknote size={12} strokeWidth={2} /> {job.salary_min ? `${Math.round(job.salary_min / 10000)}万` : ''}
                            {job.salary_min && job.salary_max ? '〜' : ''}
                            {job.salary_max ? `${Math.round(job.salary_max / 10000)}万円` : ''}
                        </span>
                    )}
                    {job.fee_display && <span className="badge badge-accent">手数料 {job.fee_display}</span>}
                </div>
            </div>

            {/* 紹介申請ボタンエリア */}
            <div style={{
                padding: 'var(--space-md) var(--space-xl)',
                borderBottom: '1px solid var(--color-border)',
                display: 'flex', alignItems: 'center', gap: 'var(--space-md)',
                background: 'rgba(18,28,52,0.03)',
            }}>
                <button className="btn btn-primary" onClick={() => setShowReferral(!showReferral)}>
                    {showReferral ? '詳細に戻る' : '紹介申請する'}
                </button>
                <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
                    候補者をこの求人に紹介できます
                </span>
            </div>

            {/* 紹介申請フォーム */}
            {showReferral ? (
                <div style={{ padding: 'var(--space-xl)' }}>
                    <h3 style={{ fontSize: 'var(--font-size-base)', fontWeight: 700, marginBottom: 'var(--space-lg)' }}>紹介申請フォーム</h3>

                    {/* 候補者選択 */}
                    <div className="form-group">
                        <label className="form-label">候補者を選択</label>
                        {selectedCandidate ? (
                            <div style={{
                                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                padding: 'var(--space-sm) var(--space-md)',
                                background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.2)',
                                borderRadius: 'var(--radius-md)',
                            }}>
                                <div>
                                    <span style={{ fontWeight: 700, fontSize: 'var(--font-size-sm)' }}>{selectedCandidate.display_name || '匿名ユーザー'}</span>
                                    <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', marginLeft: 'var(--space-sm)' }}>
                                        {selectedCandidate.desired_job_type} {selectedCandidate.location && `/ ${selectedCandidate.location}`}
                                    </span>
                                </div>
                                <button className="btn btn-secondary" style={{ fontSize: 'var(--font-size-xs)', padding: '2px 10px' }}
                                    onClick={() => setSelectedCandidate(null)}>解除</button>
                            </div>
                        ) : (
                            <button className="btn btn-secondary" style={{ width: '100%' }} onClick={onOpenCandidateModal}>
                                システム登録済みの候補者から選ぶ
                            </button>
                        )}
                        <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', marginTop: 4 }}>
                            スカウト公開中の求職者を検索・選択できます（任意）
                        </p>
                    </div>

                    {/* 履歴書PDF添付 */}
                    <div className="form-group">
                        <label className="form-label">履歴書PDFを添付</label>
                        {resumeFile ? (
                            <div style={{
                                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                padding: 'var(--space-sm) var(--space-md)',
                                background: 'var(--color-bg-secondary)', border: '1px solid var(--color-border)',
                                borderRadius: 'var(--radius-md)',
                            }}>
                                <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                                    <FileText size={14} strokeWidth={2} style={{ opacity: 0.6 }} /> {resumeFile.name} ({(resumeFile.size / 1024 / 1024).toFixed(1)}MB)
                                </span>
                                <button className="btn btn-secondary" style={{ fontSize: 'var(--font-size-xs)', padding: '2px 10px' }}
                                    onClick={() => setResumeFile(null)}>削除</button>
                            </div>
                        ) : (
                            <label style={{
                                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 'var(--space-sm)',
                                padding: 'var(--space-md)', border: '2px dashed var(--color-border)',
                                borderRadius: 'var(--radius-md)', cursor: 'pointer',
                                color: 'var(--color-text-muted)', fontSize: 'var(--font-size-sm)',
                                transition: 'all var(--transition-fast)',
                            }}
                            onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--color-accent)'}
                            onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--color-border)'}
                            >
                                <Paperclip size={16} strokeWidth={2} style={{ opacity: 0.6 }} /> PDFファイルを選択（最大10MB）
                                <input type="file" accept=".pdf" style={{ display: 'none' }}
                                    onChange={e => {
                                        const file = e.target.files?.[0];
                                        if (file) {
                                            if (file.size > 10 * 1024 * 1024) {
                                                alert('ファイルサイズは10MB以下にしてください');
                                                return;
                                            }
                                            setResumeFile(file);
                                        }
                                    }} />
                            </label>
                        )}
                    </div>

                    <div className="form-group">
                        <label className="form-label">候補者の概要 *</label>
                        <textarea className="form-textarea" rows={5} value={referralForm.candidate_summary}
                            onChange={e => setReferralForm({...referralForm, candidate_summary: e.target.value})}
                            placeholder="候補者の経歴・スキル・適性などを記入..." />
                    </div>
                    <div className="form-group">
                        <label className="form-label">メッセージ</label>
                        <textarea className="form-textarea" rows={3} value={referralForm.message}
                            onChange={e => setReferralForm({...referralForm, message: e.target.value})}
                            placeholder="紹介元への補足メッセージ（任意）" />
                    </div>

                    <div style={{ padding: 'var(--space-md)', background: 'var(--color-bg-secondary)', borderRadius: 'var(--radius-md)', marginBottom: 'var(--space-md)' }}>
                        <label className="form-label" style={{ fontSize: 'var(--font-size-sm)', marginBottom: 'var(--space-sm)' }}>手数料設定</label>

                        {isDirect ? (
                            /* パターン1: 企業←エージェント（直接紹介） */
                            <div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)', padding: 'var(--space-sm) var(--space-md)', background: 'rgba(18,28,52,0.04)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', marginBottom: 'var(--space-sm)' }}>
                                    <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', flex: 1 }}>求人に設定された紹介手数料</span>
                                    <span style={{ fontWeight: 700, fontSize: 'var(--font-size-base)', color: 'var(--color-accent)' }}>
                                        {job.fee_display || '要確認'}
                                    </span>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6, padding: 'var(--space-sm)', background: 'rgba(34,197,94,0.06)', border: '1px solid rgba(34,197,94,0.2)', borderRadius: 'var(--radius-sm)', fontSize: 'var(--font-size-xs)', color: '#166534', lineHeight: 1.6 }}>
                                    <CheckSquare size={14} strokeWidth={2} style={{ flexShrink: 0, marginTop: 1 }} />
                                    <span>パターン1（直接紹介）: 採用成功時に採用企業から紹介手数料を全額受け取ります。シェア分配はありません。</span>
                                </div>
                            </div>
                        ) : (
                            /* パターン2: エージェント間レベニューシェア */
                            <div>
                                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6, padding: 'var(--space-sm)', background: 'rgba(18,28,52,0.05)', border: '1px solid rgba(18,28,52,0.18)', borderRadius: 'var(--radius-sm)', fontSize: 'var(--font-size-xs)', color: 'var(--color-navy)', lineHeight: 1.6, marginBottom: 'var(--space-md)' }}>
                                    <RefreshCw size={14} strokeWidth={2} style={{ flexShrink: 0, marginTop: 1 }} />
                                    <span>パターン2（レベニューシェア）: 採用企業が紹介元エージェントに支払う手数料を、紹介元と紹介者で分配します。</span>
                                </div>
                                {/* 手数料タイプ切替 */}
                                <div style={{ display: 'flex', gap: 'var(--space-xs)', marginBottom: 'var(--space-md)' }}>
                                    {[{ value: 'percentage', label: '料率指定（%）' }, { value: 'fixed', label: '金額固定（円）' }].map(opt => (
                                        <button key={opt.value} type="button"
                                            onClick={() => setReferralForm(f => ({ ...f, fee_type: opt.value }))}
                                            style={{
                                                flex: 1, padding: '6px', borderRadius: 'var(--radius-md)',
                                                border: referralForm.fee_type === opt.value ? '1.5px solid var(--color-navy)' : '1px solid var(--color-border)',
                                                background: referralForm.fee_type === opt.value ? 'rgba(18,28,52,0.05)' : 'transparent',
                                                color: referralForm.fee_type === opt.value ? 'var(--color-navy)' : 'var(--color-text-secondary)',
                                                fontWeight: referralForm.fee_type === opt.value ? 700 : 400,
                                                fontSize: 'var(--font-size-xs)', cursor: 'pointer',
                                            }}>
                                            {opt.label}
                                        </button>
                                    ))}
                                </div>

                                {referralForm.fee_type === 'percentage' ? (
                                    <div className="grid grid-3" style={{ gap: 'var(--space-sm)' }}>
                                        <div>
                                            <label style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>手数料率(%)</label>
                                            <input type="number" className="form-input" value={referralForm.fee_percentage}
                                                onChange={e => setReferralForm({...referralForm, fee_percentage: Number(e.target.value)})}
                                                min={10} max={50} />
                                        </div>
                                        <div>
                                            <label style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>紹介元シェア(%)</label>
                                            <input type="number" className="form-input" value={referralForm.source_share}
                                                onChange={e => {
                                                    const v = Number(e.target.value);
                                                    setReferralForm({...referralForm, source_share: v, referrer_share: 100 - v});
                                                }} min={20} max={80} />
                                        </div>
                                        <div>
                                            <label style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>紹介者シェア(%)</label>
                                            <input type="number" className="form-input" value={referralForm.referrer_share}
                                                onChange={e => {
                                                    const v = Number(e.target.value);
                                                    setReferralForm({...referralForm, referrer_share: v, source_share: 100 - v});
                                                }} min={20} max={80} />
                                        </div>
                                    </div>
                                ) : (
                                    <div>
                                        <label style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>手数料金額（円）</label>
                                        <input type="number" className="form-input" value={referralForm.fee_amount}
                                            onChange={e => setReferralForm({...referralForm, fee_amount: e.target.value})}
                                            placeholder="例: 500000" min={1} />
                                        <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', marginTop: 4 }}>
                                            採用成功時に紹介元エージェントに支払う固定報酬額
                                        </p>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* システム利用料・免責事項 */}
                    <div style={{
                        background: 'var(--color-bg-surface)',
                        border: '1px solid var(--color-border)',
                        borderRadius: 'var(--radius-md)',
                        padding: 'var(--space-md)',
                        marginBottom: 'var(--space-lg)',
                    }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-sm)' }}>
                            <span style={{ fontWeight: 700, fontSize: 'var(--font-size-sm)' }}>システム利用料</span>
                            <span style={{ fontWeight: 700, fontSize: 'var(--font-size-lg)', color: 'var(--color-primary)' }}>¥500（税込）</span>
                        </div>
                        <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', marginBottom: 'var(--space-sm)', lineHeight: 1.6 }}>
                            紹介申請の送信1件につきシステム利用料500円（税込）が登録済みのクレジットカードに課金されます。システム利用料は紹介の成否にかかわらず返金されません。
                        </p>
                        <div style={{
                            background: 'rgba(245, 158, 11, 0.08)',
                            border: '1px solid rgba(245, 158, 11, 0.2)',
                            borderRadius: 'var(--radius-sm)',
                            padding: 'var(--space-sm)',
                            fontSize: 'var(--font-size-xs)',
                            color: 'var(--color-text-secondary)',
                            lineHeight: 1.6,
                        }}>
                            <strong>免責事項（必ずお読みください）</strong><br/>
                            本プラットフォームは求人情報のマッチングシステムを提供するものであり、紹介元企業と紹介先企業間の採用活動・契約関係には一切関与いたしません。
                            成約報酬の支払い条件、返金規定、候補者の採否等については、紹介元と紹介先の間で別途契約書を締結のうえ、双方の責任において取り決めてください。
                            当プラットフォームは、紹介の結果生じたいかなる損害・紛争についても責任を負いません。
                            紹介先企業の連絡先情報は、紹介申請が承認された後に開示されます。
                        </div>
                        <label style={{
                            display: 'flex', alignItems: 'flex-start', gap: 'var(--space-xs)',
                            marginTop: 'var(--space-sm)', cursor: 'pointer', fontSize: 'var(--font-size-xs)',
                        }}>
                            <input type="checkbox" checked={referralForm.terms_accepted}
                                onChange={e => setReferralForm({...referralForm, terms_accepted: e.target.checked})}
                                style={{ marginTop: '2px' }} />
                            <span>上記の免責事項を確認し、システム利用料500円（税込）の課金に同意します</span>
                        </label>
                    </div>

                    <div style={{ display: 'flex', gap: 'var(--space-sm)', justifyContent: 'flex-end' }}>
                        <button className="btn btn-secondary" onClick={() => setShowReferral(false)}>キャンセル</button>
                        <button className="btn btn-primary" onClick={onSubmitReferral} disabled={submitting || !referralForm.terms_accepted}>
                            {submitting ? '決済・送信中...' : '¥500 を支払って紹介申請を送信'}
                        </button>
                    </div>
                </div>
            ) : (
                /* 求人詳細 */
                <div style={{ padding: 'var(--space-xl)' }}>

                    {/* 仕事内容 */}
                    <div style={{ marginBottom: 'var(--space-xl)' }}>
                        <SectionHeader title="仕事内容" />
                        <p style={{ color: 'var(--color-text-secondary)', whiteSpace: 'pre-wrap', lineHeight: 1.7, fontSize: 'var(--font-size-sm)' }}>
                            {job.description}
                        </p>
                    </div>

                    {/* 応募要件 */}
                    {job.requirements && (
                        <div style={{ marginBottom: 'var(--space-xl)' }}>
                            <SectionHeader title="応募要件" />
                            <p style={{ color: 'var(--color-text-secondary)', whiteSpace: 'pre-wrap', lineHeight: 1.7, fontSize: 'var(--font-size-sm)' }}>
                                {job.requirements}
                            </p>
                        </div>
                    )}

                    {/* 給与・待遇 */}
                    {(job.salary_min || job.salary_max || job.salary_details) && (
                        <div style={{ marginBottom: 'var(--space-xl)' }}>
                            <SectionHeader title="給与・待遇" />
                            <InfoRow label="給与" value={job.salary_details || formatSalary(job) || null} />
                            <InfoRow label="手数料" value={job.fee_display} />
                            <InfoRow label="紹介条件" value={job.referral_conditions} />
                        </div>
                    )}

                    {/* 勤務条件 */}
                    {(job.work_hours || job.holidays || job.remote_policy || job.office_address) && (
                        <div style={{ marginBottom: 'var(--space-xl)' }}>
                            <SectionHeader title="勤務条件" />
                            <InfoRow label="勤務時間" value={job.work_hours} />
                            <InfoRow label="残業" value={job.overtime_average} />
                            <InfoRow label="休日・休暇" value={job.holidays} />
                            <InfoRow label="リモート" value={job.remote_policy} />
                            <InfoRow label="勤務地" value={job.office_address || job.location} />
                        </div>
                    )}

                    {/* 選考情報 */}
                    {job.selection_process && (
                        <div style={{ marginBottom: 'var(--space-xl)' }}>
                            <SectionHeader title="選考について" />
                            <p style={{ color: 'var(--color-text-secondary)', whiteSpace: 'pre-wrap', lineHeight: 1.7, fontSize: 'var(--font-size-sm)' }}>
                                {job.selection_process}
                            </p>
                        </div>
                    )}

                    {/* ペルソナ（ターゲット人材） */}
                    {job.persona && (
                        <div style={{ marginBottom: 'var(--space-xl)' }}>
                            <SectionHeader title="ターゲット人材" />
                            <div style={{
                                display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-sm)',
                                fontSize: 'var(--font-size-sm)',
                            }}>
                                {(job.persona.age_min || job.persona.age_max) && (
                                    <div style={{ padding: 'var(--space-sm)', background: 'var(--color-bg-surface)', borderRadius: 'var(--radius-md)' }}>
                                        <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', display: 'block', marginBottom: 2 }}>年齢</span>
                                        <span style={{ fontWeight: 600 }}>{job.persona.age_min || '?'}〜{job.persona.age_max || '?'}歳</span>
                                    </div>
                                )}
                                {(job.persona.experience_min != null || job.persona.experience_max != null) && (
                                    <div style={{ padding: 'var(--space-sm)', background: 'var(--color-bg-surface)', borderRadius: 'var(--radius-md)' }}>
                                        <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', display: 'block', marginBottom: 2 }}>経験年数</span>
                                        <span style={{ fontWeight: 600 }}>{job.persona.experience_min ?? '?'}〜{job.persona.experience_max ?? '?'}年</span>
                                    </div>
                                )}
                                {job.persona.target_education && job.persona.target_education !== '不問' && (
                                    <div style={{ padding: 'var(--space-sm)', background: 'var(--color-bg-surface)', borderRadius: 'var(--radius-md)' }}>
                                        <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', display: 'block', marginBottom: 2 }}>学歴</span>
                                        <span style={{ fontWeight: 600 }}>{job.persona.target_education}</span>
                                    </div>
                                )}
                                {job.persona.target_employment_status && job.persona.target_employment_status !== 'どちらでも' && (
                                    <div style={{ padding: 'var(--space-sm)', background: 'var(--color-bg-surface)', borderRadius: 'var(--radius-md)' }}>
                                        <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', display: 'block', marginBottom: 2 }}>雇用状況</span>
                                        <span style={{ fontWeight: 600 }}>{job.persona.target_employment_status}</span>
                                    </div>
                                )}
                            </div>
                            {job.persona.target_skills?.length > 0 && (
                                <div style={{ marginTop: 'var(--space-sm)' }}>
                                    <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>求めるスキル:</span>
                                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 4 }}>
                                        {job.persona.target_skills.map((s, i) => (
                                            <span key={i} style={{
                                                padding: '2px 8px', borderRadius: 'var(--radius-full)',
                                                background: 'rgba(200,149,46,0.1)', border: '1px solid rgba(200,149,46,0.2)',
                                                fontSize: 'var(--font-size-xs)', color: 'var(--color-text-accent)', fontWeight: 600,
                                            }}>{s}</span>
                                        ))}
                                    </div>
                                </div>
                            )}
                            {job.persona.target_locations?.length > 0 && (
                                <div style={{ marginTop: 'var(--space-sm)' }}>
                                    <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>希望勤務地:</span>
                                    <span style={{ fontSize: 'var(--font-size-sm)', marginLeft: 'var(--space-xs)' }}>{job.persona.target_locations.join(', ')}</span>
                                </div>
                            )}
                            {job.persona.target_job_types?.length > 0 && (
                                <div style={{ marginTop: 'var(--space-xs)' }}>
                                    <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>対象職種:</span>
                                    <span style={{ fontSize: 'var(--font-size-sm)', marginLeft: 'var(--space-xs)' }}>{job.persona.target_job_types.join(', ')}</span>
                                </div>
                            )}
                            {parseFloat(job.persona.boost_factor) > 1.0 && (
                                <div style={{
                                    marginTop: 'var(--space-sm)', padding: 'var(--space-xs) var(--space-sm)',
                                    background: 'rgba(245,158,11,0.08)', borderRadius: 'var(--radius-md)',
                                    fontSize: 'var(--font-size-xs)', color: '#d97706', fontWeight: 600,
                                    display: 'inline-flex', alignItems: 'center', gap: 4,
                                }}>
                                    <Zap size={13} strokeWidth={2} /> ブースト {job.persona.boost_factor}x（この求人は優先表示されています）
                                </div>
                            )}
                        </div>
                    )}

                    {/* アピールポイント */}
                    {job.appeal_points && (
                        <div style={{
                            padding: 'var(--space-md)', background: 'rgba(245,158,11,0.04)',
                            borderRadius: 'var(--radius-md)', marginTop: 'var(--space-md)',
                        }}>
                            <p style={{ fontSize: 'var(--font-size-xs)', fontWeight: 700, color: '#d97706', marginBottom: 4 }}>この求人のポイント</p>
                            <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', whiteSpace: 'pre-wrap', lineHeight: 1.6, margin: 0 }}>
                                {job.appeal_points}
                            </p>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

/* ============================================
   フィルターバッジ
   ============================================ */
function FilterBadge({ icon, label, color, onRemove }) {
    const isGreen = color === 'green';
    return (
        <span style={{
            display: 'flex', alignItems: 'center', gap: 4,
            padding: '2px 10px', borderRadius: 'var(--radius-full)',
            background: isGreen ? 'rgba(16,185,129,0.1)' : 'rgba(18,28,52,0.1)',
            border: isGreen ? '1px solid rgba(16,185,129,0.2)' : '1px solid rgba(18,28,52,0.2)',
            fontSize: 'var(--font-size-xs)',
            color: isGreen ? 'var(--color-success)' : 'var(--color-text-accent)',
        }}>
            {icon} {label}
            <button onClick={onRemove}
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: 'inherit', lineHeight: 1, fontSize: 12 }}>✕</button>
        </span>
    );
}
