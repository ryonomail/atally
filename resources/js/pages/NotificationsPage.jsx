import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';
import { useToast } from '../hooks/useToast';

const TYPE_LABELS = {
    application: '応募',
    message: 'メッセージ',
    scout: 'スカウト',
    job_alert: '求人アラート',
    system: 'システム',
};

const TYPE_ICONS = {
    application: '📋',
    message: '💬',
    scout: '🎯',
    job_alert: '🔔',
    system: '⚙️',
};

function timeAgo(dateStr) {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'たった今';
    if (mins < 60) return `${mins}分前`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}時間前`;
    const days = Math.floor(hours / 24);
    if (days < 30) return `${days}日前`;
    return new Date(dateStr).toLocaleDateString('ja-JP');
}

export default function NotificationsPage() {
    const toast = useToast();
    const [notifications, setNotifications] = useState([]);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [lastPage, setLastPage] = useState(1);
    const [filter, setFilter] = useState('all');
    const navigate = useNavigate();

    const fetchNotifications = useCallback(async (p = 1) => {
        setLoading(true);
        try {
            const res = await api.get('/notifications', { params: { page: p, per_page: 20 } });
            setNotifications(res.data.data || []);
            setPage(res.data.current_page || 1);
            setLastPage(res.data.last_page || 1);
        } catch {
            setNotifications([]);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetchNotifications(1); }, [fetchNotifications]);

    const handleMarkAllRead = async () => {
        try {
            await api.put('/notifications/read-all');
            setNotifications(prev => prev.map(n => ({ ...n, read_at: n.read_at || new Date().toISOString() })));
        } catch {
            toast.error('既読処理に失敗しました');
        }
    };

    const handleClick = async (n) => {
        if (!n.read_at) {
            try {
                await api.put(`/notifications/${n.id}/read`);
                setNotifications(prev => prev.map(x => x.id === n.id ? { ...x, read_at: new Date().toISOString() } : x));
            } catch { /* ignore */ }
        }
        if (n.link) navigate(n.link);
    };

    const filtered = filter === 'unread' ? notifications.filter(n => !n.read_at) : notifications;
    const unreadTotal = notifications.filter(n => !n.read_at).length;

    if (loading && page === 1) {
        return <div className="page container"><div className="skeleton" style={{ height: 400 }} /></div>;
    }

    return (
        <div className="page container animate-fade-in">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-xl)', flexWrap: 'wrap', gap: 'var(--space-md)' }}>
                <h1 style={{ fontSize: 'var(--font-size-3xl)', margin: 0 }}>通知</h1>
                {unreadTotal > 0 && (
                    <button className="btn btn-secondary" style={{ fontSize: 'var(--font-size-xs)' }} onClick={handleMarkAllRead}>
                        すべて既読にする
                    </button>
                )}
            </div>

            <div style={{ display: 'flex', gap: 'var(--space-xs)', marginBottom: 'var(--space-lg)' }}>
                {[
                    { key: 'all', label: 'すべて' },
                    { key: 'unread', label: `未読${unreadTotal > 0 ? ` (${unreadTotal})` : ''}` },
                ].map(f => (
                    <button
                        key={f.key}
                        onClick={() => setFilter(f.key)}
                        className={filter === f.key ? 'btn btn-primary' : 'btn btn-secondary'}
                        style={{ fontSize: 'var(--font-size-xs)' }}
                    >
                        {f.label}
                    </button>
                ))}
            </div>

            {filtered.length === 0 ? (
                <div className="card" style={{ textAlign: 'center', padding: 'var(--space-3xl)' }}>
                    <div style={{ fontSize: '3rem', marginBottom: 'var(--space-md)' }}>🔔</div>
                    <h3 style={{ marginBottom: 'var(--space-sm)' }}>
                        {filter === 'unread' ? '未読の通知はありません' : '通知はありません'}
                    </h3>
                    <p style={{ color: 'var(--color-text-secondary)' }}>
                        応募やメッセージの更新があるとここに表示されます
                    </p>
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-xs)' }}>
                    {filtered.map(n => (
                        <div
                            key={n.id}
                            onClick={() => handleClick(n)}
                            className="card"
                            style={{
                                cursor: n.link ? 'pointer' : 'default',
                                padding: 'var(--space-md)',
                                background: n.read_at ? undefined : 'rgba(200,149,46,0.04)',
                                borderLeft: n.read_at ? undefined : '3px solid var(--color-accent, #c8952e)',
                                transition: 'transform 0.1s',
                            }}
                            onMouseEnter={e => { if (n.link) e.currentTarget.style.transform = 'translateX(2px)'; }}
                            onMouseLeave={e => e.currentTarget.style.transform = 'none'}
                        >
                            <div style={{ display: 'flex', gap: 'var(--space-md)', alignItems: 'flex-start' }}>
                                <span style={{ fontSize: '1.5rem', flexShrink: 0 }}>
                                    {TYPE_ICONS[n.type] || '📌'}
                                </span>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 'var(--space-sm)' }}>
                                        <p style={{ margin: 0, fontSize: 'var(--font-size-sm)', fontWeight: n.read_at ? 400 : 600 }}>
                                            {n.title}
                                        </p>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-xs)', flexShrink: 0 }}>
                                            <span style={{
                                                fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)',
                                                padding: '1px 8px', background: 'var(--color-bg-secondary)',
                                                borderRadius: 'var(--radius-sm)',
                                            }}>
                                                {TYPE_LABELS[n.type] || n.type}
                                            </span>
                                            {!n.read_at && (
                                                <span style={{
                                                    width: 8, height: 8, borderRadius: '50%',
                                                    background: 'var(--color-accent, #c8952e)', flexShrink: 0,
                                                }} />
                                            )}
                                        </div>
                                    </div>
                                    {n.body && (
                                        <p style={{ margin: '4px 0 0', fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', lineHeight: 1.5 }}>
                                            {n.body}
                                        </p>
                                    )}
                                    <p style={{ margin: '4px 0 0', fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
                                        {timeAgo(n.created_at)}
                                    </p>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {lastPage > 1 && (
                <div style={{ display: 'flex', justifyContent: 'center', gap: 'var(--space-sm)', marginTop: 'var(--space-xl)' }}>
                    <button className="btn btn-secondary" disabled={page <= 1} onClick={() => fetchNotifications(page - 1)}>前へ</button>
                    <span style={{ padding: 'var(--space-sm)', fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)' }}>
                        {page} / {lastPage}
                    </span>
                    <button className="btn btn-secondary" disabled={page >= lastPage} onClick={() => fetchNotifications(page + 1)}>次へ</button>
                </div>
            )}
        </div>
    );
}
