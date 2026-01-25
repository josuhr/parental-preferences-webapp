// Configuration
let SHEET_ID = ''; // Will be loaded from user profile
let currentUser = null;
let userProfile = null;
let userSettings = null;

// Tab names and their corresponding GIDs (sheet IDs)
// To find GIDs: Open each tab, the URL will show #gid=XXXXXX
const CATEGORY_TABS = {
    'Arts & Crafts': '0',         // Usually the first tab is gid=0
    'Experiential': null,          // We'll need to find these
    'Games': null,
    'Movies': null,
    'Music': null,
    'Reading & Ed': null,
    'Video Games': null
};

// Since we don't have GIDs, we'll use the tab name approach
let CATEGORY_TAB_NAMES = [
    'Arts & Crafts',
    'Experiential',
    'Games',
    'Movies',
    'Music',
    'Reading & Ed',
    'Video Games'
];

// Preference level mapping
const PREFERENCE_LEVELS = {
    'Drop Anything': { order: 1, class: 'drop-anything', title: '💚 Drop Anything - Love to do!' },
    'Sometimes': { order: 2, class: 'sometimes', title: '💛 Sometimes - Sounds fun!' },
    'On Your Own': { order: 3, class: 'on-your-own', title: '⭐ On Your Own - You can do this!' }
};

// DOM Elements
const loadingEl = document.getElementById('loading');
const errorEl = document.getElementById('error');
const categoriesEl = document.getElementById('categories');
const refreshBtn = document.getElementById('refreshBtn');
const printBtn = document.getElementById('printBtn');
const helpBtn = document.getElementById('helpBtn');
const helpSection = document.getElementById('help');
const dashboardBtn = document.getElementById('dashboardBtn');
const adminBtn = document.getElementById('adminBtn');
const sourceSheets = document.getElementById('sourceSheets');
const sourceBuiltin = document.getElementById('sourceBuiltin');
const managePrefsBtn = document.getElementById('managePrefsBtn');
const viewByLevel = document.getElementById('viewByLevel');
const viewByWho = document.getElementById('viewByWho');

// Data source state (load from localStorage or default to sheets)
let currentDataSource = localStorage.getItem('preferredDataSource') || 'sheets';

// View mode state (load from localStorage or default to 'level')
let currentViewMode = localStorage.getItem('preferredViewMode') || 'level';

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
    // Initialize Supabase
    const supabase = await window.supabaseUtils.initSupabase();
    
    if (!supabase) {
        showError('Failed to initialize authentication');
        return;
    }
    
    // Check authentication
    currentUser = await window.supabaseUtils.getCurrentUser();
    
    if (!currentUser) {
        // Not logged in, redirect to auth
        window.location.href = '/auth.html';
        return;
    }
    
    // Load user data
    await loadUserData();
    
    // Set up event listeners
    refreshBtn.addEventListener('click', loadData);
    printBtn.addEventListener('click', () => window.print());
    helpBtn.addEventListener('click', () => {
        helpSection.style.display = helpSection.style.display === 'none' ? 'block' : 'none';
    });
    dashboardBtn.addEventListener('click', () => window.location.href = '/dashboard.html');
    adminBtn.addEventListener('click', () => window.location.href = '/admin.html');
    managePrefsBtn.addEventListener('click', () => window.location.href = '/preferences-manager.html');
    
    // Data source switcher
    sourceSheets.addEventListener('change', () => {
        if (sourceSheets.checked) {
            currentDataSource = 'sheets';
            localStorage.setItem('preferredDataSource', 'sheets');
            managePrefsBtn.style.display = 'none';
            loadData();
        }
    });
    
    sourceBuiltin.addEventListener('change', () => {
        if (sourceBuiltin.checked) {
            currentDataSource = 'builtin';
            localStorage.setItem('preferredDataSource', 'builtin');
            managePrefsBtn.style.display = 'inline-block';
            loadData();
        }
    });
    
    // View mode switcher
    viewByLevel.addEventListener('change', () => {
        if (viewByLevel.checked) {
            currentViewMode = 'level';
            localStorage.setItem('preferredViewMode', 'level');
            loadData();
        }
    });
    
    viewByWho.addEventListener('change', () => {
        if (viewByWho.checked) {
            currentViewMode = 'who';
            localStorage.setItem('preferredViewMode', 'who');
            loadData();
        }
    });
    
    // Set initial state from localStorage
    if (currentDataSource === 'builtin') {
        sourceBuiltin.checked = true;
        sourceSheets.checked = false;
        managePrefsBtn.style.display = 'inline-block';
    } else {
        sourceSheets.checked = true;
        sourceBuiltin.checked = false;
        managePrefsBtn.style.display = 'none';
    }
    
    // Set initial view mode from localStorage
    if (currentViewMode === 'who') {
        viewByWho.checked = true;
        viewByLevel.checked = false;
    } else {
        viewByLevel.checked = true;
        viewByWho.checked = false;
    }
    
    // Load activities
    loadData();
});

