import React, { useState } from 'react';
import { Link } from 'react-router-dom';

const TABS = [
    { id: 'tokusho', label: '特定商取引法に基づく表記' },
    { id: 'terms', label: '利用規約' },
    { id: 'privacy', label: 'プライバシーポリシー' },
];

export default function LegalPage() {
    const [activeTab, setActiveTab] = useState('tokusho');

    return (
        <div className="page container animate-fade-in" style={{ maxWidth: 800, margin: '0 auto', padding: 'var(--space-xl)' }}>
            <Link to="/" style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-accent)', textDecoration: 'none', marginBottom: 'var(--space-md)', display: 'inline-block' }}>← トップに戻る</Link>

            <h1 style={{ fontSize: 'var(--font-size-3xl)', marginBottom: 'var(--space-lg)' }}>法的情報</h1>

            <div style={{ display: 'flex', gap: 'var(--space-xs)', marginBottom: 'var(--space-xl)', borderBottom: '1px solid var(--color-border)', flexWrap: 'wrap' }}>
                {TABS.map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        style={{
                            padding: 'var(--space-sm) var(--space-md)',
                            border: 'none',
                            background: 'none',
                            cursor: 'pointer',
                            fontSize: 'var(--font-size-sm)',
                            fontWeight: activeTab === tab.id ? 700 : 400,
                            color: activeTab === tab.id ? 'var(--color-text-accent)' : 'var(--color-text-secondary)',
                            borderBottom: activeTab === tab.id ? '2px solid var(--color-text-accent)' : '2px solid transparent',
                            marginBottom: '-1px',
                            transition: 'all 0.15s',
                        }}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', lineHeight: 1.8 }}>
                {activeTab === 'tokusho' && <TokushoTab />}
                {activeTab === 'terms' && <TermsTab />}
                {activeTab === 'privacy' && <PrivacyTab />}
            </div>
        </div>
    );
}

function Section({ title, children }) {
    return (
        <div style={{ marginBottom: 'var(--space-xl)' }}>
            <h2 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 700, marginBottom: 'var(--space-sm)', color: 'var(--color-text-primary)' }}>{title}</h2>
            <div style={{ paddingLeft: 'var(--space-sm)' }}>{children}</div>
        </div>
    );
}

function InfoTable({ rows }) {
    return (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--font-size-sm)' }}>
            <tbody>
                {rows.map(([label, value]) => (
                    <tr key={label} style={{ borderBottom: '1px solid var(--color-border)' }}>
                        <td style={{ padding: 'var(--space-sm) var(--space-md)', fontWeight: 600, whiteSpace: 'nowrap', color: 'var(--color-text-primary)', verticalAlign: 'top', width: '35%', background: 'var(--color-bg-surface)' }}>
                            {label}
                        </td>
                        <td style={{ padding: 'var(--space-sm) var(--space-md)', color: 'var(--color-text-secondary)', verticalAlign: 'top' }}>
                            {value}
                        </td>
                    </tr>
                ))}
            </tbody>
        </table>
    );
}

