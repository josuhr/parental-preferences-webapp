// Kid Access Management Logic
let currentUser = null;
let currentKid = null;
let kidId = null;
let existingPermissions = [];

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
    await loadAvailableTeachers();
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

        // Store for checking in teacher list
        existingPermissions = permissions || [];

        // Get pending invitations
        const { data: invitations, error: inviteError } = await supabaseClient
            .from('teacher_invitations')
            .select('*')
            .eq('kid_id', kidId)
            .eq('status', 'pending')
            .order('created_at', { ascending: false });
        
        if (inviteError) console.error('Error loading invitations:', inviteError);
        
        const hasPermissions = permissions && permissions.length > 0;
        const hasInvitations = invitations && invitations.length > 0;
        
        if (!hasPermissions && !hasInvitations) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="icon">👥</div>
                    <p>No teachers have been granted access yet.</p>
                    <p style="font-size: 0.9rem; color: #999;">Use the form above to grant access to a teacher.</p>
                </div>
            `;
            return;
        }
        
        container.innerHTML = '';
        const accessList = document.createElement('div');
        accessList.className = 'access-list';
        
        // Show pending invitations first
        if (hasInvitations) {
            invitations.forEach(invitation => {
                const item = createInvitationItem(invitation);
                accessList.appendChild(item);
            });
        }
        
        // Then show granted permissions
        if (hasPermissions) {
            // Get teacher details
            const teacherIds = permissions.map(p => p.teacher_id);
            
            const { data: teachers, error: teacherError } = await supabaseClient
                .from('users')
                .select('id, email, display_name')
                .in('id', teacherIds);
            
            if (teacherError) throw teacherError;
            
            permissions.forEach(permission => {
                const teacher = teachers.find(t => t.id === permission.teacher_id);
                if (teacher) {
                    const item = createAccessItem(permission, teacher);
                    accessList.appendChild(item);
                }
            });
        }
        
        container.appendChild(accessList);
        
    } catch (error) {
        console.error('Error loading access list:', error);
        showMessage('Failed to load access list: ' + error.message, 'error');
    }
}

// Create invitation item element
function createInvitationItem(invitation) {
    const item = document.createElement('div');
    item.className = 'access-item';
    
    const expiresDate = new Date(invitation.expires_at).toLocaleDateString();
    const sentDate = new Date(invitation.created_at).toLocaleDateString();
    
    item.innerHTML = `
        <div class="access-info">
            <div class="teacher-name">📧 ${invitation.email}</div>
            <div class="teacher-email" style="font-style: italic; color: #999;">Invitation sent - waiting for acceptance</div>
            <div class="access-details">
                <span class="badge pending">Pending Invitation</span>
                <span class="badge ${invitation.access_level}">${invitation.access_level}</span>
                <span style="font-size: 0.8rem; color: #999;">Sent: ${sentDate}</span>
                <span style="font-size: 0.8rem; color: #999;">Expires: ${expiresDate}</span>
            </div>
        </div>
        <div class="access-actions">
            <button class="btn-small btn-revoke" onclick="cancelInvitation('${invitation.id}')">
                ❌ Cancel
            </button>
        </div>
    `;
    
    return item;
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
        const { data: teacher, error: findError } = await supabaseClient
            .from('users')
            .select('id, user_type, display_name')
            .eq('email', email)
            .maybeSingle();
        
        if (teacher) {
            // User exists - grant access immediately
            await grantAccessToExistingUser(teacher, email, accessLevel);
        } else {
            // User doesn't exist - offer to send invitation
            const confirmed = confirm(
                `${email} doesn't have an account yet.\n\n` +
                `Would you like to send them an invitation to create an account and access ${currentKid.name}'s preferences?`
            );
            
            if (confirmed) {
                await sendTeacherInvitation(email, accessLevel);
            }
        }
        
    } catch (error) {
        console.error('Error granting access:', error);
        showMessage('Failed to grant access: ' + error.message, 'error');
    }
}

// Grant access to existing user
async function grantAccessToExistingUser(teacher, email, accessLevel) {
    const supabaseClient = window.supabaseUtils.getClient();
    
    // Check if already granted
    const { data: existing, error: checkError } = await supabaseClient
        .from('kid_access_permissions')
        .select('id')
        .eq('kid_id', kidId)
        .eq('teacher_id', teacher.id)
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
            teacher_id: teacher.id,
            granted_by: currentUser.id,
            access_level: accessLevel,
            status: 'approved',
            granted_at: new Date().toISOString()
        });
    
    if (insertError) throw insertError;
    
    showMessage(`✅ Access granted to ${teacher.display_name || email}!`, 'success');
    document.getElementById('teacherEmail').value = '';
    
    // Reload access list
    await loadAccessList();
}

