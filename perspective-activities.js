// Perspective Activities Library Logic
let currentUser = null;
let activities = [];
let currentFilter = 'all';

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
    const supabase = await window.supabaseUtils.initSupabase();
    
    if (!supabase) {
        showMessage('Failed to initialize authentication', 'error');
        return;
    }
    
    // Check authentication
    currentUser = await window.supabaseUtils.getCurrentUser();
    
    if (!currentUser) {
        window.location.href = '/auth.html';
        return;
    }
    
    // Load activities
    await loadActivities();
});

// Load activities based on filter
async function loadActivities() {
    const loadingEl = document.getElementById('loadingContainer');
    const containerEl = document.getElementById('activitiesContainer');
    
    loadingEl.style.display = 'block';
    containerEl.innerHTML = '';
    
    try {
        const supabaseClient = window.supabaseUtils.getClient();
        
        let query = supabaseClient
            .from('perspective_activities')
            .select('*')
            .order('created_at', { ascending: false });
        
        // Apply filter
        if (currentFilter === 'mine') {
            query = query.eq('created_by', currentUser.id);
        } else if (currentFilter === 'public') {
            query = query.eq('is_public', true);
        } else {
            // 'all' - show mine + public
            query = query.or(`created_by.eq.${currentUser.id},is_public.eq.true`);
        }
        
        const { data, error } = await query;
        
        if (error) throw error;
        
        activities = data || [];
        
        // Render activities
        if (activities.length === 0) {
            containerEl.innerHTML = `
                <div class="empty-state">
                    <div class="icon">📚</div>
                    <h3>No Activities ${currentFilter === 'mine' ? 'Created' : 'Found'}</h3>
                    <p>${currentFilter === 'mine' 
                        ? 'Create your first perspective-taking activity to share with kids!' 
                        : 'Try changing the filter or create a new activity.'}</p>
                    <button class="btn btn-primary" onclick="openActivityModal()" style="margin-top: 15px;">
                        ➕ Create Activity
                    </button>
                </div>
            `;
        } else {
            activities.forEach(activity => {
                const card = createActivityCard(activity);
                containerEl.appendChild(card);
            });
        }
        
        loadingEl.style.display = 'none';
        
    } catch (error) {
        console.error('Error loading activities:', error);
        loadingEl.style.display = 'none';
        showMessage('Failed to load activities: ' + error.message, 'error');
    }
}

// Create activity card
function createActivityCard(activity) {
    const card = document.createElement('div');
    card.className = 'activity-card';
    card.onclick = () => showActivityDetails(activity);
    
    const isMine = activity.created_by === currentUser.id;
    const createdDate = new Date(activity.created_at).toLocaleDateString();
    
    card.innerHTML = `
        <div class="activity-header">
            <div class="activity-title">${activity.title}</div>
        </div>
        <div class="activity-meta">
            ${activity.age_range ? `<span class="meta-badge">👶 ${activity.age_range}</span>` : ''}
            ${activity.duration_minutes ? `<span class="meta-badge">⏱️ ${activity.duration_minutes} min</span>` : ''}
            ${activity.is_public ? '<span class="public-badge">🌍 Public</span>' : '<span class="meta-badge">🔒 Private</span>'}
        </div>
        <div class="activity-description">
            ${activity.description.length > 150 
                ? activity.description.substring(0, 150) + '...' 
                : activity.description}
        </div>
        <div class="activity-footer">
            <span style="font-size: 0.85rem; color: #999;">${isMine ? 'Your activity' : 'Community'}</span>
            <span style="font-size: 0.85rem; color: #999;">Added ${createdDate}</span>
        </div>
    `;
    
    return card;
}

