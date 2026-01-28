// Admin Panel Logic

let currentUser = null;
let allUsers = [];
let filteredUsers = [];

// DOM Elements
const searchInput = document.getElementById('searchInput');
const usersTableBody = document.getElementById('usersTableBody');
const emptyState = document.getElementById('emptyState');
const totalUsersEl = document.getElementById('totalUsers');
const activeUsersEl = document.getElementById('activeUsers');
const connectedSheetsEl = document.getElementById('connectedSheets');

// Initialize on page load
document.addEventListener('DOMContentLoaded', async () => {
    // Initialize Supabase
    await window.supabaseUtils.initSupabase();
    
    const supabaseClient = window.supabaseUtils.getClient();
    if (!supabaseClient) {
        showError('Failed to initialize. Please refresh the page.');
        return;
    }
    
    // Check authentication
    currentUser = await window.supabaseUtils.getCurrentUser();
    
    if (!currentUser) {
        window.location.href = '/auth.html';
        return;
    }
    
    // Check admin privileges
    const isAdminUser = await window.supabaseUtils.isAdmin(currentUser.id);
    
    if (!isAdminUser) {
        alert('Access denied. Admin privileges required.');
        window.location.href = '/dashboard.html';
        return;
    }
    
    // Load users
    await loadUsers();
    
    // Setup search
    searchInput.addEventListener('input', handleSearch);
});

// Load all users
async function loadUsers() {
    try {
        const supabaseClient = window.supabaseUtils.getClient();
        const { data, error } = await supabaseClient
            .from('users')
            .select('*')
            .order('created_at', { ascending: false });
        
        if (error) throw error;
        
        allUsers = data || [];
        filteredUsers = [...allUsers];
        
        updateStats();
        renderUsersTable();
        
    } catch (error) {
        console.error('Error loading users:', error);
        showError('Failed to load users');
    }
}

// Update statistics
function updateStats() {
    const totalUsers = allUsers.length;
    const activeUsers = allUsers.filter(u => u.is_active).length;
    const connectedSheets = allUsers.filter(u => u.sheet_id).length;
    
    totalUsersEl.textContent = totalUsers;
    activeUsersEl.textContent = activeUsers;
    connectedSheetsEl.textContent = connectedSheets;
}

// Render users table
function renderUsersTable() {
    usersTableBody.innerHTML = '';
    
    if (filteredUsers.length === 0) {
        emptyState.style.display = 'block';
        return;
    }
    
    emptyState.style.display = 'none';
    
    filteredUsers.forEach(user => {
        const row = document.createElement('tr');
        
        const statusClass = user.is_active ? 'active' : 'inactive';
        const statusText = user.is_active ? 'Active' : 'Inactive';
        const toggleText = user.is_active ? 'Disable' : 'Enable';
        
        const lastLogin = user.last_login 
            ? new Date(user.last_login).toLocaleDateString()
            : 'Never';
        
        row.innerHTML = `
            <td><strong>${user.display_name || 'N/A'}</strong></td>
            <td>${user.email}</td>
            <td><span class="role-badge ${user.role}">${user.role}</span></td>
            <td>${user.sheet_id ? '✓ Connected' : '—'}</td>
            <td><span class="user-status ${statusClass}">${statusText}</span></td>
            <td>${lastLogin}</td>
            <td>
                ${user.id !== currentUser.id ? `
                    <button class="action-btn toggle" onclick="toggleUserStatus('${user.id}', ${!user.is_active})">
                        ${toggleText}
                    </button>
                ` : '<em>You</em>'}
            </td>
        `;
        
        usersTableBody.appendChild(row);
    });
}

// Handle search
function handleSearch(e) {
    const searchTerm = e.target.value.toLowerCase();
    
    if (!searchTerm) {
        filteredUsers = [...allUsers];
    } else {
        filteredUsers = allUsers.filter(user => 
            user.email.toLowerCase().includes(searchTerm) ||
            (user.display_name && user.display_name.toLowerCase().includes(searchTerm))
        );
    }
    
    renderUsersTable();
}

