import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Bookmark } from 'lucide-react';
import api from '../api';
import { useToast } from '../hooks/useToast';

export default function SavedJobsPage() {
    const toast = useToast();
    const [jobs, setJobs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [sortOrder, setSortOrder] = useState('saved'); // 'saved' | 'newest' | 'salary_desc'

    useEffect(() => {
        api.get('/saved-jobs')
            .then(res => setJobs(res.data || []))
            .catch(() => setJobs([]))
            .finally(() => setLoading(false));
    }, []);

    const handleRemove = async (jobId) => {
        try {
            await api.delete(`/saved-jobs/${jobId}`);
            setJobs(jobs.filter(j => j.id !== jobId));
        } catch {
            toast.error('解除に失敗しました');
        }
    };

    if (loading) return <div className="page container"><div className="skeleton" style={{ height: 300 }} /></div>;

    return (
        <div className="page container animate-fade-in">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-xl)' }}>
                <h1 style={{ fontSize: 'var(--font-size-3xl)' }}>保存した求人</h1>
                <Link to="/jobs" className="btn btn-secondary" style={{ fontSize: 'var(--font-size-sm)' }}>求人を探す</Link>
            </div>

            {jobs.length > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)', marginBottom: 'var(--space-md)' }}>
                    <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>並び替え:</span>
                    {[
                        { key: 'saved', label: '保存順' },
                        { key: 'newest', label: '新着順' },
                        { key: 'salary_desc', label: '給与高い順' },
                    ].map(opt => (
                        <button key={opt.key} onClick={() => setSortOrder(opt.key)} style={{
                            padding: '4px 12px',
                            borderRadius: 'var(--radius-full)',
                            border: sortOrder === opt.key ? '1.5px solid var(--color-navy)' : '1px solid var(--color-border)',
                            background: sortOrder === opt.key ? 'var(--color-navy)' : 'transparent',
                            color: sortOrder === opt.key ? '#fff' : 'var(--color-text-secondary)',
                            fontSize: 'var(--font-size-xs)',
                            cursor: 'pointer',
                            fontWeight: sortOrder === opt.key ? 600 : 400,
                            transition: 'all 0.15s',
                        }}>
                            {opt.label}
                        </button>
                    ))}
                </div>
            )}

            {jobs.length === 0 ? (
                <div className="card" style={{ textAlign: 'center', padding: 'var(--space-3xl)' }}>
                    <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 'var(--space-md)' }}>
                        <Bookmark size={40} strokeWidth={1.5} color="var(--color-text-accent)" />
                    </div>
                    <h3 style={{ marginBottom: 'var(--space-sm)' }}>保存した求人はありません</h3>
                    <p style={{ color: 'var(--color-text-secondary)', marginBottom: 'var(--space-lg)' }}>
                        気になる求人を保存しておくと、後で簡単に見返せます
                    </p>
                    <Link to="/jobs" className="btn btn-primary">求人を探す</Link>
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
                    <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)' }}>
                        {jobs.length}件の保存済み求人
                    </p>
                    {[...jobs].sort((a, b) => {
                        if (sortOrder === 'newest') return new Date(b.created_at) - new Date(a.created_at);
                        if (sortOrder === 'salary_desc') return (b.salary_max || b.salary_min || 0) - (a.salary_max || a.salary_min || 0);
                        return 0; // saved order = original
                    }).map(job => (
                        <div key={job.id} className="card card-glow">
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                <div style={{ flex: 1 }}>
                                    <Link to={`/jobs/${job.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                                        <h3 style={{ marginBottom: 'var(--space-xs)', fontSize: 'var(--font-size-md)' }}>
                                            {job.title}
                                        </h3>
                                    </Link>
                                    <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', marginBottom: 'var(--space-xs)' }}>
                                        {job.company?.company_name || '企業名'}
                                    </p>
                                    <div style={{ display: 'flex', gap: 'var(--space-xs)', flexWrap: 'wrap' }}>
                                        {job.location && (
                                            <span className="badge badge-info" style={{ fontSize: 'var(--font-size-xs)' }}>
                                                {job.location}
                                            </span>
                                        )}
                                        {job.employment_type && (
                                            <span className="badge badge-info" style={{ fontSize: 'var(--font-size-xs)' }}>
                                                {job.employment_type}
                                            </span>
                                        )}
                                        {(job.salary_min || job.salary_max) && (
                                            <span className="badge badge-info" style={{ fontSize: 'var(--font-size-xs)' }}>
                                                {job.salary_min ? `${Math.round(job.salary_min / 10000)}万` : ''}
                                                〜
                                                {job.salary_max ? `${Math.round(job.salary_max / 10000)}万円` : ''}
                                            </span>
                                        )}
                                    </div>
                                </div>
                                <div style={{ display: 'flex', gap: 'var(--space-sm)', alignItems: 'center', flexShrink: 0, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                                    <Link to={`/jobs/${job.id}#apply`} className="btn btn-primary" style={{ fontSize: 'var(--font-size-xs)' }}>
                                        応募する
                                    </Link>
                                    <Link to={`/jobs/${job.id}`} className="btn btn-secondary" style={{ fontSize: 'var(--font-size-xs)' }}>
                                        詳細
                                    </Link>
                                    <button
                                        className="btn btn-secondary"
                                        style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-error)', borderColor: 'rgba(255,59,48,0.3)' }}
                                        onClick={() => handleRemove(job.id)}
                                        title="保存を解除"
                                    >
                                        ✕
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
