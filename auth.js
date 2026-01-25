// Authentication Logic

const googleSignInBtn = document.getElementById('googleSignInBtn');
const loadingOverlay = document.getElementById('loadingOverlay');
const errorMessage = document.getElementById('errorMessage');

// Initialize on page load
document.addEventListener('DOMContentLoaded', async () => {
    // Initialize Supabase
    await window.supabaseUtils.initSupabase();
    
    const supabaseClient = window.supabaseUtils.getClient();
    if (!supabaseClient) {
        showError('Failed to initialize authentication. Please check console for details.');
        return;
    }
    
    // Check if user is already logged in
    const user = await window.supabaseUtils.getCurrentUser();
    if (user) {
        // User is logged in, redirect to dashboard
        window.location.href = '/dashboard.html';
        return;
    }
    
    // Check for OAuth callback
    const hashParams = new URLSearchParams(window.location.hash.substring(1));
    if (hashParams.get('access_token')) {
        handleOAuthCallback();
    }
    
    // Set up sign-in button
    googleSignInBtn.addEventListener('click', signInWithGoogle);
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
