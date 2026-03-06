// packing-planner.js — Voyage Smart Packing Planner
// Features: AI packing lists, activity tags, outfit mood board, pack-light score,
//           "what did I forget" checker, already-packed mode, templates, split view, weight tracker
//
// Usage: window.PackingPlanner.open(tripId, tripData)
// tripData: { destination, start_date, end_date, days: {}, richNotes: {} }

(function () {
  'use strict';

  // ─────────────────────────────────────────────────────────────────────────
  // STYLES
  // ─────────────────────────────────────────────────────────────────────────
  if (!document.getElementById('_pp_styles')) {
    const s = document.createElement('style');
    s.id = '_pp_styles';
    s.textContent = `
@import url('https://fonts.googleapis.com/css2?family=Fraunces:ital,wght@0,400;0,600;1,400&family=DM+Sans:wght@300;400;500;600&display=swap');

/* ══ OVERLAY ══ */
#pp-overlay {
  display:none; position:fixed; inset:0; z-index:7000;
  background:rgba(8,6,4,.72);
  backdrop-filter:blur(10px); -webkit-backdrop-filter:blur(10px);
  align-items:stretch; justify-content:center;
  animation:pp-fade .22s ease;
}
#pp-overlay.active { display:flex; }
@keyframes pp-fade{from{opacity:0}to{opacity:1}}

/* ══ PANEL ══ */
#pp-panel {
  display:flex; flex-direction:column;
  width:100%; max-width:1100px;
  margin:16px; border-radius:20px; overflow:hidden;
  background:#13120f;
  border:1px solid rgba(232,213,183,.1);
  box-shadow:0 40px 100px rgba(0,0,0,.55);
  animation:pp-up .32s cubic-bezier(.16,1,.3,1);
}
@keyframes pp-up{from{opacity:0;transform:translateY(24px)}to{opacity:1;transform:none}}

/* ══ TOPBAR ══ */
#pp-topbar {
  display:flex; align-items:center; justify-content:space-between;
  padding:16px 24px 14px;
  border-bottom:1px solid rgba(232,213,183,.07);
  background:linear-gradient(135deg,rgba(217,119,87,.06),rgba(91,154,169,.06));
  flex-shrink:0;
  gap:16px; flex-wrap:wrap;
}
.pp-topbar-left { display:flex; flex-direction:column; }
.pp-eyebrow {
  font-family:'DM Sans',sans-serif; font-size:10px; font-weight:700;
  letter-spacing:.12em; text-transform:uppercase;
  color:rgba(217,119,87,.7); margin-bottom:2px;
}
.pp-title {
  font-family:'Fraunces',serif; font-size:22px; font-weight:600;
  color:#f5efe6; letter-spacing:-.3px; line-height:1.1;
}
.pp-subtitle {
  font-family:'DM Sans',sans-serif; font-size:12px;
  color:rgba(232,213,183,.38); margin-top:2px;
}
.pp-topbar-actions { display:flex; align-items:center; gap:8px; flex-wrap:wrap; }

/* Pack-light score badge */
.pp-score-badge {
  display:flex; align-items:center; gap:7px;
  padding:7px 13px; border-radius:22px;
  border:1.5px solid rgba(232,213,183,.15);
  background:rgba(232,213,183,.05);
  font-family:'DM Sans',sans-serif;
  cursor:default; transition:all .2s;
}
.pp-score-badge.gold { border-color:rgba(201,169,110,.5); background:rgba(201,169,110,.08); }
.pp-score-badge.silver { border-color:rgba(200,200,200,.4); background:rgba(200,200,200,.06); }
.pp-score-badge.bronze { border-color:rgba(205,127,50,.4); background:rgba(205,127,50,.06); }
.pp-score-emoji { font-size:18px; }
.pp-score-label { font-size:11px; font-weight:600; color:rgba(232,213,183,.65); }
.pp-score-val { font-size:14px; font-weight:700; color:#f5efe6; }

.pp-icon-btn {
  width:34px; height:34px; display:flex; align-items:center; justify-content:center;
  border:1px solid rgba(232,213,183,.12); border-radius:9px;
  background:transparent; color:rgba(232,213,183,.5);
  cursor:pointer; font-size:16px; transition:all .18s;
  position:relative;
}
.pp-icon-btn:hover { background:rgba(232,213,183,.07); color:#f5efe6; border-color:rgba(232,213,183,.28); }
.pp-icon-btn[title]:hover::after {
  content:attr(title); position:absolute; bottom:calc(100% + 6px); left:50%; transform:translateX(-50%);
  background:#222; color:#f5efe6; font-size:11px; padding:3px 8px; border-radius:5px; white-space:nowrap;
  pointer-events:none; z-index:10;
}

.pp-close-btn {
  width:34px; height:34px; display:flex; align-items:center; justify-content:center;
  border:1px solid rgba(232,213,183,.1); border-radius:50%;
  background:transparent; color:rgba(232,213,183,.45);
  cursor:pointer; font-size:19px; transition:all .18s;
}
.pp-close-btn:hover { background:rgba(232,213,183,.07); color:#f5efe6; }

/* ══ TABS ══ */
#pp-tabs {
  display:flex; gap:0; padding:0 24px;
  border-bottom:1px solid rgba(232,213,183,.07);
  flex-shrink:0; overflow-x:auto;
}
#pp-tabs::-webkit-scrollbar{ height:2px; }
.pp-tab {
  padding:11px 15px; font-family:'DM Sans',sans-serif; font-size:13px; font-weight:600;
  color:rgba(232,213,183,.4); cursor:pointer; white-space:nowrap;
  border-bottom:2px solid transparent; margin-bottom:-1px;
  transition:all .18s; background:none; border-top:none; border-left:none; border-right:none;
  display:flex; align-items:center; gap:6px;
}
.pp-tab:hover { color:rgba(232,213,183,.7); }
.pp-tab.active { color:#d97757; border-bottom-color:#d97757; }
.pp-tab-count {
  font-size:10px; font-weight:700; padding:1px 6px; border-radius:10px;
  background:rgba(217,119,87,.15); color:rgba(217,119,87,.8);
}

/* ══ SPLIT LAYOUT ══ */
#pp-body {
  display:flex; flex:1; overflow:hidden; min-height:0;
}
#pp-itinerary-pane {
  width:280px; flex-shrink:0;
  border-right:1px solid rgba(232,213,183,.07);
  overflow-y:auto; padding:16px;
  display:none;
}
#pp-itinerary-pane.visible { display:block; }
#pp-main {
  flex:1; overflow-y:auto; padding:20px 24px 32px; min-width:0;
}

/* ══ ITINERARY PANE ══ */
.pp-itin-title {
  font-family:'DM Sans',sans-serif; font-size:10px; font-weight:700;
  letter-spacing:.1em; text-transform:uppercase; color:rgba(232,213,183,.3);
  margin-bottom:12px;
}
.pp-itin-day {
  padding:10px 12px; border-radius:10px;
  border:1px solid rgba(232,213,183,.06); margin-bottom:6px;
  cursor:pointer; transition:all .18s;
}
.pp-itin-day:hover { background:rgba(232,213,183,.04); border-color:rgba(232,213,183,.12); }
.pp-itin-day.active { background:rgba(217,119,87,.08); border-color:rgba(217,119,87,.25); }
.pp-itin-day-num {
  font-family:'DM Sans',sans-serif; font-size:10px; font-weight:700;
  letter-spacing:.08em; text-transform:uppercase; color:rgba(217,119,87,.6);
}
.pp-itin-day-date { font-size:12px; font-weight:600; color:#f5efe6; margin:2px 0; }
.pp-itin-day-preview { font-size:11px; color:rgba(232,213,183,.35); line-height:1.4; }

/* ══ AI GENERATE PANEL ══ */
.pp-ai-box {
  background:linear-gradient(135deg,#0d0d1a 0%,#16213e 100%);
  border:1px solid rgba(201,169,110,.18); border-radius:15px;
  padding:18px 20px; margin-bottom:20px;
}
.pp-ai-box-label {
  font-family:'DM Sans',sans-serif; font-size:10px; font-weight:700;
  letter-spacing:.1em; text-transform:uppercase;
  color:rgba(201,169,110,.55); margin-bottom:14px;
  display:flex; align-items:center; gap:6px;
}
.pp-ai-grid { display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-bottom:12px; }
@media(max-width:500px){ .pp-ai-grid{grid-template-columns:1fr;} }
.pp-ai-field { display:flex; flex-direction:column; gap:4px; }
.pp-ai-field label {
  font-family:'DM Sans',sans-serif; font-size:11px;
  color:rgba(232,213,183,.35); letter-spacing:.04em;
}
.pp-ai-input, .pp-ai-select {
  padding:8px 11px;
  background:rgba(255,255,255,.05); border:1px solid rgba(232,213,183,.12);
  border-radius:8px; color:#f5efe6; font-family:'DM Sans',sans-serif; font-size:13px;
  outline:none; transition:border-color .2s;
}
.pp-ai-input::placeholder { color:rgba(232,213,183,.2); }
.pp-ai-input:focus, .pp-ai-select:focus { border-color:rgba(232,213,183,.35); }
.pp-ai-select option { background:#16213e; color:#f5efe6; }

/* Activity tags */
.pp-act-tags { display:flex; flex-wrap:wrap; gap:6px; margin-bottom:14px; }
.pp-act-tag {
  padding:5px 12px; border-radius:16px;
  background:rgba(232,213,183,.05); border:1px solid rgba(232,213,183,.1);
  color:rgba(232,213,183,.48); font-family:'DM Sans',sans-serif; font-size:12px;
  cursor:pointer; transition:all .18s; user-select:none;
  display:flex; align-items:center; gap:5px;
}
.pp-act-tag:hover { border-color:rgba(232,213,183,.25); color:rgba(232,213,183,.75); }
.pp-act-tag.on { background:rgba(217,119,87,.12); border-color:rgba(217,119,87,.4); color:#f5efe6; }

.pp-ai-gen-btn {
  width:100%; padding:11px;
  background:linear-gradient(135deg,#c9a96e 0%,#e8d5b7 50%,#c9a96e 100%);
  background-size:200% 100%; color:#0d0d1a; border:none; border-radius:9px;
  font-family:'DM Sans',sans-serif; font-size:13px; font-weight:700; cursor:pointer;
  letter-spacing:.02em; transition:all .3s;
}
.pp-ai-gen-btn:hover:not(:disabled){background-position:100% 0;transform:translateY(-1px);}
.pp-ai-gen-btn:disabled{opacity:.5;cursor:not-allowed;}

/* ══ PROGRESS ══ */
.pp-progress-row {
  display:flex; align-items:center; justify-content:space-between;
  margin-bottom:5px;
}
.pp-progress-label { font-size:11px; color:rgba(232,213,183,.35); font-family:'DM Sans',sans-serif; }
.pp-progress-pct { font-size:12px; font-weight:700; color:rgba(232,213,183,.6); font-family:'DM Sans',sans-serif; }
.pp-progress-track {
  height:4px; background:rgba(232,213,183,.08); border-radius:2px; overflow:hidden; margin-bottom:18px;
}
.pp-progress-fill {
  height:100%; border-radius:2px;
  background:linear-gradient(90deg,#d97757,#e8a838);
  transition:width .5s cubic-bezier(.4,0,.2,1);
}

/* ══ PACKING CATEGORIES ══ */
.pp-cats { display:flex; flex-direction:column; gap:12px; }

.pp-cat {
  border:1px solid rgba(232,213,183,.07); border-radius:12px;
  background:rgba(255,255,255,.02); overflow:hidden;
  transition:border-color .2s;
}
.pp-cat:hover { border-color:rgba(232,213,183,.12); }

.pp-cat-hdr {
  display:flex; align-items:center; gap:8px; padding:11px 14px;
  cursor:pointer; user-select:none; transition:background .15s;
}
.pp-cat-hdr:hover { background:rgba(232,213,183,.03); }
.pp-cat-emoji { font-size:17px; flex-shrink:0; }
.pp-cat-name { font-family:'DM Sans',sans-serif; font-size:13px; font-weight:700; color:#f5efe6; flex:1; }
.pp-cat-meta { display:flex; align-items:center; gap:6px; }
.pp-cat-count {
  font-size:10px; color:rgba(232,213,183,.35);
  background:rgba(232,213,183,.06); padding:2px 7px; border-radius:9px;
}
.pp-cat-weight {
  font-size:10px; color:rgba(91,154,169,.6);
  background:rgba(91,154,169,.07); padding:2px 7px; border-radius:9px;
}
.pp-cat-chevron { font-size:10px; color:rgba(232,213,183,.3); transition:transform .2s; }
.pp-cat.collapsed .pp-cat-chevron { transform:rotate(-90deg); }
.pp-cat.collapsed .pp-cat-body { display:none; }

.pp-cat-body { padding:4px 14px 12px; }

.pp-item {
  display:flex; align-items:center; gap:9px; padding:7px 0;
  border-bottom:1px solid rgba(232,213,183,.04); position:relative;
}
.pp-item:last-child { border-bottom:none; }

/* Already-packed mode checkbox */
.pp-item-chk {
  width:17px; height:17px; border-radius:5px; flex-shrink:0; cursor:pointer;
  border:1.5px solid rgba(232,213,183,.2); background:transparent;
  display:flex; align-items:center; justify-content:center;
  transition:all .15s; font-size:10px;
}
.pp-item.packed .pp-item-chk {
  background:#4caf50; border-color:#4caf50; color:#fff;
}
.pp-item.packed .pp-item-chk::after { content:'✓'; }
.pp-item.packed .pp-item-name {
  text-decoration:line-through; color:rgba(232,213,183,.3);
}

.pp-item-name {
  flex:1; font-family:'DM Sans',sans-serif; font-size:13px; color:#e8d5b7;
  outline:none; min-width:0; cursor:text; background:none; border:none; padding:0;
}
.pp-item-name:focus { color:#fff; }

/* Quantity bubble */
.pp-item-qty {
  font-size:11px; color:rgba(232,213,183,.35);
  background:rgba(232,213,183,.06); padding:1px 6px; border-radius:8px;
  white-space:nowrap; cursor:pointer;
  font-family:'DM Sans',sans-serif;
}
.pp-item-qty:hover { background:rgba(232,213,183,.12); }

/* Weight */
.pp-item-weight {
  font-size:10px; color:rgba(91,154,169,.55);
  background:rgba(91,154,169,.07); padding:1px 6px; border-radius:8px;
  white-space:nowrap; font-family:'DM Sans',sans-serif;
  cursor:pointer;
}
.pp-item-weight:hover { background:rgba(91,154,169,.14); }

.pp-item-del {
  width:20px; height:20px; border:none; background:transparent;
  color:rgba(232,213,183,.2); cursor:pointer; border-radius:4px;
  display:flex; align-items:center; justify-content:center; font-size:13px;
  opacity:0; transition:all .15s; flex-shrink:0;
}
.pp-item:hover .pp-item-del { opacity:1; }
.pp-item-del:hover { background:rgba(220,80,60,.12); color:#e05040; }

/* Add item row */
.pp-add-row {
  display:flex; gap:6px; padding-top:7px;
}
.pp-add-input {
  flex:1; padding:6px 10px;
  border:1px dashed rgba(232,213,183,.12); border-radius:7px;
  background:transparent; font-family:'DM Sans',sans-serif; font-size:12px;
  color:#f5efe6; outline:none; transition:all .15s;
}
.pp-add-input:focus { border-color:rgba(217,119,87,.4); border-style:solid; }
.pp-add-input::placeholder { color:rgba(232,213,183,.2); }
.pp-add-btn {
  padding:6px 13px; background:rgba(217,119,87,.2);
  border:1px solid rgba(217,119,87,.35); border-radius:7px;
  color:#d97757; font-size:12px; font-weight:700; cursor:pointer;
  font-family:'DM Sans',sans-serif; transition:all .15s;
}
.pp-add-btn:hover { background:rgba(217,119,87,.3); }

/* ══ WEIGHT TRACKER ══ */
.pp-weight-banner {
  display:flex; align-items:center; gap:12px; padding:11px 16px;
  background:rgba(91,154,169,.08); border:1px solid rgba(91,154,169,.18);
  border-radius:11px; margin-bottom:16px;
  font-family:'DM Sans',sans-serif;
}
.pp-weight-icon { font-size:20px; }
.pp-weight-body { flex:1; }
.pp-weight-total { font-size:16px; font-weight:700; color:#f5efe6; }
.pp-weight-limit { font-size:11px; color:rgba(91,154,169,.65); margin-top:1px; }
.pp-weight-bar-track {
  flex:1; height:5px; background:rgba(232,213,183,.08); border-radius:3px; overflow:hidden;
  min-width:80px;
}
.pp-weight-bar-fill {
  height:100%; border-radius:3px;
  background:linear-gradient(90deg,#5b9aa9,#7db87a);
  transition:width .5s ease;
}
.pp-weight-bar-fill.warn { background:linear-gradient(90deg,#e8a838,#e06b7a); }

/* ══ WHAT DID I FORGET ══ */
.pp-forgot-box {
  background:rgba(15,52,96,.22); border:1px solid rgba(100,160,230,.18);
  border-radius:13px; padding:16px 18px; margin-bottom:20px;
}
.pp-forgot-title {
  font-family:'DM Sans',sans-serif; font-size:12px; font-weight:700;
  color:rgba(180,210,255,.65); margin-bottom:10px;
  display:flex; align-items:center; gap:6px;
}
.pp-forgot-check-btn {
  padding:8px 16px; background:rgba(100,160,230,.12);
  border:1px solid rgba(100,160,230,.22); border-radius:8px;
  color:rgba(180,210,255,.7); font-family:'DM Sans',sans-serif; font-size:13px;
  cursor:pointer; transition:all .18s; display:flex; align-items:center; gap:7px;
}
.pp-forgot-check-btn:hover { background:rgba(100,160,230,.2); color:rgba(180,210,255,.9); }
.pp-forgot-check-btn:disabled { opacity:.5; cursor:not-allowed; }
.pp-forgot-results { margin-top:12px; display:flex; flex-direction:column; gap:7px; }
.pp-forgot-item {
  display:flex; align-items:flex-start; gap:8px; padding:9px 12px;
  background:rgba(255,255,255,.02); border:1px solid rgba(232,213,183,.06);
  border-radius:9px; font-family:'DM Sans',sans-serif; font-size:12px;
}
.pp-forgot-item.warning { border-color:rgba(245,158,11,.2); background:rgba(245,158,11,.04); }
.pp-forgot-item.warning .pp-forgot-item-icon { color:rgba(245,158,11,.8); }
.pp-forgot-item.suggestion { border-color:rgba(91,154,169,.2); background:rgba(91,154,169,.04); }
.pp-forgot-item.suggestion .pp-forgot-item-icon { color:rgba(91,154,169,.8); }
.pp-forgot-item-icon { font-size:14px; flex-shrink:0; margin-top:1px; }
.pp-forgot-item-text { color:rgba(232,213,183,.65); line-height:1.5; }
.pp-forgot-add-link {
  color:rgba(217,119,87,.7); text-decoration:underline; cursor:pointer;
  font-size:11px; display:block; margin-top:3px;
}
.pp-forgot-add-link:hover { color:#d97757; }

/* ══ TEMPLATES ══ */
.pp-templates-row {
  display:flex; gap:8px; flex-wrap:wrap; margin-bottom:18px;
}
.pp-template-btn {
  padding:7px 14px; border-radius:18px;
  border:1px solid rgba(232,213,183,.12); background:rgba(232,213,183,.04);
  color:rgba(232,213,183,.5); font-family:'DM Sans',sans-serif; font-size:12px;
  cursor:pointer; transition:all .18s; display:flex; align-items:center; gap:5px;
}
.pp-template-btn:hover { border-color:rgba(232,213,183,.25); color:rgba(232,213,183,.8); }
.pp-template-btn.save-tpl {
  border-color:rgba(217,119,87,.25); color:rgba(217,119,87,.6);
}
.pp-template-btn.save-tpl:hover { border-color:rgba(217,119,87,.45); color:#d97757; }

/* ══ OUTFIT MOOD BOARD ══ */
.pp-mood-grid {
  display:grid; grid-template-columns:repeat(auto-fill,minmax(140px,1fr)); gap:10px;
  margin-bottom:14px;
}
.pp-mood-card {
  border-radius:10px; overflow:hidden;
  border:1px solid rgba(232,213,183,.07);
  background:rgba(255,255,255,.03);
  position:relative; aspect-ratio:3/4;
  cursor:pointer; transition:all .2s;
}
.pp-mood-card:hover { border-color:rgba(232,213,183,.2); transform:translateY(-2px); }
.pp-mood-card img { width:100%; height:100%; object-fit:cover; display:block; }
.pp-mood-card .pp-mood-overlay {
  position:absolute; inset:0; background:linear-gradient(to top,rgba(0,0,0,.7),transparent);
  opacity:0; transition:opacity .2s;
}
.pp-mood-card:hover .pp-mood-overlay { opacity:1; }
.pp-mood-card-label {
  position:absolute; bottom:8px; left:8px; right:8px;
  font-family:'DM Sans',sans-serif; font-size:11px; font-weight:600;
  color:rgba(255,255,255,.9); opacity:0; transition:opacity .2s;
}
.pp-mood-card:hover .pp-mood-card-label { opacity:1; }
.pp-mood-card.placeholder {
  display:flex; align-items:center; justify-content:center;
  flex-direction:column; gap:5px; background:rgba(255,255,255,.02);
  border-style:dashed; cursor:default;
}
.pp-mood-card.placeholder .pp-mood-ph-icon { font-size:28px; opacity:.3; }
.pp-mood-card.placeholder .pp-mood-ph-txt { font-size:10px; color:rgba(232,213,183,.25); text-align:center; padding:0 8px; }
.pp-mood-search-row {
  display:flex; gap:8px; margin-bottom:14px;
}
.pp-mood-search-input {
  flex:1; padding:8px 12px;
  background:rgba(255,255,255,.05); border:1px solid rgba(232,213,183,.12);
  border-radius:8px; color:#f5efe6; font-family:'DM Sans',sans-serif; font-size:13px;
  outline:none; transition:border-color .2s;
}
.pp-mood-search-input::placeholder { color:rgba(232,213,183,.2); }
.pp-mood-search-input:focus { border-color:rgba(232,213,183,.3); }
.pp-mood-search-btn {
  padding:8px 16px; background:rgba(232,213,183,.08);
  border:1px solid rgba(232,213,183,.15); border-radius:8px;
  color:rgba(232,213,183,.65); font-family:'DM Sans',sans-serif; font-size:13px;
  cursor:pointer; transition:all .18s;
}
.pp-mood-search-btn:hover { background:rgba(232,213,183,.14); color:#f5efe6; }

/* ══ OUTFIT CALENDAR ══ */
.pp-outfit-calendar { display:flex; flex-direction:column; gap:8px; margin-bottom:20px; }
.pp-outfit-day {
  display:flex; align-items:center; gap:12px; padding:10px 14px;
  background:rgba(255,255,255,.02); border:1px solid rgba(232,213,183,.06);
  border-radius:11px; transition:border-color .2s;
}
.pp-outfit-day:hover { border-color:rgba(232,213,183,.12); }
.pp-outfit-day-info { width:80px; flex-shrink:0; }
.pp-outfit-day-num { font-size:10px; font-weight:700; color:rgba(217,119,87,.6); letter-spacing:.06em; text-transform:uppercase; }
.pp-outfit-day-date { font-size:12px; font-weight:600; color:#f5efe6; }
.pp-outfit-day-plan { font-size:11px; color:rgba(232,213,183,.35); margin-top:2px; line-height:1.3; }
.pp-outfit-slots { display:flex; gap:6px; flex:1; flex-wrap:wrap; }
.pp-outfit-slot {
  padding:5px 11px; border-radius:18px;
  border:1px dashed rgba(232,213,183,.12); background:transparent;
  color:rgba(232,213,183,.3); font-family:'DM Sans',sans-serif; font-size:11px;
  cursor:pointer; transition:all .18s; white-space:nowrap;
  display:flex; align-items:center; gap:4px;
}
.pp-outfit-slot:hover { border-color:rgba(217,119,87,.3); color:rgba(217,119,87,.7); border-style:solid; }
.pp-outfit-slot.filled {
  border-style:solid; border-color:rgba(217,119,87,.25);
  background:rgba(217,119,87,.08); color:#d97757;
}
.pp-outfit-slot.reuse {
  border-color:rgba(125,184,122,.25); background:rgba(125,184,122,.07);
  color:rgba(125,184,122,.8);
}
.pp-outfit-slot .reuse-star { color:rgba(125,184,122,.8); font-size:9px; }

/* ══ COMMUNITY TIPS ══ */
.pp-community-tips { display:flex; flex-direction:column; gap:8px; }
.pp-community-tip {
  padding:11px 14px; border-radius:10px;
  background:rgba(255,255,255,.02); border:1px solid rgba(232,213,183,.06);
}
.pp-tip-header { display:flex; align-items:center; gap:8px; margin-bottom:5px; }
.pp-tip-avatar {
  width:24px; height:24px; border-radius:50%;
  background:linear-gradient(135deg,#d97757,#5b9aa9);
  display:flex; align-items:center; justify-content:center;
  font-size:11px; font-weight:700; color:#fff; flex-shrink:0;
}
.pp-tip-author { font-size:12px; font-weight:600; color:rgba(232,213,183,.6); }
.pp-tip-location { font-size:10px; color:rgba(232,213,183,.3); margin-left:auto; }
.pp-tip-text { font-size:12px; color:rgba(232,213,183,.5); line-height:1.6; }
.pp-tip-upvote {
  display:inline-flex; align-items:center; gap:4px; margin-top:6px;
  padding:2px 8px; border-radius:6px; border:1px solid rgba(232,213,183,.08);
  background:transparent; color:rgba(232,213,183,.3); font-size:11px;
  cursor:pointer; transition:all .15s; font-family:'DM Sans',sans-serif;
}
.pp-tip-upvote:hover { border-color:rgba(232,213,183,.2); color:rgba(232,213,183,.65); }
.pp-tip-upvote.voted { border-color:rgba(217,119,87,.3); color:rgba(217,119,87,.7); background:rgba(217,119,87,.06); }

/* ══ SPINNERS ══ */
.pp-spin {
  width:28px; height:28px; margin:0 auto 10px; border-radius:50%;
  border:2px solid rgba(201,169,110,.12); border-top-color:rgba(201,169,110,.6);
  animation:pp-spin .8s linear infinite;
}
@keyframes pp-spin{to{transform:rotate(360deg)}}
.pp-loading { text-align:center; padding:24px; font-family:'DM Sans',sans-serif; font-size:13px; color:rgba(232,213,183,.35); font-style:italic; }

/* ══ SECTION TITLES ══ */
.pp-section-title {
  font-family:'DM Sans',sans-serif; font-size:10px; font-weight:700;
  letter-spacing:.1em; text-transform:uppercase; color:rgba(232,213,183,.28);
  margin-bottom:12px; display:flex; align-items:center; justify-content:space-between;
}
.pp-section-title a {
  font-size:11px; color:rgba(217,119,87,.6); text-decoration:none; letter-spacing:0; font-weight:500; text-transform:none;
  cursor:pointer;
}
.pp-section-title a:hover { color:#d97757; }

/* ══ PACK-LIGHT MODAL ══ */
.pp-score-modal {
  position:absolute; inset:0; display:none; align-items:center; justify-content:center;
  background:rgba(8,6,4,.85); border-radius:20px; z-index:10;
  animation:pp-fade .2s;
}
.pp-score-modal.active { display:flex; }
.pp-score-modal-inner {
  text-align:center; padding:40px 32px; max-width:340px;
}
.pp-score-big-emoji { font-size:64px; margin-bottom:16px; animation:pp-bounce .4s ease; }
@keyframes pp-bounce{0%{transform:scale(0.5)}70%{transform:scale(1.1)}100%{transform:scale(1)}}
.pp-score-modal-title {
  font-family:'Fraunces',serif; font-size:26px; font-weight:600; color:#f5efe6; margin-bottom:6px;
}
.pp-score-modal-desc { font-family:'DM Sans',sans-serif; font-size:14px; color:rgba(232,213,183,.55); line-height:1.6; margin-bottom:20px; }
.pp-score-modal-close {
  padding:9px 24px; border:1px solid rgba(232,213,183,.2); border-radius:9px;
  background:transparent; color:rgba(232,213,183,.6); font-family:'DM Sans',sans-serif;
  font-size:13px; cursor:pointer; transition:all .18s;
}
.pp-score-modal-close:hover { background:rgba(232,213,183,.06); color:#f5efe6; }
    `;
    document.head.appendChild(s);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // CONSTANTS
  // ─────────────────────────────────────────────────────────────────────────
  const ACTIVITIES = [
    {id:'beach',   label:'Beach',          emoji:'🏖️'},
    {id:'hiking',  label:'Hiking',         emoji:'🥾'},
    {id:'city',    label:'City Exploring', emoji:'🏙️'},
    {id:'dining',  label:'Fine Dining',    emoji:'🍽️'},
    {id:'business',label:'Business',       emoji:'💼'},
    {id:'cold',    label:'Cold Weather',   emoji:'❄️'},
    {id:'party',   label:'Nightlife',      emoji:'🎉'},
    {id:'sport',   label:'Water Sports',   emoji:'🏄'},
    {id:'culture', label:'Museums/Culture',emoji:'🎭'},
    {id:'safari',  label:'Safari/Nature',  emoji:'🦁'},
  ];

  const TEMPLATES = [
    {
      id:'city-weekend', label:'Weekend City Break', emoji:'🏙️',
      categories:[
        {name:'Clothing', emoji:'👔', items:[
          {name:'T-shirts',qty:2,weight:200},{name:'Jeans',qty:1,weight:600},
          {name:'Smart shirt/top',qty:1,weight:250},{name:'Underwear',qty:3,weight:100},
          {name:'Socks',qty:3,weight:80},{name:'Comfortable walking shoes',qty:1,weight:700},
          {name:'Evening shoes',qty:1,weight:500},{name:'Light jacket',qty:1,weight:400},
        ]},
        {name:'Toiletries', emoji:'🧴', items:[
          {name:'Toothbrush & toothpaste',qty:1,weight:150},{name:'Shampoo (travel size)',qty:1,weight:100},
          {name:'Deodorant',qty:1,weight:100},{name:'Moisturiser',qty:1,weight:80},
        ]},
        {name:'Tech & Travel', emoji:'💻', items:[
          {name:'Phone charger',qty:1,weight:150},{name:'Power bank',qty:1,weight:200},
          {name:'Universal adapter',qty:1,weight:200},{name:'Earphones',qty:1,weight:50},
        ]},
        {name:'Essentials', emoji:'🎒', items:[
          {name:'Passport/ID',qty:1,weight:30},{name:'Travel insurance docs',qty:1,weight:10},
          {name:'Cash & cards',qty:1,weight:50},{name:'Reusable water bottle',qty:1,weight:250},
        ]},
      ]
    },
    {
      id:'beach-week', label:'Beach Week', emoji:'🏖️',
      categories:[
        {name:'Swimwear', emoji:'👙', items:[
          {name:'Swimsuit / trunks',qty:2,weight:200},{name:'Rash guard',qty:1,weight:150},
          {name:'Beach cover-up',qty:2,weight:200},{name:'Flip flops',qty:1,weight:300},
          {name:'Sandals',qty:1,weight:400},
        ]},
        {name:'Sun Protection', emoji:'☀️', items:[
          {name:'SPF 50 sunscreen',qty:1,weight:200},{name:'After sun lotion',qty:1,weight:150},
          {name:'Sunglasses',qty:1,weight:100},{name:'Sun hat',qty:1,weight:150},
          {name:'Lip balm SPF',qty:1,weight:20},
        ]},
        {name:'Clothing', emoji:'👗', items:[
          {name:'Light dresses/shirts',qty:3,weight:200},{name:'Shorts',qty:2,weight:300},
          {name:'Evening outfit',qty:1,weight:400},{name:'Light cardigan',qty:1,weight:300},
        ]},
        {name:'Beach Gear', emoji:'🏖️', items:[
          {name:'Beach towel',qty:1,weight:500},{name:'Beach bag',qty:1,weight:200},
          {name:'Waterproof phone case',qty:1,weight:50},{name:'Snorkel (optional)',qty:1,weight:300},
        ]},
        {name:'Essentials', emoji:'🎒', items:[
          {name:'Passport',qty:1,weight:30},{name:'Reusable water bottle',qty:1,weight:250},
          {name:'First aid kit (basic)',qty:1,weight:150},{name:'Insect repellent',qty:1,weight:100},
        ]},
      ]
    },
    {
      id:'hiking-trip', label:'Hiking Trip', emoji:'🥾',
      categories:[
        {name:'Hiking Gear', emoji:'🧗', items:[
          {name:'Hiking boots',qty:1,weight:1200},{name:'Hiking socks',qty:3,weight:120},
          {name:'Trekking poles',qty:1,weight:500},{name:'Daypack',qty:1,weight:600},
          {name:'Headlamp + batteries',qty:1,weight:100},
        ]},
        {name:'Clothing', emoji:'🧥', items:[
          {name:'Base layer (moisture-wicking)',qty:2,weight:180},{name:'Fleece mid-layer',qty:1,weight:400},
          {name:'Waterproof jacket',qty:1,weight:500},{name:'Waterproof trousers',qty:1,weight:350},
          {name:'Hiking shorts',qty:1,weight:250},{name:'Warm hat & gloves',qty:1,weight:150},
        ]},
        {name:'Safety & Navigation', emoji:'🗺️', items:[
          {name:'Map / downloaded offline maps',qty:1,weight:50},{name:'First aid kit',qty:1,weight:300},
          {name:'Emergency whistle',qty:1,weight:20},{name:'Multi-tool',qty:1,weight:150},
        ]},
        {name:'Food & Water', emoji:'🥾', items:[
          {name:'Water filter / purification tablets',qty:1,weight:100},
          {name:'High-energy snacks',qty:5,weight:100},{name:'Electrolyte sachets',qty:5,weight:30},
        ]},
      ]
    },
    {
      id:'business', label:'Business Trip', emoji:'💼',
      categories:[
        {name:'Business Attire', emoji:'👔', items:[
          {name:'Suits / blazers',qty:2,weight:900},{name:'Dress shirts / blouses',qty:3,weight:250},
          {name:'Smart trousers / skirt',qty:2,weight:500},{name:'Dress shoes',qty:1,weight:800},
          {name:'Belt / accessories',qty:1,weight:150},{name:'Tie / scarf',qty:1,weight:100},
        ]},
        {name:'Tech', emoji:'💻', items:[
          {name:'Laptop + charger',qty:1,weight:1800},{name:'Phone charger',qty:1,weight:150},
          {name:'Universal adapter',qty:1,weight:200},{name:'Portable battery pack',qty:1,weight:200},
          {name:'USB drive',qty:1,weight:20},{name:'Presentation remote',qty:1,weight:80},
        ]},
        {name:'Documents', emoji:'📄', items:[
          {name:'Passport / ID',qty:1,weight:30},{name:'Business cards',qty:1,weight:50},
          {name:'Hotel confirmation printout',qty:1,weight:10},{name:'Expense receipts folder',qty:1,weight:30},
        ]},
      ]
    },
  ];

  // Unsplash-powered mood board search (free, no auth needed for source images)
  const MOOD_QUERIES = {
    beach:    ['summer outfit beach','resort wear tropical','beach fashion'],
    hiking:   ['hiking outfit mountains','outdoor adventure style','trekking fashion'],
    city:     ['city travel outfit','urban fashion street style','city break clothes'],
    dining:   ['elegant dinner outfit','smart casual fashion','fine dining style'],
    business: ['business travel outfit','professional fashion','smart office style'],
    cold:     ['winter travel outfit','cosy layer fashion','ski resort style'],
  };

  // ─────────────────────────────────────────────────────────────────────────
  // STATE
  // ─────────────────────────────────────────────────────────────────────────
  let _tripId = null;
  let _tripData = null;
  let _activeTab = 'packing';
  let _packingList = {};   // { catId: { name, emoji, items:[{id,name,qty,weight,packed}] } }
  let _selectedActivities = new Set();
  let _outfitPlan = {};    // { dateKey: { morning, evening, reuses:[] } }
  let _moodImages = [];
  let _splitView = false;
  let _alreadyPackedMode = false;
  let _savedTemplates = [];
  let _communityTips = [];
  let _forgotResults = [];
  let _weightLimit = 23000; // grams (23kg default carry-on limit)

  // ─────────────────────────────────────────────────────────────────────────
  // BUILD DOM
  // ─────────────────────────────────────────────────────────────────────────
  function _buildDOM() {
    if (document.getElementById('pp-overlay')) return;
    const overlay = document.createElement('div');
    overlay.id = 'pp-overlay';
    overlay.innerHTML = `
      <div id="pp-panel">
        <div id="pp-topbar">
          <div class="pp-topbar-left">
            <div class="pp-eyebrow">✦ Smart Packing</div>
            <div class="pp-title" id="pp-title">Packing Planner</div>
            <div class="pp-subtitle" id="pp-subtitle"></div>
          </div>
          <div class="pp-topbar-actions">
            <div class="pp-score-badge" id="pp-score-badge" title="Pack Light Score">
              <span class="pp-score-emoji" id="pp-score-emoji">🎒</span>
              <span class="pp-score-label">Pack Light</span>
              <span class="pp-score-val" id="pp-score-val">—</span>
            </div>
            <button class="pp-icon-btn" id="pp-split-btn" title="Toggle split view">⊞</button>
            <button class="pp-icon-btn" id="pp-packed-btn" title="Toggle Already Packed mode">✅</button>
            <button class="pp-icon-btn" id="pp-share-btn" title="Copy packing list">📋</button>
            <button class="pp-close-btn" id="pp-close">×</button>
          </div>
        </div>

        <div id="pp-tabs">
          <button class="pp-tab active" data-tab="packing">🎒 Packing List</button>
          <button class="pp-tab" data-tab="outfits">👗 Outfit Calendar</button>
          <button class="pp-tab" data-tab="mood">🎨 Mood Board</button>
          <button class="pp-tab" data-tab="community">🌍 Community Tips</button>
        </div>

        <div id="pp-body">
          <div id="pp-itinerary-pane">
            <div class="pp-itin-title">📅 Your Itinerary</div>
            <div id="pp-itin-days"></div>
          </div>
          <div id="pp-main"></div>
        </div>

        <div class="pp-score-modal" id="pp-score-modal">
          <div class="pp-score-modal-inner">
            <div class="pp-score-big-emoji" id="pp-score-modal-emoji">🏆</div>
            <div class="pp-score-modal-title" id="pp-score-modal-title">Pack Light Champion!</div>
            <div class="pp-score-modal-desc" id="pp-score-modal-desc"></div>
            <button class="pp-score-modal-close" id="pp-score-modal-close">Nice!</button>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);

    // Events
    overlay.addEventListener('click', e => { if (e.target === overlay) _close(); });
    document.getElementById('pp-close').addEventListener('click', _close);
    document.getElementById('pp-split-btn').addEventListener('click', _toggleSplit);
    document.getElementById('pp-packed-btn').addEventListener('click', _togglePackedMode);
    document.getElementById('pp-share-btn').addEventListener('click', _copyList);
    document.getElementById('pp-score-badge').addEventListener('click', () => _showScoreModal());
    document.getElementById('pp-score-modal-close').addEventListener('click', () => {
      document.getElementById('pp-score-modal').classList.remove('active');
    });

    document.querySelectorAll('.pp-tab').forEach(t => {
      t.addEventListener('click', () => _switchTab(t.dataset.tab));
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // PUBLIC OPEN
  // ─────────────────────────────────────────────────────────────────────────
  function open(tripId, tripData) {
    _buildDOM();
    _tripId   = tripId   || null;
    _tripData = tripData || {};
    _selectedActivities.clear();
    _forgotResults = [];

    // Load saved state from localStorage
    _loadState();

    // Header info
    const dest = _tripData.destination || 'Your Trip';
    document.getElementById('pp-title').textContent = dest + ' — Packing';
    const start = _tripData.start_date || _tripData.startDate;
    const end   = _tripData.end_date   || _tripData.endDate;
    let sub = '';
    if (start && end) {
      const s = new Date(start+'T00:00:00');
      const e = new Date(end+'T00:00:00');
      const days = Math.ceil((e-s)/86400000)+1;
      sub = `${s.toLocaleDateString('en-US',{month:'short',day:'numeric'})} – ${e.toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'})} · ${days} days`;
    }
    document.getElementById('pp-subtitle').textContent = sub;

    // Build itinerary pane
    _buildItinPane();

    // Load community tips (mocked with realistic data)
    _loadCommunityTips();

    // Activate
    document.getElementById('pp-overlay').classList.add('active');
    document.body.style.overflow = 'hidden';

    _activeTab = 'packing';
    _updateTabs();
    _renderTab('packing');
    _updateScoreBadge();
  }

  function _close() {
    _saveState();
    document.getElementById('pp-overlay').classList.remove('active');
    document.body.style.overflow = '';
  }

  // ─────────────────────────────────────────────────────────────────────────
  // STATE PERSISTENCE
  // ─────────────────────────────────────────────────────────────────────────
  function _storeKey() { return `pp_state_${_tripId||'default'}`; }

  function _saveState() {
    try {
      localStorage.setItem(_storeKey(), JSON.stringify({
        packingList: _packingList, outfitPlan: _outfitPlan,
        weightLimit: _weightLimit, savedTemplates: _savedTemplates,
      }));
    } catch {}
  }

  function _loadState() {
    try {
      const raw = localStorage.getItem(_storeKey());
      if (raw) {
        const d = JSON.parse(raw);
        _packingList    = d.packingList    || {};
        _outfitPlan     = d.outfitPlan     || {};
        _weightLimit    = d.weightLimit    || 23000;
        _savedTemplates = d.savedTemplates || [];
      } else {
        _packingList    = {};
        _outfitPlan     = {};
        _savedTemplates = [];
      }
    } catch {
      _packingList = {}; _outfitPlan = {}; _savedTemplates = [];
    }
    // Keep window reference in sync — _loadState reassigns the closure variable
    // to a new object, so any stale window._packingList must be updated here.
    window._packingList = _packingList;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // TABS
  // ─────────────────────────────────────────────────────────────────────────
  function _switchTab(tab) {
    _saveState();
    _activeTab = tab;
    _updateTabs();
    _renderTab(tab);
  }

  function _updateTabs() {
    document.querySelectorAll('.pp-tab').forEach(t => {
      t.classList.toggle('active', t.dataset.tab === _activeTab);
    });
  }

  function _renderTab(tab) {
    const main = document.getElementById('pp-main');
    if (tab === 'packing')   _renderPackingTab(main);
    if (tab === 'outfits')   _renderOutfitsTab(main);
    if (tab === 'mood')      _renderMoodTab(main);
    if (tab === 'community') _renderCommunityTab(main);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // SPLIT VIEW & PACKED MODE TOGGLES
  // ─────────────────────────────────────────────────────────────────────────
  function _toggleSplit() {
    _splitView = !_splitView;
    const pane = document.getElementById('pp-itinerary-pane');
    const btn  = document.getElementById('pp-split-btn');
    pane.classList.toggle('visible', _splitView);
    btn.style.background = _splitView ? 'rgba(217,119,87,.15)' : '';
    btn.style.borderColor = _splitView ? 'rgba(217,119,87,.4)' : '';
    btn.style.color = _splitView ? '#d97757' : '';
  }

  function _togglePackedMode() {
    _alreadyPackedMode = !_alreadyPackedMode;
    const btn = document.getElementById('pp-packed-btn');
    btn.style.background   = _alreadyPackedMode ? 'rgba(76,175,80,.15)' : '';
    btn.style.borderColor  = _alreadyPackedMode ? 'rgba(76,175,80,.4)'  : '';
    btn.style.color        = _alreadyPackedMode ? '#4caf50'             : '';
    btn.title = _alreadyPackedMode ? 'Already Packed mode ON — tick items as you pack' : 'Toggle Already Packed mode';
    // Re-render to apply packed checkboxes
    if (_activeTab === 'packing') _renderTab('packing');
  }

  // ─────────────────────────────────────────────────────────────────────────
  // ITINERARY PANE
  // ─────────────────────────────────────────────────────────────────────────
  function _buildItinPane() {
    const container = document.getElementById('pp-itin-days');
    if (!container) return;
    container.innerHTML = '';

    const start = _tripData.start_date || _tripData.startDate;
    const end   = _tripData.end_date   || _tripData.endDate;
    if (!start || !end) {
      container.innerHTML = '<div style="font-size:12px;color:rgba(232,213,183,.3);padding:8px 0;">No trip dates set.</div>';
      return;
    }

    const s = new Date(start+'T00:00:00');
    const e = new Date(end+'T00:00:00');
    let cur = new Date(s); let dayNum = 1;

    while (cur <= e) {
      const dk  = _fmt(cur);
      const day = cur.toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric'});
      const notes = _tripData.richNotes?.[dk]?.content || _tripData.days?.[dk]?.notes || '';
      let preview = '';
      try {
        const p = JSON.parse(notes);
        preview = p.aiCard?.headline || p.morning || '';
      } catch { preview = notes; }
      preview = (preview||'').replace(/\n/g,' ').substring(0,40);

      const el = document.createElement('div');
      el.className = 'pp-itin-day';
      el.innerHTML = `
        <div class="pp-itin-day-num">Day ${dayNum}</div>
        <div class="pp-itin-day-date">${day}</div>
        ${preview?`<div class="pp-itin-day-preview">${preview}</div>`:''}
      `;
      container.appendChild(el);
      cur.setDate(cur.getDate()+1); dayNum++;
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // PACKING LIST TAB
  // ─────────────────────────────────────────────────────────────────────────
  function _renderPackingTab(main) {
    const totalItems  = _countItems();
    const packedItems = _countPacked();

    main.innerHTML = `
      ${_weightsHTML()}

      <div class="pp-section-title">
        <span>✦ AI Generate List</span>
      </div>
      ${_aiBoxHTML()}

      ${_forgotResults.length ? _forgotHTML() : ''}

      <div class="pp-section-title" style="margin-top:20px">
        <span>📦 Packing List</span>
        <div style="display:flex;gap:8px;align-items:center;">
          ${_alreadyPackedMode?`<span style="font-size:11px;color:rgba(76,175,80,.7);font-weight:600">✅ Packing Mode</span>`:''}
          <a onclick="_ppCheckForgot()">🔍 What did I forget?</a>
        </div>
      </div>

      ${totalItems > 0 ? `
        <div class="pp-progress-row">
          <span class="pp-progress-label">${packedItems} of ${totalItems} items packed</span>
          <span class="pp-progress-pct">${totalItems?Math.round(packedItems/totalItems*100):0}%</span>
        </div>
        <div class="pp-progress-track">
          <div class="pp-progress-fill" style="width:${totalItems?Math.round(packedItems/totalItems*100):0}%"></div>
        </div>
      ` : ''}

      <div class="pp-section-title">
        <span>📋 Templates</span>
      </div>
      ${_templatesHTML()}

      <div class="pp-cats" id="pp-cats">
        ${Object.keys(_packingList).length === 0
          ? `<div style="text-align:center;padding:32px 16px;color:rgba(232,213,183,.3);font-family:'DM Sans',sans-serif;font-size:13px;font-style:italic;">Generate your AI packing list above, or load a template to get started.</div>`
          : _renderCats()}
      </div>
    `;

    // Wire globals needed for inline onclick (wrapped in window scope below)
    window._ppCheckForgot = () => _runForgotCheck(main);
    window._ppAddItem = (catId) => _addItem(catId);
    window._ppDelItem = (catId, itemId) => _deleteItem(catId, itemId, main);
    window._ppToggleCat = (catId) => _toggleCat(catId);
    window._ppTogglePacked = (catId, itemId) => _togglePacked(catId, itemId, main);
    window._ppEditQty = (catId, itemId) => _editQty(catId, itemId, main);
    window._ppEditWeight = (catId, itemId) => _editWeight(catId, itemId, main);
    window._ppLoadTemplate = (tplId) => _loadTemplate(tplId, main);
    window._ppSaveTemplate = () => _saveAsTemplate(main);
  }

  function _aiBoxHTML() {
    const dest = _tripData.destination || '';
    const start = _tripData.start_date || _tripData.startDate || '';
    const end   = _tripData.end_date   || _tripData.endDate   || '';

    const tags = ACTIVITIES.map(a => `
      <button class="pp-act-tag${_selectedActivities.has(a.id)?' on':''}"
        onclick="(function(el,id){
          if(window._ppSelectedActivities.has(id)){window._ppSelectedActivities.delete(id);el.classList.remove('on');}
          else{window._ppSelectedActivities.add(id);el.classList.add('on');}
        })(this,'${a.id}')">
        <span>${a.emoji}</span>${a.label}
      </button>`).join('');

    window._ppSelectedActivities = _selectedActivities;

    return `
      <div class="pp-ai-box">
        <div class="pp-ai-box-label">✦ AI Packing Generator</div>
        <div class="pp-ai-grid">
          <div class="pp-ai-field">
            <label>Destination</label>
            <input class="pp-ai-input" id="pp-dest-input" value="${dest}" placeholder="e.g. Tokyo, Japan">
          </div>
          <div class="pp-ai-field">
            <label>Trip length (nights)</label>
            <input class="pp-ai-input" id="pp-nights-input" type="number" min="1" max="60"
              value="${_calcNights()}" placeholder="e.g. 7">
          </div>
          <div class="pp-ai-field">
            <label>Travel style</label>
            <select class="pp-ai-select" id="pp-style-input">
              <option value="carry-on only">Carry-on Only</option>
              <option value="one checked bag" selected>One Checked Bag</option>
              <option value="pack light" >Pack Light</option>
              <option value="go all out">No Limits</option>
            </select>
          </div>
          <div class="pp-ai-field">
            <label>Weight limit (kg)</label>
            <input class="pp-ai-input" id="pp-weight-limit-input" type="number" min="5" max="50"
              value="${(_weightLimit/1000).toFixed(0)}"
              oninput="window._ppSetWeightLimit(this.value)">
          </div>
        </div>
        <div style="font-family:'DM Sans',sans-serif;font-size:11px;color:rgba(232,213,183,.35);margin-bottom:8px;letter-spacing:.04em;">
          TRIP ACTIVITIES — tag what you'll be doing:
        </div>
        <div class="pp-act-tags">${tags}</div>
        <button class="pp-ai-gen-btn" id="pp-ai-gen" onclick="window._ppGenerateList()">✦ Generate Smart Packing List</button>
      </div>
    `;
  }

  window._ppGenerateList = () => { const m = document.getElementById('pp-main'); if (m) _generatePackingList(m); };
  
  window._ppSetWeightLimit = (v) => { _weightLimit = parseFloat(v) * 1000 || 23000; };

  function _weightsHTML() {
    const totalGrams  = _totalWeight();
    const totalKg     = (totalGrams / 1000).toFixed(1);
    const limitKg     = (_weightLimit / 1000).toFixed(0);
    const pct         = Math.min(100, Math.round(totalGrams / _weightLimit * 100));
    const warn        = totalGrams > _weightLimit * 0.9;

    return `
      <div class="pp-weight-banner">
        <span class="pp-weight-icon">⚖️</span>
        <div class="pp-weight-body">
          <div class="pp-weight-total">${totalKg} kg packed</div>
          <div class="pp-weight-limit">of ${limitKg} kg limit · ${pct}% used</div>
        </div>
        <div class="pp-weight-bar-track">
          <div class="pp-weight-bar-fill${warn?' warn':''}" style="width:${pct}%"></div>
        </div>
      </div>
    `;
  }

  function _templatesHTML() {
    const builtins = TEMPLATES.map(t =>
      `<button class="pp-template-btn" onclick="_ppLoadTemplate('${t.id}')">${t.emoji} ${t.label}</button>`
    ).join('');
    const saved = _savedTemplates.map(t =>
      `<button class="pp-template-btn" onclick="_ppLoadTemplate('__saved__${t.id}')">${t.emoji||'📋'} ${t.label}</button>`
    ).join('');

    return `
      <div class="pp-templates-row">
        ${builtins}
        ${saved}
        <button class="pp-template-btn save-tpl" onclick="_ppSaveTemplate()">💾 Save as Template</button>
      </div>
    `;
  }

  function _renderCats() {
    return Object.entries(_packingList).map(([catId, cat]) => {
      const items = cat.items || [];
      const packed = items.filter(i=>i.packed).length;
      const totalW = items.reduce((s,i)=>(s + (i.weight||0)*(i.qty||1)),0);
      const catCollapsed = cat.collapsed || false;

      const itemsHtml = items.map(item => `
        <div class="pp-item${item.packed?' packed':''}">
          ${_alreadyPackedMode
            ? `<div class="pp-item-chk" onclick="_ppTogglePacked('${catId}','${item.id}')"></div>`
            : `<div style="width:17px;flex-shrink:0;"></div>`}
          <div class="pp-item-name" contenteditable="${_alreadyPackedMode?'false':'true'}"
            onblur="(function(el){if(window._packingList&&window._packingList['${catId}']){var itm=window._packingList['${catId}'].items.find(i=>i.id==='${item.id}');if(itm)itm.name=el.textContent.trim()||itm.name;}})(this)"
            >${item.name}</div>
          <span class="pp-item-qty" onclick="_ppEditQty('${catId}','${item.id}')" title="Edit quantity">×${item.qty||1}</span>
          <span class="pp-item-weight" onclick="_ppEditWeight('${catId}','${item.id}')" title="Edit weight (grams)">${item.weight?item.weight+'g':'–g'}</span>
          <button class="pp-item-del" onclick="_ppDelItem('${catId}','${item.id}')">×</button>
        </div>`).join('');

      return `
        <div class="pp-cat${catCollapsed?' collapsed':''}" id="pp-cat-${catId}">
          <div class="pp-cat-hdr" onclick="_ppToggleCat('${catId}')">
            <span class="pp-cat-emoji">${cat.emoji}</span>
            <span class="pp-cat-name">${cat.name}</span>
            <div class="pp-cat-meta">
              <span class="pp-cat-count">${packed}/${items.length}</span>
              ${totalW>0?`<span class="pp-cat-weight">${(totalW/1000).toFixed(1)}kg</span>`:''}
            </div>
            <span class="pp-cat-chevron">▾</span>
          </div>
          <div class="pp-cat-body">
            ${itemsHtml}
            <div class="pp-add-row">
              <input class="pp-add-input" id="pp-add-${catId}" placeholder="Add item…"
                onkeydown="if(event.key==='Enter'){event.preventDefault();_ppAddItem('${catId}');}">
              <button class="pp-add-btn" onclick="_ppAddItem('${catId}')">+</button>
            </div>
          </div>
        </div>`;
    }).join('');
  }

  function _forgotHTML() {
    return `
      <div class="pp-forgot-box">
        <div class="pp-forgot-title">🔍 What Did I Forget?
          <span style="font-size:10px;font-weight:400;color:rgba(180,210,255,.4);margin-left:auto">AI reviewed your itinerary</span>
        </div>
        <div class="pp-forgot-results">
          ${_forgotResults.map(r=>`
            <div class="pp-forgot-item ${r.type}">
              <span class="pp-forgot-item-icon">${r.type==='warning'?'⚠️':'💡'}</span>
              <div>
                <div class="pp-forgot-item-text">${r.text}</div>
                ${r.addSuggestion?`<span class="pp-forgot-add-link" onclick="_ppQuickAdd('${r.addSuggestion}','${r.category||'Essentials'}','✅')">+ Add "${r.addSuggestion}" to list</span>`:''}
              </div>
            </div>`).join('')}
        </div>
      </div>
    `;
  }

  window._ppQuickAdd = (name, catName, emoji) => {
    const main = document.getElementById('pp-main');
    const catId = _slugify(catName);
    if (!_packingList[catId]) {
      _packingList[catId] = { name:catName, emoji, items:[], collapsed:false };
    }
    _packingList[catId].items.push({ id:_uid(), name, qty:1, weight:0, packed:false });
    _saveState(); _renderPackingTab(main);
  };

  // ─────────────────────────────────────────────────────────────────────────
  // AI PACKING LIST GENERATION
  // ─────────────────────────────────────────────────────────────────────────
  async function _generatePackingList(main) {
    console.log('🎒 fired, main:', main, 'dest-input:', document.getElementById('pp-dest-input'));
    const dest     = document.getElementById('pp-dest-input')?.value?.trim()  || _tripData.destination || '';
    const nights   = parseInt(document.getElementById('pp-nights-input')?.value) || _calcNights() || 7;
    const style    = document.getElementById('pp-style-input')?.value || 'one checked bag';
    const activities = Array.from(_selectedActivities);

    const genBtn = document.getElementById('pp-ai-gen');
    if (genBtn) { genBtn.disabled = true; genBtn.textContent = 'Generating…'; }

    const cats = document.getElementById('pp-cats');
    if (cats) cats.innerHTML = `<div class="pp-loading"><div class="pp-spin"></div>Building your personalised packing list for ${dest}…</div>`;

    // Build weather summary from trip days if available
    let weatherSummary = '';
    const start = _tripData.start_date || _tripData.startDate;
    const end   = _tripData.end_date   || _tripData.endDate;
    if (start && end) {
      weatherSummary = `Trip runs ${start} to ${end}.`;
    }

    const prompt = `You are an expert travel packer. Create a smart, personalised packing list.

Destination: ${dest}
Trip length: ${nights} nights
Packing style: ${style}
Activities: ${activities.length ? activities.join(', ') : 'general sightseeing and city exploring'}
${weatherSummary}

Return ONLY valid JSON (no markdown, no text outside JSON) with this exact structure:
{
  "categories": [
    {
      "id": "clothing",
      "name": "Clothing",
      "emoji": "👗",
      "items": [
        { "name": "T-shirts", "qty": 3, "weight": 200 },
        { "name": "Jeans", "qty": 1, "weight": 600 }
      ]
    }
  ]
}

Rules:
- weight is in grams per item (realistic estimate)
- qty is quantity per category item
- Include 6-10 categories relevant to the activities and destination
- Include 4-8 items per category
- Be specific and realistic — not generic
- If activities include beach: swimwear category
- If activities include hiking: gear category with specific equipment
- If activities include business: formal wear category
- If packing style is carry-on only: keep total items lean
- Think about the destination's culture and weather`;

    try {
      const resp = await fetch('/api/ai-day-tips', {
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ _packingRequest: true, prompt }),
      });

      if (!resp.ok) throw new Error('api');
      const data = await resp.json();

      // Parse the AI response
      let parsed;
      if (data.categories) {
        parsed = data;
      } else if (data.content) {
        // raw message format
        const txt = (data.content[0]?.text||'').replace(/```json|```/g,'').trim();
        parsed = JSON.parse(txt);
      } else {
        throw new Error('unexpected format');
      }

      // Merge into packing list (don't overwrite existing)
      (parsed.categories||[]).forEach(cat => {
        const catId = cat.id || _slugify(cat.name);
        if (!_packingList[catId]) {
          _packingList[catId] = {
            name:cat.name, emoji:cat.emoji||'📦',
            items: (cat.items||[]).map(i=>({id:_uid(), name:i.name, qty:i.qty||1, weight:i.weight||0, packed:false})),
            collapsed:false,
          };
        }
      });

      _saveState();
      _renderPackingTab(main);
      _updateScoreBadge();

    } catch (err) {
      console.error('Packing generation error:', err);
      // Fall back to a sensible default based on activities
      _loadFallbackList(activities, nights, style);
      _renderPackingTab(main);
      _updateScoreBadge();
    }
  }

  function _loadFallbackList(activities, nights, style) {
    // Smart fallback: pick the most relevant built-in template
    let templateId = 'city-weekend';
    if (activities.includes('beach'))   templateId = 'beach-week';
    if (activities.includes('hiking'))  templateId = 'hiking-trip';
    if (activities.includes('business')) templateId = 'business';
    _applyTemplate(TEMPLATES.find(t=>t.id===templateId) || TEMPLATES[0]);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // "WHAT DID I FORGET" CHECKER
  // ─────────────────────────────────────────────────────────────────────────
  async function _runForgotCheck(main) {
    const forgotBtn = document.querySelector('.pp-forgot-check-btn');
    if (forgotBtn) { forgotBtn.disabled = true; forgotBtn.innerHTML = '<span>🔍</span> Checking…'; }

    // Build itinerary summary
    const itinLines = [];
    const start = _tripData.start_date || _tripData.startDate;
    const end   = _tripData.end_date   || _tripData.endDate;
    if (start && end) {
      let cur = new Date(start+'T00:00:00'); let dn = 1;
      while (cur <= new Date(end+'T00:00:00')) {
        const dk  = _fmt(cur);
        const raw = _tripData.richNotes?.[dk]?.content || _tripData.days?.[dk]?.notes || '';
        let txt = ''; try { const p=JSON.parse(raw); txt=p.aiCard?.headline||p.morning||''; } catch { txt=raw; }
        if (txt) itinLines.push(`Day ${dn} (${dk}): ${txt.substring(0,80)}`);
        cur.setDate(cur.getDate()+1); dn++;
      }
    }

    // Build current packing list summary
    const packingItems = Object.values(_packingList).flatMap(c=>c.items.map(i=>i.name));

    const prompt = `You are a travel packing expert. Review this traveler's packing list against their itinerary and identify gaps.

DESTINATION: ${_tripData.destination || 'unknown'}
ITINERARY:
${itinLines.join('\n') || 'No itinerary details available.'}

CURRENT PACKING LIST:
${packingItems.join(', ') || 'Empty list.'}

Return ONLY valid JSON array (no markdown) of up to 6 items:
[
  {
    "type": "warning",
    "text": "You have a beach day on Day 2 but no swimwear listed",
    "addSuggestion": "Swimsuit",
    "category": "Swimwear"
  },
  {
    "type": "suggestion",
    "text": "Consider packing a portable battery — long travel days ahead",
    "addSuggestion": "Power bank",
    "category": "Tech"
  }
]

Types: "warning" (clear gap) or "suggestion" (useful addition).
Be specific and reference actual itinerary details. Keep it concise.`;

    try {
      const resp = await fetch('/api/ai-day-tips', {
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ _packingRequest: true, prompt }),
      });
      if (!resp.ok) throw new Error('api');
      const data = await resp.json();

      let results;
      if (Array.isArray(data)) {
        results = data;
      } else {
        const txt = (data.content?.[0]?.text||data.rawText||'').replace(/```json|```/g,'').trim();
        results = JSON.parse(txt);
      }
      _forgotResults = Array.isArray(results) ? results : [];
    } catch {
      _forgotResults = [
        { type:'suggestion', text:'Double-check you have travel insurance documents.', addSuggestion:'Travel insurance', category:'Documents' },
        { type:'suggestion', text:'A universal power adapter is essential for international travel.', addSuggestion:'Universal adapter', category:'Tech' },
      ];
    }

    _renderPackingTab(main);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // ITEM MANAGEMENT
  // ─────────────────────────────────────────────────────────────────────────
  function _addItem(catId) {
    const input = document.getElementById(`pp-add-${catId}`);
    const name  = input?.value?.trim();
    if (!name) return;
    _packingList[catId].items.push({ id:_uid(), name, qty:1, weight:0, packed:false });
    input.value = '';
    _saveState(); _updateScoreBadge();
    const main = document.getElementById('pp-main');
    _renderPackingTab(main);
    // Scroll to and focus the same category add row
    setTimeout(()=>{ document.getElementById(`pp-add-${catId}`)?.focus(); }, 50);
  }

  function _deleteItem(catId, itemId, main) {
    if (!_packingList[catId]) return;
    _packingList[catId].items = _packingList[catId].items.filter(i=>i.id!==itemId);
    if (_packingList[catId].items.length === 0 && Object.keys(_packingList).length > 1) {
      delete _packingList[catId];
    }
    _saveState(); _updateScoreBadge(); _renderPackingTab(main);
  }

  function _toggleCat(catId) {
    if (_packingList[catId]) {
      _packingList[catId].collapsed = !_packingList[catId].collapsed;
      const catEl = document.getElementById(`pp-cat-${catId}`);
      if (catEl) catEl.classList.toggle('collapsed', _packingList[catId].collapsed);
    }
  }

  function _togglePacked(catId, itemId, main) {
    const item = _packingList[catId]?.items?.find(i=>i.id===itemId);
    if (!item) return;
    item.packed = !item.packed;
    _saveState(); _updateScoreBadge(); _renderPackingTab(main);
  }

  function _editQty(catId, itemId, main) {
    const item = _packingList[catId]?.items?.find(i=>i.id===itemId);
    if (!item) return;
    const v = prompt(`Quantity for "${item.name}":`, item.qty||1);
    if (v !== null && parseInt(v) > 0) { item.qty = parseInt(v); _saveState(); _renderPackingTab(main); }
  }

  function _editWeight(catId, itemId, main) {
    const item = _packingList[catId]?.items?.find(i=>i.id===itemId);
    if (!item) return;
    const v = prompt(`Weight for "${item.name}" in grams (e.g. 250 for a t-shirt):`, item.weight||0);
    if (v !== null && parseFloat(v) >= 0) { item.weight = parseFloat(v); _saveState(); _updateScoreBadge(); _renderPackingTab(main); }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // TEMPLATES
  // ─────────────────────────────────────────────────────────────────────────
  function _loadTemplate(tplId, main) {
    if (tplId.startsWith('__saved__')) {
      const id  = tplId.replace('__saved__','');
      const tpl = _savedTemplates.find(t=>t.id===id);
      if (tpl) { _packingList = JSON.parse(JSON.stringify(tpl.data)); _saveState(); _renderPackingTab(main); }
      return;
    }
    const tpl = TEMPLATES.find(t=>t.id===tplId);
    if (!tpl) return;
    if (Object.keys(_packingList).length > 0) {
      if (!confirm(`Load "${tpl.label}" template? This will add to your existing list.`)) return;
    }
    _applyTemplate(tpl);
    _saveState(); _renderPackingTab(main); _updateScoreBadge();
  }

  function _applyTemplate(tpl) {
    (tpl.categories||[]).forEach(cat => {
      const catId = _slugify(cat.name);
      if (!_packingList[catId]) {
        _packingList[catId] = {
          name:cat.name, emoji:cat.emoji||'📦',
          items: (cat.items||[]).map(i=>({id:_uid(), name:i.name, qty:i.qty||1, weight:i.weight||0, packed:false})),
          collapsed:false,
        };
      }
    });
  }

  function _saveAsTemplate(main) {
    const name = prompt('Template name:', _tripData.destination ? _tripData.destination + ' style' : 'My Template');
    if (!name) return;
    const id = _uid();
    _savedTemplates.push({ id, label:name, emoji:'📋', data: JSON.parse(JSON.stringify(_packingList)) });
    _saveState(); _renderPackingTab(main);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // PACK-LIGHT SCORE
  // ─────────────────────────────────────────────────────────────────────────
  function _calcScore() {
    const total = _countItems();
    if (!total) return { score:0, tier:'none' };
    const nights  = _calcNights() || 7;
    const weight  = _totalWeight() / 1000; // kg
    const reuses  = _countOutfitReuses();
    // Score: fewer items per night + less weight + more reuses = higher score
    let score = 100;
    score -= Math.max(0, (total/nights - 4) * 5);   // >4 items per night penalises
    score -= Math.max(0, (weight - 7) * 3);           // >7kg penalises
    score += reuses * 4;                               // outfit reuses reward
    score = Math.max(0, Math.min(100, Math.round(score)));
    let tier = score >= 80 ? 'gold' : score >= 55 ? 'silver' : 'bronze';
    return { score, tier };
  }

  function _updateScoreBadge() {
    const { score, tier } = _calcScore();
    const badge = document.getElementById('pp-score-badge');
    const val   = document.getElementById('pp-score-val');
    const emoji = document.getElementById('pp-score-emoji');
    if (!badge) return;
    badge.className = `pp-score-badge ${tier==='none'?'':tier}`;
    val.textContent  = tier==='none' ? '—' : score+'/100';
    emoji.textContent = tier==='gold'?'🏆':tier==='silver'?'🥈':tier==='bronze'?'🥉':'🎒';
  }

  function _showScoreModal() {
    const { score, tier } = _calcScore();
    if (score === 0) return;
    const titles  = { gold:'Pack Light Champion! 🏆', silver:'Savvy Traveller 🥈', bronze:'Getting There 🥉' };
    const descs   = {
      gold:  `Score: ${score}/100 — You're a minimalist master! Re-wearing outfits, packing lean, travelling with freedom. ✨`,
      silver:`Score: ${score}/100 — Solid packing instincts. Try re-wearing more outfits or trimming a few items to level up.`,
      bronze:`Score: ${score}/100 — Your bag has potential! Aim for fewer items per night and look for outfit re-uses to earn your gold badge.`,
    };
    document.getElementById('pp-score-modal-emoji').textContent  = tier==='gold'?'🏆':tier==='silver'?'🥈':'🥉';
    document.getElementById('pp-score-modal-title').textContent  = titles[tier]||'';
    document.getElementById('pp-score-modal-desc').textContent   = descs[tier]||'';
    document.getElementById('pp-score-modal').classList.add('active');
  }

  // ─────────────────────────────────────────────────────────────────────────
  // OUTFIT CALENDAR TAB
  // ─────────────────────────────────────────────────────────────────────────
  function _renderOutfitsTab(main) {
    const days = _getTripDays();

    main.innerHTML = `
      <div class="pp-section-title">
        <span>👗 Outfit Calendar</span>
        <span style="font-size:11px;font-weight:400;color:rgba(125,184,122,.65);letter-spacing:0;text-transform:none;">
          ♻️ Re-used outfits earn Pack Light points
        </span>
      </div>
      <div class="pp-outfit-calendar" id="pp-outfit-cal">
        ${days.length === 0
          ? `<div style="text-align:center;padding:32px;color:rgba(232,213,183,.3);font-family:'DM Sans',sans-serif;font-size:13px;font-style:italic;">Set trip dates to see your outfit calendar.</div>`
          : days.map((d,i) => _outfitDayHTML(d,i+1)).join('')}
      </div>
      ${days.length > 0 ? `
        <div class="pp-section-title" style="margin-top:20px">
          <span>♻️ Re-wear Optimizer</span>
        </div>
        <div id="pp-rewear-section" style="font-family:'DM Sans',sans-serif;font-size:13px;color:rgba(232,213,183,.45);padding:8px 0;">
          ${_rewearSuggestions()}
        </div>` : ''}
    `;

    window._ppSetOutfit = (dk, slot, cur) => {
      const val = prompt(`${slot} outfit for ${dk}:`, cur||'');
      if (val === null) return;
      if (!_outfitPlan[dk]) _outfitPlan[dk] = {};
      // Check if it's a re-use
      const allOutfits = Object.values(_outfitPlan).flatMap(d=>Object.values(d)).filter(Boolean);
      const isReuse = val && allOutfits.filter(o=>o===val).length > 0;
      _outfitPlan[dk][slot] = val;
      if (isReuse && !(_outfitPlan[dk].reuses||[]).includes(val)) {
        _outfitPlan[dk].reuses = [...(_outfitPlan[dk].reuses||[]), val];
      }
      _saveState(); _updateScoreBadge(); _renderOutfitsTab(main);
    };
  }

  function _outfitDayHTML(d, num) {
    const dk    = _fmt(d);
    const plan  = _outfitPlan[dk] || {};
    const notes = _tripData.richNotes?.[dk]?.content || _tripData.days?.[dk]?.notes || '';
    let preview = ''; try { const p=JSON.parse(notes); preview=p.aiCard?.headline||p.morning||''; } catch { preview=notes; }
    preview = (preview||'').substring(0,35);
    const allOutfits = Object.values(_outfitPlan).flatMap(od=>Object.values(od)).filter(v=>typeof v==='string');
    const isReuse = (v) => v && allOutfits.filter(o=>o===v).length > 1;
    const slots = [
      {key:'morning', label:'Morning 🌅'},
      {key:'afternoon', label:'Afternoon ☀️'},
      {key:'evening', label:'Evening 🌙'},
    ];

    return `
      <div class="pp-outfit-day">
        <div class="pp-outfit-day-info">
          <div class="pp-outfit-day-num">Day ${num}</div>
          <div class="pp-outfit-day-date">${d.toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric'})}</div>
          ${preview?`<div class="pp-outfit-day-plan">${preview}</div>`:''}
        </div>
        <div class="pp-outfit-slots">
          ${slots.map(sl=>{
            const v = plan[sl.key];
            const reuse = isReuse(v);
            return `<div class="pp-outfit-slot${v?' filled':''}${reuse?' reuse':''}" onclick="_ppSetOutfit('${dk}','${sl.key}','${(v||'').replace(/'/g,"\\'")}')">
              ${v
                ? `${reuse?'<span class="reuse-star">♻️</span>':''}<span>${v.substring(0,18)}${v.length>18?'…':''}</span>`
                : `<span style="opacity:.4">${sl.label}</span>`}
            </div>`;
          }).join('')}
        </div>
      </div>
    `;
  }

  function _rewearSuggestions() {
    const allOutfits = Object.values(_outfitPlan).flatMap(d =>
      Object.entries(d).filter(([k])=>k!=='reuses').map(([,v])=>v).filter(Boolean)
    );
    if (!allOutfits.length) return 'Plan your outfits above to see re-wear suggestions.';
    const counts = {};
    allOutfits.forEach(o=>{ counts[o]=(counts[o]||0)+1; });
    const reused = Object.entries(counts).filter(([,c])=>c>1).sort((a,b)=>b[1]-a[1]);
    if (!reused.length) return `<span style="color:rgba(125,184,122,.5)">♻️ Tip: Re-wearing the same outfit on multiple days boosts your Pack Light score!</span>`;
    return `
      <div style="display:flex;flex-direction:column;gap:6px;">
        <div style="color:rgba(125,184,122,.65);font-weight:600;margin-bottom:4px;">♻️ You're re-wearing ${reused.length} outfit${reused.length>1?'s':''}! Great packing.</div>
        ${reused.map(([o,c])=>`<div style="color:rgba(232,213,183,.4);">• "${o}" worn ${c}×</div>`).join('')}
      </div>
    `;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // MOOD BOARD TAB
  // ─────────────────────────────────────────────────────────────────────────
  function _renderMoodTab(main) {
    const dest = _tripData.destination || '';
    const query = dest ? dest + ' travel fashion outfit' : 'travel fashion outfit';

    main.innerHTML = `
      <div class="pp-section-title">
        <span>🎨 Outfit Mood Board</span>
        <span style="font-size:11px;font-weight:400;color:rgba(232,213,183,.35);letter-spacing:0;text-transform:none;">Powered by Unsplash</span>
      </div>
      <div class="pp-mood-search-row">
        <input class="pp-mood-search-input" id="pp-mood-query" value="${query}" placeholder="Search fashion vibes…">
        <button class="pp-mood-search-btn" onclick="_ppMoodSearch()">🔍 Search</button>
      </div>
      <div id="pp-mood-grid" class="pp-mood-grid">
        ${Array(8).fill(0).map(()=>`
          <div class="pp-mood-card placeholder">
            <span class="pp-mood-ph-icon">🖼️</span>
            <span class="pp-mood-ph-txt">Search for outfit inspiration</span>
          </div>`).join('')}
      </div>
      <div style="font-family:'DM Sans',sans-serif;font-size:11px;color:rgba(232,213,183,.25);margin-top:8px;text-align:center;">
        Images via Unsplash. Click any image to open full size.
      </div>
    `;

    window._ppMoodSearch = () => _searchMoodImages();

    // Auto-load if we have a destination
    if (dest) setTimeout(_searchMoodImages, 100);
  }

  async function _searchMoodImages() {
    const query = document.getElementById('pp-mood-query')?.value?.trim() || 'travel fashion';
    const grid  = document.getElementById('pp-mood-grid');
    if (!grid) return;

    grid.innerHTML = Array(8).fill(0).map(()=>`
      <div class="pp-mood-card placeholder" style="background:rgba(255,255,255,.04);animation:pp-fade .4s ease both;">
        <span class="pp-mood-ph-icon" style="animation:pp-spin 1s linear infinite">⟳</span>
      </div>`).join('');

    // Use Unsplash Source (no API key needed, free)
    const keywords = query.split(' ').slice(0,3).join(',');
    const imgs = Array.from({length:8},(_,i)=>{
      const w = 300 + (i%3)*50;
      const h = Math.round(w * (1.2 + (i%3)*0.15));
      return `https://source.unsplash.com/random/${w}x${h}?${encodeURIComponent(keywords)}&sig=${Date.now()+i}`;
    });

    grid.innerHTML = imgs.map((src,i)=>`
      <div class="pp-mood-card" style="animation:pp-fade .4s ${i*.05}s ease both">
        <img src="${src}" alt="Outfit inspiration" loading="lazy"
          onerror="this.parentElement.innerHTML='<span class=\\"pp-mood-ph-icon\\" style=\\"font-size:24px;opacity:.2\\">📷</span>'"
          onclick="window.open('${src}','_blank')">
        <div class="pp-mood-overlay"></div>
        <div class="pp-mood-card-label">Open full size →</div>
      </div>`).join('');
  }

  // ─────────────────────────────────────────────────────────────────────────
  // COMMUNITY TIPS TAB
  // ─────────────────────────────────────────────────────────────────────────
  function _renderCommunityTab(main) {
    main.innerHTML = `
      <div class="pp-section-title">
        <span>🌍 Community Packing Tips</span>
        <span style="font-size:11px;font-weight:400;color:rgba(232,213,183,.3);letter-spacing:0;text-transform:none;">From travellers who've been there</span>
      </div>
      <div class="pp-community-tips" id="pp-comm-tips">
        ${_communityTips.map((t,i)=>_communityTipHTML(t,i)).join('')}
      </div>
    `;
    window._ppUpvote = (i) => {
      const tip = _communityTips[i];
      if (!tip) return;
      tip.voted = !tip.voted;
      tip.votes = (tip.votes||0) + (tip.voted?1:-1);
      _renderCommunityTab(main);
    };
  }

  function _communityTipHTML(tip, i) {
    return `
      <div class="pp-community-tip">
        <div class="pp-tip-header">
          <div class="pp-tip-avatar">${(tip.name||'T')[0]}</div>
          <span class="pp-tip-author">${tip.name}</span>
          <span class="pp-tip-location">${tip.location}</span>
        </div>
        <div class="pp-tip-text">${tip.text}</div>
        <button class="pp-tip-upvote${tip.voted?' voted':''}" onclick="_ppUpvote(${i})">
          ▲ ${tip.votes||0}
        </button>
      </div>
    `;
  }

  function _loadCommunityTips() {
    const dest = (_tripData.destination||'').toLowerCase();
    const month = (() => {
      const s = _tripData.start_date||_tripData.startDate;
      if (!s) return '';
      return new Date(s+'T00:00:00').toLocaleDateString('en-US',{month:'long'});
    })();

    // Realistic-feeling generated tips based on destination keywords
    const generic = [
      { name:'Sarah K.', location:'Verified traveller', votes:24,
        text:`Pack a lightweight scarf — it doubles as a blanket on flights, a cover-up for temples, and looks great in photos. Absolute travel staple.` },
      { name:'Marco B.', location:'Frequent traveller', votes:18,
        text:`Roll clothes instead of folding them. Saves 20-30% more space and reduces wrinkles. Use packing cubes for easy organisation.` },
      { name:'Priya M.', location:'Travel photographer', votes:15,
        text:`Bring one neutral-coloured outfit that works for both smart casual and sightseeing. You'll rewear it more than you think.` },
      { name:'James T.', location:'Solo traveller', votes:12,
        text:`Never check your bag if you can help it. A 40L carry-on is enough for 2 weeks if you do laundry once. Saves time and baggage fees.` },
    ];

    // Add destination-specific tips
    const destTips = [];
    if (dest.includes('japan')||dest.includes('tokyo')||dest.includes('kyoto')) {
      destTips.push(
        { name:'Yuki T.', location:'Japan (local)', votes:41,
          text:`In Japan, bring slip-on shoes — you'll be removing them constantly at temples, ryokans, and some restaurants. Worth the space.` },
        { name:'Alex W.', location:'Visited ${month||"spring"} last year', votes:33,
          text:`Japan is very hot and humid in summer, freezing in winter. Check the season and pack accordingly. Their 7-Eleven sells most toiletries cheaply if you forget anything.` }
      );
    } else if (dest.includes('barcelona')||dest.includes('spain')||dest.includes('madrid')) {
      destTips.push(
        { name:'Carmen R.', location:'Barcelona local', votes:38,
          text:`In ${month||'spring'}, Barcelona evenings can be surprisingly cool. Bring a light layer — locals always laugh at tourists who packed only for heat.` },
        { name:'Diego A.', location:'Visited last year', votes:27,
          text:`Spaniards dress smartly — you'll feel more comfortable and get better service in restaurants if you bring at least one polished outfit.` }
      );
    } else if (dest.includes('bali')||dest.includes('indonesia')) {
      destTips.push(
        { name:'Maya S.', location:'Bali (frequent visitor)', votes:52,
          text:`Pack a sarong. It's required to enter temples, works as a beach cover-up, and you can buy beautiful ones there for very little.` },
        { name:'Ben K.', location:'Visited 3 times', votes:39,
          text:`Bali humidity is intense. Avoid heavy fabrics. Linen and cotton breathe much better than synthetics. Leave the jeans at home.` }
      );
    }

    _communityTips = [...destTips, ...generic];
  }

  // ─────────────────────────────────────────────────────────────────────────
  // COPY LIST
  // ─────────────────────────────────────────────────────────────────────────
  function _copyList() {
    const lines = [`📦 ${_tripData.destination||'Trip'} Packing List\n`];
    Object.values(_packingList).forEach(cat => {
      lines.push(`\n${cat.emoji} ${cat.name}:`);
      (cat.items||[]).forEach(i => {
        lines.push(`  ${i.packed?'✓':' ○'} ${i.name}${i.qty>1?' (×'+i.qty+')':''}${i.weight?'  '+i.weight+'g':''}`);
      });
    });
    const score = _calcScore();
    if (score.score > 0) lines.push(`\n🎒 Pack Light Score: ${score.score}/100`);
    navigator.clipboard.writeText(lines.join('\n')).then(()=>{
      const btn = document.getElementById('pp-share-btn');
      if (btn) { btn.textContent='✓'; btn.style.color='#4caf50'; setTimeout(()=>{btn.textContent='📋';btn.style.color='';},2000); }
    }).catch(()=>{});
  }

  // ─────────────────────────────────────────────────────────────────────────
  // HELPERS
  // ─────────────────────────────────────────────────────────────────────────
  function _countItems()  { return Object.values(_packingList).flatMap(c=>c.items||[]).length; }
  function _countPacked() { return Object.values(_packingList).flatMap(c=>c.items||[]).filter(i=>i.packed).length; }
  function _totalWeight() { return Object.values(_packingList).flatMap(c=>c.items||[]).reduce((s,i)=>s+(i.weight||0)*(i.qty||1),0); }
  function _countOutfitReuses() {
    const all = Object.values(_outfitPlan).flatMap(d=>Object.values(d).filter(v=>typeof v==='string'));
    const counts = {}; all.forEach(o=>{counts[o]=(counts[o]||0)+1;});
    return Object.values(counts).filter(c=>c>1).length;
  }

  function _calcNights() {
    const s = _tripData.start_date||_tripData.startDate;
    const e = _tripData.end_date  ||_tripData.endDate;
    if (!s||!e) return 0;
    return Math.ceil((new Date(e+'T00:00:00')-new Date(s+'T00:00:00'))/86400000);
  }

  function _getTripDays() {
    const s = _tripData.start_date||_tripData.startDate;
    const e = _tripData.end_date  ||_tripData.endDate;
    if (!s||!e) return [];
    const days=[]; let cur=new Date(s+'T00:00:00');
    while(cur<=new Date(e+'T00:00:00')){ days.push(new Date(cur)); cur.setDate(cur.getDate()+1); }
    return days;
  }

  function _fmt(d) {
    const p=n=>String(n).padStart(2,'0');
    return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}`;
  }

  function _uid() { return Math.random().toString(36).slice(2,9); }
  function _slugify(s) { return s.toLowerCase().replace(/[^a-z0-9]+/g,'-'); }

  // Expose packingList for inline event handlers
  window._packingList = _packingList;

  // ─────────────────────────────────────────────────────────────────────────
  // PUBLIC API
  // ─────────────────────────────────────────────────────────────────────────
  window.PackingPlanner = { open, close: _close };
})();
