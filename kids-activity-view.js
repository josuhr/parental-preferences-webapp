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
let activityContexts = {}; // Maps activity_id to array of context info
let currentContextFilter = 'all'; // Current context filter
let isKidViewMode = false; // Toggle between caregiver and kid view
let kidSelections = new Set(); // Activities selected by kid
let activityIllustrations = {}; // Cache for activity illustrations

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

        // Load activity contexts for filtering
        const activityIds = householdActivities.map(ha => ha.activity_id);
        if (activityIds.length > 0) {
            const { data: contextData, error: contextError } = await supabaseClient
                .from('activity_contexts')
                .select(`
                    activity_id,
                    recommendation_contexts (
                        id,
                        name,
                        context_type,
                        attributes
                    )
                `)
                .in('activity_id', activityIds);

            if (!contextError && contextData) {
                // Organize contexts by activity ID
                activityContexts = {};
                contextData.forEach(ac => {
                    if (!activityContexts[ac.activity_id]) {
                        activityContexts[ac.activity_id] = [];
                    }
                    if (ac.recommendation_contexts) {
                        activityContexts[ac.activity_id].push(ac.recommendation_contexts);
                    }
                });
            }
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
    const caregiver1Emoji = userSettings?.caregiver1_emoji || '💗';
    const caregiver2Label = userSettings?.caregiver2_label || 'Caregiver 2';
    const caregiver2Emoji = userSettings?.caregiver2_emoji || '💙';
    const bothLabel = userSettings?.both_label || 'Both';
    
    const filter = document.getElementById('caregiverFilter');
    filter.options[1].text = `${caregiver1Emoji} ${caregiver1Label}`;
    filter.options[2].text = `${caregiver2Emoji} ${caregiver2Label}`;
    filter.options[3].text = bothLabel;
}

// Filter by context
function filterByContext(context) {
    currentContextFilter = context;

    // Update button states
    document.querySelectorAll('.context-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.context === context);
    });

    renderActivities();
}

// Check if activity matches current context filter
function activityMatchesContext(activityId) {
    if (currentContextFilter === 'all') return true;

    const contexts = activityContexts[activityId] || [];
    if (contexts.length === 0) return false;

    // Check each context for a match
    return contexts.some(ctx => {
        const attrs = ctx.attributes || {};
        const name = (ctx.name || '').toLowerCase();
        const contextType = ctx.context_type || '';

        switch (currentContextFilter) {
            case 'indoor':
                return attrs.location === 'indoor' || name.includes('indoor');
            case 'outdoor':
                return attrs.location === 'outdoor' || name.includes('outdoor');
            case 'high':
                return attrs.energy === 'high' || name.includes('high energy') || name.includes('active');
            case 'low':
                return attrs.energy === 'low' || name.includes('quiet') || name.includes('calm') || name.includes('low energy');
            default:
                return true;
        }
    });
}

