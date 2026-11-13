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
  const SOURCE_LABEL = { prtimes: 'PR TIMES', hellowork: 'ハローワーク求人', google: 'Googleマップ', osm: 'OpenStreetMap', csv: 'CSV取り込み', enrich: 'HP・メール調査（続き）' };
  const FOUND_BY = { csv: 'CSV記載', hellowork: 'ハローワーク掲載', google: 'Googleマップ掲載', osm: 'OpenStreetMap', search: 'Web検索で発見' };
  const RUN_STATUS = {
    queued: ['待機中', 'badge-warn'], fetching: ['収集中', 'badge-warn'], enriching: ['調査中', 'badge-warn'],
    done: ['完了', 'badge-ok'], failed: ['失敗/中止', 'badge-ng'],
  };
  const ACTIVE = ['queued', 'fetching', 'enriching'];
  const PHP_STATUS = { eol: 'サポート終了', near_eol: 'サポート終了間近', supported: 'サポート中', unknown: 'バージョン不明' };
  const phpBadge = (x) => {
    if (!x.uses_php) return '';
    const old = x.php_status === 'eol' || x.php_status === 'near_eol';
    const label = `PHP${x.php_version ? ' ' + x.php_version.split('.').slice(0, 2).join('.') : ''}${old ? '・' + PHP_STATUS[x.php_status] : ''}`;
    return `<span class="badge ${old ? 'badge-php-old' : 'badge-php'}" title="${esc((x.cms || '') + ' ' + (x.tech_evidence || ''))}">${esc(label)}</span>`;
  };

  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const num = (n) => (n == null ? '—' : Number(n).toLocaleString());

  const state = {
    filters: { q: '', status: '', website: '', email: '', php: '', sns: '', source: '', run_id: '' },
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
        ${p.uses_php ? `<div style="font-size:12px">${esc('PHP ' + (p.php_version || '') + (PHP_STATUS[p.php_status] && p.php_status !== 'unknown' ? '（' + PHP_STATUS[p.php_status] + '）' : '') + (p.cms ? ' / ' + p.cms : ''))}</div>` : ''}
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
          <div class="sub">${esc(x.category || '')}${x.rating ? ` ・ ★${x.rating}` : ''}${x.job_count ? ` ・ 求人${x.job_count}件` : ''}</div>
          ${x.release_title ? `<div class="sub" title="${esc(x.release_title)}">📰 ${esc(x.release_title.length > 40 ? x.release_title.slice(0, 40) + '…' : x.release_title)}</div>` : ''}</td>
        <td style="min-width:180px"><div style="font-size:12px">${esc(x.address || '—')}</div>${x.phone ? `<div class="sub">${esc(x.phone)}</div>` : ''}</td>
        <td>${x.website ? `<a href="${esc(x.website)}" target="_blank" rel="noopener noreferrer" title="${esc(x.website)}">開く↗</a><div>${phpBadge(x)}</div>`
          : (x.enriched_at ? '<span class="badge badge-ng">なし</span>' : '<span class="sub">未調査</span>')}</td>
        <td class="email">${x.email ? `<a href="mailto:${esc(x.email)}">${esc(x.email)}</a>${x.no_sales_email ? '<div><span class="badge badge-ng" title="サイトに営業メールお断りの表記があるため自動送信しません">営業お断り</span></div>' : ''}` : `<span class="muted">${x.enriched_at ? '—' : '未調査'}</span>`}</td>
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
            ${l.category || l.rating || l.job_count ? ' ・ ' : ''}取得元: ${esc(SOURCE_LABEL[l.source] || l.source)}${l.website && l.website_found_by ? ` ・ HP: ${esc(FOUND_BY[l.website_found_by] || l.website_found_by)}` : ''}${l.enriched_at ? '' : ' ・ HP/メール未調査'}</div>
          <div style="margin-top:4px">${esc(l.address || '')}</div>
          ${l.release_title ? `<div class="small" style="margin-top:4px">📰 最新リリース: <a href="${esc(l.release_url || '#')}" target="_blank" rel="noopener noreferrer">${esc(l.release_title)}</a> <span class="muted">${esc(l.release_date || '')}</span></div>` : ''}
          ${l.tech_checked_at ? `<div class="small" style="margin-top:4px">使用技術: ${l.uses_php ? `${phpBadge(l)} ${esc(l.cms || '')} <span class="muted">（根拠: ${esc(l.tech_evidence || '')}）</span>` : '<span class="muted">PHPは検出されませんでした</span>'}</div>` : ''}
          ${l.no_sales_email ? '<div class="small ng-box">⚠ サイトに「営業メールお断り」等の表記があるため、自動送信の対象外です</div>' : ''}
          <div class="links">
            ${l.google_maps_url ? `<a href="${esc(l.google_maps_url)}" target="_blank" rel="noopener noreferrer">📍 Googleマップ</a>` : ''}
            ${l.prtimes_url ? `<a href="${esc(l.prtimes_url)}" target="_blank" rel="noopener noreferrer">📰 PR TIMES企業ページ</a>` : ''}
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
      ['収集済み企業', s.total, '', !f.website && !f.sns && !f.email && !f.php, { website: '', sns: '', email: '', php: '' }],
      ['ホームページなし', s.no_website, '#dc2626', f.website === 'no' && !f.sns, { website: 'no', sns: '', email: '' }],
      ['メールあり', s.with_email, '#0891b2', f.email === 'yes', { email: f.email === 'yes' ? '' : 'yes' }],
      ['SNSあり', s.with_sns, '#e1306c', f.sns === 'any' && !f.website, { sns: 'any', website: '' }],
      ['PHP製サイト', s.php, '#5b21b6', f.php === 'yes', { php: f.php === 'yes' ? '' : 'yes' }],
      ['PHPサポート終了・間近', s.php_old, '#b91c1c', f.php === 'old', { php: f.php === 'old' ? '' : 'old' }],
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

  // =================== メール配信 ===================
  const mail = { data: null, editing: null, ticking: false };
  const VARS = ['会社名', '住所', '業種', 'ホームページ', 'プレスリリース', 'プレスリリースURL', 'PHP状況', 'PHPバージョン', 'CMS', 'CMS補足'];

  $$('.tab').forEach((t) => t.addEventListener('click', () => {
    $$('.tab').forEach((x) => x.classList.toggle('active', x === t));
    $('#pane-leads').hidden = t.dataset.tab !== 'leads';
    $('#pane-mail').hidden = t.dataset.tab !== 'mail';
    if (t.dataset.tab === 'mail') loadMail(); else setTimeout(() => map.invalidateSize(), 50);
  }));

  const loadMail = () => api('GET', '/api/campaigns').then((d) => { mail.data = d; renderMail(); }).catch((e) => toast(e.message, true));

  function renderMail() {
    const d = mail.data; if (!d) return;
    const c = d.config;
    $('#mail-config').innerHTML = c.ready
      ? `<div class="ok-box">✔ メール送信の設定OK（送信元: ${esc(c.from)}／全体で1日最大 ${num(c.daily_limit)}通・${c.interval}秒間隔）</div>
         <div class="small muted">ダッシュボードを開いている間、または常駐ワーカー稼働中に、有効なキャンペーンから1通ずつ自動送信します。新しく条件に合った企業にも自動で送られます。</div>`
      : `<div class="ng-box"><b>メール送信の設定が足りません。</b>サーバーの .env に以下を設定してください：</div>
         <ul class="small">${c.missing.map((m) => `<li>${esc(m)}</li>`).join('')}</ul>
         <div class="small muted">SMTP_HOST / SMTP_PORT / SMTP_USER / SMTP_PASSWORD / MAIL_FROM / SENDER_COMPANY / SENDER_ADDRESS / SENDER_CONTACT / PUBLIC_BASE_URL（詳しくは README）</div>`;
    $('#campaigns').innerHTML = d.campaigns.length ? d.campaigns.map((x) => `<div class="card campaign">
      <div class="head">
        <div><b>${esc(x.name)}</b> <span class="muted small">対象: ${esc(d.targets[x.target])}・1日最大${x.daily_limit}通</span></div>
        <div class="row nowrap">
          <label class="switch"><input type="checkbox" data-toggle="${x.id}" ${x.active ? 'checked' : ''}> 自動送信 ${x.active ? '<span class="badge badge-ok">ON</span>' : '<span class="badge">OFF</span>'}</label>
          <button class="btn btn-secondary btn-sm" data-edit="${x.id}">編集</button>
          <button class="btn btn-danger btn-sm" data-del="${x.id}">削除</button>
        </div>
      </div>
      <div class="nums">
        <span>送信待ち <b>${num(x.stats.pending)}</b></span><span>送信済み <b>${num(x.stats.sent)}</b></span>
        <span>今日 <b>${num(x.stats.sent_today)}</b></span><span>失敗 <b style="color:#dc2626">${num(x.stats.failed)}</b></span>
        <span class="muted">営業お断り表記で除外 ${num(x.stats.blocked_no_sales)}</span>
      </div>
      <div class="small muted">件名: ${esc(x.subject)}</div></div>`).join('')
      : '<div class="card muted">キャンペーンがありません。「＋ 新しいキャンペーン」から作成してください（PHPサイト向けのひな形があります）。</div>';
    $('#mail-log').innerHTML = d.recent.length ? d.recent.map((g) => `<tr><td class="small">${new Date(g.sent_at).toLocaleString('ja-JP')}</td>
      <td class="small">${esc(g.campaign_name || '')}</td><td class="small">${esc(g.lead_name || '')}</td><td class="email">${esc(g.email)}</td>
      <td>${g.status === 'sent' ? '<span class="badge badge-ok">送信</span>' : g.status === 'failed' ? `<span class="badge badge-ng" title="${esc(g.error || '')}">失敗</span>` : `<span class="badge">${esc(g.status)}</span>`}</td></tr>`).join('')
      : '<tr><td colspan="5" class="empty">まだ送信していません</td></tr>';
    $('#suppressed').textContent = `配信停止済みのアドレス: ${num(d.suppressed)}件（これらには今後送信しません）`;
    const anyActive = d.campaigns.some((x) => x.active);
    $('#mail-badge').hidden = !anyActive;
    if (anyActive && c.ready) startTicking();
  }

  function renderEditor() {
    const e = mail.editing; const box = $('#campaign-editor');
    if (!e) { box.innerHTML = ''; return; }
    const d = mail.data;
    box.innerHTML = `<form class="card" id="campaign-form">
      <div class="card-title">${e.id ? 'キャンペーンを編集' : '新しいキャンペーン'}</div>
      <div class="detail-grid">
        <label><span class="label">名前（管理用）</span><input class="input input-sm" name="name" value="${esc(e.name)}" required></label>
        <label><span class="label">送信対象</span><select class="input input-sm" name="target">
          ${Object.entries(d.targets).map(([k, v]) => `<option value="${k}" ${k === e.target ? 'selected' : ''}>${esc(v)}</option>`).join('')}</select></label>
        <label><span class="label">1日の上限（通）</span><input class="input input-sm" type="number" min="1" max="1000" name="daily_limit" value="${e.daily_limit}"></label>
      </div>
      <label class="detail-memo"><span class="label">件名</span><input class="input input-sm" name="subject" value="${esc(e.subject)}" required></label>
      <label class="detail-memo"><span class="label">本文（送信者情報と配信停止リンクは自動で末尾に付きます）</span>
        <textarea class="input" name="body" rows="12" required>${esc(e.body)}</textarea></label>
      <div class="small vars">差し込み: ${VARS.map((v) => `<code data-var="${v}">{${v}}</code>`).join('')}
        <button type="button" class="link" style="color:var(--navy)" id="use-template">選んだ対象のひな形を入れる</button></div>
      <div class="row" style="margin-top:12px">
        <button class="btn btn-primary btn-sm" type="submit">保存</button>
        <button class="btn btn-secondary btn-sm" type="button" id="preview-btn">プレビュー</button>
        <input class="input input-sm auto" id="test-to" type="email" placeholder="テスト送信先（自分のアドレス）">
        <button class="btn btn-secondary btn-sm" type="button" id="test-btn">テスト送信</button>
        <button class="btn btn-ghost btn-sm push" type="button" id="cancel-edit">キャンセル</button>
      </div>
      <div id="preview" style="margin-top:12px"></div>
      <div class="small muted" style="margin-top:8px">保存しただけでは送信されません。一覧の「自動送信」をONにすると送信が始まります。</div>
    </form>`;
  }
  const formData = () => Object.fromEntries(new FormData($('#campaign-form')).entries());

  $('#new-campaign').addEventListener('click', () => {
    const t = mail.data?.templates?.php_old || { subject: '', body: '' };
    mail.editing = { name: 'PHPサポート終了のご案内', target: 'php_old', daily_limit: 50, subject: t.subject, body: t.body };
    renderEditor();
  });
  $('#campaigns').addEventListener('click', async (e) => {
    const ed = e.target.closest('[data-edit]'); const del = e.target.closest('[data-del]');
    if (ed) { mail.editing = { ...mail.data.campaigns.find((x) => x.id === Number(ed.dataset.edit)) }; renderEditor(); $('#campaign-editor').scrollIntoView({ behavior: 'smooth' }); }
    if (del && confirm('このキャンペーンを削除しますか？（送信履歴は残ります）')) { await api('DELETE', `/api/campaigns/${del.dataset.del}`); loadMail(); }
  });
  $('#campaigns').addEventListener('change', async (e) => {
    const t = e.target.closest('[data-toggle]'); if (!t) return;
    if (t.checked) {
      const c = mail.data.campaigns.find((x) => x.id === Number(t.dataset.toggle));
      if (!confirm(`「${c.name}」の自動送信を開始します。\n送信待ち ${c.stats.pending}件に、1日最大${c.daily_limit}通ずつ送られます。よろしいですか？`)) { t.checked = false; return; }
    }
    try { toast((await api('PUT', `/api/campaigns/${t.dataset.toggle}`, { active: t.checked })).message); } catch (err) { toast(err.message, true); }
    loadMail();
  });
  $('#campaign-editor').addEventListener('click', async (e) => {
    const v = e.target.closest('[data-var]');
    if (v) { const ta = $('#campaign-form textarea'); const p = ta.selectionStart; ta.setRangeText(`{${v.dataset.var}}`, p, ta.selectionEnd, 'end'); ta.focus(); }
    if (e.target.id === 'use-template') {
      const t = mail.data.templates[$('#campaign-form [name=target]').value];
      if (t && confirm('件名と本文をひな形で置き換えますか？')) { $('#campaign-form [name=subject]').value = t.subject; $('#campaign-form [name=body]').value = t.body; }
    }
    if (e.target.id === 'cancel-edit') { mail.editing = null; renderEditor(); }
    if (e.target.id === 'preview-btn') {
      try {
        const r = await api('POST', '/api/campaigns/preview', formData());
        $('#preview').innerHTML = `<div class="small muted">差し込み例: ${esc(r.lead)}（${esc(r.to || '')}）</div><div class="preview"><b>件名: ${esc(r.subject)}</b>\n\n${esc(r.body)}</div>`;
      } catch (err) { toast(err.message, true); }
    }
    if (e.target.id === 'test-btn') {
      try { toast((await api('POST', '/api/campaigns/test', { ...formData(), to: $('#test-to').value })).message); } catch (err) { toast(err.message, true); }
    }
  });
  $('#campaign-editor').addEventListener('submit', async (e) => {
    e.preventDefault();
    const body = formData(); const id = mail.editing.id;
    try {
      const r = await api(id ? 'PUT' : 'POST', id ? `/api/campaigns/${id}` : '/api/campaigns', body);
      toast(r.message); mail.editing = null; renderEditor(); loadMail();
    } catch (err) { toast(err.message, true); }
  });

  // 有効なキャンペーンがある間、定期的に 1 通ずつ送る
  async function startTicking() {
    if (mail.ticking) return;
    mail.ticking = true;
    try {
      for (;;) {
        let r;
        try { r = await api('POST', '/api/mail/tick'); } catch { r = {}; }
        if (r.status) { if (!$('#pane-mail').hidden) loadMail(); }
        if (r.reason === 'nothing' || r.reason === 'not_configured') {
          const d = await api('GET', '/api/campaigns').catch(() => null);
          if (d) { mail.data = d; if (!$('#pane-mail').hidden) renderMail(); }
          if (!d || !d.campaigns.some((x) => x.active && x.stats.pending)) break;
        }
        await sleep(r.reason === 'daily_limit' ? 600000 : Math.max(5, mail.data?.config?.interval || 20) * 1000);
      }
    } finally { mail.ticking = false; }
  }

  reloadAll();
  loadRuns().then(() => { if (activeRun()) driveRun(); });
  api('GET', '/api/campaigns').then((d) => { mail.data = d; $('#mail-badge').hidden = !d.campaigns.some((x) => x.active); if (d.config.ready && d.campaigns.some((x) => x.active)) startTicking(); }).catch(() => {});
})();
