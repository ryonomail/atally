import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';

const STORAGE_KEY = 'guest_resume_draft';

const defaultForm = {
    full_name: '',
    full_name_kana: '',
    birth_date: '',
    phone: '',
    email: '',
    address: '',
    work_history: [{ company: '', position: '', start: '', end: '', description: '' }],
    education: [{ school: '', faculty: '', start: '', end: '' }],
    skills: '',
    self_pr: '',
    desired_job: '',
    desired_location: '',
    desired_salary: '',
};

export default function GuestResumeEditorPage() {
    const navigate = useNavigate();
    const location = useLocation();

    useEffect(() => {
        const params = new URLSearchParams(location.search);
        const fromJob = params.get('from_job');
        if (fromJob && /^\d+$/.test(fromJob)) {
            localStorage.setItem('atally_return_job', fromJob);
        }
    }, [location.search]);

    const [form, setForm] = useState(() => {
        try {
            const saved = localStorage.getItem(STORAGE_KEY);
            return saved ? { ...defaultForm, ...JSON.parse(saved) } : defaultForm;
        } catch {
            return defaultForm;
        }
    });
    const [showSaveModal, setShowSaveModal] = useState(false);
    const [activeTab, setActiveTab] = useState('basic');
    const [autoSaved, setAutoSaved] = useState(false);

    // 自動保存（3秒デバウンス）
    useEffect(() => {
        const timer = setTimeout(() => {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(form));
            setAutoSaved(true);
            setTimeout(() => setAutoSaved(false), 2000);
        }, 1000);
        return () => clearTimeout(timer);
    }, [form]);

    const updateField = (field, value) => setForm(f => ({ ...f, [field]: value }));

    const updateWorkHistory = (index, field, value) => {
        const next = [...form.work_history];
        next[index] = { ...next[index], [field]: value };
        updateField('work_history', next);
    };

    const addWorkHistory = () => updateField('work_history', [
        ...form.work_history,
        { company: '', position: '', start: '', end: '', description: '' },
    ]);

    const removeWorkHistory = (index) => updateField('work_history',
        form.work_history.filter((_, i) => i !== index)
    );

    const updateEducation = (index, field, value) => {
        const next = [...form.education];
        next[index] = { ...next[index], [field]: value };
        updateField('education', next);
    };

    const addEducation = () => updateField('education', [
        ...form.education,
        { school: '', faculty: '', start: '', end: '' },
    ]);

    const removeEducation = (index) => updateField('education',
        form.education.filter((_, i) => i !== index)
    );

    const tabs = [
        { id: 'basic', label: '基本情報' },
        { id: 'career', label: '職歴' },
        { id: 'education', label: '学歴' },
        { id: 'pr', label: 'PR・希望' },
    ];

    return (
        <div className="page container animate-fade-in" style={{ maxWidth: 720 }}>

            {/* ヘッダー */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-xl)', flexWrap: 'wrap', gap: 'var(--space-sm)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-md)' }}>
                    <button className="btn btn-secondary" onClick={() => navigate('/')} style={{ fontSize: 'var(--font-size-sm)' }}>
                        ← トップへ
                    </button>
                    <div>
                        <h1 style={{ fontSize: 'var(--font-size-xl)', fontWeight: 700 }}>履歴書を作成</h1>
                        <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', marginTop: 2 }}>
                            登録不要・ブラウザに自動保存されます
                        </p>
                    </div>
                </div>
                <div style={{ display: 'flex', gap: 'var(--space-sm)', alignItems: 'center' }}>
                    {autoSaved && (
                        <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-success)' }}>
                            ✓ 自動保存済み
                        </span>
                    )}
                    <button className="btn btn-primary" onClick={() => setShowSaveModal(true)}>
                        💾 保存・応募する
                    </button>
                </div>
            </div>

            {/* バナー: 登録促進 + 求人探し導線 */}
            <div style={{
                background: 'linear-gradient(135deg, rgba(18,28,52,0.07) 0%, rgba(0,112,185,0.07) 100%)',
                border: '1px solid rgba(0,112,185,0.2)',
                borderRadius: 'var(--radius-md)',
                padding: 'var(--space-md) var(--space-lg)',
                marginBottom: 'var(--space-xl)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: 'var(--space-sm)',
            }}>
                <div>
                    <div style={{ fontSize: 'var(--font-size-sm)', fontWeight: 600, color: 'var(--color-text-primary)', marginBottom: 2 }}>
                        履歴書ができたら、そのまま求人に応募できます
                    </div>
                    <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
                        47万件以上の求人を掲載中 · 登録（無料）後すぐに応募可能
                    </div>
                </div>
                <div style={{ display: 'flex', gap: 'var(--space-sm)', flexWrap: 'wrap' }}>
                    <Link to="/jobs" className="btn btn-secondary" style={{ fontSize: 'var(--font-size-xs)', whiteSpace: 'nowrap' }}>
                        求人を探す
                    </Link>
                    <Link to="/register" className="btn btn-primary" style={{ fontSize: 'var(--font-size-xs)', whiteSpace: 'nowrap' }}>
                        無料登録して応募する
                    </Link>
                </div>
            </div>

            {/* タブ */}
            <div style={{ display: 'flex', gap: 4, marginBottom: 'var(--space-xl)', borderBottom: '1px solid var(--color-border)', overflowX: 'auto' }}>
                {tabs.map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        style={{
                            padding: 'var(--space-sm) var(--space-lg)',
                            background: 'none',
                            border: 'none',
                            borderBottom: activeTab === tab.id ? '2px solid var(--color-accent)' : '2px solid transparent',
                            color: activeTab === tab.id ? 'var(--color-text-accent)' : 'var(--color-text-secondary)',
                            fontWeight: activeTab === tab.id ? 700 : 400,
                            cursor: 'pointer',
                            fontSize: 'var(--font-size-sm)',
                            whiteSpace: 'nowrap',
                            transition: 'all var(--transition-fast)',
                            marginBottom: -1,
                        }}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* 基本情報 */}
            {activeTab === 'basic' && (
                <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
                    <h3 style={{ marginBottom: 'var(--space-sm)' }}>基本情報</h3>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 'var(--space-md)' }}>
                        <div className="form-group" style={{ margin: 0 }}>
                            <label className="form-label">氏名</label>
                            <input className="form-input" placeholder="山田 太郎" value={form.full_name}
                                onChange={e => updateField('full_name', e.target.value)} />
                        </div>
                        <div className="form-group" style={{ margin: 0 }}>
                            <label className="form-label">ふりがな</label>
                            <input className="form-input" placeholder="やまだ たろう" value={form.full_name_kana}
                                onChange={e => updateField('full_name_kana', e.target.value)} />
                        </div>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 'var(--space-md)' }}>
                        <div className="form-group" style={{ margin: 0 }}>
                            <label className="form-label">生年月日</label>
                            <input type="date" className="form-input" value={form.birth_date}
                                onChange={e => updateField('birth_date', e.target.value)} />
                        </div>
                        <div className="form-group" style={{ margin: 0 }}>
                            <label className="form-label">電話番号</label>
                            <input className="form-input" placeholder="090-0000-0000" value={form.phone}
                                onChange={e => updateField('phone', e.target.value)} />
                        </div>
                    </div>
                    <div className="form-group" style={{ margin: 0 }}>
                        <label className="form-label">メールアドレス</label>
                        <input type="email" className="form-input" placeholder="example@email.com" value={form.email}
                            onChange={e => updateField('email', e.target.value)} />
                    </div>
                    <div className="form-group" style={{ margin: 0 }}>
                        <label className="form-label">現住所</label>
                        <input className="form-input" placeholder="東京都渋谷区○○1-2-3" value={form.address}
                            onChange={e => updateField('address', e.target.value)} />
                    </div>
                </div>
            )}

            {/* 職歴 */}
            {activeTab === 'career' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
                    {form.work_history.map((w, i) => (
                        <div key={i} className="card" style={{ position: 'relative' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-md)' }}>
                                <h3 style={{ fontSize: 'var(--font-size-base)' }}>職歴 {i + 1}</h3>
                                {form.work_history.length > 1 && (
                                    <button onClick={() => removeWorkHistory(i)}
                                        style={{ background: 'none', border: 'none', color: 'var(--color-error)', cursor: 'pointer', fontSize: 'var(--font-size-sm)' }}>
                                        削除
                                    </button>
                                )}
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 'var(--space-md)' }}>
                                    <div className="form-group" style={{ margin: 0 }}>
                                        <label className="form-label">会社名</label>
                                        <input className="form-input" placeholder="株式会社○○" value={w.company}
                                            onChange={e => updateWorkHistory(i, 'company', e.target.value)} />
                                    </div>
                                    <div className="form-group" style={{ margin: 0 }}>
                                        <label className="form-label">職種・役職</label>
                                        <input className="form-input" placeholder="エンジニア・営業など" value={w.position}
                                            onChange={e => updateWorkHistory(i, 'position', e.target.value)} />
                                    </div>
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-md)' }}>
                                    <div className="form-group" style={{ margin: 0 }}>
                                        <label className="form-label">入社年月</label>
                                        <input type="month" className="form-input" value={w.start}
                                            onChange={e => updateWorkHistory(i, 'start', e.target.value)} />
                                    </div>
                                    <div className="form-group" style={{ margin: 0 }}>
                                        <label className="form-label">退社年月（在職中は空白）</label>
                                        <input type="month" className="form-input" value={w.end}
                                            onChange={e => updateWorkHistory(i, 'end', e.target.value)} />
                                    </div>
                                </div>
                                <div className="form-group" style={{ margin: 0 }}>
                                    <label className="form-label">業務内容・実績</label>
                                    <textarea className="form-textarea" rows={3} placeholder="担当した業務・プロジェクト・実績などを記入"
                                        value={w.description}
                                        onChange={e => updateWorkHistory(i, 'description', e.target.value)} />
                                </div>
                            </div>
                        </div>
                    ))}
                    <button className="btn btn-secondary" onClick={addWorkHistory}>
                        + 職歴を追加
                    </button>
                </div>
            )}

            {/* 学歴 */}
            {activeTab === 'education' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
                    {form.education.map((e, i) => (
                        <div key={i} className="card">
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-md)' }}>
                                <h3 style={{ fontSize: 'var(--font-size-base)' }}>学歴 {i + 1}</h3>
                                {form.education.length > 1 && (
                                    <button onClick={() => removeEducation(i)}
                                        style={{ background: 'none', border: 'none', color: 'var(--color-error)', cursor: 'pointer', fontSize: 'var(--font-size-sm)' }}>
                                        削除
                                    </button>
                                )}
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 'var(--space-md)' }}>
                                    <div className="form-group" style={{ margin: 0 }}>
                                        <label className="form-label">学校名</label>
                                        <input className="form-input" placeholder="○○大学" value={e.school}
                                            onChange={ev => updateEducation(i, 'school', ev.target.value)} />
                                    </div>
                                    <div className="form-group" style={{ margin: 0 }}>
                                        <label className="form-label">学部・学科</label>
                                        <input className="form-input" placeholder="○○学部 ○○学科" value={e.faculty}
                                            onChange={ev => updateEducation(i, 'faculty', ev.target.value)} />
                                    </div>
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-md)' }}>
                                    <div className="form-group" style={{ margin: 0 }}>
                                        <label className="form-label">入学年月</label>
                                        <input type="month" className="form-input" value={e.start}
                                            onChange={ev => updateEducation(i, 'start', ev.target.value)} />
                                    </div>
                                    <div className="form-group" style={{ margin: 0 }}>
                                        <label className="form-label">卒業年月</label>
                                        <input type="month" className="form-input" value={e.end}
                                            onChange={ev => updateEducation(i, 'end', ev.target.value)} />
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                    <button className="btn btn-secondary" onClick={addEducation}>
                        + 学歴を追加
                    </button>
                </div>
            )}

            {/* PR・希望条件 */}
            {activeTab === 'pr' && (
                <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
                    <div className="form-group" style={{ margin: 0 }}>
                        <label className="form-label">スキル・資格</label>
                        <input className="form-input" placeholder="例: Python, Excel, 普通自動車免許" value={form.skills}
                            onChange={e => updateField('skills', e.target.value)} />
                    </div>
                    <div className="form-group" style={{ margin: 0 }}>
                        <label className="form-label">自己PR・志望動機</label>
                        <textarea className="form-textarea" rows={5} placeholder="強み・実績・転職理由などを自由に記入"
                            value={form.self_pr}
                            onChange={e => updateField('self_pr', e.target.value)} />
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 'var(--space-md)' }}>
                        <div className="form-group" style={{ margin: 0 }}>
                            <label className="form-label">希望職種</label>
                            <input className="form-input" placeholder="エンジニア・営業など" value={form.desired_job}
                                onChange={e => updateField('desired_job', e.target.value)} />
                        </div>
                        <div className="form-group" style={{ margin: 0 }}>
                            <label className="form-label">希望勤務地</label>
                            <input className="form-input" placeholder="東京都内・リモート可など" value={form.desired_location}
                                onChange={e => updateField('desired_location', e.target.value)} />
                        </div>
                        <div className="form-group" style={{ margin: 0 }}>
                            <label className="form-label">希望年収</label>
                            <input className="form-input" placeholder="400万〜500万" value={form.desired_salary}
                                onChange={e => updateField('desired_salary', e.target.value)} />
                        </div>
                    </div>
                </div>
            )}

            {/* 下部ナビ */}
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 'var(--space-xl)', flexWrap: 'wrap', gap: 'var(--space-sm)' }}>
                {activeTab !== 'basic' && (
                    <button className="btn btn-secondary"
                        onClick={() => { const i = tabs.findIndex(t => t.id === activeTab); if (i > 0) setActiveTab(tabs[i - 1].id); }}>
                        ← 前へ
                    </button>
                )}
                {activeTab !== 'pr' ? (
                    <button className="btn btn-primary" style={{ marginLeft: 'auto' }}
                        onClick={() => { const i = tabs.findIndex(t => t.id === activeTab); if (i < tabs.length - 1) setActiveTab(tabs[i + 1].id); }}>
                        次へ →
                    </button>
                ) : (
                    <button className="btn btn-primary" style={{ marginLeft: 'auto' }} onClick={() => setShowSaveModal(true)}>
                        💾 保存・応募する
                    </button>
                )}
            </div>

            {/* 保存モーダル */}
            {showSaveModal && (
                <div style={{
                    position: 'fixed', inset: 0, zIndex: 1000,
                    background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    padding: 'var(--space-lg)',
                }}>
                    <div className="card animate-fade-in" style={{ maxWidth: 460, width: '100%' }}>
                        <button onClick={() => setShowSaveModal(false)}
                            style={{ position: 'absolute', top: 16, right: 16, background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: 'var(--color-text-secondary)' }}>
                            ✕
                        </button>

                        <div style={{ textAlign: 'center', marginBottom: 'var(--space-lg)' }}>
                            <div style={{ fontSize: '3rem', marginBottom: 'var(--space-sm)' }}>🎉</div>
                            <h2 style={{ fontSize: 'var(--font-size-xl)', marginBottom: 'var(--space-sm)' }}>
                                履歴書が完成しました！
                            </h2>
                            <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-sm)', lineHeight: 1.7, marginBottom: 'var(--space-md)' }}>
                                無料登録すると、この履歴書が保存され<br />
                                <strong>47万件の求人に何度でも使い回せます。</strong>
                            </p>
                            {/* 登録メリット */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, textAlign: 'left', background: 'rgba(52,199,89,0.07)', border: '1px solid rgba(52,199,89,0.2)', borderRadius: 'var(--radius-md)', padding: 'var(--space-md)', marginBottom: 'var(--space-sm)' }}>
                                {[
                                    '✅ 履歴書を何度でも使い回せる（毎回入力不要）',
                                    '✅ 複数求人にワンクリックで応募できる',
                                    '✅ 企業からのスカウトが届く',
                                    '✅ 入力内容はそのまま引き継がれる',
                                ].map((item, i) => (
                                    <div key={i} style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-primary)' }}>{item}</div>
                                ))}
                            </div>
                        </div>

                        {/* SNS登録ボタン */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)', marginBottom: 'var(--space-lg)' }}>
                            <SnsButton
                                icon="G"
                                color="#4285F4"
                                label="Googleで登録（30秒）"
                                href="/auth/google/redirect"
                                comingSoon
                            />
                            <SnsButton
                                icon=""
                                color="#06C755"
                                label="LINEで登録"
                                href="/auth/line/redirect"
                                comingSoon
                            />
                            <SnsButton
                                icon=""
                                color="#000000"
                                label="Appleで登録"
                                href="/auth/apple/redirect"
                                comingSoon
                            />
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)', marginBottom: 'var(--space-lg)' }}>
                            <div style={{ flex: 1, height: 1, background: 'var(--color-border)' }} />
                            <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>またはメールで登録</span>
                            <div style={{ flex: 1, height: 1, background: 'var(--color-border)' }} />
                        </div>

                        <Link
                            to="/register"
                            className="btn btn-secondary"
                            style={{ display: 'block', textAlign: 'center', width: '100%', marginBottom: 'var(--space-md)' }}
                        >
                            メールアドレスで登録
                        </Link>

                        <p style={{ textAlign: 'center', fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
                            すでにアカウントをお持ちの方は{' '}
                            <Link to="/login" style={{ color: 'var(--color-text-accent)' }}>ログイン</Link>
                        </p>
                    </div>
                </div>
            )}
        </div>
    );
}

