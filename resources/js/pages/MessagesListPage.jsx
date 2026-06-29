import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import api from '../api';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../hooks/useToast';
import { STATUS_LABELS } from '../constants/applicationStatus';
import { MessageSquare, Paperclip, ArrowLeft } from 'lucide-react';

const formatFileSize = (bytes) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
};

function formatTime(dateStr) {
    const d = new Date(dateStr);
    const now = new Date();
    const diff = now - d;
    const oneDay = 86400000;
    if (diff < oneDay && d.getDate() === now.getDate()) {
        return d.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' });
    }
    if (diff < oneDay * 2) return '昨日';
    if (diff < oneDay * 7) return ['日', '月', '火', '水', '木', '金', '土'][d.getDay()] + '曜日';
    return d.toLocaleDateString('ja-JP', { month: 'short', day: 'numeric' });
}

/* ============================================
   右パネル: メッセージ本文
   ============================================ */
function ChatPanel({ applicationId, onBack }) {
    const { user } = useAuth();
    const toast = useToast();
    const navigate = useNavigate();
    const [messages, setMessages] = useState([]);
    const [application, setApplication] = useState(null);
    const [loading, setLoading] = useState(true);
    const [body, setBody] = useState('');
    const [sending, setSending] = useState(false);
    const [attachment, setAttachment] = useState(null);
    const messagesContainerRef = useRef(null);
    const fileInputRef = useRef(null);
    const prevMessageCountRef = useRef(0);

    useEffect(() => {
        prevMessageCountRef.current = 0;
        setLoading(true);
        setMessages([]);
        setApplication(null);
        setBody('');
        setAttachment(null);
        loadData();
        const interval = setInterval(loadMessages, 5000);
        return () => clearInterval(interval);
    }, [applicationId]);

    useEffect(() => {
        if (messages.length === 0) return;
        const container = messagesContainerRef.current;
        if (!container) return;
        const isInitialLoad = prevMessageCountRef.current === 0;
        if (isInitialLoad) {
            container.scrollTop = container.scrollHeight;
        } else {
            container.scrollTo({ top: container.scrollHeight, behavior: 'smooth' });
        }
        prevMessageCountRef.current = messages.length;
    }, [messages]);

    const loadData = async () => {
        try {
            const [msgRes, appRes] = await Promise.all([
                api.get(`/applications/${applicationId}/messages`),
                api.get('/my-applications').catch(() => ({ data: [] })),
            ]);
            setMessages(msgRes.data.data || []);
            const app = appRes.data.find(a => a.id === parseInt(applicationId));
            setApplication(app || null);
        } catch {
            // silent
        } finally {
            setLoading(false);
        }
    };

    const loadMessages = async () => {
        try {
            const res = await api.get(`/applications/${applicationId}/messages`);
            setMessages(res.data.data || []);
        } catch {}
    };

    const handleFileSelect = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const allowedExts = ['pdf', 'doc', 'docx', 'jpg', 'jpeg', 'png'];
        const ext = file.name.split('.').pop().toLowerCase();
        if (!allowedExts.includes(ext)) { toast.error('対応形式: PDF, DOC, DOCX, JPG, PNG'); return; }
        if (file.size > 10 * 1024 * 1024) { toast.error('ファイルサイズは10MB以下にしてください'); return; }
        setAttachment(file);
        e.target.value = '';
    };

    const handleSend = async () => {
        if (!body.trim() && !attachment) return;
        setSending(true);
        try {
            const formData = new FormData();
            formData.append('body', body.trim() || (attachment ? attachment.name : ''));
            if (attachment) formData.append('attachment', attachment);
            const res = await api.post(`/applications/${applicationId}/messages`, formData);
            setMessages(prev => [...prev, res.data.message]);
            setBody('');
            setAttachment(null);
        } catch (err) {
            toast.error(err.response?.data?.message || 'メッセージの送信に失敗しました');
        } finally {
            setSending(false);
        }
    };

    const handleDownloadAttachment = async (messageId, fileName) => {
        try {
            const res = await api.get(`/messages/${messageId}/attachment`, { responseType: 'blob' });
            const url = window.URL.createObjectURL(new Blob([res.data]));
            const a = document.createElement('a');
            a.href = url;
            a.setAttribute('download', fileName);
            document.body.appendChild(a);
            a.click();
            a.remove();
            window.URL.revokeObjectURL(url);
        } catch { toast.error('ファイルのダウンロードに失敗しました'); }
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
    };

    const isScoutPending = application?.type === 'scout' && application?.status === 'pending';

    if (loading) return <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><div className="skeleton" style={{ width: '80%', height: 200 }} /></div>;

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            {/* ヘッダー */}
            <div style={{
                display: 'flex', alignItems: 'center', gap: 'var(--space-sm)',
                padding: 'var(--space-sm) var(--space-md)',
                borderBottom: '1px solid var(--color-border)', flexShrink: 0,
                background: 'var(--color-bg-surface)',
            }}>
                {onBack && (
                    <button onClick={onBack} style={{
                        background: 'none', border: 'none', cursor: 'pointer',
                        display: 'inline-flex', alignItems: 'center',
                        padding: '4px 8px', color: 'var(--color-text-secondary)',
                    }}><ArrowLeft size={18} strokeWidth={2} /></button>
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                    <h3 style={{ margin: 0, fontSize: 'var(--font-size-base)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {application?.job?.id ? (
                            <Link to={`/jobs/${application.job.id}`} style={{ color: 'inherit', textDecoration: 'none' }}>
                                {application.job.title || 'メッセージ'}
                            </Link>
                        ) : 'メッセージ'}
                    </h3>
                    <p style={{ margin: 0, fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {application?.job?.company?.id ? (
                            <Link to={`/companies/${application.job.company.id}`} style={{ color: 'inherit', textDecoration: 'none' }}>
                                {application.job.company.company_name || '企業'}
                            </Link>
                        ) : (application?.job?.company?.company_name || '企業')}
                        {application?.type === 'scout' && ' (スカウト)'}
                    </p>
                </div>
            </div>

            {/* メッセージエリア */}
            <div ref={messagesContainerRef} style={{
                flex: 1, overflowY: 'auto', padding: 'var(--space-md)',
                display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)',
            }}>
                {messages.length === 0 && (
                    <div style={{ textAlign: 'center', padding: 'var(--space-3xl)', color: 'var(--color-text-muted)' }}>
                        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 'var(--space-sm)', opacity: 0.4 }}><MessageSquare size={40} strokeWidth={1.5} /></div>
                        <p>まだメッセージはありません</p>
                        {!isScoutPending && <p style={{ fontSize: 'var(--font-size-xs)' }}>最初のメッセージを送ってみましょう</p>}
                    </div>
                )}

                {messages.map(msg => {
                    const isMe = msg.sender_id === user?.id;
                    return (
                        <div key={msg.id} style={{ display: 'flex', justifyContent: isMe ? 'flex-end' : 'flex-start' }}>
                            <div style={{
                                maxWidth: '75%', padding: '10px 14px',
                                borderRadius: isMe ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                                background: isMe ? 'var(--color-accent)' : 'var(--color-bg-elevated, #e8e8e8)',
                                color: isMe ? '#fff' : 'var(--color-text-primary)',
                                fontSize: 'var(--font-size-sm)', lineHeight: 1.5,
                            }}>
                                {!isMe && (
                                    <div style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600, marginBottom: 2, opacity: 0.8 }}>
                                        {msg.sender?.name || '相手'}
                                    </div>
                                )}
                                <div style={{ whiteSpace: 'pre-wrap' }}>{msg.body}</div>
                                {msg.attachment_name && (
                                    <div onClick={() => handleDownloadAttachment(msg.id, msg.attachment_name)} style={{
                                        display: 'flex', alignItems: 'center', gap: 6,
                                        marginTop: 6, padding: '6px 10px',
                                        background: isMe ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.06)',
                                        borderRadius: 8, cursor: 'pointer', fontSize: 'var(--font-size-xs)',
                                    }}>
                                        <Paperclip size={14} strokeWidth={2} style={{ flexShrink: 0 }} />
                                        <span style={{ textDecoration: 'underline', wordBreak: 'break-all' }}>{msg.attachment_name}</span>
                                    </div>
                                )}
                                <div style={{ fontSize: '10px', marginTop: 4, textAlign: 'right', opacity: 0.6 }}>
                                    {new Date(msg.created_at).toLocaleString('ja-JP', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                    {isMe && msg.read_at && ' 既読'}
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* 入力エリア */}
            {isScoutPending ? (
                <div style={{
                    padding: 'var(--space-md)', textAlign: 'center',
                    borderTop: '1px solid var(--color-border)',
                    color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-sm)',
                }}>
                    スカウトを承諾するとメッセージを送信できます。
                    <button className="btn btn-primary" style={{ marginLeft: 'var(--space-sm)', fontSize: 'var(--font-size-xs)' }}
                        onClick={() => navigate('/applications')}>
                        スカウト管理へ
                    </button>
                </div>
            ) : (
                <div style={{ padding: 'var(--space-sm) var(--space-md)', borderTop: '1px solid var(--color-border)', flexShrink: 0 }}>
                    {attachment && (
                        <div style={{
                            display: 'flex', alignItems: 'center', gap: 8,
                            padding: '4px 10px', marginBottom: 6,
                            background: 'var(--color-bg-secondary)', borderRadius: 'var(--radius-sm)',
                            fontSize: 'var(--font-size-xs)',
                        }}>
                            <Paperclip size={14} strokeWidth={2} style={{ flexShrink: 0 }} />
                            <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{attachment.name}</span>
                            <span style={{ color: 'var(--color-text-muted)', flexShrink: 0 }}>{formatFileSize(attachment.size)}</span>
                            <button onClick={() => setAttachment(null)} style={{
                                background: 'none', border: 'none', cursor: 'pointer',
                                color: 'var(--color-text-muted)', fontSize: '14px', padding: '0 4px',
                            }}>✕</button>
                        </div>
                    )}
                    <div style={{ display: 'flex', gap: 'var(--space-xs)', alignItems: 'flex-end' }}>
                        <input ref={fileInputRef} type="file" accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                            onChange={handleFileSelect} style={{ display: 'none' }} />
                        <button type="button" onClick={() => fileInputRef.current?.click()} style={{
                            background: 'none', border: '1px solid var(--color-border)',
                            borderRadius: 'var(--radius-sm)', padding: '6px 8px', cursor: 'pointer',
                            display: 'inline-flex', alignItems: 'center', lineHeight: 1,
                            color: 'var(--color-text-secondary)',
                        }} title="ファイルを添付"><Paperclip size={16} strokeWidth={2} /></button>
                        <textarea className="form-textarea" value={body}
                            onChange={e => setBody(e.target.value)} onKeyDown={handleKeyDown}
                            placeholder="メッセージを入力（Enterで送信）" rows={2}
                            style={{ flex: 1, resize: 'none', fontSize: 'var(--font-size-sm)' }} />
                        <button className="btn btn-primary" onClick={handleSend}
                            disabled={sending || (!body.trim() && !attachment)}
                            style={{ minWidth: 60, fontSize: 'var(--font-size-sm)' }}>
                            {sending ? '...' : '送信'}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

/* ============================================
   メインコンポーネント: 2カラムレイアウト
   ============================================ */
export default function MessagesListPage() {
    const { user } = useAuth();
    const toast = useToast();
    const { applicationId } = useParams();
    const navigate = useNavigate();
    const [conversations, setConversations] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

    useEffect(() => {
        const handleResize = () => setIsMobile(window.innerWidth < 768);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    useEffect(() => {
        api.get('/messages/conversations')
            .then(res => setConversations(res.data))
            .catch(() => toast.error('会話の取得に失敗しました'))
            .finally(() => setLoading(false));
    }, []);

    // 会話選択時にURLも更新 & 未読カウントをリセット
    const selectConversation = useCallback((id) => {
        navigate(`/messages/${id}`);
        setConversations(prev => prev.map(c =>
            c.application_id === id ? { ...c, unread_count: 0 } : c
        ));
    }, [navigate]);

    const isCompany = user?.role === 'company';

    const filtered = conversations.filter(c => {
        if (!search.trim()) return true;
        const q = search.toLowerCase();
        return (
            c.job_title?.toLowerCase().includes(q) ||
            c.company_name?.toLowerCase().includes(q) ||
            c.applicant_name?.toLowerCase().includes(q)
        );
    });

    const totalUnread = conversations.reduce((sum, c) => sum + (c.unread_count || 0), 0);

    // モバイル: 会話選択中は右パネルのみ表示
    const showListPanel = !isMobile || !applicationId;
    const showChatPanel = !isMobile || !!applicationId;

    return (
        <div className="container animate-fade-in" style={{ height: 'calc(100vh - 52px)', display: 'flex', flexDirection: 'column', paddingTop: 'var(--space-md)', paddingBottom: 'var(--space-md)', boxSizing: 'border-box', overflow: 'hidden' }}>
            {/* ヘッダー */}
            {showListPanel && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-md)', marginBottom: 'var(--space-md)', flexShrink: 0 }}>
                    <h1 style={{ fontSize: 'var(--font-size-2xl)', margin: 0 }}>
                        メッセージ
                        {totalUnread > 0 && (
                            <span style={{
                                marginLeft: 'var(--space-sm)', fontSize: 'var(--font-size-xs)',
                                background: 'var(--color-danger)', color: '#fff',
                                borderRadius: 'var(--radius-full)', padding: '2px 8px', verticalAlign: 'middle',
                            }}>{totalUnread}</span>
                        )}
                    </h1>
                </div>
            )}

            {/* メインエリア: 2カラム */}
            <div style={{
                flex: 1, display: 'flex', gap: 0, minHeight: 0,
                border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)',
                overflow: 'hidden', background: 'var(--color-bg-surface)',
            }}>
                {/* 左パネル: 会話リスト */}
                {showListPanel && (
                    <div style={{
                        width: isMobile ? '100%' : 340, flexShrink: 0,
                        display: 'flex', flexDirection: 'column',
                        borderRight: isMobile ? 'none' : '1px solid var(--color-border)',
                        height: '100%',
                    }}>
                        {/* 検索 */}
                        <div style={{ padding: 'var(--space-sm)', borderBottom: '1px solid var(--color-border)', flexShrink: 0 }}>
                            <input type="text" className="form-input"
                                placeholder="検索..."
                                value={search} onChange={e => setSearch(e.target.value)}
                                style={{ width: '100%', fontSize: 'var(--font-size-sm)', padding: '6px 10px' }} />
                        </div>

                        {/* 会話リスト */}
                        <div style={{ flex: 1, overflowY: 'auto' }}>
                            {loading ? (
                                <div style={{ padding: 'var(--space-lg)' }}><div className="skeleton" style={{ height: 200 }} /></div>
                            ) : filtered.length === 0 ? (
                                <div style={{ textAlign: 'center', padding: 'var(--space-2xl)', color: 'var(--color-text-muted)' }}>
                                    <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 'var(--space-sm)', opacity: 0.4 }}><MessageSquare size={32} strokeWidth={1.5} /></div>
                                    <p style={{ fontSize: 'var(--font-size-sm)' }}>
                                        {search ? '該当なし' : 'メッセージはまだありません'}
                                    </p>
                                </div>
                            ) : (
                                filtered.map(conv => {
                                    const isActive = conv.application_id === parseInt(applicationId);
                                    return (
                                        <div key={conv.application_id}
                                            onClick={() => selectConversation(conv.application_id)}
                                            style={{
                                                padding: '12px var(--space-md)',
                                                display: 'flex', alignItems: 'center', gap: 'var(--space-sm)',
                                                cursor: 'pointer', transition: 'background 0.1s',
                                                borderBottom: '1px solid var(--color-border)',
                                                background: isActive ? 'rgba(18,28,52,0.05)' : conv.unread_count > 0 ? 'rgba(200,149,46,0.03)' : 'transparent',
                                                borderLeft: isActive ? '3px solid var(--color-navy)' : '3px solid transparent',
                                            }}
                                            onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = 'rgba(0,0,0,0.03)'; }}
                                            onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = conv.unread_count > 0 ? 'rgba(200,149,46,0.03)' : 'transparent'; }}
                                        >
                                            {/* アバター */}
                                            <div style={{
                                                width: 40, height: 40, borderRadius: '50%',
                                                background: isActive ? 'var(--color-navy)' : 'var(--color-text-muted)',
                                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                color: '#fff', fontWeight: 700, fontSize: 'var(--font-size-sm)',
                                                flexShrink: 0,
                                            }}>
                                                {isCompany ? (conv.applicant_name?.[0] || '?') : (conv.company_name?.[0] || '?')}
                                            </div>

                                            {/* 内容 */}
                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 }}>
                                                    <span style={{
                                                        fontWeight: conv.unread_count > 0 ? 700 : 500,
                                                        fontSize: 'var(--font-size-sm)',
                                                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1,
                                                    }}>
                                                        {isCompany ? conv.applicant_name : conv.company_name}
                                                    </span>
                                                    {conv.last_message && (
                                                        <span style={{ fontSize: 10, color: 'var(--color-text-muted)', flexShrink: 0, marginLeft: 4 }}>
                                                            {formatTime(conv.last_message.created_at)}
                                                        </span>
                                                    )}
                                                </div>
                                                <div style={{
                                                    fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)',
                                                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: 2,
                                                }}>
                                                    {conv.job_title}
                                                    {conv.type === 'scout' && ' [スカウト]'}
                                                </div>
                                                {conv.last_message && (
                                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                                        <span style={{
                                                            fontSize: 'var(--font-size-xs)',
                                                            color: conv.unread_count > 0 ? 'var(--color-text-primary)' : 'var(--color-text-muted)',
                                                            fontWeight: conv.unread_count > 0 ? 600 : 400,
                                                            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1,
                                                        }}>
                                                            {conv.last_message.has_attachment && <Paperclip size={12} strokeWidth={2} style={{ verticalAlign: 'middle', marginRight: 3 }} />}
                                                            {conv.last_message.sender_name}: {conv.last_message.body}
                                                        </span>
                                                        {conv.unread_count > 0 && (
                                                            <span style={{
                                                                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                                                                background: 'var(--color-accent)', color: '#fff',
                                                                borderRadius: 'var(--radius-full)',
                                                                minWidth: 18, height: 18, fontSize: 10, fontWeight: 700,
                                                                padding: '0 5px', marginLeft: 6, flexShrink: 0,
                                                            }}>
                                                                {conv.unread_count > 99 ? '99+' : conv.unread_count}
                                                            </span>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </div>
                )}

                {/* 右パネル: メッセージ本文 */}
                {showChatPanel && (
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, height: '100%' }}>
                        {applicationId ? (
                            <ChatPanel
                                applicationId={applicationId}
                                onBack={isMobile ? () => navigate('/messages') : null}
                            />
                        ) : (
                            <div style={{
                                flex: 1, display: 'flex', flexDirection: 'column',
                                alignItems: 'center', justifyContent: 'center',
                                color: 'var(--color-text-muted)',
                            }}>
                                <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 'var(--space-md)', opacity: 0.3 }}><MessageSquare size={64} strokeWidth={1.5} /></div>
                                <p style={{ fontSize: 'var(--font-size-md)' }}>会話を選択してください</p>
                                <p style={{ fontSize: 'var(--font-size-xs)' }}>左のリストからメッセージを選んで開始</p>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
