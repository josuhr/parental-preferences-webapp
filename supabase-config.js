// Supabase Configuration
// This file is included in git - API keys are stored in Netlify environment variables

const SUPABASE_CONFIG = {
    url: '', // Will be set from Netlify env or localStorage
    anonKey: '' // Will be set from Netlify env or localStorage
};

// Initialize Supabase client
let supabaseClient = null;

async function initSupabase() {
    // Check if running locally or on Netlify
    const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    
    if (isLocal) {
        // For local development, use values from localStorage
        const storedUrl = localStorage.getItem('SUPABASE_URL');
        const storedKey = localStorage.getItem('SUPABASE_ANON_KEY');
        
        if (storedUrl && storedKey) {
            SUPABASE_CONFIG.url = storedUrl;
            SUPABASE_CONFIG.anonKey = storedKey;
        } else {
            console.warn('Local development: Please set Supabase credentials in browser console:');
            console.warn('localStorage.setItem("SUPABASE_URL", "https://xxx.supabase.co")');
            console.warn('localStorage.setItem("SUPABASE_ANON_KEY", "your-anon-key")');
            return null;
        }
    } else {
        // On Netlify, fetch from environment via function
        try {
            const response = await fetch('/.netlify/functions/get-config');
            const config = await response.json();
            SUPABASE_CONFIG.url = config.url;
            SUPABASE_CONFIG.anonKey = config.anonKey;
        } catch (error) {
            console.error('Failed to fetch Supabase config:', error);
            return null;
        }
    }
    
    // Initialize Supabase client
    if (window.supabase && SUPABASE_CONFIG.url && SUPABASE_CONFIG.anonKey) {
        supabaseClient = window.supabase.createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.anonKey);
        return supabaseClient;
    }
    
    console.error('Supabase library not loaded or config missing');
    return null;
}

// Get current user
async function getCurrentUser() {
    if (!supabaseClient) {
        await initSupabase();
    }
    
    const { data: { user }, error } = await supabaseClient.auth.getUser();
    
    if (error) {
        // AuthSessionMissingError is expected when user is not logged in
        if (error.name !== 'AuthSessionMissingError') {
            console.error('Error getting user:', error);
        }
        return null;
    }
    
    return user;
}

// Get user profile from database
async function getUserProfile(userId) {
    if (!supabaseClient) return null;
    
    const { data, error } = await supabaseClient
        .from('users')
        .select('*')
        .eq('id', userId)
        .single();
    
    if (error) {
        console.error('Error fetching user profile:', error);
        return null;
    }
    
    return data;
}

// Get user settings
async function getUserSettings(userId) {
    if (!supabaseClient) return null;
    
    const { data, error } = await supabaseClient
        .from('user_settings')
        .select('*')
        .eq('user_id', userId)
        .single();
    
    if (error) {
        console.error('Error fetching user settings:', error);
        return null;
    }
    
    return data;
}

// Check if user is admin
async function isAdmin(userId) {
    const profile = await getUserProfile(userId);
    return profile && profile.role === 'admin';
}

// Check if user has a specific user type
// Handles both old string format (user_type) and new array format (user_types)
function hasUserType(profile, type) {
    if (!profile) return false;
    
    // Check new array format
    if (Array.isArray(profile.user_types)) {
        return profile.user_types.includes(type);
    }
    
    // Check old string format
    if (profile.user_type) {
        return profile.user_type === type;
    }
    
    return false;
}

// Check if user is a teacher
async function isTeacher(userId) {
    const profile = await getUserProfile(userId);
    return hasUserType(profile, 'teacher');
}

// Check if user is a parent
async function isParent(userId) {
    const profile = await getUserProfile(userId);
    return hasUserType(profile, 'parent');
}

// Get all user types for a user
async function getUserTypes(userId) {
    const profile = await getUserProfile(userId);
    if (!profile) return [];
    
    if (Array.isArray(profile.user_types)) {
        return profile.user_types;
    }
    
    if (profile.user_type) {
        return [profile.user_type];
    }
    
    return ['parent']; // Default
}

// Sign out
async function signOut() {
    if (!supabaseClient) return;
    
    const { error } = await supabaseClient.auth.signOut();
    
    if (error) {
        console.error('Error signing out:', error);
    } else {
        window.location.href = '/auth.html';
    }
}

// Export for use in other files
window.supabaseUtils = {
    initSupabase,
    getCurrentUser,
    getUserProfile,
    getUserSettings,
    isAdmin,
    isTeacher,
    isParent,
    getUserTypes,
    hasUserType,
    signOut,
    getClient: () => supabaseClient
};
