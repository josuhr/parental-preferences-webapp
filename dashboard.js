// Dashboard Logic

let supabase = null;
let currentUser = null;
let userProfile = null;
let userSettings = null;

// DOM Elements
const userAvatar = document.getElementById('userAvatar');
const userName = document.getElementById('userName');
const userEmail = document.getElementById('userEmail');
const sheetIdInput = document.getElementById('sheetId');
const sheetStatus = document.getElementById('sheetStatus');
const themeColorInput = document.getElementById('themeColor');
const colorPreview = document.getElementById('colorPreview');
const fontFamilySelect = document.getElementById('fontFamily');
const adminBtn = document.getElementById('adminBtn');
const signOutBtn = document.getElementById('signOutBtn');
const testSheetBtn = document.getElementById('testSheetBtn');
const saveSheetBtn = document.getElementById('saveSheetBtn');
const saveSettingsBtn = document.getElementById('saveSettingsBtn');

// Initialize on page load
document.addEventListener('DOMContentLoaded', async () => {
    // Initialize Supabase
    supabase = await window.supabaseUtils.initSupabase();
    
    if (!supabase) {
        showError('Failed to initialize. Please refresh the page.');
        return;
    }
    
    // Check authentication
    currentUser = await window.supabaseUtils.getCurrentUser();
    
    if (!currentUser) {
        // Not logged in, redirect to auth
        window.location.href = '/auth.html';
        return;
    }
    
    // Load user data
    await loadUserData();
    
    // Set up event listeners
    setupEventListeners();
});

// Load user data
async function loadUserData() {
    try {
        // Get user profile
        userProfile = await window.supabaseUtils.getUserProfile(currentUser.id);
        
        if (!userProfile) {
            showError('Failed to load user profile');
            return;
        }
        
        // Get user settings
        userSettings = await window.supabaseUtils.getUserSettings(currentUser.id);
        
        // Update UI
        updateUserInfo();
        updateSheetInfo();
        updateCustomizationInfo();
        
        // Check if admin
        if (userProfile.role === 'admin') {
            adminBtn.style.display = 'inline-block';
        }
    } catch (error) {
        console.error('Error loading user data:', error);
        showError('Failed to load user data');
    }
}

// Update user info display
function updateUserInfo() {
    const displayName = userProfile.display_name || currentUser.email.split('@')[0];
    const initials = displayName.substring(0, 2).toUpperCase();
    
    userAvatar.textContent = initials;
    userName.textContent = displayName;
    userEmail.textContent = currentUser.email;
}

// Update sheet info
function updateSheetInfo() {
    if (userProfile.sheet_id) {
        sheetIdInput.value = userProfile.sheet_id;
        sheetStatus.innerHTML = '<span class="status-badge success">✓ Connected</span>';
    } else {
        sheetStatus.innerHTML = '<span class="status-badge warning">Not configured</span>';
    }
}

// Update customization info
function updateCustomizationInfo() {
    if (userSettings) {
        themeColorInput.value = userSettings.theme_color || '#667eea';
        colorPreview.style.background = userSettings.theme_color || '#667eea';
        fontFamilySelect.value = userSettings.font_family || 'Comic Sans MS';
    }
}

// Setup event listeners
function setupEventListeners() {
    // Color picker
    themeColorInput.addEventListener('input', (e) => {
        colorPreview.style.background = e.target.value;
    });
    
    // Buttons
    signOutBtn.addEventListener('click', () => window.supabaseUtils.signOut());
    adminBtn.addEventListener('click', () => window.location.href = '/admin.html');
    testSheetBtn.addEventListener('click', testSheetConnection);
    saveSheetBtn.addEventListener('click', saveSheetId);
    saveSettingsBtn.addEventListener('click', saveUserSettings');
}

// Test sheet connection
async function testSheetConnection() {
    const sheetId = sheetIdInput.value.trim();
    
    if (!sheetId) {
        showError('Please enter a Google Sheet ID');
        return;
    }
    
    testSheetBtn.disabled = true;
    testSheetBtn.textContent = 'Testing...';
    
    try {
        // Try to fetch from first tab
        const url = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:json&sheet=Arts%20%26%20Crafts`;
        const response = await fetch(url);
        
        if (!response.ok) {
            throw new Error('Failed to access sheet. Make sure it is shared with "Anyone with the link can view"');
        }
        
        const text = await response.text();
        const jsonMatch = text.match(/google\.visualization\.Query\.setResponse\(([\s\S]+)\);?\s*$/);
        
        if (!jsonMatch) {
            throw new Error('Invalid sheet format');
        }
        
        const data = JSON.parse(jsonMatch[1]);
        
        if (data.status === 'error') {
            throw new Error(data.errors?.[0]?.detailed_message || 'Sheet access error');
        }
        
        // Success!
        sheetStatus.innerHTML = '<span class="status-badge success">✓ Connection successful!</span>';
        alert('✓ Sheet connection successful! Remember to save.');
        
    } catch (error) {
        console.error('Sheet test error:', error);
        showError(error.message || 'Failed to connect to sheet');
    } finally {
        testSheetBtn.disabled = false;
        testSheetBtn.textContent = 'Test Connection';
    }
}

// Save sheet ID
async function saveSheetId() {
    const sheetId = sheetIdInput.value.trim();
    
    if (!sheetId) {
        showError('Please enter a Google Sheet ID');
        return;
    }
    
    saveSheetBtn.disabled = true;
    saveSheetBtn.textContent = 'Saving...';
    
    try {
        const { error } = await supabase
            .from('users')
            .update({ sheet_id: sheetId })
            .eq('id', currentUser.id);
        
        if (error) throw error;
        
        userProfile.sheet_id = sheetId;
        sheetStatus.innerHTML = '<span class="status-badge success">✓ Connected</span>';
        alert('✓ Sheet ID saved successfully!');
        
    } catch (error) {
        console.error('Error saving sheet ID:', error);
        showError('Failed to save sheet ID');
    } finally {
        saveSheetBtn.disabled = false;
        saveSheetBtn.textContent = 'Save Sheet ID';
    }
}

// Save user settings
async function saveUserSettings() {
    const themeColor = themeColorInput.value;
    const fontFamily = fontFamilySelect.value;
    
    saveSettingsBtn.disabled = true;
    saveSettingsBtn.textContent = 'Saving...';
    
    try {
        const { error } = await supabase
            .from('user_settings')
            .update({
                theme_color: themeColor,
                font_family: fontFamily
            })
            .eq('user_id', currentUser.id);
        
        if (error) throw error;
        
        alert('✓ Preferences saved successfully!');
        
    } catch (error) {
        console.error('Error saving settings:', error);
        showError('Failed to save preferences');
    } finally {
        saveSettingsBtn.disabled = false;
        saveSettingsBtn.textContent = 'Save Preferences';
    }
}

// Show error message
function showError(message) {
    const errorEl = document.getElementById('error');
    if (errorEl) {
        errorEl.textContent = message;
        errorEl.style.display = 'block';
        setTimeout(() => {
            errorEl.style.display = 'none';
        }, 5000);
    } else {
        alert(message);
    }
}
