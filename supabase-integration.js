// Supabase Integration for Voyage Travel Planner
// Add this to replace the mock authentication and data storage

// Initialize Supabase
const SUPABASE_URL = 'https://yclhhvvzjojzosummjyk.supabase.co'; // Get from Supabase dashboard
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InljbGhodnZ6am9qem9zdW1tanlrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI1NTg3MTksImV4cCI6MjA4ODEzNDcxOX0.pYB_T63PsSdSf_WMagHHQnnKnNUhfL1ioiX7ing2x5w'; // Get from Supabase dashboard

// Create the client and expose it globally
window.supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Optional local alias for convenience inside this file
const supabaseClient = window.supabaseClient;

// ============================================================================
// AUTHENTICATION FUNCTIONS
// ============================================================================

async function signup(event) {
    event.preventDefault();
    
    const name = document.getElementById('signupName').value;
    const email = document.getElementById('signupEmail').value;
    const password = document.getElementById('signupPassword').value;
    const isPublic = document.getElementById('profilePublic').checked;

    try {
        const { data: authData, error: authError } = await supabaseClient.auth.signUp({
            email: email,
            password: password,
            options: {
                data: { name: name }
            }
        });

        if (authError) throw authError;

        alert('Account created! Please check your email to verify your account.');
        showPage('loginPage');
        
    } catch (error) {
        console.error('Signup error:', error);
        alert('Error creating account: ' + error.message);
    }
}

async function login(event) {
    event.preventDefault();
    
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;

    try {
        const { data, error } = await supabaseClient.auth.signInWithPassword({
            email: email,
            password: password
        });

        if (error) throw error;

        // Get user profile
        const { data: profile } = await supabaseClient
            .from('profiles')
            .select('*')
            .eq('id', data.user.id)
            .single();

        currentUser = {
            id: data.user.id,
            email: data.user.email,
            name: profile?.name || 'User',
            isPublic: profile?.is_public || false
        };

        // Load trips
        const { data: tripsData } = await supabaseClient
            .from('trips')
            .select('*')
            .eq('user_id', data.user.id)
            .eq('is_past', false);

        trips = tripsData || [];

        const { data: pastTripsData } = await supabaseClient
            .from('trips')
            .select('*')
            .eq('user_id', data.user.id)
            .eq('is_past', true);

        pastTrips = pastTripsData || [];

        document.getElementById('welcomeMessage').textContent = `Welcome back, ${currentUser.name}!`;
        showPage('homepage');
        renderHomepage();
        
    } catch (error) {
        console.error('Login error:', error);
        alert('Invalid email or password: ' + error.message);
    }
}

async function logout() {
    if (confirm('Are you sure you want to log out?')) {
        try {
            await supabaseClient.auth.signOut();
            currentUser = null;
            trips = [];
            pastTrips = [];
            showPage('loginPage');
        } catch (error) {
            console.error('Logout error:', error);
        }
    }
}

async function loadUserData(user) {
    try {
        // Get user profile
        const { data: profile, error: profileError } = await supabaseClient
            .from('profiles')
            .select('*')
            .eq('id', user.id)
            .single();

        if (profileError) throw profileError;

        currentUser = {
            id: user.id,
            email: user.email,
            name: profile.name,
            isPublic: profile.is_public
        };

        // Load trips
        const { data: tripsData, error: tripsError } = await supabaseClient
            .from('trips')
            .select('*')
            .eq('user_id', user.id)
            .eq('is_past', false)
            .order('start_date', { ascending: true });

        if (tripsError) throw tripsError;

        trips = tripsData || [];

        // Load past trips
        const { data: pastTripsData, error: pastTripsError } = await supabaseClient
            .from('trips')
            .select('*')
            .eq('user_id', user.id)
            .eq('is_past', true)
            .order('start_date', { ascending: false });

        if (pastTripsError) throw pastTripsError;

        pastTrips = pastTripsData || [];

        // Load memories for past trips
        for (let trip of pastTrips) {
            const { data: memories, error: memoriesError } = await supabaseClient
                .from('memories')
                .select(`
                    *,
                    memory_photos (*)
                `)
                .eq('trip_id', trip.id)
                .order('date', { ascending: true });

            if (!memoriesError) {
                trip.memories = memories.map(m => ({
                    date: m.date,
                    title: m.title,
                    notes: m.notes,
                    photos: m.memory_photos.map(p => ({
                        url: p.url,
                        geoLocation: p.latitude && p.longitude ? {
                            lat: p.latitude,
                            lng: p.longitude
                        } : null
                    }))
                }));
            }
        }

        document.getElementById('welcomeMessage').textContent = `Welcome back, ${currentUser.name}!`;
        showPage('homepage');
        renderHomepage();
        
    } catch (error) {
        console.error('Error loading user data:', error);
        alert('Error loading your data. Please try again.');
    }
}

// ============================================================================
// TRIP FUNCTIONS
// ============================================================================

