// Teacher Invitation Acceptance Logic
let invitationData = null;
let token = null;

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
    const supabase = await window.supabaseUtils.initSupabase();
    
    if (!supabase) {
        showError('Failed to initialize');
        return;
    }
    
    // Get token from URL
    const urlParams = new URLSearchParams(window.location.search);
    token = urlParams.get('token');
    
    if (!token) {
        showExpired();
        return;
    }
    
    // Load invitation data
    await loadInvitation();
});

// Load invitation details
async function loadInvitation() {
    try {
        const supabaseClient = window.supabaseUtils.getClient();
        
        // Get invitation (accessible to anon users)
        const { data: invitation, error } = await supabaseClient
            .from('teacher_invitations')
            .select('*')
            .eq('token', token)
            .eq('status', 'pending')
            .single();
        
        if (error || !invitation) {
            showExpired();
            return;
        }
        
        // Check if expired
        if (new Date(invitation.expires_at) < new Date()) {
            // Mark as expired
            await supabaseClient
                .from('teacher_invitations')
                .update({ status: 'expired' })
                .eq('id', invitation.id);
            
            showExpired();
            return;
        }
        
        invitationData = invitation;
        
        // Load kid and inviter details
        const { data: kid } = await supabaseClient
            .from('kids')
            .select('name, avatar_emoji')
            .eq('id', invitation.kid_id)
            .single();
        
        const { data: inviter } = await supabaseClient
            .from('users')
            .select('display_name, email')
            .eq('id', invitation.invited_by)
            .single();
        
        // Update UI
        document.getElementById('kidName').textContent = kid ? kid.name : 'a child';
        document.getElementById('inviterName').textContent = inviter ? inviter.display_name || inviter.email : 'A parent';
        document.getElementById('teacherEmail').value = invitation.email;
        document.getElementById('accessBadge').textContent = invitation.access_level;
        
        // Show invitation form
        document.getElementById('loadingContainer').style.display = 'none';
        document.getElementById('inviteContainer').style.display = 'block';
        
    } catch (error) {
        console.error('Error loading invitation:', error);
        showExpired();
    }
}

// Accept invitation and create account
async function acceptInvitation() {
    const name = document.getElementById('teacherName').value.trim();
    const email = document.getElementById('teacherEmail').value.trim();
    const password = document.getElementById('teacherPassword').value;
    const passwordConfirm = document.getElementById('teacherPasswordConfirm').value;
    
    // Validation
    if (!name || !password) {
        showError('Please fill in all fields');
        return;
    }
    
    if (password !== passwordConfirm) {
        showError('Passwords do not match');
        return;
    }
    
    if (password.length < 8) {
        showError('Password must be at least 8 characters');
        return;
    }
    
    hideError();
    
    try {
        const supabaseClient = window.supabaseUtils.getClient();
        
        // Create auth account
        const { data: authData, error: signUpError } = await supabaseClient.auth.signUp({
            email: email,
            password: password,
            options: {
                data: {
                    display_name: name
                },
                // Skip email verification for invited teachers
                emailRedirectTo: `${window.location.origin}/teacher-dashboard.html`
            }
        });
        
        if (signUpError) {
            // Handle rate limit error specifically
            if (signUpError.message && signUpError.message.includes('rate limit')) {
                throw new Error('Too many signup attempts. Please wait a few minutes and try again, or contact the person who invited you.');
            }
            throw signUpError;
        }
        
        if (!authData.user) {
            throw new Error('Failed to create account');
        }
        
        // Create user record with user_type = 'teacher'
        const { error: userError } = await supabaseClient
            .from('users')
            .insert({
                id: authData.user.id,
                email: email,
                display_name: name,
                auth_method: 'teacher_invite',
                user_type: 'teacher',
                email_verified: true, // Auto-verify invited teachers
                role: 'user'
            });
        
        if (userError) {
            console.error('Error creating user record:', userError);
            throw userError;
        }
        
        // Grant access to the kid
        const { error: accessError } = await supabaseClient
            .from('kid_access_permissions')
            .insert({
                kid_id: invitationData.kid_id,
                teacher_id: authData.user.id,
                granted_by: invitationData.invited_by,
                access_level: invitationData.access_level,
                status: 'approved',
                granted_at: new Date().toISOString()
            });
        
        if (accessError) {
            console.error('Error granting access:', accessError);
            // Continue anyway - user is created
        }
        
        // Grant access to teacher-dashboard app
        const { data: app } = await supabaseClient
            .from('apps')
            .select('id')
            .eq('slug', 'teacher-dashboard')
            .maybeSingle();
        
        if (app) {
            await supabaseClient
                .from('user_app_access')
                .insert({
                    user_id: authData.user.id,
                    app_id: app.id,
                    role: 'user'
                });
        }
        
        // Mark invitation as accepted
        await supabaseClient
            .from('teacher_invitations')
            .update({
                status: 'accepted',
                accepted_at: new Date().toISOString()
            })
            .eq('id', invitationData.id);
        
        // Show success and redirect
        alert('✅ Account created successfully! Redirecting to your dashboard...');
        
        setTimeout(() => {
            window.location.href = '/teacher-dashboard.html';
        }, 1500);
        
    } catch (error) {
        console.error('Error accepting invitation:', error);
        showError(error.message || 'Failed to create account. Please try again.');
    }
}

// Show expired state
function showExpired() {
    document.getElementById('loadingContainer').style.display = 'none';
    document.getElementById('inviteContainer').style.display = 'none';
    document.getElementById('expiredContainer').style.display = 'block';
}

// Show error
function showError(message) {
    const errorEl = document.getElementById('errorMessage');
    errorEl.textContent = message;
    errorEl.classList.add('show');
}

// Hide error
function hideError() {
    document.getElementById('errorMessage').classList.remove('show');
}
