import React from 'react';
import { Link } from 'react-router-dom';

export default function TermsPage() {
    return (
        <div className="page container animate-fade-in" style={{ maxWidth: 800, margin: '0 auto', padding: 'var(--space-xl)' }}>
            <Link to="/" style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-accent)', textDecoration: 'none', marginBottom: 'var(--space-md)', display: 'inline-block' }}>← トップに戻る</Link>

            <h1 style={{ fontSize: 'var(--font-size-3xl)', marginBottom: 'var(--space-xl)' }}>利用規約</h1>

            <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', lineHeight: 1.8 }}>
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
