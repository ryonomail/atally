/* 営業リスト ダッシュボード */
(() => {
  'use strict';

  const STATUS = {
    new: { label: '未対応', color: '#3b82f6' }, contacted: { label: '連絡済み', color: '#f59e0b' },
    negotiating: { label: '商談中', color: '#8b5cf6' }, won: { label: '成約', color: '#22c55e' },
    lost: { label: '失注', color: '#94a3b8' }, excluded: { label: '対象外', color: '#cbd5e1' },
  };
  const SNS = [
    { key: 'instagram', label: 'IG', name: 'Instagram', color: '#e1306c' },
    { key: 'twitter', label: 'X', name: 'X(Twitter)', color: '#111' },
    { key: 'facebook', label: 'FB', name: 'Facebook', color: '#1877f2' },
    { key: 'tiktok', label: 'TT', name: 'TikTok', color: '#000' },
    { key: 'youtube', label: 'YT', name: 'YouTube', color: '#ff0000' },
    { key: 'line', label: 'LINE', name: 'LINE', color: '#06c755' },
  ];
  const SOURCE_LABEL = { hellowork: 'ハローワーク求人', google: 'Googleマップ', osm: 'OpenStreetMap', csv: 'CSV取り込み', enrich: 'HP・メール調査（続き）' };
  const FOUND_BY = { hellowork: 'ハローワーク掲載', google: 'Googleマップ掲載', osm: 'OpenStreetMap', search: 'Web検索で発見' };
  const RUN_STATUS = {
    queued: ['待機中', 'badge-warn'], fetching: ['収集中', 'badge-warn'], enriching: ['調査中', 'badge-warn'],
    done: ['完了', 'badge-ok'], failed: ['失敗/中止', 'badge-ng'],
  };
  const ACTIVE = ['queued', 'fetching', 'enriching'];

  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const num = (n) => (n == null ? '—' : Number(n).toLocaleString());

  const state = {
    filters: { q: '', status: '', website: '', email: '', sns: '', source: '', run_id: '' },
    page: 1, list: null, points: [], selected: null, runs: [], stats: null, view: 'both', stepping: false,
  };

  // ---------------- API ----------------
  async function api(method, url, body, isForm) {
    const opt = { method, headers: { 'X-Requested-With': 'fetch', Accept: 'application/json' }, credentials: 'same-origin' };
    if (body && !isForm) { opt.headers['Content-Type'] = 'application/json'; opt.body = JSON.stringify(body); }
    if (isForm) opt.body = body;
    const res = await fetch(url, opt);
    if (res.status === 401) { location.href = '/login'; throw new Error('login'); }
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.message || `エラー (${res.status})`);
    return data;
  }
  const qs = (extra = {}) => {
    const p = new URLSearchParams();
    Object.entries({ ...state.filters, ...extra }).forEach(([k, v]) => { if (v !== '' && v != null) p.set(k, v); });
    return p.toString();
  };
  function toast(msg, err) {
    const d = document.createElement('div');
    d.textContent = msg; if (err) d.className = 'err';
    $('#toast').appendChild(d); setTimeout(() => d.remove(), 4500);
  }

  // ---------------- 地図 ----------------
  const map = L.map('map').setView([35.681, 139.767], 10);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  }).addTo(map);
  const layer = L.featureGroup().addTo(map);
  const legend = L.control({ position: 'bottomleft' });
  legend.onAdd = () => {
    const d = L.DomUtil.create('div', 'legend');
    d.innerHTML = Object.entries(STATUS).slice(0, 4).map(([, v]) => `<span class="dot" style="background:${v.color}"></span>${v.label}`).join(' ')
      + ' <span class="dot" style="border:2px solid #111"></span>黒枠=HPなし';
    return d;
  };
  legend.addTo(map);
  let markers = {};

  function renderMap() {
    layer.clearLayers(); markers = {};
    state.points.forEach((p) => {
      const m = L.circleMarker([p.lat, p.lng], {
        radius: 7, weight: 2, color: p.has_website ? '#fff' : '#111', fillColor: STATUS[p.status]?.color || '#3b82f6', fillOpacity: 0.9,
      });
      const sns = SNS.filter((s) => p[s.key]).map((s) => `<a href="${esc(p[s.key])}" target="_blank" rel="noopener noreferrer" style="color:${s.color};font-weight:700;margin-right:6px">${s.name}</a>`).join('');
      m.bindPopup(`<div style="min-width:180px"><b>${esc(p.name)}</b><div style="color:#666;font-size:12px">${esc(p.category || '')}</div>
        <div style="font-size:12px;margin:4px 0">${esc(p.address || '')}</div>
        <div style="font-size:12px">${p.has_website ? 'HPあり' : '<b style="color:#dc2626">HPなし</b>'} ・ ${esc(STATUS[p.status]?.label || '')}${p.job_count ? ` ・ 求人${p.job_count}件` : ''}</div>
        ${p.email ? `<div style="font-size:12px"><a href="mailto:${esc(p.email)}">${esc(p.email)}</a></div>` : ''}
        ${sns ? `<div style="font-size:12px;margin-top:4px">${sns}</div>` : ''}</div>`);
      m.on('click', () => selectById(p.id, false));
      m.addTo(layer); markers[p.id] = m;
    });
    if (state.points.length) map.fitBounds(layer.getBounds(), { padding: [30, 30], maxZoom: 15 });
    $('#map-count').textContent = `地図に表示中: ${num(state.points.length)}件（位置情報のある企業のみ・最大3,000件）`;
  }

  // ---------------- 一覧 ----------------
  const snsHtml = (l) => {
    const items = SNS.filter((s) => l[s.key]);
    if (!items.length) return '<span class="muted">—</span>';
    return `<div class="sns">${items.map((s) => `<a href="${esc(l[s.key])}" target="_blank" rel="noopener noreferrer" title="${esc(s.name)}" style="background:${s.color}">${s.label}</a>`).join('')}</div>`;
  };
  const statusSelect = (l) => `<select class="status-select" data-id="${l.id}" style="border:1px solid ${STATUS[l.status]?.color};color:${STATUS[l.status]?.color}">
      ${Object.entries(STATUS).map(([k, v]) => `<option value="${k}" ${k === l.status ? 'selected' : ''}>${v.label}</option>`).join('')}</select>`;

  function renderList() {
    const tb = $('#rows');
    const l = state.list;
    if (!l) { tb.innerHTML = '<tr><td colspan="6" class="empty">読み込み中…</td></tr>'; return; }
    if (!l.data.length) {
      tb.innerHTML = '<tr><td colspan="6" class="empty">企業がありません。上のフォームで「収集」を押すか、CSVを取り込んでください。</td></tr>';
    } else {
      tb.innerHTML = l.data.map((x) => `<tr data-id="${x.id}" class="${state.selected?.id === x.id ? 'sel' : ''}">
        <td style="min-width:160px"><div class="name">${esc(x.name)}</div>
          <div class="sub">${esc(x.category || '')}${x.rating ? ` ・ ★${x.rating}` : ''}${x.job_count ? ` ・ 求人${x.job_count}件` : ''}</div></td>
        <td style="min-width:180px"><div style="font-size:12px">${esc(x.address || '—')}</div>${x.phone ? `<div class="sub">${esc(x.phone)}</div>` : ''}</td>
        <td>${x.website ? `<a href="${esc(x.website)}" target="_blank" rel="noopener noreferrer" title="${esc(x.website)}">開く↗</a>`
          : (x.enriched_at ? '<span class="badge badge-ng">なし</span>' : '<span class="sub">未調査</span>')}</td>
        <td class="email">${x.email ? `<a href="mailto:${esc(x.email)}">${esc(x.email)}</a>` : `<span class="muted">${x.enriched_at ? '—' : '未調査'}</span>`}</td>
        <td>${snsHtml(x)}</td>
        <td class="nosel">${statusSelect(x)}</td></tr>`).join('');
    }
    const pg = $('#pager');
    pg.innerHTML = l.total ? `<span class="muted">${num(l.total)}件中 ${num(l.from)}–${num(l.to)}件</span>
      ${l.last_page > 1 ? `<div class="row nowrap"><button class="btn btn-secondary btn-sm" data-page="${l.page - 1}" ${l.page <= 1 ? 'disabled' : ''}>前へ</button>
      <span>${l.page} / ${l.last_page}</span>
      <button class="btn btn-secondary btn-sm" data-page="${l.page + 1}" ${l.page >= l.last_page ? 'disabled' : ''}>次へ</button></div>` : ''}` : '';
  }

  // ---------------- 詳細 ----------------
  function renderDetail() {
    const box = $('#detail');
    const l = state.selected;
    if (!l) { box.innerHTML = ''; return; }
    const field = (k, label, type = 'text') => `<label><span class="label">${label}</span><input class="input input-sm" type="${type}" name="${k}" value="${esc(l[k] || '')}"></label>`;
    box.innerHTML = `<div class="card">
      <div class="row" style="justify-content:space-between;align-items:flex-start">
        <div>
          <div style="font-size:17px;font-weight:700">${esc(l.name)}</div>
          <div class="sub" style="font-size:12px">${esc(l.category || '')}${l.rating ? ` ・ ★${l.rating}（${l.review_count ?? 0}件）` : ''}${l.job_count ? ` ・ ハローワーク求人 ${l.job_count}件` : ''}
            ・ 取得元: ${esc(SOURCE_LABEL[l.source] || l.source)}${l.website && l.website_found_by ? ` ・ HP: ${esc(FOUND_BY[l.website_found_by] || l.website_found_by)}` : ''}${l.enriched_at ? '' : ' ・ HP/メール未調査'}</div>
          <div style="margin-top:4px">${esc(l.address || '')}</div>
          <div class="links">
            ${l.google_maps_url ? `<a href="${esc(l.google_maps_url)}" target="_blank" rel="noopener noreferrer">📍 Googleマップ</a>` : ''}
            ${l.website ? `<a href="${esc(l.website)}" target="_blank" rel="noopener noreferrer">🌐 ホームページ</a>` : ''}
            ${l.phone ? `<a href="tel:${esc(l.phone)}">📞 ${esc(l.phone)}</a>` : ''}
            ${l.email ? `<a href="mailto:${esc(l.email)}">✉ ${esc(l.email)}</a>` : ''}
          </div>
          <div style="margin-top:6px">${snsHtml(l)}</div>
        </div>
        <button class="btn btn-secondary btn-sm" data-act="close">閉じる</button>
      </div>
      <form id="detail-form">
        <div class="detail-grid">
          <label><span class="label">営業ステータス</span><select class="input input-sm" name="status">
            ${Object.entries(STATUS).map(([k, v]) => `<option value="${k}" ${k === l.status ? 'selected' : ''}>${v.label}</option>`).join('')}</select></label>
          ${field('phone', '電話番号')}${field('email', 'メール', 'email')}${field('website', 'ホームページ', 'url')}
          ${SNS.map((s) => field(s.key, s.name, 'url')).join('')}
        </div>
        <label class="detail-memo"><span class="label">メモ</span><textarea class="input" name="memo" rows="3">${esc(l.memo || '')}</textarea></label>
        <div class="row">
          <button class="btn btn-primary btn-sm" type="submit">保存</button>
          <button class="btn btn-secondary btn-sm" type="button" data-act="enrich">↻ HP・メール・SNSを再取得</button>
          <button class="btn btn-danger btn-sm push" type="button" data-act="delete">削除</button>
        </div>
      </form></div>`;
  }

  // ---------------- 統計・履歴 ----------------
  function renderStats() {
    const s = state.stats; if (!s) return;
    const f = state.filters;
    const cards = [
      ['収集済み企業', s.total, '', !f.website && !f.sns && !f.email, { website: '', sns: '', email: '' }],
      ['ホームページなし', s.no_website, '#dc2626', f.website === 'no' && !f.sns, { website: 'no', sns: '', email: '' }],
      ['メールあり', s.with_email, '#0891b2', f.email === 'yes', { email: f.email === 'yes' ? '' : 'yes' }],
      ['SNSあり', s.with_sns, '#e1306c', f.sns === 'any' && !f.website, { sns: 'any', website: '' }],
      ['HPなし・SNSのみ', s.no_website_with_sns, '#8b5cf6', f.website === 'no' && f.sns === 'any', { website: 'no', sns: 'any' }],
      ['未対応', s.by_status?.new ?? 0, STATUS.new.color, f.status === 'new', { status: f.status === 'new' ? '' : 'new' }],
    ];
    $('#stats').innerHTML = cards.map(([label, v, color, active, set], i) => `<button type="button" class="card stat ${active ? 'active' : ''}" data-stat="${i}">
      <div class="small muted">${label}</div><div class="v" style="color:${color || 'inherit'}">${num(v)}</div></button>`).join('');
    $$('#stats .stat').forEach((b) => b.onclick = () => setFilters(cards[b.dataset.stat][4]));
    $('#unenriched').textContent = s.unenriched ? `未調査 ${num(s.unenriched)}件（求人数の多い企業から1回150件ずつ）` : '未調査の企業はありません';
    $('#enrich-btn').disabled = !s.unenriched || activeRun();
  }

  const runLabel = (r) => r.sources === 'enrich' ? SOURCE_LABEL.enrich
    : r.sources === 'csv' ? SOURCE_LABEL.csv
      : `${r.sources.split(',').map((x) => SOURCE_LABEL[x] || x).join('+')}：${r.keyword || '全業種'} / ${r.area || '全国'}`;
  const activeRun = () => state.runs.find((r) => ACTIVE.includes(r.status));

  function renderRuns() {
    const box = $('#runs-box');
    box.hidden = !state.runs.length;
    $('#runs').innerHTML = state.runs.slice(0, 10).map((r) => `<div>
      <span class="badge ${RUN_STATUS[r.status]?.[1] || ''}">${RUN_STATUS[r.status]?.[0] || r.status}</span>
      <b>${esc(runLabel(r))}</b>
      <span class="muted">${new Date(r.created_at).toLocaleString('ja-JP')}${r.status === 'done' ? ` ・ ${num(r.found_count)}件` : ''}${r.status === 'done' && r.sources !== 'enrich' ? `（新規${num(r.new_count)}）` : ''}</span>
      ${r.status === 'done' && r.sources !== 'enrich' ? `<button type="button" class="btn btn-secondary btn-sm" data-run="${r.id}" style="padding:1px 8px;font-size:11px">この結果を表示</button>` : ''}
      ${r.message ? `<div class="run-msg">${esc(r.message)}</div>` : ''}</div>`).join('');
    const sel = $('select[data-filter="run_id"]');
    const cur = sel.value;
    sel.innerHTML = '<option value="">全収集結果</option>' + state.runs.filter((r) => r.status === 'done' && r.sources !== 'enrich')
      .map((r) => `<option value="${r.id}">${esc(runLabel(r))}</option>`).join('');
    sel.value = cur;

    const a = activeRun();
    $('#collect-btn').disabled = !!a;
    $('#collect-btn').textContent = a ? '⏳ 処理中…' : '▶ 収集';
    $('#progress').hidden = !a;
    if (a) {
      const pct = a.enrich_total ? Math.round((a.enrich_done / a.enrich_total) * 100) : 0;
      $('#progress-text').textContent = a.status === 'enriching'
        ? `${runLabel(a)}：HP・メール・SNSを調査中 ${num(a.enrich_done)} / ${num(a.enrich_total)}件`
        : `${runLabel(a)}：企業を収集中…`;
      $('#progress-bar').style.width = (a.status === 'enriching' ? pct : 5) + '%';
    }
  }

  // ---------------- 読み込み ----------------
  const loadList = () => api('GET', `/api/leads?${qs({ page: state.page })}`).then((d) => { state.list = d; renderList(); }).catch((e) => toast(e.message, true));
  const loadMap = () => api('GET', `/api/leads/map?${qs()}`).then((d) => { state.points = d; renderMap(); }).catch(() => {});
  const loadStats = () => api('GET', '/api/stats').then((d) => { state.stats = d; renderStats(); }).catch(() => {});
  const loadRuns = () => api('GET', '/api/runs').then((d) => { state.runs = d; renderRuns(); renderStats(); }).catch(() => {});
  const reloadAll = () => { loadList(); loadMap(); loadStats(); };

  function setFilters(obj) {
    Object.assign(state.filters, obj); state.page = 1;
    $$('[data-filter]').forEach((el) => { el.value = state.filters[el.dataset.filter] ?? ''; });
    $('#export-btn').href = `/api/export.csv?${qs()}`;
    loadList(); loadMap(); renderStats();
  }

  // 実行中の収集をブラウザから少しずつ進める（常駐ワーカーがいれば並走しても安全）
  async function driveRun() {
    if (state.stepping) return;
    state.stepping = true;
    try {
      let a = activeRun();
      while (a) {
        const before = `${a.status}/${a.enrich_done}`;
        let r;
        try { r = await api('POST', `/api/runs/${a.id}/step`); } catch (e) { toast(e.message, true); await sleep(5000); r = a; }
        state.runs = state.runs.map((x) => (x.id === r.id ? r : x)); renderRuns();
        if (!ACTIVE.includes(r.status)) {
          if (r.status === 'done') toast(`完了: ${runLabel(r)}`); else toast('収集に失敗または中止しました', true);
          reloadAll(); loadRuns(); break;
        }
        if (`${r.status}/${r.enrich_done}` === before) await sleep(3000);
        else if (r.enrich_done % 30 < 6) { loadList(); loadStats(); }
        a = r;
      }
    } finally { state.stepping = false; }
  }
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  function selectById(id) {
    const hit = state.list?.data.find((x) => x.id === id);
    if (hit) { state.selected = hit; renderDetail(); renderList(); return; }
    const p = state.points.find((x) => x.id === id);
    api('GET', `/api/leads?${qs({ q: p?.name || '' })}`).then((d) => {
      state.selected = d.data.find((x) => x.id === id) || null; renderDetail();
    });
  }
  function onSaved(lead) {
    if (state.list) state.list.data = state.list.data.map((x) => (x.id === lead.id ? lead : x));
    state.points = state.points.map((x) => (x.id === lead.id ? { ...x, ...lead } : x));
    if (state.selected?.id === lead.id) state.selected = lead;
    renderList(); renderDetail(); loadStats();
  }

  // ---------------- イベント ----------------
  const srcBoxes = () => $$('input[name="src"]');
  function updateHints() {
    const s = srcBoxes().filter((b) => b.checked).map((b) => b.value);
    const onlyHw = s.length && s.every((x) => x === 'hellowork');
    $('#kw-hint').textContent = onlyHw ? '（空欄で全業種）' : '';
    $('#area-hint').textContent = onlyHw ? '（空欄で全国）' : '';
  }
  srcBoxes().forEach((b) => b.addEventListener('change', updateHints)); updateHints();

  $('#collect-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const sources = srcBoxes().filter((b) => b.checked).map((b) => b.value);
    try {
      const r = await api('POST', '/api/collect', { keyword: $('#keyword').value, area: $('#area').value, sources });
      toast(r.message); state.runs = [r.run, ...state.runs]; renderRuns(); driveRun();
    } catch (err) { toast(err.message, true); }
  });
  $('#enrich-btn').addEventListener('click', async () => {
    try { const r = await api('POST', '/api/enrich-batch'); toast(r.message); state.runs = [r.run, ...state.runs]; renderRuns(); driveRun(); } catch (err) { toast(err.message, true); }
  });
  $('#csv-file').addEventListener('change', async (e) => {
    const f = e.target.files[0]; if (!f) return;
    const fd = new FormData(); fd.append('file', f);
    try { const r = await api('POST', '/api/import-csv', fd, true); toast(r.message); state.runs = [r.run, ...state.runs]; renderRuns(); reloadAll(); driveRun(); } catch (err) { toast(err.message, true); }
    e.target.value = '';
  });
  $('#cancel-btn').addEventListener('click', async () => {
    const a = activeRun(); if (!a || !confirm('処理を中止しますか？（取得済みのデータは残ります）')) return;
    await api('POST', `/api/runs/${a.id}/cancel`).catch(() => {}); loadRuns(); reloadAll();
  });
  $('#search-form').addEventListener('submit', (e) => { e.preventDefault(); setFilters({ q: $('#q').value }); });
  $$('[data-filter]').forEach((el) => el.addEventListener('change', () => setFilters({ [el.dataset.filter]: el.value })));
  $('#runs').addEventListener('click', (e) => { const b = e.target.closest('[data-run]'); if (b) setFilters({ run_id: b.dataset.run }); });
  $$('.view-btn').forEach((b) => b.addEventListener('click', () => {
    state.view = b.dataset.view;
    $$('.view-btn').forEach((x) => x.classList.toggle('active', x === b));
    $('#list-pane').hidden = state.view === 'map'; $('#map-pane').hidden = state.view === 'list';
    $('#grid').classList.toggle('only', state.view !== 'both');
    setTimeout(() => map.invalidateSize(), 50);
  }));
  $('#rows').addEventListener('click', (e) => {
    if (e.target.closest('a, select, .nosel')) return;
    const tr = e.target.closest('tr[data-id]'); if (!tr) return;
    const id = Number(tr.dataset.id);
    state.selected = state.list.data.find((x) => x.id === id); renderDetail(); renderList();
    const m = markers[id]; if (m) { map.setView(m.getLatLng(), Math.max(map.getZoom(), 15)); m.openPopup(); }
    $('#detail').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  });
  $('#rows').addEventListener('change', async (e) => {
    const s = e.target.closest('.status-select'); if (!s) return;
    try { onSaved(await api('PUT', `/api/leads/${s.dataset.id}`, { status: s.value })); } catch (err) { toast(err.message, true); }
  });
  $('#pager').addEventListener('click', (e) => { const b = e.target.closest('[data-page]'); if (b) { state.page = Number(b.dataset.page); loadList(); } });
  $('#detail').addEventListener('click', async (e) => {
    const act = e.target.closest('[data-act]')?.dataset.act; const l = state.selected; if (!act || !l) return;
    if (act === 'close') { state.selected = null; renderDetail(); renderList(); }
    if (act === 'enrich') {
      e.target.disabled = true; e.target.textContent = '取得中…';
      try { onSaved(await api('POST', `/api/leads/${l.id}/enrich`)); toast('再取得しました'); } catch (err) { toast(err.message, true); }
    }
    if (act === 'delete' && confirm(`「${l.name}」をリストから削除しますか？`)) {
      await api('DELETE', `/api/leads/${l.id}`); state.selected = null; renderDetail(); reloadAll(); toast('削除しました');
    }
  });
  $('#detail').addEventListener('submit', async (e) => {
    e.preventDefault(); const l = state.selected;
    const fd = new FormData(e.target); const payload = {};
    for (const [k, v] of fd.entries()) if ((v || '') !== (l[k] || '')) payload[k] = v || null;
    try { onSaved(await api('PUT', `/api/leads/${l.id}`, payload)); toast('保存しました'); } catch (err) { toast(err.message, true); }
  });

  // フィルターの選択肢
  $('select[data-filter="status"]').innerHTML = '<option value="">全ステータス</option>' + Object.entries(STATUS).map(([k, v]) => `<option value="${k}">${v.label}</option>`).join('');
  $('select[data-filter="sns"]').innerHTML = '<option value="">SNS: すべて</option><option value="any">SNSあり</option><option value="none">SNSなし</option>'
    + SNS.map((s) => `<option value="${s.key}">${s.name}あり</option>`).join('');

  reloadAll();
  loadRuns().then(() => { if (activeRun()) driveRun(); });
})();
