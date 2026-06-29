import React from 'react';
import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';

const VALUES = [
    {
        icon: '🤝',
        title: 'シンプルさ',
        desc: '複雑な操作は不要。求職者も企業も、直感的に使えるプラットフォームを追求します。',
    },
    {
        icon: '⚖️',
        title: '公正・透明性',
        desc: '職業安定法・労働基準法に準拠し、ブラック求人のない健全な採用市場を守ります。',
    },
    {
        icon: '🔒',
        title: 'プライバシー保護',
        desc: '個人情報は厳重に管理。求職者のデータが本人の意図しない形で使われることはありません。',
    },
    {
        icon: '💡',
        title: '継続的な改善',
        desc: 'ユーザーの声をもとにプロダクトを磨き続けます。使うたびに便利になるサービスを目指します。',
    },
];

export default function AboutPage() {
    return (
        <div className="animate-fade-in">
            <Helmet>
                <title>Atallyについて - Atally</title>
                <meta name="description" content="Atallyは仕事探しをシンプルにする求人マッチングプラットフォームです。職業安定法に準拠し、求職者と企業を誠実につなぎます。" />
            </Helmet>

            {/* ヒーロー */}
            <section style={{
                background: 'var(--color-bg-secondary)',
                borderBottom: '1px solid var(--color-border)',
                padding: 'var(--space-3xl) var(--space-md)',
                textAlign: 'center',
            }}>
                <div style={{ maxWidth: 640, margin: '0 auto' }}>
                    <h1 style={{ fontSize: 'clamp(1.75rem, 4vw, 2.5rem)', fontWeight: 800, lineHeight: 1.3, marginBottom: 'var(--space-lg)', color: 'var(--color-navy)' }}>
                        ぴったり合う仕事探し、はじめよう。
                    </h1>
                    <p style={{ fontSize: 'var(--font-size-base)', color: 'var(--color-text-secondary)', lineHeight: 1.9 }}>
                        Atallyは「仕事を探す人」と「人を探す企業」が、<br />
                        ストレスなくつながれるプラットフォームです。<br />
                        余計なものをそぎ落とし、本当に必要な機能だけを届けます。
                    </p>
                </div>
            </section>

            <div className="container" style={{ maxWidth: 800, paddingTop: 'var(--space-3xl)', paddingBottom: 'var(--space-3xl)' }}>

                {/* ミッション */}
                <section style={{ marginBottom: 'var(--space-3xl)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)', marginBottom: 'var(--space-lg)' }}>
                        <div style={{ width: 3, height: 24, background: 'var(--color-accent)', borderRadius: 99 }} />
                        <h2 style={{ fontSize: 'var(--font-size-xl)', fontWeight: 700, margin: 0 }}>ミッション</h2>
                    </div>
                    <div className="card" style={{ padding: 'var(--space-2xl)', textAlign: 'center' }}>
                        <p style={{ fontSize: 'var(--font-size-lg)', fontWeight: 600, color: 'var(--color-text-primary)', lineHeight: 1.8, margin: 0 }}>
                            「ぴったり合う仕事探し、はじめよう。」
                        </p>
                    </div>
                </section>

                {/* Atallyが生まれた理由 */}
                <section style={{ marginBottom: 'var(--space-3xl)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)', marginBottom: 'var(--space-lg)' }}>
                        <div style={{ width: 3, height: 24, background: 'var(--color-accent)', borderRadius: 99 }} />
                        <h2 style={{ fontSize: 'var(--font-size-xl)', fontWeight: 700, margin: 0 }}>Atallyが生まれた理由</h2>
                    </div>
                    <div style={{ fontSize: 'var(--font-size-base)', color: 'var(--color-text-secondary)', lineHeight: 1.9, display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
                        <p>
                            現在の求人市場は、過剰な情報と複雑な操作で溢れています。
                            求職者は膨大な求人の中から自分に合うものを探すのに疲弊し、
                            企業は高額な掲載費を払っても思うような人材に出会えないことがあります。
                        </p>
                        <p>
                            私たちはこの問題を解決したいと考えました。
                            シンプルで使いやすい求人マッチングプラットフォームを作ることで、
                            求職者と企業が本質的なマッチングに集中できる環境を提供します。
                        </p>
                        <p>
                            Atallyは「Atally（アタリ）」＝「的中する」という言葉から着想を得ています。
                            一人ひとりにピッタリ合う仕事・人材が見つかる、そんなプラットフォームを目指しています。
                        </p>
                    </div>
                </section>

                {/* バリュー */}
                <section style={{ marginBottom: 'var(--space-3xl)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)', marginBottom: 'var(--space-lg)' }}>
                        <div style={{ width: 3, height: 24, background: 'var(--color-accent)', borderRadius: 99 }} />
                        <h2 style={{ fontSize: 'var(--font-size-xl)', fontWeight: 700, margin: 0 }}>大切にしていること</h2>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 'var(--space-md)' }}>
                        {VALUES.map((v, i) => (
                            <div key={i} className="card" style={{ padding: 'var(--space-xl)' }}>
                                <div style={{ fontSize: 28, marginBottom: 'var(--space-sm)' }}>{v.icon}</div>
                                <h3 style={{ fontSize: 'var(--font-size-base)', fontWeight: 700, marginBottom: 'var(--space-sm)' }}>{v.title}</h3>
                                <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', lineHeight: 1.7, margin: 0 }}>{v.desc}</p>
                            </div>
                        ))}
                    </div>
                </section>

                {/* 法令遵守 */}
                <section style={{ marginBottom: 'var(--space-3xl)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)', marginBottom: 'var(--space-lg)' }}>
                        <div style={{ width: 3, height: 24, background: 'var(--color-accent)', borderRadius: 99 }} />
                        <h2 style={{ fontSize: 'var(--font-size-xl)', fontWeight: 700, margin: 0 }}>法令遵守への取り組み</h2>
                    </div>
                    <div className="card" style={{ padding: 'var(--space-xl)' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
                            {[
                                { badge: '職業安定法', desc: '求人情報の明示義務・虚偽求人の排除など、職業安定法の規定に基づいた運営を行っています。' },
                                { badge: '労働基準法', desc: '最低賃金・労働時間・休暇など、労働基準法に違反する求人は掲載できない仕組みを設けています。' },
                                { badge: '個人情報保護法', desc: '求職者・企業の個人情報は個人情報保護法に基づき厳重に管理し、第三者への不正提供は行いません。' },
                            ].map((item, i) => (
                                <div key={i} style={{ display: 'flex', gap: 'var(--space-md)', paddingBottom: i < 2 ? 'var(--space-md)' : 0, borderBottom: i < 2 ? '1px solid var(--color-border)' : 'none' }}>
                                    <span style={{
                                        display: 'inline-flex', alignItems: 'center', gap: 4,
                                        padding: '3px 10px', borderRadius: 'var(--radius-full)',
                                        background: 'rgba(52,199,89,0.1)', border: '1px solid rgba(52,199,89,0.3)',
                                        fontSize: 'var(--font-size-xs)', color: '#1d8f42', fontWeight: 500,
                                        whiteSpace: 'nowrap', flexShrink: 0, alignSelf: 'flex-start',
                                    }}>
                                        {item.badge}
                                    </span>
                                    <p style={{ margin: 0, fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', lineHeight: 1.7 }}>
                                        {item.desc}
                                    </p>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>

                {/* リンク */}
                <div style={{ display: 'flex', gap: 'var(--space-md)', flexWrap: 'wrap', justifyContent: 'center' }}>
                    <Link to="/help" className="btn btn-secondary">ヘルプセンター</Link>
                    <Link to="/terms" className="btn btn-secondary">利用規約</Link>
                    <Link to="/privacy" className="btn btn-secondary">プライバシーポリシー</Link>
                    <Link to="/for-companies" className="btn btn-primary">企業の方はこちら</Link>
                </div>
            </div>
        </div>
    );
}
