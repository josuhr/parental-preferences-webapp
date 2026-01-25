// Authentication Logic

const loadingOverlay = document.getElementById('loadingOverlay');
const errorMessage = document.getElementById('errorMessage');

// Tab switching
function switchTab(tabName) {
    // Update tab buttons
    document.querySelectorAll('.auth-tab').forEach(tab => {
        tab.classList.remove('active');
    });
    document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');
    
    // Update tab content
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.remove('active');
    });
    document.getElementById(tabName + 'Tab').classList.add('active');
    
    hideError();
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', async () => {
    // Initialize Supabase
    await window.supabaseUtils.initSupabase();
    
    const supabaseClient = window.supabaseUtils.getClient();
    if (!supabaseClient) {
        showError('Failed to initialize authentication. Please check console for details.');
        return;
    }
    
    // IMPORTANT: Check for OAuth callback FIRST before checking if logged in
    // This ensures user record is created before redirecting to dashboard
    const hashParams = new URLSearchParams(window.location.hash.substring(1));
    if (hashParams.get('access_token')) {
        console.log('OAuth callback detected - processing...');
        await handleOAuthCallback();
        return; // handleOAuthCallback will redirect to dashboard
    }
    
    // Check if user is already logged in (no OAuth callback in progress)
    const user = await window.supabaseUtils.getCurrentUser();
    if (user) {
        console.log('User already logged in, redirecting to dashboard');
        // User is logged in, redirect to dashboard
        window.location.href = '/dashboard.html';
        return;
    }
    
    // Set up Google sign-in button
    const googleSignInBtn = document.getElementById('googleSignInBtn');
    if (googleSignInBtn) {
        googleSignInBtn.addEventListener('click', signInWithGoogle);
    }
});

// Sign in with Google
async function signInWithGoogle() {
    const supabaseClient = window.supabaseUtils.getClient();
    if (!supabaseClient) {
        showError('Authentication not initialized');
        return;
    }
    
    showLoading(true);
    hideError();
    
    try {
        const { data, error } = await supabaseClient.auth.signInWithOAuth({
            provider: 'google',
            options: {
                redirectTo: `${window.location.origin}/auth.html`,
                queryParams: {
                    access_type: 'offline',
                    prompt: 'consent',
                }
            }
        });
        
        if (error) throw error;
        
        // OAuth redirect will happen automatically
    } catch (error) {
        console.error('Sign in error:', error);
        showError(error.message || 'Failed to sign in. Please try again.');
        showLoading(false);
    }
}

// Handle OAuth callback
async function handleOAuthCallback() {
    showLoading(true);
    
    try {
        const supabaseClient = window.supabaseUtils.getClient();
        // Get the current session
        const { data: { session }, error: sessionError } = await supabaseClient.auth.getSession();
        
        if (sessionError) {
            console.error('Session error:', sessionError);
            throw sessionError;
        }
        
        if (session && session.user) {
            console.log('OAuth callback - User authenticated:', session.user.email);
            console.log('User ID (auth.uid):', session.user.id);
            
            // Check if user exists in database
            const { data: existingUser, error: fetchError } = await supabaseClient
                .from('users')
                .select('*')
                .eq('google_id', session.user.id)
                .single();
            
            if (fetchError && fetchError.code !== 'PGRST116') {
                // Error other than "not found"
                console.error('Error checking for existing user:', fetchError);
                throw fetchError;
            }
            
            // If user doesn't exist, create them
            if (!existingUser) {
                console.log('New user detected, creating user record...');
                const newUserData = {
                    id: session.user.id,
                    email: session.user.email,
                    display_name: session.user.user_metadata.full_name || session.user.email.split('@')[0],
                    google_id: session.user.id,
                    role: 'user',
                    last_login: new Date().toISOString()
                };
                console.log('Attempting to insert user:', newUserData);
                
                const { data: insertedUser, error: insertError } = await supabaseClient
                    .from('users')
                    .insert([newUserData])
                    .select();
                
                if (insertError) {
                    console.error('FAILED to create user:', insertError);
                    console.error('Error code:', insertError.code);
                    console.error('Error message:', insertError.message);
                    console.error('Error details:', insertError.details);
                    console.error('Error hint:', insertError.hint);
                    
                    // Show detailed error message to user
                    const errorMsg = `Failed to create your account. Please contact the administrator with this information:\n\n` +
                                   `Email: ${session.user.email}\n` +
                                   `User ID: ${session.user.id}\n` +
                                   `Error: ${insertError.message || 'Unknown error'}`;
                    showError(errorMsg);
                    showLoading(false);
                    
                    // Don't redirect or clear hash - let user see the error
                    return;
                }
                
                console.log('User created successfully:', insertedUser);
            } else {
                console.log('Existing user found, updating last login...');
                // Update last login
                const { error: updateError } = await supabaseClient
                    .from('users')
                    .update({ last_login: new Date().toISOString() })
                    .eq('id', session.user.id);
                
                if (updateError) {
                    console.error('Failed to update last login:', updateError);
                    // Don't fail the login for this
                }
            }
            
            console.log('Redirecting to dashboard...');
            // Redirect to dashboard
            window.location.href = '/dashboard.html';
        } else {
            console.error('No session or user found in OAuth callback');
            showError('Authentication failed: No session found. Please try again.');
            showLoading(false);
        }
    } catch (error) {
        console.error('OAuth callback error:', error);
        console.error('Error type:', error.constructor.name);
        console.error('Full error object:', JSON.stringify(error, null, 2));
        
        // Show more detailed error message
        let errorMsg = 'Authentication failed. ';
        if (error.message) {
            errorMsg += error.message;
        }
        if (error.hint) {
            errorMsg += '\n\nHint: ' + error.hint;
        }
        errorMsg += '\n\nPlease try again or contact the administrator if this persists.';
        
        showError(errorMsg);
        showLoading(false);
        
        // Clear the hash to prevent loops
        history.replaceState(null, null, ' ');
    }
}

