import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';
import { useToast } from '../hooks/useToast';

const EMPTY_FORM = {
    client_name: '',
    client_description: '',
    contact_person: '',
    contact_email: '',
    contact_phone: '',
    address: '',
};

/* ============================================
   モーダル（追加/編集フォーム）
   ============================================ */
function ClientFormModal({ client, onClose, onSaved }) {
    const isEdit = !!client?.id;
    const [form, setForm] = useState(isEdit ? {
        client_name: client.client_name || '',
        client_description: client.client_description || '',
        contact_person: client.contact_person || '',
        contact_email: client.contact_email || '',
        contact_phone: client.contact_phone || '',
        address: client.address || '',
    } : { ...EMPTY_FORM });
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');

    const handleChange = (field, value) => {
        setForm(prev => ({ ...prev, [field]: value }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!form.client_name.trim()) {
            setError('クライアント名は必須です');
            return;
        }
        setSubmitting(true);
        setError('');
        try {
            if (isEdit) {
                await api.put(`/agency/clients/${client.id}`, form);
            } else {
                await api.post('/agency/clients', form);
            }
            onSaved();
        } catch (err) {
            setError(err.response?.data?.message || '保存に失敗しました');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div style={{
            position: 'fixed', inset: 0, zIndex: 1000,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'rgba(0,0,0,0.5)',
        }} onClick={onClose}>
            <div className="card" style={{
                width: '100%', maxWidth: 560, maxHeight: '90vh', overflowY: 'auto',
                margin: 'var(--space-md)',
            }} onClick={e => e.stopPropagation()}>
                <h2 style={{ fontSize: 'var(--font-size-xl)', marginBottom: 'var(--space-lg)' }}>
                    {isEdit ? 'クライアントを編集' : '新規クライアント'}
                </h2>

                {error && (
                    <div style={{
                        padding: 'var(--space-md)', marginBottom: 'var(--space-md)',
                        background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)',
                        borderRadius: 'var(--radius-md)', fontSize: 'var(--font-size-sm)', color: '#dc2626',
                    }}>
                        {error}
                    </div>
                )}

                <form onSubmit={handleSubmit}>
                    <div className="form-group">
                        <label className="form-label">クライアント名 *</label>
                        <input
                            className="form-input"
                            type="text"
                            placeholder="例: 株式会社サンプル"
                            value={form.client_name}
                            onChange={e => handleChange('client_name', e.target.value)}
                            required
                        />
                    </div>

                    <div className="form-group">
                        <label className="form-label">説明</label>
                        <textarea
                            className="form-input"
                            rows={3}
                            placeholder="クライアントの概要や特徴"
                            value={form.client_description}
                            onChange={e => handleChange('client_description', e.target.value)}
                        />
                    </div>

                    <div className="form-group">
                        <label className="form-label">担当者名</label>
                        <input
                            className="form-input"
                            type="text"
                            placeholder="例: 田中太郎"
                            value={form.contact_person}
                            onChange={e => handleChange('contact_person', e.target.value)}
                        />
                    </div>

                    <div className="form-group">
                        <label className="form-label">メールアドレス</label>
                        <input
                            className="form-input"
                            type="email"
                            placeholder="例: tanaka@example.com"
                            value={form.contact_email}
                            onChange={e => handleChange('contact_email', e.target.value)}
                        />
                    </div>

                    <div className="form-group">
                        <label className="form-label">電話番号</label>
                        <input
                            className="form-input"
                            type="tel"
                            placeholder="例: 03-1234-5678"
                            value={form.contact_phone}
                            onChange={e => handleChange('contact_phone', e.target.value)}
                        />
                    </div>

                    <div className="form-group">
                        <label className="form-label">住所</label>
                        <input
                            className="form-input"
                            type="text"
                            placeholder="例: 東京都渋谷区..."
                            value={form.address}
                            onChange={e => handleChange('address', e.target.value)}
                        />
                    </div>

                    <div style={{ display: 'flex', gap: 'var(--space-md)', justifyContent: 'flex-end', marginTop: 'var(--space-lg)' }}>
                        <button type="button" className="btn btn-secondary" onClick={onClose} disabled={submitting}>
                            キャンセル
                        </button>
                        <button type="submit" className="btn btn-primary" disabled={submitting}>
                            {submitting ? '保存中...' : (isEdit ? '更新する' : '追加する')}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

/* ============================================
   削除確認モーダル
   ============================================ */
function DeleteConfirmModal({ client, onClose, onConfirm, deleting }) {
    return (
        <div style={{
            position: 'fixed', inset: 0, zIndex: 1000,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'rgba(0,0,0,0.5)',
        }} onClick={onClose}>
            <div className="card" style={{
                width: '100%', maxWidth: 420, margin: 'var(--space-md)',
            }} onClick={e => e.stopPropagation()}>
                <h2 style={{ fontSize: 'var(--font-size-xl)', marginBottom: 'var(--space-md)' }}>
                    削除の確認
                </h2>
                <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', marginBottom: 'var(--space-lg)' }}>
                    「{client.client_name}」を削除しますか？この操作は取り消せません。
                </p>
                <div style={{ display: 'flex', gap: 'var(--space-md)', justifyContent: 'flex-end' }}>
                    <button className="btn btn-secondary" onClick={onClose} disabled={deleting}>
                        キャンセル
                    </button>
                    <button
                        className="btn btn-primary"
                        style={{ background: '#dc2626', borderColor: '#dc2626' }}
                        onClick={onConfirm}
                        disabled={deleting}
                    >
                        {deleting ? '削除中...' : '削除する'}
                    </button>
                </div>
            </div>
        </div>
    );
}

/* ============================================
   メインコンポーネント
   ============================================ */
export default function AgencyClientsPage() {
    const toast = useToast();
    const [clients, setClients] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [formModal, setFormModal] = useState(null); // null | {} (new) | client (edit)
    const [deleteModal, setDeleteModal] = useState(null); // null | client
    const [deleting, setDeleting] = useState(false);
    const navigate = useNavigate();

    const fetchClients = async () => {
        setLoading(true);
        setError('');
        try {
            const { data } = await api.get('/agency/clients');
            setClients(Array.isArray(data) ? data : data.data || []);
        } catch (err) {
            setError(err.response?.data?.message || 'クライアントの取得に失敗しました');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchClients(); }, []);

    const handleDelete = async () => {
        if (!deleteModal) return;
        setDeleting(true);
        try {
            await api.delete(`/agency/clients/${deleteModal.id}`);
            setDeleteModal(null);
            await fetchClients();
        } catch (err) {
            toast.error(err.response?.data?.message || '削除に失敗しました');
        } finally {
            setDeleting(false);
        }
    };

    const handleSaved = () => {
        setFormModal(null);
        fetchClients();
    };

    if (loading) {
        return (
            <div className="page container">
                <div className="skeleton" style={{ height: 400 }} />
            </div>
        );
    }

    return (
        <div className="page container animate-fade-in">
            {/* ヘッダー */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-md)', marginBottom: 'var(--space-xl)', flexWrap: 'wrap' }}>
                <button className="btn btn-secondary" onClick={() => navigate('/agency/dashboard')} style={{ fontSize: 'var(--font-size-sm)' }}>
                    ← 戻る
                </button>
                <h1 style={{ fontSize: 'var(--font-size-2xl)', margin: 0, flex: 1 }}>クライアント管理</h1>
                <button className="btn btn-primary" onClick={() => setFormModal({})}>
                    + 新規クライアント
                </button>
            </div>

            {/* エラー表示 */}
            {error && (
                <div style={{
                    padding: 'var(--space-md)', marginBottom: 'var(--space-lg)',
                    background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)',
                    borderRadius: 'var(--radius-md)', fontSize: 'var(--font-size-sm)', color: '#dc2626',
                }}>
                    {error}
                </div>
            )}

            {/* 空状態 */}
            {clients.length === 0 && !error && (
                <div className="card" style={{ textAlign: 'center', padding: 'var(--space-2xl)' }}>
                    <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--font-size-lg)', marginBottom: 'var(--space-md)' }}>
                        クライアントはまだ登録されていません
                    </p>
                    <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-sm)', marginBottom: 'var(--space-lg)' }}>
                        「新規クライアント」ボタンから最初のクライアントを追加しましょう。
                    </p>
                    <button className="btn btn-primary" onClick={() => setFormModal({})}>
                        + 新規クライアント
                    </button>
                </div>
            )}

            {/* クライアント一覧（カード） */}
            {clients.length > 0 && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 'var(--space-md)' }}>
                    {clients.map(client => (
                        <div key={client.id} className="card" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                <h3 style={{ fontSize: 'var(--font-size-lg)', margin: 0, wordBreak: 'break-word' }}>
                                    {client.client_name}
                                </h3>
                                <div style={{ display: 'flex', gap: 'var(--space-xs)', flexShrink: 0 }}>
                                    <button
                                        className="btn btn-secondary"
                                        style={{ fontSize: 'var(--font-size-xs)', padding: '4px 10px' }}
                                        onClick={() => setFormModal(client)}
                                    >
                                        編集
                                    </button>
                                    <button
                                        className="btn btn-secondary"
                                        style={{ fontSize: 'var(--font-size-xs)', padding: '4px 10px', color: '#dc2626' }}
                                        onClick={() => setDeleteModal(client)}
                                    >
                                        削除
                                    </button>
                                </div>
                            </div>

                            {client.client_description && (
                                <p style={{
                                    fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)',
                                    margin: 0, lineHeight: 1.5,
                                    display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
                                }}>
                                    {client.client_description}
                                </p>
                            )}

                            <div style={{ marginTop: 'auto', paddingTop: 'var(--space-sm)', borderTop: '1px solid var(--color-border)', fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
                                {client.contact_person && (
                                    <p style={{ margin: '2px 0' }}>担当者: {client.contact_person}</p>
                                )}
                                {client.contact_email && (
                                    <p style={{ margin: '2px 0' }}>メール: {client.contact_email}</p>
                                )}
                                {client.contact_phone && (
                                    <p style={{ margin: '2px 0' }}>電話: {client.contact_phone}</p>
                                )}
                                {client.address && (
                                    <p style={{ margin: '2px 0' }}>住所: {client.address}</p>
                                )}
                                {!client.contact_person && !client.contact_email && !client.contact_phone && !client.address && (
                                    <p style={{ margin: '2px 0', fontStyle: 'italic' }}>連絡先未登録</p>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* フォームモーダル */}
            {formModal !== null && (
                <ClientFormModal
                    client={formModal.id ? formModal : null}
                    onClose={() => setFormModal(null)}
                    onSaved={handleSaved}
                />
            )}

            {/* 削除確認モーダル */}
            {deleteModal && (
                <DeleteConfirmModal
                    client={deleteModal}
                    onClose={() => setDeleteModal(null)}
                    onConfirm={handleDelete}
                    deleting={deleting}
                />
            )}
        </div>
    );
}