// Show activity details
function showActivityDetails(activity) {
    const modal = document.getElementById('detailModal');
    const content = document.getElementById('detailContent');
    const title = document.getElementById('detailTitle');
    
    title.textContent = activity.title;
    
    const isMine = activity.created_by === currentUser.id;
    
    content.innerHTML = `
        <div class="activity-meta" style="margin-bottom: 20px;">
            ${activity.age_range ? `<span class="meta-badge">👶 ${activity.age_range}</span>` : ''}
            ${activity.duration_minutes ? `<span class="meta-badge">⏱️ ${activity.duration_minutes} minutes</span>` : ''}
            ${activity.is_public ? '<span class="public-badge">🌍 Public</span>' : '<span class="meta-badge">🔒 Private</span>'}
        </div>
        
        <div class="detail-section">
            <h3>📝 Description</h3>
            <p>${activity.description}</p>
        </div>
        
        ${activity.materials_needed ? `
            <div class="detail-section">
                <h3>🎨 Materials Needed</h3>
                <p>${activity.materials_needed}</p>
            </div>
        ` : ''}
        
        <div class="detail-section">
            <h3>📋 Instructions</h3>
            <p style="white-space: pre-wrap;">${activity.instructions}</p>
        </div>
        
        ${activity.learning_goals ? `
            <div class="detail-section">
                <h3>🎯 Learning Goals</h3>
                <p>${activity.learning_goals}</p>
            </div>
        ` : ''}
        
        <div style="display: flex; gap: 10px; justify-content: flex-end; margin-top: 30px;">
            ${isMine ? `<button class="btn btn-secondary" onclick="editActivity('${activity.id}')">Edit</button>` : ''}
            <button class="btn btn-secondary" onclick="closeDetailModal()">Close</button>
        </div>
    `;
    
    modal.classList.add('show');
}

// Close detail modal
function closeDetailModal() {
    document.getElementById('detailModal').classList.remove('show');
}

// Filter activities
function filterActivities(filter) {
    currentFilter = filter;
    
    // Update button states
    document.querySelectorAll('.filter-bar button[data-filter]').forEach(btn => {
        btn.classList.remove('active');
    });
    document.querySelector(`.filter-bar button[data-filter="${filter}"]`).classList.add('active');
    
    // Reload activities
    loadActivities();
}

// Open activity modal
function openActivityModal() {
    const modal = document.getElementById('activityModal');
    const form = document.getElementById('activityForm');
    
    form.reset();
    modal.classList.add('show');
}

// Close activity modal
function closeActivityModal() {
    document.getElementById('activityModal').classList.remove('show');
}

// Save activity
async function saveActivity() {
    try {
        const supabaseClient = window.supabaseUtils.getClient();
        
        const title = document.getElementById('actTitle').value.trim();
        const description = document.getElementById('actDescription').value.trim();
        const ageRange = document.getElementById('actAgeRange').value.trim();
        const duration = document.getElementById('actDuration').value;
        const materials = document.getElementById('actMaterials').value.trim();
        const instructions = document.getElementById('actInstructions').value.trim();
        const goals = document.getElementById('actGoals').value.trim();
        const isPublic = document.getElementById('actPublic').checked;
        
        if (!title || !description || !instructions) {
            showMessage('Please fill in all required fields', 'error');
            return;
        }
        
        // Insert activity
        const { error } = await supabaseClient
            .from('perspective_activities')
            .insert({
                created_by: currentUser.id,
                title: title,
                description: description,
                age_range: ageRange || null,
                duration_minutes: duration ? parseInt(duration) : null,
                materials_needed: materials || null,
                instructions: instructions,
                learning_goals: goals || null,
                is_public: isPublic
            });
        
        if (error) throw error;
        
        showMessage('✅ Activity created successfully!', 'success');
        closeActivityModal();
        
        // Reload activities
        await loadActivities();
        
    } catch (error) {
        console.error('Error saving activity:', error);
        showMessage('Failed to save activity: ' + error.message, 'error');
    }
}

// Edit activity (placeholder - would open modal with existing data)
function editActivity(activityId) {
    // For now, just show message
    showMessage('Edit functionality coming soon!', 'error');
    closeDetailModal();
}

// Show message
function showMessage(message, type = 'success') {
    const container = document.getElementById('messageContainer');
    const className = type === 'success' ? 'success' : 'error';
    container.innerHTML = `<div class="${className}">${message}</div>`;
    
    setTimeout(() => {
        container.innerHTML = '';
    }, 5000);
}
