import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { useAuth } from '../hooks/useAuth';

const FAQS = [
    {
        q: '無料で使えますか？',
        a: '求人掲載は無料で利用できます。有料プランを使う場合、日額・月額ともに最低¥500から設定できます。初期費用・採用成功報酬は一切かかりません。',
    },
    {
        q: '有効化したときにすぐ課金されますか？',
        a: 'はい。求人やキャンペーンを「配信中」にした瞬間に初回分が即時決済されます。日額プランはその後毎日0時に自動課金、月額プランは申し込み日から1ヶ月ごとに自動更新されます。',
    },
    {
        q: '日額プランと月額プランの違いは何ですか？',
        a: '日額プランは設定金額が毎日自動課金されます。月額プランはキャンペーン機能でのみ選択でき、申し込み日を起点に1ヶ月ごとに自動更新・課金されます（月初固定ではなく、例えば4月15日申し込みなら次回は5月15日）。求人ごとへの日割り配分はシステムが自動で計算します。',
    },
    {
        q: '月額プランはいつ請求されますか？',
        a: '申し込み（またはキャンペーン再開）時点で初回分を即時決済します。以降は申し込み日から1ヶ月後に自動更新されます。次回請求日はキャンペーン管理画面で確認できます。',
    },
    {
        q: 'キャンペーン機能とは何ですか？',
        a: '複数の求人をひとつの予算グループにまとめて管理できる機能です。例えば10件の求人にまとめて¥10,000を設定すると1件あたり¥1,000が配分されます。パフォーマンス（閲覧数）に応じた自動配分も選択できます。日額・月額どちらでも利用可能です。',
    },
    {
        q: 'スカウト機能はいつ使えますか？',
        a: '有料掲載中（配信中）の求人が1件以上あれば、スカウト検索・送信が利用できます（追加料金なし）。無料掲載のみの場合はスカウト機能はご利用いただけません。すべての有料求人を停止・非公開にするとスカウト機能もロックされます。',
    },
    {
        q: 'いつでも停止・変更できますか？',
        a: 'はい、いつでも可能です。求人・キャンペーンを「一時停止」にすると翌日（月額は次の請求タイミング）から課金が止まります。違約金・解約手続きは一切不要です。',
    },
    {
        q: '決済が失敗した場合はどうなりますか？',
        a: '決済失敗時は求人・キャンペーンが自動的に一時停止され、登録メールアドレスに通知が届きます。カード情報を更新後、管理画面から「再開」することで再度即時決済が行われ掲載が再開します。',
    },
    {
        q: '支払い方法は何がありますか？',
        a: 'クレジットカード（Visa / Mastercard / American Express）に対応しています。決済はStripeを通じて安全に処理され、カード番号はAtallyのサーバーには保存されません。',
    },
    {
        q: '採用できた場合に追加費用はかかりますか？',
        a: 'かかりません。採用成功報酬は一切なく、設定した日額・月額予算のみのお支払いです。',
    },
];

