// Dashboard Logic - Onboarding Hub

let currentUser = null;
let userProfile = null;

// DOM Elements
const userAvatar = document.getElementById('userAvatar');
const userName = document.getElementById('userName');
const userEmail = document.getElementById('userEmail');
const adminBtn = document.getElementById('adminBtn');
const signOutBtn = document.getElementById('signOutBtn');
const kidCountEl = document.getElementById('kidCount');
const activityCountEl = document.getElementById('activityCount');
const preferenceCountEl = document.getElementById('preferenceCount');

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
        // Not logged in, redirect to auth
        window.location.href = '/auth.html';
        return;
    }
    
    // Load user data
    await loadUserData();
    
    // Load statistics
    await loadStatistics();
    
    // Set up event listeners
    setupEventListeners();
});

// Load user data
async function loadUserData() {
    try {
        console.log('Loading user data for:', currentUser.email, 'ID:', currentUser.id);
        
        // Get user profile
        userProfile = await window.supabaseUtils.getUserProfile(currentUser.id);
        
        if (!userProfile) {
            console.error('User profile not found in database for:', currentUser.email);
            
            // Update UI to show error state instead of "Loading..."
            userName.textContent = 'Account Setup Error';
            userName.style.color = '#c62828';
            userEmail.textContent = currentUser.email;
            userAvatar.textContent = '⚠️';
            userAvatar.style.background = '#ffebee';
            
            // Show detailed error with instructions
            const errorMsg = `Your account (${currentUser.email}) was authenticated but not found in the database.\n\n` +
                           `This may happen if you just signed up. Please contact the administrator with this information:\n\n` +
                           `Email: ${currentUser.email}\n` +
                           `User ID: ${currentUser.id}\n\n` +
                           `The administrator can create your account manually.`;
            
            showError(errorMsg);
            
            return;
        }
        
        console.log('User profile loaded successfully:', userProfile);
        
        // Update UI
        updateUserInfo();
        
        // Check if admin
        if (userProfile.role === 'admin') {
            adminBtn.style.display = 'flex';
        }
    } catch (error) {
        console.error('Error loading user data:', error);
        console.error('Error details:', JSON.stringify(error, null, 2));
        
        // Update UI to show error state
        userName.textContent = 'Error Loading Profile';
        userName.style.color = '#c62828';
        userEmail.textContent = currentUser.email;
        
        showError(`Failed to load user data: ${error.message || 'Unknown error'}`);
    }
}

// Update user info display
function updateUserInfo() {
    const displayName = userProfile.display_name || currentUser.email.split('@')[0];
    const initials = displayName.substring(0, 2).toUpperCase();
    
    userAvatar.textContent = initials;
    userName.textContent = displayName;
    userEmail.textContent = currentUser.email;
}

// Load statistics
async function loadStatistics() {
    try {
        const supabaseClient = window.supabaseUtils.getClient();
        
        // Count kids
        const { count: kidCount, error: kidError } = await supabaseClient
            .from('kids')
            .select('*', { count: 'exact', head: true })
            .eq('parent_id', currentUser.id);
        
        if (kidError) throw kidError;
        
        // Count household activities
        const { count: activityCount, error: activityError } = await supabaseClient
            .from('household_activities')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', currentUser.id);
        
        if (activityError) throw activityError;
        
        // Count preferences set (join to get only this user's preferences)
        const { count: preferenceCount, error: prefError } = await supabaseClient
            .from('household_activity_preferences')
            .select('household_activities!inner(user_id)', { count: 'exact', head: true })
            .eq('household_activities.user_id', currentUser.id);
        
        if (prefError) throw prefError;
        
        // Update UI
        kidCountEl.textContent = kidCount || 0;
        activityCountEl.textContent = activityCount || 0;
        preferenceCountEl.textContent = preferenceCount || 0;
        
    } catch (error) {
        console.error('Error loading statistics:', error);
        kidCountEl.textContent = '-';
        activityCountEl.textContent = '-';
        preferenceCountEl.textContent = '-';
    }
}

function setupEventListeners() {
    // Buttons
    if (signOutBtn) signOutBtn.addEventListener('click', () => window.supabaseUtils.signOut());
    if (adminBtn) adminBtn.addEventListener('click', () => window.location.href = '/admin.html');
}

// Show error message
function showError(message) {
    const errorEl = document.getElementById('error');
    if (errorEl) {
        errorEl.textContent = message;
        errorEl.style.display = 'block';
        errorEl.style.whiteSpace = 'pre-wrap'; // Support multiline
        errorEl.style.padding = '20px';
        errorEl.style.marginTop = '20px';
        errorEl.style.background = '#ffebee';
        errorEl.style.color = '#c62828';
        errorEl.style.borderRadius = '10px';
        errorEl.style.maxWidth = '100%';
        errorEl.style.fontSize = '0.95rem';
        errorEl.style.lineHeight = '1.6';
        // Don't auto-hide - let user read the full message
    } else {
        alert(message);
    }
}
