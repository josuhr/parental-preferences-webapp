// Platform Navigation JavaScript
// This file handles the platform navigation functionality

(function() {
    let currentAppSlug = 'parental-prefs'; // Default
    let apps = [];
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
            
            // Load available apps
            await loadApps();
            
            // Set up event listeners
            setupEventListeners();
            
        } catch (error) {
            console.error('Error initializing platform nav:', error);
        }
    }
    
    // Load available apps from database
    async function loadApps() {
        try {
            const supabaseClient = window.supabaseUtils.getClient();
            if (!supabaseClient) return;
            
            // Get user's accessible apps
            const { data, error } = await supabaseClient
                .from('user_app_access')
                .select(`
                    app_id,
                    role,
                    apps (
                        id,
                        slug,
                        name,
                        description,
                        icon,
                        is_active
                    )
                `)
                .eq('user_id', currentUser.id);
            
            if (error) {
                console.error('Error loading apps:', error);
                return;
            }
            
            apps = data || [];
            renderAppSwitcher();
            
        } catch (error) {
            console.error('Error in loadApps:', error);
        }
    }
    
    // Render app switcher menu
    function renderAppSwitcher() {
        const menu = document.getElementById('appSwitcherMenu');
        if (!menu) return;
        
        menu.innerHTML = '';
        
        apps.forEach(access => {
            const app = access.apps;
            const isCurrent = app.slug === currentAppSlug;
            const isDisabled = !app.is_active;
            
            const item = document.createElement('a');
            item.className = 'app-switcher-item' + 
                            (isCurrent ? ' current' : '') + 
                            (isDisabled ? ' disabled' : '');
            item.href = isDisabled ? '#' : getAppUrl(app.slug);
            
            if (isDisabled) {
                item.onclick = (e) => {
                    e.preventDefault();
                    alert('This app is coming soon!');
                };
            }
            
            item.innerHTML = `
                <div class="app-switcher-item-icon">${app.icon || '📱'}</div>
                <div class="app-switcher-item-text">
                    <h3>${app.name}</h3>
                    <p>${app.description || ''}</p>
                </div>
                ${isDisabled ? '<span class="app-switcher-item-badge">Coming Soon</span>' : ''}
            `;
            
            menu.appendChild(item);
        });
    }
    
    // Get URL for an app
    function getAppUrl(slug) {
        const urls = {
            'parental-prefs': '/index.html',
            'kid-prefs': '/kid-prefs.html',
            'teacher-dashboard': '/teacher-dashboard.html',
            'recommendations': '/recommendations.html',
            'recommendation-settings': '/recommendation-settings.html',
            'kids-activity-view': '/kids-activity-view.html'
        };
        return urls[slug] || '/dashboard.html';
    }
    
    // Set up event listeners
    function setupEventListeners() {
        // App switcher toggle
        const appSwitcherBtn = document.getElementById('appSwitcherBtn');
        const appSwitcherMenu = document.getElementById('appSwitcherMenu');
        const userMenuDropdown = document.getElementById('userMenuDropdown');
        
        if (appSwitcherBtn && appSwitcherMenu) {
            appSwitcherBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                appSwitcherMenu.classList.toggle('show');
                if (userMenuDropdown) {
                    userMenuDropdown.classList.remove('show');
                }
            });
        }
        
        // User menu toggle
        const userMenuBtn = document.getElementById('userMenuBtn');
        
        if (userMenuBtn && userMenuDropdown) {
            userMenuBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                userMenuDropdown.classList.toggle('show');
                if (appSwitcherMenu) {
                    appSwitcherMenu.classList.remove('show');
                }
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
        
        // Close menus when clicking outside
        document.addEventListener('click', () => {
            if (appSwitcherMenu) appSwitcherMenu.classList.remove('show');
            if (userMenuDropdown) userMenuDropdown.classList.remove('show');
        });
    }
    
    // Set current app context
    window.platformNav = {
        setCurrentApp: function(slug, name, icon) {
            currentAppSlug = slug;
            const nameEl = document.getElementById('currentAppName');
            const iconEl = document.getElementById('currentAppIcon');
            if (nameEl) nameEl.textContent = name;
            if (iconEl) iconEl.textContent = icon;
        },
        
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
