import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../api';
import { useToast } from '../hooks/useToast';
import SEO from '../components/SEO';
import { formatSalary } from '../utils/salary';

export default function LandingPage() {
    const navigate = useNavigate();
    const toast = useToast();
    const [keyword, setKeyword] = useState('');
    const [location, setLocation] = useState('');
    const [featuredJobs, setFeaturedJobs] = useState([]);
    const [jobsLoading, setJobsLoading] = useState(true);

    useEffect(() => {
        api.get('/jobs', { params: { per_page: 6 } })
            .then(res => setFeaturedJobs(res.data.data || []))
            .catch(() => toast.error('求人情報の取得に失敗しました'))
            .finally(() => setJobsLoading(false));
    }, []);

    const handleSearch = (e) => {
        e.preventDefault();
        const params = new URLSearchParams();
        if (keyword) params.set('keyword', keyword);
        if (location) params.set('location', location);
        navigate(`/jobs?${params.toString()}`);
    };

    const websiteJsonLd = {
        '@context': 'https://schema.org',
        '@type': 'WebSite',
        name: 'Atally',
        url: window.location.origin,
        description: '品質重視の次世代求人マッチングプラットフォーム',
        potentialAction: {
            '@type': 'SearchAction',
            target: `${window.location.origin}/jobs?q={search_term_string}`,
            'query-input': 'required name=search_term_string',
        },
    };

    return (
        <div className="page">
            <SEO
                title={null}
                description="登録不要・完全無料で履歴書が作れる求人サイト。47万件以上の求人掲載中（ハローワーク求人含む）。作成した履歴書でそのまま応募できます。ブラック求人ゼロ・職業安定法準拠。"
                jsonLd={websiteJsonLd}
            />

            {/* ── Hero ── */}
            <section style={{
                padding: 'var(--space-3xl) 0 var(--space-2xl)',
                position: 'relative',
                overflow: 'hidden',
            }}>
                <div style={{
                    position: 'absolute', inset: 0,
                    background: 'radial-gradient(ellipse 80% 60% at 50% 0%, rgba(18,28,52,0.12) 0%, transparent 70%)',
                    pointerEvents: 'none',
                }} />

                <div className="container animate-slide-up" style={{ textAlign: 'center', position: 'relative' }}>
                    <div style={{
                        display: 'inline-block',
                        padding: '4px 16px',
                        background: 'rgba(18,28,52,0.12)',
                        border: '1px solid rgba(18,28,52,0.25)',
                        borderRadius: 'var(--radius-full)',
                        fontSize: 'var(--font-size-xs)',
                        color: 'var(--color-text-accent)',
                        marginBottom: 'var(--space-lg)',
                        fontWeight: 600,
                    }}>
                        転職活動を、もっとシンプルに
                    </div>

                    <h1 style={{
                        fontSize: 'clamp(2rem, 5vw, 3.5rem)',
                        fontWeight: 800,
                        lineHeight: 1.2,
                        marginBottom: 'var(--space-md)',
                    }}>
                        求人を探す<br />
                        <span style={{
                            background: 'var(--gradient-accent)',
                            WebkitBackgroundClip: 'text',
                            WebkitTextFillColor: 'transparent',
                        }}>履歴書を作る</span><br />
                        すべて無料
                    </h1>

                    <p style={{
                        fontSize: 'var(--font-size-lg)',
                        color: 'var(--color-text-secondary)',
                        maxWidth: 560,
                        margin: '0 auto var(--space-xl)',
                        lineHeight: 1.7,
                    }}>
                        登録不要・完全無料で全求人を閲覧できます。<br />
                        ブラック求人ゼロ。法令準拠の求人のみ掲載。
                    </p>

                    {/* 安心バッジ */}
                    <div style={{ display: 'flex', justifyContent: 'center', gap: 'var(--space-xs)', marginBottom: 'var(--space-lg)', flexWrap: 'wrap' }}>
                        {[
                            { icon: '⚖️', label: '職業安定法準拠' },
                            { icon: '🔒', label: '個人情報保護' },
                            { icon: '✅', label: 'ブラック求人排除' },
                            { icon: '🆓', label: '求職者は完全無料' },
                        ].map((b, i) => (
                            <span key={i} style={{
                                display: 'inline-flex', alignItems: 'center', gap: 4,
                                padding: '4px 12px',
                                borderRadius: 'var(--radius-full)',
                                background: 'rgba(52,199,89,0.1)',
                                border: '1px solid rgba(52,199,89,0.3)',
                                fontSize: 'var(--font-size-xs)',
                                color: '#1d8f42',
                                fontWeight: 500,
                            }}>
                                {b.icon} {b.label}
                            </span>
                        ))}
                    </div>

                    {/* 検索バー */}
                    <form onSubmit={handleSearch} style={{
                        display: 'flex',
                        gap: 'var(--space-sm)',
                        flexWrap: 'wrap',
                        maxWidth: 700,
                        margin: '0 auto var(--space-xl)',
                    }}>
                        <div style={{ flex: '2 1 220px', position: 'relative' }}>
                            <span style={{
                                position: 'absolute', left: 14, top: '50%',
                                transform: 'translateY(-50%)', fontSize: 18, opacity: 0.45,
                            }}>🔍</span>
                            <input
                                type="text"
                                className="form-input"
                                placeholder="職種・スキル・会社名"
                                value={keyword}
                                onChange={e => setKeyword(e.target.value)}
                                style={{ paddingLeft: 42, height: 52, fontSize: 'var(--font-size-base)' }}
                            />
                        </div>
                        <div style={{ flex: '1 1 160px', position: 'relative' }}>
                            <span style={{
                                position: 'absolute', left: 14, top: '50%',
                                transform: 'translateY(-50%)', fontSize: 18, opacity: 0.45,
                            }}>📍</span>
                            <input
                                type="text"
                                className="form-input"
                                placeholder="勤務地"
                                value={location}
                                onChange={e => setLocation(e.target.value)}
                                style={{ paddingLeft: 42, height: 52, fontSize: 'var(--font-size-base)' }}
                            />
                        </div>
                        <button
                            type="submit"
                            className="btn btn-primary"
                            style={{ height: 52, padding: '0 var(--space-xl)', fontSize: 'var(--font-size-base)', whiteSpace: 'nowrap', flex: '0 0 auto' }}
                        >
                            検索する
                        </button>
                    </form>


                    {/* カテゴリクイック選択 */}
                    <div style={{
                        display: 'flex', gap: 'var(--space-xs)', flexWrap: 'wrap',
                        justifyContent: 'center', marginBottom: 'var(--space-xl)',
                    }}>
                        {[
                            { icon: '💻', label: 'IT・エンジニア', q: 'エンジニア' },
                            { icon: '📊', label: '営業', q: '営業' },
                            { icon: '🎨', label: 'デザイン', q: 'デザイナー' },
                            { icon: '💼', label: '経営・企画', q: '経営企画' },
                            { icon: '🏥', label: '医療・介護', q: '医療' },
                            { icon: '📚', label: '教育', q: '教育' },
                            { icon: '🏗️', label: '建設・不動産', q: '建設' },
                            { icon: '🛒', label: '販売・接客', q: '販売' },
                        ].map((cat, i) => (
                            <button key={i}
                                onClick={() => navigate(`/jobs?keyword=${encodeURIComponent(cat.q)}`)}
                                style={{
                                    display: 'inline-flex', alignItems: 'center', gap: 4,
                                    padding: '5px 12px', borderRadius: 'var(--radius-full)',
                                    border: '1px solid var(--color-border)',
                                    background: 'var(--color-bg-glass)', cursor: 'pointer',
                                    fontSize: 'var(--font-size-xs)', fontWeight: 500,
                                    color: 'var(--color-text-secondary)',
                                    transition: 'all 0.15s',
                                    backdropFilter: 'blur(8px)',
                                }}
                                onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--color-accent)'; e.currentTarget.style.color = 'var(--color-text-accent)'; }}
                                onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--color-border)'; e.currentTarget.style.color = 'var(--color-text-secondary)'; }}
                            >
                                {cat.icon} {cat.label}
                            </button>
                        ))}
                    </div>

                    {/* CTA */}
                    <div style={{ display: 'flex', gap: 'var(--space-md)', justifyContent: 'center', flexWrap: 'wrap' }}>
                        <Link to="/resumes/guest" className="btn btn-primary btn-lg" style={{ gap: 8 }}>
                            📝 履歴書を無料で作る
                        </Link>
                    </div>
                    <p style={{ marginTop: 'var(--space-sm)', fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
                        登録不要・完全無料 · 作成後そのまま47万件の求人に応募できます
                    </p>
                </div>
            </section>

            {/* ── 使い方 3ステップ ── */}
            <section className="container" style={{ paddingBottom: 'var(--space-2xl)' }}>
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                    gap: 'var(--space-lg)',
                    position: 'relative',
                }}>
                    {[
                        { step: '01', icon: '🔍', title: '求人を検索', desc: '登録なしで全件閲覧。\nキーワード・地域・雇用形態で絞り込み。' },
                        { step: '02', icon: '📝', title: '履歴書を作成', desc: '職歴・スキルを入力するだけ。\nプロ品質の書類が完全無料で作れます。' },
                        { step: '03', icon: '✉️', title: '気になる求人に応募', desc: 'Google連携で30秒登録→即応募。\n企業とメッセージで直接やりとり。' },
                    ].map((item, i) => (
                        <div key={i} className="card" style={{ textAlign: 'center', padding: 'var(--space-xl)' }}>
                            <div style={{
                                fontSize: 'var(--font-size-xs)', fontWeight: 700,
                                color: 'var(--color-text-accent)', marginBottom: 'var(--space-sm)', letterSpacing: 2,
                            }}>STEP {item.step}</div>
                            <div style={{ fontSize: '2.5rem', marginBottom: 'var(--space-sm)' }}>{item.icon}</div>
                            <h3 style={{ marginBottom: 'var(--space-xs)', fontSize: 'var(--font-size-lg)' }}>{item.title}</h3>
                            <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-sm)', lineHeight: 1.7, whiteSpace: 'pre-line' }}>
                                {item.desc}
                            </p>
                        </div>
                    ))}
                </div>
            </section>

            {/* ── 注目求人 ── */}
            <section style={{ borderTop: '1px solid var(--color-border)', padding: 'var(--space-2xl) 0' }}>
                <div className="container">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-xl)' }}>
                        <div>
                            <h2 style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 700, marginBottom: 'var(--space-xs)' }}>
                                注目の求人
                            </h2>
                            <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-sm)' }}>
                                登録なしで全件閲覧できます
                            </p>
                        </div>
                        <Link to="/jobs" className="btn btn-secondary" style={{ whiteSpace: 'nowrap' }}>
                            すべて見る →
                        </Link>
                    </div>

                    {jobsLoading ? (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 'var(--space-md)' }}>
                            {[1,2,3,4,5,6].map(i => (
                                <div key={i} className="skeleton" style={{ height: 160, borderRadius: 'var(--radius-lg)' }} />
                            ))}
                        </div>
                    ) : featuredJobs.length === 0 ? (
                        <div className="card" style={{ textAlign: 'center', padding: 'var(--space-2xl)', color: 'var(--color-text-secondary)' }}>
                            現在掲載中の求人はありません
                        </div>
                    ) : (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 'var(--space-md)' }}>
                            {featuredJobs.map(job => (
                                <Link
                                    key={job.id}
                                    to={`/jobs/${job.id}`}
                                    className="card card-glow"
                                    style={{ textDecoration: 'none', color: 'inherit', display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}
                                >
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                        <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
                                            🏢 {job.company?.company_name || '企業名非公開'}
                                        </span>
                                        {job.employment_type && (
                                            <span className="badge badge-info" style={{ fontSize: 11 }}>{job.employment_type}</span>
                                        )}
                                    </div>
                                    <h3 style={{ fontSize: 'var(--font-size-base)', fontWeight: 700, lineHeight: 1.4 }}>
                                        {job.title}
                                    </h3>
                                    <div style={{ display: 'flex', gap: 'var(--space-sm)', flexWrap: 'wrap', marginTop: 'auto' }}>
                                        {job.location && (
                                            <span style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>📍 {job.location}</span>
                                        )}
                                        {(job.salary_min || job.salary_max) && (
                                            <span style={{ fontSize: 12, color: 'var(--color-success)', fontWeight: 600 }}>
                                                💰 {formatSalary(job)}
                                            </span>
                                        )}
                                    </div>
                                </Link>
                            ))}
                        </div>
                    )}

                    <div style={{ textAlign: 'center', marginTop: 'var(--space-xl)' }}>
                        <Link to="/jobs" className="btn btn-primary btn-lg">
                            求人をすべて見る
                        </Link>
                    </div>
                </div>
            </section>

            {/* ── 履歴書作成フック ── */}
            <section style={{ borderTop: '1px solid var(--color-border)', padding: 'var(--space-2xl) 0' }}>
                <div className="container">
                    <div className="card card-glow" style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                        gap: 'var(--space-xl)',
                        alignItems: 'center',
                        padding: 'var(--space-2xl)',
                        background: 'linear-gradient(135deg, rgba(18,28,52,0.08) 0%, rgba(168,85,247,0.05) 100%)',
                    }}>
                        <div>
                            <div style={{
                                display: 'inline-block', padding: '4px 12px',
                                background: 'rgba(18,28,52,0.15)', borderRadius: 'var(--radius-full)',
                                fontSize: 'var(--font-size-xs)', color: 'var(--color-text-accent)',
                                fontWeight: 600, marginBottom: 'var(--space-md)',
                            }}>
                                登録不要・完全無料
                            </div>
                            <h2 style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 700, marginBottom: 'var(--space-md)', lineHeight: 1.3 }}>
                                まず履歴書を<br />作ってみませんか？
                            </h2>
                            <p style={{ color: 'var(--color-text-secondary)', lineHeight: 1.8, marginBottom: 'var(--space-xl)', fontSize: 'var(--font-size-sm)' }}>
                                職歴・スキルを入力するだけで<br />
                                JIS規格対応の履歴書が完成します。<br />
                                登録なしでそのまま作り始められます。
                            </p>
                            <Link to="/resumes/guest" className="btn btn-primary btn-lg">
                                今すぐ無料で作る →
                            </Link>
                        </div>

                        {/* 履歴書イメージ */}
                        <div style={{
                            background: 'var(--color-bg-surface)',
                            borderRadius: 'var(--radius-lg)',
                            border: '1px solid var(--color-border)',
                            padding: 'var(--space-lg)',
                            fontSize: 'var(--font-size-xs)',
                            color: 'var(--color-text-secondary)',
                            fontFamily: 'serif',
                        }}>
                            <div style={{ textAlign: 'center', fontWeight: 700, fontSize: 'var(--font-size-base)', marginBottom: 'var(--space-sm)', color: 'var(--color-text-primary)', letterSpacing: 8 }}>
                                履 歴 書
                            </div>
                            <div style={{ display: 'flex', gap: 'var(--space-md)' }}>
                                {/* 左: 個人情報 */}
                                <div style={{ flex: 1 }}>
                                    {[
                                        { label: 'ふりがな', value: 'やまだ はなこ' },
                                        { label: '氏　　名', value: '山田 花子', large: true },
                                        { label: '生年月日', value: '1990年 4月 1日生（34歳）' },
                                        { label: '現住所', value: '東京都渋谷区○○' },
                                    ].map((row, i) => (
                                        <div key={i} style={{
                                            display: 'flex', gap: 8, padding: '4px 0',
                                            borderBottom: '1px solid var(--color-border)',
                                        }}>
                                            <span style={{ minWidth: 56, opacity: 0.6 }}>{row.label}</span>
                                            <span style={{ fontWeight: row.large ? 700 : 400, color: row.large ? 'var(--color-text-primary)' : undefined }}>
                                                {row.value}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                                {/* 右: 証明写真 */}
                                <div style={{
                                    width: 72, height: 96, flexShrink: 0,
                                    border: '1px solid var(--color-border)',
                                    borderRadius: 2,
                                    overflow: 'hidden',
                                    background: 'var(--color-bg-secondary)',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    flexDirection: 'column', gap: 4,
                                }}>
                                    <span style={{ fontSize: '1.5rem', opacity: 0.3 }}>👤</span>
                                    <span style={{ fontSize: 9, color: 'var(--color-text-muted)', textAlign: 'center', lineHeight: 1.3 }}>証明<br/>写真</span>
                                </div>
                            </div>
                            <div style={{ marginTop: 'var(--space-sm)', opacity: 0.5, fontSize: 11 }}>
                                学歴・職歴 ／ 免許・資格 ／ 志望動機...
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* ── なぜAtallyか ── */}
            <section style={{ borderTop: '1px solid var(--color-border)', padding: 'var(--space-2xl) 0' }}>
                <div className="container">
                    <div style={{ textAlign: 'center', marginBottom: 'var(--space-xl)' }}>
                        <h2 style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 700, marginBottom: 'var(--space-sm)' }}>
                            Atallyが選ばれる理由
                        </h2>
                        <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-sm)' }}>
                            ぴったり合う仕事・人材が見つかる設計
                        </p>
                    </div>
                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
                        gap: 'var(--space-md)',
                    }}>
                        {[
                            {
                                icon: '🛡️',
                                title: 'ブラック求人ゼロ',
                                desc: '労働基準法・職業安定法に準拠した求人のみ掲載審査。違反求人を排除し、安心して応募できる環境を守ります。',
                                color: '#f59e0b',
                            },
                            {
                                icon: '🔒',
                                title: '個人情報を厳重保護',
                                desc: '個人情報保護法に準拠した情報管理。SSL暗号化通信で、あなたの情報は常に安全に守られます。',
                                color: '#3b82f6',
                            },
                            {
                                icon: '🆓',
                                title: '求職者は完全無料',
                                desc: '求人検索・応募・履歴書作成・メッセージ機能、すべて無料で使い放題。隠れた費用は一切ありません。',
                                color: '#22c55e',
                            },
                            {
                                icon: '💬',
                                title: '企業と直接やりとり',
                                desc: '応募後はメッセージ機能で担当者と直接コミュニケーション。エージェント不要で選考がスムーズに進みます。',
                                color: '#8b5cf6',
                            },
                        ].map((item, i) => (
                            <div key={i} className="card" style={{ padding: 'var(--space-lg)' }}>
                                <div style={{
                                    width: 44, height: 44, borderRadius: 'var(--radius-md)',
                                    background: `${item.color}15`,
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    fontSize: '1.4rem', marginBottom: 'var(--space-md)',
                                }}>
                                    {item.icon}
                                </div>
                                <h3 style={{ fontSize: 'var(--font-size-base)', fontWeight: 700, marginBottom: 'var(--space-xs)' }}>
                                    {item.title}
                                </h3>
                                <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-sm)', lineHeight: 1.7, margin: 0 }}>
                                    {item.desc}
                                </p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* ── 企業・エージェント向け（下部） ── */}
            <section style={{ borderTop: '1px solid var(--color-border)', padding: 'var(--space-2xl) 0', background: 'var(--color-bg-secondary)' }}>
                <div className="container">
                    {/* 企業向け */}
                    <div style={{ marginBottom: 'var(--space-3xl)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-md)', marginBottom: 'var(--space-xl)', flexWrap: 'wrap' }}>
                            <div style={{ flex: 1, minWidth: 260 }}>
                                <div style={{ display: 'inline-block', padding: '3px 12px', background: 'rgba(18,28,52,0.1)', border: '1px solid rgba(18,28,52,0.2)', borderRadius: 'var(--radius-full)', fontSize: 'var(--font-size-xs)', color: 'var(--color-text-accent)', fontWeight: 600, marginBottom: 'var(--space-sm)' }}>
                                    採用担当者の方へ
                                </div>
                                <h2 style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 700, marginBottom: 'var(--space-sm)', lineHeight: 1.3 }}>
                                    求人掲載は無料から。<br />初期費用も成功報酬も¥0。
                                </h2>
                                <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-sm)', lineHeight: 1.8, marginBottom: 'var(--space-lg)' }}>
                                    まずは無料で掲載スタート。注目度を上げたい場合は<br />
                                    日額・月額¥500〜から有料プランにアップグレードできます。<br />
                                    採用成功報酬なし。違約金・解約手続き一切不要。
                                </p>
                                <div style={{ display: 'flex', gap: 'var(--space-sm)', flexWrap: 'wrap' }}>
                                    {['¥0 無料掲載あり', '¥0 成功報酬', '有料は¥500〜/日', 'いつでも停止OK'].map((t, i) => (
                                        <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '4px 12px', borderRadius: 'var(--radius-full)', background: 'var(--color-bg-surface)', border: '1px solid var(--color-border)', fontSize: 'var(--font-size-xs)', fontWeight: 600, color: 'var(--color-text-secondary)' }}>✓ {t}</span>
                                    ))}
                                </div>
                            </div>
                            {/* 料金フロー簡易説明 */}
                            <div style={{ flex: 1, minWidth: 280 }}>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-sm)' }}>
                                    {[
                                        { step: '1', icon: '🏢', title: '無料アカウント作成', desc: '会社情報を入力するだけ。無料で求人を即時掲載できます。' },
                                        { step: '2', icon: '📋', title: '求人・プランを設定', desc: '無料掲載のままでもOK。注目を集めたい場合は日額¥500〜から。' },
                                        { step: '3', icon: '✉️', title: '応募者を管理', desc: '書類選考から内定まで一画面で完結。' },
                                        { step: '4', icon: '🔍', title: 'スカウトで先手を打つ', desc: '登録求職者を検索してダイレクトアプローチ。' },
                                    ].map((item, i) => (
                                        <div key={i} className="card" style={{ padding: 'var(--space-md)' }}>
                                            <div style={{ fontSize: 'var(--font-size-xs)', fontWeight: 700, color: 'var(--color-text-accent)', marginBottom: 4 }}>STEP {item.step}</div>
                                            <div style={{ fontSize: '1.4rem', marginBottom: 4 }}>{item.icon}</div>
                                            <div style={{ fontWeight: 700, fontSize: 'var(--font-size-xs)', marginBottom: 2 }}>{item.title}</div>
                                            <div style={{ fontSize: 11, color: 'var(--color-text-secondary)', lineHeight: 1.5 }}>{item.desc}</div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                        <div style={{ display: 'flex', gap: 'var(--space-sm)', flexWrap: 'wrap' }}>
                            <Link to="/register?role=company" className="btn btn-primary">
                                企業として無料登録する
                            </Link>
                            <Link to="/for-companies" className="btn btn-secondary">
                                採用担当者向けページ →
                            </Link>
                            <Link to="/pricing" className="btn btn-secondary">
                                料金の詳細
                            </Link>
                        </div>
                    </div>

                    {/* エージェント向け */}
                    <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: 'var(--space-xl)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--space-xl)', flexWrap: 'wrap' }}>
                            <div>
                                <div style={{ display: 'inline-block', padding: '3px 12px', background: 'rgba(149,100,200,0.1)', border: '1px solid rgba(149,100,200,0.25)', borderRadius: 'var(--radius-full)', fontSize: 'var(--font-size-xs)', color: '#7c3aed', fontWeight: 600, marginBottom: 'var(--space-sm)' }}>
                                    人材紹介会社の方へ
                                </div>
                                <h3 style={{ fontSize: 'var(--font-size-xl)', fontWeight: 700, marginBottom: 'var(--space-xs)' }}>
                                    BtoB人材紹介もAtallyで一元化
                                </h3>
                                <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-sm)', lineHeight: 1.7, maxWidth: 520 }}>
                                    求人DBへのアクセス・候補者マッチング・紹介申請管理・クライアント管理まで。<br />
                                    ライセンス認証済み事業者向け。紹介申請¥500/件のみ。月額固定費なし。
                                </p>
                            </div>
                            <Link to="/for-agencies" className="btn btn-secondary" style={{ whiteSpace: 'nowrap', flexShrink: 0 }}>
                                紹介会社向けページ →
                            </Link>
                        </div>
                    </div>
                </div>
            </section>

        </div>
    );
}
