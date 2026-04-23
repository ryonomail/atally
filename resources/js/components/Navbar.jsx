import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import api from '../api';

/* ============================================
   通知ベルドロップダウン
   ============================================ */
function NotificationBell({ user }) {
    const [open, setOpen] = useState(false);
    const [notifications, setNotifications] = useState([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const ref = useRef(null);
    const navigate = useNavigate();

    const fetchRecent = useCallback(() => {
        if (!user) return;
        api.get('/notifications/recent')
            .then(res => {
                setNotifications(res.data.notifications || []);
                setUnreadCount(res.data.unread_count || 0);
            })
            .catch(() => {});
    }, [user]);

    useEffect(() => {
        fetchRecent();
        const interval = setInterval(fetchRecent, 30000);
        return () => clearInterval(interval);
    }, [fetchRecent]);

    // 外側クリックで閉じる
    useEffect(() => {
        if (!open) return;
        const handler = (e) => {
            if (ref.current && !ref.current.contains(e.target)) setOpen(false);
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [open]);

    const handleClick = (n) => {
        if (!n.read_at) {
            api.put(`/notifications/${n.id}/read`).catch(() => {});
        }
        setOpen(false);
        if (n.link) navigate(n.link);
    };

    const handleMarkAllRead = () => {
        api.put('/notifications/read-all').then(() => {
            setNotifications(prev => prev.map(n => ({ ...n, read_at: n.read_at || new Date().toISOString() })));
            setUnreadCount(0);
        }).catch(() => {});
    };

    const typeIcon = (type) => {
        switch (type) {
            case 'application': return '📋';
            case 'message': return '💬';
            case 'scout': return '🎯';
            case 'job_alert': return '🔔';
            case 'system': return '⚙️';
            default: return '📌';
        }
    };

    const timeAgo = (dateStr) => {
        const diff = Date.now() - new Date(dateStr).getTime();
        const mins = Math.floor(diff / 60000);
        if (mins < 1) return 'たった今';
        if (mins < 60) return `${mins}分前`;
        const hours = Math.floor(mins / 60);
        if (hours < 24) return `${hours}時間前`;
        const days = Math.floor(hours / 24);
        if (days < 30) return `${days}日前`;
        return new Date(dateStr).toLocaleDateString('ja-JP');
    };

    return (
        <div ref={ref} style={{ position: 'relative' }}>
            <button
                onClick={() => setOpen(prev => !prev)}
                title="通知"
                style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    padding: '4px 8px', position: 'relative', fontSize: '1.1rem',
                }}
            >
                <span role="img" aria-label="通知">🔔</span>
                {unreadCount > 0 && (
                    <span style={{
                        position: 'absolute', top: 0, right: 2,
                        background: '#dc2626', color: '#fff', fontSize: 10, fontWeight: 700,
                        minWidth: 16, height: 16, borderRadius: 8,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        padding: '0 4px', lineHeight: 1,
                    }}>
                        {unreadCount > 99 ? '99+' : unreadCount}
                    </span>
                )}
            </button>

            {open && (
                <div style={{
                    position: 'absolute', right: 0, top: '100%', marginTop: 8,
                    width: 360, maxHeight: 440, overflowY: 'auto',
                    background: 'var(--color-bg-surface)', border: '1px solid var(--color-border)',
                    borderRadius: 'var(--radius-lg)', boxShadow: '0 8px 32px rgba(0,0,0,0.25)',
                    zIndex: 1000,
                }}>
                    {/* ヘッダー */}
                    <div style={{
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        padding: 'var(--space-sm) var(--space-md)',
                        borderBottom: '1px solid var(--color-border)',
                    }}>
                        <span style={{ fontWeight: 700, fontSize: 'var(--font-size-sm)' }}>通知</span>
                        <div style={{ display: 'flex', gap: 'var(--space-sm)', alignItems: 'center' }}>
                            {unreadCount > 0 && (
                                <button
                                    onClick={handleMarkAllRead}
                                    style={{
                                        background: 'none', border: 'none', cursor: 'pointer',
                                        fontSize: 'var(--font-size-xs)', color: 'var(--color-text-accent)',
                                    }}
                                >
                                    すべて既読
                                </button>
                            )}
                        </div>
                    </div>

                    {/* 通知リスト */}
                    {notifications.length === 0 ? (
                        <div style={{ padding: 'var(--space-xl)', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: 'var(--font-size-sm)' }}>
                            通知はありません
                        </div>
                    ) : (
                        notifications.map(n => (
                            <div
                                key={n.id}
                                onClick={() => handleClick(n)}
                                style={{
                                    display: 'flex', gap: 'var(--space-sm)', padding: 'var(--space-sm) var(--space-md)',
                                    cursor: n.link ? 'pointer' : 'default',
                                    background: n.read_at ? 'transparent' : 'rgba(200,149,46,0.06)',
                                    borderBottom: '1px solid var(--color-border)',
                                    transition: 'background 0.15s',
                                }}
                                onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.04)'}
                                onMouseLeave={e => e.currentTarget.style.background = n.read_at ? 'transparent' : 'rgba(200,149,46,0.06)'}
                            >
                                <span style={{ fontSize: '1.2rem', flexShrink: 0, marginTop: 2 }}>{typeIcon(n.type)}</span>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <p style={{
                                        margin: 0, fontSize: 'var(--font-size-sm)',
                                        fontWeight: n.read_at ? 400 : 600,
                                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                                    }}>
                                        {n.title}
                                    </p>
                                    {n.body && (
                                        <p style={{
                                            margin: 0, fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)',
                                            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                                        }}>
                                            {n.body}
                                        </p>
                                    )}
                                    <p style={{ margin: 0, fontSize: 10, color: 'var(--color-text-muted)', marginTop: 2 }}>
                                        {timeAgo(n.created_at)}
                                    </p>
                                </div>
                                {!n.read_at && (
                                    <span style={{
                                        width: 8, height: 8, borderRadius: '50%', background: 'var(--color-accent, #c8952e)',
                                        flexShrink: 0, marginTop: 6,
                                    }} />
                                )}
                            </div>
                        ))
                    )}

                    {/* フッター */}
                    <Link
                        to="/notifications"
                        onClick={() => setOpen(false)}
                        style={{
                            display: 'block', textAlign: 'center', padding: 'var(--space-sm)',
                            fontSize: 'var(--font-size-xs)', color: 'var(--color-text-accent)',
                            textDecoration: 'none', borderTop: '1px solid var(--color-border)',
                        }}
                    >
                        すべての通知を見る
                    </Link>
                </div>
            )}
        </div>
    );
}

