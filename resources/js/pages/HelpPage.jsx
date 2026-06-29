import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { Search } from 'lucide-react';

const FAQS = {
    jobseeker: [
        {
            q: '登録は無料ですか？',
            a: 'はい、求職者の方は完全無料でご利用いただけます。登録から応募、メッセージのやり取りまで、すべて無料です。',
        },
        {
            q: '履歴書のデータは安全に管理されますか？',
            a: 'はい。ご登録の情報はSSL暗号化通信で保護され、応募先企業以外に共有されることはありません。プライバシーポリシーに基づき厳重に管理しています。',
        },
        {
            q: 'スカウトとはどのような機能ですか？',
            a: '企業の採用担当者があなたのプロフィールや履歴書を見て、直接オファーを送れる機能です。履歴書一覧からデフォルト履歴書を設定するとスカウトを受け取りやすくなります。',
        },
        {
            q: '応募後のキャンセルはできますか？',
            a: '応募後のキャンセルは現在対応していません。応募前に求人内容をよくご確認ください。不明な点は企業へのメッセージ機能でお問い合わせいただけます。',
        },
        {
            q: '複数の求人に同時応募できますか？',
            a: 'はい、複数の求人へ同時に応募できます。応募状況は「応募履歴」ページで一括管理できます。',
        },
        {
            q: 'プロフィールを企業に非公開にできますか？',
            a: '現在はプロフィール全体の公開/非公開切り替えには対応していません。スカウト機能はデフォルト履歴書を設定している場合のみ有効になります。',
        },
        {
            q: 'メールアドレスを変更したいのですが？',
            a: '設定ページ（/settings）からメールアドレスの変更が可能です。変更後は確認メールが届きますので、リンクをクリックして変更を完了してください。',
        },
    ],
    company: [
        {
            q: '求人掲載の料金はいくらですか？',
            a: '無料プランでは求人を1件掲載できます。複数掲載や上位表示など有料機能については料金ページをご確認ください。',
        },
        {
            q: '掲載した求人はすぐに公開されますか？',
            a: 'はい、求人を「公開」ステータスに設定すると即時公開されます。公開前に「下書き」として保存して内容を確認することもできます。',
        },
        {
            q: 'スカウト機能を使うには何が必要ですか？',
            a: '有料プランへの加入が必要です。スカウト機能では求職者のプロフィールを検索し、直接メッセージを送ることができます。',
        },
        {
            q: '応募者の情報はどこで確認できますか？',
            a: '「求人管理」→対象の求人の「応募者管理」から確認できます。履歴書の閲覧、選考ステータスの更新、面接日程の設定が可能です。',
        },
        {
            q: '採用が決まった場合の手続きは？',
            a: '応募者管理ページで選考ステータスを「採用」に更新し、メッセージ機能で採用連絡を行ってください。Atallyは採用後の手続きには介在しません。',
        },
        {
            q: '企業アカウントを削除したいのですが？',
            a: '企業アカウントの削除をご希望の場合は、チャットサポートまたは設定ページからお問い合わせください。掲載中の求人はすべて非公開になります。',
        },
    ],
};

function FAQItem({ q, a }) {
    const [open, setOpen] = useState(false);
    return (
        <div style={{
            borderBottom: '1px solid var(--color-border)',
            overflow: 'hidden',
        }}>
            <button
                onClick={() => setOpen(v => !v)}
                style={{
                    width: '100%', textAlign: 'left', background: 'none', border: 'none',
                    padding: 'var(--space-md) 0', cursor: 'pointer',
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    gap: 'var(--space-md)',
                    fontSize: 'var(--font-size-base)', fontWeight: 500,
                    color: 'var(--color-text-primary)',
                }}
            >
                <span>{q}</span>
                <span style={{
                    fontSize: 18, color: 'var(--color-accent)',
                    transition: 'transform 0.2s',
                    transform: open ? 'rotate(45deg)' : 'rotate(0deg)',
                    flexShrink: 0,
                }}>＋</span>
            </button>
            {open && (
                <div style={{
                    paddingBottom: 'var(--space-md)',
                    color: 'var(--color-text-secondary)',
                    fontSize: 'var(--font-size-sm)',
                    lineHeight: 1.8,
                    animation: 'fadeInUp 0.2s ease',
                }}>
                    {a}
                </div>
            )}
        </div>
    );
}

