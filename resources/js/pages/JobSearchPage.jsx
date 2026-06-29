import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import api from '../api';
import { useToast } from '../hooks/useToast';
import SEO from '../components/SEO';
import GuestProfileBanner, { getGuestProfile } from '../components/GuestProfileBanner';
import { JOB_CATEGORY_MAJORS } from '../data/jobCategories';
import { formatSalary } from '../utils/salary';

const EMPLOYMENT_TYPES = [
    { value: '', label: 'すべて' },
    { value: '正社員', label: '正社員' },
    { value: '契約社員', label: '契約社員' },
    { value: 'パート', label: 'パート・アルバイト' },
    { value: '派遣', label: '派遣社員' },
    { value: '業務委託', label: '業務委託' },
    { value: 'インターン', label: 'インターン' },
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

const SORT_OPTIONS = [
    { value: 'ranking', label: 'おすすめ順' },
    { value: 'newest', label: '新着順' },
    { value: 'salary_high', label: '年収の高い順' },
];

const AREAS = ['東京都', '大阪府', '愛知県', '神奈川県', '福岡県', '北海道', 'リモート可'];

const APPLICATION_TYPES = [
    { value: '', label: 'すべて' },
    { value: '中途', label: '中途採用' },
    { value: '新卒', label: '新卒採用' },
    { value: '中途・新卒', label: '中途・新卒' },
];

const REMOTE_OPTIONS = [
    { value: '', label: 'すべて' },
    { value: 'フルリモート', label: 'フルリモート' },
    { value: 'ハイブリッド', label: 'ハイブリッド' },
    { value: '出社', label: '原則出社' },
];

const FEATURE_TAG_OPTIONS = [
    '上場企業', '外資系', 'ベンチャー', 'スタートアップ', '急成長中',
    'リモートワーク可', 'フレックスタイム', '年間休日120日以上', '土日祝休み',
    '副業OK', 'ストックオプション', '退職金制度', '住宅手当', '家族手当',
    '研修充実', '資格取得支援', '英語力を活かせる', '未経験歓迎',
    '第二新卒歓迎', '管理職候補', '転勤なし', '駅チカ',
];

const JOB_CATEGORIES = [
    { icon: '💻', label: 'IT・エンジニア' },
    { icon: '📊', label: '営業・マーケ' },
    { icon: '🎨', label: 'デザイン' },
    { icon: '💼', label: '経営・企画' },
    { icon: '🏥', label: '医療・介護' },
    { icon: '🏗️', label: '建設・不動産' },
    { icon: '📚', label: '教育' },
    { icon: '🛒', label: '販売・接客' },
];

// 検索履歴ユーティリティ
const SEARCH_HISTORY_KEY = 'search_history';
const MAX_HISTORY = 10;

function getSearchHistory() {
    try {
        return JSON.parse(localStorage.getItem(SEARCH_HISTORY_KEY) || '[]');
    } catch {
        return [];
    }
}

function addSearchHistory(keyword, location) {
    if (!keyword && !location) return;
    const history = getSearchHistory();
    // 同じ検索を除去
    const filtered = history.filter(
        h => !(h.keyword === keyword && h.location === location)
    );
    filtered.unshift({ keyword: keyword || '', location: location || '', timestamp: Date.now() });
    localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(filtered.slice(0, MAX_HISTORY)));
}

function clearSearchHistory() {
    localStorage.removeItem(SEARCH_HISTORY_KEY);
}

// キーワードサジェスト（デバウンス付き）
const POPULAR_KEYWORDS = [
    'エンジニア', 'デザイナー', 'マーケティング', '営業', '事務', '経理',
    'プログラマー', 'ディレクター', 'マネージャー', 'コンサルタント',
    'React', 'Python', 'Java', 'AWS', 'データ分析', '人事', '広報',
    'カスタマーサポート', 'ライター', 'プロジェクトマネージャー',
];

