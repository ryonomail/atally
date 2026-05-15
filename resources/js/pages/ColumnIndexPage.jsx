import React from 'react';
import { Link } from 'react-router-dom';
import SEO from '../components/SEO';
import { columnList } from '../data/columns';

export default function ColumnIndexPage() {
    return (
        <div className="page container" style={{ maxWidth: 860, paddingTop: 'var(--space-2xl)', paddingBottom: 'var(--space-2xl)' }}>
            <SEO
                title="お役立ちコラム | 履歴書・転職・志望動機の書き方 | Atally"
                description="履歴書の書き方、志望動機の書き方、職務経歴書の書き方など転職・就職活動に役立つコラムを掲載。求人検索・履歴書作成ツールと合わせてご活用ください。"
            />
            <div style={{ marginBottom: 'var(--space-xl)' }}>
                <h1 style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 800, marginBottom: 'var(--space-xs)' }}>
                    お役立ちコラム
                </h1>
                <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-sm)' }}>
                    履歴書・転職活動に役立つ情報をまとめました
                </p>
            </div>

            <div style={{ display: 'grid', gap: 'var(--space-md)' }}>
                {columnList.map(col => (
                    <Link key={col.slug} to={`/column/${col.slug}`} style={{ textDecoration: 'none' }}>
                        <div className="card" style={{
                            padding: 'var(--space-lg) var(--space-xl)',
                            display: 'flex', gap: 'var(--space-lg)', alignItems: 'flex-start',
                            transition: 'box-shadow 0.15s',
                        }}
                        onMouseEnter={e => e.currentTarget.style.boxShadow = '0 4px 20px rgba(0,0,0,0.1)'}
                        onMouseLeave={e => e.currentTarget.style.boxShadow = ''}>
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ display: 'flex', gap: 'var(--space-sm)', marginBottom: 'var(--space-xs)', flexWrap: 'wrap', alignItems: 'center' }}>
                                    <span style={{
                                        fontSize: 'var(--font-size-xs)', fontWeight: 600,
                                        background: 'rgba(0,112,185,0.1)', color: '#0070b9',
                                        padding: '2px 10px', borderRadius: 'var(--radius-full)',
                                    }}>{col.category}</span>
                                    <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
                                        約{col.readTime}分で読めます
                                    </span>
                                </div>
                                <h2 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 700, marginBottom: 'var(--space-xs)', color: 'var(--color-text-primary)' }}>
                                    {col.title}
                                </h2>
                                <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', lineHeight: 1.7, margin: 0 }}>
                                    {col.metaDescription}
                                </p>
                            </div>
                            <span style={{ color: 'var(--color-text-muted)', fontSize: 20, flexShrink: 0 }}>›</span>
                        </div>
                    </Link>
                ))}
            </div>

            <div className="card" style={{ marginTop: 'var(--space-2xl)', padding: 'var(--space-xl)', textAlign: 'center', background: 'linear-gradient(135deg, rgba(0,112,185,0.07) 0%, rgba(52,199,89,0.05) 100%)' }}>
                <h3 style={{ marginBottom: 'var(--space-sm)' }}>📝 無料で履歴書を作成しませんか？</h3>
                <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-sm)', marginBottom: 'var(--space-lg)' }}>
                    登録不要・完全無料。作成後そのまま47万件以上の求人に応募できます。
                </p>
                <Link to="/resumes/guest" className="btn btn-primary btn-lg">履歴書を無料で作る</Link>
            </div>
        </div>
    );
}
