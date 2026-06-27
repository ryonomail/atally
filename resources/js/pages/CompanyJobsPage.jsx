import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import api from '../api';
import PREFECTURE_CITIES from '../data/prefectureCities';
import INDUSTRY_OPTIONS from '../data/industries';
import { JOB_CATEGORY_MAJORS, getMinorCategories } from '../data/jobCategories';
import { useToast } from '../hooks/useToast';
import ConfirmDialog from '../components/ConfirmDialog';

const FEATURE_TAG_OPTIONS = [
    'リモート可', 'フルリモート', 'フレックス制', '土日休み', '年間休日120日以上',
    '残業少なめ', '副業OK', '服装自由', '駅近', '社宅・寮あり',
    '退職金あり', 'ストックオプション', '研修充実', '資格取得支援',
    '産休・育休実績あり', '時短勤務OK', 'U・Iターン歓迎', '未経験歓迎', '学歴不問',
    '外国語を活かせる', 'スカウトOK', '急募',
];

const INITIAL_FORM = {
    // 基本情報（★ = 職業安定法必須）
    title: '', description: '', requirements: '',
    // 職種カテゴリ
    job_category_major: '', job_category_minor: '',
    // 採用情報
    application_type: '中途', positions_available: '',
    feature_tags: [],
    // 仕事内容補足
    preferred_qualifications: '', recruitment_background: '',
    scope_of_change: '',
    // 給与 ★
    salary_min: '', salary_max: '', salary_type: '年収',
    salary_details: '', raise_frequency: '', bonus: '',
    // 勤務条件 ★
    prefecture: '', city: '', location: '',
    office_address: '', nearest_station: '', access_info: '', transfer_policy: '',
    employment_type: '正社員',
    work_hours: '', remote_policy: '', overtime_average: '',
    location_scope_of_change: '',
    dormitory: '', smoking_policy: '',
    // 待遇 ★
    holidays: '', holiday_details: '', insurance: ['健康保険', '厚生年金', '雇用保険', '労災保険'],
    allowances: '', benefits: [],
    probation_period: '', probation_conditions: '',
    // 選考
    selection_process: '', required_documents: '', estimated_timeline: '',
    // 会社の魅力
    company_culture: '', work_environment: '',
    number_of_employees: '', founded_year: '', industry: '',
    // その他 ★
    appeal_points: '', contract_period: '期間の定めなし', notes: '',
    // 人材紹介
    allow_referral: false, referral_fee_type: 'percentage', referral_fee: '', referral_conditions: '',
    // 求人種別（人材紹介会社用）
    listing_type: 'direct', // 'direct' = 自社採用, 'referral' = 人材紹介
    agency_client_id: '',
    // 紹介先企業情報（人材紹介時）
    client_company_name: '', client_company_address: '', client_company_industry: '',
    client_company_employees: '', client_company_description: '',
    // エージェント限定情報
    age_min: '', age_max: '', gender_requirement: '不問',
    nationality_requirement: '', education_requirement: '',
    referral_fee_distribution: '', refund_policy: '', payment_terms: '',
    disclosure_scope: '', likely_candidates: '', ng_targets: '',
    selection_details_agent: '',
    // 課金設定
    daily_budget: 0,
};

const INSURANCE_OPTIONS = ['健康保険', '厚生年金', '雇用保険', '労災保険'];

const PREFECTURES = [
    '北海道', '青森県', '岩手県', '宮城県', '秋田県', '山形県', '福島県',
    '茨城県', '栃木県', '群馬県', '埼玉県', '千葉県', '東京都', '神奈川県',
    '新潟県', '富山県', '石川県', '福井県', '山梨県', '長野県',
    '岐阜県', '静岡県', '愛知県', '三重県',
    '滋賀県', '京都府', '大阪府', '兵庫県', '奈良県', '和歌山県',
    '鳥取県', '島根県', '岡山県', '広島県', '山口県',
    '徳島県', '香川県', '愛媛県', '高知県',
    '福岡県', '佐賀県', '長崎県', '熊本県', '大分県', '宮崎県', '鹿児島県', '沖縄県',
    'フルリモート（全国）', '海外',
];

