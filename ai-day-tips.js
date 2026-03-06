// ai-day-tips.js
// Drop this file into your project root alongside ui.js
// Then call initAIDayTips() once on page load, and openAIDayTips(destination, date, dayNumber) from your day view

(function () {
  // ─── Inject Styles ───────────────────────────────────────────────────────────
  const style = document.createElement('style');
  style.textContent = `
    @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,500;0,700;1,500&family=DM+Sans:wght@300;400;500&display=swap');

    /* ── AI Tips Button (injected into day modal) ── */
    .ai-tips-trigger {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      margin-top: 12px;
      padding: 10px 18px;
      background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%);
      color: #e8d5b7;
      border: 1px solid rgba(232, 213, 183, 0.2);
      border-radius: 10px;
      font-family: 'DM Sans', sans-serif;
      font-size: 14px;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.25s ease;
      letter-spacing: 0.01em;
    }
    .ai-tips-trigger:hover {
      background: linear-gradient(135deg, #0f3460 0%, #16213e 100%);
      border-color: rgba(232, 213, 183, 0.5);
      transform: translateY(-1px);
      box-shadow: 0 4px 20px rgba(15, 52, 96, 0.4);
    }
    .ai-tips-trigger .sparkle {
      font-size: 16px;
      animation: sparkle-spin 3s ease-in-out infinite;
    }
    @keyframes sparkle-spin {
      0%, 100% { transform: rotate(0deg) scale(1); }
      50% { transform: rotate(15deg) scale(1.2); }
    }

    /* ── Overlay ── */
    #ai-tips-overlay {
      display: none;
      position: fixed;
      inset: 0;
      z-index: 10000;
      background: rgba(10, 10, 20, 0.75);
      backdrop-filter: blur(6px);
      -webkit-backdrop-filter: blur(6px);
      align-items: center;
      justify-content: center;
      padding: 20px;
    }
    #ai-tips-overlay.open {
      display: flex;
      animation: overlay-in 0.3s ease;
    }
    @keyframes overlay-in {
      from { opacity: 0; }
      to { opacity: 1; }
    }

    /* ── Panel ── */
    #ai-tips-panel {
      width: 100%;
      max-width: 620px;
      max-height: 90vh;
      overflow-y: auto;
      background: #0d0d1a;
      border-radius: 20px;
      border: 1px solid rgba(232, 213, 183, 0.15);
      box-shadow: 0 30px 80px rgba(0, 0, 0, 0.6), inset 0 1px 0 rgba(255,255,255,0.05);
      animation: panel-up 0.35s cubic-bezier(0.16, 1, 0.3, 1);
      scrollbar-width: thin;
      scrollbar-color: rgba(232, 213, 183, 0.2) transparent;
    }
    #ai-tips-panel::-webkit-scrollbar { width: 4px; }
    #ai-tips-panel::-webkit-scrollbar-thumb { background: rgba(232, 213, 183, 0.2); border-radius: 2px; }
    @keyframes panel-up {
      from { opacity: 0; transform: translateY(30px) scale(0.97); }
      to { opacity: 1; transform: translateY(0) scale(1); }
    }

    /* ── Panel Header ── */
    .ai-tips-header {
      padding: 28px 28px 20px;
      border-bottom: 1px solid rgba(232, 213, 183, 0.08);
      position: relative;
    }
    .ai-tips-header-top {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      margin-bottom: 20px;
    }
    .ai-tips-label {
      font-family: 'DM Sans', sans-serif;
      font-size: 11px;
      font-weight: 500;
      letter-spacing: 0.12em;
      text-transform: uppercase;
      color: #e8d5b7;
      opacity: 0.5;
      margin-bottom: 6px;
    }
    .ai-tips-destination {
      font-family: 'Playfair Display', serif;
      font-size: 26px;
      font-weight: 700;
      color: #f5efe6;
      line-height: 1.2;
    }
    .ai-tips-date {
      font-family: 'DM Sans', sans-serif;
      font-size: 13px;
      color: rgba(232, 213, 183, 0.45);
      margin-top: 4px;
    }
    .ai-tips-close {
      width: 34px;
      height: 34px;
      display: flex;
      align-items: center;
      justify-content: center;
      background: rgba(255,255,255,0.04);
      border: 1px solid rgba(255,255,255,0.08);
      border-radius: 50%;
      color: rgba(232, 213, 183, 0.6);
      cursor: pointer;
      font-size: 18px;
      flex-shrink: 0;
      transition: all 0.2s;
      line-height: 1;
    }
    .ai-tips-close:hover {
      background: rgba(255,255,255,0.08);
      color: #f5efe6;
    }

    /* ── Preference Pills ── */
    .ai-tips-prefs-label {
      font-family: 'DM Sans', sans-serif;
      font-size: 12px;
      color: rgba(232, 213, 183, 0.4);
      margin-bottom: 10px;
      letter-spacing: 0.05em;
    }
    .ai-tips-prefs {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }
    .pref-pill {
      padding: 6px 14px;
      border-radius: 20px;
      background: rgba(232, 213, 183, 0.06);
      border: 1px solid rgba(232, 213, 183, 0.12);
      color: rgba(232, 213, 183, 0.55);
      font-family: 'DM Sans', sans-serif;
      font-size: 13px;
      cursor: pointer;
      transition: all 0.2s;
      display: flex;
      align-items: center;
      gap: 6px;
      user-select: none;
    }
    .pref-pill:hover {
      border-color: rgba(232, 213, 183, 0.3);
      color: rgba(232, 213, 183, 0.8);
    }
    .pref-pill.active {
      background: rgba(232, 213, 183, 0.12);
      border-color: rgba(232, 213, 183, 0.45);
      color: #f5efe6;
    }
    .ai-tips-generate-btn {
      margin-top: 18px;
      width: 100%;
      padding: 13px;
      background: linear-gradient(135deg, #c9a96e 0%, #e8d5b7 50%, #c9a96e 100%);
      background-size: 200% 100%;
      color: #0d0d1a;
      border: none;
      border-radius: 12px;
      font-family: 'DM Sans', sans-serif;
      font-size: 15px;
      font-weight: 600;
      cursor: pointer;
      letter-spacing: 0.02em;
      transition: all 0.3s ease;
    }
    .ai-tips-generate-btn:hover:not(:disabled) {
      background-position: 100% 0;
      box-shadow: 0 4px 20px rgba(201, 169, 110, 0.35);
      transform: translateY(-1px);
    }
    .ai-tips-generate-btn:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }

    /* ── Results Area ── */
    #ai-tips-results {
      padding: 0 28px 28px;
    }

    /* ── Loading ── */
    .ai-tips-loading {
      padding: 40px 0;
      text-align: center;
    }
    .ai-loading-orb {
      width: 48px;
      height: 48px;
      margin: 0 auto 20px;
      border-radius: 50%;
      background: conic-gradient(from 0deg, transparent 0%, #c9a96e 50%, transparent 100%);
      animation: orb-spin 1.2s linear infinite;
    }
    @keyframes orb-spin {
      to { transform: rotate(360deg); }
    }
    .ai-loading-text {
      font-family: 'Playfair Display', serif;
      font-style: italic;
      font-size: 16px;
      color: rgba(232, 213, 183, 0.5);
    }

    /* ── Headline Card ── */
    .ai-headline-card {
      margin-top: 24px;
      padding: 20px;
      background: linear-gradient(135deg, rgba(201, 169, 110, 0.08) 0%, rgba(232, 213, 183, 0.04) 100%);
      border: 1px solid rgba(201, 169, 110, 0.2);
      border-radius: 14px;
      margin-bottom: 6px;
      animation: card-in 0.4s ease both;
    }
    .ai-headline-text {
      font-family: 'Playfair Display', serif;
      font-size: 20px;
      font-style: italic;
      color: #e8d5b7;
      line-height: 1.35;
      margin-bottom: 8px;
    }
    .ai-intro-text {
      font-family: 'DM Sans', sans-serif;
      font-size: 14px;
      color: rgba(232, 213, 183, 0.55);
      line-height: 1.6;
    }
    .ai-best-for {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      margin-top: 12px;
      padding: 4px 10px;
      background: rgba(201, 169, 110, 0.1);
      border-radius: 20px;
      font-family: 'DM Sans', sans-serif;
      font-size: 12px;
      color: rgba(201, 169, 110, 0.8);
    }

    /* ── Activity Cards ── */
    .ai-activities-section {
      margin-top: 20px;
    }
    .ai-section-title {
      font-family: 'DM Sans', sans-serif;
      font-size: 11px;
      font-weight: 500;
      letter-spacing: 0.1em;
      text-transform: uppercase;
      color: rgba(232, 213, 183, 0.3);
      margin-bottom: 12px;
    }
    .ai-activity-card {
      background: rgba(255, 255, 255, 0.02);
      border: 1px solid rgba(232, 213, 183, 0.08);
      border-radius: 14px;
      padding: 16px 18px;
      margin-bottom: 10px;
      transition: all 0.2s;
      animation: card-in 0.4s ease both;
      position: relative;
      overflow: hidden;
    }
    .ai-activity-card::before {
      content: '';
      position: absolute;
      left: 0;
      top: 0;
      bottom: 0;
      width: 3px;
      background: linear-gradient(to bottom, #c9a96e, rgba(201, 169, 110, 0.2));
      border-radius: 3px 0 0 3px;
    }
    .ai-activity-card:hover {
      background: rgba(255, 255, 255, 0.04);
      border-color: rgba(232, 213, 183, 0.15);
    }
    .ai-activity-header {
      display: flex;
      align-items: center;
      gap: 10px;
      margin-bottom: 8px;
    }
    .ai-activity-emoji {
      font-size: 20px;
      flex-shrink: 0;
    }
    .ai-activity-meta {
      flex: 1;
    }
    .ai-activity-time {
      font-family: 'DM Sans', sans-serif;
      font-size: 11px;
      font-weight: 500;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: rgba(201, 169, 110, 0.6);
    }
    .ai-activity-title {
      font-family: 'DM Sans', sans-serif;
      font-size: 15px;
      font-weight: 500;
      color: #f5efe6;
      margin-top: 2px;
    }
    .ai-activity-desc {
      font-family: 'DM Sans', sans-serif;
      font-size: 13px;
      line-height: 1.6;
      color: rgba(232, 213, 183, 0.5);
    }

    /* ── Local Tip ── */
    .ai-local-tip {
      margin-top: 20px;
      padding: 16px 18px;
      background: rgba(15, 52, 96, 0.25);
      border: 1px solid rgba(15, 52, 96, 0.6);
      border-radius: 14px;
      animation: card-in 0.4s 0.2s ease both;
    }
    .ai-local-tip-label {
      font-family: 'DM Sans', sans-serif;
      font-size: 11px;
      font-weight: 500;
      letter-spacing: 0.1em;
      text-transform: uppercase;
      color: rgba(100, 160, 230, 0.6);
      margin-bottom: 6px;
    }
    .ai-local-tip-text {
      font-family: 'DM Sans', sans-serif;
      font-size: 13px;
      color: rgba(180, 210, 255, 0.65);
      line-height: 1.6;
    }

    /* ── Save Button ── */
    .ai-tips-save-btn {
      margin-top: 20px;
      width: 100%;
      padding: 13px;
      background: transparent;
      border: 1px solid rgba(232, 213, 183, 0.25);
      border-radius: 12px;
      color: rgba(232, 213, 183, 0.7);
      font-family: 'DM Sans', sans-serif;
      font-size: 14px;
      font-weight: 500;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      transition: all 0.25s;
      animation: card-in 0.4s 0.3s ease both;
    }
    .ai-tips-save-btn:hover {
      background: rgba(232, 213, 183, 0.06);
      border-color: rgba(232, 213, 183, 0.45);
      color: #f5efe6;
    }
    .ai-tips-save-btn.saved {
      border-color: rgba(120, 200, 120, 0.4);
      color: rgba(120, 200, 120, 0.8);
      background: rgba(120, 200, 120, 0.05);
    }

    @keyframes card-in {
      from { opacity: 0; transform: translateY(12px); }
      to { opacity: 1; transform: translateY(0); }
    }

    /* ── Error ── */
    .ai-tips-error {
      padding: 28px;
      text-align: center;
      font-family: 'DM Sans', sans-serif;
      font-size: 14px;
      color: rgba(255, 150, 150, 0.7);
    }
  `;
  document.head.appendChild(style);

  // ─── State ───────────────────────────────────────────────────────────────────
  let currentDestination = '';
  let currentDate = '';
  let currentDayNumber = null;
  let currentTipsData = null;
  let selectedPrefs = new Set();
  let onSaveCallback = null;

  const PREFERENCES = [
    { id: 'chill', label: 'Chill', emoji: '☕' },
    { id: 'sightseeing', label: 'Sightseeing', emoji: '🏛️' },
    { id: 'food', label: 'Food & Drink', emoji: '🍜' },
    { id: 'adventure', label: 'Adventure', emoji: '🧗' },
    { id: 'culture', label: 'Culture', emoji: '🎭' },
    { id: 'shopping', label: 'Shopping', emoji: '🛍️' },
    { id: 'nightlife', label: 'Nightlife', emoji: '🌙' },
    { id: 'nature', label: 'Nature', emoji: '🌿' },
  ];

  // ─── Build DOM ────────────────────────────────────────────────────────────────
  const overlay = document.createElement('div');
  overlay.id = 'ai-tips-overlay';
  overlay.innerHTML = `
    <div id="ai-tips-panel">
      <div class="ai-tips-header">
        <div class="ai-tips-header-top">
          <div>
            <div class="ai-tips-label">✦ AI Day Planner</div>
            <div class="ai-tips-destination" id="ai-tips-dest-text">–</div>
            <div class="ai-tips-date" id="ai-tips-date-text"></div>
          </div>
          <button class="ai-tips-close" id="ai-tips-close-btn">×</button>
        </div>
        <div class="ai-tips-prefs-label">What kind of day are you feeling?</div>
        <div class="ai-tips-prefs" id="ai-tips-prefs-container"></div>
        <button class="ai-tips-generate-btn" id="ai-tips-gen-btn">✦ Inspire My Day</button>
      </div>
      <div id="ai-tips-results"></div>
    </div>
  `;
  document.body.appendChild(overlay);

  // Render preference pills
  const prefsContainer = document.getElementById('ai-tips-prefs-container');
  PREFERENCES.forEach(pref => {
    const pill = document.createElement('button');
    pill.className = 'pref-pill';
    pill.dataset.id = pref.id;
    pill.innerHTML = `<span>${pref.emoji}</span> ${pref.label}`;
    pill.addEventListener('click', () => {
      if (selectedPrefs.has(pref.id)) {
        selectedPrefs.delete(pref.id);
        pill.classList.remove('active');
      } else {
        selectedPrefs.add(pref.id);
        pill.classList.add('active');
      }
    });
    prefsContainer.appendChild(pill);
  });

  // Close handlers
  document.getElementById('ai-tips-close-btn').addEventListener('click', closePanel);
  overlay.addEventListener('click', e => { if (e.target === overlay) closePanel(); });

  // Generate button
  document.getElementById('ai-tips-gen-btn').addEventListener('click', generateTips);

  // ─── Open/Close ───────────────────────────────────────────────────────────────
  function openPanel(destination, date, dayNumber, saveCallback) {
    currentDestination = destination || 'your destination';
    currentDate = date || '';
    currentDayNumber = dayNumber || null;
    onSaveCallback = saveCallback || null;
    currentTipsData = null;

    document.getElementById('ai-tips-dest-text').textContent = currentDestination;
    document.getElementById('ai-tips-date-text').textContent = currentDate
      ? `${currentDate}${dayNumber ? ` · Day ${dayNumber}` : ''}`
      : dayNumber ? `Day ${dayNumber}` : '';

    document.getElementById('ai-tips-results').innerHTML = '';
    document.getElementById('ai-tips-gen-btn').disabled = false;
    document.getElementById('ai-tips-gen-btn').textContent = '✦ Inspire My Day';

    overlay.classList.add('open');
    document.body.style.overflow = 'hidden';
  }

  function closePanel() {
    overlay.classList.remove('open');
    document.body.style.overflow = '';
  }

  // ─── Generate ─────────────────────────────────────────────────────────────────
  async function generateTips() {
    const btn = document.getElementById('ai-tips-gen-btn');
    const resultsEl = document.getElementById('ai-tips-results');

    btn.disabled = true;
    btn.textContent = 'Thinking…';

    resultsEl.innerHTML = `
      <div class="ai-tips-loading">
        <div class="ai-loading-orb"></div>
        <div class="ai-loading-text">Crafting your perfect day in ${currentDestination}…</div>
      </div>
    `;

    try {
      const response = await fetch('/api/ai-day-tips', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          destination: currentDestination,
          date: currentDate,
          dayNumber: currentDayNumber,
          preferences: Array.from(selectedPrefs),
        }),
      });

      if (!response.ok) throw new Error('API error');

      const data = await response.json();
      currentTipsData = data;
      renderResults(data);
      btn.textContent = '↺ Regenerate';
    } catch (err) {
      resultsEl.innerHTML = `<div class="ai-tips-error">Couldn't load tips right now. Check your API key and try again.</div>`;
      btn.textContent = '✦ Try Again';
    }

    btn.disabled = false;
  }

  // ─── Render Results ───────────────────────────────────────────────────────────
  function renderResults(data) {
    const resultsEl = document.getElementById('ai-tips-results');

    const activitiesHTML = (data.activities || []).map((act, i) => `
      <div class="ai-activity-card" style="animation-delay: ${i * 0.07}s">
        <div class="ai-activity-header">
          <div class="ai-activity-emoji">${act.emoji || '📍'}</div>
          <div class="ai-activity-meta">
            <div class="ai-activity-time">${act.time || ''}</div>
            <div class="ai-activity-title">${act.title || ''}</div>
          </div>
        </div>
        <div class="ai-activity-desc">${act.description || ''}</div>
      </div>
    `).join('');

    resultsEl.innerHTML = `
      <div class="ai-headline-card">
        <div class="ai-headline-text">"${data.headline}"</div>
        <div class="ai-intro-text">${data.intro}</div>
        ${data.bestFor ? `<div class="ai-best-for">✦ Best for ${data.bestFor}</div>` : ''}
      </div>

      <div class="ai-activities-section">
        <div class="ai-section-title">Your Day</div>
        ${activitiesHTML}
      </div>

      ${data.localTip ? `
      <div class="ai-local-tip">
        <div class="ai-local-tip-label">📍 Local Insider Tip</div>
        <div class="ai-local-tip-text">${data.localTip}</div>
      </div>` : ''}

      <button class="ai-tips-save-btn" id="ai-tips-save-btn">
        <span>🗒️</span> Save to Day Notes
      </button>
    `;

    document.getElementById('ai-tips-save-btn').addEventListener('click', saveToDay);
  }

  // ─── Save to Day ──────────────────────────────────────────────────────────────
  function saveToDay() {
    if (!currentTipsData) return;

    const saveBtn = document.getElementById('ai-tips-save-btn');

    // Format a clean text block to save into notes
    const lines = [
      `✦ AI Day Plan — ${currentTipsData.headline}`,
      `${currentTipsData.intro}`,
      '',
      ...( currentTipsData.activities || []).map(a =>
        `${a.emoji} ${a.time} — ${a.title}\n${a.description}`
      ),
      '',
      currentTipsData.localTip ? `📍 Local tip: ${currentTipsData.localTip}` : '',
    ].filter(l => l !== undefined);

    const formattedText = lines.join('\n');

    // Call external save callback (from your day view integration)
    if (typeof onSaveCallback === 'function') {
      onSaveCallback(formattedText, currentTipsData);
    } else {
      // Fallback: copy to clipboard
      navigator.clipboard.writeText(formattedText).catch(() => {});
    }

    saveBtn.innerHTML = '<span>✓</span> Saved to Day Notes!';
    saveBtn.classList.add('saved');

    setTimeout(closePanel, 1200);
  }

  // ─── Public API ───────────────────────────────────────────────────────────────
  window.AIDayTips = {
    /**
     * Open the AI tips panel.
     * @param {string} destination  - e.g. "Rome, Italy"
     * @param {string} date         - e.g. "March 15, 2025"
     * @param {number} dayNumber    - e.g. 3
     * @param {function} onSave     - called with (formattedText, rawData) when user saves
     */
    open: openPanel,
    close: closePanel,
  };
})();
