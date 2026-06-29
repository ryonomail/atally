import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, MessageSquare, Paperclip } from 'lucide-react';
import api from '../api';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../hooks/useToast';

const formatFileSize = (bytes) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
};

export default function MessagePage() {
    const toast = useToast();
    const { applicationId } = useParams();
    const { user } = useAuth();
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
        loadData();
        // ポーリング: 5秒ごとにメッセージ更新
        const interval = setInterval(loadMessages, 5000);
        return () => clearInterval(interval);
    }, [applicationId]);

    useEffect(() => {
        if (messages.length === 0) return;
        const container = messagesContainerRef.current;
        if (!container) return;
        const isInitialLoad = prevMessageCountRef.current === 0;
        // コンテナ内のみスクロール（ページ全体を動かさない）
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
                api.get('/my-applications'),
            ]);
            setMessages(msgRes.data.data || []);
            const app = appRes.data.find(a => a.id === parseInt(applicationId));
            setApplication(app || null);
        } catch (err) {
            toast.error('メッセージの取得に失敗しました');
            navigate('/messages');
        } finally {
            setLoading(false);
        }
    };

    const loadMessages = async () => {
        try {
            const res = await api.get(`/applications/${applicationId}/messages`);
            setMessages(res.data.data || []);
        } catch (err) {
            // silent fail for polling
        }
    };

    const handleFileSelect = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const allowedTypes = ['application/pdf', 'application/msword',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'image/jpeg', 'image/png'];
        const allowedExts = ['pdf', 'doc', 'docx', 'jpg', 'jpeg', 'png'];
        const ext = file.name.split('.').pop().toLowerCase();

        if (!allowedTypes.includes(file.type) && !allowedExts.includes(ext)) {
            toast.error('対応形式: PDF, DOC, DOCX, JPG, PNG');
            return;
        }
        if (file.size > 10 * 1024 * 1024) {
            toast.error('ファイルサイズは10MB以下にしてください');
            return;
        }
        setAttachment(file);
        // リセットしてもう一度同じファイルを選択可能にする
        e.target.value = '';
    };

    const handleRemoveAttachment = () => {
        setAttachment(null);
    };

    const handleSend = async () => {
        if (!body.trim() && !attachment) return;
        setSending(true);
        try {
            const formData = new FormData();
            formData.append('body', body.trim() || (attachment ? attachment.name : ''));
            if (attachment) {
                formData.append('attachment', attachment);
            }
            const res = await api.post(`/applications/${applicationId}/messages`, formData);
            setMessages([...messages, res.data.message]);
            setBody('');
            setAttachment(null);
        } catch (err) {
            const msg = err.response?.data?.message || 'メッセージの送信に失敗しました';
            toast.error(msg);
        } finally {
            setSending(false);
        }
    };

    const handleDownloadAttachment = async (messageId, fileName) => {
        try {
            const res = await api.get(`/messages/${messageId}/attachment`, {
                responseType: 'blob',
            });
            const url = window.URL.createObjectURL(new Blob([res.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', fileName);
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(url);
        } catch (err) {
            toast.error('ファイルのダウンロードに失敗しました');
        }
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    if (loading) return <div className="page container"><div className="skeleton" style={{ height: 400 }} /></div>;

    const isScoutPending = application?.type === 'scout' && application?.status === 'pending';

    return (
        <div className="container animate-fade-in" style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 52px)', paddingTop: 'var(--space-md)', paddingBottom: 'var(--space-md)', boxSizing: 'border-box', overflow: 'hidden' }}>
            {/* ヘッダー */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-md)', marginBottom: 'var(--space-md)', flexShrink: 0 }}>
                <button className="btn btn-secondary" onClick={() => navigate('/messages')} style={{ fontSize: 'var(--font-size-sm)', display: 'inline-flex', alignItems: 'center', gap: 6 }}><ArrowLeft size={16} strokeWidth={2} /> 戻る</button>
                <div>
                    <h2 style={{ margin: 0, fontSize: 'var(--font-size-xl)' }}>
                        {application?.job?.id ? (
                            <Link to={`/jobs/${application.job.id}`} style={{ color: 'inherit', textDecoration: 'none' }}>
                                {application.job.title || 'メッセージ'}
                            </Link>
                        ) : 'メッセージ'}
                    </h2>
                    <p style={{ margin: 0, fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
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
                background: 'var(--color-bg-surface)', borderRadius: 'var(--radius-md)',
                border: '1px solid var(--color-border)',
                display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)',
            }}>
                {messages.length === 0 && (
                    <div style={{ textAlign: 'center', padding: 'var(--space-3xl)', color: 'var(--color-text-muted)' }}>
                        <div style={{ marginBottom: 'var(--space-sm)', display: 'flex', justifyContent: 'center' }}>
                            <MessageSquare size={32} strokeWidth={1.5} style={{ color: 'var(--color-text-accent)', opacity: 0.5 }} />
                        </div>
                        <p>まだメッセージはありません</p>
                        {!isScoutPending && <p style={{ fontSize: 'var(--font-size-xs)' }}>最初のメッセージを送ってみましょう</p>}
                    </div>
                )}

                {messages.map(msg => {
                    const isMe = msg.sender_id === user?.id;
                    return (
                        <div key={msg.id} style={{
                            display: 'flex',
                            justifyContent: isMe ? 'flex-end' : 'flex-start',
                        }}>
                            <div style={{
                                maxWidth: '70%',
                                padding: '10px 14px',
                                borderRadius: isMe ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                                background: isMe ? 'var(--color-navy)' : 'var(--color-bg-elevated, #e8e8e8)',
                                color: isMe ? '#fff' : 'var(--color-text-primary)',
                                fontSize: 'var(--font-size-sm)',
                                lineHeight: 1.5,
                            }}>
                                {!isMe && (
                                    <div style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600, marginBottom: 2, opacity: 0.8 }}>
                                        {msg.sender?.name || '相手'}
                                    </div>
                                )}
                                <div style={{ whiteSpace: 'pre-wrap' }}>{msg.body}</div>
                                {msg.attachment_name && (
                                    <div
                                        onClick={() => handleDownloadAttachment(msg.id, msg.attachment_name)}
                                        style={{
                                            display: 'flex', alignItems: 'center', gap: 6,
                                            marginTop: 6, padding: '6px 10px',
                                            background: isMe ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.06)',
                                            borderRadius: 8, cursor: 'pointer',
                                            fontSize: 'var(--font-size-xs)',
                                        }}
                                    >
                                        <Paperclip size={14} strokeWidth={2} style={{ flexShrink: 0 }} />
                                        <span style={{ textDecoration: 'underline', wordBreak: 'break-all' }}>
                                            {msg.attachment_name}
                                        </span>
                                    </div>
                                )}
                                <div style={{
                                    fontSize: '10px', marginTop: 4, textAlign: 'right',
                                    opacity: 0.6,
                                }}>
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
                    background: 'var(--color-bg-surface)', borderRadius: 'var(--radius-md)',
                    marginTop: 'var(--space-sm)', border: '1px solid var(--color-border)',
                    color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-sm)',
                }}>
                    スカウトを承諾するとメッセージを送信できます。
                    <button className="btn btn-primary" style={{ marginLeft: 'var(--space-sm)', fontSize: 'var(--font-size-xs)' }}
                        onClick={() => navigate('/applications')}>
                        スカウト管理へ
                    </button>
                </div>
            ) : (
                <div style={{ marginTop: 'var(--space-sm)', flexShrink: 0 }}>
                    {/* 添付プレビュー */}
                    {attachment && (
                        <div style={{
                            display: 'flex', alignItems: 'center', gap: 8,
                            padding: '6px 12px', marginBottom: 6,
                            background: 'var(--color-bg-surface)', border: '1px solid var(--color-border)',
                            borderRadius: 'var(--radius-sm)', fontSize: 'var(--font-size-xs)',
                        }}>
                            <Paperclip size={14} strokeWidth={2} style={{ color: 'var(--color-text-secondary)', flexShrink: 0 }} />
                            <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {attachment.name}
                            </span>
                            <span style={{ color: 'var(--color-text-muted)', flexShrink: 0 }}>
                                {formatFileSize(attachment.size)}
                            </span>
                            <button
                                onClick={handleRemoveAttachment}
                                style={{
                                    background: 'none', border: 'none', cursor: 'pointer',
                                    color: 'var(--color-text-muted)', fontSize: '16px', padding: '0 4px',
                                    lineHeight: 1,
                                }}
                                title="添付を削除"
                            >
                                ✕
                            </button>
                        </div>
                    )}
                    <div style={{ display: 'flex', gap: 'var(--space-sm)' }}>
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                            onChange={handleFileSelect}
                            style={{ display: 'none' }}
                        />
                        <button
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            style={{
                                alignSelf: 'flex-end', background: 'none', border: '1px solid var(--color-border)',
                                borderRadius: 'var(--radius-sm)', padding: '8px 10px', cursor: 'pointer',
                                lineHeight: 1, display: 'inline-flex', alignItems: 'center',
                            }}
                            title="ファイルを添付（PDF, DOC, JPG, PNG / 10MB以下）"
                        >
                            <Paperclip size={18} strokeWidth={2} style={{ color: 'var(--color-text-secondary)' }} />
                        </button>
                        <textarea
                            className="form-textarea"
                            value={body}
                            onChange={e => setBody(e.target.value)}
                            onKeyDown={handleKeyDown}
                            placeholder="メッセージを入力（Enterで送信、Shift+Enterで改行）"
                            rows={2}
                            style={{ flex: 1, resize: 'none' }}
                        />
                        <button className="btn btn-primary" onClick={handleSend}
                            disabled={sending || (!body.trim() && !attachment)}
                            style={{ alignSelf: 'flex-end', minWidth: 80 }}>
                            {sending ? '...' : '送信'}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
