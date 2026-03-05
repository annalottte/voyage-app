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

// ============================================================================
// PASSWORD RESET
// ============================================================================

async function sendPasswordReset(event) {
    event.preventDefault();

    const email = document.getElementById('resetEmail').value.trim();
    const btn = document.getElementById('resetSubmitBtn');
    const successEl = document.getElementById('forgotPasswordSuccess');

    btn.disabled = true;
    btn.textContent = 'Sending…';

    try {
        const { error } = await supabaseClient.auth.resetPasswordForEmail(email, {
            redirectTo: window.location.origin + window.location.pathname
        });

        if (error) throw error;

        successEl.style.display = 'block';
        btn.textContent = 'Sent!';
        document.getElementById('resetEmail').value = '';

        // Auto-return to login after 4s
        setTimeout(() => {
            successEl.style.display = 'none';
            btn.disabled = false;
            btn.textContent = 'Send Reset Link';
            showPage('loginPage');
        }, 4000);

    } catch (error) {
        console.error('Password reset error:', error);
        alert('Error sending reset email: ' + error.message);
        btn.disabled = false;
        btn.textContent = 'Send Reset Link';
    }
}

async function submitNewPassword(event) {
    event.preventDefault();

    const newPassword = document.getElementById('newPassword').value;
    const confirmPassword = document.getElementById('confirmNewPassword').value;
    const btn = document.getElementById('newPasswordBtn');
    const errorEl = document.getElementById('resetPasswordError');

    errorEl.style.display = 'none';

    if (newPassword !== confirmPassword) {
        errorEl.textContent = 'Passwords do not match.';
        errorEl.style.display = 'block';
        return;
    }

    if (newPassword.length < 6) {
        errorEl.textContent = 'Password must be at least 6 characters.';
        errorEl.style.display = 'block';
        return;
    }

    btn.disabled = true;
    btn.textContent = 'Updating…';

    try {
        const { error } = await supabaseClient.auth.updateUser({ password: newPassword });

        if (error) throw error;

        alert('✅ Password updated successfully! Please log in with your new password.');
        await supabaseClient.auth.signOut();
        showPage('loginPage');

    } catch (error) {
        console.error('Password update error:', error);
        errorEl.textContent = 'Error updating password: ' + error.message;
        errorEl.style.display = 'block';
        btn.disabled = false;
        btn.textContent = 'Update Password';
    }
}

// ============================================================================
// SETTINGS MODAL
// ============================================================================

function openSettingsModal() {
    const infoEl = document.getElementById('settingsUserInfo');
    if (infoEl && currentUser) {
        infoEl.innerHTML = `
            <div style="font-weight: 600; color: var(--text-primary); margin-bottom: 4px;">${currentUser.name || 'User'}</div>
            <div>${currentUser.email || ''}</div>
        `;
    }
    document.getElementById('settingsModal')?.classList.add('active');
}

// ============================================================================
// DELETE ACCOUNT
// ============================================================================

