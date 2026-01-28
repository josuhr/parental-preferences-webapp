// Dashboard Logic

let currentUser = null;
let userProfile = null;
let userSettings = null;

// DOM Elements
const userAvatar = document.getElementById('userAvatar');
const userName = document.getElementById('userName');
const userEmail = document.getElementById('userEmail');
const sheetIdInput = document.getElementById('sheetId');
const sheetStatus = document.getElementById('sheetStatus');
const adminBtn = document.getElementById('adminBtn');
const signOutBtn = document.getElementById('signOutBtn');
const testSheetBtn = document.getElementById('testSheetBtn');
const saveSheetBtn = document.getElementById('saveSheetBtn');

// Caregiver label elements
const caregiver1LabelInput = document.getElementById('caregiver1Label');
const caregiver1EmojiSelect = document.getElementById('caregiver1Emoji');
const caregiver2LabelInput = document.getElementById('caregiver2Label');
const caregiver2EmojiSelect = document.getElementById('caregiver2Emoji');
const bothLabelInput = document.getElementById('bothLabel');
const bothEmojiSelect = document.getElementById('bothEmoji');
const saveCaregiverLabelsBtn = document.getElementById('saveCaregiverLabelsBtn');

// Initialize on page load
document.addEventListener('DOMContentLoaded', async () => {
    // Initialize Supabase
    await window.supabaseUtils.initSupabase();
    
    const supabaseClient = window.supabaseUtils.getClient();
    if (!supabaseClient) {
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
        console.log('Loading user data for:', currentUser.email, 'ID:', currentUser.id);
        
        // Get user profile
        userProfile = await window.supabaseUtils.getUserProfile(currentUser.id);
        
        if (!userProfile) {
            console.error('User profile not found in database for:', currentUser.email);
            
            // Update UI to show error state instead of "Loading..."
            userName.textContent = 'Account Setup Error';
            userName.style.color = '#c62828';
            userEmail.textContent = currentUser.email;
            userAvatar.textContent = '⚠️';
            userAvatar.style.background = '#ffebee';
            
            // Show detailed error with instructions
            const errorMsg = `Your account (${currentUser.email}) was authenticated but not found in the database.\n\n` +
                           `This may happen if you just signed up. Please contact the administrator with this information:\n\n` +
                           `Email: ${currentUser.email}\n` +
                           `User ID: ${currentUser.id}\n\n` +
                           `The administrator can create your account manually.`;
            
            showError(errorMsg);
            
            // Disable all action buttons except sign out
            if (testSheetBtn) testSheetBtn.disabled = true;
            if (saveSheetBtn) saveSheetBtn.disabled = true;
            
            return;
        }
        
        console.log('User profile loaded successfully:', userProfile);
        
        // Get user settings
        userSettings = await window.supabaseUtils.getUserSettings(currentUser.id);
        console.log('User settings loaded:', userSettings);
        
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
        console.error('Error details:', JSON.stringify(error, null, 2));
        
        // Update UI to show error state
        userName.textContent = 'Error Loading Profile';
        userName.style.color = '#c62828';
        userEmail.textContent = currentUser.email;
        
        showError(`Failed to load user data: ${error.message || 'Unknown error'}`);
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
        // Load caregiver labels
        caregiver1LabelInput.value = userSettings.caregiver1_label || 'Mom';
        caregiver1EmojiSelect.value = userSettings.caregiver1_emoji || '💗';
        caregiver2LabelInput.value = userSettings.caregiver2_label || 'Dad';
        caregiver2EmojiSelect.value = userSettings.caregiver2_emoji || '💙';
        bothLabelInput.value = userSettings.both_label || 'Both';
        bothEmojiSelect.value = userSettings.both_emoji || '💜';
    }
}

function setupEventListeners() {
    // Buttons
    if (signOutBtn) signOutBtn.addEventListener('click', () => window.supabaseUtils.signOut());
    if (adminBtn) adminBtn.addEventListener('click', () => window.location.href = '/admin.html');
    if (testSheetBtn) testSheetBtn.addEventListener('click', testSheetConnection);
    if (saveSheetBtn) saveSheetBtn.addEventListener('click', saveSheetId);
    if (saveCaregiverLabelsBtn) saveCaregiverLabelsBtn.addEventListener('click', saveCaregiverLabels);
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
        const supabaseClient = window.supabaseUtils.getClient();
        const { error } = await supabaseClient
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

// Save caregiver labels
async function saveCaregiverLabels() {
    const caregiver1Label = caregiver1LabelInput.value.trim() || 'Mom';
    const caregiver1Emoji = caregiver1EmojiSelect.value;
    const caregiver2Label = caregiver2LabelInput.value.trim() || 'Dad';
    const caregiver2Emoji = caregiver2EmojiSelect.value;
    const bothLabel = bothLabelInput.value.trim() || 'Both';
    const bothEmoji = bothEmojiSelect.value;
    
    saveCaregiverLabelsBtn.disabled = true;
    saveCaregiverLabelsBtn.textContent = 'Saving...';
    
    try {
        const supabaseClient = window.supabaseUtils.getClient();
        const { error } = await supabaseClient
            .from('user_settings')
            .update({
                caregiver1_label: caregiver1Label,
                caregiver1_emoji: caregiver1Emoji,
                caregiver2_label: caregiver2Label,
                caregiver2_emoji: caregiver2Emoji,
                both_label: bothLabel,
                both_emoji: bothEmoji
            })
            .eq('user_id', currentUser.id);
        
        if (error) throw error;
        
        // Update local cache
        if (userSettings) {
            userSettings.caregiver1_label = caregiver1Label;
            userSettings.caregiver1_emoji = caregiver1Emoji;
            userSettings.caregiver2_label = caregiver2Label;
            userSettings.caregiver2_emoji = caregiver2Emoji;
            userSettings.both_label = bothLabel;
            userSettings.both_emoji = bothEmoji;
        }
        
        alert('✓ Caregiver labels saved successfully!\n\nRefresh the activities page to see your changes.');
        
    } catch (error) {
        console.error('Error saving caregiver labels:', error);
        showError('Failed to save caregiver labels');
    } finally {
        saveCaregiverLabelsBtn.disabled = false;
        saveCaregiverLabelsBtn.textContent = 'Save Caregiver Labels';
    }
}

// Show error message
function showError(message) {
    const errorEl = document.getElementById('error');
    if (errorEl) {
        errorEl.textContent = message;
        errorEl.style.display = 'block';
        errorEl.style.whiteSpace = 'pre-wrap'; // Support multiline
        errorEl.style.padding = '20px';
        errorEl.style.marginTop = '20px';
        errorEl.style.background = '#ffebee';
        errorEl.style.color = '#c62828';
        errorEl.style.borderRadius = '10px';
        errorEl.style.maxWidth = '100%';
        errorEl.style.fontSize = '0.95rem';
        errorEl.style.lineHeight = '1.6';
        // Don't auto-hide - let user read the full message
    } else {
        alert(message);
    }
}