// Load user data
async function loadUserData() {
    try {
        userProfile = await window.supabaseUtils.getUserProfile(currentUser.id);
        userSettings = await window.supabaseUtils.getUserSettings(currentUser.id);
        
        if (!userProfile) {
            showError('Failed to load user profile');
            return;
        }
        
        // Set sheet ID
        SHEET_ID = userProfile.sheet_id || '';
        
        // Show dashboard button
        dashboardBtn.style.display = 'inline-block';
        
        // Show admin button if user is admin
        if (userProfile.role === 'admin') {
            adminBtn.style.display = 'inline-block';
        }
        
        // Apply user customization
        if (userSettings) {
            applyUserCustomization(userSettings);
        }
        
    } catch (error) {
        console.error('Error loading user data:', error);
        showError('Failed to load user data');
    }
}

// Apply user customization
function applyUserCustomization(settings) {
    // Apply theme color
    if (settings.theme_color) {
        document.documentElement.style.setProperty('--theme-color', settings.theme_color);
    }
    
    // Apply font family
    if (settings.font_family) {
        document.body.style.fontFamily = `${settings.font_family}, sans-serif`;
    }
    
    // Apply custom category tabs if present
    if (settings.category_tabs && Array.isArray(settings.category_tabs)) {
        CATEGORY_TAB_NAMES = settings.category_tabs;
    }
}

// Show/Hide Loading State
function showLoading(show) {
    if (show) {
        loadingEl.classList.add('show');
    } else {
        loadingEl.classList.remove('show');
    }
}

// Show Error
function showError(message) {
    errorEl.textContent = message;
    errorEl.classList.add('show');
    setTimeout(() => {
        errorEl.classList.remove('show');
    }, 5000);
}

// Fetch data from Google Sheets using alternative methods
async function fetchSheetData(tabName) {
    // Method 1: Try gviz API (works if sheet is published)
    try {
        return await fetchViaGviz(tabName);
    } catch (gvizError) {
        console.warn(`gviz method failed for ${tabName}:`, gvizError.message);
        
        // Method 2: Try using published export (requires sheet to be published to web)
        try {
            return await fetchViaPublished(tabName);
        } catch (publishError) {
            console.error(`All methods failed for ${tabName}`);
            throw new Error(`Cannot access sheet "${tabName}". Please ensure the Google Sheet is shared with "Anyone with the link can view"`);
        }
    }
}

// Method 1: Google Visualization API
async function fetchViaGviz(tabName) {
    const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:json&sheet=${encodeURIComponent(tabName)}&headers=1`;
    
    const response = await fetch(url, {
        method: 'GET',
        headers: {
            'Accept': 'application/json, text/javascript, */*',
        }
    });
    
    if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const text = await response.text();
    
    // Parse the response
    const jsonMatch = text.match(/google\.visualization\.Query\.setResponse\(([\s\S]+)\);?\s*$/);
    if (!jsonMatch) {
        throw new Error('Invalid response format');
    }
    
    const data = JSON.parse(jsonMatch[1]);
    
    if (data.status === 'error') {
        throw new Error(data.errors?.[0]?.detailed_message || data.errors?.[0]?.message || 'Unknown API error');
    }
    
    if (!data.table) {
        throw new Error('No data table in response');
    }
    
    return data.table;
}

// Method 2: Published to web CSV (fallback)
async function fetchViaPublished(tabName) {
    // This requires the sheet to be "Published to web"
    // We'll try to get it as CSV and parse it
    const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&sheet=${encodeURIComponent(tabName)}`;
    
    const response = await fetch(url);
    
    if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
    }
    
    const csv = await response.text();
    return parseCSVToTable(csv);
}

