import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../api';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import { useToast } from '../hooks/useToast';
import ConfirmDialog from '../components/ConfirmDialog';
import { FileText, ClipboardList, BarChart3, Mail, BookmarkCheck, Bell, Eye, Download, CheckCircle2 } from 'lucide-react';

const RESUME_TYPES = [
    { key: 'resume', label: 'アルバイト用履歴書', icon: FileText, description: 'アルバイト・パート応募向け' },
    { key: 'career_resume', label: '転職用履歴書', icon: ClipboardList, description: '正社員・転職応募向け' },
    { key: 'cv', label: '職務経歴書', icon: BarChart3, description: '詳細な職務経歴・実績をまとめる書類' },
];

const TYPE_LABELS = { resume: 'アルバイト用', career_resume: '転職用履歴書', cv: '職務経歴書' };
const TYPE_BADGE_CLASS = { resume: 'badge-info', career_resume: 'badge-success', cv: 'badge-warning' };

export default function ResumeListPage() {
    const [resumes, setResumes] = useState([]);
    const [loading, setLoading] = useState(true);
    const [creating, setCreating] = useState(false);
    const [showTypeSelector, setShowTypeSelector] = useState(false);
    const [previewData, setPreviewData] = useState(null);
    const [previewResumeId, setPreviewResumeId] = useState(null);
    const [downloadingId, setDownloadingId] = useState(null);
    const [defaultResumeId, setDefaultResumeId] = useState(() => {
        const stored = localStorage.getItem('default_resume_id');
        return stored ? Number(stored) : null;
    });
    const previewRef = useRef(null);
    const navigate = useNavigate();
    const toast = useToast();
    const [confirmDialog, setConfirmDialog] = useState(null);

    useEffect(() => {
        fetchResumes();
    }, []);

    const fetchResumes = async () => {
        try {
            const res = await api.get('/resumes');
            setResumes(res.data.resumes || []);
        } finally {
            setLoading(false);
        }
    };

    const createResume = async (type = 'resume') => {
        setCreating(true);
        setShowTypeSelector(false);
        const typeLabel = TYPE_LABELS[type] || '履歴書';
        try {
            const res = await api.post('/resumes', {
                title: `${typeLabel} ${resumes.length + 1}`,
                type,
            });
            navigate(`/resumes/${res.data.resume.id}`);
        } catch (err) {
            const msg = err.response?.data?.message || '作成に失敗しました';
            if (msg.includes('プロフィール')) {
                setConfirmDialog({
                    title: 'プロフィール登録が必要です',
                    message: '履歴書を作成するには、先にプロフィールを登録する必要があります。\nプロフィールページに移動しますか？',
                    confirmText: '移動する',
                    onConfirm: () => { setConfirmDialog(null); navigate('/profile'); },
                    onCancel: () => setConfirmDialog(null),
                });
            } else {
                toast.error(msg);
            }
        } finally {
            setCreating(false);
        }
    };

    const duplicateResume = async (id) => {
        try {
            const res = await api.post(`/resumes/${id}/duplicate`);
            setResumes([res.data.resume, ...resumes]);
        } catch (err) {
            toast.error('複製に失敗しました');
        }
    };

    const createCvFromResume = async (id) => {
        try {
            const res = await api.post(`/resumes/${id}/to-cv`);
            navigate(`/resumes/${res.data.resume.id}`);
        } catch (err) {
            toast.error(err.response?.data?.message || '職務経歴書の作成に失敗しました');
        }
    };

    const handleSetDefault = (id) => {
        if (defaultResumeId === id) {
            localStorage.removeItem('default_resume_id');
            setDefaultResumeId(null);
        } else {
            localStorage.setItem('default_resume_id', String(id));
            setDefaultResumeId(id);
        }
    };

    const deleteResume = (id) => {
        setConfirmDialog({
            title: '履歴書の削除',
            message: 'この履歴書を削除しますか？',
            confirmText: '削除',
            onConfirm: async () => {
                setConfirmDialog(null);
                try {
                    await api.delete(`/resumes/${id}`);
                    setResumes(resumes.filter(r => r.id !== id));
                    if (defaultResumeId === id) {
                        localStorage.removeItem('default_resume_id');
                        setDefaultResumeId(null);
                    }
                } catch (err) {
                    toast.error('削除に失敗しました');
                }
            },
            onCancel: () => setConfirmDialog(null),
        });
    };

    const handlePreview = async (id) => {
        if (previewResumeId === id) {
            setPreviewData(null);
            setPreviewResumeId(null);
            return;
        }
        try {
            const res = await api.get(`/resumes/${id}/preview`);
            setPreviewData(res.data.snapshot);
            setPreviewResumeId(id);
        } catch (err) {
            toast.error('プレビューの取得に失敗しました');
        }
    };

    const handleDownload = useCallback(async (id) => {
        setDownloadingId(id);
        try {
            const res = await api.get(`/resumes/${id}/preview`);
            const snapshot = res.data.snapshot;
            setPreviewData(snapshot);
            setPreviewResumeId(id);

            // Wait for DOM render
            await new Promise(r => setTimeout(r, 300));

            if (!previewRef.current) {
                toast.error('プレビューの生成に失敗しました');
                return;
            }

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

            const resume = resumes.find(r => r.id === id);
            const typeLabel = TYPE_LABELS[resume?.type] || '履歴書';
            const fileName = `${resume?.title || typeLabel}_${new Date().toISOString().slice(0,10)}.pdf`;
            pdf.save(fileName);
        } catch (err) {
            console.error('PDF generation failed:', err);
            toast.error('PDFの生成に失敗しました');
        } finally {
            setDownloadingId(null);
        }
    }, [resumes]);

    if (loading) return <div className="page container"><div className="skeleton" style={{ height: 300 }} /></div>;

    return (
        <div className="page container animate-fade-in">
            {/* スカウト活用バナー */}
            {resumes.length > 0 && !defaultResumeId && (
                <div style={{
                    background: 'linear-gradient(135deg, rgba(200,149,46,0.12), rgba(200,149,46,0.06))',
                    border: '1px solid rgba(200,149,46,0.3)',
                    borderRadius: 'var(--radius-md)',
                    padding: 'var(--space-md) var(--space-lg)',
                    marginBottom: 'var(--space-lg)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 'var(--space-md)',
                    flexWrap: 'wrap',
                }}>
                    <Mail size={24} strokeWidth={2} color="var(--color-text-accent)" style={{ flexShrink: 0 }} />
                    <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 600, marginBottom: 2, color: 'var(--color-text-accent)' }}>
                            スカウトを受け取る準備ができています
                        </div>
                        <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>
                            「デフォルト設定」した履歴書は応募時に自動選択され、企業からのスカウトにも活用されます。
                        </div>
                    </div>
                    <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', background: 'rgba(200,149,46,0.1)', padding: '4px 10px', borderRadius: 'var(--radius-full)', whiteSpace: 'nowrap', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                        <BookmarkCheck size={14} strokeWidth={2} color="var(--color-text-accent)" /> マークでデフォルト設定
                    </div>
                </div>
            )}
            {resumes.length > 0 && defaultResumeId && (
                <div style={{
                    background: 'rgba(52,199,89,0.08)',
                    border: '1px solid rgba(52,199,89,0.25)',
                    borderRadius: 'var(--radius-md)',
                    padding: 'var(--space-sm) var(--space-lg)',
                    marginBottom: 'var(--space-lg)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 'var(--space-sm)',
                    fontSize: 'var(--font-size-sm)',
                    color: 'var(--color-success)',
                }}>
                    <CheckCircle2 size={16} strokeWidth={2} style={{ flexShrink: 0 }} />
                    デフォルト履歴書が設定されています。スカウト受信・応募時に自動使用されます。
                </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-xl)' }}>
                <h1 style={{ fontSize: 'var(--font-size-3xl)', color: 'var(--color-navy)' }}>履歴書一覧</h1>
                <div style={{ position: 'relative' }}>
                    <button className="btn btn-primary" onClick={() => setShowTypeSelector(!showTypeSelector)} disabled={creating}>
                        {creating ? '作成中...' : '＋ 新規作成'}
                    </button>
                    {showTypeSelector && (
                        <div className="card" style={{
                            position: 'absolute', right: 0, top: '100%', marginTop: 8, zIndex: 100,
                            width: 320, padding: 0, boxShadow: '0 8px 30px rgba(0,0,0,0.15)',
                        }}>
                            {RESUME_TYPES.map(t => (
                                <button key={t.key} onClick={() => createResume(t.key)} style={{
                                    display: 'flex', alignItems: 'center', gap: 12, width: '100%', padding: '14px 16px',
                                    border: 'none', background: 'none', cursor: 'pointer', textAlign: 'left',
                                    borderBottom: '1px solid var(--color-border)', fontSize: 'var(--font-size-sm)',
                                }}
                                onMouseEnter={e => e.currentTarget.style.background = 'var(--color-bg-surface)'}
                                onMouseLeave={e => e.currentTarget.style.background = 'none'}
                                >
                                    <t.icon size={22} strokeWidth={2} color="var(--color-text-accent)" style={{ flexShrink: 0 }} />
                                    <div>
                                        <div style={{ fontWeight: 600 }}>{t.label}</div>
                                        <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', marginTop: 2 }}>{t.description}</div>
                                    </div>
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {resumes.length === 0 ? (
                <div className="card" style={{ textAlign: 'center', padding: 'var(--space-3xl)' }}>
                    <div style={{ marginBottom: 'var(--space-md)', display: 'flex', justifyContent: 'center' }}>
                        <FileText size={48} strokeWidth={1.5} color="var(--color-text-accent)" />
                    </div>
                    <h3 style={{ marginBottom: 'var(--space-sm)', color: 'var(--color-navy)' }}>履歴書がありません</h3>
                    <p style={{ color: 'var(--color-text-secondary)', marginBottom: 'var(--space-lg)' }}>
                        親プロフィールから子履歴書をワンタップで作成できます
                    </p>
                    <div style={{ display: 'flex', gap: 'var(--space-md)', justifyContent: 'center', flexWrap: 'wrap' }}>
                        {RESUME_TYPES.map(t => (
                            <button key={t.key} className="btn btn-primary" onClick={() => createResume(t.key)} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                                <t.icon size={16} strokeWidth={2} /> {t.label}を作成
                            </button>
                        ))}
                    </div>
                </div>
            ) : (
                <div className="grid grid-2">
                    {resumes.map(resume => (
                        <div key={resume.id} className="card card-glow">
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                <div>
                                    <h3 style={{ marginBottom: 'var(--space-xs)', color: 'var(--color-navy)' }}>{resume.title}</h3>
                                    <div style={{ display: 'flex', gap: 'var(--space-xs)', alignItems: 'center', marginBottom: 'var(--space-xs)' }}>
                                        <span className={`badge ${TYPE_BADGE_CLASS[resume.type] || 'badge-info'}`}>
                                            {TYPE_LABELS[resume.type] || 'アルバイト用'}
                                        </span>
                                        {defaultResumeId === resume.id && <span className="badge badge-success" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><BookmarkCheck size={12} strokeWidth={2} /> デフォルト</span>}
                                        {resume.scout_enabled && <span className="badge badge-info" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><Bell size={12} strokeWidth={2} /> スカウトON</span>}
                                    </div>
                                    <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
                                        更新: {new Date(resume.updated_at).toLocaleDateString('ja-JP')}
                                    </p>
                                </div>
                            </div>
                            {resume.motivation && (
                                <p style={{ marginTop: 'var(--space-sm)', fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>
                                    {resume.motivation.substring(0, 80)}...
                                </p>
                            )}
                            <div style={{ display: 'flex', gap: 'var(--space-sm)', marginTop: 'var(--space-md)', flexWrap: 'wrap' }}>
                                <Link to={`/resumes/${resume.id}`} className="btn btn-primary" style={{ fontSize: 'var(--font-size-xs)' }}>編集</Link>
                                <button className="btn btn-secondary" style={{ fontSize: 'var(--font-size-xs)', display: 'inline-flex', alignItems: 'center', gap: 4 }} onClick={() => handlePreview(resume.id)}>
                                    {previewResumeId === resume.id ? '✕ 閉じる' : <><Eye size={14} strokeWidth={2} /> プレビュー</>}
                                </button>
                                <button className="btn btn-secondary" style={{ fontSize: 'var(--font-size-xs)', display: 'inline-flex', alignItems: 'center', gap: 4 }}
                                    onClick={() => handleDownload(resume.id)} disabled={downloadingId === resume.id}>
                                    {downloadingId === resume.id ? '生成中...' : <><Download size={14} strokeWidth={2} /> PDF</>}
                                </button>
                                <button className="btn btn-secondary" style={{ fontSize: 'var(--font-size-xs)' }} onClick={() => duplicateResume(resume.id)}>複製</button>
                                {resume.type !== 'cv' && (
                                    <button className="btn btn-secondary" style={{ fontSize: 'var(--font-size-xs)' }} onClick={() => createCvFromResume(resume.id)}>職務経歴書化</button>
                                )}
                                <button
                                    className={defaultResumeId === resume.id ? 'btn btn-primary' : 'btn btn-secondary'}
                                    style={{ fontSize: 'var(--font-size-xs)', display: 'inline-flex', alignItems: 'center', gap: 4 }}
                                    onClick={() => handleSetDefault(resume.id)}>
                                    {defaultResumeId === resume.id ? <><BookmarkCheck size={14} strokeWidth={2} /> デフォルト</> : 'デフォルトに設定'}
                                </button>
                                <button className="btn btn-danger" style={{ fontSize: 'var(--font-size-xs)' }} onClick={() => deleteResume(resume.id)}>削除</button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* プレビューモーダル */}
            {previewData && previewResumeId && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    background: 'rgba(0,0,0,0.6)', zIndex: 1000,
                    display: 'flex', justifyContent: 'center', alignItems: 'flex-start',
                    padding: '40px 20px', overflowY: 'auto',
                }} onClick={(e) => { if (e.target === e.currentTarget) { setPreviewData(null); setPreviewResumeId(null); } }}>
                    <div style={{ position: 'relative', maxWidth: '850px', width: '100%' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-md)' }}>
                            <h3 style={{ color: '#fff', margin: 0, display: 'inline-flex', alignItems: 'center', gap: 8 }}><FileText size={18} strokeWidth={2} /> プレビュー</h3>
                            <div style={{ display: 'flex', gap: 'var(--space-sm)' }}>
                                <button className="btn btn-secondary" onClick={() => handleDownload(previewResumeId)}
                                    disabled={downloadingId === previewResumeId} style={{ fontSize: 'var(--font-size-sm)', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                                    {downloadingId === previewResumeId ? '生成中...' : <><Download size={16} strokeWidth={2} /> PDFダウンロード</>}
                                </button>
                                <button className="btn btn-secondary" onClick={() => { setPreviewData(null); setPreviewResumeId(null); }}
                                    style={{ fontSize: 'var(--font-size-sm)' }}>✕ 閉じる</button>
                            </div>
                        </div>
                        <JisResumePreviewMini data={previewData} previewRef={previewRef} />
                    </div>
                </div>
            )}

            {confirmDialog && <ConfirmDialog {...confirmDialog} />}
        </div>
    );
}

/* ── JIS規格 履歴書プレビュー（一覧用） ── */
function JisResumePreviewMini({ data, previewRef }) {
    const isCareer = data.type === 'career_resume';
    const isCv = data.type === 'cv';

    const formatDate = (dateString, fallback) => {
        if (!dateString) return fallback;
        const d = new Date(dateString);
        return isNaN(d.getTime()) ? fallback : d.toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric' });
    };

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
    const dateStr = formatDate(data.snapshot_at || new Date(), '　　年　 月　 日');

    const eduWorkRows = [];
    if (data.education && data.education.length > 0) {
        eduWorkRows.push({ center: '学　歴' });
        data.education.forEach(e => {
            if (e.start_date || e.start) eduWorkRows.push({ year: (e.start_date || e.start).substring(0,4), month: (e.start_date || e.start).substring(5,7), text: `${e.school} ${e.faculty} 入学` });
            if (e.end_date || e.end) eduWorkRows.push({ year: (e.end_date || e.end).substring(0,4), month: (e.end_date || e.end).substring(5,7), text: `${e.school} ${e.faculty} 卒業` });
        });
    }
    if (data.work_history && data.work_history.length > 0) {
        if (eduWorkRows.length > 0) eduWorkRows.push({ text: '' });
        eduWorkRows.push({ center: '職　歴' });
        data.work_history.forEach(w => {
            if (w.start_date || w.start) eduWorkRows.push({ year: (w.start_date || w.start).substring(0,4), month: (w.start_date || w.start).substring(5,7), text: `${w.company} 入社` });
            if (w.position) eduWorkRows.push({ text: `  (配属: ${w.position})` });
            if (w.end_date || w.end) eduWorkRows.push({ year: (w.end_date || w.end).substring(0,4), month: (w.end_date || w.end).substring(5,7), text: `${w.company} 退社` });
            else eduWorkRows.push({ text: '  現在に至る' });
        });
        eduWorkRows.push({ right: '以　上' });
    }

    const maxPage1Rows = 16;
    const p1Rows = eduWorkRows.slice(0, maxPage1Rows);
    while (p1Rows.length < maxPage1Rows) p1Rows.push({});

    const maxPage2EduRows = 7;
    const p2EduRows = eduWorkRows.length > maxPage1Rows ? eduWorkRows.slice(maxPage1Rows) : [];
    while (p2EduRows.length < maxPage2EduRows) p2EduRows.push({});

    const licenseRows = [];
    if (data.licenses && data.licenses.length > 0) {
        data.licenses.forEach(l => {
            const y = l.date ? l.date.substring(0,4) : '';
            const m = l.date ? l.date.substring(5,7) : '';
            licenseRows.push({ year: y, month: m, text: l.name });
        });
    }
    if (licenseRows.length === 0) licenseRows.push({ text: 'なし' });
    const maxLicenseRows = 8;
    while (licenseRows.length < maxLicenseRows) licenseRows.push({});

    const pageStyle = {
        background: '#fff', color: '#000', margin: '0 auto 24px auto',
        width: '210mm', height: '297mm',
        padding: '15mm', boxSizing: 'border-box',
        fontFamily: '"MS Mincho", "Yu Mincho", "Hiragino Mincho ProN", serif',
        fontSize: '13px', lineHeight: 1.4,
        boxShadow: '0 2px 10px rgba(0,0,0,0.2)', position: 'relative',
        display: 'flex', flexDirection: 'column'
    };

    const border = '1px solid currentColor';
    const cellPad = '4px 8px';

    /* ── 職務経歴書プレビュー（動的ページ分割） ── */
    if (isCv) {
        const workHistory = data.work_history || [];
        const sectionHeaderStyle = { background: '#f5f5f5', padding: '6px 10px', fontSize: '13px', fontWeight: 'bold', borderBottom: border };

        const estLines = (text) => text ? Math.max(1, Math.ceil(text.length / 70)) : 0;
        const LINES_PER_PAGE = 48;
        const projLines = (p) => 2 + estLines(p.description) + (p.technologies ? 1 : 0) + (p.role ? 1 : 0);
        const workEntryLines = (w) => {
            let lines = 3 + estLines(w.description);
            if (w.projects && w.projects.length > 0) {
                for (const p of w.projects) lines += projLines(p);
            }
            return lines;
        };

        const headerLines = 8;
        const summaryLines = 3 + estLines(data.content?.career_summary);
        let avail = LINES_PER_PAGE - headerLines - summaryLines - 2;

        let page1WorkCount = 0, used = 0;
        for (let i = 0; i < workHistory.length; i++) {
            const el = workEntryLines(workHistory[i]);
            if (used + el > avail && page1WorkCount > 0) break;
            used += el; page1WorkCount++;
        }
        const page1Work = workHistory.slice(0, page1WorkCount);
        const remainWork = workHistory.slice(page1WorkCount);

        const workContPages = [];
        let buf = [], bufLines = 0;
        for (const w of remainWork) {
            const el = workEntryLines(w);
            if (bufLines + el > LINES_PER_PAGE - 3 && buf.length > 0) { workContPages.push(buf); buf = []; bufLines = 0; }
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
            <div ref={previewRef} style={{ background: '#e0e0e0', padding: '24px' }}>
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

                {workContPages.map((pageWork, pi) => (
                    <div key={`wc_${pi}`} data-pdf-page style={pageStyle}>
                        <div style={{ border }}>
                            <div style={sectionHeaderStyle}>職務経歴（続き）</div>
                            {pageWork.map((w, i) => renderWorkEntry(w, i, pageWork))}
                        </div>
                    </div>
                ))}

                <div data-pdf-page style={pageStyle}>
                    {renderBottomSections()}
                </div>
            </div>
        );
    }

    const renderEduWorkRow = (r, i, prefix) => (
        <div key={prefix + i} style={{ display: 'flex', borderBottom: '1px dotted currentColor', minHeight: '28px', flex: 1 }}>
            <div style={{ width: '40px', borderRight: '1px dotted currentColor', textAlign: 'center', padding: '4px 0' }}>{r.year || '　'}</div>
            <div style={{ width: '30px', borderRight: border, textAlign: 'center', padding: '4px 0' }}>{r.month || '　'}</div>
            <div style={{ flex: 1, padding: '4px 8px', textAlign: r.center ? 'center' : r.right ? 'right' : 'left' }}>
                {r.center || r.text || r.right || '　'}
            </div>
        </div>
    );

    return (
        <div ref={previewRef} style={{ background: '#e0e0e0', padding: '24px' }}>
            {/* --- PAGE 1 --- */}
            <div data-pdf-page style={pageStyle}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '8px' }}>
                    <h2 style={{ fontSize: '24px', letterSpacing: '12px', margin: 0, fontWeight: 'normal' }}>履 歴 書</h2>
                    <div style={{ fontSize: '11px' }}>{dateStr} 現在</div>
                </div>
                <div style={{ display: 'flex', border: border }}>
                    {/* 左側: ふりがな・氏名・生年月日 */}
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                        {/* ふりがな */}
                        <div style={{ display: 'flex', borderBottom: '1px dotted currentColor', padding: '2px 8px' }}>
                            <div style={{ width: '60px', fontSize: '10px' }}>ふりがな</div>
                            <div style={{ flex: 1, fontSize: '11px' }}>{data.full_name_kana}</div>
                        </div>
                        {/* 氏名 */}
                        <div style={{ display: 'flex', borderBottom: border, padding: '8px 8px', alignItems: 'center', flex: 2 }}>
                            <div style={{ width: '60px', fontSize: '10px' }}>氏 名</div>
                            <div style={{ flex: 1, fontSize: '22px', textAlign: 'center', letterSpacing: '4px' }}>{data.full_name}</div>
                        </div>
                        {/* 生年月日・性別 */}
                        <div style={{ display: 'flex', flex: 1.6 }}>
                            <div style={{ flex: 1, padding: '8px 8px', display: 'flex', alignItems: 'center', fontSize: '13px' }}>
                                {formatDate(data.birth_date, '　　年　 月　 日')} 生（満 {age !== null ? age : '　'} 歳）
                            </div>
                            <div style={{ width: '60px', borderLeft: border, padding: '8px 0', textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                {data.gender === 'male' ? '男' : data.gender === 'female' ? '女' : '男・女'}
                            </div>
                        </div>
                    </div>
                    {/* 右側: 写真 */}
                    <div style={{ width: '30mm', borderLeft: border, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {data.photo_path ? (
                            <img src={`/storage/${data.photo_path}`} alt="写真" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        ) : (
                            <div style={{ textAlign: 'center', fontSize: '9px', color: '#666', lineHeight: 1.4, padding: '4px' }}>
                                証明写真<br/>縦36mm〜40mm<br/>横24mm〜30mm<br/>本人単身胸から上<br/>裏面のりづけ
                            </div>
                        )}
                    </div>
                </div>
                <div style={{ display: 'flex', borderLeft: border, borderRight: border, borderBottom: border }}>
                    <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', borderBottom: '1px dotted currentColor', padding: '2px 8px' }}>
                            <div style={{ width: '60px', fontSize: '10px' }}>ふりがな</div>
                            <div style={{ flex: 1, fontSize: '11px' }}></div>
                        </div>
                        <div style={{ padding: cellPad, height: '50px' }}>
                            <div style={{ fontSize: '10px', marginBottom: '4px' }}>現住所 〒 {data.postal_code}</div>
                            <div style={{ fontSize: '14px', paddingTop: '4px' }}>{data.address}</div>
                        </div>
                    </div>
                    <div style={{ width: '40mm', borderLeft: border, display: 'flex', flexDirection: 'column' }}>
                        <div style={{ padding: '6px 8px', borderBottom: border, flex: 1 }}>
                            <span style={{ fontSize: '10px' }}>電話</span><br/>
                            <span style={{ fontSize: '12px' }}>{data.phone}</span>
                        </div>
                        <div style={{ padding: '6px 8px', flex: 1 }}>
                            <span style={{ fontSize: '10px' }}>Email</span><br/>
                            <span style={{ fontSize: '11px', wordBreak: 'break-all' }}></span>
                        </div>
                    </div>
                </div>
                <div style={{ display: 'flex', borderLeft: border, borderRight: border, borderBottom: border }}>
                    <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', borderBottom: '1px dotted currentColor', padding: '2px 8px' }}>
                            <div style={{ width: '60px', fontSize: '10px' }}>ふりがな</div>
                            <div style={{ flex: 1 }}></div>
                        </div>
                        <div style={{ padding: cellPad, height: '50px' }}>
                            <div style={{ fontSize: '10px' }}>連絡先 〒（現住所以外に連絡を希望する場合のみ入力）</div>
                            <div style={{ fontSize: '14px' }}></div>
                        </div>
                    </div>
                    <div style={{ width: '40mm', borderLeft: border, display: 'flex', flexDirection: 'column' }}>
                        <div style={{ padding: '6px 8px', borderBottom: border, flex: 1 }}>
                            <span style={{ fontSize: '10px' }}>電話</span>
                        </div>
                        <div style={{ padding: '6px 8px', flex: 1 }}>
                            <span style={{ fontSize: '10px' }}>Email</span>
                        </div>
                    </div>
                </div>
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
    );
}