export default function CompanyJobsPage() {
    const [jobs, setJobs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [saving, setSaving] = useState(false);
    const [form, setForm] = useState(INITIAL_FORM);
    const [editingJob, setEditingJob] = useState(null); // null=新規, job object=編集
    const [benefitInput, setBenefitInput] = useState('');
    const [activeTab, setActiveTab] = useState('basic');
    const [errors, setErrors] = useState({});
    const [showPreview, setShowPreview] = useState(false);
    const [draftBanner, setDraftBanner] = useState(false); // 下書きバナー表示
    const [autoSaveMsg, setAutoSaveMsg] = useState(null); // 自動保存インジケーター（null or タイムスタンプ文字列）
    const toast = useToast();
    const [confirmDialog, setConfirmDialog] = useState(null);
    const [viewMode, setViewMode] = useState('list'); // 'list' | 'analytics' | 'campaigns'
    const [analytics, setAnalytics] = useState([]);
    const [analyticsLoading, setAnalyticsLoading] = useState(false);
    const [funnel, setFunnel] = useState([]);
    // 予算グループ関連
    const [campaigns, setCampaigns] = useState([]);
    const [campaignsLoading, setCampaignsLoading] = useState(false);
    const [selectedCampaignId, setSelectedCampaignId] = useState(null);
    const [campaignDetail, setCampaignDetail] = useState(null);
    const [campaignDetailLoading, setCampaignDetailLoading] = useState(false);
    const [showCampaignForm, setShowCampaignForm] = useState(false);
    const [editingCampaignId, setEditingCampaignId] = useState(null);
    const [campaignSaving, setCampaignSaving] = useState(false);
    const [campaignForm, setCampaignForm] = useState({ name: '', daily_budget: 5000, budget_allocation: 'even', start_date: '', end_date: '', job_ids: [] });
    const [addJobIds, setAddJobIds] = useState([]);
    const lastSavedForm = useRef(null); // 最後に保存したフォーム状態
    const [rankResult, setRankResult] = useState(null); // 順位シミュレーション結果
    const rankTimerRef = useRef(null);
    const [selectedJobs, setSelectedJobs] = useState([]); // 一括選択
    const [bulkBudget, setBulkBudget] = useState(0);
    const [bulkSaving, setBulkSaving] = useState(false);
    const [searchKeyword, setSearchKeyword] = useState('');
    const [filterStatus, setFilterStatus] = useState('all');
    const [filterBudget, setFilterBudget] = useState('all'); // all | free | paid
    const [currentPage, setCurrentPage] = useState(1); // 一覧のページング（大量求人対策）
    const [agencyClients, setAgencyClients] = useState([]);
    const navigate = useNavigate();
    const { user } = useAuth();
    const isAgency = user?.company?.company_type === 'recruitment_agency';

    const DRAFT_KEY = 'job_draft_form';
    const [showShortcutHelp, setShowShortcutHelp] = useState(false);

    // --- キーボードショートカット ---
    useEffect(() => {
        const handleKey = (e) => {
            // フォームやinput内では無効
            if (['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) return;
            if (e.key === '?' && !e.shiftKey) {
                e.preventDefault();
                setShowShortcutHelp(v => !v);
            } else if (e.key === 'n' && !e.ctrlKey && !e.metaKey) {
                if (!showForm) { setShowForm(true); setEditingJob(null); setForm(INITIAL_FORM); }
            } else if (e.key === 'Escape') {
                setShowShortcutHelp(false);
                if (showForm) setShowForm(false);
            }
        };
        window.addEventListener('keydown', handleKey);
        return () => window.removeEventListener('keydown', handleKey);
    }, [showForm]);

    // --- 自動保存: 新規作成時のみ、5秒ごとにlocalStorageへ保存 ---
    useEffect(() => {
        if (!showForm || editingJob) return; // 編集時は自動保存しない
        const interval = setInterval(() => {
            const currentJson = JSON.stringify(form);
            if (lastSavedForm.current !== currentJson && currentJson !== JSON.stringify(INITIAL_FORM)) {
                localStorage.setItem(DRAFT_KEY, currentJson);
                lastSavedForm.current = currentJson;
                const now = new Date();
                const timeStr = `${now.getHours().toString().padStart(2,'0')}:${now.getMinutes().toString().padStart(2,'0')}`;
                setAutoSaveMsg(timeStr);
                setTimeout(() => setAutoSaveMsg(null), 3000);
            }
        }, 5000);
        return () => clearInterval(interval);
    }, [showForm, editingJob, form]);

    // --- フォームを開いたとき、下書きがあるかチェック ---
    useEffect(() => {
        if (showForm && !editingJob) {
            const draft = localStorage.getItem(DRAFT_KEY);
            if (draft) {
                setDraftBanner(true);
            }
        } else {
            setDraftBanner(false);
        }
    }, [showForm, editingJob]);

    const restoreDraft = useCallback(() => {
        try {
            const draft = JSON.parse(localStorage.getItem(DRAFT_KEY));
            if (draft) {
                setForm({ ...INITIAL_FORM, ...draft });
                lastSavedForm.current = JSON.stringify({ ...INITIAL_FORM, ...draft });
            }
        } catch (_) { /* ignore */ }
        setDraftBanner(false);
    }, []);

    const discardDraft = useCallback(() => {
        localStorage.removeItem(DRAFT_KEY);
        lastSavedForm.current = null;
        setDraftBanner(false);
    }, []);

    // 日額予算変更時に順位シミュレーション（デバウンス500ms）
    useEffect(() => {
        if (!showForm) return;
        const budget = Number(form.daily_budget) || 0;
        clearTimeout(rankTimerRef.current);
        rankTimerRef.current = setTimeout(() => {
            api.post('/ranking/simulate', { budget })
                .then(res => setRankResult(res.data))
                .catch(() => setRankResult(null));
        }, 500);
        return () => clearTimeout(rankTimerRef.current);
    }, [form.daily_budget, showForm]);

    useEffect(() => {
        api.get('/my-jobs').then(res => {
            setJobs(res.data.data || res.data || []);
        }).catch(() => {}).finally(() => setLoading(false));
        // 人材紹介会社ならクライアント一覧も取得
        if (isAgency) {
            api.get('/agency/clients').then(res => {
                setAgencyClients(res.data.data || res.data || []);
            }).catch(() => {});
        }
    }, []);

    const fetchAnalytics = useCallback(() => {
        setAnalyticsLoading(true);
        api.get('/my-jobs/analytics').then(res => {
            setAnalytics(res.data?.jobs || res.data || []);
            setFunnel(res.data?.funnel || []);
        }).catch(() => {
            setAnalytics([]);
            setFunnel([]);
        }).finally(() => setAnalyticsLoading(false));
    }, []);

    useEffect(() => {
        if (viewMode === 'analytics') {
            fetchAnalytics();
        }
        if (viewMode === 'campaigns') {
            fetchCampaigns();
        }
    }, [viewMode, fetchAnalytics]);

    // 予算グループ一覧取得
    const fetchCampaigns = useCallback(() => {
        setCampaignsLoading(true);
        api.get('/campaigns').then(res => setCampaigns(res.data || []))
            .catch(() => setCampaigns([]))
            .finally(() => setCampaignsLoading(false));
    }, []);

    // 予算グループ詳細取得
    useEffect(() => {
        if (!selectedCampaignId) { setCampaignDetail(null); return; }
        setCampaignDetailLoading(true);
        api.get(`/campaigns/${selectedCampaignId}`)
            .then(res => setCampaignDetail(res.data))
            .catch(() => setCampaignDetail(null))
            .finally(() => setCampaignDetailLoading(false));
    }, [selectedCampaignId]);

    const set = (key, val) => setForm(prev => ({ ...prev, [key]: val }));

    const toggleInsurance = (item) => {
        const current = form.insurance || [];
        set('insurance', current.includes(item) ? current.filter(i => i !== item) : [...current, item]);
    };

    const showToastMsg = (message, type = 'success') => type === 'error' ? toast.error(message) : toast.success(message);

    const addBenefit = () => {
        if (benefitInput.trim()) {
            set('benefits', [...(form.benefits || []), benefitInput.trim()]);
            setBenefitInput('');
        }
    };

    const removeBenefit = (idx) => {
        set('benefits', form.benefits.filter((_, i) => i !== idx));
    };

    const startEdit = (job) => {
        setEditingJob(job);
        setForm({
            title: job.title || '',
            description: job.description || '',
            requirements: job.requirements || '',
            salary_min: job.salary_min || '',
            salary_max: job.salary_max || '',
            salary_type: job.salary_type || '年収',
            salary_details: job.salary_details || '',
            raise_frequency: job.raise_frequency || '',
            bonus: job.bonus || '',
            prefecture: job.prefecture || '',
            city: job.city || '',
            location: job.location || '',
            office_address: job.office_address || '',
            nearest_station: job.nearest_station || '',
            access_info: job.access_info || '',
            transfer_policy: job.transfer_policy || '',
            employment_type: job.employment_type || '正社員',
            work_hours: job.work_hours || '',
            remote_policy: job.remote_policy || '',
            overtime_average: job.overtime_average || '',
            holidays: job.holidays || '',
            holiday_details: job.holiday_details || '',
            insurance: job.insurance || ['健康保険', '厚生年金', '雇用保険', '労災保険'],
            allowances: job.allowances || '',
            benefits: job.benefits || [],
            probation_period: job.probation_period || '',
            probation_conditions: job.probation_conditions || '',
            selection_process: job.selection_process || '',
            required_documents: job.required_documents || '',
            estimated_timeline: job.estimated_timeline || '',
            company_culture: job.company_culture || '',
            work_environment: job.work_environment || '',
            number_of_employees: job.number_of_employees || '',
            founded_year: job.founded_year || '',
            industry: job.industry || '',
            appeal_points: job.appeal_points || '',
            contract_period: job.contract_period || '',
            notes: job.notes || '',
            allow_referral: job.allow_referral || false,
            referral_fee_type: job.referral_fee_type || 'percentage',
            referral_fee: job.referral_fee || '',
            referral_conditions: job.referral_conditions || '',
            listing_type: job.agency_client_id ? 'referral' : 'direct',
            agency_client_id: job.agency_client_id || '',
            client_company_name: job.agency_client?.client_name || '',
            client_company_address: job.agency_client?.address || '',
            client_company_industry: job.client_company_industry || '',
            client_company_employees: job.client_company_employees || '',
            client_company_description: job.agency_client?.client_description || '',
            // 職種カテゴリ
            job_category_major: job.job_category_major || '',
            job_category_minor: job.job_category_minor || '',
            // 採用情報
            application_type: job.application_type || '中途',
            positions_available: job.positions_available || '',
            feature_tags: job.feature_tags || [],
            // 仕事内容補足
            preferred_qualifications: job.preferred_qualifications || '',
            recruitment_background: job.recruitment_background || '',
            scope_of_change: job.scope_of_change || '',
            // 勤務条件補足
            location_scope_of_change: job.location_scope_of_change || '',
            dormitory: job.dormitory || '',
            smoking_policy: job.smoking_policy || '',
            // エージェント限定情報
            age_min: job.age_min || '',
            age_max: job.age_max || '',
            gender_requirement: job.gender_requirement || '不問',
            nationality_requirement: job.nationality_requirement || '',
            education_requirement: job.education_requirement || '',
            referral_fee_distribution: job.referral_fee_distribution || '',
            refund_policy: job.refund_policy || '',
            payment_terms: job.payment_terms || '',
            disclosure_scope: job.disclosure_scope || '',
            likely_candidates: job.likely_candidates || '',
            ng_targets: job.ng_targets || '',
            selection_details_agent: job.selection_details_agent || '',
            daily_budget: job.daily_budget || 0,
            status: job.status || 'draft',
        });
        setActiveTab('basic');
        setShowForm(true);
    };

    const handleDuplicate = async (job) => {
        try {
            const res = await api.post(`/jobs/${job.id}/duplicate`);
            setJobs(prev => [res.data, ...prev]);
            toast.success(`「${job.title}」を複製しました（下書き）`);
        } catch (err) {
            toast.error(err.response?.data?.message || '複製に失敗しました');
        }
    };

    const handleExportCsv = async () => {
        try {
            const res = await api.get('/jobs-export-csv', { responseType: 'blob' });
            const url = window.URL.createObjectURL(new Blob([res.data]));
            const a = document.createElement('a');
            a.href = url;
            a.download = 'jobs_export.csv';
            a.click();
            window.URL.revokeObjectURL(url);
        } catch {
            toast.error('CSVエクスポートに失敗しました');
        }
    };

    const handleDelete = (job) => {
        setConfirmDialog({
            title: '求人の削除',
            message: `「${job.title}」を削除しますか？この操作は取り消せません。`,
            confirmText: '削除',
            onConfirm: async () => {
                setConfirmDialog(null);
                try {
                    await api.delete(`/jobs/${job.id}`);
                    setJobs(jobs.filter(j => j.id !== job.id));
                } catch (err) {
                    toast.error(err.response?.data?.message || '削除に失敗しました');
                }
            },
            onCancel: () => setConfirmDialog(null),
        });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        // 公開（active）に変更する場合、日額予算を即時決済する旨を事前確認
        const isActivating =
            form.status === 'active' &&
            (!editingJob || editingJob.status !== 'active');
        const budget = parseFloat(form.daily_budget) || 0;

        if (isActivating && budget >= 500) {
            const confirmed = await new Promise((resolve) => {
                setConfirmDialog({
                    title: '求人を公開・決済確認',
                    message: `求人を公開すると、本日分の日額予算 ¥${budget.toLocaleString()} が登録済みのカードに即時決済されます。\n\nよろしいですか？`,
                    confirmText: `¥${budget.toLocaleString()} を決済して公開する`,
                    onConfirm: () => { setConfirmDialog(null); resolve(true); },
                    onCancel: () => { setConfirmDialog(null); resolve(false); },
                });
            });
            if (!confirmed) return;
        }

        setSaving(true);
        setErrors({});
        try {
            const payload = { ...form };
            // 必須フィールドは空文字のままにしない（サーバーバリデーション用）
            const REQUIRED_FIELDS = ['title', 'description', 'prefecture', 'city', 'office_address', 'employment_type', 'salary_type', 'salary_min', 'work_hours', 'holidays', 'insurance', 'contract_period'];
            Object.keys(payload).forEach(k => {
                if (payload[k] === '' && !REQUIRED_FIELDS.includes(k)) payload[k] = null;
            });
            if (payload.salary_min) payload.salary_min = parseInt(payload.salary_min);
            if (payload.salary_max) payload.salary_max = parseInt(payload.salary_max);
            payload.daily_budget = parseFloat(payload.daily_budget) || 0;

            // 人材紹介: クライアント情報の処理
            if (payload.listing_type === 'referral' && !payload.agency_client_id && payload.client_company_name) {
                // 新規クライアントを作成
                try {
                    const clientRes = await api.post('/agency/clients', {
                        client_name: payload.client_company_name,
                        address: payload.client_company_address || '',
                        client_description: payload.client_company_description || '',
                    });
                    payload.agency_client_id = clientRes.data.id || clientRes.data.data?.id;
                    setAgencyClients(prev => [...prev, clientRes.data.data || clientRes.data]);
                } catch (clientErr) {
                    // クライアント作成失敗でもジョブ作成は続行
                }
            }
            if (payload.listing_type === 'direct') {
                payload.agency_client_id = null;
                payload.client_company_industry = null;
                payload.client_company_employees = null;
            }
            // フロント専用フィールドを除去
            delete payload.listing_type;
            delete payload.client_company_name;
            delete payload.client_company_address;
            delete payload.client_company_description;

            if (editingJob) {
                if (!payload.status) payload.status = editingJob.status;
                const res = await api.put(`/jobs/${editingJob.id}`, payload);
                setJobs(jobs.map(j => j.id === editingJob.id ? res.data : j));
            } else {
                const res = await api.post('/jobs', payload);
                setJobs([res.data, ...jobs]);
                // 新規作成成功時に下書きをクリア
                localStorage.removeItem(DRAFT_KEY);
                lastSavedForm.current = null;
            }
            setShowForm(false);
            setForm(INITIAL_FORM);
            setEditingJob(null);
        } catch (err) {
            if (err.response?.status === 422 && err.response?.data?.errors) {
                setErrors(err.response.data.errors);
                // 最初のエラーがあるタブに切り替え
                const errorKeys = Object.keys(err.response.data.errors);
                const basicFields = ['title', 'description', 'requirements', 'employment_type', 'industry'];
                const salaryFields = ['salary_type', 'salary_min', 'salary_max', 'insurance'];
                const workFields = ['prefecture', 'city', 'location', 'work_hours', 'holidays', 'contract_period'];
                if (errorKeys.some(k => basicFields.includes(k))) setActiveTab('basic');
                else if (errorKeys.some(k => salaryFields.includes(k))) setActiveTab('salary');
                else if (errorKeys.some(k => workFields.includes(k))) setActiveTab('work');
            } else if (err.response?.status === 402 && err.response?.data?.payment_required) {
                setConfirmDialog({
                    title: 'カード登録が必要です',
                    message: '求人を掲載するには、先にクレジットカードを登録してください。\n企業管理画面でカードを登録しますか？',
                    confirmText: '登録へ進む',
                    onConfirm: () => { setConfirmDialog(null); navigate('/company'); },
                    onCancel: () => setConfirmDialog(null),
                });
            } else {
                toast.error(err.response?.data?.message || '求人の保存に失敗しました');
            }
        } finally {
            setSaving(false);
        }
    };

    // フィルタリング
    const filteredJobs = useMemo(() => {
        let result = jobs;
        if (searchKeyword.trim()) {
            const kw = searchKeyword.trim().toLowerCase();
            result = result.filter(j =>
                (j.title || '').toLowerCase().includes(kw) ||
                (j.location || '').toLowerCase().includes(kw) ||
                (j.employment_type || '').toLowerCase().includes(kw) ||
                (j.description || '').toLowerCase().includes(kw)
            );
        }
        if (filterStatus !== 'all') {
            result = result.filter(j => j.status === filterStatus);
        }
        if (filterBudget === 'free') {
            result = result.filter(j => !j.daily_budget || Number(j.daily_budget) === 0);
        } else if (filterBudget === 'paid') {
            result = result.filter(j => Number(j.daily_budget) > 0);
        }
        return result;
    }, [jobs, searchKeyword, filterStatus, filterBudget]);

    // 一覧のページング（数千件をDOMに一括描画すると重いため、1ページ50件ずつ表示）
    const JOBS_PER_PAGE = 50;
    const totalPages = Math.max(1, Math.ceil(filteredJobs.length / JOBS_PER_PAGE));
    // フィルタ変更などで件数が減ったら、現在ページを範囲内に戻す
    useEffect(() => { if (currentPage > totalPages) setCurrentPage(1); }, [totalPages, currentPage]);
    const pagedJobs = useMemo(
        () => filteredJobs.slice((currentPage - 1) * JOBS_PER_PAGE, currentPage * JOBS_PER_PAGE),
        [filteredJobs, currentPage]
    );
    // 絞り込み条件が変わったら1ページ目に戻す
    useEffect(() => { setCurrentPage(1); }, [searchKeyword, filterStatus, filterBudget]);

    const toggleJobSelect = (jobId) => {
        setSelectedJobs(prev => prev.includes(jobId) ? prev.filter(id => id !== jobId) : [...prev, jobId]);
    };

    const toggleSelectAll = () => {
        const filteredIds = filteredJobs.map(j => j.id);
        if (filteredIds.every(id => selectedJobs.includes(id))) {
            setSelectedJobs(prev => prev.filter(id => !filteredIds.includes(id)));
        } else {
            setSelectedJobs(prev => [...new Set([...prev, ...filteredIds])]);
        }
    };

    const handleBulkBudget = async () => {
        if (selectedJobs.length === 0) return;
        setBulkSaving(true);
        try {
            const res = await api.post('/jobs/bulk-budget', {
                job_ids: selectedJobs,
                daily_budget: parseFloat(bulkBudget) || 0,
            });
            const updatedMap = {};
            (res.data.updated || []).forEach(j => { updatedMap[j.id] = j; });
            setJobs(prev => prev.map(j => updatedMap[j.id] ? { ...j, ...updatedMap[j.id] } : j));
            setSelectedJobs([]);
            toast.success(res.data.message);
        } catch (err) {
            toast.error(err.response?.data?.message || '一括更新に失敗しました');
        } finally {
            setBulkSaving(false);
        }
    };

    const handleBulkStatus = async (status) => {
        if (selectedJobs.length === 0) return;
        setBulkSaving(true);
        try {
            const res = await api.post('/jobs/bulk-status', {
                job_ids: selectedJobs,
                status,
            });
            const updatedMap = {};
            (res.data.updated || []).forEach(j => { updatedMap[j.id] = j; });
            setJobs(prev => prev.map(j => updatedMap[j.id] ? { ...j, ...updatedMap[j.id] } : j));
            setSelectedJobs([]);
            toast.success(res.data.message);
        } catch (err) {
            if (err.response?.status === 402 && err.response?.data?.payment_required) {
                setConfirmDialog({
                    title: 'カード登録が必要です',
                    message: '求人を公開するには、先にクレジットカードを登録してください。',
                    confirmText: '登録へ進む',
                    onConfirm: () => { setConfirmDialog(null); navigate('/company'); },
                    onCancel: () => setConfirmDialog(null),
                });
            } else {
                toast.error(err.response?.data?.message || 'ステータス変更に失敗しました');
            }
        } finally {
            setBulkSaving(false);
        }
    };

    const handleBulkDelete = () => {
        if (selectedJobs.length === 0) return;
        setConfirmDialog({
            title: '一括削除',
            message: `${selectedJobs.length}件の求人を削除しますか？この操作は取り消せません。`,
            confirmText: '削除',
            onConfirm: async () => {
                setConfirmDialog(null);
                setBulkSaving(true);
                try {
                    const res = await api.post('/jobs/bulk-delete', { job_ids: selectedJobs });
                    const deletedIds = res.data.deleted_ids || [];
                    setJobs(prev => prev.filter(j => !deletedIds.includes(j.id)));
                    setSelectedJobs([]);
                    toast.success(res.data.message);
                } catch (err) {
                    toast.error(err.response?.data?.message || '一括削除に失敗しました');
                } finally {
                    setBulkSaving(false);
                }
            },
            onCancel: () => setConfirmDialog(null),
        });
    };

    const statusLabel = {
        draft: { class: 'badge-info', text: '下書き' },
        pending_review: { class: 'badge-warning', text: '審査中' },
        active: { class: 'badge-success', text: '公開中' },
        suspended: { class: 'badge-error', text: '停止中' },
        closed: { class: 'badge-info', text: '終了' },
    };

    const TABS = [
        { key: 'basic', label: '基本情報', icon: '📋', step: 1, required: true, desc: '求人タイトル・仕事内容' },
        { key: 'salary', label: '給与・待遇', icon: '💰', step: 2, required: true, desc: '給与・福利厚生' },
        { key: 'work', label: '勤務条件', icon: '🏢', step: 3, required: true, desc: '勤務地・勤務時間' },
        { key: 'selection', label: '選考', icon: '📊', step: 4, required: false, desc: '選考プロセス' },
        { key: 'appeal', label: '魅力・その他', icon: '✨', step: 5, required: false, desc: '会社の魅力・PR' },
        ...(form.listing_type === 'referral' || form.allow_referral ? [{ key: 'agent', label: 'エージェント限定', icon: '🔒', step: 6, required: false, desc: '紹介条件' }] : []),
        ...(editingJob ? [{ key: 'photos', label: '写真', icon: '📷', step: 7, required: false, desc: '求人画像' }] : []),
    ];

    const currentTabIndex = TABS.findIndex(t => t.key === activeTab);
    const goNextTab = () => {
        if (currentTabIndex < TABS.length - 1) setActiveTab(TABS[currentTabIndex + 1].key);
    };
    const goPrevTab = () => {
        if (currentTabIndex > 0) setActiveTab(TABS[currentTabIndex - 1].key);
    };

    if (loading) return <div className="page container"><div className="skeleton" style={{ height: 300 }} /></div>;

    if (user?.company?.verification_status !== 'verified') {
        return (
            <div className="page container animate-fade-in">
                <div className="card" style={{ textAlign: 'center', padding: 'var(--space-3xl)', maxWidth: 560, margin: '0 auto' }}>
                    <div style={{ fontSize: '3rem', marginBottom: 'var(--space-md)' }}>⏳</div>
                    <h2 style={{ marginBottom: 'var(--space-md)' }}>企業審査中です</h2>
                    <p style={{ color: 'var(--color-text-secondary)', lineHeight: 1.7 }}>
                        審査が完了すると求人の作成・公開が可能になります。<br />
                        通常 1〜3 営業日以内にご連絡いたします。
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="page container animate-fade-in">
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-md)', marginBottom: 'var(--space-xl)' }}>
                <h1 style={{ fontSize: 'var(--font-size-3xl)', flex: 1 }}>求人管理</h1>
                <button className="btn btn-primary" onClick={() => {
                    if (showForm) {
                        setShowForm(false);
                        setEditingJob(null);
                        setForm(INITIAL_FORM);
                    } else {
                        setEditingJob(null);
                        // 会社プロフィールから自動入力
                        const c = user?.company || {};
                        setForm({
                            ...INITIAL_FORM,
                            industry: c.industry || '',
                            number_of_employees: c.number_of_employees || '',
                            founded_year: c.founded_year || '',
                            office_address: c.office_address || '',
                            nearest_station: c.nearest_station || '',
                            company_culture: c.company_culture || '',
                            work_environment: c.work_environment || '',
                        });
                        setShowForm(true);
                    }
                }}>
                    {showForm ? '✕ 閉じる' : '＋ 求人作成'}
                </button>
                <button
                    title="キーボードショートカット"
                    onClick={() => setShowShortcutHelp(v => !v)}
                    style={{ background: 'none', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-full)', width: 30, height: 30, cursor: 'pointer', fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                >?</button>
            </div>

            {/* キーボードショートカットヘルプ */}
            {showShortcutHelp && (
                <div style={{
                    position: 'fixed', inset: 0, zIndex: 1000,
                    background: 'rgba(0,0,0,0.5)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                }} onClick={() => setShowShortcutHelp(false)}>
                    <div className="card" style={{ maxWidth: 420, width: '90%', padding: 'var(--space-xl)' }} onClick={e => e.stopPropagation()}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-lg)' }}>
                            <h3 style={{ margin: 0 }}>キーボードショートカット</h3>
                            <button onClick={() => setShowShortcutHelp(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: 'var(--color-text-muted)' }}>×</button>
                        </div>
                        {[
                            { key: 'N', desc: '新規求人作成フォームを開く' },
                            { key: 'Esc', desc: 'フォーム・このヘルプを閉じる' },
                            { key: '?', desc: 'このヘルプを表示/非表示' },
                        ].map(s => (
                            <div key={s.key} style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-md)', padding: 'var(--space-sm) 0', borderBottom: '1px solid var(--color-border)' }}>
                                <kbd style={{ display: 'inline-block', padding: '3px 10px', borderRadius: 6, background: 'var(--color-bg-primary)', border: '1px solid var(--color-border)', fontFamily: 'monospace', fontSize: 'var(--font-size-sm)', fontWeight: 700, minWidth: 40, textAlign: 'center' }}>{s.key}</kbd>
                                <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>{s.desc}</span>
                            </div>
                        ))}
                        <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', marginTop: 'var(--space-md)', marginBottom: 0 }}>
                            ※ 入力フィールドにカーソルがある間は無効
                        </p>
                    </div>
                </div>
            )}

            {/* ===== 表示切替タブ + 検索 ===== */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)', marginBottom: 'var(--space-lg)', flexWrap: 'wrap' }}>
                <button
                    className={`btn ${viewMode === 'list' ? 'btn-primary' : 'btn-secondary'}`}
                    style={{ fontSize: 'var(--font-size-sm)' }}
                    onClick={() => setViewMode('list')}
                >
                    求人一覧
                </button>
                <button
                    className={`btn ${viewMode === 'analytics' ? 'btn-primary' : 'btn-secondary'}`}
                    style={{ fontSize: 'var(--font-size-sm)' }}
                    onClick={() => setViewMode('analytics')}
                >
                    パフォーマンス
                </button>
                <button
                    className={`btn ${viewMode === 'campaigns' ? 'btn-primary' : 'btn-secondary'}`}
                    style={{ fontSize: 'var(--font-size-sm)' }}
                    onClick={() => setViewMode('campaigns')}
                >
                    予算グループ
                </button>

                {viewMode === 'list' && jobs.length > 0 && !showForm && (
                    <>
                        <div style={{ width: 1, height: 24, background: 'var(--color-border)', margin: '0 var(--space-xs)' }} />
                        <div style={{ position: 'relative', flex: '1 1 200px', maxWidth: 300 }}>
                            <input
                                className="form-input"
                                type="text"
                                value={searchKeyword}
                                onChange={e => { setSearchKeyword(e.target.value); setSelectedJobs([]); }}
                                placeholder="求人を検索..."
                                style={{ height: 36, fontSize: 'var(--font-size-sm)', paddingLeft: 32 }}
                            />
                            <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)', fontSize: 14, pointerEvents: 'none' }}>🔍</span>
                        </div>
                        <select
                            className="form-select"
                            value={filterStatus}
                            onChange={e => { setFilterStatus(e.target.value); setSelectedJobs([]); }}
                            style={{ height: 36, fontSize: 'var(--font-size-xs)', width: 'auto', minWidth: 90 }}
                        >
                            <option value="all">全ステータス</option>
                            <option value="active">公開中</option>
                            <option value="draft">下書き</option>
                            <option value="pending_review">審査中</option>
                            <option value="suspended">停止中</option>
                            <option value="closed">終了</option>
                        </select>
                        <select
                            className="form-select"
                            value={filterBudget}
                            onChange={e => { setFilterBudget(e.target.value); setSelectedJobs([]); }}
                            style={{ height: 36, fontSize: 'var(--font-size-xs)', width: 'auto', minWidth: 90 }}
                        >
                            <option value="all">全予算</option>
                            <option value="paid">有料</option>
                            <option value="free">無料枠</option>
                        </select>
                        {(searchKeyword || filterStatus !== 'all' || filterBudget !== 'all') && (
                            <button
                                className="btn btn-secondary"
                                style={{ fontSize: 'var(--font-size-xs)', padding: '4px 10px', height: 36 }}
                                onClick={() => { setSearchKeyword(''); setFilterStatus('all'); setFilterBudget('all'); setSelectedJobs([]); }}
                            >
                                リセット
                            </button>
                        )}
                        <button
                            className="btn btn-secondary"
                            style={{ fontSize: 'var(--font-size-xs)', padding: '4px 10px', height: 36, marginLeft: 'auto' }}
                            onClick={handleExportCsv}
                        >
                            CSV出力
                        </button>
                    </>
                )}
            </div>

            {/* ===== パフォーマンス分析 ===== */}
            {viewMode === 'analytics' && (
                <JobAnalyticsPanel analytics={analytics} funnel={funnel} loading={analyticsLoading} statusLabel={statusLabel} />
            )}

            {/* ===== 予算グループ管理 ===== */}
            {viewMode === 'campaigns' && (
                <CampaignPanel
                    campaigns={campaigns}
                    loading={campaignsLoading}
                    selectedCampaignId={selectedCampaignId}
                    setSelectedCampaignId={setSelectedCampaignId}
                    campaignDetail={campaignDetail}
                    campaignDetailLoading={campaignDetailLoading}
                    showCampaignForm={showCampaignForm}
                    setShowCampaignForm={setShowCampaignForm}
                    editingCampaignId={editingCampaignId}
                    setEditingCampaignId={setEditingCampaignId}
                    campaignForm={campaignForm}
                    setCampaignForm={setCampaignForm}
                    campaignSaving={campaignSaving}
                    jobs={jobs}
                    companyName={user?.company?.company_name || ''}
                    addJobIds={addJobIds}
                    setAddJobIds={setAddJobIds}
                    onSave={async (e) => {
                        e.preventDefault();
                        setCampaignSaving(true);
                        try {
                            if (editingCampaignId) {
                                await api.put(`/campaigns/${editingCampaignId}`, campaignForm);
                                showToastMsg('予算グループを更新しました');
                            } else {
                                await api.post('/campaigns', campaignForm);
                                showToastMsg('予算グループを作成しました');
                            }
                            setCampaignForm({ name: '', daily_budget: 5000, budget_allocation: 'even', start_date: '', end_date: '', job_ids: [] });
                            setEditingCampaignId(null);
                            setShowCampaignForm(false);
                            fetchCampaigns();
                            if (selectedCampaignId) {
                                const res = await api.get(`/campaigns/${selectedCampaignId}`);
                                setCampaignDetail(res.data);
                            }
                        } catch (err) {
                            showToastMsg(err.response?.data?.message || 'エラーが発生しました', 'error');
                        } finally {
                            setCampaignSaving(false);
                        }
                    }}
                    onStatusChange={async (id, status) => {
                        try {
                            await api.put(`/campaigns/${id}`, { status });
                            showToastMsg(`予算グループを${status === 'active' ? '再開' : status === 'paused' ? '一時停止' : '終了'}しました`);
                            fetchCampaigns();
                            if (selectedCampaignId === id) {
                                const res = await api.get(`/campaigns/${id}`);
                                setCampaignDetail(res.data);
                            }
                        } catch (err) {
                            showToastMsg(err.response?.data?.message || 'エラーが発生しました', 'error');
                        }
                    }}
                    onDelete={async (id) => {
                        if (!confirm('この予算グループを削除しますか？')) return;
                        try {
                            await api.delete(`/campaigns/${id}`);
                            showToastMsg('予算グループを削除しました');
                            if (selectedCampaignId === id) { setSelectedCampaignId(null); setCampaignDetail(null); }
                            fetchCampaigns();
                        } catch (err) {
                            showToastMsg(err.response?.data?.message || 'エラーが発生しました', 'error');
                        }
                    }}
                    onAddJobs={async () => {
                        if (!selectedCampaignId || addJobIds.length === 0) return;
                        try {
                            await api.post(`/campaigns/${selectedCampaignId}/jobs`, { job_ids: addJobIds });
                            showToastMsg(`${addJobIds.length}件の求人を追加しました`);
                            setAddJobIds([]);
                            fetchCampaigns();
                            const res = await api.get(`/campaigns/${selectedCampaignId}`);
                            setCampaignDetail(res.data);
                        } catch (err) {
                            showToastMsg(err.response?.data?.message || 'エラーが発生しました', 'error');
                        }
                    }}
                    onRemoveJob={async (jobId) => {
                        try {
                            await api.delete(`/campaigns/${selectedCampaignId}/jobs`, { data: { job_ids: [jobId] } });
                            showToastMsg('求人を除外しました');
                            fetchCampaigns();
                            const res = await api.get(`/campaigns/${selectedCampaignId}`);
                            setCampaignDetail(res.data);
                        } catch (err) {
                            showToastMsg(err.response?.data?.message || 'エラーが発生しました', 'error');
                        }
                    }}
                    onRedistribute={async () => {
                        try {
                            await api.post(`/campaigns/${selectedCampaignId}/redistribute`);
                            showToastMsg('予算を再配分しました');
                            const res = await api.get(`/campaigns/${selectedCampaignId}`);
                            setCampaignDetail(res.data);
                        } catch (err) {
                            showToastMsg(err.response?.data?.message || 'エラーが発生しました', 'error');
                        }
                    }}
                />
            )}

            {/* ===== 求人作成フォーム ===== */}
            {viewMode === 'list' && showForm && (
                <form onSubmit={handleSubmit} className="card" style={{ marginBottom: 'var(--space-xl)', borderLeft: `4px solid ${editingJob ? '#f59e0b' : 'var(--color-accent)'}` }}>
                    <h3 style={{ marginBottom: 'var(--space-md)' }}>{editingJob ? `求人を編集: ${editingJob.title}` : '新規求人作成'}</h3>

                    {/* 下書き復元バナー */}
                    {draftBanner && !editingJob && (
                        <div style={{
                            padding: 'var(--space-sm) var(--space-md)',
                            background: 'rgba(245,158,11,0.08)',
                            border: '1px solid rgba(245,158,11,0.25)',
                            borderRadius: 'var(--radius-md)',
                            marginBottom: 'var(--space-md)',
                            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                            fontSize: 'var(--font-size-sm)',
                        }}>
                            <span style={{ color: '#b45309', fontWeight: 600 }}>下書きが保存されています</span>
                            <div style={{ display: 'flex', gap: 'var(--space-xs)' }}>
                                <button type="button" onClick={restoreDraft}
                                    style={{ padding: '4px 12px', borderRadius: 'var(--radius-md)', border: '1px solid #d97706', background: '#fbbf24', color: '#78350f', cursor: 'pointer', fontWeight: 700, fontSize: 'var(--font-size-xs)' }}>
                                    復元する
                                </button>
                                <button type="button" onClick={discardDraft}
                                    style={{ padding: '4px 12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', background: 'transparent', color: 'var(--color-text-muted)', cursor: 'pointer', fontSize: 'var(--font-size-xs)' }}>
                                    破棄する
                                </button>
                            </div>
                        </div>
                    )}

                    {/* 職業安定法 法令遵守バナー */}
                    <div style={{
                        padding: 'var(--space-sm) var(--space-md)',
                        background: 'rgba(18,28,52,0.06)',
                        border: '1px solid rgba(18,28,52,0.15)',
                        borderRadius: 'var(--radius-md)',
                        marginBottom: 'var(--space-md)',
                        fontSize: 'var(--font-size-xs)',
                        color: 'var(--color-text-secondary)',
                        lineHeight: 1.6,
                    }}>
                        <strong style={{ color: 'var(--color-text-accent)' }}>職業安定法に基づく必須項目</strong>：
                        <span style={{ color: '#ef4444' }}>*</span> マークの項目は法令により記載が義務付けられています。
                    </div>

                    {/* バリデーションエラー表示 */}
                    {Object.keys(errors).length > 0 && (
                        <div style={{
                            padding: 'var(--space-sm) var(--space-md)',
                            background: 'rgba(239,68,68,0.06)',
                            border: '1px solid rgba(239,68,68,0.2)',
                            borderRadius: 'var(--radius-md)',
                            marginBottom: 'var(--space-md)',
                            fontSize: 'var(--font-size-xs)',
                            color: '#ef4444',
                        }}>
                            <strong>入力エラー：</strong>
                            <ul style={{ margin: '4px 0 0', paddingLeft: 20 }}>
                                {Object.entries(errors).map(([key, msgs]) => (
                                    <li key={key}>{Array.isArray(msgs) ? msgs[0] : msgs}</li>
                                ))}
                            </ul>
                        </div>
                    )}

                    {/* ステップ進捗インジケーター */}
                    <div style={{ marginBottom: 'var(--space-xl)' }}>
                        {/* プログレスバー */}
                        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 'var(--space-md)' }}>
                            {TABS.map((tab, i) => (
                                <React.Fragment key={tab.key}>
                                    <button type="button" onClick={() => setActiveTab(tab.key)}
                                        style={{
                                            width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            fontSize: 'var(--font-size-xs)', fontWeight: 700,
                                            cursor: 'pointer', transition: 'all 0.2s', border: 'none',
                                            background: i <= currentTabIndex ? 'var(--color-accent)' : 'var(--color-bg-surface)',
                                            color: i <= currentTabIndex ? '#fff' : 'var(--color-text-muted)',
                                            boxShadow: activeTab === tab.key ? '0 0 0 3px rgba(200,149,46,0.3)' : 'none',
                                        }}
                                        title={tab.label}>
                                        {i + 1}
                                    </button>
                                    {i < TABS.length - 1 && (
                                        <div style={{
                                            flex: 1, height: 2, margin: '0 4px',
                                            background: i < currentTabIndex ? 'var(--color-accent)' : 'var(--color-border)',
                                            transition: 'background 0.3s',
                                        }} />
                                    )}
                                </React.Fragment>
                            ))}
                        </div>
                        {/* 現在のステップ表示 */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                            <p style={{ margin: 0, fontSize: 'var(--font-size-sm)', fontWeight: 600 }}>
                                {TABS[currentTabIndex]?.icon} ステップ {currentTabIndex + 1}/{TABS.length}: {TABS[currentTabIndex]?.label}
                                {TABS[currentTabIndex]?.required && (
                                    <span style={{ fontSize: 'var(--font-size-xs)', color: '#ef4444', marginLeft: 6 }}>必須</span>
                                )}
                            </p>
                            <p style={{ margin: 0, fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
                                {TABS[currentTabIndex]?.desc}
                                {!TABS[currentTabIndex]?.required && ' （任意）'}
                            </p>
                        </div>
                    </div>

                    {/* ===== 基本情報タブ ===== */}
                    {activeTab === 'basic' && (
                        <div className="animate-fade-in">
                            {/* 人材紹介会社: 求人種別選択 */}
                            {isAgency && (
                                <div style={{
                                    marginBottom: 'var(--space-lg)', padding: 'var(--space-md)',
                                    background: 'rgba(200,149,46,0.04)', borderRadius: 'var(--radius-md)',
                                    border: '1px solid rgba(200,149,46,0.15)',
                                }}>
                                    <label className="form-label" style={{ fontWeight: 700 }}>求人種別 *</label>
                                    <div style={{ display: 'flex', gap: 'var(--space-sm)', marginBottom: 'var(--space-md)' }}>
                                        {[
                                            { value: 'direct', label: '自社採用', desc: '自社で直接採用する求人' },
                                            { value: 'referral', label: '人材紹介', desc: '紹介先企業の求人を代理掲載' },
                                        ].map(opt => (
                                            <div key={opt.value} onClick={() => set('listing_type', opt.value)}
                                                style={{
                                                    flex: 1, padding: 'var(--space-md)', borderRadius: 'var(--radius-md)',
                                                    border: form.listing_type === opt.value ? '2px solid var(--color-accent)' : '1px solid var(--color-border)',
                                                    background: form.listing_type === opt.value ? 'rgba(200,149,46,0.08)' : 'var(--color-bg-surface)',
                                                    cursor: 'pointer', textAlign: 'center',
                                                }}>
                                                <div style={{ fontWeight: 600, fontSize: 'var(--font-size-md)' }}>{opt.label}</div>
                                                <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', marginTop: 2 }}>{opt.desc}</div>
                                            </div>
                                        ))}
                                    </div>

                                    {/* 人材紹介選択時: 紹介先企業情報 */}
                                    {form.listing_type === 'referral' && (
                                        <div style={{
                                            padding: 'var(--space-md)', background: 'var(--color-bg-surface)',
                                            borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)',
                                        }}>
                                            <h4 style={{ fontSize: 'var(--font-size-md)', marginBottom: 'var(--space-md)' }}>
                                                紹介先企業情報（職業安定法による明示義務）
                                            </h4>

                                            {/* 既存クライアントから選択 */}
                                            {agencyClients.length > 0 && (
                                                <div className="form-group">
                                                    <label className="form-label">登録済みクライアントから選択</label>
                                                    <select className="form-select" value={form.agency_client_id || ''}
                                                        onChange={e => {
                                                            const cid = e.target.value;
                                                            set('agency_client_id', cid);
                                                            if (cid) {
                                                                const client = agencyClients.find(c => String(c.id) === cid);
                                                                if (client) {
                                                                    setForm(prev => ({
                                                                        ...prev,
                                                                        agency_client_id: cid,
                                                                        client_company_name: client.client_name || '',
                                                                        client_company_address: client.address || '',
                                                                        client_company_description: client.client_description || '',
                                                                    }));
                                                                }
                                                            }
                                                        }}>
                                                        <option value="">新規入力</option>
                                                        {agencyClients.map(c => (
                                                            <option key={c.id} value={c.id}>{c.client_name}</option>
                                                        ))}
                                                    </select>
                                                </div>
                                            )}

                                            <div className="grid grid-2">
                                                <div className="form-group">
                                                    <label className="form-label">紹介先企業名 *</label>
                                                    <input className="form-input" value={form.client_company_name || ''}
                                                        onChange={e => set('client_company_name', e.target.value)}
                                                        placeholder="例: 株式会社〇〇" />
                                                </div>
                                                <div className="form-group">
                                                    <label className="form-label">紹介先企業 業界</label>
                                                    <select className="form-select" value={form.client_company_industry || ''}
                                                        onChange={e => set('client_company_industry', e.target.value)}>
                                                        <option value="">選択してください</option>
                                                        {INDUSTRY_OPTIONS.map(ind => <option key={ind} value={ind}>{ind}</option>)}
                                                    </select>
                                                </div>
                                                <div className="form-group">
                                                    <label className="form-label">紹介先企業 従業員数</label>
                                                    <select className="form-select" value={form.client_company_employees || ''}
                                                        onChange={e => set('client_company_employees', e.target.value)}>
                                                        <option value="">選択してください</option>
                                                        {['1〜10名','11〜50名','51〜100名','101〜300名','301〜500名','501〜1000名','1001〜5000名','5001名以上'].map(r =>
                                                            <option key={r} value={r}>{r}</option>
                                                        )}
                                                    </select>
                                                </div>
                                                <div className="form-group">
                                                    <label className="form-label">紹介先企業 所在地</label>
                                                    <input className="form-input" value={form.client_company_address || ''}
                                                        onChange={e => set('client_company_address', e.target.value)}
                                                        placeholder="例: 東京都港区..." />
                                                </div>
                                            </div>
                                            <div className="form-group">
                                                <label className="form-label">紹介先企業 概要</label>
                                                <textarea className="form-textarea" rows={2} value={form.client_company_description || ''}
                                                    onChange={e => set('client_company_description', e.target.value)}
                                                    placeholder="事業内容の概要" />
                                            </div>

                                            <div style={{
                                                padding: 'var(--space-sm) var(--space-md)',
                                                background: 'rgba(200,149,46,0.06)', borderRadius: 'var(--radius-sm)',
                                                fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)',
                                            }}>
                                                紹介元: {user?.company?.company_name || '（自社）'}
                                                {user?.company?.permit_number && ` （許可番号: ${user.company.permit_number}）`}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}

                            <div className="form-group">
                                <label className="form-label">求人タイトル <span style={{ color: '#ef4444' }}>*</span></label>
                                <input className="form-input" required value={form.title}
                                    onChange={e => set('title', e.target.value)}
                                    onBlur={() => {
                                        if (!form.title.trim()) {
                                            setErrors(prev => ({ ...prev, title: ['求人タイトルを入力してください'] }));
                                        } else {
                                            setErrors(prev => { const n = { ...prev }; delete n.title; return n; });
                                        }
                                    }}
                                    placeholder="例: 【ロケーションフリー】DXビジネスコンサルタント"
                                    style={errors.title ? { borderColor: '#ef4444' } : {}} />
                                {errors.title && <div style={{ color: '#ef4444', fontSize: 'var(--font-size-xs)', marginTop: 2 }}>{errors.title[0]}</div>}
                            </div>

                            {/* 職種カテゴリ */}
                            <div className="grid grid-2">
                                <div className="form-group">
                                    <label className="form-label">職種（大分類）</label>
                                    <select className="form-select" value={form.job_category_major || ''}
                                        onChange={e => { set('job_category_major', e.target.value); set('job_category_minor', ''); }}>
                                        <option value="">選択してください</option>
                                        {JOB_CATEGORY_MAJORS.map(c => <option key={c} value={c}>{c}</option>)}
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label className="form-label">職種（中分類）</label>
                                    <select className="form-select" value={form.job_category_minor || ''}
                                        onChange={e => set('job_category_minor', e.target.value)}
                                        disabled={!form.job_category_major}>
                                        <option value="">選択してください</option>
                                        {getMinorCategories(form.job_category_major).map(c => <option key={c} value={c}>{c}</option>)}
                                    </select>
                                </div>
                            </div>

                            {/* 採用情報 */}
                            <div className="grid grid-2">
                                <div className="form-group">
                                    <label className="form-label">応募区分</label>
                                    <select className="form-select" value={form.application_type || ''}
                                        onChange={e => set('application_type', e.target.value)}>
                                        <option value="">選択してください</option>
                                        <option value="中途">中途</option>
                                        <option value="新卒">新卒</option>
                                        <option value="中途・新卒">中途・新卒</option>
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label className="form-label">採用人数</label>
                                    <input className="form-input" type="number" min="1" max="999"
                                        value={form.positions_available || ''}
                                        onChange={e => set('positions_available', e.target.value)}
                                        placeholder="例: 3" />
                                </div>
                            </div>

                            {/* 特徴タグ */}
                            <div className="form-group">
                                <label className="form-label">特徴タグ</label>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                                    {FEATURE_TAG_OPTIONS.map(tag => {
                                        const selected = (form.feature_tags || []).includes(tag);
                                        return (
                                            <button key={tag} type="button"
                                                onClick={() => {
                                                    const tags = form.feature_tags || [];
                                                    set('feature_tags', selected ? tags.filter(t => t !== tag) : [...tags, tag]);
                                                }}
                                                style={{
                                                    padding: '4px 10px', borderRadius: 20, fontSize: 'var(--font-size-xs)',
                                                    border: selected ? '1px solid var(--color-accent)' : '1px solid var(--color-border)',
                                                    background: selected ? 'rgba(200,149,46,0.12)' : 'transparent',
                                                    color: selected ? 'var(--color-accent)' : 'var(--color-text-secondary)',
                                                    cursor: 'pointer', fontWeight: selected ? 600 : 400,
                                                }}>
                                                {selected ? '✓ ' : ''}{tag}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* 日額予算（課金設定） */}
                            <div style={{
                                padding: 'var(--space-md)',
                                background: 'linear-gradient(135deg, rgba(200,149,46,0.04), rgba(180,130,30,0.04))',
                                border: '1px solid rgba(200,149,46,0.15)',
                                borderRadius: 'var(--radius-md)',
                                marginBottom: 'var(--space-lg)',
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)', marginBottom: 'var(--space-sm)' }}>
                                    <span style={{ fontSize: 'var(--font-size-base)', fontWeight: 700 }}>日額予算（この求人）</span>
                                    <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
                                        予算が高いほど検索結果で上位に表示されます
                                    </span>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-md)' }}>
                                    <input
                                        type="range" min="0" max="100000" step="500"
                                        value={form.daily_budget || 0}
                                        onChange={e => set('daily_budget', Number(e.target.value))}
                                        style={{ flex: 1, accentColor: 'var(--color-primary)' }}
                                    />
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                        <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)' }}>¥</span>
                                        <input
                                            type="number" min="0" max="999999" step="100"
                                            className="form-input"
                                            value={form.daily_budget || 0}
                                            onChange={e => set('daily_budget', Number(e.target.value))}
                                            style={{ width: 120, textAlign: 'right' }}
                                        />
                                        <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>/日</span>
                                    </div>
                                </div>
                                {(form.daily_budget || 0) === 0 && (
                                    <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-warning)', marginTop: 'var(--space-xs)', marginBottom: 0 }}>
                                        予算¥0の場合、検索結果で最下位に表示されます（無料枠）
                                    </p>
                                )}
                                {(form.daily_budget || 0) > 0 && (
                                    <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', marginTop: 'var(--space-xs)', marginBottom: 0 }}>
                                        月額目安: 約¥{((form.daily_budget || 0) * 30).toLocaleString()}
                                    </p>
                                )}
                                {/* 推定順位インライン表示 */}
                                {rankResult && !rankResult.error && (
                                    <div style={{
                                        display: 'flex', alignItems: 'center', gap: 'var(--space-lg)',
                                        marginTop: 'var(--space-md)', padding: 'var(--space-sm) var(--space-md)',
                                        background: 'var(--color-bg-surface)', borderRadius: 'var(--radius-md)',
                                    }}>
                                        <div style={{ textAlign: 'center' }}>
                                            <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>推定順位</span>
                                            <p style={{ fontSize: 'var(--font-size-xl)', fontWeight: 800, margin: 0 }}>
                                                #{rankResult.estimated_rank}
                                                <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: 400, color: 'var(--color-text-muted)' }}>
                                                    {' '}/ {rankResult.total_jobs || rankResult.total_companies}件
                                                </span>
                                            </p>
                                        </div>
                                        <div style={{ textAlign: 'center' }}>
                                            <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>スコア</span>
                                            <p style={{ fontSize: 'var(--font-size-base)', fontWeight: 700, color: 'var(--color-accent)', margin: 0 }}>
                                                {rankResult.simulated_ranking_score?.toFixed(1)}
                                            </p>
                                        </div>
                                        <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
                                            = ¥{(form.daily_budget || 0).toLocaleString()} × 品質{rankResult.quality_score}
                                        </span>
                                    </div>
                                )}
                            </div>
                            <div className="form-group">
                                <label className="form-label">業務内容 <span style={{ color: '#ef4444' }}>*</span></label>
                                <textarea className="form-textarea" required value={form.description} rows={8}
                                    onChange={e => set('description', e.target.value)}
                                    placeholder={"【業務内容】\n・具体的な業務内容を記入\n・担当する範囲\n・使用する技術やツール"}
                                    style={errors.description ? { borderColor: '#ef4444' } : {}} />
                            </div>
                            <div className="form-group">
                                <label className="form-label">仕事内容の変更の範囲</label>
                                <textarea className="form-textarea" value={form.scope_of_change || ''} rows={2}
                                    onChange={e => set('scope_of_change', e.target.value)}
                                    placeholder="変更の範囲がある場合記入（例: 会社の定める業務）" />
                            </div>
                            <div className="form-group">
                                <label className="form-label">応募条件（必須）</label>
                                <textarea className="form-textarea" value={form.requirements || ''} rows={5}
                                    onChange={e => set('requirements', e.target.value)}
                                    placeholder={"＜必要経験＞\n・コンサルティングorシステム開発経験\n・顧客折衝の経験"} />
                            </div>
                            <div className="form-group">
                                <label className="form-label">歓迎条件</label>
                                <textarea className="form-textarea" value={form.preferred_qualifications || ''} rows={4}
                                    onChange={e => set('preferred_qualifications', e.target.value)}
                                    placeholder={"＜歓迎条件＞\n・プロジェクトマネージャー・リーダー経験\n・チームメンバーの育成、組織マネジメント経験"} />
                            </div>
                            <div className="form-group">
                                <label className="form-label">募集背景</label>
                                <textarea className="form-textarea" value={form.recruitment_background || ''} rows={3}
                                    onChange={e => set('recruitment_background', e.target.value)}
                                    placeholder="事業拡大に伴う増員募集 など" />
                            </div>
                            <div className="grid grid-2">
                                <div className="form-group">
                                    <label className="form-label">雇用形態 <span style={{ color: '#ef4444' }}>*</span></label>
                                    <select className="form-select" required value={form.employment_type}
                                        onChange={e => set('employment_type', e.target.value)}>
                                        <option value="正社員">正社員</option>
                                        <option value="契約社員">契約社員</option>
                                        <option value="パート">パート・アルバイト</option>
                                        <option value="派遣">派遣社員</option>
                                        <option value="業務委託">業務委託</option>
                                        <option value="インターン">インターン</option>
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label className="form-label">業界・業種</label>
                                    <select className="form-select" value={form.industry || ''}
                                        onChange={e => set('industry', e.target.value)}>
                                        <option value="">選択してください</option>
                                        {INDUSTRY_OPTIONS.map(ind => (
                                            <option key={ind} value={ind}>{ind}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* ===== 給与・待遇タブ ===== */}
                    {activeTab === 'salary' && (
                        <div className="animate-fade-in">
                            <div className="grid grid-3">
                                <div className="form-group">
                                    <label className="form-label">給与種別 <span style={{ color: '#ef4444' }}>*</span></label>
                                    <select className="form-select" required value={form.salary_type}
                                        onChange={e => set('salary_type', e.target.value)}>
                                        <option value="年収">年収</option>
                                        <option value="月給">月給</option>
                                        <option value="日給">日給</option>
                                        <option value="時給">時給</option>
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label className="form-label">下限（円） <span style={{ color: '#ef4444' }}>*</span></label>
                                    <input className="form-input" type="number" required value={form.salary_min || ''}
                                        onChange={e => set('salary_min', e.target.value)}
                                        placeholder="例: 4000000"
                                        style={errors.salary_min ? { borderColor: '#ef4444' } : {}} />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">上限（円）</label>
                                    <input className="form-input" type="number" value={form.salary_max || ''}
                                        onChange={e => set('salary_max', e.target.value)}
                                        onBlur={() => {
                                            if (form.salary_max && form.salary_min && Number(form.salary_max) < Number(form.salary_min)) {
                                                setErrors(prev => ({ ...prev, salary_max: ['上限は下限以上の値にしてください'] }));
                                            } else {
                                                setErrors(prev => { const n = { ...prev }; delete n.salary_max; return n; });
                                            }
                                        }}
                                        placeholder="例: 7000000"
                                        style={errors.salary_max ? { borderColor: '#ef4444' } : {}} />
                                    {errors.salary_max && <div style={{ color: '#ef4444', fontSize: 'var(--font-size-xs)', marginTop: 2 }}>{errors.salary_max[0]}</div>}
                                </div>
                            </div>
                            <div className="form-group">
                                <label className="form-label">給与補足（モデル年収等）</label>
                                <textarea className="form-textarea" value={form.salary_details || ''} rows={4}
                                    onChange={e => set('salary_details', e.target.value)}
                                    placeholder={"月給33万〜58万円（みなし残業なし）\n\n【モデル年収】\n・26歳（経験3年）：年収450万円"} />
                            </div>
                            <div className="grid grid-2">
                                <div className="form-group">
                                    <label className="form-label">昇給</label>
                                    <input className="form-input" value={form.raise_frequency || ''}
                                        onChange={e => set('raise_frequency', e.target.value)}
                                        placeholder="例: 年2回（4月・10月）" />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">賞与</label>
                                    <input className="form-input" value={form.bonus || ''}
                                        onChange={e => set('bonus', e.target.value)}
                                        placeholder="例: 年2回（6月・12月）※昨年実績4ヶ月分" />
                                </div>
                            </div>
                            <div className="form-group">
                                <label className="form-label">手当</label>
                                <textarea className="form-textarea" value={form.allowances || ''} rows={3}
                                    onChange={e => set('allowances', e.target.value)}
                                    placeholder={"交通費全額支給（月上限5万円）\n住宅手当（月2万円）\n残業手当（全額支給）"} />
                            </div>

                            {/* 社会保険 */}
                            <div className="form-group">
                                <label className="form-label">社会保険 <span style={{ color: '#ef4444' }}>*</span></label>
                                <div style={{ display: 'flex', gap: 'var(--space-sm)', flexWrap: 'wrap' }}>
                                    {INSURANCE_OPTIONS.map(item => (
                                        <label key={item} style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer', fontSize: 'var(--font-size-sm)' }}>
                                            <input type="checkbox" checked={(form.insurance || []).includes(item)}
                                                onChange={() => toggleInsurance(item)} />
                                            {item}
                                        </label>
                                    ))}
                                </div>
                            </div>

                            {/* 福利厚生 */}
                            <div className="form-group">
                                <label className="form-label">福利厚生</label>
                                <div style={{ display: 'flex', gap: 'var(--space-xs)', flexWrap: 'wrap', marginBottom: 'var(--space-xs)' }}>
                                    {(form.benefits || []).map((b, i) => (
                                        <span key={i} style={{
                                            display: 'inline-flex', alignItems: 'center', gap: 4,
                                            padding: '2px 10px', borderRadius: 'var(--radius-full)',
                                            background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.2)',
                                            fontSize: 'var(--font-size-xs)', color: 'var(--color-success)',
                                        }}>
                                            {b}
                                            <button type="button" onClick={() => removeBenefit(i)}
                                                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: 'inherit', fontSize: 11 }}>✕</button>
                                        </span>
                                    ))}
                                </div>
                                <div style={{ display: 'flex', gap: 'var(--space-xs)' }}>
                                    <input className="form-input" value={benefitInput}
                                        onChange={e => setBenefitInput(e.target.value)}
                                        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addBenefit(); } }}
                                        placeholder="例: 交通費全額支給（Enterで追加）" style={{ flex: 1 }} />
                                    <button type="button" className="btn btn-secondary" onClick={addBenefit}>追加</button>
                                </div>
                            </div>

                            <div className="grid grid-2">
                                <div className="form-group">
                                    <label className="form-label">試用期間</label>
                                    <input className="form-input" value={form.probation_period || ''}
                                        onChange={e => set('probation_period', e.target.value)}
                                        placeholder="例: 3ヶ月" />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">試用期間中の条件</label>
                                    <input className="form-input" value={form.probation_conditions || ''}
                                        onChange={e => set('probation_conditions', e.target.value)}
                                        placeholder="例: 待遇変更なし" />
                                </div>
                            </div>
                        </div>
                    )}

                    {/* ===== 勤務条件タブ ===== */}
                    {activeTab === 'work' && (
                        <div className="animate-fade-in">
                            <div className="grid grid-2">
                                <div className="form-group">
                                    <label className="form-label">都道府県 <span style={{ color: '#ef4444' }}>*</span></label>
                                    <select className="form-select" required value={form.prefecture || ''}
                                        onChange={e => { set('prefecture', e.target.value); set('city', ''); }}
                                        style={errors.prefecture ? { borderColor: '#ef4444' } : {}}>
                                        <option value="">選択してください</option>
                                        {PREFECTURES.map(p => <option key={p} value={p}>{p}</option>)}
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label className="form-label">市区町村 <span style={{ color: '#ef4444' }}>*</span></label>
                                    {(() => {
                                        const cities = form.prefecture ? PREFECTURE_CITIES[form.prefecture] : null;
                                        const isOther = cities && form.city && !cities.includes(form.city);
                                        if (!cities) {
                                            return <input className="form-input" value={form.city || ''}
                                                onChange={e => set('city', e.target.value)}
                                                placeholder="例: 渋谷区"
                                                style={errors.city ? { borderColor: '#ef4444' } : {}} />;
                                        }
                                        return (<>
                                            <select className="form-select"
                                                value={isOther ? '__other__' : (form.city || '')}
                                                onChange={e => set('city', e.target.value === '__other__' ? '' : e.target.value)}
                                                style={errors.city ? { borderColor: '#ef4444' } : {}}>
                                                <option value="">選択してください</option>
                                                {cities.map(c => <option key={c} value={c}>{c}</option>)}
                                                <option value="__other__">その他（手入力）</option>
                                            </select>
                                            {isOther && (
                                                <input className="form-input" style={{ marginTop: 'var(--space-sm)' }}
                                                    value={form.city} onChange={e => set('city', e.target.value)}
                                                    placeholder="市区町村を入力" />
                                            )}
                                        </>);
                                    })()}
                                </div>
                            </div>
                            <div className="form-group">
                                <label className="form-label">詳細住所（ビル名・階数） <span style={{ color: '#ef4444' }}>*</span></label>
                                <input className="form-input" value={form.office_address || ''}
                                    onChange={e => set('office_address', e.target.value)}
                                    placeholder="例: 渋谷スクランブルスクエア 38F" />
                            </div>
                            <div className="grid grid-2">
                                <div className="form-group">
                                    <label className="form-label">最寄り駅</label>
                                    <input className="form-input" value={form.nearest_station || ''}
                                        onChange={e => set('nearest_station', e.target.value)}
                                        placeholder="例: JR山手線 渋谷駅" />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">アクセス</label>
                                    <input className="form-input" value={form.access_info || ''}
                                        onChange={e => set('access_info', e.target.value)}
                                        placeholder="例: 渋谷駅 東口直結 徒歩1分" />
                                </div>
                            </div>
                            <div className="grid grid-2">
                                <div className="form-group">
                                    <label className="form-label">リモート勤務</label>
                                    <select className="form-select" value={form.remote_policy || ''}
                                        onChange={e => set('remote_policy', e.target.value)}>
                                        <option value="">選択してください</option>
                                        <option value="フルリモート">フルリモート</option>
                                        <option value="ハイブリッド">ハイブリッド（一部リモート）</option>
                                        <option value="出社">原則出社</option>
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label className="form-label">転勤の有無</label>
                                    <select className="form-select" value={form.transfer_policy || ''}
                                        onChange={e => set('transfer_policy', e.target.value)}>
                                        <option value="">選択してください</option>
                                        <option value="転勤なし">転勤なし</option>
                                        <option value="転勤あり（国内）">転勤あり（国内）</option>
                                        <option value="転勤あり（海外含む）">転勤あり（海外含む）</option>
                                        <option value="将来的に転勤の可能性あり">将来的に転勤の可能性あり</option>
                                    </select>
                                </div>
                            </div>
                            <div className="grid grid-2">
                                <div className="form-group">
                                    <label className="form-label">勤務時間 <span style={{ color: '#ef4444' }}>*</span></label>
                                    <input className="form-input" required value={form.work_hours || ''}
                                        onChange={e => set('work_hours', e.target.value)}
                                        placeholder="例: フレックスタイム制（コアタイム 11:00〜15:00）"
                                        style={errors.work_hours ? { borderColor: '#ef4444' } : {}} />
                                </div>
                            </div>
                            <div className="grid grid-2">
                                <div className="form-group">
                                    <label className="form-label">月平均残業時間</label>
                                    <input className="form-input" value={form.overtime_average || ''}
                                        onChange={e => set('overtime_average', e.target.value)}
                                        placeholder="例: 月15時間程度" />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">契約期間 <span style={{ color: '#ef4444' }}>*</span></label>
                                    <input className="form-input" required value={form.contract_period || ''}
                                        onChange={e => set('contract_period', e.target.value)}
                                        placeholder="例: 期間の定めなし / 6ヶ月（更新あり）"
                                        style={errors.contract_period ? { borderColor: '#ef4444' } : {}} />
                                </div>
                            </div>
                            <div className="form-group">
                                <label className="form-label">休日・休暇 <span style={{ color: '#ef4444' }}>*</span></label>
                                <input className="form-input" required value={form.holidays || ''}
                                    onChange={e => set('holidays', e.target.value)}
                                    placeholder="例: 完全週休2日制（土日）、祝日、年間休日125日"
                                    style={errors.holidays ? { borderColor: '#ef4444' } : {}} />
                            </div>
                            <div className="form-group">
                                <label className="form-label">休暇詳細</label>
                                <textarea className="form-textarea" value={form.holiday_details || ''} rows={4}
                                    onChange={e => set('holiday_details', e.target.value)}
                                    placeholder={"有給休暇（初年度10日）\n夏季休暇（3日）\n年末年始休暇\n慶弔休暇\n産前産後休暇・育児休暇"} />
                            </div>
                            <div className="form-group">
                                <label className="form-label">勤務地の変更の範囲</label>
                                <input className="form-input" value={form.location_scope_of_change || ''}
                                    onChange={e => set('location_scope_of_change', e.target.value)}
                                    placeholder="例: 会社の定める場所（テレワークを行う場所含む）" />
                            </div>
                            <div className="grid grid-2">
                                <div className="form-group">
                                    <label className="form-label">寮の有無</label>
                                    <select className="form-select" value={form.dormitory || ''}
                                        onChange={e => set('dormitory', e.target.value)}>
                                        <option value="">選択してください</option>
                                        <option value="あり（社宅）">あり（社宅）</option>
                                        <option value="あり（独身寮）">あり（独身寮）</option>
                                        <option value="あり（借上社宅）">あり（借上社宅）</option>
                                        <option value="なし">なし</option>
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label className="form-label">受動喫煙対策</label>
                                    <select className="form-select" value={form.smoking_policy || ''}
                                        onChange={e => set('smoking_policy', e.target.value)}>
                                        <option value="">選択してください</option>
                                        <option value="屋内全面禁煙">屋内全面禁煙</option>
                                        <option value="屋内原則禁煙（喫煙室あり）">屋内原則禁煙（喫煙室あり）</option>
                                        <option value="敷地内全面禁煙">敷地内全面禁煙</option>
                                        <option value="対策あり">対策あり</option>
                                    </select>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* ===== 選考タブ ===== */}
                    {activeTab === 'selection' && (
                        <div className="animate-fade-in">
                            <div className="form-group">
                                <label className="form-label">選考フロー</label>
                                <textarea className="form-textarea" value={form.selection_process || ''} rows={6}
                                    onChange={e => set('selection_process', e.target.value)}
                                    placeholder={"1. 書類選考（1週間以内に連絡）\n2. カジュアル面談（オンライン30分）\n3. 技術面接（オンライン60分）\n4. 最終面接（CTO面接）\n5. 内定"} />
                            </div>
                            <div className="grid grid-2">
                                <div className="form-group">
                                    <label className="form-label">必要書類</label>
                                    <input className="form-input" value={form.required_documents || ''}
                                        onChange={e => set('required_documents', e.target.value)}
                                        placeholder="例: 履歴書、職務経歴書" />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">選考期間目安</label>
                                    <input className="form-input" value={form.estimated_timeline || ''}
                                        onChange={e => set('estimated_timeline', e.target.value)}
                                        placeholder="例: 応募から内定まで約3〜4週間" />
                                </div>
                            </div>
                        </div>
                    )}

                    {/* ===== 魅力・その他タブ ===== */}
                    {activeTab === 'appeal' && (
                        <div className="animate-fade-in">
                            <div className="form-group">
                                <label className="form-label">この求人のアピールポイント</label>
                                <textarea className="form-textarea" value={form.appeal_points || ''} rows={5}
                                    onChange={e => set('appeal_points', e.target.value)}
                                    placeholder={"・フルリモートOK、フレックス制で自分のペースで働ける\n・技術書・カンファレンス費用は会社負担\n・副業OK"} />
                            </div>
                            <div className="form-group">
                                <label className="form-label">職場環境・チーム構成</label>
                                <textarea className="form-textarea" value={form.work_environment || ''} rows={4}
                                    onChange={e => set('work_environment', e.target.value)}
                                    placeholder={"チーム構成：PM1名 + エンジニア5名\n平均年齢30歳、中途入社比率80%"} />
                            </div>
                            <div className="form-group">
                                <label className="form-label">社風・カルチャー</label>
                                <textarea className="form-textarea" value={form.company_culture || ''} rows={3}
                                    onChange={e => set('company_culture', e.target.value)}
                                    placeholder="会社の雰囲気や大切にしている価値観を記入" />
                            </div>
                            <div className="grid grid-3">
                                <div className="form-group">
                                    <label className="form-label">従業員数</label>
                                    <input className="form-input" value={form.number_of_employees || ''}
                                        onChange={e => set('number_of_employees', e.target.value)}
                                        placeholder="例: 120名" />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">設立年</label>
                                    <input className="form-input" value={form.founded_year || ''}
                                        onChange={e => set('founded_year', e.target.value)}
                                        placeholder="例: 2015年" />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">業界</label>
                                    <select className="form-select" value={form.industry || ''}
                                        onChange={e => set('industry', e.target.value)}>
                                        <option value="">選択してください</option>
                                        {INDUSTRY_OPTIONS.map(ind => (
                                            <option key={ind} value={ind}>{ind}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                            <div className="form-group">
                                <label className="form-label">備考・その他</label>
                                <textarea className="form-textarea" value={form.notes || ''} rows={3}
                                    onChange={e => set('notes', e.target.value)}
                                    placeholder="その他伝えたい事項" />
                            </div>

                            {/* 人材紹介可否 */}
                            <div style={{
                                marginTop: 'var(--space-lg)', paddingTop: 'var(--space-lg)',
                                borderTop: '2px solid var(--color-border)',
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-md)' }}>
                                    <div>
                                        <h4 style={{ fontSize: 'var(--font-size-base)', marginBottom: 4 }}>人材紹介の受け入れ</h4>
                                        <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', margin: 0 }}>
                                            ONにすると、人材紹介会社の求人データベースに掲載されます
                                        </p>
                                    </div>
                                    <button type="button"
                                        onClick={() => set('allow_referral', !form.allow_referral)}
                                        style={{
                                            padding: '6px 20px', borderRadius: 'var(--radius-full)',
                                            border: 'none', cursor: 'pointer', fontWeight: 700,
                                            fontSize: 'var(--font-size-sm)',
                                            background: form.allow_referral ? 'var(--color-success)' : 'var(--color-border)',
                                            color: form.allow_referral ? '#fff' : 'var(--color-text-muted)',
                                            transition: 'all var(--transition-fast)',
                                        }}>
                                        {form.allow_referral ? 'ON' : 'OFF'}
                                    </button>
                                </div>

                                {form.allow_referral && (
                                    <div className="animate-fade-in" style={{
                                        padding: 'var(--space-md)',
                                        background: 'rgba(16,185,129,0.04)',
                                        border: '1px solid rgba(16,185,129,0.15)',
                                        borderRadius: 'var(--radius-md)',
                                    }}>
                                        <div className="grid grid-2">
                                            <div className="form-group">
                                                <label className="form-label" style={{ fontSize: 'var(--font-size-xs)' }}>手数料タイプ</label>
                                                <select className="form-select" value={form.referral_fee_type || 'percentage'}
                                                    onChange={e => set('referral_fee_type', e.target.value)}>
                                                    <option value="percentage">成果報酬（年収の%）</option>
                                                    <option value="fixed">固定金額（円）</option>
                                                </select>
                                            </div>
                                            <div className="form-group">
                                                <label className="form-label" style={{ fontSize: 'var(--font-size-xs)' }}>
                                                    {form.referral_fee_type === 'percentage' ? '手数料率（%）' : '手数料（円）'}
                                                </label>
                                                <input className="form-input" type="number" value={form.referral_fee || ''}
                                                    onChange={e => set('referral_fee', e.target.value)}
                                                    placeholder={form.referral_fee_type === 'percentage' ? '例: 30' : '例: 500000'}
                                                    min="0" step={form.referral_fee_type === 'percentage' ? '0.1' : '1'} />
                                            </div>
                                        </div>
                                        <div className="form-group" style={{ marginBottom: 0 }}>
                                            <label className="form-label" style={{ fontSize: 'var(--font-size-xs)' }}>紹介条件・備考</label>
                                            <textarea className="form-textarea" value={form.referral_conditions || ''} rows={3}
                                                onChange={e => set('referral_conditions', e.target.value)}
                                                placeholder={"例:\n・返金規定: 入社後3ヶ月以内の退職は全額返金\n・紹介対象: 正社員のみ\n・その他条件があれば記載"} />
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* ===== エージェント限定タブ ===== */}
                    {activeTab === 'agent' && (
                        <div className="animate-fade-in">
                            <div style={{
                                padding: 'var(--space-md)', marginBottom: 'var(--space-lg)',
                                background: 'rgba(239,68,68,0.04)', borderRadius: 'var(--radius-md)',
                                border: '1px solid rgba(239,68,68,0.15)',
                            }}>
                                <p style={{ fontWeight: 700, color: '#ef4444', fontSize: 'var(--font-size-sm)', margin: 0 }}>
                                    この情報は求職者には公開されません。エージェント間の共有情報です。
                                </p>
                            </div>

                            <h4 style={{ fontSize: 'var(--font-size-md)', marginBottom: 'var(--space-md)', fontWeight: 700 }}>候補者要件</h4>
                            <div className="grid grid-2">
                                <div className="form-group">
                                    <label className="form-label">年齢</label>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                        <input className="form-input" type="number" min="15" max="70"
                                            value={form.age_min || ''} onChange={e => set('age_min', e.target.value)}
                                            placeholder="下限" style={{ width: 80 }} />
                                        <span>〜</span>
                                        <input className="form-input" type="number" min="15" max="70"
                                            value={form.age_max || ''} onChange={e => set('age_max', e.target.value)}
                                            placeholder="上限" style={{ width: 80 }} />
                                        <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)' }}>歳</span>
                                    </div>
                                </div>
                                <div className="form-group">
                                    <label className="form-label">性別</label>
                                    <select className="form-select" value={form.gender_requirement || '不問'}
                                        onChange={e => set('gender_requirement', e.target.value)}>
                                        <option value="不問">不問</option>
                                        <option value="男性">男性</option>
                                        <option value="女性">女性</option>
                                    </select>
                                </div>
                            </div>
                            <div className="grid grid-2">
                                <div className="form-group">
                                    <label className="form-label">国籍</label>
                                    <input className="form-input" value={form.nationality_requirement || ''}
                                        onChange={e => set('nationality_requirement', e.target.value)}
                                        placeholder="例: 日本国籍の方のみ / 不問" />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">学歴</label>
                                    <select className="form-select" value={form.education_requirement || ''}
                                        onChange={e => set('education_requirement', e.target.value)}>
                                        <option value="">指定なし</option>
                                        <option value="不問">不問</option>
                                        <option value="高卒以上">高卒以上</option>
                                        <option value="専門卒以上">専門卒以上</option>
                                        <option value="短大卒以上">短大卒以上</option>
                                        <option value="大卒以上">大卒以上</option>
                                        <option value="大学院卒以上">大学院卒以上</option>
                                    </select>
                                </div>
                            </div>
                            <div className="form-group">
                                <label className="form-label">内定の可能性が高い人</label>
                                <textarea className="form-textarea" value={form.likely_candidates || ''} rows={3}
                                    onChange={e => set('likely_candidates', e.target.value)}
                                    placeholder="どのような人材が内定しやすいか" />
                            </div>
                            <div className="form-group">
                                <label className="form-label">NG対象</label>
                                <textarea className="form-textarea" value={form.ng_targets || ''} rows={3}
                                    onChange={e => set('ng_targets', e.target.value)}
                                    placeholder="紹介NGとなる条件（例: 競合出身不可 等）" />
                            </div>

                            <h4 style={{ fontSize: 'var(--font-size-md)', margin: 'var(--space-xl) 0 var(--space-md)', fontWeight: 700 }}>紹介料・契約</h4>
                            <div className="grid grid-2">
                                <div className="form-group">
                                    <label className="form-label">紹介料（分配額）</label>
                                    <input className="form-input" value={form.referral_fee_distribution || ''}
                                        onChange={e => set('referral_fee_distribution', e.target.value)}
                                        placeholder="例: 想定年収の24%（候補者提供エージェント様へ）" />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">支払い期日</label>
                                    <input className="form-input" value={form.payment_terms || ''}
                                        onChange={e => set('payment_terms', e.target.value)}
                                        placeholder="例: 入社日月当月末締め翌月末払い" />
                                </div>
                            </div>
                            <div className="form-group">
                                <label className="form-label">返金規定</label>
                                <textarea className="form-textarea" value={form.refund_policy || ''} rows={4}
                                    onChange={e => set('refund_policy', e.target.value)}
                                    placeholder={"例:\n入社後1ヶ月以内の場合80%\n入社後3ヶ月以内の場合50%"} />
                            </div>
                            <div className="form-group">
                                <label className="form-label">公開可能範囲</label>
                                <input className="form-input" value={form.disclosure_scope || ''}
                                    onChange={e => set('disclosure_scope', e.target.value)}
                                    placeholder="例: 媒体掲載NG / スカウトOK（社名公開OK）" />
                            </div>
                            <div className="form-group">
                                <label className="form-label">選考詳細情報（エージェント向け）</label>
                                <textarea className="form-textarea" value={form.selection_details_agent || ''} rows={4}
                                    onChange={e => set('selection_details_agent', e.target.value)}
                                    placeholder="エージェント向けの選考に関する補足情報" />
                            </div>
                        </div>
                    )}

                    {/* ===== 写真タブ（編集時のみ） ===== */}
                    {activeTab === 'photos' && editingJob && (
                        <JobPhotoManager jobId={editingJob.id} photos={editingJob.photos || []} onUpdate={(photos) => {
                            const updated = { ...editingJob, photos };
                            setEditingJob(updated);
                            setJobs(jobs.map(j => j.id === editingJob.id ? { ...j, photos } : j));
                        }} />
                    )}

                    {/* 自動保存インジケーター */}
                    {autoSaveMsg && !editingJob && (
                        <div style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 6,
                            fontSize: 'var(--font-size-xs)',
                            color: 'var(--color-success)',
                            marginTop: 'var(--space-sm)',
                            animation: 'fadeInUp 0.3s ease',
                        }}>
                            <span style={{ fontSize: 13 }}>✓</span>
                            <span>下書きを自動保存しました <span style={{ opacity: 0.7 }}>({autoSaveMsg})</span></span>
                        </div>
                    )}

                    {/* ステップナビゲーション + 送信ボタン */}
                    <div style={{ marginTop: 'var(--space-xl)', paddingTop: 'var(--space-lg)', borderTop: '1px solid var(--color-border)' }}>
                        {/* ステップ移動ボタン */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-lg)' }}>
                            <button type="button" className="btn btn-secondary"
                                onClick={goPrevTab}
                                disabled={currentTabIndex === 0}
                                style={{ visibility: currentTabIndex === 0 ? 'hidden' : 'visible' }}>
                                ← 前のステップ
                            </button>
                            <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
                                {currentTabIndex + 1} / {TABS.length}
                            </span>
                            {currentTabIndex < TABS.length - 1 ? (
                                <button type="button" className="btn btn-primary" onClick={goNextTab}>
                                    次のステップ →
                                </button>
                            ) : (
                                <div />
                            )}
                        </div>

                        {/* 保存・送信ボタン */}
                        <div style={{ display: 'flex', gap: 'var(--space-sm)', flexWrap: 'wrap', alignItems: 'center' }}>
                            <button type="submit" className="btn btn-primary" disabled={saving}>
                                {saving ? '保存中...' : editingJob ? '💾 求人を更新' : '📋 求人を作成（審査へ）'}
                            </button>
                            <button type="button" className="btn btn-secondary" onClick={() => setShowPreview(true)}>
                                👁 プレビュー
                            </button>
                            <button type="button" className="btn btn-secondary" onClick={() => { setShowForm(false); setEditingJob(null); setForm(INITIAL_FORM); }}>キャンセル</button>
                            {editingJob && (
                                <div style={{ marginLeft: 'auto', alignSelf: 'center' }}>
                                    <label className="form-label" style={{ fontSize: 'var(--font-size-xs)', marginBottom: 2 }}>ステータス</label>
                                    <select className="form-select" value={form.status || editingJob.status} onChange={e => set('status', e.target.value)} style={{ height: 36, fontSize: 'var(--font-size-xs)', width: 'auto' }}>
                                        <option value="draft">下書き</option>
                                        <option value="pending_review">審査へ提出</option>
                                        <option value="active">公開中</option>
                                        <option value="suspended">停止</option>
                                        <option value="closed">終了</option>
                                    </select>
                                </div>
                            )}
                            {!editingJob && (
                                <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', marginLeft: 'auto', alignSelf: 'center' }}>
                                    ※ 初回投稿は運営の審査後に公開されます
                                </p>
                            )}
                        </div>
                    </div>
                </form>
            )}


            {/* プレビューモーダル */}
            {showPreview && (
                <JobPreviewModal
                    form={form}
                    companyName={user?.company_name || '（会社名）'}
                    onClose={() => setShowPreview(false)}
                />
            )}

            {/* ===== 求人一覧 ===== */}
            {viewMode === 'list' && (
                jobs.length === 0 && !showForm ? (
                    <div className="card" style={{ textAlign: 'center', padding: 'var(--space-3xl)' }}>
                        <div style={{ fontSize: '3rem', marginBottom: 'var(--space-md)' }}>📋</div>
                        <h3 style={{ marginBottom: 'var(--space-sm)' }}>まだ求人がありません</h3>
                        <p style={{ color: 'var(--color-text-secondary)', marginBottom: 'var(--space-lg)' }}>最初の求人を作成しましょう。初回投稿は運営の審査後に公開されます。</p>
                        <button className="btn btn-primary btn-lg" onClick={() => setShowForm(true)}>最初の求人を作成</button>
                    </div>
                ) : (
                    <>
                        {/* 一括選択バー */}
                        {filteredJobs.length > 0 && !showForm && (
                            <div style={{
                                display: 'flex', alignItems: 'center', gap: 'var(--space-md)',
                                padding: 'var(--space-sm) var(--space-md)',
                                marginBottom: 'var(--space-md)',
                                background: selectedJobs.length > 0
                                    ? 'linear-gradient(135deg, rgba(200,149,46,0.08), rgba(180,130,30,0.04))'
                                    : 'var(--color-bg-surface)',
                                border: selectedJobs.length > 0
                                    ? '1px solid rgba(200,149,46,0.25)'
                                    : '1px solid var(--color-border)',
                                borderRadius: 'var(--radius-lg)',
                                transition: 'all var(--transition-fast)',
                            }}>
                                <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-xs)', cursor: 'pointer', fontSize: 'var(--font-size-sm)', whiteSpace: 'nowrap' }}>
                                    <input
                                        type="checkbox"
                                        checked={filteredJobs.length > 0 && filteredJobs.every(j => selectedJobs.includes(j.id))}
                                        onChange={toggleSelectAll}
                                        style={{ accentColor: 'var(--color-accent)', width: 16, height: 16 }}
                                    />
                                    全選択 ({filteredJobs.length})
                                </label>
                                {selectedJobs.length > 0 && (
                                    <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-accent)', fontWeight: 700 }}>
                                        {selectedJobs.length}件選択中
                                    </span>
                                )}
                                {selectedJobs.length > 0 && (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)', marginLeft: 'auto', flexWrap: 'wrap' }}>
                                        {/* 予算一括設定 */}
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                            <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>¥</span>
                                            <input
                                                type="number" min="0" max="999999" step="500"
                                                className="form-input"
                                                value={bulkBudget}
                                                onChange={e => setBulkBudget(Number(e.target.value))}
                                                style={{ width: 110, textAlign: 'right', height: 32, fontSize: 'var(--font-size-sm)' }}
                                                placeholder="日額予算"
                                            />
                                            <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>/日</span>
                                        </div>
                                        <button
                                            className="btn btn-primary"
                                            style={{ fontSize: 'var(--font-size-xs)', padding: '6px 16px' }}
                                            onClick={handleBulkBudget}
                                            disabled={bulkSaving}
                                        >
                                            予算設定
                                        </button>

                                        {/* 区切り線 */}
                                        <div style={{ width: 1, height: 24, background: 'var(--color-border)' }} />

                                        {/* ステータス一括変更 */}
                                        <select
                                            className="form-select"
                                            style={{ height: 32, fontSize: 'var(--font-size-xs)', width: 'auto', minWidth: 100 }}
                                            value=""
                                            onChange={e => { if (e.target.value) handleBulkStatus(e.target.value); }}
                                            disabled={bulkSaving}
                                        >
                                            <option value="">ステータス変更</option>
                                            <option value="active">公開中</option>
                                            <option value="suspended">停止</option>
                                            <option value="closed">終了</option>
                                            <option value="draft">下書き</option>
                                        </select>

                                        {/* 区切り線 */}
                                        <div style={{ width: 1, height: 24, background: 'var(--color-border)' }} />

                                        {/* 一括削除 */}
                                        <button
                                            className="btn btn-secondary"
                                            style={{ fontSize: 'var(--font-size-xs)', padding: '6px 12px', color: '#ef4444' }}
                                            onClick={handleBulkDelete}
                                            disabled={bulkSaving}
                                        >
                                            一括削除
                                        </button>
                                        <button
                                            className="btn btn-secondary"
                                            style={{ fontSize: 'var(--font-size-xs)', padding: '6px 12px' }}
                                            onClick={() => setSelectedJobs([])}
                                        >
                                            解除
                                        </button>
                                    </div>
                                )}
                            </div>
                        )}
                        {/* 検索結果が0件 */}
                        {filteredJobs.length === 0 && !showForm && jobs.length > 0 && (
                            <div className="card" style={{ textAlign: 'center', padding: 'var(--space-xl)', color: 'var(--color-text-muted)' }}>
                                <div style={{ fontSize: '2rem', marginBottom: 'var(--space-sm)' }}>🔍</div>
                                <p>条件に一致する求人がありません</p>
                                <button
                                    className="btn btn-secondary"
                                    style={{ fontSize: 'var(--font-size-sm)', marginTop: 'var(--space-sm)' }}
                                    onClick={() => { setSearchKeyword(''); setFilterStatus('all'); setFilterBudget('all'); }}
                                >
                                    フィルターをリセット
                                </button>
                            </div>
                        )}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
                            {pagedJobs.map(job => (
                                <JobCard
                                    key={job.id}
                                    job={job}
                                    statusLabel={statusLabel}
                                    onEdit={() => startEdit(job)}
                                    onDelete={() => handleDelete(job)}
                                    onDuplicate={() => handleDuplicate(job)}
                                    selected={selectedJobs.includes(job.id)}
                                    onToggleSelect={() => toggleJobSelect(job.id)}
                                    showCheckbox={!showForm}
                                />
                            ))}
                        </div>

                        {/* ページング（大量求人を快適に閲覧） */}
                        {filteredJobs.length > JOBS_PER_PAGE && !showForm && (
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 'var(--space-md)', marginTop: 'var(--space-lg)', flexWrap: 'wrap' }}>
                                <button className="btn btn-secondary" disabled={currentPage <= 1}
                                    onClick={() => { setCurrentPage(p => Math.max(1, p - 1)); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>
                                    ← 前へ
                                </button>
                                <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>
                                    {currentPage} / {totalPages} ページ（全 {filteredJobs.length.toLocaleString()} 件）
                                </span>
                                <button className="btn btn-secondary" disabled={currentPage >= totalPages}
                                    onClick={() => { setCurrentPage(p => Math.min(totalPages, p + 1)); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>
                                    次へ →
                                </button>
                            </div>
                        )}
                    </>
                )
            )}

            {confirmDialog && <ConfirmDialog {...confirmDialog} />}
        </div>
    );
}

/* ============================================
   求人プレビューモーダル
   ============================================ */
function PreviewSectionHeader({ icon, title }) {
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

function PreviewInfoRow({ label, value }) {
    if (!value) return null;
    return (
        <div style={{ display: 'flex', gap: 'var(--space-md)', padding: 'var(--space-sm) 0', borderBottom: '1px solid rgba(0,0,0,0.04)' }}>
            <span style={{ flex: '0 0 120px', fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)', fontWeight: 600 }}>{label}</span>
            <span style={{ flex: 1, fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', whiteSpace: 'pre-wrap', lineHeight: 1.7 }}>{value}</span>
        </div>
    );
}

function JobPreviewModal({ form, companyName, onClose }) {
    const insuranceText = Array.isArray(form.insurance) ? form.insurance.join(' / ') : form.insurance;
    const benefitsText = (() => {
        if (!form.benefits) return null;
        if (Array.isArray(form.benefits)) return form.benefits.length > 0 ? form.benefits.join(' / ') : null;
        if (typeof form.benefits === 'string') return form.benefits;
        return null;
    })();
    const locationText = [form.prefecture, form.city].filter(Boolean).join(' ');

    return (
        <div style={{
            position: 'fixed', inset: 0, zIndex: 1000,
            background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
            padding: 'var(--space-md)', overflowY: 'auto',
        }} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
            <div className="animate-fade-in" style={{
                width: '100%', maxWidth: 800, margin: 'var(--space-xl) auto',
                background: 'var(--color-bg-primary)', borderRadius: 'var(--radius-xl)',
                boxShadow: '0 25px 50px rgba(0,0,0,0.25)',
                overflow: 'hidden',
            }}>
                {/* ヘッダーバー */}
                <div style={{
                    padding: 'var(--space-md) var(--space-xl)',
                    background: 'var(--color-accent)',
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                }}>
                    <span style={{ color: '#fff', fontWeight: 700, fontSize: 'var(--font-size-base)' }}>
                        👁 求人プレビュー（求職者から見た表示）
                    </span>
                    <button onClick={onClose} style={{
                        background: 'rgba(255,255,255,0.2)', border: 'none', color: '#fff',
                        fontSize: 16, cursor: 'pointer', borderRadius: 'var(--radius-full)',
                        width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>✕</button>
                </div>

                <div style={{ padding: 'var(--space-xl)' }}>
                    {/* ヘッダーカード */}
                    <div className="card" style={{ marginBottom: 'var(--space-md)', padding: 'var(--space-xl)' }}>
                        <div style={{ marginBottom: 'var(--space-lg)' }}>
                            <h1 style={{ fontSize: 'var(--font-size-2xl)', marginBottom: 'var(--space-sm)', lineHeight: 1.4 }}>
                                {form.title || '（求人タイトル未入力）'}
                            </h1>
                            <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-base)' }}>
                                🏢 {companyName}
                                {form.industry && <span style={{ marginLeft: 8, opacity: 0.7 }}>({form.industry})</span>}
                            </p>
                        </div>
                        {/* バッジ */}
                        <div style={{ display: 'flex', gap: 'var(--space-sm)', flexWrap: 'wrap' }}>
                            {form.employment_type && <span className="badge badge-info">👔 {form.employment_type}</span>}
                            {form.remote_policy && <span className="badge badge-info">🏠 {form.remote_policy}</span>}
                            {locationText && <span className="badge badge-info">📍 {locationText}</span>}
                            {(form.salary_min || form.salary_max) && (
                                <span className="badge badge-success">
                                    💰 {form.salary_min ? `${Math.round(Number(form.salary_min) / 10000)}万` : ''}
                                    {form.salary_min && form.salary_max ? '〜' : ''}
                                    {form.salary_max ? `${Math.round(Number(form.salary_max) / 10000)}万円` : ''}
                                </span>
                            )}
                            {form.work_hours && <span className="badge badge-info">🕐 {form.work_hours}</span>}
                            {form.overtime_average && <span className="badge badge-info">⏱ 残業{form.overtime_average}</span>}
                            {form.holidays && <span className="badge badge-info">📅 {form.holidays.includes('年間') ? form.holidays.match(/年間休日\d+日/)?.[0] || form.holidays : form.holidays}</span>}
                        </div>
                    </div>

                    {/* アピールポイント */}
                    {form.appeal_points && (
                        <div className="card" style={{ marginBottom: 'var(--space-md)', padding: 'var(--space-lg)', background: 'rgba(245,158,11,0.04)', border: '1px solid rgba(245,158,11,0.15)' }}>
                            <p style={{ fontSize: 'var(--font-size-sm)', fontWeight: 700, color: '#d97706', marginBottom: 'var(--space-sm)' }}>
                                この求人のポイント
                            </p>
                            <p style={{ color: 'var(--color-text-secondary)', whiteSpace: 'pre-wrap', lineHeight: 1.7, fontSize: 'var(--font-size-sm)', margin: 0 }}>
                                {form.appeal_points}
                            </p>
                        </div>
                    )}

                    {/* 仕事内容 */}
                    {form.description && (
                        <div className="card" style={{ marginBottom: 'var(--space-md)', padding: 'var(--space-xl)' }}>
                            <PreviewSectionHeader icon="📋" title="仕事内容" />
                            <p style={{ color: 'var(--color-text-secondary)', whiteSpace: 'pre-wrap', lineHeight: 1.8 }}>
                                {form.description}
                            </p>
                        </div>
                    )}

                    {/* 応募要件 */}
                    {form.requirements && (
                        <div className="card" style={{ marginBottom: 'var(--space-md)', padding: 'var(--space-xl)' }}>
                            <PreviewSectionHeader icon="✅" title="応募要件" />
                            <p style={{ color: 'var(--color-text-secondary)', whiteSpace: 'pre-wrap', lineHeight: 1.8 }}>
                                {form.requirements}
                            </p>
                        </div>
                    )}

                    {/* 給与・待遇 */}
                    {(form.salary_min || form.salary_max || form.salary_details || form.allowances || benefitsText || insuranceText) && (
                        <div className="card" style={{ marginBottom: 'var(--space-md)', padding: 'var(--space-xl)' }}>
                            <PreviewSectionHeader icon="💰" title="給与・待遇" />
                            <PreviewInfoRow label="給与" value={
                                form.salary_details || (form.salary_min || form.salary_max
                                    ? `${form.salary_type || '年収'} ${form.salary_min ? `${(Number(form.salary_min) / 10000).toLocaleString()}万` : ''}${form.salary_min && form.salary_max ? '〜' : ''}${form.salary_max ? `${(Number(form.salary_max) / 10000).toLocaleString()}万円` : ''}`
                                    : null)
                            } />
                            <PreviewInfoRow label="昇給" value={form.raise_frequency} />
                            <PreviewInfoRow label="賞与" value={form.bonus} />
                            <PreviewInfoRow label="手当" value={form.allowances} />
                            <PreviewInfoRow label="福利厚生" value={benefitsText} />
                            <PreviewInfoRow label="社会保険" value={insuranceText} />
                        </div>
                    )}

                    {/* 勤務条件 */}
                    {(form.work_hours || form.holidays || locationText || form.office_address) && (
                        <div className="card" style={{ marginBottom: 'var(--space-md)', padding: 'var(--space-xl)' }}>
                            <PreviewSectionHeader icon="🏢" title="勤務条件" />
                            <PreviewInfoRow label="勤務時間" value={form.work_hours} />
                            <PreviewInfoRow label="残業" value={form.overtime_average} />
                            <PreviewInfoRow label="休日・休暇" value={form.holidays} />
                            <PreviewInfoRow label="休暇詳細" value={form.holiday_details} />
                            <PreviewInfoRow label="リモート" value={form.remote_policy} />
                            <PreviewInfoRow label="勤務地" value={locationText} />
                            <PreviewInfoRow label="詳細住所" value={form.office_address} />
                            <PreviewInfoRow label="最寄り駅" value={form.nearest_station} />
                            <PreviewInfoRow label="アクセス" value={form.access_info} />
                            <PreviewInfoRow label="転勤" value={form.transfer_policy} />
                            <PreviewInfoRow label="契約期間" value={form.contract_period} />
                        </div>
                    )}

                    {/* 試用期間 */}
                    {form.probation_period && (
                        <div className="card" style={{ marginBottom: 'var(--space-md)', padding: 'var(--space-xl)' }}>
                            <PreviewSectionHeader icon="📝" title="試用期間" />
                            <PreviewInfoRow label="期間" value={form.probation_period} />
                            <PreviewInfoRow label="条件" value={form.probation_conditions} />
                        </div>
                    )}

                    {/* 職場環境・社風 */}
                    {(form.work_environment || form.company_culture) && (
                        <div className="card" style={{ marginBottom: 'var(--space-md)', padding: 'var(--space-xl)' }}>
                            <PreviewSectionHeader icon="👥" title="職場環境・社風" />
                            {form.work_environment && (
                                <>
                                    <p style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: 4 }}>チーム構成</p>
                                    <p style={{ color: 'var(--color-text-secondary)', whiteSpace: 'pre-wrap', lineHeight: 1.8, marginBottom: 'var(--space-lg)' }}>
                                        {form.work_environment}
                                    </p>
                                </>
                            )}
                            {form.company_culture && (
                                <>
                                    <p style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: 4 }}>社風・カルチャー</p>
                                    <p style={{ color: 'var(--color-text-secondary)', whiteSpace: 'pre-wrap', lineHeight: 1.8, margin: 0 }}>
                                        {form.company_culture}
                                    </p>
                                </>
                            )}
                        </div>
                    )}

                    {/* 選考について */}
                    {(form.selection_process || form.required_documents || form.estimated_timeline) && (
                        <div className="card" style={{ marginBottom: 'var(--space-md)', padding: 'var(--space-xl)' }}>
                            <PreviewSectionHeader icon="📊" title="選考について" />
                            {form.selection_process && (
                                <p style={{ color: 'var(--color-text-secondary)', whiteSpace: 'pre-wrap', lineHeight: 1.8, marginBottom: 'var(--space-md)' }}>
                                    {form.selection_process}
                                </p>
                            )}
                            <PreviewInfoRow label="必要書類" value={form.required_documents} />
                            <PreviewInfoRow label="選考期間" value={form.estimated_timeline} />
                        </div>
                    )}

                    {/* 企業情報 */}
                    {(form.number_of_employees || form.founded_year || form.industry) && (
                        <div className="card" style={{ marginBottom: 'var(--space-md)', padding: 'var(--space-xl)' }}>
                            <PreviewSectionHeader icon="🏛" title="企業情報" />
                            <PreviewInfoRow label="会社名" value={companyName} />
                            <PreviewInfoRow label="業界" value={form.industry} />
                            <PreviewInfoRow label="設立" value={form.founded_year} />
                            <PreviewInfoRow label="従業員数" value={form.number_of_employees} />
                        </div>
                    )}

                    {/* 備考 */}
                    {form.notes && (
                        <div className="card" style={{ marginBottom: 'var(--space-md)', padding: 'var(--space-lg)', background: 'var(--color-bg-surface)' }}>
                            <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)', lineHeight: 1.7, margin: 0 }}>
                                {form.notes}
                            </p>
                        </div>
                    )}

                    {/* 閉じるボタン */}
                    <div style={{ textAlign: 'center', paddingTop: 'var(--space-md)' }}>
                        <button className="btn btn-secondary" onClick={onClose} style={{ minWidth: 200 }}>
                            閉じる
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

/* ============================================
   求人カード（ペルソナ設定モーダル付き）
   ============================================ */
function JobCard({ job, statusLabel, onEdit, onDelete, onDuplicate, selected, onToggleSelect, showCheckbox }) {
    const [showPersona, setShowPersona] = useState(false);
    const navigate = useNavigate();

    return (
        <div className="card card-glow" style={{
            borderLeft: selected ? '3px solid var(--color-accent)' : undefined,
            background: selected ? 'rgba(200,149,46,0.03)' : undefined,
        }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--space-sm)' }}>
                    {showCheckbox && (
                        <input
                            type="checkbox"
                            checked={selected}
                            onChange={onToggleSelect}
                            style={{ accentColor: 'var(--color-accent)', width: 18, height: 18, marginTop: 4, cursor: 'pointer', flexShrink: 0 }}
                        />
                    )}
                    <div>
                    <h3 style={{ marginBottom: 'var(--space-xs)' }}>{job.title}</h3>
                    {job.job_category_major && (
                        <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', marginBottom: 2 }}>
                            {job.job_category_major}{job.job_category_minor ? ` > ${job.job_category_minor}` : ''}
                        </div>
                    )}
                    <div style={{ display: 'flex', gap: 'var(--space-sm)', flexWrap: 'wrap', marginTop: 'var(--space-sm)' }}>
                        <span className={`badge ${statusLabel[job.status]?.class}`}>{statusLabel[job.status]?.text || job.status}</span>
                        {job.ng_word_flagged && <span className="badge badge-error">⚠️ NGワード検出</span>}
                        {job.employment_type && <span className="badge badge-info">👔 {job.employment_type}</span>}
                        {job.location && <span className="badge badge-info">📍 {job.location}</span>}
                        {job.remote_policy && <span className="badge badge-info">🏠 {job.remote_policy}</span>}
                        {job.application_type && <span className="badge badge-info">📋 {job.application_type}</span>}
                        {job.positions_available && <span className="badge badge-info">👥 {job.positions_available}名</span>}
                        {Number(job.daily_budget) > 0
                            ? <span className="badge badge-success">💰 ¥{Number(job.daily_budget).toLocaleString()}/日</span>
                            : <span className="badge badge-warning">無料枠</span>}
                        {job.agency_client_id && <span className="badge badge-info">人材紹介</span>}
                        {job.allow_referral && !job.agency_client_id && <span className="badge badge-success">🤝 紹介可</span>}
                        {job.photos?.length > 0 && <span className="badge badge-success">📷 {job.photos.length}枚</span>}
                    </div>
                    {job.feature_tags?.length > 0 && (
                        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 6 }}>
                            {job.feature_tags.map(tag => (
                                <span key={tag} style={{
                                    padding: '1px 8px', borderRadius: 'var(--radius-full)',
                                    border: '1px solid var(--color-accent)', color: 'var(--color-accent)',
                                    fontSize: 10, lineHeight: '18px',
                                }}>{tag}</span>
                            ))}
                        </div>
                    )}
                    </div>
                </div>
                <div style={{ display: 'flex', gap: 'var(--space-sm)', flexWrap: 'wrap' }}>
                    <button className="btn btn-secondary" style={{ fontSize: 'var(--font-size-xs)' }}
                        onClick={() => setShowPersona(!showPersona)}>
                        🎯 ペルソナ
                    </button>
                    <button className="btn btn-secondary" style={{ fontSize: 'var(--font-size-xs)' }} onClick={onEdit}>編集</button>
                    <button className="btn btn-secondary" style={{ fontSize: 'var(--font-size-xs)' }} onClick={onDuplicate}>複製</button>
                    <button className="btn btn-secondary" style={{ fontSize: 'var(--font-size-xs)' }}
                        onClick={() => navigate(`/company/jobs/${job.id}/applications`)}>
                        応募者{job.applications_count > 0 ? ` (${job.applications_count})` : ''}
                    </button>
                    <button className="btn btn-secondary" style={{ fontSize: 'var(--font-size-xs)', color: '#ef4444' }} onClick={onDelete}>削除</button>
                </div>
            </div>

            {/* 採用ファネル */}
            {(() => {
                const steps = [
                    { label: '閲覧', count: job.views_count || 0, color: '#94a3b8' },
                    { label: '応募', count: job.applications_count || 0, color: '#6b7280' },
                    { label: '選考中', count: job.reviewing_count || 0, color: '#3b82f6' },
                    { label: '面接', count: job.interviewing_count || 0, color: '#8b5cf6' },
                    { label: '内定', count: job.offered_count || 0, color: '#f59e0b' },
                    { label: '採用', count: job.hired_count || 0, color: '#22c55e' },
                ];
                return (
                    <div style={{
                        display: 'flex', alignItems: 'center', gap: 0,
                        marginTop: 'var(--space-sm)', padding: '8px 12px',
                        background: 'rgba(0,0,0,0.02)', borderRadius: 'var(--radius-sm)',
                        border: '1px solid var(--color-border)',
                    }}>
                        {steps.map((s, i) => (
                            <React.Fragment key={s.label}>
                                <div style={{ textAlign: 'center', flex: 1, minWidth: 0 }}>
                                    <div style={{ fontSize: 'var(--font-size-lg)', fontWeight: 700, color: s.count > 0 ? s.color : 'var(--color-text-muted)' }}>
                                        {s.count}
                                    </div>
                                    <div style={{ fontSize: 10, color: 'var(--color-text-muted)', whiteSpace: 'nowrap' }}>{s.label}</div>
                                </div>
                                {i < steps.length - 1 && (
                                    <span style={{ color: 'var(--color-text-muted)', fontSize: 10, flexShrink: 0, margin: '0 2px' }}>▸</span>
                                )}
                            </React.Fragment>
                        ))}
                    </div>
                );
            })()}

            {showPersona && <PersonaEditor jobId={job.id} persona={job.persona} onClose={() => setShowPersona(false)} />}
        </div>
    );
}

/* ============================================
   ペルソナ設定エディタ
   ============================================ */
const SKILL_SUGGESTIONS = [
    'React', 'TypeScript', 'JavaScript', 'Laravel', 'PHP', 'Python', 'Java', 'Go', 'Ruby',
    'AWS', 'Docker', 'Kubernetes', 'GCP', 'Azure', 'Terraform',
    'Figma', 'SQL', 'PostgreSQL', 'MySQL', 'MongoDB', 'Redis',
    'Node.js', 'Vue.js', 'Next.js', 'Nuxt.js', 'Angular', 'Svelte',
    'Swift', 'Kotlin', 'Flutter', 'React Native',
    'C#', '.NET', 'Rust', 'Scala',
    'Git', 'CI/CD', 'Agile/Scrum', 'REST API', 'GraphQL',
    'Linux', 'Nginx', 'Apache',
    'Excel', 'PowerPoint', 'Salesforce', 'SAP', 'Tableau', 'Power BI',
    '簿記', 'TOEIC800+', 'PMP', 'AWS認定', '情報処理技術者',
];
const LOCATION_OPTIONS = [
    '東京都', '神奈川県', '埼玉県', '千葉県',
    '大阪府', '京都府', '兵庫県', '愛知県',
    '福岡県', '北海道', '宮城県', '広島県',
    'リモート可', '海外',
];
const JOB_TYPE_OPTIONS = [
    'エンジニア', 'フロントエンド', 'バックエンド', 'インフラ', 'データサイエンティスト',
    'デザイナー', 'ディレクター', 'PM/PL',
    '営業', 'インサイドセールス', 'カスタマーサクセス',
    'マーケティング', '広報・PR', '企画',
    '人事', '経理・財務', '法務', '総務', '事務',
    '管理職', 'コンサルタント', '研究開発',
];
const PERSONALITY_TRAIT_OPTIONS = [
    'コミュニケーション力', 'リーダーシップ', '主体性', '論理的思考力',
    'チームワーク', '問題解決力', '柔軟性', '責任感',
    '向上心', '誠実さ', 'ストレス耐性', '創造力',
    '交渉力', '分析力', '行動力', 'プレゼン力',
];
const PRIORITY_CONDITION_OPTIONS = [
    'スキルマッチ', '業界経験', '年齢', '転職回数',
    '学歴', 'マネジメント経験', '語学力', '資格',
    '年収帯', '就業状況（即日可）', 'カルチャーフィット', '成長意欲',
];
const COMPANY_SIZE_OPTIONS = [
    'スタートアップ（〜30名）', '中小企業（31〜300名）', '中堅企業（301〜1000名）',
    '大企業（1001〜5000名）', '大手企業（5001名以上）',
];
const CERTIFICATION_SUGGESTIONS = [
    '基本情報技術者', '応用情報技術者', '情報セキュリティスペシャリスト',
    'AWS認定ソリューションアーキテクト', 'AWS認定デベロッパー',
    'Google Cloud Professional', 'Azure認定', 'PMP',
    'TOEIC 800点以上', 'TOEIC 900点以上', 'TOEFL iBT 80+', '英検1級',
    '日商簿記2級', '日商簿記1級', '公認会計士', '税理士', '社労士',
    '宅地建物取引士', '中小企業診断士', 'FP2級', 'FP1級',
    '普通自動車免許', 'CCNA', 'LPIC', 'Oracle認定',
];

function PersonaEditor({ jobId, persona: initialPersona, onClose }) {
    const initFromData = (data) => ({
        age_min: data?.age_min ?? '',
        age_max: data?.age_max ?? '',
        experience_min: data?.experience_min ?? '',
        experience_max: data?.experience_max ?? '',
        target_skills: data?.target_skills || [],
        target_locations: data?.target_locations || [],
        target_job_types: data?.target_job_types || [],
        target_employment_status: data?.target_employment_status || 'どちらでも',
        target_education: data?.target_education || '不問',
        boost_factor: data?.boost_factor ?? '1.5',
        target_industries: data?.target_industries || [],
        target_salary_min: data?.target_salary_min ?? '',
        target_salary_max: data?.target_salary_max ?? '',
        target_languages: data?.target_languages || [],
        target_certifications: data?.target_certifications || [],
        target_management_experience: data?.target_management_experience || '',
        target_company_sizes: data?.target_company_sizes || [],
        max_company_changes: data?.max_company_changes ?? '',
        personality_traits: data?.personality_traits || [],
        priority_conditions: data?.priority_conditions || [],
        ng_conditions: data?.ng_conditions || '',
        ideal_candidate_description: data?.ideal_candidate_description || '',
    });

    const [persona, setPersona] = useState(initFromData(initialPersona));
    const [loading, setLoading] = useState(!initialPersona);
    const [saving, setSaving] = useState(false);
    const [skillInput, setSkillInput] = useState('');
    const [certInput, setCertInput] = useState('');
    const [message, setMessage] = useState(null);
    const [personaConfirm, setPersonaConfirm] = useState(false);
    const [activeSection, setActiveSection] = useState('basic');

    useEffect(() => {
        if (initialPersona) return;
        api.get(`/jobs/${jobId}/persona`).then(res => {
            if (res.data) setPersona(initFromData(res.data));
        }).catch(err => {
            if (err.response?.status === 403) setMessage({ type: 'error', text: err.response.data.message });
        }).finally(() => setLoading(false));
    }, [jobId, initialPersona]);

    const p = (key, val) => setPersona(prev => ({ ...prev, [key]: val }));

    const toggleArray = (key, item) => {
        const current = persona[key] || [];
        p(key, current.includes(item) ? current.filter(i => i !== item) : [...current, item]);
    };

    const addToArray = (key, value, setInput) => {
        if (value.trim() && !(persona[key] || []).includes(value.trim())) {
            p(key, [...(persona[key] || []), value.trim()]);
            setInput('');
        }
    };

    const removeFromArray = (key, index) => {
        p(key, (persona[key] || []).filter((_, j) => j !== index));
    };

    const addLanguage = () => {
        const langs = persona.target_languages || [];
        p('target_languages', [...langs, { language: '', level: '' }]);
    };

    const updateLanguage = (index, field, value) => {
        const langs = [...(persona.target_languages || [])];
        langs[index] = { ...langs[index], [field]: value };
        p('target_languages', langs);
    };

    const removeLanguage = (index) => {
        p('target_languages', (persona.target_languages || []).filter((_, i) => i !== index));
    };

    const handleSave = async () => {
        setSaving(true);
        setMessage(null);
        try {
            const payload = { ...persona };
            ['age_min', 'age_max', 'experience_min', 'experience_max', 'target_salary_min', 'target_salary_max', 'max_company_changes'].forEach(k => {
                payload[k] = payload[k] === '' ? null : parseInt(payload[k]);
            });
            payload.boost_factor = parseFloat(payload.boost_factor) || 1.5;
            // filter out empty languages
            payload.target_languages = (payload.target_languages || []).filter(l => l.language);
            await api.put(`/jobs/${jobId}/persona`, payload);
            setMessage({ type: 'success', text: 'ペルソナ設定を保存しました' });
        } catch (err) {
            setMessage({ type: 'error', text: err.response?.data?.message || '保存に失敗しました' });
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = () => setPersonaConfirm(true);

    const executeDelete = async () => {
        setPersonaConfirm(false);
        try {
            await api.delete(`/jobs/${jobId}/persona`);
            setPersona(initFromData(null));
            setMessage({ type: 'success', text: 'ペルソナ設定を削除しました' });
        } catch (err) {
            setMessage({ type: 'error', text: '削除に失敗しました' });
        }
    };

    if (loading) return <div style={{ padding: 'var(--space-lg)', borderTop: '1px solid var(--color-border)', marginTop: 'var(--space-md)' }}><div className="skeleton" style={{ height: 200 }} /></div>;

    const sectionStyle = (key) => ({
        padding: '6px 14px', borderRadius: 20, fontSize: 'var(--font-size-xs)', cursor: 'pointer',
        border: activeSection === key ? '1px solid var(--color-accent)' : '1px solid var(--color-border)',
        background: activeSection === key ? 'rgba(200,149,46,0.12)' : 'transparent',
        color: activeSection === key ? 'var(--color-accent)' : 'var(--color-text-secondary)',
        fontWeight: activeSection === key ? 600 : 400,
    });

    const chipToggleStyle = (selected) => ({
        padding: '4px 12px', borderRadius: 'var(--radius-full)', cursor: 'pointer',
        fontSize: 'var(--font-size-xs)',
        border: selected ? '1px solid var(--color-accent)' : '1px solid var(--color-border)',
        background: selected ? 'rgba(200,149,46,0.12)' : 'transparent',
        color: selected ? 'var(--color-accent)' : 'var(--color-text-secondary)',
        fontWeight: selected ? 600 : 400,
    });

    const tagStyle = {
        display: 'inline-flex', alignItems: 'center', gap: 4,
        padding: '2px 10px', borderRadius: 'var(--radius-full)',
        background: 'rgba(18,28,52,0.1)', border: '1px solid rgba(18,28,52,0.2)',
        fontSize: 'var(--font-size-xs)', color: 'var(--color-text-accent)',
    };

    // count how many conditions are set per section
    const countBasic = [persona.age_min, persona.age_max, persona.experience_min, persona.experience_max,
        persona.target_employment_status !== 'どちらでも' && persona.target_employment_status,
        persona.target_education !== '不問' && persona.target_education,
        persona.max_company_changes].filter(Boolean).length;
    const countSkill = (persona.target_skills?.length || 0) + (persona.target_certifications?.length || 0) + (persona.target_languages?.length || 0);
    const countTarget = (persona.target_locations?.length || 0) + (persona.target_job_types?.length || 0) + (persona.target_industries?.length || 0);
    const countProfile = (persona.personality_traits?.length || 0) + (persona.target_management_experience ? 1 : 0)
        + (persona.target_company_sizes?.length || 0) + (persona.target_salary_min ? 1 : 0);
    const countOther = (persona.ng_conditions ? 1 : 0) + (persona.ideal_candidate_description ? 1 : 0)
        + (persona.priority_conditions?.length || 0);

    return (
        <div className="animate-fade-in" style={{
            marginTop: 'var(--space-md)', paddingTop: 'var(--space-lg)',
            borderTop: '2px solid var(--color-accent)',
        }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-md)' }}>
                <h4 style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--color-text-accent)', margin: 0 }}>
                    🎯 ターゲットペルソナ設定
                </h4>
                <button className="btn btn-secondary" style={{ fontSize: 'var(--font-size-xs)' }} onClick={onClose}>閉じる</button>
            </div>

            <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', marginBottom: 'var(--space-md)', lineHeight: 1.6 }}>
                ターゲット求職者の条件を設定すると、条件にマッチする求職者に優先的に表示されます。
                設定しない項目は全求職者に均等に表示されます。
            </p>

            {message && (
                <div style={{
                    padding: 'var(--space-sm) var(--space-md)', marginBottom: 'var(--space-md)',
                    borderRadius: 'var(--radius-md)', fontSize: 'var(--font-size-sm)',
                    background: message.type === 'success' ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
                    color: message.type === 'success' ? 'var(--color-success)' : '#ef4444',
                    border: `1px solid ${message.type === 'success' ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)'}`,
                }}>{message.text}</div>
            )}

            {/* セクションナビ */}
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 'var(--space-lg)' }}>
                <button type="button" onClick={() => setActiveSection('basic')} style={sectionStyle('basic')}>
                    基本条件{countBasic > 0 && ` (${countBasic})`}
                </button>
                <button type="button" onClick={() => setActiveSection('skills')} style={sectionStyle('skills')}>
                    スキル・資格{countSkill > 0 && ` (${countSkill})`}
                </button>
                <button type="button" onClick={() => setActiveSection('target')} style={sectionStyle('target')}>
                    勤務地・職種・業界{countTarget > 0 && ` (${countTarget})`}
                </button>
                <button type="button" onClick={() => setActiveSection('profile')} style={sectionStyle('profile')}>
                    人物像・経歴{countProfile > 0 && ` (${countProfile})`}
                </button>
                <button type="button" onClick={() => setActiveSection('other')} style={sectionStyle('other')}>
                    NG・優先条件{countOther > 0 && ` (${countOther})`}
                </button>
                <button type="button" onClick={() => setActiveSection('boost')} style={sectionStyle('boost')}>
                    ブースト設定
                </button>
            </div>

            {/* ===== 基本条件 ===== */}
            {activeSection === 'basic' && (
                <div className="animate-fade-in">
                    <div className="grid grid-2" style={{ marginBottom: 'var(--space-md)' }}>
                        <div>
                            <label className="form-label" style={{ fontSize: 'var(--font-size-xs)' }}>ターゲット年齢層</label>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-xs)' }}>
                                <input className="form-input" type="number" min="18" max="70" value={persona.age_min}
                                    onChange={e => p('age_min', e.target.value)} placeholder="下限" style={{ width: 80 }} />
                                <span style={{ color: 'var(--color-text-muted)' }}>〜</span>
                                <input className="form-input" type="number" min="18" max="70" value={persona.age_max}
                                    onChange={e => p('age_max', e.target.value)} placeholder="上限" style={{ width: 80 }} />
                                <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>歳</span>
                            </div>
                        </div>
                        <div>
                            <label className="form-label" style={{ fontSize: 'var(--font-size-xs)' }}>経験年数</label>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-xs)' }}>
                                <input className="form-input" type="number" min="0" max="50" value={persona.experience_min}
                                    onChange={e => p('experience_min', e.target.value)} placeholder="下限" style={{ width: 80 }} />
                                <span style={{ color: 'var(--color-text-muted)' }}>〜</span>
                                <input className="form-input" type="number" min="0" max="50" value={persona.experience_max}
                                    onChange={e => p('experience_max', e.target.value)} placeholder="上限" style={{ width: 80 }} />
                                <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>年</span>
                            </div>
                        </div>
                    </div>
                    <div className="grid grid-3" style={{ marginBottom: 'var(--space-md)' }}>
                        <div className="form-group">
                            <label className="form-label" style={{ fontSize: 'var(--font-size-xs)' }}>雇用状況</label>
                            <select className="form-select" value={persona.target_employment_status || 'どちらでも'}
                                onChange={e => p('target_employment_status', e.target.value)}>
                                <option value="どちらでも">どちらでも</option>
                                <option value="在職中">在職中</option>
                                <option value="離職中">離職中</option>
                            </select>
                        </div>
                        <div className="form-group">
                            <label className="form-label" style={{ fontSize: 'var(--font-size-xs)' }}>学歴</label>
                            <select className="form-select" value={persona.target_education || '不問'}
                                onChange={e => p('target_education', e.target.value)}>
                                <option value="不問">不問</option>
                                <option value="高卒以上">高卒以上</option>
                                <option value="専門卒以上">専門卒以上</option>
                                <option value="短大卒以上">短大卒以上</option>
                                <option value="大卒以上">大卒以上</option>
                                <option value="大学院卒以上">大学院卒以上</option>
                            </select>
                        </div>
                        <div className="form-group">
                            <label className="form-label" style={{ fontSize: 'var(--font-size-xs)' }}>転職回数上限</label>
                            <select className="form-select" value={persona.max_company_changes ?? ''}
                                onChange={e => p('max_company_changes', e.target.value)}>
                                <option value="">指定なし</option>
                                <option value="1">1回まで</option>
                                <option value="2">2回まで</option>
                                <option value="3">3回まで</option>
                                <option value="5">5回まで</option>
                                <option value="10">10回まで</option>
                            </select>
                        </div>
                    </div>
                    <div className="grid grid-2">
                        <div>
                            <label className="form-label" style={{ fontSize: 'var(--font-size-xs)' }}>ターゲット年収帯</label>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-xs)' }}>
                                <input className="form-input" type="number" min="0" step="50"
                                    value={persona.target_salary_min}
                                    onChange={e => p('target_salary_min', e.target.value)}
                                    placeholder="下限" style={{ width: 100 }} />
                                <span style={{ color: 'var(--color-text-muted)' }}>〜</span>
                                <input className="form-input" type="number" min="0" step="50"
                                    value={persona.target_salary_max}
                                    onChange={e => p('target_salary_max', e.target.value)}
                                    placeholder="上限" style={{ width: 100 }} />
                                <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>万円</span>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ===== スキル・資格・語学 ===== */}
            {activeSection === 'skills' && (
                <div className="animate-fade-in">
                    {/* スキル */}
                    <div style={{ marginBottom: 'var(--space-lg)' }}>
                        <label className="form-label" style={{ fontSize: 'var(--font-size-xs)' }}>ターゲットスキル</label>
                        <div style={{ display: 'flex', gap: 'var(--space-xs)', flexWrap: 'wrap', marginBottom: 'var(--space-xs)' }}>
                            {(persona.target_skills || []).map((s, i) => (
                                <span key={i} style={tagStyle}>
                                    {s}
                                    <button type="button" onClick={() => removeFromArray('target_skills', i)}
                                        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: 'inherit', fontSize: 11 }}>✕</button>
                                </span>
                            ))}
                        </div>
                        <div style={{ display: 'flex', gap: 'var(--space-xs)', marginBottom: 'var(--space-xs)' }}>
                            <input className="form-input" value={skillInput}
                                onChange={e => setSkillInput(e.target.value)}
                                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addToArray('target_skills', skillInput, setSkillInput); } }}
                                placeholder="スキルを入力（Enterで追加）" style={{ flex: 1 }} />
                            <button type="button" className="btn btn-secondary" onClick={() => addToArray('target_skills', skillInput, setSkillInput)}
                                style={{ fontSize: 'var(--font-size-xs)' }}>追加</button>
                        </div>
                        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                            {SKILL_SUGGESTIONS.filter(s => !(persona.target_skills || []).includes(s)).slice(0, 18).map(s => (
                                <button key={s} type="button" onClick={() => toggleArray('target_skills', s)}
                                    style={{ padding: '2px 8px', borderRadius: 'var(--radius-full)', border: '1px solid var(--color-border)',
                                        background: 'transparent', cursor: 'pointer', fontSize: 11, color: 'var(--color-text-muted)' }}>+ {s}</button>
                            ))}
                        </div>
                    </div>

                    {/* 資格 */}
                    <div style={{ marginBottom: 'var(--space-lg)' }}>
                        <label className="form-label" style={{ fontSize: 'var(--font-size-xs)' }}>求める資格</label>
                        <div style={{ display: 'flex', gap: 'var(--space-xs)', flexWrap: 'wrap', marginBottom: 'var(--space-xs)' }}>
                            {(persona.target_certifications || []).map((c, i) => (
                                <span key={i} style={tagStyle}>
                                    {c}
                                    <button type="button" onClick={() => removeFromArray('target_certifications', i)}
                                        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: 'inherit', fontSize: 11 }}>✕</button>
                                </span>
                            ))}
                        </div>
                        <div style={{ display: 'flex', gap: 'var(--space-xs)', marginBottom: 'var(--space-xs)' }}>
                            <input className="form-input" value={certInput}
                                onChange={e => setCertInput(e.target.value)}
                                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addToArray('target_certifications', certInput, setCertInput); } }}
                                placeholder="資格名を入力（Enterで追加）" style={{ flex: 1 }} />
                            <button type="button" className="btn btn-secondary" onClick={() => addToArray('target_certifications', certInput, setCertInput)}
                                style={{ fontSize: 'var(--font-size-xs)' }}>追加</button>
                        </div>
                        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                            {CERTIFICATION_SUGGESTIONS.filter(c => !(persona.target_certifications || []).includes(c)).slice(0, 12).map(c => (
                                <button key={c} type="button" onClick={() => toggleArray('target_certifications', c)}
                                    style={{ padding: '2px 8px', borderRadius: 'var(--radius-full)', border: '1px solid var(--color-border)',
                                        background: 'transparent', cursor: 'pointer', fontSize: 11, color: 'var(--color-text-muted)' }}>+ {c}</button>
                            ))}
                        </div>
                    </div>

                    {/* 語学 */}
                    <div>
                        <label className="form-label" style={{ fontSize: 'var(--font-size-xs)' }}>語学力</label>
                        {(persona.target_languages || []).map((lang, i) => (
                            <div key={i} style={{ display: 'flex', gap: 'var(--space-xs)', alignItems: 'center', marginBottom: 'var(--space-xs)' }}>
                                <select className="form-select" value={lang.language} onChange={e => updateLanguage(i, 'language', e.target.value)}
                                    style={{ width: 140 }}>
                                    <option value="">言語を選択</option>
                                    <option value="英語">英語</option>
                                    <option value="中国語">中国語</option>
                                    <option value="韓国語">韓国語</option>
                                    <option value="フランス語">フランス語</option>
                                    <option value="ドイツ語">ドイツ語</option>
                                    <option value="スペイン語">スペイン語</option>
                                    <option value="ポルトガル語">ポルトガル語</option>
                                    <option value="日本語">日本語</option>
                                </select>
                                <select className="form-select" value={lang.level || ''} onChange={e => updateLanguage(i, 'level', e.target.value)}
                                    style={{ width: 180 }}>
                                    <option value="">レベル指定なし</option>
                                    <option value="日常会話">日常会話</option>
                                    <option value="ビジネスレベル">ビジネスレベル</option>
                                    <option value="ネイティブ/流暢">ネイティブ/流暢</option>
                                    <option value="読み書き">読み書き</option>
                                </select>
                                <button type="button" onClick={() => removeLanguage(i)}
                                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', fontSize: 16, padding: 4 }}>✕</button>
                            </div>
                        ))}
                        <button type="button" className="btn btn-secondary" onClick={addLanguage}
                            style={{ fontSize: 'var(--font-size-xs)' }}>+ 語学を追加</button>
                    </div>
                </div>
            )}

            {/* ===== 勤務地・職種・業界 ===== */}
            {activeSection === 'target' && (
                <div className="animate-fade-in">
                    <div style={{ marginBottom: 'var(--space-lg)' }}>
                        <label className="form-label" style={{ fontSize: 'var(--font-size-xs)' }}>ターゲット勤務地</label>
                        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                            {LOCATION_OPTIONS.map(loc => (
                                <button key={loc} type="button" onClick={() => toggleArray('target_locations', loc)}
                                    style={chipToggleStyle((persona.target_locations || []).includes(loc))}>{loc}</button>
                            ))}
                        </div>
                    </div>

                    <div style={{ marginBottom: 'var(--space-lg)' }}>
                        <label className="form-label" style={{ fontSize: 'var(--font-size-xs)' }}>ターゲット職種</label>
                        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                            {JOB_TYPE_OPTIONS.map(jt => (
                                <button key={jt} type="button" onClick={() => toggleArray('target_job_types', jt)}
                                    style={chipToggleStyle((persona.target_job_types || []).includes(jt))}>{jt}</button>
                            ))}
                        </div>
                    </div>

                    <div>
                        <label className="form-label" style={{ fontSize: 'var(--font-size-xs)' }}>ターゲット業界</label>
                        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                            {INDUSTRY_OPTIONS.map(ind => (
                                <button key={ind} type="button" onClick={() => toggleArray('target_industries', ind)}
                                    style={chipToggleStyle((persona.target_industries || []).includes(ind))}>{ind}</button>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* ===== 人物像・経歴 ===== */}
            {activeSection === 'profile' && (
                <div className="animate-fade-in">
                    <div style={{ marginBottom: 'var(--space-lg)' }}>
                        <label className="form-label" style={{ fontSize: 'var(--font-size-xs)' }}>求める人物像（ソフトスキル）</label>
                        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                            {PERSONALITY_TRAIT_OPTIONS.map(trait => (
                                <button key={trait} type="button" onClick={() => toggleArray('personality_traits', trait)}
                                    style={chipToggleStyle((persona.personality_traits || []).includes(trait))}>{trait}</button>
                            ))}
                        </div>
                    </div>

                    <div className="grid grid-2" style={{ marginBottom: 'var(--space-lg)' }}>
                        <div className="form-group">
                            <label className="form-label" style={{ fontSize: 'var(--font-size-xs)' }}>マネジメント経験</label>
                            <select className="form-select" value={persona.target_management_experience || ''}
                                onChange={e => p('target_management_experience', e.target.value)}>
                                <option value="">指定なし</option>
                                <option value="不要">不要</option>
                                <option value="あれば尚可">あれば尚可</option>
                                <option value="必須（規模不問）">必須（規模不問）</option>
                                <option value="必須（5人以上）">必須（5人以上）</option>
                                <option value="必須（10人以上）">必須（10人以上）</option>
                                <option value="必須（50人以上）">必須（50人以上）</option>
                            </select>
                        </div>
                    </div>

                    <div style={{ marginBottom: 'var(--space-lg)' }}>
                        <label className="form-label" style={{ fontSize: 'var(--font-size-xs)' }}>前職企業規模（希望）</label>
                        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                            {COMPANY_SIZE_OPTIONS.map(size => (
                                <button key={size} type="button" onClick={() => toggleArray('target_company_sizes', size)}
                                    style={chipToggleStyle((persona.target_company_sizes || []).includes(size))}>{size}</button>
                            ))}
                        </div>
                    </div>

                    <div className="form-group">
                        <label className="form-label" style={{ fontSize: 'var(--font-size-xs)' }}>理想の候補者像（フリーテキスト）</label>
                        <textarea className="form-textarea" rows={4} value={persona.ideal_candidate_description || ''}
                            onChange={e => p('ideal_candidate_description', e.target.value)}
                            placeholder="具体的にどのような経歴・人物像の方を求めているか自由に記述してください。マッチング精度の向上に活用されます。" />
                    </div>
                </div>
            )}

            {/* ===== NG・優先条件 ===== */}
            {activeSection === 'other' && (
                <div className="animate-fade-in">
                    <div style={{ marginBottom: 'var(--space-lg)' }}>
                        <label className="form-label" style={{ fontSize: 'var(--font-size-xs)' }}>重視する条件（優先度順に選択）</label>
                        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 'var(--space-xs)' }}>
                            {(persona.priority_conditions || []).map((cond, i) => (
                                <span key={i} style={{ ...tagStyle, background: 'rgba(200,149,46,0.12)', border: '1px solid rgba(200,149,46,0.3)', color: 'var(--color-accent)' }}>
                                    {i + 1}. {cond}
                                    <button type="button" onClick={() => removeFromArray('priority_conditions', i)}
                                        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: 'inherit', fontSize: 11 }}>✕</button>
                                </span>
                            ))}
                        </div>
                        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                            {PRIORITY_CONDITION_OPTIONS.filter(c => !(persona.priority_conditions || []).includes(c)).map(cond => (
                                <button key={cond} type="button"
                                    onClick={() => p('priority_conditions', [...(persona.priority_conditions || []), cond])}
                                    style={{ padding: '2px 8px', borderRadius: 'var(--radius-full)', border: '1px solid var(--color-border)',
                                        background: 'transparent', cursor: 'pointer', fontSize: 11, color: 'var(--color-text-muted)' }}>+ {cond}</button>
                            ))}
                        </div>
                    </div>

                    <div className="form-group">
                        <label className="form-label" style={{ fontSize: 'var(--font-size-xs)' }}>NG条件</label>
                        <textarea className="form-textarea" rows={4} value={persona.ng_conditions || ''}
                            onChange={e => p('ng_conditions', e.target.value)}
                            placeholder={"紹介NGとなる条件を記載\n例:\n・競合他社（A社、B社）出身\n・短期離職を繰り返している方\n・特定のスキルセットが不足する方"} />
                    </div>
                </div>
            )}

            {/* ===== ブースト設定 ===== */}
            {activeSection === 'boost' && (
                <div className="animate-fade-in">
                    <div className="form-group">
                        <label className="form-label" style={{ fontSize: 'var(--font-size-xs)' }}>ブースト倍率</label>
                        <select className="form-select" value={persona.boost_factor}
                            onChange={e => p('boost_factor', e.target.value)} style={{ maxWidth: 350 }}>
                            <option value="1.0">1.0x（標準 / 日額そのまま）</option>
                            <option value="1.5">1.5x（日額 x1.5 消費）</option>
                            <option value="2.0">2.0x（日額 x2.0 消費）</option>
                            <option value="2.5">2.5x（日額 x2.5 消費）</option>
                            <option value="3.0">3.0x（日額 x3.0 消費）</option>
                        </select>
                        <div style={{
                            marginTop: 'var(--space-sm)', padding: 'var(--space-md)',
                            background: parseFloat(persona.boost_factor) > 1.0 ? 'rgba(245,158,11,0.08)' : 'rgba(18,28,52,0.05)',
                            borderRadius: 'var(--radius-md)', fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)',
                            border: parseFloat(persona.boost_factor) > 1.0 ? '1px solid rgba(245,158,11,0.2)' : '1px solid transparent',
                        }}>
                            {parseFloat(persona.boost_factor) > 1.0 ? (
                                <>
                                    <span style={{ fontWeight: 600, color: '#d97706' }}>
                                        この求人の日額コスト: 設定予算の {persona.boost_factor}倍
                                    </span>
                                    <br />
                                    表示優先度が上がる代わりに、日額予算の消費が {persona.boost_factor}倍になります。
                                    <br />
                                    ペルソナの条件にマッチする求職者への表示が優先的に強化されます。
                                </>
                            ) : (
                                '標準設定です。日額予算はそのまま消費されます。ペルソナの条件は候補者のマッチング判定にのみ使用されます。'
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* 保存・削除ボタン */}
            <div style={{ display: 'flex', gap: 'var(--space-sm)', paddingTop: 'var(--space-lg)', marginTop: 'var(--space-lg)', borderTop: '1px solid var(--color-border)' }}>
                <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
                    {saving ? '保存中...' : '💾 ペルソナを保存'}
                </button>
                <button className="btn btn-secondary" onClick={handleDelete} style={{ fontSize: 'var(--font-size-xs)' }}>
                    リセット
                </button>
            </div>
            {personaConfirm && (
                <ConfirmDialog
                    title="ペルソナ設定の削除"
                    message="ペルソナ設定を削除しますか？"
                    confirmText="削除"
                    onConfirm={executeDelete}
                    onCancel={() => setPersonaConfirm(false)}
                />
            )}
        </div>
    );
}

