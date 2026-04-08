import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../api';
import { useToast } from '../hooks/useToast';

const EMPLOYMENT_TYPES = ['', '正社員', '契約社員', '派遣社員', 'パート・アルバイト', '業務委託', 'インターン'];

export default function JobAlertsPage() {
    const toast = useToast();
    const [alerts, setAlerts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [saving, setSaving] = useState(false);
    const [form, setForm] = useState({ keyword: '', location: '', employment_type: '', salary_min: '' });

    useEffect(() => {
        api.get('/job-alerts')
            .then(res => setAlerts(res.data || []))
            .catch(() => setAlerts([]))
            .finally(() => setLoading(false));
    }, []);

    const handleCreate = async (e) => {
        e.preventDefault();
        setSaving(true);
        try {
            const payload = {};
            if (form.keyword) payload.keyword = form.keyword;
            if (form.location) payload.location = form.location;
            if (form.employment_type) payload.employment_type = form.employment_type;
            if (form.salary_min) payload.salary_min = Number(form.salary_min);

            const res = await api.post('/job-alerts', payload);
            setAlerts([res.data, ...alerts]);
            setForm({ keyword: '', location: '', employment_type: '', salary_min: '' });
            setShowForm(false);
        } catch (err) {
            toast.error(err.response?.data?.message || 'アラートの作成に失敗しました');
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (alertId) => {
        if (!confirm('このアラートを削除しますか？')) return;
        try {
            await api.delete(`/job-alerts/${alertId}`);
            setAlerts(alerts.filter(a => a.id !== alertId));
        } catch {
            toast.error('削除に失敗しました');
        }
    };

    if (loading) return <div className="page container"><div className="skeleton" style={{ height: 300 }} /></div>;

    return (
        <div className="page container animate-fade-in">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-xl)' }}>
                <h1 style={{ fontSize: 'var(--font-size-3xl)' }}>求人アラート</h1>
                <button
                    className="btn btn-primary"
                    style={{ fontSize: 'var(--font-size-sm)' }}
                    onClick={() => setShowForm(!showForm)}
                >
                    {showForm ? 'キャンセル' : '+ 新しいアラート'}
                </button>
            </div>

            <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-sm)', marginBottom: 'var(--space-lg)' }}>
                条件を設定すると、マッチする新着求人が掲載されたときに通知を受け取れます。
            </p>

            {/* 作成フォーム */}
            {showForm && (
                <div className="card" style={{ marginBottom: 'var(--space-lg)' }}>
                    <h3 style={{ marginBottom: 'var(--space-md)', fontSize: 'var(--font-size-md)' }}>アラート条件を設定</h3>
                    <form onSubmit={handleCreate}>
                        <div className="grid grid-2" style={{ gap: 'var(--space-md)', marginBottom: 'var(--space-md)' }}>
                            <div className="form-group" style={{ margin: 0 }}>
                                <label className="form-label" style={{ fontSize: 'var(--font-size-sm)' }}>キーワード</label>
                                <input
                                    className="form-input"
                                    placeholder="例: エンジニア、営業"
                                    value={form.keyword}
                                    onChange={e => setForm({ ...form, keyword: e.target.value })}
                                />
                            </div>
                            <div className="form-group" style={{ margin: 0 }}>
                                <label className="form-label" style={{ fontSize: 'var(--font-size-sm)' }}>勤務地</label>
                                <input
                                    className="form-input"
                                    placeholder="例: 東京都、大阪府"
                                    value={form.location}
                                    onChange={e => setForm({ ...form, location: e.target.value })}
                                />
                            </div>
                            <div className="form-group" style={{ margin: 0 }}>
                                <label className="form-label" style={{ fontSize: 'var(--font-size-sm)' }}>雇用形態</label>
                                <select
                                    className="form-select"
                                    value={form.employment_type}
                                    onChange={e => setForm({ ...form, employment_type: e.target.value })}
                                >
                                    <option value="">指定なし</option>
                                    {EMPLOYMENT_TYPES.filter(t => t).map(t => (
                                        <option key={t} value={t}>{t}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="form-group" style={{ margin: 0 }}>
                                <label className="form-label" style={{ fontSize: 'var(--font-size-sm)' }}>最低年収（万円）</label>
                                <input
                                    className="form-input"
                                    type="number"
                                    placeholder="例: 400"
                                    value={form.salary_min}
                                    onChange={e => setForm({ ...form, salary_min: e.target.value })}
                                    min="0"
                                />
                            </div>
                        </div>
                        <button type="submit" className="btn btn-primary" disabled={saving}>
                            {saving ? '作成中...' : 'アラートを作成'}
                        </button>
                    </form>
                </div>
            )}

            {/* アラート一覧 */}
            {alerts.length === 0 ? (
                <div className="card" style={{ textAlign: 'center', padding: 'var(--space-3xl)' }}>
                    <div style={{ fontSize: '3rem', marginBottom: 'var(--space-md)' }}>🔔</div>
                    <h3 style={{ marginBottom: 'var(--space-sm)' }}>アラートがありません</h3>
                    <p style={{ color: 'var(--color-text-secondary)', marginBottom: 'var(--space-lg)' }}>
                        求人アラートを作成すると、条件に合う新着求人を見逃しません
                    </p>
                    {!showForm && (
                        <button className="btn btn-primary" onClick={() => setShowForm(true)}>
                            アラートを作成する
                        </button>
                    )}
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
                    <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)' }}>
                        {alerts.length}件のアラート
                    </p>
                    {alerts.map(alert => (
                        <div key={alert.id} className="card">
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                <div style={{ flex: 1 }}>
                                    <div style={{ display: 'flex', gap: 'var(--space-sm)', flexWrap: 'wrap', marginBottom: 'var(--space-sm)' }}>
                                        {alert.keyword && (
                                            <span className="badge badge-info" style={{ fontSize: 'var(--font-size-xs)' }}>
                                                {alert.keyword}
                                            </span>
                                        )}
                                        {alert.location && (
                                            <span className="badge badge-info" style={{ fontSize: 'var(--font-size-xs)' }}>
                                                {alert.location}
                                            </span>
                                        )}
                                        {alert.employment_type && (
                                            <span className="badge badge-info" style={{ fontSize: 'var(--font-size-xs)' }}>
                                                {alert.employment_type}
                                            </span>
                                        )}
                                        {alert.salary_min && (
                                            <span className="badge badge-info" style={{ fontSize: 'var(--font-size-xs)' }}>
                                                {Math.round(alert.salary_min / 10000)}万円〜
                                            </span>
                                        )}
                                        {!alert.keyword && !alert.location && !alert.employment_type && !alert.salary_min && (
                                            <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)' }}>
                                                全求人を通知
                                            </span>
                                        )}
                                    </div>
                                    <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
                                        作成日: {new Date(alert.created_at).toLocaleDateString('ja-JP')}
                                    </p>
                                </div>
                                <button
                                    className="btn btn-secondary"
                                    style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-error)', flexShrink: 0 }}
                                    onClick={() => handleDelete(alert.id)}
                                >
                                    削除
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
