// ui.js
// ===========================
// UI STATE (no DB mutations)
// ===========================
let currentPage = 'loginPage';

let currentDate = new Date(2025, 2, 1);
let selectedDate = null;

let currentTripImageData = null;     // preview-only
let currentTripHeaderData = null;    // preview-only
let currentMemoryPhotos = [];        // preview-only for Save Memory (Supabase reads this)
let photoMap = null;
let mapMarkers = [];
let locationPhotoGroups = {};

// Cached weather for the currently open day — passed to AIDayTips so it
// doesn't need to re-fetch when the panel opens.
let _lastFetchedWeather = null;

function pad2(n) {
  return String(n).padStart(2, '0');
}

/**
 * Canonical YYYY-MM-DD key in local time.
 * Matches what your Supabase tables expect and what you store in currentTrip.days.
 * IMPORTANT: always use this — never toISOString() which gives UTC and can shift the date.
 */
function getDateKey(dateLike) {
  if (!dateLike) return '';
  const d = (dateLike instanceof Date) ? dateLike : new Date(dateLike);
  if (!isFinite(d)) return '';
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

/**
 * Keep formatDate as an alias (since supabase-integration.js calls formatDate()).
 */
function formatDate(dateLike) {
  return getDateKey(dateLike);
}

// ===========================
// NAVIGATION
// ===========================
function showPage(pageId) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  const el = document.getElementById(pageId);
  if (el) el.classList.add('active');
  currentPage = pageId;
}

function goToHomepage() {
  scratchMapReady = false;
  const inner = document.getElementById('scratchMapInner');
  if (inner) inner.innerHTML = '';
  showPage('homepage');
}

// ===========================
// HOMEPAGE (UI-only)
// Reads `trips`, `pastTrips` from supabase-integration.js
// ===========================

/** Days between today and a date (positive = future, negative = past) */
function daysUntil(dateStr) {
  const today = new Date(); today.setHours(0,0,0,0);
  const d = new Date(dateStr + 'T00:00:00');
  return Math.round((d - today) / (1000*60*60*24));
}

function countdownLabel(trip) {
  const start = trip.start_date || trip.startDate;
  const end   = trip.end_date   || trip.endDate;
  if (!start || !end) return null;
  const dStart = daysUntil(start);
  const dEnd   = daysUntil(end);
  if (dStart > 0)        return { text: `in ${dStart}d`, cls: 'future' };
  if (dStart <= 0 && dEnd >= 0) return { text: 'Ongoing ✈', cls: 'ongoing' };
  return { text: 'Past', cls: 'past' };
}

function tripPlaceholderGradient(destination) {
  // deterministic colour pair from destination string
  const palettes = [
    ['#d97757','#e8a838'], ['#5b9aa9','#7db87a'],
    ['#c17ab8','#5b7ab8'], ['#e06b7a','#e8a838'],
    ['#7db87a','#5b9aa9'], ['#8d6eb8','#d97757'],
  ];
  let h = 0;
  for (let i = 0; i < (destination||'').length; i++) h = (h * 31 + destination.charCodeAt(i)) & 0xffff;
  const [a, b] = palettes[h % palettes.length];
  return `linear-gradient(135deg, ${a} 0%, ${b} 100%)`;
}

function renderHomepage() {
  // ── Hero: pick the next upcoming or ongoing trip ──
  const heroEl = document.getElementById('hpHero');
  if (heroEl && typeof trips !== 'undefined') {
    const sorted = [...trips].sort((a, b) => {
      const da = daysUntil(a.start_date || a.startDate);
      const db = daysUntil(b.start_date || b.startDate);
      // Prefer ongoing > nearest future > past
      const scoreA = da <= 0 && daysUntil(a.end_date||a.endDate) >= 0 ? -9999 : da;
      const scoreB = db <= 0 && daysUntil(b.end_date||b.endDate) >= 0 ? -9999 : db;
      return scoreA - scoreB;
    });
    const hero = sorted.find(t => {
      const d = daysUntil(t.start_date || t.startDate);
      return d > -365; // anything within past year or future
    });

    if (hero) {
      const start = new Date((hero.start_date||hero.startDate) + 'T00:00:00');
      const end   = new Date((hero.end_date  ||hero.endDate)   + 'T00:00:00');
      const cd    = countdownLabel(hero);
      const img   = hero.image_url || hero.image || '';
      const days  = isFinite(start) && isFinite(end) ? Math.ceil((end-start)/(1000*60*60*24))+1 : '';
      const fmtStart = isFinite(start) ? start.toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'}) : '';
      const fmtEnd   = isFinite(end)   ? end.toLocaleDateString('en-US',  {month:'short',day:'numeric',year:'numeric'}) : '';

      heroEl.onclick = () => typeof openTrip === 'function' && openTrip(hero.id);
      heroEl.innerHTML = `
        ${img
          ? `<img class="hp-hero-image" src="${img}" alt="${hero.destination||''}">`
          : `<div class="hp-hero-placeholder"></div>`}
        <div class="hp-hero-overlay"></div>
        <div class="hp-hero-content">
          <div class="hp-hero-eyebrow">${cd?.cls === 'ongoing' ? '✈ Currently travelling' : 'Next adventure'}</div>
          <div class="hp-hero-title">${hero.destination || 'Trip'}</div>
          <div class="hp-hero-meta">
            <span class="hp-hero-dates">${fmtStart} – ${fmtEnd}${days ? ` · ${days} days` : ''}</span>
            ${cd ? `<span class="hp-countdown ${cd.cls}">${cd.text}</span>` : ''}
          </div>
        </div>
        <div class="hp-hero-open-btn">→</div>
      `;
    } else {
      heroEl.innerHTML = `
        <div class="hp-hero-placeholder"></div>
        <div class="hp-hero-overlay"></div>
        <div class="hp-hero-content" style="justify-content:center;align-items:center;text-align:center;">
          <div style="font-size:52px;margin-bottom:12px;">✈️</div>
          <div style="font-family:'Fraunces',serif;font-size:26px;color:#fff;font-style:italic;margin-bottom:8px;">Where to next?</div>
          <div style="font-size:14px;color:rgba(255,255,255,0.65);margin-bottom:20px;">Plan your first adventure</div>
          <button class="hp-hero-empty-btn" onclick="event.stopPropagation();openCreateTripModal()">+ Plan a Trip</button>
        </div>
      `;
      heroEl.onclick = null;
    }
  }

  // ── Trip cards ──
  const grid = document.getElementById('tripsGrid');
  if (grid) {
    grid.innerHTML = '';
    if (typeof trips !== 'undefined' && trips.length) {
      trips.forEach((trip, idx) => renderTripCard(trip, idx, grid, false));
    } else {
      grid.innerHTML = `<div class="hp-empty"><div class="hp-empty-icon">🧳</div><div class="hp-empty-text">No trips yet — create one above!</div></div>`;
    }
  }

  // ── Past trip cards ──
  const pastGrid = document.getElementById('pastTripsGrid');
  if (pastGrid) {
    pastGrid.innerHTML = '';
    if (typeof pastTrips !== 'undefined' && pastTrips.length) {
      pastTrips.forEach((trip, idx) => renderTripCard(trip, idx, pastGrid, true));
    } else {
      pastGrid.innerHTML = `<div class="hp-empty"><div class="hp-empty-icon">📷</div><div class="hp-empty-text">Archive a trip to start your Memory Lane</div></div>`;
    }
  }

  setTimeout(() => { if (typeof initScratchMap === 'function') initScratchMap(); }, 100);
}

function renderTripCard(trip, idx, container, isPast) {
  const card = document.createElement('div');
  card.className = 'trip-card';
  card.style.animationDelay = `${idx * 0.07}s`;

  const start = new Date((trip.start_date||trip.startDate) + 'T00:00:00');
  const end   = new Date((trip.end_date  ||trip.endDate)   + 'T00:00:00');
  const cd    = isPast ? null : countdownLabel(trip);
  const img   = trip.image_url || trip.image || '';
  const totalDays = isFinite(start) && isFinite(end)
    ? Math.ceil((end - start) / (1000*60*60*24)) + 1 : null;
  const daysPlanned = trip.days ? Object.keys(trip.days).length : 0;
  const memoriesCount = trip.memories?.length || 0;
  const sharedBadge = trip._sharedRole
    ? '<span class="collab-badge" style="margin-bottom:6px;display:inline-block;">👥 Shared</span>' : '';

  // Progress bar for ongoing
  let progressBar = '';
  if (cd?.cls === 'ongoing' && isFinite(start) && isFinite(end)) {
    const elapsed = Math.abs(daysUntil(trip.start_date||trip.startDate));
    const pct = Math.min(100, Math.round((elapsed / totalDays) * 100));
    progressBar = `<div class="trip-progress-bar"><div class="trip-progress-fill" style="width:${pct}%"></div></div>`;
  }

  const fmtStart = isFinite(start) ? start.toLocaleDateString('en-US',{month:'short',day:'numeric'}) : '';
  const fmtEnd   = isFinite(end)   ? end.toLocaleDateString('en-US',  {month:'short',day:'numeric',year:'numeric'}) : '';

  const imgHtml = img
    ? `<img class="trip-card-image" src="${img}" alt="${trip.destination||''}">`
    : `<div class="trip-card-image-placeholder" style="background:${tripPlaceholderGradient(trip.destination)}"><span style="filter:drop-shadow(0 2px 4px rgba(0,0,0,0.2));font-size:44px;">✈️</span></div>`;

  const statsHtml = isPast
    ? `<span class="trip-card-stat">✨ ${memoriesCount} memories</span>`
    : `<span class="trip-card-stat">📅 ${totalDays ?? '—'} days</span><span class="trip-card-stat">✓ ${daysPlanned} planned</span>`;

  card.innerHTML = `
    ${imgHtml}
    <div class="trip-card-content">
      ${sharedBadge}
      ${progressBar}
      <div class="trip-card-top">
        <div class="trip-card-title">${trip.destination || 'Trip'}</div>
        ${cd ? `<span class="trip-card-countdown ${cd.cls}">${cd.text}</span>` : ''}
      </div>
      <div class="trip-card-dates">${fmtStart} – ${fmtEnd}</div>
      <div class="trip-card-footer">
        <div class="trip-card-stats">${statsHtml}</div>
        <button class="trip-card-menu-btn" onclick="event.stopPropagation(); toggleCardMenu(event, '${trip.id}', ${isPast})">···</button>
      </div>
    </div>
  `;

  card.addEventListener('click', () => {
    if (isPast) openMemoryJournal(trip.id);
    else if (typeof openTrip === 'function') openTrip(trip.id);
  });

  container.appendChild(card);
}

