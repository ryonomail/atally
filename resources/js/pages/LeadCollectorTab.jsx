import React, { useState, useEffect, useRef, useCallback } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Search, Download, RefreshCw, Trash2, MapPin, Globe, Phone, Mail, ExternalLink, Play, Loader } from 'lucide-react';
import api from '../api';
import { useToast } from '../hooks/useToast';

/* ============================================
   営業リスト（見込み企業の自動収集）タブ
   - 「収集」ボタン → サーバーのキューで Googleマップ / OpenStreetMap / 公式サイト / SNS から収集
   - 一覧・地図・CSV出力・営業ステータス管理
   ============================================ */

const STATUS = {
    new:         { label: '未対応',   color: '#3b82f6' },
    contacted:   { label: '連絡済み', color: '#f59e0b' },
    negotiating: { label: '商談中',   color: '#8b5cf6' },
    won:         { label: '成約',     color: '#22c55e' },
    lost:        { label: '失注',     color: '#94a3b8' },
    excluded:    { label: '対象外',   color: '#cbd5e1' },
};

const SNS = [
    { key: 'instagram', label: 'IG',   name: 'Instagram', color: '#e1306c' },
    { key: 'twitter',   label: 'X',    name: 'X(Twitter)', color: '#111' },
    { key: 'facebook',  label: 'FB',   name: 'Facebook',  color: '#1877f2' },
    { key: 'tiktok',    label: 'TT',   name: 'TikTok',    color: '#000' },
    { key: 'youtube',   label: 'YT',   name: 'YouTube',   color: '#ff0000' },
    { key: 'line',      label: 'LINE', name: 'LINE',      color: '#06c755' },
];

const RUN_STATUS = {
    queued:  { label: '待機中', cls: 'badge-warning' },
    running: { label: '収集中', cls: 'badge-warning' },
    done:    { label: '完了',   cls: 'badge-success' },
    failed:  { label: '失敗',   cls: 'badge-error' },
};

const SOURCE_LABEL = { hellowork: 'ハローワーク求人', google: 'Googleマップ', osm: 'OpenStreetMap' };
const FOUND_BY = { hellowork: 'ハローワーク掲載', google: 'Googleマップ掲載', osm: 'OpenStreetMap', search: 'Web検索で発見' };

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function SnsLinks({ lead, size = 'sm' }) {
    const items = SNS.filter(s => lead[s.key]);
    if (!items.length) return <span style={{ color: 'var(--color-text-muted)', fontSize: 12 }}>—</span>;
    return (
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            {items.map(s => (
                <a key={s.key} href={lead[s.key]} target="_blank" rel="noopener noreferrer" title={`${s.name}: ${lead[s.key]}`}
                    onClick={e => e.stopPropagation()}
                    style={{
                        background: s.color, color: '#fff', borderRadius: 4, textDecoration: 'none',
                        fontSize: size === 'sm' ? 10 : 12, fontWeight: 700, padding: size === 'sm' ? '2px 5px' : '3px 8px', lineHeight: 1.4,
                    }}>{s.label}</a>
            ))}
        </div>
    );
}

function StatCard({ label, value, color, active, onClick }) {
    return (
        <button type="button" className="card" onClick={onClick} style={{
            textAlign: 'left', cursor: onClick ? 'pointer' : 'default', padding: 'var(--space-md) var(--space-lg)',
            border: active ? '2px solid var(--color-navy)' : undefined, font: 'inherit',
        }}>
            <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>{label}</div>
            <div style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 700, color: color || 'var(--color-navy)' }}>{value ?? '—'}</div>
        </button>
    );
}