// Parse CSV to table format (matching gviz structure)
function parseCSVToTable(csv) {
    const lines = csv.split('\n');
    const rows = lines.map(line => {
        // Simple CSV parser (handles basic cases)
        const cells = parseCSVLine(line);
        return {
            c: cells.map(value => ({ v: value }))
        };
    });
    
    return { rows };
}

// Simple CSV line parser
function parseCSVLine(line) {
    const result = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
        const char = line[i];
        
        if (char === '"') {
            if (inQuotes && line[i + 1] === '"') {
                current += '"';
                i++;
            } else {
                inQuotes = !inQuotes;
            }
        } else if (char === ',' && !inQuotes) {
            result.push(current);
            current = '';
        } else {
            current += char;
        }
    }
    
    result.push(current);
    return result;
}

// Parse sheet rows into activity objects
function parseActivities(table, categoryName) {
    if (!table || !table.rows || table.rows.length === 0) {
        console.warn('No table or rows found');
        return [];
    }
    
    console.log(`Parsing ${categoryName} with ${table.rows.length} rows`);
    
    const activities = [];
    
    // Category tabs have different structure than main sheet:
    // Column A (cells[0]) = Parent emoji (👨, 👩, 👨👩, or empty)
    // Column B (cells[1]) = Activity Name
    // Column C (cells[2]) = Preference Level (Drop Anything, Sometimes, On Your Own)
    
    // Skip header row (index 0)
    for (let i = 1; i < table.rows.length; i++) {
        const row = table.rows[i];
        const cells = row.c;
        
        // Debug: Log first few rows
        if (i <= 3) {
            console.log(`Row ${i}:`, cells);
        }
        
        // Skip empty rows
        if (!cells || cells.length < 2) {
            if (i <= 3) console.warn(`Row ${i} skipped: not enough cells`);
            continue;
        }
        
        // Extract data from category tab structure
        const parent = cells[0]?.v || '';  // Parent emoji
        const activityName = cells[1]?.v || '';  // Activity name
        const preference = cells[2]?.v || '';  // Preference level
        
        if (i <= 3) {
            console.log(`Row ${i} parsed:`, { parent, activityName, preference, category: categoryName });
        }
        
        // Skip rows without activity name
        if (!activityName.trim()) {
            if (i <= 3) console.warn(`Row ${i} skipped: no activity name`);
            continue;
        }
        
        activities.push({
            parent: parent.trim(),
            category: categoryName,  // Use the tab name as category
            name: activityName.trim(),
            preference: preference.trim()
        });
    }
    
    console.log(`Parsed ${activities.length} activities from ${categoryName}`);
    return activities;
}

// Convert parent name/emoji to display info
function getParentInfo(parent) {
    const parentStr = parent.toLowerCase();
    
    // Use custom labels from userSettings if available
    const bothLabel = userSettings?.both_label || 'Both';
    const bothEmoji = userSettings?.both_emoji || '💜';
    const caregiver1Label = userSettings?.caregiver1_label || 'Mom';
    const caregiver1Emoji = userSettings?.caregiver1_emoji || '💗';
    const caregiver2Label = userSettings?.caregiver2_label || 'Dad';
    const caregiver2Emoji = userSettings?.caregiver2_emoji || '💙';
    
    // Check for emoji format first (from the sheet)
    if (parent.includes('👨') && parent.includes('👩')) {
        return {
            emoji: bothEmoji,
            text: bothLabel,
            class: 'both'
        };
    } else if (parent.includes('👩')) {
        return {
            emoji: caregiver1Emoji,
            text: caregiver1Label,
            class: 'mom'
        };
    } else if (parent.includes('👨')) {
        return {
            emoji: caregiver2Emoji,
            text: caregiver2Label,
            class: 'dad'
        };
    }
    
    // Also check for text format (in case it's spelled out)
    if (parentStr.includes('mom') && parentStr.includes('dad')) {
        return {
            emoji: bothEmoji,
            text: bothLabel,
            class: 'both'
        };
    } else if (parentStr.includes('mom')) {
        return {
            emoji: caregiver1Emoji,
            text: caregiver1Label,
            class: 'mom'
        };
    } else if (parentStr.includes('dad')) {
        return {
            emoji: caregiver2Emoji,
            text: caregiver2Label,
            class: 'dad'
        };
    }
    
    // Default to independent
    return {
        emoji: '⭐',
        text: 'On Your Own',
        class: 'independent'
    };
}

