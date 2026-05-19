import React, { useState } from 'react';
import { Link, useParams, Navigate } from 'react-router-dom';
import SEO from '../components/SEO';
import { columns, columnList } from '../data/columns';

function getWareki(year) {
    if (year >= 2019) return `令和${year - 2018}年`;
    if (year >= 1989) return `平成${year - 1988}年`;
    if (year >= 1926) return `昭和${year - 1925}年`;
    return `${year}年`;
}

function YearLookup() {
    const [birthYear, setBirthYear] = useState('');
    const years = [];
    for (let y = 1975; y <= 2010; y++) years.push(y);

    const milestones = birthYear ? [
        { label: '小学校卒業', year: Number(birthYear) + 13 },
        { label: '中学校卒業', year: Number(birthYear) + 16 },
        { label: '高校卒業', year: Number(birthYear) + 19 },
        { label: '短大卒業（2年制）', year: Number(birthYear) + 21 },
        { label: '大学卒業（4年制）', year: Number(birthYear) + 23 },
        { label: '大学院修了（修士2年）', year: Number(birthYear) + 25 },
    ] : [];

    return (
        <div style={{ marginBottom: 'var(--space-lg)' }}>
            <div style={{ marginBottom: 'var(--space-md)' }}>
                <label style={{ display: 'block', fontWeight: 600, fontSize: 'var(--font-size-sm)', marginBottom: 'var(--space-xs)' }}>
                    生まれ年を選んでください
                </label>
                <select
                    value={birthYear}
                    onChange={e => setBirthYear(e.target.value)}
                    style={{
                        width: '100%', maxWidth: 280, padding: '10px 14px',
                        border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)',
                        fontSize: 'var(--font-size-sm)', background: 'white',
                        cursor: 'pointer', appearance: 'auto',
                    }}
                >
                    <option value="">── 選択してください ──</option>
                    {years.map(y => (
                        <option key={y} value={y}>{y}年（{getWareki(y)}）</option>
                    ))}
                </select>
            </div>

            {milestones.length > 0 && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 'var(--space-sm)' }}>
                    {milestones.map(({ label, year }) => (
                        <div key={label} style={{
                            background: 'rgba(0,112,185,0.05)', border: '1px solid rgba(0,112,185,0.2)',
                            borderRadius: 'var(--radius-md)', padding: '12px 16px',
                        }}>
                            <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', marginBottom: 4 }}>{label}</div>
                            <div style={{ fontWeight: 700, fontSize: 'var(--font-size-md)', color: '#0070b9' }}>{year}年</div>
                            <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>（{getWareki(year)}）</div>
                        </div>
                    ))}
                </div>
            )}

            {!birthYear && (
                <div style={{ color: 'var(--color-text-muted)', fontSize: 'var(--font-size-sm)', padding: '16px', background: '#f5f6f7', borderRadius: 'var(--radius-md)', textAlign: 'center' }}>
                    生まれ年を選ぶと、各節目の卒業・修了年度が表示されます
                </div>
            )}

            <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', marginTop: 'var(--space-sm)', lineHeight: 1.6 }}>
                ※ 4月2日以降生まれ（通常）の場合。早生まれ（1月1日〜4月1日）の方は1年前後することがあります。
            </p>
        </div>
    );
}

