import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';

const STEPS = [
    { num: '01', title: '企業アカウントを作成', desc: '会社情報を登録するだけ。審査なし、最短5分で利用開始できます。', icon: '🏢' },
    { num: '02', title: '求人票を作成・無料公開', desc: '必要事項を入力して公開ボタンを押すだけ。無料でそのまま掲載できます。', icon: '📝' },
    { num: '03', title: '応募者を管理', desc: '応募が届いたら書類選考・面接・内定まで一画面で管理できます。', icon: '📋' },
    { num: '04', title: '（任意）有料プランで注目度アップ', desc: '日額・月額¥500〜の有料掲載で露出を強化。スカウト機能も使えるようになります。', icon: '🚀' },
];

const FEATURES = [
    {
        icon: '⚡',
        title: '最短5分で求人掲載',
        desc: '複雑な審査や書類提出は不要。アカウント作成後すぐに求人を公開できます。',
        group: '採用活動を効率化',
    },
    {
        icon: '📊',
        title: '応募状況を一元管理',
        desc: '書類選考・面接・内定・不採用まで、選考フローをビジュアルで把握。担当者の工数を大幅削減。',
        group: '採用活動を効率化',
    },
    {
        icon: '✉️',
        title: 'スカウト機能（有料プランで利用可）',
        desc: '有料掲載中の求人が1件以上あれば、スカウト検索・送信を追加費用なしで利用できます。',
        group: '採用活動を効率化',
    },
    {
        icon: '💬',
        title: '応募者とダイレクトメッセージ',
        desc: '応募者と直接やり取り。日程調整から質疑応答まで、メッセージ機能で完結します。',
        group: '採用活動を効率化',
    },
    {
        icon: '📈',
        title: '求人パフォーマンス分析',
        desc: '閲覧数・応募数・選考通過率をデータで確認。予算対効果を最大化できます。',
        group: 'コスト管理・安心',
    },
    {
        icon: '⚖️',
        title: '法令準拠サポート',
        desc: '職業安定法・労働基準法に準拠した求人フォーマットを提供。コンプライアンスリスクを低減。',
        group: 'コスト管理・安心',
    },
];

const TESTIMONIALS = [
    {
        company: 'ITスタートアップ',
        industry: 'ITサービス',
        comment: '掲載から3日で5件の応募が届きました。スカウト機能で欲しい人材に直接アプローチできるので採用効率が大幅に上がりました。',
        size: '従業員50名',
    },
    {
        company: '製造業',
        industry: '製造・メーカー',
        comment: '他サービスと比べて圧倒的に使いやすい。応募者とのメッセージがスムーズで、採用担当の工数が半分になりました。',
        size: '従業員200名',
    },
    {
        company: '小売業',
        industry: '小売・販売',
        comment: 'まず無料掲載で試して、反応がよかったので有料プランにアップしました。日額¥500から始められるので無駄なく使えます。',
        size: '従業員30名',
    },
];