/* ============================================
   写真アップロード管理（有料機能）
   ============================================ */
function JobPhotoManager({ jobId, photos: initialPhotos, onUpdate }) {
    const [photos, setPhotos] = useState(initialPhotos || []);
    const [uploading, setUploading] = useState(false);
    const [error, setError] = useState(null);
    const [photoDeleteConfirm, setPhotoDeleteConfirm] = useState(null);
    const fileInputRef = React.useRef(null);

    const handleUpload = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // クライアント側バリデーション
        if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
            setError('JPG, PNG, WebP形式の画像のみアップロードできます。');
            return;
        }
        if (file.size > 10 * 1024 * 1024) {
            setError('ファイルサイズは10MB以下にしてください。');
            return;
        }

        setUploading(true);
        setError(null);
        try {
            const formData = new FormData();
            formData.append('photo', file);

            const res = await api.post(`/jobs/${jobId}/photos`, formData);
            const updated = [...photos, res.data];
            setPhotos(updated);
            onUpdate(updated);
        } catch (err) {
            setError(err.response?.data?.message || 'アップロードに失敗しました');
        } finally {
            setUploading(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    const handleDelete = (photoId) => {
        setPhotoDeleteConfirm(photoId);
    };

    const executePhotoDelete = async (photoId) => {
        setPhotoDeleteConfirm(null);
        try {
            await api.delete(`/jobs/${jobId}/photos/${photoId}`);
            const updated = photos.filter(p => p.id !== photoId);
            setPhotos(updated);
            onUpdate(updated);
        } catch (err) {
            setError(err.response?.data?.message || '削除に失敗しました');
        }
    };

    return (
        <div className="animate-fade-in">
            <div style={{
                padding: 'var(--space-sm) var(--space-md)',
                background: 'rgba(245,158,11,0.06)',
                border: '1px solid rgba(245,158,11,0.15)',
                borderRadius: 'var(--radius-md)',
                marginBottom: 'var(--space-md)',
                fontSize: 'var(--font-size-xs)',
                color: 'var(--color-text-secondary)',
                lineHeight: 1.6,
            }}>
                <strong style={{ color: '#d97706' }}>有料機能</strong>：
                写真は有料プラン（予算設定済み）の企業のみアップロードできます。最大5枚まで。
            </div>

            {error && (
                <div style={{
                    padding: 'var(--space-sm) var(--space-md)',
                    background: 'rgba(239,68,68,0.06)',
                    border: '1px solid rgba(239,68,68,0.2)',
                    borderRadius: 'var(--radius-md)',
                    marginBottom: 'var(--space-md)',
                    fontSize: 'var(--font-size-xs)',
                    color: '#ef4444',
                }}>
                    {error}
                </div>
            )}

            {/* 写真グリッド */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
                gap: 'var(--space-md)',
                marginBottom: 'var(--space-md)',
            }}>
                {photos.map(photo => (
                    <div key={photo.id} style={{
                        position: 'relative',
                        borderRadius: 'var(--radius-lg)',
                        overflow: 'hidden',
                        border: '1px solid var(--color-border)',
                        aspectRatio: '4 / 3',
                    }}>
                        <img
                            src={photo.url}
                            alt={photo.caption || '求人写真'}
                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        />
                        <button
                            type="button"
                            onClick={() => handleDelete(photo.id)}
                            style={{
                                position: 'absolute', top: 6, right: 6,
                                background: 'rgba(0,0,0,0.6)', color: '#fff',
                                border: 'none', borderRadius: '50%',
                                width: 28, height: 28, cursor: 'pointer',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontSize: 14,
                            }}
                            title="削除"
                        >
                            ✕
                        </button>
                        {photo.caption && (
                            <div style={{
                                position: 'absolute', bottom: 0, left: 0, right: 0,
                                background: 'linear-gradient(transparent, rgba(0,0,0,0.7))',
                                padding: '16px 8px 6px',
                                fontSize: 'var(--font-size-xs)',
                                color: '#fff',
                            }}>
                                {photo.caption}
                            </div>
                        )}
                    </div>
                ))}

                {/* アップロードボタン（5枚未満の場合） */}
                {photos.length < 5 && (
                    <label style={{
                        display: 'flex', flexDirection: 'column',
                        alignItems: 'center', justifyContent: 'center',
                        borderRadius: 'var(--radius-lg)',
                        border: '2px dashed var(--color-border)',
                        aspectRatio: '4 / 3',
                        cursor: uploading ? 'wait' : 'pointer',
                        color: 'var(--color-text-muted)',
                        fontSize: 'var(--font-size-sm)',
                        transition: 'all var(--transition-fast)',
                        background: 'var(--color-bg-surface)',
                        opacity: uploading ? 0.5 : 1,
                    }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--color-accent)'; e.currentTarget.style.color = 'var(--color-text-accent)'; }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--color-border)'; e.currentTarget.style.color = 'var(--color-text-muted)'; }}
                    >
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/jpeg,image/png,image/webp"
                            onChange={handleUpload}
                            disabled={uploading}
                            style={{ display: 'none' }}
                        />
                        <span style={{ fontSize: 32, marginBottom: 4 }}>{uploading ? '...' : '+'}</span>
                        <span>{uploading ? 'アップロード中...' : '写真を追加'}</span>
                        <span style={{ fontSize: 'var(--font-size-xs)', opacity: 0.6, marginTop: 2 }}>{photos.length}/5枚</span>
                    </label>
                )}
            </div>

            <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
                JPG / PNG / WebP、1枚あたり最大10MB。オフィス、チーム、業務風景などの写真を掲載できます。
            </p>
            {photoDeleteConfirm && (
                <ConfirmDialog
                    title="写真の削除"
                    message="この写真を削除しますか？"
                    confirmText="削除"
                    onConfirm={() => executePhotoDelete(photoDeleteConfirm)}
                    onCancel={() => setPhotoDeleteConfirm(null)}
                />
            )}
        </div>
    );
}