// Toggle user status
async function toggleUserStatus(userId, newStatus) {
    if (!confirm(`Are you sure you want to ${newStatus ? 'enable' : 'disable'} this user?`)) {
        return;
    }
    
    try {
        const supabaseClient = window.supabaseUtils.getClient();
        const { error } = await supabaseClient
            .from('users')
            .update({ is_active: newStatus })
            .eq('id', userId);
        
        if (error) throw error;
        
        // Update local data
        const user = allUsers.find(u => u.id === userId);
        if (user) {
            user.is_active = newStatus;
        }
        
        updateStats();
        renderUsersTable();
        
        alert(`✓ User ${newStatus ? 'enabled' : 'disabled'} successfully`);
        
    } catch (error) {
        console.error('Error toggling user status:', error);
        showError('Failed to update user status');
    }
}

// Show error message
function showError(message) {
    const errorEl = document.getElementById('error');
    if (errorEl) {
        errorEl.textContent = message;
        errorEl.style.display = 'block';
        setTimeout(() => {
            errorEl.style.display = 'none';
        }, 5000);
    } else {
        alert(message);
    }
}

// Make toggleUserStatus available globally
window.toggleUserStatus = toggleUserStatus;

// ====== UNIVERSAL ACTIVITIES MANAGEMENT ======

let categories = [];
let universalActivities = [];
let editingCategoryId = null;
let editingActivityId = null;

// Initialize activities management
document.addEventListener('DOMContentLoaded', async () => {
    // Setup event listeners for activities management
    const addCategoryBtn = document.getElementById('addCategoryBtn');
    const addUniversalActivityBtn = document.getElementById('addUniversalActivityBtn');
    const activitySearchInput = document.getElementById('activitySearchInput');
    const saveCategoryBtn = document.getElementById('saveCategoryBtn');
    const saveActivityBtn = document.getElementById('saveActivityBtn');
    
    if (addCategoryBtn) {
        addCategoryBtn.addEventListener('click', () => openCategoryModal());
    }
    
    if (addUniversalActivityBtn) {
        addUniversalActivityBtn.addEventListener('click', () => openActivityModal());
    }
    
    if (activitySearchInput) {
        activitySearchInput.addEventListener('input', (e) => filterActivities(e.target.value));
    }
    
    if (saveCategoryBtn) {
        saveCategoryBtn.addEventListener('click', saveCategory);
    }
    
    if (saveActivityBtn) {
        saveActivityBtn.addEventListener('click', saveActivity);
    }
    
    // Load activities after user check
    if (currentUser) {
        await loadUniversalActivities();
    }
});

// Load universal activities and categories
async function loadUniversalActivities() {
    try {
        const supabaseClient = window.supabaseUtils.getClient();
        
        // Load categories
        const { data: categoriesData, error: categoriesError } = await supabaseClient
            .from('kid_activity_categories')
            .select('*')
            .is('parent_id', null)
            .order('sort_order', { ascending: true });
        
        if (categoriesError) throw categoriesError;
        categories = categoriesData || [];
        
        // Load activities
        const { data: activitiesData, error: activitiesError } = await supabaseClient
            .from('kid_activities')
            .select('*')
            .is('parent_id', null)
            .order('name', { ascending: true });
        
        if (activitiesError) throw activitiesError;
        universalActivities = activitiesData || [];
        
        renderUniversalActivities();
        
    } catch (error) {
        console.error('Error loading universal activities:', error);
        showError('Failed to load activities');
    }
}