// Group activities by preference level
function groupByPreference(activities) {
    const groups = {
        'Drop Anything': [],
        'Sometimes': [],
        'On Your Own': []
    };
    
    activities.forEach(activity => {
        const pref = activity.preference;
        if (groups[pref]) {
            groups[pref].push(activity);
        }
    });
    
    return groups;
}

// Render activity card
function renderActivityCard(activity) {
    const parentInfo = getParentInfo(activity.parent);
    
    const card = document.createElement('div');
    card.className = 'activity-card';
    
    card.innerHTML = `
        <div class="activity-name">${activity.name}</div>
        <div class="parent-info">
            <div class="parent-badge ${parentInfo.class}">
                <span class="parent-emoji">${parentInfo.emoji}</span>
                <span>${parentInfo.text}</span>
            </div>
        </div>
    `;
    
    return card;
}

// Render preference section
function renderPreferenceSection(preference, activities) {
    if (activities.length === 0) return '';
    
    const prefInfo = PREFERENCE_LEVELS[preference];
    
    const section = document.createElement('div');
    section.className = 'preference-section';
    
    const title = document.createElement('div');
    title.className = `preference-title ${prefInfo.class}`;
    title.textContent = prefInfo.title;
    section.appendChild(title);
    
    const grid = document.createElement('div');
    grid.className = 'activities-grid';
    
    activities.forEach(activity => {
        grid.appendChild(renderActivityCard(activity));
    });
    
    section.appendChild(grid);
    
    return section;
}

// Render category section
function renderCategory(categoryName, activities) {
    const section = document.createElement('div');
    section.className = 'category-section';
    
    const title = document.createElement('h2');
    title.className = 'category-title';
    title.textContent = categoryName;
    section.appendChild(title);
    
    if (currentViewMode === 'level') {
        // Group activities by preference level
        const grouped = groupByPreference(activities);
        
        // Render each preference level in order
        ['Drop Anything', 'Sometimes', 'On Your Own'].forEach(pref => {
            const prefSection = renderPreferenceSection(pref, grouped[pref]);
            if (prefSection) {
                section.appendChild(prefSection);
            }
        });
    } else {
        // Group activities by who likes them
        const grouped = groupByCaregiver(activities);
        
        // Render each caregiver group
        ['both', 'mom', 'dad', 'neither'].forEach(who => {
            const whoSection = renderCaregiverSection(who, grouped[who]);
            if (whoSection) {
                section.appendChild(whoSection);
            }
        });
    }
    
    return section;
}

// Group activities by caregiver for sheets
function groupByCaregiver(activities) {
    const groups = {
        'both': [],
        'mom': [],
        'dad': [],
        'neither': []
    };
    
    activities.forEach(activity => {
        const parentInfo = getParentInfo(activity.parent);
        const caregiverClass = parentInfo.class;
        
        // Map classes to groups
        if (caregiverClass === 'both') {
            groups['both'].push(activity);
        } else if (caregiverClass === 'mom') {
            groups['mom'].push(activity);
        } else if (caregiverClass === 'dad') {
            groups['dad'].push(activity);
        } else {
            groups['neither'].push(activity);
        }
    });
    
    return groups;
}

