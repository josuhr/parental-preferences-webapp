// Preferences Manager JavaScript
// Handles CRUD operations for categories, activities, and preferences

let currentUser = null;
let categories = [];
let activities = [];
let preferences = [];
let editingCategoryId = null;
let editingActivityId = null;
let userSettings = null; // Store user settings for custom labels

// Icons for categories
const CATEGORY_ICONS = ['🏠', '🌳', '🎨', '🎮', '📚', '🎵', '⚽', '🍳', '🧩', '🎭', '🚗', '🏊', '🎪', '🌟', '🎁', '🎯'];

// Initialize on page load
document.addEventListener('DOMContentLoaded', async () => {
    try {
        // Check authentication
        currentUser = await window.supabaseUtils.getCurrentUser();
        if (!currentUser) {
            window.location.href = '/auth.html';
            return;
        }

        // Load user settings for custom labels
        userSettings = await window.supabaseUtils.getUserSettings(currentUser.id);
        
        // Update button labels based on user settings
        updatePreferenceButtonLabels();
        
        // Set up event listeners
        setupEventListeners();
        
        // Load icon picker
        renderIconPicker();
        
        // Load data
        await loadAllData();
        
    } catch (error) {
        console.error('Error initializing:', error);
        showError('Failed to initialize preferences manager');
    }
});

// Set up event listeners
function setupEventListeners() {
    // Add category button
    document.getElementById('addCategoryBtn').addEventListener('click', () => {
        openCategoryModal();
    });
    
    // Category form submit
    document.getElementById('categoryForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        await saveCategory();
    });
    
    // Activity form submit
    document.getElementById('activityForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        await saveActivity();
    });
    
    // Preference selector buttons
    document.querySelectorAll('#activityForm .preference-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('#activityForm .preference-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            document.getElementById('activityPreference').value = btn.dataset.level;
        });
    });
    
    // Preference level selector buttons
    document.querySelectorAll('#activityForm .preference-level-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('#activityForm .preference-level-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            document.getElementById('activityPreferenceLevel').value = btn.dataset.level;
        });
    });
    
    // Import button (placeholder)
    document.getElementById('importBtn').addEventListener('click', () => {
        alert('Import from Google Sheets will be implemented in a future update.\n\nFor now, you can manually create categories and activities here.');
    });
}

// Update preference button labels with custom caregiver names
function updatePreferenceButtonLabels() {
    const bothLabel = userSettings?.both_label || 'Both';
    const bothEmoji = userSettings?.both_emoji || '💜';
    const caregiver1Label = userSettings?.caregiver1_label || 'Mom';
    const caregiver1Emoji = userSettings?.caregiver1_emoji || '💗';
    const caregiver2Label = userSettings?.caregiver2_label || 'Dad';
    const caregiver2Emoji = userSettings?.caregiver2_emoji || '💙';
    
    // Update the buttons in the form
    const buttons = document.querySelectorAll('#activityForm .preference-btn');
    buttons.forEach(btn => {
        const level = btn.dataset.level;
        if (level === 'both') {
            btn.textContent = `${bothEmoji} ${bothLabel}`;
        } else if (level === 'mom') {
            btn.textContent = `${caregiver1Emoji} ${caregiver1Label}`;
        } else if (level === 'dad') {
            btn.textContent = `${caregiver2Emoji} ${caregiver2Label}`;
        }
        // 'neither' stays as is
    });
}

// Load all data
async function loadAllData() {
    showLoading(true);
    
    try {
        const supabaseClient = window.supabaseUtils.getClient();
        
        // Load categories
        const { data: categoriesData, error: categoriesError } = await supabaseClient
            .from('activity_categories')
            .select('*')
            .eq('user_id', currentUser.id)
            .order('sort_order', { ascending: true });
        
        if (categoriesError) throw categoriesError;
        categories = categoriesData || [];
        
        // Load activities
        const { data: activitiesData, error: activitiesError } = await supabaseClient
            .from('activities')
            .select('*')
            .order('sort_order', { ascending: true });
        
        if (activitiesError) throw activitiesError;
        activities = activitiesData || [];
        
        // Load preferences
        const { data: preferencesData, error: preferencesError } = await supabaseClient
            .from('parent_preferences')
            .select('*')
            .eq('user_id', currentUser.id);
        
        if (preferencesError) throw preferencesError;
        preferences = preferencesData || [];
        
        renderCategories();
        
    } catch (error) {
        console.error('Error loading data:', error);
        showError('Failed to load preferences: ' + error.message);
    } finally {
        showLoading(false);
    }
}