/* ---------- 地図 ---------- */
function LeadMap({ points, selectedId, onSelect }) {
    const elRef = useRef(null);
    const mapRef = useRef(null);
    const layerRef = useRef(null);
    const markersRef = useRef({});

    useEffect(() => {
        const map = L.map(elRef.current, { scrollWheelZoom: true }).setView([35.681, 139.767], 11);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom: 19,
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        }).addTo(map);
        layerRef.current = L.featureGroup().addTo(map);
        mapRef.current = map;
        return () => map.remove();
    }, []);

    useEffect(() => {
        const layer = layerRef.current;
        if (!layer) return;
        layer.clearLayers();
        markersRef.current = {};
        points.forEach(p => {
            const color = STATUS[p.status]?.color || '#3b82f6';
            const m = L.circleMarker([p.lat, p.lng], {
                radius: 7, weight: 2, color: p.has_website ? '#fff' : '#111',
                fillColor: color, fillOpacity: 0.9,
            });
            const sns = SNS.filter(s => p[s.key])
                .map(s => `<a href="${esc(p[s.key])}" target="_blank" rel="noopener noreferrer" style="color:${s.color};font-weight:700;margin-right:6px">${s.name}</a>`)
                .join('');
            m.bindPopup(`
                <div style="min-width:180px">
                    <div style="font-weight:700;font-size:14px">${esc(p.name)}</div>
                    <div style="color:#666;font-size:12px">${esc(p.category || '')}</div>
                    <div style="font-size:12px;margin:4px 0">${esc(p.address || '')}</div>
                    <div style="font-size:12px">${p.has_website ? 'HPあり' : '<b style="color:#dc2626">HPなし</b>'} ・ ${esc(STATUS[p.status]?.label || '')}${p.job_count ? ` ・ 求人${p.job_count}件` : ''}</div>
                    ${p.email ? `<div style="font-size:12px"><a href="mailto:${esc(p.email)}">${esc(p.email)}</a></div>` : ''}
                    ${sns ? `<div style="margin-top:4px;font-size:12px">${sns}</div>` : ''}
                </div>`);
            m.on('click', () => onSelect?.(p.id, false));
            m.addTo(layer);
            markersRef.current[p.id] = m;
        });
        if (points.length) {
            mapRef.current.fitBounds(layer.getBounds(), { padding: [30, 30], maxZoom: 15 });
        }
    }, [points]); // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => {
        const m = markersRef.current[selectedId];
        if (m && mapRef.current) {
            mapRef.current.setView(m.getLatLng(), Math.max(mapRef.current.getZoom(), 15));
            m.openPopup();
        }
    }, [selectedId]);

    return (
        <div style={{ position: 'relative' }}>
            <div ref={elRef} style={{ height: 520, borderRadius: 12, overflow: 'hidden', border: '1px solid var(--color-border)', zIndex: 0 }} />
            <div style={{
                position: 'absolute', bottom: 8, left: 8, zIndex: 500, background: 'rgba(255,255,255,0.92)',
                borderRadius: 8, padding: '6px 10px', fontSize: 11, display: 'flex', gap: 10, flexWrap: 'wrap', maxWidth: '90%',
            }}>
                {Object.entries(STATUS).slice(0, 4).map(([k, v]) => (
                    <span key={k}><span style={{ display: 'inline-block', width: 9, height: 9, borderRadius: '50%', background: v.color, marginRight: 3 }} />{v.label}</span>
                ))}
                <span><span style={{ display: 'inline-block', width: 9, height: 9, borderRadius: '50%', border: '2px solid #111', marginRight: 3 }} />黒枠 = HPなし</span>
            </div>
        </div>
    );
}