/* ============================================
   予算グループ管理パネル
   ============================================ */
const CAMPAIGN_STATUS_LABELS = { active: '配信中', paused: '一時停止', ended: '終了' };
const CAMPAIGN_STATUS_COLORS = { active: '#22c55e', paused: '#f59e0b', ended: '#94a3b8' };
const ALLOCATION_LABELS = { even: '均等配分', weighted: 'パフォーマンス比' };
const cfmt = (n) => Number(n || 0).toLocaleString();

function CampaignPanel({
    campaigns, loading, selectedCampaignId, setSelectedCampaignId,
    campaignDetail, campaignDetailLoading,
    showCampaignForm, setShowCampaignForm, editingCampaignId, setEditingCampaignId,
    campaignForm, setCampaignForm, campaignSaving, jobs, companyName,
    addJobIds, setAddJobIds,
    onSave, onStatusChange, onDelete, onAddJobs, onRemoveJob, onRedistribute,
}) {
    const resetForm = () => {
        setCampaignForm({ name: '', daily_budget: 5000, budget_allocation: 'even', start_date: '', end_date: '', job_ids: [] });
        setEditingCampaignId(null);
        setShowCampaignForm(false);
    };

    const startEdit = (c) => {
        setCampaignForm({ name: c.name, daily_budget: c.daily_budget, budget_allocation: c.budget_allocation, start_date: c.start_date || '', end_date: c.end_date || '', job_ids: [] });
        setEditingCampaignId(c.id);
        setShowCampaignForm(true);
    };

    const cBtnSm = { padding: '5px 10px', background: 'var(--color-accent)', color: '#fff', border: 'none', borderRadius: 'var(--radius-sm)', fontWeight: 600, cursor: 'pointer', fontSize: 'var(--font-size-xs)' };

    return (
        <div>
            {/* 作成ボタン */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-md)' }}>
                <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-sm)', margin: 0 }}>
                    複数の求人をグループ化して日額予算をまとめて管理
                </p>
                <button className="btn btn-primary" style={{ fontSize: 'var(--font-size-sm)' }} onClick={() => { resetForm(); setShowCampaignForm(true); }}>
                    + 新規予算グループ
                </button>
            </div>

            {/* 作成/編集フォーム */}
            {showCampaignForm && (
                <div className="card" style={{ marginBottom: 'var(--space-lg)', borderLeft: '4px solid var(--color-accent)' }}>
                    <h3 style={{ marginTop: 0, fontSize: 'var(--font-size-md)' }}>
                        {editingCampaignId ? '予算グループを編集' : '新規予算グループ作成'}
                    </h3>
                    <form onSubmit={onSave}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-md)' }}>
                            <div style={{ gridColumn: '1/-1' }}>
                                <label className="form-label">予算グループ名 *</label>
                                <input className="form-input" type="text" value={campaignForm.name} onChange={e => setCampaignForm(f => ({ ...f, name: e.target.value }))} placeholder="例: エンジニア採用強化" required />
                            </div>
                            <div>
                                <label className="form-label">日額予算（全体）</label>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <span style={{ color: 'var(--color-text-muted)', fontSize: 'var(--font-size-sm)' }}>¥</span>
                                    <input type="range" min={0} max={100000} step={500} value={campaignForm.daily_budget} onChange={e => setCampaignForm(f => ({ ...f, daily_budget: Number(e.target.value) }))} style={{ flex: 1 }} />
                                    <input className="form-input" type="number" value={campaignForm.daily_budget} onChange={e => setCampaignForm(f => ({ ...f, daily_budget: Math.max(0, Number(e.target.value)) }))} style={{ width: 110, textAlign: 'right' }} />
                                </div>
                                <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>月額見積もり: ¥{cfmt(campaignForm.daily_budget * 30)}</span>
                            </div>
                            <div>
                                <label className="form-label">配分方法</label>
                                <select className="form-select" value={campaignForm.budget_allocation} onChange={e => setCampaignForm(f => ({ ...f, budget_allocation: e.target.value }))}>
                                    <option value="even">均等配分 — 全求人に同じ日額</option>
                                    <option value="weighted">パフォーマンス比 — 閲覧数に応じて配分</option>
                                </select>
                            </div>
                            <div>
                                <label className="form-label">開始日</label>
                                <input className="form-input" type="date" value={campaignForm.start_date} onChange={e => setCampaignForm(f => ({ ...f, start_date: e.target.value }))} />
                            </div>
                            <div>
                                <label className="form-label">終了日</label>
                                <input className="form-input" type="date" value={campaignForm.end_date} onChange={e => setCampaignForm(f => ({ ...f, end_date: e.target.value }))} />
                            </div>
                            {/* 新規時のみ求人選択 */}
                            {!editingCampaignId && (
                                <div style={{ gridColumn: '1/-1' }}>
                                    <label className="form-label">求人を追加（後から追加可）</label>
                                    <JobCheckboxList
                                        jobs={jobs.filter(j => !j.campaign_id)}
                                        selectedIds={campaignForm.job_ids}
                                        onToggle={(jobId) => setCampaignForm(f => ({ ...f, job_ids: f.job_ids.includes(jobId) ? f.job_ids.filter(id => id !== jobId) : [...f.job_ids, jobId] }))}
                                        emptyText="未所属の求人がありません"
                                        companyName={companyName}
                                    />
                                    {campaignForm.job_ids.length > 0 && (
                                        <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-accent)', fontWeight: 600, marginTop: 4, display: 'block' }}>
                                            {campaignForm.job_ids.length}件選択 → 1求人あたり ¥{cfmt(Math.round(campaignForm.daily_budget / campaignForm.job_ids.length))}/日
                                        </span>
                                    )}
                                </div>
                            )}
                        </div>
                        <div style={{ display: 'flex', gap: 'var(--space-sm)', marginTop: 'var(--space-md)', justifyContent: 'flex-end' }}>
                            <button type="button" className="btn btn-secondary" onClick={resetForm}>キャンセル</button>
                            <button type="submit" className="btn btn-primary" disabled={campaignSaving}>{campaignSaving ? '保存中...' : editingCampaignId ? '更新' : '作成'}</button>
                        </div>
                    </form>
                </div>
            )}

            {/* メインレイアウト */}
            {loading ? (
                <div className="card"><div className="skeleton" style={{ height: 200 }} /></div>
            ) : campaigns.length === 0 && !showCampaignForm ? (
                <div className="card" style={{ textAlign: 'center', padding: 'var(--space-2xl)' }}>
                    <div style={{ fontSize: 48, marginBottom: 'var(--space-md)' }}>📊</div>
                    <h3 style={{ marginBottom: 'var(--space-sm)' }}>予算グループを作成しましょう</h3>
                    <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-sm)' }}>
                        複数の求人をまとめて日額予算を管理できます。<br />パフォーマンスに応じた自動配分も可能です。
                    </p>
                </div>
            ) : campaigns.length > 0 && (
                <div style={{ display: 'grid', gridTemplateColumns: '340px 1fr', gap: 'var(--space-lg)', alignItems: 'start' }}>
                    {/* 左: 予算グループ一覧 */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
                        {campaigns.map(c => (
                            <div key={c.id} onClick={() => setSelectedCampaignId(c.id)}
                                className="card" style={{
                                    cursor: 'pointer', transition: 'all 0.15s', padding: 'var(--space-md)',
                                    borderLeft: selectedCampaignId === c.id ? '3px solid var(--color-accent)' : '3px solid transparent',
                                    opacity: c.status === 'ended' ? 0.6 : 1,
                                }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                                    <strong style={{ fontSize: 'var(--font-size-sm)' }}>{c.name}</strong>
                                    <span style={{
                                        fontSize: 'var(--font-size-xs)', fontWeight: 600, padding: '1px 8px', borderRadius: 'var(--radius-full)',
                                        background: `${CAMPAIGN_STATUS_COLORS[c.status]}18`, color: CAMPAIGN_STATUS_COLORS[c.status],
                                    }}>
                                        {CAMPAIGN_STATUS_LABELS[c.status]}
                                    </span>
                                </div>
                                <div style={{ display: 'flex', gap: 'var(--space-md)', fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
                                    <span>日額 <strong style={{ color: 'var(--color-accent)' }}>¥{cfmt(c.daily_budget)}</strong></span>
                                    <span>求人 <strong>{c.active_jobs_count}/{c.jobs_count}</strong></span>
                                    <span>{ALLOCATION_LABELS[c.budget_allocation]}</span>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* 右: 詳細パネル */}
                    <div>
                        {!selectedCampaignId ? (
                            <div className="card" style={{ textAlign: 'center', padding: 'var(--space-xl)', color: 'var(--color-text-muted)' }}>
                                予算グループを選択してください
                            </div>
                        ) : campaignDetailLoading ? (
                            <div className="card"><div className="skeleton" style={{ height: 200 }} /></div>
                        ) : campaignDetail && (
                            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                                {/* ヘッダー */}
                                <div style={{ padding: 'var(--space-lg)', borderBottom: '1px solid var(--color-border)' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 'var(--space-sm)' }}>
                                        <div>
                                            <h3 style={{ margin: 0, fontSize: 'var(--font-size-lg)' }}>{campaignDetail.name}</h3>
                                            <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
                                                {ALLOCATION_LABELS[campaignDetail.budget_allocation]}
                                                {campaignDetail.start_date && ` | ${campaignDetail.start_date}`}
                                                {campaignDetail.end_date && ` 〜 ${campaignDetail.end_date}`}
                                            </span>
                                        </div>
                                        <div style={{ display: 'flex', gap: 6 }}>
                                            <button style={cBtnSm} onClick={() => startEdit(campaignDetail)}>編集</button>
                                            {campaignDetail.status === 'active' && (
                                                <button style={{ ...cBtnSm, background: '#f59e0b' }} onClick={() => onStatusChange(campaignDetail.id, 'paused')}>一時停止</button>
                                            )}
                                            {campaignDetail.status === 'paused' && (
                                                <button style={{ ...cBtnSm, background: '#22c55e' }} onClick={() => onStatusChange(campaignDetail.id, 'active')}>再開</button>
                                            )}
                                            <button style={{ ...cBtnSm, background: '#ef4444' }} onClick={() => onDelete(campaignDetail.id)}>削除</button>
                                        </div>
                                    </div>

                                    {/* サマリーカード */}
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--space-sm)', marginTop: 'var(--space-md)' }}>
                                        {[
                                            { label: '予算グループ日額', value: `¥${cfmt(campaignDetail.daily_budget)}`, accent: true },
                                            { label: '実際の配分合計', value: `¥${cfmt(campaignDetail.actual_daily_spend)}` },
                                            { label: '月額見積もり', value: `¥${cfmt(campaignDetail.monthly_estimate)}` },
                                        ].map((s, i) => (
                                            <div key={i} style={{
                                                padding: 'var(--space-sm)', borderRadius: 'var(--radius-md)', textAlign: 'center',
                                                background: s.accent ? 'var(--color-accent)' : 'var(--color-bg)',
                                                border: s.accent ? 'none' : '1px solid var(--color-border)',
                                            }}>
                                                <div style={{ fontSize: 'var(--font-size-xs)', color: s.accent ? 'rgba(255,255,255,.7)' : 'var(--color-text-muted)', marginBottom: 2 }}>{s.label}</div>
                                                <div style={{ fontSize: 'var(--font-size-md)', fontWeight: 700, color: s.accent ? '#fff' : 'var(--color-text)' }}>{s.value}</div>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* 所属求人 */}
                                <div style={{ padding: 'var(--space-lg)' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-sm)' }}>
                                        <h4 style={{ margin: 0, fontSize: 'var(--font-size-sm)' }}>所属求人（{campaignDetail.jobs?.length || 0}件）</h4>
                                        {campaignDetail.status === 'active' && (
                                            <button style={cBtnSm} onClick={onRedistribute}>予算を再配分</button>
                                        )}
                                    </div>

                                    {campaignDetail.jobs?.length > 0 ? (
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                            {campaignDetail.jobs.map(job => (
                                                <div key={job.id} style={{
                                                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                                    padding: 'var(--space-sm) var(--space-md)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', background: 'var(--color-bg)',
                                                }}>
                                                    <div style={{ flex: 1, minWidth: 0 }}>
                                                        <div style={{ fontWeight: 600, fontSize: 'var(--font-size-sm)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{job.title}</div>
                                                        <div style={{ display: 'flex', gap: 'var(--space-md)', fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', marginTop: 2 }}>
                                                            <span>日額 ¥{cfmt(job.daily_budget)}</span>
                                                            <span>閲覧(7日) {job.recent_views_count || 0}</span>
                                                            <span>応募 {job.applications_count || 0}</span>
                                                            <span style={{ color: job.status === 'active' ? '#22c55e' : 'var(--color-text-muted)' }}>
                                                                {job.status === 'active' ? '掲載中' : job.status}
                                                            </span>
                                                        </div>
                                                    </div>
                                                    <button onClick={() => onRemoveJob(job.id)} style={{ ...cBtnSm, background: 'transparent', color: '#ef4444', border: '1px solid #ef4444' }}>除外</button>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--font-size-sm)' }}>求人がまだ追加されていません</p>
                                    )}

                                    {/* 求人追加 */}
                                    {campaignDetail.status !== 'ended' && (
                                        <div style={{ marginTop: 'var(--space-md)', paddingTop: 'var(--space-md)', borderTop: '1px solid var(--color-border)' }}>
                                            <label className="form-label" style={{ fontSize: 'var(--font-size-xs)' }}>求人を追加</label>
                                            <JobCheckboxList
                                                jobs={jobs.filter(j => j.campaign_id !== campaignDetail.id)}
                                                selectedIds={addJobIds}
                                                onToggle={(jobId) => setAddJobIds(ids => ids.includes(jobId) ? ids.filter(id => id !== jobId) : [...ids, jobId])}
                                                emptyText="追加可能な求人がありません"
                                                companyName={companyName}
                                            />
                                            {addJobIds.length > 0 && (
                                                <button className="btn btn-primary" style={{ fontSize: 'var(--font-size-xs)', marginTop: 8 }} onClick={onAddJobs}>{addJobIds.length}件を追加</button>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

/* ============================================
   求人チェックボックスリスト（予算グループ用）
   ============================================ */
const STATUS_LABEL_MAP = { active: '掲載中', draft: '下書き', pending_review: '審査中', suspended: '停止', closed: '終了' };

function JobCheckboxList({ jobs, selectedIds, onToggle, emptyText, companyName }) {
    if (jobs.length === 0) {
        return <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--font-size-xs)', margin: '4px 0' }}>{emptyText}</p>;
    }
    return (
        <div style={{ maxHeight: 260, overflowY: 'auto', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', background: 'var(--color-bg)' }}>
            {/* ヘッダー */}
            <div style={{ display: 'grid', gridTemplateColumns: '32px 1fr 120px 70px 72px 56px', gap: 4, padding: '6px 10px', borderBottom: '1px solid var(--color-border)', fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', fontWeight: 600, position: 'sticky', top: 0, background: 'var(--color-bg-surface)', zIndex: 1 }}>
                <span></span>
                <span>求人名</span>
                <span>企業名</span>
                <span style={{ textAlign: 'right' }}>日額</span>
                <span style={{ textAlign: 'center' }}>ステータス</span>
                <span style={{ textAlign: 'center' }}>応募</span>
            </div>
            {jobs.map(job => {
                const selected = selectedIds.includes(job.id);
                // 人材紹介の場合は紹介先企業名、それ以外は自社名
                const displayCompany = job.agency_client?.client_name || companyName || '';
                return (
                    <div key={job.id} onClick={() => onToggle(job.id)} style={{
                        display: 'grid', gridTemplateColumns: '32px 1fr 120px 70px 72px 56px', gap: 4,
                        padding: '8px 10px', cursor: 'pointer', alignItems: 'center',
                        borderBottom: '1px solid var(--color-border)',
                        background: selected ? 'rgba(200,149,46,0.06)' : 'transparent',
                        transition: 'background 0.1s',
                    }}>
                        <input type="checkbox" checked={selected} onChange={() => {}} style={{ accentColor: 'var(--color-accent)', cursor: 'pointer' }} />
                        <div style={{ minWidth: 0 }}>
                            <div style={{ fontWeight: 500, fontSize: 'var(--font-size-sm)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--color-text)' }}>
                                {job.title}
                            </div>
                            {job.location && (
                                <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                    {job.location}
                                </div>
                            )}
                        </div>
                        <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}>
                            {displayCompany}
                        </div>
                        <div style={{ textAlign: 'right', fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
                            ¥{cfmt(job.daily_budget || 0)}
                        </div>
                        <div style={{ textAlign: 'center' }}>
                            <span style={{
                                fontSize: 'var(--font-size-xs)', padding: '1px 6px', borderRadius: 'var(--radius-full)',
                                background: job.status === 'active' ? '#22c55e18' : 'var(--color-bg-surface)',
                                color: job.status === 'active' ? '#22c55e' : 'var(--color-text-muted)',
                                fontWeight: 500,
                            }}>
                                {STATUS_LABEL_MAP[job.status] || job.status}
                            </span>
                        </div>
                        <div style={{ textAlign: 'center', fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
                            {job.applications_count ?? '-'}
                        </div>
                    </div>
                );
            })}
        </div>
    );
}

/* ============================================
   求人パフォーマンス分析パネル
   ============================================ */
function JobAnalyticsPanel({ analytics, funnel, loading, statusLabel }) {
    if (loading) {
        return <div className="card"><div className="skeleton" style={{ height: 200 }} /></div>;
    }

    if (!analytics || analytics.length === 0) {
        return (
            <div className="card" style={{ textAlign: 'center', padding: 'var(--space-3xl)' }}>
                <div style={{ fontSize: '3rem', marginBottom: 'var(--space-md)' }}>📊</div>
                <h3 style={{ marginBottom: 'var(--space-sm)' }}>分析データがありません</h3>
                <p style={{ color: 'var(--color-text-secondary)' }}>求人を作成して公開すると、パフォーマンスデータが表示されます。</p>
            </div>
        );
    }

    const maxViews = Math.max(...analytics.map(a => a.view_count), 1);
    const maxApps = Math.max(...analytics.map(a => a.application_count), 1);

    // 合計
    const totalViews = analytics.reduce((s, a) => s + a.view_count, 0);
    const totalViews7d = analytics.reduce((s, a) => s + a.view_count_7d, 0);
    const totalApps = analytics.reduce((s, a) => s + a.application_count, 0);
    const totalRate = totalViews > 0 ? ((totalApps / totalViews) * 100).toFixed(1) : '0.0';

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-lg)' }}>
            {/* サマリーカード */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 'var(--space-md)' }}>
                <SummaryCard label="総閲覧数" value={totalViews} sub={`直近7日: ${totalViews7d}`} color="#121c34" />
                <SummaryCard label="総応募数" value={totalApps} color="#10b981" />
                <SummaryCard label="平均応募率" value={`${totalRate}%`} color="#f59e0b" />
                <SummaryCard label="掲載求人数" value={analytics.length} color="#8b5cf6" />
            </div>

            {/* 採用ファネル */}
            {funnel && funnel.length > 0 && (
                <div className="card">
                    <h3 style={{ marginBottom: 'var(--space-md)', fontSize: 'var(--font-size-lg)' }}>採用ファネル</h3>
                    <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', marginBottom: 'var(--space-lg)' }}>
                        閲覧から採用までの各ステージの通過数
                    </p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
                        {(() => {
                            const maxCount = Math.max(...funnel.map(f => f.count), 1);
                            return funnel.map((stage, i) => {
                                const pct = (stage.count / maxCount) * 100;
                                const prevCount = i > 0 ? funnel[i - 1].count : null;
                                const convRate = prevCount && prevCount > 0
                                    ? ((stage.count / prevCount) * 100).toFixed(1)
                                    : null;
                                return (
                                    <div key={stage.stage}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)' }}>
                                                <span style={{ fontWeight: 600, fontSize: 'var(--font-size-sm)' }}>{stage.stage}</span>
                                                {convRate && (
                                                    <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
                                                        ({convRate}% 通過)
                                                    </span>
                                                )}
                                            </div>
                                            <span style={{ fontWeight: 700, fontSize: 'var(--font-size-md)', fontVariantNumeric: 'tabular-nums' }}>
                                                {stage.count.toLocaleString()}
                                            </span>
                                        </div>
                                        <div style={{
                                            width: '100%', background: 'var(--color-bg-surface)',
                                            borderRadius: 'var(--radius-sm)', height: 28, overflow: 'hidden',
                                        }}>
                                            <div style={{
                                                width: `${Math.max(pct, 2)}%`, height: '100%',
                                                background: stage.color, borderRadius: 'var(--radius-sm)',
                                                transition: 'width 0.5s ease',
                                                opacity: 0.85,
                                            }} />
                                        </div>
                                    </div>
                                );
                            });
                        })()}
                    </div>
                </div>
            )}

            {/* 求人別テーブル */}
            <div className="card" style={{ overflowX: 'auto' }}>
                <h3 style={{ marginBottom: 'var(--space-md)', fontSize: 'var(--font-size-lg)' }}>求人別パフォーマンス</h3>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--font-size-sm)' }}>
                    <thead>
                        <tr style={{ borderBottom: '2px solid var(--color-border)', textAlign: 'left' }}>
                            <th style={{ padding: 'var(--space-sm) var(--space-md)', whiteSpace: 'nowrap' }}>求人名</th>
                            <th style={{ padding: 'var(--space-sm) var(--space-md)', whiteSpace: 'nowrap' }}>ステータス</th>
                            <th style={{ padding: 'var(--space-sm) var(--space-md)', whiteSpace: 'nowrap', textAlign: 'right' }}>閲覧数（全期間）</th>
                            <th style={{ padding: 'var(--space-sm) var(--space-md)', whiteSpace: 'nowrap', textAlign: 'right' }}>閲覧数（7日）</th>
                            <th style={{ padding: 'var(--space-sm) var(--space-md)', whiteSpace: 'nowrap', textAlign: 'right' }}>応募数</th>
                            <th style={{ padding: 'var(--space-sm) var(--space-md)', whiteSpace: 'nowrap', textAlign: 'right' }}>応募率</th>
                            <th style={{ padding: 'var(--space-sm) var(--space-md)', minWidth: 180 }}>閲覧 / 応募</th>
                        </tr>
                    </thead>
                    <tbody>
                        {analytics.map(item => {
                            const st = statusLabel[item.status] || { class: 'badge-info', text: item.status };
                            return (
                                <tr key={item.job_id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                                    <td style={{ padding: 'var(--space-sm) var(--space-md)', fontWeight: 600, maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                        {item.title}
                                    </td>
                                    <td style={{ padding: 'var(--space-sm) var(--space-md)' }}>
                                        <span className={`badge ${st.class}`} style={{ fontSize: 'var(--font-size-xs)' }}>{st.text}</span>
                                    </td>
                                    <td style={{ padding: 'var(--space-sm) var(--space-md)', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                                        {item.view_count.toLocaleString()}
                                    </td>
                                    <td style={{ padding: 'var(--space-sm) var(--space-md)', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                                        {item.view_count_7d.toLocaleString()}
                                    </td>
                                    <td style={{ padding: 'var(--space-sm) var(--space-md)', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                                        {item.application_count.toLocaleString()}
                                    </td>
                                    <td style={{ padding: 'var(--space-sm) var(--space-md)', textAlign: 'right', fontWeight: 600, color: item.application_rate >= 5 ? '#10b981' : item.application_rate >= 2 ? '#f59e0b' : 'var(--color-text-secondary)' }}>
                                        {item.application_rate}%
                                    </td>
                                    <td style={{ padding: 'var(--space-sm) var(--space-md)' }}>
                                        <BarComparison viewCount={item.view_count} appCount={item.application_count} maxViews={maxViews} maxApps={maxApps} />
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

function SummaryCard({ label, value, sub, color }) {
    return (
        <div className="card" style={{ textAlign: 'center', padding: 'var(--space-md)', borderTop: `3px solid ${color}` }}>
            <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', marginBottom: 'var(--space-xs)' }}>{label}</div>
            <div style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 700, color }}>{typeof value === 'number' ? value.toLocaleString() : value}</div>
            {sub && <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', marginTop: 'var(--space-xs)' }}>{sub}</div>}
        </div>
    );
}

function BarComparison({ viewCount, appCount, maxViews, maxApps }) {
    const viewPct = maxViews > 0 ? (viewCount / maxViews) * 100 : 0;
    const appPct = maxApps > 0 ? (appCount / maxApps) * 100 : 0;
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-xs)' }}>
                <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', width: 28, textAlign: 'right' }}>閲覧</span>
                <div style={{ flex: 1, background: 'var(--color-bg-surface)', borderRadius: 3, height: 8, overflow: 'hidden' }}>
                    <div style={{ width: `${Math.max(viewPct, 2)}%`, height: '100%', background: '#121c34', borderRadius: 3, transition: 'width 0.3s ease' }} />
                </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-xs)' }}>
                <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', width: 28, textAlign: 'right' }}>応募</span>
                <div style={{ flex: 1, background: 'var(--color-bg-surface)', borderRadius: 3, height: 8, overflow: 'hidden' }}>
                    <div style={{ width: `${Math.max(appPct, 2)}%`, height: '100%', background: '#10b981', borderRadius: 3, transition: 'width 0.3s ease' }} />
                </div>
            </div>
        </div>
    );
}