function TokushoTab() {
    return (
        <>
            <p style={{ marginBottom: 'var(--space-lg)', color: 'var(--color-text-muted)' }}>最終更新日: 2025年4月1日</p>
            <p style={{ marginBottom: 'var(--space-xl)' }}>
                特定商取引に関する法律第11条に基づき、以下の事項を表示します。
            </p>

            <Section title="事業者情報">
                <InfoTable rows={[
                    ['販売業者', '合同会社Attract'],
                    ['代表者名', '西原涼'],
                    ['所在地', 'お問い合わせにてご案内いたします'],
                    ['電話番号', 'お問い合わせにてご案内いたします'],
                    ['メールアドレス', 'support@atally.jp'],
                    ['URL', 'https://atally.io'],
                ]} />
            </Section>

            <Section title="サービス内容">
                <InfoTable rows={[
                    ['サービス名', 'Atally（アタリー）'],
                    ['役務の内容', '求人情報の掲載・人材紹介マッチングプラットフォームの提供'],
                    ['利用対象者', '求職者（個人）、求人企業、人材紹介会社'],
                ]} />
            </Section>

            <Section title="料金・支払い">
                <InfoTable rows={[
                    ['料金', <>
                        <strong>求職者：</strong>無料<br />
                        <strong>求人企業（直接採用）：</strong>採用成功報酬型（詳細は<Link to="/pricing" style={{ color: 'var(--color-text-accent)' }}>料金ページ</Link>をご確認ください）<br />
                        <strong>人材紹介会社：</strong>採用成功報酬型（詳細は<Link to="/pricing" style={{ color: 'var(--color-text-accent)' }}>料金ページ</Link>をご確認ください）
                    </>],
                    ['役務の対価以外に必要な費用', '消費税（料金に別途加算）、インターネット接続費用はお客様のご負担となります'],
                    ['支払方法', 'クレジットカード（Visa・Mastercard・American Express・JCB）'],
                    ['支払時期', '採用成功確認後、請求書発行日より30日以内'],
                    ['役務提供時期', 'アカウント登録後すぐにサービスをご利用いただけます'],
                ]} />
            </Section>

            <Section title="キャンセル・返金">
                <InfoTable rows={[
                    ['申込みの有効期限', '特に定めなし（アカウント有効期間中）'],
                    ['キャンセル・解約', 'アカウントはいつでも削除可能です。採用成功後に確定した料金については、返金は承っておりません'],
                    ['返金に関する特約', '採用確定後に候補者が入社を辞退した場合など、所定の条件を満たす場合は料金の減額または返金対応を行います。詳細は個別にお問い合わせください'],
                ]} />
            </Section>

            <Section title="動作環境">
                <InfoTable rows={[
                    ['推奨ブラウザ', 'Google Chrome・Mozilla Firefox・Apple Safari・Microsoft Edge（各最新版）'],
                    ['推奨環境', 'インターネット接続環境が必要です'],
                ]} />
            </Section>

            <Section title="お問い合わせ">
                <p>ご不明な点はメールにてお問い合わせください。</p>
                <div style={{ marginTop: 'var(--space-sm)', padding: 'var(--space-md)', background: 'var(--color-bg-surface)', borderRadius: 'var(--radius-md)' }}>
                    Atally運営事務局（合同会社Attract）<br />
                    メール: support@atally.jp
                </div>
            </Section>
        </>
    );
}