// Make filter function globally available
window.filterByContext = filterByContext;

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

        // Apply filter (caregiver + context)
        const preference = preferences.find(p => p.household_activity_id === ha.id);
        if (shouldShowActivity(preference, activity.id)) {
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
        { value: 'on_your_own', label: 'On Your Own', icon: '👋' }
    ];
    
    ratingLevels.forEach(rating => {
        // Group activities by this rating level
        const activitiesByRating = {};
        
        householdActivities.forEach(ha => {
            const activity = ha.kid_activities;
            const preference = preferences.find(p => p.household_activity_id === ha.id);

            if (shouldShowActivity(preference, activity.id)) {
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

// Check if activity should be shown based on caregiver filter and context filter
function shouldShowActivity(preference, activityId) {
    // Check context filter first
    if (!activityMatchesContext(activityId)) return false;

    // Then check caregiver filter
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
    const caregiver1Emoji = userSettings?.caregiver1_emoji || '💗';
    const caregiver2Label = userSettings?.caregiver2_label || 'Caregiver 2';
    const caregiver2Emoji = userSettings?.caregiver2_emoji || '💙';
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
            // Show single "Both" column when they agree
            prefsHTML = `
                <div class="activity-card-prefs">
                    ${createPrefColumn(bothLabel, prefs.caregiver1, true)}
                </div>
            `;
        } else {
            // Show side-by-side columns when preferences differ
            prefsHTML = `
                <div class="activity-card-prefs">
                    ${createPrefColumn(`${caregiver1Emoji} ${caregiver1Label}`, prefs.caregiver1)}
                    ${createPrefColumn(`${caregiver2Emoji} ${caregiver2Label}`, prefs.caregiver2)}
                </div>
            `;
        }
    } else {
        const emoji = currentFilter === 'caregiver1' ? caregiver1Emoji :
                     currentFilter === 'caregiver2' ? caregiver2Emoji : '';
        const label = currentFilter === 'caregiver1' ? caregiver1Label :
                     currentFilter === 'caregiver2' ? caregiver2Label : bothLabel;
        const displayLabel = emoji ? `${emoji} ${label}` : label;
        prefsHTML = `
            <div class="activity-card-prefs">
                <div class="pref-single">
                    <span class="pref-emoji">${getPreferenceEmoji(prefs[currentFilter])}</span>
                    <span class="pref-text">${getPreferenceText(prefs[currentFilter])}</span>
                </div>
            </div>
        `;
    }

    card.innerHTML = `
        <div class="activity-card-title">${activity.name}</div>
        ${prefsHTML}
    `;

    return card;
}

// Create preference column for card (vertical layout: label above, emoji/text below)
function createPrefColumn(label, preference, isBothAgree = false) {
    const emoji = getPreferenceEmoji(preference);
    const text = getPreferenceText(preference);
    const extraClass = isBothAgree ? 'both-agree' : '';

    return `
        <div class="pref-column ${extraClass}">
            <span class="pref-label">${label}</span>
            <span class="pref-emoji">${emoji}</span>
            <span class="pref-text">${text}</span>
        </div>
    `;
}

// Create activity table (table view)
function createActivityTable(categoryActivities) {
    const table = document.createElement('table');
    table.className = 'activities-table';
    
    const caregiver1Label = userSettings?.caregiver1_label || 'Caregiver 1';
    const caregiver1Emoji = userSettings?.caregiver1_emoji || '💗';
    const caregiver2Label = userSettings?.caregiver2_label || 'Caregiver 2';
    const caregiver2Emoji = userSettings?.caregiver2_emoji || '💙';
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
                <th style="text-align: center; width: 20%;">${caregiver1Emoji} ${caregiver1Label}</th>
                <th style="text-align: center; width: 20%;">${caregiver2Emoji} ${caregiver2Label}</th>
        `;
    } else {
        const emoji = currentFilter === 'caregiver1' ? caregiver1Emoji :
                     currentFilter === 'caregiver2' ? caregiver2Emoji : '';
        const label = currentFilter === 'caregiver1' ? caregiver1Label :
                     currentFilter === 'caregiver2' ? caregiver2Label : bothLabel;
        const displayLabel = emoji ? `${emoji} ${label}` : label;
        thead += `<th style="text-align: center;">${displayLabel}</th>`;
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
        case 'on_your_own': return '👋';
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

// Export to PDF (uses browser print dialog) - Fridge-worthy handout design
function exportToPDF() {
    // Save current view settings
    const originalTitle = document.title;
    const originalView = currentView;
    const originalFilter = currentFilter;

    // Force table view and show all for printing
    currentView = 'table';
    currentFilter = 'all';
    renderActivities();

    // Get caregiver labels
    const caregiver1Label = userSettings?.caregiver1_label || 'Caregiver 1';
    const caregiver1Emoji = userSettings?.caregiver1_emoji || '💗';
    const caregiver2Label = userSettings?.caregiver2_label || 'Caregiver 2';
    const caregiver2Emoji = userSettings?.caregiver2_emoji || '💙';
    const dateStr = new Date().toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });

    // Update document title for PDF filename
    document.title = `Family Activity Preferences - ${new Date().toLocaleDateString()}`;

    const container = document.querySelector('.kids-view-container');

    // Create colorful print header
    const printHeader = document.createElement('div');
    printHeader.className = 'print-header';
    printHeader.innerHTML = `
        <h1>🏠 What We Like!</h1>
        <div class="subtitle">
            ${caregiver1Emoji} ${caregiver1Label} & ${caregiver2Emoji} ${caregiver2Label}
        </div>
    `;

    // Create legend explaining the emojis
    const printLegend = document.createElement('div');
    printLegend.className = 'print-legend';
    printLegend.innerHTML = `
        <div class="print-legend-item">
            <span class="print-legend-emoji">🔥</span>
            <span class="print-legend-text">Drop Anything!</span>
        </div>
        <div class="print-legend-item">
            <span class="print-legend-emoji">👌</span>
            <span class="print-legend-text">Sometimes</span>
        </div>
        <div class="print-legend-item">
            <span class="print-legend-emoji">👋</span>
            <span class="print-legend-text">On Your Own</span>
        </div>
    `;

    // Create footer
    const printFooter = document.createElement('div');
    printFooter.className = 'print-footer';
    printFooter.innerHTML = `
        <div class="print-footer-logo">HomeBase</div>
        <div>Updated ${dateStr}</div>
    `;

    // Add elements to page
    container.insertBefore(printHeader, container.firstChild);
    container.insertBefore(printLegend, printHeader.nextSibling);
    container.appendChild(printFooter);

    // Open print dialog
    window.print();

    // Clean up after print and restore view
    setTimeout(() => {
        document.title = originalTitle;
        printHeader.remove();
        printLegend.remove();
        printFooter.remove();

        // Restore original view and filter
        currentView = originalView;
        currentFilter = originalFilter;
        renderActivities();
    }, 100);
}

// Make functions globally available
window.switchView = switchView;
window.exportToPDF = exportToPDF;

// ===== KID VIEW FUNCTIONALITY =====

// Toggle between caregiver and kid view
function toggleViewMode() {
    isKidViewMode = !isKidViewMode;

    const toggle = document.getElementById('viewModeToggle');
    const caregiverLabel = document.getElementById('caregiverViewLabel');
    const kidLabel = document.getElementById('kidViewLabel');

    if (isKidViewMode) {
        toggle.classList.add('kid-mode');
        caregiverLabel.classList.remove('active');
        kidLabel.classList.add('active');
        document.body.classList.add('kid-view-active');
        renderKidView();
    } else {
        toggle.classList.remove('kid-mode');
        caregiverLabel.classList.add('active');
        kidLabel.classList.remove('active');
        document.body.classList.remove('kid-view-active');
        document.getElementById('kidSelectionsBar').classList.remove('visible');
    }
}

// Render the kid-friendly view
function renderKidView() {
    const grid = document.getElementById('kidActivitiesGrid');
    if (!grid) return;

    grid.innerHTML = '';

    // Get all activities, applying context filter
    const activitiesToShow = householdActivities.filter(ha => {
        const activity = ha.kid_activities;
        return activityMatchesContext(activity.id);
    });

    if (activitiesToShow.length === 0) {
        grid.innerHTML = `
            <div style="grid-column: 1/-1; text-align: center; padding: 40px; color: #666;">
                <div style="font-size: 48px; margin-bottom: 16px;">🔍</div>
                <p>No activities found for this filter.</p>
            </div>
        `;
        return;
    }

    // Render each activity as a kid-friendly card
    activitiesToShow.forEach(ha => {
        const activity = ha.kid_activities;
        const preference = preferences.find(p => p.household_activity_id === ha.id);
        const category = categories.find(c => c.id === activity.category_id);

        const card = createKidActivityCard(activity, preference, category, ha.id);
        grid.appendChild(card);
    });

    updateSelectionsBar();
}

// Create a kid-friendly activity card
function createKidActivityCard(activity, preference, category, householdId) {
    const card = document.createElement('div');
    card.className = 'kid-activity-card';
    card.dataset.activityId = activity.id;
    card.dataset.householdId = householdId;

    if (kidSelections.has(activity.id)) {
        card.classList.add('selected');
    }

    // Get caregiver info
    const caregiver1Label = userSettings?.caregiver1_label || 'Mom';
    const caregiver1Emoji = userSettings?.caregiver1_emoji || '💗';
    const caregiver2Label = userSettings?.caregiver2_label || 'Dad';
    const caregiver2Emoji = userSettings?.caregiver2_emoji || '💙';

    const pref1 = preference?.caregiver1_preference;
    const pref2 = preference?.caregiver2_preference;

    // Build caregiver badges HTML
    let caregiversHTML = '';
    if (pref1 || pref2) {
        caregiversHTML = '<div class="kid-card-caregivers">';
        if (pref1) {
            const isLoves = pref1 === 'drop_anything';
            caregiversHTML += `
                <div class="kid-caregiver-badge ${isLoves ? 'loves' : ''}">
                    <span class="emoji">${getPreferenceEmoji(pref1)}</span>
                    <span class="name">${caregiver1Label}</span>
                </div>
            `;
        }
        if (pref2) {
            const isLoves = pref2 === 'drop_anything';
            caregiversHTML += `
                <div class="kid-caregiver-badge ${isLoves ? 'loves' : ''}">
                    <span class="emoji">${getPreferenceEmoji(pref2)}</span>
                    <span class="name">${caregiver2Label}</span>
                </div>
            `;
        }
        caregiversHTML += '</div>';
    }

    // Check for cached illustration
    const illustrationUrl = activity.illustration_url || activityIllustrations[activity.id];
    const categoryIcon = category?.icon || '🎯';

    let imageHTML;
    if (illustrationUrl) {
        imageHTML = `<img src="${illustrationUrl}" alt="${activity.name}" onerror="this.parentElement.innerHTML='${categoryIcon}'">`;
    } else {
        imageHTML = categoryIcon;
    }

    card.innerHTML = `
        <div class="kid-card-image" id="img-${activity.id}">
            ${imageHTML}
        </div>
        <div class="kid-card-name">${activity.name}</div>
        ${caregiversHTML}
    `;

    // Add click handler for selection
    card.addEventListener('click', () => {
        toggleKidSelection(activity.id, card);
    });

    // Optionally load illustration if not cached
    if (!illustrationUrl && !activityIllustrations[activity.id]) {
        // We could auto-generate here, but let's make it opt-in to control costs
        // loadActivityIllustration(activity.id, activity.name, category?.name);
    }

    return card;
}

// Toggle kid's activity selection
function toggleKidSelection(activityId, cardElement) {
    if (kidSelections.has(activityId)) {
        kidSelections.delete(activityId);
        cardElement.classList.remove('selected');
    } else {
        kidSelections.add(activityId);
        cardElement.classList.add('selected');
        // Add a little bounce animation
        cardElement.style.transform = 'scale(1.1)';
        setTimeout(() => {
            cardElement.style.transform = '';
        }, 150);
    }

    updateSelectionsBar();
    saveKidSelections();
}

// Update the selections bar at the bottom
function updateSelectionsBar() {
    const bar = document.getElementById('kidSelectionsBar');
    const countEl = document.getElementById('selectionsCount');

    if (kidSelections.size > 0) {
        bar.classList.add('visible');
        countEl.textContent = kidSelections.size;
    } else {
        bar.classList.remove('visible');
    }
}

// Clear all kid selections
function clearKidSelections() {
    kidSelections.clear();

    // Remove selected class from all cards
    document.querySelectorAll('.kid-activity-card.selected').forEach(card => {
        card.classList.remove('selected');
    });

    updateSelectionsBar();
    saveKidSelections();
}

// Save kid selections to localStorage (could also save to database)
function saveKidSelections() {
    const selectionsArray = Array.from(kidSelections);
    localStorage.setItem('kidActivitySelections', JSON.stringify(selectionsArray));
}

// Load kid selections from localStorage
function loadKidSelections() {
    try {
        const saved = localStorage.getItem('kidActivitySelections');
        if (saved) {
            const selectionsArray = JSON.parse(saved);
            kidSelections = new Set(selectionsArray);
        }
    } catch (e) {
        console.error('Error loading kid selections:', e);
    }
}

// Load activity illustration from AI (called on-demand)
async function loadActivityIllustration(activityId, activityName, categoryName) {
    const imageContainer = document.getElementById(`img-${activityId}`);
    if (!imageContainer) return;

    // Show loading state
    imageContainer.classList.add('loading');

    try {
        const response = await fetch('/.netlify/functions/generate-activity-image', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                activityId,
                activityName,
                categoryName
            })
        });

        if (!response.ok) {
            throw new Error('Failed to generate image');
        }

        const data = await response.json();
        if (data.success && data.imageUrl) {
            // Cache the URL
            activityIllustrations[activityId] = data.imageUrl;

            // Update the image
            imageContainer.innerHTML = `<img src="${data.imageUrl}" alt="${activityName}">`;
        }
    } catch (error) {
        console.error('Error loading illustration:', error);
    } finally {
        imageContainer.classList.remove('loading');
    }
}

// Initialize kid view on page load
function initKidView() {
    loadKidSelections();
}

// Call init when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initKidView);
} else {
    initKidView();
}

// Make kid view functions globally available
window.toggleViewMode = toggleViewMode;
window.clearKidSelections = clearKidSelections;
window.loadActivityIllustration = loadActivityIllustration;