export default function Navbar() {
    const { user, logout } = useAuth();
    const [menuOpen, setMenuOpen] = useState(false);
    const [unreadCount, setUnreadCount] = useState(0);
    const menuRef = useRef(null);
    const hamburgerRef = useRef(null);

    // 未読メッセージ数をポーリング
    useEffect(() => {
        if (!user) return;

        const fetchUnread = () => {
            api.get('/messages/unread-count')
                .then(res => setUnreadCount(res.data.unread_count || 0))
                .catch(() => {});
        };

        fetchUnread();
        const interval = setInterval(fetchUnread, 30000);
        return () => clearInterval(interval);
    }, [user]);

    // メニュー外クリックで閉じる
    useEffect(() => {
        if (!menuOpen) return;

        const handleClickOutside = (e) => {
            if (
                menuRef.current && !menuRef.current.contains(e.target) &&
                hamburgerRef.current && !hamburgerRef.current.contains(e.target)
            ) {
                setMenuOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        document.addEventListener('touchstart', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            document.removeEventListener('touchstart', handleClickOutside);
        };
    }, [menuOpen]);

    const closeMenu = useCallback(() => setMenuOpen(false), []);

    const messagesPath = '/messages';

    return (
        <nav className="navbar">
            <div className="container navbar-inner">
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-lg)' }}>
                    <Link to="/" className="navbar-brand">Atally</Link>

                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)' }}>
                    {/* 通知ベル */}
                    {user && <NotificationBell user={user} />}

                    {/* 未読メッセージバッジ */}
                    {user && (
                        <Link to={messagesPath} className="navbar-unread-badge-link" title="メッセージ">
                            <span className="navbar-message-icon">
                                <span role="img" aria-label="メッセージ">💬</span>
                                {unreadCount > 0 && (
                                    <span className="navbar-unread-badge">
                                        {unreadCount > 99 ? '99+' : unreadCount}
                                    </span>
                                )}
                            </span>
                        </Link>
                    )}

                    {/* ハンバーガーメニューボタン（モバイル用） */}
                    <button
                        ref={hamburgerRef}
                        className="navbar-hamburger"
                        onClick={() => setMenuOpen(prev => !prev)}
                        aria-label="メニューを開く"
                        aria-expanded={menuOpen}
                    >
                        <span className="navbar-hamburger-icon">{menuOpen ? '✕' : '☰'}</span>
                    </button>

                    {/* デスクトップナビゲーション */}
                    <ul className="navbar-nav navbar-nav-desktop">
                        <NavLinks user={user} logout={logout} />
                    </ul>
                </div>
            </div>

            {/* モバイルドロップダウンメニュー */}
            {menuOpen && (
                <div className="navbar-mobile-menu" ref={menuRef}>
                    <ul className="navbar-mobile-nav" onClick={closeMenu}>
                        <NavLinks user={user} logout={logout} showAll />
                    </ul>
                </div>
            )}
        </nav>
    );
}

/* ============================================
   ドロップダウンメニュー共通コンポーネント
   ============================================ */
