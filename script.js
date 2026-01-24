// Configuration
const SHEET_ID = '143M9nXKYlOo9fourw7c9SHa4C_nLBmCSdqcvJ72cjUE';

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
const CATEGORY_TAB_NAMES = [
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

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    loadData();
    refreshBtn.addEventListener('click', loadData);
    printBtn.addEventListener('click', () => window.print());
    helpBtn.addEventListener('click', () => {
        helpSection.style.display = helpSection.style.display === 'none' ? 'block' : 'none';
    });
});

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
    
    // Check for emoji format first (from the sheet)
    if (parent.includes('👨') && parent.includes('👩')) {
        return {
            emoji: '👩👨',
            text: 'Mom & Dad',
            class: 'both'
        };
    } else if (parent.includes('👩')) {
        return {
            emoji: '👩',
            text: 'Mom',
            class: 'mom'
        };
    } else if (parent.includes('👨')) {
        return {
            emoji: '👨',
            text: 'Dad',
            class: 'dad'
        };
    }
    
    // Also check for text format (in case it's spelled out)
    if (parentStr.includes('mom') && parentStr.includes('dad')) {
        return {
            emoji: '👩👨',
            text: 'Mom & Dad',
            class: 'both'
        };
    } else if (parentStr.includes('mom')) {
        return {
            emoji: '👩',
            text: 'Mom',
            class: 'mom'
        };
    } else if (parentStr.includes('dad')) {
        return {
            emoji: '👨',
            text: 'Dad',
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
    
    // Group activities by preference level
    const grouped = groupByPreference(activities);
    
    // Render each preference level in order
    ['Drop Anything', 'Sometimes', 'On Your Own'].forEach(pref => {
        const prefSection = renderPreferenceSection(pref, grouped[pref]);
        if (prefSection) {
            section.appendChild(prefSection);
        }
    });
    
    return section;
}

// Load and render all data
async function loadData() {
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
