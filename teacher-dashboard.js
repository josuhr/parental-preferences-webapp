// Teacher Dashboard Logic
let currentUser = null;
let accessibleKids = [];

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
    const supabase = await window.supabaseUtils.initSupabase();
    
    if (!supabase) {
        showError('Failed to initialize authentication');
        return;
    }
    
    // Check authentication
    currentUser = await window.supabaseUtils.getCurrentUser();
    
    if (!currentUser) {
        window.location.href = '/auth.html';
        return;
    }
    
    // Load teacher data
    await loadTeacherData();
});

// Load all teacher data
async function loadTeacherData() {
    try {
        const supabaseClient = window.supabaseUtils.getClient();
        
        // Get user profile
        const userProfile = await window.supabaseUtils.getUserProfile(currentUser.id);
        
        if (!userProfile) {
            showError('Failed to load your profile');
            return;
        }
        
        // Update welcome message
        document.getElementById('teacherName').textContent = userProfile.display_name || 'Teacher';
        
        // Load accessible kids
        await loadAccessibleKids();
        
        // Load statistics
        await loadStatistics();
        
    } catch (error) {
        console.error('Error loading teacher data:', error);
        showError('Failed to load dashboard: ' + error.message);
    }
}

// Load kids the teacher has access to
async function loadAccessibleKids() {
    const loadingEl = document.getElementById('loadingContainer');
    const kidsEl = document.getElementById('kidsContainer');
    
    loadingEl.style.display = 'block';
    kidsEl.innerHTML = '';
    
    try {
        const supabaseClient = window.supabaseUtils.getClient();
        
        // Get kids with approved access
        const { data: permissions, error: permError } = await supabaseClient
            .from('kid_access_permissions')
            .select('*')
            .eq('teacher_id', currentUser.id)
            .eq('status', 'approved');
        
        if (permError) throw permError;
        
        if (!permissions || permissions.length === 0) {
            kidsEl.innerHTML = `
                <div class="empty-state">
                    <div class="icon">👶</div>
                    <h3>No Kids Accessible Yet</h3>
                    <p>Parents haven't granted you access to any kids yet.</p>
                    <p style="color: #999; font-size: 0.9rem; margin-top: 10px;">
                        Ask parents to grant you access from their Kid Preferences dashboard.
                    </p>
                </div>
            `;
            loadingEl.style.display = 'none';
            return;
        }
        
        // Load kid details for each permission
        const kidIds = permissions.map(p => p.kid_id);
        
        const { data: kids, error: kidsError } = await supabaseClient
            .from('kids')
            .select('*')
            .in('id', kidIds);
        
        if (kidsError) throw kidsError;
        
        // Load preference counts for each kid
        const { data: preferences, error: prefError } = await supabaseClient
            .from('kid_preferences')
            .select('kid_id, preference_level')
            .in('kid_id', kidIds);
        
        if (prefError) throw prefError;
        
        // Combine data
        accessibleKids = kids.map(kid => {
            const permission = permissions.find(p => p.kid_id === kid.id);
            const kidPrefs = preferences.filter(p => p.kid_id === kid.id);
            const lovesCount = kidPrefs.filter(p => p.preference_level === 'loves').length;
            
            return {
                ...kid,
                access_level: permission.access_level,
                total_preferences: kidPrefs.length,
                loves_count: lovesCount
            };
        });
        
        // Render kids
        renderKids();
        
        loadingEl.style.display = 'none';
        
    } catch (error) {
        console.error('Error loading accessible kids:', error);
        loadingEl.style.display = 'none';
        showError('Failed to load kids: ' + error.message);
    }
}

// Render kids cards
function renderKids() {
    const kidsEl = document.getElementById('kidsContainer');
    kidsEl.innerHTML = '';
    
    accessibleKids.forEach(kid => {
        const card = createKidCard(kid);
        kidsEl.appendChild(card);
    });
}

// Create kid card element
function createKidCard(kid) {
    const card = document.createElement('div');
    card.className = 'kid-card';
    
    const age = calculateAge(kid.birth_date);
    
    card.innerHTML = `
        <div class="kid-header">
            <div class="kid-avatar">${kid.avatar_emoji || '👶'}</div>
            <div class="kid-info">
                <h3>${kid.name}</h3>
                <div class="kid-age">${age ? age + ' years old' : 'Age not set'}</div>
                <span class="access-badge ${kid.access_level}">${kid.access_level} access</span>
            </div>
        </div>
        ${kid.notes ? `<p style="color: #666; font-size: 0.9rem; margin-top: 10px;">${kid.notes}</p>` : ''}
        <div class="kid-stats">
            <div class="kid-stat">
                <div class="number">${kid.total_preferences || 0}</div>
                <div class="label">Preferences</div>
            </div>
            <div class="kid-stat">
                <div class="number">${kid.loves_count || 0}</div>
                <div class="label">Loves</div>
            </div>
        </div>
        <div class="quick-actions">
            <button class="quick-action-btn" onclick="viewKidPreferences('${kid.id}')">
                👀 View Preferences
            </button>
            <button class="quick-action-btn secondary" onclick="addObservation('${kid.id}')">
                📝 Add Observation
            </button>
        </div>
    `;
    
    return card;
}

// Calculate age from birth date
function calculateAge(birthDate) {
    if (!birthDate) return null;
    const today = new Date();
    const birth = new Date(birthDate);
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
        age--;
    }
    return age;
}

// Load statistics
async function loadStatistics() {
    try {
        const supabaseClient = window.supabaseUtils.getClient();
        
        // Count accessible kids
        const kidsCount = accessibleKids.length;
        document.getElementById('kidsCount').textContent = kidsCount;
        
        // Count observations
        const { data: observations, error: obsError } = await supabaseClient
            .from('teacher_observations')
            .select('id', { count: 'exact', head: true })
            .eq('teacher_id', currentUser.id);
        
        if (!obsError) {
            document.getElementById('observationsCount').textContent = observations || 0;
        }
        
        // Count perspective activities
        const { data: activities, error: actError } = await supabaseClient
            .from('perspective_activities')
            .select('id', { count: 'exact', head: true })
            .eq('created_by', currentUser.id);
        
        if (!actError) {
            document.getElementById('activitiesCount').textContent = activities || 0;
        }
        
    } catch (error) {
        console.error('Error loading statistics:', error);
    }
}

// View kid preferences (read-only)
function viewKidPreferences(kidId) {
    window.location.href = `/teacher-kid-view.html?kid=${kidId}`;
}

// Add observation
function addObservation(kidId) {
    window.location.href = `/teacher-observations.html?kid=${kidId}&action=add`;
}

// Show error
function showError(message) {
    const errorEl = document.getElementById('errorContainer');
    errorEl.innerHTML = `<div class="error">${message}</div>`;
}
