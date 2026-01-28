// Kid Management JavaScript
// Handles kid profile management and preferences

let currentUser = null;
let kids = [];
let editingKidId = null;

// Avatar emojis for kids
const KID_AVATARS = ['👶', '👧', '👦', '🧒', '👨', '👩', '😊', '😃', '🤗', '🥰', '😎', '🤓', '🌟', '⭐', '🌈', '🦄'];

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
        
        // Load avatar picker
        renderAvatarPicker();
        
        // Load kids
        await loadKids();
        
    } catch (error) {
        console.error('Error initializing:', error);
        showError('Failed to initialize kid preferences');
    }
});

// Set up event listeners
function setupEventListeners() {
    document.getElementById('addKidBtn').addEventListener('click', () => {
        openKidModal();
    });
    
    document.getElementById('kidForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        await saveKid();
    });
}

// Load all kids for current user
async function loadKids() {
    try {
        const supabaseClient = window.supabaseUtils.getClient();
        
        const { data, error } = await supabaseClient
            .from('kids')
            .select('*')
            .eq('parent_id', currentUser.id)
            .eq('is_active', true)
            .order('created_at', { ascending: false });
        
        if (error) throw error;
        
        kids = data || [];
        
        // Load preferences count for each kid
        for (let kid of kids) {
            const { data: prefs, error: prefError } = await supabaseClient
                .from('kid_preferences')
                .select('id, preference_level')
                .eq('kid_id', kid.id);
            
            if (!prefError && prefs) {
                kid.total_preferences = prefs.length;
                kid.loves_count = prefs.filter(p => p.preference_level === 'loves').length;
                kid.likes_count = prefs.filter(p => p.preference_level === 'likes').length;
            } else {
                kid.total_preferences = 0;
                kid.loves_count = 0;
                kid.likes_count = 0;
            }
        }
        
        renderKids();
        
    } catch (error) {
        console.error('Error loading kids:', error);
        showError('Failed to load kids: ' + error.message);
    }
}

// Render kids grid
function renderKids() {
    const grid = document.getElementById('kidsGrid');
    const emptyState = document.getElementById('emptyState');
    
    if (kids.length === 0) {
        grid.style.display = 'none';
        emptyState.style.display = 'block';
        return;
    }
    
    grid.style.display = 'grid';
    emptyState.style.display = 'none';
    grid.innerHTML = '';
    
    kids.forEach(kid => {
        const card = createKidCard(kid);
        grid.appendChild(card);
    });
}

// Create kid card
function createKidCard(kid) {
    const card = document.createElement('div');
    card.className = 'kid-card';
    
    // Calculate age
    let ageText = '';
    if (kid.birth_date) {
        const birthDate = new Date(kid.birth_date);
        const ageYears = Math.floor((new Date() - birthDate) / (365.25 * 24 * 60 * 60 * 1000));
        ageText = `${ageYears} years old`;
    }
    
    card.innerHTML = `
        <div class="kid-card-header">
            <div class="kid-avatar">${kid.avatar_emoji}</div>
            <div class="kid-info">
                <h3>${kid.name}</h3>
                ${kid.nickname ? `<div class="kid-age">"${kid.nickname}"</div>` : ''}
                ${ageText ? `<div class="kid-age">${ageText}</div>` : ''}
            </div>
        </div>
        
        <div class="kid-stats">
            <div class="stat">
                <div class="stat-value">${kid.total_preferences || 0}</div>
                <div class="stat-label">Activities</div>
            </div>
            <div class="stat">
                <div class="stat-value">${kid.loves_count || 0}</div>
                <div class="stat-label">Loves</div>
            </div>
            <div class="stat">
                <div class="stat-value">${kid.likes_count || 0}</div>
                <div class="stat-label">Likes</div>
            </div>
        </div>
        
        <div class="kid-actions">
            <button class="btn btn-primary btn-small" onclick="manageAccess('${kid.id}')">
                👥 Teachers
            </button>
            <button class="btn btn-secondary btn-small" onclick="editKid('${kid.id}')">
                ✏️ Edit
            </button>
            <button class="btn btn-secondary btn-small" onclick="deleteKid('${kid.id}')">
                🗑️ Delete
            </button>
        </div>
    `;
    
    return card;
}

