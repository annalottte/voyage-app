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
  scratchMapReady = false;
  const inner = document.getElementById('scratchMapInner');
  if (inner) inner.innerHTML = '';
  showPage('homepage');
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
      const sharedBadge = trip._sharedRole ? '<div class="collab-badge">👥 Shared</div>' : '';

      card.innerHTML = `
        ${img ? `<img src="${img}" alt="${trip.destination || 'Trip'}" class="trip-card-image">`
               : '<div class="trip-card-image"></div>'}
        <div class="trip-card-content">
          ${sharedBadge}
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
          <button class="trip-share-btn" onclick="event.stopPropagation(); openCollaboratorsModal('${trip.id}')">👥 Share & Collaborate</button>
          ${!trip._sharedRole ? `<button class="trip-delete-btn" onclick="event.stopPropagation(); deleteTrip('${trip.id}')">🗑️ Delete Trip</button>` : ''}
          ${!trip._sharedRole ? `<button class="trip-archive-btn" onclick="event.stopPropagation(); archiveTrip('${trip.id}')">📦 Archive to Memory Lane</button>` : ''}
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
          <button class="trip-share-btn" style="margin-top:10px;" onclick="event.stopPropagation(); openAddMemoryModal('${trip.id}')">+ Add Memory</button>
        </div>
      `;
      pastGrid && pastGrid.appendChild(card);
    });
  }

  // Init scratch map after render (slight delay so DOM is ready)
  setTimeout(() => {
    if (typeof initScratchMap === 'function') initScratchMap();
  }, 100);
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

function openAddMemoryModal(tripId) {
  // If called with a specific tripId, pre-select that trip
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
    // Trip already known — hide picker & freehand, show label
    if (pickerGroup) pickerGroup.style.display = 'none';
    if (freehandGroup) freehandGroup.style.display = 'none';
    if (label) label.textContent = `Adding to: ${currentMemoryTrip.destination}`;
  } else {
    // Show trip picker (existing trips) + freehand option
    if (picker) {
      picker.innerHTML = '<option value="">— Choose an existing trip —</option>';
      (pastTrips || []).forEach(t => {
        const opt = document.createElement('option');
        opt.value = t.id;
        opt.textContent = t.destination;
        picker.appendChild(opt);
      });
      // Add a "new destination" option at the bottom
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

  // Fetch weather for this day
  if (currentTrip?.destination) {
    const dateStr = getDateKey(selectedDate);
    fetchWeatherForDay(currentTrip.destination, dateStr);
  }
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
    // Pending requests
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

    // Friends list
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

    const friendIds = new Set([
        ...(friends || []).map(f => f.id),
        currentUser?.id
    ]);

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

    // Load current collaborators
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
    // Geocode destination
    const geoRes = await fetch(
      `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(destination)}&count=1&language=en&format=json`
    );
    const geoData = await geoRes.json();
    if (!geoData.results?.length) throw new Error('Location not found');

    const { latitude, longitude, name, country } = geoData.results[0];

    // Check if date is within forecast range (16 days from today)
    const today = new Date();
    today.setHours(0,0,0,0);
    const targetDate = new Date(dateStr + 'T00:00:00');
    const diffDays = Math.round((targetDate - today) / (1000*60*60*24));

    if (diffDays < -1 || diffDays > 15) {
      widget.innerHTML = `<div class="weather-unavailable">⚠️ Weather forecast only available within 16 days of today. Check back closer to your trip!</div>`;
      return;
    }

    // Fetch forecast
    const weatherRes = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&daily=weathercode,temperature_2m_max,temperature_2m_min,precipitation_sum,windspeed_10m_max&hourly=temperature_2m,weathercode&timezone=auto&start_date=${dateStr}&end_date=${dateStr}`
    );
    const weatherData = await weatherRes.json();

    const daily = weatherData.daily;
    if (!daily?.weathercode?.length) throw new Error('No forecast data');

    const code = daily.weathercode[0];
    const tmax = Math.round(daily.temperature_2m_max[0]);
    const tmin = Math.round(daily.temperature_2m_min[0]);
    const precip = daily.precipitation_sum[0];
    const wind = Math.round(daily.windspeed_10m_max[0]);
    const icon = WMO_ICONS[code] || '🌡️';
    const desc = WMO_CODES[code] || 'Unknown';

    // Hourly (show every 3 hours, daytime only: 7am-10pm)
    const hours = weatherData.hourly;
    let hourlyHtml = '';
    if (hours?.time) {
      const dayHours = hours.time
        .map((t, i) => ({ time: t, temp: Math.round(hours.temperature_2m[i]), code: hours.weathercode[i] }))
        .filter(h => {
          const hr = new Date(h.time).getHours();
          return hr >= 7 && hr <= 22 && hr % 3 === 0;
        });

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

  } catch (err) {
    console.warn('Weather fetch failed:', err);
    widget.innerHTML = `<div class="weather-unavailable">🌡️ Could not load weather for this destination.</div>`;
  }
}

// ===========================
// SCRATCH MAP
// ===========================

// Rich travel-inspired palette — enough colours to feel varied
const SCRATCH_PALETTE = [
  '#d97757','#5b9aa9','#e8a838','#7db87a','#c17ab8',
  '#e06b7a','#5b8dd9','#d4a853','#6bbfb0','#b87a5b',
  '#9b7dd4','#7ab8d4','#d4745b','#5ba87a','#d45b8d',
  '#8db85b','#5b7ab8','#d4b85b','#b85b7a','#5bd4c4',
];

// name → colour index, persisted alongside visited set
let visitedCountries = new Map(); // name → colorIndex
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

  // Always start fresh, then restore from localStorage
  visitedCountries = new Map();
  scratchColorCounter = 0;
  const saved = localStorage.getItem(`voyage_scratch_${currentUser?.id}`);
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      // Support both old Set format (array of strings) and new Map format (array of [name, idx])
      if (Array.isArray(parsed) && parsed.length && Array.isArray(parsed[0])) {
        visitedCountries = new Map(parsed);
        scratchColorCounter = visitedCountries.size;
      } else if (Array.isArray(parsed)) {
        // Migrate old format
        parsed.forEach(name => {
          visitedCountries.set(name, getNextScratchColor());
        });
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

    // Ocean background
    svg.append('rect')
      .attr('width', width).attr('height', height)
      .attr('fill', '#c8dff0').attr('rx', 8);

    // Country name lookup
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

  // Build context from memories
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
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1000,
        messages: [{ role: 'user', content: prompt }]
      })
    });

    const data = await response.json();
    const text = data.content?.[0]?.text || 'Could not generate summary. Please try again.';

    // Typewriter effect
    textEl.classList.remove('ai-typing');
    textEl.textContent = '';
    textEl.classList.add('ai-typing');
    let i = 0;
    const interval = setInterval(() => {
      textEl.textContent += text[i];
      i++;
      if (i >= text.length) {
        clearInterval(interval);
        textEl.classList.remove('ai-typing');
      }
    }, 12);

  } catch (err) {
    console.error('AI summary error:', err);
    content.innerHTML = `<div class="ai-summary-text">Sorry, could not generate summary right now. Please try again.</div>`;
  }

  regenerateBtn.disabled = false;
}
