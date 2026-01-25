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
        
        if (sessionError) throw sessionError;
        
        if (session && session.user) {
            // Check if user exists in database
            const { data: existingUser, error: fetchError } = await supabaseClient
                .from('users')
                .select('*')
                .eq('google_id', session.user.id)
                .single();
            
            if (fetchError && fetchError.code !== 'PGRST116') {
                // Error other than "not found"
                throw fetchError;
            }
            
            // If user doesn't exist, create them
            if (!existingUser) {
                const { error: insertError } = await supabaseClient
                    .from('users')
                    .insert([{
                        id: session.user.id,
                        email: session.user.email,
                        display_name: session.user.user_metadata.full_name || session.user.email.split('@')[0],
                        google_id: session.user.id,
                        role: 'user',
                        last_login: new Date().toISOString()
                    }]);
                
                if (insertError) {
                    console.error('Error creating user:', insertError);
                    throw insertError;
                }
            } else {
                // Update last login
                await supabaseClient
                    .from('users')
                    .update({ last_login: new Date().toISOString() })
                    .eq('id', session.user.id);
            }
            
            // Redirect to dashboard
            window.location.href = '/dashboard.html';
        }
    } catch (error) {
        console.error('OAuth callback error:', error);
        showError('Authentication failed. Please try again.');
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
    errorMessage.classList.add('show');
}

// Hide error message
function hideError() {
    errorMessage.classList.remove('show');
}
