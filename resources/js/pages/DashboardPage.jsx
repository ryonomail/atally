import React, { useState, useEffect } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import api from '../api';
import { useToast } from '../hooks/useToast';
import { STATUS_LABELS, STATUS_COLORS } from '../constants/applicationStatus';

export default function DashboardPage() {
    const { user } = useAuth();
    const toast = useToast();
    const [apps, setApps] = useState([]);
    const [loadingApps, setLoadingApps] = useState(true);
    const [profile, setProfile] = useState(null);
    const [hasResume, setHasResume] = useState(false);
    const [savedJobCount, setSavedJobCount] = useState(0);

    useEffect(() => {
        if (user?.role !== 'jobseeker') return;
        api.get('/my-applications').then(res => setApps(res.data || [])).catch(() => toast.error('応募情報の取得に失敗しました')).finally(() => setLoadingApps(false));
        api.get('/profile').then(res => setProfile(res.data)).catch(() => {});
        api.get('/resumes').then(res => setHasResume((res.data || []).length > 0)).catch(() => {});
        api.get('/saved-jobs').then(res => setSavedJobCount((res.data || []).length)).catch(() => {});
    }, [user]);

    if (user?.role === 'company') return <Navigate to="/company" replace />;

    // 応募ステータス集計
    const statusCounts = {};
    apps.forEach(a => {
        const s = a.status || 'pending';
        statusCounts[s] = (statusCounts[s] || 0) + 1;
    });

    // 直近の面接予定
    const now = new Date();
    const upcomingInterviews = apps
        .flatMap(a => (a.interview_schedules || []).map(s => ({ ...s, job_title: a.job?.title, app_id: a.id })))
        .filter(s => new Date(s.scheduled_at) > now && s.status !== 'cancelled')
        .sort((a, b) => new Date(a.scheduled_at) - new Date(b.scheduled_at))
        .slice(0, 3);

    // 最近の応募（直近5件）
    const recentApps = [...apps].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 5);

    const completionRate = profile?.completion_rate || 0;
    const completionPct = Math.round(completionRate * 100);

    return (
        <div className="page container animate-fade-in">
            {/* パーソナライズされた挨拶 */}
            {(() => {
                const hour = new Date().getHours();
                const greeting = hour < 12 ? 'おはようございます' : hour < 17 ? 'こんにちは' : 'こんばんは';
                const motivations = [
                    '今日も一歩、理想の仕事に近づきましょう。',
                    '新しい求人が追加されているかもしれません。',
                    'プロフィールを充実させると、スカウトが来やすくなります。',
                    '気になる求人は保存して、じっくり比較しましょう。',
                ];
                const motivationMsg = motivations[new Date().getDate() % motivations.length];
                return (
                    <div style={{ marginBottom: 'var(--space-xl)' }}>
                        <h1 style={{ fontSize: 'var(--font-size-3xl)', marginBottom: 4 }}>
                            {greeting}、{user?.name}さん
                        </h1>
                        <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-sm)' }}>
                            {motivationMsg}
                        </p>
                    </div>
                );
            })()}

            {/* プロフィール完成度 + 応募サマリー */}
            {!loadingApps && (
                <div className="grid grid-4" style={{ gap: 'var(--space-md)', marginBottom: 'var(--space-xl)' }}>
                    <div className="card" style={{ textAlign: 'center' }}>
                        <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--font-size-xs)', marginBottom: 'var(--space-xs)' }}>プロフィール完成度</p>
                        <div style={{ position: 'relative', width: 64, height: 64, margin: '0 auto var(--space-xs)' }}>
                            <svg viewBox="0 0 36 36" style={{ width: 64, height: 64, transform: 'rotate(-90deg)' }}>
                                <circle cx="18" cy="18" r="15.9" fill="none" stroke="var(--color-border)" strokeWidth="3" />
                                <circle cx="18" cy="18" r="15.9" fill="none" stroke="var(--color-accent, #c8952e)" strokeWidth="3"
                                    strokeDasharray={`${completionPct} ${100 - completionPct}`} strokeLinecap="round" />
                            </svg>
                            <span style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', fontSize: 'var(--font-size-sm)', fontWeight: 700 }}>
                                {completionPct}%
                            </span>
                        </div>
                        <Link to="/profile" style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-accent)' }}>編集する</Link>
                    </div>
                    <div className="card" style={{ textAlign: 'center' }}>
                        <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--font-size-xs)', marginBottom: 'var(--space-xs)' }}>応募数</p>
                        <p style={{ fontSize: 'var(--font-size-3xl)', fontWeight: 700, color: '#3b82f6', margin: 0 }}>{apps.length}</p>
                    </div>
                    <div className="card" style={{ textAlign: 'center' }}>
                        <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--font-size-xs)', marginBottom: 'var(--space-xs)' }}>選考中</p>
                        <p style={{ fontSize: 'var(--font-size-3xl)', fontWeight: 700, color: '#f59e0b', margin: 0 }}>
                            {(statusCounts.pending || 0) + (statusCounts.under_review || 0) + (statusCounts.interviewing || 0)}
                        </p>
                    </div>
                    <div className="card" style={{ textAlign: 'center' }}>
                        <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--font-size-xs)', marginBottom: 'var(--space-xs)' }}>内定・採用</p>
                        <p style={{ fontSize: 'var(--font-size-3xl)', fontWeight: 700, color: '#22c55e', margin: 0 }}>
                            {(statusCounts.offered || 0) + (statusCounts.accepted || 0) + (statusCounts.hired || 0)}
                        </p>
                    </div>
                </div>
            )}

            {/* オンボーディングチェックリスト */}
            {!loadingApps && completionPct < 100 && apps.length < 3 && (() => {
                const steps = [
                    { label: 'プロフィールを入力する', done: completionPct >= 50, link: '/profile', icon: '👤' },
                    { label: '履歴書を作成する', done: hasResume, link: '/resumes', icon: '📄' },
                    { label: '気になる求人を保存する', done: savedJobCount > 0, link: '/jobs', icon: '🔖' },
                    { label: '求人に応募する', done: apps.length > 0, link: '/jobs', icon: '📮' },
                    { label: '通知設定を確認する', done: apps.length > 0, link: '/settings', icon: '🔔' },
                ];
                const doneCount = steps.filter(s => s.done).length;
                if (doneCount === steps.length) return null;
                return (
                    <div className="card" style={{ marginBottom: 'var(--space-xl)', borderLeft: '3px solid var(--color-accent)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-md)' }}>
                            <h3 style={{ margin: 0, fontSize: 'var(--font-size-lg)' }}>はじめましょう</h3>
                            <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
                                {doneCount}/{steps.length} 完了
                            </span>
                        </div>
                        <div style={{
                            width: '100%', height: 6, background: 'var(--color-bg-surface)',
                            borderRadius: 3, marginBottom: 'var(--space-md)', overflow: 'hidden',
                        }}>
                            <div style={{
                                width: `${(doneCount / steps.length) * 100}%`, height: '100%',
                                background: 'var(--color-accent)', borderRadius: 3, transition: 'width 0.3s',
                            }} />
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-xs)' }}>
                            {steps.map((step, i) => (
                                <Link key={i} to={step.link} style={{
                                    display: 'flex', alignItems: 'center', gap: 'var(--space-sm)',
                                    padding: 'var(--space-sm) var(--space-md)',
                                    background: step.done ? 'rgba(16,185,129,0.06)' : 'var(--color-bg-secondary)',
                                    borderRadius: 'var(--radius-md)', textDecoration: 'none', color: 'inherit',
                                    opacity: step.done ? 0.6 : 1,
                                }}>
                                    <span style={{ fontSize: 18 }}>{step.done ? '✅' : step.icon}</span>
                                    <span style={{
                                        fontSize: 'var(--font-size-sm)', fontWeight: step.done ? 400 : 600,
                                        textDecoration: step.done ? 'line-through' : 'none',
                                    }}>
                                        {step.label}
                                    </span>
                                </Link>
                            ))}
                        </div>
                    </div>
                );
            })()}

            {/* 面接予定 */}
            {upcomingInterviews.length > 0 && (
                <div className="card" style={{ marginBottom: 'var(--space-xl)', borderLeft: '3px solid var(--color-accent, #c8952e)' }}>
                    <h3 style={{ marginBottom: 'var(--space-md)', fontSize: 'var(--font-size-lg)' }}>直近の面接予定</h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
                        {upcomingInterviews.map(s => (
                            <Link key={s.id} to={`/applications`} style={{ textDecoration: 'none', color: 'inherit' }}>
                                <div style={{
                                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                    padding: 'var(--space-sm) var(--space-md)', background: 'var(--color-bg-secondary)',
                                    borderRadius: 'var(--radius-md)', transition: 'transform 0.1s',
                                }}
                                onMouseEnter={e => e.currentTarget.style.transform = 'translateX(2px)'}
                                onMouseLeave={e => e.currentTarget.style.transform = 'none'}>
                                    <div>
                                        <p style={{ margin: 0, fontWeight: 600, fontSize: 'var(--font-size-sm)' }}>{s.job_title}</p>
                                        <p style={{ margin: '2px 0 0', fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
                                            {s.location || 'オンライン'}{s.meeting_url ? ' (Web面接)' : ''}
                                        </p>
                                    </div>
                                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                                        <p style={{ margin: 0, fontWeight: 600, fontSize: 'var(--font-size-sm)', color: 'var(--color-accent, #c8952e)' }}>
                                            {new Date(s.scheduled_at).toLocaleDateString('ja-JP', { month: 'short', day: 'numeric' })}
                                        </p>
                                        <p style={{ margin: 0, fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
                                            {new Date(s.scheduled_at).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })}
                                        </p>
                                    </div>
                                </div>
                            </Link>
                        ))}
                    </div>
                </div>
            )}

            {/* 最近の応募 */}
            {recentApps.length === 0 && (
                <div className="card" style={{ marginBottom: 'var(--space-xl)', textAlign: 'center', padding: 'var(--space-2xl)' }}>
                    <div style={{ fontSize: '2.5rem', marginBottom: 'var(--space-md)' }}>📋</div>
                    <h3 style={{ marginBottom: 'var(--space-sm)' }}>まだ応募がありません</h3>
                    <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-sm)', marginBottom: 'var(--space-lg)' }}>
                        気になる求人を見つけて応募してみましょう
                    </p>
                    <Link to="/jobs" className="btn btn-primary">求人を探す</Link>
                </div>
            )}
            {recentApps.length > 0 && (
                <div className="card" style={{ marginBottom: 'var(--space-xl)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-md)' }}>
                        <h3 style={{ margin: 0, fontSize: 'var(--font-size-lg)' }}>最近の応募</h3>
                        <Link to="/applications" style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-accent)' }}>すべて見る</Link>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-xs)' }}>
                        {recentApps.map(a => (
                            <Link key={a.id} to="/applications" style={{ textDecoration: 'none', color: 'inherit' }}>
                                <div style={{
                                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                    padding: 'var(--space-sm) var(--space-md)', background: 'var(--color-bg-secondary)',
                                    borderRadius: 'var(--radius-md)',
                                }}>
                                    <div style={{ minWidth: 0, flex: 1 }}>
                                        <p style={{ margin: 0, fontWeight: 500, fontSize: 'var(--font-size-sm)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                            {a.job?.title || '求人'}
                                        </p>
                                        <p style={{ margin: '2px 0 0', fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
                                            {a.job?.company?.company_name || ''} · {a.type === 'scout' ? 'スカウト' : '応募'}
                                        </p>
                                    </div>
                                    <span style={{
                                        fontSize: 'var(--font-size-xs)', fontWeight: 600, flexShrink: 0, padding: '2px 10px',
                                        borderRadius: 'var(--radius-sm)', color: STATUS_COLORS[a.status] || '#94a3b8',
                                        background: `${STATUS_COLORS[a.status] || '#94a3b8'}15`,
                                    }}>
                                        {STATUS_LABELS[a.status] || a.status}
                                    </span>
                                </div>
                            </Link>
                        ))}
                    </div>
                </div>
            )}

            {/* 今日のアクション */}
            {!loadingApps && (() => {
                const actions = [];
                if (completionPct < 50) actions.push({ icon: '👤', label: 'プロフィールを入力する', sub: '基本情報だけでOK・2分で完了', to: '/profile', color: '#3b82f6' });
                if (!hasResume) actions.push({ icon: '📝', label: '履歴書を作成する', sub: 'テンプレートで簡単作成', to: '/resumes', color: '#8b5cf6' });
                if (apps.length === 0 && completionPct >= 50) actions.push({ icon: '🔍', label: '求人を探して応募する', sub: '1万件以上の求人から検索', to: '/jobs', color: '#22c55e' });
                if (apps.length > 0 && upcomingInterviews.length === 0) actions.push({ icon: '📨', label: '応募状況を確認する', sub: '企業からの返信をチェック', to: '/applications', color: '#f59e0b' });
                if (actions.length === 0) return null;
                return (
                    <div style={{ marginBottom: 'var(--space-xl)' }}>
                        <h2 style={{ fontSize: 'var(--font-size-base)', fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: 'var(--space-sm)', letterSpacing: 1 }}>
                            TODAY'S ACTION
                        </h2>
                        <div style={{ display: 'flex', gap: 'var(--space-sm)', flexWrap: 'wrap' }}>
                            {actions.map((action, i) => (
                                <Link key={i} to={action.to} style={{
                                    display: 'flex', alignItems: 'center', gap: 'var(--space-md)',
                                    padding: 'var(--space-md) var(--space-lg)',
                                    background: `${action.color}08`,
                                    border: `1px solid ${action.color}30`,
                                    borderRadius: 'var(--radius-lg)',
                                    textDecoration: 'none', color: 'inherit',
                                    flex: '1 1 280px', transition: 'all 0.2s',
                                }}
                                onMouseEnter={e => { e.currentTarget.style.background = `${action.color}12`; e.currentTarget.style.transform = 'translateY(-1px)'; }}
                                onMouseLeave={e => { e.currentTarget.style.background = `${action.color}08`; e.currentTarget.style.transform = 'none'; }}
                                >
                                    <div style={{
                                        width: 40, height: 40, borderRadius: 'var(--radius-md)',
                                        background: `${action.color}15`,
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        fontSize: '1.2rem', flexShrink: 0,
                                    }}>
                                        {action.icon}
                                    </div>
                                    <div>
                                        <p style={{ margin: 0, fontWeight: 600, fontSize: 'var(--font-size-sm)' }}>{action.label}</p>
                                        <p style={{ margin: 0, fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>{action.sub}</p>
                                    </div>
                                    <span style={{ marginLeft: 'auto', color: action.color, fontSize: '1rem', flexShrink: 0 }}>→</span>
                                </Link>
                            ))}
                        </div>
                    </div>
                );
            })()}

            {/* クイックアクセス */}
            <h2 style={{ fontSize: 'var(--font-size-xl)', marginBottom: 'var(--space-md)' }}>メニュー</h2>
            <div className="grid grid-3">
                <Link to="/profile" className="card card-glow" style={{ textDecoration: 'none', color: 'inherit' }}>
                    <div style={{ fontSize: '2rem', marginBottom: 'var(--space-sm)' }}>👤</div>
                    <h3>プロフィール</h3>
                    <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-sm)' }}>基本情報・学歴・職歴の管理</p>
                </Link>
                <Link to="/resumes" className="card card-glow" style={{ textDecoration: 'none', color: 'inherit' }}>
                    <div style={{ fontSize: '2rem', marginBottom: 'var(--space-sm)' }}>📝</div>
                    <h3>履歴書</h3>
                    <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-sm)' }}>履歴書の作成・編集・PDF出力</p>
                </Link>
                <Link to="/jobs" className="card card-glow" style={{ textDecoration: 'none', color: 'inherit' }}>
                    <div style={{ fontSize: '2rem', marginBottom: 'var(--space-sm)' }}>🔍</div>
                    <h3>求人検索</h3>
                    <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-sm)' }}>求人を探して応募する</p>
                </Link>
                <Link to="/applications" className="card card-glow" style={{ textDecoration: 'none', color: 'inherit' }}>
                    <div style={{ fontSize: '2rem', marginBottom: 'var(--space-sm)' }}>📨</div>
                    <h3>応募・スカウト</h3>
                    <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-sm)' }}>応募状況の確認・スカウト管理</p>
                </Link>
                <Link to="/messages" className="card card-glow" style={{ textDecoration: 'none', color: 'inherit' }}>
                    <div style={{ fontSize: '2rem', marginBottom: 'var(--space-sm)' }}>💬</div>
                    <h3>メッセージ</h3>
                    <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-sm)' }}>企業との連絡・やりとり</p>
                </Link>
                <Link to="/saved-jobs" className="card card-glow" style={{ textDecoration: 'none', color: 'inherit' }}>
                    <div style={{ fontSize: '2rem', marginBottom: 'var(--space-sm)' }}>★</div>
                    <h3>保存した求人</h3>
                    <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-sm)' }}>ブックマークした求人の一覧</p>
                </Link>
                <Link to="/job-alerts" className="card card-glow" style={{ textDecoration: 'none', color: 'inherit' }}>
                    <div style={{ fontSize: '2rem', marginBottom: 'var(--space-sm)' }}>🔔</div>
                    <h3>求人アラート</h3>
                    <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-sm)' }}>条件に合う新着求人の通知設定</p>
                </Link>
            </div>
        </div>
    );
}
