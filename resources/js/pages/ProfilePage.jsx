import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';
import { useUnsavedChanges } from '../hooks/useUnsavedChanges';
import { useToast } from '../hooks/useToast';

export default function ProfilePage() {
    const [profile, setProfile] = useState(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [completionRate, setCompletionRate] = useState(0);
    const [photoPath, setPhotoPath] = useState(null);
    const photoInputRef = useRef(null);
    const [form, setForm] = useState({
        full_name: '', full_name_kana: '', birth_date: '', gender: '',
        phone: '', postal_code: '', address: '', self_pr: '',
        education: [], work_history: [], skills: [], licenses: [],
    });
    const [savedForm, setSavedForm] = useState(null);
    const [fieldErrors, setFieldErrors] = useState({});
    const toast = useToast();
    const navigate = useNavigate();
    const { isDirty, confirmNavigation } = useUnsavedChanges(savedForm, form);

    const errorStyle = { color: '#ef4444', fontSize: 'var(--font-size-xs)', marginTop: 2 };

    const validatePhone = (value) => {
        if (!value) return '';
        const digits = value.replace(/[^\d]/g, '');
        if (digits.length < 10 || digits.length > 11) return '電話番号の形式が正しくありません';
        const patterns = [
            /^0[789]0-\d{4}-\d{4}$/,
            /^0\d{1,4}-\d{1,4}-\d{4}$/,
        ];
        if (!patterns.some(p => p.test(value))) return '電話番号の形式が正しくありません';
        return '';
    };

    const formatPhone = (value) => {
        const digits = value.replace(/[^\d]/g, '');
        if (digits.startsWith('0') && ['70','80','90'].includes(digits.substring(1,3))) {
            if (digits.length <= 3) return digits;
            if (digits.length <= 7) return digits.slice(0,3) + '-' + digits.slice(3);
            return digits.slice(0,3) + '-' + digits.slice(3,7) + '-' + digits.slice(7,11);
        }
        if (digits.startsWith('0')) {
            if (digits.length <= 2) return digits;
            if (digits.length <= 6) return digits.slice(0,2) + '-' + digits.slice(2);
            return digits.slice(0,2) + '-' + digits.slice(2,6) + '-' + digits.slice(6,10);
        }
        return digits;
    };

    const validatePostalCode = (value) => {
        if (!value) return '';
        if (!/^\d{3}-\d{4}$/.test(value)) return '郵便番号の形式が正しくありません（例: 150-0002）';
        return '';
    };

    const formatPostalCode = (value) => {
        const digits = value.replace(/[^\d]/g, '');
        if (digits.length <= 3) return digits;
        return digits.slice(0,3) + '-' + digits.slice(3,7);
    };

    const validateDateRange = (start, end) => {
        if (!start || !end) return '';
        if (end < start) return '終了日は開始日より後にしてください';
        return '';
    };

    const validateKana = (value) => {
        if (!value) return '';
        if (!/^[ァ-ヶー\s　]+$/.test(value)) return 'カタカナで入力してください';
        return '';
    };

    const handleBlur = (field) => {
        let error = '';
        if (field === 'phone') error = validatePhone(form.phone);
        if (field === 'postal_code') error = validatePostalCode(form.postal_code);
        if (field === 'full_name_kana') error = validateKana(form.full_name_kana);
        if (field === 'full_name' && !form.full_name.trim()) error = '氏名を入力してください';
        if (field === 'birth_date' && !form.birth_date) error = '生年月日を選択してください';
        setFieldErrors(prev => ({ ...prev, [field]: error }));
    };

    const handleBlurDateRange = (type, index, start, end) => {
        const key = `${type}_${index}_date`;
        const error = validateDateRange(start, end);
        setFieldErrors(prev => ({ ...prev, [key]: error }));
    };

    useEffect(() => {
        api.get('/profile').then(res => {
            const p = res.data.profile;
            setProfile(p);
            setPhotoPath(p.photo_path);
            const loaded = {
                full_name: p.full_name || '', full_name_kana: p.full_name_kana || '',
                birth_date: p.birth_date ? p.birth_date.split('T')[0] : '', gender: p.gender || '',
                phone: p.phone || '', postal_code: p.postal_code || '',
                address: p.address || '', self_pr: p.self_pr || '',
                education: p.education || [], work_history: p.work_history || [],
                skills: p.skills || [], licenses: p.licenses || [],
            };
            setForm(loaded);
            setSavedForm(loaded);
            setCompletionRate(res.data.completion_rate || 0);
        }).catch(() => {
            const empty = {
                full_name: '', full_name_kana: '', birth_date: '', gender: '',
                phone: '', postal_code: '', address: '', self_pr: '',
                education: [], work_history: [], skills: [], licenses: [],
            };
            setSavedForm(empty);
        }).finally(() => setLoading(false));
    }, []);

    const handleSave = async () => {
        // クライアントサイドバリデーション
        const errors = {};
        if (!form.full_name.trim()) errors.full_name = '氏名を入力してください';
        if (form.full_name_kana && !/^[ァ-ヶー\s　]+$/.test(form.full_name_kana)) errors.full_name_kana = 'カタカナで入力してください';
        if (form.phone) { const phoneErr = validatePhone(form.phone); if (phoneErr) errors.phone = phoneErr; }
        if (form.postal_code) { const postErr = validatePostalCode(form.postal_code); if (postErr) errors.postal_code = postErr; }
        if (Object.keys(errors).length > 0) {
            setFieldErrors(errors);
            toast.error('入力内容にエラーがあります');
            return;
        }
        setSaving(true);
        try {
            const res = await api.put('/profile', form);
            setProfile(res.data.profile);
            setCompletionRate(res.data.completion_rate);
            setSavedForm({ ...form });
            toast.success('保存しました！');
        } catch (err) {
            const errors = err.response?.data?.errors;
            if (errors) {
                toast.error('入力エラー:\n' + Object.values(errors).flat().join('\n'));
            } else {
                toast.error('保存に失敗しました');
            }
        } finally {
            setSaving(false);
        }
    };

    const handlePhotoUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        if (file.size > 10 * 1024 * 1024) {
            toast.error('ファイルサイズは10MB以下にしてください');
            return;
        }
        setUploading(true);
        try {
            const formData = new FormData();
            formData.append('photo', file);
            const res = await api.post('/profile/photo', formData);
            setPhotoPath(res.data.photo_path);
            setCompletionRate(res.data.completion_rate);
            toast.success('写真をアップロードしました！');
        } catch (err) {
            const detail = err.response?.data?.message || err.response?.data?.errors?.photo?.[0] || err.message || '不明なエラー';
            toast.error(`写真のアップロードに失敗しました: ${detail}`);
            console.error('Photo upload error:', err);
        } finally {
            setUploading(false);
        }
    };

    const addEducation = () => {
        setForm({...form, education: [...form.education, { school: '', faculty: '', start_date: '', end_date: '' }]});
    };
    const removeEducation = (index) => {
        const ed = [...form.education]; ed.splice(index, 1);
        setForm({...form, education: ed});
    };
    const addWorkHistory = () => {
        setForm({...form, work_history: [...form.work_history, { company: '', position: '', start_date: '', end_date: '', description: '' }]});
    };
    const removeWorkHistory = (index) => {
        const whs = [...form.work_history]; whs.splice(index, 1);
        setForm({...form, work_history: whs});
    };
    const addLicense = () => {
        setForm({...form, licenses: [...form.licenses, { name: '', date: '' }]});
    };
    const removeLicense = (index) => {
        const l = [...form.licenses]; l.splice(index, 1);
        setForm({...form, licenses: l});
    };

    const [showDetailedSections, setShowDetailedSections] = useState(false);

    // 詳細セクションに入力があれば自動展開
    useEffect(() => {
        if (form.education.length > 0 || form.work_history.length > 0 || form.licenses.length > 0 || form.skills.length > 0 || form.self_pr) {
            setShowDetailedSections(true);
        }
    }, [loading]);

    if (loading) return <div className="page container"><div className="skeleton" style={{ height: 400 }} /></div>;

    const basicComplete = form.full_name && form.full_name_kana && form.birth_date && form.phone;
    const detailComplete = form.education.length > 0 || form.work_history.length > 0 || form.skills.length > 0;

    return (
        <div className="page container animate-fade-in">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-md)' }}>
                <h1 style={{ fontSize: 'var(--font-size-3xl)' }}>プロフィール</h1>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-md)' }}>
                    {isDirty && <span className="badge badge-warning">未保存の変更あり</span>}
                    <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
                        {saving ? '保存中...' : '💾 保存'}
                    </button>
                </div>
            </div>

            {/* 完成度バー + 項目別ガイド */}
            {(() => {
                const pct = Math.round(completionRate * 100);
                const items = [
                    { label: '氏名', done: !!form.full_name, pts: 10 },
                    { label: 'フリガナ', done: !!form.full_name_kana, pts: 5 },
                    { label: '生年月日', done: !!form.birth_date, pts: 10 },
                    { label: '電話番号', done: !!form.phone, pts: 10 },
                    { label: '証明写真', done: !!photoPath, pts: 15 },
                    { label: '自己PR', done: !!form.self_pr, pts: 10 },
                    { label: '学歴', done: form.education.length > 0, pts: 10 },
                    { label: '職歴', done: form.work_history.length > 0, pts: 15 },
                    { label: 'スキル', done: form.skills.length > 0, pts: 10 },
                    { label: '資格', done: form.licenses.length > 0, pts: 5 },
                ];
                const incomplete = items.filter(i => !i.done);
                const barColor = pct >= 80 ? '#22c55e' : pct >= 50 ? '#f59e0b' : '#3b82f6';
                return (
                    <div style={{ marginBottom: 'var(--space-xl)', maxWidth: 700 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                            <span style={{ fontSize: 'var(--font-size-sm)', fontWeight: 600 }}>プロフィール入力率</span>
                            <span style={{ fontSize: 'var(--font-size-xl)', fontWeight: 800, color: barColor }}>{pct}%</span>
                        </div>
                        <div style={{ width: '100%', height: 8, background: 'var(--color-bg-surface)', borderRadius: 4, overflow: 'hidden', marginBottom: 'var(--space-sm)' }}>
                            <div style={{ width: `${pct}%`, height: '100%', background: barColor, borderRadius: 4, transition: 'width 0.6s ease' }} />
                        </div>
                        {incomplete.length > 0 && (
                            <div style={{ display: 'flex', gap: 'var(--space-xs)', flexWrap: 'wrap', alignItems: 'center' }}>
                                <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>入力するとスコアUP:</span>
                                {incomplete.slice(0, 5).map(item => (
                                    <span key={item.label} style={{
                                        padding: '2px 10px', borderRadius: 'var(--radius-full)', fontSize: 'var(--font-size-xs)',
                                        background: 'rgba(200,149,46,0.08)', color: 'var(--color-text-accent)',
                                        border: '1px solid rgba(200,149,46,0.2)', cursor: 'default',
                                    }}>
                                        {item.label} <strong>+{item.pts}%</strong>
                                    </span>
                                ))}
                                {incomplete.length > 5 && (
                                    <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
                                        他{incomplete.length - 5}項目
                                    </span>
                                )}
                            </div>
                        )}
                        {pct >= 80 && (
                            <p style={{ fontSize: 'var(--font-size-xs)', color: '#22c55e', fontWeight: 600, marginTop: 4 }}>
                                スカウトを受けやすい状態です！
                            </p>
                        )}
                    </div>
                );
            })()}

            <div style={{ maxWidth: 700 }}>

                {/* プロフィール完成度ガイド */}
                {!basicComplete && (
                    <div style={{
                        padding: 'var(--space-lg)', marginBottom: 'var(--space-lg)',
                        background: 'var(--color-accent-light)',
                        borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-border)',
                    }}>
                        <p style={{ fontWeight: 700, fontSize: 'var(--font-size-base)', marginBottom: 'var(--space-xs)' }}>
                            まずは基本情報だけ入力しましょう
                        </p>
                        <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', margin: 0, lineHeight: 1.6 }}>
                            氏名・フリガナ・生年月日・電話番号の4項目だけで応募を始められます。<br/>
                            学歴や職歴は後からいつでも追加できます。
                        </p>
                    </div>
                )}

                {basicComplete && !detailComplete && (
                    <div style={{
                        padding: 'var(--space-md)', marginBottom: 'var(--space-lg)',
                        background: 'rgba(16,185,129,0.08)', borderRadius: 'var(--radius-lg)',
                        border: '1px solid rgba(16,185,129,0.2)',
                        display: 'flex', alignItems: 'center', gap: 'var(--space-md)',
                    }}>
                        <span style={{ fontSize: '1.5rem' }}>✓</span>
                        <div>
                            <p style={{ fontWeight: 600, margin: '0 0 2px 0', fontSize: 'var(--font-size-sm)' }}>
                                基本情報が入力されました！ 応募を始められます
                            </p>
                            <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', margin: 0 }}>
                                学歴・職歴・スキルを追加すると、スカウトを受けやすくなります
                            </p>
                        </div>
                    </div>
                )}

                {/* 証明写真 */}
                <div className="card" style={{ marginBottom: 'var(--space-lg)' }}>
                    <h3 style={{ marginBottom: 'var(--space-md)' }}>📷 証明写真</h3>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-lg)' }}>
                        <div style={{
                            width: 120, height: 150, border: '2px dashed var(--color-border)',
                            borderRadius: 'var(--radius-md)', display: 'flex', alignItems: 'center',
                            justifyContent: 'center', overflow: 'hidden', flexShrink: 0,
                            background: 'var(--color-bg-surface)',
                        }}>
                            {photoPath ? (
                                <img src={`/storage/${photoPath}`} alt="証明写真"
                                    style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            ) : (
                                <div style={{ textAlign: 'center', color: 'var(--color-text-muted)', fontSize: 'var(--font-size-xs)' }}>
                                    <div style={{ fontSize: '2rem', marginBottom: 4 }}>📷</div>
                                    3cm × 4cm
                                </div>
                            )}
                        </div>
                        <div>
                            <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', marginBottom: 'var(--space-sm)' }}>
                                履歴書用の証明写真をアップロード<br/>
                                <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
                                    JPEG/PNG、10MB以下
                                </span>
                            </p>
                            <input type="file" ref={photoInputRef} accept="image/jpeg,image/png"
                                style={{ display: 'none' }} onChange={handlePhotoUpload} />
                            <button className="btn btn-secondary" onClick={() => photoInputRef.current?.click()}
                                disabled={uploading} style={{ fontSize: 'var(--font-size-sm)' }}>
                                {uploading ? 'アップロード中...' : (photoPath ? '📷 写真を変更' : '📷 写真をアップロード')}
                            </button>
                        </div>
                    </div>
                </div>

                {/* 基本情報 */}
                <div className="card" style={{ marginBottom: 'var(--space-lg)' }}>
                    <h3 style={{ marginBottom: 'var(--space-md)' }}>基本情報</h3>
                    <div className="grid grid-2">
                        <div className="form-group">
                            <label className="form-label">氏名</label>
                            <input className="form-input" value={form.full_name}
                                onChange={e => setForm({...form, full_name: e.target.value})}
                                onBlur={() => handleBlur('full_name')}
                                placeholder="例: 山田 太郎"
                                style={fieldErrors.full_name ? { borderColor: '#ef4444' } : {}} />
                            {fieldErrors.full_name && <div style={errorStyle}>{fieldErrors.full_name}</div>}
                        </div>
                        <div className="form-group">
                            <label className="form-label">フリガナ</label>
                            <input className="form-input" value={form.full_name_kana}
                                onChange={e => setForm({...form, full_name_kana: e.target.value})}
                                onBlur={() => handleBlur('full_name_kana')}
                                placeholder="例: ヤマダ タロウ"
                                style={fieldErrors.full_name_kana ? { borderColor: '#ef4444' } : {}} />
                            {fieldErrors.full_name_kana && <div style={errorStyle}>{fieldErrors.full_name_kana}</div>}
                        </div>
                        <div className="form-group">
                            <label className="form-label">生年月日</label>
                            <input type="date" className="form-input" value={form.birth_date}
                                onChange={e => setForm({...form, birth_date: e.target.value})}
                                onBlur={() => handleBlur('birth_date')}
                                style={fieldErrors.birth_date ? { borderColor: '#ef4444' } : {}} />
                            {fieldErrors.birth_date && <div style={errorStyle}>{fieldErrors.birth_date}</div>}
                        </div>
                        <div className="form-group">
                            <label className="form-label">性別</label>
                            <select className="form-select" value={form.gender} onChange={e => setForm({...form, gender: e.target.value})}>
                                <option value="">選択してください</option>
                                <option value="male">男性</option>
                                <option value="female">女性</option>
                                <option value="other">その他</option>
                            </select>
                        </div>
                        <div className="form-group">
                            <label className="form-label">電話番号</label>
                            <input className="form-input" value={form.phone}
                                onChange={e => setForm({...form, phone: formatPhone(e.target.value)})}
                                onBlur={() => handleBlur('phone')}
                                placeholder="例: 090-1234-5678"
                                style={fieldErrors.phone ? { borderColor: '#ef4444' } : {}} />
                            {fieldErrors.phone && <div style={errorStyle}>{fieldErrors.phone}</div>}
                        </div>
                        <div className="form-group">
                            <label className="form-label">郵便番号</label>
                            <input className="form-input" value={form.postal_code}
                                onChange={e => setForm({...form, postal_code: formatPostalCode(e.target.value)})}
                                onBlur={() => handleBlur('postal_code')}
                                placeholder="例: 100-0001"
                                style={fieldErrors.postal_code ? { borderColor: '#ef4444' } : {}} />
                            {fieldErrors.postal_code && <div style={errorStyle}>{fieldErrors.postal_code}</div>}
                        </div>
                    </div>
                    <div className="form-group">
                        <label className="form-label">住所</label>
                        <input className="form-input" value={form.address} onChange={e => setForm({...form, address: e.target.value})} placeholder="例: 東京都千代田区千代田1-1" />
                    </div>
                    <div className="form-group">
                        <label className="form-label">自己PR</label>
                        <textarea className="form-textarea" value={form.self_pr} rows={4} onChange={e => setForm({...form, self_pr: e.target.value})}
                            placeholder="自分の強みやアピールポイントを記入" />
                    </div>
                </div>

                {/* 詳細情報トグル */}
                {!showDetailedSections ? (
                    <button onClick={() => setShowDetailedSections(true)}
                        style={{
                            width: '100%', padding: 'var(--space-lg)',
                            background: 'var(--color-bg-secondary)', border: '2px dashed var(--color-border)',
                            borderRadius: 'var(--radius-lg)', cursor: 'pointer',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            gap: 'var(--space-sm)', fontSize: 'var(--font-size-sm)',
                            color: 'var(--color-text-accent)', fontWeight: 600,
                            marginBottom: 'var(--space-lg)', transition: 'all 0.2s',
                        }}
                        onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--color-accent)'}
                        onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--color-border)'}>
                        ＋ 学歴・職歴・スキルを追加する（任意）
                    </button>
                ) : (
                <>

                {/* 学歴 */}
                <div className="card" style={{ marginBottom: 'var(--space-lg)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-md)' }}>
                        <h3>🎓 学歴</h3>
                        <button className="btn btn-secondary" onClick={addEducation} style={{ fontSize: 'var(--font-size-sm)' }}>＋ 追加</button>
                    </div>
                    {form.education.length === 0 && (
                        <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--font-size-sm)' }}>学歴を追加してください</p>
                    )}
                    {form.education.map((edu, i) => (
                        <div key={i} style={{ padding: 'var(--space-md)', background: 'var(--color-bg-surface)', borderRadius: 'var(--radius-md)', marginBottom: 'var(--space-sm)', position: 'relative' }}>
                            <button onClick={() => removeEducation(i)} style={{ position: 'absolute', top: 8, right: 8, background: 'none', border: 'none', color: '#f87171', cursor: 'pointer', fontSize: '1rem' }} title="削除">✕</button>
                            <div className="grid grid-2">
                                <div className="form-group" style={{ marginBottom: 'var(--space-xs)' }}>
                                    <input className="form-input" placeholder="学校名" value={edu.school}
                                        onChange={e => { const ed = [...form.education]; ed[i] = {...ed[i], school: e.target.value}; setForm({...form, education: ed}); }} />
                                </div>
                                <div className="form-group" style={{ marginBottom: 'var(--space-xs)' }}>
                                    <input className="form-input" placeholder="学部・学科" value={edu.faculty || ''}
                                        onChange={e => { const ed = [...form.education]; ed[i] = {...ed[i], faculty: e.target.value}; setForm({...form, education: ed}); }} />
                                </div>
                                <div className="form-group" style={{ marginBottom: 0 }}>
                                    <input type="month" className="form-input" placeholder="開始" value={edu.start_date || ''}
                                        onChange={e => { const ed = [...form.education]; ed[i] = {...ed[i], start_date: e.target.value}; setForm({...form, education: ed}); }}
                                        onBlur={() => handleBlurDateRange('education', i, edu.start_date, edu.end_date)} />
                                </div>
                                <div className="form-group" style={{ marginBottom: 0 }}>
                                    <input type="month" className="form-input" placeholder="終了" value={edu.end_date || ''}
                                        onChange={e => { const ed = [...form.education]; ed[i] = {...ed[i], end_date: e.target.value}; setForm({...form, education: ed}); }}
                                        onBlur={() => handleBlurDateRange('education', i, edu.start_date, edu.end_date)} />
                                </div>
                            </div>
                            {fieldErrors[`education_${i}_date`] && <div style={errorStyle}>{fieldErrors[`education_${i}_date`]}</div>}
                        </div>
                    ))}
                </div>

                {/* 職歴 */}
                <div className="card" style={{ marginBottom: 'var(--space-lg)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-md)' }}>
                        <h3>💼 職歴</h3>
                        <button className="btn btn-secondary" onClick={addWorkHistory} style={{ fontSize: 'var(--font-size-sm)' }}>＋ 追加</button>
                    </div>
                    {form.work_history.length === 0 && (
                        <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--font-size-sm)' }}>職歴を追加してください</p>
                    )}
                    {form.work_history.map((wh, i) => (
                        <div key={i} style={{ padding: 'var(--space-md)', background: 'var(--color-bg-surface)', borderRadius: 'var(--radius-md)', marginBottom: 'var(--space-sm)', position: 'relative' }}>
                            <button onClick={() => removeWorkHistory(i)} style={{ position: 'absolute', top: 8, right: 8, background: 'none', border: 'none', color: '#f87171', cursor: 'pointer', fontSize: '1rem' }} title="削除">✕</button>
                            <div className="grid grid-2">
                                <div className="form-group" style={{ marginBottom: 'var(--space-xs)' }}>
                                    <input className="form-input" placeholder="会社名" value={wh.company}
                                        onChange={e => { const whs = [...form.work_history]; whs[i] = {...whs[i], company: e.target.value}; setForm({...form, work_history: whs}); }} />
                                </div>
                                <div className="form-group" style={{ marginBottom: 'var(--space-xs)' }}>
                                    <input className="form-input" placeholder="役職" value={wh.position || ''}
                                        onChange={e => { const whs = [...form.work_history]; whs[i] = {...whs[i], position: e.target.value}; setForm({...form, work_history: whs}); }} />
                                </div>
                                <div className="form-group" style={{ marginBottom: 'var(--space-xs)' }}>
                                    <input type="month" className="form-input" value={wh.start_date || ''}
                                        onChange={e => { const whs = [...form.work_history]; whs[i] = {...whs[i], start_date: e.target.value}; setForm({...form, work_history: whs}); }}
                                        onBlur={() => handleBlurDateRange('work_history', i, wh.start_date, wh.end_date)} />
                                </div>
                                <div className="form-group" style={{ marginBottom: 'var(--space-xs)' }}>
                                    <input type="month" className="form-input" value={wh.end_date || ''}
                                        onChange={e => { const whs = [...form.work_history]; whs[i] = {...whs[i], end_date: e.target.value}; setForm({...form, work_history: whs}); }}
                                        onBlur={() => handleBlurDateRange('work_history', i, wh.start_date, wh.end_date)} />
                                </div>
                            </div>
                            {fieldErrors[`work_history_${i}_date`] && <div style={{ ...errorStyle, marginBottom: 'var(--space-xs)' }}>{fieldErrors[`work_history_${i}_date`]}</div>}
                            <div className="form-group" style={{ marginBottom: 0 }}>
                                <textarea className="form-textarea" placeholder="職務内容" value={wh.description || ''} rows={2}
                                    onChange={e => { const whs = [...form.work_history]; whs[i] = {...whs[i], description: e.target.value}; setForm({...form, work_history: whs}); }} />
                            </div>
                        </div>
                    ))}
                </div>

                {/* 免許・資格 */}
                <div className="card" style={{ marginBottom: 'var(--space-lg)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-md)' }}>
                        <h3>📜 免許・資格</h3>
                        <button className="btn btn-secondary" onClick={addLicense} style={{ fontSize: 'var(--font-size-sm)' }}>＋ 追加</button>
                    </div>
                    {form.licenses.length === 0 && (
                        <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--font-size-sm)' }}>免許・資格を追加してください</p>
                    )}
                    {form.licenses.map((lic, i) => (
                        <div key={i} style={{ padding: 'var(--space-md)', background: 'var(--color-bg-surface)', borderRadius: 'var(--radius-md)', marginBottom: 'var(--space-sm)', position: 'relative' }}>
                            <button onClick={() => removeLicense(i)} style={{ position: 'absolute', top: 8, right: 8, background: 'none', border: 'none', color: '#f87171', cursor: 'pointer', fontSize: '1rem' }} title="削除">✕</button>
                            <div className="grid grid-2">
                                <div className="form-group" style={{ marginBottom: 0 }}>
                                    <input className="form-input" placeholder="資格名" value={lic.name || ''}
                                        onChange={e => { const l = [...form.licenses]; l[i] = {...l[i], name: e.target.value}; setForm({...form, licenses: l}); }} />
                                </div>
                                <div className="form-group" style={{ marginBottom: 0 }}>
                                    <input type="month" className="form-input" placeholder="取得年月" value={lic.date || ''}
                                        onChange={e => { const l = [...form.licenses]; l[i] = {...l[i], date: e.target.value}; setForm({...form, licenses: l}); }} />
                                </div>
                            </div>
                        </div>
                    ))}
                </div>

                {/* スキル */}
                <div className="card" style={{ marginBottom: 'var(--space-lg)' }}>
                    <h3 style={{ marginBottom: 'var(--space-md)' }}>🛠️ スキル</h3>
                    <div className="form-group">
                        <input className="form-input" placeholder="カンマ区切りで入力 例: JavaScript, React, Laravel"
                            value={form.skills.join(', ')}
                            onChange={e => setForm({...form, skills: e.target.value.split(',').map(s => s.trim()).filter(Boolean)})} />
                    </div>
                    {form.skills.length > 0 && (
                        <div style={{ display: 'flex', gap: 'var(--space-xs)', flexWrap: 'wrap' }}>
                            {form.skills.map((s, i) => (
                                <span key={i} className="badge badge-info">{s}</span>
                            ))}
                        </div>
                    )}
                </div>

                </>
                )}
            </div>

        </div>
    );
}