/* ---------- 詳細・編集パネル ---------- */
function LeadDetail({ lead, onSaved, onDeleted, onClose }) {
    const toast = useToast();
    const [form, setForm] = useState(lead);
    const [saving, setSaving] = useState(false);
    const [enriching, setEnriching] = useState(false);

    useEffect(() => setForm(lead), [lead]);

    const save = async () => {
        setSaving(true);
        try {
            const payload = {};
            ['status', 'memo', 'phone', 'email', 'website', ...SNS.map(s => s.key)].forEach(k => {
                if ((form[k] ?? '') !== (lead[k] ?? '')) payload[k] = form[k] === '' ? null : form[k];
            });
            const res = await api.put(`/admin/leads/${lead.id}`, payload);
            onSaved(res.data);
            toast.success('保存しました');
        } catch (e) {
            toast.error(e.response?.data?.message || '保存に失敗しました');
        } finally { setSaving(false); }
    };

    const enrich = async () => {
        setEnriching(true);
        try {
            const res = await api.post(`/admin/leads/${lead.id}/enrich`);
            onSaved(res.data);
            toast.success('SNS・連絡先を再取得しました');
        } catch (e) {
            toast.error(e.response?.data?.message || '再取得に失敗しました');
        } finally { setEnriching(false); }
    };

    const del = async () => {
        if (!window.confirm(`「${lead.name}」をリストから削除しますか？`)) return;
        await api.delete(`/admin/leads/${lead.id}`);
        onDeleted(lead.id);
    };

    const field = (k, label, type = 'text') => (
        <label style={{ display: 'block', marginBottom: 8 }}>
            <span style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>{label}</span>
            <input className="form-input" type={type} value={form[k] ?? ''} onChange={e => setForm({ ...form, [k]: e.target.value })}
                style={{ padding: '6px 10px', fontSize: 13 }} />
        </label>
    );

    return (
        <div className="card" style={{ padding: 'var(--space-lg)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'flex-start' }}>
                <div>
                    <div style={{ fontSize: 'var(--font-size-lg)', fontWeight: 700 }}>{lead.name}</div>
                    <div style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>
                        {lead.category} {lead.rating ? ` ・ ★${lead.rating}（${lead.review_count ?? 0}件）` : ''}{lead.job_count ? ` ・ ハローワーク求人 ${lead.job_count}件` : ''} ・ 取得元: {SOURCE_LABEL[lead.source] || lead.source}
                        {lead.website && lead.website_found_by ? ` ・ HP: ${FOUND_BY[lead.website_found_by] || lead.website_found_by}` : ''}
                        {lead.enriched_at ? '' : ' ・ HP/メール未調査'}
                    </div>
                    <div style={{ fontSize: 13, marginTop: 4 }}>{lead.address}</div>
                    <div style={{ display: 'flex', gap: 12, marginTop: 6, fontSize: 13, flexWrap: 'wrap' }}>
                        {lead.google_maps_url && <a href={lead.google_maps_url} target="_blank" rel="noopener noreferrer"><MapPin size={13} /> Googleマップ</a>}
                        {lead.website && <a href={lead.website} target="_blank" rel="noopener noreferrer"><Globe size={13} /> ホームページ</a>}
                        {lead.phone && <a href={`tel:${lead.phone}`}><Phone size={13} /> {lead.phone}</a>}
                        {lead.email && <a href={`mailto:${lead.email}`}><Mail size={13} /> {lead.email}</a>}
                    </div>
                    <div style={{ marginTop: 6 }}><SnsLinks lead={lead} size="md" /></div>
                </div>
                <button className="btn btn-secondary btn-sm" onClick={onClose}>閉じる</button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '0 12px', marginTop: 'var(--space-md)' }}>
                <label style={{ display: 'block', marginBottom: 8 }}>
                    <span style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>営業ステータス</span>
                    <select className="form-select" value={form.status} onChange={e => setForm({ ...form, status: e.target.value })} style={{ padding: '6px 10px', fontSize: 13 }}>
                        {Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                    </select>
                </label>
                {field('phone', '電話番号')}
                {field('email', 'メール', 'email')}
                {field('website', 'ホームページ', 'url')}
                {SNS.map(s => <React.Fragment key={s.key}>{field(s.key, s.name, 'url')}</React.Fragment>)}
            </div>
            <label style={{ display: 'block' }}>
                <span style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>メモ</span>
                <textarea className="form-input" rows={3} value={form.memo ?? ''} onChange={e => setForm({ ...form, memo: e.target.value })} style={{ fontSize: 13 }} />
            </label>
            <div style={{ display: 'flex', gap: 8, marginTop: 'var(--space-md)', flexWrap: 'wrap' }}>
                <button className="btn btn-primary btn-sm" onClick={save} disabled={saving}>{saving ? '保存中…' : '保存'}</button>
                <button className="btn btn-secondary btn-sm" onClick={enrich} disabled={enriching}>
                    <RefreshCw size={13} /> {enriching ? '取得中…' : 'SNS・連絡先を再取得'}
                </button>
                <button className="btn btn-danger btn-sm" onClick={del} style={{ marginLeft: 'auto' }}><Trash2 size={13} /> 削除</button>
            </div>
        </div>
    );
}

/* ---------- メイン ---------- */
export default function LeadCollectorTab() {
    const toast = useToast();
    const [keyword, setKeyword] = useState('');
    const [area, setArea] = useState('');
    const [sources, setSources] = useState({ hellowork: true, google: false, osm: false });
    const [enriching, setEnriching] = useState(false);
    const [submitting, setSubmitting] = useState(false);

    const [stats, setStats] = useState(null);
    const [runs, setRuns] = useState([]);
    const [filters, setFilters] = useState({ q: '', status: '', website: '', sns: '', email: '', source: '', run_id: '' });
    const [qInput, setQInput] = useState('');
    const [page, setPage] = useState(1);
    const [list, setList] = useState(null);
    const [points, setPoints] = useState([]);
    const [selected, setSelected] = useState(null);
    const [view, setView] = useState('both'); // both / list / map
    const prevActive = useRef(false);

    const params = useCallback(() => {
        const p = {};
        Object.entries(filters).forEach(([k, v]) => { if (v) p[k] = v; });
        return p;
    }, [filters]);

    const loadList = useCallback(() => {
        api.get('/admin/leads', { params: { ...params(), page } }).then(r => setList(r.data)).catch(() => toast.error('一覧の取得に失敗しました'));
    }, [params, page]); // eslint-disable-line react-hooks/exhaustive-deps
    const loadMap = useCallback(() => {
        api.get('/admin/leads/map', { params: params() }).then(r => setPoints(r.data)).catch(() => {});
    }, [params]);
    const loadStats = () => api.get('/admin/leads/stats').then(r => setStats(r.data)).catch(() => {});
    const loadRuns = () => api.get('/admin/leads/runs').then(r => setRuns(r.data)).catch(() => {});

    useEffect(() => { loadStats(); loadRuns(); }, []);
    useEffect(() => { loadList(); }, [loadList]);
    useEffect(() => { loadMap(); }, [loadMap]);


    // 実行中の収集があればポーリング。完了したら一覧を更新
    const active = runs.some(r => r.status === 'queued' || r.status === 'running');
    useEffect(() => {
        if (prevActive.current && !active) {
            const last = runs[0];
            if (last?.status === 'done') toast.success(`収集完了: ${last.found_count}件（新規 ${last.new_count}件）`);
            if (last?.status === 'failed') toast.error('収集に失敗しました');
            loadStats(); loadList(); loadMap();
        }
        prevActive.current = active;
        if (!active) return;
        const t = setInterval(loadRuns, 3000);
        return () => clearInterval(t);
    }, [active]); // eslint-disable-line react-hooks/exhaustive-deps

    const collect = async (e) => {
        e.preventDefault();
        const src = Object.entries(sources).filter(([, v]) => v).map(([k]) => k);
        if (!src.length) { toast.error('収集元を1つ以上選択してください'); return; }
        if ((sources.google || sources.osm) && (!keyword.trim() || !area.trim())) {
            toast.error('Googleマップ / OpenStreetMap は業種とエリアの両方が必要です'); return;
        }
        setSubmitting(true);
        try {
            const res = await api.post('/admin/leads/collect', { keyword, area, sources: src });
            toast.success(res.data.message);
            loadRuns();
        } catch (err) {
            toast.error(err.response?.data?.message || '収集の開始に失敗しました');
        } finally { setSubmitting(false); }
    };

    const enrichMore = async () => {
        setEnriching(true);
        try {
            const res = await api.post('/admin/leads/enrich-batch');
            toast.success(res.data.message);
            loadRuns();
        } catch (err) {
            toast.error(err.response?.data?.message || '開始に失敗しました');
        } finally { setEnriching(false); }
    };

    const setFilter = (k, v) => { setFilters(f => ({ ...f, [k]: v })); setPage(1); };

    const exportCsv = async () => {
        try {
            const res = await api.get('/admin/leads/export', { params: params(), responseType: 'blob' });
            const url = URL.createObjectURL(res.data);
            const a = document.createElement('a');
            a.href = url; a.download = `営業リスト_${new Date().toISOString().slice(0, 10)}.csv`;
            a.click();
            URL.revokeObjectURL(url);
        } catch { toast.error('CSV出力に失敗しました'); }
    };

    const quickStatus = async (lead, status) => {
        try {
            const res = await api.put(`/admin/leads/${lead.id}`, { status });
            onSaved(res.data);
        } catch { toast.error('更新に失敗しました'); }
    };

    const onSaved = (lead) => {
        setList(l => l && ({ ...l, data: l.data.map(x => x.id === lead.id ? lead : x) }));
        setPoints(ps => ps.map(x => x.id === lead.id ? { ...x, ...lead } : x));
        setSelected(s => s && s.id === lead.id ? lead : s);
        loadStats();
    };
    const onDeleted = (id) => {
        setSelected(null);
        setList(l => l && ({ ...l, data: l.data.filter(x => x.id !== id), total: l.total - 1 }));
        setPoints(ps => ps.filter(x => x.id !== id));
        loadStats();
        toast.success('削除しました');
    };

    const selectById = (id) => {
        const hit = list?.data.find(x => x.id === id);
        if (hit) setSelected(hit);
        else api.get('/admin/leads', { params: { ...params(), q: points.find(p => p.id === id)?.name } })
            .then(r => setSelected(r.data.data.find(x => x.id === id) || null)).catch(() => {});
    };

    const runOptions = runs.filter(r => r.status === 'done' && !(r.sources || []).includes('enrich'));
    const onlyHw = sources.hellowork && !sources.google && !sources.osm;
    const runLabel = (r) => (r.sources || []).includes('enrich')
        ? 'HP・メール調査（続き）'
        : `${(r.sources || []).map(x => SOURCE_LABEL[x] || x).join('+')}：${r.keyword || '全業種'} / ${r.area || '全国'}`;

    return (
        <div>
            <style>{`
                .lead-grid { display: grid; grid-template-columns: minmax(0, 1.1fr) minmax(0, 1fr); gap: var(--space-lg); align-items: start; }
                .lead-grid.only { grid-template-columns: minmax(0, 1fr); }
                @media (max-width: 1000px) { .lead-grid { grid-template-columns: minmax(0, 1fr); } }
                .lead-table { width: 100%; border-collapse: collapse; font-size: 13px; }
                .lead-table th { text-align: left; font-weight: 600; color: var(--color-text-secondary); font-size: 12px; padding: 8px; border-bottom: 1px solid var(--color-border); white-space: nowrap; }
                .lead-table td { padding: 8px; border-bottom: 1px solid var(--color-divider); vertical-align: top; }
                .lead-table tr { cursor: pointer; }
                .lead-table tbody tr:hover { background: var(--color-accent-light); }
                .lead-table tr.sel { background: rgba(18, 28, 52, 0.06); }
                .lead-spin { animation: lead-spin 1s linear infinite; }
                @keyframes lead-spin { to { transform: rotate(360deg); } }
                .btn-sm { padding: 6px 12px; font-size: 13px; display: inline-flex; align-items: center; gap: 4px; }
            `}</style>

            {/* 収集フォーム */}
            <form className="card" onSubmit={collect} style={{ padding: 'var(--space-lg)', marginBottom: 'var(--space-lg)' }}>
                <div style={{ fontWeight: 700, marginBottom: 'var(--space-sm)' }}>企業を自動収集</div>
                <div style={{ display: 'flex', gap: 'var(--space-sm)', flexWrap: 'wrap', alignItems: 'flex-end' }}>
                    <label style={{ flex: '1 1 200px' }}>
                        <span style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>業種・キーワード{onlyHw && '（空欄で全業種）'}</span>
                        <input className="form-input" required={!onlyHw} maxLength={100} value={keyword} onChange={e => setKeyword(e.target.value)} placeholder="例: 介護、建設、美容室" />
                    </label>
                    <label style={{ flex: '1 1 200px' }}>
                        <span style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>エリア{onlyHw && '（空欄で全国）'}</span>
                        <input className="form-input" required={!onlyHw} maxLength={100} value={area} onChange={e => setArea(e.target.value)} placeholder="例: 東京都、世田谷区、大阪市北区" />
                    </label>
                    <button className="btn btn-primary" type="submit" disabled={submitting || active} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap' }}>
                        {active ? <><Loader size={16} className="lead-spin" /> 収集中…</> : <><Play size={16} /> 収集</>}
                    </button>
                </div>
                <div style={{ display: 'flex', gap: 'var(--space-lg)', marginTop: 'var(--space-sm)', fontSize: 13, flexWrap: 'wrap' }}>
                    <label>
                        <input type="checkbox" checked={sources.hellowork} onChange={e => setSources({ ...sources, hellowork: e.target.checked })} /> ハローワーク求人
                        {stats?.hellowork_employers != null && <span style={{ color: 'var(--color-text-muted)' }}>（取り込み可能 {stats.hellowork_employers.toLocaleString()}社）</span>}
                    </label>
                    <label style={{ opacity: stats?.sources?.google === false ? 0.5 : 1 }}>
                        <input type="checkbox" checked={sources.google} disabled={stats?.sources?.google === false}
                            onChange={e => setSources({ ...sources, google: e.target.checked })} /> Googleマップ
                        {stats?.sources?.google === false && <span style={{ color: 'var(--color-text-muted)' }}>（GOOGLE_PLACES_API_KEY 未設定）</span>}
                    </label>
                    <label><input type="checkbox" checked={sources.osm} onChange={e => setSources({ ...sources, osm: e.target.checked })} /> OpenStreetMap</label>
                    <span style={{ color: 'var(--color-text-secondary)' }}>
                        HPあり→サイト・問い合わせページからメール/SNS抽出 ／ HPなし→{stats?.sources?.sns_search ? 'Web検索で公式サイト・SNSを特定' : 'Web検索は BRAVE_SEARCH_API_KEY 設定で有効'}
                    </span>
                </div>
                {stats?.unenriched > 0 && (
                    <div style={{ marginTop: 'var(--space-sm)', display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', fontSize: 13 }}>
                        <button type="button" className="btn btn-secondary btn-sm" onClick={enrichMore} disabled={enriching || active}>
                            <Search size={14} /> HP・メールを探す
                        </button>
                        <span style={{ color: 'var(--color-text-secondary)' }}>
                            未調査 {stats.unenriched.toLocaleString()}件（求人数の多い企業から1回{150}件ずつ調査）
                        </span>
                    </div>
                )}

                {runs.length > 0 && (
                    <details style={{ marginTop: 'var(--space-md)' }} open={active}>
                        <summary style={{ cursor: 'pointer', fontSize: 13, color: 'var(--color-text-secondary)' }}>収集履歴</summary>
                        <div style={{ marginTop: 8, display: 'grid', gap: 6 }}>
                            {runs.slice(0, 8).map(r => (
                                <div key={r.id} style={{ fontSize: 12, display: 'flex', gap: 8, alignItems: 'baseline', flexWrap: 'wrap' }}>
                                    <span className={`badge ${RUN_STATUS[r.status]?.cls || ''}`}>{RUN_STATUS[r.status]?.label || r.status}</span>
                                    <b>{runLabel(r)}</b>
                                    <span style={{ color: 'var(--color-text-secondary)' }}>
                                        {new Date(r.created_at).toLocaleString('ja-JP')}
                                        {r.status === 'done' && ` ・ ${r.found_count}件`}{r.status === 'done' && !(r.sources || []).includes('enrich') && `（新規${r.new_count}）`}
                                    </span>
                                    {r.status === 'done' && !(r.sources || []).includes('enrich') && (
                                        <button type="button" className="btn btn-secondary" style={{ padding: '1px 8px', fontSize: 11 }}
                                            onClick={() => setFilter('run_id', String(r.id))}>この結果を表示</button>
                                    )}
                                    {r.message && <div style={{ width: '100%', whiteSpace: 'pre-wrap', color: 'var(--color-text-muted)', paddingLeft: 4 }}>{r.message}</div>}
                                </div>
                            ))}
                        </div>
                    </details>
                )}
            </form>

            {/* 統計 */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 'var(--space-sm)', marginBottom: 'var(--space-lg)' }}>
                <StatCard label="収集済み企業" value={stats?.total} active={!filters.website && !filters.sns && !filters.email} onClick={() => { setFilter('website', ''); setFilter('sns', ''); setFilter('email', ''); }} />
                <StatCard label="ホームページなし" value={stats?.no_website} color="#dc2626" active={filters.website === 'no' && !filters.sns} onClick={() => { setFilter('website', 'no'); setFilter('sns', ''); }} />
                <StatCard label="SNSあり" value={stats?.with_sns} color="#e1306c" active={filters.sns === 'any' && !filters.website} onClick={() => { setFilter('sns', 'any'); setFilter('website', ''); }} />
                <StatCard label="メールあり" value={stats?.with_email} color="#0891b2" active={filters.email === 'yes'} onClick={() => setFilter('email', filters.email === 'yes' ? '' : 'yes')} />
                <StatCard label="HPなし・SNSのみ" value={stats?.no_website_with_sns} color="#8b5cf6" active={filters.website === 'no' && filters.sns === 'any'} onClick={() => { setFilter('website', 'no'); setFilter('sns', 'any'); }} />
                <StatCard label="未対応" value={stats?.by_status?.new ?? 0} color={STATUS.new.color} active={filters.status === 'new'} onClick={() => setFilter('status', filters.status === 'new' ? '' : 'new')} />
            </div>

            {/* フィルター */}
            <div style={{ display: 'flex', gap: 'var(--space-sm)', flexWrap: 'wrap', marginBottom: 'var(--space-md)', alignItems: 'center' }}>
                <form onSubmit={e => { e.preventDefault(); setFilter('q', qInput); }} style={{ display: 'flex', gap: 4, flex: '1 1 240px' }}>
                    <input className="form-input" value={qInput} onChange={e => setQInput(e.target.value)} placeholder="会社名・住所・業種・電話で絞り込み" style={{ padding: '6px 10px', fontSize: 13 }} />
                    <button className="btn btn-secondary btn-sm" type="submit"><Search size={14} /></button>
                </form>
                <select className="form-select" value={filters.status} onChange={e => setFilter('status', e.target.value)} style={{ width: 'auto', padding: '6px 10px', fontSize: 13 }}>
                    <option value="">全ステータス</option>
                    {Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                </select>
                <select className="form-select" value={filters.website} onChange={e => setFilter('website', e.target.value)} style={{ width: 'auto', padding: '6px 10px', fontSize: 13 }}>
                    <option value="">HP: すべて</option>
                    <option value="yes">HPあり</option>
                    <option value="no">HPなし</option>
                </select>
                <select className="form-select" value={filters.sns} onChange={e => setFilter('sns', e.target.value)} style={{ width: 'auto', padding: '6px 10px', fontSize: 13 }}>
                    <option value="">SNS: すべて</option>
                    <option value="any">SNSあり</option>
                    <option value="none">SNSなし</option>
                    {SNS.map(s => <option key={s.key} value={s.key}>{s.name}あり</option>)}
                </select>
                <select className="form-select" value={filters.email} onChange={e => setFilter('email', e.target.value)} style={{ width: 'auto', padding: '6px 10px', fontSize: 13 }}>
                    <option value="">メール: すべて</option>
                    <option value="yes">メールあり</option>
                    <option value="no">メールなし</option>
                </select>
                <select className="form-select" value={filters.source} onChange={e => setFilter('source', e.target.value)} style={{ width: 'auto', padding: '6px 10px', fontSize: 13 }}>
                    <option value="">取得元: すべて</option>
                    {Object.entries(SOURCE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
                <select className="form-select" value={filters.run_id} onChange={e => setFilter('run_id', e.target.value)} style={{ width: 'auto', padding: '6px 10px', fontSize: 13 }}>
                    <option value="">全収集結果</option>
                    {runOptions.map(r => <option key={r.id} value={r.id}>{runLabel(r)}</option>)}
                </select>
                <div style={{ display: 'flex', gap: 4, marginLeft: 'auto' }}>
                    {[['both', '地図＋一覧'], ['list', '一覧'], ['map', '地図']].map(([k, label]) => (
                        <button key={k} type="button" className={`btn btn-sm ${view === k ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setView(k)}>{label}</button>
                    ))}
                    <button type="button" className="btn btn-secondary btn-sm" onClick={exportCsv}><Download size={14} /> CSV</button>
                </div>
            </div>

            {selected && (
                <div style={{ marginBottom: 'var(--space-md)' }}>
                    <LeadDetail lead={selected} onSaved={onSaved} onDeleted={onDeleted} onClose={() => setSelected(null)} />
                </div>
            )}

            <div className={`lead-grid ${view !== 'both' ? 'only' : ''}`}>
                {view !== 'map' && (
                    <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                        <div style={{ overflowX: 'auto' }}>
                            <table className="lead-table">
                                <thead>
                                    <tr>
                                        <th>会社名</th>
                                        <th>住所・電話</th>
                                        <th>HP</th>
                                        <th>メール</th>
                                        <th>SNS</th>
                                        <th>ステータス</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {!list && <tr><td colSpan={6} style={{ textAlign: 'center', padding: 40, color: 'var(--color-text-muted)' }}>読み込み中…</td></tr>}
                                    {list && list.data.length === 0 && (
                                        <tr><td colSpan={6} style={{ textAlign: 'center', padding: 40, color: 'var(--color-text-muted)' }}>
                                            企業がありません。上のフォームで業種とエリアを入れて「収集」を押してください。
                                        </td></tr>
                                    )}
                                    {list?.data.map(l => (
                                        <tr key={l.id} className={selected?.id === l.id ? 'sel' : ''} onClick={() => setSelected(l)}>
                                            <td style={{ minWidth: 160 }}>
                                                <div style={{ fontWeight: 600 }}>{l.name}</div>
                                                <div style={{ fontSize: 11, color: 'var(--color-text-secondary)' }}>
                                                    {l.category}{l.rating ? ` ・ ★${l.rating}` : ''}{l.job_count ? ` ・ 求人${l.job_count}件` : ''}
                                                </div>
                                            </td>
                                            <td style={{ minWidth: 180 }}>
                                                <div style={{ fontSize: 12 }}>{l.address || '—'}</div>
                                                {l.phone && <div style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>{l.phone}</div>}
                                            </td>
                                            <td>
                                                {l.website
                                                    ? <a href={l.website} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} title={l.website}><ExternalLink size={14} /></a>
                                                    : l.enriched_at
                                                        ? <span className="badge badge-error" style={{ fontSize: 10, whiteSpace: 'nowrap' }}>なし</span>
                                                        : <span style={{ fontSize: 11, color: 'var(--color-text-muted)', whiteSpace: 'nowrap' }}>未調査</span>}
                                            </td>
                                            <td style={{ fontSize: 12, maxWidth: 180, wordBreak: 'break-all' }}>
                                                {l.email
                                                    ? <a href={`mailto:${l.email}`} onClick={e => e.stopPropagation()}>{l.email}</a>
                                                    : <span style={{ color: 'var(--color-text-muted)' }}>{l.enriched_at ? '—' : '未調査'}</span>}
                                            </td>
                                            <td><SnsLinks lead={l} /></td>
                                            <td onClick={e => e.stopPropagation()}>
                                                <select value={l.status} onChange={e => quickStatus(l, e.target.value)}
                                                    style={{ fontSize: 12, padding: '2px 4px', borderRadius: 6, border: `1px solid ${STATUS[l.status]?.color}`, color: STATUS[l.status]?.color, background: 'transparent' }}>
                                                    {Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                                                </select>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        {list && list.last_page > 1 && (
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 'var(--space-sm) var(--space-md)', fontSize: 13 }}>
                                <span style={{ color: 'var(--color-text-secondary)' }}>{list.total}件中 {list.from}–{list.to}件</span>
                                <div style={{ display: 'flex', gap: 4 }}>
                                    <button className="btn btn-secondary btn-sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>前へ</button>
                                    <span style={{ padding: '6px 8px' }}>{page} / {list.last_page}</span>
                                    <button className="btn btn-secondary btn-sm" disabled={page >= list.last_page} onClick={() => setPage(p => p + 1)}>次へ</button>
                                </div>
                            </div>
                        )}
                        {list && list.last_page <= 1 && list.total > 0 && (
                            <div style={{ padding: 'var(--space-sm) var(--space-md)', fontSize: 13, color: 'var(--color-text-secondary)' }}>{list.total}件</div>
                        )}
                    </div>
                )}
                {view !== 'list' && (
                    <div>
                        <LeadMap points={points} selectedId={selected?.id} onSelect={selectById} />
                        <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginTop: 4 }}>
                            地図に表示中: {points.length}件（位置情報のある企業のみ・最大3,000件）
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
