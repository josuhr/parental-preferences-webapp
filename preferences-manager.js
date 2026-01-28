// Preferences Manager JavaScript
// Handles household activities with multi-caregiver preferences and kid preferences

let currentUser = null;
let categories = [];
let householdActivities = [];
let allUniversalActivities = []; // For adding new activities
let preferences = [];
let userSettings = null;
let kids = [];
let kidPreferences = [];
let visibleKidIds = new Set(); // Track which kids are visible in the table

// Initialize on page load
document.addEventListener('DOMContentLoaded', async () => {
    try {
        currentUser = await window.supabaseUtils.getCurrentUser();
        if (!currentUser) {
            window.location.href = '/auth.html';
            return;
        }

        userSettings = await window.supabaseUtils.getUserSettings(currentUser.id);
        
        await loadKids(); // Load kids first
        setupEventListeners();
        await loadAllData();
        
    } catch (error) {
        console.error('Error initializing:', error);
        showError('Failed to initialize preferences manager');
    }
});

// Set up event listeners
function setupEventListeners() {
    document.getElementById('addActivityBtn').addEventListener('click', () => {
        openAddActivityModal();
    });
    
    document.getElementById('addActivityForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        await addActivityToHousehold();
    });
}

// Load kids for the current user
async function loadKids() {
    try {
        const supabaseClient = window.supabaseUtils.getClient();
        const { data, error } = await supabaseClient
            .from('kids')
            .select('*')
            .eq('parent_id', currentUser.id)
            .order('name', { ascending: true });
        
        if (error) throw error;
        
        kids = data || [];
        
        // Initially show all kids
        visibleKidIds = new Set(kids.map(k => k.id));
        
        // Render kid filters
        renderKidFilters();
        
    } catch (error) {
        console.error('Error loading kids:', error);
        showError('Failed to load kids');
    }
}

// Render kid filter checkboxes
function renderKidFilters() {
    const container = document.getElementById('kidFilters');
    if (!container) return;
    
    if (kids.length === 0) {
        container.innerHTML = '<span style="color: #666; font-style: italic;">No kids added yet</span>';
        return;
    }
    
    container.innerHTML = '';
    kids.forEach(kid => {
        const label = document.createElement('label');
        label.className = 'kid-filter-checkbox';
        label.innerHTML = `
            <input type="checkbox" 
                   value="${kid.id}" 
                   ${visibleKidIds.has(kid.id) ? 'checked' : ''} 
                   onchange="toggleKidVisibility('${kid.id}')">
            <span>${kid.emoji || '👤'} ${kid.name}</span>
        `;
        container.appendChild(label);
    });
}

// Toggle kid visibility in table
function toggleKidVisibility(kidId) {
    if (visibleKidIds.has(kidId)) {
        visibleKidIds.delete(kidId);
    } else {
        visibleKidIds.add(kidId);
    }
    renderHouseholdActivities();
}

// Make toggleKidVisibility available globally
window.toggleKidVisibility = toggleKidVisibility;

