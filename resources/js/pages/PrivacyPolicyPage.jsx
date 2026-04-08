import React from 'react';
import { Link } from 'react-router-dom';

export default function PrivacyPolicyPage() {
    return (
        <div className="page container animate-fade-in" style={{ maxWidth: 800, margin: '0 auto', padding: 'var(--space-xl)' }}>
            <Link to="/" style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-accent)', textDecoration: 'none', marginBottom: 'var(--space-md)', display: 'inline-block' }}>← トップに戻る</Link>

            <h1 style={{ fontSize: 'var(--font-size-3xl)', marginBottom: 'var(--space-xl)' }}>プライバシーポリシー（個人情報保護方針）</h1>

            <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', lineHeight: 1.8 }}>
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
                    <p style={{ marginTop: 'var(--space-sm)', padding: 'var(--space-md)', background: 'var(--color-bg-surface)', borderRadius: 'var(--radius-md)' }}>
                        Atally運営事務局（合同会社Attract）<br />
                        メール: privacy@atally.jp
                    </p>
                </Section>
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