// Send teacher invitation
async function sendTeacherInvitation(email, accessLevel) {
    try {
        const supabaseClient = window.supabaseUtils.getClient();
        
        // Generate unique token
        const token = generateInvitationToken();
        
        // Set expiration (7 days from now)
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 7);
        
        // Check if invitation already exists
        const { data: existingInvite } = await supabaseClient
            .from('teacher_invitations')
            .select('id, status')
            .eq('email', email)
            .eq('kid_id', kidId)
            .eq('status', 'pending')
            .maybeSingle();
        
        if (existingInvite) {
            showMessage('An invitation has already been sent to this email address.', 'error');
            return;
        }
        
        // Store invitation
        const { error: inviteError } = await supabaseClient
            .from('teacher_invitations')
            .insert({
                invited_by: currentUser.id,
                kid_id: kidId,
                email: email,
                token: token,
                access_level: accessLevel,
                expires_at: expiresAt.toISOString()
            });
        
        if (inviteError) throw inviteError;
        
        // Send invitation email via Netlify function
        try {
            const response = await fetch('/.netlify/functions/send-invitation', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    email: email,
                    token: token,
                    kidName: currentKid.name,
                    inviterName: currentUser.email, // Will be updated when we have display_name
                    accessLevel: accessLevel
                })
            });
            
            if (!response.ok) {
                console.error('Failed to send email, but invitation created');
                showMessage('⚠️ Invitation created, but email failed to send. Please share this link manually:\n' + 
                           `${window.location.origin}/teacher-invite.html?token=${token}`, 'error');
                return;
            }
        } catch (emailError) {
            console.error('Email sending error:', emailError);
            showMessage('⚠️ Invitation created, but email failed to send. Please share this link manually:\n' + 
                       `${window.location.origin}/teacher-invite.html?token=${token}`, 'error');
            return;
        }
        
        showMessage(`✅ Invitation sent to ${email}! They have 7 days to accept.`, 'success');
        document.getElementById('teacherEmail').value = '';
        
        // Reload access list to show pending invitation
        await loadAccessList();
        
    } catch (error) {
        console.error('Error sending invitation:', error);
        showMessage('Failed to send invitation: ' + error.message, 'error');
    }
}

// Generate unique invitation token
function generateInvitationToken() {
    // Create a secure random token
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
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

// Cancel pending invitation
async function cancelInvitation(invitationId) {
    if (!confirm('Are you sure you want to cancel this invitation?')) {
        return;
    }
    
    try {
        const supabaseClient = window.supabaseUtils.getClient();
        
        const { error } = await supabaseClient
            .from('teacher_invitations')
            .update({ status: 'cancelled' })
            .eq('id', invitationId);
        
        if (error) throw error;
        
        showMessage('Invitation cancelled', 'success');
        
        // Reload access list
        await loadAccessList();
        
    } catch (error) {
        console.error('Error cancelling invitation:', error);
        showMessage('Failed to cancel invitation: ' + error.message, 'error');
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

// Load available teachers
async function loadAvailableTeachers() {
    const container = document.getElementById('availableTeachersContainer');

    try {
        const supabaseClient = window.supabaseUtils.getClient();

        // Get all users who are teachers (check both user_type and role fields)
        const { data: teachers, error } = await supabaseClient
            .from('users')
            .select('id, email, display_name, user_type, role')
            .order('display_name');

        if (error) throw error;

        // Filter to only teachers (checking multiple possible fields)
        const teacherUsers = (teachers || []).filter(user => {
            return user.user_type === 'teacher' || user.role === 'teacher';
        });

        if (teacherUsers.length === 0) {
            container.innerHTML = `
                <div class="no-teachers">
                    No teachers registered in the system yet. Use the email form below to invite one.
                </div>
            `;
            return;
        }

        // Build teacher cards
        const grid = document.createElement('div');
        grid.className = 'teachers-grid';

        teacherUsers.forEach(teacher => {
            const card = createTeacherCard(teacher);
            grid.appendChild(card);
        });

        container.innerHTML = '';
        container.appendChild(grid);

    } catch (error) {
        console.error('Error loading teachers:', error);
        container.innerHTML = `
            <div class="no-teachers">
                Failed to load teachers. You can still use the email form below.
            </div>
        `;
    }
}

// Create teacher card element
function createTeacherCard(teacher) {
    const card = document.createElement('div');
    card.className = 'teacher-card';

    // Check if this teacher already has access
    const hasAccess = existingPermissions.some(p =>
        p.teacher_id === teacher.id && p.status === 'approved'
    );

    if (hasAccess) {
        card.classList.add('already-granted');
    }

    // Get initials for avatar
    const name = teacher.display_name || teacher.email;
    const initials = name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();

    card.innerHTML = `
        <div class="teacher-card-info">
            <div class="teacher-card-avatar">${initials}</div>
            <div class="teacher-card-details">
                <div class="teacher-card-name">${teacher.display_name || 'Teacher'}</div>
                <div class="teacher-card-email">${teacher.email}</div>
            </div>
        </div>
        <div class="teacher-card-actions">
            ${hasAccess ? `
                <span style="color: #4CAF50; font-size: 0.85rem;">✓ Has Access</span>
            ` : `
                <select id="access-level-${teacher.id}">
                    <option value="view">View</option>
                    <option value="comment">Comment</option>
                    <option value="full">Full</option>
                </select>
                <button class="btn-grant" onclick="grantAccessToTeacher('${teacher.id}', '${teacher.email}', '${teacher.display_name || ''}')">
                    Grant
                </button>
            `}
        </div>
    `;

    return card;
}

// Grant access to a specific teacher from the list
async function grantAccessToTeacher(teacherId, email, displayName) {
    const accessLevel = document.getElementById(`access-level-${teacherId}`).value;

    try {
        const supabaseClient = window.supabaseUtils.getClient();

        // Check if already granted
        const { data: existing } = await supabaseClient
            .from('kid_access_permissions')
            .select('id')
            .eq('kid_id', kidId)
            .eq('teacher_id', teacherId)
            .maybeSingle();

        if (existing) {
            showMessage('This teacher already has access.', 'error');
            return;
        }

        // Grant access
        const { error: insertError } = await supabaseClient
            .from('kid_access_permissions')
            .insert({
                kid_id: kidId,
                teacher_id: teacherId,
                granted_by: currentUser.id,
                access_level: accessLevel,
                status: 'approved',
                granted_at: new Date().toISOString()
            });

        if (insertError) throw insertError;

        showMessage(`✅ Access granted to ${displayName || email}!`, 'success');

        // Reload both lists
        await loadAccessList();
        await loadAvailableTeachers();

    } catch (error) {
        console.error('Error granting access:', error);
        showMessage('Failed to grant access: ' + error.message, 'error');
    }
}