// Render categories and activities
function renderCategories() {
    const container = document.getElementById('categoriesContainer');
    const emptyState = document.getElementById('emptyState');
    
    if (categories.length === 0) {
        container.style.display = 'none';
        emptyState.style.display = 'block';
        return;
    }
    
    container.style.display = 'flex';
    emptyState.style.display = 'none';
    container.innerHTML = '';
    
    categories.forEach(category => {
        const categoryActivities = activities.filter(a => a.category_id === category.id);
        const card = createCategoryCard(category, categoryActivities);
        container.appendChild(card);
    });
}

// Create category card
function createCategoryCard(category, categoryActivities) {
    const card = document.createElement('div');
    card.className = 'category-card';
    
    card.innerHTML = `
        <div class="category-header">
            <div class="category-title">
                <span class="category-icon">${category.icon}</span>
                <span>${category.name}</span>
            </div>
            <div class="category-actions">
                <button class="btn-icon" onclick="editCategory('${category.id}')" title="Edit category">✏️</button>
                <button class="btn-icon" onclick="deleteCategory('${category.id}')" title="Delete category">🗑️</button>
            </div>
        </div>
        <div class="activities-list" id="activities-${category.id}"></div>
        <button class="add-activity-btn" onclick="openActivityModal('${category.id}')">
            ➕ Add Activity
        </button>
    `;
    
    // Render activities
    const activitiesList = card.querySelector(`#activities-${category.id}`);
    categoryActivities.forEach(activity => {
        const activityEl = createActivityElement(activity);
        activitiesList.appendChild(activityEl);
    });
    
    return card;
}

// Create activity element
function createActivityElement(activity) {
    const preference = preferences.find(p => p.activity_id === activity.id);
    const preferenceLevel = preference ? preference.preference_level : 'both';
    const activityPrefLevel = activity.preference_level || 'drop_anything';
    
    // Get custom labels
    const bothEmoji = userSettings?.both_emoji || '💜';
    const caregiver1Emoji = userSettings?.caregiver1_emoji || '💗';
    const caregiver2Emoji = userSettings?.caregiver2_emoji || '💙';
    
    // Get preference level badge
    const prefLevelBadge = {
        'drop_anything': '💚 Drop Anything',
        'sometimes': '💛 Sometimes',
        'on_your_own': '⭐ On Your Own'
    }[activityPrefLevel];
    
    const div = document.createElement('div');
    div.className = 'activity-item';
    
    div.innerHTML = `
        <div class="activity-info">
            <div class="activity-name">${activity.name}</div>
            <div style="font-size: 11px; color: #888; margin-top: 2px;">${prefLevelBadge}</div>
            ${activity.description ? `<div class="activity-description">${activity.description}</div>` : ''}
        </div>
        <div class="preference-selector">
            <button class="preference-btn ${preferenceLevel === 'both' ? 'active' : ''}" 
                    data-level="both" 
                    onclick="updatePreference('${activity.id}', 'both')">${bothEmoji}</button>
            <button class="preference-btn ${preferenceLevel === 'mom' ? 'active' : ''}" 
                    data-level="mom" 
                    onclick="updatePreference('${activity.id}', 'mom')">${caregiver1Emoji}</button>
            <button class="preference-btn ${preferenceLevel === 'dad' ? 'active' : ''}" 
                    data-level="dad" 
                    onclick="updatePreference('${activity.id}', 'dad')">${caregiver2Emoji}</button>
            <button class="preference-btn ${preferenceLevel === 'neither' ? 'active' : ''}" 
                    data-level="neither" 
                    onclick="updatePreference('${activity.id}', 'neither')">⚪</button>
        </div>
        <div class="category-actions">
            <button class="btn-icon" onclick="editActivity('${activity.id}')" title="Edit activity">✏️</button>
            <button class="btn-icon" onclick="deleteActivity('${activity.id}')" title="Delete activity">🗑️</button>
        </div>
    `;
    
    return div;
}

// Update preference
async function updatePreference(activityId, level) {
    try {
        const supabaseClient = window.supabaseUtils.getClient();
        const existingPref = preferences.find(p => p.activity_id === activityId);
        
        if (existingPref) {
            // Update existing preference
            const { error } = await supabaseClient
                .from('parent_preferences')
                .update({ preference_level: level, updated_at: new Date().toISOString() })
                .eq('id', existingPref.id);
            
            if (error) throw error;
            
            existingPref.preference_level = level;
        } else {
            // Create new preference
            const { data, error } = await supabaseClient
                .from('parent_preferences')
                .insert({
                    activity_id: activityId,
                    user_id: currentUser.id,
                    preference_level: level
                })
                .select()
                .single();
            
            if (error) throw error;
            
            preferences.push(data);
        }
        
        renderCategories();
        
    } catch (error) {
        console.error('Error updating preference:', error);
        showError('Failed to update preference');
    }
}