function TermsTab() {
    return (
        <>
            <p style={{ marginBottom: 'var(--space-md)', color: 'var(--color-text-muted)' }}>最終更新日: 2025年4月1日</p>

            <Section title="第1条（適用）">
                <p>本規約は、Atally（以下「本サービス」）の利用条件を定めるものです。登録ユーザーの皆さま（以下「ユーザー」）には、本規約に従って本サービスをご利用いただきます。</p>
            </Section>

            <Section title="第2条（利用登録）">
                <p>登録希望者が本規約に同意の上、所定の方法によって利用登録を申請し、当社がこれを承認することによって、利用登録が完了するものとします。</p>
                <p>当社は、以下の場合には利用登録の申請を承認しないことがあります。</p>
                <ul>
                    <li>虚偽の事項を届け出た場合</li>
                    <li>本規約に違反したことがある者からの申請である場合</li>
                    <li>その他、当社が利用登録を相当でないと判断した場合</li>
                </ul>
            </Section>

            <Section title="第3条（求人掲載に関する遵守事項）">
                <p>企業ユーザーは、求人情報の掲載にあたり、以下の法令を遵守するものとします。</p>
                <ul>
                    <li><strong>職業安定法</strong>（昭和22年法律第141号）- 求人情報の明示義務（業務内容、賃金、勤務時間、就業場所、雇用形態、社会保険、契約期間、休日）</li>
                    <li><strong>雇用対策法</strong>（昭和41年法律第132号）- 年齢制限の禁止</li>
                    <li><strong>男女雇用機会均等法</strong>（昭和47年法律第113号）- 性別による差別の禁止</li>
                    <li><strong>労働基準法</strong>（昭和22年法律第49号）- 労働条件の明示義務</li>
                </ul>
                <p>本サービスは、法令に反する表現を含む求人掲載を検出した場合、掲載の停止・修正を求めることがあります。</p>
            </Section>

            <Section title="第4条（人材紹介事業者の義務）">
                <p>有料職業紹介事業の許可を受けた事業者が本サービスを利用する場合、以下の義務を負うものとします。</p>
                <ul>
                    <li>有料職業紹介事業許可番号の登録・表示</li>
                    <li>紹介手数料の適正な設定および明示</li>
                    <li>求職者への事業者情報の開示</li>
                </ul>
            </Section>

            <Section title="第5条（禁止事項）">
                <p>ユーザーは、本サービスの利用にあたり、以下の行為をしてはなりません。</p>
                <ul>
                    <li>法令または公序良俗に違反する行為</li>
                    <li>虚偽の求人情報・個人情報の登録</li>
                    <li>差別的な表現を含む求人の掲載</li>
                    <li>本サービスの運営を妨害する行為</li>
                    <li>他のユーザーに不利益、損害、不快感を与える行為</li>
                    <li>不正アクセス、クローリング等のシステム負荷行為</li>
                    <li>当社が許諾しない営利目的での利用</li>
                </ul>
            </Section>

            <Section title="第6条（本サービスの提供の停止等）">
                <p>当社は、以下のいずれかの事由があると判断した場合、ユーザーに事前に通知することなく本サービスの全部または一部の提供を停止または中断することができるものとします。</p>
                <ul>
                    <li>本サービスにかかるシステムの保守点検または更新を行う場合</li>
                    <li>地震、落雷、火災等の不可抗力により本サービスの提供が困難となった場合</li>
                    <li>その他、当社が本サービスの提供が困難と判断した場合</li>
                </ul>
            </Section>

            <Section title="第7条（免責事項）">
                <p>当社は、本サービスに掲載される求人情報の正確性、完全性、適法性について保証するものではありません。ユーザー間の取引・連絡・紛争等について、当社は一切の責任を負いません。</p>
            </Section>

            <Section title="第8条（規約の変更）">
                <p>当社は、必要と判断した場合には、ユーザーに通知することなく本規約を変更することがあります。変更後の規約は、本サービス上に表示した時点から効力を生じるものとします。</p>
            </Section>

            <Section title="第9条（準拠法・裁判管轄）">
                <p>本規約の解釈にあたっては、日本法を準拠法とします。本サービスに関して紛争が生じた場合には、東京地方裁判所を第一審の専属的合意管轄とします。</p>
            </Section>
        </>
    );
}

