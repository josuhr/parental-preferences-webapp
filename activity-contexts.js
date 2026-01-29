// Activity Contexts Management JavaScript
// Handles viewing and editing context tags for activities

let currentUser = null;
let activities = [];
let categories = [];
let contexts = [];
let activityContexts = {};
let selectedActivityId = null;
let selectedContextId = null;

// Initialize on page load
document.addEventListener('DOMContentLoaded', async () => {
    try {
        // Check authentication
        currentUser = await window.supabaseUtils.getCurrentUser();
        if (!currentUser) {
            window.location.href = '/auth.html';
            return;
        }

        // Set up event listeners
        setupEventListeners();
        
        // Load data
        await loadAllData();
        
    } catch (error) {
        console.error('Error initializing:', error);
        showError('Failed to initialize activity contexts');
    }
});

// Set up event listeners
function setupEventListeners() {
    document.getElementById('searchInput').addEventListener('input', filterActivities);
    document.getElementById('categoryFilter').addEventListener('change', filterActivities);
    document.getElementById('contextFilter').addEventListener('change', filterActivities);
    
    document.getElementById('addContextTypeBtn').addEventListener('click', openNewContextModal);
    document.getElementById('newContextForm').addEventListener('submit', saveNewContext);
    
    document.getElementById('fitScoreInput').addEventListener('input', (e) => {
        document.getElementById('fitScoreDisplay').textContent = parseFloat(e.target.value).toFixed(2);
    });
}

// Load all data
async function loadAllData() {
    const supabaseClient = window.supabaseUtils.getClient();
    
    try {
        // Load categories
        const { data: catData, error: catError } = await supabaseClient
            .from('kid_activity_categories')
            .select('*')
            .is('parent_id', null)
            .order('sort_order');
        
        if (catError) throw catError;
        categories = catData || [];
        
        // Populate category filter
        const categorySelect = document.getElementById('categoryFilter');
        categories.forEach(cat => {
            const option = document.createElement('option');
            option.value = cat.id;
            option.textContent = `${cat.icon} ${cat.name}`;
            categorySelect.appendChild(option);
        });
        
        // Load activities with their categories
        const { data: actData, error: actError } = await supabaseClient
            .from('kid_activities')
            .select(`
                *,
                kid_activity_categories!inner (
                    id,
                    name,
                    icon,
                    parent_id
                )
            `)
            .order('sort_order');
        
        if (actError) throw actError;
        
        // Filter to universal activities only
        activities = (actData || []).filter(a => a.kid_activity_categories.parent_id === null);
        
        // Load contexts
        const { data: ctxData, error: ctxError } = await supabaseClient
            .from('recommendation_contexts')
            .select('*')
            .order('name');
        
        if (ctxError) throw ctxError;
        contexts = ctxData || [];
        
        // Load activity-context mappings
        const { data: mappingData, error: mappingError } = await supabaseClient
            .from('activity_contexts')
            .select('*');
        
        if (mappingError) throw mappingError;
        
        // Organize mappings by activity
        activityContexts = {};
        (mappingData || []).forEach(mapping => {
            if (!activityContexts[mapping.activity_id]) {
                activityContexts[mapping.activity_id] = [];
            }
            activityContexts[mapping.activity_id].push(mapping);
        });
        
        // Update stats
        updateStats(mappingData || []);
        
        // Render activities
        renderActivities();
        
    } catch (error) {
        console.error('Error loading data:', error);
        showError('Failed to load activity data: ' + error.message);
    }
}

// Update statistics display
function updateStats(mappings) {
    document.getElementById('totalActivities').textContent = activities.length;
    document.getElementById('activitiesWithContexts').textContent = 
        Object.keys(activityContexts).length;
    document.getElementById('totalContextTypes').textContent = contexts.length;
    document.getElementById('totalMappings').textContent = mappings.length;
}