export default function HelpPage() {
    const [tab, setTab] = useState('jobseeker');
    const [search, setSearch] = useState('');

    const filtered = FAQS[tab].filter(f =>
        f.q.includes(search) || f.a.includes(search)
    );

    return (
        <div className="page animate-fade-in" style={{ paddingTop: 0 }}>
            <Helmet>
                <title>ヘルプセンター - Atally</title>
            </Helmet>

            {/* ヒーロー */}
            <div style={{
                background: 'var(--color-bg-secondary)',
                borderBottom: '1px solid var(--color-border)',
                padding: 'var(--space-3xl) var(--space-md)',
                textAlign: 'center',
            }}>
                <h1 style={{ fontSize: 'var(--font-size-3xl)', fontWeight: 700, marginBottom: 'var(--space-sm)', color: 'var(--color-navy)' }}>
                    ヘルプセンター
                </h1>
                <p style={{ color: 'var(--color-text-secondary)', marginBottom: 'var(--space-xl)', fontSize: 'var(--font-size-base)' }}>
                    よくある質問やチャットサポートでご案内します
                </p>
                <div style={{ maxWidth: 500, margin: '0 auto', position: 'relative' }}>
                    <Search size={18} strokeWidth={2} style={{ position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)', opacity: 0.35, pointerEvents: 'none' }} />
                    <input
                        type="text"
                        placeholder="質問を検索..."
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        className="form-input"
                        style={{
                            width: '100%', padding: '14px 16px 14px 46px',
                            borderRadius: 'var(--radius-full)',
                            fontSize: 'var(--font-size-base)',
                        }}
                    />
                </div>
            </div>

            <div className="container" style={{ maxWidth: 800, paddingTop: 'var(--space-3xl)', paddingBottom: 'var(--space-3xl)' }}>

                {/* クイックリンク */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 'var(--space-md)', marginBottom: 'var(--space-3xl)' }}>
                    {[
                        { icon: '💬', title: 'チャットサポート', desc: 'リアルタイムで相談', action: () => {
            if (window.$crisp) {
                window.$crisp.push(['do', 'chat:open']);
            } else {
                window.location.href = 'mailto:support@atally.jp';
            }
        }},
                        { icon: '📧', title: 'メールで問い合わせ', desc: 'support@atally.jp', action: () => window.location.href = 'mailto:support@atally.jp' },
                        { icon: '📋', title: '利用規約', desc: '規約・ポリシー確認', link: '/terms' },
                        { icon: '🔒', title: 'プライバシー', desc: '個人情報の取り扱い', link: '/privacy' },
                    ].map((card, i) => (
                        card.link ? (
                            <Link key={i} to={card.link} style={{ textDecoration: 'none' }}>
                                <div className="card card-lift" style={{ textAlign: 'center', padding: 'var(--space-lg)', cursor: 'pointer' }}>
                                    <div style={{ fontSize: 28, marginBottom: 'var(--space-sm)' }}>{card.icon}</div>
                                    <div style={{ fontWeight: 600, fontSize: 'var(--font-size-sm)', marginBottom: 4 }}>{card.title}</div>
                                    <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>{card.desc}</div>
                                </div>
                            </Link>
                        ) : (
                            <div key={i} className="card card-lift" style={{ textAlign: 'center', padding: 'var(--space-lg)', cursor: 'pointer' }} onClick={card.action}>
                                <div style={{ fontSize: 28, marginBottom: 'var(--space-sm)' }}>{card.icon}</div>
                                <div style={{ fontWeight: 600, fontSize: 'var(--font-size-sm)', marginBottom: 4 }}>{card.title}</div>
                                <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>{card.desc}</div>
                            </div>
                        )
                    ))}
                </div>

                {/* FAQ セクション */}
                <h2 style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 700, marginBottom: 'var(--space-lg)' }}>
                    よくある質問
                </h2>

                {/* タブ */}
                <div style={{ display: 'flex', gap: 'var(--space-sm)', marginBottom: 'var(--space-xl)', borderBottom: '2px solid var(--color-border)', paddingBottom: 0 }}>
                    {[
                        { key: 'jobseeker', label: '👤 求職者の方' },
                        { key: 'company', label: '🏢 企業の方' },
                    ].map(t => (
                        <button key={t.key} onClick={() => { setTab(t.key); setSearch(''); }} style={{
                            background: 'none', border: 'none', cursor: 'pointer',
                            padding: 'var(--space-sm) var(--space-md)',
                            fontSize: 'var(--font-size-sm)', fontWeight: tab === t.key ? 700 : 400,
                            color: tab === t.key ? 'var(--color-accent)' : 'var(--color-text-secondary)',
                            borderBottom: tab === t.key ? '2px solid var(--color-accent)' : '2px solid transparent',
                            marginBottom: -2,
                            transition: 'all 0.15s',
                        }}>
                            {t.label}
                        </button>
                    ))}
                </div>

                {/* FAQ リスト */}
                <div className="card" style={{ padding: 'var(--space-md) var(--space-xl)' }}>
                    {filtered.length > 0 ? (
                        filtered.map((f, i) => <FAQItem key={i} q={f.q} a={f.a} />)
                    ) : (
                        <div style={{ textAlign: 'center', padding: 'var(--space-3xl)', color: 'var(--color-text-muted)' }}>
                            <div style={{ fontSize: '2rem', marginBottom: 'var(--space-sm)' }}>🔍</div>
                            「{search}」に一致する質問が見つかりませんでした
                        </div>
                    )}
                </div>

                {/* チャット誘導 */}
                <div style={{
                    marginTop: 'var(--space-3xl)',
                    background: 'linear-gradient(135deg, rgba(200,149,46,0.1), rgba(200,149,46,0.05))',
                    border: '1px solid rgba(200,149,46,0.25)',
                    borderRadius: 'var(--radius-lg)',
                    padding: 'var(--space-2xl)',
                    textAlign: 'center',
                }}>
                    <div style={{ fontSize: '2.5rem', marginBottom: 'var(--space-sm)' }}>💬</div>
                    <h3 style={{ marginBottom: 'var(--space-sm)' }}>解決しない場合はチャットへ</h3>
                    <p style={{ color: 'var(--color-text-secondary)', marginBottom: 'var(--space-lg)', fontSize: 'var(--font-size-sm)' }}>
                        営業時間内（平日 10:00〜17:00）はチャットでリアルタイムにご対応します。<br />
                        時間外はメッセージを残していただければ翌営業日にご返信します。
                    </p>
                    <button
                        className="btn btn-primary"
                        onClick={() => {
                            if (window.$crisp) {
                                window.$crisp.push(['do', 'chat:open']);
                            } else {
                                window.location.href = 'mailto:support@atally.jp';
                            }
                        }}
                        style={{ fontSize: 'var(--font-size-base)', padding: '12px 32px' }}
                    >
                        チャットで質問する
                    </button>
                </div>
            </div>
        </div>
    );
}
