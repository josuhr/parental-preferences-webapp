// Platform Navigation JavaScript
// Simplified for HomeBase - sidebar handles app navigation

(function() {
    let currentUser = null;
    
    // Initialize platform navigation
    async function initPlatformNav() {
        try {
            // Get current user
            currentUser = await window.supabaseUtils.getCurrentUser();
            if (!currentUser) return;
            
            // Get user profile
            const userProfile = await window.supabaseUtils.getUserProfile(currentUser.id);
            if (!userProfile) return;
            
            // Update user menu
            const userMenuAvatar = document.getElementById('userMenuAvatar');
            const userMenuName = document.getElementById('userMenuName');
            if (userMenuAvatar && userMenuName) {
                const initials = (userProfile.display_name || currentUser.email.split('@')[0]).substring(0, 2).toUpperCase();
                userMenuAvatar.textContent = initials;
                userMenuName.textContent = userProfile.display_name || currentUser.email.split('@')[0];
            }
            
            // Show admin menu item if admin
            const adminMenuItem = document.getElementById('adminMenuItem');
            if (adminMenuItem && userProfile.role === 'admin') {
                adminMenuItem.style.display = 'flex';
            }
            
            // Set up event listeners
            setupEventListeners();
            
        } catch (error) {
            console.error('Error initializing platform nav:', error);
        }
    }
    
    // Set up event listeners
    function setupEventListeners() {
        // User menu toggle
        const userMenuBtn = document.getElementById('userMenuBtn');
        const userMenuDropdown = document.getElementById('userMenuDropdown');
        
        if (userMenuBtn && userMenuDropdown) {
            userMenuBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                userMenuDropdown.classList.toggle('show');
            });
        }
        
        // Admin menu item
        const adminMenuItem = document.getElementById('adminMenuItem');
        if (adminMenuItem) {
            adminMenuItem.addEventListener('click', () => {
                window.location.href = '/admin.html';
            });
        }
        
        // Sign out
        const signOutMenuItem = document.getElementById('signOutMenuItem');
        if (signOutMenuItem) {
            signOutMenuItem.addEventListener('click', async () => {
                await window.supabaseUtils.signOut();
            });
        }
        
        // Close menu when clicking outside
        document.addEventListener('click', () => {
            const userMenuDropdown = document.getElementById('userMenuDropdown');
            if (userMenuDropdown) userMenuDropdown.classList.remove('show');
        });
    }
    
    // Export for external access
    window.platformNav = {
        init: initPlatformNav
    };
    
    // Auto-initialize after Supabase is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            setTimeout(initPlatformNav, 500); // Wait for supabase-config to initialize
        });
    } else {
        setTimeout(initPlatformNav, 500);
    }
})();