// Show loading overlay
function showLoading(show) {
    if (show) {
        loadingOverlay.classList.add('show');
    } else {
        loadingOverlay.classList.remove('show');
    }
}

// Show error message
function showError(message) {
    errorMessage.textContent = message;
    errorMessage.style.whiteSpace = 'pre-wrap'; // Support multiline errors
    errorMessage.classList.add('show');
}

// Hide error message
function hideError() {
    errorMessage.classList.remove('show');
}

// ============================================================================
// Email/Password Authentication
// ============================================================================

// Sign up with email
async function signUpWithEmail() {
    const name = document.getElementById('signupName').value.trim();
    const email = document.getElementById('signupEmail').value.trim();
    const password = document.getElementById('signupPassword').value;
    const passwordConfirm = document.getElementById('signupPasswordConfirm').value;
    
    // Validation
    if (!name || !email || !password) {
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
    
    showLoading(true);
    hideError();
    
    try {
        const supabaseClient = window.supabaseUtils.getClient();
        
        // Sign up with Supabase Auth
        const { data, error } = await supabaseClient.auth.signUp({
            email: email,
            password: password,
            options: {
                data: {
                    display_name: name
                },
                emailRedirectTo: `${window.location.origin}/verify-email.html`
            }
        });
        
        if (error) throw error;
        
        if (data.user) {
            // Create user record in database
            const { error: insertError } = await supabaseClient
                .from('users')
                .insert({
                    id: data.user.id,
                    email: email,
                    display_name: name,
                    auth_method: 'email',
                    email_verified: false,
                    role: 'user'
                });
            
            if (insertError) {
                console.error('Error creating user record:', insertError);
                // Continue anyway - the user is created in Supabase Auth
            }
            
            // Show success message
            showLoading(false);
            alert('Account created! Please check your email to verify your account before signing in.');
            
            // Switch to sign in tab
            switchTab('signin');
            
            // Clear form
            document.getElementById('emailSignUpForm').reset();
        }
    } catch (error) {
        console.error('Sign up error:', error);
        showError(error.message || 'Failed to create account. Please try again.');
        showLoading(false);
    }
}

// Sign in with email
async function signInWithEmail() {
    const email = document.getElementById('signinEmail').value.trim();
    const password = document.getElementById('signinPassword').value;
    
    if (!email || !password) {
        showError('Please enter email and password');
        return;
    }
    
    showLoading(true);
    hideError();
    
    try {
        const supabaseClient = window.supabaseUtils.getClient();
        
        const { data, error } = await supabaseClient.auth.signInWithPassword({
            email: email,
            password: password
        });
        
        if (error) throw error;
        
        if (data.user) {
            // Check if email is verified
            if (!data.user.email_confirmed_at) {
                showError('Please verify your email before signing in. Check your inbox for the verification link.');
                await supabaseClient.auth.signOut();
                showLoading(false);
                return;
            }
            
            // Update last login
            await supabaseClient
                .from('users')
                .update({ last_login: new Date().toISOString() })
                .eq('id', data.user.id);
            
            // Redirect to dashboard
            window.location.href = '/dashboard.html';
        }
    } catch (error) {
        console.error('Sign in error:', error);
        showError(error.message || 'Invalid email or password');
        showLoading(false);
    }
}

// Show forgot password prompt
function showForgotPassword() {
    const email = prompt('Enter your email address to reset your password:');
    
    if (email) {
        requestPasswordReset(email.trim());
    }
}

// Request password reset
async function requestPasswordReset(email) {
    if (!email) return;
    
    showLoading(true);
    hideError();
    
    try {
        const supabaseClient = window.supabaseUtils.getClient();
        
        const { error } = await supabaseClient.auth.resetPasswordForEmail(email, {
            redirectTo: `${window.location.origin}/reset-password.html`
        });
        
        if (error) throw error;
        
        showLoading(false);
        alert('Password reset link sent! Please check your email.');
    } catch (error) {
        console.error('Password reset error:', error);
        showError(error.message || 'Failed to send reset email');
        showLoading(false);
    }
}
