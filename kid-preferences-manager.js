// Kid Preferences Manager JavaScript
// Handles activity preferences for a specific kid

let currentUser = null;
let currentKid = null;
let categories = [];
let activities = [];
let preferences = [];
let editingCategoryId = null;
let editingActivityId = null;

const CATEGORY_ICONS = ['⚽', '🎨', '📚', '🎮', '🏊', '🎵', '🍳', '🧩', '🚴', '🎭', '🌳', '🏀', '🎪', '🎯', '🛴', '🎸'];

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
    try {
        currentUser = await window.supabaseUtils.getCurrentUser();
        if (!currentUser) {
            window.location.href = '/auth.html';
            return;
        }

        // Get kid ID from URL
        const urlParams = new URLSearchParams(window.location.search);
        const kidId = urlParams.get('kid');
        
        if (!kidId) {
            showError('No kid selected');
            setTimeout(() => window.location.href = '/kid-prefs.html', 2000);
            return;
        }

        // Load kid info
        await loadKidInfo(kidId);
        
        // Set up event listeners
        setupEventListeners();
        
        // Load icon picker
        renderIconPicker();
        
        // Load data
        await loadAllData();
        
    } catch (error) {
        console.error('Error initializing:', error);
        showError('Failed to initialize');
    }
});

// Load kid information
async function loadKidInfo(kidId) {
    try {
        const supabaseClient = window.supabaseUtils.getClient();
        
        const { data, error } = await supabaseClient
            .from('kids')
            .select('*')
            .eq('id', kidId)
            .eq('parent_id', currentUser.id)
            .single();
        
        if (error) throw error;
        if (!data) throw new Error('Kid not found');
        
        currentKid = data;
        
        // Update UI
        document.getElementById('kidAvatar').textContent = currentKid.avatar_emoji;
        document.getElementById('kidName').textContent = currentKid.name;
        document.getElementById('kidBreadcrumb').textContent = `${currentKid.name}'s Activities`;
        document.getElementById('kidNameInModal').textContent = currentKid.name;
        
    } catch (error) {
        console.error('Error loading kid:', error);
        showError('Failed to load kid information');
        setTimeout(() => window.location.href = '/kid-prefs.html', 2000);
    }
}

// Set up event listeners
function setupEventListeners() {
    document.getElementById('addCategoryBtn').addEventListener('click', () => {
        openCategoryModal();
    });
    
    document.getElementById('categoryForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        await saveCategory();
    });
    
    document.getElementById('activityForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        await saveActivity();
    });
    
    // Preference buttons
    document.querySelectorAll('#activityForm .preference-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('#activityForm .preference-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            document.getElementById('activityPreference').value = btn.dataset.level;
        });
    });
}

// Load all data
async function loadAllData() {
    try {
        const supabaseClient = window.supabaseUtils.getClient();
        
        // Load categories (universal + user's custom)
        const { data: catData, error: catError } = await supabaseClient
            .from('kid_activity_categories')
            .select('*')
            .or(`parent_id.is.null,parent_id.eq.${currentUser.id}`)
            .order('sort_order');
        
        if (catError) throw catError;
        categories = catData || [];
        
        // Load activities (only from the categories we have access to)
        const categoryIds = categories.map(c => c.id);
        let activities_query = supabaseClient
            .from('kid_activities')
            .select('*')
            .order('sort_order');
        
        if (categoryIds.length > 0) {
            activities_query = activities_query.in('category_id', categoryIds);
        }
        
        const { data: actData, error: actError } = await activities_query;
        
        if (actError) throw actError;
        activities = actData || [];
        
        // Load preferences for this kid
        const { data: prefData, error: prefError } = await supabaseClient
            .from('kid_preferences')
            .select('*')
            .eq('kid_id', currentKid.id);
        
        if (prefError) throw prefError;
        preferences = prefData || [];
        
        renderCategories();
        
    } catch (error) {
        console.error('Error loading data:', error);
        showError('Failed to load data');
    }
}