// Render caregiver section for sheets
function renderCaregiverSection(caregiver, activities) {
    if (activities.length === 0) return null;
    
    const bothLabel = userSettings?.both_label || 'Both';
    const bothEmoji = userSettings?.both_emoji || '💜';
    const caregiver1Label = userSettings?.caregiver1_label || 'Mom';
    const caregiver1Emoji = userSettings?.caregiver1_emoji || '💗';
    const caregiver2Label = userSettings?.caregiver2_label || 'Dad';
    const caregiver2Emoji = userSettings?.caregiver2_emoji || '💙';
    
    const caregiverInfo = {
        'both': { emoji: bothEmoji, text: bothLabel, class: 'both' },
        'mom': { emoji: caregiver1Emoji, text: caregiver1Label, class: 'mom' },
        'dad': { emoji: caregiver2Emoji, text: caregiver2Label, class: 'dad' },
        'neither': { emoji: '⭐', text: 'On Your Own', class: 'independent' }
    };
    
    const info = caregiverInfo[caregiver];
    
    const section = document.createElement('div');
    section.className = 'preference-section';
    
    const title = document.createElement('div');
    title.className = `preference-title ${info.class}`;
    title.innerHTML = `${info.emoji} ${info.text}`;
    section.appendChild(title);
    
    const grid = document.createElement('div');
    grid.className = 'activities-grid';
    
    activities.forEach(activity => {
        const card = renderActivityCardSimple(activity);
        grid.appendChild(card);
    });
    
    section.appendChild(grid);
    
    return section;
}

// Render simple activity card for sheets (no parent badge)
function renderActivityCardSimple(activity) {
    const card = document.createElement('div');
    card.className = 'activity-card';
    
    // Show preference level as badge
    const prefBadges = {
        'Drop Anything': { emoji: '💚', text: 'Love it!', class: 'drop-anything' },
        'Sometimes': { emoji: '💛', text: 'Sounds fun', class: 'sometimes' },
        'On Your Own': { emoji: '⭐', text: 'You can do this', class: 'on-your-own' }
    };
    
    const badgeInfo = prefBadges[activity.preference] || { emoji: '💚', text: 'Love it!', class: 'drop-anything' };
    
    card.innerHTML = `
        <div class="activity-name">${activity.name}</div>
        <div class="parent-info">
            <div class="parent-badge ${badgeInfo.class}">
                <span class="parent-emoji">${badgeInfo.emoji}</span>
                <span>${badgeInfo.text}</span>
            </div>
        </div>
    `;
    
    return card;
}

// Load and render all data
async function loadData() {
    if (currentDataSource === 'sheets') {
        await loadDataFromSheets();
    } else {
        await loadDataFromBuiltin();
    }
}

// Load data from built-in preferences
async function loadDataFromBuiltin() {
    showLoading(true);
    categoriesEl.innerHTML = '';
    
    try {
        const supabaseClient = window.supabaseUtils.getClient();
        
        // Load categories
        const { data: categories, error: catError } = await supabaseClient
            .from('activity_categories')
            .select('*')
            .eq('user_id', currentUser.id)
            .order('sort_order', { ascending: true });
        
        if (catError) throw catError;
        
        if (!categories || categories.length === 0) {
            categoriesEl.innerHTML = `
                <div style="text-align: center; padding: 60px 20px;">
                    <div style="font-size: 64px; margin-bottom: 20px;">📋</div>
                    <h2 style="color: #666; margin-bottom: 10px;">No Preferences Yet</h2>
                    <p style="color: #999; margin-bottom: 20px;">Create your first category to get started!</p>
                    <button onclick="window.location.href='/preferences-manager.html'" class="btn btn-primary">
                        ✏️ Manage Preferences
                    </button>
                </div>
            `;
            showLoading(false);
            return;
        }
        
        // Load all activities and preferences
        const { data: activities, error: actError } = await supabaseClient
            .from('activities')
            .select('*')
            .order('sort_order', { ascending: true });
        
        if (actError) throw actError;
        
        const { data: preferences, error: prefError } = await supabaseClient
            .from('parent_preferences')
            .select('*')
            .eq('user_id', currentUser.id);
        
        if (prefError) throw prefError;
        
        // Render each category
        categories.forEach(category => {
            const categoryActivities = activities.filter(a => a.category_id === category.id);
            if (categoryActivities.length > 0) {
                const section = renderBuiltinCategory(category, categoryActivities, preferences);
                categoriesEl.appendChild(section);
            }
        });
        
        showLoading(false);
        
    } catch (error) {
        showLoading(false);
        showError('Failed to load built-in preferences: ' + error.message);
        console.error('Error loading built-in data:', error);
    }
}