// Load all data
async function loadAllData() {
    showLoading(true);
    
    try {
        const supabaseClient = window.supabaseUtils.getClient();
        
        // Load universal kid activity categories
        const { data: categoriesData, error: categoriesError } = await supabaseClient
            .from('kid_activity_categories')
            .select('*')
            .is('parent_id', null)
            .order('sort_order', { ascending: true });
        
        if (categoriesError) throw categoriesError;
        categories = categoriesData || [];
        
        // Load ALL universal activities (for the add modal)
        const categoryIds = categories.map(c => c.id);
        if (categoryIds.length > 0) {
            const { data: allActivitiesData, error: allActivitiesError } = await supabaseClient
                .from('kid_activities')
                .select('*')
                .in('category_id', categoryIds)
                .order('name', { ascending: true });
            
            if (allActivitiesError) throw allActivitiesError;
            allUniversalActivities = allActivitiesData || [];
        }
        
        // Load household activities
        const { data: householdData, error: householdError } = await supabaseClient
            .from('household_activities')
            .select(`
                id,
                activity_id,
                added_at,
                notes,
                kid_activities (
                    id,
                    name,
                    description,
                    category_id
                )
            `)
            .eq('user_id', currentUser.id)
            .order('added_at', { ascending: false });
        
        if (householdError) throw householdError;
        householdActivities = householdData || [];
        
        // Load preferences for household activities
        const householdActivityIds = householdActivities.map(ha => ha.id);
        if (householdActivityIds.length > 0) {
            const { data: prefsData, error: prefsError} = await supabaseClient
                .from('household_activity_preferences')
                .select('*')
                .in('household_activity_id', householdActivityIds);
            
            if (prefsError) throw prefsError;
            preferences = prefsData || [];
        } else {
            preferences = [];
        }
        
        // Load kid preferences for all activities
        const activityIds = householdActivities.map(ha => ha.activity_id);
        if (activityIds.length > 0 && kids.length > 0) {
            const kidIds = kids.map(k => k.id);
            const { data: kidPrefsData, error: kidPrefsError } = await supabaseClient
                .from('kid_preferences')
                .select('*')
                .in('kid_id', kidIds)
                .in('activity_id', activityIds);
            
            if (kidPrefsError) throw kidPrefsError;
            kidPreferences = kidPrefsData || [];
        } else {
            kidPreferences = [];
        }
        
        renderHouseholdActivities();
        
    } catch (error) {
        console.error('Error loading data:', error);
        showError('Failed to load preferences: ' + error.message);
    } finally {
        showLoading(false);
    }
}

// Render household activities
function renderHouseholdActivities() {
    const container = document.getElementById('activitiesContainer');
    const emptyState = document.getElementById('emptyState');
    
    if (householdActivities.length === 0) {
        container.style.display = 'none';
        emptyState.style.display = 'block';
        return;
    }
    
    container.style.display = 'block';
    emptyState.style.display = 'none';
    container.innerHTML = '';
    
    // Group by category
    const activityByCategory = {};
    householdActivities.forEach(ha => {
        const activity = ha.kid_activities;
        const categoryId = activity.category_id;
        if (!activityByCategory[categoryId]) {
            activityByCategory[categoryId] = [];
        }
        activityByCategory[categoryId].push({
            household_id: ha.id,
            activity: activity
        });
    });
    
    // Render each category
    categories.forEach(category => {
        const categoryActivities = activityByCategory[category.id] || [];
        if (categoryActivities.length > 0) {
            const categoryCard = createCategoryCard(category, categoryActivities);
            container.appendChild(categoryCard);
        }
    });
}

// Create category card
function createCategoryCard(category, categoryActivities) {
    const card = document.createElement('div');
    card.className = 'category-card';
    
    const caregiver1Label = userSettings?.caregiver1_label || 'Mom';
    const caregiver2Label = userSettings?.caregiver2_label || 'Dad';
    const bothLabel = userSettings?.both_label || 'Both';
    
    // Build header with kid columns
    let headerHTML = `
        <div class="category-header">
            <div class="category-title">
                <span class="category-icon">${category.icon}</span>
                <span>${category.name}</span>
                <span style="font-size: 11px; color: #888; margin-left: 10px;">(${categoryActivities.length} activities)</span>
            </div>
        </div>
        <div class="activities-table">
            <div class="table-header" style="display: grid; grid-template-columns: 2fr repeat(2, 1fr)`;
    
    // Add kid columns
    const visibleKids = kids.filter(k => visibleKidIds.has(k.id));
    visibleKids.forEach(() => {
        headerHTML += ' 1fr';
    });
    headerHTML += ' 100px; gap: 10px; align-items: center;">';
    
    headerHTML += `
                <div class="col-activity">Activity</div>
                <div class="col-pref">${caregiver1Label}</div>
                <div class="col-pref">${caregiver2Label}</div>`;
    
    // Add kid column headers
    visibleKids.forEach(kid => {
        headerHTML += `<div class="col-pref kid-column">${kid.emoji || '👤'} ${kid.name}</div>`;
    });
    
    headerHTML += `
                <div class="col-actions">Actions</div>
            </div>
            <div class="table-body" id="activities-${category.id}"></div>
        </div>
    `;
    
    card.innerHTML = headerHTML;
    
    const tableBody = card.querySelector(`#activities-${category.id}`);
    categoryActivities.forEach(item => {
        const activityRow = createActivityRow(item.household_id, item.activity);
        tableBody.appendChild(activityRow);
    });
    
    return card;
}