export default function ForCompaniesPage() {
    const navigate = useNavigate();

    return (
        <div className="animate-fade-in">
            <Helmet>
                <title>企業の採用担当者へ - Atally</title>
                <meta name="description" content="ぴったりの人材を、見つけよう。Atallyは求人掲載からスカウトまで採用に必要なすべてが揃うプラットフォームです。" />
            </Helmet>

            {/* ヒーロー */}
            <section style={{
                background: 'var(--color-bg-secondary)',
                borderBottom: '1px solid var(--color-border)',
                padding: 'var(--space-3xl) var(--space-md)',
                textAlign: 'center',
                minHeight: '60vh',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
                <div style={{ maxWidth: 720 }}>
                    <div style={{
                        fontSize: 'var(--font-size-xs)',
                        letterSpacing: '0.12em',
                        textTransform: 'uppercase',
                        color: 'var(--color-text-accent)',
                        fontWeight: 600,
                        marginBottom: 'var(--space-lg)',
                    }}>
                        採用担当者の方へ
                    </div>
                    <h1 style={{ fontSize: 'clamp(1.75rem, 4vw, 2.5rem)', fontWeight: 800, lineHeight: 1.3, marginBottom: 'var(--space-lg)', color: 'var(--color-navy)' }}>
                        ぴったりの人材を、<br />見つけよう。
                    </h1>
                    <p style={{ fontSize: 'var(--font-size-base)', color: 'var(--color-text-secondary)', lineHeight: 1.8, marginBottom: 'var(--space-2xl)', maxWidth: 560, margin: '0 auto var(--space-2xl)' }}>
                        求人掲載は<strong style={{ color: 'var(--color-navy)' }}>無料</strong>からスタートできます。<br />
                        注目を集めたい場合は日額・月額¥500〜の有料プランも選択可能。<br />
                        採用成功報酬なし。最短5分で掲載開始。
                    </p>
                    <div style={{ display: 'flex', gap: 'var(--space-md)', justifyContent: 'center', flexWrap: 'wrap' }}>
                        <button
                            className="btn btn-primary"
                            style={{ fontSize: 'var(--font-size-base)', padding: '14px 32px' }}
                            onClick={() => navigate('/register?role=company')}
                        >
                            無料で求人を掲載する
                        </button>
                        <Link to="/pricing" className="btn btn-secondary" style={{ fontSize: 'var(--font-size-base)', padding: '14px 32px' }}>
                            料金を確認する
                        </Link>
                    </div>
                    <p style={{ marginTop: 'var(--space-md)', fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
                        職業安定法準拠 · 求人掲載無料から · 成功報酬¥0 · いつでも停止・再開可
                    </p>
                </div>
            </section>

            {/* 数字で見るAtally */}
            <section style={{ background: 'var(--color-bg-secondary)', padding: 'var(--space-2xl) var(--space-md)', borderBottom: '1px solid var(--color-border)' }}>
                <div className="container" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 'var(--space-lg)', textAlign: 'center' }}>
                    {[
                        { num: '5分', label: '最短で掲載開始' },
                        { num: '¥0', label: '無料プランで掲載可能' },
                        { num: '¥500〜', label: '有料プランの最低日額' },
                        { num: 'いつでも', label: '停止・再開OK' },
                    ].map((s, i) => (
                        <div key={i}>
                            <div style={{ fontSize: 'var(--font-size-3xl)', fontWeight: 800, color: 'var(--color-accent)' }}>{s.num}</div>
                            <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', marginTop: 4 }}>{s.label}</div>
                        </div>
                    ))}
                </div>
            </section>

            {/* 機能一覧 */}
            <section style={{ padding: 'var(--space-3xl) var(--space-md)' }}>
                <div className="container">
                    <div style={{ textAlign: 'center', marginBottom: 'var(--space-2xl)' }}>
                        <h2 style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 700, marginBottom: 'var(--space-sm)' }}>
                            採用に必要なすべてが揃っています
                        </h2>
                        <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-sm)' }}>
                            複数のツールを使い分ける必要はありません
                        </p>
                    </div>

                    {/* グループ①: 採用活動を効率化 */}
                    <div style={{ marginBottom: 'var(--space-xl)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)', marginBottom: 'var(--space-md)' }}>
                            <span style={{ fontWeight: 700, fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>採用活動を効率化</span>
                            <div style={{ flex: 1, height: 1, background: 'var(--color-border)' }} />
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 'var(--space-md)' }}>
                            {FEATURES.filter(f => f.group === '採用活動を効率化').map((f, i) => (
                                <div key={i} className="card card-lift" style={{ padding: 'var(--space-xl)' }}>
                                    <div style={{ fontSize: 28, marginBottom: 'var(--space-md)' }}>{f.icon}</div>
                                    <h3 style={{ fontSize: 'var(--font-size-base)', fontWeight: 700, marginBottom: 'var(--space-sm)' }}>{f.title}</h3>
                                    <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', lineHeight: 1.7, margin: 0 }}>{f.desc}</p>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* グループ②: コスト管理・安心 */}
                    <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)', marginBottom: 'var(--space-md)' }}>
                            <span style={{ fontWeight: 700, fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>コスト管理・安心</span>
                            <div style={{ flex: 1, height: 1, background: 'var(--color-border)' }} />
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 'var(--space-md)' }}>
                            {FEATURES.filter(f => f.group === 'コスト管理・安心').map((f, i) => (
                                <div key={i} className="card card-lift" style={{ padding: 'var(--space-xl)' }}>
                                    <div style={{ fontSize: 28, marginBottom: 'var(--space-md)' }}>{f.icon}</div>
                                    <h3 style={{ fontSize: 'var(--font-size-base)', fontWeight: 700, marginBottom: 'var(--space-sm)' }}>{f.title}</h3>
                                    <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', lineHeight: 1.7, margin: 0 }}>{f.desc}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </section>

            {/* 利用の流れ */}
            <section style={{ background: 'var(--color-bg-surface)', padding: 'var(--space-3xl) var(--space-md)', borderTop: '1px solid var(--color-border)', borderBottom: '1px solid var(--color-border)' }}>
                <div className="container">
                    <div style={{ textAlign: 'center', marginBottom: 'var(--space-2xl)' }}>
                        <h2 style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 700, marginBottom: 'var(--space-sm)' }}>
                            4ステップで採用開始
                        </h2>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 'var(--space-lg)' }}>
                        {STEPS.map((step, i) => (
                            <div key={i} style={{ textAlign: 'center', position: 'relative' }}>
                                <div style={{ fontSize: 36, marginBottom: 'var(--space-sm)' }}>{step.icon}</div>
                                <div style={{ fontSize: 'var(--font-size-xs)', fontWeight: 700, color: 'var(--color-accent)', marginBottom: 'var(--space-xs)', letterSpacing: '0.1em' }}>
                                    STEP {step.num}
                                </div>
                                <h3 style={{ fontSize: 'var(--font-size-base)', fontWeight: 700, marginBottom: 'var(--space-sm)' }}>{step.title}</h3>
                                <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', lineHeight: 1.7, margin: 0 }}>{step.desc}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* 導入事例 */}
            <section style={{ padding: 'var(--space-3xl) var(--space-md)' }}>
                <div className="container">
                    <div style={{ textAlign: 'center', marginBottom: 'var(--space-2xl)' }}>
                        <h2 style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 700, marginBottom: 'var(--space-sm)' }}>
                            導入企業の声
                        </h2>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 'var(--space-md)' }}>
                        {TESTIMONIALS.map((t, i) => (
                            <div key={i} className="card" style={{ padding: 'var(--space-xl)' }}>
                                <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', lineHeight: 1.8, marginBottom: 'var(--space-lg)', fontStyle: 'italic' }}>
                                    「{t.comment}」
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)' }}>
                                    <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--color-accent-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>🏢</div>
                                    <div>
                                        <div style={{ fontWeight: 600, fontSize: 'var(--font-size-sm)' }}>{t.company}</div>
                                        <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>{t.industry} · {t.size}</div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* CTA */}
            <section style={{
                background: 'var(--color-accent-light)',
                borderTop: '1px solid var(--color-border)',
                padding: 'var(--space-3xl) var(--space-md)',
                textAlign: 'center',
            }}>
                <h2 style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 700, marginBottom: 'var(--space-md)', color: 'var(--color-navy)' }}>
                    今すぐ採用を始めましょう
                </h2>
                <p style={{ color: 'var(--color-text-secondary)', marginBottom: 'var(--space-xl)', fontSize: 'var(--font-size-sm)' }}>
                    求人掲載は無料からスタートできます。有料プランは日額・月額¥500〜。<br />
                    成功報酬なし、違約金なし、いつでも停止可能。
                </p>
                <div style={{ display: 'flex', gap: 'var(--space-md)', justifyContent: 'center', flexWrap: 'wrap' }}>
                    <button className="btn btn-primary" style={{ fontSize: 'var(--font-size-base)', padding: '14px 32px' }} onClick={() => navigate('/register?role=company')}>
                        無料で始める
                    </button>
                    <Link to="/help" className="btn btn-secondary" style={{ fontSize: 'var(--font-size-base)', padding: '14px 32px' }}>
                        よくある質問
                    </Link>
                </div>
            </section>
        </div>
    );
}
