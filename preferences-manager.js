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
let expandedCategoryIds = new Set(); // Track expanded categories in current session
let selectedActivityIds = new Set(); // For bulk add modal

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

    document.getElementById('bulkAddBtn').addEventListener('click', () => {
        openBulkAddModal();
    });

    document.getElementById('aiSuggestionsBtn').addEventListener('click', () => {
        openAiSuggestionsModal();
    });
    
    // Search input
    document.getElementById('activitySearchInput').addEventListener('input', (e) => {
        filterActivitiesInModal(e.target.value);
    });
    
    // Bulk search input
    document.getElementById('bulkSearchInput').addEventListener('input', (e) => {
        filterBulkActivities(e.target.value);
    });
    
    // Show/hide create form
    document.getElementById('showCreateActivityBtn').addEventListener('click', () => {
        document.getElementById('createActivityForm').style.display = 'block';
        document.getElementById('showCreateActivityBtn').style.display = 'none';
    });
    
    document.getElementById('cancelCreateBtn').addEventListener('click', () => {
        document.getElementById('createActivityForm').style.display = 'none';
        document.getElementById('showCreateActivityBtn').style.display = 'block';
        clearCreateForm();
    });
    
    // Create new activity
    document.getElementById('createActivityBtn').addEventListener('click', async () => {
        await createAndAddNewActivity();
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
    const card = document.createElement('details');
    card.className = 'category-card';
    card.dataset.categoryId = category.id;
    
    // Keep category open if it was previously expanded in this session
    if (expandedCategoryIds.has(category.id)) {
        card.setAttribute('open', '');
    }
    
    // Track when category is opened/closed
    card.addEventListener('toggle', () => {
        if (card.open) {
            expandedCategoryIds.add(category.id);
        } else {
            expandedCategoryIds.delete(category.id);
        }
    });
    
    const caregiver1Label = userSettings?.caregiver1_label || 'Mom';
    const caregiver2Label = userSettings?.caregiver2_label || 'Dad';
    const bothLabel = userSettings?.both_label || 'Both';
    
    // Build header with kid columns
    let headerHTML = `
        <summary class="category-header">
            <div class="category-title">
                <span class="category-icon">${category.icon}</span>
                <span>${category.name}</span>
                <span style="font-size: 11px; color: #888; margin-left: 10px;">(${categoryActivities.length} activities)</span>
            </div>
        </summary>
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
        { value: 'drop_anything', emoji: '🔥', title: 'Drop anything - High priority' },
        { value: 'sometimes', emoji: '👌', title: 'Sometimes - Flexible' },
        { value: 'on_your_own', emoji: '🆗', title: 'On your own - Kid can do independently' }
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
        { value: 'loves', emoji: '⭐', title: 'Loves - Kid\'s favorite!' },
        { value: 'likes', emoji: '👍', title: 'Likes - Kid enjoys this' },
        { value: 'neutral', emoji: '😐', title: 'Not Interested - Kid doesn\'t enjoy' },
        { value: 'refuses', emoji: '❓', title: 'Not Yet Tried - Unknown preference' }
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
    
    // Get activity IDs already in household
    const householdActivityIds = householdActivities.map(ha => ha.kid_activities.id);
    
    // Filter to show only activities not yet added
    const availableActivities = allUniversalActivities.filter(
        a => !householdActivityIds.includes(a.id)
    );
    
    // Populate category dropdown for create form
    const categorySelect = document.getElementById('newActivityCategory');
    categorySelect.innerHTML = '<option value="">-- Select a category --</option>';
    categories.forEach(cat => {
        const option = document.createElement('option');
        option.value = cat.id;
        option.textContent = `${cat.icon} ${cat.name}`;
        categorySelect.appendChild(option);
    });
    
    // Reset search and form
    document.getElementById('activitySearchInput').value = '';
    document.getElementById('createActivityForm').style.display = 'none';
    document.getElementById('showCreateActivityBtn').style.display = 'block';
    clearCreateForm();
    
    // Populate activities by category
    renderActivitiesByCategory(availableActivities);
    
    modal.style.display = 'flex';
}

// Render activities grouped by category
function renderActivitiesByCategory(activities) {
    const container = document.getElementById('activitiesByCategory');
    container.innerHTML = '';
    
    if (activities.length === 0) {
        document.getElementById('noActivitiesFound').style.display = 'block';
        return;
    }
    
    document.getElementById('noActivitiesFound').style.display = 'none';
    
    // Group by category
    const groupedActivities = {};
    activities.forEach(activity => {
        if (!groupedActivities[activity.category_id]) {
            groupedActivities[activity.category_id] = [];
        }
        groupedActivities[activity.category_id].push(activity);
    });
    
    // Render each category
    categories.forEach(category => {
        const categoryActivities = groupedActivities[category.id];
        if (!categoryActivities || categoryActivities.length === 0) return;
        
        const categorySection = document.createElement('div');
        categorySection.style.marginBottom = '20px';
        categorySection.className = 'activity-category-section';
        
        const categoryHeader = document.createElement('div');
        categoryHeader.style.cssText = 'background: #667eea; color: white; padding: 10px 15px; border-radius: 8px 8px 0 0; font-weight: 600; display: flex; align-items: center; gap: 8px;';
        categoryHeader.innerHTML = `<span>${category.icon}</span><span>${category.name}</span><span style="opacity: 0.8; font-size: 0.9em;">(${categoryActivities.length})</span>`;
        
        const activityList = document.createElement('div');
        activityList.style.cssText = 'border: 1px solid #e0e0e0; border-top: none; border-radius: 0 0 8px 8px; background: white;';
        
        categoryActivities.forEach((activity, index) => {
            const activityItem = document.createElement('div');
            activityItem.className = 'activity-item';
            activityItem.dataset.activityId = activity.id;
            activityItem.dataset.activityName = activity.name.toLowerCase();
            activityItem.dataset.categoryId = activity.category_id;
            activityItem.style.cssText = `
                padding: 12px 15px;
                display: flex;
                justify-content: space-between;
                align-items: center;
                cursor: pointer;
                transition: background 0.2s;
                ${index < categoryActivities.length - 1 ? 'border-bottom: 1px solid #f0f0f0;' : ''}
            `;
            
            activityItem.addEventListener('mouseenter', () => {
                activityItem.style.background = '#f5f7fa';
            });
            
            activityItem.addEventListener('mouseleave', () => {
                activityItem.style.background = 'white';
            });
            
            activityItem.innerHTML = `
                <div>
                    <div style="font-weight: 500; color: #333;">${activity.name}</div>
                    ${activity.description ? `<div style="font-size: 0.85rem; color: #666; margin-top: 4px;">${activity.description}</div>` : ''}
                </div>
                <button type="button" class="btn-primary" style="padding: 6px 16px; font-size: 0.9rem;" 
                        onclick="addSpecificActivityToHousehold('${activity.id}')">Add</button>
            `;
            
            activityList.appendChild(activityItem);
        });
        
        categorySection.appendChild(categoryHeader);
        categorySection.appendChild(activityList);
        container.appendChild(categorySection);
    });
}

// Filter activities in modal by search term
function filterActivitiesInModal(searchTerm) {
    const normalizedSearch = searchTerm.toLowerCase().trim();
    const householdActivityIds = householdActivities.map(ha => ha.kid_activities.id);
    
    if (normalizedSearch === '') {
        // Show all available activities
        const availableActivities = allUniversalActivities.filter(
            a => !householdActivityIds.includes(a.id)
        );
        renderActivitiesByCategory(availableActivities);
    } else {
        // Filter by search term
        const filteredActivities = allUniversalActivities.filter(a => {
            if (householdActivityIds.includes(a.id)) return false;
            return a.name.toLowerCase().includes(normalizedSearch) || 
                   (a.description && a.description.toLowerCase().includes(normalizedSearch));
        });
        renderActivitiesByCategory(filteredActivities);
    }
}

// Add specific activity to household (called from modal)
async function addSpecificActivityToHousehold(activityId) {
    try {
        const supabaseClient = window.supabaseUtils.getClient();
        
        const { data, error } = await supabaseClient
            .from('household_activities')
            .insert({
                user_id: currentUser.id,
                activity_id: activityId
            })
            .select();
        
        if (error) throw error;
        
        showSuccess('Activity added to household!');
        await loadAllData();
        closeAddActivityModal();
        
    } catch (error) {
        console.error('Error adding activity:', error);
        showError('Failed to add activity');
    }
}

// Create and add new activity
async function createAndAddNewActivity() {
    try {
        const categoryId = document.getElementById('newActivityCategory').value;
        const name = document.getElementById('newActivityName').value.trim();
        const description = document.getElementById('newActivityDescription').value.trim();
        
        if (!categoryId || !name) {
            showError('Please fill in required fields');
            return;
        }
        
        const supabaseClient = window.supabaseUtils.getClient();
        
        // Create the activity as a universal activity
        const { data: newActivity, error: activityError } = await supabaseClient
            .from('kid_activities')
            .insert({
                category_id: categoryId,
                name: name,
                description: description || null
            })
            .select()
            .single();
        
        if (activityError) throw activityError;
        
        // Add to household
        const { data: householdActivity, error: householdError } = await supabaseClient
            .from('household_activities')
            .insert({
                user_id: currentUser.id,
                activity_id: newActivity.id
            })
            .select();
        
        if (householdError) throw householdError;
        
        showSuccess('Activity created and added to household!');
        await loadAllData();
        closeAddActivityModal();
        
    } catch (error) {
        console.error('Error creating activity:', error);
        showError('Failed to create activity');
    }
}

// Clear create form
function clearCreateForm() {
    document.getElementById('newActivityCategory').value = '';
    document.getElementById('newActivityName').value = '';
    document.getElementById('newActivityDescription').value = '';
}

// Close add activity modal
function closeAddActivityModal() {
    document.getElementById('addActivityModal').style.display = 'none';
    
    // Clear the create activity form
    clearCreateForm();
    
    // Hide the create form div
    const createForm = document.getElementById('createActivityForm');
    if (createForm) {
        createForm.style.display = 'none';
    }
    
    // Clear search input
    const searchInput = document.getElementById('activitySearchInput');
    if (searchInput) {
        searchInput.value = '';
    }
}

// Add activity to household
// Function removed - now using addSpecificActivityToHousehold() and createAndAddNewActivity()

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

// ====== BULK ADD FUNCTIONALITY ======

// Open bulk add modal
function openBulkAddModal() {
    selectedActivityIds.clear();
    const modal = document.getElementById('bulkAddModal');
    
    if (!modal) {
        showError('Bulk add modal not found');
        return;
    }
    
    // Reset search
    const searchInput = document.getElementById('bulkSearchInput');
    const selectAllCheckbox = document.getElementById('selectAllCheckbox');
    
    if (searchInput) searchInput.value = '';
    if (selectAllCheckbox) selectAllCheckbox.checked = false;
    
    // Render activities
    try {
        renderBulkActivities();
        updateSelectedCount();
    } catch (error) {
        console.error('Error rendering bulk activities:', error);
        showError('Error loading activities: ' + error.message);
        return;
    }
    
    modal.style.display = 'flex';
}

// Close bulk add modal
function closeBulkAddModal() {
    document.getElementById('bulkAddModal').style.display = 'none';
    selectedActivityIds.clear();
}

// Render bulk activities with checkboxes
function renderBulkActivities(searchTerm = '') {
    const container = document.getElementById('bulkActivitiesContainer');
    const noActivitiesDiv = document.getElementById('bulkNoActivitiesFound');
    
    if (!container || !noActivitiesDiv) {
        return;
    }
    
    container.innerHTML = '';
    
    // Get activities not already in household
    const householdActivityIds = householdActivities.map(ha => ha.kid_activities.id);
    let availableActivities = allUniversalActivities.filter(a => !householdActivityIds.includes(a.id));
    
    // Apply search filter
    if (searchTerm) {
        const normalized = searchTerm.toLowerCase().trim();
        availableActivities = availableActivities.filter(a =>
            a.name.toLowerCase().includes(normalized) ||
            (a.description && a.description.toLowerCase().includes(normalized))
        );
    }
    
    if (availableActivities.length === 0) {
        noActivitiesDiv.style.display = 'block';
        return;
    }
    
    noActivitiesDiv.style.display = 'none';
    
    // Group by category
    const groupedActivities = {};
    availableActivities.forEach(activity => {
        if (!groupedActivities[activity.category_id]) {
            groupedActivities[activity.category_id] = [];
        }
        groupedActivities[activity.category_id].push(activity);
    });
    
    // Render each category
    categories.forEach(category => {
        const categoryActivities = groupedActivities[category.id];
        if (!categoryActivities || categoryActivities.length === 0) return;
        
        const categorySection = document.createElement('div');
        categorySection.style.marginBottom = '20px';
        
        const categoryHeader = document.createElement('div');
        categoryHeader.style.cssText = 'background: #667eea; color: white; padding: 10px 15px; border-radius: 8px 8px 0 0; font-weight: 600; display: flex; align-items: center; gap: 8px;';
        categoryHeader.innerHTML = `
            <span>${category.icon}</span>
            <span>${category.name}</span>
            <span style="opacity: 0.8; font-size: 0.9em;">(${categoryActivities.length})</span>
        `;
        
        const activityList = document.createElement('div');
        activityList.style.cssText = 'border: 1px solid #e0e0e0; border-top: none; border-radius: 0 0 8px 8px; background: white;';
        
        categoryActivities.forEach((activity, index) => {
            const activityItem = document.createElement('div');
            activityItem.className = 'bulk-activity-item';
            activityItem.dataset.activityId = activity.id;
            activityItem.style.cssText = `
                padding: 12px 15px;
                display: flex;
                align-items: center;
                gap: 12px;
                cursor: pointer;
                transition: background 0.2s;
                ${index < categoryActivities.length - 1 ? 'border-bottom: 1px solid #f0f0f0;' : ''}
            `;
            
            const isSelected = selectedActivityIds.has(activity.id);
            
            activityItem.addEventListener('click', () => {
                toggleActivitySelection(activity.id);
            });
            
            activityItem.addEventListener('mouseenter', () => {
                activityItem.style.background = '#f5f7fa';
            });
            
            activityItem.addEventListener('mouseleave', () => {
                activityItem.style.background = 'white';
            });
            
            activityItem.innerHTML = `
                <input type="checkbox" 
                       class="bulk-checkbox" 
                       data-activity-id="${activity.id}" 
                       ${isSelected ? 'checked' : ''}
                       style="width: 18px; height: 18px; cursor: pointer;">
                <div style="flex: 1;">
                    <div style="font-weight: 500; color: #333;">${activity.name}</div>
                    ${activity.description ? `<div style="font-size: 0.85rem; color: #666; margin-top: 4px;">${activity.description}</div>` : ''}
                </div>
            `;
            
            activityList.appendChild(activityItem);
        });
        
        categorySection.appendChild(categoryHeader);
        categorySection.appendChild(activityList);
        container.appendChild(categorySection);
    });
}

// Toggle activity selection
function toggleActivitySelection(activityId) {
    if (selectedActivityIds.has(activityId)) {
        selectedActivityIds.delete(activityId);
    } else {
        selectedActivityIds.add(activityId);
    }
    
    // Update checkbox
    const checkbox = document.querySelector(`input[data-activity-id="${activityId}"]`);
    if (checkbox) {
        checkbox.checked = selectedActivityIds.has(activityId);
    }
    
    updateSelectedCount();
}

// Toggle select all visible activities
function toggleSelectAll() {
    const checkbox = document.getElementById('selectAllCheckbox');
    const allCheckboxes = document.querySelectorAll('.bulk-checkbox');
    
    if (checkbox.checked) {
        // Select all visible
        allCheckboxes.forEach(cb => {
            const activityId = cb.dataset.activityId;
            selectedActivityIds.add(activityId);
            cb.checked = true;
        });
    } else {
        // Deselect all visible
        allCheckboxes.forEach(cb => {
            const activityId = cb.dataset.activityId;
            selectedActivityIds.delete(activityId);
            cb.checked = false;
        });
    }
    
    updateSelectedCount();
}

// Update selected count display
function updateSelectedCount() {
    const count = selectedActivityIds.size;
    
    const selectedCountEl = document.getElementById('selectedCount');
    const addButtonCountEl = document.getElementById('addButtonCount');
    const addBtn = document.getElementById('bulkAddSelectedBtn');
    
    if (selectedCountEl) selectedCountEl.textContent = `${count} selected`;
    if (addButtonCountEl) addButtonCountEl.textContent = count;
    
    // Update button state
    if (addBtn) {
        if (count === 0) {
            addBtn.disabled = true;
            addBtn.style.opacity = '0.5';
            addBtn.style.cursor = 'not-allowed';
        } else {
            addBtn.disabled = false;
            addBtn.style.opacity = '1';
            addBtn.style.cursor = 'pointer';
        }
    }
}

// Filter bulk activities by search
function filterBulkActivities(searchTerm) {
    renderBulkActivities(searchTerm);
    document.getElementById('selectAllCheckbox').checked = false;
}

// Add selected activities to household
async function addSelectedActivities() {
    if (selectedActivityIds.size === 0) {
        showError('Please select at least one activity');
        return;
    }
    
    try {
        const supabaseClient = window.supabaseUtils.getClient();
        
        // Prepare bulk insert data
        const insertData = Array.from(selectedActivityIds).map(activityId => ({
            user_id: currentUser.id,
            activity_id: activityId
        }));
        
        // Bulk insert
        const { data, error } = await supabaseClient
            .from('household_activities')
            .insert(insertData)
            .select();
        
        if (error) throw error;
        
        showSuccess(`Successfully added ${selectedActivityIds.size} activities!`);
        await loadAllData();
        closeBulkAddModal();
        
    } catch (error) {
        console.error('Error adding activities:', error);
        showError('Failed to add activities: ' + error.message);
    }
}

// Make functions globally available
window.closeBulkAddModal = closeBulkAddModal;
window.toggleSelectAll = toggleSelectAll;
window.addSelectedActivities = addSelectedActivities;

// ====== AI SUGGESTIONS FUNCTIONALITY ======

// Open AI suggestions modal
function openAiSuggestionsModal() {
    const modal = document.getElementById('aiSuggestionsModal');
    if (!modal) {
        showError('AI suggestions modal not found');
        return;
    }

    // Show loading state
    document.getElementById('aiSuggestionsLoading').style.display = 'block';
    document.getElementById('aiSuggestionsError').style.display = 'none';
    document.getElementById('aiSuggestionsList').style.display = 'none';
    document.getElementById('aiSuggestionsFooter').style.display = 'none';

    modal.style.display = 'flex';

    // Fetch suggestions
    fetchAiSuggestions();
}

// Close AI suggestions modal
function closeAiSuggestionsModal() {
    const modal = document.getElementById('aiSuggestionsModal');
    if (modal) {
        modal.style.display = 'none';
    }
}

// Fetch AI suggestions from the Netlify function
async function fetchAiSuggestions() {
    // Show loading state
    document.getElementById('aiSuggestionsLoading').style.display = 'block';
    document.getElementById('aiSuggestionsError').style.display = 'none';
    document.getElementById('aiSuggestionsList').style.display = 'none';
    document.getElementById('aiSuggestionsFooter').style.display = 'none';

    try {
        // Gather preference data
        const requestData = gatherPreferenceDataForAI();
        console.log('Sending AI request with data:', requestData);

        // Call the Netlify function
        const response = await fetch('/.netlify/functions/suggest-activities', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestData)
        });

        console.log('Response status:', response.status);

        // Check if response is ok
        if (!response.ok) {
            const errorText = await response.text();
            console.error('Response error:', errorText);
            throw new Error(`Server error (${response.status}): ${errorText.substring(0, 100)}`);
        }

        // Try to parse JSON
        let data;
        try {
            const responseText = await response.text();
            console.log('Response text:', responseText.substring(0, 200));
            data = JSON.parse(responseText);
        } catch (parseError) {
            console.error('JSON parse error:', parseError);
            throw new Error('Invalid response from server. Please try again.');
        }

        if (!data.success) {
            throw new Error(data.message || data.error || 'Failed to generate suggestions');
        }

        // Render suggestions
        renderAiSuggestions(data.suggestions);

    } catch (error) {
        console.error('Error fetching AI suggestions:', error);
        showAiError(error.message || 'Unable to generate suggestions');
    }
}

// Gather preference data to send to the AI
function gatherPreferenceDataForAI() {
    // Get current household activities with their names and categories
    const householdActivityList = householdActivities.map(ha => {
        const activity = ha.kid_activities;
        const category = categories.find(c => c.id === activity.category_id);
        return {
            name: activity.name,
            category: category ? category.name : 'Unknown',
            description: activity.description || ''
        };
    });

    // Get caregiver preferences grouped by level
    const caregiverPrefs = {
        drop_anything: [],
        sometimes: [],
        on_your_own: []
    };

    preferences.forEach(pref => {
        const householdActivity = householdActivities.find(ha => ha.id === pref.household_activity_id);
        if (!householdActivity) return;

        const activityName = householdActivity.kid_activities.name;

        if (pref.caregiver1_preference === 'drop_anything' || pref.caregiver2_preference === 'drop_anything') {
            if (!caregiverPrefs.drop_anything.includes(activityName)) {
                caregiverPrefs.drop_anything.push(activityName);
            }
        }
        if (pref.caregiver1_preference === 'sometimes' || pref.caregiver2_preference === 'sometimes') {
            if (!caregiverPrefs.sometimes.includes(activityName)) {
                caregiverPrefs.sometimes.push(activityName);
            }
        }
        if (pref.caregiver1_preference === 'on_your_own' || pref.caregiver2_preference === 'on_your_own') {
            if (!caregiverPrefs.on_your_own.includes(activityName)) {
                caregiverPrefs.on_your_own.push(activityName);
            }
        }
    });

    // Get kid preferences grouped by kid and level
    const kidPrefs = {};

    kids.forEach(kid => {
        kidPrefs[kid.name] = {
            loves: [],
            likes: [],
            neutral: [],
            refuses: []
        };

        kidPreferences.filter(kp => kp.kid_id === kid.id).forEach(kp => {
            const householdActivity = householdActivities.find(ha => ha.activity_id === kp.activity_id);
            if (!householdActivity) return;

            const activityName = householdActivity.kid_activities.name;

            switch (kp.preference_level) {
                case 'loves':
                    kidPrefs[kid.name].loves.push(activityName);
                    break;
                case 'likes':
                    kidPrefs[kid.name].likes.push(activityName);
                    break;
                case 'neutral':
                    kidPrefs[kid.name].neutral.push(activityName);
                    break;
                case 'refuses':
                    kidPrefs[kid.name].refuses.push(activityName);
                    break;
            }
        });
    });

    // Get categories for the AI to choose from
    const categoryList = categories.map(c => ({
        id: c.id,
        name: c.name,
        icon: c.icon
    }));

    return {
        householdActivities: householdActivityList,
        preferences: caregiverPrefs,
        kidPreferences: kidPrefs,
        categories: categoryList
    };
}

// Show error state in the AI modal
function showAiError(message) {
    document.getElementById('aiSuggestionsLoading').style.display = 'none';
    document.getElementById('aiSuggestionsList').style.display = 'none';
    document.getElementById('aiSuggestionsFooter').style.display = 'none';

    const errorDiv = document.getElementById('aiSuggestionsError');
    const errorMessage = document.getElementById('aiErrorMessage');

    if (message.includes('not configured')) {
        document.getElementById('aiErrorTitle').textContent = 'AI Not Configured';
        errorMessage.textContent = 'The AI service is not set up. Please ask your administrator to configure the OPENAI_API_KEY.';
    } else if (message.includes('Rate limit')) {
        document.getElementById('aiErrorTitle').textContent = 'Too Many Requests';
        errorMessage.textContent = 'Please wait a moment before trying again.';
    } else {
        document.getElementById('aiErrorTitle').textContent = 'Unable to Generate Suggestions';
        errorMessage.textContent = message;
    }

    errorDiv.style.display = 'block';
}

// Render AI suggestions in the modal
function renderAiSuggestions(suggestions) {
    document.getElementById('aiSuggestionsLoading').style.display = 'none';
    document.getElementById('aiSuggestionsError').style.display = 'none';

    const container = document.getElementById('suggestionsContainer');
    container.innerHTML = '';

    if (!suggestions || suggestions.length === 0) {
        container.innerHTML = `
            <div style="text-align: center; padding: 40px; color: #666;">
                <div style="font-size: 32px; margin-bottom: 10px;">🤷</div>
                <p>No suggestions available right now. Try adding more activities and preferences first!</p>
            </div>
        `;
        document.getElementById('aiSuggestionsList').style.display = 'block';
        document.getElementById('aiSuggestionsFooter').style.display = 'block';
        return;
    }

    suggestions.forEach((suggestion, index) => {
        const category = categories.find(c => c.name === suggestion.category);
        const categoryIcon = category ? category.icon : '📌';

        const card = document.createElement('div');
        card.className = 'suggestion-card';
        card.id = `suggestion-${index}`;
        card.innerHTML = `
            <div class="suggestion-header">
                <span class="suggestion-category">${categoryIcon} ${suggestion.category}</span>
                <button class="suggestion-add-btn" onclick="addSuggestedActivity(${index})">
                    ➕ Add
                </button>
            </div>
            <div class="suggestion-name">${suggestion.name}</div>
            <div class="suggestion-description">${suggestion.description}</div>
            <div class="suggestion-reasoning">💡 ${suggestion.reasoning}</div>
        `;

        container.appendChild(card);
    });

    // Store suggestions for later use when adding
    window.currentAiSuggestions = suggestions;

    document.getElementById('aiSuggestionsList').style.display = 'block';
    document.getElementById('aiSuggestionsFooter').style.display = 'block';
}

// Add a suggested activity to the household
async function addSuggestedActivity(suggestionIndex) {
    const suggestion = window.currentAiSuggestions[suggestionIndex];
    if (!suggestion) {
        showError('Suggestion not found');
        return;
    }

    const card = document.getElementById(`suggestion-${suggestionIndex}`);
    const addBtn = card.querySelector('.suggestion-add-btn');

    // Disable button while processing
    addBtn.disabled = true;
    addBtn.textContent = 'Adding...';

    try {
        const supabaseClient = window.supabaseUtils.getClient();

        // Find the category ID
        const category = categories.find(c => c.name === suggestion.category);
        if (!category) {
            throw new Error('Category not found');
        }

        // Create the activity in kid_activities
        const { data: newActivity, error: activityError } = await supabaseClient
            .from('kid_activities')
            .insert({
                category_id: category.id,
                name: suggestion.name,
                description: suggestion.description
            })
            .select()
            .single();

        if (activityError) throw activityError;

        // Add to household_activities
        const { error: householdError } = await supabaseClient
            .from('household_activities')
            .insert({
                user_id: currentUser.id,
                activity_id: newActivity.id
            });

        if (householdError) throw householdError;

        // Update UI to show success
        const headerDiv = card.querySelector('.suggestion-header');
        headerDiv.innerHTML = `
            <span class="suggestion-category">${category.icon} ${suggestion.category}</span>
            <span class="suggestion-added">✓ Added</span>
        `;

        // Reload the main data to show the new activity
        await loadAllData();

        showSuccess(`"${suggestion.name}" added to your household!`);

    } catch (error) {
        console.error('Error adding suggested activity:', error);
        showError('Failed to add activity: ' + error.message);

        // Re-enable button on error
        addBtn.disabled = false;
        addBtn.textContent = '➕ Add';
    }
}

// Make AI functions globally available
window.openAiSuggestionsModal = openAiSuggestionsModal;
window.closeAiSuggestionsModal = closeAiSuggestionsModal;
window.fetchAiSuggestions = fetchAiSuggestions;
window.addSuggestedActivity = addSuggestedActivity;