export default function JobSearchPage() {
    const [searchParams] = useSearchParams();
    const { user } = useAuth();
    const toast = useToast();
    const navigate = useNavigate();
    const listRef = useRef(null);

    const [filters, setFilters] = useState(() => ({
        keyword: searchParams.get('keyword') || '',
        location: searchParams.get('location') || '',
        employment_type: searchParams.get('employment_type') || '',
        salary_min: searchParams.get('salary_min') || '',
        job_category_major: searchParams.get('job_category_major') || '',
        application_type: searchParams.get('application_type') || '',
        remote_policy: searchParams.get('remote_policy') || '',
        feature_tags: searchParams.get('feature_tags') ? searchParams.get('feature_tags').split(',') : [],
        sort: searchParams.get('sort') || 'ranking',
    }));
    const [inputKeyword, setInputKeyword] = useState(filters.keyword);
    const [inputLocation, setInputLocation] = useState(filters.location);
    const [showHistory, setShowHistory] = useState(false);
    const [searchHistory, setSearchHistory] = useState(getSearchHistory);
    const historyRef = useRef(null);
    const [suggestions, setSuggestions] = useState([]);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const suggestTimerRef = useRef(null);

    // キーワードサジェスト（入力時にフィルタリング）
    const handleKeywordChange = (value) => {
        setInputKeyword(value);
        if (suggestTimerRef.current) clearTimeout(suggestTimerRef.current);
        if (value.length >= 1) {
            suggestTimerRef.current = setTimeout(() => {
                const lower = value.toLowerCase();
                const matches = POPULAR_KEYWORDS.filter(k => k.toLowerCase().includes(lower)).slice(0, 6);
                setSuggestions(matches);
                setShowSuggestions(matches.length > 0);
                setShowHistory(false);
            }, 150);
        } else {
            setSuggestions([]);
            setShowSuggestions(false);
        }
    };

    const handleSuggestionClick = (keyword) => {
        setInputKeyword(keyword);
        setShowSuggestions(false);
        setFilters(prev => ({ ...prev, keyword }));
        setPage(1);
        addSearchHistory(keyword, inputLocation);
        setSearchHistory(getSearchHistory());
    };

    const [jobs, setJobs] = useState([]);
    const [meta, setMeta] = useState(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false); // データあり状態での再取得中フラグ
    const [page, setPage] = useState(() => {
        const p = parseInt(searchParams.get('page'), 10);
        return p > 0 ? p : 1;
    });
    const [perPage, setPerPage] = useState(() => {
        const saved = localStorage.getItem('jobSearchPerPage');
        return saved ? parseInt(saved, 10) : 20;
    });
    const [showFilters, setShowFilters] = useState(false);
    const [savedJobs, setSavedJobs] = useState(() => {
        try { return JSON.parse(localStorage.getItem('savedJobs') || '[]'); } catch { return []; }
    });
    const [appliedJobIds, setAppliedJobIds] = useState([]);
    const [alertSuccess, setAlertSuccess] = useState(false);
    const [alertSaving, setAlertSaving] = useState(false);
    const [showAlerts, setShowAlerts] = useState(false);
    const [jobAlerts, setJobAlerts] = useState([]);

    // ゲスト属性プロフィール（未ログイン時のペルソナマッチ用）
    const [guestProfile, setGuestProfile] = useState(() => getGuestProfile());

    // Split-pane state
    const [selectedJobId, setSelectedJobId] = useState(null);
    const [selectedJob, setSelectedJob] = useState(null);
    const [detailLoading, setDetailLoading] = useState(false);
    // 選択中の求人リスト上のデータ（クリック瞬時表示用）
    const selectedJobListDataRef = useRef(null);
    const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

    // Sync filters + page to URL query parameters
    useEffect(() => {
        const params = new URLSearchParams();
        if (filters.keyword) params.set('keyword', filters.keyword);
        if (filters.location) params.set('location', filters.location);
        if (filters.employment_type) params.set('employment_type', filters.employment_type);
        if (filters.salary_min) params.set('salary_min', filters.salary_min);
        if (filters.job_category_major) params.set('job_category_major', filters.job_category_major);
        if (filters.application_type) params.set('application_type', filters.application_type);
        if (filters.remote_policy) params.set('remote_policy', filters.remote_policy);
        if (filters.feature_tags?.length > 0) params.set('feature_tags', filters.feature_tags.join(','));
        if (filters.sort && filters.sort !== 'ranking') params.set('sort', filters.sort);
        if (page > 1) params.set('page', String(page));
        const qs = params.toString();
        const newUrl = qs ? `${window.location.pathname}?${qs}` : window.location.pathname;
        window.history.replaceState(null, '', newUrl);
    }, [filters, page]);

    const activeFilterCount = [
        filters.employment_type, filters.salary_min, filters.location,
        filters.job_category_major, filters.application_type, filters.remote_policy,
        filters.feature_tags?.length > 0 ? true : '',
    ].filter(Boolean).length;

    // 認証済みユーザー: 保存済み求人・応募済み求人をAPIから取得
    useEffect(() => {
        if (!user) return;
        api.get('/saved-jobs')
            .then(res => {
                setSavedJobs(res.data);
                localStorage.setItem('savedJobs', JSON.stringify(res.data));
            })
            .catch(() => {});
        api.get('/my-applications/job-ids')
            .then(res => setAppliedJobIds(res.data))
            .catch(() => {});
        // 求人アラートはMVP期間中は無効化中のため取得しない
    }, [user]);

    // レスポンシブ判定
    useEffect(() => {
        const onResize = () => setIsMobile(window.innerWidth < 768);
        window.addEventListener('resize', onResize);
        return () => window.removeEventListener('resize', onResize);
    }, []);

    const abortControllerRef = useRef(null);
    // フィルター変更かページ送りかを区別するためのref（null = 初回）
    const prevFiltersRef = useRef(null);

    const fetchJobs = useCallback(async (currentFilters, currentPage, currentGuestProfile, resetSelection) => {
        // 前回のリクエストをキャンセル（race condition防止）
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
        }
        const controller = new AbortController();
        abortControllerRef.current = controller;

        // データが既にある場合はスケルトンを出さず、薄いオーバーレイのみ表示
        const hasExistingData = jobs.length > 0;
        if (hasExistingData) {
            setRefreshing(true);
        } else {
            setLoading(true);
        }

        try {
            const params = { page: currentPage, per_page: perPage };
            if (currentFilters.keyword) params.keyword = currentFilters.keyword;
            if (currentFilters.location) params.location = currentFilters.location;
            if (currentFilters.employment_type) params.employment_type = currentFilters.employment_type;
            if (currentFilters.salary_min) params.salary_min = currentFilters.salary_min;
            if (currentFilters.sort) params.sort = currentFilters.sort;
            if (currentFilters.job_category_major) params.job_category_major = currentFilters.job_category_major;
            if (currentFilters.application_type) params.application_type = currentFilters.application_type;
            if (currentFilters.remote_policy) params.remote_policy = currentFilters.remote_policy;
            if (currentFilters.feature_tags?.length > 0) params.feature_tags = currentFilters.feature_tags.join(',');
            // ゲスト属性パラメータ（未ログイン時のペルソナマッチ用）
            if (!user && currentGuestProfile) {
                if (currentGuestProfile.age) params.guest_age = currentGuestProfile.age;
                if (currentGuestProfile.experience_years) params.guest_experience_years = currentGuestProfile.experience_years;
            }
            // スキルフィルター（ログイン/未ログイン共通 - 件数絞り込みに使用）
            if (currentGuestProfile?.skills?.length > 0) {
                params.guest_skills = currentGuestProfile.skills.join(',');
            }
            const res = await api.get('/jobs', { params, signal: controller.signal });
            const data = res.data.data || [];
            setJobs(data);
            setMeta(res.data);
            // フィルター変更・初回のみ先頭を自動選択（ページ送りは現在の選択を維持）
            if (data.length > 0 && !isMobile && resetSelection) {
                selectedJobListDataRef.current = data[0];
                setSelectedJob(data[0]);
                setSelectedJobId(data[0].id);
            }
        } catch (err) {
            if (err.name === 'AbortError' || err.code === 'ERR_CANCELED') return;
            toast.error('求人情報の取得に失敗しました');
        } finally {
            if (!controller.signal.aborted) {
                setLoading(false);
                setRefreshing(false);
            }
        }
    }, [isMobile, user, perPage]);

    useEffect(() => {
        // 初回 or フィルター変更 → 先頭を自動選択 / ページ送りのみ → 選択を維持
        const filtersKey = JSON.stringify(filters);
        const resetSelection = prevFiltersRef.current === null || prevFiltersRef.current !== filtersKey;
        prevFiltersRef.current = filtersKey;
        fetchJobs(filters, page, guestProfile, resetSelection);
        return () => {
            if (abortControllerRef.current) {
                abortControllerRef.current.abort();
            }
        };
    }, [filters, page, guestProfile]);

    // 選択された求人の詳細をバックグラウンドで取得（リストデータはクリック時に即表示済み）
    useEffect(() => {
        if (!selectedJobId) {
            setSelectedJob(null);
            selectedJobListDataRef.current = null;
            return;
        }
        // リストデータが即セットされていない場合のみローディング表示
        const hasInstantData = selectedJobListDataRef.current?.id === selectedJobId;
        if (!hasInstantData) {
            setDetailLoading(true);
        }
        api.get(`/jobs/${selectedJobId}`)
            .then(res => setSelectedJob(res.data))
            .catch(() => { if (!hasInstantData) setSelectedJob(null); })
            .finally(() => setDetailLoading(false));
    }, [selectedJobId]);

    // 検索履歴: 外側クリックで閉じる
    useEffect(() => {
        const onClickOutside = (e) => {
            if (historyRef.current && !historyRef.current.contains(e.target)) {
                setShowHistory(false);
                setShowSuggestions(false);
            }
        };
        document.addEventListener('mousedown', onClickOutside);
        return () => document.removeEventListener('mousedown', onClickOutside);
    }, []);

    const handleSearch = (e) => {
        e.preventDefault();
        addSearchHistory(inputKeyword, inputLocation);
        setSearchHistory(getSearchHistory());
        setShowHistory(false);
        setShowSuggestions(false);
        setFilters(prev => ({ ...prev, keyword: inputKeyword, location: inputLocation }));
        setPage(1);
    };

    const handleHistoryClick = (entry) => {
        setInputKeyword(entry.keyword);
        setInputLocation(entry.location);
        setShowHistory(false);
        setFilters(prev => ({ ...prev, keyword: entry.keyword, location: entry.location }));
        setPage(1);
    };

    const handleClearHistory = () => {
        clearSearchHistory();
        setSearchHistory([]);
        setShowHistory(false);
    };

    const updateFilter = (key, value) => {
        setFilters(prev => ({ ...prev, [key]: value }));
        setPage(1);
    };

    const clearFilters = () => {
        const next = {
            keyword: '', location: '', employment_type: '', salary_min: '',
            job_category_major: '', application_type: '', remote_policy: '',
            feature_tags: [], sort: 'ranking',
        };
        setFilters(next);
        setInputKeyword('');
        setInputLocation('');
        setPage(1);
    };

    const saveJobAlert = async () => {
        setAlertSaving(true);
        try {
            const payload = {};
            if (filters.keyword) payload.keyword = filters.keyword;
            if (filters.location) payload.location = filters.location;
            if (filters.employment_type) payload.employment_type = filters.employment_type;
            if (filters.salary_min) payload.salary_min = Number(filters.salary_min);
            const res = await api.post('/job-alerts', payload);
            setJobAlerts(prev => [res.data, ...prev]);
            setAlertSuccess(true);
            setTimeout(() => setAlertSuccess(false), 3000);
        } catch (err) {
            console.error(err);
        } finally {
            setAlertSaving(false);
        }
    };

    const deleteJobAlert = async (alertId) => {
        try {
            await api.delete(`/job-alerts/${alertId}`);
            setJobAlerts(prev => prev.filter(a => a.id !== alertId));
        } catch (err) {
            console.error(err);
        }
    };

    const toggleSaveJob = async (jobId) => {
        const isSaved = savedJobs.includes(jobId);
        // 楽観的UI更新
        const next = isSaved
            ? savedJobs.filter(id => id !== jobId)
            : [...savedJobs, jobId];
        setSavedJobs(next);

        if (user) {
            try {
                if (isSaved) {
                    await api.delete(`/saved-jobs/${jobId}`);
                } else {
                    await api.post(`/saved-jobs/${jobId}`);
                }
            } catch {
                // APIエラー時はロールバック
                setSavedJobs(savedJobs);
            }
        } else {
            // 未認証ユーザーはlocalStorageにフォールバック
            localStorage.setItem('savedJobs', JSON.stringify(next));
        }
    };

    const handleJobClick = (job) => {
        if (isMobile) {
            navigate(`/jobs/${job.id}`);
        } else {
            // リストデータを即座に表示（待機時間ゼロ）、詳細はバックグラウンドで取得
            selectedJobListDataRef.current = job;
            setSelectedJob(job);
            setSelectedJobId(job.id);
        }
    };

    // ホバー時に詳細をプリフェッチ（クリック前にAPIレスポンスをキャッシュに入れる）
    const prefetchTimer = useRef(null);
    const handleJobHover = (jobId) => {
        if (jobId === selectedJobId || isMobile) return;
        // 200ms後にプリフェッチ（素早いマウス通過は無視）
        clearTimeout(prefetchTimer.current);
        prefetchTimer.current = setTimeout(() => {
            api.get(`/jobs/${jobId}`).catch(() => {});
        }, 200);
    };
    const handleJobHoverEnd = () => clearTimeout(prefetchTimer.current);

    return (
        <div className="page" style={{ background: 'var(--color-bg-primary)' }}>
            <SEO
                title="求人検索"
                description="Atallyで求人を検索。正社員、契約社員、パート、業務委託など多様な働き方から、あなたに最適な仕事を見つけましょう。"
            />

            {/* 検索ヘッダー（sticky） */}
            <div style={{
                background: 'linear-gradient(135deg, rgba(18,28,52,0.1) 0%, rgba(168,85,247,0.06) 100%)',
                borderBottom: '1px solid var(--color-border)',
                padding: 'var(--space-xl) 0 var(--space-md)',
                position: 'sticky', top: 52, zIndex: 100,
                backdropFilter: 'blur(12px)',
            }}>
                <div className="container">
                    <form onSubmit={handleSearch} style={{ display: 'flex', gap: 'var(--space-sm)', flexWrap: 'wrap' }}>
                        <div style={{ flex: '2 1 220px', position: 'relative' }} ref={historyRef}>
                            <span style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', fontSize: 16, opacity: 0.4, zIndex: 1 }}>🔍</span>
                            <input type="text" className="form-input" placeholder="職種・スキル・会社名"
                                value={inputKeyword} onChange={e => handleKeywordChange(e.target.value)}
                                onFocus={() => { if (!inputKeyword && searchHistory.length > 0) { setShowHistory(true); setShowSuggestions(false); } }}
                                style={{ paddingLeft: 40, height: 46 }} />
                            {/* キーワードサジェスト */}
                            {showSuggestions && suggestions.length > 0 && (
                                <div style={{
                                    position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 201,
                                    background: 'var(--color-bg-secondary)', border: '1px solid var(--color-border)',
                                    borderRadius: 'var(--radius-md)', boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                                    marginTop: 4, overflow: 'hidden',
                                }}>
                                    <div style={{ padding: '6px 14px', borderBottom: '1px solid var(--color-border)' }}>
                                        <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', fontWeight: 600 }}>候補</span>
                                    </div>
                                    {suggestions.map((s, i) => (
                                        <button type="button" key={i} onClick={() => handleSuggestionClick(s)} style={{
                                            display: 'flex', alignItems: 'center', gap: 8, width: '100%', textAlign: 'left',
                                            background: 'none', border: 'none', padding: '10px 14px', cursor: 'pointer',
                                            borderBottom: i < suggestions.length - 1 ? '1px solid rgba(0,0,0,0.04)' : 'none',
                                            fontSize: 'var(--font-size-sm)', color: 'var(--color-text-primary)',
                                            transition: 'background 0.1s',
                                        }}
                                        onMouseEnter={e => e.currentTarget.style.background = 'var(--color-accent-light)'}
                                        onMouseLeave={e => e.currentTarget.style.background = 'none'}>
                                            <span style={{ color: 'var(--color-text-muted)', fontSize: 12 }}>🔍</span>
                                            {s}
                                        </button>
                                    ))}
                                </div>
                            )}
                            {showHistory && searchHistory.length > 0 && !showSuggestions && (
                                <div style={{
                                    position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 200,
                                    background: 'var(--color-bg-primary)', border: '1px solid var(--color-border)',
                                    borderRadius: 'var(--radius-md)', boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                                    marginTop: 4, maxHeight: 300, overflow: 'auto',
                                }}>
                                    <div style={{ padding: '8px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--color-border)' }}>
                                        <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', fontWeight: 600 }}>検索履歴</span>
                                        <button type="button" onClick={handleClearHistory} style={{
                                            background: 'none', border: 'none', cursor: 'pointer',
                                            fontSize: 'var(--font-size-xs)', color: 'var(--color-text-accent)',
                                        }}>履歴をクリア</button>
                                    </div>
                                    {searchHistory.map((entry, i) => (
                                        <button type="button" key={i} onClick={() => handleHistoryClick(entry)} style={{
                                            display: 'block', width: '100%', textAlign: 'left', background: 'none',
                                            border: 'none', padding: '10px 14px', cursor: 'pointer',
                                            borderBottom: i < searchHistory.length - 1 ? '1px solid rgba(0,0,0,0.04)' : 'none',
                                            fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)',
                                        }}>
                                            <span>{entry.keyword || '(キーワードなし)'}</span>
                                            {entry.location && <span style={{ marginLeft: 8, color: 'var(--color-text-muted)' }}>📍{entry.location}</span>}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                        <div style={{ flex: '1 1 160px', position: 'relative' }}>
                            <span style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', fontSize: 16, opacity: 0.4 }}>📍</span>
                            <input type="text" className="form-input" placeholder="勤務地" list="location-suggestions"
                                value={inputLocation} onChange={e => setInputLocation(e.target.value)}
                                style={{ paddingLeft: 40, height: 46 }} />
                            <datalist id="location-suggestions">
                                {['東京都', '大阪府', '愛知県', '神奈川県', '福岡県', '北海道', '埼玉県', '千葉県', '兵庫県', '京都府', '広島県', '宮城県', 'リモート'].map(a => (
                                    <option key={a} value={a} />
                                ))}
                            </datalist>
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

                    {/* 絞り込みパネル */}
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
                            <div style={{ flex: '1 1 200px' }}>
                                <label className="form-label" style={{ fontSize: 'var(--font-size-xs)' }}>職種カテゴリ</label>
                                <select className="form-select" value={filters.job_category_major}
                                    onChange={e => updateFilter('job_category_major', e.target.value)} style={{ height: 40 }}>
                                    <option value="">すべて</option>
                                    {JOB_CATEGORY_MAJORS.map(m => <option key={m} value={m}>{m}</option>)}
                                </select>
                            </div>
                            <div style={{ flex: '1 1 160px' }}>
                                <label className="form-label" style={{ fontSize: 'var(--font-size-xs)' }}>応募区分</label>
                                <select className="form-select" value={filters.application_type}
                                    onChange={e => updateFilter('application_type', e.target.value)} style={{ height: 40 }}>
                                    {APPLICATION_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                                </select>
                            </div>
                            <div style={{ flex: '1 1 160px' }}>
                                <label className="form-label" style={{ fontSize: 'var(--font-size-xs)' }}>リモート</label>
                                <select className="form-select" value={filters.remote_policy}
                                    onChange={e => updateFilter('remote_policy', e.target.value)} style={{ height: 40 }}>
                                    {REMOTE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                                </select>
                            </div>
                            {activeFilterCount > 0 && (
                                <button className="btn btn-secondary" style={{ height: 40, fontSize: 'var(--font-size-xs)' }} onClick={clearFilters}>
                                    クリア
                                </button>
                            )}
                            {/* 特徴タグ */}
                            <div style={{ width: '100%' }}>
                                <label className="form-label" style={{ fontSize: 'var(--font-size-xs)', marginBottom: 4 }}>特徴タグ</label>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                                    {FEATURE_TAG_OPTIONS.map(tag => {
                                        const isActive = filters.feature_tags?.includes(tag);
                                        return (
                                            <button key={tag} type="button"
                                                onClick={() => {
                                                    const next = isActive
                                                        ? filters.feature_tags.filter(t => t !== tag)
                                                        : [...(filters.feature_tags || []), tag];
                                                    updateFilter('feature_tags', next);
                                                }}
                                                style={{
                                                    padding: '3px 10px', borderRadius: 'var(--radius-full)',
                                                    border: isActive ? '1px solid var(--color-accent)' : '1px solid var(--color-border)',
                                                    background: isActive ? 'rgba(200,149,46,0.15)' : 'transparent',
                                                    color: isActive ? 'var(--color-accent)' : 'var(--color-text-muted)',
                                                    cursor: 'pointer', fontSize: 11, transition: 'all var(--transition-fast)',
                                                }}>{tag}</button>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* 求人アラートはMVP期間中は無効化中 */}
                    {false && user?.role === 'jobseeker' && (
                        <div style={{
                            display: 'flex', alignItems: 'center', gap: 'var(--space-sm)',
                            marginTop: 'var(--space-md)', flexWrap: 'wrap',
                        }}>
                            <button
                                className="btn btn-secondary"
                                disabled={alertSaving}
                                onClick={saveJobAlert}
                                style={{ height: 40, fontSize: 'var(--font-size-xs)', whiteSpace: 'nowrap' }}
                            >
                                {alertSaving ? '保存中...' : 'この条件で新着通知を受け取る'}
                            </button>
                            <button
                                className="btn btn-secondary"
                                onClick={() => setShowAlerts(v => !v)}
                                style={{ height: 40, fontSize: 'var(--font-size-xs)', whiteSpace: 'nowrap', position: 'relative' }}
                            >
                                アラート一覧
                                {jobAlerts.length > 0 && (
                                    <span style={{
                                        position: 'absolute', top: -6, right: -6,
                                        background: 'var(--color-accent)', color: '#fff',
                                        borderRadius: '50%', width: 18, height: 18,
                                        fontSize: 11, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700,
                                    }}>{jobAlerts.length}</span>
                                )}
                            </button>
                            {alertSuccess && (
                                <span className="animate-fade-in" style={{
                                    fontSize: 'var(--font-size-xs)', color: 'var(--color-success)', fontWeight: 600,
                                }}>
                                    求人アラートを設定しました
                                </span>
                            )}
                        </div>
                    )}

                    {/* アラート一覧パネル */}
                    {false && showAlerts && user?.role === 'jobseeker' && (
                        <div className="animate-fade-in" style={{
                            marginTop: 'var(--space-md)', padding: 'var(--space-md)',
                            background: 'var(--color-bg-surface)', borderRadius: 'var(--radius-lg)',
                            border: '1px solid var(--color-border)',
                        }}>
                            <h4 style={{ fontSize: 'var(--font-size-sm)', fontWeight: 700, marginBottom: 'var(--space-sm)' }}>
                                設定中の求人アラート
                            </h4>
                            {jobAlerts.length === 0 ? (
                                <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
                                    求人アラートはまだ設定されていません
                                </p>
                            ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-xs)' }}>
                                    {jobAlerts.map(alert => (
                                        <div key={alert.id} style={{
                                            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                            padding: 'var(--space-sm) var(--space-md)',
                                            background: 'var(--color-bg-primary)', borderRadius: 'var(--radius-md)',
                                            border: '1px solid var(--color-border)',
                                        }}>
                                            <div style={{ display: 'flex', gap: 'var(--space-xs)', flexWrap: 'wrap', fontSize: 'var(--font-size-xs)' }}>
                                                {alert.keyword && <span style={{ color: 'var(--color-text-accent)' }}>キーワード: {alert.keyword}</span>}
                                                {alert.location && <span style={{ color: 'var(--color-text-secondary)' }}>勤務地: {alert.location}</span>}
                                                {alert.employment_type && <span style={{ color: 'var(--color-text-secondary)' }}>雇用形態: {alert.employment_type}</span>}
                                                {alert.salary_min && <span style={{ color: 'var(--color-success)' }}>年収: {Math.round(alert.salary_min / 10000)}万円以上</span>}
                                                {!alert.keyword && !alert.location && !alert.employment_type && !alert.salary_min && (
                                                    <span style={{ color: 'var(--color-text-muted)' }}>すべての新着求人</span>
                                                )}
                                            </div>
                                            <button
                                                onClick={() => deleteJobAlert(alert.id)}
                                                style={{
                                                    background: 'none', border: 'none', cursor: 'pointer',
                                                    color: 'var(--color-text-muted)', fontSize: 14, padding: '2px 6px',
                                                    lineHeight: 1,
                                                }}
                                                title="削除"
                                            >✕</button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>

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
                                border: filters.location === area ? '1px solid var(--color-accent)' : '1px solid var(--color-border)',
                                background: filters.location === area ? 'rgba(18,28,52,0.15)' : 'transparent',
                                color: filters.location === area ? 'var(--color-text-accent)' : 'var(--color-text-secondary)',
                                cursor: 'pointer', fontSize: 'var(--font-size-xs)', transition: 'all var(--transition-fast)',
                            }}>{area}</button>
                    ))}
                </div>

                {/* 職種カテゴリ（キーワード未入力時） */}
                {!filters.keyword && (
                    <div style={{ display: 'flex', gap: 'var(--space-sm)', flexWrap: 'wrap', marginBottom: 'var(--space-lg)' }}>
                        {JOB_CATEGORIES.map(cat => (
                            <button key={cat.label}
                                onClick={() => { setInputKeyword(cat.label); updateFilter('keyword', cat.label); }}
                                style={{
                                    display: 'flex', alignItems: 'center', gap: 6,
                                    padding: '6px 14px', borderRadius: 'var(--radius-full)',
                                    border: '1px solid var(--color-border)', background: 'var(--color-bg-surface)',
                                    cursor: 'pointer', fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)',
                                    transition: 'all var(--transition-fast)',
                                }}>
                                <span>{cat.icon}</span>{cat.label}
                            </button>
                        ))}
                    </div>
                )}

                {/* ゲスト属性入力バナー（未ログイン時のみ） */}
                {!user && (
                    <div style={{ marginBottom: 'var(--space-md)' }}>
                        <GuestProfileBanner onProfileChange={setGuestProfile} />
                    </div>
                )}

                {/* 件数・アクティブバッジ・ソート */}
                <div style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    marginBottom: 'var(--space-md)', paddingBottom: 'var(--space-sm)',
                    borderBottom: '1px solid var(--color-border)', flexWrap: 'wrap', gap: 'var(--space-sm)',
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)', flexWrap: 'wrap' }}>
                        {!loading && meta && (
                            <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>
                                <span style={{ color: 'var(--color-text-accent)', fontWeight: 700, fontSize: 'var(--font-size-xl)' }}>{meta.total}</span> 件
                            </p>
                        )}
                        {filters.keyword && <FilterBadge icon="🔍" label={filters.keyword} onRemove={() => { setInputKeyword(''); updateFilter('keyword', ''); }} />}
                        {filters.employment_type && <FilterBadge icon="👔" label={filters.employment_type} onRemove={() => updateFilter('employment_type', '')} />}
                        {filters.salary_min && <FilterBadge icon="💰" label={SALARY_OPTIONS.find(o => o.value === filters.salary_min)?.label} color="green" onRemove={() => updateFilter('salary_min', '')} />}
                        {filters.job_category_major && <FilterBadge icon="📂" label={filters.job_category_major} onRemove={() => updateFilter('job_category_major', '')} />}
                        {filters.application_type && <FilterBadge icon="📋" label={filters.application_type} onRemove={() => updateFilter('application_type', '')} />}
                        {filters.remote_policy && <FilterBadge icon="🏠" label={REMOTE_OPTIONS.find(o => o.value === filters.remote_policy)?.label} onRemove={() => updateFilter('remote_policy', '')} />}
                        {filters.feature_tags?.map(tag => (
                            <FilterBadge key={tag} icon="🏷" label={tag} onRemove={() => updateFilter('feature_tags', filters.feature_tags.filter(t => t !== tag))} />
                        ))}
                    </div>
                    <div style={{ display: 'flex', gap: 'var(--space-sm)', alignItems: 'center' }}>
                        <select className="form-select" value={perPage} onChange={e => {
                            const v = parseInt(e.target.value, 10);
                            setPerPage(v);
                            localStorage.setItem('jobSearchPerPage', v);
                            setPage(1);
                        }}
                            style={{ height: 36, fontSize: 'var(--font-size-xs)', width: 'auto', minWidth: 80 }}>
                            {[10, 20, 50, 100].map(n => <option key={n} value={n}>{n}件</option>)}
                        </select>
                        <select className="form-select" value={filters.sort} onChange={e => updateFilter('sort', e.target.value)}
                            style={{ height: 36, fontSize: 'var(--font-size-xs)', width: 'auto', minWidth: 120 }}>
                            {SORT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                        </select>
                    </div>
                </div>

                {/* ===== Split-pane レイアウト ===== */}
                <div style={{
                    display: 'flex',
                    gap: 'var(--space-lg)',
                    height: isMobile ? 'auto' : 'calc(100vh - 320px)',
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
                                {[1, 2, 3, 4, 5].map(i => <div key={i} className="skeleton" style={{ height: 120, borderRadius: 'var(--radius-lg)' }} />)}
                            </div>
                        ) : refreshing ? (
                            // 再取得中: 既存データをそのまま表示し、上部にスピナーのみ表示
                            <div style={{ position: 'relative' }}>
                                <div style={{
                                    position: 'sticky', top: 0, zIndex: 10,
                                    display: 'flex', alignItems: 'center', gap: 'var(--space-xs)',
                                    padding: '6px var(--space-sm)',
                                    background: 'rgba(255,255,255,0.9)', backdropFilter: 'blur(4px)',
                                    borderRadius: 'var(--radius-md)',
                                    marginBottom: 'var(--space-sm)',
                                    fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)',
                                }}>
                                    <div style={{ width: 14, height: 14, border: '2px solid var(--color-border)', borderTopColor: 'var(--color-accent)', borderRadius: '50%', animation: 'spin 0.7s linear infinite', flexShrink: 0 }} />
                                    更新中...
                                </div>
                                <div style={{ opacity: 0.5, pointerEvents: 'none', display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
                                    {jobs.map(job => (
                                        <JobListCard
                                            key={job.id}
                                            job={job}
                                            isSelected={selectedJobId === job.id}
                                            isSaved={savedJobs.includes(job.id)}
                                            isApplied={appliedJobIds.includes(job.id)}
                                            onToggleSave={() => {}}
                                            onClick={() => {}}
                                        />
                                    ))}
                                </div>
                            </div>
                        ) : jobs.length === 0 ? (
                            <div className="card" style={{ padding: 'var(--space-xl)' }}>
                                <div style={{ textAlign: 'center', marginBottom: 'var(--space-lg)' }}>
                                    <div style={{ fontSize: 48, marginBottom: 'var(--space-sm)' }}>🔍</div>
                                    <h3 style={{ marginBottom: 'var(--space-xs)' }}>条件に合う求人が見つかりませんでした</h3>
                                    {filters.keyword && (
                                        <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)', margin: 0 }}>
                                            「{filters.keyword}」{filters.location ? ` / ${filters.location}` : ''}
                                        </p>
                                    )}
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)', marginBottom: 'var(--space-lg)' }}>
                                    {[
                                        filters.keyword && { label: 'キーワードを外して検索', action: () => { setInputKeyword(''); updateFilter('keyword', ''); } },
                                        filters.location && { label: '勤務地の絞り込みを外す', action: () => { setInputLocation(''); updateFilter('location', ''); } },
                                        filters.employment_type && { label: '雇用形態の絞り込みを外す', action: () => updateFilter('employment_type', '') },
                                        filters.salary_min && { label: '年収の絞り込みを外す', action: () => updateFilter('salary_min', '') },
                                        activeFilterCount > 0 && { label: 'すべての絞り込みをリセット', action: clearFilters, primary: true },
                                    ].filter(Boolean).map((item, i) => (
                                        <button key={i} onClick={item.action}
                                            className={item.primary ? 'btn btn-primary' : 'btn btn-secondary'}
                                            style={{ width: '100%' }}>
                                            {item.label}
                                        </button>
                                    ))}
                                </div>
                                <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: 'var(--space-md)' }}>
                                    <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', marginBottom: 'var(--space-sm)', fontWeight: 600 }}>
                                        こちらも試してみてください
                                    </p>
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-xs)' }}>
                                        {['エンジニア', 'デザイナー', '営業', '事務', '医療', '教育', 'リモート可', '正社員'].map(kw => (
                                            <button key={kw}
                                                onClick={() => { setInputKeyword(kw); setFilters(prev => ({ ...prev, keyword: kw, location: '', employment_type: '', salary_min: '', feature_tags: [] })); setPage(1); }}
                                                style={{ padding: '4px 12px', borderRadius: 'var(--radius-full)', border: '1px solid var(--color-border)', background: 'transparent', cursor: 'pointer', fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', transition: 'all 0.15s' }}
                                                onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--color-accent)'; e.currentTarget.style.color = 'var(--color-text-accent)'; }}
                                                onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--color-border)'; e.currentTarget.style.color = 'var(--color-text-secondary)'; }}>
                                                {kw}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                                {user?.role === 'jobseeker' && (
                                    <div style={{ marginTop: 'var(--space-md)', padding: 'var(--space-md)', background: 'rgba(200,149,46,0.06)', borderRadius: 'var(--radius-md)', border: '1px solid rgba(200,149,46,0.15)' }}>
                                        <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-accent)', fontWeight: 600, marginBottom: 4 }}>
                                            💡 求人アラートを設定しませんか？
                                        </p>
                                        <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', margin: 0 }}>
                                            条件に合う新着求人が登録されたら自動でお知らせします。
                                        </p>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
                                {jobs.map(job => (
                                    <JobListCard
                                        key={job.id}
                                        job={job}
                                        isSelected={selectedJobId === job.id}
                                        isSaved={savedJobs.includes(job.id)}
                                        isApplied={appliedJobIds.includes(job.id)}
                                        onToggleSave={() => toggleSaveJob(job.id)}
                                        onClick={() => handleJobClick(job)}
                                        onMouseEnter={() => handleJobHover(job.id)}
                                        onMouseLeave={handleJobHoverEnd}
                                    />
                                ))}
                            </div>
                        )}
                    </div>

                    {/* ページネーション（常時表示） */}
                    {meta && meta.last_page > 1 && (
                        <div style={{ display: 'flex', justifyContent: 'center', gap: 'var(--space-xs)', marginTop: 'var(--space-sm)', flexWrap: 'wrap', flexShrink: 0 }}>
                            <button className="btn btn-secondary" disabled={page === 1} style={{ fontSize: 'var(--font-size-xs)' }}
                                onClick={() => { setPage(p => p - 1); if (listRef.current) listRef.current.scrollTop = 0; }}>←</button>
                            {Array.from({ length: Math.min(meta.last_page, 7) }, (_, i) => {
                                const p = meta.last_page <= 7 ? i + 1
                                    : page <= 4 ? i + 1
                                    : page >= meta.last_page - 3 ? meta.last_page - 6 + i
                                    : page - 3 + i;
                                return (
                                    <button key={p} className={`btn ${p === page ? 'btn-primary' : 'btn-secondary'}`}
                                        onClick={() => { setPage(p); if (listRef.current) listRef.current.scrollTop = 0; }}
                                        style={{ minWidth: 32, fontSize: 'var(--font-size-xs)', padding: '4px 8px' }}>{p}</button>
                                );
                            })}
                            <button className="btn btn-secondary" disabled={page === meta.last_page} style={{ fontSize: 'var(--font-size-xs)' }}
                                onClick={() => { setPage(p => p + 1); if (listRef.current) listRef.current.scrollTop = 0; }}>→</button>
                        </div>
                    )}
                    {meta && (
                        <p style={{ textAlign: 'center', marginTop: 'var(--space-xs)', fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', flexShrink: 0 }}>
                            {meta.total}件中 {meta.from}〜{meta.to}件を表示
                        </p>
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
                                <JobDetailPanel job={selectedJob} user={user} navigate={navigate} isSaved={savedJobs.includes(selectedJob.id)} onToggleSave={() => toggleSaveJob(selectedJob.id)} />
                            ) : (
                                <div className="card" style={{ textAlign: 'center', padding: 'var(--space-3xl)', color: 'var(--color-text-muted)' }}>
                                    <div style={{ fontSize: 48, marginBottom: 'var(--space-md)', opacity: 0.4 }}>👈</div>
                                    <p>左のリストから求人をクリックしてください</p>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

/* ============================================
   左パネル用コンパクトジョブカード
   ============================================ */
function JobListCard({ job, isSelected, isSaved, isApplied, onToggleSave, onClick, onMouseEnter, onMouseLeave }) {
    return (
        <div
            onClick={onClick}
            onMouseEnter={onMouseEnter}
            onMouseLeave={onMouseLeave}
            style={{
                padding: 'var(--space-md)',
                borderRadius: 'var(--radius-lg)',
                border: isSelected ? '2px solid var(--color-accent)' : '1px solid var(--color-border)',
                background: isSelected ? 'rgba(18,28,52,0.06)' : 'var(--color-bg-surface)',
                cursor: 'pointer',
                transition: 'all var(--transition-fast)',
                boxShadow: isSelected ? '0 0 0 1px rgba(18,28,52,0.2)' : 'none',
            }}
            onMouseEnter={e => { if (!isSelected) e.currentTarget.style.borderColor = 'rgba(18,28,52,0.4)'; }}
            onMouseLeave={e => { if (!isSelected) e.currentTarget.style.borderColor = 'var(--color-border)'; }}
        >
            {/* ヘッダー: 企業名 + 保存ボタン */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-xs)' }}>
                <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', fontWeight: 500 }}>
                    🏢 {job.company?.company_name || '企業名非公開'}
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-xs)' }}>
                    {isApplied && <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 'var(--radius-full)', background: 'rgba(16,185,129,0.15)', color: '#059669', fontWeight: 700, border: '1px solid rgba(16,185,129,0.3)' }}>応募済み</span>}
                    {job.source === 'hellowork' && <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 'var(--radius-full)', background: 'rgba(0,112,185,0.08)', color: '#0070b9', fontWeight: 600, border: '1px solid rgba(0,112,185,0.25)' }}>ハローワーク</span>}
                    {job.is_agency_job && <span className="badge badge-warning" style={{ fontSize: 10, padding: '1px 6px' }}>人材紹介</span>}
                    {job.employment_type && <span className="badge badge-info" style={{ fontSize: 10, padding: '1px 6px' }}>{job.employment_type}</span>}
                    <button onClick={e => { e.stopPropagation(); onToggleSave(); }}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, padding: '0 2px', color: isSaved ? '#f59e0b' : 'var(--color-text-muted)' }}
                        title={isSaved ? '保存済み' : '保存する'}>{isSaved ? '⭐' : '☆'}</button>
                </div>
            </div>

            {/* 職種カテゴリ */}
            {job.job_category_major && (
                <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginBottom: 2 }}>
                    {job.job_category_major}{job.job_category_minor ? ` > ${job.job_category_minor}` : ''}
                </div>
            )}

            {/* タイトル */}
            <h4 style={{
                fontSize: 'var(--font-size-base)', fontWeight: 700,
                marginBottom: 'var(--space-xs)', lineHeight: 1.4,
                display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
            }}>
                {job.title}
            </h4>

            {/* メタ情報 */}
            <div style={{ display: 'flex', gap: 'var(--space-sm)', flexWrap: 'wrap', marginBottom: 'var(--space-xs)' }}>
                {job.location && (
                    <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
                        📍 {job.location}
                    </span>
                )}
                {formatSalary(job) && (
                    <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-success)', fontWeight: 600 }}>
                        💰 {formatSalary(job)}
                    </span>
                )}
            </div>

            {/* 特徴タグ */}
            {job.feature_tags?.length > 0 && (
                <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap', marginBottom: 'var(--space-xs)' }}>
                    {job.feature_tags.slice(0, 4).map(tag => (
                        <span key={tag} style={{
                            padding: '0px 6px', borderRadius: 'var(--radius-full)',
                            border: '1px solid var(--color-accent)', color: 'var(--color-accent)',
                            fontSize: 10, lineHeight: '16px',
                        }}>{tag}</span>
                    ))}
                    {job.feature_tags.length > 4 && (
                        <span style={{ fontSize: 10, color: 'var(--color-text-muted)' }}>+{job.feature_tags.length - 4}</span>
                    )}
                </div>
            )}

            {/* 説明プレビュー */}
            {job.description && (
                <p style={{
                    fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', lineHeight: 1.5,
                    display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
                    margin: 0,
                }}>{job.description.replace(/【[^】]+】\n?/g, '').trim()}</p>
            )}
        </div>
    );
}

/* ============================================
   セクションヘッダー共通コンポーネント
   ============================================ */
function SectionHeader({ icon, title }) {
    return (
        <h3 style={{
            fontSize: 'var(--font-size-sm)', fontWeight: 700, marginBottom: 'var(--space-sm)',
            color: 'var(--color-text-primary)', display: 'flex', alignItems: 'center', gap: 6,
            paddingBottom: 'var(--space-xs)', borderBottom: '2px solid var(--color-accent)',
        }}>
            <span style={{ fontSize: 14 }}>{icon}</span> {title}
        </h3>
    );
}

/* 定義リスト風の行 */
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
   右パネル用詳細ビュー
   ============================================ */
function JobDetailPanel({ job, user, navigate, isSaved, onToggleSave }) {
    const insuranceText = Array.isArray(job.insurance) ? job.insurance.join(' / ') : job.insurance;
    const benefitsText = Array.isArray(job.benefits) ? job.benefits.join(' / ') : job.benefits;

    return (
        <div className="card animate-fade-in" style={{ padding: 0, overflow: 'hidden' }}>
            {/* ヘッダー */}
            <div style={{
                padding: 'var(--space-lg) var(--space-xl)',
                borderBottom: '1px solid var(--color-border)',
                background: 'linear-gradient(135deg, rgba(18,28,52,0.04) 0%, rgba(168,85,247,0.02) 100%)',
            }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 'var(--space-md)' }}>
                    <div style={{ flex: 1 }}>
                        {job.job_category_major && (
                            <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', marginBottom: 4 }}>
                                {job.job_category_major}{job.job_category_minor ? ` > ${job.job_category_minor}` : ''}
                            </div>
                        )}
                        <h2 style={{ fontSize: 'var(--font-size-xl)', fontWeight: 700, marginBottom: 'var(--space-xs)', lineHeight: 1.4 }}>
                            {job.title}
                        </h2>
                        <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-sm)' }}>
                            🏢 <Link to={`/companies/${job.company?.id}`} style={{ color: 'var(--color-text-secondary)' }}>{job.company?.company_name || '企業名非公開'}</Link>
                            {job.industry && <span style={{ marginLeft: 8, opacity: 0.7 }}>({job.industry})</span>}
                        </p>
                    </div>
                    <button onClick={onToggleSave}
                        style={{
                            background: 'none', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)',
                            cursor: 'pointer', fontSize: 20, padding: '6px 10px',
                            color: isSaved ? '#f59e0b' : 'var(--color-text-muted)',
                        }}
                        title={isSaved ? '保存済み' : '保存する'}>{isSaved ? '⭐' : '☆'}</button>
                </div>

                {/* バッジ */}
                <div style={{ display: 'flex', gap: 'var(--space-xs)', flexWrap: 'wrap', marginTop: 'var(--space-md)' }}>
                    {job.source === 'hellowork'
                        ? <span className="badge" style={{ background: 'rgba(0,112,185,0.08)', color: '#0070b9', border: '1px solid rgba(0,112,185,0.25)' }}>🏢 ハローワーク掲載</span>
                        : job.is_agency_job
                            ? <span className="badge" style={{ background: 'rgba(124,58,237,0.12)', color: '#7c3aed', border: '1px solid rgba(124,58,237,0.3)' }}>🤝 エージェント求人</span>
                            : <span className="badge" style={{ background: 'rgba(18,28,52,0.08)', color: 'var(--color-primary)', border: '1px solid rgba(18,28,52,0.2)' }}>🏢 直接採用</span>
                    }
                    {job.employment_type && <span className="badge badge-info">👔 {job.employment_type}</span>}
                    {job.remote_policy && <span className="badge badge-info">🏠 {job.remote_policy}</span>}
                    {job.location && <span className="badge badge-info">📍 {job.location}</span>}
                    {formatSalary(job) && (
                        <span className="badge badge-success">💰 {formatSalary(job)}</span>
                    )}
                    {job.overtime_average && <span className="badge badge-info">⏱ 残業{job.overtime_average}</span>}
                    {job.holidays && <span className="badge badge-info">📅 {job.holidays.includes('年間') ? job.holidays.match(/年間休日\d+日/)?.[0] || job.holidays : job.holidays}</span>}
                    {job.application_type && <span className="badge badge-info">📋 {job.application_type}</span>}
                    {job.positions_available && <span className="badge badge-info">👥 {job.positions_available}名募集</span>}
                    {job.dormitory === 'あり' && <span className="badge badge-info">🏠 寮あり</span>}
                </div>
                {job.feature_tags?.length > 0 && (
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 'var(--space-sm)' }}>
                        {job.feature_tags.map(tag => (
                            <span key={tag} style={{
                                padding: '2px 8px', borderRadius: 'var(--radius-full)',
                                border: '1px solid var(--color-accent)', color: 'var(--color-accent)',
                                fontSize: 11, lineHeight: '18px',
                            }}>{tag}</span>
                        ))}
                    </div>
                )}
            </div>

            {/* アピールポイント */}
            {job.appeal_points && (
                <div style={{
                    padding: 'var(--space-md) var(--space-xl)',
                    borderBottom: '1px solid var(--color-border)',
                    background: 'rgba(245,158,11,0.04)',
                }}>
                    <p style={{ fontSize: 'var(--font-size-xs)', fontWeight: 700, color: '#d97706', marginBottom: 4 }}>✨ アピールポイント</p>
                    <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', whiteSpace: 'pre-wrap', lineHeight: 1.6, margin: 0 }}>
                        {job.appeal_points}
                    </p>
                </div>
            )}

            {/* 写真ギャラリー */}
            {job.photos?.length > 0 && (
                <div style={{
                    padding: 'var(--space-md) var(--space-xl)',
                    borderBottom: '1px solid var(--color-border)',
                }}>
                    <div style={{
                        display: 'flex', gap: 'var(--space-sm)',
                        overflowX: 'auto', paddingBottom: 'var(--space-xs)',
                    }}>
                        {job.photos.map(photo => (
                            <img
                                key={photo.id}
                                src={photo.url}
                                alt={photo.caption || '求人写真'}
                                style={{
                                    width: 180, height: 135, objectFit: 'cover',
                                    borderRadius: 'var(--radius-md)',
                                    flexShrink: 0,
                                    border: '1px solid var(--color-border)',
                                }}
                            />
                        ))}
                    </div>
                </div>
            )}

            {/* 応募ボタン / ハローワーク通知 */}
            <div style={{
                padding: 'var(--space-md) var(--space-xl)',
                borderBottom: '1px solid var(--color-border)',
                display: 'flex', alignItems: 'center', gap: 'var(--space-md)',
                background: job.source === 'hellowork' ? 'rgba(0,112,185,0.04)' : 'rgba(16,185,129,0.03)',
            }}>
                {job.source === 'hellowork' ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        <p style={{ fontSize: 'var(--font-size-xs)', fontWeight: 700, color: '#0070b9', margin: 0 }}>
                            🏢 ハローワーク掲載求人について
                        </p>
                        <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', lineHeight: 1.7, margin: 0 }}>
                            この求人はハローワーク（公共職業安定所）が提供する求人情報です。
                            応募・詳細確認はお近くのハローワーク窓口または
                            <a href="https://www.hellowork.mhlw.go.jp/" target="_blank" rel="noopener noreferrer"
                                style={{ color: '#0070b9' }}>ハローワークインターネットサービス</a>
                            からお手続きください。
                        </p>
                    </div>
                ) : user?.role === 'jobseeker' ? (
                    <button className="btn btn-primary" onClick={() => navigate(`/jobs/${job.id}`)}>
                        応募する
                    </button>
                ) : !user ? (
                    <>
                        <button className="btn btn-primary" onClick={() => navigate('/register')}>
                            登録して応募する
                        </button>
                        <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
                            Googleアカウントで30秒 /{' '}
                            <a href="/login" onClick={e => { e.preventDefault(); navigate('/login'); }}
                                style={{ color: 'var(--color-text-accent)', textDecoration: 'none' }}>ログイン</a>
                        </span>
                    </>
                ) : null}
            </div>

            {/* 本文セクション */}
            <div style={{ padding: 'var(--space-xl)' }}>

                {/* 募集背景 */}
                {job.recruitment_background && (
                    <div style={{ marginBottom: 'var(--space-xl)' }}>
                        <SectionHeader icon="📌" title="募集背景" />
                        <p style={{ color: 'var(--color-text-secondary)', whiteSpace: 'pre-wrap', lineHeight: 1.7, fontSize: 'var(--font-size-sm)' }}>
                            {job.recruitment_background}
                        </p>
                    </div>
                )}

                {/* 仕事内容 */}
                <div style={{ marginBottom: 'var(--space-xl)' }}>
                    <SectionHeader icon="📋" title="仕事内容" />
                    <p style={{ color: 'var(--color-text-secondary)', whiteSpace: 'pre-wrap', lineHeight: 1.7, fontSize: 'var(--font-size-sm)' }}>
                        {job.description?.replace(/【[^】]+】\n?/g, '').trim()}
                    </p>
                    {job.scope_of_change && (
                        <InfoRow label="変更の範囲" value={job.scope_of_change} />
                    )}
                </div>

                {/* 応募要件 */}
                {(job.requirements || job.preferred_qualifications) && (
                    <div style={{ marginBottom: 'var(--space-xl)' }}>
                        <SectionHeader icon="✅" title="応募要件" />
                        {job.requirements && (
                            <p style={{ color: 'var(--color-text-secondary)', whiteSpace: 'pre-wrap', lineHeight: 1.7, fontSize: 'var(--font-size-sm)' }}>
                                {job.requirements}
                            </p>
                        )}
                        {job.preferred_qualifications && (
                            <div style={{ marginTop: 'var(--space-sm)' }}>
                                <p style={{ fontSize: 'var(--font-size-xs)', fontWeight: 700, color: 'var(--color-text-muted)', marginBottom: 4 }}>歓迎条件</p>
                                <p style={{ color: 'var(--color-text-secondary)', whiteSpace: 'pre-wrap', lineHeight: 1.7, fontSize: 'var(--font-size-sm)' }}>
                                    {job.preferred_qualifications}
                                </p>
                            </div>
                        )}
                    </div>
                )}

                {/* 給与・待遇 */}
                {(job.salary_details || job.salary_min || job.salary_max || job.salary_type ||
                  job.raise_frequency || job.bonus || job.allowances || benefitsText || insuranceText) && (
                    <div style={{ marginBottom: 'var(--space-xl)' }}>
                        <SectionHeader icon="💰" title="給与・待遇" />
                        <InfoRow label="給与" value={job.salary_details || formatSalary(job) || job.salary_type || null} />
                        <InfoRow label="昇給" value={job.raise_frequency} />
                        <InfoRow label="賞与" value={job.bonus} />
                        <InfoRow label="手当" value={job.allowances} />
                        <InfoRow label="福利厚生" value={benefitsText} />
                        <InfoRow label="社会保険" value={insuranceText} />
                    </div>
                )}

                {/* 勤務条件 */}
                {(job.employment_type || job.location || job.work_hours || job.holidays ||
                  job.remote_policy || job.office_address || job.overtime_average ||
                  job.nearest_station || job.contract_period || job.dormitory) && (
                    <div style={{ marginBottom: 'var(--space-xl)' }}>
                        <SectionHeader icon="🏢" title="勤務条件" />
                        <InfoRow label="雇用形態" value={job.employment_type} />
                        <InfoRow label="勤務地" value={job.location} />
                        {job.office_address && <InfoRow label="詳細住所" value={job.office_address} />}
                        {job.nearest_station && <InfoRow label="最寄り駅" value={job.nearest_station} />}
                        {job.access_info && <InfoRow label="アクセス" value={job.access_info} />}
                        <InfoRow label="勤務時間" value={job.work_hours} />
                        <InfoRow label="残業" value={job.overtime_average} />
                        <InfoRow label="休日・休暇" value={job.holidays} />
                        <InfoRow label="休暇詳細" value={job.holiday_details} />
                        <InfoRow label="リモート" value={job.remote_policy} />
                        {job.transfer_policy && <InfoRow label="転勤" value={job.transfer_policy} />}
                        {job.location_scope_of_change && <InfoRow label="勤務地変更の範囲" value={job.location_scope_of_change} />}
                        {job.dormitory && <InfoRow label="寮" value={job.dormitory} />}
                        {job.smoking_policy && <InfoRow label="受動喫煙対策" value={job.smoking_policy} />}
                        <InfoRow label="契約期間" value={job.contract_period} />
                    </div>
                )}

                {/* 試用期間 */}
                {job.probation_period && (
                    <div style={{ marginBottom: 'var(--space-xl)' }}>
                        <SectionHeader icon="📝" title="試用期間" />
                        <InfoRow label="期間" value={job.probation_period} />
                        <InfoRow label="条件" value={job.probation_conditions} />
                    </div>
                )}

                {/* 職場環境 */}
                {(job.work_environment || job.company_culture) && (
                    <div style={{ marginBottom: 'var(--space-xl)' }}>
                        <SectionHeader icon="👥" title="職場環境・社風" />
                        {job.work_environment && (
                            <p style={{ color: 'var(--color-text-secondary)', whiteSpace: 'pre-wrap', lineHeight: 1.7, fontSize: 'var(--font-size-sm)', marginBottom: 'var(--space-md)' }}>
                                {job.work_environment}
                            </p>
                        )}
                        {job.company_culture && (
                            <p style={{ color: 'var(--color-text-secondary)', whiteSpace: 'pre-wrap', lineHeight: 1.7, fontSize: 'var(--font-size-sm)' }}>
                                {job.company_culture}
                            </p>
                        )}
                    </div>
                )}

                {/* 選考情報 */}
                {(job.selection_process || job.required_documents || job.estimated_timeline ||
                  job.application_type || job.positions_available) && (
                    <div style={{ marginBottom: 'var(--space-xl)' }}>
                        <SectionHeader icon="📊" title="選考・採用について" />
                        <InfoRow label="応募方法" value={job.application_type} />
                        <InfoRow label="募集人数" value={job.positions_available ? `${job.positions_available}名` : null} />
                        {job.selection_process && (
                            <p style={{ color: 'var(--color-text-secondary)', whiteSpace: 'pre-wrap', lineHeight: 1.7, fontSize: 'var(--font-size-sm)', margin: 'var(--space-sm) 0' }}>
                                {job.selection_process}
                            </p>
                        )}
                        <InfoRow label="必要書類" value={job.required_documents} />
                        <InfoRow label="選考期間" value={job.estimated_timeline} />
                    </div>
                )}

                {/* 掲載情報 */}
                {(job.published_at || job.expires_at) && (
                    <div style={{ marginBottom: 'var(--space-xl)' }}>
                        <SectionHeader icon="📅" title="掲載情報" />
                        <InfoRow label="掲載開始日" value={job.published_at ? new Date(job.published_at).toLocaleDateString('ja-JP') : null} />
                        <InfoRow label="応募締切" value={job.expires_at ? new Date(job.expires_at).toLocaleDateString('ja-JP') : null} />
                    </div>
                )}

                {/* 企業情報 */}
                {(job.number_of_employees || job.founded_year || job.industry ||
                  job.company?.description || job.company?.website || job.company?.address) && (
                    <div style={{ marginBottom: 'var(--space-xl)' }}>
                        <SectionHeader icon="🏛" title="企業情報" />
                        <InfoRow label="業界" value={job.industry || job.company?.industry} />
                        <InfoRow label="従業員数" value={job.number_of_employees || job.company?.number_of_employees} />
                        <InfoRow label="設立" value={job.founded_year} />
                        <InfoRow label="資本金" value={job.company?.capital} />
                        <InfoRow label="売上高" value={job.company?.revenue} />
                        {job.company?.address && <InfoRow label="本社所在地" value={job.company.address} />}
                        {job.company?.phone && <InfoRow label="電話番号" value={job.company.phone} />}
                        {job.company?.website && (
                            <div style={{ display: 'flex', gap: 'var(--space-sm)', padding: 'var(--space-xs) 0', borderBottom: '1px solid rgba(0,0,0,0.04)' }}>
                                <span style={{ flex: '0 0 110px', fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', fontWeight: 600 }}>Webサイト</span>
                                <a href={job.company.website} target="_blank" rel="noopener noreferrer"
                                    style={{ flex: 1, fontSize: 'var(--font-size-sm)', color: 'var(--color-text-accent)', wordBreak: 'break-all' }}>
                                    {job.company.website}
                                </a>
                            </div>
                        )}
                        {job.company?.description && (
                            <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-sm)', lineHeight: 1.7, marginTop: 'var(--space-sm)', whiteSpace: 'pre-wrap' }}>
                                {job.company.description}
                            </p>
                        )}
                    </div>
                )}

                {/* 人材紹介: 紹介先クライアント企業 */}
                {job.is_agency_job && job.client_company && (
                    <div style={{ marginBottom: 'var(--space-xl)' }}>
                        <SectionHeader icon="🤝" title="求人企業情報" />
                        <InfoRow label="企業名" value={job.client_company.name} />
                        <InfoRow label="業界" value={job.client_company.industry} />
                        <InfoRow label="従業員数" value={job.client_company.employees} />
                        <InfoRow label="所在地" value={job.client_company.address} />
                        {job.client_company.description && (
                            <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-sm)', lineHeight: 1.7, marginTop: 'var(--space-sm)', whiteSpace: 'pre-wrap' }}>
                                {job.client_company.description}
                            </p>
                        )}
                    </div>
                )}

                {/* 備考 */}
                {job.notes && (
                    <div style={{
                        padding: 'var(--space-md)', background: 'var(--color-bg-surface)',
                        borderRadius: 'var(--radius-md)', marginBottom: 'var(--space-md)',
                        fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', lineHeight: 1.7,
                    }}>
                        <p style={{ fontWeight: 600, fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', marginBottom: 6 }}>備考</p>
                        {job.notes}
                    </div>
                )}

                {job.agency_display && (
                    <div style={{
                        padding: 'var(--space-md)', background: 'var(--color-bg-surface)',
                        borderRadius: 'var(--radius-md)', marginTop: 'var(--space-md)',
                    }}>
                        <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
                            ⚖️ {job.agency_display}
                        </p>
                    </div>
                )}
            </div>

            {/* ゲスト向けCTA（ハローワーク求人には表示しない） */}
            {!user && job.source !== 'hellowork' && (
                <div style={{
                    padding: 'var(--space-xl)',
                    background: 'linear-gradient(135deg, rgba(18,28,52,0.08) 0%, rgba(168,85,247,0.05) 100%)',
                    borderTop: '1px solid rgba(18,28,52,0.15)',
                    textAlign: 'center',
                }}>
                    <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', marginBottom: 'var(--space-md)', lineHeight: 1.6 }}>
                        無料登録（30秒）で応募できます
                    </p>
                    <div style={{ display: 'flex', gap: 'var(--space-sm)', justifyContent: 'center', flexWrap: 'wrap' }}>
                        <button className="btn btn-primary" onClick={() => navigate('/register')}>
                            無料登録して応募する
                        </button>
                        <button className="btn btn-secondary" onClick={() => navigate('/login')}>
                            ログイン
                        </button>
                    </div>
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
