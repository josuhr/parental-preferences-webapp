// Sidebar Navigation JavaScript
// Hierarchical collapsible navigation for HomeBase

(function() {
    let sidebarState = {
        collapsed: false,
        expandedSections: ['what-we-like'] // Default expanded
    };
    
    const currentPage = window.location.pathname.split('/').pop() || 'index.html';
    
    // User permission flags
    let userIsTeacher = false;
    let userIsAdmin = false;
    
    // Navigation structure (hardcoded for now, can be made dynamic later)
    const navStructure = [
        {
            slug: 'what-we-like',
            name: 'What We Like',
            icon: '❤️',
            expanded: true,
            items: [
                { name: 'Activity Preferences', icon: '❤️', url: '/preferences-manager.html', slug: 'preferences-manager.html' },
                { name: 'Kid Management', icon: '👶', url: '/kid-prefs.html', slug: 'kid-prefs.html' },
                { name: 'Who Likes What?', icon: '👨‍👩‍👧‍👦', url: '/kids-activity-view.html', slug: 'kids-activity-view.html' },
                { name: 'Recommendations', icon: '✨', url: '/recommendations.html', slug: 'recommendations.html' },
                { name: 'Teacher Dashboard', icon: '🏫', url: '/teacher-dashboard.html', slug: 'teacher-dashboard.html', requiresTeacher: true },
                { name: 'Settings', icon: '⚙️', url: '/recommendation-settings.html', slug: 'recommendation-settings.html' }
            ]
        },
        {
            slug: 'future-apps',
            name: 'Coming Soon',
            icon: '🌟',
            expanded: false,
            comingSoon: true,
            items: [
                { name: 'House Rules', icon: '📋', comingSoon: true },
                { name: 'Food Explorer', icon: '🍽️', comingSoon: true },
                { name: 'Try This', icon: '🎯', comingSoon: true },
                { name: 'Little Earners', icon: '💰', comingSoon: true }
            ]
        }
    ];
    
    // Check user permissions
    async function checkUserPermissions() {
        try {
            if (window.supabaseUtils) {
                const user = await window.supabaseUtils.getCurrentUser();
                if (user) {
                    userIsTeacher = await window.supabaseUtils.isTeacher(user.id);
                    userIsAdmin = await window.supabaseUtils.isAdmin(user.id);
                }
            }
        } catch (error) {
            console.error('Error checking user permissions for sidebar:', error);
        }
    }
    
    // Initialize sidebar navigation
    async function initSidebarNav() {
        // Check user permissions first
        await checkUserPermissions();
        
        // Load saved state
        loadSidebarState();
        
        // Render navigation
        renderSidebar();
        
        // Set up event listeners
        setupEventListeners();
        
        // Apply initial state
        applySidebarState();
        
        // Auto-expand section containing current page
        autoExpandCurrentSection();
    }
    
    // Load sidebar state from localStorage
    function loadSidebarState() {
        const saved = localStorage.getItem('homebase-sidebar-state');
        if (saved) {
            try {
                sidebarState = JSON.parse(saved);
            } catch (e) {
                console.error('Error loading sidebar state:', e);
            }
        }
    }
    
    // Save sidebar state to localStorage
    function saveSidebarState() {
        localStorage.setItem('homebase-sidebar-state', JSON.stringify(sidebarState));
    }
    
    // Render sidebar navigation
    function renderSidebar() {
        const content = document.getElementById('sidebarContent');
        if (!content) return;
        
        content.innerHTML = '';
        
        navStructure.forEach(section => {
            const sectionEl = createSectionElement(section);
            content.appendChild(sectionEl);
        });
    }
    
    // Create section element
    function createSectionElement(section) {
        const sectionDiv = document.createElement('div');
        sectionDiv.className = 'sidebar-section';
        sectionDiv.id = `section-${section.slug}`;
        
        if (sidebarState.expandedSections.includes(section.slug)) {
            sectionDiv.classList.add('expanded');
        }
        
        // Section header
        const header = document.createElement('div');
        header.className = 'sidebar-section-header';
        header.dataset.tooltip = section.name;
        
        if (section.items && section.items.length > 0) {
            header.onclick = () => toggleSection(section.slug);
        } else if (section.url) {
            header.onclick = () => window.location.href = section.url;
        }
        
        header.innerHTML = `
            <div class="sidebar-section-left">
                <span class="sidebar-section-icon">${section.icon}</span>
                <span class="sidebar-section-label">${section.name}</span>
            </div>
            ${section.items && section.items.length > 0 ? '<span class="sidebar-expand-icon">›</span>' : ''}
        `;
        
        sectionDiv.appendChild(header);
        
        // Section items
        if (section.items && section.items.length > 0) {
            const itemsContainer = document.createElement('div');
            itemsContainer.className = 'sidebar-section-items';
            
            section.items.forEach(item => {
                const itemEl = createItemElement(item);
                // Only append if item should be shown (not filtered out)
                if (itemEl) {
                    itemsContainer.appendChild(itemEl);
                }
            });
            
            sectionDiv.appendChild(itemsContainer);
        }
        
        return sectionDiv;
    }
    
    // Check if item should be visible based on permissions
    function shouldShowItem(item) {
        // If item requires teacher access, check permissions
        if (item.requiresTeacher) {
            return userIsTeacher || userIsAdmin;
        }
        return true;
    }
    
    // Create item element
    function createItemElement(item) {
        // Check if item should be shown
        if (!shouldShowItem(item)) {
            return null;
        }
        
        const itemLink = document.createElement('a');
        itemLink.className = 'sidebar-item';
        itemLink.dataset.tooltip = item.name;
        
        if (item.comingSoon) {
            itemLink.href = '#';
            itemLink.onclick = (e) => {
                e.preventDefault();
                alert('Coming soon! This feature is in development.');
            };
        } else {
            itemLink.href = item.url;
            
            // Check if this is the current page
            if (isCurrentPage(item.url)) {
                itemLink.classList.add('active');
            }
        }
        
        itemLink.innerHTML = `
            <span class="sidebar-item-icon">${item.icon}</span>
            <span class="sidebar-item-text">${item.name}</span>
            ${item.comingSoon ? '<span class="coming-soon-badge">Soon</span>' : ''}
        `;
        
        return itemLink;
    }
    
    // Check if URL is current page
    function isCurrentPage(url) {
        if (!url) return false;
        const urlPage = url.split('/').pop();
        
        // Handle index.html being the parental prefs page
        if (currentPage === 'index.html' && urlPage === 'preferences-manager.html') {
            return false;
        }
        if (currentPage === 'preferences-manager.html' && urlPage === 'preferences-manager.html') {
            return true;
        }
        
        return currentPage === urlPage;
    }
    
    // Toggle section expand/collapse
    function toggleSection(slug) {
        const index = sidebarState.expandedSections.indexOf(slug);
        if (index > -1) {
            sidebarState.expandedSections.splice(index, 1);
        } else {
            sidebarState.expandedSections.push(slug);
        }
        
        saveSidebarState();
        
        const sectionEl = document.getElementById(`section-${slug}`);
        if (sectionEl) {
            sectionEl.classList.toggle('expanded');
        }
    }
    
    // Auto-expand section containing current page
    function autoExpandCurrentSection() {
        navStructure.forEach(section => {
            if (section.items) {
                const hasCurrentPage = section.items.some(item => isCurrentPage(item.url));
                if (hasCurrentPage && !sidebarState.expandedSections.includes(section.slug)) {
                    sidebarState.expandedSections.push(section.slug);
                    saveSidebarState();
                    const sectionEl = document.getElementById(`section-${section.slug}`);
                    if (sectionEl) {
                        sectionEl.classList.add('expanded');
                    }
                }
            }
        });
    }
    
    // Set up event listeners
    function setupEventListeners() {
        // Sidebar toggle button
        const toggleBtn = document.getElementById('sidebarToggleBtn');
        if (toggleBtn) {
            toggleBtn.addEventListener('click', toggleSidebarCollapse);
        }
        
        // Mobile sidebar toggle
        const mobileToggle = document.getElementById('mobileSidebarToggle');
        if (mobileToggle) {
            mobileToggle.addEventListener('click', toggleMobileSidebar);
        }
        
        // Mobile overlay
        const overlay = document.getElementById('sidebarOverlay');
        if (overlay) {
            overlay.addEventListener('click', closeMobileSidebar);
        }
    }
    
    // Toggle sidebar collapse
    function toggleSidebarCollapse() {
        sidebarState.collapsed = !sidebarState.collapsed;
        saveSidebarState();
        applySidebarState();
    }
    
    // Apply sidebar state
    function applySidebarState() {
        const sidebar = document.getElementById('sidebarNav');
        if (!sidebar) return;
        
        if (sidebarState.collapsed) {
            sidebar.classList.add('collapsed');
            document.body.style.marginLeft = 'var(--sidebar-width-collapsed)';
        } else {
            sidebar.classList.remove('collapsed');
            document.body.style.marginLeft = 'var(--sidebar-width)';
        }
    }
    
    // Toggle mobile sidebar
    function toggleMobileSidebar() {
        const sidebar = document.getElementById('sidebarNav');
        const overlay = document.getElementById('sidebarOverlay');
        
        if (sidebar && overlay) {
            sidebar.classList.toggle('mobile-open');
            overlay.classList.toggle('show');
        }
    }
    
    // Close mobile sidebar
    function closeMobileSidebar() {
        const sidebar = document.getElementById('sidebarNav');
        const overlay = document.getElementById('sidebarOverlay');
        
        if (sidebar && overlay) {
            sidebar.classList.remove('mobile-open');
            overlay.classList.remove('show');
        }
    }
    
    // Export to window for external access if needed
    window.sidebarNav = {
        init: initSidebarNav,
        toggle: toggleSidebarCollapse
    };
    
    // Auto-initialize after DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initSidebarNav);
    } else {
        // DOM already loaded
        setTimeout(initSidebarNav, 100);
    }
})();