// Render categories
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
                <span style="font-size: 24px;">${category.icon}</span>
                <span>${category.name}</span>
            </div>
            <div class="category-actions">
                <button class="btn-icon" onclick="editCategory('${category.id}')">✏️</button>
                <button class="btn-icon" onclick="deleteCategory('${category.id}')">🗑️</button>
            </div>
        </div>
        <div class="activities-list" id="activities-${category.id}"></div>
        <button class="add-activity-btn" onclick="openActivityModal('${category.id}')">➕ Add Activity</button>
    `;
    
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
    const preferenceLevel = preference ? preference.preference_level : 'likes';
    
    const div = document.createElement('div');
    div.className = 'activity-item';
    
    div.innerHTML = `
        <div class="activity-info">
            <div class="activity-name">${activity.name}</div>
            ${activity.description ? `<div style="font-size: 12px; color: #666;">${activity.description}</div>` : ''}
        </div>
        <div class="preference-selector">
            <button class="preference-btn ${preferenceLevel === 'loves' ? 'active' : ''}" 
                    data-level="loves" 
                    onclick="updatePreference('${activity.id}', 'loves')">❤️</button>
            <button class="preference-btn ${preferenceLevel === 'likes' ? 'active' : ''}" 
                    data-level="likes" 
                    onclick="updatePreference('${activity.id}', 'likes')">😊</button>
            <button class="preference-btn ${preferenceLevel === 'neutral' ? 'active' : ''}" 
                    data-level="neutral" 
                    onclick="updatePreference('${activity.id}', 'neutral')">😐</button>
            <button class="preference-btn ${preferenceLevel === 'dislikes' ? 'active' : ''}" 
                    data-level="dislikes" 
                    onclick="updatePreference('${activity.id}', 'dislikes')">😟</button>
            <button class="preference-btn ${preferenceLevel === 'refuses' ? 'active' : ''}" 
                    data-level="refuses" 
                    onclick="updatePreference('${activity.id}', 'refuses')">❌</button>
        </div>
        <div class="category-actions">
            <button class="btn-icon" onclick="editActivity('${activity.id}')">✏️</button>
            <button class="btn-icon" onclick="deleteActivity('${activity.id}')">🗑️</button>
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
            const { error } = await supabaseClient
                .from('kid_preferences')
                .update({ preference_level: level })
                .eq('id', existingPref.id);
            
            if (error) throw error;
            existingPref.preference_level = level;
        } else {
            const { data, error } = await supabaseClient
                .from('kid_preferences')
                .insert({
                    kid_id: currentKid.id,
                    activity_id: activityId,
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

// Category modal functions
function openCategoryModal(categoryId = null) {
    editingCategoryId = categoryId;
    const modal = document.getElementById('categoryModal');
    const form = document.getElementById('categoryForm');
    
    form.reset();
    document.getElementById('categoryId').value = categoryId || '';
    
    if (categoryId) {
        const category = categories.find(c => c.id === categoryId);
        if (category) {
            document.getElementById('categoryName').value = category.name;
            document.getElementById('categoryIcon').value = category.icon;
            document.querySelectorAll('.icon-option').forEach(opt => {
                opt.classList.toggle('selected', opt.textContent === category.icon);
            });
        }
    }
    
    modal.classList.add('show');
}

function closeCategoryModal() {
    document.getElementById('categoryModal').classList.remove('show');
}

async function saveCategory() {
    try {
        const supabaseClient = window.supabaseUtils.getClient();
        const name = document.getElementById('categoryName').value.trim();
        const icon = document.getElementById('categoryIcon').value;
        
        if (!name || !icon) {
            showError('Please fill in all fields');
            return;
        }
        
        if (editingCategoryId) {
            const { error } = await supabaseClient
                .from('kid_activity_categories')
                .update({ name, icon })
                .eq('id', editingCategoryId);
            
            if (error) throw error;
        } else {
            const { error } = await supabaseClient
                .from('kid_activity_categories')
                .insert({
                    parent_id: currentUser.id,
                    name,
                    icon,
                    sort_order: categories.length
                });
            
            if (error) throw error;
        }
        
        closeCategoryModal();
        await loadAllData();
        showSuccess('Category saved!');
        
    } catch (error) {
        console.error('Error saving category:', error);
        showError('Failed to save category');
    }
}

function editCategory(categoryId) {
    openCategoryModal(categoryId);
}

async function deleteCategory(categoryId) {
    if (!confirm('Delete this category and all its activities?')) return;
    
    try {
        const supabaseClient = window.supabaseUtils.getClient();
        const { error } = await supabaseClient
            .from('kid_activity_categories')
            .delete()
            .eq('id', categoryId);
        
        if (error) throw error;
        
        await loadAllData();
        showSuccess('Category deleted');
        
    } catch (error) {
        console.error('Error deleting category:', error);
        showError('Failed to delete category');
    }
}

// Activity modal functions
function openActivityModal(categoryId, activityId = null) {
    editingActivityId = activityId;
    const modal = document.getElementById('activityModal');
    const form = document.getElementById('activityForm');
    
    form.reset();
    document.getElementById('activityId').value = activityId || '';
    document.getElementById('activityCategoryId').value = categoryId;
    
    document.querySelectorAll('#activityForm .preference-btn').forEach(b => b.classList.remove('active'));
    document.querySelector('#activityForm .preference-btn[data-level="likes"]').classList.add('active');
    document.getElementById('activityPreference').value = 'likes';
    
    if (activityId) {
        const activity = activities.find(a => a.id === activityId);
        const preference = preferences.find(p => p.activity_id === activityId);
        
        if (activity) {
            document.getElementById('activityName').value = activity.name;
            document.getElementById('activityDescription').value = activity.description || '';
            
            if (preference) {
                const level = preference.preference_level;
                document.querySelectorAll('#activityForm .preference-btn').forEach(b => b.classList.remove('active'));
                document.querySelector(`#activityForm .preference-btn[data-level="${level}"]`).classList.add('active');
                document.getElementById('activityPreference').value = level;
            }
        }
    }
    
    modal.classList.add('show');
}

function closeActivityModal() {
    document.getElementById('activityModal').classList.remove('show');
}

async function saveActivity() {
    try {
        const supabaseClient = window.supabaseUtils.getClient();
        const name = document.getElementById('activityName').value.trim();
        const description = document.getElementById('activityDescription').value.trim();
        const categoryId = document.getElementById('activityCategoryId').value;
        const preferenceLevel = document.getElementById('activityPreference').value;
        
        if (!name) {
            showError('Please enter an activity name');
            return;
        }
        
        if (editingActivityId) {
            const { error } = await supabaseClient
                .from('kid_activities')
                .update({ name, description })
                .eq('id', editingActivityId);
            
            if (error) throw error;
            
            await updatePreference(editingActivityId, preferenceLevel);
        } else {
            const { data, error } = await supabaseClient
                .from('kid_activities')
                .insert({
                    category_id: categoryId,
                    name,
                    description,
                    sort_order: activities.filter(a => a.category_id === categoryId).length
                })
                .select()
                .single();
            
            if (error) throw error;
            
            await updatePreference(data.id, preferenceLevel);
        }
        
        closeActivityModal();
        await loadAllData();
        showSuccess('Activity saved!');
        
    } catch (error) {
        console.error('Error saving activity:', error);
        showError('Failed to save activity');
    }
}

function editActivity(activityId) {
    const activity = activities.find(a => a.id === activityId);
    if (activity) {
        openActivityModal(activity.category_id, activityId);
    }
}

async function deleteActivity(activityId) {
    if (!confirm('Delete this activity?')) return;
    
    try {
        const supabaseClient = window.supabaseUtils.getClient();
        const { error } = await supabaseClient
            .from('kid_activities')
            .delete()
            .eq('id', activityId);
        
        if (error) throw error;
        
        await loadAllData();
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

// Show messages
function showError(message) {
    const container = document.getElementById('messageContainer');
    container.innerHTML = `<div class="error-message">${message}</div>`;
    setTimeout(() => container.innerHTML = '', 5000);
}

function showSuccess(message) {
    const container = document.getElementById('messageContainer');
    container.innerHTML = `<div class="success-message">${message}</div>`;
    setTimeout(() => container.innerHTML = '', 3000);
}