// Close any open dropdown when clicking outside
document.addEventListener('click', () => {
  document.querySelectorAll('.trip-card-dropdown').forEach(d => d.remove());
});

function toggleCardMenu(event, tripId, isPast) {
  event.stopPropagation();
  document.querySelectorAll('.trip-card-dropdown').forEach(d => d.remove());

  const btn = event.currentTarget;
  const card = btn.closest('.trip-card');

  const menu = document.createElement('div');
  menu.className = 'trip-card-dropdown';

  const items = isPast ? [
    { icon: '📖', label: 'Open Journal',  fn: `openMemoryJournal('${tripId}')` },
    { icon: '📸', label: 'Add Memory',    fn: `openAddMemoryModal('${tripId}')` },
  ] : [
    { icon: '✈️', label: 'Open Calendar', fn: `(typeof openTrip==='function')&&openTrip('${tripId}')` },
    { icon: '👥', label: 'Share & Collab', fn: `openCollaboratorsModal('${tripId}')` },
    { icon: '📦', label: 'Archive Trip',  fn: `archiveTrip('${tripId}')` },
    { icon: '🗑️', label: 'Delete Trip',   fn: `deleteTrip('${tripId}')`, danger: true },
  ];

  menu.innerHTML = items.map(it =>
    `<button class="trip-card-dropdown-item${it.danger?' danger':''}" onclick="event.stopPropagation();${it.fn};document.querySelectorAll('.trip-card-dropdown').forEach(d=>d.remove())">
      ${it.icon} ${it.label}
    </button>`
  ).join('');

  card.style.position = 'relative';
  card.appendChild(menu);

  const btnRect = btn.getBoundingClientRect();
  const cardRect = card.getBoundingClientRect();
  menu.style.top  = (btnRect.bottom - cardRect.top + 4) + 'px';
  menu.style.right = '8px';
  menu.style.left  = 'auto';
}

// Ensure only one page is visible on first load
document.addEventListener('DOMContentLoaded', () => {
  const anyActive = document.querySelector('.page.active');
  if (!anyActive) showPage('loginPage');
});

// ===========================
// MEMORY JOURNAL (UI-only)
// ===========================
function openMemoryJournal(tripId) {
  if (typeof pastTrips === 'undefined') return;
  const trip = pastTrips.find(t => t.id === tripId);
  if (!trip) return;

  window.currentMemoryTrip = trip;

  const nameEl  = document.getElementById('memoryTripName');
  const datesEl = document.getElementById('memoryTripDates');
  if (nameEl)  nameEl.textContent  = trip.destination || 'Trip Memories';

  const start = new Date(trip.start_date || trip.startDate);
  const end   = new Date(trip.end_date   || trip.endDate);
  if (datesEl) {
    const s = isFinite(start) ? start.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '';
    const e = isFinite(end)   ? end.toLocaleDateString('en-US',   { month: 'short', day: 'numeric', year: 'numeric' })   : '';
    datesEl.textContent = `${s} - ${e}`;
  }

  renderMemories();
  showPage('memoryJournalPage');
}

function renderMemories() {
  if (!window.currentMemoryTrip) return;
  const container = document.getElementById('stonesContainer');
  if (!container) return;

  container.innerHTML = '';
  const mems = currentMemoryTrip.memories || [];
  if (!mems.length) {
    container.innerHTML = `
      <div class="empty-memories">
        <div class="empty-memories-icon">✨</div>
        <div class="empty-memories-text">No memories yet</div>
        <div class="empty-memories-subtext">Click the + button to add your first memory</div>
      </div>`;
    return;
  }

  const sorted = [...mems].sort((a, b) => new Date(a.date) - new Date(b.date));
  sorted.forEach((memory, index) => {
    const stone = document.createElement('div');
    stone.className = 'stone';
    stone.style.animationDelay = `${index * 0.1}s`;

    const d = new Date(memory.date);
    const formatted = isFinite(d) ? d.toLocaleDateString('en-US', {
      weekday: 'long', month: 'long', day: 'numeric', year: 'numeric'
    }) : '';

    let photosHtml = '';
    if (Array.isArray(memory.photos) && memory.photos.length) {
      photosHtml = '<div class="stone-photos">';
      memory.photos.forEach(p => {
        const url = typeof p === 'string' ? p : p.url;
        photosHtml += `
          <div class="stone-photo">
            <img src="${url}" alt="Memory photo">
          </div>`;
      });
      photosHtml += '</div>';
    }

    stone.innerHTML = `
      <div class="stone-marker">${index + 1}</div>
      <div class="stone-content">
        <div class="stone-date">${formatted}</div>
        ${memory.title ? `<div class="stone-title">${memory.title}</div>` : ''}
        <div class="stone-notes">${memory.notes || ''}</div>
        ${photosHtml}
        <div class="stone-actions">
          <button class="stone-btn" onclick="editMemory(${index})">Edit</button>
          <button class="stone-btn" onclick="deleteMemory(${index})">Delete</button>
        </div>
      </div>`;
    container.appendChild(stone);
  });
}

function openAddMemoryModal(tripId) {
  if (tripId) {
    const trip = (pastTrips || []).find(t => t.id === tripId);
    if (trip) window.currentMemoryTrip = trip;
  }

  const modal = document.getElementById('addMemoryModal');
  if (!modal) return;

  const pickerGroup = document.getElementById('addMemoryTripPickerGroup');
  const picker = document.getElementById('addMemoryTripPicker');
  const label = document.getElementById('addMemoryTripLabel');
  const freehandGroup = document.getElementById('addMemoryFreehandGroup');

  if (window.currentMemoryTrip) {
    if (pickerGroup) pickerGroup.style.display = 'none';
    if (freehandGroup) freehandGroup.style.display = 'none';
    if (label) label.textContent = `Adding to: ${currentMemoryTrip.destination}`;
  } else {
    if (picker) {
      picker.innerHTML = '<option value="">— Choose an existing trip —</option>';
      (pastTrips || []).forEach(t => {
        const opt = document.createElement('option');
        opt.value = t.id;
        opt.textContent = t.destination;
        picker.appendChild(opt);
      });
      const newOpt = document.createElement('option');
      newOpt.value = '__new__';
      newOpt.textContent = '✏️ Enter a new destination…';
      picker.appendChild(newOpt);
    }
    if (pickerGroup) pickerGroup.style.display = 'block';
    if (freehandGroup) freehandGroup.style.display = 'none';
    if (label) label.textContent = '';
  }

  modal.classList.add('active');
  document.getElementById('addMemoryForm')?.reset();
  const preview = document.getElementById('memoryPhotosPreview');
  if (preview) preview.innerHTML = '';
  currentMemoryPhotos = [];

  const start = currentMemoryTrip?.start_date || currentMemoryTrip?.startDate;
  const dateInput = document.getElementById('memoryDate');
  if (dateInput && start) dateInput.value = start;
}

function handleMemoryTripPickerChange(value) {
  const freehandGroup = document.getElementById('addMemoryFreehandGroup');
  if (value === '__new__') {
    if (freehandGroup) freehandGroup.style.display = 'block';
    document.getElementById('addMemoryDestination')?.focus();
  } else {
    if (freehandGroup) freehandGroup.style.display = 'none';
  }
}

async function handleMemoryPhotosUpload(event) {
  const files = event.target.files;
  if (!files || !files.length) return;

  const preview = document.getElementById('memoryPhotosPreview');
  const label   = document.getElementById('memoryPhotosUploadText');

  for (const file of files) {
    const geoLocation = await extractGeoLocation(file);
    const reader = new FileReader();
    await new Promise(res => {
      reader.onload = e => {
        currentMemoryPhotos.push({ url: e.target.result, geoLocation });
        if (preview) {
          const img = document.createElement('img');
          img.src = e.target.result;
          img.style.width = '100%';
          img.style.height = '100px';
          img.style.objectFit = 'cover';
          img.style.borderRadius = '8px';
          preview.appendChild(img);
        }
        res();
      };
      reader.readAsDataURL(file);
    });
  }
  if (label) label.textContent = `✓ ${files.length} photo${files.length > 1 ? 's' : ''} uploaded`;
}

