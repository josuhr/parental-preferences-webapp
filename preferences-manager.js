// Preferences Manager JavaScript
// Handles household activities with multi-caregiver preferences

let currentUser = null;
let categories = [];
let householdActivities = [];
let allUniversalActivities = []; // For adding new activities
let preferences = [];
let userSettings = null;

// Initialize on page load
document.addEventListener('DOMContentLoaded', async () => {
    try {
        currentUser = await window.supabaseUtils.getCurrentUser();
        if (!currentUser) {
            window.location.href = '/auth.html';
            return;
        }

        userSettings = await window.supabaseUtils.getUserSettings(currentUser.id);
        
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
            const { data: prefsData, error: prefsError } = await supabaseClient
                .from('household_activity_preferences')
                .select('*')
                .in('household_activity_id', householdActivityIds);
            
            if (prefsError) throw prefsError;
            preferences = prefsData || [];
        } else {
            preferences = [];
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
    
    card.innerHTML = `
        <div class="category-header">
            <div class="category-title">
                <span class="category-icon">${category.icon}</span>
                <span>${category.name}</span>
                <span style="font-size: 11px; color: #888; margin-left: 10px;">(${categoryActivities.length} activities)</span>
            </div>
        </div>
        <div class="activities-table">
            <div class="table-header">
                <div class="col-activity">Activity</div>
                <div class="col-pref">${caregiver1Label}</div>
                <div class="col-pref">${caregiver2Label}</div>
                <div class="col-pref">${bothLabel}</div>
                <div class="col-actions">Actions</div>
            </div>
            <div class="table-body" id="activities-${category.id}"></div>
        </div>
    `;
    
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
    
    row.innerHTML = `
        <div class="col-activity">
            <div class="activity-name">${activity.name}</div>
            ${activity.description ? `<div class="activity-description">${activity.description}</div>` : ''}
        </div>
        <div class="col-pref">
            ${createPreferenceButtons(householdId, 'caregiver1', preference?.caregiver1_preference)}
        </div>
        <div class="col-pref">
            ${createPreferenceButtons(householdId, 'caregiver2', preference?.caregiver2_preference)}
        </div>
        <div class="col-pref">
            ${createPreferenceButtons(householdId, 'both', preference?.both_preference)}
        </div>
        <div class="col-actions">
            <button class="btn-icon" onclick="removeActivity('${householdId}')" title="Remove from household">🗑️</button>
        </div>
    `;
    
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
