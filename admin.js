// Admin Panel Logic

let currentUser = null;
let allUsers = [];
let filteredUsers = [];

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
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.addEventListener('input', handleSearch);
    }
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
    
    // Count teachers - handle both old string format and new array format
    const teacherCount = allUsers.filter(u => {
        if (Array.isArray(u.user_types)) {
            return u.user_types.includes('teacher');
        } else if (u.user_type) {
            return u.user_type === 'teacher';
        }
        return false;
    }).length;
    
    document.getElementById('totalUsers').textContent = totalUsers;
    document.getElementById('activeUsers').textContent = activeUsers;
    document.getElementById('teacherCount').textContent = teacherCount;
    
    // Category and activity counts are updated in loadUniversalActivities
}

// Get user types as array (handles both old and new format)
function getUserTypes(user) {
    if (Array.isArray(user.user_types)) {
        return user.user_types;
    } else if (user.user_type) {
        return [user.user_type];
    }
    return ['parent'];
}

// Render user types as badges
function renderUserTypeBadges(user) {
    const types = getUserTypes(user);
    return types.map(type => {
        const typeClass = type === 'admin' ? 'admin-type' : type;
        return `<span class="type-badge ${typeClass}">${type}</span>`;
    }).join('');
}

// Render users table
function renderUsersTable() {
    const usersTableBody = document.getElementById('usersTableBody');
    const emptyState = document.getElementById('emptyState');
    
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
        
        const lastLogin = user.last_login 
            ? new Date(user.last_login).toLocaleDateString()
            : 'Never';
        
        const isCurrentUser = user.id === currentUser.id;
        
        row.innerHTML = `
            <td><strong>${user.display_name || 'N/A'}</strong></td>
            <td>${user.email}</td>
            <td><span class="role-badge ${user.role}">${user.role}</span></td>
            <td>${renderUserTypeBadges(user)}</td>
            <td><span class="user-status ${statusClass}">${statusText}</span></td>
            <td>${lastLogin}</td>
            <td>
                <button class="action-btn edit" onclick="openEditUserModal('${user.id}')">
                    ✏️ Edit
                </button>
                ${!isCurrentUser ? `
                    <button class="action-btn ${user.is_active ? 'danger' : 'toggle'}" 
                            onclick="toggleUserStatus('${user.id}', ${!user.is_active})">
                        ${user.is_active ? 'Disable' : 'Enable'}
                    </button>
                ` : '<em style="color: #999;">You</em>'}
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

// Show message (error or success)
function showMessage(message, type = 'error') {
    const container = document.getElementById('messageContainer');
    if (container) {
        const className = type === 'error' ? 'error-message' : 'success-message';
        container.innerHTML = `<div class="${className}">${message}</div>`;
        setTimeout(() => {
            container.innerHTML = '';
        }, 5000);
    } else {
        alert(message);
    }
}

function showError(message) {
    showMessage(message, 'error');
}

function showSuccess(message) {
    showMessage(message, 'success');
}

// ====== ADD USER FUNCTIONALITY ======

function openAddUserModal() {
    const modal = document.getElementById('addUserModal');
    
    // Reset form
    document.getElementById('newUserEmail').value = '';
    document.getElementById('newUserName').value = '';
    document.getElementById('newUserPassword').value = '';
    document.getElementById('newUserRole').value = 'user';
    document.getElementById('newUserTypeParent').checked = true;
    document.getElementById('newUserTypeTeacher').checked = false;
    
    modal.classList.add('show');
}

function closeAddUserModal() {
    document.getElementById('addUserModal').classList.remove('show');
}

async function saveNewUser() {
    try {
        const email = document.getElementById('newUserEmail').value.trim();
        const displayName = document.getElementById('newUserName').value.trim();
        const password = document.getElementById('newUserPassword').value;
        const role = document.getElementById('newUserRole').value;
        const isParent = document.getElementById('newUserTypeParent').checked;
        const isTeacher = document.getElementById('newUserTypeTeacher').checked;
        
        if (!email || !displayName || !password) {
            showError('Please fill in all required fields');
            return;
        }
        
        if (password.length < 8) {
            showError('Password must be at least 8 characters');
            return;
        }
        
        if (!isParent && !isTeacher) {
            showError('Please select at least one user type');
            return;
        }
        
        // Build user_types array
        const userTypes = [];
        if (isParent) userTypes.push('parent');
        if (isTeacher) userTypes.push('teacher');
        
        const supabaseClient = window.supabaseUtils.getClient();
        
        // Note: Creating users requires admin API or service role key
        // For now, we'll insert directly into the users table
        // In production, you might want to use Supabase Admin API
        
        // Check if email already exists
        const { data: existingUser } = await supabaseClient
            .from('users')
            .select('id')
            .eq('email', email)
            .single();
        
        if (existingUser) {
            showError('A user with this email already exists');
            return;
        }
        
        // Create user record
        // Note: This creates a user profile but not an auth account
        // The user would need to sign up or be invited separately
        const { error } = await supabaseClient
            .from('users')
            .insert({
                email,
                display_name: displayName,
                role,
                user_types: userTypes,
                auth_method: 'email',
                is_active: true
            });
        
        if (error) throw error;
        
        closeAddUserModal();
        showSuccess('User created successfully! They will need to set up their password via the login page.');
        await loadUsers();
        
    } catch (error) {
        console.error('Error creating user:', error);
        showError('Failed to create user: ' + error.message);
    }
}

// ====== EDIT USER FUNCTIONALITY ======

function openEditUserModal(userId) {
    const user = allUsers.find(u => u.id === userId);
    if (!user) {
        showError('User not found');
        return;
    }
    
    const modal = document.getElementById('editUserModal');
    const userTypes = getUserTypes(user);
    
    document.getElementById('editUserId').value = user.id;
    document.getElementById('editUserEmail').value = user.email;
    document.getElementById('editUserName').value = user.display_name || '';
    document.getElementById('editUserRole').value = user.role || 'user';
    document.getElementById('editUserTypeParent').checked = userTypes.includes('parent');
    document.getElementById('editUserTypeTeacher').checked = userTypes.includes('teacher');
    document.getElementById('editUserActive').value = user.is_active ? 'true' : 'false';
    
    modal.classList.add('show');
}

function closeEditUserModal() {
    document.getElementById('editUserModal').classList.remove('show');
}

async function saveUserEdits() {
    alert('saveUserEdits called - this confirms the button is working');
    console.log('=== SAVE USER EDITS CALLED ===');
    
    try {
        const userId = document.getElementById('editUserId').value;
        const displayName = document.getElementById('editUserName').value.trim();
        const role = document.getElementById('editUserRole').value;
        const isParent = document.getElementById('editUserTypeParent').checked;
        const isTeacher = document.getElementById('editUserTypeTeacher').checked;
        const isActive = document.getElementById('editUserActive').value === 'true';
        
        console.log('Saving user edits:', { userId, displayName, role, isParent, isTeacher, isActive });
        
        if (!displayName) {
            showError('Please enter a display name');
            return;
        }
        
        if (!isParent && !isTeacher) {
            showError('Please select at least one user type');
            return;
        }
        
        // Build user_types array
        const userTypes = [];
        if (isParent) userTypes.push('parent');
        if (isTeacher) userTypes.push('teacher');
        
        console.log('User types to save:', userTypes);
        
        const supabaseClient = window.supabaseUtils.getClient();
        
        const { data, error } = await supabaseClient
            .from('users')
            .update({
                display_name: displayName,
                role,
                user_types: userTypes,
                is_active: isActive
            })
            .eq('id', userId)
            .select();
        
        console.log('Update result:', { data, error });
        
        if (error) throw error;
        
        // Check if the update actually affected any rows
        if (!data || data.length === 0) {
            showError('Update failed - you may not have permission to edit this user. Check RLS policies.');
            console.error('Update returned no rows - likely RLS policy blocking the update');
            return;
        }
        
        closeEditUserModal();
        showSuccess('User updated successfully!');
        await loadUsers();
        
    } catch (error) {
        console.error('Error updating user:', error);
        showError('Failed to update user: ' + error.message);
    }
}

// Make functions globally available
window.toggleUserStatus = toggleUserStatus;
window.openAddUserModal = openAddUserModal;
window.closeAddUserModal = closeAddUserModal;
window.saveNewUser = saveNewUser;
window.openEditUserModal = openEditUserModal;
window.closeEditUserModal = closeEditUserModal;
window.saveUserEdits = saveUserEdits;

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
        
        // Load universal categories (parent_id IS NULL means universal)
        const { data: categoriesData, error: categoriesError } = await supabaseClient
            .from('kid_activity_categories')
            .select('*')
            .is('parent_id', null)
            .order('sort_order', { ascending: true });
        
        if (categoriesError) throw categoriesError;
        categories = categoriesData || [];
        
        // Load activities from universal categories
        // Activities don't have parent_id - they belong to categories via category_id
        // We need to get activities where the category's parent_id IS NULL
        if (categories.length > 0) {
            const categoryIds = categories.map(c => c.id);
            
            const { data: activitiesData, error: activitiesError } = await supabaseClient
                .from('kid_activities')
                .select('*')
                .in('category_id', categoryIds)
                .order('name', { ascending: true });
            
            if (activitiesError) throw activitiesError;
            universalActivities = activitiesData || [];
        } else {
            universalActivities = [];
        }
        
        // Update stats
        const categoryCountEl = document.getElementById('categoryCount');
        const activityCountEl = document.getElementById('activityCount');
        if (categoryCountEl) categoryCountEl.textContent = categories.length;
        if (activityCountEl) activityCountEl.textContent = universalActivities.length;
        
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
        
        // Skip empty categories when searching
        if (categoryActivities.length === 0 && normalizedSearch) return;
        
        const categoryCard = document.createElement('div');
        categoryCard.className = 'category-card';
        
        const categoryHeader = document.createElement('div');
        categoryHeader.className = 'category-header';
        categoryHeader.innerHTML = `
            <div class="category-title">
                <span style="font-size: 1.5rem;">${category.icon}</span>
                <h3>${category.name}</h3>
                <span class="category-count">(${categoryActivities.length} activities)</span>
            </div>
            <div class="header-actions">
                <button class="action-btn edit" onclick="editCategory('${category.id}')">✏️ Edit</button>
                <button class="action-btn danger" onclick="deleteCategory('${category.id}')">🗑️ Delete</button>
            </div>
        `;
        
        const activitiesList = document.createElement('div');
        activitiesList.className = 'activities-list';
        
        if (categoryActivities.length === 0) {
            activitiesList.innerHTML = '<p style="color: #999; text-align: center; padding: 20px;">No activities in this category</p>';
        } else {
            categoryActivities.forEach(activity => {
                const activityRow = document.createElement('div');
                activityRow.className = 'activity-row';
                activityRow.innerHTML = `
                    <div class="activity-info">
                        <div class="activity-name">${activity.name}</div>
                        ${activity.description ? `<div class="activity-description">${activity.description}</div>` : ''}
                    </div>
                    <div class="header-actions">
                        <button class="action-btn edit" onclick="editActivity('${activity.id}')">✏️</button>
                        <button class="action-btn danger" onclick="deleteActivity('${activity.id}')">🗑️</button>
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
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">📚</div>
                <p>No categories yet. Add a category to get started!</p>
            </div>
        `;
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