function editMemory(index) {
  alert('Edit functionality placeholder — would populate the form for editing.');
}

// ===========================
// CALENDAR (UI-only)
// Reads `currentTrip` set by Supabase openTrip()
// ===========================
function renderCalendar() {
  // Populate topbar from currentTrip whenever calendar renders
  if (typeof currentTrip !== 'undefined' && currentTrip) {
    const titleEl = document.getElementById('calendarTripTitle');
    const metaEl  = document.getElementById('calendarTripMeta');
    const chip    = document.getElementById('calCountdownChip');
    const destEl  = document.getElementById('tripDestinationText');
    const datesEl = document.getElementById('tripDates');

    if (titleEl) titleEl.textContent = currentTrip.destination || 'Trip Calendar';

    const start = new Date((currentTrip.start_date||currentTrip.startDate) + 'T00:00:00');
    const end   = new Date((currentTrip.end_date  ||currentTrip.endDate)   + 'T00:00:00');
    const fmtStart = isFinite(start) ? start.toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'}) : '';
    const fmtEnd   = isFinite(end)   ? end.toLocaleDateString('en-US',  {month:'short',day:'numeric',year:'numeric'}) : '';
    if (metaEl) metaEl.textContent = `${fmtStart} – ${fmtEnd}`;
    if (destEl) destEl.textContent = currentTrip.destination || '—';
    if (datesEl) datesEl.textContent = `${fmtStart} – ${fmtEnd}`;

    const cd = countdownLabel(currentTrip);
    if (chip) {
      if (cd && cd.cls !== 'past') {
        chip.textContent = cd.text;
        chip.className = `sidebar-countdown${cd.cls === 'ongoing' ? ' ongoing' : ''}`;
        chip.style.display = '';
      } else {
        chip.style.display = 'none';
      }
    }
  }

  const grid = document.getElementById('calendarGrid');
  if (!grid) return;

  const firstDay   = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
  const lastDay    = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
  const prevLast   = new Date(currentDate.getFullYear(), currentDate.getMonth(), 0);
  const monthLabel = document.getElementById('currentMonth');

  if (monthLabel) {
    monthLabel.textContent = currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  }

  // keep weekday headers
  const weekdayEls = grid.querySelectorAll('.weekday');
  grid.innerHTML = '';
  weekdayEls.forEach(d => grid.appendChild(d));

  const firstDow = firstDay.getDay();
  for (let i = firstDow - 1; i >= 0; i--) {
    const day = prevLast.getDate() - i;
    grid.appendChild(createDayCell(day, true, currentDate.getMonth() - 1));
  }
  for (let day = 1; day <= lastDay.getDate(); day++) {
    grid.appendChild(createDayCell(day, false, currentDate.getMonth()));
  }
  const remaining = 42 - grid.children.length + 7;
  for (let day = 1; day <= remaining; day++) {
    grid.appendChild(createDayCell(day, true, currentDate.getMonth() + 1));
  }

  if (typeof updateRightPanel === 'function') updateRightPanel();
}

function createDayCell(day, otherMonth, month) {
  const cell = document.createElement('div');
  cell.className = 'day-cell';
  if (otherMonth) cell.classList.add('other-month');

  const cellDate = new Date(currentDate.getFullYear(), month, day);
  const dateKey = getDateKey(cellDate);
  const dayData = (typeof currentTrip !== 'undefined') ? currentTrip?.days?.[dateKey] : null;

  // Check rich notes too
  const richContent = (typeof currentTrip !== 'undefined') ? currentTrip?.richNotes?.[dateKey]?.content : null;
  const parsedRich = richContent ? parseNotesData(richContent) : null;

  const hasNotes    = !!(parsedRich?.morning || parsedRich?.afternoon || parsedRich?.evening || parsedRich?.aiCard || dayData?.notes);
  const hasPhotos   = !!(dayData?.photos?.length);
  const hasLinks    = !!(dayData?.links?.length);
  const hasContent  = hasNotes || hasPhotos || hasLinks;

  const tripStart = (typeof currentTrip !== 'undefined') && currentTrip?.start_date
    ? new Date(currentTrip.start_date + 'T00:00:00') : null;
  const tripEnd   = (typeof currentTrip !== 'undefined') && currentTrip?.end_date
    ? new Date(currentTrip.end_date   + 'T00:00:00') : null;

  const cellTime = cellDate.getTime();
  const isInTrip = !otherMonth && tripStart && tripEnd
    && cellTime >= tripStart.getTime()
    && cellTime <= tripEnd.getTime();

  const isTripStart = isInTrip && cellTime === tripStart.getTime();
  const isTripEnd   = isInTrip && cellTime === tripEnd.getTime();

  if (hasContent)  cell.classList.add('has-plans');
  if (isInTrip)    cell.classList.add('in-trip');
  if (isTripStart) cell.classList.add('trip-start');
  if (isTripEnd)   cell.classList.add('trip-end');

  const isSelected = selectedDate?.getDate() === day &&
                     selectedDate?.getMonth() === currentDate.getMonth() &&
                     !otherMonth;
  if (isSelected) cell.classList.add('selected');

  // Build a one-line preview from the richest available source
  let previewText = '';
  if (parsedRich?.aiCard?.headline) {
    previewText = parsedRich.aiCard.headline;
  } else if (parsedRich?.morning) {
    previewText = parsedRich.morning;
  } else if (parsedRich?.afternoon) {
    previewText = parsedRich.afternoon;
  } else if (parsedRich?.evening) {
    previewText = parsedRich.evening;
  } else if (dayData?.notes) {
    previewText = dayData.notes;
  }
  previewText = previewText.replace(/\n/g, ' ').trim().substring(0, 38);
  if (previewText.length === 38) previewText += '…';

  const pills = [];
  if (hasNotes)  pills.push('<span class="day-pill day-pill-notes">📝</span>');
  if (hasPhotos) pills.push(`<span class="day-pill day-pill-photos">📸 ${dayData.photos.length}</span>`);
  if (hasLinks)  pills.push(`<span class="day-pill day-pill-links">🔗 ${dayData.links.length}</span>`);

  const tripLabel = isTripStart
    ? '<div class="trip-range-label trip-range-start">Depart</div>'
    : isTripEnd
      ? '<div class="trip-range-label trip-range-end">Return</div>'
      : '';

  cell.innerHTML = `
    ${tripLabel}
    <div class="day-number">${day}</div>
    ${hasContent && previewText ? `<div class="day-preview">${previewText}</div>` : ''}
    ${pills.length ? `<div class="day-pills">${pills.join('')}</div>` : ''}
  `;

  if (!otherMonth) cell.onclick = () => selectDate(day);
  return cell;
}

function selectDate(day) {
  selectedDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
  renderCalendar();
  updateDetailsPanel();
  updateRightPanel();
  openDayDetail();
}

function updateDetailsPanel() {
  if (!selectedDate) return;
  if (typeof currentTrip !== 'undefined' && currentTrip) {
    const chip = document.getElementById('calCountdownChip');
    if (chip) {
      const cd = countdownLabel(currentTrip);
      if (cd && cd.cls !== 'past') {
        chip.textContent = cd.text;
        chip.className = `cal-countdown-chip${cd.cls === 'ongoing' ? ' ongoing' : ''}`;
        chip.style.display = '';
      } else {
        chip.style.display = 'none';
      }
    }
  }
}

function previousMonth() {
  currentDate.setMonth(currentDate.getMonth() - 1);
  renderCalendar();
}

function nextMonth() {
  currentDate.setMonth(currentDate.getMonth() + 1);
  renderCalendar();
}

function openDayDetail() {
  if (!selectedDate || typeof currentTrip === 'undefined' || !currentTrip) return;

  const dateKey = getDateKey(selectedDate);
  const dayData = currentTrip.days?.[dateKey] || { notes: '', photos: [], links: [] };

  const dateEl = document.getElementById('dayDetailDate');
  const subEl  = document.getElementById('dayDetailSubtitle');

  if (dateEl) {
    dateEl.textContent = selectedDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  }

  const startRaw = currentTrip.start_date || currentTrip.startDate;
  const start = startRaw ? new Date(startRaw) : null;
  const dayNumber = start && isFinite(start) ? (Math.ceil((selectedDate - start) / (1000 * 60 * 60 * 24)) + 1) : null;
  if (subEl) subEl.textContent = dayNumber && dayNumber > 0 ? `Day ${dayNumber} of your trip` : 'Plan ahead';

  // ── FIX: prefer richNotes (day_notes table) over legacy notes (trip_days table) ──
  const richContent = currentTrip.richNotes?.[dateKey]?.content || dayData.notes || '';
  renderStructuredNotes(richContent);

  renderPhotos(dayData.photos || []);
  renderLinks(dayData.links || []);

  // Clear stale weather cache before fetching fresh data for this day
  _lastFetchedWeather = null;

  // ── Inject AI Day Ideas button ──────────────────────────────────────────────
  injectAIDayButton(dayNumber);

  const _ddoA = document.getElementById('dayDetailOverlay'); if (_ddoA && !_ddoA._isStub) _ddoA.classList.add('active');

  // Fetch weather for this day
  if (currentTrip?.destination) {
    const dateStr = getDateKey(selectedDate);
    fetchWeatherForDay(currentTrip.destination, dateStr);
  }
}