function PrivacyTab() {
    return (
        <>
            <p style={{ marginBottom: 'var(--space-md)', color: 'var(--color-text-muted)' }}>最終更新日: 2025年4月1日</p>
            <p style={{ marginBottom: 'var(--space-lg)' }}>
                Atally運営（以下「当社」）は、個人情報の保護に関する法律（個人情報保護法）その他の関連法令を遵守し、
                以下のとおりプライバシーポリシーを定め、個人情報の適切な取扱いと保護に努めます。
            </p>

            <Section title="1. 収集する個人情報">
                <p>当社は、本サービスの提供にあたり、以下の個人情報を収集することがあります。</p>
                <h4 style={{ fontWeight: 600, marginTop: 'var(--space-sm)' }}>求職者</h4>
                <ul>
                    <li>氏名、メールアドレス、電話番号</li>
                    <li>履歴書・職務経歴書に記載される情報（学歴、職歴、資格、スキル等）</li>
                    <li>プロフィール写真</li>
                    <li>希望条件（勤務地、給与、雇用形態等）</li>
                </ul>
                <h4 style={{ fontWeight: 600, marginTop: 'var(--space-sm)' }}>企業ユーザー</h4>
                <ul>
                    <li>企業名、代表者名、所在地、連絡先</li>
                    <li>担当者の氏名、メールアドレス</li>
                    <li>法人確認書類</li>
                    <li>有料職業紹介事業許可番号（人材紹介会社の場合）</li>
                </ul>
            </Section>

            <Section title="2. 個人情報の利用目的">
                <p>収集した個人情報は、以下の目的で利用いたします。</p>
                <ul>
                    <li>本サービスの提供・運営（求人マッチング、応募管理、メッセージ機能等）</li>
                    <li>ユーザーの本人確認・企業審査</li>
                    <li>スカウト機能による求人情報の提供</li>
                    <li>利用状況の分析・サービス改善</li>
                    <li>お問い合わせへの対応</li>
                    <li>重要なお知らせ・規約変更の通知</li>
                </ul>
            </Section>

            <Section title="3. 個人情報の第三者提供">
                <p>当社は、以下の場合を除き、ユーザーの同意なく個人情報を第三者に提供いたしません。</p>
                <ul>
                    <li><strong>求人応募時</strong>：求職者が求人に応募した場合、応募先企業に履歴書・応募情報を提供します</li>
                    <li><strong>スカウト承諾時</strong>：求職者がスカウトを承諾した場合、企業にプロフィール情報を提供します</li>
                    <li><strong>人材紹介</strong>：人材紹介会社を通じた応募の場合、当該紹介会社に必要な情報を提供します</li>
                    <li><strong>法令に基づく場合</strong>：法令に基づき開示が求められた場合</li>
                    <li><strong>人の生命・身体・財産の保護</strong>：緊急の必要がある場合</li>
                </ul>
            </Section>

            <Section title="4. 個人情報の管理">
                <p>当社は、個人情報の漏洩、滅失、毀損の防止のため、以下の安全管理措置を講じます。</p>
                <ul>
                    <li>通信の暗号化（SSL/TLS）</li>
                    <li>アクセス制御とログ管理</li>
                    <li>パスワードのハッシュ化保存</li>
                    <li>定期的なセキュリティ監査</li>
                </ul>
            </Section>

            <Section title="5. 個人情報の開示・訂正・削除">
                <p>ユーザーは、当社に対して自己の個人情報の開示・訂正・追加・削除・利用停止を請求することができます。
                本人確認の上、合理的な期間内に対応いたします。</p>
                <p>アカウント削除をご希望の場合は、設定画面またはお問い合わせからご連絡ください。
                アカウント削除後、関連する個人情報は法令で定められた保存期間を除き速やかに削除いたします。</p>
            </Section>

            <Section title="6. Cookieの使用">
                <p>本サービスでは、ユーザー体験の向上のためCookieを使用しています。
                Cookieにより個人を特定することはありませんが、ブラウザの設定により無効化することが可能です。</p>
            </Section>

            <Section title="7. 未成年者の個人情報">
                <p>18歳未満の方は、保護者の同意を得た上で本サービスをご利用ください。</p>
            </Section>

            <Section title="8. プライバシーポリシーの変更">
                <p>当社は、必要に応じて本ポリシーを変更することがあります。重要な変更がある場合は、本サービス上での告知またはメールにてお知らせいたします。</p>
            </Section>

            <Section title="9. お問い合わせ">
                <p>個人情報の取扱いに関するお問い合わせは、以下までご連絡ください。</p>
                <div style={{ marginTop: 'var(--space-sm)', padding: 'var(--space-md)', background: 'var(--color-bg-surface)', borderRadius: 'var(--radius-md)' }}>
                    Atally運営事務局（合同会社Attract）<br />
                    メール: privacy@atally.jp
                </div>
            </Section>
        </>
    );
}
