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
