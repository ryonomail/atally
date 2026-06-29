import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../api';
import { useToast } from '../hooks/useToast';
import { STATUS_LABELS, STATUS_BADGE_CLASS as STATUS_BADGE, STATUS_COLORS as STATUS_DOT_COLOR } from '../constants/applicationStatus';
import { ClipboardList, Bell, MessageSquare, Calendar, MapPin, Link2 } from 'lucide-react';

const REJECTION_REASON_LABELS = {
    experience_mismatch: '経験不一致',
    skill_mismatch: 'スキル不一致',
    salary_mismatch: '希望条件不一致',
    position_filled: '募集終了',
    other: 'その他',
};

// 標準フロー参照
const STANDARD_FLOW = ['pending', 'under_review', 'interviewing', 'offered'];
const STANDARD_FLOW_LABELS = {
    pending: '応募',
    under_review: '書類選考',
    interviewing: '面接',
    offered: '内定 / 不採用',
};

function ApplicationTimeline({ application, onClose }) {
    const [timeline, setTimeline] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        api.get(`/applications/${application.id}/timeline`)
            .then(res => {
                let data = res.data;
                // 履歴が空の場合、応募日を「応募」として表示
                if (data.length === 0) {
                    data = [{
                        id: 'initial',
                        status: 'pending',
                        changed_at: application.created_at,
                        note: '応募しました',
                    }];
                }
                setTimeline(data);
            })
            .catch(() => {
                // フォールバック: 応募日のみ表示
                setTimeline([{
                    id: 'initial',
                    status: 'pending',
                    changed_at: application.created_at,
                    note: '応募しました',
                }]);
            })
            .finally(() => setLoading(false));
    }, [application.id]);

    // 現在到達しているステータス一覧
    const reachedStatuses = new Set(timeline.map(t => t.status));

    return (
        <div style={{
            marginTop: 'var(--space-md)', padding: 'var(--space-lg)',
            background: 'var(--color-bg-surface)', borderRadius: 'var(--radius-md)',
            border: '1px solid var(--color-border)',
        }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-lg)' }}>
                <h4 style={{ margin: 0, fontSize: 'var(--font-size-md)' }}>選考タイムライン</h4>
                <button
                    onClick={onClose}
                    style={{
                        background: 'none', border: 'none', cursor: 'pointer',
                        fontSize: 'var(--font-size-lg)', color: 'var(--color-text-secondary)',
                        lineHeight: 1,
                    }}
                >
                    &times;
                </button>
            </div>

            {loading ? (
                <div className="skeleton" style={{ height: 100 }} />
            ) : (
                <>
                    {/* 標準フロー参照 */}
                    <div style={{
                        display: 'flex', alignItems: 'center', gap: 0,
                        marginBottom: 'var(--space-lg)', padding: 'var(--space-sm) var(--space-md)',
                        background: 'var(--color-bg)', borderRadius: 'var(--radius-sm)',
                        fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)',
                        overflowX: 'auto',
                    }}>
                        {STANDARD_FLOW.map((status, i) => (
                            <React.Fragment key={status}>
                                <span style={{
                                    fontWeight: reachedStatuses.has(status) ? 600 : 400,
                                    color: reachedStatuses.has(status) ? 'var(--color-accent)' : 'var(--color-text-muted)',
                                    whiteSpace: 'nowrap',
                                }}>
                                    {STANDARD_FLOW_LABELS[status]}
                                </span>
                                {i < STANDARD_FLOW.length - 1 && (
                                    <span style={{ margin: '0 8px', color: 'var(--color-text-muted)' }}>&rarr;</span>
                                )}
                            </React.Fragment>
                        ))}
                    </div>

                    {/* 縦タイムライン */}
                    <div style={{ position: 'relative', paddingLeft: 28 }}>
                        {/* 縦線 */}
                        <div style={{
                            position: 'absolute', left: 8, top: 6, bottom: 6,
                            width: 2, background: 'var(--color-border)',
                        }} />

                        {timeline.map((entry, i) => {
                            const isLatest = i === timeline.length - 1;
                            const dotSize = isLatest ? 16 : 10;
                            const dotColor = STATUS_DOT_COLOR[entry.status] || '#6b7280';

                            return (
                                <div key={entry.id} style={{
                                    position: 'relative',
                                    paddingBottom: i < timeline.length - 1 ? 'var(--space-lg)' : 0,
                                }}>
                                    {/* ドット */}
                                    <div style={{
                                        position: 'absolute',
                                        left: -28 + 9 - dotSize / 2,
                                        top: 2,
                                        width: dotSize,
                                        height: dotSize,
                                        borderRadius: '50%',
                                        background: dotColor,
                                        border: isLatest ? `3px solid ${dotColor}33` : 'none',
                                        boxShadow: isLatest ? `0 0 0 4px ${dotColor}22` : 'none',
                                        zIndex: 1,
                                    }} />

                                    {/* コンテンツ */}
                                    <div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)' }}>
                                            <span style={{
                                                fontWeight: isLatest ? 700 : 500,
                                                fontSize: isLatest ? 'var(--font-size-md)' : 'var(--font-size-sm)',
                                                color: isLatest ? 'var(--color-text)' : 'var(--color-text-secondary)',
                                            }}>
                                                {STATUS_LABELS[entry.status] || entry.status}
                                            </span>
                                            {isLatest && (
                                                <span style={{
                                                    fontSize: 'var(--font-size-xs)',
                                                    background: dotColor,
                                                    color: '#fff',
                                                    padding: '1px 8px',
                                                    borderRadius: 'var(--radius-sm)',
                                                    fontWeight: 600,
                                                }}>
                                                    現在
                                                </span>
                                            )}
                                        </div>
                                        <div style={{
                                            fontSize: 'var(--font-size-xs)',
                                            color: 'var(--color-text-muted)',
                                            marginTop: 2,
                                        }}>
                                            {new Date(entry.changed_at).toLocaleString('ja-JP', {
                                                year: 'numeric', month: '2-digit', day: '2-digit',
                                                hour: '2-digit', minute: '2-digit',
                                            })}
                                        </div>
                                        {entry.note && (
                                            <div style={{
                                                fontSize: 'var(--font-size-xs)',
                                                color: 'var(--color-text-secondary)',
                                                marginTop: 4,
                                                fontStyle: 'italic',
                                            }}>
                                                {entry.note}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </>
            )}
        </div>
    );
}

export default function MyApplicationsPage() {
    const toast = useToast();
    const [applications, setApplications] = useState([]);
    const [loading, setLoading] = useState(true);
    const [tab, setTab] = useState('applications'); // applications | scouts
    const [resumes, setResumes] = useState([]);
    const [acceptingId, setAcceptingId] = useState(null);
    const [selectedResumeId, setSelectedResumeId] = useState(null);
    const [timelineAppId, setTimelineAppId] = useState(null);
    const [confirmingScheduleId, setConfirmingScheduleId] = useState(null);
    const [statusFilter, setStatusFilter] = useState('all');
    const [sortOrder, setSortOrder] = useState('desc');
    const navigate = useNavigate();

    useEffect(() => {
        Promise.all([
            api.get('/my-applications'),
            api.get('/resumes'),
        ]).then(([appRes, resumeRes]) => {
            setApplications(appRes.data);
            setResumes(resumeRes.data.resumes || []);
        }).finally(() => setLoading(false));
    }, []);

    const myApplications = applications.filter(a => a.type === 'standard');
    const scouts = applications.filter(a => a.type === 'scout');

    // フィルタ・ソート適用
    const filteredApplications = myApplications
        .filter(a => statusFilter === 'all' || a.status === statusFilter)
        .sort((a, b) => {
            const dateA = new Date(a.created_at).getTime();
            const dateB = new Date(b.created_at).getTime();
            return sortOrder === 'desc' ? dateB - dateA : dateA - dateB;
        });

    const handleAcceptScout = async (applicationId) => {
        if (!selectedResumeId) {
            toast.info('送信する履歴書を選択してください');
            return;
        }
        try {
            const res = await api.post(`/applications/${applicationId}/accept-scout`, {
                resume_id: selectedResumeId,
            });
            setApplications(applications.map(a => a.id === applicationId ? res.data : a));
            setAcceptingId(null);
            setSelectedResumeId(null);
        } catch (err) {
            toast.error('承諾に失敗しました');
        }
    };

    const handleDeclineScout = async (applicationId) => {
        if (!confirm('このスカウトを辞退しますか？')) return;
        try {
            const res = await api.post(`/applications/${applicationId}/decline-scout`);
            setApplications(applications.map(a => a.id === applicationId ? res.data : a));
        } catch (err) {
            toast.error('辞退に失敗しました');
        }
    };

    const handleWithdraw = async (applicationId) => {
        if (!confirm('この応募を辞退しますか？')) return;
        try {
            const res = await api.put(`/applications/${applicationId}/status`, { status: 'withdrawn' });
            setApplications(applications.map(a => a.id === applicationId ? res.data : a));
        } catch (err) {
            toast.error('辞退に失敗しました');
        }
    };

    const handleConfirmInterview = async (appId, scheduleId) => {
        setConfirmingScheduleId(scheduleId);
        try {
            const res = await api.put(`/schedules/${scheduleId}/confirm`);
            // interview_schedules 内の該当スケジュールを更新
            setApplications(applications.map(a => {
                if (a.id !== appId) return a;
                return {
                    ...a,
                    interview_schedules: (a.interview_schedules || []).map(s =>
                        s.id === scheduleId ? res.data.schedule : s
                    ),
                };
            }));
        } catch (err) {
            toast.error('確認に失敗しました');
        } finally {
            setConfirmingScheduleId(null);
        }
    };

    if (loading) return <div className="page container"><div className="skeleton" style={{ height: 300 }} /></div>;

    return (
        <div className="page container animate-fade-in">
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-md)', marginBottom: 'var(--space-xl)' }}>
                <h1 style={{ fontSize: 'var(--font-size-3xl)' }}>応募・スカウト管理</h1>
            </div>

            {/* タブ */}
            <div style={{ display: 'flex', gap: 'var(--space-sm)', marginBottom: 'var(--space-xl)', borderBottom: '2px solid var(--color-border)', paddingBottom: 'var(--space-sm)' }}>
                <button
                    onClick={() => setTab('applications')}
                    style={{
                        padding: '8px 20px', border: 'none', cursor: 'pointer', borderRadius: 'var(--radius-md) var(--radius-md) 0 0',
                        background: tab === 'applications' ? 'var(--color-navy)' : 'transparent',
                        color: tab === 'applications' ? '#fff' : 'var(--color-text-secondary)',
                        fontWeight: tab === 'applications' ? 600 : 400, fontSize: 'var(--font-size-sm)',
                    }}>
                    応募一覧 ({myApplications.length})
                </button>
                <button
                    onClick={() => setTab('scouts')}
                    style={{
                        padding: '8px 20px', border: 'none', cursor: 'pointer', borderRadius: 'var(--radius-md) var(--radius-md) 0 0',
                        background: tab === 'scouts' ? 'var(--color-navy)' : 'transparent',
                        color: tab === 'scouts' ? '#fff' : 'var(--color-text-secondary)',
                        fontWeight: tab === 'scouts' ? 600 : 400, fontSize: 'var(--font-size-sm)',
                        position: 'relative',
                    }}>
                    スカウト ({scouts.length})
                    {scouts.filter(s => s.status === 'pending').length > 0 && (
                        <span style={{
                            position: 'absolute', top: -4, right: -4,
                            background: 'var(--color-danger)', color: '#fff', borderRadius: '50%',
                            width: 18, height: 18, fontSize: 11, display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>{scouts.filter(s => s.status === 'pending').length}</span>
                    )}
                </button>
            </div>

            {/* 応募一覧 */}
            {tab === 'applications' && (
                myApplications.length === 0 ? (
                    <div className="card" style={{ textAlign: 'center', padding: 'var(--space-3xl)' }}>
                        <div style={{ marginBottom: 'var(--space-md)', display: 'flex', justifyContent: 'center' }}>
                            <ClipboardList size={48} strokeWidth={1.5} color="var(--color-text-accent)" />
                        </div>
                        <h3 style={{ marginBottom: 'var(--space-sm)' }}>応募履歴がありません</h3>
                        <p style={{ color: 'var(--color-text-secondary)', marginBottom: 'var(--space-lg)' }}>
                            求人を探して応募してみましょう
                        </p>
                        <Link to="/jobs" className="btn btn-primary">求人を探す</Link>
                    </div>
                ) : (
                    <>
                    {/* フィルタ・ソートバー */}
                    <div style={{ display: 'flex', gap: 'var(--space-md)', marginBottom: 'var(--space-md)', alignItems: 'center' }}>
                        <select
                            className="form-select"
                            value={statusFilter}
                            onChange={e => setStatusFilter(e.target.value)}
                            style={{ fontSize: 'var(--font-size-sm)', padding: '6px 12px' }}
                        >
                            <option value="all">すべて</option>
                            {Object.entries(STATUS_LABELS).map(([key, label]) => (
                                <option key={key} value={key}>{label}</option>
                            ))}
                        </select>
                        <select
                            className="form-select"
                            value={sortOrder}
                            onChange={e => setSortOrder(e.target.value)}
                            style={{ fontSize: 'var(--font-size-sm)', padding: '6px 12px' }}
                        >
                            <option value="desc">新しい順</option>
                            <option value="asc">古い順</option>
                        </select>
                    </div>
                    {filteredApplications.length === 0 ? (
                        <div className="card" style={{ textAlign: 'center', padding: 'var(--space-xl)', color: 'var(--color-text-secondary)' }}>
                            該当する応募はありません
                        </div>
                    ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
                        {filteredApplications.map(app => (
                            <div key={app.id} className="card card-glow">
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                    <div style={{ flex: 1 }}>
                                        <h3 style={{ marginBottom: 'var(--space-xs)' }}>{app.job?.title || '求人情報'}</h3>
                                        <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', marginBottom: 'var(--space-xs)' }}>
                                            {app.job?.company?.company_name || '企業名'}
                                        </p>
                                        <div style={{ display: 'flex', gap: 'var(--space-xs)', alignItems: 'center' }}>
                                            <span className={`badge ${STATUS_BADGE[app.status] || 'badge-info'}`}>
                                                {STATUS_LABELS[app.status] || app.status}
                                            </span>
                                            <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
                                                応募日: {new Date(app.created_at).toLocaleDateString('ja-JP')}
                                            </span>
                                        </div>
                                    </div>
                                    <div style={{ display: 'flex', gap: 'var(--space-sm)' }}>
                                        <button
                                            className="btn btn-secondary"
                                            style={{ fontSize: 'var(--font-size-xs)' }}
                                            onClick={() => setTimelineAppId(timelineAppId === app.id ? null : app.id)}
                                        >
                                            {timelineAppId === app.id ? '閉じる' : '進捗確認'}
                                        </button>
                                        <Link to={`/messages/${app.id}`} className="btn btn-secondary" style={{ fontSize: 'var(--font-size-xs)', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                                            <MessageSquare size={16} strokeWidth={2} />
                                            メッセージ
                                        </Link>
                                        {['pending', 'under_review', 'interviewing', 'offered'].includes(app.status) && (
                                            <button className="btn btn-danger" style={{ fontSize: 'var(--font-size-xs)' }}
                                                onClick={() => handleWithdraw(app.id)}>辞退</button>
                                        )}
                                    </div>
                                </div>

                                {/* 不採用の理由・フィードバック */}
                                {app.status === 'rejected' && (app.rejection_reason || app.rejection_feedback) && (
                                    <div style={{
                                        marginTop: 'var(--space-md)', padding: 'var(--space-md)',
                                        background: 'rgba(239,68,68,0.04)', borderRadius: 'var(--radius-md)',
                                        border: '1px solid rgba(239,68,68,0.15)',
                                    }}>
                                        <h4 style={{ fontSize: 'var(--font-size-sm)', fontWeight: 600, marginBottom: 'var(--space-sm)', color: 'var(--color-danger)' }}>
                                            不採用の理由
                                        </h4>
                                        {app.rejection_reason && (
                                            <div style={{ marginBottom: app.rejection_feedback ? 'var(--space-sm)' : 0 }}>
                                                <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>理由: </span>
                                                <span style={{ fontSize: 'var(--font-size-sm)', fontWeight: 500 }}>
                                                    {REJECTION_REASON_LABELS[app.rejection_reason] || app.rejection_reason}
                                                </span>
                                            </div>
                                        )}
                                        {app.rejection_feedback && (
                                            <div>
                                                <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', display: 'block', marginBottom: 4 }}>
                                                    企業からのフィードバック:
                                                </span>
                                                <p style={{
                                                    fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)',
                                                    whiteSpace: 'pre-wrap', lineHeight: 1.7, margin: 0,
                                                }}>
                                                    {app.rejection_feedback}
                                                </p>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* タイムラインパネル */}
                                {timelineAppId === app.id && (
                                    <ApplicationTimeline
                                        application={app}
                                        onClose={() => setTimelineAppId(null)}
                                    />
                                )}

                                {/* 面接日程表示 */}
                                {app.interview_schedules && app.interview_schedules.filter(s => s.status !== 'cancelled').length > 0 && (
                                    <div style={{
                                        marginTop: 'var(--space-md)', padding: 'var(--space-md)',
                                        background: 'rgba(18,28,52,0.04)', borderRadius: 'var(--radius-md)',
                                        border: '1px solid var(--color-border)',
                                    }}>
                                        <h4 style={{ fontSize: 'var(--font-size-sm)', fontWeight: 600, marginBottom: 'var(--space-sm)', display: 'flex', alignItems: 'center', gap: 6 }}>
                                            <Calendar size={16} strokeWidth={2} color="var(--color-text-accent)" />
                                            面接日程
                                        </h4>
                                        {app.interview_schedules.filter(s => s.status !== 'cancelled').map(iv => (
                                            <div key={iv.id} style={{
                                                padding: 'var(--space-sm) var(--space-md)',
                                                background: 'var(--color-bg-surface)',
                                                borderRadius: 'var(--radius-sm)',
                                                border: '1px solid var(--color-border)',
                                                marginBottom: 'var(--space-xs)',
                                            }}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                    <div>
                                                        <div style={{ fontWeight: 600, fontSize: 'var(--font-size-sm)' }}>
                                                            {new Date(iv.scheduled_at).toLocaleString('ja-JP', {
                                                                year: 'numeric', month: '2-digit', day: '2-digit',
                                                                hour: '2-digit', minute: '2-digit',
                                                            })}
                                                        </div>
                                                        {iv.location && (
                                                            <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', marginTop: 2, display: 'flex', alignItems: 'center', gap: 4 }}>
                                                                <MapPin size={14} strokeWidth={2} style={{ opacity: 0.5, flexShrink: 0 }} />
                                                                {iv.location}
                                                            </div>
                                                        )}
                                                        {iv.meeting_url && (
                                                            <div style={{ fontSize: 'var(--font-size-xs)', marginTop: 2, display: 'flex', alignItems: 'center', gap: 4 }}>
                                                                <Link2 size={14} strokeWidth={2} style={{ color: 'var(--color-text-accent)', flexShrink: 0 }} />
                                                                <a href={iv.meeting_url} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--color-accent)' }}>
                                                                    会議URLを開く
                                                                </a>
                                                            </div>
                                                        )}
                                                        {iv.notes && (
                                                            <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', marginTop: 2 }}>
                                                                {iv.notes}
                                                            </div>
                                                        )}
                                                    </div>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)' }}>
                                                        <span className={`badge ${
                                                            iv.status === 'confirmed' ? 'badge-success' :
                                                            iv.status === 'completed' ? 'badge-info' :
                                                            'badge-warning'
                                                        }`} style={{ fontSize: 10 }}>
                                                            {iv.status === 'pending' ? '未確認' :
                                                             iv.status === 'confirmed' ? '確認済み' :
                                                             iv.status === 'completed' ? '完了' : iv.status}
                                                        </span>
                                                        {iv.status === 'pending' && (
                                                            <button
                                                                className="btn btn-primary"
                                                                style={{ fontSize: 'var(--font-size-xs)', padding: '4px 12px' }}
                                                                disabled={confirmingScheduleId === iv.id}
                                                                onClick={() => handleConfirmInterview(app.id, iv.id)}
                                                            >
                                                                {confirmingScheduleId === iv.id ? '処理中...' : '確認'}
                                                            </button>
                                                        )}
                                                        <button
                                                            className="btn btn-secondary"
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
                                                            style={{ fontSize: 'var(--font-size-xs)', padding: '4px 8px', display: 'inline-flex', alignItems: 'center' }}
                                                            title="カレンダーに追加"
                                                        >
                                                            <Calendar size={16} strokeWidth={2} />
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                    )}
                    </>
                )
            )}

            {/* スカウト一覧 */}
            {tab === 'scouts' && (
                scouts.length === 0 ? (
                    <div className="card" style={{ textAlign: 'center', padding: 'var(--space-3xl)' }}>
                        <div style={{ marginBottom: 'var(--space-md)', display: 'flex', justifyContent: 'center' }}>
                            <Bell size={48} strokeWidth={1.5} color="var(--color-text-accent)" />
                        </div>
                        <h3 style={{ marginBottom: 'var(--space-sm)' }}>スカウトはまだありません</h3>
                        <p style={{ color: 'var(--color-text-secondary)', marginBottom: 'var(--space-lg)' }}>
                            履歴書のスカウト設定をONにすると、企業からスカウトが届きます
                        </p>
                        <Link to="/resumes" className="btn btn-primary">履歴書を管理する</Link>
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
                        {scouts.map(scout => (
                            <div key={scout.id} className="card card-glow" style={{
                                borderLeft: scout.status === 'pending' ? '4px solid var(--color-accent)' : undefined,
                            }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                    <div style={{ flex: 1 }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)', marginBottom: 'var(--space-xs)' }}>
                                            {scout.status === 'pending' && <Bell size={18} strokeWidth={2} color="var(--color-text-accent)" style={{ flexShrink: 0 }} />}
                                            <h3 style={{ margin: 0 }}>{scout.job?.title || 'スカウト求人'}</h3>
                                        </div>
                                        <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', marginBottom: 'var(--space-xs)' }}>
                                            {scout.job?.company?.company_name || '企業名'} からのスカウト
                                        </p>
                                        <div style={{ display: 'flex', gap: 'var(--space-xs)', alignItems: 'center' }}>
                                            <span className={`badge ${STATUS_BADGE[scout.status] || 'badge-info'}`}>
                                                {scout.status === 'pending' ? '未回答' :
                                                 scout.status === 'accepted' ? '承諾済み' :
                                                 scout.status === 'rejected' ? '辞退済み' :
                                                 STATUS_LABELS[scout.status] || scout.status}
                                            </span>
                                            <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
                                                受信日: {new Date(scout.created_at).toLocaleDateString('ja-JP')}
                                            </span>
                                        </div>
                                    </div>
                                    <div style={{ display: 'flex', gap: 'var(--space-sm)', alignItems: 'center' }}>
                                        {scout.status === 'accepted' && (
                                            <Link to={`/messages/${scout.id}`} className="btn btn-secondary" style={{ fontSize: 'var(--font-size-xs)', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                                                <MessageSquare size={16} strokeWidth={2} />
                                                メッセージ
                                            </Link>
                                        )}
                                        {scout.status === 'pending' && (
                                            <>
                                                <button className="btn btn-primary" style={{ fontSize: 'var(--font-size-xs)' }}
                                                    onClick={() => { setAcceptingId(scout.id); setSelectedResumeId(null); }}>
                                                    承諾する
                                                </button>
                                                <button className="btn btn-danger" style={{ fontSize: 'var(--font-size-xs)' }}
                                                    onClick={() => handleDeclineScout(scout.id)}>
                                                    辞退
                                                </button>
                                            </>
                                        )}
                                    </div>
                                </div>

                                {/* スカウト承諾時の履歴書選択 */}
                                {acceptingId === scout.id && (
                                    <div style={{
                                        marginTop: 'var(--space-md)', padding: 'var(--space-md)',
                                        background: 'var(--color-bg-surface)', borderRadius: 'var(--radius-md)',
                                        border: '1px solid var(--color-border)',
                                    }}>
                                        <p style={{ fontWeight: 600, marginBottom: 'var(--space-sm)', fontSize: 'var(--font-size-sm)' }}>
                                            送信する履歴書を選択してください（承諾後に個人情報が企業に公開されます）
                                        </p>
                                        {resumes.length === 0 ? (
                                            <div style={{ padding: 'var(--space-md)', background: 'rgba(245,158,11,0.08)', borderRadius: 'var(--radius-sm)', marginBottom: 'var(--space-md)' }}>
                                                <p style={{ fontSize: 'var(--font-size-sm)', marginBottom: 'var(--space-sm)' }}>
                                                    履歴書がまだ作成されていません。スカウトを承諾するには履歴書が必要です。
                                                </p>
                                                <Link to="/resumes" className="btn btn-primary" style={{ fontSize: 'var(--font-size-xs)' }}>
                                                    履歴書を作成する
                                                </Link>
                                            </div>
                                        ) : (
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-xs)', marginBottom: 'var(--space-md)' }}>
                                                {resumes.map(r => (
                                                    <label key={r.id} style={{
                                                        display: 'flex', alignItems: 'center', gap: 'var(--space-sm)',
                                                        padding: '8px 12px', borderRadius: 'var(--radius-sm)',
                                                        border: selectedResumeId === r.id ? '1.5px solid var(--color-navy)' : '1px solid var(--color-border)',
                                                        background: selectedResumeId === r.id ? 'rgba(18,28,52,0.05)' : undefined,
                                                        cursor: 'pointer', fontSize: 'var(--font-size-sm)',
                                                    }}>
                                                        <input type="radio" name="resume" value={r.id}
                                                            checked={selectedResumeId === r.id}
                                                            onChange={() => setSelectedResumeId(r.id)} />
                                                        <span>{r.title}</span>
                                                    </label>
                                                ))}
                                            </div>
                                        )}
                                        <div style={{ display: 'flex', gap: 'var(--space-sm)' }}>
                                            <button className="btn btn-primary" style={{ fontSize: 'var(--font-size-xs)' }}
                                                onClick={() => handleAcceptScout(scout.id)}>
                                                この履歴書で承諾
                                            </button>
                                            <button className="btn btn-secondary" style={{ fontSize: 'var(--font-size-xs)' }}
                                                onClick={() => setAcceptingId(null)}>
                                                キャンセル
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )
            )}
        </div>
    );
}