async function confirmDeleteAccount() {
    const firstConfirm = confirm(
        '⚠️ Are you absolutely sure you want to delete your account?\n\nThis will permanently delete all your trips, memories, and data. This cannot be undone.'
    );
    if (!firstConfirm) return;

    const typedEmail = prompt(`To confirm, please type your email address:\n${currentUser.email}`);
    if (!typedEmail || typedEmail.trim().toLowerCase() !== currentUser.email.toLowerCase()) {
        alert('Email did not match. Account deletion cancelled.');
        return;
    }

    try {
        const userId = currentUser.id;

        // 1. Delete all trip data belonging to the user (cascade should handle children,
        //    but we clean up explicitly for safety)
        const { data: userTrips } = await supabaseClient
            .from('trips')
            .select('id')
            .eq('user_id', userId);

        if (userTrips?.length) {
            const tripIds = userTrips.map(t => t.id);

            // Delete trip days (photos + links cascade via FK)
            await supabaseClient.from('trip_days').delete().in('trip_id', tripIds);

            // Delete memories (photos cascade)
            await supabaseClient.from('memories').delete().in('trip_id', tripIds);

            // Delete collaborator entries
            await supabaseClient.from('trip_collaborators').delete().in('trip_id', tripIds);

            // Delete trips
            await supabaseClient.from('trips').delete().eq('user_id', userId);
        }

        // 2. Delete friendships
        await supabaseClient.from('friendships').delete()
            .or(`requester_id.eq.${userId},addressee_id.eq.${userId}`);

        // 3. Delete profile
        await supabaseClient.from('profiles').delete().eq('id', userId);

        // 4. Call the Edge Function to delete the auth.users record server-side
        const { data: { session } } = await supabaseClient.auth.getSession()
        const response = await fetch(
            `${supabaseClient.supabaseUrl}/functions/v1/delete-user`,
            {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${session.access_token}`,
                    'Content-Type': 'application/json',
                },
            }
        )

        if (!response.ok) {
            const err = await response.json()
            throw new Error(err.error || 'Edge Function error')
        }

        await supabaseClient.auth.signOut();

        currentUser = null;
        trips = [];
        pastTrips = [];

        alert('Your account has been deleted. We\'re sorry to see you go. 👋');
        showPage('loginPage');

    } catch (error) {
        console.error('Error deleting account:', error);
        alert('Error deleting account: ' + error.message + '\n\nPlease contact support if the problem persists.');
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

async function deleteTrip(tripId) {
    if (!confirm('Are you sure you want to delete this trip? This cannot be undone.')) return;

    try {
        // Delete child data first
        const { data: days } = await supabaseClient
            .from('trip_days')
            .select('id')
            .eq('trip_id', tripId);

        if (days?.length) {
            const dayIds = days.map(d => d.id);
            await supabaseClient.from('day_photos').delete().in('trip_day_id', dayIds);
            await supabaseClient.from('day_links').delete().in('trip_day_id', dayIds);
            await supabaseClient.from('trip_days').delete().eq('trip_id', tripId);
        }

        await supabaseClient.from('trip_collaborators').delete().eq('trip_id', tripId);
        await supabaseClient.from('memories').delete().eq('trip_id', tripId);

        const { error } = await supabaseClient
            .from('trips')
            .delete()
            .eq('id', tripId);

        if (error) throw error;

        // Remove from local array and re-render
        trips = trips.filter(t => t.id !== tripId);
        renderHomepage();

    } catch (error) {
        console.error('Error deleting trip:', error);
        alert('Error deleting trip: ' + error.message);
    }
}

async function archiveTrip(tripId) {
    if (!confirm('Archive this trip to Memory Lane? It will move from Your Trips to Memory Lane where you can add memories and reflections.')) return;

    try {
        const { error } = await supabaseClient
            .from('trips')
            .update({ is_past: true })
            .eq('id', tripId);

        if (error) throw error;

        // Move locally from trips → pastTrips
        const trip = trips.find(t => t.id === tripId);
        if (trip) {
            trip.is_past = true;
            trip.memories = trip.memories || [];
            trips = trips.filter(t => t.id !== tripId);
            pastTrips.unshift(trip);
        }

        renderHomepage();

        if (confirm('Trip archived! 🎉 Want to open Memory Lane for this trip now?')) {
            openMemoryJournal(tripId);
        }

    } catch (error) {
        console.error('Error archiving trip:', error);
        alert('Error archiving trip: ' + error.message);
    }
}
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

        // If we're not on the memory journal page, clear so next open is fresh
        if (currentPage !== 'memoryJournalPage') {
            window.currentMemoryTrip = null;
        }
        
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

// ============================================================================
// FRIENDS & COLLABORATION FUNCTIONS
// ============================================================================

// ---------- State ----------
let friends = [];           // accepted friends
let friendRequests = [];    // pending incoming requests
let currentTripCollaborators = []; // collaborators for currently open trip

// ---------- Search for users by email ----------
async function searchUserByEmail(email) {
    try {
        const { data, error } = await supabaseClient
            .from('profiles')
            .select('id, name, email')
            .ilike('email', email.trim())
            .neq('id', currentUser.id)
            .limit(5);

        if (error) throw error;
        return data || [];
    } catch (error) {
        console.error('Error searching users:', error);
        return [];
    }
}

// ---------- Send a friend request ----------
async function sendFriendRequest(addresseeId) {
    try {
        // Check if friendship already exists
        const { data: existing } = await supabaseClient
            .from('friendships')
            .select('id, status')
            .or(`and(requester_id.eq.${currentUser.id},addressee_id.eq.${addresseeId}),and(requester_id.eq.${addresseeId},addressee_id.eq.${currentUser.id})`)
            .maybeSingle();

        if (existing) {
            const msgs = { pending: 'Friend request already sent!', accepted: 'You are already friends!', declined: 'This request was declined.' };
            alert(msgs[existing.status] || 'Friendship already exists.');
            return;
        }

        const { error } = await supabaseClient
            .from('friendships')
            .insert([{ requester_id: currentUser.id, addressee_id: addresseeId }]);

        if (error) throw error;
        alert('Friend request sent! 🎉');
    } catch (error) {
        console.error('Error sending friend request:', error);
        alert('Error sending friend request: ' + error.message);
    }
}

// ---------- Accept / Decline friend request ----------
async function respondToFriendRequest(friendshipId, accept) {
    try {
        const { error } = await supabaseClient
            .from('friendships')
            .update({ status: accept ? 'accepted' : 'declined', updated_at: new Date().toISOString() })
            .eq('id', friendshipId);

        if (error) throw error;

        // Refresh friends list
        await loadFriends();
        renderFriendsPage();
    } catch (error) {
        console.error('Error responding to friend request:', error);
        alert('Error: ' + error.message);
    }
}

// ---------- Remove friend ----------
async function removeFriend(friendshipId) {
    if (!confirm('Remove this friend?')) return;
    try {
        const { error } = await supabaseClient
            .from('friendships')
            .delete()
            .eq('id', friendshipId);

        if (error) throw error;
        await loadFriends();
        renderFriendsPage();
    } catch (error) {
        console.error('Error removing friend:', error);
    }
}

// ---------- Load friends + pending requests ----------
async function loadFriends() {
    try {
        const { data, error } = await supabaseClient
            .from('friendships')
            .select(`
                id, status, requester_id, addressee_id,
                requester:profiles!friendships_requester_id_fkey(id, name, email),
                addressee:profiles!friendships_addressee_id_fkey(id, name, email)
            `)
            .or(`requester_id.eq.${currentUser.id},addressee_id.eq.${currentUser.id}`);

        if (error) throw error;

        friends = (data || [])
            .filter(f => f.status === 'accepted')
            .map(f => {
                const isMine = f.requester_id === currentUser.id;
                const other = isMine ? f.addressee : f.requester;
                return { friendshipId: f.id, ...other };
            });

        friendRequests = (data || [])
            .filter(f => f.status === 'pending' && f.addressee_id === currentUser.id)
            .map(f => ({ friendshipId: f.id, ...f.requester }));

        // Show notification dot if there are pending requests
        const btn = document.getElementById('friendsNavBtn');
        if (btn) {
            const existing = btn.querySelector('.request-dot');
            if (existing) existing.remove();
            if (friendRequests.length) {
                const dot = document.createElement('span');
                dot.className = 'request-dot';
                btn.appendChild(dot);
            }
        }

    } catch (error) {
        console.error('Error loading friends:', error);
    }
}

// ---------- Load collaborators for a trip ----------
async function loadTripCollaborators(tripId) {
    try {
        const { data, error } = await supabaseClient
            .from('trip_collaborators')
            .select(`
                id, role,
                user:profiles!trip_collaborators_user_id_fkey(id, name, email)
            `)
            .eq('trip_id', tripId);

        if (error) throw error;
        currentTripCollaborators = (data || []).map(c => ({
            collaboratorId: c.id,
            role: c.role,
            ...c.user
        }));
        return currentTripCollaborators;
    } catch (error) {
        console.error('Error loading collaborators:', error);
        return [];
    }
}

// ---------- Add a collaborator to a trip ----------
async function addTripCollaborator(tripId, userId, role = 'editor') {
    try {
        const { error } = await supabaseClient
            .from('trip_collaborators')
            .insert([{ trip_id: tripId, user_id: userId, role, invited_by: currentUser.id }]);

        if (error) throw error;
        await loadTripCollaborators(tripId);
        renderCollaboratorsModal(tripId);
        alert('Collaborator added! They can now co-plan this trip. 🌍');
    } catch (error) {
        console.error('Error adding collaborator:', error);
        alert('Error adding collaborator: ' + error.message);
    }
}

// ---------- Remove a collaborator ----------
async function removeTripCollaborator(collaboratorId, tripId) {
    if (!confirm('Remove this collaborator from the trip?')) return;
    try {
        const { error } = await supabaseClient
            .from('trip_collaborators')
            .delete()
            .eq('id', collaboratorId);

        if (error) throw error;
        await loadTripCollaborators(tripId);
        renderCollaboratorsModal(tripId);
    } catch (error) {
        console.error('Error removing collaborator:', error);
    }
}

// ---------- Load shared trips (trips where user is a collaborator) ----------
async function loadSharedTrips() {
    try {
        const { data, error } = await supabaseClient
            .from('trip_collaborators')
            .select(`
                role,
                trip:trips(*)
            `)
            .eq('user_id', currentUser.id);

        if (error) throw error;
        return (data || []).map(c => ({ ...c.trip, _sharedRole: c.role }));
    } catch (error) {
        console.error('Error loading shared trips:', error);
        return [];
    }
}

// Extend loadUserData to also load friends + shared trips
const _originalLoadUserData = loadUserData;
async function loadUserData(user) {
    await _originalLoadUserData(user);
    await loadFriends();
    
    // Load shared trips and merge into trips list
    const shared = await loadSharedTrips();
    if (shared.length) {
        const myIds = new Set(trips.map(t => t.id));
        shared.forEach(t => { if (!myIds.has(t.id)) trips.push(t); });
        renderHomepage();
    }
}