async function createTrip(event) {
    event.preventDefault();

    const destination = document.getElementById('tripDestinationInput').value.trim();
    if (!destination) {
        alert('Please enter a destination.');
        return;
    }
    const startDate = document.getElementById('tripStartDate').value;
    const endDate = document.getElementById('tripEndDate').value;
    const isPrivate = document.getElementById('tripPrivate').checked;

    try {
        let imageUrl = null;
        let headerImageUrl = null;

        // Upload images to Supabase Storage
        if (currentTripImageData) {
            imageUrl = await uploadImage(currentTripImageData, 'trip-images');
        }
        if (currentTripHeaderData) {
            headerImageUrl = await uploadImage(currentTripHeaderData, 'trip-images');
        }

        const { data, error } = await supabaseClient
            .from('trips')
            .insert([{
                user_id: currentUser.id,
                destination: destination,
                start_date: startDate,
                end_date: endDate,
                image_url: imageUrl,
                header_image_url: headerImageUrl,
                is_private: isPrivate,
                is_past: false
            }])
            .select()
            .single();

        if (error) throw error;

        trips.unshift(data);
        closeModal('createTripModal');
        renderHomepage();
        
    } catch (error) {
        console.error('Error creating trip:', error);
        alert('Error creating trip. Please try again.');
    }
}

async function openTrip(tripId) {
    try {
        const { data: trip, error } = await supabaseClient
            .from('trips')
            .select('*')
            .eq('id', tripId)
            .single();

        if (error) throw error;

        currentTrip = trip;

        // Load trip days
        const { data: days, error: daysError } = await supabaseClient
            .from('trip_days')
            .select(`
                *,
                day_photos (*),
                day_links (*)
            `)
            .eq('trip_id', tripId);

        if (daysError) throw daysError;

        // Convert to the format expected by the frontend
        currentTrip.days = {};
        days.forEach(day => {
            const dateKey = day.date;
            currentTrip.days[dateKey] = {
                notes: day.notes,
                photos: day.day_photos.map(p => p.url),
                links: day.day_links.map(l => l.url)
            };
        });

        // Update UI
        const startDate = new Date(currentTrip.start_date);
        currentDate = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
        selectedDate = null;

        document.getElementById('calendarTripTitle').textContent = currentTrip.destination;
        document.getElementById('sidebarTripTitle').textContent = currentTrip.destination;
        document.getElementById('tripDestinationText').textContent = currentTrip.destination;
        
        const formattedDates = `${formatDate(new Date(currentTrip.start_date))} - ${formatDate(new Date(currentTrip.end_date))}`;
        document.getElementById('tripDates').textContent = formattedDates;

        const headerImage = document.getElementById('calendarHeaderImage');
        if (currentTrip.header_image_url) {
            headerImage.src = currentTrip.header_image_url;
            headerImage.style.display = 'block';
        } else {
            headerImage.style.display = 'none';
        }

        showPage('calendarPage');
        renderCalendar();
        
    } catch (error) {
        console.error('Error opening trip:', error);
        alert('Error loading trip. Please try again.');
    }
}

// ============================================================================
// DAY FUNCTIONS
// ============================================================================

async function saveDayNotes() {
    if (!selectedDate || !currentTrip) return;

    const dateKey = getDateKey(selectedDate);
    const notes = document.getElementById('dayNotes').value;

    try {
        // Check if day exists
        const { data: existingDay, error: checkError } = await supabaseClient
            .from('trip_days')
            .select('id')
            .eq('trip_id', currentTrip.id)
            .eq('date', dateKey)
            .single();

        if (checkError && checkError.code !== 'PGRST116') throw checkError;

        if (existingDay) {
            // Update existing day
            const { error: updateError } = await supabaseClient
                .from('trip_days')
                .update({ notes: notes })
                .eq('id', existingDay.id);

            if (updateError) throw updateError;
        } else {
            // Create new day
            const { error: insertError } = await supabaseClient
                .from('trip_days')
                .insert([{
                    trip_id: currentTrip.id,
                    date: dateKey,
                    notes: notes
                }]);

            if (insertError) throw insertError;
        }

        if (!currentTrip.days[dateKey]) {
            currentTrip.days[dateKey] = { notes: '', photos: [], links: [] };
        }
        currentTrip.days[dateKey].notes = notes;
        
    } catch (error) {
        console.error('Error saving notes:', error);
        alert('Error saving notes. Please try again.');
    }
}

async function addLink() {
    const input = document.getElementById('linkInput');
    const url = input.value.trim();
    
    if (!url || !selectedDate || !currentTrip) return;

    const dateKey = getDateKey(selectedDate);

    try {
        // Get or create day
        let dayId = await getOrCreateDay(currentTrip.id, dateKey);

        // Insert link
        const { error } = await supabaseClient
            .from('day_links')
            .insert([{
                trip_day_id: dayId,
                url: url
            }]);

        if (error) throw error;

        if (!currentTrip.days[dateKey]) {
            currentTrip.days[dateKey] = { notes: '', photos: [], links: [] };
        }
        currentTrip.days[dateKey].links.push(url);
        
        renderLinks(currentTrip.days[dateKey].links);
        input.value = '';
        
    } catch (error) {
        console.error('Error adding link:', error);
        alert('Error adding link. Please try again.');
    }
}