// Open category modal
function openCategoryModal(categoryId = null) {
    editingCategoryId = categoryId;
    const modal = document.getElementById('categoryModal');
    const title = document.getElementById('categoryModalTitle');
    const form = document.getElementById('categoryForm');
    
    form.reset();
    document.getElementById('categoryId').value = categoryId || '';
    
    if (categoryId) {
        title.textContent = 'Edit Category';
        const category = categories.find(c => c.id === categoryId);
        if (category) {
            document.getElementById('categoryName').value = category.name;
            document.getElementById('categoryIcon').value = category.icon;
            document.querySelectorAll('.icon-option').forEach(opt => {
                opt.classList.toggle('selected', opt.textContent === category.icon);
            });
        }
    } else {
        title.textContent = 'Add Category';
    }
    
    modal.classList.add('show');
}

// Close category modal
function closeCategoryModal() {
    document.getElementById('categoryModal').classList.remove('show');
    editingCategoryId = null;
}

// Save category
async function saveCategory() {
    try {
        const supabaseClient = window.supabaseUtils.getClient();
        const name = document.getElementById('categoryName').value.trim();
        const icon = document.getElementById('categoryIcon').value;
        
        if (!name || !icon) {
            showError('Please fill in all required fields');
            return;
        }
        
        if (editingCategoryId) {
            // Update existing category
            const { error } = await supabaseClient
                .from('activity_categories')
                .update({ name, icon, updated_at: new Date().toISOString() })
                .eq('id', editingCategoryId);
            
            if (error) throw error;
            
            const category = categories.find(c => c.id === editingCategoryId);
            if (category) {
                category.name = name;
                category.icon = icon;
            }
        } else {
            // Create new category
            const { data, error } = await supabaseClient
                .from('activity_categories')
                .insert({
                    user_id: currentUser.id,
                    name,
                    icon,
                    sort_order: categories.length
                })
                .select()
                .single();
            
            if (error) throw error;
            
            categories.push(data);
        }
        
        closeCategoryModal();
        renderCategories();
        showSuccess(editingCategoryId ? 'Category updated!' : 'Category created!');
        
    } catch (error) {
        console.error('Error saving category:', error);
        showError('Failed to save category: ' + error.message);
    }
}

// Edit category
function editCategory(categoryId) {
    openCategoryModal(categoryId);
}

// Delete category
async function deleteCategory(categoryId) {
    if (!confirm('Are you sure? This will delete the category and all its activities.')) {
        return;
    }
    
    try {
        const supabaseClient = window.supabaseUtils.getClient();
        const { error } = await supabaseClient
            .from('activity_categories')
            .delete()
            .eq('id', categoryId);
        
        if (error) throw error;
        
        categories = categories.filter(c => c.id !== categoryId);
        activities = activities.filter(a => a.category_id !== categoryId);
        
        renderCategories();
        showSuccess('Category deleted');
        
    } catch (error) {
        console.error('Error deleting category:', error);
        showError('Failed to delete category');
    }
}

// Open activity modal
function openActivityModal(categoryId, activityId = null) {
    editingActivityId = activityId;
    const modal = document.getElementById('activityModal');
    const title = document.getElementById('activityModalTitle');
    const form = document.getElementById('activityForm');
    
    form.reset();
    document.getElementById('activityId').value = activityId || '';
    document.getElementById('activityCategoryId').value = categoryId;
    
    // Reset preference buttons
    document.querySelectorAll('#activityForm .preference-btn').forEach(b => b.classList.remove('active'));
    document.querySelector('#activityForm .preference-btn[data-level="both"]').classList.add('active');
    document.getElementById('activityPreference').value = 'both';
    
    // Reset preference level buttons
    document.querySelectorAll('#activityForm .preference-level-btn').forEach(b => b.classList.remove('active'));
    document.querySelector('#activityForm .preference-level-btn[data-level="drop_anything"]').classList.add('active');
    document.getElementById('activityPreferenceLevel').value = 'drop_anything';
    
    if (activityId) {
        title.textContent = 'Edit Activity';
        const activity = activities.find(a => a.id === activityId);
        const preference = preferences.find(p => p.activity_id === activityId);
        
        if (activity) {
            document.getElementById('activityName').value = activity.name;
            document.getElementById('activityDescription').value = activity.description || '';
            
            // Set preference level
            const prefLevel = activity.preference_level || 'drop_anything';
            document.querySelectorAll('#activityForm .preference-level-btn').forEach(b => b.classList.remove('active'));
            document.querySelector(`#activityForm .preference-level-btn[data-level="${prefLevel}"]`).classList.add('active');
            document.getElementById('activityPreferenceLevel').value = prefLevel;
            
            // Set parent preference
            if (preference) {
                const level = preference.preference_level;
                document.querySelectorAll('#activityForm .preference-btn').forEach(b => b.classList.remove('active'));
                document.querySelector(`#activityForm .preference-btn[data-level="${level}"]`).classList.add('active');
                document.getElementById('activityPreference').value = level;
            }
        }
    } else {
        title.textContent = 'Add Activity';
    }
    
    modal.classList.add('show');
}

