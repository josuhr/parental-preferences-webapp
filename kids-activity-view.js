// Kids Activity View JavaScript
// Shows which caregivers prefer which activities

let currentUser = null;
let userSettings = null;
let categories = [];
let householdActivities = [];
let preferences = [];
let currentView = 'grid';
let currentFilter = 'all';
let groupByMode = 'category'; // 'category' or 'rating'

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
    
    document.getElementById('groupByMode').addEventListener('change', (e) => {
        groupByMode = e.target.value;
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
    
    if (groupByMode === 'category') {
        renderByCategory(container);
    } else {
        renderByRating(container);
    }
}

// Render activities grouped by category
function renderByCategory(container) {
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

// Render activities grouped by caregiver rating
function renderByRating(container) {
    const ratingLevels = [
        { value: 'drop_anything', label: 'Drop Anything', icon: '🔥' },
        { value: 'sometimes', label: 'Sometimes', icon: '👌' },
        { value: 'on_your_own', label: 'On Your Own', icon: '🆗' }
    ];
    
    ratingLevels.forEach(rating => {
        // Group activities by this rating level
        const activitiesByRating = {};
        
        householdActivities.forEach(ha => {
            const activity = ha.kid_activities;
            const preference = preferences.find(p => p.household_activity_id === ha.id);
            
            if (shouldShowActivity(preference)) {
                // Check if any caregiver has this rating
                let hasRating = false;
                if (currentFilter === 'all') {
                    hasRating = preference?.caregiver1_preference === rating.value ||
                               preference?.caregiver2_preference === rating.value;
                } else {
                    const prefLevel = preference?.[`${currentFilter}_preference`];
                    hasRating = prefLevel === rating.value;
                }
                
                if (hasRating) {
                    const categoryId = activity.category_id;
                    if (!activitiesByRating[categoryId]) {
                        activitiesByRating[categoryId] = [];
                    }
                    activitiesByRating[categoryId].push({
                        household_id: ha.id,
                        activity: activity,
                        preference: preference
                    });
                }
            }
        });
        
        // Count total activities at this rating
        const totalCount = Object.values(activitiesByRating).reduce((sum, arr) => sum + arr.length, 0);
        
        if (totalCount > 0) {
            // Create rating section
            const ratingSection = document.createElement('div');
            ratingSection.className = 'category-section';
            ratingSection.style.marginBottom = '30px';
            
            const ratingHeader = document.createElement('div');
            ratingHeader.className = 'category-title';
            ratingHeader.style.background = '#667eea';
            ratingHeader.style.color = 'white';
            ratingHeader.style.padding = '15px 20px';
            ratingHeader.style.borderRadius = '8px';
            ratingHeader.style.marginBottom = '15px';
            ratingHeader.innerHTML = `
                <span style="font-size: 1.5rem;">${rating.icon}</span>
                <span style="font-weight: 600; margin-left: 10px;">${rating.label}</span>
                <span style="font-size: 13px; opacity: 0.9; margin-left: 10px;">(${totalCount} activities)</span>
            `;
            
            ratingSection.appendChild(ratingHeader);
            
            // Render categories within this rating
            categories.forEach(category => {
                const categoryActivities = activitiesByRating[category.id] || [];
                if (categoryActivities.length > 0) {
                    const categorySubsection = document.createElement('div');
                    categorySubsection.style.marginBottom = '20px';
                    categorySubsection.style.marginLeft = '20px';
                    
                    const categoryHeader = document.createElement('div');
                    categoryHeader.style.cssText = 'font-weight: 600; color: #333; margin-bottom: 10px; display: flex; align-items: center; gap: 8px;';
                    categoryHeader.innerHTML = `
                        <span>${category.icon}</span>
                        <span>${category.name}</span>
                        <span style="font-size: 13px; color: #888;">(${categoryActivities.length})</span>
                    `;
                    
                    const contentDiv = document.createElement('div');
                    contentDiv.id = `rating-${rating.value}-category-${category.id}`;
                    
                    if (currentView === 'grid') {
                        contentDiv.className = 'activities-grid';
                        categoryActivities.forEach(item => {
                            contentDiv.appendChild(createActivityCard(item.activity, item.preference));
                        });
                    } else {
                        contentDiv.appendChild(createActivityTable(categoryActivities));
                    }
                    
                    categorySubsection.appendChild(categoryHeader);
                    categorySubsection.appendChild(contentDiv);
                    ratingSection.appendChild(categorySubsection);
                }
            });
            
            container.appendChild(ratingSection);
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
        caregiver2: preference?.caregiver2_preference
    };
    
    let prefsHTML = '';
    if (currentFilter === 'all') {
        // Check if both caregivers agree
        const bothAgree = prefs.caregiver1 && prefs.caregiver2 && prefs.caregiver1 === prefs.caregiver2;
        
        if (bothAgree) {
            // Only show "Both" when they agree
            prefsHTML = `
                <div class="activity-card-prefs">
                    ${createPrefRow(bothLabel, prefs.caregiver1)}
                </div>
            `;
        } else {
            // Show individual preferences when they differ or one is missing
            prefsHTML = `
                <div class="activity-card-prefs">
                    ${createPrefRow(caregiver1Label, prefs.caregiver1)}
                    ${createPrefRow(caregiver2Label, prefs.caregiver2)}
                </div>
            `;
        }
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
                <th style="text-align: left; width: 60%;">Activity</th>
    `;
    
    if (currentFilter === 'all') {
        // Check if we need to show "Both" column or individual columns
        // We'll determine this per row, but for headers we show individual
        thead += `
                <th style="text-align: center; width: 20%;">${caregiver1Label}</th>
                <th style="text-align: center; width: 20%;">${caregiver2Label}</th>
        `;
    } else {
        const label = currentFilter === 'caregiver1' ? caregiver1Label :
                     currentFilter === 'caregiver2' ? caregiver2Label : bothLabel;
        thead += `<th style="text-align: center;">${label}</th>`;
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
                <td style="width: 60%;">
                    <div class="activity-name-cell">${activity.name}</div>
                    ${activity.description ? `<div class="activity-description-cell">${activity.description}</div>` : ''}
                </td>
        `;
        
        if (currentFilter === 'all') {
            const pref1 = preference?.caregiver1_preference;
            const pref2 = preference?.caregiver2_preference;
            const bothAgree = pref1 && pref2 && pref1 === pref2;
            
            if (bothAgree) {
                // Show "Both" in colspan when they agree
                tbody += `
                    <td colspan="2" class="pref-cell" style="text-align: center; background: #f0f8ff;">
                        <strong>${bothLabel}:</strong> ${getPreferenceEmoji(pref1)} ${getPreferenceText(pref1)}
                    </td>
                `;
            } else {
                // Show individual preferences when they differ
                tbody += `
                    <td class="pref-cell" style="text-align: center; width: 20%;">${getPreferenceEmoji(pref1)}</td>
                    <td class="pref-cell" style="text-align: center; width: 20%;">${getPreferenceEmoji(pref2)}</td>
                `;
            }
        } else {
            const pref = preference?.[`${currentFilter}_preference`];
            tbody += `<td class="pref-cell" style="text-align: center;">${getPreferenceEmoji(pref)}</td>`;
        }
        
        tbody += '</tr>';
    });
    tbody += '</tbody>';
    
    table.innerHTML = thead + tbody;
    return table;
}

// Get preference emoji (matching Activity Preferences page)
function getPreferenceEmoji(preference) {
    switch (preference) {
        case 'drop_anything': return '🔥';
        case 'sometimes': return '👌';
        case 'on_your_own': return '🆗';
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

// Export to PDF (uses browser print dialog)
function exportToPDF() {
    // Save current view settings
    const originalTitle = document.title;
    
    // Update title for PDF
    const caregiver1Label = userSettings?.caregiver1_label || 'Caregiver 1';
    const caregiver2Label = userSettings?.caregiver2_label || 'Caregiver 2';
    const dateStr = new Date().toLocaleDateString();
    document.title = `Family Activity Preferences - ${dateStr}`;
    
    // Add print-friendly header
    const printHeader = document.createElement('div');
    printHeader.id = 'printHeader';
    printHeader.style.display = 'none';
    printHeader.innerHTML = `
        <div style="text-align: center; margin-bottom: 20px; padding-bottom: 15px; border-bottom: 2px solid #333;">
            <h1 style="margin: 0 0 10px 0; font-size: 24px;">👨‍👩‍👧‍👦 Our Family Activity Preferences</h1>
            <p style="margin: 0; color: #666;">Generated on ${dateStr}</p>
            <p style="margin: 5px 0 0 0; color: #666; font-size: 14px;">
                Caregivers: ${caregiver1Label} & ${caregiver2Label}
            </p>
        </div>
    `;
    
    // Add to page
    const container = document.querySelector('.kids-view-container');
    container.insertBefore(printHeader, container.firstChild);
    
    // Add print styles
    const printStyle = document.createElement('style');
    printStyle.id = 'printStyles';
    printStyle.textContent = `
        @media print {
            #printHeader {
                display: block !important;
            }
        }
    `;
    document.head.appendChild(printStyle);
    
    // Open print dialog
    window.print();
    
    // Clean up after print
    setTimeout(() => {
        document.title = originalTitle;
        printHeader.remove();
        printStyle.remove();
    }, 100);
}

// Make functions globally available
window.switchView = switchView;
window.exportToPDF = exportToPDF;
