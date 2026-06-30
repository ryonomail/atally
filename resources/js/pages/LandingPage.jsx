import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../api';
import { useToast } from '../hooks/useToast';
import SEO from '../components/SEO';
import { formatSalary } from '../utils/salary';
import {
    Search, MapPin, ArrowRight, ArrowUpRight,
    ShieldCheck, Lock, MessageSquare, FileText,
} from 'lucide-react';

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

            {/* ─────────────────────────  Hero  ───────────────────────── */}
            <section style={{ padding: 'var(--space-3xl) 0 var(--space-2xl)' }}>
                <div className="container animate-slide-up" style={{ maxWidth: 760, textAlign: 'center' }}>

                    <div style={{
                        fontSize: 'var(--font-size-xs)',
                        letterSpacing: '0.14em',
                        textTransform: 'uppercase',
                        color: 'var(--color-text-accent)',
                        fontWeight: 600,
                        marginBottom: 'var(--space-lg)',
                    }}>
                        登録不要・完全無料
                    </div>

                    <h1 style={{
                        fontSize: 'clamp(2.1rem, 5vw, 3.4rem)',
                        fontWeight: 700,
                        lineHeight: 1.18,
                        letterSpacing: '-0.02em',
                        margin: '0 0 var(--space-lg)',
                        color: 'var(--color-navy)',
                    }}>
                        履歴書を作って、<br />仕事を探そう。
                    </h1>

                    <p style={{
                        fontSize: 'var(--font-size-lg)',
                        color: 'var(--color-text-secondary)',
                        maxWidth: 480,
                        margin: '0 auto var(--space-2xl)',
                        lineHeight: 1.8,
                    }}>
                        入力するだけでプロ品質の履歴書が完成。
                        そのまま47万件以上の求人に応募できます。
                    </p>

                    <div style={{
                        display: 'inline-flex', gap: 'var(--space-sm)',
                        flexWrap: 'wrap', justifyContent: 'center',
                        marginBottom: 'var(--space-md)',
                    }}>
                        <Link
                            to="/resumes/guest"
                            className="btn btn-primary"
                            style={{
                                gap: 8, padding: '13px 30px',
                                fontSize: 'var(--font-size-base)', fontWeight: 600,
                                borderRadius: 'var(--radius-md)',
                            }}
                        >
                            <FileText size={18} strokeWidth={2} />
                            履歴書を無料で作る
                            <ArrowRight size={17} strokeWidth={2.25} />
                        </Link>
                        <a
                            href="#jobs"
                            className="btn btn-secondary"
                            style={{ padding: '13px 24px', fontSize: 'var(--font-size-base)', borderRadius: 'var(--radius-md)' }}
                        >
                            求人を見る
                        </a>
                    </div>

                    <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', margin: 0 }}>
                        2分で完成 ・ 作成後そのまま応募 ・ 職業安定法準拠
                    </p>
                </div>
            </section>

            {/* ─────────────────────────  検索  ───────────────────────── */}
            <section className="container" style={{ paddingBottom: 'var(--space-3xl)' }}>
                <form
                    onSubmit={handleSearch}
                    style={{
                        display: 'flex', gap: 'var(--space-sm)', flexWrap: 'wrap',
                        maxWidth: 720, margin: '0 auto',
                        background: 'var(--color-bg-secondary)',
                        border: '1px solid var(--color-border)',
                        borderRadius: 'var(--radius-lg)',
                        boxShadow: 'var(--shadow-md)',
                        padding: 'var(--space-sm)',
                    }}
                >
                    <div style={{ flex: '2 1 220px', position: 'relative' }}>
                        <Search size={17} strokeWidth={2} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', opacity: 0.35, pointerEvents: 'none' }} />
                        <input
                            type="text" className="form-input"
                            placeholder="職種・スキル・会社名"
                            value={keyword} onChange={e => setKeyword(e.target.value)}
                            style={{ paddingLeft: 42, height: 50, border: 'none', boxShadow: 'none', background: 'transparent' }}
                        />
                    </div>
                    <div style={{ flex: '1 1 150px', position: 'relative' }}>
                        <MapPin size={17} strokeWidth={2} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', opacity: 0.35, pointerEvents: 'none' }} />
                        <input
                            type="text" className="form-input"
                            placeholder="勤務地"
                            value={location} onChange={e => setLocation(e.target.value)}
                            style={{ paddingLeft: 42, height: 50, border: 'none', boxShadow: 'none', background: 'transparent' }}
                        />
                    </div>
                    <button type="submit" className="btn btn-primary" style={{ height: 50, padding: '0 28px', whiteSpace: 'nowrap', flex: '0 0 auto', borderRadius: 'var(--radius-md)', fontWeight: 600 }}>
                        検索
                    </button>
                </form>

                <div style={{ display: 'flex', gap: 'var(--space-sm)', flexWrap: 'wrap', justifyContent: 'center', marginTop: 'var(--space-lg)' }}>
                    {['エンジニア', '営業', 'デザイナー', '医療・介護', '販売・接客', '事務'].map((q, i) => (
                        <button
                            key={i}
                            onClick={() => navigate(`/jobs?keyword=${encodeURIComponent(q)}`)}
                            style={{
                                padding: '5px 16px', borderRadius: 'var(--radius-full)',
                                border: '1px solid var(--color-border)', background: 'transparent',
                                cursor: 'pointer', fontSize: 'var(--font-size-sm)',
                                color: 'var(--color-text-secondary)', transition: 'all 0.15s',
                            }}
                            onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--color-accent)'; e.currentTarget.style.color = 'var(--color-text-accent)'; }}
                            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--color-border)'; e.currentTarget.style.color = 'var(--color-text-secondary)'; }}
                        >
                            {q}
                        </button>
                    ))}
                </div>
            </section>

            {/* ─────────────────────────  注目求人  ───────────────────────── */}
            <section id="jobs" style={{ borderTop: '1px solid var(--color-divider)', padding: 'var(--space-3xl) 0' }}>
                <div className="container">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 'var(--space-2xl)', gap: 'var(--space-md)', flexWrap: 'wrap' }}>
                        <h2 style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 700, letterSpacing: '-0.01em', margin: 0 }}>
                            注目の求人
                        </h2>
                        <Link to="/jobs" style={{ color: 'var(--color-text-accent)', fontSize: 'var(--font-size-sm)', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 4, textDecoration: 'none' }}>
                            すべての求人を見る <ArrowRight size={15} strokeWidth={2.25} />
                        </Link>
                    </div>

                    {jobsLoading ? (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 'var(--space-md)' }}>
                            {[1, 2, 3, 4, 5, 6].map(i => (
                                <div key={i} className="skeleton" style={{ height: 150, borderRadius: 'var(--radius-lg)' }} />
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
                                    className="card"
                                    style={{ textDecoration: 'none', color: 'inherit', display: 'flex', flexDirection: 'column', gap: 'var(--space-md)', padding: 'var(--space-lg)' }}
                                >
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 'var(--space-sm)' }}>
                                        <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
                                            {job.company?.company_name || '企業名非公開'}
                                        </span>
                                        {job.employment_type && (
                                            <span style={{ fontSize: 11, color: 'var(--color-text-secondary)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-full)', padding: '2px 10px', whiteSpace: 'nowrap', flexShrink: 0 }}>
                                                {job.employment_type}
                                            </span>
                                        )}
                                    </div>
                                    <h3 style={{ fontSize: 'var(--font-size-base)', fontWeight: 600, lineHeight: 1.5, margin: 0 }}>
                                        {job.title}
                                    </h3>
                                    <div style={{ display: 'flex', gap: 'var(--space-md)', flexWrap: 'wrap', marginTop: 'auto', fontSize: 'var(--font-size-sm)' }}>
                                        {job.location && (
                                            <span style={{ color: 'var(--color-text-secondary)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                                                <MapPin size={13} strokeWidth={2} style={{ opacity: 0.5 }} /> {job.location}
                                            </span>
                                        )}
                                        {(job.salary_min || job.salary_max) && (
                                            <span style={{ color: 'var(--color-text-primary)', fontWeight: 600 }}>
                                                {formatSalary(job)}
                                            </span>
                                        )}
                                    </div>
                                </Link>
                            ))}
                        </div>
                    )}
                </div>
            </section>

            {/* ─────────────────────────  都道府県から探す（SEO内部リンク）  ───────────────────────── */}
            <section style={{ borderTop: '1px solid var(--color-divider)', padding: 'var(--space-3xl) 0' }}>
                <div className="container">
                    <h2 style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 700, letterSpacing: '-0.01em', marginBottom: 'var(--space-lg)' }}>
                        都道府県から求人を探す
                    </h2>
                    <div style={{ display: 'flex', gap: 'var(--space-xs)', flexWrap: 'wrap' }}>
                        {[
                            '北海道', '青森県', '岩手県', '宮城県', '秋田県', '山形県', '福島県',
                            '茨城県', '栃木県', '群馬県', '埼玉県', '千葉県', '東京都', '神奈川県',
                            '新潟県', '富山県', '石川県', '福井県', '山梨県', '長野県', '岐阜県',
                            '静岡県', '愛知県', '三重県', '滋賀県', '京都府', '大阪府', '兵庫県',
                            '奈良県', '和歌山県', '鳥取県', '島根県', '岡山県', '広島県', '山口県',
                            '徳島県', '香川県', '愛媛県', '高知県', '福岡県', '佐賀県', '長崎県',
                            '熊本県', '大分県', '宮崎県', '鹿児島県', '沖縄県',
                        ].map(pref => (
                            <Link key={pref} to={`/jobs?prefecture=${encodeURIComponent(pref)}`}
                                style={{
                                    padding: '5px 14px', borderRadius: 'var(--radius-full)',
                                    border: '1px solid var(--color-border)', background: 'transparent',
                                    fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)',
                                    textDecoration: 'none', transition: 'all 0.15s',
                                }}
                                onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--color-accent)'; e.currentTarget.style.color = 'var(--color-text-accent)'; }}
                                onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--color-border)'; e.currentTarget.style.color = 'var(--color-text-secondary)'; }}>
                                {pref}の求人
                            </Link>
                        ))}
                    </div>
                </div>
            </section>

            {/* ─────────────────────────  使い方 3ステップ  ───────────────────────── */}
            <section style={{ borderTop: '1px solid var(--color-divider)', padding: 'var(--space-3xl) 0' }}>
                <div className="container" style={{ maxWidth: 880 }}>
                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                        gap: 'var(--space-2xl)',
                    }}>
                        {[
                            { step: '01', title: '求人を探す', desc: '登録なしで全件閲覧。キーワード・地域・雇用形態で絞り込めます。' },
                            { step: '02', title: '履歴書を作る', desc: '職歴・スキルを入力するだけ。JIS規格対応の履歴書が無料で完成します。' },
                            { step: '03', title: '応募する', desc: 'Google連携で30秒登録。作った履歴書でそのまま応募・直接やりとり。' },
                        ].map((item, i) => (
                            <div key={i}>
                                <div style={{ fontSize: 'var(--font-size-sm)', fontWeight: 700, color: 'var(--color-text-accent)', marginBottom: 'var(--space-sm)' }}>
                                    {item.step}
                                </div>
                                <h3 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 600, marginBottom: 'var(--space-xs)' }}>
                                    {item.title}
                                </h3>
                                <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-sm)', lineHeight: 1.8, margin: 0 }}>
                                    {item.desc}
                                </p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* ─────────────────────────  選ばれる理由  ───────────────────────── */}
            <section style={{ borderTop: '1px solid var(--color-divider)', padding: 'var(--space-3xl) 0' }}>
                <div className="container">
                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
                        gap: 'var(--space-2xl)',
                    }}>
                        {[
                            { Icon: ShieldCheck, title: 'ブラック求人ゼロ', desc: '労働基準法・職業安定法に準拠した求人のみを掲載。安心して応募できる環境を守ります。' },
                            { Icon: Lock, title: '個人情報を厳重保護', desc: '個人情報保護法に準拠した管理とSSL暗号化通信。あなたの情報は常に安全です。' },
                            { Icon: FileText, title: '求職者は完全無料', desc: '検索・応募・履歴書作成・メッセージまで、すべて無料。隠れた費用はありません。' },
                            { Icon: MessageSquare, title: '企業と直接やりとり', desc: '応募後はメッセージで担当者と直接コミュニケーション。選考がスムーズに進みます。' },
                        ].map(({ Icon, title, desc }, i) => (
                            <div key={i}>
                                <Icon size={22} strokeWidth={1.75} style={{ color: 'var(--color-text-accent)', marginBottom: 'var(--space-md)' }} />
                                <h3 style={{ fontSize: 'var(--font-size-base)', fontWeight: 600, marginBottom: 'var(--space-xs)' }}>
                                    {title}
                                </h3>
                                <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-sm)', lineHeight: 1.8, margin: 0 }}>
                                    {desc}
                                </p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* ─────────────────────────  履歴書 CTA  ───────────────────────── */}
            <section style={{ borderTop: '1px solid var(--color-divider)', padding: 'var(--space-3xl) 0' }}>
                <div className="container">
                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
                        gap: 'var(--space-2xl)',
                        alignItems: 'center',
                        maxWidth: 920, margin: '0 auto',
                    }}>
                        {/* 左：コピー */}
                        <div>
                            <h2 style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 700, letterSpacing: '-0.01em', marginBottom: 'var(--space-md)', lineHeight: 1.3 }}>
                                まず、履歴書を<br />作ってみませんか。
                            </h2>
                            <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-base)', lineHeight: 1.9, marginBottom: 'var(--space-xl)' }}>
                                登録不要。入力するだけでJIS規格対応の履歴書が完成し、そのまま気になる求人に応募できます。
                            </p>
                            <Link
                                to="/resumes/guest"
                                className="btn btn-primary"
                                style={{ gap: 8, padding: '13px 32px', fontSize: 'var(--font-size-base)', fontWeight: 600, borderRadius: 'var(--radius-md)' }}
                            >
                                今すぐ無料で作る
                                <ArrowRight size={17} strokeWidth={2.25} />
                            </Link>
                        </div>

                        {/* 右：履歴書プレビュー */}
                        <div style={{
                            background: 'var(--color-bg-secondary)',
                            borderRadius: 'var(--radius-lg)',
                            border: '1px solid var(--color-border)',
                            boxShadow: 'var(--shadow-lg)',
                            padding: 'var(--space-lg)',
                            fontSize: 'var(--font-size-xs)',
                            color: 'var(--color-text-secondary)',
                            fontFamily: 'serif',
                            maxWidth: 420,
                            justifySelf: 'center',
                            width: '100%',
                        }}>
                            <div style={{ textAlign: 'center', fontWeight: 700, fontSize: 'var(--font-size-base)', marginBottom: 'var(--space-md)', color: 'var(--color-text-primary)', letterSpacing: 8 }}>
                                履 歴 書
                            </div>
                            <div style={{ display: 'flex', gap: 'var(--space-md)' }}>
                                <div style={{ flex: 1 }}>
                                    {[
                                        { label: 'ふりがな', value: 'やまだ はなこ' },
                                        { label: '氏　　名', value: '山田 花子', large: true },
                                        { label: '生年月日', value: '1990年 4月 1日生' },
                                        { label: '現住所', value: '東京都渋谷区○○' },
                                    ].map((row, i) => (
                                        <div key={i} style={{ display: 'flex', gap: 8, padding: '5px 0', borderBottom: '1px solid var(--color-divider)' }}>
                                            <span style={{ minWidth: 56, opacity: 0.55 }}>{row.label}</span>
                                            <span style={{ fontWeight: row.large ? 700 : 400, color: row.large ? 'var(--color-text-primary)' : undefined }}>
                                                {row.value}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                                <img
                                    src="/images/resume-photo.jpg"
                                    alt="証明写真"
                                    style={{
                                        width: 72, height: 96, flexShrink: 0,
                                        border: '1px solid var(--color-border)',
                                        borderRadius: 2, objectFit: 'cover',
                                        background: 'var(--color-bg-secondary)',
                                    }}
                                />
                            </div>
                            <div style={{ marginTop: 'var(--space-md)', opacity: 0.5, fontSize: 11 }}>
                                学歴・職歴 ／ 免許・資格 ／ 志望動機 …
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* ─────────────────────────  企業・紹介会社向け  ───────────────────────── */}
            <section style={{ borderTop: '1px solid var(--color-divider)', padding: 'var(--space-3xl) 0', background: 'var(--color-bg-secondary)' }}>
                <div className="container" style={{ maxWidth: 880 }}>
                    <div style={{ display: 'flex', gap: 'var(--space-2xl)', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div style={{ flex: '1 1 360px' }}>
                            <div style={{ fontSize: 'var(--font-size-xs)', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--color-text-accent)', fontWeight: 600, marginBottom: 'var(--space-md)' }}>
                                採用担当者の方へ
                            </div>
                            <h2 style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 700, letterSpacing: '-0.01em', marginBottom: 'var(--space-md)', lineHeight: 1.3 }}>
                                求人掲載は無料から。<br />初期費用も成功報酬も¥0。
                            </h2>
                            <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-sm)', lineHeight: 1.9, marginBottom: 'var(--space-lg)' }}>
                                まずは無料で掲載スタート。注目度を上げたいときだけ、日額¥500〜から有料ブーストにアップグレードできます。
                                採用成功報酬なし、違約金なし、いつでも停止可能です。
                            </p>
                            <div style={{ display: 'flex', gap: 'var(--space-sm)', flexWrap: 'wrap' }}>
                                <Link to="/register?role=company" className="btn btn-primary" style={{ borderRadius: 'var(--radius-md)', fontWeight: 600 }}>
                                    企業として無料登録
                                </Link>
                                <Link to="/for-companies" className="btn btn-secondary" style={{ borderRadius: 'var(--radius-md)' }}>
                                    詳しく見る
                                </Link>
                            </div>
                        </div>

                        <div style={{ flex: '1 1 280px', borderLeft: '1px solid var(--color-divider)', paddingLeft: 'var(--space-2xl)' }}>
                            <div style={{ fontSize: 'var(--font-size-xs)', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--color-text-muted)', fontWeight: 600, marginBottom: 'var(--space-md)' }}>
                                人材紹介会社の方へ
                            </div>
                            <h3 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 600, marginBottom: 'var(--space-sm)' }}>
                                BtoB人材紹介もAtallyで一元化
                            </h3>
                            <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-sm)', lineHeight: 1.8, marginBottom: 'var(--space-lg)' }}>
                                求人DB・候補者マッチング・紹介申請・クライアント管理まで一元化。紹介申請¥500/件のみ、月額固定費なし。
                            </p>
                            <Link to="/for-agencies" style={{ color: 'var(--color-text-accent)', fontSize: 'var(--font-size-sm)', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 4, textDecoration: 'none' }}>
                                紹介会社向けページ <ArrowUpRight size={15} strokeWidth={2.25} />
                            </Link>
                        </div>
                    </div>
                </div>
            </section>

        </div>
    );
}
