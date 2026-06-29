import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import api from '../api';
import ConfirmDialog from '../components/ConfirmDialog';
import { STATUS_LABELS_COMPANY as STATUS_LABELS, STATUS_BADGE_CLASS as STATUS_BADGE } from '../constants/applicationStatus';
import { useToast } from '../hooks/useToast';
import { FileText, Users, Award, CheckCircle, X, MessageSquare, Calendar, MapPin, Link2, Inbox } from 'lucide-react';
const STATUS_FLOW = [
    { value: 'under_review', label: '書類選考中', Icon: FileText },
    { value: 'interviewing', label: '面接中', Icon: Users },
    { value: 'offered', label: '内定', Icon: Award },
    { value: 'hired', label: '採用', Icon: CheckCircle },
    { value: 'rejected', label: '不採用', Icon: X },
];
const REJECTION_REASON_OPTIONS = [
    { value: '', label: '-- 理由を選択 --' },
    { value: 'experience_mismatch', label: '経験不一致' },
    { value: 'skill_mismatch', label: 'スキル不一致' },
    { value: 'salary_mismatch', label: '希望条件不一致' },
    { value: 'position_filled', label: '募集終了' },
    { value: 'other', label: 'その他' },
];
const REJECTION_REASON_LABELS = {
    experience_mismatch: '経験不一致',
    skill_mismatch: 'スキル不一致',
    salary_mismatch: '希望条件不一致',
    position_filled: '募集終了',
    other: 'その他',
};