// Close activity modal
function closeActivityModal() {
    document.getElementById('activityModal').classList.remove('show');
    editingActivityId = null;
}

// Save activity
async function saveActivity() {
    try {
        const supabaseClient = window.supabaseUtils.getClient();
        const name = document.getElementById('activityName').value.trim();
        const description = document.getElementById('activityDescription').value.trim();
        const categoryId = document.getElementById('activityCategoryId').value;
        const preferenceLevel = document.getElementById('activityPreference').value;
        const activityPrefLevel = document.getElementById('activityPreferenceLevel').value;
        
        if (!name) {
            showError('Please enter an activity name');
            return;
        }
        
        if (editingActivityId) {
            // Update existing activity
            const { error: actError } = await supabaseClient
                .from('activities')
                .update({ 
                    name, 
                    description, 
                    preference_level: activityPrefLevel,
                    updated_at: new Date().toISOString() 
                })
                .eq('id', editingActivityId);
            
            if (actError) throw actError;
            
            const activity = activities.find(a => a.id === editingActivityId);
            if (activity) {
                activity.name = name;
                activity.description = description;
                activity.preference_level = activityPrefLevel;
            }
            
            // Update preference
            await updatePreference(editingActivityId, preferenceLevel);
            
        } else {
            // Create new activity
            const categoryActivities = activities.filter(a => a.category_id === categoryId);
            const { data: actData, error: actError } = await supabaseClient
                .from('activities')
                .insert({
                    category_id: categoryId,
                    name,
                    description,
                    preference_level: activityPrefLevel,
                    sort_order: categoryActivities.length
                })
                .select()
                .single();
            
            if (actError) throw actError;
            
            activities.push(actData);
            
            // Create preference
            const { data: prefData, error: prefError } = await supabaseClient
                .from('parent_preferences')
                .insert({
                    activity_id: actData.id,
                    user_id: currentUser.id,
                    preference_level: preferenceLevel
                })
                .select()
                .single();
            
            if (prefError) throw prefError;
            
            preferences.push(prefData);
        }
        
        closeActivityModal();
        renderCategories();
        showSuccess(editingActivityId ? 'Activity updated!' : 'Activity created!');
        
    } catch (error) {
        console.error('Error saving activity:', error);
        showError('Failed to save activity: ' + error.message);
    }
}

// Edit activity
function editActivity(activityId) {
    const activity = activities.find(a => a.id === activityId);
    if (activity) {
        openActivityModal(activity.category_id, activityId);
    }
}

// Delete activity
async function deleteActivity(activityId) {
    if (!confirm('Are you sure you want to delete this activity?')) {
        return;
    }
    
    try {
        const supabaseClient = window.supabaseUtils.getClient();
        const { error } = await supabaseClient
            .from('activities')
            .delete()
            .eq('id', activityId);
        
        if (error) throw error;
        
        activities = activities.filter(a => a.id !== activityId);
        preferences = preferences.filter(p => p.activity_id !== activityId);
        
        renderCategories();
        showSuccess('Activity deleted');
        
    } catch (error) {
        console.error('Error deleting activity:', error);
        showError('Failed to delete activity');
    }
}

// Render icon picker
function renderIconPicker() {
    const picker = document.getElementById('iconPicker');
    picker.innerHTML = '';
    
    CATEGORY_ICONS.forEach(icon => {
        const option = document.createElement('div');
        option.className = 'icon-option';
        option.textContent = icon;
        option.addEventListener('click', () => {
            document.querySelectorAll('.icon-option').forEach(opt => opt.classList.remove('selected'));
            option.classList.add('selected');
            document.getElementById('categoryIcon').value = icon;
        });
        picker.appendChild(option);
    });
}

// Show loading state
function showLoading(show) {
    document.getElementById('loadingContainer').style.display = show ? 'block' : 'none';
}

// Show error message
function showError(message) {
    const container = document.getElementById('messageContainer');
    container.innerHTML = `<div class="error-message">${message}</div>`;
    setTimeout(() => {
        container.innerHTML = '';
    }, 5000);
}

// Show success message
function showSuccess(message) {
    const container = document.getElementById('messageContainer');
    container.innerHTML = `<div class="success-message">${message}</div>`;
    setTimeout(() => {
        container.innerHTML = '';
    }, 3000);
}
