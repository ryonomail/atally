import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';

const FEATURES = [
    {
        icon: '🗂️',
        title: '求人データベース',
        desc: '他社企業の紹介受入求人を一覧検索。キーワード・勤務地・給与で絞り込み、候補者にぴったりの求人を探せます。',
        group: '紹介業務を効率化',
    },
    {
        icon: '👤',
        title: '候補者マッチング',
        desc: 'スカウト公開中の求職者を匿名で検索し、求人とマッチした候補者を選んで紹介申請できます。',
        group: '紹介業務を効率化',
    },
    {
        icon: '📂',
        title: 'CSV一括アップロード',
        desc: '自社保有の求人を一括登録。テンプレートに沿って入力するだけで、大量の求人も短時間で掲載できます。',
        group: '紹介業務を効率化',
    },
    {
        icon: '🏢',
        title: 'クライアント管理',
        desc: '取引先企業の担当者情報・連絡先をプラットフォーム上で一元管理。案件ごとの進捗も把握できます。',
        group: '紹介業務を効率化',
    },
    {
        icon: '📊',
        title: '成約・紹介分析',
        desc: '月別・クライアント別の紹介件数・成約状況をダッシュボードで確認。経営判断に必要なデータをすぐに把握。',
        group: '信頼・コスト管理',
    },
    {
        icon: '🔒',
        title: 'ライセンス認証バッジ',
        desc: '職業紹介事業許可証を提出して運営が認証。認証済みバッジにより採用企業からの信頼性が向上します。',
        group: '信頼・コスト管理',
    },
];

const STEPS = [
    { num: '01', icon: '📝', title: 'アカウント作成', desc: '人材紹介会社として登録。基本情報と会社名を入力するだけで、すぐに利用開始できます。' },
    { num: '02', icon: '📜', title: 'ライセンス申請', desc: '職業紹介事業許可証と許可番号を提出。運営審査後に認証済みバッジが付与されます。' },
    { num: '03', icon: '🔍', title: '求人・候補者を探す', desc: '求人データベースから紹介受入求人を検索し、マッチする候補者を見つけます。' },
    { num: '04', icon: '✉️', title: '紹介申請・成約', desc: 'システム利用料¥500で紹介申請を送信。承認後は採用企業と直接契約して成功報酬を受け取ります。' },
];

const PRICING_ITEMS = [
    {
        label: '自社求人の掲載費',
        value: '無料 〜 ¥500〜/日',
        note: '自社求人の掲載は無料から可能。注目度を上げたい場合は日額・月額¥500〜の有料プランを選択できます。一般企業と同じ料金体系。',
    },
    {
        label: '紹介申請 システム利用料',
        value: '¥500 / 件',
        note: '他社求人に候補者を紹介申請するたびに発生。紹介の成否にかかわらず課金。',
    },
    {
        label: '採用成功報酬',
        value: '企業間で直接契約',
        note: '成功報酬は紹介元と採用企業が直接取り決めます。Atallyは関与しません。手数料タイプは料率（デフォルト20%）または固定金額から選択できます。',
    },
    {
        label: '初期費用 / 月額固定',
        value: '¥0',
        note: '初期費用・月額固定費・プラットフォームへの成功報酬上乗せは一切なし。',
    },
];

