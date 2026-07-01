import React, { useState, useEffect, useCallback } from 'react';
import { Link, useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { TrendingUp, Search, MapPin } from 'lucide-react';
import api from '../api';
import SEO from '../components/SEO';
import PREFECTURE_CITIES from '../data/prefectureCities';

const PREFECTURES = Object.keys(PREFECTURE_CITIES);
const SALARY_TYPES = ['月給', '時給', '日給', '年収'];
const yen = n => '¥' + Number(n || 0).toLocaleString();

export default function SalaryBenchmarkPage() {
    const params = useParams();               // /kyuyo/:prefecture?/:industry?
    const [sp] = useSearchParams();
    const navigate = useNavigate();

    const [industries, setIndustries] = useState([]);
    const [industry, setIndustry] = useState(params.industry || sp.get('industry') || '');
    const [prefecture, setPrefecture] = useState(params.prefecture || sp.get('prefecture') || '');
    const [salaryType, setSalaryType] = useState(sp.get('salary_type') || '月給');
    const [result, setResult] = useState(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        api.get('/salary-benchmark/industries').then(res => {
            const list = res.data || [];
            setIndustries(list);
            if (!industry && list.length) setIndustry(list[0]);
        }).catch(() => {});
    }, []);

    const run = useCallback(() => {
        if (!industry || !salaryType) return;
        setLoading(true);
        api.get('/salary-benchmark', { params: { industry, prefecture: prefecture || undefined, salary_type: salaryType } })
            .then(res => setResult(res.data))
            .catch(() => setResult(null))
            .finally(() => setLoading(false));
    }, [industry, prefecture, salaryType]);

    // 条件が変わったら自動診断（industry確定後）
    useEffect(() => { if (industry) run(); }, [industry, prefecture, salaryType]);

    const scopeLabel = result?.available
        ? (result.scope === 'prefecture' ? `${result.prefecture}・${result.industry}` : `全国・${result.industry}`)
        : '';

    // 相場バー（p25〜p75の範囲で中央値の位置を示す）
    const bar = result?.available ? (() => {
        const lo = result.p25, hi = result.p75, span = Math.max(hi - lo, 1);
        const medPos = Math.min(Math.max((result.median - lo) / span, 0), 1) * 100;
        return { medPos };
    })() : null;

    const jobsHref = `/jobs?${new URLSearchParams({
        ...(prefecture ? { prefecture } : {}),
        keyword: industry,
    }).toString()}`;

    const pageTitle = (prefecture || '全国') + 'の' + (industry || '職種') + 'の給料・年収相場';

    return (
        <div className="container" style={{ padding: '28px 0 60px', maxWidth: 860 }}>
            <SEO title={`${pageTitle}${result?.available ? `【${salaryType}中央値 ${yen(result.median)}】` : ''}`}
                 description={`${prefecture || '全国'}の${industry || '各職種'}の給与相場（${salaryType}）を、実際の求人${result?.available ? result.count.toLocaleString() + '件' : ''}から算出。下位25%・中央値・上位25%がわかります。`} />

            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                <TrendingUp size={24} style={{ color: 'var(--color-accent, #c8952e)' }} />
                <h1 style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 700, color: 'var(--color-navy, #121c34)', margin: 0 }}>
                    給料・年収相場チェッカー
                </h1>
            </div>
            <p style={{ color: 'var(--color-text-secondary, #6b7280)', fontSize: 'var(--font-size-sm)', marginBottom: 22 }}>
                業種・地域・給与種別を選ぶだけ。実際の求人データから「今の相場」を無料で診断します（登録不要）。
            </p>

            {/* セレクタ */}
            <div className="card" style={{ padding: 18, borderRadius: 12, border: '1px solid var(--color-border, #e5e7eb)', marginBottom: 20 }}>
                <div className="grid grid-3" style={{ gap: 12 }}>
                    <div className="form-group" style={{ margin: 0 }}>
                        <label className="form-label">業種</label>
                        <select className="form-select" value={industry} onChange={e => setIndustry(e.target.value)}>
                            {industries.map(i => <option key={i} value={i}>{i}</option>)}
                        </select>
                    </div>
                    <div className="form-group" style={{ margin: 0 }}>
                        <label className="form-label">都道府県</label>
                        <select className="form-select" value={prefecture} onChange={e => setPrefecture(e.target.value)}>
                            <option value="">全国</option>
                            {PREFECTURES.map(p => <option key={p} value={p}>{p}</option>)}
                        </select>
                    </div>
                    <div className="form-group" style={{ margin: 0 }}>
                        <label className="form-label">給与種別</label>
                        <select className="form-select" value={salaryType} onChange={e => setSalaryType(e.target.value)}>
                            {SALARY_TYPES.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                    </div>
                </div>
            </div>

            {/* 結果 */}
            {loading && <div className="skeleton" style={{ height: 180, borderRadius: 12 }} />}

            {!loading && result && result.available && (
                <div className="card" style={{ padding: 22, borderRadius: 12, border: '1px solid var(--color-accent-light, #eadfc4)', background: 'linear-gradient(180deg, #fbf6ea 0%, #fdfbf5 100%)' }}>
                    <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary, #6b7280)', marginBottom: 4 }}>
                        {scopeLabel}（{salaryType}・求人{result.count.toLocaleString()}件から算出）
                        {result.scope === 'nationwide' && prefecture && <span style={{ marginLeft: 6 }}>※{prefecture}は件数が少ないため全国相場を表示</span>}
                    </div>
                    <div style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 800, color: 'var(--color-navy, #121c34)', marginBottom: 16 }}>
                        中央値 <span style={{ color: 'var(--color-accent, #c8952e)' }}>{yen(result.median)}</span>
                        <span style={{ fontSize: 'var(--font-size-sm)', fontWeight: 500, color: 'var(--color-text-secondary, #6b7280)', marginLeft: 8 }}>/ {salaryType}</span>
                    </div>

                    {/* 相場レンジ・バー */}
                    <div style={{ margin: '4px 0 18px' }}>
                        <div style={{ position: 'relative', height: 8, background: '#e7dcc4', borderRadius: 999 }}>
                            <div style={{ position: 'absolute', left: `${bar.medPos}%`, top: -4, width: 16, height: 16, borderRadius: '50%', background: 'var(--color-accent, #c8952e)', transform: 'translateX(-50%)', border: '2px solid #fff' }} />
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, fontSize: 'var(--font-size-xs)' }}>
                            <div><div style={{ opacity: 0.6 }}>下位25%</div><div style={{ fontWeight: 600 }}>{yen(result.p25)}</div></div>
                            <div style={{ textAlign: 'right' }}><div style={{ opacity: 0.6 }}>上位25%</div><div style={{ fontWeight: 600 }}>{yen(result.p75)}</div></div>
                        </div>
                    </div>

                    <Link to={jobsHref} className="btn btn-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                        <Search size={16} /> {prefecture || '全国'}の{industry}の求人を見る
                    </Link>
                </div>
            )}

            {!loading && result && !result.available && (
                <div className="card" style={{ padding: 20, borderRadius: 12, textAlign: 'center', color: 'var(--color-text-secondary, #6b7280)' }}>
                    この条件は求人データが少なく、相場を算出できませんでした。業種や地域を変えてお試しください。
                </div>
            )}

            {/* 他の都道府県への内部リンク（SEO） */}
            {industry && (
                <div style={{ marginTop: 28 }}>
                    <h2 style={{ fontSize: 'var(--font-size-md)', fontWeight: 700, color: 'var(--color-navy, #121c34)', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
                        <MapPin size={16} /> {industry}の相場を他の地域でも見る
                    </h2>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                        {PREFECTURES.map(p => (
                            <button key={p}
                                onClick={() => { setPrefecture(p); navigate(`/kyuyo/${encodeURIComponent(p)}/${encodeURIComponent(industry)}`); }}
                                className="chip"
                                style={{ padding: '4px 10px', borderRadius: 999, border: '1px solid var(--color-border, #e5e7eb)', background: p === prefecture ? 'var(--color-navy, #121c34)' : '#fff', color: p === prefecture ? '#fff' : 'var(--color-navy, #121c34)', fontSize: 'var(--font-size-xs)', cursor: 'pointer' }}>
                                {p}
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
