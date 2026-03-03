<!-- ui.js -->
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

function pad2(n) {
  return String(n).padStart(2, '0');
}

/**
 * Canonical YYYY-MM-DD key in local time.
 * Matches what your Supabase tables expect and what you store in currentTrip.days.
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
  showPage('homepage');
  // do not touch data here; Supabase owns currentTrip/trips/pastTrips
}

// ===========================
// HOMEPAGE (UI-only)
// Reads `trips`, `pastTrips` from supabase-integration.js
// ===========================
function renderHomepage() {
  const grid = document.getElementById('tripsGrid');
  if (grid) grid.innerHTML = '';

  if (typeof trips !== 'undefined' && Array.isArray(trips)) {
    trips.forEach(trip => {
      const card = document.createElement('div');
      card.className = 'trip-card';
      card.onclick = () => (typeof openTrip === 'function') && openTrip(trip.id);

      const start = new Date(trip.start_date || trip.startDate);
      const end   = new Date(trip.end_date   || trip.endDate);

      const days = (isFinite(start) && isFinite(end))
        ? Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1
        : '-';

      const daysWithPlans = trip.days ? Object.keys(trip.days).length : 0;
      const img = trip.image_url || trip.image || '';

      card.innerHTML = `
        ${img ? `<img src="${img}" alt="${trip.destination || 'Trip'}" class="trip-card-image">`
               : '<div class="trip-card-image"></div>'}
        <div class="trip-card-content">
          <div class="trip-card-title">${trip.destination || 'Trip'}</div>
          <div class="trip-card-dates">
            ${isFinite(start) ? start.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : ''}
            -
            ${isFinite(end)   ? end.toLocaleDateString('en-US',   { month: 'short', day: 'numeric', year: 'numeric' })   : ''}
          </div>
          <div class="trip-card-stats">
            <div class="trip-card-stat">📅 ${days} days</div>
            <div class="trip-card-stat">✓ ${daysWithPlans} planned</div>
          </div>
        </div>
      `;
      grid && grid.appendChild(card);
    });
  }

  const pastGrid = document.getElementById('pastTripsGrid');
  if (pastGrid) pastGrid.innerHTML = '';

  if (typeof pastTrips !== 'undefined' && Array.isArray(pastTrips)) {
    pastTrips.forEach(trip => {
      const card = document.createElement('div');
      card.className = 'trip-card';
      card.onclick = () => openMemoryJournal(trip.id);

      const start = new Date(trip.start_date || trip.startDate);
      const end   = new Date(trip.end_date   || trip.endDate);
      const img   = trip.image_url || trip.image || '';
      const memoriesCount = trip.memories?.length || 0;

      card.innerHTML = `
        ${img ? `<img src="${img}" alt="${trip.destination || 'Trip'}" class="trip-card-image">`
               : '<div class="trip-card-image"></div>'}
        <div class="trip-card-content">
          <div class="trip-card-title">${trip.destination || 'Trip'}</div>
          <div class="trip-card-dates">
            ${isFinite(start) ? start.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : ''}
            -
            ${isFinite(end)   ? end.toLocaleDateString('en-US',   { month: 'short', day: 'numeric', year: 'numeric' })   : ''}
          </div>
          <div class="trip-card-stats">
            <div class="trip-card-stat">✨ ${memoriesCount} memories</div>
          </div>
        </div>
      `;
      pastGrid && pastGrid.appendChild(card);
    });
  }
}

// Ensure only one page is visible on first load
document.addEventListener('DOMContentLoaded', () => {
  // If no page has .active yet, default to loginPage
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

  window.currentMemoryTrip = trip; // Supabase owns data; UI reads from here

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

function openAddMemoryModal() {
  if (!window.currentMemoryTrip) return;
  const modal = document.getElementById('addMemoryModal');
  if (!modal) return;

  modal.classList.add('active');
  document.getElementById('addMemoryForm')?.reset();
  const preview = document.getElementById('memoryPhotosPreview');
  if (preview) preview.innerHTML = '';

  currentMemoryPhotos = []; // UI preview list

  const start = currentMemoryTrip.start_date || currentMemoryTrip.startDate;
  const dateInput = document.getElementById('memoryDate');
  if (dateInput && start) dateInput.value = start;
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

  const firstDow = firstDay.getDay(); // 0 = Sun
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
}

function createDayCell(day, otherMonth, month) {
  const cell = document.createElement('div');
  cell.className = 'day-cell';
  if (otherMonth) cell.classList.add('other-month');

  const cellDate = new Date(currentDate.getFullYear(), month, day);
  const dateKey = getDateKey(cellDate);
  const dayData = (typeof currentTrip !== 'undefined') ? currentTrip?.days?.[dateKey] : null;
  const hasContent = !!(dayData && (dayData.notes || (dayData.photos?.length) || (dayData.links?.length)));

  if (hasContent) cell.classList.add('has-plans');

  const isSelected = selectedDate?.getDate() === day &&
                     selectedDate?.getMonth() === currentDate.getMonth() &&
                     !otherMonth;
  if (isSelected) cell.classList.add('selected');

  cell.innerHTML = `
    <div class="day-number">${day}</div>
    ${hasContent ? '<div class="day-preview">' + (dayData.notes?.substring(0, 30) || 'Has content') + '</div>' : ''}
    ${hasContent ? '<div class="plan-indicator"></div>' : ''}
  `;

  if (!otherMonth) cell.onclick = () => selectDate(day);
  return cell;
}

function selectDate(day) {
  selectedDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
  renderCalendar();
  updateDetailsPanel();
  openDayDetail();
}

function updateDetailsPanel() {
  if (!selectedDate) return;
  const dateStr = selectedDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  const selectedDateEl = document.getElementById('selectedDate');
  if (selectedDateEl) selectedDateEl.textContent = dateStr;

  const activitiesList = document.getElementById('activitiesList');
  if (activitiesList) {
    activitiesList.innerHTML = `
      <div style="text-align: center; padding: 24px; color: var(--text-secondary);">
        <p style="margin-bottom: 12px;">Click "View Day Details" to add notes, photos, and links for this day.</p>
      </div>`;
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

  const notesEl = document.getElementById('dayNotes');
  if (notesEl) notesEl.value = dayData.notes || '';

  renderPhotos(dayData.photos || []);
  renderLinks(dayData.links || []);

  document.getElementById('dayDetailOverlay')?.classList.add('active');
}

function closeDayDetail() {
  document.getElementById('dayDetailOverlay')?.classList.remove('active');
  renderCalendar();
}

// Delegators — implement in Supabase file if you want persistence now
function handlePhotoUpload(event) {
  if (typeof window.handleDayPhotoUpload === 'function') {
    return window.handleDayPhotoUpload(event);
  }
  console.warn('Day photo upload not wired to Supabase yet.');
}
function deletePhoto(index) {
  if (typeof window.deleteDayPhoto === 'function') {
    return window.deleteDayPhoto(index);
  }
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
// CREATE TRIP MODAL (UI-only, previews)
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
    if (preview) {
      preview.src = currentTripImageData;
      preview.style.display = 'block';
    }
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
    if (preview) {
      preview.src = currentTripHeaderData;
      preview.style.display = 'block';
    }
    const textEl = document.getElementById('tripHeaderUploadText');
    if (textEl) textEl.textContent = '✓ Header image uploaded';
  };
  reader.readAsDataURL(file);
}

function closeModal(modalId) {
  document.getElementById(modalId)?.classList.remove('active');
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
          if (!locationPhotoGroups[key]) {
            locationPhotoGroups[key] = { lat: geo.lat, lng: geo.lng, photos: [] };
          }
          locationPhotoGroups[key].photos.push({
            url: typeof p === 'string' ? p : p.url,
            date: mem.date,
            title: mem.title
          });
        }
      });
    });
  }

  const bounds = [];
  Object.entries(locationPhotoGroups).forEach(([key, loc]) => {
    const marker = L.marker([loc.lat, loc.lng], {
      icon: L.divIcon({
        className: 'map-marker',
        html: `<div class="map-marker">${loc.photos.length}</div>`,
        iconSize: [40, 40]
      })
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
      item.innerHTML = `
        <img src="${p.url}" alt="${p.title || 'Memory'}">
        <div class="location-photo-date">${label}</div>
      `;
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
      const lat   = EXIF.getTag(this, 'GPSLatitude');
      const lng   = EXIF.getTag(this, 'GPSLongitude');
      const latR  = EXIF.getTag(this, 'GPSLatitudeRef');
      const lngR  = EXIF.getTag(this, 'GPSLongitudeRef');
      if (lat && lng) {
        resolve({ lat: convertDMSToDD(lat, latR), lng: convertDMSToDD(lng, lngR) });
      } else {
        resolve(null);
      }
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
document.getElementById('dayDetailOverlay')?.addEventListener('click', function (e) {
  if (e.target === this) closeDayDetail();
});