// Create activity row
function createActivityRow(householdId, activity) {
    const row = document.createElement('div');
    row.className = 'activity-row';
    
    const preference = preferences.find(p => p.household_activity_id === householdId);
    const visibleKids = kids.filter(k => visibleKidIds.has(k.id));
    
    // Build grid template matching header
    let gridTemplate = '2fr repeat(2, 1fr)';
    visibleKids.forEach(() => {
        gridTemplate += ' 1fr';
    });
    gridTemplate += ' 100px';
    
    row.style.display = 'grid';
    row.style.gridTemplateColumns = gridTemplate;
    row.style.gap = '10px';
    row.style.alignItems = 'center';
    
    let rowHTML = `
        <div class="col-activity">
            <div class="activity-name">${activity.name}</div>
            ${activity.description ? `<div class="activity-description">${activity.description}</div>` : ''}
        </div>
        <div class="col-pref">
            ${createPreferenceButtons(householdId, 'caregiver1', preference?.caregiver1_preference)}
        </div>
        <div class="col-pref">
            ${createPreferenceButtons(householdId, 'caregiver2', preference?.caregiver2_preference)}
        </div>`;
    
    // Add kid preference columns
    visibleKids.forEach(kid => {
        const kidPref = kidPreferences.find(kp => kp.kid_id === kid.id && kp.activity_id === activity.id);
        rowHTML += `
        <div class="col-pref kid-column">
            ${createKidPreferenceButtons(kid.id, activity.id, kidPref?.preference_level)}
        </div>`;
    });
    
    rowHTML += `
        <div class="col-actions">
            <button class="btn-icon" onclick="removeActivity('${householdId}')" title="Remove from household">🗑️</button>
        </div>
    `;
    
    row.innerHTML = rowHTML;
    
    return row;
}

// Create preference buttons
function createPreferenceButtons(householdId, caregiverType, currentPreference) {
    const levels = [
        { value: 'drop_anything', emoji: '💚', title: 'Drop anything' },
        { value: 'sometimes', emoji: '💛', title: 'Sometimes' },
        { value: 'on_your_own', emoji: '⭐', title: 'On your own' }
    ];
    
    return levels.map(level => {
        const active = currentPreference === level.value ? 'active' : '';
        return `<button class="preference-btn ${active}" 
                        data-level="${level.value}" 
                        onclick="updatePreference('${householdId}', '${caregiverType}', '${level.value}')"
                        title="${level.title}">${level.emoji}</button>`;
    }).join('');
}

// Create kid preference buttons
function createKidPreferenceButtons(kidId, activityId, currentPreference) {
    const levels = [
        { value: 'loves', emoji: '💚', title: 'Loves' },
        { value: 'likes', emoji: '💙', title: 'Likes' },
        { value: 'neutral', emoji: '😐', title: 'Not Interested' },
        { value: 'refuses', emoji: '⭐', title: 'Not Yet Tried' }
    ];
    
    return levels.map(level => {
        const active = currentPreference === level.value ? 'active' : '';
        return `<button class="kid-preference-btn ${active}" 
                        data-level="${level.value}" 
                        onclick="updateKidPreference('${kidId}', '${activityId}', '${level.value}')"
                        title="${level.title}">${level.emoji}</button>`;
    }).join('');
}

// Update preference
async function updatePreference(householdId, caregiverType, level) {
    try {
        const supabaseClient = window.supabaseUtils.getClient();
        const existingPref = preferences.find(p => p.household_activity_id === householdId);
        
        const columnName = `${caregiverType}_preference`;
        
        if (existingPref) {
            // Update existing
            const { error } = await supabaseClient
                .from('household_activity_preferences')
                .update({ 
                    [columnName]: level,
                    updated_at: new Date().toISOString() 
                })
                .eq('id', existingPref.id);
            
            if (error) throw error;
            existingPref[columnName] = level;
        } else {
            // Create new
            const { data, error } = await supabaseClient
                .from('household_activity_preferences')
                .insert({
                    household_activity_id: householdId,
                    [columnName]: level
                })
                .select()
                .single();
            
            if (error) throw error;
            preferences.push(data);
        }
        
        renderHouseholdActivities();
        
    } catch (error) {
        console.error('Error updating preference:', error);
        showError('Failed to update preference');
    }
}

