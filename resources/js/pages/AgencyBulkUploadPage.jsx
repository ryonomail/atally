import React, { useState, useRef } from 'react';
import api from '../api';
import { useAuth } from '../hooks/useAuth';

const CSV_TEMPLATE = 'title,description,requirements,salary_min,salary_max,salary_type,salary_details,raise_frequency,bonus,location,office_address,employment_type,work_hours,remote_policy,overtime_average,contract_period,holidays,holiday_details,allowances,probation_period,probation_conditions,selection_process,required_documents,estimated_timeline,company_culture,work_environment,number_of_employees,founded_year,industry,appeal_points,notes,allow_referral,referral_fee_type,referral_fee,referral_conditions,persona_age_min,persona_age_max,persona_experience_min,persona_experience_max,persona_target_skills,persona_target_locations,persona_target_job_types,persona_target_employment_status,persona_target_education,persona_target_industries,persona_target_salary_min,persona_target_salary_max,persona_target_certifications,persona_target_management_experience,persona_max_company_changes,persona_personality_traits,persona_ng_conditions,persona_ideal_candidate_description,persona_boost_factor\n"Webエンジニア","Reactを用いたフロントエンド開発を担当。新規機能の設計・実装・コードレビューまで幅広く携わっていただきます。","React経験3年以上、TypeScript実務経験",5000000,8000000,"年収","月給制（固定残業20h含む）","年1回（4月）","年2回（6月・12月）","東京都渋谷区","渋谷駅徒歩5分","正社員","9:00〜18:00（フレックス制あり）","フルリモート可","月10時間程度","期間の定めなし","完全週休2日制（土日祝）","年末年始・夏季休暇・慶弔休暇","交通費全額支給、住宅手当","3ヶ月","本採用と同条件","書類選考→一次面接→最終面接","履歴書・職務経歴書","2週間程度","フラットな組織、1on1面談あり","モダンな開発環境、最新MacBook支給","50名","2020","IT・Web","自社プロダクト開発に集中できる環境","未経験の方も歓迎",true,"percentage",30,"成果報酬型。入社後3ヶ月の返金規定あり",25,35,3,10,"React;TypeScript;Laravel","東京都;神奈川県","フロントエンド;バックエンド","在職中;離職中","大卒以上","IT・Web;SaaS","5000000","8000000","TOEIC700点以上;AWS認定","あり",3,"主体性;チームワーク","短期離職が多い方","モダンな技術スタックに興味があり、チームで協力して開発を進められる方",1.5';

const REQUIRED_FIELDS = ['title', 'description'];

/**
 * Simple CSV parser that handles quoted fields with commas and newlines.
 */
function parseCSV(text) {
    const rows = [];
    let current = '';
    let inQuotes = false;
    const chars = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

    for (let i = 0; i < chars.length; i++) {
        const ch = chars[i];
        if (ch === '"') {
            if (inQuotes && chars[i + 1] === '"') {
                current += '"';
                i++;
            } else {
                inQuotes = !inQuotes;
            }
        } else if (ch === ',' && !inQuotes) {
            rows.push(current);
            current = '';
        } else if (ch === '\n' && !inQuotes) {
            rows.push(current);
            current = '';
            // yield a row boundary marker
            rows.push(null);
        } else {
            current += ch;
        }
    }
    if (current.length > 0) {
        rows.push(current);
    }

    // Split flat array into rows using null markers
    const result = [];
    let row = [];
    for (const val of rows) {
        if (val === null) {
            if (row.length > 0) result.push(row);
            row = [];
        } else {
            row.push(val.trim());
        }
    }
    if (row.length > 0) result.push(row);
    return result;
}