// Open Nearby Now from a trip/day view
window.NearbyNow.open(trip.destination, userLat, userLng, (spots) => {
  // spots = array of selected spot objects
  saveToDay(spots);
});

// Open Route Optimizer directly (e.g. from a day's activity list)
window.RouteOptimizer.open(dayActivities, trip.destination, userLat, userLng, (optimized) => {
  saveDayRoute(optimized);
});

// ===========================
// STRUCTURED NOTES
// ===========================

/**
 * Notes are stored as JSON in the existing `notes` field.
 * Format: { aiCard: {...}, morning: "...", afternoon: "...", evening: "..." }
 * Falls back gracefully if the field contains plain text (legacy).
 */
function parseNotesData(raw) {
  if (!raw) return { aiCard: null, morning: '', afternoon: '', evening: '' };
  try {
    const parsed = JSON.parse(raw);
    if (typeof parsed === 'object' && !Array.isArray(parsed)) return {
      aiCard: parsed.aiCard || null,
      morning: parsed.morning || '',
      afternoon: parsed.afternoon || '',
      evening: parsed.evening || '',
    };
  } catch (e) {}
  // Legacy plain text — put it all in morning
  return { aiCard: null, morning: raw, afternoon: '', evening: '' };
}

function serializeNotesData() {
  return JSON.stringify({
    aiCard: window._currentDayAiCard || null,
    morning:   (document.getElementById('dayNotesMorning')?.value   || '').trim(),
    afternoon: (document.getElementById('dayNotesAfternoon')?.value || '').trim(),
    evening:   (document.getElementById('dayNotesEvening')?.value   || '').trim(),
  });
}

function renderStructuredNotes(rawNotes) {
  const container = document.getElementById('dayNotesContainer');
  if (!container) return;

  const data = parseNotesData(rawNotes);
  window._currentDayAiCard = data.aiCard || null;

  const aiCardHtml = data.aiCard ? buildAiCardHtml(data.aiCard) : '';

  container.innerHTML = `
    ${aiCardHtml}
    <div class="day-notes-sections">
      <div class="day-notes-section">
        <div class="day-notes-section-label">
          <span class="day-notes-section-icon">🌅</span> Morning
        </div>
        <textarea
          id="dayNotesMorning"
          class="day-notes-textarea"
          placeholder="Breakfast spots, early sights, morning plans…"
          rows="3"
          oninput="scheduleDayNotesSave()"
        >${escapeHtml(data.morning)}</textarea>
      </div>
      <div class="day-notes-section">
        <div class="day-notes-section-label">
          <span class="day-notes-section-icon">☀️</span> Afternoon
        </div>
        <textarea
          id="dayNotesAfternoon"
          class="day-notes-textarea"
          placeholder="Museums, markets, activities, lunch…"
          rows="3"
          oninput="scheduleDayNotesSave()"
        >${escapeHtml(data.afternoon)}</textarea>
      </div>
      <div class="day-notes-section">
        <div class="day-notes-section-label">
          <span class="day-notes-section-icon">🌙</span> Evening
        </div>
        <textarea
          id="dayNotesEvening"
          class="day-notes-textarea"
          placeholder="Dinner reservations, nightlife, wind-down…"
          rows="3"
          oninput="scheduleDayNotesSave()"
        >${escapeHtml(data.evening)}</textarea>
      </div>
    </div>
  `;
}

function buildAiCardHtml(card) {
  if (!card) return '';
  const activitiesHtml = (card.activities || []).map(a => `
    <div class="ai-saved-activity">
      <span class="ai-saved-activity-emoji">${a.emoji || '📍'}</span>
      <div>
        <div class="ai-saved-activity-time">${a.time || ''}</div>
        <div class="ai-saved-activity-title">${a.title || ''}</div>
        ${a.description ? `<div class="ai-saved-activity-desc">${a.description}</div>` : ''}
      </div>
    </div>
  `).join('');

  return `
    <div class="ai-saved-card" id="aiSavedCard">
      <div class="ai-saved-card-header">
        <div class="ai-saved-card-label">✦ AI Day Plan</div>
        <button class="ai-saved-card-dismiss" onclick="dismissAiCard()" title="Dismiss">×</button>
      </div>
      <div class="ai-saved-card-headline">"${card.headline || ''}"</div>
      ${card.intro ? `<div class="ai-saved-card-intro">${card.intro}</div>` : ''}
      ${activitiesHtml ? `<div class="ai-saved-activities">${activitiesHtml}</div>` : ''}
      ${card.localTip ? `
        <div class="ai-saved-tip">
          <span>📍</span> ${card.localTip}
        </div>` : ''}
    </div>
  `;
}

function dismissAiCard() {
  window._currentDayAiCard = null;
  const _asc = document.getElementById('aiSavedCard'); if (_asc && !_asc._isStub) _asc.remove();
  scheduleDayNotesSave();
}

function escapeHtml(str) {
  return (str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

let _notesSaveTimer = null;
function scheduleDayNotesSave() {
  clearTimeout(_notesSaveTimer);
  _notesSaveTimer = setTimeout(() => {
    if (typeof window.saveDayNotes === 'function' && selectedDate && currentTrip) {
      const dateKey = getDateKey(selectedDate);
      window.saveDayNotes(currentTrip.id, dateKey, serializeNotesData());
    }
  }, 800);
}

/**
 * Injects (or refreshes) the AI Day Ideas button + vibe input inside the day detail modal.
 *
 * Clicking the button shows an inline vibe input row.
 * Pressing Enter or clicking "Get Ideas →" passes the vibe text to AIDayTips.open()
 * as the 6th `userPrefs` argument.
 */
function injectAIDayButton(dayNumber) {
  // Remove any stale elements first to avoid duplicates on re-open
  ['aiDayTipsBtn', 'aiVibePrompt'].forEach(id => {
    const el = document.getElementById(id);
    if (el && !el._isStub) el.remove();
  });

  // Only inject if the ai-day-tips module is loaded
  if (typeof window.AIDayTips !== 'object') return;

  const notesContainer = document.getElementById('dayNotesContainer');
  if (!notesContainer) return;

  // ── Button ──────────────────────────────────────────────────────────────
  const btn = document.createElement('button');
  btn.id = 'aiDayTipsBtn';
  btn.className = 'ai-tips-trigger';
  btn.innerHTML = '<span class="sparkle">✦</span> AI Day Ideas';
  btn.style.marginBottom = '14px';

  // ── Vibe prompt card ─────────────────────────────────────────────────────
  const promptEl = document.createElement('div');
  promptEl.id = 'aiVibePrompt';
  promptEl.style.cssText = `
    display:none;
    margin-bottom:14px;
    background:linear-gradient(135deg,#0d0d1a 0%,#16213e 100%);
    border:1px solid rgba(201,169,110,0.25);
    border-radius:12px;
    padding:14px 16px;
    animation:fadeIn 0.2s ease;
  `;
  promptEl.innerHTML = `
    <div style="font-size:11px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;color:rgba(201,169,110,0.7);margin-bottom:8px;">✦ What's your vibe today?</div>
    <div style="display:flex;gap:8px;align-items:center;">
      <input
        id="aiVibeInput"
        type="text"
        placeholder="e.g. I want to drink a local beer, find a beach…"
        style="flex:1;padding:9px 12px;border-radius:8px;border:1px solid rgba(201,169,110,0.2);background:rgba(255,255,255,0.05);color:#e8d5b7;font-size:13px;font-family:inherit;outline:none;transition:border-color 0.2s;"
        onfocus="this.style.borderColor='rgba(201,169,110,0.45)'"
        onblur="this.style.borderColor='rgba(201,169,110,0.2)'"
      >
      <button id="aiVibeGo" style="padding:9px 14px;background:rgba(201,169,110,0.2);border:1px solid rgba(201,169,110,0.3);border-radius:8px;color:#e8d5b7;font-size:13px;font-weight:600;cursor:pointer;white-space:nowrap;transition:all 0.2s;"
        onmouseover="this.style.background='rgba(201,169,110,0.35)'"
        onmouseout="this.style.background='rgba(201,169,110,0.2)'"
      >Get Ideas →</button>
    </div>
    <div style="font-size:11px;color:rgba(232,213,183,0.4);margin-top:6px;">Optional — leave blank for general suggestions</div>
  `;

  // Insert both before the notes container
  notesContainer.parentNode.insertBefore(btn, notesContainer);
  notesContainer.parentNode.insertBefore(promptEl, notesContainer);

  // ── Nearby Now button ─────────────────────────────────────────────────────
  if (typeof window.NearbyNow === 'object') {
    // Remove stale instance on re-open
    const staleNN = document.getElementById('nearbyNowBtn');
    if (staleNN && !staleNN._isStub) staleNN.remove();
  
    const nnBtn = document.createElement('button');
    nnBtn.id = 'nearbyNowBtn';
    nnBtn.className = 'ai-tips-trigger';
    nnBtn.innerHTML = '<span class="sparkle">📍</span> Nearby Now';
    nnBtn.style.cssText = 'margin-bottom:14px; margin-left:8px;';
  
    nnBtn.addEventListener('click', () => {
      const destination = currentTrip?.destination || 'your destination';
      navigator.geolocation?.getCurrentPosition(
        pos => window.NearbyNow.open(destination, pos.coords.latitude, pos.coords.longitude),
        ()  => window.NearbyNow.open(destination, null, null)
      );
    });
  
    // Insert right after the AI Day Ideas button
    const aiBtn = document.getElementById('aiDayTipsBtn');
    if (aiBtn) aiBtn.after(nnBtn);
    else notesContainer.parentNode.insertBefore(nnBtn, notesContainer);
  }

  // ── Wire up button click → show/hide prompt ──────────────────────────────
  btn.addEventListener('click', () => {
    const isVisible = promptEl.style.display !== 'none';
    promptEl.style.display = isVisible ? 'none' : 'block';
    if (!isVisible) {
      setTimeout(() => document.getElementById('aiVibeInput')?.focus(), 50);
    }
  });

  // ── Wire up "Get Ideas" button ────────────────────────────────────────────
  function launchAI() {
    const userPrefs = (document.getElementById('aiVibeInput')?.value || '').trim();
    promptEl.style.display = 'none';

    const destination = currentTrip?.destination || 'your destination';
    const dateStr = selectedDate
      ? selectedDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
      : '';

    window.AIDayTips.open(
      destination,
      dateStr,
      dayNumber,
      (formattedText, rawData) => {
        // Store the raw AI data as the card and re-render
        window._currentDayAiCard = rawData || null;
        renderStructuredNotes(serializeNotesData());

        // Trigger Supabase save
        if (typeof window.saveDayNotes === 'function') {
          const dateKey = getDateKey(selectedDate);
          window.saveDayNotes(currentTrip.id, dateKey, serializeNotesData());
        }
      },
      _lastFetchedWeather,  // pre-fetched weather — avoids a second geocode call
      userPrefs             // ← vibe / user request passed to AIDayTips
    );
  }

  document.getElementById('aiVibeGo').addEventListener('click', launchAI);

  // Allow Enter key in the vibe input to trigger launch
  document.getElementById('aiVibeInput').addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); launchAI(); }
  });
}

