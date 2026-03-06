// nearby-explore.js — Voyage Nearby Now + Route Optimizer
// Two features in one module:
//   1. window.NearbyNow.open(destination)       — AI-powered nearby spot discovery
//   2. window.RouteOptimizer.open(activities)   — day optimizer with Leaflet map route
//
// Drop alongside ui.js and add <script src="nearby-explore.js"></script> before ui.js
// Requires: Leaflet already loaded (it's in index.html), Anthropic API via /api/ai-day-tips

(function () {
  'use strict';

  // ─── Shared styles ──────────────────────────────────────────────────────────
  if (!document.getElementById('_ne_styles')) {
    const s = document.createElement('style');
    s.id = '_ne_styles';
    s.textContent = `
@import url('https://fonts.googleapis.com/css2?family=Fraunces:ital,wght@0,400;0,600;1,400&family=DM+Sans:wght@300;400;500;600&display=swap');

/* ══ SHARED OVERLAY ══ */
.ne-overlay {
  display:none; position:fixed; inset:0; z-index:9000;
  background:rgba(10,9,8,.82);
  backdrop-filter:blur(10px); -webkit-backdrop-filter:blur(10px);
  align-items:center; justify-content:center; padding:16px;
}
.ne-overlay.open { display:flex; animation:ne-fade .22s ease; }
@keyframes ne-fade { from{opacity:0} to{opacity:1} }

/* ══ SHARED PANEL ══ */
.ne-panel {
  width:100%; max-width:720px; max-height:92vh;
  background:#faf9f7; border-radius:24px;
  border:1px solid #e8e4df;
  box-shadow:0 32px 80px rgba(26,24,22,.22);
  display:flex; flex-direction:column; overflow:hidden;
  animation:ne-up .35s cubic-bezier(.16,1,.3,1);
}
@keyframes ne-up { from{opacity:0;transform:translateY(24px) scale(.97)} to{opacity:1;transform:none} }

/* ══ PANEL HEADER ══ */
.ne-header {
  padding:20px 22px 16px;
  border-bottom:1px solid #e8e4df;
  flex-shrink:0;
  background:#fff;
}
.ne-header-row {
  display:flex; align-items:flex-start; justify-content:space-between; gap:12px;
}
.ne-eyebrow {
  font-family:'DM Sans',sans-serif; font-size:10px; font-weight:700;
  letter-spacing:.12em; text-transform:uppercase; color:#d97757; margin-bottom:3px;
}
.ne-title {
  font-family:'Fraunces',serif; font-size:22px; font-weight:600;
  color:#1a1816; letter-spacing:-.3px; line-height:1.2;
}
.ne-subtitle {
  font-family:'DM Sans',sans-serif; font-size:12px;
  color:#9c958f; margin-top:3px;
}
.ne-close {
  width:32px; height:32px; border-radius:50%;
  border:1px solid #e8e4df; background:#faf9f7;
  color:#9c958f; cursor:pointer; font-size:18px;
  display:flex; align-items:center; justify-content:center;
  flex-shrink:0; transition:all .2s; line-height:1;
}
.ne-close:hover { background:#f5f3f0; color:#1a1816; }

/* ══ CATEGORY PILLS ══ */
.ne-pills-wrap { display:flex; flex-wrap:wrap; gap:6px; margin-top:14px; }
.ne-pill {
  padding:5px 13px; border-radius:18px;
  background:#faf9f7; border:1px solid #e8e4df;
  color:#6b6460; font-family:'DM Sans',sans-serif; font-size:12px; font-weight:500;
  cursor:pointer; transition:all .18s; display:flex; align-items:center; gap:5px;
  user-select:none;
}
.ne-pill:hover { border-color:#d6cfc7; color:#1a1816; }
.ne-pill.on { background:#fef3ee; border-color:#d97757; color:#d97757; font-weight:600; }

/* ══ SEARCH / ACTION BAR ══ */
.ne-action-bar {
  display:flex; gap:8px; margin-top:14px;
}
.ne-input-wrap { position:relative; flex:1; }
.ne-input-icon {
  position:absolute; left:11px; top:50%; transform:translateY(-50%);
  font-size:13px; pointer-events:none; color:#9c958f;
}
.ne-input {
  width:100%; padding:9px 12px 9px 33px;
  background:#faf9f7; border:1px solid #e8e4df;
  border-radius:10px; color:#1a1816;
  font-family:'DM Sans',sans-serif; font-size:13px; outline:none;
  transition:border-color .2s, background .2s;
}
.ne-input:focus { border-color:#d97757; background:#fff; }
.ne-input::placeholder { color:#c5bdb6; }
.ne-btn-primary {
  padding:9px 18px; border-radius:10px;
  background:#d97757; border:none; color:#fff;
  font-family:'DM Sans',sans-serif; font-size:13px; font-weight:600;
  cursor:pointer; transition:all .22s; white-space:nowrap; flex-shrink:0;
}
.ne-btn-primary:hover:not(:disabled) { background:#c9674a; transform:translateY(-1px); box-shadow:0 4px 12px rgba(217,119,87,.35); }
.ne-btn-primary:disabled { opacity:.5; cursor:not-allowed; }
.ne-btn-secondary {
  padding:9px 16px; border-radius:10px;
  background:#faf9f7; border:1px solid #e8e4df; color:#6b6460;
  font-family:'DM Sans',sans-serif; font-size:13px; font-weight:500;
  cursor:pointer; transition:all .18s; flex-shrink:0;
}
.ne-btn-secondary:hover { background:#f5f3f0; border-color:#d6cfc7; color:#1a1816; }

/* ══ SCROLLABLE BODY ══ */
.ne-body {
  flex:1; overflow-y:auto; padding:0;
  scrollbar-width:thin; scrollbar-color:#e8e4df transparent;
}
.ne-body::-webkit-scrollbar { width:4px; }
.ne-body::-webkit-scrollbar-thumb { background:#e8e4df; border-radius:2px; }

/* ══ LOADING STATE ══ */
.ne-loading {
  padding:60px 24px; text-align:center;
}
.ne-spinner {
  width:36px; height:36px; margin:0 auto 16px;
  border:3px solid #e8e4df; border-top-color:#d97757;
  border-radius:50%; animation:ne-spin 0.8s linear infinite;
}
@keyframes ne-spin { to{transform:rotate(360deg)} }
.ne-loading-txt {
  font-family:'Fraunces',serif; font-style:italic;
  font-size:15px; color:#9c958f;
}

/* ══ SPOT CARDS (Nearby Now) ══ */
.nn-grid {
  display:grid; grid-template-columns:1fr 1fr;
  gap:12px; padding:18px 20px;
}
@media(max-width:540px){ .nn-grid{grid-template-columns:1fr;} }

.nn-card {
  background:#fff; border:1px solid #e8e4df; border-radius:16px;
  overflow:hidden; cursor:pointer; transition:all .22s;
  animation:ne-card-in .35s ease both;
  position:relative;
}
@keyframes ne-card-in { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:none} }
.nn-card:hover { transform:translateY(-3px); box-shadow:0 8px 24px rgba(26,24,22,.1); border-color:#d6cfc7; }
.nn-card.selected { border-color:#d97757; box-shadow:0 0 0 2px rgba(217,119,87,.2); }

.nn-card-thumb {
  height:90px; display:flex; align-items:center; justify-content:center;
  font-size:40px; position:relative; overflow:hidden;
  background:linear-gradient(135deg,#fef3ee,#f3e8e3);
}
.nn-card-thumb.food   { background:linear-gradient(135deg,#fff8f0,#fde8d0); }
.nn-card-thumb.nature { background:linear-gradient(135deg,#f0faf0,#d8f0d8); }
.nn-card-thumb.culture{ background:linear-gradient(135deg,#f0f0fa,#d8d8f0); }
.nn-card-thumb.cafe   { background:linear-gradient(135deg,#fdf8f0,#f5e8d0); }
.nn-card-thumb.nightlife{ background:linear-gradient(135deg,#0d0d1a,#1a1a2e); }
.nn-card-thumb.nightlife .nn-card-emoji { filter:drop-shadow(0 0 8px rgba(217,119,87,.6)); }

.nn-card-emoji { font-size:38px; z-index:1; }
.nn-card-dist-badge {
  position:absolute; top:8px; right:8px;
  background:rgba(255,255,255,.9); backdrop-filter:blur(4px);
  border:1px solid #e8e4df; border-radius:8px;
  font-family:'DM Sans',sans-serif; font-size:10px; font-weight:600;
  color:#6b6460; padding:2px 7px;
}
.nn-card-body { padding:12px 14px 14px; }
.nn-card-category {
  font-family:'DM Sans',sans-serif; font-size:10px; font-weight:700;
  letter-spacing:.08em; text-transform:uppercase;
  color:#d97757; margin-bottom:3px;
}
.nn-card-name {
  font-family:'Fraunces',serif; font-size:14px; font-weight:600;
  color:#1a1816; line-height:1.3; margin-bottom:4px;
}
.nn-card-desc {
  font-family:'DM Sans',sans-serif; font-size:11px;
  color:#9c958f; line-height:1.5;
}
.nn-card-tags { display:flex; flex-wrap:wrap; gap:4px; margin-top:8px; }
.nn-card-tag {
  font-family:'DM Sans',sans-serif; font-size:10px;
  color:#6b6460; background:#faf9f7; border:1px solid #e8e4df;
  border-radius:6px; padding:2px 7px;
}
.nn-card-check {
  position:absolute; top:8px; left:8px;
  width:22px; height:22px; border-radius:50%;
  background:#d97757; display:flex; align-items:center; justify-content:center;
  color:#fff; font-size:12px; font-weight:700;
  opacity:0; transform:scale(.7); transition:all .18s;
}
.nn-card.selected .nn-card-check { opacity:1; transform:scale(1); }

/* ══ FOOTER BAR (Nearby Now) ══ */
.nn-footer {
  flex-shrink:0; padding:14px 20px;
  border-top:1px solid #e8e4df; background:#fff;
  display:flex; align-items:center; justify-content:space-between; gap:10px;
}
.nn-footer-count {
  font-family:'DM Sans',sans-serif; font-size:13px; color:#6b6460;
}
.nn-footer-count strong { color:#1a1816; }
.nn-footer-actions { display:flex; gap:8px; }

/* ══ ROUTE OPTIMIZER STYLES ══ */
.ro-body-inner { padding:0; display:flex; flex-direction:column; }

/* Map container */
.ro-map-wrap {
  height:260px; flex-shrink:0; position:relative; background:#e8e4df;
  overflow:hidden;
}
.ro-map-wrap #ro-map { height:100%; width:100%; }
.ro-map-overlay {
  position:absolute; inset:0; display:flex; align-items:center; justify-content:center;
  background:linear-gradient(135deg,#fef3ee,#f3e8e3);
  flex-direction:column; gap:8px;
  font-family:'DM Sans',sans-serif; font-size:13px; color:#9c958f;
}
.ro-map-overlay-icon { font-size:36px; }

/* Stats strip */
.ro-stats {
  display:flex; gap:0; border-bottom:1px solid #e8e4df;
  flex-shrink:0; background:#fff;
}
.ro-stat {
  flex:1; padding:12px 14px; text-align:center;
  border-right:1px solid #e8e4df;
}
.ro-stat:last-child { border-right:none; }
.ro-stat-val {
  font-family:'Fraunces',serif; font-size:20px; font-weight:600;
  color:#1a1816; line-height:1;
}
.ro-stat-lbl {
  font-family:'DM Sans',sans-serif; font-size:10px; font-weight:600;
  letter-spacing:.07em; text-transform:uppercase; color:#9c958f;
  margin-top:3px;
}

/* Activities list */
.ro-list { padding:16px 20px 24px; }
.ro-list-label {
  font-family:'DM Sans',sans-serif; font-size:10px; font-weight:700;
  letter-spacing:.1em; text-transform:uppercase; color:#9c958f; margin-bottom:12px;
  display:flex; align-items:center; gap:6px;
}
.ro-list-label span { color:#d97757; }

.ro-item {
  display:flex; align-items:flex-start; gap:12px;
  padding:12px 14px; border-radius:14px;
  border:1px solid #e8e4df; background:#fff;
  margin-bottom:8px; transition:all .2s;
  animation:ne-card-in .35s ease both;
  position:relative;
}
.ro-item:hover { border-color:#d6cfc7; background:#faf9f7; }

.ro-item-num {
  width:28px; height:28px; border-radius:50%; flex-shrink:0;
  background:#d97757; color:#fff;
  font-family:'DM Sans',sans-serif; font-size:12px; font-weight:700;
  display:flex; align-items:center; justify-content:center;
  margin-top:1px;
}
.ro-item-emoji { font-size:22px; flex-shrink:0; margin-top:2px; }
.ro-item-body { flex:1; min-width:0; }
.ro-item-time {
  font-family:'DM Sans',sans-serif; font-size:10px; font-weight:700;
  letter-spacing:.07em; text-transform:uppercase; color:#d97757; margin-bottom:1px;
}
.ro-item-name {
  font-family:'DM Sans',sans-serif; font-size:14px; font-weight:600;
  color:#1a1816; line-height:1.3;
}
.ro-item-desc {
  font-family:'DM Sans',sans-serif; font-size:11px;
  color:#9c958f; line-height:1.5; margin-top:2px;
}
.ro-item-walk {
  display:flex; align-items:center; gap:4px;
  font-family:'DM Sans',sans-serif; font-size:11px; color:#5b9aa9;
  margin-top:5px;
}
.ro-connector {
  display:flex; align-items:center; gap:8px;
  padding:4px 14px 4px 54px;
  font-family:'DM Sans',sans-serif; font-size:11px; color:#9c958f;
}
.ro-connector-line {
  flex:1; height:1px; background:repeating-linear-gradient(
    90deg, #e8e4df 0, #e8e4df 4px, transparent 4px, transparent 8px
  );
}

/* ══ EMPTY / ERROR STATES ══ */
.ne-empty {
  padding:48px 24px; text-align:center;
  font-family:'DM Sans',sans-serif; font-size:13px; color:#9c958f;
}
.ne-empty-icon { font-size:40px; margin-bottom:10px; opacity:.5; }
.ne-empty-title { font-family:'Fraunces',serif; font-size:17px; color:#1a1816; margin-bottom:6px; }

/* ══ LOCATION PERMISSION BANNER ══ */
.nn-loc-banner {
  margin:16px 20px 0; padding:12px 16px;
  background:#fef3ee; border:1px solid rgba(217,119,87,.25); border-radius:12px;
  display:flex; align-items:center; gap:10px;
  font-family:'DM Sans',sans-serif; font-size:12px; color:#6b6460;
}
.nn-loc-banner-icon { font-size:18px; flex-shrink:0; }
.nn-loc-banner-text strong { color:#d97757; }
.nn-loc-banner button {
  margin-left:auto; padding:5px 12px; border-radius:8px;
  background:#d97757; border:none; color:#fff;
  font-family:'DM Sans',sans-serif; font-size:11px; font-weight:600;
  cursor:pointer; flex-shrink:0; transition:all .18s;
}
.nn-loc-banner button:hover { background:#c9674a; }

/* ══ LEAFLET OVERRIDES for Route map ══ */
.ro-map-wrap .leaflet-container { border-radius:0; }
.ro-map-wrap .leaflet-popup-content-wrapper {
  border-radius:10px; box-shadow:0 4px 16px rgba(26,24,22,.12);
  font-family:'DM Sans',sans-serif; font-size:12px;
}
    `;
    document.head.appendChild(s);
  }

  // ══════════════════════════════════════════════════════════════════════════
  // ─── NEARBY NOW ────────────────────────────────────────────────────────
  // ══════════════════════════════════════════════════════════════════════════
  (function NearbyNow() {

    const CATEGORIES = [
      { id:'food',      label:'Food & Drink', emoji:'🍜' },
      { id:'cafe',      label:'Cafés',        emoji:'☕' },
      { id:'culture',   label:'Culture',      emoji:'🏛️' },
      { id:'nature',    label:'Parks & Nature',emoji:'🌿' },
      { id:'shopping',  label:'Shopping',     emoji:'🛍️' },
      { id:'nightlife', label:'Nightlife',    emoji:'🌙' },
      { id:'hidden',    label:'Hidden Gems',  emoji:'💎' },
    ];

    let _destination = '';
    let _userLat = null, _userLng = null;
    let _selectedCats = new Set(['food','cafe','hidden']);
    let _spots = [];
    let _selectedSpots = new Set();

    // Build DOM
    const overlay = document.createElement('div');
    overlay.className = 'ne-overlay';
    overlay.id = 'nn-overlay';
    overlay.innerHTML = `
      <div class="ne-panel" id="nn-panel" style="max-width:680px">
        <div class="ne-header">
          <div class="ne-header-row">
            <div>
              <div class="ne-eyebrow">📍 Nearby Now</div>
              <div class="ne-title" id="nn-title">Exploring nearby…</div>
              <div class="ne-subtitle" id="nn-subtitle">AI-curated spots close to you right now</div>
            </div>
            <button class="ne-close" id="nn-close">×</button>
          </div>
          <div id="nn-loc-banner-wrap"></div>
          <div class="ne-pills-wrap" id="nn-pills"></div>
          <div class="ne-action-bar">
            <div class="ne-input-wrap">
              <span class="ne-input-icon">🔍</span>
              <input id="nn-area" class="ne-input" type="text"
                placeholder="Specific area, street, or landmark…" autocomplete="off">
            </div>
            <button class="ne-btn-primary" id="nn-discover">Discover</button>
          </div>
        </div>
        <div class="ne-body" id="nn-body">
          <div class="ne-empty">
            <div class="ne-empty-icon">🗺️</div>
            <div class="ne-empty-title">Ready to explore?</div>
            <div>Pick your mood, then hit Discover</div>
          </div>
        </div>
        <div class="nn-footer" id="nn-footer" style="display:none">
          <div class="nn-footer-count" id="nn-count">0 spots found</div>
          <div class="nn-footer-actions">
            <button class="ne-btn-secondary" id="nn-route-btn" style="display:none">🗺️ Optimize Route</button>
            <button class="ne-btn-primary" id="nn-save-btn" style="display:none">+ Add to Day</button>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);

    // Build category pills
    const pillsEl = document.getElementById('nn-pills');
    CATEGORIES.forEach(c => {
      const btn = document.createElement('button');
      btn.className = 'ne-pill' + (_selectedCats.has(c.id) ? ' on' : '');
      btn.dataset.id = c.id;
      btn.innerHTML = `<span>${c.emoji}</span>${c.label}`;
      btn.addEventListener('click', () => {
        if (_selectedCats.has(c.id)) { _selectedCats.delete(c.id); btn.classList.remove('on'); }
        else { _selectedCats.add(c.id); btn.classList.add('on'); }
      });
      pillsEl.appendChild(btn);
    });

    document.getElementById('nn-close').addEventListener('click', closeNN);
    overlay.addEventListener('click', e => { if (e.target === overlay) closeNN(); });
    document.getElementById('nn-discover').addEventListener('click', discover);
    document.getElementById('nn-area').addEventListener('keydown', e => { if (e.key === 'Enter') discover(); });

    // Route button — hands off selected spots to RouteOptimizer
    document.getElementById('nn-route-btn').addEventListener('click', () => {
      const sel = _spots.filter(s => _selectedSpots.has(s._id));
      if (!sel.length) { alert('Select at least one spot to optimise a route!'); return; }
      closeNN();
      const acts = sel.map(s => ({
        emoji: s.emoji,
        title: s.name,
        description: s.description,
        time: s.bestTime || 'Anytime',
        lat: s.lat, lng: s.lng,
      }));
      window.RouteOptimizer.open(acts, _destination, _userLat, _userLng);
    });

    // Save to day — calls optional callback
    document.getElementById('nn-save-btn').addEventListener('click', () => {
      const sel = _spots.filter(s => _selectedSpots.has(s._id));
      if (typeof window._nnOnSave === 'function') window._nnOnSave(sel);
      else {
        const text = sel.map(s => `${s.emoji} ${s.name}: ${s.description}`).join('\n');
        navigator.clipboard.writeText(text).catch(() => {});
        alert(`${sel.length} spot(s) copied to clipboard!`);
      }
      closeNN();
    });

    function openNN(destination, userLat, userLng, onSave) {
      _destination = destination || 'your destination';
      _userLat = userLat || null;
      _userLng = userLng || null;
      window._nnOnSave = onSave || null;
      _spots = [];
      _selectedSpots.clear();

      document.getElementById('nn-title').textContent = _destination;
      document.getElementById('nn-subtitle').textContent = 'AI-curated spots close to you right now';
      document.getElementById('nn-area').value = '';
      document.getElementById('nn-body').innerHTML = `
        <div class="ne-empty">
          <div class="ne-empty-icon">🗺️</div>
          <div class="ne-empty-title">Ready to explore?</div>
          <div>Pick your mood, then hit Discover</div>
        </div>`;
      document.getElementById('nn-footer').style.display = 'none';

      // Show location banner if no GPS
      const bannerWrap = document.getElementById('nn-loc-banner-wrap');
      if (!userLat) {
        bannerWrap.innerHTML = `
          <div class="nn-loc-banner">
            <span class="nn-loc-banner-icon">📡</span>
            <div class="nn-loc-banner-text">
              <strong>Share your location</strong> for hyper-local suggestions
            </div>
            <button onclick="window.NearbyNow._requestLocation()">Allow</button>
          </div>`;
      } else {
        bannerWrap.innerHTML = `
          <div class="nn-loc-banner" style="background:#f0faf0;border-color:rgba(46,125,50,.2)">
            <span class="nn-loc-banner-icon">✅</span>
            <div class="nn-loc-banner-text">
              <strong style="color:#2e7d32">Location active</strong> — showing spots near you
            </div>
          </div>`;
      }

      overlay.classList.add('open');
      document.body.style.overflow = 'hidden';
      setTimeout(() => document.getElementById('nn-area').focus(), 350);
    }

    function closeNN() {
      overlay.classList.remove('open');
      document.body.style.overflow = '';
    }

    async function discover() {
      const btn   = document.getElementById('nn-discover');
      const body  = document.getElementById('nn-body');
      const area  = document.getElementById('nn-area').value.trim();
      const cats  = Array.from(_selectedCats);

      if (!cats.length) { alert('Pick at least one category!'); return; }

      btn.disabled = true; btn.textContent = '…';
      _selectedSpots.clear();
      _spots = [];

      body.innerHTML = `
        <div class="ne-loading">
          <div class="ne-spinner"></div>
          <div class="ne-loading-txt">Scouting the best spots${area ? ' around ' + area : ' in ' + _destination}…</div>
        </div>`;
      document.getElementById('nn-footer').style.display = 'none';

      const categoryLabels = {
        food:'restaurants, street food, food markets, local eateries',
        cafe:'cafés, coffee shops, tea houses, bakeries',
        culture:'museums, galleries, historic sites, local landmarks',
        nature:'parks, gardens, viewpoints, natural areas, waterfronts',
        shopping:'local markets, boutiques, souvenir shops, artisan stores',
        nightlife:'bars, pubs, live music venues, evening hangouts',
        hidden:'off-the-beaten-path gems, local secrets, underrated spots',
      };

      const catText = cats.map(c => categoryLabels[c]).join('; ');
      const locNote = _userLat ? `The user is currently at coordinates ${_userLat.toFixed(4)}, ${_userLng.toFixed(4)}.` : '';
      const areaNote = area ? `They specifically want spots around: ${area}.` : '';

      const prompt = `You are a local expert for ${_destination}. Suggest 8 specific, real nearby spots to visit right now.

Categories to focus on: ${catText}.
${locNote}
${areaNote}

Return ONLY a JSON array of 8 spots. Each spot:
{
  "name": "Exact place name",
  "category": "food|cafe|culture|nature|shopping|nightlife|hidden",
  "emoji": "single emoji",
  "description": "2 sentences — what makes it special, specific details",
  "bestTime": "Morning|Afternoon|Evening|Anytime",
  "walkTime": "~5 min|~10 min|~15 min|~20 min",
  "insiderTip": "One short insider tip",
  "tags": ["tag1","tag2","tag3"],
  "lat": approximate_latitude_number,
  "lng": approximate_longitude_number
}

Use REAL place names. Vary the distance. Mix famous and hidden. No markdown, just the JSON array.`;

      try {
        const resp = await fetch('/api/ai-day-tips', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            _packingRequest: true,
            prompt,
          }),
        });
        if (!resp.ok) throw new Error('api');
        const data = await resp.json();
        _spots = Array.isArray(data) ? data : (data.spots || []);
        _spots.forEach((s, i) => s._id = i);
        _renderSpots();
      } catch {
        body.innerHTML = `<div class="ne-empty"><div class="ne-empty-icon">😕</div><div class="ne-empty-title">Couldn't load spots</div><div>Check your connection and try again</div></div>`;
      }

      btn.disabled = false; btn.textContent = 'Discover';
    }

    function _renderSpots() {
      const body  = document.getElementById('nn-body');
      const footer = document.getElementById('nn-footer');
      const count = document.getElementById('nn-count');

      if (!_spots.length) {
        body.innerHTML = `<div class="ne-empty"><div class="ne-empty-icon">🔭</div><div class="ne-empty-title">No spots found</div><div>Try different categories or a different area</div></div>`;
        footer.style.display = 'none';
        return;
      }

      const grid = document.createElement('div');
      grid.className = 'nn-grid';

      _spots.forEach((s, i) => {
        const card = document.createElement('div');
        card.className = 'nn-card';
        card.style.animationDelay = `${i * 0.06}s`;
        card.innerHTML = `
          <div class="nn-card-check">✓</div>
          <div class="nn-card-thumb ${s.category}">
            <span class="nn-card-emoji">${s.emoji || '📍'}</span>
            <span class="nn-card-dist-badge">🚶 ${s.walkTime || '~10 min'}</span>
          </div>
          <div class="nn-card-body">
            <div class="nn-card-category">${s.category}</div>
            <div class="nn-card-name">${s.name}</div>
            <div class="nn-card-desc">${s.description}</div>
            ${s.insiderTip ? `<div class="nn-card-desc" style="margin-top:6px;color:#5b9aa9">💡 ${s.insiderTip}</div>` : ''}
            <div class="nn-card-tags">${(s.tags||[]).map(t => `<span class="nn-card-tag">${t}</span>`).join('')}</div>
          </div>
        `;
        card.addEventListener('click', () => {
          if (_selectedSpots.has(s._id)) {
            _selectedSpots.delete(s._id);
            card.classList.remove('selected');
          } else {
            _selectedSpots.add(s._id);
            card.classList.add('selected');
          }
          _updateFooter();
        });
        grid.appendChild(card);
      });

      body.innerHTML = '';
      body.appendChild(grid);
      footer.style.display = 'flex';
      count.innerHTML = `<strong>${_spots.length}</strong> spots found`;
      document.getElementById('nn-route-btn').style.display = 'none';
      document.getElementById('nn-save-btn').style.display = 'none';
    }

    function _updateFooter() {
      const n = _selectedSpots.size;
      const count = document.getElementById('nn-count');
      count.innerHTML = n
        ? `<strong>${n}</strong> spot${n > 1 ? 's' : ''} selected`
        : `<strong>${_spots.length}</strong> spots found`;
      document.getElementById('nn-route-btn').style.display  = n >= 2 ? 'flex' : 'none';
      document.getElementById('nn-save-btn').style.display   = n >= 1 ? 'flex' : 'none';
    }

    function _requestLocation() {
      navigator.geolocation?.getCurrentPosition(pos => {
        _userLat = pos.coords.latitude;
        _userLng = pos.coords.longitude;
        const bannerWrap = document.getElementById('nn-loc-banner-wrap');
        if (bannerWrap) {
          bannerWrap.innerHTML = `
            <div class="nn-loc-banner" style="background:#f0faf0;border-color:rgba(46,125,50,.2)">
              <span class="nn-loc-banner-icon">✅</span>
              <div class="nn-loc-banner-text">
                <strong style="color:#2e7d32">Location active</strong> — showing spots near you
              </div>
            </div>`;
        }
      }, () => {
        alert('Location access denied. You can still search by area name.');
      });
    }

    window.NearbyNow = { open: openNN, close: closeNN, _requestLocation };
  })();

  // ══════════════════════════════════════════════════════════════════════════
  // ─── ROUTE OPTIMIZER ───────────────────────────────────────────────────
  // ══════════════════════════════════════════════════════════════════════════
  (function RouteOptimizer() {

    let _destination = '';
    let _userLat = null, _userLng = null;
    let _activities = [];
    let _optimized = [];
    let _map = null;
    let _routeLayer = null;

    // Build DOM
    const overlay = document.createElement('div');
    overlay.className = 'ne-overlay';
    overlay.id = 'ro-overlay';
    overlay.innerHTML = `
      <div class="ne-panel" id="ro-panel" style="max-width:720px">
        <div class="ne-header">
          <div class="ne-header-row">
            <div>
              <div class="ne-eyebrow">🗺️ Route Optimizer</div>
              <div class="ne-title" id="ro-title">Optimizing your day…</div>
              <div class="ne-subtitle" id="ro-subtitle">Best walking order with estimated times</div>
            </div>
            <button class="ne-close" id="ro-close">×</button>
          </div>
          <div class="ne-action-bar" style="margin-top:14px">
            <div class="ne-input-wrap">
              <span class="ne-input-icon">🏁</span>
              <input id="ro-start" class="ne-input" type="text"
                placeholder="Starting point (hotel, station, address…)" autocomplete="off">
            </div>
            <button class="ne-btn-primary" id="ro-optimize">Optimize</button>
            <button class="ne-btn-secondary" id="ro-add">+ Add Stop</button>
          </div>
        </div>
        <div class="ne-body" id="ro-body">
          <div class="ro-body-inner" id="ro-inner">
            <div class="ro-map-wrap">
              <div id="ro-map-placeholder" class="ro-map-overlay">
                <div class="ro-map-overlay-icon">🗺️</div>
                <div>Map loads after optimization</div>
              </div>
              <div id="ro-map" style="display:none"></div>
            </div>
            <div class="ro-stats" id="ro-stats" style="display:none">
              <div class="ro-stat">
                <div class="ro-stat-val" id="ro-stat-stops">–</div>
                <div class="ro-stat-lbl">Stops</div>
              </div>
              <div class="ro-stat">
                <div class="ro-stat-val" id="ro-stat-walk">–</div>
                <div class="ro-stat-lbl">Walk total</div>
              </div>
              <div class="ro-stat">
                <div class="ro-stat-val" id="ro-stat-hours">–</div>
                <div class="ro-stat-lbl">Day length</div>
              </div>
              <div class="ro-stat">
                <div class="ro-stat-val" id="ro-stat-score">–</div>
                <div class="ro-stat-lbl">Efficiency</div>
              </div>
            </div>
            <div class="ro-list" id="ro-list">
              <div class="ne-empty">
                <div class="ne-empty-icon">🏃</div>
                <div class="ne-empty-title">Add your stops</div>
                <div>Enter activities, then hit Optimize to get the best route</div>
              </div>
            </div>
          </div>
        </div>
        <div class="nn-footer" id="ro-footer" style="display:none">
          <div class="nn-footer-count" id="ro-footer-label">Route ready</div>
          <div class="nn-footer-actions">
            <button class="ne-btn-secondary" id="ro-copy">📋 Copy Route</button>
            <button class="ne-btn-primary" id="ro-save">💾 Save to Day</button>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);

    // Add stop modal (simple inline)
    const addModal = document.createElement('div');
    addModal.id = 'ro-add-modal';
    addModal.style.cssText = 'display:none;position:fixed;inset:0;z-index:10000;background:rgba(10,9,8,.6);backdrop-filter:blur(6px);align-items:center;justify-content:center;padding:16px;';
    addModal.innerHTML = `
      <div style="background:#fff;border-radius:18px;padding:24px;max-width:400px;width:100%;box-shadow:0 20px 60px rgba(26,24,22,.2);animation:ne-up .3s ease;">
        <div style="font-family:'Fraunces',serif;font-size:18px;font-weight:600;color:#1a1816;margin-bottom:16px;">+ Add a Stop</div>
        <input id="ro-add-name" class="ne-input" style="width:100%;margin-bottom:10px;" placeholder="Place name (e.g. Eiffel Tower)">
        <input id="ro-add-time" class="ne-input" style="width:100%;margin-bottom:10px;" placeholder="Suggested time slot (e.g. Morning, 2pm…)">
        <input id="ro-add-emoji" class="ne-input" style="width:100%;margin-bottom:16px;" placeholder="Emoji (optional, e.g. 🏛️)">
        <div style="display:flex;gap:8px;justify-content:flex-end;">
          <button class="ne-btn-secondary" id="ro-add-cancel">Cancel</button>
          <button class="ne-btn-primary" id="ro-add-confirm">Add Stop</button>
        </div>
      </div>
    `;
    document.body.appendChild(addModal);

    document.getElementById('ro-close').addEventListener('click', closeRO);
    overlay.addEventListener('click', e => { if (e.target === overlay) closeRO(); });
    document.getElementById('ro-optimize').addEventListener('click', optimize);
    document.getElementById('ro-add').addEventListener('click', () => {
      addModal.style.display = 'flex';
      setTimeout(() => document.getElementById('ro-add-name').focus(), 50);
    });
    document.getElementById('ro-add-cancel').addEventListener('click', () => { addModal.style.display = 'none'; });
    document.getElementById('ro-add-confirm').addEventListener('click', () => {
      const name  = document.getElementById('ro-add-name').value.trim();
      const time  = document.getElementById('ro-add-time').value.trim();
      const emoji = document.getElementById('ro-add-emoji').value.trim();
      if (!name) return;
      _activities.push({ title: name, time: time || 'Anytime', emoji: emoji || '📍', description: '' });
      _renderActivityList();
      addModal.style.display = 'none';
      document.getElementById('ro-add-name').value = '';
      document.getElementById('ro-add-time').value = '';
      document.getElementById('ro-add-emoji').value = '';
    });

    document.getElementById('ro-copy').addEventListener('click', () => {
      if (!_optimized.length) return;
      const text = _optimized.map((a, i) =>
        `${i + 1}. ${a.emoji || '📍'} ${a.optimizedTime || a.time} — ${a.title}\n   ${a.description || ''}${a.walkToNext ? '\n   🚶 ' + a.walkToNext + ' to next stop' : ''}`
      ).join('\n\n');
      navigator.clipboard.writeText(text).then(() => {
        const btn = document.getElementById('ro-copy');
        btn.textContent = '✓ Copied!';
        setTimeout(() => { btn.textContent = '📋 Copy Route'; }, 2000);
      });
    });

    document.getElementById('ro-save').addEventListener('click', () => {
      if (typeof window._roOnSave === 'function') window._roOnSave(_optimized);
      closeRO();
    });

    function openRO(activities, destination, userLat, userLng, onSave) {
      _destination = destination || 'your destination';
      _userLat = userLat || null;
      _userLng = userLng || null;
      _activities = (activities || []).map(a => ({ ...a }));
      _optimized = [];
      window._roOnSave = onSave || null;

      document.getElementById('ro-title').textContent = _destination;
      document.getElementById('ro-subtitle').textContent = 'Best walking order with estimated times';
      document.getElementById('ro-start').value = '';
      document.getElementById('ro-footer').style.display = 'none';
      document.getElementById('ro-stats').style.display = 'none';

      // Reset map area
      document.getElementById('ro-map').style.display = 'none';
      document.getElementById('ro-map-placeholder').style.display = 'flex';
      if (_map) { _map.remove(); _map = null; _routeLayer = null; }

      _renderActivityList();
      overlay.classList.add('open');
      document.body.style.overflow = 'hidden';
    }

    function closeRO() {
      overlay.classList.remove('open');
      document.body.style.overflow = '';
    }

    function _renderActivityList() {
      const list = document.getElementById('ro-list');
      if (!_activities.length) {
        list.innerHTML = `<div class="ne-empty"><div class="ne-empty-icon">🏃</div><div class="ne-empty-title">No stops yet</div><div>Click "+ Add Stop" to begin building your route</div></div>`;
        return;
      }
      list.innerHTML = `<div class="ro-list-label">✏️ Your stops <span>(drag to reorder after optimizing)</span></div>`;
      _activities.forEach((a, i) => {
        const item = document.createElement('div');
        item.className = 'ro-item';
        item.style.animationDelay = `${i * 0.05}s`;
        item.innerHTML = `
          <div class="ro-item-num">${i + 1}</div>
          <div class="ro-item-emoji">${a.emoji || '📍'}</div>
          <div class="ro-item-body">
            <div class="ro-item-time">${a.time || 'Anytime'}</div>
            <div class="ro-item-name">${a.title}</div>
            ${a.description ? `<div class="ro-item-desc">${a.description}</div>` : ''}
          </div>
          <button onclick="window.RouteOptimizer._removeStop(${i})" style="background:none;border:none;color:#d6cfc7;cursor:pointer;font-size:18px;padding:4px;line-height:1;transition:color .15s;" onmouseover="this.style.color='#c0392b'" onmouseout="this.style.color='#d6cfc7'">×</button>
        `;
        list.appendChild(item);
      });
    }

    async function optimize() {
      if (_activities.length < 2) {
        alert('Add at least 2 stops to optimize a route!');
        return;
      }

      const btn   = document.getElementById('ro-optimize');
      const list  = document.getElementById('ro-list');
      const start = document.getElementById('ro-start').value.trim();

      btn.disabled = true; btn.textContent = '…';

      list.innerHTML = `
        <div class="ne-loading" style="padding:40px 24px">
          <div class="ne-spinner"></div>
          <div class="ne-loading-txt">Calculating the most efficient route…</div>
        </div>`;

      const stopsList = _activities.map((a, i) =>
        `${i + 1}. "${a.title}" (${a.time || 'Anytime'})`
      ).join('\n');

      const prompt = `You are a local navigation expert for ${_destination}. 
${start ? `The traveler starts at: ${start}.` : ''}
${_userLat ? `Their GPS: ${_userLat.toFixed(4)}, ${_userLng.toFixed(4)}.` : ''}

Optimize the visiting order for these ${_activities.length} stops to minimize total walking distance:

${stopsList}

Consider: logical geographic clustering, opening hours, morning/afternoon/evening flow, and avoiding backtracking.

Return ONLY a JSON object:
{
  "optimizedOrder": [0,1,2,...],
  "stops": [
    {
      "originalIndex": 0,
      "title": "Place name",
      "emoji": "emoji",
      "optimizedTime": "9:00 AM",
      "suggestedDuration": "45 min",
      "description": "One sentence why this order and time works",
      "walkToNext": "~8 min walk",
      "lat": approximate_lat,
      "lng": approximate_lng
    }
  ],
  "totalWalkTime": "~35 min total",
  "totalDayLength": "~7 hours",
  "efficiencyScore": "A+",
  "routeTip": "One sentence overall advice for this route"
}

No markdown, just JSON.`;

      try {
        const resp = await fetch('/api/ai-day-tips', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ _packingRequest: true, prompt }),
        });
        if (!resp.ok) throw new Error('api');
        const data = await resp.json();
        _optimized = data.stops || [];
        _renderOptimizedRoute(data);
        _initMap(data);
      } catch {
        list.innerHTML = `<div class="ne-empty"><div class="ne-empty-icon">😕</div><div class="ne-empty-title">Optimization failed</div><div>Check your connection and try again</div></div>`;
      }

      btn.disabled = false; btn.textContent = 'Re-optimize';
    }

    function _renderOptimizedRoute(data) {
      const list  = document.getElementById('ro-list');
      const stats = document.getElementById('ro-stats');
      const footer = document.getElementById('ro-footer');

      // Stats
      document.getElementById('ro-stat-stops').textContent  = _optimized.length;
      document.getElementById('ro-stat-walk').textContent   = data.totalWalkTime || '–';
      document.getElementById('ro-stat-hours').textContent  = data.totalDayLength || '–';
      document.getElementById('ro-stat-score').textContent  = data.efficiencyScore || '–';
      stats.style.display = 'flex';

      // Optimized list
      list.innerHTML = `<div class="ro-list-label">✅ Optimized order <span style="color:#d97757">(efficiency ${data.efficiencyScore || '–'})</span></div>`;
      if (data.routeTip) {
        list.innerHTML += `<div style="background:#fef3ee;border:1px solid rgba(217,119,87,.2);border-radius:10px;padding:10px 14px;margin-bottom:14px;font-family:'DM Sans',sans-serif;font-size:12px;color:#6b6460;line-height:1.5;">💡 ${data.routeTip}</div>`;
      }

      _optimized.forEach((stop, i) => {
        const item = document.createElement('div');
        item.className = 'ro-item';
        item.style.animationDelay = `${i * 0.07}s`;
        item.innerHTML = `
          <div class="ro-item-num">${i + 1}</div>
          <div class="ro-item-emoji">${stop.emoji || '📍'}</div>
          <div class="ro-item-body">
            <div class="ro-item-time">${stop.optimizedTime || ''} · ${stop.suggestedDuration || ''}</div>
            <div class="ro-item-name">${stop.title}</div>
            ${stop.description ? `<div class="ro-item-desc">${stop.description}</div>` : ''}
            ${stop.walkToNext && i < _optimized.length - 1 ? `<div class="ro-item-walk">🚶 ${stop.walkToNext} to next stop</div>` : ''}
          </div>
        `;
        list.appendChild(item);

        // Connector between stops
        if (i < _optimized.length - 1) {
          const conn = document.createElement('div');
          conn.className = 'ro-connector';
          conn.innerHTML = `<div class="ro-connector-line"></div>`;
          list.appendChild(conn);
        }
      });

      footer.style.display = 'flex';
      document.getElementById('ro-footer-label').innerHTML = `<strong>${_optimized.length}</strong> stops · ${data.totalWalkTime || ''}`;
    }

    function _initMap(data) {
      // Only run if Leaflet is available and we have coords
      if (!window.L) return;
      const stops = _optimized.filter(s => s.lat && s.lng);
      if (stops.length < 2) return;

      const mapEl = document.getElementById('ro-map');
      const placeholder = document.getElementById('ro-map-placeholder');
      mapEl.style.display = 'block';
      placeholder.style.display = 'none';

      // Destroy old map
      if (_map) { _map.remove(); _map = null; }

      _map = L.map('ro-map', { zoomControl: true, scrollWheelZoom: false });
      L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
        attribution: '© OpenStreetMap © CartoDB',
        maxZoom: 18,
      }).addTo(_map);

      // Custom numbered markers
      const markers = stops.map((stop, i) => {
        const icon = L.divIcon({
          className: '',
          html: `<div style="
            width:28px;height:28px;border-radius:50%;
            background:#d97757;color:#fff;
            font-family:'DM Sans',sans-serif;font-size:12px;font-weight:700;
            display:flex;align-items:center;justify-content:center;
            box-shadow:0 3px 10px rgba(217,119,87,.5);
            border:2px solid #fff;
          ">${i + 1}</div>`,
          iconSize: [28, 28],
          iconAnchor: [14, 14],
        });
        const marker = L.marker([stop.lat, stop.lng], { icon }).addTo(_map);
        marker.bindPopup(`<strong>${stop.emoji || '📍'} ${stop.title}</strong><br>${stop.optimizedTime || ''}`);
        return marker;
      });

      // Draw route line
      const latlngs = stops.map(s => [s.lat, s.lng]);
      if (_routeLayer) _map.removeLayer(_routeLayer);
      _routeLayer = L.polyline(latlngs, {
        color: '#d97757',
        weight: 3,
        opacity: 0.7,
        dashArray: '8, 6',
      }).addTo(_map);

      // Fit bounds
      const group = L.featureGroup(markers);
      _map.fitBounds(group.getBounds().pad(0.2));
    }

    function _removeStop(i) {
      _activities.splice(i, 1);
      _optimized = [];
      document.getElementById('ro-footer').style.display = 'none';
      document.getElementById('ro-stats').style.display = 'none';
      document.getElementById('ro-map').style.display = 'none';
      document.getElementById('ro-map-placeholder').style.display = 'flex';
      _renderActivityList();
      document.getElementById('ro-optimize').textContent = 'Optimize';
    }

    window.RouteOptimizer = { open: openRO, close: closeRO, _removeStop };
  })();

})();
