// Kids Activity View JavaScript
// Shows which caregivers prefer which activities

let currentUser = null;
let userSettings = null;
let categories = [];
let householdActivities = [];
let preferences = [];
let currentView = 'grid';
let currentFilter = 'all';

// Initialize
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
        showError('Failed to initialize');
    }
});

// Set up event listeners
function setupEventListeners() {
    document.getElementById('caregiverFilter').addEventListener('change', (e) => {
        currentFilter = e.target.value;
        renderActivities();
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
        
        // Load household activities for current user
        const { data: householdData, error: householdError } = await supabaseClient
            .from('household_activities')
            .select(`
                id,
                activity_id,
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
        
        // Load preferences
        const householdActivityIds = householdActivities.map(ha => ha.id);
        if (householdActivityIds.length > 0) {
            const { data: prefsData, error: prefsError } = await supabaseClient
                .from('household_activity_preferences')
                .select('*')
                .in('household_activity_id', householdActivityIds);
            
            if (prefsError) throw prefsError;
            preferences = prefsData || [];
        }
        
        updateCaregiverLabels();
        renderActivities();
        
    } catch (error) {
        console.error('Error loading data:', error);
        showError('Failed to load activities: ' + error.message);
    } finally {
        showLoading(false);
    }
}

// Update caregiver labels in UI
function updateCaregiverLabels() {
    const caregiver1Label = userSettings?.caregiver1_label || 'Caregiver 1';
    const caregiver2Label = userSettings?.caregiver2_label || 'Caregiver 2';
    const bothLabel = userSettings?.both_label || 'Both';
    
    const filter = document.getElementById('caregiverFilter');
    filter.options[1].text = caregiver1Label;
    filter.options[2].text = caregiver2Label;
    filter.options[3].text = bothLabel;
}

// Switch view
function switchView(view) {
    currentView = view;
    document.querySelectorAll('.view-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.view === view);
    });
    renderActivities();
}

// Render activities
function renderActivities() {
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
        
        // Apply filter
        const preference = preferences.find(p => p.household_activity_id === ha.id);
        if (shouldShowActivity(preference)) {
            if (!activityByCategory[categoryId]) {
                activityByCategory[categoryId] = [];
            }
            activityByCategory[categoryId].push({
                household_id: ha.id,
                activity: activity,
                preference: preference
            });
        }
    });
    
    // Render each category
    categories.forEach(category => {
        const categoryActivities = activityByCategory[category.id] || [];
        if (categoryActivities.length > 0) {
            const categorySection = createCategorySection(category, categoryActivities);
            container.appendChild(categorySection);
        }
    });
}

// Check if activity should be shown based on filter
function shouldShowActivity(preference) {
    if (currentFilter === 'all') return true;
    
    if (!preference) return false;
    
    const prefLevel = preference[`${currentFilter}_preference`];
    return prefLevel !== null && prefLevel !== undefined;
}

// Create category section
function createCategorySection(category, categoryActivities) {
    const section = document.createElement('div');
    section.className = 'category-section';
    
    section.innerHTML = `
        <div class="category-title">
            <span class="category-icon">${category.icon}</span>
            <span>${category.name}</span>
            <span style="font-size: 13px; color: #888; margin-left: 10px;">(${categoryActivities.length} activities)</span>
        </div>
        <div id="category-content-${category.id}"></div>
    `;
    
    const contentDiv = section.querySelector(`#category-content-${category.id}`);
    
    if (currentView === 'grid') {
        contentDiv.className = 'activities-grid';
        categoryActivities.forEach(item => {
            contentDiv.appendChild(createActivityCard(item.activity, item.preference));
        });
    } else {
        contentDiv.appendChild(createActivityTable(categoryActivities));
    }
    
    return section;
}

// Create activity card (grid view)
function createActivityCard(activity, preference) {
    const card = document.createElement('div');
    card.className = 'activity-card';
    
    const caregiver1Label = userSettings?.caregiver1_label || 'Caregiver 1';
    const caregiver2Label = userSettings?.caregiver2_label || 'Caregiver 2';
    const bothLabel = userSettings?.both_label || 'Both';
    
    const prefs = {
        caregiver1: preference?.caregiver1_preference,
        caregiver2: preference?.caregiver2_preference,
        both: preference?.both_preference
    };
    
    let prefsHTML = '';
    if (currentFilter === 'all') {
        prefsHTML = `
            <div class="activity-card-prefs">
                ${createPrefRow(caregiver1Label, prefs.caregiver1)}
                ${createPrefRow(caregiver2Label, prefs.caregiver2)}
                ${createPrefRow(bothLabel, prefs.both)}
            </div>
        `;
    } else {
        const label = currentFilter === 'caregiver1' ? caregiver1Label :
                     currentFilter === 'caregiver2' ? caregiver2Label : bothLabel;
        prefsHTML = `
            <div class="activity-card-prefs">
                ${createPrefRow(label, prefs[currentFilter])}
            </div>
        `;
    }
    
    card.innerHTML = `
        <div class="activity-card-title">${activity.name}</div>
        ${prefsHTML}
    `;
    
    return card;
}

// Create preference row for card
function createPrefRow(label, preference) {
    const emoji = getPreferenceEmoji(preference);
    const text = getPreferenceText(preference);
    
    return `
        <div class="pref-row">
            <span class="pref-label">${label}:</span>
            <span class="pref-value">${emoji} ${text}</span>
        </div>
    `;
}

// Create activity table (table view)
function createActivityTable(categoryActivities) {
    const table = document.createElement('table');
    table.className = 'activities-table';
    
    const caregiver1Label = userSettings?.caregiver1_label || 'Caregiver 1';
    const caregiver2Label = userSettings?.caregiver2_label || 'Caregiver 2';
    const bothLabel = userSettings?.both_label || 'Both';
    
    let thead = `
        <thead>
            <tr>
                <th>Activity</th>
    `;
    
    if (currentFilter === 'all') {
        thead += `
                <th>${caregiver1Label}</th>
                <th>${caregiver2Label}</th>
                <th>${bothLabel}</th>
        `;
    } else {
        const label = currentFilter === 'caregiver1' ? caregiver1Label :
                     currentFilter === 'caregiver2' ? caregiver2Label : bothLabel;
        thead += `<th>${label}</th>`;
    }
    
    thead += `
            </tr>
        </thead>
    `;
    
    let tbody = '<tbody>';
    categoryActivities.forEach(item => {
        const activity = item.activity;
        const preference = item.preference;
        
        tbody += `
            <tr>
                <td>
                    <div class="activity-name-cell">${activity.name}</div>
                    ${activity.description ? `<div class="activity-description-cell">${activity.description}</div>` : ''}
                </td>
        `;
        
        if (currentFilter === 'all') {
            tbody += `
                <td class="pref-cell">${getPreferenceEmoji(preference?.caregiver1_preference)}</td>
                <td class="pref-cell">${getPreferenceEmoji(preference?.caregiver2_preference)}</td>
                <td class="pref-cell">${getPreferenceEmoji(preference?.both_preference)}</td>
            `;
        } else {
            const pref = preference?.[`${currentFilter}_preference`];
            tbody += `<td class="pref-cell">${getPreferenceEmoji(pref)}</td>`;
        }
        
        tbody += '</tr>';
    });
    tbody += '</tbody>';
    
    table.innerHTML = thead + tbody;
    return table;
}

// Get preference emoji
function getPreferenceEmoji(preference) {
    switch (preference) {
        case 'drop_anything': return '💚';
        case 'sometimes': return '💛';
        case 'on_your_own': return '⭐';
        default: return '—';
    }
}

// Get preference text
function getPreferenceText(preference) {
    switch (preference) {
        case 'drop_anything': return 'Drop Anything';
        case 'sometimes': return 'Sometimes';
        case 'on_your_own': return 'On Your Own';
        default: return 'Not set';
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
    }
    console.error(message);
}