function NavDropdown({ label, children }) {
    const [open, setOpen] = useState(false);
    const ref = useRef(null);

    useEffect(() => {
        if (!open) return;
        const handler = (e) => {
            if (ref.current && !ref.current.contains(e.target)) setOpen(false);
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [open]);

    return (
        <li ref={ref} style={{ position: 'relative' }}>
            <button
                className="navbar-link navbar-dropdown-trigger"
                onClick={() => setOpen(prev => !prev)}
                aria-expanded={open}
            >
                {label}
                <span style={{ fontSize: '0.6em', marginLeft: 4, opacity: 0.7 }}>{open ? '▲' : '▼'}</span>
            </button>
            {open && (
                <div className="navbar-dropdown" onClick={() => setOpen(false)}>
                    {children}
                </div>
            )}
        </li>
    );
}

/**
 * ナビゲーションリンク（デスクトップ・モバイル共用）
 * showAll=true の場合、hide-mobile クラスを付けない（モバイルメニュー用）
 */
function NavLinks({ user, logout, showAll = false }) {
    const hideMobile = showAll ? '' : 'hide-mobile';

    return (
        <>
            {user?.role !== 'company' && (
                <li><Link to="/jobs" className="navbar-link">求人検索</Link></li>
            )}

            {!user && (
                <>
                    <li><Link to="/login" className="navbar-link">ログイン</Link></li>
                    <li><Link to="/register" className="btn btn-primary">無料登録</Link></li>
                </>
            )}

            {user?.role === 'jobseeker' && (
                <>
                    <li><Link to="/dashboard" className="navbar-link">マイページ</Link></li>
                    <li><Link to="/resumes" className="navbar-link">履歴書</Link></li>
                </>
            )}

            {user?.role === 'company' && (
                <>
                    <li><Link to={user?.company?.company_type === 'recruitment_agency' ? '/agency' : '/company'} className="navbar-link">管理画面</Link></li>
                    <li><Link to="/company/jobs" className={`navbar-link ${hideMobile}`}>求人管理</Link></li>
                    {user?.company?.company_type === 'recruitment_agency' ? (
                        showAll ? (
                            <>
                                <li><Link to="/company/scout" className="navbar-link">スカウト</Link></li>
                                <li><Link to="/agency" className="navbar-link">紹介管理</Link></li>
                                <li><Link to="/agency/job-database" className="navbar-link">求人DB</Link></li>
                                <li><Link to="/agency/bulk-upload" className="navbar-link">求人一括アップロード</Link></li>
                                <li><Link to="/agency/clients" className="navbar-link">クライアント</Link></li>
                            </>
                        ) : (
                            <NavDropdown label="エージェント">
                                <Link to="/company/scout" className="navbar-dropdown-item">スカウト</Link>
                                <Link to="/agency" className="navbar-dropdown-item">紹介管理</Link>
                                <Link to="/agency/job-database" className="navbar-dropdown-item">求人DB</Link>
                                <Link to="/agency/bulk-upload" className="navbar-dropdown-item">求人一括アップロード</Link>
                                <Link to="/agency/clients" className="navbar-dropdown-item">クライアント</Link>
                            </NavDropdown>
                        )
                    ) : (
                        <li><Link to="/company/scout" className={`navbar-link ${hideMobile}`}>スカウト</Link></li>
                    )}
                </>
            )}

            {user?.role === 'admin' && (
                <li><Link to="/admin" className="navbar-link">運営管理</Link></li>
            )}

            {user && !showAll && (
                <>
                    <NavDropdown label={<><span style={{ fontSize: '1rem' }}>👤</span></>}>
                        <div style={{ padding: '6px 16px', fontSize: 'var(--font-size-xs)', color: 'rgba(255,255,255,0.5)', borderBottom: '1px solid rgba(255,255,255,0.1)', marginBottom: 4 }}>
                            {user.name || 'アカウント'}
                        </div>
                        {user?.role === 'jobseeker' && (
                            <Link to="/profile" className="navbar-dropdown-item">プロフィール</Link>
                        )}
                        <Link to="/settings" className="navbar-dropdown-item">設定</Link>
                    </NavDropdown>
                    <li>
                        <button onClick={logout} className="btn" style={{
                            fontSize: '0.75rem',
                            background: 'rgba(255,255,255,0.1)',
                            color: 'rgba(255,255,255,0.8)',
                            border: '1px solid rgba(255,255,255,0.15)',
                            padding: '4px 10px',
                        }}>
                            ログアウト
                        </button>
                    </li>
                </>
            )}

            {user && showAll && (
                <>
                    {user?.role === 'jobseeker' && (
                        <li><Link to="/profile" className="navbar-link">プロフィール</Link></li>
                    )}
                    <li><Link to="/settings" className="navbar-link">設定</Link></li>
                    <li>
                        <button onClick={logout} className="btn" style={{
                            fontSize: '0.8rem',
                            background: 'rgba(255,255,255,0.12)',
                            color: 'rgba(255,255,255,0.85)',
                            border: '1px solid rgba(255,255,255,0.2)',
                        }}>
                            ログアウト
                        </button>
                    </li>
                </>
            )}
        </>
    );
}
