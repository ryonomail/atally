import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';

export default function ScoutSearchPage() {
    const navigate = useNavigate();

    // 検索フィルタ
    const [skills, setSkills] = useState('');
    const [location, setLocation] = useState('');

    // 検索結果
    const [profiles, setProfiles] = useState([]);
    const [pagination, setPagination] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [page, setPage] = useState(1);

    // 一括選択
    const [selectedIds, setSelectedIds] = useState([]);

    // 一括スカウト送信
    const [jobs, setJobs] = useState([]);
    const [selectedJobId, setSelectedJobId] = useState('');
    const [message, setMessage] = useState('');
    const [sending, setSending] = useState(false);
    const [result, setResult] = useState(null);

    // アクティブ求人一覧を取得
    useEffect(() => {
        api.get('/my-jobs')
            .then(res => {
                const activeJobs = (res.data || []).filter(j => j.status === 'active');
                setJobs(activeJobs);
                if (activeJobs.length > 0) {
                    setSelectedJobId(activeJobs[0].id);
                }
            })
            .catch(() => {});
    }, []);

    // 検索実行
    const fetchProfiles = useCallback(async (pageNum = 1) => {
        setLoading(true);
        setError('');
        try {
            const params = { page: pageNum };
            if (skills.trim()) params.skills = skills.trim();
            if (location.trim()) params.location = location.trim();

            const res = await api.get('/scout/search', { params });
            setProfiles(res.data.data || []);
            setPagination({
                current_page: res.data.current_page,
                last_page: res.data.last_page,
                total: res.data.total,
            });
            setPage(pageNum);
        } catch (err) {
            setError(err.response?.data?.message || 'スカウト検索に失敗しました。');
            setProfiles([]);
        } finally {
            setLoading(false);
        }
    }, [skills, location]);

    useEffect(() => {
        fetchProfiles(1);
    }, []);

    const handleSearch = (e) => {
        e.preventDefault();
        setSelectedIds([]);
        fetchProfiles(1);
    };

    // チェックボックス操作
    const toggleSelect = (id) => {
        setSelectedIds(prev =>
            prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
        );
    };

    const toggleSelectAll = () => {
        const currentIds = profiles.map(p => p.id);
        const allSelected = currentIds.every(id => selectedIds.includes(id));
        if (allSelected) {
            setSelectedIds(prev => prev.filter(id => !currentIds.includes(id)));
        } else {
            setSelectedIds(prev => [...new Set([...prev, ...currentIds])]);
        }
    };

    // 一括スカウト送信
    const handleBulkScout = async () => {
        if (selectedIds.length === 0 || !selectedJobId) return;

        setSending(true);
        setResult(null);
        try {
            const res = await api.post('/scout/bulk', {
                user_ids: selectedIds,
                job_id: selectedJobId,
                message: message || null,
            });
            setResult(res.data);
            setSelectedIds([]);
        } catch (err) {
            setResult({ error: err.response?.data?.message || '一括スカウトの送信に失敗しました。' });
        } finally {
            setSending(false);
        }
    };

    const allOnPageSelected = profiles.length > 0 && profiles.every(p => selectedIds.includes(p.id));

    return (
        <div className="page container animate-fade-in">
            {/* ヘッダー */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-md)', marginBottom: 'var(--space-xl)' }}>
                <button className="btn btn-secondary" onClick={() => navigate('/dashboard')} style={{ fontSize: 'var(--font-size-sm)' }}>
                    &#x2B05; 戻る
                </button>
                <h1 style={{ fontSize: 'var(--font-size-3xl)' }}>スカウト検索</h1>
            </div>

            {/* 検索フォーム */}
            <form onSubmit={handleSearch} className="card" style={{ marginBottom: 'var(--space-lg)' }}>
                <div className="grid grid-2" style={{ gap: 'var(--space-md)', marginBottom: 'var(--space-md)' }}>
                    <div className="form-group" style={{ margin: 0 }}>
                        <label className="form-label">スキル</label>
                        <input
                            className="form-input"
                            value={skills}
                            onChange={e => setSkills(e.target.value)}
                            placeholder="例: JavaScript, React"
                        />
                    </div>
                    <div className="form-group" style={{ margin: 0 }}>
                        <label className="form-label">勤務地</label>
                        <input
                            className="form-input"
                            value={location}
                            onChange={e => setLocation(e.target.value)}
                            placeholder="例: 東京, 大阪"
                        />
                    </div>
                </div>
                <button type="submit" className="btn btn-primary" disabled={loading}>
                    {loading ? '検索中...' : '検索'}
                </button>
            </form>

            {/* エラー表示 */}
            {error && (
                <div className="card" style={{
                    background: 'rgba(239,68,68,0.06)',
                    border: '1px solid rgba(239,68,68,0.15)',
                    color: 'var(--color-error)',
                    marginBottom: 'var(--space-lg)',
                }}>
                    {error}
                </div>
            )}

            {/* 結果通知 */}
            {result && (
                <div className="card" style={{
                    background: result.error ? 'rgba(239,68,68,0.06)' : 'rgba(16,185,129,0.06)',
                    border: result.error ? '1px solid rgba(239,68,68,0.15)' : '1px solid rgba(16,185,129,0.15)',
                    marginBottom: 'var(--space-lg)',
                }}>
                    {result.error ? (
                        <p style={{ color: 'var(--color-error)' }}>{result.error}</p>
                    ) : (
                        <div>
                            <p style={{ fontWeight: 600, marginBottom: 'var(--space-sm)' }}>一括スカウト送信完了</p>
                            <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>
                                送信成功: <strong style={{ color: 'var(--color-success)' }}>{result.sent_count}名</strong>
                                {result.skipped_count > 0 && (
                                    <span> / スキップ: <strong style={{ color: '#d97706' }}>{result.skipped_count}名</strong></span>
                                )}
                            </p>
                            {result.errors && result.errors.length > 0 && (
                                <ul style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', marginTop: 'var(--space-sm)', paddingLeft: 'var(--space-lg)' }}>
                                    {result.errors.map((e, i) => (
                                        <li key={i}>ユーザーID {e.user_id}: {e.reason}</li>
                                    ))}
                                </ul>
                            )}
                        </div>
                    )}
                </div>
            )}

            {/* 検索結果 */}
            {loading ? (
                <div className="card"><div className="skeleton" style={{ height: 200 }} /></div>
            ) : profiles.length === 0 ? (
                <div className="card" style={{ textAlign: 'center', padding: 'var(--space-3xl)', color: 'var(--color-text-muted)' }}>
                    該当する候補者が見つかりませんでした。
                </div>
            ) : (
                <>
                    {/* 件数 & 全選択 */}
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        marginBottom: 'var(--space-md)',
                    }}>
                        <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>
                            {pagination?.total || 0}件の候補者
                            {selectedIds.length > 0 && (
                                <span style={{ marginLeft: 'var(--space-sm)', fontWeight: 600, color: 'var(--color-text-accent)' }}>
                                    ({selectedIds.length}名選択中)
                                </span>
                            )}
                        </p>
                        <label style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 'var(--space-xs)',
                            cursor: 'pointer',
                            fontSize: 'var(--font-size-sm)',
                            color: 'var(--color-text-secondary)',
                        }}>
                            <input
                                type="checkbox"
                                checked={allOnPageSelected}
                                onChange={toggleSelectAll}
                                style={{ width: 18, height: 18, cursor: 'pointer' }}
                            />
                            このページを全選択
                        </label>
                    </div>

                    {/* 候補者カード一覧 */}
                    {profiles.map(profile => (
                        <div
                            key={profile.id}
                            className="card card-glow"
                            style={{
                                marginBottom: 'var(--space-md)',
                                borderLeft: selectedIds.includes(profile.id) ? '4px solid var(--color-accent)' : undefined,
                                cursor: 'pointer',
                            }}
                            onClick={() => toggleSelect(profile.id)}
                        >
                            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--space-md)' }}>
                                <input
                                    type="checkbox"
                                    checked={selectedIds.includes(profile.id)}
                                    onChange={() => toggleSelect(profile.id)}
                                    onClick={e => e.stopPropagation()}
                                    style={{ width: 20, height: 20, marginTop: 2, cursor: 'pointer', flexShrink: 0 }}
                                />
                                <div style={{ flex: 1 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)', marginBottom: 'var(--space-xs)', flexWrap: 'wrap' }}>
                                        <h3 style={{ margin: 0, fontSize: 'var(--font-size-lg)' }}>{profile.display_name}</h3>
                                        {profile.age && (
                                            <span className="badge badge-info" style={{ fontSize: 10 }}>{profile.age}歳</span>
                                        )}
                                        {profile.gender && (
                                            <span className="badge badge-info" style={{ fontSize: 10 }}>{profile.gender}</span>
                                        )}
                                        {profile.area && profile.area !== '非公開' && (
                                            <span className="badge badge-info" style={{ fontSize: 10 }}>{profile.area}</span>
                                        )}
                                    </div>

                                    <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', marginBottom: 'var(--space-sm)' }}>
                                        <span>学歴: {profile.education_summary}</span>
                                        <span style={{ margin: '0 var(--space-sm)' }}>|</span>
                                        <span>職歴: {profile.work_history_summary}</span>
                                        <span style={{ margin: '0 var(--space-sm)' }}>|</span>
                                        <span>完成度: {profile.profile_completion}%</span>
                                    </div>

                                    {profile.skills && profile.skills.length > 0 && (
                                        <div style={{ display: 'flex', gap: 'var(--space-xs)', flexWrap: 'wrap', marginBottom: 'var(--space-sm)' }}>
                                            {profile.skills.map((skill, i) => (
                                                <span key={i} className="badge badge-warning" style={{ fontSize: 10 }}>{skill}</span>
                                            ))}
                                        </div>
                                    )}

                                    {profile.self_pr_excerpt && (
                                        <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', margin: 0, lineHeight: 1.5 }}>
                                            {profile.self_pr_excerpt}
                                        </p>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))}

                    {/* ページネーション */}
                    {pagination && pagination.last_page > 1 && (
                        <div style={{ display: 'flex', justifyContent: 'center', gap: 'var(--space-sm)', marginTop: 'var(--space-lg)' }}>
                            <button
                                className="btn btn-secondary"
                                disabled={page <= 1}
                                onClick={() => fetchProfiles(page - 1)}
                                style={{ fontSize: 'var(--font-size-sm)' }}
                            >
                                前へ
                            </button>
                            <span style={{
                                display: 'flex',
                                alignItems: 'center',
                                fontSize: 'var(--font-size-sm)',
                                color: 'var(--color-text-secondary)',
                                padding: '0 var(--space-md)',
                            }}>
                                {pagination.current_page} / {pagination.last_page}
                            </span>
                            <button
                                className="btn btn-secondary"
                                disabled={page >= pagination.last_page}
                                onClick={() => fetchProfiles(page + 1)}
                                style={{ fontSize: 'var(--font-size-sm)' }}
                            >
                                次へ
                            </button>
                        </div>
                    )}
                </>
            )}

            {/* 一括アクションバー（選択時に表示） */}
            {selectedIds.length > 0 && (
                <div style={{
                    position: 'fixed',
                    bottom: 0,
                    left: 0,
                    right: 0,
                    background: 'var(--color-bg-surface)',
                    borderTop: '2px solid var(--color-accent)',
                    padding: 'var(--space-md) var(--space-lg)',
                    boxShadow: '0 -4px 20px rgba(0,0,0,0.1)',
                    zIndex: 100,
                }}>
                    <div className="container" style={{
                        display: 'flex',
                        alignItems: 'flex-end',
                        gap: 'var(--space-md)',
                        flexWrap: 'wrap',
                    }}>
                        {/* 求人選択 */}
                        <div style={{ flex: '1 1 200px', minWidth: 200 }}>
                            <label className="form-label" style={{ fontSize: 'var(--font-size-xs)', marginBottom: 'var(--space-xs)' }}>
                                対象求人
                            </label>
                            {jobs.length === 0 ? (
                                <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-error)' }}>
                                    アクティブな求人がありません
                                </p>
                            ) : (
                                <select
                                    className="form-select"
                                    value={selectedJobId}
                                    onChange={e => setSelectedJobId(Number(e.target.value))}
                                    style={{ fontSize: 'var(--font-size-sm)' }}
                                >
                                    {jobs.map(job => (
                                        <option key={job.id} value={job.id}>{job.title}</option>
                                    ))}
                                </select>
                            )}
                        </div>

                        {/* メッセージ */}
                        <div style={{ flex: '2 1 300px', minWidth: 200 }}>
                            <label className="form-label" style={{ fontSize: 'var(--font-size-xs)', marginBottom: 'var(--space-xs)' }}>
                                メッセージ（任意）
                            </label>
                            <textarea
                                className="form-textarea"
                                value={message}
                                onChange={e => setMessage(e.target.value)}
                                placeholder="スカウトメッセージを入力してください..."
                                rows={2}
                                style={{ fontSize: 'var(--font-size-sm)', resize: 'none' }}
                                maxLength={2000}
                            />
                        </div>

                        {/* 送信ボタン */}
                        <div style={{ flexShrink: 0 }}>
                            <button
                                className="btn btn-primary"
                                onClick={handleBulkScout}
                                disabled={sending || jobs.length === 0 || !selectedJobId}
                                style={{ whiteSpace: 'nowrap' }}
                            >
                                {sending ? '送信中...' : `${selectedIds.length}名にスカウト送信`}
                            </button>
                            <button
                                className="btn btn-secondary"
                                onClick={() => setSelectedIds([])}
                                style={{ marginLeft: 'var(--space-sm)', fontSize: 'var(--font-size-xs)' }}
                            >
                                選択解除
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* 一括アクションバーが表示されているときの余白 */}
            {selectedIds.length > 0 && <div style={{ height: 140 }} />}
        </div>
    );
}