function closeDayDetail() {
  const _ddo = document.getElementById('dayDetailOverlay'); if (_ddo && !_ddo._isStub) _ddo.classList.remove('active');
  // Clean up AI button, vibe prompt, and card state
  ['aiDayTipsBtn', 'aiVibePrompt'].forEach(id => {
    const el = document.getElementById(id); if (el && !el._isStub) el.remove();
  });
  window._currentDayAiCard = null;
  clearTimeout(_notesSaveTimer);
  renderCalendar();
}

// Delegators — implement in Supabase file if you want persistence
function handlePhotoUpload(event) {
  if (typeof window.handleDayPhotoUpload === 'function') return window.handleDayPhotoUpload(event);
  console.warn('Day photo upload not wired to Supabase yet.');
}
function deletePhoto(index) {
  if (typeof window.deleteDayPhoto === 'function') return window.deleteDayPhoto(index);
  console.warn('Day photo delete not wired to Supabase yet.');
}

// ===========================
// RENDERERS
// ===========================
function renderPhotos(photos) {
  const grid = document.getElementById('photoGrid');
  if (!grid) return;
  grid.innerHTML = '';
  (photos || []).forEach((photo, index) => {
    const url = typeof photo === 'string' ? photo : photo?.url || '';
    const item = document.createElement('div');
    item.className = 'photo-item';
    item.innerHTML = `
      <img src="${url}" alt="Photo ${index + 1}">
      <button class="photo-delete" onclick="deletePhoto(${index})">×</button>
    `;
    grid.appendChild(item);
  });
}

function renderLinks(links) {
  const list = document.getElementById('linksList');
  if (!list) return;
  list.innerHTML = '';
  (links || []).forEach((link, index) => {
    const item = document.createElement('div');
    item.className = 'link-item';
    item.innerHTML = `
      <div class="link-icon">🔗</div>
      <div class="link-content">
        <a href="${link}" target="_blank" class="link-url">${link}</a>
      </div>
      <button class="link-delete" onclick="deleteLink(${index})">×</button>
    `;
    list.appendChild(item);
  });
}

// ===========================
// CREATE TRIP MODAL (UI-only)
// ===========================
function openCreateTripModal() {
  const overlay = document.getElementById('createTripModal');
  if (!overlay) return;
  overlay.classList.add('active');
  document.getElementById('createTripForm')?.reset();

  const p1 = document.getElementById('tripImagePreview');
  const p2 = document.getElementById('tripHeaderPreview');
  if (p1) p1.style.display = 'none';
  if (p2) p2.style.display = 'none';

  currentTripImageData = null;
  currentTripHeaderData = null;
}

function handleTripImageUpload(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    currentTripImageData = e.target.result;
    const preview = document.getElementById('tripImagePreview');
    if (preview) { preview.src = currentTripImageData; preview.style.display = 'block'; }
    const textEl = document.getElementById('tripImageUploadText');
    if (textEl) textEl.textContent = '✓ Cover image uploaded';
  };
  reader.readAsDataURL(file);
}

function handleTripHeaderUpload(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    currentTripHeaderData = e.target.result;
    const preview = document.getElementById('tripHeaderPreview');
    if (preview) { preview.src = currentTripHeaderData; preview.style.display = 'block'; }
    const textEl = document.getElementById('tripHeaderUploadText');
    if (textEl) textEl.textContent = '✓ Header image uploaded';
  };
  reader.readAsDataURL(file);
}

function closeModal(modalId) {
  const el = document.getElementById(modalId);
  if (el) el.classList.remove('active');
}

// ===========================
// MAP (UI-only; from currentMemoryTrip)
// ===========================
function toggleMapView() {
  const mapContainer = document.getElementById('photoMapContainer');
  const btn = document.getElementById('toggleMapBtn');
  if (!mapContainer || !btn) return;

  if (mapContainer.style.display === 'none') {
    mapContainer.style.display = 'block';
    btn.textContent = '📋 Hide Photo Map';
    initializePhotoMap();
  } else {
    mapContainer.style.display = 'none';
    btn.textContent = '🗺️ Show Photo Map';
  }
}

function initializePhotoMap() {
  if (!photoMap) {
    photoMap = L.map('map').setView([40.4168, -3.7038], 4);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors', maxZoom: 18
    }).addTo(photoMap);
  }

  mapMarkers.forEach(m => photoMap.removeLayer(m));
  mapMarkers = [];
  locationPhotoGroups = {};

  if (window.currentMemoryTrip && Array.isArray(currentMemoryTrip.memories)) {
    currentMemoryTrip.memories.forEach(mem => {
      (mem.photos || []).forEach(p => {
        const geo = p.geoLocation;
        if (geo && typeof geo.lat === 'number' && typeof geo.lng === 'number') {
          const key = `${geo.lat.toFixed(4)},${geo.lng.toFixed(4)}`;
          if (!locationPhotoGroups[key]) locationPhotoGroups[key] = { lat: geo.lat, lng: geo.lng, photos: [] };
          locationPhotoGroups[key].photos.push({
            url: typeof p === 'string' ? p : p.url,
            date: mem.date, title: mem.title
          });
        }
      });
    });
  }

  const bounds = [];
  Object.entries(locationPhotoGroups).forEach(([key, loc]) => {
    const marker = L.marker([loc.lat, loc.lng], {
      icon: L.divIcon({ className: 'map-marker', html: `<div class="map-marker">${loc.photos.length}</div>`, iconSize: [40, 40] })
    }).addTo(photoMap);
    marker.on('click', () => openLocationPhotos(key));
    mapMarkers.push(marker);
    bounds.push([loc.lat, loc.lng]);
  });

  if (bounds.length) photoMap.fitBounds(bounds, { padding: [50, 50] });
  setTimeout(() => photoMap.invalidateSize(), 100);
}

function openLocationPhotos(locationKey) {
  const loc = locationPhotoGroups[locationKey];
  if (!loc) return;

  const nameEl  = document.getElementById('locationName');
  const countEl = document.getElementById('locationPhotoCount');
  const grid    = document.getElementById('locationPhotosGrid');

  if (nameEl)  nameEl.textContent  = '📍 Location';
  if (countEl) countEl.textContent = `${loc.photos.length} photo${loc.photos.length > 1 ? 's' : ''}`;
  if (grid) {
    grid.innerHTML = '';
    loc.photos.forEach(p => {
      const d = new Date(p.date);
      const label = isFinite(d) ? d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '';
      const item = document.createElement('div');
      item.className = 'location-photo-item';
      item.innerHTML = `<img src="${p.url}" alt="${p.title || 'Memory'}"><div class="location-photo-date">${label}</div>`;
      grid.appendChild(item);
    });
  }
  document.getElementById('locationPhotosOverlay')?.classList.add('active');
}

function closeLocationPhotos() {
  document.getElementById('locationPhotosOverlay')?.classList.remove('active');
}

// ===========================
// EXIF HELPERS
// ===========================
async function extractGeoLocation(file) {
  return new Promise(resolve => {
    EXIF.getData(file, function () {
      const lat = EXIF.getTag(this, 'GPSLatitude');
      const lng = EXIF.getTag(this, 'GPSLongitude');
      const latR = EXIF.getTag(this, 'GPSLatitudeRef');
      const lngR = EXIF.getTag(this, 'GPSLongitudeRef');
      if (lat && lng) resolve({ lat: convertDMSToDD(lat, latR), lng: convertDMSToDD(lng, lngR) });
      else resolve(null);
    });
  });
}

