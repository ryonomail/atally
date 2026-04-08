import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../api';
import { useUnsavedChanges } from '../hooks/useUnsavedChanges';
import { useToast } from '../hooks/useToast';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

const TYPE_LABELS = { resume: 'アルバイト用履歴書', career_resume: '転職用履歴書', cv: '職務経歴書' };
const TYPE_ICONS = { resume: '📝', career_resume: '📋', cv: '📊' };

export default function ResumeEditorPage() {
    const { id } = useParams();
    const navigate = useNavigate();
    const toast = useToast();
    const [resume, setResume] = useState(null);
    const [preview, setPreview] = useState(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [showPreview, setShowPreview] = useState(false);
    const [form, setForm] = useState({
        title: '', motivation: '', desired_salary: '', desired_location: '', available_date: '',
    });
    const [content, setContent] = useState({});
    const [savedForm, setSavedForm] = useState(null);
    const [savedContent, setSavedContent] = useState(null);
    const [downloading, setDownloading] = useState(false);
    const previewRef = useRef(null);
    const { isDirty, confirmNavigation } = useUnsavedChanges(savedForm, form);

    useEffect(() => {
        api.get(`/resumes/${id}`).then(res => {
            const r = res.data.resume;
            setResume(r);
            const loaded = {
                title: r.title || '', motivation: r.motivation || '', desired_salary: r.desired_salary || '',
                desired_location: r.desired_location || '', available_date: r.available_date ? r.available_date.split('T')[0] : '',
            };
            setForm(loaded);
            setSavedForm(loaded);
            const c = r.content || {};
            setContent(c);
            setSavedContent(JSON.stringify(c));
        }).catch(() => navigate('/resumes')).finally(() => setLoading(false));
    }, [id]);

    const handleSave = async () => {
        setSaving(true);
        try {
            const payload = { ...form, content: Object.keys(content).length > 0 ? content : null };
            Object.keys(payload).forEach(k => {
                if (payload[k] === '') payload[k] = null;
            });
            const res = await api.put(`/resumes/${id}`, payload);
            setResume(res.data.resume);
            setSavedForm({ ...form });
            setSavedContent(JSON.stringify(content));
            toast.success('保存しました');
        } catch (err) {
            const errors = err.response?.data?.errors;
            if (errors) {
                toast.error('入力エラー: ' + Object.values(errors).flat().join(', '));
            } else {
                toast.error('保存に失敗しました');
            }
        } finally {
            setSaving(false);
        }
    };

    const handlePreview = async () => {
        try {
            const res = await api.get(`/resumes/${id}/preview`);
            setPreview(res.data.snapshot);
            setShowPreview(true);
        } catch (err) {
            toast.error('プレビューの取得に失敗しました');
        }
    };

    const handleDownload = useCallback(async () => {
        if (!previewRef.current) {
            toast.info('先にプレビューを表示してください');
            return;
        }
        setDownloading(true);
        try {
            const container = previewRef.current;
            const pages = container.querySelectorAll('[data-pdf-page]');
            const pdf = new jsPDF('p', 'mm', 'a4');
            const pdfWidth = 210;
            const pdfHeight = 297;

            for (let i = 0; i < pages.length; i++) {
                if (i > 0) pdf.addPage();
                const canvas = await html2canvas(pages[i], {
                    scale: 2,
                    useCORS: true,
                    backgroundColor: '#ffffff',
                    logging: false,
                });
                const imgData = canvas.toDataURL('image/png');
                pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
            }

            const typeLabel = TYPE_LABELS[resume?.type] || '履歴書';
            const fileName = `${form.title || typeLabel}_${new Date().toISOString().slice(0,10)}.pdf`;
            pdf.save(fileName);
        } catch (err) {
            console.error('PDF generation failed:', err);
            toast.error('PDFの生成に失敗しました');
        } finally {
            setDownloading(false);
        }
    }, [preview, form.title, resume?.type]);

    if (loading) return <div className="page container"><div className="skeleton" style={{ height: 400 }} /></div>;

    return (
        <div className="page container animate-fade-in">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-xl)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-md)' }}>
                    <button className="btn btn-secondary" onClick={() => confirmNavigation('/resumes')} style={{ fontSize: 'var(--font-size-sm)' }}>⬅ 戻る</button>
                    <h1 style={{ fontSize: 'var(--font-size-2xl)' }}>{TYPE_ICONS[resume?.type] || '📝'} {form.title || '履歴書編集'}</h1>
                </div>
                <div style={{ display: 'flex', gap: 'var(--space-sm)', alignItems: 'center' }}>
                    {isDirty && <span className="badge badge-warning">未保存</span>}
                    <button className="btn btn-secondary" onClick={handlePreview}>👁️ プレビュー</button>
                    {showPreview && preview && (
                        <button className="btn btn-secondary" onClick={handleDownload} disabled={downloading}>
                            {downloading ? '生成中...' : '📥 PDF'}
                        </button>
                    )}
                    <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
                        {saving ? '保存中...' : '💾 保存'}
                    </button>
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: showPreview ? '1fr minmax(0, 1fr)' : '1fr', gap: 'var(--space-xl)' }}>
                {/* Editor */}
                <div>
                    {/* スカウト設定 */}
                    <div className="card" style={{
                        marginBottom: 'var(--space-lg)',
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        background: resume?.scout_enabled ? 'var(--color-bg-surface)' : undefined,
                        border: resume?.scout_enabled ? '1px solid var(--color-accent)' : undefined,
                    }}>
                        <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)' }}>
                                <span style={{ fontSize: '1.2rem' }}>{resume?.scout_enabled ? '🔔' : '🔕'}</span>
                                <strong style={{ fontSize: 'var(--font-size-sm)' }}>スカウト受付</strong>
                                {resume?.scout_enabled && <span className="badge badge-success" style={{ fontSize: 'var(--font-size-xs)' }}>ON</span>}
                            </div>
                            <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', margin: '4px 0 0' }}>
                                {resume?.scout_enabled
                                    ? 'この履歴書で企業からのスカウトを受け付けています（個人情報は承諾後に公開）'
                                    : 'ONにすると企業があなたのスキル・経歴を匿名で閲覧できます'}
                            </p>
                        </div>
                        <button
                            className={resume?.scout_enabled ? 'btn btn-secondary' : 'btn btn-primary'}
                            style={{ fontSize: 'var(--font-size-xs)', whiteSpace: 'nowrap' }}
                            onClick={async () => {
                                try {
                                    const res = await api.put(`/resumes/${id}`, { scout_enabled: !resume?.scout_enabled });
                                    setResume(res.data.resume);
                                } catch { toast.error('設定の変更に失敗しました'); }
                            }}>
                            {resume?.scout_enabled ? 'OFFにする' : 'ONにする'}
                        </button>
                    </div>

                    {resume?.scout_enabled && (
                        <div style={{
                            background: 'linear-gradient(135deg, rgba(200,149,46,0.06) 0%, rgba(16,185,129,0.06) 100%)',
                            border: '1px solid rgba(200,149,46,0.2)',
                            borderRadius: 'var(--radius-md)',
                            padding: 'var(--space-md) var(--space-lg)',
                            marginBottom: 'var(--space-lg)',
                            fontSize: 'var(--font-size-sm)',
                            lineHeight: 1.8,
                        }}>
                            <p style={{ fontWeight: 700, margin: '0 0 var(--space-xs) 0', color: 'var(--color-text-primary)' }}>
                                スカウトを有効にすると...
                            </p>
                            <ul style={{ listStyle: 'none', padding: 0, margin: 0, color: 'var(--color-text-secondary)' }}>
                                <li>&#10003; あなたのプロフィール（匿名）が企業に公開されます</li>
                                <li>&#10003; 企業があなたのスキル・経歴を見てスカウトを送れます</li>
                                <li>&#10003; 名前・連絡先は承諾するまで公開されません</li>
                                <li>&#10003; いつでもオフにできます</li>
                            </ul>
                        </div>
                    )}

                    <div className="card" style={{ marginBottom: 'var(--space-lg)' }}>
                        <h3 style={{ marginBottom: 'var(--space-md)' }}>履歴書情報（子データ）</h3>
                        <div className="form-group">
                            <label className="form-label">タイトル</label>
                            <input className="form-input" value={form.title} placeholder="例: A社用、営業職向け"
                                onChange={e => setForm({...form, title: e.target.value})} />
                        </div>
                        <div className="form-group">
                            <label className="form-label">志望動機</label>
                            <textarea className="form-textarea" value={form.motivation} rows={6}
                                onChange={e => setForm({...form, motivation: e.target.value})}
                                placeholder="この応募先に合わせた志望動機を記入" />
                        </div>
                        <div className="grid grid-2">
                            <div className="form-group">
                                <label className="form-label">希望給与</label>
                                <input className="form-input" value={form.desired_salary}
                                    onChange={e => setForm({...form, desired_salary: e.target.value})}
                                    placeholder="例: 年収400万〜500万" />
                            </div>
                            <div className="form-group">
                                <label className="form-label">希望勤務地</label>
                                <input className="form-input" value={form.desired_location}
                                    onChange={e => setForm({...form, desired_location: e.target.value})}
                                    placeholder="例: 東京都内" />
                            </div>
                        </div>
                        <div className="form-group">
                            <label className="form-label">入社可能日</label>
                            <input type="date" className="form-input" value={form.available_date}
                                onChange={e => setForm({...form, available_date: e.target.value})} />
                        </div>
                    </div>

                    {/* アルバイト用履歴書の追加フィールド */}
                    {resume?.type === 'resume' && (
                        <div className="card" style={{ marginBottom: 'var(--space-lg)' }}>
                            <h3 style={{ marginBottom: 'var(--space-md)' }}>📝 アルバイト用 追加情報</h3>
                            <div className="grid grid-2">
                                <div className="form-group">
                                    <label className="form-label">通勤時間（時間）</label>
                                    <input className="form-input" type="number" min="0" value={content.commute_hours || ''}
                                        onChange={e => setContent({...content, commute_hours: e.target.value})}
                                        placeholder="例: 1" />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">通勤時間（分）</label>
                                    <input className="form-input" type="number" min="0" max="59" value={content.commute_minutes || ''}
                                        onChange={e => setContent({...content, commute_minutes: e.target.value})}
                                        placeholder="例: 30" />
                                </div>
                            </div>
                            <div className="form-group">
                                <label className="form-label">扶養家族数（配偶者を除く）</label>
                                <input className="form-input" type="number" min="0" value={content.dependents_count || ''}
                                    onChange={e => setContent({...content, dependents_count: e.target.value})}
                                    placeholder="例: 0" />
                            </div>
                            <div className="grid grid-2">
                                <div className="form-group">
                                    <label className="form-label">配偶者</label>
                                    <select className="form-input" value={content.has_spouse || ''}
                                        onChange={e => setContent({...content, has_spouse: e.target.value})}>
                                        <option value="">選択してください</option>
                                        <option value="yes">有</option>
                                        <option value="no">無</option>
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label className="form-label">配偶者の扶養義務</label>
                                    <select className="form-input" value={content.spouse_support || ''}
                                        onChange={e => setContent({...content, spouse_support: e.target.value})}>
                                        <option value="">選択してください</option>
                                        <option value="yes">有</option>
                                        <option value="no">無</option>
                                    </select>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* 転職用履歴書の追加フィールド */}
                    {resume?.type === 'career_resume' && (
                        <div className="card" style={{ marginBottom: 'var(--space-lg)' }}>
                            <h3 style={{ marginBottom: 'var(--space-md)' }}>📋 転職用 追加情報</h3>
                            <div className="form-group">
                                <label className="form-label">職務要約</label>
                                <textarea className="form-textarea" rows={4} value={content.career_summary || ''}
                                    onChange={e => setContent({...content, career_summary: e.target.value})}
                                    placeholder="これまでのキャリアを3〜5行で要約してください" />
                            </div>
                            <div className="grid grid-2">
                                <div className="form-group">
                                    <label className="form-label">現在の就業状況</label>
                                    <select className="form-input" value={content.employment_status || ''}
                                        onChange={e => setContent({...content, employment_status: e.target.value})}>
                                        <option value="">選択してください</option>
                                        <option value="employed">在職中</option>
                                        <option value="unemployed">離職中</option>
                                        <option value="freelance">フリーランス</option>
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label className="form-label">転職回数</label>
                                    <input className="form-input" type="number" min="0" value={content.job_change_count || ''}
                                        onChange={e => setContent({...content, job_change_count: e.target.value})}
                                        placeholder="例: 2" />
                                </div>
                            </div>
                            <div className="form-group">
                                <label className="form-label">退職理由</label>
                                <textarea className="form-textarea" rows={3} value={content.reason_for_leaving || ''}
                                    onChange={e => setContent({...content, reason_for_leaving: e.target.value})}
                                    placeholder="前職（現職）の退職理由" />
                            </div>
                            <div className="grid grid-2">
                                <div className="form-group">
                                    <label className="form-label">希望業界</label>
                                    <input className="form-input" value={content.desired_industry || ''}
                                        onChange={e => setContent({...content, desired_industry: e.target.value})}
                                        placeholder="例: IT・通信" />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">希望職種</label>
                                    <input className="form-input" value={content.desired_position || ''}
                                        onChange={e => setContent({...content, desired_position: e.target.value})}
                                        placeholder="例: フロントエンドエンジニア" />
                                </div>
                            </div>
                        </div>
                    )}

                    {/* 職務経歴書の追加フィールド */}
                    {resume?.type === 'cv' && (
                        <div className="card" style={{ marginBottom: 'var(--space-lg)' }}>
                            <h3 style={{ marginBottom: 'var(--space-md)' }}>📊 職務経歴書 詳細</h3>
                            <div className="form-group">
                                <label className="form-label">職務要約</label>
                                <textarea className="form-textarea" rows={4} value={content.career_summary || ''}
                                    onChange={e => setContent({...content, career_summary: e.target.value})}
                                    placeholder="これまでのキャリア全体を簡潔に要約してください" />
                            </div>
                            <div className="form-group">
                                <label className="form-label">テクニカルスキル</label>
                                <textarea className="form-textarea" rows={3} value={content.technical_skills || ''}
                                    onChange={e => setContent({...content, technical_skills: e.target.value})}
                                    placeholder="例: JavaScript / TypeScript / React / Node.js / AWS" />
                            </div>

                            <div className="form-group">
                                <label className="form-label">実績・受賞歴</label>
                                <textarea className="form-textarea" rows={3} value={content.achievements || ''}
                                    onChange={e => setContent({...content, achievements: e.target.value})}
                                    placeholder="例: 売上前年比150%達成、社内MVP受賞 など" />
                            </div>
                            <div className="form-group">
                                <label className="form-label">マネジメント経験</label>
                                <textarea className="form-textarea" rows={2} value={content.management_experience || ''}
                                    onChange={e => setContent({...content, management_experience: e.target.value})}
                                    placeholder="例: チームリーダーとして5名のメンバーを管理" />
                            </div>
                        </div>
                    )}

                    {/* 親プロフィール参照 */}
                    {resume?.profile && (
                        <div className="card" style={{ opacity: 0.9, marginBottom: 'var(--space-lg)' }}>
                            <h3 style={{ marginBottom: 'var(--space-md)', color: 'var(--color-text-secondary)' }}>
                                👤 親プロフィール（自動参照）
                            </h3>
                            <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>
                                <p><strong>氏名:</strong> {resume.profile.full_name || '未入力'}</p>
                                <p><strong>学歴:</strong> {resume.profile.education?.length || 0}件</p>
                                <p><strong>職歴:</strong> {resume.profile.work_history?.length || 0}件</p>
                                <p><strong>スキル:</strong> {resume.profile.skills?.join(', ') || '未入力'}</p>
                                <p style={{ marginTop: 'var(--space-sm)', fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
                                    ※ 親プロフィールは<a href="/profile" style={{ color: 'var(--color-accent)' }}>プロフィールページ</a>で編集できます
                                </p>
                            </div>
                        </div>
                    )}

                    {/* この履歴書専用の追加データ */}
                    <div className="card" style={{ marginBottom: 'var(--space-lg)' }}>
                        <h3 style={{ marginBottom: 'var(--space-md)' }}>📎 この履歴書専用の追加データ</h3>
                        <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', marginBottom: 'var(--space-md)' }}>
                            プロフィールの学歴・職歴・資格に加えて、この履歴書だけに追加したい項目を入力できます。
                        </p>

                        {/* 追加職歴 */}
                        <div style={{ marginBottom: 'var(--space-lg)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-sm)' }}>
                                <label className="form-label" style={{ margin: 0, fontWeight: 600 }}>追加職歴</label>
                                <button className="btn btn-secondary" style={{ fontSize: 'var(--font-size-xs)' }}
                                    onClick={() => setContent({...content, extra_work_history: [...(content.extra_work_history || []), { company: '', position: '', start_date: '', end_date: '', description: '' }]})}>
                                    ＋ 追加
                                </button>
                            </div>
                            {(content.extra_work_history || []).length === 0 && (
                                <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--font-size-xs)' }}>プロフィールの職歴に追加したい項目がある場合に使用します</p>
                            )}
                            {(content.extra_work_history || []).map((wh, i) => (
                                <div key={i} style={{ padding: 'var(--space-md)', background: 'var(--color-bg-surface)', borderRadius: 'var(--radius-md)', marginBottom: 'var(--space-sm)', position: 'relative' }}>
                                    <button onClick={() => {
                                        const arr = [...(content.extra_work_history || [])]; arr.splice(i, 1);
                                        setContent({...content, extra_work_history: arr});
                                    }} style={{ position: 'absolute', top: 8, right: 8, background: 'none', border: 'none', color: '#f87171', cursor: 'pointer', fontSize: '1rem' }}>✕</button>
                                    <div className="grid grid-2">
                                        <div className="form-group" style={{ marginBottom: 'var(--space-xs)' }}>
                                            <input className="form-input" placeholder="会社名" value={wh.company || ''}
                                                onChange={e => { const arr = [...(content.extra_work_history || [])]; arr[i] = {...arr[i], company: e.target.value}; setContent({...content, extra_work_history: arr}); }} />
                                        </div>
                                        <div className="form-group" style={{ marginBottom: 'var(--space-xs)' }}>
                                            <input className="form-input" placeholder="役職" value={wh.position || ''}
                                                onChange={e => { const arr = [...(content.extra_work_history || [])]; arr[i] = {...arr[i], position: e.target.value}; setContent({...content, extra_work_history: arr}); }} />
                                        </div>
                                        <div className="form-group" style={{ marginBottom: 'var(--space-xs)' }}>
                                            <input type="month" className="form-input" value={wh.start_date || ''}
                                                onChange={e => { const arr = [...(content.extra_work_history || [])]; arr[i] = {...arr[i], start_date: e.target.value}; setContent({...content, extra_work_history: arr}); }} />
                                        </div>
                                        <div className="form-group" style={{ marginBottom: 'var(--space-xs)' }}>
                                            <input type="month" className="form-input" value={wh.end_date || ''}
                                                onChange={e => { const arr = [...(content.extra_work_history || [])]; arr[i] = {...arr[i], end_date: e.target.value}; setContent({...content, extra_work_history: arr}); }} />
                                        </div>
                                    </div>
                                    <div className="form-group" style={{ marginBottom: 'var(--space-sm)' }}>
                                        <textarea className="form-textarea" placeholder="職務内容" value={wh.description || ''} rows={2}
                                            onChange={e => { const arr = [...(content.extra_work_history || [])]; arr[i] = {...arr[i], description: e.target.value}; setContent({...content, extra_work_history: arr}); }} />
                                    </div>
                                    {/* プロジェクト（職歴内） */}
                                    <div style={{ borderTop: '1px dashed var(--color-border)', paddingTop: 'var(--space-sm)' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-xs)' }}>
                                            <label style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600, color: 'var(--color-text-secondary)' }}>プロジェクト</label>
                                            <button className="btn btn-secondary" style={{ fontSize: '11px', padding: '2px 8px' }}
                                                onClick={() => { const arr = [...(content.extra_work_history || [])]; arr[i] = {...arr[i], projects: [...(arr[i].projects || []), { name: '', period: '', role: '', description: '', technologies: '' }]}; setContent({...content, extra_work_history: arr}); }}>
                                                ＋ プロジェクト追加
                                            </button>
                                        </div>
                                        {(wh.projects || []).map((proj, pi) => (
                                            <div key={pi} style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', padding: 'var(--space-sm)', marginBottom: 'var(--space-xs)', position: 'relative' }}>
                                                <button onClick={() => {
                                                    const arr = [...(content.extra_work_history || [])]; const ps = [...(arr[i].projects || [])]; ps.splice(pi, 1); arr[i] = {...arr[i], projects: ps}; setContent({...content, extra_work_history: arr});
                                                }} style={{ position: 'absolute', top: 4, right: 4, background: 'none', border: 'none', color: '#f87171', cursor: 'pointer', fontSize: '12px' }}>✕</button>
                                                <div className="grid grid-2" style={{ marginBottom: 'var(--space-xs)' }}>
                                                    <input className="form-input" style={{ fontSize: '12px' }} placeholder="プロジェクト名" value={proj.name || ''}
                                                        onChange={e => { const arr = [...(content.extra_work_history || [])]; const ps = [...(arr[i].projects || [])]; ps[pi] = {...ps[pi], name: e.target.value}; arr[i] = {...arr[i], projects: ps}; setContent({...content, extra_work_history: arr}); }} />
                                                    <input className="form-input" style={{ fontSize: '12px' }} placeholder="期間 例: 2023年4月〜2024年3月" value={proj.period || ''}
                                                        onChange={e => { const arr = [...(content.extra_work_history || [])]; const ps = [...(arr[i].projects || [])]; ps[pi] = {...ps[pi], period: e.target.value}; arr[i] = {...arr[i], projects: ps}; setContent({...content, extra_work_history: arr}); }} />
                                                </div>
                                                <input className="form-input" style={{ fontSize: '12px', marginBottom: 'var(--space-xs)' }} placeholder="役割 例: フロントエンドリーダー" value={proj.role || ''}
                                                    onChange={e => { const arr = [...(content.extra_work_history || [])]; const ps = [...(arr[i].projects || [])]; ps[pi] = {...ps[pi], role: e.target.value}; arr[i] = {...arr[i], projects: ps}; setContent({...content, extra_work_history: arr}); }} />
                                                <textarea className="form-textarea" style={{ fontSize: '12px', marginBottom: 'var(--space-xs)' }} rows={2} placeholder="業務内容・成果" value={proj.description || ''}
                                                    onChange={e => { const arr = [...(content.extra_work_history || [])]; const ps = [...(arr[i].projects || [])]; ps[pi] = {...ps[pi], description: e.target.value}; arr[i] = {...arr[i], projects: ps}; setContent({...content, extra_work_history: arr}); }} />
                                                <input className="form-input" style={{ fontSize: '12px' }} placeholder="使用技術 例: React, TypeScript, AWS" value={proj.technologies || ''}
                                                    onChange={e => { const arr = [...(content.extra_work_history || [])]; const ps = [...(arr[i].projects || [])]; ps[pi] = {...ps[pi], technologies: e.target.value}; arr[i] = {...arr[i], projects: ps}; setContent({...content, extra_work_history: arr}); }} />
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* 追加学歴 */}
                        <div style={{ marginBottom: 'var(--space-lg)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-sm)' }}>
                                <label className="form-label" style={{ margin: 0, fontWeight: 600 }}>追加学歴</label>
                                <button className="btn btn-secondary" style={{ fontSize: 'var(--font-size-xs)' }}
                                    onClick={() => setContent({...content, extra_education: [...(content.extra_education || []), { school: '', faculty: '', start_date: '', end_date: '' }]})}>
                                    ＋ 追加
                                </button>
                            </div>
                            {(content.extra_education || []).length === 0 && (
                                <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--font-size-xs)' }}>プロフィールの学歴に追加したい項目がある場合に使用します</p>
                            )}
                            {(content.extra_education || []).map((edu, i) => (
                                <div key={i} style={{ padding: 'var(--space-md)', background: 'var(--color-bg-surface)', borderRadius: 'var(--radius-md)', marginBottom: 'var(--space-sm)', position: 'relative' }}>
                                    <button onClick={() => {
                                        const arr = [...(content.extra_education || [])]; arr.splice(i, 1);
                                        setContent({...content, extra_education: arr});
                                    }} style={{ position: 'absolute', top: 8, right: 8, background: 'none', border: 'none', color: '#f87171', cursor: 'pointer', fontSize: '1rem' }}>✕</button>
                                    <div className="grid grid-2">
                                        <div className="form-group" style={{ marginBottom: 'var(--space-xs)' }}>
                                            <input className="form-input" placeholder="学校名" value={edu.school || ''}
                                                onChange={e => { const arr = [...(content.extra_education || [])]; arr[i] = {...arr[i], school: e.target.value}; setContent({...content, extra_education: arr}); }} />
                                        </div>
                                        <div className="form-group" style={{ marginBottom: 'var(--space-xs)' }}>
                                            <input className="form-input" placeholder="学部・学科" value={edu.faculty || ''}
                                                onChange={e => { const arr = [...(content.extra_education || [])]; arr[i] = {...arr[i], faculty: e.target.value}; setContent({...content, extra_education: arr}); }} />
                                        </div>
                                        <div className="form-group" style={{ marginBottom: 0 }}>
                                            <input type="month" className="form-input" value={edu.start_date || ''}
                                                onChange={e => { const arr = [...(content.extra_education || [])]; arr[i] = {...arr[i], start_date: e.target.value}; setContent({...content, extra_education: arr}); }} />
                                        </div>
                                        <div className="form-group" style={{ marginBottom: 0 }}>
                                            <input type="month" className="form-input" value={edu.end_date || ''}
                                                onChange={e => { const arr = [...(content.extra_education || [])]; arr[i] = {...arr[i], end_date: e.target.value}; setContent({...content, extra_education: arr}); }} />
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* 追加資格 */}
                        <div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-sm)' }}>
                                <label className="form-label" style={{ margin: 0, fontWeight: 600 }}>追加免許・資格</label>
                                <button className="btn btn-secondary" style={{ fontSize: 'var(--font-size-xs)' }}
                                    onClick={() => setContent({...content, extra_licenses: [...(content.extra_licenses || []), { name: '', date: '' }]})}>
                                    ＋ 追加
                                </button>
                            </div>
                            {(content.extra_licenses || []).length === 0 && (
                                <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--font-size-xs)' }}>プロフィールの資格に追加したい項目がある場合に使用します</p>
                            )}
                            {(content.extra_licenses || []).map((lic, i) => (
                                <div key={i} style={{ padding: 'var(--space-md)', background: 'var(--color-bg-surface)', borderRadius: 'var(--radius-md)', marginBottom: 'var(--space-sm)', position: 'relative' }}>
                                    <button onClick={() => {
                                        const arr = [...(content.extra_licenses || [])]; arr.splice(i, 1);
                                        setContent({...content, extra_licenses: arr});
                                    }} style={{ position: 'absolute', top: 8, right: 8, background: 'none', border: 'none', color: '#f87171', cursor: 'pointer', fontSize: '1rem' }}>✕</button>
                                    <div className="grid grid-2">
                                        <div className="form-group" style={{ marginBottom: 0 }}>
                                            <input className="form-input" placeholder="資格名" value={lic.name || ''}
                                                onChange={e => { const arr = [...(content.extra_licenses || [])]; arr[i] = {...arr[i], name: e.target.value}; setContent({...content, extra_licenses: arr}); }} />
                                        </div>
                                        <div className="form-group" style={{ marginBottom: 0 }}>
                                            <input type="month" className="form-input" placeholder="取得年月" value={lic.date || ''}
                                                onChange={e => { const arr = [...(content.extra_licenses || [])]; arr[i] = {...arr[i], date: e.target.value}; setContent({...content, extra_licenses: arr}); }} />
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* JIS規格プレビュー Panel */}
                {showPreview && preview && (
                    <div style={{ position: 'sticky', top: 80, alignSelf: 'start' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-sm)' }}>
                            <h3 style={{ color: 'var(--color-text-secondary)' }}>📄 JIS規格 履歴書プレビュー</h3>
                            <button className="btn btn-secondary" onClick={() => setShowPreview(false)} style={{ fontSize: 'var(--font-size-xs)' }}>✕ 閉じる</button>
                        </div>
                        <JisResumePreview data={preview} previewRef={previewRef} />
                    </div>
                )}
            </div>
        </div>
    );
}

/* ── JIS規格 (JIS Z 8303) 履歴書プレビューコンポーネント ── */
function JisResumePreview({ data, previewRef }) {
    const containerRef = useRef(null);
    const [scale, setScale] = useState(1);
    const A4_WIDTH_PX = 794; // 210mm ≈ 794px at 96dpi

    useEffect(() => {
        const updateScale = () => {
            if (containerRef.current) {
                const containerWidth = containerRef.current.offsetWidth - 48; // padding分
                if (containerWidth < A4_WIDTH_PX) {
                    setScale(containerWidth / A4_WIDTH_PX);
                } else {
                    setScale(1);
                }
            }
        };
        updateScale();
        window.addEventListener('resize', updateScale);
        return () => window.removeEventListener('resize', updateScale);
    }, []);

    const isCareer = data.type === 'career_resume';
    const isCv = data.type === 'cv';

    // 安全な日付フォーマット関数
    const formatDate = (dateString, fallback) => {
        if (!dateString) return fallback;
        const d = new Date(dateString);
        return isNaN(d.getTime()) ? fallback : d.toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric' });
    };

    // 年齢計算
    const calcAge = (birthDateStr) => {
        if (!birthDateStr) return null;
        const birth = new Date(birthDateStr);
        if (isNaN(birth.getTime())) return null;
        const today = new Date();
        let age = today.getFullYear() - birth.getFullYear();
        const m = today.getMonth() - birth.getMonth();
        if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
        return age;
    };
    const age = calcAge(data.birth_date);

    // 右上の履歴書作成日（凍結データがなければ現在日時）
    const dateStr = formatDate(data.snapshot_at || new Date(), '　　年　 月　 日');

    // 学歴・職歴の行データ生成
    const eduWorkRows = [];
    if (data.education && data.education.length > 0) {
        eduWorkRows.push({ center: '学　歴' });
        data.education.forEach(e => {
            if (e.start_date || e.start) eduWorkRows.push({ year: (e.start_date || e.start).substring(0,4), month: (e.start_date || e.start).substring(5,7), text: `${e.school} ${e.faculty} 入学` });
            if (e.end_date || e.end) eduWorkRows.push({ year: (e.end_date || e.end).substring(0,4), month: (e.end_date || e.end).substring(5,7), text: `${e.school} ${e.faculty} 卒業` });
        });
    }
    if (data.work_history && data.work_history.length > 0) {
        if (eduWorkRows.length > 0) eduWorkRows.push({ text: '' }); // 空行
        eduWorkRows.push({ center: '職　歴' });
        data.work_history.forEach(w => {
            if (w.start_date || w.start) eduWorkRows.push({ year: (w.start_date || w.start).substring(0,4), month: (w.start_date || w.start).substring(5,7), text: `${w.company} 入社` });
            if (w.position) eduWorkRows.push({ text: `  (配属: ${w.position})` });
            if (w.end_date || w.end) eduWorkRows.push({ year: (w.end_date || w.end).substring(0,4), month: (w.end_date || w.end).substring(5,7), text: `${w.company} 退社` });
            else eduWorkRows.push({ text: '  現在に至る' });
        });
        eduWorkRows.push({ right: '以　上' });
    }

    // ページ1の行数（転職用は連絡先セクションが大きいので少なめ）
    const maxPage1Rows = 16;
    const p1Rows = eduWorkRows.slice(0, maxPage1Rows);
    while (p1Rows.length < maxPage1Rows) p1Rows.push({});

    // ページ2上部の学歴・職歴続き行（はみ出し分）
    const maxPage2EduRows = 7;
    const p2EduRows = eduWorkRows.length > maxPage1Rows ? eduWorkRows.slice(maxPage1Rows) : [];
    while (p2EduRows.length < maxPage2EduRows) p2EduRows.push({});

    // 免許・資格の行データ生成
    const licenseRows = [];
    if (data.licenses && data.licenses.length > 0) {
        data.licenses.forEach(l => {
            const y = l.date ? l.date.substring(0,4) : '';
            const m = l.date ? l.date.substring(5,7) : '';
            licenseRows.push({ year: y, month: m, text: l.name });
        });
    }
    if (licenseRows.length === 0) {
        licenseRows.push({ text: 'なし' });
    }
    const maxLicenseRows = 8;
    while (licenseRows.length < maxLicenseRows) licenseRows.push({});

    const pageStyle = {
        background: '#fff', color: '#000', margin: '0 auto 24px auto',
        width: '210mm', height: '297mm', // A4 size
        padding: '15mm', boxSizing: 'border-box',
        fontFamily: '"MS Mincho", "Yu Mincho", "Hiragino Mincho ProN", serif',
        fontSize: '13px', lineHeight: 1.4,
        boxShadow: '0 2px 10px rgba(0,0,0,0.2)', position: 'relative',
        display: 'flex', flexDirection: 'column'
    };

    const border = '1px solid currentColor';
    const cellPad = '4px 8px';

    // 学歴・職歴行レンダリング共通関数
    const renderEduWorkRow = (r, i, prefix) => (
        <div key={prefix + i} style={{ display: 'flex', borderBottom: '1px dotted currentColor', minHeight: '28px', flex: 1 }}>
            <div style={{ width: '40px', borderRight: '1px dotted currentColor', textAlign: 'center', padding: '4px 0' }}>{r.year || '　'}</div>
            <div style={{ width: '30px', borderRight: border, textAlign: 'center', padding: '4px 0' }}>{r.month || '　'}</div>
            <div style={{ flex: 1, padding: '4px 8px', textAlign: r.center ? 'center' : r.right ? 'right' : 'left' }}>
                {r.center || r.text || r.right || '　'}
            </div>
        </div>
    );

    /* ── 職務経歴書プレビュー（動的ページ分割） ── */
    if (isCv) {
        const workHistory = data.work_history || [];
        const sectionHeaderStyle = { background: '#f5f5f5', padding: '6px 10px', fontSize: '13px', fontWeight: 'bold', borderBottom: border };

        // 行数見積もり（1行≒テキスト70文字相当）
        const estLines = (text) => text ? Math.max(1, Math.ceil(text.length / 70)) : 0;
        const LINES_PER_PAGE = 48;

        // プロジェクトの行数見積もり
        const projLines = (p) => 2 + estLines(p.description) + (p.technologies ? 1 : 0) + (p.role ? 1 : 0);
        // 各職歴エントリの行数見積もり（プロジェクト含む）
        const workEntryLines = (w) => {
            let lines = 3 + estLines(w.description);
            if (w.projects && w.projects.length > 0) {
                for (const p of w.projects) lines += projLines(p);
            }
            return lines;
        };

        // ページ1: ヘッダー(8行) + 職務要約 + 職歴の一部
        const headerLines = 8;
        const summaryLines = 3 + estLines(data.content?.career_summary);
        const workHeaderLines = 2;
        let avail = LINES_PER_PAGE - headerLines - summaryLines - workHeaderLines;

        let page1WorkCount = 0;
        let used = 0;
        for (let i = 0; i < workHistory.length; i++) {
            const el = workEntryLines(workHistory[i]);
            if (used + el > avail && page1WorkCount > 0) break;
            used += el;
            page1WorkCount++;
        }
        const page1Work = workHistory.slice(0, page1WorkCount);
        const remainWork = workHistory.slice(page1WorkCount);

        // 残り職歴を続きページに分割
        const workContPages = [];
        let buf = [], bufLines = 0;
        for (const w of remainWork) {
            const el = workEntryLines(w);
            if (bufLines + el > LINES_PER_PAGE - 3 && buf.length > 0) {
                workContPages.push(buf);
                buf = []; bufLines = 0;
            }
            buf.push(w); bufLines += el;
        }
        if (buf.length > 0) workContPages.push(buf);

        const renderWorkEntry = (w, i, arr) => (
            <div key={i} style={{ padding: '10px', borderBottom: i < arr.length - 1 ? '1px solid #ccc' : 'none', fontSize: '13px', lineHeight: 1.6 }}>
                <div style={{ fontWeight: 'bold', marginBottom: '4px', fontSize: '14px' }}>{w.company}</div>
                <div style={{ fontSize: '12px', color: '#444' }}>
                    {w.start_date || w.start} 〜 {w.end_date || w.end || '現在'}
                    {w.position && `　${w.position}`}
                </div>
                {w.description && <div style={{ marginTop: '4px', fontSize: '12px', whiteSpace: 'pre-wrap' }}>{w.description}</div>}
                {/* プロジェクト（職歴内） */}
                {w.projects && w.projects.length > 0 && (
                    <div style={{ marginTop: '8px', paddingLeft: '12px', borderLeft: '3px solid #ddd' }}>
                        {w.projects.map((p, pi) => (
                            <div key={pi} style={{ marginBottom: pi < w.projects.length - 1 ? '8px' : 0, fontSize: '12px' }}>
                                <div style={{ fontWeight: 'bold' }}>【{p.name}】</div>
                                {p.period && <div style={{ color: '#555' }}>期間: {p.period}</div>}
                                {p.role && <div style={{ color: '#555' }}>役割: {p.role}</div>}
                                {p.description && <div style={{ marginTop: '2px', whiteSpace: 'pre-wrap' }}>{p.description}</div>}
                                {p.technologies && <div style={{ marginTop: '2px', color: '#555' }}>使用技術: {p.technologies}</div>}
                            </div>
                        ))}
                    </div>
                )}
            </div>
        );

        const renderBottomSections = () => (<>
            <div style={{ border }}>
                <div style={sectionHeaderStyle}>テクニカルスキル</div>
                <div style={{ padding: '10px', fontSize: '13px', lineHeight: 1.6, whiteSpace: 'pre-wrap', minHeight: '40px' }}>
                    {data.content?.technical_skills || data.skills?.join('、') || ''}
                </div>
            </div>
            <div style={{ border, borderTop: 'none' }}>
                <div style={sectionHeaderStyle}>免許・資格</div>
                <div style={{ padding: '10px', fontSize: '13px', lineHeight: 1.6, minHeight: '30px' }}>
                    {data.licenses && data.licenses.length > 0
                        ? data.licenses.map((l, i) => <div key={i}>{l.date && `${l.date.substring(0,4)}年${l.date.substring(5,7)}月`} {l.name}</div>)
                        : 'なし'}
                </div>
            </div>
            {data.content?.achievements && (
                <div style={{ border, borderTop: 'none' }}>
                    <div style={sectionHeaderStyle}>実績・受賞歴</div>
                    <div style={{ padding: '10px', fontSize: '13px', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{data.content.achievements}</div>
                </div>
            )}
            <div style={{ border, borderTop: 'none' }}>
                <div style={sectionHeaderStyle}>自己PR</div>
                <div style={{ padding: '10px', fontSize: '13px', lineHeight: 1.6, whiteSpace: 'pre-wrap', minHeight: '40px' }}>
                    {data.self_pr || data.motivation || ''}
                </div>
            </div>
        </>);

        return (
            <div ref={containerRef} style={{ maxHeight: '80vh', overflowY: 'auto', background: '#e0e0e0', padding: '24px', overflowX: 'hidden' }}>
              <div ref={previewRef} style={{ transformOrigin: 'top left', transform: `scale(${scale})`, width: `${100 / scale}%` }}>
                {/* ページ1: ヘッダー + 職務要約 + 職歴（一部） */}
                <div data-pdf-page style={pageStyle}>
                    <h2 style={{ fontSize: '22px', letterSpacing: '8px', margin: 0, fontWeight: 'normal', textAlign: 'center', marginBottom: '16px' }}>職 務 経 歴 書</h2>
                    <div style={{ textAlign: 'right', fontSize: '12px', marginBottom: '12px' }}>{dateStr} 現在</div>
                    <div style={{ textAlign: 'right', fontSize: '14px', marginBottom: '20px' }}>氏名: {data.full_name}</div>
                    <div style={{ border, marginBottom: '0' }}>
                        <div style={sectionHeaderStyle}>職務要約</div>
                        <div style={{ padding: '10px', fontSize: '13px', lineHeight: 1.6, whiteSpace: 'pre-wrap', minHeight: '60px' }}>
                            {data.content?.career_summary || ''}
                        </div>
                    </div>
                    <div style={{ border, borderTop: 'none' }}>
                        <div style={sectionHeaderStyle}>職務経歴</div>
                        {page1Work.length > 0
                            ? page1Work.map((w, i) => renderWorkEntry(w, i, page1Work))
                            : <div style={{ padding: '10px', fontSize: '13px', color: '#999' }}>　</div>}
                    </div>
                </div>

                {/* 職歴続きページ */}
                {workContPages.map((pageWork, pi) => (
                    <div key={`wc_${pi}`} data-pdf-page style={pageStyle}>
                        <div style={{ border }}>
                            <div style={sectionHeaderStyle}>職務経歴（続き）</div>
                            {pageWork.map((w, i) => renderWorkEntry(w, i, pageWork))}
                        </div>
                    </div>
                ))}

                {/* スキル・資格・自己PR等 */}
                <div data-pdf-page style={pageStyle}>
                    {renderBottomSections()}
                </div>
              </div>
            </div>
        );
    }

    return (
        <div ref={containerRef} style={{ maxHeight: '80vh', overflowY: 'auto', background: '#e0e0e0', padding: '24px', overflowX: 'hidden' }}>
          <div ref={previewRef} style={{ transformOrigin: 'top left', transform: `scale(${scale})`, width: `${100 / scale}%` }}>

            {/* --- PAGE 1 --- */}
            <div data-pdf-page style={pageStyle}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '8px' }}>
                    <h2 style={{ fontSize: '24px', letterSpacing: '12px', margin: 0, fontWeight: 'normal' }}>履 歴 書</h2>
                    <div style={{ fontSize: '11px' }}>{dateStr} 現在</div>
                </div>

                {/* 氏名・写真（上部3行）— flexで左右分割 */}
                <div style={{ display: 'flex', border: border }}>
                    {/* 左側: ふりがな・氏名・生年月日 */}
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                        {/* ふりがな */}
                        <div style={{ borderBottom: '1px dotted currentColor', padding: '2px 6px', fontSize: '10px' }}>
                            <span style={{ fontSize: '10px' }}>ふりがな　</span>
                            <span style={{ fontSize: '11px' }}>{data.full_name_kana}</span>
                        </div>
                        {/* 氏名 */}
                        <div style={{ borderBottom: border, padding: '8px 6px', display: 'flex', alignItems: 'center', flex: 2 }}>
                            <span style={{ fontSize: '10px' }}>氏 名　</span>
                            <span style={{ fontSize: '22px', letterSpacing: '4px', paddingLeft: '16px' }}>{data.full_name}</span>
                        </div>
                        {/* 生年月日・性別 */}
                        <div style={{ display: 'flex', flex: 1.6 }}>
                            <div style={{ flex: 1, padding: '8px 6px', display: 'flex', alignItems: 'center', fontSize: '13px' }}>
                                {formatDate(data.birth_date, '　　年　 月　 日')} 生（満 {age !== null ? age : '　'} 歳）
                            </div>
                            <div style={{ width: '16mm', textAlign: 'center', padding: '8px', borderLeft: border, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px' }}>
                                {data.gender === 'male' ? '男' : data.gender === 'female' ? '女' : '男・女'}
                            </div>
                        </div>
                    </div>
                    {/* 右側: 写真 */}
                    <div style={{ width: '30mm', borderLeft: border, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {data.photo_path ? (
                            <img src={`/storage/${data.photo_path}`} alt="写真" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                        ) : (
                            <div style={{ textAlign: 'center', fontSize: '9px', color: '#666', lineHeight: 1.4, padding: '4px' }}>
                                証明写真<br/>縦36〜40mm<br/>横24〜30mm<br/>本人単身胸から上<br/>裏面のりづけ
                            </div>
                        )}
                    </div>
                </div>

                {/* 住所・連絡先 — tableレイアウト */}
                <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed', borderTop: 'none' }}>
                    <colgroup>
                        <col />
                        <col style={{ width: '16mm' }} />
                        <col style={{ width: '30mm' }} />
                    </colgroup>
                    {/* 現住所ふりがな */}
                    <tr>
                        <td style={{ border: border, borderBottom: '1px dotted currentColor', padding: '2px 6px', fontSize: '10px' }}>
                            ふりがな
                        </td>
                        <td rowSpan={2} style={{ border: border, padding: '4px 6px', fontSize: '10px', verticalAlign: 'top' }}>
                            <div>電話</div>
                            <div style={{ fontSize: '12px', marginTop: '2px' }}>{data.phone}</div>
                        </td>
                        <td rowSpan={2} style={{ border: border, padding: '4px 6px', fontSize: '10px', verticalAlign: 'top' }}>
                            <div>Email</div>
                        </td>
                    </tr>
                    {/* 現住所 */}
                    <tr>
                        <td style={{ border: border, padding: '4px 6px', height: '14mm' }}>
                            <div style={{ fontSize: '10px' }}>現住所 〒 {data.postal_code}</div>
                            <div style={{ fontSize: '13px', marginTop: '2px' }}>{data.address}</div>
                        </td>
                    </tr>
                    {/* 連絡先ふりがな */}
                    <tr>
                        <td style={{ border: border, borderBottom: '1px dotted currentColor', padding: '2px 6px', fontSize: '10px' }}>
                            ふりがな
                        </td>
                        <td rowSpan={2} style={{ border: border, padding: '4px 6px', fontSize: '10px', verticalAlign: 'top' }}>
                            <div>電話</div>
                        </td>
                        <td rowSpan={2} style={{ border: border, padding: '4px 6px', fontSize: '10px', verticalAlign: 'top' }}>
                            <div>Email</div>
                        </td>
                    </tr>
                    {/* 連絡先 */}
                    <tr>
                        <td style={{ border: border, padding: '4px 6px', height: '14mm' }}>
                            <div style={{ fontSize: '10px' }}>連絡先 〒（現住所以外に連絡を希望する場合のみ入力）</div>
                        </td>
                    </tr>
                </table>

                {/* 学歴・職歴テーブル */}
                <div style={{ border: border, flex: 1, display: 'flex', flexDirection: 'column' }}>
                    <div style={{ display: 'flex', borderBottom: border, textAlign: 'center', fontSize: '11px', fontWeight: 'bold' }}>
                        <div style={{ width: '40px', borderRight: '1px dotted currentColor', padding: '4px 0' }}>年</div>
                        <div style={{ width: '30px', borderRight: border, padding: '4px 0' }}>月</div>
                        <div style={{ flex: 1, padding: '4px 0' }}>学歴・職歴</div>
                    </div>
                    {p1Rows.map((r, i) => renderEduWorkRow(r, i, 'p1_'))}
                </div>
            </div>

            {/* --- PAGE 2 --- */}
            <div data-pdf-page style={pageStyle}>
                {/* 転職用のみ: 学歴・職歴の続き */}
                {isCareer && (
                    <div style={{ border: border, marginBottom: '0', display: 'flex', flexDirection: 'column' }}>
                        <div style={{ display: 'flex', borderBottom: border, textAlign: 'center', fontSize: '11px', fontWeight: 'bold' }}>
                            <div style={{ width: '40px', borderRight: '1px dotted currentColor', padding: '4px 0' }}>年</div>
                            <div style={{ width: '30px', borderRight: border, padding: '4px 0' }}>月</div>
                            <div style={{ flex: 1, padding: '4px 0' }}>学歴・職歴</div>
                        </div>
                        {p2EduRows.map((r, i) => renderEduWorkRow(r, i, 'p2_edu_'))}
                    </div>
                )}

                {/* 免許・資格 */}
                <div style={{ border: border, borderTop: isCareer ? 'none' : border }}>
                    <div style={{ display: 'flex', borderBottom: border, textAlign: 'center', fontSize: '11px', fontWeight: 'bold' }}>
                        <div style={{ width: '40px', borderRight: '1px dotted currentColor', padding: '4px 0' }}>年</div>
                        <div style={{ width: '30px', borderRight: border, padding: '4px 0' }}>月</div>
                        <div style={{ flex: 1, padding: '4px 0' }}>免許・資格</div>
                    </div>
                    {licenseRows.map((r, i) => (
                        <div key={'p2_lic_'+i} style={{ display: 'flex', borderBottom: i === maxLicenseRows-1 ? 'none' : '1px dotted currentColor', minHeight: '28px' }}>
                            <div style={{ width: '40px', borderRight: '1px dotted currentColor', textAlign: 'center', padding: '4px 0' }}>{r.year || '　'}</div>
                            <div style={{ width: '30px', borderRight: border, textAlign: 'center', padding: '4px 0' }}>{r.month || '　'}</div>
                            <div style={{ flex: 1, padding: '4px 8px' }}>{r.text || '　'}</div>
                        </div>
                    ))}
                </div>

                {/* 志望動機 + 右側情報 */}
                <div style={{ display: 'flex', border: border, borderTop: 'none', flex: 1 }}>
                    <div style={{ flex: 1, borderRight: isCareer ? 'none' : border, padding: '10px', display: 'flex', flexDirection: 'column' }}>
                        <div style={{ fontSize: '11px', marginBottom: '6px' }}>志望動機・特技・アピールポイントなど</div>
                        <div style={{ flex: 1, whiteSpace: 'pre-wrap', fontSize: '13px', lineHeight: 1.6 }}>
                            {data.motivation}
                            {data.content?.career_summary && `\n\n【職務要約】\n${data.content.career_summary}`}
                            {data.skills?.length > 0 && `\n\n【スキル・得意分野】\n${data.skills.join('、')}`}
                            {data.self_pr && `\n\n【自己PR】\n${data.self_pr}`}
                        </div>
                    </div>
                    {!isCareer && (
                        <div style={{ width: '55mm', display: 'flex', flexDirection: 'column' }}>
                            <div style={{ borderBottom: border, padding: '6px 8px', flex: 1.2, display: 'flex', flexDirection: 'column' }}>
                                <div style={{ fontSize: '10px' }}>通勤時間</div>
                                <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', paddingRight: '8px', fontSize: '13px' }}>
                                    約 {data.content?.commute_hours || '　'} 時間 {data.content?.commute_minutes || '　'} 分
                                </div>
                            </div>
                            <div style={{ borderBottom: border, padding: '6px 8px', flex: 1.2, display: 'flex', flexDirection: 'column' }}>
                                <div style={{ fontSize: '10px' }}>扶養家族数（配偶者を除く）</div>
                                <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', paddingRight: '8px', fontSize: '13px' }}>
                                    {data.content?.dependents_count ?? '　'} 人
                                </div>
                            </div>
                            <div style={{ display: 'flex', flex: 0.8 }}>
                                <div style={{ flex: 1, borderRight: border, padding: '6px 8px', display: 'flex', flexDirection: 'column' }}>
                                    <div style={{ fontSize: '10px', marginBottom: '4px' }}>配偶者</div>
                                    <div style={{ flex: 1, fontSize: '13px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                        {data.content?.has_spouse === 'yes' ? <><u>有</u> ・ 無</> : data.content?.has_spouse === 'no' ? <>有 ・ <u>無</u></> : '有 ・ 無'}
                                    </div>
                                </div>
                                <div style={{ flex: 1, padding: '6px 8px', display: 'flex', flexDirection: 'column' }}>
                                    <div style={{ fontSize: '10px', marginBottom: '4px' }}>配偶者の扶養義務</div>
                                    <div style={{ flex: 1, fontSize: '13px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                        {data.content?.spouse_support === 'yes' ? <><u>有</u> ・ 無</> : data.content?.spouse_support === 'no' ? <>有 ・ <u>無</u></> : '有 ・ 無'}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* 本人希望欄 */}
                <div style={{ border: border, borderTop: 'none', flex: 0.6, padding: '10px', display: 'flex', flexDirection: 'column' }}>
                    <div style={{ fontSize: '11px', marginBottom: '6px' }}>本人希望欄（特に給料・職種・勤務時間・勤務地・その他について希望があれば記入）</div>
                    <div style={{ flex: 1, fontSize: '13px', lineHeight: 1.6 }}>
                        {data.desired_salary && <div>【希望給与】 {data.desired_salary}</div>}
                        {data.desired_location && <div>【希望勤務地】 {data.desired_location}</div>}
                        {data.available_date && <div>【入社可能日】 {formatDate(data.available_date, '')}</div>}
                        {data.content?.desired_industry && <div>【希望業界】 {data.content.desired_industry}</div>}
                        {data.content?.desired_position && <div>【希望職種】 {data.content.desired_position}</div>}
                    </div>
                </div>

            </div>
          </div>
        </div>
    );
}