// Update kid preference
async function updateKidPreference(kidId, activityId, level) {
    try {
        const supabaseClient = window.supabaseUtils.getClient();
        const existingPref = kidPreferences.find(kp => kp.kid_id === kidId && kp.activity_id === activityId);
        
        if (existingPref) {
            // Update existing
            const { error } = await supabaseClient
                .from('kid_preferences')
                .update({ 
                    preference_level: level,
                    updated_at: new Date().toISOString() 
                })
                .eq('id', existingPref.id);
            
            if (error) throw error;
            existingPref.preference_level = level;
        } else {
            // Create new
            const { data, error } = await supabaseClient
                .from('kid_preferences')
                .insert({
                    kid_id: kidId,
                    activity_id: activityId,
                    preference_level: level
                })
                .select()
                .single();
            
            if (error) throw error;
            kidPreferences.push(data);
        }
        
        renderHouseholdActivities();
        
    } catch (error) {
        console.error('Error updating kid preference:', error);
        showError('Failed to update kid preference');
    }
}

// Make functions available globally
window.updateKidPreference = updateKidPreference;

// Open add activity modal
function openAddActivityModal() {
    const modal = document.getElementById('addActivityModal');
    const select = document.getElementById('activitySelect');
    
    // Get activity IDs already in household
    const householdActivityIds = householdActivities.map(ha => ha.kid_activities.id);
    
    // Filter to show only activities not yet added
    const availableActivities = allUniversalActivities.filter(
        a => !householdActivityIds.includes(a.id)
    );
    
    if (availableActivities.length === 0) {
        showError('All activities have been added to your household!');
        return;
    }
    
    // Populate select
    select.innerHTML = '<option value="">-- Select an activity --</option>';
    availableActivities.forEach(activity => {
        const category = categories.find(c => c.id === activity.category_id);
        const option = document.createElement('option');
        option.value = activity.id;
        option.textContent = `${category?.icon || ''} ${activity.name}`;
        select.appendChild(option);
    });
    
    modal.style.display = 'flex';
}

// Close add activity modal
function closeAddActivityModal() {
    document.getElementById('addActivityModal').style.display = 'none';
    document.getElementById('addActivityForm').reset();
}

// Add activity to household
async function addActivityToHousehold() {
    try {
        const activityId = document.getElementById('activitySelect').value;
        if (!activityId) {
            showError('Please select an activity');
            return;
        }
        
        const supabaseClient = window.supabaseUtils.getClient();
        
        const { data, error } = await supabaseClient
            .from('household_activities')
            .insert({
                user_id: currentUser.id,
                activity_id: activityId
            })
            .select()
            .single();
        
        if (error) throw error;
        
        closeAddActivityModal();
        await loadAllData();
        showSuccess('Activity added to household!');
        
    } catch (error) {
        console.error('Error adding activity:', error);
        showError('Failed to add activity: ' + error.message);
    }
}

// Remove activity from household
async function removeActivity(householdId) {
    if (!confirm('Remove this activity from your household?')) {
        return;
    }
    
    try {
        const supabaseClient = window.supabaseUtils.getClient();
        
        const { error } = await supabaseClient
            .from('household_activities')
            .delete()
            .eq('id', householdId);
        
        if (error) throw error;
        
        await loadAllData();
        showSuccess('Activity removed from household');
        
    } catch (error) {
        console.error('Error removing activity:', error);
        showError('Failed to remove activity');
    }
}

// Utility functions
function showLoading(show) {
    const loader = document.getElementById('loading');
    if (loader) {
        loader.style.display = show ? 'block' : 'none';
    }
}

function showError(message) {
    const errorDiv = document.getElementById('error');
    if (errorDiv) {
        errorDiv.textContent = message;
        errorDiv.style.display = 'block';
        setTimeout(() => errorDiv.style.display = 'none', 5000);
    }
    console.error(message);
}

function showSuccess(message) {
    const successDiv = document.getElementById('success');
    if (successDiv) {
        successDiv.textContent = message;
        successDiv.style.display = 'block';
        setTimeout(() => successDiv.style.display = 'none', 3000);
    }
}