async function deleteLink(index) {
    if (!selectedDate || !currentTrip) return;

    const dateKey = getDateKey(selectedDate);
    
    try {
        const { data: day } = await supabaseClient
            .from('trip_days')
            .select('id')
            .eq('trip_id', currentTrip.id)
            .eq('date', dateKey)
            .single();

        if (day) {
            const { data: links } = await supabaseClient
                .from('day_links')
                .select('*')
                .eq('trip_day_id', day.id)
                .order('created_at', { ascending: true });

            if (links && links[index]) {
                await supabaseClient
                    .from('day_links')
                    .delete()
                    .eq('id', links[index].id);
            }
        }

        if (currentTrip.days[dateKey]?.links) {
            currentTrip.days[dateKey].links.splice(index, 1);
            renderLinks(currentTrip.days[dateKey].links);
        }
        
    } catch (error) {
        console.error('Error deleting link:', error);
    }
}

// ============================================================================
// MEMORY FUNCTIONS
// ============================================================================

async function saveMemory(event) {
    event.preventDefault();
    
    const date = document.getElementById('memoryDate').value;
    const title = document.getElementById('memoryTitle').value;
    const notes = document.getElementById('memoryNotes').value;

    try {
        // Create memory
        const { data: memory, error: memoryError } = await supabaseClient
            .from('memories')
            .insert([{
                trip_id: currentMemoryTrip.id,
                date: date,
                title: title,
                notes: notes
            }])
            .select()
            .single();

        if (memoryError) throw memoryError;

        // Upload photos
        const photoPromises = currentMemoryPhotos.map(async (photo) => {
            const photoUrl = await uploadImage(photo.url, 'memory-photos');
            
            return supabaseClient
                .from('memory_photos')
                .insert([{
                    memory_id: memory.id,
                    url: photoUrl,
                    latitude: photo.geoLocation?.lat,
                    longitude: photo.geoLocation?.lng
                }]);
        });

        await Promise.all(photoPromises);

        // Update local data
        if (!currentMemoryTrip.memories) {
            currentMemoryTrip.memories = [];
        }

        currentMemoryTrip.memories.push({
            date: date,
            title: title,
            notes: notes,
            photos: currentMemoryPhotos
        });

        closeModal('addMemoryModal');
        renderMemories();
        renderHomepage();
        
    } catch (error) {
        console.error('Error saving memory:', error);
        alert('Error saving memory. Please try again.');
    }
}

async function deleteMemory(index) {
    if (!confirm('Are you sure you want to delete this memory?')) return;

    try {
        const memory = currentMemoryTrip.memories[index];
        
        // Get memory from database
        const { data: dbMemories } = await supabaseClient
            .from('memories')
            .select('id')
            .eq('trip_id', currentMemoryTrip.id)
            .order('date', { ascending: true });

        if (dbMemories && dbMemories[index]) {
            const { error } = await supabaseClient
                .from('memories')
                .delete()
                .eq('id', dbMemories[index].id);

            if (error) throw error;
        }

        currentMemoryTrip.memories.splice(index, 1);
        renderMemories();
        renderHomepage();
        
    } catch (error) {
        console.error('Error deleting memory:', error);
        alert('Error deleting memory. Please try again.');
    }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function pad2(n) {
  return String(n).padStart(2, '0');
}

/**
 * Returns YYYY-MM-DD in local time (stable for Supabase dates).
 */
function formatDate(dateLike) {
  if (!dateLike) return '';
  const d = (dateLike instanceof Date) ? dateLike : new Date(dateLike);
  if (!isFinite(d)) return '';
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

async function uploadImage(base64Data, bucket) {
    try {
        // Convert base64 to blob
        const response = await fetch(base64Data);
        const blob = await response.blob();
        
        // Generate unique filename
        const fileName = `${currentUser.id}/${Date.now()}_${Math.random().toString(36).substring(7)}.jpg`;
        
        // Upload to Supabase Storage
        const { data, error } = await supabaseClient.storage
            .from(bucket)
            .upload(fileName, blob, {
                contentType: 'image/jpeg',
                upsert: false
            });

        if (error) throw error;

        // Get public URL
        const { data: { publicUrl } } = supabaseClient.storage
            .from(bucket)
            .getPublicUrl(fileName);

        return publicUrl;
        
    } catch (error) {
        console.error('Error uploading image:', error);
        throw error;
    }
}

async function getOrCreateDay(tripId, date) {
    const { data: existingDay, error: checkError } = await supabaseClient
        .from('trip_days')
        .select('id')
        .eq('trip_id', tripId)
        .eq('date', date)
        .single();

    if (checkError && checkError.code !== 'PGRST116') throw checkError;

    if (existingDay) {
        return existingDay.id;
    }

    const { data: newDay, error: insertError } = await supabaseClient
        .from('trip_days')
        .insert([{
            trip_id: tripId,
            date: date,
            notes: ''
        }])
        .select('id')
        .single();

    if (insertError) throw insertError;

    return newDay.id;
}