function Section({ section }) {
    const base = { lineHeight: 1.85, marginBottom: 'var(--space-lg)' };
    switch (section.type) {
        case 'h2': return <h2 style={{ fontSize: 'var(--font-size-xl)', fontWeight: 700, marginTop: 'var(--space-2xl)', marginBottom: 'var(--space-md)', paddingBottom: 'var(--space-sm)', borderBottom: '2px solid var(--color-accent)' }}>{section.content}</h2>;
        case 'h3': return <h3 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 600, marginTop: 'var(--space-xl)', marginBottom: 'var(--space-sm)' }}>{section.content}</h3>;
        case 'p':  return <p style={{ ...base, color: 'var(--color-text-secondary)' }}>{section.content}</p>;
        case 'ul': return (
            <ul style={{ ...base, paddingLeft: 'var(--space-xl)' }}>
                {section.items.map((item, i) => <li key={i} style={{ marginBottom: 6, color: 'var(--color-text-secondary)' }}>{item}</li>)}
            </ul>
        );
        case 'ol': return (
            <ol style={{ ...base, paddingLeft: 'var(--space-xl)' }}>
                {section.items.map((item, i) => <li key={i} style={{ marginBottom: 8, color: 'var(--color-text-secondary)' }}>{item}</li>)}
            </ol>
        );
        case 'table': return (
            <div style={{ overflowX: 'auto', marginBottom: 'var(--space-lg)' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--font-size-sm)' }}>
                    <thead>
                        <tr style={{ background: '#f5f6f7' }}>
                            {section.headers.map((h, i) => <th key={i} style={{ padding: '10px 14px', border: '1px solid var(--color-border)', fontWeight: 600, textAlign: 'left' }}>{h}</th>)}
                        </tr>
                    </thead>
                    <tbody>
                        {section.rows.map((row, i) => (
                            <tr key={i} style={{ background: i % 2 === 0 ? 'white' : '#fafafa' }}>
                                {row.map((cell, j) => <td key={j} style={{ padding: '10px 14px', border: '1px solid var(--color-border)', color: 'var(--color-text-secondary)' }}>{cell}</td>)}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        );
        case 'box': return (
            <div style={{ background: 'rgba(0,112,185,0.06)', border: '1px solid rgba(0,112,185,0.2)', borderRadius: 'var(--radius-md)', padding: 'var(--space-lg)', marginBottom: 'var(--space-lg)', color: 'var(--color-text-primary)', lineHeight: 1.8, whiteSpace: 'pre-wrap' }}>
                {section.content}
            </div>
        );
        case 'example': return (
            <div style={{ background: '#f0f7ff', border: '1px solid #bee3f8', borderRadius: 'var(--radius-md)', padding: 'var(--space-lg)', marginBottom: 'var(--space-lg)' }}>
                <div style={{ fontSize: 'var(--font-size-xs)', fontWeight: 700, color: '#0070b9', marginBottom: 'var(--space-xs)' }}>【記入例】</div>
                <div style={{ color: 'var(--color-text-secondary)', lineHeight: 1.8, whiteSpace: 'pre-wrap', fontSize: 'var(--font-size-sm)' }}>{section.content}</div>
            </div>
        );
        case 'caution': return (
            <div style={{ background: '#fff5f5', border: '1px solid #fed7d7', borderRadius: 'var(--radius-md)', padding: 'var(--space-lg)', marginBottom: 'var(--space-lg)' }}>
                <div style={{ fontSize: 'var(--font-size-xs)', fontWeight: 700, color: '#c53030', marginBottom: 'var(--space-xs)' }}>⚠️ 注意</div>
                <div style={{ color: 'var(--color-text-secondary)', lineHeight: 1.8, fontSize: 'var(--font-size-sm)', whiteSpace: 'pre-wrap' }}>{section.content}</div>
            </div>
        );
        case 'faq': return (
            <div style={{ marginBottom: 'var(--space-lg)' }}>
                {section.items.map((item, i) => (
                    <div key={i} style={{ marginBottom: 'var(--space-md)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
                        <div style={{ background: '#f5f6f7', padding: 'var(--space-md) var(--space-lg)', fontWeight: 600, fontSize: 'var(--font-size-sm)' }}>
                            Q. {item.q}
                        </div>
                        <div style={{ padding: 'var(--space-md) var(--space-lg)', color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-sm)', lineHeight: 1.8 }}>
                            A. {item.a}
                        </div>
                    </div>
                ))}
            </div>
        );
        case 'year-lookup': return <YearLookup />;
        default: return null;
    }
}

export default function ColumnPage() {
    const { slug } = useParams();
    const col = columns[slug];
    if (!col) return <Navigate to="/column" replace />;

    const others = columnList.filter(c => c.slug !== slug).slice(0, 3);
    const faqItems = col.sections.filter(s => s.type === 'faq').flatMap(s => s.items);
    const faqJsonLd = faqItems.length > 0 ? {
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        mainEntity: faqItems.map(item => ({
            '@type': 'Question',
            name: item.q,
            acceptedAnswer: { '@type': 'Answer', text: item.a },
        })),
    } : null;

    return (
        <div className="page" style={{ paddingBottom: 'var(--space-2xl)' }}>
            <SEO
                title={col.title + ' | Atally'}
                description={col.metaDescription}
                url={`${window.location.origin}/column/${col.slug}`}
                jsonLd={faqJsonLd}
            />

            {/* ヘッダー */}
            <div style={{ background: 'linear-gradient(135deg, rgba(18,28,52,0.06) 0%, transparent 60%)', borderBottom: '1px solid var(--color-border)', padding: 'var(--space-xl) 0' }}>
                <div className="container" style={{ maxWidth: 860 }}>
                    <div style={{ display: 'flex', gap: 6, marginBottom: 'var(--space-sm)', fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
                        <Link to="/" style={{ color: 'var(--color-text-muted)', textDecoration: 'none' }}>ホーム</Link>
                        <span>›</span>
                        <Link to="/column" style={{ color: 'var(--color-text-muted)', textDecoration: 'none' }}>コラム</Link>
                        <span>›</span>
                        <span>{col.title}</span>
                    </div>
                    <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600, background: 'rgba(0,112,185,0.1)', color: '#0070b9', padding: '2px 10px', borderRadius: 'var(--radius-full)', marginBottom: 'var(--space-sm)', display: 'inline-block' }}>
                        {col.category}
                    </span>
                    <h1 style={{ fontSize: 'clamp(1.4rem, 3vw, 2rem)', fontWeight: 800, lineHeight: 1.3, marginBottom: 'var(--space-sm)' }}>{col.title}</h1>
                    <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
                        公開日: {col.publishedAt} ／ 更新日: {col.updatedAt} ／ 約{col.readTime}分
                    </div>
                </div>
            </div>

            <div className="container" style={{ maxWidth: 860, paddingTop: 'var(--space-xl)' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr min(280px, 30%)', gap: 'var(--space-xl)', alignItems: 'start' }}>
                    {/* 本文 */}
                    <article>
                        {col.sections.map((section, i) => <Section key={i} section={section} />)}

                        {/* CTA */}
                        <div className="card" style={{ marginTop: 'var(--space-2xl)', padding: 'var(--space-xl)', textAlign: 'center', background: 'linear-gradient(135deg, rgba(0,112,185,0.07) 0%, rgba(52,199,89,0.05) 100%)', border: '1px solid rgba(0,112,185,0.15)' }}>
                            <div style={{ fontSize: '2rem', marginBottom: 'var(--space-sm)' }}>📝</div>
                            <h3 style={{ marginBottom: 'var(--space-sm)' }}>実際に履歴書を作ってみましょう</h3>
                            <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-sm)', marginBottom: 'var(--space-lg)', lineHeight: 1.7 }}>
                                Atallyの無料履歴書作成ツールなら、この記事の内容をそのまま活かして<br />
                                プロ品質の履歴書が登録不要・無料で作れます。
                            </p>
                            <div style={{ display: 'flex', gap: 'var(--space-md)', justifyContent: 'center', flexWrap: 'wrap' }}>
                                <Link to="/resumes/guest" className="btn btn-primary btn-lg">📝 今すぐ無料で作る</Link>
                                <Link to="/jobs" className="btn btn-secondary">求人を探す</Link>
                            </div>
                        </div>
                    </article>

                    {/* サイドバー */}
                    <aside style={{ position: 'sticky', top: 80 }}>
                        <div className="card" style={{ padding: 'var(--space-lg)', marginBottom: 'var(--space-lg)' }}>
                            <div style={{ fontWeight: 700, fontSize: 'var(--font-size-sm)', marginBottom: 'var(--space-md)' }}>関連コラム</div>
                            {others.map(c => (
                                <Link key={c.slug} to={`/column/${c.slug}`} style={{ display: 'block', textDecoration: 'none', marginBottom: 'var(--space-sm)', paddingBottom: 'var(--space-sm)', borderBottom: '1px solid var(--color-border)' }}>
                                    <div style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600, color: 'var(--color-text-primary)', lineHeight: 1.5 }}>{c.title}</div>
                                    <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', marginTop: 2 }}>約{c.readTime}分</div>
                                </Link>
                            ))}
                        </div>
                        <div className="card" style={{ padding: 'var(--space-lg)', textAlign: 'center', background: 'rgba(0,112,185,0.04)', border: '1px solid rgba(0,112,185,0.15)' }}>
                            <div style={{ fontWeight: 700, fontSize: 'var(--font-size-sm)', marginBottom: 'var(--space-sm)' }}>📝 履歴書を無料作成</div>
                            <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', marginBottom: 'var(--space-md)', lineHeight: 1.7 }}>登録不要・完全無料<br />作成後そのまま求人に応募可</p>
                            <Link to="/resumes/guest" className="btn btn-primary" style={{ width: '100%', display: 'block' }}>今すぐ作る</Link>
                        </div>
                    </aside>
                </div>
            </div>
        </div>
    );
}