export default function PricingPage() {
    const [openFaq, setOpenFaq] = useState(null);
    const { user } = useAuth();
    const navigate = useNavigate();

    return (
        <div className="page animate-fade-in" style={{ paddingTop: 0 }}>
            <Helmet>
                <title>料金について - Atally</title>
                <meta name="description" content="初期費用・成功報酬なし。使った分だけの完全従量課金。Atallyの料金体系を解説します。" />
            </Helmet>

            {/* ヘッダー */}
            <div style={{
                background: 'linear-gradient(160deg, #1a2a4a 0%, #0d1b35 100%)',
                padding: 'var(--space-3xl) var(--space-md)',
                textAlign: 'center',
                color: '#fff',
            }}>
                <h1 style={{ fontSize: 'var(--font-size-3xl)', fontWeight: 700, marginBottom: 'var(--space-sm)' }}>
                    無料から始めて、必要なときだけ課金。
                </h1>
                <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: 'var(--font-size-base)', maxWidth: 520, margin: '0 auto var(--space-lg)' }}>
                    求人掲載は無料。注目度を高めたい場合は日額・月額¥500〜から。<br />
                    初期費用なし・採用成功報酬なし・違約金なし。
                </p>
                <div style={{ display: 'flex', justifyContent: 'center', gap: 'var(--space-sm)', flexWrap: 'wrap' }}>
                    {['¥0 掲載は無料から', '¥0 成功報酬', '有料は¥500〜/日', '違約金なし'].map((t, i) => (
                        <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '4px 14px', borderRadius: 'var(--radius-full)', background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', fontSize: 'var(--font-size-xs)', color: 'rgba(255,255,255,0.85)', fontWeight: 500 }}>✓ {t}</span>
                    ))}
                </div>
            </div>

            <div className="container" style={{ maxWidth: 860, paddingTop: 'var(--space-3xl)', paddingBottom: 'var(--space-3xl)' }}>

                {/* 3つのポイント */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 'var(--space-md)', marginBottom: 'var(--space-3xl)' }}>
                    {[
                        { icon: '🆓', title: '無料で掲載できる', desc: '求人掲載は無料からスタート可能。有料プランにしたい場合は日額・月額¥500〜から設定できます。' },
                        { icon: '⚡', title: '有効化即時決済', desc: '有料プランを「配信中」にした瞬間に初回分を即時決済。日額は毎日自動課金、月額は申し込み日から1ヶ月ごとに自動更新。' },
                        { icon: '🎯', title: '成功報酬なし', desc: '採用が決まっても追加費用は一切かかりません。設定した日額・月額予算のみのシンプルな料金体系。' },
                    ].map((item, i) => (
                        <div key={i} className="card" style={{ padding: 'var(--space-xl)', textAlign: 'center' }}>
                            <div style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 800, color: 'var(--color-accent)', marginBottom: 'var(--space-sm)' }}>{item.icon}</div>
                            <h3 style={{ fontSize: 'var(--font-size-base)', fontWeight: 700, marginBottom: 'var(--space-sm)' }}>{item.title}</h3>
                            <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', lineHeight: 1.7, margin: 0 }}>{item.desc}</p>
                        </div>
                    ))}
                </div>

                {/* 仕組みの説明 */}
                <div className="card" style={{ padding: 'var(--space-2xl)', marginBottom: 'var(--space-3xl)' }}>
                    <h2 style={{ fontSize: 'var(--font-size-xl)', fontWeight: 700, marginBottom: 'var(--space-xl)' }}>料金の仕組み</h2>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-xl)' }}>
                        {/* ステップ1 */}
                        <div style={{ display: 'flex', gap: 'var(--space-lg)', alignItems: 'flex-start' }}>
                            <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--gradient-accent)', color: '#fff', fontWeight: 700, fontSize: 'var(--font-size-sm)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>1</div>
                            <div>
                                <div style={{ fontWeight: 700, marginBottom: 4 }}>求人を作成する（無料掲載 or 有料プランを選択）</div>
                                <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', lineHeight: 1.7 }}>
                                    求人票を作成後、そのまま無料で掲載できます。有料プランを使う場合は1日あたりの予算を設定（最低¥500〜）。複数求人はキャンペーン機能でまとめて管理でき、日額・月額を選択できます。
                                </div>
                            </div>
                        </div>

                        <div style={{ height: 1, background: 'var(--color-border)', marginLeft: 54 }} />

                        {/* ステップ2 */}
                        <div style={{ display: 'flex', gap: 'var(--space-lg)', alignItems: 'flex-start' }}>
                            <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--gradient-accent)', color: '#fff', fontWeight: 700, fontSize: 'var(--font-size-sm)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>2</div>
                            <div>
                                <div style={{ fontWeight: 700, marginBottom: 4 }}>有効化した瞬間に初日分を即時決済</div>
                                <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', lineHeight: 1.7 }}>
                                    求人を「配信中」にした時点でその日の予算を即時決済します。設定した日額予算が高いほど検索上位に表示されやすくなり、応募数アップにつながります。
                                </div>
                            </div>
                        </div>

                        <div style={{ height: 1, background: 'var(--color-border)', marginLeft: 54 }} />

                        {/* ステップ3 */}
                        <div style={{ display: 'flex', gap: 'var(--space-lg)', alignItems: 'flex-start' }}>
                            <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--gradient-accent)', color: '#fff', fontWeight: 700, fontSize: 'var(--font-size-sm)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>3</div>
                            <div>
                                <div style={{ fontWeight: 700, marginBottom: 4 }}>自動継続課金</div>
                                <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', lineHeight: 1.7 }}>
                                    日額プランは毎日0時に自動課金。月額プランは申し込み日から1ヶ月ごとに自動更新・課金されます（例: 4/15申し込み → 次回5/15）。
                                    決済失敗時は自動で掲載を停止し、メールでお知らせします。有料掲載中であればスカウト機能も追加費用なしで利用できます。
                                </div>
                            </div>
                        </div>

                        <div style={{ height: 1, background: 'var(--color-border)', marginLeft: 54 }} />

                        {/* ステップ4 */}
                        <div style={{ display: 'flex', gap: 'var(--space-lg)', alignItems: 'flex-start' }}>
                            <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--gradient-accent)', color: '#fff', fontWeight: 700, fontSize: 'var(--font-size-sm)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>4</div>
                            <div>
                                <div style={{ fontWeight: 700, marginBottom: 4 }}>いつでも停止・予算変更できる</div>
                                <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', lineHeight: 1.7 }}>
                                    求人を一時停止すれば翌日からの課金がすぐ止まります。契約期間・違約金・解約手続きは一切不要です。
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* キャンペーン機能の説明 */}
                <div className="card" style={{ padding: 'var(--space-2xl)', marginBottom: 'var(--space-3xl)', background: 'linear-gradient(135deg, rgba(18,28,52,0.05) 0%, rgba(168,85,247,0.04) 100%)' }}>
                    <div style={{ display: 'flex', gap: 'var(--space-xl)', alignItems: 'center', flexWrap: 'wrap' }}>
                        <div style={{ flex: '1 1 280px' }}>
                            <div style={{ display: 'inline-block', padding: '3px 10px', background: 'var(--color-accent)15', border: '1px solid var(--color-accent)30', borderRadius: 'var(--radius-full)', fontSize: 'var(--font-size-xs)', color: 'var(--color-accent)', fontWeight: 600, marginBottom: 'var(--space-sm)' }}>
                                複数求人をまとめて管理
                            </div>
                            <h2 style={{ fontSize: 'var(--font-size-xl)', fontWeight: 700, marginBottom: 'var(--space-sm)' }}>キャンペーン機能</h2>
                            <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', lineHeight: 1.8, margin: 0 }}>
                                複数の求人をひとつの予算グループにまとめ、トータルコストをコントロールできます。
                                日額・月額どちらでも設定でき、均等配分またはパフォーマンス比での自動配分を選択できます。
                            </p>
                        </div>
                        <div style={{ flex: '1 1 240px', background: 'var(--color-bg-surface)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-border)', padding: 'var(--space-lg)' }}>
                            <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', marginBottom: 'var(--space-sm)' }}>計算例（日額プラン）</div>
                            {[
                                { label: 'キャンペーン日額予算', value: '¥10,000' },
                                { label: '対象求人数', value: '10件' },
                                { label: '1件あたり日額', value: '¥1,000/日', accent: true },
                                { label: '月額換算', value: '約¥300,000' },
                            ].map((row, i) => (
                                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: i < 3 ? '1px solid var(--color-border)' : 'none' }}>
                                    <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>{row.label}</span>
                                    <span style={{ fontSize: 'var(--font-size-sm)', fontWeight: row.accent ? 700 : 500, color: row.accent ? 'var(--color-accent)' : 'var(--color-text)' }}>{row.value}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* できること一覧 */}
                <div style={{ marginBottom: 'var(--space-3xl)' }}>
                    <h2 style={{ fontSize: 'var(--font-size-xl)', fontWeight: 700, marginBottom: 'var(--space-lg)' }}>含まれる機能</h2>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 'var(--space-sm)' }}>
                        {[
                            { icon: '📋', label: '求人票の作成・公開' },
                            { icon: '👥', label: '応募者管理（選考フロー）' },
                            { icon: '💬', label: '応募者とのメッセージ' },
                            { icon: '✉️', label: 'スカウト機能（有料掲載1件以上で利用可）' },
                            { icon: '📊', label: '求人パフォーマンス分析' },
                            { icon: '📁', label: '応募者データCSVエクスポート' },
                            { icon: '📅', label: '面接日程の管理' },
                            { icon: '🗂️', label: 'キャンペーン（予算グループ）管理' },
                            { icon: '⚡', label: '有効化即時決済・毎日自動課金' },
                            { icon: '🔔', label: '決済失敗時の自動停止・メール通知' },
                        ].map((f, i) => (
                            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)', padding: 'var(--space-sm) var(--space-md)', background: 'var(--color-bg-surface)', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)' }}>
                                <span>{f.icon}</span>
                                <span style={{ fontSize: 'var(--font-size-sm)' }}>{f.label}</span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* 人材紹介会社向け料金 */}
                <div style={{ marginBottom: 'var(--space-3xl)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)', marginBottom: 'var(--space-lg)' }}>
                        <h2 style={{ fontSize: 'var(--font-size-xl)', fontWeight: 700, margin: 0 }}>人材紹介会社の方へ</h2>
                        <span style={{ padding: '2px 10px', borderRadius: 'var(--radius-full)', background: 'rgba(149,100,200,0.1)', border: '1px solid rgba(149,100,200,0.25)', fontSize: 'var(--font-size-xs)', color: '#7c3aed', fontWeight: 600 }}>エージェント専用</span>
                    </div>
                    <div className="card" style={{ overflow: 'hidden', marginBottom: 'var(--space-md)' }}>
                        {[
                            { label: '紹介申請 システム利用料', value: '¥500 / 件', note: '他社求人に候補者を紹介申請するたびに発生。紹介の成否にかかわらず課金。', highlight: true },
                            { label: '採用成功報酬', value: '企業間で直接契約', note: '成功報酬は紹介元企業と採用企業が直接取り決めます。Atallyは一切関与しません。手数料タイプは料率（デフォルト20%）または固定金額から選択できます。', highlight: false },
                            { label: '自社求人の掲載費', value: '¥500〜/日 または 月額', note: '一般企業と同じ従量課金。自社保有求人の掲載が必要な場合のみ発生。', highlight: false },
                            { label: '初期費用 / 月額固定', value: '¥0', note: '初期費用・月額固定費・プラットフォームへの成功報酬の上乗せは一切なし。', highlight: false },
                        ].map((item, i, arr) => (
                            <div key={i} style={{
                                display: 'flex', gap: 'var(--space-md)', alignItems: 'flex-start',
                                padding: 'var(--space-lg) var(--space-xl)',
                                borderBottom: i < arr.length - 1 ? '1px solid var(--color-border)' : 'none',
                                background: item.highlight ? 'rgba(18,28,52,0.02)' : 'transparent',
                            }}>
                                <div style={{ flex: 1 }}>
                                    <div style={{ fontWeight: 600, fontSize: 'var(--font-size-sm)', marginBottom: 4 }}>{item.label}</div>
                                    <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', lineHeight: 1.6 }}>{item.note}</div>
                                </div>
                                <div style={{ fontWeight: 700, fontSize: 'var(--font-size-base)', color: item.highlight ? 'var(--color-accent)' : 'var(--color-text-secondary)', textAlign: 'right', flexShrink: 0, maxWidth: 200 }}>
                                    {item.value}
                                </div>
                            </div>
                        ))}
                    </div>
                    <div style={{ display: 'flex', gap: 'var(--space-sm)', alignItems: 'center', flexWrap: 'wrap' }}>
                        <Link to="/for-agencies" className="btn btn-secondary" style={{ fontSize: 'var(--font-size-sm)' }}>
                            紹介会社向け詳細ページ →
                        </Link>
                        <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>職業紹介事業許可証のライセンス審査が必要です</span>
                    </div>
                </div>

                {/* FAQ */}
                <h2 style={{ fontSize: 'var(--font-size-xl)', fontWeight: 700, marginBottom: 'var(--space-lg)' }}>よくある質問</h2>
                <div className="card" style={{ padding: 'var(--space-md) var(--space-xl)', marginBottom: 'var(--space-xl)' }}>
                    {FAQS.map((f, i) => (
                        <div key={i} style={{ borderBottom: i < FAQS.length - 1 ? '1px solid var(--color-border)' : 'none' }}>
                            <button onClick={() => setOpenFaq(openFaq === i ? null : i)} style={{
                                width: '100%', textAlign: 'left', background: 'none', border: 'none',
                                padding: 'var(--space-md) 0', cursor: 'pointer',
                                display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 'var(--space-md)',
                                fontSize: 'var(--font-size-base)', fontWeight: 500, color: 'var(--color-text-primary)',
                            }}>
                                <span>{f.q}</span>
                                <span style={{ color: 'var(--color-accent)', fontSize: 18, flexShrink: 0, transform: openFaq === i ? 'rotate(45deg)' : 'none', transition: 'transform 0.2s' }}>＋</span>
                            </button>
                            {openFaq === i && (
                                <div style={{ paddingBottom: 'var(--space-md)', color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-sm)', lineHeight: 1.8 }}>
                                    {f.a}
                                </div>
                            )}
                        </div>
                    ))}
                </div>

                {/* CTA */}
                <div style={{ textAlign: 'center', background: 'linear-gradient(135deg, rgba(200,149,46,0.1), rgba(200,149,46,0.05))', border: '1px solid rgba(200,149,46,0.25)', borderRadius: 'var(--radius-lg)', padding: 'var(--space-2xl)' }}>
                    <h3 style={{ marginBottom: 'var(--space-sm)' }}>まず無料で始めてみましょう</h3>
                    <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-sm)', marginBottom: 'var(--space-lg)' }}>
                        アカウント作成は無料。求人を作成して予算を設定するまで費用はかかりません。
                    </p>
                    <div style={{ display: 'flex', gap: 'var(--space-md)', justifyContent: 'center', flexWrap: 'wrap' }}>
                        <button className="btn btn-primary" style={{ padding: '12px 32px' }} onClick={() => navigate(user ? '/company/jobs' : '/register?role=company')}>
                            求人を掲載する
                        </button>
                        <Link to="/help" className="btn btn-secondary" style={{ padding: '12px 32px' }}>
                            詳しく聞く
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    );
}