// Open kid modal
function openKidModal(kidId = null) {
    editingKidId = kidId;
    const modal = document.getElementById('kidModal');
    const title = document.getElementById('kidModalTitle');
    const form = document.getElementById('kidForm');
    
    form.reset();
    document.getElementById('kidId').value = kidId || '';
    
    // Reset avatar selection
    document.querySelectorAll('.emoji-option').forEach(opt => opt.classList.remove('selected'));
    
    if (kidId) {
        title.textContent = 'Edit Kid';
        const kid = kids.find(k => k.id === kidId);
        if (kid) {
            document.getElementById('kidName').value = kid.name;
            document.getElementById('kidNickname').value = kid.nickname || '';
            document.getElementById('kidBirthDate').value = kid.birth_date || '';
            document.getElementById('kidAvatar').value = kid.avatar_emoji;
            document.getElementById('kidNotes').value = kid.notes || '';
            
            // Select avatar
            document.querySelectorAll('.emoji-option').forEach(opt => {
                if (opt.textContent === kid.avatar_emoji) {
                    opt.classList.add('selected');
                }
            });
        }
    } else {
        title.textContent = 'Add Kid';
        // Select default avatar
        const defaultAvatar = document.querySelector('.emoji-option');
        if (defaultAvatar) {
            defaultAvatar.classList.add('selected');
            document.getElementById('kidAvatar').value = defaultAvatar.textContent;
        }
    }
    
    modal.classList.add('show');
}

// Close kid modal
function closeKidModal() {
    document.getElementById('kidModal').classList.remove('show');
    editingKidId = null;
}

// Save kid
async function saveKid() {
    try {
        const supabaseClient = window.supabaseUtils.getClient();
        
        const name = document.getElementById('kidName').value.trim();
        const nickname = document.getElementById('kidNickname').value.trim();
        const birthDate = document.getElementById('kidBirthDate').value;
        const avatarEmoji = document.getElementById('kidAvatar').value;
        const notes = document.getElementById('kidNotes').value.trim();
        
        if (!name) {
            showError('Please enter a name');
            return;
        }
        
        if (!avatarEmoji) {
            showError('Please select an avatar');
            return;
        }
        
        const kidData = {
            name,
            nickname: nickname || null,
            birth_date: birthDate || null,
            avatar_emoji: avatarEmoji,
            notes: notes || null
        };
        
        if (editingKidId) {
            // Update existing kid
            const { error } = await supabaseClient
                .from('kids')
                .update(kidData)
                .eq('id', editingKidId);
            
            if (error) throw error;
            
            showSuccess('Kid updated successfully!');
        } else {
            // Create new kid
            kidData.parent_id = currentUser.id;
            
            const { error } = await supabaseClient
                .from('kids')
                .insert(kidData);
            
            if (error) throw error;
            
            showSuccess('Kid added successfully!');
        }
        
        closeKidModal();
        await loadKids();
        
    } catch (error) {
        console.error('Error saving kid:', error);
        showError('Failed to save kid: ' + error.message);
    }
}

// Edit kid
function editKid(kidId) {
    openKidModal(kidId);
}

// Delete kid
async function deleteKid(kidId) {
    const kid = kids.find(k => k.id === kidId);
    if (!kid) return;
    
    if (!confirm(`Are you sure you want to delete ${kid.name}'s profile?\n\nThis will also delete all their preferences.`)) {
        return;
    }
    
    try {
        const supabaseClient = window.supabaseUtils.getClient();
        
        const { error } = await supabaseClient
            .from('kids')
            .delete()
            .eq('id', kidId);
        
        if (error) throw error;
        
        showSuccess(`${kid.name}'s profile deleted`);
        await loadKids();
        
    } catch (error) {
        console.error('Error deleting kid:', error);
        showError('Failed to delete kid: ' + error.message);
    }
}

// Manage teacher access for a kid
function manageAccess(kidId) {
    window.location.href = `/kid-access-management.html?kid=${kidId}`;
}

// Render avatar picker
function renderAvatarPicker() {
    const picker = document.getElementById('avatarPicker');
    picker.innerHTML = '';
    
    KID_AVATARS.forEach(emoji => {
        const option = document.createElement('div');
        option.className = 'emoji-option';
        option.textContent = emoji;
        option.addEventListener('click', () => {
            document.querySelectorAll('.emoji-option').forEach(opt => opt.classList.remove('selected'));
            option.classList.add('selected');
            document.getElementById('kidAvatar').value = emoji;
        });
        picker.appendChild(option);
    });
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
