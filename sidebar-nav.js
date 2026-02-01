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

    // Custom SVG Icons
    const icons = {
        // Section icons
        'heart-filled': `<svg viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
        </svg>`,
        'star': `<svg viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
        </svg>`,

        // What We Like items
        'preferences': `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" xmlns="http://www.w3.org/2000/svg">
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
            <path d="M9 12l2 2 4-4"/>
        </svg>`,
        'child': `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" xmlns="http://www.w3.org/2000/svg">
            <circle cx="12" cy="6" r="3"/>
            <path d="M12 9v4"/>
            <path d="M8 13l4 4 4-4"/>
            <path d="M8 21v-4"/>
            <path d="M16 21v-4"/>
        </svg>`,
        'family': `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" xmlns="http://www.w3.org/2000/svg">
            <circle cx="7" cy="5" r="2"/>
            <circle cx="17" cy="5" r="2"/>
            <circle cx="12" cy="12" r="2.5"/>
            <path d="M7 7v2c0 1.1.9 2 2 2h1"/>
            <path d="M17 7v2c0 1.1-.9 2-2 2h-1"/>
            <path d="M12 14.5v3.5"/>
            <path d="M9 22v-4"/>
            <path d="M15 22v-4"/>
        </svg>`,
        'sparkle': `<svg viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 2L9.5 9.5 2 12l7.5 2.5L12 22l2.5-7.5L22 12l-7.5-2.5L12 2z"/>
            <circle cx="19" cy="5" r="1.5"/>
            <circle cx="5" cy="19" r="1"/>
        </svg>`,
        'school': `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" xmlns="http://www.w3.org/2000/svg">
            <path d="M3 21h18"/>
            <path d="M5 21V7l7-4 7 4v14"/>
            <path d="M9 21v-6h6v6"/>
            <path d="M10 10h4"/>
        </svg>`,
        'settings': `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" xmlns="http://www.w3.org/2000/svg">
            <circle cx="12" cy="12" r="3"/>
            <path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83"/>
        </svg>`,

        // Coming Soon items
        'clipboard': `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" xmlns="http://www.w3.org/2000/svg">
            <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/>
            <rect x="8" y="2" width="8" height="4" rx="1"/>
            <path d="M9 12h6"/>
            <path d="M9 16h6"/>
        </svg>`,
        'utensils': `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" xmlns="http://www.w3.org/2000/svg">
            <path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2"/>
            <path d="M7 2v20"/>
            <path d="M21 15V2v0a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7"/>
        </svg>`,
        'target': `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" xmlns="http://www.w3.org/2000/svg">
            <circle cx="12" cy="12" r="10"/>
            <circle cx="12" cy="12" r="6"/>
            <circle cx="12" cy="12" r="2"/>
            <path d="M12 2v4"/>
            <path d="M12 18v4"/>
            <path d="M2 12h4"/>
            <path d="M18 12h4"/>
        </svg>`,
        'piggybank': `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" xmlns="http://www.w3.org/2000/svg">
            <path d="M19 5c-1.5 0-2.8 1.4-3 2-3.5-1.5-11-.3-11 5 0 1.8 0 3 2 4.5V20h4v-2h3v2h4v-4c1-.5 1.7-1 2-2h2v-4h-2c0-1-.5-1.5-1-2V5z"/>
            <path d="M2 9v1c0 1.1.9 2 2 2h1"/>
            <circle cx="13" cy="9" r="1"/>
        </svg>`,
        'tags': `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" xmlns="http://www.w3.org/2000/svg">
            <path d="M9 5H2v7l9 9 7-7-9-9z"/>
            <circle cx="6" cy="9" r="1.5" fill="currentColor"/>
            <path d="M15 5h-1l7 7-4 4"/>
        </svg>`,
        'admin': `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 2L4 6v6c0 5.5 3.5 10.7 8 12 4.5-1.3 8-6.5 8-12V6l-8-4z"/>
            <path d="M9 12l2 2 4-4"/>
        </svg>`
    };

    // Navigation structure
    const navStructure = [
        {
            slug: 'what-we-like',
            name: 'What We Like',
            icon: 'heart-filled',
            expanded: true,
            items: [
                { name: 'Activity Preferences', icon: 'preferences', url: '/preferences-manager.html', slug: 'preferences-manager.html' },
                { name: 'Kid Management', icon: 'child', url: '/kid-prefs.html', slug: 'kid-prefs.html' },
                { name: 'Who Likes What?', icon: 'family', url: '/kids-activity-view.html', slug: 'kids-activity-view.html' },
                { name: 'Recommendations', icon: 'sparkle', url: '/recommendations.html', slug: 'recommendations.html' },
                { name: 'Activity Contexts', icon: 'tags', url: '/activity-contexts.html', slug: 'activity-contexts.html' },
                { name: 'Teacher Dashboard', icon: 'school', url: '/teacher-dashboard.html', slug: 'teacher-dashboard.html', requiresTeacher: true },
                { name: 'Activity Admin', icon: 'admin', url: '/activity-admin.html', slug: 'activity-admin.html', requiresAdmin: true },
                { name: 'Settings', icon: 'settings', url: '/recommendation-settings.html', slug: 'recommendation-settings.html' }
            ]
        },
        {
            slug: 'future-apps',
            name: 'Coming Soon',
            icon: 'star',
            expanded: false,
            comingSoon: true,
            items: [
                { name: 'House Rules', icon: 'clipboard', comingSoon: true },
                { name: 'Food Explorer', icon: 'utensils', comingSoon: true },
                { name: 'Try This', icon: 'target', comingSoon: true },
                { name: 'Little Earners', icon: 'piggybank', comingSoon: true }
            ]
        }
    ];

    // Get icon HTML
    function getIcon(iconName) {
        return icons[iconName] || '';
    }

    // Check user permissions
    async function checkUserPermissions() {
        try {
            // Wait for supabaseUtils to be available (max 3 seconds)
            let attempts = 0;
            while (!window.supabaseUtils && attempts < 30) {
                await new Promise(resolve => setTimeout(resolve, 100));
                attempts++;
            }

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
        sectionDiv.setAttribute('data-section', section.slug);

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
                <span class="sidebar-section-icon">${getIcon(section.icon)}</span>
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
        // If item requires admin access, check permissions
        if (item.requiresAdmin) {
            return userIsAdmin;
        }
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
            itemLink.classList.add('coming-soon');
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
            <span class="sidebar-item-icon">${getIcon(item.icon)}</span>
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
