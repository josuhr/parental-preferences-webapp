// Kid Access Management Logic
let currentUser = null;
let currentKid = null;
let kidId = null;

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
    
    // Get kid ID from URL
    const urlParams = new URLSearchParams(window.location.search);
    kidId = urlParams.get('kid');
    
    if (!kidId) {
        showMessage('No kid specified', 'error');
        return;
    }
    
    // Load kid data and access list
    await loadKidData();
    await loadAccessList();
});

// Load kid information
async function loadKidData() {
    try {
        const supabaseClient = window.supabaseUtils.getClient();
        
        const { data: kid, error } = await supabaseClient
            .from('kids')
            .select('*')
            .eq('id', kidId)
            .single();
        
        if (error) throw error;
        
        if (!kid || kid.parent_id !== currentUser.id) {
            showMessage('Kid not found or you do not have permission', 'error');
            return;
        }
        
        currentKid = kid;
        
        // Update UI
        document.getElementById('kidAvatar').textContent = kid.avatar_emoji || '👶';
        document.getElementById('kidName').textContent = kid.name;
        document.getElementById('kidNameInline').textContent = kid.name + "'s";
        
    } catch (error) {
        console.error('Error loading kid data:', error);
        showMessage('Failed to load kid data: ' + error.message, 'error');
    }
}

// Load access list
async function loadAccessList() {
    const container = document.getElementById('accessListContainer');
    
    try {
        const supabaseClient = window.supabaseUtils.getClient();
        
        // Get all access permissions for this kid
        const { data: permissions, error } = await supabaseClient
            .from('kid_access_permissions')
            .select('*')
            .eq('kid_id', kidId)
            .order('created_at', { ascending: false });
        
        if (error) throw error;
        
        if (!permissions || permissions.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="icon">👥</div>
                    <p>No teachers have been granted access yet.</p>
                    <p style="font-size: 0.9rem; color: #999;">Use the form above to grant access to a teacher.</p>
                </div>
            `;
            return;
        }
        
        // Get teacher details for each permission
        const teacherIds = permissions.map(p => p.teacher_id);
        
        const { data: teachers, error: teacherError } = await supabaseClient
            .from('users')
            .select('id, email, display_name')
            .in('id', teacherIds);
        
        if (teacherError) throw teacherError;
        
        // Render access list
        container.innerHTML = '';
        const accessList = document.createElement('div');
        accessList.className = 'access-list';
        
        permissions.forEach(permission => {
            const teacher = teachers.find(t => t.id === permission.teacher_id);
            if (teacher) {
                const item = createAccessItem(permission, teacher);
                accessList.appendChild(item);
            }
        });
        
        container.appendChild(accessList);
        
    } catch (error) {
        console.error('Error loading access list:', error);
        showMessage('Failed to load access list: ' + error.message, 'error');
    }
}

// Create access item element
function createAccessItem(permission, teacher) {
    const item = document.createElement('div');
    item.className = 'access-item';
    
    const grantedDate = new Date(permission.created_at).toLocaleDateString();
    const expiresText = permission.expires_at 
        ? `Expires: ${new Date(permission.expires_at).toLocaleDateString()}` 
        : '';
    
    item.innerHTML = `
        <div class="access-info">
            <div class="teacher-name">${teacher.display_name || 'Teacher'}</div>
            <div class="teacher-email">${teacher.email}</div>
            <div class="access-details">
                <span class="badge ${permission.status}">${permission.status}</span>
                <span class="badge ${permission.access_level}">${permission.access_level}</span>
                <span style="font-size: 0.8rem; color: #999;">Granted: ${grantedDate}</span>
                ${expiresText ? `<span style="font-size: 0.8rem; color: #999;">${expiresText}</span>` : ''}
            </div>
            ${permission.notes ? `<div style="font-size: 0.85rem; color: #666; margin-top: 8px;">${permission.notes}</div>` : ''}
        </div>
        <div class="access-actions">
            ${permission.status === 'approved' ? `
                <button class="btn-small btn-revoke" onclick="revokeAccess('${permission.id}')">
                    ❌ Revoke
                </button>
            ` : ''}
        </div>
    `;
    
    return item;
}

// Grant access to a teacher
async function grantAccess() {
    const emailInput = document.getElementById('teacherEmail');
    const accessLevelSelect = document.getElementById('accessLevel');
    
    const email = emailInput.value.trim();
    const accessLevel = accessLevelSelect.value;
    
    if (!email) {
        showMessage('Please enter a teacher email address', 'error');
        return;
    }
    
    try {
        const supabaseClient = window.supabaseUtils.getClient();
        
        // Find teacher by email
        const { data: teachers, error: findError } = await supabaseClient
            .from('users')
            .select('id, user_type')
            .eq('email', email)
            .single();
        
        if (findError || !teachers) {
            showMessage('Teacher not found. They need to sign up first.', 'error');
            return;
        }
        
        // Check if already granted
        const { data: existing, error: checkError } = await supabaseClient
            .from('kid_access_permissions')
            .select('id')
            .eq('kid_id', kidId)
            .eq('teacher_id', teachers.id)
            .maybeSingle();
        
        if (checkError) {
            console.error('Error checking existing access:', checkError);
        }
        
        if (existing) {
            showMessage('This teacher already has access. Revoke it first to change settings.', 'error');
            return;
        }
        
        // Grant access
        const { error: insertError } = await supabaseClient
            .from('kid_access_permissions')
            .insert({
                kid_id: kidId,
                teacher_id: teachers.id,
                granted_by: currentUser.id,
                access_level: accessLevel,
                status: 'approved',
                granted_at: new Date().toISOString()
            });
        
        if (insertError) throw insertError;
        
        showMessage('✅ Access granted successfully!', 'success');
        emailInput.value = '';
        
        // Reload access list
        await loadAccessList();
        
    } catch (error) {
        console.error('Error granting access:', error);
        showMessage('Failed to grant access: ' + error.message, 'error');
    }
}

// Revoke teacher access
async function revokeAccess(permissionId) {
    if (!confirm('Are you sure you want to revoke this teacher\'s access?')) {
        return;
    }
    
    try {
        const supabaseClient = window.supabaseUtils.getClient();
        
        const { error } = await supabaseClient
            .from('kid_access_permissions')
            .update({ status: 'revoked' })
            .eq('id', permissionId);
        
        if (error) throw error;
        
        showMessage('Access revoked successfully', 'success');
        
        // Reload access list
        await loadAccessList();
        
    } catch (error) {
        console.error('Error revoking access:', error);
        showMessage('Failed to revoke access: ' + error.message, 'error');
    }
}

// Show message
function showMessage(message, type = 'success') {
    const container = document.getElementById('messageContainer');
    container.innerHTML = `<div class="message ${type}">${message}</div>`;
    
    setTimeout(() => {
        container.innerHTML = '';
    }, 5000);
}
