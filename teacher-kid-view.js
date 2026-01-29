// Teacher Kid View Logic (Read-Only)
let currentUser = null;
let kidId = null;
let kidData = null;

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
    
    // Get kid ID from URL
    const urlParams = new URLSearchParams(window.location.search);
    kidId = urlParams.get('kid');
    
    if (!kidId) {
        showError('No kid specified');
        return;
    }
    
    // Verify teacher has access
    await verifyAccess();
});

// Verify teacher has access to this kid
async function verifyAccess() {
    try {
        const supabaseClient = window.supabaseUtils.getClient();
        
        // Check if teacher has approved access
        const { data: access, error } = await supabaseClient
            .from('kid_access_permissions')
            .select('*')
            .eq('kid_id', kidId)
            .eq('teacher_id', currentUser.id)
            .eq('status', 'approved')
            .single();
        
        if (error || !access) {
            showError('You do not have access to view this kid\'s preferences');
            return;
        }
        
        // Load kid data and preferences
        await loadKidData();
        await loadPreferences();
        
    } catch (error) {
        console.error('Error verifying access:', error);
        showError('Failed to verify access: ' + error.message);
    }
}

// Load kid information
async function loadKidData() {
    try {
        const supabaseClient = window.supabaseUtils.getClient();
        
        const { data: kid, error } = await supabaseClient
            .from('kids')
            .select('*')
            .eq('id', kidId)
            .single();
        
        if (error) throw error;
        
        kidData = kid;
        
        // Update UI
        document.getElementById('kidAvatar').textContent = kid.avatar_emoji || '👶';
        document.getElementById('kidName').textContent = kid.name;
        
    } catch (error) {
        console.error('Error loading kid data:', error);
        showError('Failed to load kid data: ' + error.message);
    }
}

// Load preferences
async function loadPreferences() {
    const loadingEl = document.getElementById('loadingContainer');
    const categoriesEl = document.getElementById('categoriesContainer');
    
    loadingEl.style.display = 'block';
    categoriesEl.innerHTML = '';
    
    try {
        const supabaseClient = window.supabaseUtils.getClient();
        
        // Get parent ID for this kid
        const { data: kid, error: kidError } = await supabaseClient
            .from('kids')
            .select('parent_id')
            .eq('id', kidId)
            .single();
        
        if (kidError) throw kidError;
        
        // Load categories
        const { data: categories, error: catError } = await supabaseClient
            .from('kid_activity_categories')
            .select('*')
            .eq('parent_id', kid.parent_id)
            .order('sort_order', { ascending: true });
        
        if (catError) throw catError;
        
        if (!categories || categories.length === 0) {
            categoriesEl.innerHTML = `
                <div class="empty-state">
                    <div class="icon">📋</div>
                    <h3>No Preferences Yet</h3>
                    <p>The parent hasn't added any activities for ${kidData.name} yet.</p>
                </div>
            `;
            loadingEl.style.display = 'none';
            return;
        }
        
        // Load activities for these categories
        const categoryIds = categories.map(c => c.id);
        
        const { data: activities, error: actError } = await supabaseClient
            .from('kid_activities')
            .select('*')
            .in('category_id', categoryIds)
            .order('sort_order', { ascending: true });
        
        if (actError) throw actError;
        
        // Load preferences for this kid
        const { data: preferences, error: prefError } = await supabaseClient
            .from('kid_preferences')
            .select('*')
            .eq('kid_id', kidId);
        
        if (prefError) throw prefError;
        
        // Render each category
        categories.forEach(category => {
            const categoryActivities = activities.filter(a => a.category_id === category.id);
            if (categoryActivities.length > 0) {
                const section = renderCategory(category, categoryActivities, preferences);
                categoriesEl.appendChild(section);
            }
        });
        
        loadingEl.style.display = 'none';
        
    } catch (error) {
        console.error('Error loading preferences:', error);
        loadingEl.style.display = 'none';
        showError('Failed to load preferences: ' + error.message);
    }
}

// Render category section
function renderCategory(category, activities, preferences) {
    const section = document.createElement('div');
    section.className = 'category-section';
    
    const header = document.createElement('div');
    header.className = 'category-header';
    header.innerHTML = `
        <h2>${category.icon} ${category.name}</h2>
    `;
    section.appendChild(header);
    
    // Group activities by preference level
    const grouped = {
        loves: [],
        likes: [],
        neutral: [],
        dislikes: [],
        refuses: []
    };
    
    activities.forEach(activity => {
        const pref = preferences.find(p => p.activity_id === activity.id);
        const level = pref ? pref.preference_level : 'neutral';
        grouped[level].push(activity);
    });
    
    // Render each preference group
    const levels = [
        { key: 'loves', emoji: '💖', title: 'Loves' },
        { key: 'likes', emoji: '😊', title: 'Likes' },
        { key: 'neutral', emoji: '😐', title: 'Neutral' },
        { key: 'dislikes', emoji: '😕', title: 'Dislikes' },
        { key: 'refuses', emoji: '🚫', title: 'Refuses' }
    ];
    
    levels.forEach(level => {
        if (grouped[level.key].length > 0) {
            const group = renderPreferenceGroup(level, grouped[level.key]);
            section.appendChild(group);
        }
    });
    
    return section;
}

// Render preference group
function renderPreferenceGroup(level, activities) {
    const group = document.createElement('div');
    group.className = 'preference-group';
    
    const title = document.createElement('div');
    title.className = `preference-group-title ${level.key}`;
    title.textContent = `${level.emoji} ${level.title}`;
    group.appendChild(title);
    
    const list = document.createElement('div');
    list.className = 'activities-list';
    
    activities.forEach(activity => {
        const chip = document.createElement('div');
        chip.className = 'activity-chip';
        chip.innerHTML = `
            <strong>${activity.name}</strong>
            ${activity.description ? `<div class="description">${activity.description}</div>` : ''}
        `;
        list.appendChild(chip);
    });
    
    group.appendChild(list);
    
    return group;
}

// Navigate to add observation
function addObservation() {
    window.location.href = `/teacher-observations.html?kid=${kidId}&action=add`;
}

// View observations for this kid
function viewObservations() {
    window.location.href = `/teacher-observations.html?kid=${kidId}`;
}

// Show error
function showError(message) {
    const errorEl = document.getElementById('errorContainer');
    errorEl.innerHTML = `<div class="error-message">${message}</div>`;
    
    // Auto-dismiss after 8 seconds
    setTimeout(() => {
        errorEl.innerHTML = '';
    }, 8000);
}