function SnsButton({ icon, color, label, href, comingSoon }) {
    const content = (
        <div style={{
            display: 'flex', alignItems: 'center', gap: 'var(--space-md)',
            padding: 'var(--space-sm) var(--space-lg)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-md)',
            background: 'var(--color-bg-surface)',
            cursor: comingSoon ? 'not-allowed' : 'pointer',
            opacity: comingSoon ? 0.6 : 1,
            transition: 'all var(--transition-fast)',
            position: 'relative',
        }}>
            <div style={{
                width: 32, height: 32, borderRadius: '50%',
                background: color, display: 'flex', alignItems: 'center',
                justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: 14,
                flexShrink: 0,
            }}>
                {icon}
            </div>
            <span style={{ flex: 1, fontWeight: 600, fontSize: 'var(--font-size-sm)' }}>{label}</span>
            {comingSoon && (
                <span style={{
                    fontSize: 10, padding: '2px 6px',
                    background: 'rgba(245,158,11,0.15)',
                    color: '#d97706', borderRadius: 'var(--radius-sm)',
                    fontWeight: 600,
                }}>
                    近日公開
                </span>
            )}
        </div>
    );

    if (comingSoon) return <div>{content}</div>;
    return <a href={href} style={{ textDecoration: 'none', color: 'inherit' }}>{content}</a>;
}
