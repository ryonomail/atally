import React, { useState, useEffect } from 'react';

const GUEST_PROFILE_KEY = 'guest_profile';

const SKILL_CATEGORIES = {
    '営業・販売': ['営業', '法人営業', '個人営業', 'ルート営業', '接客', '販売', '店舗運営', 'テレアポ'],
    '事務・管理': ['一般事務', '経理', '総務', '人事', '労務', '秘書', '受付', '簿記', 'データ入力'],
    'IT・エンジニア': ['JavaScript', 'Python', 'Java', 'PHP', 'React', 'AWS', 'SQL', 'インフラ'],
    'デザイン・クリエイティブ': ['デザイン', 'Figma', 'Photoshop', 'Illustrator', '動画編集', 'Web制作', 'ライティング'],
    '医療・介護': ['看護', '介護', '薬剤師', '医療事務', 'ケアマネ', '理学療法'],
    '建設・製造': ['施工管理', '建築', '電気工事', '製造', '品質管理', 'CAD', 'フォークリフト'],
    '飲食・サービス': ['調理', 'ホール', 'バリスタ', '栄養士', 'ホテル', 'ブライダル'],
    '物流・運輸': ['ドライバー', '倉庫管理', '配送', '貿易事務', '通関士', '物流管理'],
    '共通スキル': ['Excel', 'マネジメント', '英語', '中国語', 'マーケティング', 'TOEIC800+'],
};

export function getGuestProfile() {
    try {
        return JSON.parse(localStorage.getItem(GUEST_PROFILE_KEY) || 'null');
    } catch {
        return null;
    }
}

export function clearGuestProfile() {
    localStorage.removeItem(GUEST_PROFILE_KEY);
}