// Render universal activities by category
function renderUniversalActivities(searchTerm = '') {
    const container = document.getElementById('categoriesContainer');
    if (!container) return;
    
    container.innerHTML = '';
    
    const normalizedSearch = searchTerm.toLowerCase().trim();
    
    categories.forEach(category => {
        let categoryActivities = universalActivities.filter(a => a.category_id === category.id);
        
        // Apply search filter
        if (normalizedSearch) {
            categoryActivities = categoryActivities.filter(a =>
                a.name.toLowerCase().includes(normalizedSearch) ||
                (a.description && a.description.toLowerCase().includes(normalizedSearch))
            );
        }
        
        if (categoryActivities.length === 0 && normalizedSearch) return;
        
        const categoryCard = document.createElement('div');
        categoryCard.style.cssText = 'background: #f9f9f9; border-radius: 12px; padding: 20px; margin-bottom: 20px; border: 2px solid #e0e0e0;';
        
        const categoryHeader = document.createElement('div');
        categoryHeader.style.cssText = 'display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px; padding-bottom: 10px; border-bottom: 2px solid #667eea;';
        categoryHeader.innerHTML = `
            <div style="display: flex; align-items: center; gap: 10px;">
                <span style="font-size: 1.5rem;">${category.icon}</span>
                <h3 style="margin: 0; color: #333;">${category.name}</h3>
                <span style="color: #999; font-size: 0.9rem;">(${categoryActivities.length} activities)</span>
            </div>
            <div>
                <button class="btn btn-secondary" style="padding: 6px 12px; margin-right: 5px;" onclick="editCategory('${category.id}')">✏️ Edit</button>
                <button class="btn btn-secondary" style="padding: 6px 12px;" onclick="deleteCategory('${category.id}')">🗑️ Delete</button>
            </div>
        `;
        
        const activitiesList = document.createElement('div');
        activitiesList.style.cssText = 'display: grid; gap: 10px;';
        
        if (categoryActivities.length === 0) {
            activitiesList.innerHTML = '<p style="color: #999; text-align: center; padding: 20px;">No activities in this category</p>';
        } else {
            categoryActivities.forEach(activity => {
                const activityRow = document.createElement('div');
                activityRow.style.cssText = 'background: white; padding: 15px; border-radius: 8px; display: flex; justify-content: space-between; align-items: start; border: 1px solid #e0e0e0;';
                activityRow.innerHTML = `
                    <div style="flex: 1;">
                        <div style="font-weight: 600; color: #333; margin-bottom: 5px;">${activity.name}</div>
                        ${activity.description ? `<div style="font-size: 0.9rem; color: #666;">${activity.description}</div>` : ''}
                    </div>
                    <div style="display: flex; gap: 5px;">
                        <button class="btn btn-secondary" style="padding: 6px 12px;" onclick="editActivity('${activity.id}')">✏️ Edit</button>
                        <button class="btn btn-secondary" style="padding: 6px 12px;" onclick="deleteActivity('${activity.id}')">🗑️</button>
                    </div>
                `;
                activitiesList.appendChild(activityRow);
            });
        }
        
        categoryCard.appendChild(categoryHeader);
        categoryCard.appendChild(activitiesList);
        container.appendChild(categoryCard);
    });
    
    if (categories.length === 0) {
        container.innerHTML = '<div style="text-align: center; padding: 40px; color: #999;"><p>No categories yet. Add a category to get started!</p></div>';
    }
}

// Filter activities by search term
function filterActivities(searchTerm) {
    renderUniversalActivities(searchTerm);
}

// Open category modal
function openCategoryModal(categoryId = null) {
    editingCategoryId = categoryId;
    const modal = document.getElementById('categoryModal');
    const title = document.getElementById('categoryModalTitle');
    
    if (categoryId) {
        const category = categories.find(c => c.id === categoryId);
        if (category) {
            title.textContent = 'Edit Category';
            document.getElementById('categoryName').value = category.name;
            document.getElementById('categoryIcon').value = category.icon;
            document.getElementById('categorySortOrder').value = category.sort_order || 1;
        }
    } else {
        title.textContent = 'Add Category';
        document.getElementById('categoryName').value = '';
        document.getElementById('categoryIcon').value = '';
        document.getElementById('categorySortOrder').value = categories.length + 1;
    }
    
    modal.style.display = 'flex';
}

// Close category modal
function closeCategoryModal() {
    document.getElementById('categoryModal').style.display = 'none';
    editingCategoryId = null;
}

// Save category
async function saveCategory() {
    try {
        const name = document.getElementById('categoryName').value.trim();
        const icon = document.getElementById('categoryIcon').value.trim();
        const sortOrder = parseInt(document.getElementById('categorySortOrder').value);
        
        if (!name || !icon) {
            alert('Please fill in all required fields');
            return;
        }
        
        const supabaseClient = window.supabaseUtils.getClient();
        
        if (editingCategoryId) {
            // Update existing category
            const { error } = await supabaseClient
                .from('kid_activity_categories')
                .update({ name, icon, sort_order: sortOrder })
                .eq('id', editingCategoryId);
            
            if (error) throw error;
            alert('Category updated successfully!');
        } else {
            // Create new category
            const { error } = await supabaseClient
                .from('kid_activity_categories')
                .insert({
                    name,
                    icon,
                    sort_order: sortOrder,
                    parent_id: null // Universal category
                });
            
            if (error) throw error;
            alert('Category created successfully!');
        }
        
        closeCategoryModal();
        await loadUniversalActivities();
        
    } catch (error) {
        console.error('Error saving category:', error);
        alert('Failed to save category: ' + error.message);
    }
}

