import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import api from '../api';

export default function CompanyProfilePage() {
    const { id } = useParams();
    const navigate = useNavigate();
    const [company, setCompany] = useState(null);
    const [jobs, setJobs] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        api.get(`/companies/${id}/profile`)
            .then(res => {
                setCompany(res.data.company);
                setJobs(res.data.jobs);
            })
            .catch(() => navigate('/jobs'))
            .finally(() => setLoading(false));
    }, [id]);

    if (loading) return <div className="page container"><div className="skeleton" style={{ height: 400 }} /></div>;
    if (!company) return null;

    const infoItems = [
        { label: '業種', value: company.industry },
        { label: '従業員数', value: company.number_of_employees },
        { label: '設立年', value: company.founded_year },
        { label: '所在地', value: company.office_address || company.address },
        { label: '最寄り駅', value: company.nearest_station },
        { label: '売上高', value: company.revenue },
        { label: '資本金', value: company.capital },
        { label: 'Webサイト', value: company.website, isLink: true },
    ].filter(i => i.value);

    return (
        <div className="page container" style={{ maxWidth: 900, padding: 'var(--space-xl) var(--space-md)' }}>
            {/* ヘッダー */}
            <div className="card" style={{ padding: 'var(--space-xl)', marginBottom: 'var(--space-lg)' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--space-lg)' }}>
                    <div style={{
                        width: 72, height: 72, borderRadius: 12,
                        background: 'var(--color-navy)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 28, fontWeight: 700, color: '#fff', flexShrink: 0,
                    }}>
                        {company.company_name?.charAt(0)}
                    </div>
                    <div style={{ flex: 1 }}>
                        <h1 style={{ fontSize: 'var(--font-size-xl)', fontWeight: 700, marginBottom: 4, color: 'var(--color-navy)' }}>
                            {company.company_name}
                        </h1>
                        {company.industry && (
                            <span className="badge badge-info" style={{ fontSize: 'var(--font-size-xs)' }}>
                                {company.industry}
                            </span>
                        )}
                        <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', marginTop: 'var(--space-sm)', lineHeight: 1.8 }}>
                            {company.description}
                        </p>
                    </div>
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 'var(--space-lg)' }}>
                {/* メインコンテンツ */}
                <div>
                    {/* 企業文化 */}
                    {company.company_culture && (
                        <div className="card" style={{ padding: 'var(--space-lg)', marginBottom: 'var(--space-lg)' }}>
                            <h2 style={{ fontSize: 'var(--font-size-base)', fontWeight: 700, marginBottom: 'var(--space-md)', paddingBottom: 'var(--space-xs)', borderBottom: '1px solid var(--color-border)', color: 'var(--color-navy)', display: 'flex', alignItems: 'center', gap: 8 }}>
                                <span style={{ width: 3, height: 14, background: 'var(--color-accent)', borderRadius: 2, flexShrink: 0 }} />
                                企業文化・社風
                            </h2>
                            <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', lineHeight: 1.8, whiteSpace: 'pre-wrap' }}>
                                {company.company_culture}
                            </p>
                        </div>
                    )}

                    {/* 職場環境 */}
                    {company.work_environment && (
                        <div className="card" style={{ padding: 'var(--space-lg)', marginBottom: 'var(--space-lg)' }}>
                            <h2 style={{ fontSize: 'var(--font-size-base)', fontWeight: 700, marginBottom: 'var(--space-md)', paddingBottom: 'var(--space-xs)', borderBottom: '1px solid var(--color-border)', color: 'var(--color-navy)', display: 'flex', alignItems: 'center', gap: 8 }}>
                                <span style={{ width: 3, height: 14, background: 'var(--color-accent)', borderRadius: 2, flexShrink: 0 }} />
                                職場環境
                            </h2>
                            <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', lineHeight: 1.8, whiteSpace: 'pre-wrap' }}>
                                {company.work_environment}
                            </p>
                        </div>
                    )}

                    {/* 福利厚生 */}
                    {company.benefits_default && (
                        <div className="card" style={{ padding: 'var(--space-lg)', marginBottom: 'var(--space-lg)' }}>
                            <h2 style={{ fontSize: 'var(--font-size-base)', fontWeight: 700, marginBottom: 'var(--space-md)', paddingBottom: 'var(--space-xs)', borderBottom: '1px solid var(--color-border)', color: 'var(--color-navy)', display: 'flex', alignItems: 'center', gap: 8 }}>
                                <span style={{ width: 3, height: 14, background: 'var(--color-accent)', borderRadius: 2, flexShrink: 0 }} />
                                福利厚生
                            </h2>
                            <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', lineHeight: 1.8, whiteSpace: 'pre-wrap' }}>
                                {company.benefits_default}
                            </p>
                        </div>
                    )}

                    {/* 求人一覧 */}
                    <div className="card" style={{ padding: 'var(--space-lg)' }}>
                        <h2 style={{ fontSize: 'var(--font-size-base)', fontWeight: 700, marginBottom: 'var(--space-md)', paddingBottom: 'var(--space-xs)', borderBottom: '1px solid var(--color-border)', color: 'var(--color-navy)', display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ width: 3, height: 14, background: 'var(--color-accent)', borderRadius: 2, flexShrink: 0 }} />
                            募集中の求人 ({jobs.length}件)
                        </h2>
                        {jobs.length === 0 ? (
                            <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--font-size-sm)', padding: 'var(--space-lg) 0', textAlign: 'center' }}>
                                現在募集中の求人はありません
                            </p>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
                                {jobs.map(job => (
                                    <Link key={job.id} to={`/jobs/${job.id}`} style={{
                                        display: 'block', padding: 'var(--space-md)',
                                        border: '1px solid var(--color-border)', borderRadius: 8,
                                        textDecoration: 'none', color: 'inherit',
                                        transition: 'border-color 0.15s',
                                    }}
                                    onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--color-accent)'}
                                    onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--color-border)'}
                                    >
                                        <div style={{ fontWeight: 600, fontSize: 'var(--font-size-sm)', color: 'var(--color-text-primary)', marginBottom: 4 }}>
                                            {job.title}
                                        </div>
                                        <div style={{ display: 'flex', gap: 'var(--space-md)', fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
                                            {job.location && <span>{job.location}</span>}
                                            {job.employment_type && <span>{job.employment_type}</span>}
                                            {(job.salary_min || job.salary_max) && (
                                                <span>
                                                    {job.salary_min ? `${Number(job.salary_min).toLocaleString()}円` : ''}
                                                    {job.salary_min && job.salary_max ? '〜' : ''}
                                                    {job.salary_max ? `${Number(job.salary_max).toLocaleString()}円` : ''}
                                                </span>
                                            )}
                                        </div>
                                    </Link>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* サイドバー */}
                <div>
                    <div className="card" style={{ padding: 'var(--space-lg)', position: 'sticky', top: 80 }}>
                        <h3 style={{ fontSize: 'var(--font-size-sm)', fontWeight: 700, marginBottom: 'var(--space-md)' }}>
                            企業情報
                        </h3>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
                            {infoItems.map((item, i) => (
                                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--font-size-xs)', padding: 'var(--space-xs) 0', borderBottom: '1px solid rgba(0,0,0,0.04)' }}>
                                    <span style={{ color: 'var(--color-text-muted)', fontWeight: 600 }}>{item.label}</span>
                                    {item.isLink ? (
                                        <a href={item.value} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--color-accent)', textDecoration: 'none', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                            {item.value.replace(/^https?:\/\//, '')}
                                        </a>
                                    ) : (
                                        <span style={{ color: 'var(--color-text-secondary)', textAlign: 'right', maxWidth: 160 }}>{item.value}</span>
                                    )}
                                </div>
                            ))}
                        </div>

                        <div style={{ marginTop: 'var(--space-lg)', paddingTop: 'var(--space-md)', borderTop: '1px solid var(--color-border)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--font-size-xs)', marginBottom: 'var(--space-xs)' }}>
                                <span style={{ color: 'var(--color-text-muted)' }}>公開求人数</span>
                                <span style={{ fontWeight: 700, color: 'var(--color-accent)' }}>{jobs.length}件</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div style={{ marginTop: 'var(--space-xl)', textAlign: 'center' }}>
                <Link to="/jobs" className="btn btn-secondary" style={{ fontSize: 'var(--font-size-sm)' }}>
                    求人検索に戻る
                </Link>
            </div>
        </div>
    );
}