// Render built-in category
function renderBuiltinCategory(category, activities, preferences) {
    const section = document.createElement('div');
    section.className = 'category-section';
    
    const title = document.createElement('h2');
    title.className = 'category-title';
    title.innerHTML = `${category.icon} ${category.name}`;
    section.appendChild(title);
    
    if (currentViewMode === 'level') {
        // Group by preference level (how much they like it)
        renderByPreferenceLevel(section, activities, preferences);
    } else {
        // Group by who likes it (caregiver)
        renderByCaregiver(section, activities, preferences);
    }
    
    return section;
}

// Render activities grouped by preference level
function renderByPreferenceLevel(section, activities, preferences) {
    const grouped = {
        'drop_anything': [],
        'sometimes': [],
        'on_your_own': []
    };
    
    activities.forEach(activity => {
        const prefLevel = activity.preference_level || 'drop_anything';
        const pref = preferences.find(p => p.activity_id === activity.id);
        const parentPref = pref ? pref.preference_level : 'both';
        
        grouped[prefLevel].push({
            ...activity,
            parent_preference: parentPref
        });
    });
    
    // Render Drop Anything section (highest priority)
    if (grouped['drop_anything'].length > 0) {
        const dropSection = document.createElement('div');
        dropSection.className = 'preference-section';
        
        const dropTitle = document.createElement('div');
        dropTitle.className = 'preference-title drop-anything';
        dropTitle.textContent = '💚 Drop Anything - Love to do!';
        dropSection.appendChild(dropTitle);
        
        const dropGrid = document.createElement('div');
        dropGrid.className = 'activities-grid';
        grouped['drop_anything'].forEach(activity => {
            const card = renderBuiltinActivityCard(activity, activity.parent_preference);
            dropGrid.appendChild(card);
        });
        dropSection.appendChild(dropGrid);
        section.appendChild(dropSection);
    }
    
    // Render Sometimes section
    if (grouped['sometimes'].length > 0) {
        const sometimesSection = document.createElement('div');
        sometimesSection.className = 'preference-section';
        
        const sometimesTitle = document.createElement('div');
        sometimesTitle.className = 'preference-title sometimes';
        sometimesTitle.textContent = '💛 Sometimes - Sounds fun!';
        sometimesSection.appendChild(sometimesTitle);
        
        const sometimesGrid = document.createElement('div');
        sometimesGrid.className = 'activities-grid';
        grouped['sometimes'].forEach(activity => {
            const card = renderBuiltinActivityCard(activity, activity.parent_preference);
            sometimesGrid.appendChild(card);
        });
        sometimesSection.appendChild(sometimesGrid);
        section.appendChild(sometimesSection);
    }
    
    // Render On Your Own section
    if (grouped['on_your_own'].length > 0) {
        const ownSection = document.createElement('div');
        ownSection.className = 'preference-section';
        
        const ownTitle = document.createElement('div');
        ownTitle.className = 'preference-title on-your-own';
        ownTitle.textContent = '⭐ On Your Own - You can do this!';
        ownSection.appendChild(ownTitle);
        
        const ownGrid = document.createElement('div');
        ownGrid.className = 'activities-grid';
        grouped['on_your_own'].forEach(activity => {
            const card = renderBuiltinActivityCard(activity, activity.parent_preference);
            ownGrid.appendChild(card);
        });
        ownSection.appendChild(ownGrid);
        section.appendChild(ownSection);
    }
}