function convertDMSToDD(dms, ref) {
  const [deg, min, sec] = dms;
  let dd = deg + min / 60 + sec / 3600;
  if (ref === 'S' || ref === 'W') dd *= -1;
  return dd;
}

// ===========================
// GLOBAL CLICK-OUTSIDE HANDLERS
// ===========================
document.querySelectorAll('.modal-overlay').forEach(overlay => {
  overlay.addEventListener('click', function (e) {
    if (e.target === this) this.classList.remove('active');
  });
});
const _ddoEv = document.getElementById('dayDetailOverlay');
if (_ddoEv && !_ddoEv._isStub) _ddoEv.addEventListener('click', function (e) {
  if (e.target === this) closeDayDetail();
});

// ===========================
// FRIENDS PAGE (UI)
// ===========================
function openFriendsPage() {
  renderFriendsPage();
  document.getElementById('friendsPage')?.classList.add('active-overlay');
}

function closeFriendsPage() {
  document.getElementById('friendsPage')?.classList.remove('active-overlay');
}

function renderFriendsPage() {
  const reqContainer = document.getElementById('friendRequestsList');
  if (reqContainer) {
    if (!friendRequests?.length) {
      reqContainer.innerHTML = '<p class="friends-empty">No pending requests</p>';
    } else {
      reqContainer.innerHTML = friendRequests.map(r => `
        <div class="friend-card">
          <div class="friend-avatar">${(r.name || '?')[0].toUpperCase()}</div>
          <div class="friend-info">
            <div class="friend-name">${r.name || 'Unknown'}</div>
            <div class="friend-email">${r.email || ''}</div>
          </div>
          <div class="friend-actions">
            <button class="friend-btn friend-btn-accept" onclick="respondToFriendRequest('${r.friendshipId}', true)">Accept</button>
            <button class="friend-btn friend-btn-decline" onclick="respondToFriendRequest('${r.friendshipId}', false)">Decline</button>
          </div>
        </div>
      `).join('');
    }
  }

  const friendsContainer = document.getElementById('friendsList');
  if (friendsContainer) {
    if (!friends?.length) {
      friendsContainer.innerHTML = '<p class="friends-empty">No friends yet — search for someone above!</p>';
    } else {
      friendsContainer.innerHTML = friends.map(f => `
        <div class="friend-card">
          <div class="friend-avatar">${(f.name || '?')[0].toUpperCase()}</div>
          <div class="friend-info">
            <div class="friend-name">${f.name || 'Unknown'}</div>
            <div class="friend-email">${f.email || ''}</div>
          </div>
          <div class="friend-actions">
            <button class="friend-btn friend-btn-remove" onclick="removeFriend('${f.friendshipId}')">Remove</button>
          </div>
        </div>
      `).join('');
    }
  }
}

async function handleFriendSearch() {
  const input = document.getElementById('friendSearchInput');
  const results = document.getElementById('friendSearchResults');
  if (!input || !results) return;

  const email = input.value.trim();
  if (!email) { results.innerHTML = ''; return; }

  results.innerHTML = '<p style="color: var(--text-tertiary); font-size: 13px;">Searching…</p>';
  const users = await searchUserByEmail(email);

  if (!users.length) {
    results.innerHTML = '<p class="friends-empty">No users found with that email.</p>';
    return;
  }

  const friendIds = new Set([...(friends || []).map(f => f.id), currentUser?.id]);

  results.innerHTML = users.map(u => `
    <div class="friend-card">
      <div class="friend-avatar">${(u.name || '?')[0].toUpperCase()}</div>
      <div class="friend-info">
        <div class="friend-name">${u.name || 'Unknown'}</div>
        <div class="friend-email">${u.email || ''}</div>
      </div>
      <div class="friend-actions">
        ${friendIds.has(u.id)
          ? '<span style="font-size:12px;color:var(--text-tertiary)">Already friends</span>'
          : `<button class="friend-btn friend-btn-add" onclick="sendFriendRequest('${u.id}')">+ Add Friend</button>`
        }
      </div>
    </div>
  `).join('');
}

// ===========================
// COLLABORATORS MODAL (UI)
// ===========================
async function openCollaboratorsModal(tripId) {
  const modal = document.getElementById('collaboratorsModal');
  if (!modal) return;
  modal.dataset.tripId = tripId;
  modal.classList.add('active');
  await loadTripCollaborators(tripId);
  renderCollaboratorsModal(tripId);
}

function closeCollaboratorsModal() {
  document.getElementById('collaboratorsModal')?.classList.remove('active');
  document.getElementById('collabSearchResults').innerHTML = '';
  document.getElementById('collabSearchInput').value = '';
}

function renderCollaboratorsModal(tripId) {
  const list = document.getElementById('collaboratorsList');
  if (!list) return;

  if (!currentTripCollaborators?.length) {
    list.innerHTML = '<p class="friends-empty">No collaborators yet. Invite a friend below!</p>';
    return;
  }

  list.innerHTML = currentTripCollaborators.map(c => `
    <div class="friend-card">
      <div class="friend-avatar" style="background: var(--accent-sky);">${(c.name || '?')[0].toUpperCase()}</div>
      <div class="friend-info">
        <div class="friend-name">${c.name || 'Unknown'}</div>
        <div class="friend-email">${c.email || ''} · <span style="color:var(--accent-warm)">${c.role}</span></div>
      </div>
      <div class="friend-actions">
        <button class="friend-btn friend-btn-remove" onclick="removeTripCollaborator('${c.collaboratorId}', '${tripId}')">Remove</button>
      </div>
    </div>
  `).join('');
}

async function handleCollabSearch() {
  const input = document.getElementById('collabSearchInput');
  const results = document.getElementById('collabSearchResults');
  if (!input || !results) return;

  const email = input.value.trim();
  if (!email) { results.innerHTML = ''; return; }

  results.innerHTML = '<p style="color: var(--text-tertiary); font-size: 13px;">Searching…</p>';
  const users = await searchUserByEmail(email);

  if (!users.length) {
    results.innerHTML = '<p class="friends-empty">No users found.</p>';
    return;
  }

  const tripId = document.getElementById('collaboratorsModal').dataset.tripId;
  const existingIds = new Set((currentTripCollaborators || []).map(c => c.id));

  results.innerHTML = users.map(u => `
    <div class="friend-card">
      <div class="friend-avatar">${(u.name || '?')[0].toUpperCase()}</div>
      <div class="friend-info">
        <div class="friend-name">${u.name || 'Unknown'}</div>
        <div class="friend-email">${u.email || ''}</div>
      </div>
      <div class="friend-actions">
        ${existingIds.has(u.id)
          ? '<span style="font-size:12px;color:var(--text-tertiary)">Already added</span>'
          : `<button class="friend-btn friend-btn-add" onclick="addTripCollaborator('${tripId}', '${u.id}')">Invite</button>`
        }
      </div>
    </div>
  `).join('');
}

// ===========================
// WEATHER WIDGET
// ===========================

const WMO_CODES = {
  0:'Clear sky',1:'Mainly clear',2:'Partly cloudy',3:'Overcast',
  45:'Foggy',48:'Icy fog',
  51:'Light drizzle',53:'Drizzle',55:'Heavy drizzle',
  61:'Light rain',63:'Rain',65:'Heavy rain',
  71:'Light snow',73:'Snow',75:'Heavy snow',80:'Showers',81:'Rain showers',82:'Violent showers',
  95:'Thunderstorm',96:'Thunderstorm w/ hail',99:'Thunderstorm w/ heavy hail'
};

const WMO_ICONS = {
  0:'☀️',1:'🌤️',2:'⛅',3:'☁️',
  45:'🌫️',48:'🌫️',
  51:'🌦️',53:'🌧️',55:'🌧️',
  61:'🌧️',63:'🌧️',65:'🌧️',
  71:'🌨️',73:'❄️',75:'❄️',80:'🌦️',81:'🌧️',82:'⛈️',
  95:'⛈️',96:'⛈️',99:'⛈️'
};