export default function ForAgenciesPage() {
    const navigate = useNavigate();

    return (
        <div className="animate-fade-in">
            <Helmet>
                <title>人材紹介会社の方へ - Atally</title>
                <meta name="description" content="AtallyはBtoB人材紹介に必要な機能をワンストップで提供。求人DB・候補者マッチング・収益管理まで一つのプラットフォームで完結します。" />
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
                        人材紹介会社の方へ
                    </div>
                    <h1 style={{ fontSize: 'clamp(1.75rem, 4vw, 2.5rem)', fontWeight: 800, lineHeight: 1.3, marginBottom: 'var(--space-lg)', color: 'var(--color-navy)' }}>
                        紹介業務を、<br />もっとシンプルに。
                    </h1>
                    <p style={{ fontSize: 'var(--font-size-base)', color: 'var(--color-text-secondary)', lineHeight: 1.8, marginBottom: 'var(--space-2xl)', maxWidth: 560, margin: '0 auto var(--space-2xl)' }}>
                        求人DB検索から候補者マッチング、紹介申請、成約管理、収益分析まで。<br />
                        自社求人は<strong style={{ color: 'var(--color-navy)' }}>無料</strong>で掲載可能。紹介申請は¥500/件のみ。<br />
                        月額固定費なし、採用成功報酬への上乗せなし。
                    </p>
                    <div style={{ display: 'flex', gap: 'var(--space-md)', justifyContent: 'center', flexWrap: 'wrap' }}>
                        <button
                            className="btn btn-primary"
                            style={{ fontSize: 'var(--font-size-base)', padding: '14px 32px' }}
                            onClick={() => navigate('/register?role=company')}
                        >
                            無料で始める
                        </button>
                        <Link to="/pricing" className="btn btn-secondary" style={{ fontSize: 'var(--font-size-base)', padding: '14px 32px' }}>
                            料金を確認する
                        </Link>
                    </div>
                    <p style={{ marginTop: 'var(--space-md)', fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
                        職業安定法準拠 · ライセンス審査あり · 自社求人掲載無料から · 紹介申請¥500/件 · 月額固定費¥0
                    </p>
                </div>
            </section>

            {/* 数字 */}
            <section style={{ background: 'var(--color-bg-secondary)', padding: 'var(--space-2xl) var(--space-md)', borderBottom: '1px solid var(--color-border)' }}>
                <div className="container" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 'var(--space-lg)', textAlign: 'center' }}>
                    {[
                        { num: '¥0', label: '自社求人掲載（無料から）' },
                        { num: '¥500', label: '紹介申請 /件' },
                        { num: '20%', label: 'デフォルト手数料率' },
                        { num: '¥0', label: '月額固定費・初期費用' },
                    ].map((s, i) => (
                        <div key={i}>
                            <div style={{ fontSize: 'var(--font-size-3xl)', fontWeight: 800, color: 'var(--color-accent)' }}>{s.num}</div>
                            <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', marginTop: 4 }}>{s.label}</div>
                        </div>
                    ))}
                </div>
            </section>

            {/* 機能 */}
            <section style={{ padding: 'var(--space-3xl) var(--space-md)' }}>
                <div className="container">
                    <div style={{ textAlign: 'center', marginBottom: 'var(--space-2xl)' }}>
                        <h2 style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 700, marginBottom: 'var(--space-sm)' }}>
                            紹介業務に必要な機能がすべて揃っています
                        </h2>
                        <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-sm)' }}>
                            複数のツールを使い分ける必要はありません
                        </p>
                    </div>

                    {/* グループ①: 紹介業務を効率化 */}
                    <div style={{ marginBottom: 'var(--space-xl)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)', marginBottom: 'var(--space-md)' }}>
                            <span style={{ fontWeight: 700, fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>紹介業務を効率化</span>
                            <div style={{ flex: 1, height: 1, background: 'var(--color-border)' }} />
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 'var(--space-md)' }}>
                            {FEATURES.filter(f => f.group === '紹介業務を効率化').map((f, i) => (
                                <div key={i} className="card card-lift" style={{ padding: 'var(--space-xl)' }}>
                                    <div style={{ fontSize: 28, marginBottom: 'var(--space-md)' }}>{f.icon}</div>
                                    <h3 style={{ fontSize: 'var(--font-size-base)', fontWeight: 700, marginBottom: 'var(--space-sm)' }}>{f.title}</h3>
                                    <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', lineHeight: 1.7, margin: 0 }}>{f.desc}</p>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* グループ②: 信頼・コスト管理 */}
                    <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)', marginBottom: 'var(--space-md)' }}>
                            <span style={{ fontWeight: 700, fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>信頼・コスト管理</span>
                            <div style={{ flex: 1, height: 1, background: 'var(--color-border)' }} />
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 'var(--space-md)' }}>
                            {FEATURES.filter(f => f.group === '信頼・コスト管理').map((f, i) => (
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

            {/* 料金 */}
            <section style={{ background: 'var(--color-bg-surface)', padding: 'var(--space-3xl) var(--space-md)', borderTop: '1px solid var(--color-border)', borderBottom: '1px solid var(--color-border)' }}>
                <div className="container" style={{ maxWidth: 720 }}>
                    <div style={{ textAlign: 'center', marginBottom: 'var(--space-2xl)' }}>
                        <h2 style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 700, marginBottom: 'var(--space-sm)' }}>
                            料金体系
                        </h2>
                        <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-sm)' }}>
                            一般企業とは異なる、紹介会社向けの料金モデル
                        </p>
                    </div>
                    <div className="card" style={{ overflow: 'hidden' }}>
                        {PRICING_ITEMS.map((item, i) => (
                            <div key={i} style={{
                                display: 'flex', gap: 'var(--space-md)', alignItems: 'flex-start',
                                padding: 'var(--space-lg) var(--space-xl)',
                                borderBottom: i < PRICING_ITEMS.length - 1 ? '1px solid var(--color-border)' : 'none',
                            }}>
                                <div style={{ flex: 1 }}>
                                    <div style={{ fontWeight: 600, fontSize: 'var(--font-size-sm)', marginBottom: 4 }}>{item.label}</div>
                                    <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>{item.note}</div>
                                </div>
                                <div style={{ fontWeight: 700, fontSize: 'var(--font-size-base)', color: 'var(--color-accent)', textAlign: 'right', flexShrink: 0, maxWidth: 200 }}>
                                    {item.value}
                                </div>
                            </div>
                        ))}
                    </div>
                    <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', marginTop: 'var(--space-md)', textAlign: 'center' }}>
                        採用成功報酬は紹介元と採用企業間で直接契約・支払いが行われます。Atallyは一切関与しません。<br />
                        詳細は<Link to="/pricing" style={{ color: 'var(--color-accent)' }}>料金ページ</Link>をご確認ください。
                    </p>
                </div>
            </section>

            {/* 利用の流れ */}
            <section style={{ padding: 'var(--space-3xl) var(--space-md)' }}>
                <div className="container">
                    <div style={{ textAlign: 'center', marginBottom: 'var(--space-2xl)' }}>
                        <h2 style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 700, marginBottom: 'var(--space-sm)' }}>
                            4ステップで紹介業務を開始
                        </h2>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 'var(--space-lg)' }}>
                        {STEPS.map((step, i) => (
                            <div key={i} style={{ textAlign: 'center' }}>
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

            {/* CTA */}
            <section style={{
                background: 'var(--color-accent-light)',
                borderTop: '1px solid var(--color-border)',
                padding: 'var(--space-3xl) var(--space-md)',
                textAlign: 'center',
            }}>
                <h2 style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 700, marginBottom: 'var(--space-md)', color: 'var(--color-navy)' }}>
                    紹介業務をAtally で始めましょう
                </h2>
                <p style={{ color: 'var(--color-text-secondary)', marginBottom: 'var(--space-xl)', fontSize: 'var(--font-size-sm)' }}>
                    自社求人の掲載は無料からスタートできます。<br />
                    ライセンス審査を通過すれば、求人DBへのアクセスと候補者紹介機能が解放されます。紹介申請¥500/件のみ。
                </p>
                <div style={{ display: 'flex', gap: 'var(--space-md)', justifyContent: 'center', flexWrap: 'wrap' }}>
                    <button className="btn btn-primary" style={{ fontSize: 'var(--font-size-base)', padding: '14px 32px' }}
                        onClick={() => navigate('/register?role=company')}>
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