export default function GuestProfileBanner({ onProfileChange }) {
    const [isExpanded, setIsExpanded] = useState(false);
    const [isDismissed, setIsDismissed] = useState(false);
    const [profile, setProfile] = useState(() => getGuestProfile() || {});
    const [skillInput, setSkillInput] = useState('');
    const [skillCategory, setSkillCategory] = useState(Object.keys(SKILL_CATEGORIES)[0]);

    const hasProfile = profile.age || profile.experience_years || (profile.skills && profile.skills.length > 0);

    useEffect(() => {
        if (hasProfile) {
            localStorage.setItem(GUEST_PROFILE_KEY, JSON.stringify(profile));
            onProfileChange?.(profile);
        }
    }, [profile]);

    // 初回ロード時にも既存プロフィールを通知
    useEffect(() => {
        if (hasProfile) {
            onProfileChange?.(profile);
        }
    }, []);

    const handleApply = () => {
        localStorage.setItem(GUEST_PROFILE_KEY, JSON.stringify(profile));
        onProfileChange?.(profile);
        setIsExpanded(false);
    };

    const handleClear = () => {
        setProfile({});
        clearGuestProfile();
        onProfileChange?.(null);
    };

    const addSkill = (skill) => {
        const current = profile.skills || [];
        if (!current.includes(skill) && current.length < 10) {
            setProfile(prev => ({ ...prev, skills: [...current, skill] }));
        }
    };

    const removeSkill = (skill) => {
        setProfile(prev => ({
            ...prev,
            skills: (prev.skills || []).filter(s => s !== skill),
        }));
    };

    const handleSkillInputKeyDown = (e) => {
        if (e.key === 'Enter' && skillInput.trim()) {
            e.preventDefault();
            addSkill(skillInput.trim());
            setSkillInput('');
        }
    };

    if (isDismissed) return null;

    // コンパクト表示: プロフィール未入力 or 折りたたみ時
    if (!isExpanded) {
        return (
            <div style={{
                background: 'var(--color-accent-light)',
                border: '1px solid rgba(0,122,255,0.15)',
                borderRadius: 'var(--radius-lg)',
                padding: 'var(--space-sm) var(--space-md)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 'var(--space-sm)',
                flexWrap: 'wrap',
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)', flex: 1 }}>
                    <span style={{ fontSize: 15, opacity: 0.6 }}>&#9432;</span>
                    {hasProfile ? (
                        <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>
                            条件で絞り込み中
                            {profile.age && <span style={tagStyle}>{profile.age}歳</span>}
                            {profile.experience_years && <span style={tagStyle}>経験{profile.experience_years}年</span>}
                            {profile.skills?.map(s => <span key={s} style={tagStyle}>{s}</span>)}
                        </span>
                    ) : (
                        <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>
                            スキルを入力すると、そのスキルに関連する求人だけに絞り込まれます
                        </span>
                    )}
                </div>
                <div style={{ display: 'flex', gap: 'var(--space-xs)' }}>
                    <button
                        className="btn btn-primary"
                        onClick={() => setIsExpanded(true)}
                        style={{ height: 32, fontSize: 'var(--font-size-xs)', padding: '0 var(--space-md)' }}
                    >
                        {hasProfile ? '編集' : '入力する'}
                    </button>
                    {hasProfile && (
                        <button
                            className="btn btn-secondary"
                            onClick={handleClear}
                            style={{ height: 32, fontSize: 'var(--font-size-xs)', padding: '0 var(--space-sm)' }}
                        >
                            クリア
                        </button>
                    )}
                    <button
                        onClick={() => setIsDismissed(true)}
                        style={{
                            background: 'none', border: 'none', cursor: 'pointer',
                            color: 'var(--color-text-muted)', fontSize: 16, lineHeight: 1, padding: '0 4px',
                        }}
                        title="閉じる"
                    >&times;</button>
                </div>
            </div>
        );
    }

    // 展開表示: 入力フォーム
    return (
        <div className="animate-fade-in" style={{
            background: 'var(--color-accent-light)',
            border: '1px solid rgba(0,122,255,0.15)',
            borderRadius: 'var(--radius-lg)',
            padding: 'var(--space-md)',
        }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-md)' }}>
                <div>
                    <h4 style={{ fontSize: 'var(--font-size-sm)', fontWeight: 700, margin: 0 }}>
                        スキル・条件で絞り込む
                    </h4>
                    <p style={{ fontSize: 11, color: 'var(--color-text-muted)', margin: '2px 0 0' }}>
                        スキルを入力すると、そのスキルに関連する求人だけに絞り込まれます。年齢・経験年数はおすすめ順の調整に使われます。
                    </p>
                </div>
                <button
                    onClick={() => setIsExpanded(false)}
                    style={{
                        background: 'none', border: 'none', cursor: 'pointer',
                        color: 'var(--color-text-muted)', fontSize: 18, lineHeight: 1,
                    }}
                >&times;</button>
            </div>

            <div style={{ display: 'flex', gap: 'var(--space-md)', flexWrap: 'wrap', marginBottom: 'var(--space-md)' }}>
                {/* 年齢 */}
                <div style={{ flex: '1 1 120px' }}>
                    <label className="form-label" style={{ fontSize: 'var(--font-size-xs)' }}>年齢</label>
                    <select
                        className="form-select"
                        value={profile.age || ''}
                        onChange={e => setProfile(prev => ({ ...prev, age: e.target.value ? Number(e.target.value) : undefined }))}
                        style={{ height: 38 }}
                    >
                        <option value="">選択してください</option>
                        {Array.from({ length: 53 }, (_, i) => i + 18).map(age => (
                            <option key={age} value={age}>{age}歳</option>
                        ))}
                    </select>
                </div>

                {/* 経験年数 */}
                <div style={{ flex: '1 1 120px' }}>
                    <label className="form-label" style={{ fontSize: 'var(--font-size-xs)' }}>経験年数</label>
                    <select
                        className="form-select"
                        value={profile.experience_years || ''}
                        onChange={e => setProfile(prev => ({ ...prev, experience_years: e.target.value ? Number(e.target.value) : undefined }))}
                        style={{ height: 38 }}
                    >
                        <option value="">選択してください</option>
                        <option value="0">未経験</option>
                        <option value="1">1年</option>
                        <option value="2">2年</option>
                        <option value="3">3年</option>
                        <option value="5">5年</option>
                        <option value="7">7年</option>
                        <option value="10">10年以上</option>
                        <option value="15">15年以上</option>
                        <option value="20">20年以上</option>
                    </select>
                </div>
            </div>

            {/* スキル */}
            <div style={{ marginBottom: 'var(--space-md)' }}>
                <label className="form-label" style={{ fontSize: 'var(--font-size-xs)' }}>スキル・経験</label>

                {/* 選択済みスキル */}
                {profile.skills?.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 'var(--space-xs)' }}>
                        {profile.skills.map(skill => (
                            <span key={skill} style={{
                                display: 'inline-flex', alignItems: 'center', gap: 4,
                                background: 'var(--color-accent)', color: '#fff',
                                borderRadius: 'var(--radius-full)', padding: '2px 10px',
                                fontSize: 'var(--font-size-xs)', fontWeight: 500,
                            }}>
                                {skill}
                                <button
                                    onClick={() => removeSkill(skill)}
                                    style={{
                                        background: 'none', border: 'none', cursor: 'pointer',
                                        color: 'rgba(255,255,255,0.8)', fontSize: 14, lineHeight: 1, padding: 0,
                                    }}
                                >&times;</button>
                            </span>
                        ))}
                    </div>
                )}

                {/* スキル入力 */}
                <input
                    type="text"
                    className="form-input"
                    placeholder="スキルを入力してEnter"
                    value={skillInput}
                    onChange={e => setSkillInput(e.target.value)}
                    onKeyDown={handleSkillInputKeyDown}
                    style={{ height: 36, fontSize: 'var(--font-size-xs)', marginBottom: 'var(--space-xs)' }}
                />

                {/* カテゴリタブ */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 2, marginBottom: 'var(--space-xs)' }}>
                    {Object.keys(SKILL_CATEGORIES).map(cat => (
                        <button
                            key={cat}
                            onClick={() => setSkillCategory(cat)}
                            style={{
                                background: skillCategory === cat ? 'var(--color-accent)' : 'transparent',
                                color: skillCategory === cat ? '#fff' : 'var(--color-text-secondary)',
                                border: skillCategory === cat ? 'none' : '1px solid var(--color-border)',
                                borderRadius: 'var(--radius-full)',
                                padding: '3px 10px',
                                fontSize: 11,
                                cursor: 'pointer',
                                fontWeight: skillCategory === cat ? 600 : 400,
                                transition: 'all 0.15s',
                            }}
                        >
                            {cat}
                        </button>
                    ))}
                </div>

                {/* サジェスト */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                    {(SKILL_CATEGORIES[skillCategory] || [])
                        .filter(s => !(profile.skills || []).includes(s))
                        .map(skill => (
                            <button
                                key={skill}
                                onClick={() => addSkill(skill)}
                                style={{
                                    background: 'var(--color-bg-primary)',
                                    border: '1px solid var(--color-border)',
                                    borderRadius: 'var(--radius-full)',
                                    padding: '2px 10px',
                                    fontSize: 'var(--font-size-xs)',
                                    color: 'var(--color-text-secondary)',
                                    cursor: 'pointer',
                                }}
                            >
                                + {skill}
                            </button>
                        ))}
                </div>
            </div>

            <div style={{ display: 'flex', gap: 'var(--space-sm)', justifyContent: 'flex-end' }}>
                <button
                    className="btn btn-secondary"
                    onClick={() => setIsExpanded(false)}
                    style={{ height: 36, fontSize: 'var(--font-size-xs)' }}
                >
                    キャンセル
                </button>
                <button
                    className="btn btn-primary"
                    onClick={handleApply}
                    style={{ height: 36, fontSize: 'var(--font-size-xs)' }}
                >
                    この条件で表示を最適化
                </button>
            </div>
        </div>
    );
}

const tagStyle = {
    display: 'inline-block',
    background: 'rgba(0,122,255,0.1)',
    color: 'var(--color-accent)',
    borderRadius: 'var(--radius-full)',
    padding: '1px 8px',
    fontSize: 'var(--font-size-xs)',
    fontWeight: 500,
    marginLeft: 6,
};