async function fetchWeatherForDay(destination, dateStr) {
  const widget = document.getElementById('weatherWidget');
  if (!widget) return;
  widget.innerHTML = '<div class="weather-loading">Fetching forecast…</div>';

  try {
    const geoRes = await fetch(
      `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(destination)}&count=1&language=en&format=json`
    );
    const geoData = await geoRes.json();
    if (!geoData.results?.length) throw new Error('Location not found');

    const { latitude, longitude, name, country } = geoData.results[0];

    const today = new Date(); today.setHours(0,0,0,0);
    const targetDate = new Date(dateStr + 'T00:00:00');
    const diffDays = Math.round((targetDate - today) / (1000*60*60*24));

    if (diffDays < -1 || diffDays > 15) {
      widget.innerHTML = `<div class="weather-unavailable">⚠️ Weather forecast only available within 16 days of today. Check back closer to your trip!</div>`;
      return;
    }

    const weatherRes = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&daily=weathercode,temperature_2m_max,temperature_2m_min,precipitation_sum,windspeed_10m_max&hourly=temperature_2m,weathercode&timezone=auto&start_date=${dateStr}&end_date=${dateStr}`
    );
    const weatherData = await weatherRes.json();

    const daily = weatherData.daily;
    if (!daily?.weathercode?.length) throw new Error('No forecast data');

    const code   = daily.weathercode[0];
    const tmax   = Math.round(daily.temperature_2m_max[0]);
    const tmin   = Math.round(daily.temperature_2m_min[0]);
    const precip = daily.precipitation_sum[0];
    const wind   = Math.round(daily.windspeed_10m_max[0]);
    const icon   = WMO_ICONS[code] || '🌡️';
    const desc   = WMO_CODES[code] || 'Unknown';

    const hours = weatherData.hourly;
    let hourlyHtml = '';
    if (hours?.time) {
      const dayHours = hours.time
        .map((t, i) => ({ time: t, temp: Math.round(hours.temperature_2m[i]), code: hours.weathercode[i] }))
        .filter(h => { const hr = new Date(h.time).getHours(); return hr >= 7 && hr <= 22 && hr % 3 === 0; });

      hourlyHtml = `<div class="weather-hourly">` +
        dayHours.map(h => {
          const hr = new Date(h.time).getHours();
          const label = hr === 12 ? '12pm' : hr > 12 ? `${hr-12}pm` : `${hr}am`;
          return `<div class="weather-hour">
            <div class="wh-time">${label}</div>
            <div class="wh-icon">${WMO_ICONS[h.code] || '🌡️'}</div>
            <div class="wh-temp">${h.temp}°</div>
          </div>`;
        }).join('') +
      `</div>`;
    }

    widget.innerHTML = `
      <div class="weather-main">
        <div class="weather-icon-temp">
          <div class="weather-icon">${icon}</div>
          <div class="weather-temp">${tmax}°<span>C</span></div>
        </div>
        <div class="weather-details">
          <div class="weather-desc">${desc}</div>
          <div class="weather-meta">
            <span>↓ ${tmin}°C</span>
            <span>💧 ${precip}mm</span>
            <span>💨 ${wind} km/h</span>
            <span style="color:var(--text-tertiary)">${name}, ${country}</span>
          </div>
        </div>
        ${hourlyHtml}
      </div>
    `;

    // Cache for AIDayTips
    _lastFetchedWeather = {
      description: desc, icon, tempMax: tmax, tempMin: tmin,
      precipitation: precip ?? 0, windSpeed: wind,
    };

  } catch (err) {
    console.warn('Weather fetch failed:', err);
    widget.innerHTML = `<div class="weather-unavailable">🌡️ Could not load weather for this destination.</div>`;
    _lastFetchedWeather = null;
  }
}

// ===========================
// SCRATCH MAP
// ===========================

const SCRATCH_PALETTE = [
  '#d97757','#5b9aa9','#e8a838','#7db87a','#c17ab8',
  '#e06b7a','#5b8dd9','#d4a853','#6bbfb0','#b87a5b',
  '#9b7dd4','#7ab8d4','#d4745b','#5ba87a','#d45b8d',
  '#8db85b','#5b7ab8','#d4b85b','#b85b7a','#5bd4c4',
];

let visitedCountries = new Map();
let scratchMapReady = false;
let scratchColorCounter = 0;

function getNextScratchColor() {
  const idx = scratchColorCounter % SCRATCH_PALETTE.length;
  scratchColorCounter++;
  return idx;
}

async function initScratchMap() {
  const container = document.getElementById('scratchMapInner');
  if (!container || scratchMapReady) return;

  visitedCountries = new Map();
  scratchColorCounter = 0;
  const saved = localStorage.getItem(`voyage_scratch_${currentUser?.id}`);
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length && Array.isArray(parsed[0])) {
        visitedCountries = new Map(parsed);
        scratchColorCounter = visitedCountries.size;
      } else if (Array.isArray(parsed)) {
        parsed.forEach(name => { visitedCountries.set(name, getNextScratchColor()); });
      }
    } catch(e) {}
  }

  try {
    const res = await fetch('https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json');
    const world = await res.json();
    const countries = topojson.feature(world, world.objects.countries);

    const width = container.offsetWidth || 900;
    const height = Math.round(width * 0.5);

    const projection = d3.geoNaturalEarth1()
      .scale(width / 6.5)
      .translate([width / 2, height / 2]);

    const path = d3.geoPath().projection(projection);

    const svg = d3.select(container).append('svg')
      .attr('viewBox', `0 0 ${width} ${height}`)
      .attr('preserveAspectRatio', 'xMidYMid meet');

    svg.append('rect')
      .attr('width', width).attr('height', height)
      .attr('fill', '#c8dff0').attr('rx', 8);

    const countryNames = {
      '004':'Afghanistan','008':'Albania','012':'Algeria','024':'Angola','032':'Argentina',
      '036':'Australia','040':'Austria','050':'Bangladesh','056':'Belgium','068':'Bolivia',
      '076':'Brazil','100':'Bulgaria','116':'Cambodia','120':'Cameroon','124':'Canada',
      '152':'Chile','156':'China','170':'Colombia','180':'DR Congo','188':'Costa Rica',
      '191':'Croatia','192':'Cuba','196':'Cyprus','203':'Czech Republic','208':'Denmark',
      '218':'Ecuador','818':'Egypt','231':'Ethiopia','246':'Finland','250':'France',
      '276':'Germany','288':'Ghana','300':'Greece','320':'Guatemala','332':'Haiti',
      '340':'Honduras','356':'India','360':'Indonesia','364':'Iran','368':'Iraq',
      '372':'Ireland','376':'Israel','380':'Italy','388':'Jamaica','392':'Japan',
      '400':'Jordan','404':'Kenya','410':'South Korea','414':'Kuwait','418':'Laos',
      '422':'Lebanon','434':'Libya','442':'Luxembourg','484':'Mexico','504':'Morocco',
      '508':'Mozambique','516':'Namibia','524':'Nepal','528':'Netherlands','540':'New Caledonia',
      '554':'New Zealand','566':'Nigeria','578':'Norway','586':'Pakistan','591':'Panama',
      '604':'Peru','608':'Philippines','616':'Poland','620':'Portugal','630':'Puerto Rico',
      '642':'Romania','643':'Russia','646':'Rwanda','682':'Saudi Arabia','686':'Senegal',
      '694':'Sierra Leone','703':'Slovakia','706':'Somalia','710':'South Africa',
      '724':'Spain','144':'Sri Lanka','729':'Sudan','752':'Sweden','756':'Switzerland',
      '760':'Syria','158':'Taiwan','764':'Thailand','792':'Turkey','800':'Uganda',
      '804':'Ukraine','784':'United Arab Emirates','826':'United Kingdom','840':'United States',
      '858':'Uruguay','862':'Venezuela','704':'Vietnam','887':'Yemen','894':'Zambia','716':'Zimbabwe'
    };

    svg.selectAll('.scratch-country')
      .data(countries.features)
      .enter().append('path')
      .attr('class', 'scratch-country')
      .attr('fill', d => {
        const name = (countryNames[d.id] || '').toLowerCase();
        const colorIdx = visitedCountries.get(name);
        return colorIdx !== undefined ? SCRATCH_PALETTE[colorIdx % SCRATCH_PALETTE.length] : '#ddd6ce';
      })
      .attr('d', path)
      .attr('data-name', d => countryNames[d.id] || d.id)
      .on('mouseover', function() {
        const fill = d3.select(this).attr('fill');
        if (fill === '#ddd6ce') d3.select(this).attr('fill', '#c8bfb7');
      })
      .on('mouseout', function(event, d) {
        const name = (countryNames[d.id] || '').toLowerCase();
        const colorIdx = visitedCountries.get(name);
        d3.select(this).attr('fill',
          colorIdx !== undefined ? SCRATCH_PALETTE[colorIdx % SCRATCH_PALETTE.length] : '#ddd6ce'
        );
      })
      .on('click', function(event, d) {
        const name = (countryNames[d.id] || '').toLowerCase();
        if (!name) return;
        if (visitedCountries.has(name)) {
          visitedCountries.delete(name);
          d3.select(this).attr('fill', '#ddd6ce');
        } else {
          const colorIdx = getNextScratchColor();
          visitedCountries.set(name, colorIdx);
          d3.select(this)
            .attr('fill', SCRATCH_PALETTE[colorIdx % SCRATCH_PALETTE.length])
            .attr('filter', 'drop-shadow(0 1px 3px rgba(0,0,0,0.25))');
          setTimeout(() => d3.select(this).attr('filter', null), 600);
        }
        saveScratchMap();
        updateScratchMapStats();
      })
      .append('title')
      .text(d => countryNames[d.id] || '');

    scratchMapReady = true;
    updateScratchMapStats();

  } catch (err) {
    console.error('Scratch map failed:', err);
    container.innerHTML = '<p style="color:var(--text-tertiary);text-align:center;padding:32px">Could not load map. Check your connection.</p>';
  }
}

function saveScratchMap() {
  if (currentUser?.id) {
    localStorage.setItem(`voyage_scratch_${currentUser.id}`, JSON.stringify([...visitedCountries.entries()]));
  }
}

function updateScratchMapStats() {
  const el = document.getElementById('scratchMapStats');
  if (el) {
    const count = visitedCountries.size;
    el.textContent = count === 0
      ? 'Click countries to mark them as visited!'
      : `🌍 ${count} countr${count === 1 ? 'y' : 'ies'} visited — keep exploring!`;
  }
}

// ===========================
// AI JOURNEY SUMMARY
// ===========================

async function openAISummaryModal() {
  const modal = document.getElementById('aiSummaryModal');
  if (!modal) return;
  modal.classList.add('active');
  await generateAISummary();
}

async function generateAISummary() {
  const content = document.getElementById('aiSummaryContent');
  const regenerateBtn = document.getElementById('aiRegenerateBtn');
  if (!content || !window.currentMemoryTrip) return;

  regenerateBtn.disabled = true;

  const trip = window.currentMemoryTrip;
  const mems = trip.memories || [];

  if (!mems.length) {
    content.innerHTML = `<div class="ai-summary-text">No memories yet — add some memories to your trip first, then come back for your AI summary! ✨</div>`;
    regenerateBtn.disabled = false;
    return;
  }

  const memorySummary = mems.map((m, i) => {
    const d = new Date(m.date);
    const dateStr = isFinite(d) ? d.toLocaleDateString('en-US', { weekday:'long', month:'long', day:'numeric' }) : m.date;
    return `Day ${i+1} (${dateStr})${m.title ? ` - ${m.title}` : ''}: ${m.notes || 'No notes'}`;
  }).join('\n');

  const prompt = `You are writing a beautiful, warm, and evocative travel journal summary for someone's trip to ${trip.destination || 'an amazing destination'}.

Here are their memories from the trip:
${memorySummary}

Write a short, lyrical "Day at a Glance" style summary (3-4 paragraphs) that:
- Captures the emotional highlights and key moments
- Uses vivid, sensory language
- Feels personal and nostalgic, like a letter to themselves
- Ends with a warm reflection on the journey as a whole

Write in second person ("you"). Keep it genuine and heartfelt, not generic.`;

  content.innerHTML = `<div class="ai-summary-text ai-typing"> </div>`;
  const textEl = content.querySelector('.ai-summary-text');

  try {
    const response = await fetch('/api/ai-summary', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1000,
        messages: [{ role: 'user', content: prompt }]
      })
    });

    const data = await response.json();
    const text = data.content?.[0]?.text || 'Could not generate summary. Please try again.';

    textEl.classList.remove('ai-typing');
    textEl.textContent = '';
    textEl.classList.add('ai-typing');
    let i = 0;
    const interval = setInterval(() => {
      textEl.textContent += text[i];
      i++;
      if (i >= text.length) { clearInterval(interval); textEl.classList.remove('ai-typing'); }
    }, 12);

  } catch (err) {
    console.error('AI summary error:', err);
    content.innerHTML = `<div class="ai-summary-text">Sorry, could not generate summary right now. Please try again.</div>`;
  }

  regenerateBtn.disabled = false;
}

// =============================================
// RIGHT PANEL: Trip Planner
// =============================================

function updateRightPanel() {
  if (document.getElementById('pp-overlay')?.classList.contains('active')) return; // ← add this
  if (!currentTrip) return;

  // Stats
  const start = new Date((currentTrip.start_date || currentTrip.startDate) + 'T00:00:00');
  const end   = new Date((currentTrip.end_date   || currentTrip.endDate)   + 'T00:00:00');
  const totalDays  = (isFinite(start) && isFinite(end))
    ? Math.ceil((end - start) / (1000*60*60*24)) + 1 : null;
  const daysPlanned = currentTrip.days ? Object.keys(currentTrip.days).length : 0;
  const dStart = daysUntil(currentTrip.start_date || currentTrip.startDate);
  const dEnd   = daysUntil(currentTrip.end_date   || currentTrip.endDate);
  const untilText = dStart > 0 ? dStart : (dEnd >= 0 ? '✈' : '✓');
  const pct = totalDays ? Math.round((daysPlanned / totalDays) * 100) : 0;

  const el = id => { const e = document.getElementById(id); return (e && !e._isStub) ? e : null; };
  const set = (id, v) => { const e = el(id); if (e) e.textContent = v; };

  set('rpStatDays',    totalDays ?? '—');
  set('rpStatPlanned', daysPlanned);
  set('rpStatUntil',   untilText);
  set('rpStatPct',     totalDays ? pct + '%' : '—');

// ── Packing Planner button ──
if (typeof window.PackingPlanner === 'object') {
  let packingBtn = document.getElementById('rpPackingBtn');
  if (packingBtn) {
    packingBtn.style.display = 'flex';
    packingBtn.onclick = () => window.PackingPlanner.open(currentTrip?.id, currentTrip);
  }
}
  
  // ─────────────────────────────────────────────────────────────────────────

  // Day card
  const dayCard    = el('rpDayCard');
  const dayDate    = el('rpDayDate');
  const dayLabel   = el('rpDayLabel');
  const dayPreview = el('rpDayPreview');
  const openBtn    = el('rpOpenBtn');

  if (selectedDate) {
    const dateStr = selectedDate.toLocaleDateString('en-US', { weekday:'short', month:'long', day:'numeric' });
    if (dayDate) { dayDate.textContent = dateStr; dayDate.style.cssText = ''; }
    if (dayLabel) dayLabel.textContent = 'Selected';

    // ── FIX: use getDateKey (local time) and parseNotesData ──────────────────
    let preview = '';
    const dateKey  = getDateKey(selectedDate);                              // ← was toISOString() which gave wrong UTC date
    const richEntry = currentTrip.richNotes?.[dateKey];
    const dayEntry  = currentTrip.days?.[dateKey];

    if (richEntry?.content) {
      const parsed = parseNotesData(richEntry.content);
      preview = parsed.aiCard?.headline || parsed.morning || parsed.afternoon || parsed.evening || '';
    } else if (dayEntry?.notes) {
      const parsed = parseNotesData(dayEntry.notes);
      preview = parsed.aiCard?.headline || parsed.morning || parsed.afternoon || parsed.evening || dayEntry.notes || '';
    }
    // ────────────────────────────────────────────────────────────────────────

    if (dayPreview) dayPreview.textContent = preview || 'Nothing planned yet — click to add notes, photos & ideas.';
    if (dayCard) dayCard.classList.toggle('has-content', !!preview);
    if (openBtn) openBtn.style.display = '';
  } else {
    if (dayDate)    { dayDate.textContent = 'No day selected'; dayDate.style.color = 'var(--text-tertiary)'; dayDate.style.fontStyle = 'italic'; dayDate.style.fontSize = '14px'; }
    if (dayLabel)   dayLabel.textContent = 'Click any day to plan it';
    if (dayPreview) dayPreview.textContent = '';
    if (openBtn)    openBtn.style.display = 'none';
  }

  rpRenderChecklist();
}

// ── Checklist storage (localStorage keyed by trip id) ──
function rpGetChecklist() {
  if (!currentTrip) return [];
  try { return JSON.parse(localStorage.getItem('rp_checklist_' + currentTrip.id) || '[]'); }
  catch { return []; }
}

function rpSaveChecklist(items) {
  if (!currentTrip) return;
  try { localStorage.setItem('rp_checklist_' + currentTrip.id, JSON.stringify(items)); } catch {}
}

function rpRenderChecklist() {
  const list  = document.getElementById('rpChecklist');
  const empty = document.getElementById('rpEmptyChecklist');
  if (!list || list._isStub) return;

  const items = rpGetChecklist();
  empty && (empty.style.display = items.length ? 'none' : '');
  list.innerHTML = '';

  items.forEach((item, i) => {
    const row = document.createElement('div');
    row.className = 'rp-check-item' + (item.done ? ' done' : '');

    const box = document.createElement('div');
    box.className = 'rp-check-box';
    box.title = item.done ? 'Mark undone' : 'Mark done';
    box.onclick = () => { items[i].done = !items[i].done; rpSaveChecklist(items); rpRenderChecklist(); };

    const text = document.createElement('div');
    text.className = 'rp-check-text';
    text.textContent = item.text;
    text.contentEditable = true;
    text.spellcheck = false;
    text.onblur = () => { items[i].text = text.textContent.trim() || item.text; rpSaveChecklist(items); };
    text.onkeydown = e => { if (e.key === 'Enter') { e.preventDefault(); text.blur(); } };

    const del = document.createElement('button');
    del.className = 'rp-check-del';
    del.title = 'Remove';
    del.textContent = '×';
    del.onclick = () => { items.splice(i, 1); rpSaveChecklist(items); rpRenderChecklist(); };

    row.append(box, text, del);
    list.appendChild(row);
  });
}

function rpShowInput() {
  const row   = document.getElementById('rpInputRow');
  const input = document.getElementById('rpNewItem');
  if (row && !row._isStub)   row.style.display = 'flex';
  if (input && !input._isStub) { input.focus(); input.value = ''; }
}

function rpHideInput() {
  const row = document.getElementById('rpInputRow');
  if (row && !row._isStub) row.style.display = 'none';
}

function rpAddItem() {
  const input = document.getElementById('rpNewItem');
  if (!input || input._isStub) return;
  const text = input.value.trim();
  if (!text) return;
  const items = rpGetChecklist();
  items.push({ text, done: false });
  rpSaveChecklist(items);
  rpRenderChecklist();
  input.value = '';
  input.focus();
}