// Render activities list
function renderActivities() {
    const container = document.getElementById('activityList');
    const searchTerm = document.getElementById('searchInput').value.toLowerCase();
    const categoryId = document.getElementById('categoryFilter').value;
    const contextStatus = document.getElementById('contextFilter').value;
    
    let filtered = activities;
    
    // Filter by search
    if (searchTerm) {
        filtered = filtered.filter(a => 
            a.name.toLowerCase().includes(searchTerm) ||
            (a.description && a.description.toLowerCase().includes(searchTerm))
        );
    }
    
    // Filter by category
    if (categoryId) {
        filtered = filtered.filter(a => a.category_id === categoryId);
    }
    
    // Filter by context status
    if (contextStatus === 'with') {
        filtered = filtered.filter(a => activityContexts[a.id] && activityContexts[a.id].length > 0);
    } else if (contextStatus === 'without') {
        filtered = filtered.filter(a => !activityContexts[a.id] || activityContexts[a.id].length === 0);
    }
    
    if (filtered.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <h3>No activities found</h3>
                <p>Try adjusting your search or filters.</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = filtered.map(activity => createActivityItem(activity)).join('');
}

// Create activity item HTML
function createActivityItem(activity) {
    const category = activity.kid_activity_categories;
    const actContexts = activityContexts[activity.id] || [];
    
    const contextTags = actContexts.map(ac => {
        const context = contexts.find(c => c.id === ac.context_id);
        if (!context) return '';
        return `
            <span class="context-tag">
                ${context.name}
                <span class="fit-score">${Math.round(ac.fit_score * 100)}%</span>
                <button class="remove-btn" onclick="removeContext('${activity.id}', '${ac.id}')" title="Remove">×</button>
            </span>
        `;
    }).join('');
    
    return `
        <div class="activity-item" data-activity-id="${activity.id}">
            <div class="activity-header">
                <div class="activity-info">
                    <h3>${category.icon} ${activity.name}</h3>
                    <div class="category">${category.name}</div>
                    ${activity.description ? `<div class="description">${activity.description}</div>` : ''}
                </div>
            </div>
            <div class="context-tags">
                ${contextTags || '<span class="no-contexts">No contexts assigned</span>'}
                <button class="add-context-btn" onclick="openAddContextModal('${activity.id}')">
                    + Add Context
                </button>
            </div>
        </div>
    `;
}

// Filter activities
function filterActivities() {
    renderActivities();
}

// Open add context modal
function openAddContextModal(activityId) {
    selectedActivityId = activityId;
    selectedContextId = null;
    
    const activity = activities.find(a => a.id === activityId);
    if (!activity) return;
    
    document.getElementById('activityNameDisplay').textContent = activity.name;
    
    // Get existing context IDs for this activity
    const existingContextIds = (activityContexts[activityId] || []).map(ac => ac.context_id);
    
    // Render available contexts
    const container = document.getElementById('contextOptionsList');
    const availableContexts = contexts.filter(c => !existingContextIds.includes(c.id));
    
    if (availableContexts.length === 0) {
        container.innerHTML = '<p style="color: #999; text-align: center;">All contexts already assigned to this activity.</p>';
    } else {
        container.innerHTML = availableContexts.map(ctx => `
            <div class="context-option" data-context-id="${ctx.id}" onclick="selectContext('${ctx.id}')">
                <span class="name">${ctx.name}</span>
                <span class="desc">${ctx.description || ctx.context_type}</span>
            </div>
        `).join('');
    }
    
    // Reset fit score
    document.getElementById('fitScoreInput').value = 0.80;
    document.getElementById('fitScoreDisplay').textContent = '0.80';
    
    document.getElementById('addContextModal').classList.add('show');
}

// Close add context modal
function closeAddContextModal() {
    document.getElementById('addContextModal').classList.remove('show');
    selectedActivityId = null;
    selectedContextId = null;
}

// Select context in modal
function selectContext(contextId) {
    selectedContextId = contextId;
    
    // Update visual selection
    document.querySelectorAll('.context-option').forEach(opt => {
        opt.classList.remove('selected');
        if (opt.dataset.contextId === contextId) {
            opt.classList.add('selected');
        }
    });
}

// Save activity context mapping
async function saveActivityContext() {
    if (!selectedActivityId || !selectedContextId) {
        showError('Please select a context');
        return;
    }
    
    const fitScore = parseFloat(document.getElementById('fitScoreInput').value);
    
    try {
        const supabaseClient = window.supabaseUtils.getClient();
        
        const { data, error } = await supabaseClient
            .from('activity_contexts')
            .insert({
                activity_id: selectedActivityId,
                context_id: selectedContextId,
                fit_score: fitScore
            })
            .select()
            .single();
        
        if (error) throw error;
        
        // Update local data
        if (!activityContexts[selectedActivityId]) {
            activityContexts[selectedActivityId] = [];
        }
        activityContexts[selectedActivityId].push(data);
        
        closeAddContextModal();
        renderActivities();
        showSuccess('Context added successfully!');
        
        // Update stats
        const totalMappings = Object.values(activityContexts).flat().length;
        document.getElementById('totalMappings').textContent = totalMappings;
        document.getElementById('activitiesWithContexts').textContent = Object.keys(activityContexts).length;
        
    } catch (error) {
        console.error('Error saving context:', error);
        showError('Failed to save context: ' + error.message);
    }
}

// Remove context from activity
async function removeContext(activityId, mappingId) {
    if (!confirm('Remove this context from the activity?')) return;
    
    try {
        const supabaseClient = window.supabaseUtils.getClient();
        
        const { error } = await supabaseClient
            .from('activity_contexts')
            .delete()
            .eq('id', mappingId);
        
        if (error) throw error;
        
        // Update local data
        if (activityContexts[activityId]) {
            activityContexts[activityId] = activityContexts[activityId].filter(ac => ac.id !== mappingId);
            if (activityContexts[activityId].length === 0) {
                delete activityContexts[activityId];
            }
        }
        
        renderActivities();
        showSuccess('Context removed');
        
        // Update stats
        const totalMappings = Object.values(activityContexts).flat().length;
        document.getElementById('totalMappings').textContent = totalMappings;
        document.getElementById('activitiesWithContexts').textContent = Object.keys(activityContexts).length;
        
    } catch (error) {
        console.error('Error removing context:', error);
        showError('Failed to remove context: ' + error.message);
    }
}

// Open new context modal
function openNewContextModal() {
    document.getElementById('newContextForm').reset();
    document.getElementById('newContextModal').classList.add('show');
}

// Close new context modal
function closeNewContextModal() {
    document.getElementById('newContextModal').classList.remove('show');
}

// Save new context type
async function saveNewContext(e) {
    e.preventDefault();
    
    const name = document.getElementById('contextName').value.trim();
    const description = document.getElementById('contextDescription').value.trim();
    const contextType = document.getElementById('contextType').value;
    
    if (!name) {
        showError('Please enter a context name');
        return;
    }
    
    try {
        const supabaseClient = window.supabaseUtils.getClient();
        
        // Build attributes based on context type
        const attributes = {};
        if (contextType === 'location') {
            attributes.location = name.toLowerCase().replace(/\s+/g, '_');
        } else if (contextType === 'energy_level') {
            attributes.energy = name.toLowerCase().includes('high') ? 'high' : 
                              name.toLowerCase().includes('low') ? 'low' : 'medium';
        } else if (contextType === 'time_of_day') {
            attributes.time_of_day = name.toLowerCase().replace(/\s+/g, '_');
        }
        
        const { data, error } = await supabaseClient
            .from('recommendation_contexts')
            .insert({
                name,
                description: description || null,
                context_type: contextType,
                attributes
            })
            .select()
            .single();
        
        if (error) throw error;
        
        // Update local data
        contexts.push(data);
        
        closeNewContextModal();
        showSuccess('Context type created successfully!');
        
        // Update stats
        document.getElementById('totalContextTypes').textContent = contexts.length;
        
    } catch (error) {
        console.error('Error creating context:', error);
        if (error.message.includes('duplicate')) {
            showError('A context with this name already exists');
        } else {
            showError('Failed to create context: ' + error.message);
        }
    }
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