function groupErrors(errors) {
    const groups = {
        missing: { label: '必須項目の不足', items: [] },
        format: { label: 'フォーマットエラー', items: [] },
        other: { label: 'その他のエラー', items: [] },
    };

    for (const err of errors) {
        const lower = err.toLowerCase();

        if (lower.includes('必須') || lower.includes('required') || lower.includes('未入力') || lower.includes('missing')) {
            groups.missing.items.push(err);
        } else if (lower.includes('フォーマット') || lower.includes('format') || lower.includes('形式') || lower.includes('invalid') || lower.includes('数値')) {
            groups.format.items.push(err);
        } else {
            groups.other.items.push(err);
        }
    }

    return Object.values(groups).filter(g => g.items.length > 0);
}

export default function AgencyBulkUploadPage() {
    const { user } = useAuth();
    const [file, setFile] = useState(null);
    const [uploading, setUploading] = useState(false);
    const [result, setResult] = useState(null);
    const [error, setError] = useState('');
    const [preview, setPreview] = useState(null); // { headers, rows, totalRows, warnings }
    const fileInputRef = useRef(null);

    if (user?.company?.verification_status !== 'verified') {
        return (
            <div className="page container animate-fade-in">
                <div className="card" style={{ textAlign: 'center', padding: 'var(--space-3xl)', maxWidth: 500, margin: '0 auto' }}>
                    <div style={{ fontSize: '3rem', marginBottom: 'var(--space-md)' }}>⏳</div>
                    <h2 style={{ marginBottom: 'var(--space-md)' }}>企業審査中です</h2>
                    <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-sm)' }}>
                        審査が完了すると求人の一括アップロードが可能になります。<br />
                        審査状況はダッシュボードでご確認ください。
                    </p>
                </div>
            </div>
        );
    }

    const handleFileSelect = (selectedFile) => {
        setFile(selectedFile);
        setResult(null);
        setError('');
        setPreview(null);

        if (!selectedFile) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const text = e.target.result;
                const parsed = parseCSV(text);
                if (parsed.length < 1) {
                    setError('CSVファイルが空です');
                    setPreview(null);
                    return;
                }

                const headers = parsed[0];
                const dataRows = parsed.slice(1).filter(r => r.some(cell => cell !== ''));
                const totalRows = dataRows.length;
                const previewRows = dataRows.slice(0, 5);

                // Validate required fields
                const warnings = [];
                const missingHeaders = REQUIRED_FIELDS.filter(f => !headers.includes(f));
                if (missingHeaders.length > 0) {
                    warnings.push({
                        type: 'header',
                        message: `必須カラムが見つかりません: ${missingHeaders.join(', ')}`,
                    });
                }

                // Check each data row for empty required fields
                const requiredIndices = REQUIRED_FIELDS.map(f => headers.indexOf(f)).filter(i => i >= 0);
                dataRows.forEach((row, rowIdx) => {
                    requiredIndices.forEach((colIdx) => {
                        const val = row[colIdx] || '';
                        if (val.trim() === '') {
                            warnings.push({
                                type: 'row',
                                row: rowIdx + 2, // 1-based, +1 for header
                                message: `行${rowIdx + 2}: 「${headers[colIdx]}」が空です`,
                            });
                        }
                    });
                });

                setPreview({ headers, previewRows, totalRows, warnings });
            } catch (err) {
                setError('CSVの読み込みに失敗しました。ファイル形式を確認してください。');
                setPreview(null);
            }
        };
        reader.onerror = () => {
            setError('ファイルの読み込みに失敗しました');
            setPreview(null);
        };
        reader.readAsText(selectedFile, 'UTF-8');
    };

    const handleUpload = async (e) => {
        e.preventDefault();
        if (!file) { setError('CSVファイルを選択してください'); return; }

        setUploading(true);
        setError('');
        setResult(null);

        const formData = new FormData();
        formData.append('file', file);

        try {
            const res = await api.post('/agency/bulk-upload', formData);
            setResult(res.data);
            setFile(null);
            setPreview(null);
        } catch (err) {
            setError(err.response?.data?.message || 'アップロードに失敗しました');
        } finally {
            setUploading(false);
        }
    };

    const handleReUpload = () => {
        setFile(null);
        setResult(null);
        setError('');
        setPreview(null);
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    const downloadTemplate = () => {
        const blob = new Blob([CSV_TEMPLATE], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'job_template.csv';
        a.click();
        URL.revokeObjectURL(url);
    };

    return (
        <div className="page container" style={{ maxWidth: 720 }}>
            <h1 style={{ fontSize: 'var(--font-size-2xl)', marginBottom: 'var(--space-lg)' }}>求人一括アップロード</h1>

            <div className="card" style={{ marginBottom: 'var(--space-lg)' }}>
                <h3 style={{ marginBottom: 'var(--space-md)' }}>CSVフォーマット</h3>
                <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', marginBottom: 'var(--space-md)', lineHeight: 1.6 }}>
                    CSVファイルの1行目はヘッダー行です。<strong>title</strong> と <strong>description</strong> は必須です。<br />
                    必要なカラムだけ含めればOKです。最大5,000件まで一括登録できます（20MB以下）。
                </p>

                <details style={{ marginBottom: 'var(--space-md)' }}>
                    <summary style={{ cursor: 'pointer', fontWeight: 600, fontSize: 'var(--font-size-sm)', color: 'var(--color-text-accent)' }}>
                        使用可能カラム一覧（54項目）
                    </summary>
                    <div style={{ marginTop: 'var(--space-sm)', fontSize: 'var(--font-size-xs)', lineHeight: 1.8 }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead>
                                <tr style={{ borderBottom: '2px solid var(--color-border)', textAlign: 'left' }}>
                                    <th style={{ padding: '4px 8px', color: 'var(--color-text-muted)' }}>カテゴリ</th>
                                    <th style={{ padding: '4px 8px', color: 'var(--color-text-muted)' }}>カラム名</th>
                                    <th style={{ padding: '4px 8px', color: 'var(--color-text-muted)' }}>説明</th>
                                    <th style={{ padding: '4px 8px', color: 'var(--color-text-muted)' }}>例</th>
                                </tr>
                            </thead>
                            <tbody>
                                {[
                                    ['基本情報', 'title', '求人タイトル ★必須', 'Webエンジニア'],
                                    ['', 'description', '仕事内容 ★必須', 'Reactを用いた開発...'],
                                    ['', 'requirements', '応募要件', 'React経験3年以上'],
                                    ['給与', 'salary_min', '下限年収（円）', '5000000'],
                                    ['', 'salary_max', '上限年収（円）', '8000000'],
                                    ['', 'salary_type', '給与形態', '年収 / 月給 / 時給'],
                                    ['', 'salary_details', '給与補足', '固定残業20h含む'],
                                    ['', 'raise_frequency', '昇給', '年1回（4月）'],
                                    ['', 'bonus', '賞与', '年2回'],
                                    ['勤務条件', 'prefecture', '都道府県', '東京都'],
                                    ['', 'city', '市区町村', '渋谷区'],
                                    ['', 'location', '勤務地（自動生成可）', '東京都渋谷区'],
                                    ['', 'office_address', '詳細住所', '渋谷スクランブルスクエア 38F'],
                                    ['', 'nearest_station', '最寄り駅', 'JR山手線 渋谷駅'],
                                    ['', 'access_info', 'アクセス', '渋谷駅 東口直結 徒歩1分'],
                                    ['', 'transfer_policy', '転勤の有無', '転勤なし'],
                                    ['', 'employment_type', '雇用形態', '正社員 / 契約社員 / パート'],
                                    ['', 'work_hours', '勤務時間', '9:00〜18:00'],
                                    ['', 'remote_policy', 'リモート', 'フルリモート可'],
                                    ['', 'overtime_average', '残業時間', '月10時間程度'],
                                    ['', 'contract_period', '契約期間', '期間の定めなし'],
                                    ['待遇', 'holidays', '休日', '完全週休2日制'],
                                    ['', 'holiday_details', '休日詳細', '年末年始・夏季休暇'],
                                    ['', 'allowances', '手当', '交通費全額支給'],
                                    ['', 'probation_period', '試用期間', '3ヶ月'],
                                    ['', 'probation_conditions', '試用期間条件', '本採用と同条件'],
                                    ['選考', 'selection_process', '選考フロー', '書類→一次→最終'],
                                    ['', 'required_documents', '必要書類', '履歴書・職務経歴書'],
                                    ['', 'estimated_timeline', '選考期間', '2週間程度'],
                                    ['会社情報', 'company_culture', '社風', 'フラットな組織'],
                                    ['', 'work_environment', '職場環境', 'MacBook支給'],
                                    ['', 'number_of_employees', '従業員数', '50名'],
                                    ['', 'founded_year', '設立年', '2020'],
                                    ['', 'industry', '業種', 'IT・Web'],
                                    ['その他', 'appeal_points', 'アピール', '自社プロダクト開発'],
                                    ['', 'notes', '備考', '未経験歓迎'],
                                    ['紹介設定', 'allow_referral', '紹介許可', 'true / false'],
                                    ['', 'referral_fee_type', '手数料タイプ', 'percentage / fixed'],
                                    ['', 'referral_fee', '手数料', '30（%） or 500000（円）'],
                                    ['', 'referral_conditions', '紹介条件', '返金規定あり'],
                                    ['ペルソナ', 'persona_age_min', '対象年齢（下限）', '25'],
                                    ['', 'persona_age_max', '対象年齢（上限）', '35'],
                                    ['', 'persona_experience_min', '経験年数（下限）', '3'],
                                    ['', 'persona_experience_max', '経験年数（上限）', '10'],
                                    ['', 'persona_target_skills', '求めるスキル（;区切り）', 'React;TypeScript;Laravel'],
                                    ['', 'persona_target_locations', '対象勤務地（;区切り）', '東京都;神奈川県'],
                                    ['', 'persona_target_job_types', '対象職種（;区切り）', 'フロントエンド;バックエンド'],
                                    ['', 'persona_target_employment_status', '現在の就業状態', '在職中;離職中'],
                                    ['', 'persona_target_education', '学歴条件', '大卒以上'],
                                    ['', 'persona_target_industries', '対象業界（;区切り）', 'IT・Web;SaaS'],
                                    ['', 'persona_target_salary_min', '希望年収下限（円）', '5000000'],
                                    ['', 'persona_target_salary_max', '希望年収上限（円）', '8000000'],
                                    ['', 'persona_target_certifications', '求める資格（;区切り）', 'TOEIC700点以上;AWS認定'],
                                    ['', 'persona_target_management_experience', 'マネジメント経験', 'あり / なし / 不問'],
                                    ['', 'persona_max_company_changes', '最大転職回数', '3'],
                                    ['', 'persona_personality_traits', '求める人物像（;区切り）', '主体性;チームワーク'],
                                    ['', 'persona_ng_conditions', 'NG条件', '短期離職が多い方'],
                                    ['', 'persona_ideal_candidate_description', '理想の候補者像', 'モダンな技術に興味がある方'],
                                    ['', 'persona_boost_factor', 'ブースト係数（0.5〜3.0）', '1.5'],
                                ].map(([cat, col, desc, ex], i) => (
                                    <tr key={i} style={{ borderBottom: '1px solid var(--color-border)' }}>
                                        <td style={{ padding: '4px 8px', color: 'var(--color-text-muted)', fontWeight: cat ? 600 : 400 }}>{cat}</td>
                                        <td style={{ padding: '4px 8px', fontFamily: 'monospace', fontWeight: 500 }}>{col}</td>
                                        <td style={{ padding: '4px 8px', color: 'var(--color-text-secondary)' }}>{desc}</td>
                                        <td style={{ padding: '4px 8px', color: 'var(--color-text-muted)', fontStyle: 'italic' }}>{ex}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </details>

                <button className="btn btn-secondary" onClick={downloadTemplate}>CSVテンプレートをダウンロード</button>
            </div>

            <div className="card">
                <form onSubmit={handleUpload}>
                    <div className="form-group">
                        <label className="form-label">CSVファイル</label>
                        <div style={{
                            border: '2px dashed var(--color-border)', borderRadius: 'var(--radius-lg)',
                            padding: 'var(--space-2xl)', textAlign: 'center',
                            background: file ? 'rgba(16,185,129,0.05)' : 'var(--color-bg-secondary)',
                            cursor: 'pointer', transition: 'all 0.2s',
                        }} onClick={() => (fileInputRef.current || document.getElementById('csv-file')).click()}>
                            <input id="csv-file" ref={fileInputRef} type="file" accept=".csv,.txt" style={{ display: 'none' }}
                                onChange={e => handleFileSelect(e.target.files[0] || null)} />
                            {file ? (
                                <>
                                    <div style={{ fontSize: '2rem', marginBottom: 'var(--space-sm)' }}>📄</div>
                                    <p style={{ fontWeight: 600 }}>{file.name}</p>
                                    <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
                                        {(file.size / 1024).toFixed(1)} KB
                                    </p>
                                </>
                            ) : (
                                <>
                                    <div style={{ fontSize: '2rem', marginBottom: 'var(--space-sm)' }}>📁</div>
                                    <p style={{ color: 'var(--color-text-secondary)' }}>クリックしてCSVファイルを選択</p>
                                    <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>CSV / TXT（最大20MB・5,000件まで）</p>
                                </>
                            )}
                        </div>
                    </div>

                    {/* CSV Preview */}
                    {preview && (
                        <div style={{
                            marginBottom: 'var(--space-md)',
                            border: '1px solid var(--color-border)',
                            borderRadius: 'var(--radius-md)',
                            overflow: 'hidden',
                        }}>
                            <div style={{
                                padding: 'var(--space-sm) var(--space-md)',
                                background: 'var(--color-bg-secondary)',
                                borderBottom: '1px solid var(--color-border)',
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                            }}>
                                <span style={{ fontWeight: 600, fontSize: 'var(--font-size-sm)' }}>
                                    プレビュー
                                </span>
                                <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
                                    全{preview.totalRows}件のデータ
                                    {preview.totalRows > 5 && '（先頭5件を表示）'}
                                </span>
                            </div>

                            {/* Validation warnings */}
                            {preview.warnings.length > 0 && (
                                <div style={{
                                    padding: 'var(--space-sm) var(--space-md)',
                                    background: 'rgba(245, 158, 11, 0.08)',
                                    borderBottom: '1px solid var(--color-border)',
                                }}>
                                    <div style={{
                                        fontWeight: 600,
                                        fontSize: 'var(--font-size-xs)',
                                        color: '#d97706',
                                        marginBottom: 4,
                                    }}>
                                        検証警告（{preview.warnings.length}件）
                                    </div>
                                    <ul style={{
                                        margin: 0,
                                        paddingLeft: 'var(--space-md)',
                                        fontSize: 'var(--font-size-xs)',
                                        color: '#92400e',
                                        maxHeight: 120,
                                        overflowY: 'auto',
                                    }}>
                                        {preview.warnings.slice(0, 20).map((w, i) => (
                                            <li key={i} style={{ marginBottom: 2 }}>{w.message}</li>
                                        ))}
                                        {preview.warnings.length > 20 && (
                                            <li style={{ fontStyle: 'italic' }}>
                                                ...他{preview.warnings.length - 20}件の警告
                                            </li>
                                        )}
                                    </ul>
                                </div>
                            )}

                            {/* Preview table */}
                            <div style={{ overflowX: 'auto', maxHeight: 320 }}>
                                <table style={{
                                    width: '100%',
                                    borderCollapse: 'collapse',
                                    fontSize: 'var(--font-size-xs)',
                                    whiteSpace: 'nowrap',
                                }}>
                                    <thead>
                                        <tr style={{
                                            background: 'var(--color-bg-secondary)',
                                            borderBottom: '2px solid var(--color-border)',
                                            position: 'sticky',
                                            top: 0,
                                        }}>
                                            <th style={{
                                                padding: '6px 10px',
                                                color: 'var(--color-text-muted)',
                                                fontWeight: 600,
                                                textAlign: 'center',
                                                borderRight: '1px solid var(--color-border)',
                                                background: 'var(--color-bg-secondary)',
                                            }}>行</th>
                                            {preview.headers.map((h, i) => {
                                                const isRequired = REQUIRED_FIELDS.includes(h);
                                                return (
                                                    <th key={i} style={{
                                                        padding: '6px 10px',
                                                        fontWeight: 600,
                                                        fontFamily: 'monospace',
                                                        textAlign: 'left',
                                                        borderRight: '1px solid var(--color-border)',
                                                        background: isRequired
                                                            ? 'rgba(245, 158, 11, 0.12)'
                                                            : 'var(--color-bg-secondary)',
                                                        color: isRequired ? '#d97706' : 'var(--color-text-muted)',
                                                    }}>
                                                        {h}{isRequired && ' *'}
                                                    </th>
                                                );
                                            })}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {preview.previewRows.map((row, rowIdx) => (
                                            <tr key={rowIdx} style={{
                                                borderBottom: '1px solid var(--color-border)',
                                            }}>
                                                <td style={{
                                                    padding: '5px 10px',
                                                    color: 'var(--color-text-muted)',
                                                    textAlign: 'center',
                                                    fontWeight: 600,
                                                    borderRight: '1px solid var(--color-border)',
                                                    background: 'var(--color-bg-secondary)',
                                                }}>{rowIdx + 2}</td>
                                                {preview.headers.map((h, colIdx) => {
                                                    const val = row[colIdx] || '';
                                                    const isRequired = REQUIRED_FIELDS.includes(h);
                                                    const isEmpty = isRequired && val.trim() === '';
                                                    return (
                                                        <td key={colIdx} style={{
                                                            padding: '5px 10px',
                                                            maxWidth: 200,
                                                            overflow: 'hidden',
                                                            textOverflow: 'ellipsis',
                                                            borderRight: '1px solid var(--color-border)',
                                                            background: isEmpty ? 'rgba(239, 68, 68, 0.06)' : 'transparent',
                                                            color: isEmpty ? '#ef4444' : 'var(--color-text-primary)',
                                                        }}>
                                                            {isEmpty ? '（未入力）' : val}
                                                        </td>
                                                    );
                                                })}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {error && (
                        <div style={{
                            padding: 'var(--space-sm) var(--space-md)', marginBottom: 'var(--space-md)',
                            borderRadius: 'var(--radius-md)', background: 'rgba(239,68,68,0.1)',
                            color: '#ef4444', fontSize: 'var(--font-size-sm)',
                        }}>{error}</div>
                    )}

                    {/* Progress indicator during upload */}
                    {uploading && preview && (
                        <div style={{
                            padding: 'var(--space-sm) var(--space-md)',
                            marginBottom: 'var(--space-md)',
                            borderRadius: 'var(--radius-md)',
                            background: 'rgba(59, 130, 246, 0.08)',
                            color: '#2563eb',
                            fontSize: 'var(--font-size-sm)',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 'var(--space-sm)',
                        }}>
                            <span style={{
                                display: 'inline-block',
                                width: 16,
                                height: 16,
                                border: '2px solid #93c5fd',
                                borderTopColor: '#2563eb',
                                borderRadius: '50%',
                                animation: 'spin 0.8s linear infinite',
                            }} />
                            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
                            アップロード中... （{preview.totalRows}件処理中）
                        </div>
                    )}

                    <div style={{ display: 'flex', gap: 'var(--space-md)' }}>
                        <button type="submit" className="btn btn-primary btn-lg" style={{ flex: 1 }} disabled={!file || uploading}>
                            {uploading ? 'アップロード中...' : 'アップロードして一括登録'}
                        </button>
                        {file && !uploading && (
                            <button type="button" className="btn btn-secondary btn-lg" onClick={handleReUpload}>
                                キャンセル
                            </button>
                        )}
                    </div>
                </form>
            </div>

            {/* 結果表示 */}
            {result && (
                <div className="card animate-fade-in" style={{ marginTop: 'var(--space-lg)' }}>
                    <h3 style={{ marginBottom: 'var(--space-md)' }}>アップロード結果</h3>
                    <div style={{ display: 'flex', gap: 'var(--space-lg)', marginBottom: 'var(--space-md)' }}>
                        <div style={{ textAlign: 'center' }}>
                            <div style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 700, color: 'var(--color-success)' }}>
                                {result.created_count}
                            </div>
                            <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>登録成功</div>
                        </div>
                        {result.error_count > 0 && (
                            <div style={{ textAlign: 'center' }}>
                                <div style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 700, color: '#ef4444' }}>
                                    {result.error_count}
                                </div>
                                <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>エラー</div>
                            </div>
                        )}
                    </div>
                    {result.created_count > 0 && (
                        <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>
                            登録された求人は運営の審査後に公開されます。
                        </p>
                    )}

                    {/* Grouped error display */}
                    {result.errors?.length > 0 && (
                        <div style={{ marginTop: 'var(--space-md)' }}>
                            <label className="form-label" style={{ fontSize: 'var(--font-size-xs)', color: '#ef4444' }}>
                                エラー詳細（{result.errors.length}件）
                            </label>
                            {groupErrors(result.errors).map((group, gIdx) => (
                                <div key={gIdx} style={{
                                    marginBottom: 'var(--space-sm)',
                                    border: '1px solid rgba(239, 68, 68, 0.2)',
                                    borderRadius: 'var(--radius-md)',
                                    overflow: 'hidden',
                                }}>
                                    <div style={{
                                        padding: '6px var(--space-sm)',
                                        background: 'rgba(239, 68, 68, 0.06)',
                                        fontWeight: 600,
                                        fontSize: 'var(--font-size-xs)',
                                        color: '#dc2626',
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                    }}>
                                        <span>{group.label}</span>
                                        <span>{group.items.length}件</span>
                                    </div>
                                    <ul style={{
                                        margin: 0,
                                        padding: 'var(--space-xs) var(--space-sm) var(--space-xs) var(--space-xl)',
                                        fontSize: 'var(--font-size-xs)',
                                        color: 'var(--color-text-muted)',
                                        maxHeight: 160,
                                        overflowY: 'auto',
                                    }}>
                                        {group.items.map((err, i) => {
                                            const rowMatch = err.match(/(行\s*(\d+)|Row\s*(\d+))/i);
                                            const rowNum = rowMatch ? (rowMatch[2] || rowMatch[3]) : null;
                                            return (
                                                <li key={i} style={{ marginBottom: 3 }}>
                                                    {rowNum && (
                                                        <span style={{
                                                            display: 'inline-block',
                                                            background: 'rgba(239, 68, 68, 0.1)',
                                                            color: '#dc2626',
                                                            borderRadius: 4,
                                                            padding: '1px 6px',
                                                            fontSize: '0.7rem',
                                                            fontWeight: 700,
                                                            marginRight: 6,
                                                        }}>行{rowNum}</span>
                                                    )}
                                                    {rowNum ? err.replace(rowMatch[0], '').replace(/^[\s:：]+/, '') : err}
                                                </li>
                                            );
                                        })}
                                    </ul>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Re-upload button */}
                    <div style={{ marginTop: 'var(--space-lg)', textAlign: 'center' }}>
                        <button
                            type="button"
                            className="btn btn-secondary"
                            onClick={handleReUpload}
                        >
                            再アップロード
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