export default function CompanyApplicationsPage() {
    const { jobId } = useParams();
    const navigate = useNavigate();
    const [job, setJob] = useState(null);
    const [applications, setApplications] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedApp, setSelectedApp] = useState(null);
    const [filter, setFilter] = useState('all');
    const [updating, setUpdating] = useState(false);
    const [checkedIds, setCheckedIds] = useState(new Set());
    const [bulkStatus, setBulkStatus] = useState('');
    const [bulkUpdating, setBulkUpdating] = useState(false);
    const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
    const toast = useToast();

    useEffect(() => {
        const handleResize = () => setIsMobile(window.innerWidth < 768);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);
    const [confirmDialog, setConfirmDialog] = useState(null);
    const [showInterviewForm, setShowInterviewForm] = useState(false);
    const [interviewData, setInterviewData] = useState({ scheduled_at: '', location: '', meeting_url: '', notes: '' });
    const [interviewSubmitting, setInterviewSubmitting] = useState(false);
    const [interviews, setInterviews] = useState([]);
    const [showRejectionForm, setShowRejectionForm] = useState(false);
    const [rejectionData, setRejectionData] = useState({ rejection_reason: '', rejection_feedback: '' });

    useEffect(() => {
        Promise.all([
            api.get(`/jobs/${jobId}`),
            api.get(`/jobs/${jobId}/applications`),
        ]).then(([jobRes, appRes]) => {
            setJob(jobRes.data);
            setApplications(appRes.data);
            if (appRes.data.length > 0) setSelectedApp(appRes.data[0]);
        }).catch(() => navigate('/company/jobs'))
          .finally(() => setLoading(false));
    }, [jobId]);

    // 面接日程機能はMVP期間中は無効（面接調整はメッセージで行う）。無効APIは呼ばない。
    useEffect(() => {
        setInterviews([]);
        setShowInterviewForm(false);
        setInterviewData({ scheduled_at: '', location: '', meeting_url: '', notes: '' });
    }, [selectedApp?.id]);

    const handleCreateInterview = async () => {
        if (!selectedApp || !interviewData.scheduled_at) return;
        setInterviewSubmitting(true);
        try {
            const res = await api.post(`/applications/${selectedApp.id}/schedules`, interviewData);
            setInterviews(prev => [...prev, res.data.schedule]);
            setShowInterviewForm(false);
            setInterviewData({ scheduled_at: '', location: '', meeting_url: '', notes: '' });
            toast.success('面接日程を設定しました');
        } catch (err) {
            toast.error(err.response?.data?.message || '面接日程の設定に失敗しました');
        } finally {
            setInterviewSubmitting(false);
        }
    };

    const handleCancelInterview = async (scheduleId) => {
        try {
            await api.put(`/schedules/${scheduleId}`, { status: 'cancelled' });
            setInterviews(prev => prev.map(s => s.id === scheduleId ? { ...s, status: 'cancelled' } : s));
            toast.success('面接をキャンセルしました');
        } catch (err) {
            toast.error('キャンセルに失敗しました');
        }
    };

    const handleStatusChange = async (appId, newStatus) => {
        if (newStatus === 'rejected') {
            setShowRejectionForm(true);
            setRejectionData({ rejection_reason: '', rejection_feedback: '' });
            return;
        }
        setUpdating(true);
        try {
            const res = await api.put(`/applications/${appId}/status`, { status: newStatus });
            setApplications(applications.map(a => a.id === appId ? res.data : a));
            if (selectedApp?.id === appId) setSelectedApp(res.data);
        } catch (err) {
            toast.error(err.response?.data?.message || 'ステータス更新に失敗しました');
        } finally {
            setUpdating(false);
        }
    };

    const handleRejectSubmit = async () => {
        if (!selectedApp) return;
        setUpdating(true);
        try {
            const res = await api.put(`/applications/${selectedApp.id}/status`, {
                status: 'rejected',
                rejection_reason: rejectionData.rejection_reason || null,
                rejection_feedback: rejectionData.rejection_feedback || null,
            });
            setApplications(applications.map(a => a.id === selectedApp.id ? res.data : a));
            setSelectedApp(res.data);
            setShowRejectionForm(false);
            setRejectionData({ rejection_reason: '', rejection_feedback: '' });
            toast.success('不採用通知を送信しました');
        } catch (err) {
            toast.error(err.response?.data?.message || 'ステータス更新に失敗しました');
        } finally {
            setUpdating(false);
        }
    };

    const toggleCheck = (id, e) => {
        e.stopPropagation();
        setCheckedIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const toggleAll = () => {
        if (checkedIds.size === filtered.length) {
            setCheckedIds(new Set());
        } else {
            setCheckedIds(new Set(filtered.map(a => a.id)));
        }
    };

    const handleBulkUpdate = () => {
        if (!bulkStatus || checkedIds.size === 0) return;
        setConfirmDialog({
            title: '一括ステータス変更',
            message: `${checkedIds.size}件の応募ステータスを「${STATUS_LABELS[bulkStatus]}」に変更しますか？`,
            onConfirm: async () => {
                setConfirmDialog(null);
                setBulkUpdating(true);
                try {
                    const res = await api.put('/applications/bulk-status', {
                        application_ids: Array.from(checkedIds),
                        status: bulkStatus,
                    });
                    setApplications(prev => prev.map(a =>
                        checkedIds.has(a.id) ? { ...a, status: bulkStatus } : a
                    ));
                    if (selectedApp && checkedIds.has(selectedApp.id)) {
                        setSelectedApp(prev => ({ ...prev, status: bulkStatus }));
                    }
                    setCheckedIds(new Set());
                    setBulkStatus('');
                    toast.success(res.data.message);
                } catch (err) {
                    toast.error(err.response?.data?.message || '一括更新に失敗しました');
                } finally {
                    setBulkUpdating(false);
                }
            },
            onCancel: () => setConfirmDialog(null),
        });
    };

    const filtered = filter === 'all'
        ? applications
        : applications.filter(a => a.status === filter);

    const counts = {};
    applications.forEach(a => { counts[a.status] = (counts[a.status] || 0) + 1; });

    if (loading) return <div className="page container"><div className="skeleton" style={{ height: 400 }} /></div>;

    return (
        <div className="page container animate-fade-in">
            {/* ヘッダー */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-md)', marginBottom: 'var(--space-lg)' }}>
                <button className="btn btn-secondary" onClick={() => navigate('/company/jobs')} style={{ fontSize: 'var(--font-size-sm)' }}>← 求人管理</button>
                <div>
                    <h1 style={{ fontSize: 'var(--font-size-2xl)', margin: 0 }}>応募者管理</h1>
                    {job && <p style={{ margin: 0, color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-sm)' }}>{job.title}</p>}
                </div>
                <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 'var(--space-sm)' }}>
                    <span className="badge badge-info">
                        {applications.length}件の応募
                    </span>
                    {applications.length > 0 && (
                        <button
                            className="btn btn-secondary"
                            style={{ fontSize: 'var(--font-size-xs)' }}
                            onClick={async () => {
                                try {
                                    const res = await api.get(`/jobs/${jobId}/applications-csv`, { responseType: 'blob' });
                                    const url = window.URL.createObjectURL(new Blob([res.data]));
                                    const a = document.createElement('a');
                                    a.href = url;
                                    a.download = `applications_${jobId}.csv`;
                                    a.click();
                                    window.URL.revokeObjectURL(url);
                                } catch {
                                    toast.error('CSVエクスポートに失敗しました');
                                }
                            }}
                        >
                            CSV出力
                        </button>
                    )}
                </div>
            </div>

            {/* ステージパイプライン */}
            {applications.length > 0 && (
                <div style={{
                    display: 'flex',
                    gap: 2,
                    marginBottom: 'var(--space-lg)',
                    background: 'var(--color-bg-surface)',
                    borderRadius: 'var(--radius-lg)',
                    padding: 'var(--space-md)',
                    border: '1px solid var(--color-border)',
                    overflowX: 'auto',
                }}>
                    {STATUS_FLOW.map((stage, idx) => {
                        const count = counts[stage.value] || 0;
                        const isActive = filter === stage.value;
                        const total = applications.length;
                        const pct = total > 0 ? Math.round((count / total) * 100) : 0;
                        return (
                            <button key={stage.value} onClick={() => setFilter(isActive ? 'all' : stage.value)} style={{
                                flex: 1, minWidth: 80, padding: 'var(--space-sm)',
                                borderRadius: 'var(--radius-md)',
                                border: isActive ? '1.5px solid var(--color-navy)' : '2px solid transparent',
                                background: isActive ? 'rgba(18,28,52,0.05)' : 'transparent',
                                cursor: 'pointer',
                                textAlign: 'center',
                                transition: 'all 0.15s',
                            }}>
                                <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 4 }}>
                                    <stage.Icon size={18} strokeWidth={2} color={isActive ? 'var(--color-navy)' : 'var(--color-text-accent)'} />
                                </div>
                                <div style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600, color: isActive ? 'var(--color-navy)' : 'var(--color-text-primary)', marginBottom: 2 }}>
                                    {stage.label}
                                </div>
                                <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
                                    {count}名
                                </div>
                                {count > 0 && (
                                    <div style={{ marginTop: 4, height: 3, borderRadius: 99, background: 'var(--color-border)', overflow: 'hidden' }}>
                                        <div style={{ height: '100%', width: `${pct}%`, background: 'var(--color-accent)', borderRadius: 99 }} />
                                    </div>
                                )}
                            </button>
                        );
                    })}
                </div>
            )}

            {applications.length === 0 ? (
                <div className="card" style={{ textAlign: 'center', padding: 'var(--space-3xl)' }}>
                    <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 'var(--space-md)' }}>
                        <Inbox size={48} strokeWidth={1.5} color="var(--color-text-accent)" />
                    </div>
                    <h3 style={{ marginBottom: 'var(--space-sm)' }}>まだ応募がありません</h3>
                    <p style={{ color: 'var(--color-text-secondary)' }}>
                        求人が公開されると応募者がここに表示されます
                    </p>
                </div>
            ) : (
                <>
                    {/* フィルターバー */}
                    <div style={{
                        display: 'flex', gap: 'var(--space-xs)', flexWrap: 'wrap',
                        marginBottom: 'var(--space-lg)', overflowX: 'auto',
                    }}>
                        <button className={`btn ${filter === 'all' ? 'btn-primary' : 'btn-secondary'}`}
                            style={{ fontSize: 'var(--font-size-xs)' }}
                            onClick={() => setFilter('all')}>
                            全て ({applications.length})
                        </button>
                        {Object.entries(counts).map(([status, count]) => (
                            <button key={status}
                                className={`btn ${filter === status ? 'btn-primary' : 'btn-secondary'}`}
                                style={{ fontSize: 'var(--font-size-xs)' }}
                                onClick={() => setFilter(status)}>
                                {STATUS_LABELS[status] || status} ({count})
                            </button>
                        ))}
                    </div>

                    {/* 2カラムレイアウト */}
                    <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '340px 1fr', gap: 'var(--space-lg)', alignItems: 'start' }}>

                        {/* 応募者リスト */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)', maxHeight: '75vh', overflowY: 'auto' }}>
                            {/* 全選択ヘッダー */}
                            <div style={{
                                display: 'flex', alignItems: 'center', gap: 'var(--space-sm)',
                                padding: 'var(--space-xs) var(--space-md)',
                                fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)',
                            }}>
                                <input
                                    type="checkbox"
                                    checked={filtered.length > 0 && checkedIds.size === filtered.length}
                                    onChange={toggleAll}
                                    style={{ cursor: 'pointer', accentColor: 'var(--color-accent)' }}
                                />
                                <span>全選択</span>
                                {checkedIds.size > 0 && (
                                    <span style={{ marginLeft: 'auto', fontWeight: 600, color: 'var(--color-accent)' }}>
                                        {checkedIds.size}件選択中
                                    </span>
                                )}
                            </div>
                            {filtered.map(app => (
                                <div key={app.id}
                                    onClick={() => setSelectedApp(app)}
                                    style={{
                                        padding: 'var(--space-md)',
                                        borderRadius: 'var(--radius-lg)',
                                        border: selectedApp?.id === app.id ? '1.5px solid var(--color-navy)' : '1px solid var(--color-border)',
                                        background: selectedApp?.id === app.id ? 'rgba(18,28,52,0.06)' : 'var(--color-bg-surface)',
                                        cursor: 'pointer',
                                        display: 'flex', alignItems: 'flex-start', gap: 'var(--space-sm)',
                                    }}>
                                    <input
                                        type="checkbox"
                                        checked={checkedIds.has(app.id)}
                                        onChange={(e) => toggleCheck(app.id, e)}
                                        onClick={(e) => e.stopPropagation()}
                                        style={{ marginTop: 3, cursor: 'pointer', flexShrink: 0, accentColor: 'var(--color-accent)' }}
                                    />
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-xs)' }}>
                                            <span style={{ fontWeight: 600, fontSize: 'var(--font-size-sm)' }}>
                                                {app.user?.name || '応募者'}
                                            </span>
                                            <span className={`badge ${STATUS_BADGE[app.status]}`} style={{ fontSize: 10 }}>
                                                {STATUS_LABELS[app.status]}
                                            </span>
                                        </div>
                                        <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
                                            {app.type === 'scout' && <span className="badge badge-warning" style={{ fontSize: 9, marginRight: 4 }}>スカウト</span>}
                                            応募日: {new Date(app.created_at).toLocaleDateString('ja-JP')}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* 応募者詳細 */}
                        {selectedApp ? (
                            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                                {/* ヘッダー */}
                                <div style={{
                                    padding: 'var(--space-lg) var(--space-xl)',
                                    borderBottom: '1px solid var(--color-border)',
                                    background: 'var(--color-bg-secondary)',
                                }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                        <div>
                                            <h2 style={{ fontSize: 'var(--font-size-xl)', margin: 0 }}>
                                                {selectedApp.user?.name || '応募者'}
                                            </h2>
                                            <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--font-size-sm)', margin: 0 }}>
                                                {selectedApp.user?.email}
                                            </p>
                                        </div>
                                        <span className={`badge ${STATUS_BADGE[selectedApp.status]}`}>
                                            {STATUS_LABELS[selectedApp.status]}
                                        </span>
                                    </div>
                                </div>

                                {/* ステータス変更 */}
                                <div style={{
                                    padding: 'var(--space-md) var(--space-xl)',
                                    borderBottom: '1px solid var(--color-border)',
                                    display: 'flex', gap: 'var(--space-xs)', flexWrap: 'wrap', alignItems: 'center',
                                }}>
                                    <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', marginRight: 'var(--space-sm)' }}>
                                        選考ステータス:
                                    </span>
                                    {STATUS_FLOW.map(s => (
                                        <button key={s.value}
                                            className={`btn ${selectedApp.status === s.value ? 'btn-primary' : 'btn-secondary'}`}
                                            style={{ fontSize: 'var(--font-size-xs)', padding: '4px 10px', display: 'inline-flex', alignItems: 'center', gap: 6 }}
                                            disabled={updating || selectedApp.status === s.value}
                                            onClick={() => handleStatusChange(selectedApp.id, s.value)}>
                                            <s.Icon size={14} strokeWidth={2} /> {s.label}
                                        </button>
                                    ))}
                                </div>

                                {/* 不採用理由フォーム */}
                                {showRejectionForm && (
                                    <div style={{
                                        padding: 'var(--space-lg) var(--space-xl)',
                                        borderBottom: '1px solid var(--color-border)',
                                        background: 'rgba(239,68,68,0.04)',
                                    }}>
                                        <h4 style={{ fontSize: 'var(--font-size-sm)', fontWeight: 600, marginBottom: 'var(--space-md)', color: 'var(--color-danger)' }}>
                                            不採用通知
                                        </h4>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
                                            <div>
                                                <label style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', display: 'block', marginBottom: 4 }}>
                                                    不採用の理由
                                                </label>
                                                <select
                                                    value={rejectionData.rejection_reason}
                                                    onChange={e => setRejectionData({ ...rejectionData, rejection_reason: e.target.value })}
                                                    style={{
                                                        width: '100%', padding: '8px 12px', borderRadius: 'var(--radius-md)',
                                                        border: '1px solid var(--color-border)', fontSize: 'var(--font-size-sm)',
                                                        background: 'var(--color-bg-surface)', color: 'var(--color-text-primary)',
                                                    }}
                                                >
                                                    {REJECTION_REASON_OPTIONS.map(opt => (
                                                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                                                    ))}
                                                </select>
                                            </div>
                                            <div>
                                                <label style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', display: 'block', marginBottom: 4 }}>
                                                    求職者へのフィードバック（任意）
                                                </label>
                                                <textarea
                                                    placeholder="求職者に表示されるフィードバックを入力してください"
                                                    value={rejectionData.rejection_feedback}
                                                    onChange={e => setRejectionData({ ...rejectionData, rejection_feedback: e.target.value })}
                                                    rows={4}
                                                    style={{
                                                        width: '100%', padding: '8px 12px', borderRadius: 'var(--radius-md)',
                                                        border: '1px solid var(--color-border)', fontSize: 'var(--font-size-sm)',
                                                        resize: 'vertical',
                                                        background: 'var(--color-bg-surface)', color: 'var(--color-text-primary)',
                                                    }}
                                                />
                                            </div>
                                            <div style={{ display: 'flex', gap: 'var(--space-sm)', marginTop: 'var(--space-xs)' }}>
                                                <button
                                                    className="btn btn-danger"
                                                    style={{ fontSize: 'var(--font-size-sm)' }}
                                                    disabled={updating}
                                                    onClick={handleRejectSubmit}
                                                >
                                                    {updating ? '送信中...' : '不採用を確定する'}
                                                </button>
                                                <button
                                                    className="btn btn-secondary"
                                                    style={{ fontSize: 'var(--font-size-sm)' }}
                                                    onClick={() => setShowRejectionForm(false)}
                                                >
                                                    キャンセル
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* アクション */}
                                <div style={{
                                    padding: 'var(--space-md) var(--space-xl)',
                                    borderBottom: '1px solid var(--color-border)',
                                    display: 'flex', gap: 'var(--space-sm)',
                                }}>
                                    <Link to={`/messages/${selectedApp.id}`} className="btn btn-primary" style={{ fontSize: 'var(--font-size-sm)', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                                        <MessageSquare size={16} strokeWidth={2} /> メッセージを送る
                                    </Link>
                                    {selectedApp.status === 'interviewing' && (
                                        <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', alignSelf: 'center' }}>
                                            面接の日程調整はメッセージでやり取りできます
                                        </span>
                                    )}
                                </div>

                                {/* 面接設定フォーム */}
                                {showInterviewForm && selectedApp.status === 'interviewing' && (
                                    <div style={{
                                        padding: 'var(--space-lg) var(--space-xl)',
                                        borderBottom: '1px solid var(--color-border)',
                                        background: 'rgba(18,28,52,0.03)',
                                    }}>
                                        <h4 style={{ fontSize: 'var(--font-size-sm)', fontWeight: 600, marginBottom: 'var(--space-md)' }}>
                                            面接日程を設定
                                        </h4>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
                                            <div>
                                                <label style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', display: 'block', marginBottom: 4 }}>
                                                    日時 <span style={{ color: 'var(--color-danger)' }}>*</span>
                                                </label>
                                                <input
                                                    type="datetime-local"
                                                    value={interviewData.scheduled_at}
                                                    onChange={e => setInterviewData({ ...interviewData, scheduled_at: e.target.value })}
                                                    style={{
                                                        width: '100%', padding: '8px 12px', borderRadius: 'var(--radius-md)',
                                                        border: '1px solid var(--color-border)', fontSize: 'var(--font-size-sm)',
                                                        background: 'var(--color-bg-surface)', color: 'var(--color-text-primary)',
                                                    }}
                                                />
                                            </div>
                                            <div>
                                                <label style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', display: 'block', marginBottom: 4 }}>
                                                    場所（対面の場合）
                                                </label>
                                                <input
                                                    type="text"
                                                    placeholder="例: 東京都渋谷区..."
                                                    value={interviewData.location}
                                                    onChange={e => setInterviewData({ ...interviewData, location: e.target.value })}
                                                    style={{
                                                        width: '100%', padding: '8px 12px', borderRadius: 'var(--radius-md)',
                                                        border: '1px solid var(--color-border)', fontSize: 'var(--font-size-sm)',
                                                        background: 'var(--color-bg-surface)', color: 'var(--color-text-primary)',
                                                    }}
                                                />
                                            </div>
                                            <div>
                                                <label style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', display: 'block', marginBottom: 4 }}>
                                                    会議URL（オンラインの場合）
                                                </label>
                                                <input
                                                    type="url"
                                                    placeholder="例: https://zoom.us/j/..."
                                                    value={interviewData.meeting_url}
                                                    onChange={e => setInterviewData({ ...interviewData, meeting_url: e.target.value })}
                                                    style={{
                                                        width: '100%', padding: '8px 12px', borderRadius: 'var(--radius-md)',
                                                        border: '1px solid var(--color-border)', fontSize: 'var(--font-size-sm)',
                                                        background: 'var(--color-bg-surface)', color: 'var(--color-text-primary)',
                                                    }}
                                                />
                                            </div>
                                            <div>
                                                <label style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', display: 'block', marginBottom: 4 }}>
                                                    備考
                                                </label>
                                                <textarea
                                                    placeholder="面接に関する備考・注意事項など"
                                                    value={interviewData.notes}
                                                    onChange={e => setInterviewData({ ...interviewData, notes: e.target.value })}
                                                    rows={3}
                                                    style={{
                                                        width: '100%', padding: '8px 12px', borderRadius: 'var(--radius-md)',
                                                        border: '1px solid var(--color-border)', fontSize: 'var(--font-size-sm)',
                                                        resize: 'vertical',
                                                        background: 'var(--color-bg-surface)', color: 'var(--color-text-primary)',
                                                    }}
                                                />
                                            </div>
                                            <div style={{ display: 'flex', gap: 'var(--space-sm)', marginTop: 'var(--space-xs)' }}>
                                                <button
                                                    className="btn btn-primary"
                                                    style={{ fontSize: 'var(--font-size-sm)' }}
                                                    disabled={!interviewData.scheduled_at || interviewSubmitting}
                                                    onClick={handleCreateInterview}
                                                >
                                                    {interviewSubmitting ? '送信中...' : '日程を設定'}
                                                </button>
                                                <button
                                                    className="btn btn-secondary"
                                                    style={{ fontSize: 'var(--font-size-sm)' }}
                                                    onClick={() => setShowInterviewForm(false)}
                                                >
                                                    キャンセル
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* 面接日程一覧 */}
                                {interviews.length > 0 && (
                                    <div style={{
                                        padding: 'var(--space-lg) var(--space-xl)',
                                        borderBottom: '1px solid var(--color-border)',
                                    }}>
                                        <h4 style={{ fontSize: 'var(--font-size-sm)', fontWeight: 600, marginBottom: 'var(--space-md)', display: 'flex', alignItems: 'center', gap: 8, color: 'var(--color-navy)' }}>
                                            <span style={{ width: 3, height: 14, background: 'var(--color-accent)', borderRadius: 2, flexShrink: 0 }} />
                                            面接日程
                                        </h4>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
                                            {interviews.map(iv => (
                                                <div key={iv.id} style={{
                                                    padding: 'var(--space-md)',
                                                    borderRadius: 'var(--radius-md)',
                                                    border: '1px solid var(--color-border)',
                                                    background: iv.status === 'cancelled' ? 'rgba(239,68,68,0.04)' : 'var(--color-bg-surface)',
                                                    opacity: iv.status === 'cancelled' ? 0.6 : 1,
                                                }}>
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-xs)' }}>
                                                        <span style={{ fontWeight: 600, fontSize: 'var(--font-size-sm)' }}>
                                                            {new Date(iv.scheduled_at).toLocaleString('ja-JP', {
                                                                year: 'numeric', month: '2-digit', day: '2-digit',
                                                                hour: '2-digit', minute: '2-digit',
                                                            })}
                                                        </span>
                                                        <span className={`badge ${
                                                            iv.status === 'confirmed' ? 'badge-success' :
                                                            iv.status === 'cancelled' ? 'badge-danger' :
                                                            iv.status === 'completed' ? 'badge-info' :
                                                            'badge-warning'
                                                        }`} style={{ fontSize: 10 }}>
                                                            {iv.status === 'pending' ? '未確認' :
                                                             iv.status === 'confirmed' ? '確認済み' :
                                                             iv.status === 'cancelled' ? 'キャンセル' :
                                                             iv.status === 'completed' ? '完了' : iv.status}
                                                        </span>
                                                    </div>
                                                    {iv.location && (
                                                        <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', marginBottom: 2, display: 'flex', alignItems: 'center', gap: 6 }}>
                                                            <MapPin size={14} strokeWidth={2} style={{ opacity: 0.5, flexShrink: 0 }} /> {iv.location}
                                                        </div>
                                                    )}
                                                    {iv.meeting_url && (
                                                        <div style={{ fontSize: 'var(--font-size-xs)', marginBottom: 2, display: 'flex', alignItems: 'center', gap: 6 }}>
                                                            <Link2 size={14} strokeWidth={2} style={{ color: 'var(--color-text-accent)', flexShrink: 0 }} /> <a href={iv.meeting_url} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--color-accent)' }}>
                                                                会議URLを開く
                                                            </a>
                                                        </div>
                                                    )}
                                                    {iv.notes && (
                                                        <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', marginTop: 4 }}>
                                                            {iv.notes}
                                                        </div>
                                                    )}
                                                    <div style={{ display: 'flex', gap: 'var(--space-xs)', marginTop: 'var(--space-xs)' }}>
                                                        {iv.status !== 'cancelled' && (
                                                            <button
                                                                className="btn btn-secondary"
                                                                style={{ fontSize: 'var(--font-size-xs)', padding: '2px 8px', display: 'inline-flex', alignItems: 'center', gap: 6 }}
                                                                onClick={async () => {
                                                                    try {
                                                                        const res = await api.get(`/schedules/${iv.id}/ical`, { responseType: 'blob' });
                                                                        const url = window.URL.createObjectURL(new Blob([res.data]));
                                                                        const a = document.createElement('a');
                                                                        a.href = url;
                                                                        a.download = `interview_${iv.id}.ics`;
                                                                        a.click();
                                                                        window.URL.revokeObjectURL(url);
                                                                    } catch { /* ignore */ }
                                                                }}
                                                            >
                                                                <Calendar size={14} strokeWidth={2} /> カレンダーに追加
                                                            </button>
                                                        )}
                                                        {iv.status === 'pending' && (
                                                            <button
                                                                className="btn btn-danger"
                                                                style={{ fontSize: 'var(--font-size-xs)', padding: '2px 8px' }}
                                                                onClick={() => handleCancelInterview(iv.id)}
                                                            >
                                                                キャンセル
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* カバーレター */}
                                {selectedApp.cover_letter && (
                                    <div style={{
                                        padding: 'var(--space-lg) var(--space-xl)',
                                        borderBottom: '1px solid var(--color-border)',
                                    }}>
                                        <h4 style={{ fontSize: 'var(--font-size-sm)', fontWeight: 600, marginBottom: 'var(--space-sm)', display: 'flex', alignItems: 'center', gap: 8, color: 'var(--color-navy)' }}>
                                            <span style={{ width: 3, height: 14, background: 'var(--color-accent)', borderRadius: 2, flexShrink: 0 }} />
                                            志望動機・カバーレター
                                        </h4>
                                        <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', whiteSpace: 'pre-wrap', lineHeight: 1.8 }}>
                                            {selectedApp.cover_letter}
                                        </p>
                                    </div>
                                )}

                                {/* 履歴書スナップショット */}
                                <div style={{ padding: 'var(--space-xl)' }}>
                                    {selectedApp.resume_snapshot ? (
                                        <>
                                            <h3 style={{ fontSize: 'var(--font-size-base)', fontWeight: 700, marginBottom: 'var(--space-lg)', paddingBottom: 'var(--space-xs)', borderBottom: '1px solid var(--color-border)', display: 'flex', alignItems: 'center', gap: 8, color: 'var(--color-navy)' }}>
                                                <span style={{ width: 3, height: 16, background: 'var(--color-accent)', borderRadius: 2, flexShrink: 0 }} />
                                                提出書類
                                            </h3>

                                            {/* プロフィール情報 */}
                                            {selectedApp.resume_snapshot.profile && (() => {
                                                const p = selectedApp.resume_snapshot.profile;
                                                return (
                                                    <div style={{ marginBottom: 'var(--space-xl)' }}>
                                                        <h4 style={{ fontSize: 'var(--font-size-sm)', fontWeight: 600, marginBottom: 'var(--space-sm)', color: 'var(--color-text-muted)' }}>基本情報</h4>
                                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-xs)' }}>
                                                            {p.address && <InfoRow label="住所" value={p.address} />}
                                                            {p.phone && <InfoRow label="電話" value={p.phone} />}
                                                            {p.birth_date && <InfoRow label="生年月日" value={p.birth_date} />}
                                                            {p.gender && <InfoRow label="性別" value={p.gender} />}
                                                        </div>
                                                        {p.skills?.length > 0 && (
                                                            <div style={{ marginTop: 'var(--space-sm)' }}>
                                                                <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', fontWeight: 600 }}>スキル: </span>
                                                                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 4 }}>
                                                                    {p.skills.map((s, i) => (
                                                                        <span key={i} className="badge badge-info" style={{ fontSize: 10 }}>{s}</span>
                                                                    ))}
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            })()}

                                            {/* 履歴書内容 */}
                                            {selectedApp.resume_snapshot.resume && (() => {
                                                const r = selectedApp.resume_snapshot.resume;
                                                return (
                                                    <div>
                                                        <h4 style={{ fontSize: 'var(--font-size-sm)', fontWeight: 600, marginBottom: 'var(--space-sm)', color: 'var(--color-text-muted)' }}>
                                                            {r.title || '履歴書'}
                                                        </h4>

                                                        {r.summary && (
                                                            <div style={{ marginBottom: 'var(--space-md)' }}>
                                                                <p style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: 4 }}>自己PR</p>
                                                                <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', whiteSpace: 'pre-wrap', lineHeight: 1.7 }}>
                                                                    {r.summary}
                                                                </p>
                                                            </div>
                                                        )}

                                                        {r.work_history && (
                                                            <div style={{ marginBottom: 'var(--space-md)' }}>
                                                                <p style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: 4 }}>職歴</p>
                                                                <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', whiteSpace: 'pre-wrap', lineHeight: 1.7 }}>
                                                                    {typeof r.work_history === 'string' ? r.work_history : JSON.stringify(r.work_history, null, 2)}
                                                                </p>
                                                            </div>
                                                        )}

                                                        {r.education && (
                                                            <div style={{ marginBottom: 'var(--space-md)' }}>
                                                                <p style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: 4 }}>学歴</p>
                                                                <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', whiteSpace: 'pre-wrap', lineHeight: 1.7 }}>
                                                                    {typeof r.education === 'string' ? r.education : JSON.stringify(r.education, null, 2)}
                                                                </p>
                                                            </div>
                                                        )}

                                                        {r.certifications && (
                                                            <div>
                                                                <p style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: 4 }}>資格</p>
                                                                <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', whiteSpace: 'pre-wrap', lineHeight: 1.7 }}>
                                                                    {typeof r.certifications === 'string' ? r.certifications : JSON.stringify(r.certifications, null, 2)}
                                                                </p>
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            })()}
                                        </>
                                    ) : (
                                        <div style={{ textAlign: 'center', padding: 'var(--space-xl)', color: 'var(--color-text-muted)' }}>
                                            {selectedApp.type === 'scout' && selectedApp.status === 'pending'
                                                ? 'スカウト未承諾のため、履歴書はまだ提出されていません'
                                                : '履歴書データがありません'}
                                        </div>
                                    )}
                                </div>
                            </div>
                        ) : (
                            <div className="card" style={{ textAlign: 'center', padding: 'var(--space-3xl)', color: 'var(--color-text-muted)' }}>
                                左のリストから応募者を選択してください
                            </div>
                        )}
                    </div>

                    {/* 一括操作バー */}
                    {checkedIds.size > 0 && (
                        <div style={{
                            position: 'fixed', bottom: 'var(--space-lg)', left: '50%', transform: 'translateX(-50%)',
                            background: 'var(--color-bg-surface)', border: '1px solid var(--color-border)',
                            borderRadius: 'var(--radius-xl)', padding: 'var(--space-sm) var(--space-lg)',
                            display: 'flex', alignItems: 'center', gap: 'var(--space-md)',
                            boxShadow: '0 8px 32px rgba(0,0,0,0.18)', zIndex: 1000,
                        }}>
                            <span style={{ fontWeight: 600, fontSize: 'var(--font-size-sm)', whiteSpace: 'nowrap' }}>
                                {checkedIds.size}件選択中
                            </span>
                            <select
                                value={bulkStatus}
                                onChange={e => setBulkStatus(e.target.value)}
                                style={{
                                    padding: '6px 10px', borderRadius: 'var(--radius-md)',
                                    border: '1px solid var(--color-border)', fontSize: 'var(--font-size-sm)',
                                    background: 'var(--color-bg-surface)', color: 'var(--color-text-primary)',
                                }}
                            >
                                <option value="">ステータス変更</option>
                                {STATUS_FLOW.map(s => (
                                    <option key={s.value} value={s.value}>{s.label}</option>
                                ))}
                            </select>
                            <button
                                className="btn btn-primary"
                                style={{ fontSize: 'var(--font-size-sm)', padding: '6px 16px' }}
                                disabled={!bulkStatus || bulkUpdating}
                                onClick={handleBulkUpdate}
                            >
                                {bulkUpdating ? '処理中...' : '一括変更'}
                            </button>
                            <button
                                className="btn btn-secondary"
                                style={{ fontSize: 'var(--font-size-xs)', padding: '6px 10px' }}
                                onClick={() => { setCheckedIds(new Set()); setBulkStatus(''); }}
                            >
                                解除
                            </button>
                        </div>
                    )}
                </>
            )}

            {confirmDialog && <ConfirmDialog {...confirmDialog} />}
        </div>
    );
}

function InfoRow({ label, value }) {
    if (!value) return null;
    return (
        <div style={{ padding: '4px 0' }}>
            <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>{label}: </span>
            <span style={{ fontSize: 'var(--font-size-sm)' }}>{value}</span>
        </div>
    );
}
