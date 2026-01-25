// Teacher Observations Logic
let currentUser = null;
let accessibleKids = [];
let observations = [];

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
    
    // Set today's date as default
    document.getElementById('obsDate').value = new Date().toISOString().split('T')[0];
    
    // Load accessible kids
    await loadAccessibleKids();
    
    // Load observations
    await loadObservations();
    
    // Check URL parameters for auto-open
    const urlParams = new URLSearchParams(window.location.search);
    const action = urlParams.get('action');
    const kidId = urlParams.get('kid');
    
    if (action === 'add' && kidId) {
        openObservationModal(kidId);
    }
});

// Load kids teacher has access to
async function loadAccessibleKids() {
    try {
        const supabaseClient = window.supabaseUtils.getClient();
        
        // Get approved access permissions
        const { data: permissions, error: permError } = await supabaseClient
            .from('kid_access_permissions')
            .select('kid_id')
            .eq('teacher_id', currentUser.id)
            .eq('status', 'approved');
        
        if (permError) throw permError;
        
        if (!permissions || permissions.length === 0) {
            accessibleKids = [];
            return;
        }
        
        const kidIds = permissions.map(p => p.kid_id);
        
        // Get kid details
        const { data: kids, error: kidsError } = await supabaseClient
            .from('kids')
            .select('id, name, avatar_emoji')
            .in('id', kidIds)
            .order('name');
        
        if (kidsError) throw kidsError;
        
        accessibleKids = kids || [];
        
        // Populate kid filters and selects
        populateKidSelects();
        
    } catch (error) {
        console.error('Error loading accessible kids:', error);
        showMessage('Failed to load kids: ' + error.message, 'error');
    }
}

// Populate kid select dropdowns
function populateKidSelects() {
    const kidFilter = document.getElementById('kidFilter');
    const obsKid = document.getElementById('obsKid');
    
    // Clear existing options (except first one)
    kidFilter.innerHTML = '<option value="">All Kids</option>';
    obsKid.innerHTML = '<option value="">Select a kid...</option>';
    
    accessibleKids.forEach(kid => {
        const filterOption = document.createElement('option');
        filterOption.value = kid.id;
        filterOption.textContent = `${kid.avatar_emoji} ${kid.name}`;
        kidFilter.appendChild(filterOption);
        
        const selectOption = filterOption.cloneNode(true);
        obsKid.appendChild(selectOption);
    });
}

// Load observations
async function loadObservations() {
    const loadingEl = document.getElementById('loadingContainer');
    const containerEl = document.getElementById('observationsContainer');
    
    loadingEl.style.display = 'block';
    containerEl.innerHTML = '';
    
    try {
        const supabaseClient = window.supabaseUtils.getClient();
        
        // Get filter values
        const kidFilter = document.getElementById('kidFilter').value;
        const typeFilter = document.getElementById('typeFilter').value;
        
        // Build query
        let query = supabaseClient
            .from('teacher_observations')
            .select('*')
            .eq('teacher_id', currentUser.id)
            .order('observed_date', { ascending: false });
        
        if (kidFilter) {
            query = query.eq('kid_id', kidFilter);
        }
        
        if (typeFilter) {
            query = query.eq('observation_type', typeFilter);
        }
        
        const { data, error } = await query;
        
        if (error) throw error;
        
        observations = data || [];
        
        // Render observations
        if (observations.length === 0) {
            containerEl.innerHTML = `
                <div class="empty-state">
                    <div class="icon">📝</div>
                    <h3>No Observations Yet</h3>
                    <p>Start recording observations about kids' engagement and preferences.</p>
                    <button class="btn btn-primary" onclick="openObservationModal()" style="margin-top: 15px;">
                        ➕ Add First Observation
                    </button>
                </div>
            `;
        } else {
            observations.forEach(obs => {
                const card = createObservationCard(obs);
                containerEl.appendChild(card);
            });
        }
        
        loadingEl.style.display = 'none';
        
    } catch (error) {
        console.error('Error loading observations:', error);
        loadingEl.style.display = 'none';
        showMessage('Failed to load observations: ' + error.message, 'error');
    }
}

// Create observation card
function createObservationCard(obs) {
    const card = document.createElement('div');
    card.className = 'observation-card';
    
    const kid = accessibleKids.find(k => k.id === obs.kid_id);
    const kidName = kid ? `${kid.avatar_emoji} ${kid.name}` : 'Unknown Kid';
    const observedDate = new Date(obs.observed_date).toLocaleDateString();
    const createdDate = new Date(obs.created_at).toLocaleDateString();
    
    card.innerHTML = `
        <div class="observation-header">
            <div class="observation-meta">
                <span class="badge ${obs.observation_type}">${obs.observation_type}</span>
                <span style="color: #999; font-size: 0.9rem;">${kidName}</span>
            </div>
        </div>
        <div class="observation-title">${obs.title}</div>
        ${obs.description ? `<div class="observation-description">${obs.description}</div>` : ''}
        <div class="observation-footer">
            <div>
                <span>📅 Observed: ${observedDate}</span>
                ${!obs.is_visible_to_parent ? '<span style="margin-left: 15px;">🔒 Private</span>' : ''}
            </div>
            <div>Added: ${createdDate}</div>
        </div>
    `;
    
    return card;
}

// Open observation modal
function openObservationModal(preselectedKidId = null) {
    const modal = document.getElementById('observationModal');
    const form = document.getElementById('observationForm');
    
    form.reset();
    document.getElementById('obsDate').value = new Date().toISOString().split('T')[0];
    document.getElementById('obsVisibleToParent').checked = true;
    
    if (preselectedKidId) {
        document.getElementById('obsKid').value = preselectedKidId;
    }
    
    modal.classList.add('show');
}

// Close observation modal
function closeObservationModal() {
    document.getElementById('observationModal').classList.remove('show');
}

// Save observation
async function saveObservation() {
    try {
        const supabaseClient = window.supabaseUtils.getClient();
        
        const kidId = document.getElementById('obsKid').value;
        const type = document.getElementById('obsType').value;
        const title = document.getElementById('obsTitle').value.trim();
        const description = document.getElementById('obsDescription').value.trim();
        const date = document.getElementById('obsDate').value;
        const visibleToParent = document.getElementById('obsVisibleToParent').checked;
        
        if (!kidId || !type || !title) {
            showMessage('Please fill in all required fields', 'error');
            return;
        }
        
        // Verify teacher still has access to this kid
        const { data: access, error: accessError } = await supabaseClient
            .from('kid_access_permissions')
            .select('id')
            .eq('kid_id', kidId)
            .eq('teacher_id', currentUser.id)
            .eq('status', 'approved')
            .single();
        
        if (accessError || !access) {
            showMessage('You no longer have access to this kid', 'error');
            return;
        }
        
        // Insert observation
        const { error: insertError } = await supabaseClient
            .from('teacher_observations')
            .insert({
                kid_id: kidId,
                teacher_id: currentUser.id,
                observation_type: type,
                title: title,
                description: description || null,
                observed_date: date,
                is_visible_to_parent: visibleToParent
            });
        
        if (insertError) throw insertError;
        
        showMessage('✅ Observation saved successfully!', 'success');
        closeObservationModal();
        
        // Reload observations
        await loadObservations();
        
    } catch (error) {
        console.error('Error saving observation:', error);
        showMessage('Failed to save observation: ' + error.message, 'error');
    }
}

// Show message
function showMessage(message, type = 'success') {
    const container = document.getElementById('messageContainer');
    container.innerHTML = `<div class="${type}">${message}</div>`;
    
    setTimeout(() => {
        container.innerHTML = '';
    }, 5000);
}
