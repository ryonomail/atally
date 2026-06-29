import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { Hand, User, FileText, Search, Building2, ClipboardList } from 'lucide-react';

const STEPS_JOBSEEKER = [
    {
        Icon: Hand,
        title: 'Atallyへようこそ！',
        desc: 'ぴったり合う仕事探し、はじめましょう。まずは基本的な使い方をご紹介します。',
        tip: null,
    },
    {
        Icon: User,
        title: 'プロフィールを充実させよう',
        desc: 'プロフィールを80%以上入力すると、企業からスカウトが届きやすくなります。スキルや経験を詳しく記入しましょう。',
        tip: { label: 'プロフィールを設定する', path: '/profile' },
    },
    {
        Icon: FileText,
        title: '履歴書を作成しよう',
        desc: '履歴書はアルバイト用・転職用・職務経歴書の3種類から選べます。デフォルト設定すると応募時に自動入力されます。',
        tip: { label: '履歴書を作成する', path: '/resumes' },
    },
    {
        Icon: Search,
        title: '求人を探してみよう',
        desc: '職種・勤務地・給与など条件を絞って求人を検索できます。気になる求人は「保存」して後で見返せます。',
        tip: { label: '求人を探す', path: '/jobs' },
    },
];

const STEPS_COMPANY = [
    {
        Icon: Hand,
        title: 'Atallyへようこそ！',
        desc: 'ぴったりの人材を、見つけましょう。まずは基本的な使い方をご紹介します。',
        tip: null,
    },
    {
        Icon: Building2,
        title: '会社プロフィールを設定しよう',
        desc: '会社の基本情報を入力することで、求職者に信頼感を与えられます。ロゴや会社の雰囲気も登録できます。',
        tip: null,
    },
    {
        Icon: ClipboardList,
        title: '求人票を作成しよう',
        desc: '「求人管理」から新しい求人を作成できます。下書き保存・プレビュー確認後に公開できるので安心です。',
        tip: { label: '求人を作成する', path: '/company/jobs' },
    },
];

const ONBOARDING_KEY = 'atally_onboarding_done';

export default function OnboardingModal() {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [step, setStep] = useState(0);
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        if (!user) return;
        // 管理者・エージェントは対象外
        if (user.role === 'admin') return;
        const key = `${ONBOARDING_KEY}_${user.id}`;
        if (!localStorage.getItem(key)) {
            setVisible(true);
        }
    }, [user]);

    if (!visible || !user) return null;

    const steps = user.role === 'company' ? STEPS_COMPANY : STEPS_JOBSEEKER;
    const current = steps[step];
    const isLast = step === steps.length - 1;

    const handleClose = () => {
        const key = `${ONBOARDING_KEY}_${user.id}`;
        localStorage.setItem(key, '1');
        setVisible(false);
    };

    const handleNext = () => {
        if (isLast) {
            handleClose();
        } else {
            setStep(s => s + 1);
        }
    };

    const handleTip = () => {
        if (current.tip) {
            handleClose();
            navigate(current.tip.path);
        }
    };

    return (
        <div style={{
            position: 'fixed', inset: 0, zIndex: 2000,
            background: 'rgba(0,0,0,0.6)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: 'var(--space-md)',
            animation: 'fadeIn 0.25s ease',
        }}>
            <div className="card" style={{
                maxWidth: 460, width: '100%',
                padding: 'var(--space-2xl)',
                textAlign: 'center',
                animation: 'pageEnter 0.3s ease',
                position: 'relative',
            }}>
                {/* 閉じるボタン */}
                <button onClick={handleClose} style={{
                    position: 'absolute', top: 'var(--space-md)', right: 'var(--space-md)',
                    background: 'none', border: 'none', cursor: 'pointer',
                    fontSize: 20, color: 'var(--color-text-muted)', lineHeight: 1,
                }}>×</button>

                {/* アイコン */}
                <div style={{ marginBottom: 'var(--space-lg)', display: 'flex', justifyContent: 'center' }}>
                    {current.Icon && <current.Icon size={44} strokeWidth={1.75} color="var(--color-accent)" />}
                </div>

                {/* タイトル */}
                <h2 style={{ fontSize: 'var(--font-size-xl)', fontWeight: 700, marginBottom: 'var(--space-sm)' }}>
                    {current.title}
                </h2>

                {/* 説明 */}
                <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', lineHeight: 1.8, marginBottom: 'var(--space-xl)' }}>
                    {current.desc}
                </p>

                {/* アクションボタン */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
                    {current.tip && (
                        <button className="btn btn-secondary" onClick={handleTip} style={{ width: '100%' }}>
                            → {current.tip.label}
                        </button>
                    )}
                    <button className="btn btn-primary" onClick={handleNext} style={{ width: '100%' }}>
                        {isLast ? '使い始める' : '次へ'}
                    </button>
                </div>

                {/* ステップ表示 */}
                <div style={{ display: 'flex', justifyContent: 'center', gap: 6, marginTop: 'var(--space-lg)' }}>
                    {steps.map((_, i) => (
                        <div key={i} style={{
                            width: i === step ? 20 : 6, height: 6,
                            borderRadius: 99,
                            background: i === step ? 'var(--color-accent)' : 'var(--color-border)',
                            transition: 'all 0.2s',
                        }} />
                    ))}
                </div>

                {/* スキップ */}
                <button onClick={handleClose} style={{
                    marginTop: 'var(--space-sm)',
                    background: 'none', border: 'none', cursor: 'pointer',
                    fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)',
                }}>
                    スキップ
                </button>
            </div>
        </div>
    );
}
