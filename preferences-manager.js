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
    
    const bulkAddBtn = document.getElementById('bulkAddBtn');
    if (bulkAddBtn) {
        bulkAddBtn.addEventListener('click', () => {
            console.log('Bulk Add button clicked');
            openBulkAddModal();
        });
    } else {
        console.error('Bulk Add button not found in DOM');
    }
    
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
                parent_id: currentUser.id,
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
        
        // Create the activity (universal - parent_id is NULL)
        const { data: newActivity, error: activityError } = await supabaseClient
            .from('kid_activities')
            .insert({
                category_id: categoryId,
                name: name,
                description: description || null,
                parent_id: null // Universal activity
            })
            .select()
            .single();
        
        if (activityError) throw activityError;
        
        // Add to household
        const { data: householdActivity, error: householdError } = await supabaseClient
            .from('household_activities')
            .insert({
                parent_id: currentUser.id,
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
    document.getElementById('addActivityForm').reset();
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

let selectedActivityIds = new Set();

// Open bulk add modal
function openBulkAddModal() {
    console.log('openBulkAddModal called');
    console.log('allUniversalActivities:', allUniversalActivities.length);
    console.log('categories:', categories.length);
    
    selectedActivityIds.clear();
    const modal = document.getElementById('bulkAddModal');
    
    if (!modal) {
        console.error('Bulk add modal not found in DOM');
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
    
    // Explicitly set dimensions via JavaScript
    modal.style.display = 'flex';
    modal.style.width = '100vw';
    modal.style.height = '100vh';
    modal.style.position = 'fixed';
    modal.style.top = '0';
    modal.style.left = '0';
    modal.style.right = '0';
    modal.style.bottom = '0';
    
    console.log('Modal opened');
    console.log('Modal display style:', modal.style.display);
    
    const computedStyle = window.getComputedStyle(modal);
    console.log('Modal computed styles:', {
        display: computedStyle.display,
        position: computedStyle.position,
        zIndex: computedStyle.zIndex,
        top: computedStyle.top,
        left: computedStyle.left,
        right: computedStyle.right,
        bottom: computedStyle.bottom,
        width: computedStyle.width,
        height: computedStyle.height,
        opacity: computedStyle.opacity,
        visibility: computedStyle.visibility,
        background: computedStyle.background
    });
    
    const rect = modal.getBoundingClientRect();
    console.log('Modal bounding rect:', {
        top: rect.top,
        left: rect.left,
        width: rect.width,
        height: rect.height,
        right: rect.right,
        bottom: rect.bottom
    });
    
    // Check modal-content child
    const modalContent = modal.querySelector('.modal-content');
    if (modalContent) {
        const contentRect = modalContent.getBoundingClientRect();
        const contentStyles = window.getComputedStyle(modalContent);
        console.log('Modal-content bounding rect:', {
            top: contentRect.top,
            left: contentRect.left,
            width: contentRect.width,
            height: contentRect.height
        });
        console.log('Modal-content display:', contentStyles.display);
        console.log('Modal-content visibility:', contentStyles.visibility);
    }
    
    // Check if modal has any children
    console.log('Modal children count:', modal.children.length);
    console.log('Modal innerHTML length:', modal.innerHTML.length);
    
    // Check modal's parent and its computed styles
    console.log('Modal parent element:', modal.parentElement);
    console.log('Modal parent tag:', modal.parentElement?.tagName);
    if (modal.parentElement) {
        const parentStyles = window.getComputedStyle(modal.parentElement);
        const parentRect = modal.parentElement.getBoundingClientRect();
        console.log('Parent display:', parentStyles.display);
        console.log('Parent dimensions:', {
            width: parentRect.width,
            height: parentRect.height
        });
    }
    
    // Try to manually trigger a reflow
    modal.style.display = 'none';
    modal.offsetHeight; // Force reflow
    modal.style.display = 'flex';
    
    const rectAfterReflow = modal.getBoundingClientRect();
    console.log('Modal rect after reflow:', {
        width: rectAfterReflow.width,
        height: rectAfterReflow.height
    });
    
    console.log('Modal element:', modal);
}

// Close bulk add modal
function closeBulkAddModal() {
    document.getElementById('bulkAddModal').style.display = 'none';
    selectedActivityIds.clear();
}

// Render bulk activities with checkboxes
function renderBulkActivities(searchTerm = '') {
    console.log('renderBulkActivities called with searchTerm:', searchTerm);
    
    const container = document.getElementById('bulkActivitiesContainer');
    const noActivitiesDiv = document.getElementById('bulkNoActivitiesFound');
    
    if (!container || !noActivitiesDiv) {
        console.error('Required DOM elements not found');
        return;
    }
    
    container.innerHTML = '';
    
    // Get activities not already in household
    const householdActivityIds = householdActivities.map(ha => ha.kid_activities.id);
    let availableActivities = allUniversalActivities.filter(a => !householdActivityIds.includes(a.id));
    
    console.log('Available activities:', availableActivities.length);
    
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
    console.log('updateSelectedCount called, count:', count);
    
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
            parent_id: currentUser.id,
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