// Edit category
function editCategory(categoryId) {
    openCategoryModal(categoryId);
}

// Delete category
async function deleteCategory(categoryId) {
    if (!confirm('Are you sure you want to delete this category? This will also delete all activities in this category.')) {
        return;
    }
    
    try {
        const supabaseClient = window.supabaseUtils.getClient();
        
        // Delete category (activities will be cascade deleted)
        const { error } = await supabaseClient
            .from('kid_activity_categories')
            .delete()
            .eq('id', categoryId);
        
        if (error) throw error;
        
        alert('Category deleted successfully!');
        await loadUniversalActivities();
        
    } catch (error) {
        console.error('Error deleting category:', error);
        alert('Failed to delete category: ' + error.message);
    }
}

// Open activity modal
function openActivityModal(activityId = null) {
    editingActivityId = activityId;
    const modal = document.getElementById('activityModal');
    const title = document.getElementById('activityModalTitle');
    const categorySelect = document.getElementById('activityCategory');
    
    // Populate category dropdown
    categorySelect.innerHTML = '<option value="">-- Select a category --</option>';
    categories.forEach(cat => {
        const option = document.createElement('option');
        option.value = cat.id;
        option.textContent = `${cat.icon} ${cat.name}`;
        categorySelect.appendChild(option);
    });
    
    if (activityId) {
        const activity = universalActivities.find(a => a.id === activityId);
        if (activity) {
            title.textContent = 'Edit Activity';
            document.getElementById('activityCategory').value = activity.category_id;
            document.getElementById('activityName').value = activity.name;
            document.getElementById('activityDescription').value = activity.description || '';
        }
    } else {
        title.textContent = 'Add Activity';
        document.getElementById('activityCategory').value = '';
        document.getElementById('activityName').value = '';
        document.getElementById('activityDescription').value = '';
    }
    
    modal.style.display = 'flex';
}

// Close activity modal
function closeActivityModal() {
    document.getElementById('activityModal').style.display = 'none';
    editingActivityId = null;
}

// Save activity
async function saveActivity() {
    try {
        const categoryId = document.getElementById('activityCategory').value;
        const name = document.getElementById('activityName').value.trim();
        const description = document.getElementById('activityDescription').value.trim();
        
        if (!categoryId || !name) {
            alert('Please fill in all required fields');
            return;
        }
        
        const supabaseClient = window.supabaseUtils.getClient();
        
        if (editingActivityId) {
            // Update existing activity
            const { error } = await supabaseClient
                .from('kid_activities')
                .update({ 
                    category_id: categoryId,
                    name, 
                    description: description || null 
                })
                .eq('id', editingActivityId);
            
            if (error) throw error;
            alert('Activity updated successfully!');
        } else {
            // Create new activity
            const { error } = await supabaseClient
                .from('kid_activities')
                .insert({
                    category_id: categoryId,
                    name,
                    description: description || null,
                    parent_id: null // Universal activity
                });
            
            if (error) throw error;
            alert('Activity created successfully!');
        }
        
        closeActivityModal();
        await loadUniversalActivities();
        
    } catch (error) {
        console.error('Error saving activity:', error);
        alert('Failed to save activity: ' + error.message);
    }
}

// Edit activity
function editActivity(activityId) {
    openActivityModal(activityId);
}

// Delete activity
async function deleteActivity(activityId) {
    if (!confirm('Are you sure you want to delete this activity?')) {
        return;
    }
    
    try {
        const supabaseClient = window.supabaseUtils.getClient();
        
        const { error } = await supabaseClient
            .from('kid_activities')
            .delete()
            .eq('id', activityId);
        
        if (error) throw error;
        
        alert('Activity deleted successfully!');
        await loadUniversalActivities();
        
    } catch (error) {
        console.error('Error deleting activity:', error);
        alert('Failed to delete activity: ' + error.message);
    }
}

// Make functions globally available
window.editCategory = editCategory;
window.deleteCategory = deleteCategory;
window.editActivity = editActivity;
window.deleteActivity = deleteActivity;
window.closeCategoryModal = closeCategoryModal;
window.closeActivityModal = closeActivityModal;
