// ai-day-tips.js  —  Drop alongside ui.js
// Call: window.AIDayTips.open(destination, dateStr, dayNumber, onSave, weather, userPrefs)

(function () {
  'use strict';

  // ─── Styles ──────────────────────────────────────────────────────────────
  if (!document.getElementById('_adt_styles')) {
    const s = document.createElement('style');
    s.id = '_adt_styles';
    s.textContent = `
@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,500;0,700;1,500&family=DM+Sans:wght@300;400;500;600&display=swap');

.ai-tips-trigger {
  display:inline-flex;align-items:center;gap:8px;
  padding:10px 18px;
  background:linear-gradient(135deg,#1a1a2e 0%,#16213e 50%,#0f3460 100%);
  color:#e8d5b7;border:1px solid rgba(232,213,183,0.2);border-radius:10px;
  font-family:'DM Sans',sans-serif;font-size:14px;font-weight:500;
  cursor:pointer;transition:all .25s;letter-spacing:.01em;
}
.ai-tips-trigger:hover {
  background:linear-gradient(135deg,#0f3460,#16213e);
  border-color:rgba(232,213,183,0.5);transform:translateY(-1px);
  box-shadow:0 4px 20px rgba(15,52,96,.4);
}
.ai-tips-trigger .sparkle{font-size:16px;animation:adt-sparkle 3s ease-in-out infinite;}
@keyframes adt-sparkle{0%,100%{transform:rotate(0) scale(1);}50%{transform:rotate(15deg) scale(1.2);}}

/* ── Overlay ── */
#adt-overlay{
  display:none;position:fixed;inset:0;z-index:10000;
  background:rgba(10,10,20,.78);
  backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);
  align-items:center;justify-content:center;padding:20px;
}
#adt-overlay.open{display:flex;animation:adt-fade .25s ease;}
@keyframes adt-fade{from{opacity:0;}to{opacity:1;}}

/* ── Panel ── */
#adt-panel{
  width:100%;max-width:660px;max-height:92vh;
  background:#0d0d1a;border-radius:22px;
  border:1px solid rgba(232,213,183,.14);
  box-shadow:0 32px 80px rgba(0,0,0,.7),inset 0 1px 0 rgba(255,255,255,.04);
  display:flex;flex-direction:column;overflow:hidden;
  animation:adt-up .35s cubic-bezier(.16,1,.3,1);
}
@keyframes adt-up{from{opacity:0;transform:translateY(28px) scale(.97);}to{opacity:1;transform:none;}}

/* ── Header ── */
.adt-hdr{
  padding:24px 26px 18px;border-bottom:1px solid rgba(232,213,183,.07);
  flex-shrink:0;
}
.adt-hdr-top{display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:16px;}
.adt-label{font-family:'DM Sans',sans-serif;font-size:10px;font-weight:600;
  letter-spacing:.12em;text-transform:uppercase;color:rgba(232,213,183,.45);margin-bottom:5px;}
.adt-dest{font-family:'Playfair Display',serif;font-size:25px;font-weight:700;color:#f5efe6;line-height:1.2;}
.adt-date{font-family:'DM Sans',sans-serif;font-size:12px;color:rgba(232,213,183,.4);margin-top:3px;}
.adt-close{
  width:32px;height:32px;display:flex;align-items:center;justify-content:center;
  background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);
  border-radius:50%;color:rgba(232,213,183,.55);cursor:pointer;font-size:18px;
  flex-shrink:0;transition:all .2s;line-height:1;
}
.adt-close:hover{background:rgba(255,255,255,.1);color:#f5efe6;}

/* ── Weather strip ── */
.adt-wx{
  display:flex;align-items:center;gap:9px;padding:9px 13px;
  background:rgba(15,52,96,.32);border:1px solid rgba(100,160,230,.2);
  border-radius:10px;margin-bottom:14px;
  font-family:'DM Sans',sans-serif;font-size:13px;color:rgba(180,210,255,.75);
}
.adt-wx .wx-i{font-size:19px;flex-shrink:0;}
.adt-wx .wx-d{opacity:.6;margin-left:3px;}
.adt-wx.loading{opacity:.5;font-style:italic;}
.adt-wx.error{border-color:rgba(255,180,100,.2);color:rgba(255,200,130,.55);}

/* ── Vibe input (new free-text pref) ── */
.adt-vibe-row{margin-bottom:12px;}
.adt-input-label{
  font-family:'DM Sans',sans-serif;font-size:11px;color:rgba(232,213,183,.38);
  margin-bottom:7px;letter-spacing:.05em;
}
.adt-input-wrap{position:relative;}
.adt-input-wrap .adt-icon{
  position:absolute;left:11px;top:50%;transform:translateY(-50%);
  font-size:13px;pointer-events:none;opacity:.45;
}
.adt-vibe-input,.adt-loc-input{
  width:100%;padding:9px 12px 9px 32px;box-sizing:border-box;
  background:rgba(255,255,255,.05);border:1px solid rgba(232,213,183,.14);
  border-radius:9px;color:#f5efe6;
  font-family:'DM Sans',sans-serif;font-size:13px;outline:none;
  transition:border-color .2s,background .2s;
}
.adt-vibe-input::placeholder,.adt-loc-input::placeholder{color:rgba(232,213,183,.22);}
.adt-vibe-input:focus,.adt-loc-input:focus{
  border-color:rgba(232,213,183,.4);background:rgba(255,255,255,.07);
}

/* ── Location input ── */
.adt-loc-row{margin-bottom:14px;}

/* ── Preference pills ── */
.adt-prefs-label{
  font-family:'DM Sans',sans-serif;font-size:11px;color:rgba(232,213,183,.38);
  margin-bottom:9px;letter-spacing:.05em;
}
.adt-pills{display:flex;flex-wrap:wrap;gap:7px;}
.adt-pill{
  padding:5px 13px;border-radius:18px;
  background:rgba(232,213,183,.05);border:1px solid rgba(232,213,183,.1);
  color:rgba(232,213,183,.5);font-family:'DM Sans',sans-serif;font-size:12px;
  cursor:pointer;transition:all .18s;display:flex;align-items:center;gap:5px;
  user-select:none;
}
.adt-pill:hover{border-color:rgba(232,213,183,.28);color:rgba(232,213,183,.8);}
.adt-pill.on{background:rgba(232,213,183,.11);border-color:rgba(232,213,183,.45);color:#f5efe6;}

/* ── Generate btn ── */
.adt-gen-btn{
  margin-top:16px;width:100%;padding:12px;
  background:linear-gradient(135deg,#c9a96e 0%,#e8d5b7 50%,#c9a96e 100%);
  background-size:200% 100%;color:#0d0d1a;border:none;border-radius:11px;
  font-family:'DM Sans',sans-serif;font-size:14px;font-weight:700;
  cursor:pointer;letter-spacing:.02em;transition:all .3s;
}
.adt-gen-btn:hover:not(:disabled){
  background-position:100% 0;
  box-shadow:0 4px 20px rgba(201,169,110,.35);transform:translateY(-1px);
}
.adt-gen-btn:disabled{opacity:.55;cursor:not-allowed;}

/* ── Scrollable results area ── */
#adt-results{
  flex:1;overflow-y:auto;padding:0 26px 26px;
  scrollbar-width:thin;scrollbar-color:rgba(232,213,183,.15) transparent;
}
#adt-results::-webkit-scrollbar{width:4px;}
#adt-results::-webkit-scrollbar-thumb{background:rgba(232,213,183,.15);border-radius:2px;}

/* ── Loading ── */
.adt-loading{padding:44px 0;text-align:center;}
.adt-orb{
  width:46px;height:46px;margin:0 auto 18px;border-radius:50%;
  background:conic-gradient(from 0deg,transparent 0%,#c9a96e 50%,transparent 100%);
  animation:adt-spin 1.1s linear infinite;
}
@keyframes adt-spin{to{transform:rotate(360deg);}}
.adt-loading-txt{
  font-family:'Playfair Display',serif;font-style:italic;
  font-size:15px;color:rgba(232,213,183,.45);
}

/* ── Result cards ── */
.adt-headline-card{
  margin-top:22px;padding:18px;
  background:linear-gradient(135deg,rgba(201,169,110,.08),rgba(232,213,183,.03));
  border:1px solid rgba(201,169,110,.2);border-radius:14px;margin-bottom:4px;
  animation:adt-card .4s ease both;
}
.adt-headline{
  font-family:'Playfair Display',serif;font-size:19px;font-style:italic;
  color:#e8d5b7;line-height:1.35;margin-bottom:7px;
}
.adt-intro{font-family:'DM Sans',sans-serif;font-size:13px;color:rgba(232,213,183,.52);line-height:1.6;}
.adt-wx-note{
  display:flex;align-items:flex-start;gap:6px;margin-top:9px;
  padding:7px 11px;background:rgba(15,52,96,.3);border-radius:8px;
  font-family:'DM Sans',sans-serif;font-size:12px;color:rgba(180,210,255,.68);line-height:1.5;
}
.adt-meta-row{display:flex;flex-wrap:wrap;gap:0;align-items:center;margin-top:10px;}
.adt-best-for{
  display:inline-flex;align-items:center;gap:4px;padding:3px 9px;
  background:rgba(201,169,110,.1);border-radius:18px;
  font-family:'DM Sans',sans-serif;font-size:11px;color:rgba(201,169,110,.8);
}
.adt-loc-badge{
  display:inline-flex;align-items:center;gap:4px;padding:3px 9px;margin-left:5px;
  background:rgba(100,200,150,.08);border:1px solid rgba(100,200,150,.2);border-radius:18px;
  font-family:'DM Sans',sans-serif;font-size:11px;color:rgba(100,200,150,.7);
}
.adt-vibe-badge{
  display:inline-flex;align-items:center;gap:4px;padding:3px 9px;margin-left:5px;
  background:rgba(200,140,200,.08);border:1px solid rgba(200,140,200,.2);border-radius:18px;
  font-family:'DM Sans',sans-serif;font-size:11px;color:rgba(200,150,220,.75);
}

.adt-acts{margin-top:18px;}
.adt-acts-ttl{
  font-family:'DM Sans',sans-serif;font-size:10px;font-weight:600;
  letter-spacing:.1em;text-transform:uppercase;color:rgba(232,213,183,.28);margin-bottom:11px;
}
.adt-act{
  background:rgba(255,255,255,.02);border:1px solid rgba(232,213,183,.07);
  border-radius:13px;padding:14px 16px;margin-bottom:9px;
  transition:all .2s;animation:adt-card .4s ease both;position:relative;overflow:hidden;
}
.adt-act::before{
  content:'';position:absolute;left:0;top:0;bottom:0;width:3px;
  background:linear-gradient(to bottom,#c9a96e,rgba(201,169,110,.15));
  border-radius:3px 0 0 3px;
}
.adt-act.caution::before{background:linear-gradient(to bottom,#f59e0b,rgba(245,158,11,.15));}
.adt-act:hover{background:rgba(255,255,255,.04);border-color:rgba(232,213,183,.14);}
.adt-act-top{display:flex;align-items:center;gap:9px;margin-bottom:7px;}
.adt-act-emoji{font-size:19px;flex-shrink:0;}
.adt-act-time{
  font-family:'DM Sans',sans-serif;font-size:10px;font-weight:600;
  letter-spacing:.08em;text-transform:uppercase;color:rgba(201,169,110,.55);
}
.adt-act-title{font-family:'DM Sans',sans-serif;font-size:14px;font-weight:500;color:#f5efe6;margin-top:1px;}
.adt-act-desc{font-family:'DM Sans',sans-serif;font-size:12px;line-height:1.6;color:rgba(232,213,183,.48);}
.adt-caution-badge{
  display:inline-flex;align-items:center;gap:3px;margin-top:7px;padding:2px 7px;
  background:rgba(245,158,11,.1);border:1px solid rgba(245,158,11,.25);border-radius:5px;
  font-family:'DM Sans',sans-serif;font-size:10px;color:rgba(245,158,11,.8);
}

.adt-tip{
  margin-top:18px;padding:14px 16px;
  background:rgba(15,52,96,.22);border:1px solid rgba(15,52,96,.55);
  border-radius:13px;animation:adt-card .4s .2s ease both;
}
.adt-tip-lbl{
  font-family:'DM Sans',sans-serif;font-size:10px;font-weight:600;
  letter-spacing:.1em;text-transform:uppercase;color:rgba(100,160,230,.55);margin-bottom:5px;
}
.adt-tip-txt{font-family:'DM Sans',sans-serif;font-size:12px;color:rgba(180,210,255,.62);line-height:1.6;}

.adt-save-btn{
  margin-top:18px;width:100%;padding:12px;
  background:transparent;border:1px solid rgba(232,213,183,.22);border-radius:11px;
  color:rgba(232,213,183,.65);font-family:'DM Sans',sans-serif;font-size:13px;font-weight:500;
  cursor:pointer;display:flex;align-items:center;justify-content:center;gap:7px;
  transition:all .22s;animation:adt-card .4s .3s ease both;
}
.adt-save-btn:hover{background:rgba(232,213,183,.06);border-color:rgba(232,213,183,.42);color:#f5efe6;}
.adt-save-btn.saved{
  border-color:rgba(100,200,100,.4);color:rgba(100,200,100,.8);
  background:rgba(100,200,100,.05);
}
.adt-error{
  padding:28px;text-align:center;
  font-family:'DM Sans',sans-serif;font-size:13px;color:rgba(255,140,140,.65);
}

@keyframes adt-card{from{opacity:0;transform:translateY(10px);}to{opacity:1;transform:none;}}
    `;
    document.head.appendChild(s);
  }

  // ─── WMO tables ──────────────────────────────────────────────────────────
  const WI = {0:'☀️',1:'🌤️',2:'⛅',3:'☁️',45:'🌫️',48:'🌫️',51:'🌦️',53:'🌧️',55:'🌧️',
    61:'🌧️',63:'🌧️',65:'🌧️',71:'🌨️',73:'❄️',75:'❄️',80:'🌦️',81:'🌧️',82:'⛈️',95:'⛈️',96:'⛈️',99:'⛈️'};
  const WC = {0:'Clear sky',1:'Mainly clear',2:'Partly cloudy',3:'Overcast',45:'Foggy',48:'Icy fog',
    51:'Light drizzle',53:'Drizzle',55:'Heavy drizzle',61:'Light rain',63:'Rain',65:'Heavy rain',
    71:'Light snow',73:'Snow',75:'Heavy snow',80:'Showers',81:'Rain showers',82:'Violent showers',
    95:'Thunderstorm',96:'Thunderstorm w/ hail',99:'Thunderstorm w/ heavy hail'};

  // ─── Preference config ────────────────────────────────────────────────────
  const PREFS = [
    {id:'chill',      label:'Chill',        emoji:'☕'},
    {id:'sightseeing',label:'Sightseeing',  emoji:'🏛️'},
    {id:'food',       label:'Food & Drink', emoji:'🍜'},
    {id:'adventure',  label:'Adventure',    emoji:'🧗'},
    {id:'culture',    label:'Culture',      emoji:'🎭'},
    {id:'shopping',   label:'Shopping',     emoji:'🛍️'},
    {id:'nightlife',  label:'Nightlife',    emoji:'🌙'},
    {id:'nature',     label:'Nature',       emoji:'🌿'},
  ];

  // ─── State ────────────────────────────────────────────────────────────────
  let _dest='', _date='', _day=null, _weather=null, _onSave=null;
  let _selectedPrefs=new Set(), _fetchedWeather=null, _lastData=null;

  // ─── Build DOM ────────────────────────────────────────────────────────────
  const overlay = document.createElement('div');
  overlay.id = 'adt-overlay';
  overlay.innerHTML = `
    <div id="adt-panel">
      <div class="adt-hdr">
        <div class="adt-hdr-top">
          <div>
            <div class="adt-label">✦ AI Day Planner</div>
            <div class="adt-dest" id="adt-dest">–</div>
            <div class="adt-date" id="adt-date"></div>
          </div>
          <button class="adt-close" id="adt-close">×</button>
        </div>

        <div id="adt-wx-strip" class="adt-wx" style="display:none"></div>

        <div class="adt-vibe-row">
          <div class="adt-input-label">✨ What do you want to do today? (optional)</div>
          <div class="adt-input-wrap">
            <span class="adt-icon">✨</span>
            <input id="adt-vibe" class="adt-vibe-input" type="text"
              placeholder="e.g. try a local craft beer, find a hidden beach, visit a street market…"
              autocomplete="off">
          </div>
        </div>

        <div class="adt-loc-row">
          <div class="adt-input-label">📍 Specific area or landmark (optional)</div>
          <div class="adt-input-wrap">
            <span class="adt-icon">📍</span>
            <input id="adt-loc" class="adt-loc-input" type="text"
              placeholder="e.g. the Old Town, Bondi Beach, Shibuya…" autocomplete="off">
          </div>
        </div>

        <div class="adt-prefs-label">What kind of day are you feeling?</div>
        <div class="adt-pills" id="adt-pills"></div>

        <button class="adt-gen-btn" id="adt-gen">✦ Inspire My Day</button>
      </div>
      <div id="adt-results"></div>
    </div>
  `;
  document.body.appendChild(overlay);

  // Build pills
  const pillsEl = document.getElementById('adt-pills');
  PREFS.forEach(p => {
    const btn = document.createElement('button');
    btn.className = 'adt-pill';
    btn.dataset.id = p.id;
    btn.innerHTML = `<span>${p.emoji}</span>${p.label}`;
    btn.addEventListener('click', () => {
      _selectedPrefs.has(p.id) ? (_selectedPrefs.delete(p.id), btn.classList.remove('on'))
                               : (_selectedPrefs.add(p.id),    btn.classList.add('on'));
    });
    pillsEl.appendChild(btn);
  });

  document.getElementById('adt-close').addEventListener('click', close);
  overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
  document.getElementById('adt-gen').addEventListener('click', generate);

  // Debounced weather re-fetch on location change
  let _locTimer = null;
  document.getElementById('adt-loc').addEventListener('input', () => {
    clearTimeout(_locTimer);
    _locTimer = setTimeout(async () => {
      const v = document.getElementById('adt-loc').value.trim();
      if (!v || !_date) return;
      try {
        const w = await _fetchWeather(v, _date);
        if (w) { _fetchedWeather = w; _showWx(w); }
      } catch {}
    }, 850);
  });

  // ─── Public: open ─────────────────────────────────────────────────────────
  // Signature: open(destination, dateStr, dayNumber, onSave, weatherData, userPrefs)
  function open(destination, dateStr, dayNumber, onSave, weatherData, userPrefs) {
    _dest    = destination || 'your destination';
    _date    = dateStr     || '';
    _day     = dayNumber   || null;
    _onSave  = onSave      || null;
    _weather = weatherData || null;
    _fetchedWeather = null;
    _lastData = null;

    document.getElementById('adt-dest').textContent = _dest;
    document.getElementById('adt-date').textContent = _date
      ? `${_date}${_day ? ' · Day ' + _day : ''}`
      : (_day ? 'Day ' + _day : '');

    // Pre-fill vibe input from userPrefs passed by ui.js
    const vibeEl = document.getElementById('adt-vibe');
    vibeEl.value = (userPrefs || '').trim();

    document.getElementById('adt-loc').value = '';
    _selectedPrefs.clear();
    document.querySelectorAll('.adt-pill').forEach(p => p.classList.remove('on'));
    document.getElementById('adt-results').innerHTML = '';

    const genBtn = document.getElementById('adt-gen');
    genBtn.disabled = false;
    genBtn.textContent = '✦ Inspire My Day';

    if (weatherData) {
      _showWx(weatherData);
    } else if (_date) {
      _fetchAndShowWx(_dest);
    } else {
      document.getElementById('adt-wx-strip').style.display = 'none';
    }

    overlay.classList.add('open');
    document.body.style.overflow = 'hidden';

    // Auto-focus: vibe if empty, else location
    setTimeout(() => {
      vibeEl.value ? document.getElementById('adt-loc').focus() : vibeEl.focus();
    }, 360);
  }

  // ─── Public: close ────────────────────────────────────────────────────────
  function close() {
    overlay.classList.remove('open');
    document.body.style.overflow = '';
  }

  // ─── Weather helpers ──────────────────────────────────────────────────────
  function _showWx(w) {
    const el = document.getElementById('adt-wx-strip');
    el.style.display = 'flex';
    el.className = 'adt-wx';
    let detail = '';
    if (w.tempMax !== undefined && w.tempMin !== undefined) detail = `${w.tempMin}–${w.tempMax}°C`;
    else if (w.tempMax !== undefined) detail = `${w.tempMax}°C`;
    if (w.precipitation > 0) detail += ` · 💧 ${w.precipitation}mm`;
    if (w.windSpeed > 30)    detail += ` · 💨 ${w.windSpeed}km/h`;
    el.innerHTML = `<span class="wx-i">${w.icon||'🌡️'}</span><span><strong>${w.description||''}</strong><span class="wx-d">${detail ? ' · '+detail : ''}</span></span>`;
  }

  async function _fetchAndShowWx(loc) {
    const el = document.getElementById('adt-wx-strip');
    el.style.display = 'flex';
    el.className = 'adt-wx loading';
    el.innerHTML = '<span class="wx-i">🌡️</span><span>Fetching weather…</span>';
    try {
      const w = await _fetchWeather(loc, _date);
      if (w) { _fetchedWeather = w; _showWx(w); } else el.style.display = 'none';
    } catch {
      el.className = 'adt-wx error';
      el.innerHTML = '<span class="wx-i">⚠️</span><span>Weather unavailable</span>';
    }
  }

  async function _fetchWeather(loc, dateStr) {
    const dk = _dateKey(dateStr);
    if (!dk) return null;
    const today = new Date(); today.setHours(0,0,0,0);
    const diff = Math.round((new Date(dk+'T00:00:00') - today) / 86400000);
    if (diff < -1 || diff > 15) return null;

    const g = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(loc)}&count=1&language=en&format=json`).then(r=>r.json());
    if (!g.results?.length) return null;
    const {latitude:lat,longitude:lng} = g.results[0];

    const wx = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&daily=weathercode,temperature_2m_max,temperature_2m_min,precipitation_sum,windspeed_10m_max&timezone=auto&start_date=${dk}&end_date=${dk}`).then(r=>r.json());
    const d = wx.daily;
    if (!d?.weathercode?.length) return null;
    const c = d.weathercode[0];
    return { description:WC[c]||'Unknown', icon:WI[c]||'🌡️',
      tempMax:Math.round(d.temperature_2m_max[0]), tempMin:Math.round(d.temperature_2m_min[0]),
      precipitation:d.precipitation_sum[0]??0, windSpeed:Math.round(d.windspeed_10m_max[0]) };
  }

  function _dateKey(s) {
    if (!s) return null;
    const d = new Date(s.split('·')[0].trim());
    if (!isFinite(d)) return null;
    const p = n=>String(n).padStart(2,'0');
    return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}`;
  }

  // ─── Generate ─────────────────────────────────────────────────────────────
  async function generate() {
    const gen     = document.getElementById('adt-gen');
    const results = document.getElementById('adt-results');
    const loc     = document.getElementById('adt-loc').value.trim();
    const vibe    = document.getElementById('adt-vibe').value.trim(); // free-text user request

    gen.disabled = true;
    gen.textContent = 'Thinking…';
    results.innerHTML = `
      <div class="adt-loading">
        <div class="adt-orb"></div>
        <div class="adt-loading-txt">Crafting your perfect day${loc ? ' around '+loc : ' in '+_dest}…</div>
      </div>`;

    let wx = _fetchedWeather || _weather || null;
    if (loc) {
      try {
        const lw = await _fetchWeather(loc, _date);
        if (lw) { wx = lw; _showWx(lw); }
      } catch {}
    }

    try {
      const resp = await fetch('/api/ai-day-tips', {
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body: JSON.stringify({
          destination:      _dest,
          specificLocation: loc  || null,
          date:             _date,
          dayNumber:        _day,
          preferences:      Array.from(_selectedPrefs),
          userRequest:      vibe || null,   // ← passed to API
          weather:          wx,
        }),
      });
      if (!resp.ok) throw new Error('api');
      const data = await resp.json();
      _lastData = { ...data, _loc: loc||null, _wx: wx, _vibe: vibe||null };
      _render(_lastData);
      gen.textContent = '↺ Regenerate';
    } catch {
      results.innerHTML = `<div class="adt-error">Couldn't load ideas right now.<br>Check your API key and try again.</div>`;
      gen.textContent = '✦ Try Again';
    }
    gen.disabled = false;
  }

  // ─── Render results ───────────────────────────────────────────────────────
  function _render(d) {
    const results = document.getElementById('adt-results');
    const actsHtml = (d.activities||[]).map((a,i)=>`
      <div class="adt-act${a.weatherSuitable===false?' caution':''}" style="animation-delay:${i*.07}s">
        <div class="adt-act-top">
          <div class="adt-act-emoji">${a.emoji||'📍'}</div>
          <div>
            <div class="adt-act-time">${a.time||''}</div>
            <div class="adt-act-title">${a.title||''}</div>
          </div>
        </div>
        <div class="adt-act-desc">${a.description||''}</div>
        ${a.weatherSuitable===false?'<div class="adt-caution-badge">⚠️ Weather may be challenging</div>':''}
      </div>`).join('');

    results.innerHTML = `
      <div class="adt-headline-card">
        <div class="adt-headline">"${d.headline||''}"</div>
        <div class="adt-intro">${d.intro||''}</div>
        ${d.weatherNote?`<div class="adt-wx-note">🌤️ ${d.weatherNote}</div>`:''}
        <div class="adt-meta-row">
          ${d.bestFor?`<div class="adt-best-for">✦ Best for ${d.bestFor}</div>`:''}
          ${d._loc?`<div class="adt-loc-badge">📍 Around ${d._loc}</div>`:''}
          ${d._vibe?`<div class="adt-vibe-badge">✨ "${d._vibe}"</div>`:''}
        </div>
      </div>
      <div class="adt-acts">
        <div class="adt-acts-ttl">Your Day</div>
        ${actsHtml}
      </div>
      ${d.localTip?`<div class="adt-tip"><div class="adt-tip-lbl">📍 Local Insider Tip</div><div class="adt-tip-txt">${d.localTip}</div></div>`:''}
      <button class="adt-save-btn" id="adt-save">🗒️ Save to Day Notes</button>
    `;
    document.getElementById('adt-save').addEventListener('click', _save);
  }

  // ─── Save ─────────────────────────────────────────────────────────────────
  function _save() {
    if (!_lastData) return;
    const btn = document.getElementById('adt-save');
    const w   = _lastData._wx;
    const wxLine = w
      ? `🌤️ Weather: ${w.description}${w.tempMax!=null?', '+w.tempMin+'–'+w.tempMax+'°C':''}${w.precipitation>0?', 💧'+w.precipitation+'mm':''}`
      : '';
    const lines = [
      `✦ AI Day Plan — ${_lastData.headline}`,
      _lastData._loc    ? `📍 Around: ${_lastData._loc}`   : '',
      _lastData._vibe   ? `✨ Vibe: "${_lastData._vibe}"` : '',
      wxLine,
      '',
      _lastData.intro,
      _lastData.weatherNote ? `\n🌤️ ${_lastData.weatherNote}` : '',
      '',
      ...(_lastData.activities||[]).map(a =>
        `${a.emoji} ${a.time} — ${a.title}${a.weatherSuitable===false?' ⚠️':''}\n${a.description}`),
      '',
      _lastData.localTip ? `📍 Local tip: ${_lastData.localTip}` : '',
    ].filter(l=>l!==undefined);

    if (typeof _onSave === 'function') _onSave(lines.join('\n'), _lastData);
    else navigator.clipboard.writeText(lines.join('\n')).catch(()=>{});

    btn.innerHTML = '✓ Saved to Day Notes!';
    btn.classList.add('saved');
    setTimeout(close, 1300);
  }

  // ─── Export ───────────────────────────────────────────────────────────────
  window.AIDayTips = { open, close };
})();