// Render activities grouped by caregiver
function renderByCaregiver(section, activities, preferences) {
    const bothLabel = userSettings?.both_label || 'Both';
    const bothEmoji = userSettings?.both_emoji || '💜';
    const caregiver1Label = userSettings?.caregiver1_label || 'Mom';
    const caregiver1Emoji = userSettings?.caregiver1_emoji || '💗';
    const caregiver2Label = userSettings?.caregiver2_label || 'Dad';
    const caregiver2Emoji = userSettings?.caregiver2_emoji || '💙';
    
    const grouped = {
        'both': [],
        'mom': [],
        'dad': [],
        'neither': []
    };
    
    activities.forEach(activity => {
        const pref = preferences.find(p => p.activity_id === activity.id);
        const parentPref = pref ? pref.preference_level : 'both';
        
        grouped[parentPref].push({
            ...activity,
            parent_preference: parentPref
        });
    });
    
    // Render Both section
    if (grouped['both'].length > 0) {
        const bothSection = document.createElement('div');
        bothSection.className = 'preference-section';
        
        const bothTitle = document.createElement('div');
        bothTitle.className = 'preference-title both';
        bothTitle.innerHTML = `${bothEmoji} ${bothLabel}`;
        bothSection.appendChild(bothTitle);
        
        const bothGrid = document.createElement('div');
        bothGrid.className = 'activities-grid';
        grouped['both'].forEach(activity => {
            const card = renderBuiltinActivityCardSimple(activity);
            bothGrid.appendChild(card);
        });
        bothSection.appendChild(bothGrid);
        section.appendChild(bothSection);
    }
    
    // Render Caregiver 1 section
    if (grouped['mom'].length > 0) {
        const momSection = document.createElement('div');
        momSection.className = 'preference-section';
        
        const momTitle = document.createElement('div');
        momTitle.className = 'preference-title mom';
        momTitle.innerHTML = `${caregiver1Emoji} ${caregiver1Label}`;
        momSection.appendChild(momTitle);
        
        const momGrid = document.createElement('div');
        momGrid.className = 'activities-grid';
        grouped['mom'].forEach(activity => {
            const card = renderBuiltinActivityCardSimple(activity);
            momGrid.appendChild(card);
        });
        momSection.appendChild(momGrid);
        section.appendChild(momSection);
    }
    
    // Render Caregiver 2 section
    if (grouped['dad'].length > 0) {
        const dadSection = document.createElement('div');
        dadSection.className = 'preference-section';
        
        const dadTitle = document.createElement('div');
        dadTitle.className = 'preference-title dad';
        dadTitle.innerHTML = `${caregiver2Emoji} ${caregiver2Label}`;
        dadSection.appendChild(dadTitle);
        
        const dadGrid = document.createElement('div');
        dadGrid.className = 'activities-grid';
        grouped['dad'].forEach(activity => {
            const card = renderBuiltinActivityCardSimple(activity);
            dadGrid.appendChild(card);
        });
        dadSection.appendChild(dadGrid);
        section.appendChild(dadSection);
    }
    
    // Render On Your Own section
    if (grouped['neither'].length > 0) {
        const neitherSection = document.createElement('div');
        neitherSection.className = 'preference-section';
        
        const neitherTitle = document.createElement('div');
        neitherTitle.className = 'preference-title independent';
        neitherTitle.innerHTML = `⭐ On Your Own`;
        neitherSection.appendChild(neitherTitle);
        
        const neitherGrid = document.createElement('div');
        neitherGrid.className = 'activities-grid';
        grouped['neither'].forEach(activity => {
            const card = renderBuiltinActivityCardSimple(activity);
            neitherGrid.appendChild(card);
        });
        neitherSection.appendChild(neitherGrid);
        section.appendChild(neitherSection);
    }
}

// Render simple activity card (for "who" view - no parent badge needed)
function renderBuiltinActivityCardSimple(activity) {
    const card = document.createElement('div');
    card.className = 'activity-card';
    
    // Add preference level badge
    const levelBadges = {
        'drop_anything': { text: 'Love it!', emoji: '💚', class: 'drop-anything' },
        'sometimes': { text: 'Sounds fun', emoji: '💛', class: 'sometimes' },
        'on_your_own': { text: 'You can do this', emoji: '⭐', class: 'on-your-own' }
    };
    
    const levelInfo = levelBadges[activity.preference_level] || levelBadges['drop_anything'];
    
    card.innerHTML = `
        <div class="activity-name">${activity.name}</div>
        ${activity.description ? `<div style="font-size: 12px; color: #666; margin-top: 4px;">${activity.description}</div>` : ''}
        <div class="parent-info">
            <div class="parent-badge ${levelInfo.class}">
                <span class="parent-emoji">${levelInfo.emoji}</span>
                <span>${levelInfo.text}</span>
            </div>
        </div>
    `;
    
    return card;
}

// Render built-in activity card
function renderBuiltinActivityCard(activity, preferenceLevel) {
    const parentInfo = getParentInfoFromLevel(preferenceLevel);
    
    const card = document.createElement('div');
    card.className = 'activity-card';
    
    card.innerHTML = `
        <div class="activity-name">${activity.name}</div>
        ${activity.description ? `<div style="font-size: 12px; color: #666; margin-top: 4px;">${activity.description}</div>` : ''}
        <div class="parent-info">
            <div class="parent-badge ${parentInfo.class}">
                <span class="parent-emoji">${parentInfo.emoji}</span>
                <span>${parentInfo.text}</span>
            </div>
        </div>
    `;
    
    return card;
}

// Get parent info from preference level
function getParentInfoFromLevel(level) {
    // Use custom labels from userSettings if available
    const bothLabel = userSettings?.both_label || 'Both';
    const bothEmoji = userSettings?.both_emoji || '💜';
    const caregiver1Label = userSettings?.caregiver1_label || 'Mom';
    const caregiver1Emoji = userSettings?.caregiver1_emoji || '💗';
    const caregiver2Label = userSettings?.caregiver2_label || 'Dad';
    const caregiver2Emoji = userSettings?.caregiver2_emoji || '💙';
    
    const mapping = {
        'both': { emoji: bothEmoji, text: bothLabel, class: 'both' },
        'mom': { emoji: caregiver1Emoji, text: caregiver1Label, class: 'mom' },
        'dad': { emoji: caregiver2Emoji, text: caregiver2Label, class: 'dad' },
        'neither': { emoji: '⭐', text: 'On Your Own', class: 'independent' }
    };
    return mapping[level] || mapping['both'];
}

// Load data from Google Sheets (original implementation)
async function loadDataFromSheets() {
    // Check if sheet ID is configured
    if (!SHEET_ID) {
        showError('No Google Sheet configured. Please go to Dashboard to set up your sheet.');
        categoriesEl.innerHTML = '';
        showLoading(false);
        return;
    }
    
    showLoading(true);
    categoriesEl.innerHTML = '';
    
    try {
        // Fetch all category tabs
        const promises = CATEGORY_TAB_NAMES.map(tab => 
            fetchSheetData(tab).then(table => ({
                name: tab,
                activities: parseActivities(table, tab)  // Pass category name
            })).catch(error => {
                console.error(`Failed to load ${tab}:`, error);
                return { name: tab, activities: [], error: error.message };
            })
        );
        
        const categories = await Promise.all(promises);
        
        // Check if we got any data
        const successfulCategories = categories.filter(c => c.activities.length > 0);
        const failedCategories = categories.filter(c => c.error);
        
        if (successfulCategories.length === 0) {
            throw new Error('No data could be loaded from any category. Please check that the sheet is publicly accessible.');
        }
        
        // Render each category
        categories.forEach(({ name, activities, error }) => {
            if (activities.length > 0) {
                const categorySection = renderCategory(name, activities);
                categoriesEl.appendChild(categorySection);
            } else if (error) {
                console.warn(`Skipped ${name}: ${error}`);
            }
        });
        
        showLoading(false);
        
        // Show success/warning message
        if (failedCategories.length > 0) {
            showError(`Loaded ${successfulCategories.length} categories. ${failedCategories.length} categories failed to load.`);
        }
        
        console.log(`✅ Loaded ${successfulCategories.length} categories successfully!`);
        if (failedCategories.length > 0) {
            console.warn(`❌ Failed categories:`, failedCategories.map(c => c.name));
        }
        
    } catch (error) {
        showLoading(false);
        let errorMessage = 'Failed to load data. ';
        
        if (error.message.includes('Failed to fetch')) {
            errorMessage += 'Please check your internet connection.';
        } else if (error.message.includes('HTTP error')) {
            errorMessage += 'The Google Sheet may not be publicly accessible. Please ensure "Anyone with the link can view" is enabled.';
        } else {
            errorMessage += error.message || 'Unknown error occurred.';
        }
        
        showError(errorMessage);
        console.error('Error loading data:', error);
        console.error('Sheet ID:', SHEET_ID);
        console.error('Attempting to load tabs:', CATEGORY_TABS);
    }
}
