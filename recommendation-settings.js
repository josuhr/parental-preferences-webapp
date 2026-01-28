// Settings Page Logic
// Combines Google Sheets, Caregiver Labels, and Recommendation Settings

// State
let currentUserId = null;
let currentUser = null;
let userProfile = null;
let userSettings = null;
let rules = {};
let hasChanges = false;
let supabaseDb = null;

// Preset configurations
const presets = {
    balanced: {
        preference_match: 0.40,
        parent_influence: 0.20,
        similar_kids: 0.20,
        teacher_endorsement: 0.10,
        context_match: 0.10,
        novelty_boost: 0.05,
        recency_penalty: 0.15
    },
    'kid-led': {
        preference_match: 0.60,
        parent_influence: 0.05,
        similar_kids: 0.15,
        teacher_endorsement: 0.05,
        context_match: 0.15,
        novelty_boost: 0.10,
        recency_penalty: 0.10
    },
    'parent-guided': {
        preference_match: 0.25,
        parent_influence: 0.40,
        similar_kids: 0.10,
        teacher_endorsement: 0.15,
        context_match: 0.10,
        novelty_boost: 0.03,
        recency_penalty: 0.10
    },
    discovery: {
        preference_match: 0.20,
        parent_influence: 0.15,
        similar_kids: 0.25,
        teacher_endorsement: 0.10,
        context_match: 0.10,
        novelty_boost: 0.30,
        recency_penalty: 0.20
    }
};

// Rule type mapping to UI element IDs
const ruleMapping = {
    preference_match: 'preferenceWeight',
    parent_influence: 'parentWeight',
    similar_kids: 'similarKidsWeight',
    teacher_endorsement: 'teacherWeight',
    context_match: 'contextWeight',
    novelty_boost: 'noveltyWeight',
    recency_penalty: 'recencyWeight'
};

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
    // Get Supabase client
    await window.supabaseUtils.initSupabase();
    supabaseDb = window.supabaseUtils.getClient();
    
    await checkAuth();
    await loadAllSettings();
    setupEventListeners();
});

// Check authentication
async function checkAuth() {
    currentUser = await window.supabaseUtils.getCurrentUser();
    
    if (!currentUser) {
        window.location.href = 'auth.html';
        return;
    }
    
    currentUserId = currentUser.id;
}

// Load all settings (Google Sheets, Caregiver Labels, Recommendation Rules)
async function loadAllSettings() {
    try {
        // Get user profile
        userProfile = await window.supabaseUtils.getUserProfile(currentUserId);
        
        if (!userProfile) {
            console.error('User profile not found');
            showError('User profile not found in database');
            return;
        }
        
        // Get user settings
        userSettings = await window.supabaseUtils.getUserSettings(currentUserId);
        
        // Load Google Sheet info
        loadSheetInfo();
        
        // Load Caregiver Labels
        loadCaregiverLabels();
        
        // Load Recommendation Settings
        await loadRecommendationSettings();
        
    } catch (error) {
        console.error('Error loading settings:', error);
        showError('Error loading settings: ' + error.message);
    }
}

// ===== GOOGLE SHEETS SECTION =====

function loadSheetInfo() {
    const sheetIdInput = document.getElementById('sheetId');
    const sheetStatus = document.getElementById('sheetStatus');
    
    if (userProfile.sheet_id) {
        sheetIdInput.value = userProfile.sheet_id;
        sheetStatus.innerHTML = '<span class="status-badge success">✓ Connected</span>';
    } else {
        sheetStatus.innerHTML = '<span class="status-badge warning">Not configured</span>';
    }
}

async function testSheetConnection() {
    const sheetIdInput = document.getElementById('sheetId');
    const testSheetBtn = document.getElementById('testSheetBtn');
    const sheetStatus = document.getElementById('sheetStatus');
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
        showSuccess('Sheet connection successful! Remember to save.');
        
    } catch (error) {
        console.error('Sheet test error:', error);
        showError(error.message || 'Failed to connect to sheet');
    } finally {
        testSheetBtn.disabled = false;
        testSheetBtn.textContent = 'Test Connection';
    }
}

async function saveSheetId() {
    const sheetIdInput = document.getElementById('sheetId');
    const saveSheetBtn = document.getElementById('saveSheetBtn');
    const sheetStatus = document.getElementById('sheetStatus');
    const sheetId = sheetIdInput.value.trim();
    
    if (!sheetId) {
        showError('Please enter a Google Sheet ID');
        return;
    }
    
    saveSheetBtn.disabled = true;
    saveSheetBtn.textContent = 'Saving...';
    
    try {
        const { error } = await supabaseDb
            .from('users')
            .update({ sheet_id: sheetId })
            .eq('id', currentUserId);
        
        if (error) throw error;
        
        userProfile.sheet_id = sheetId;
        sheetStatus.innerHTML = '<span class="status-badge success">✓ Connected</span>';
        showSuccess('Sheet ID saved successfully!');
        
    } catch (error) {
        console.error('Error saving sheet ID:', error);
        showError('Failed to save sheet ID');
    } finally {
        saveSheetBtn.disabled = false;
        saveSheetBtn.textContent = 'Save Sheet ID';
    }
}

// ===== CAREGIVER LABELS SECTION =====

function loadCaregiverLabels() {
    const caregiver1LabelInput = document.getElementById('caregiver1Label');
    const caregiver1EmojiSelect = document.getElementById('caregiver1Emoji');
    const caregiver2LabelInput = document.getElementById('caregiver2Label');
    const caregiver2EmojiSelect = document.getElementById('caregiver2Emoji');
    const bothLabelInput = document.getElementById('bothLabel');
    const bothEmojiSelect = document.getElementById('bothEmoji');
    
    if (userSettings) {
        caregiver1LabelInput.value = userSettings.caregiver1_label || 'Mom';
        caregiver1EmojiSelect.value = userSettings.caregiver1_emoji || '💗';
        caregiver2LabelInput.value = userSettings.caregiver2_label || 'Dad';
        caregiver2EmojiSelect.value = userSettings.caregiver2_emoji || '💙';
        bothLabelInput.value = userSettings.both_label || 'Both';
        bothEmojiSelect.value = userSettings.both_emoji || '💜';
    }
}

async function saveCaregiverLabels() {
    const caregiver1LabelInput = document.getElementById('caregiver1Label');
    const caregiver1EmojiSelect = document.getElementById('caregiver1Emoji');
    const caregiver2LabelInput = document.getElementById('caregiver2Label');
    const caregiver2EmojiSelect = document.getElementById('caregiver2Emoji');
    const bothLabelInput = document.getElementById('bothLabel');
    const bothEmojiSelect = document.getElementById('bothEmoji');
    const saveCaregiverLabelsBtn = document.getElementById('saveCaregiverLabelsBtn');
    
    const caregiver1Label = caregiver1LabelInput.value.trim() || 'Mom';
    const caregiver1Emoji = caregiver1EmojiSelect.value;
    const caregiver2Label = caregiver2LabelInput.value.trim() || 'Dad';
    const caregiver2Emoji = caregiver2EmojiSelect.value;
    const bothLabel = bothLabelInput.value.trim() || 'Both';
    const bothEmoji = bothEmojiSelect.value;
    
    saveCaregiverLabelsBtn.disabled = true;
    saveCaregiverLabelsBtn.textContent = 'Saving...';
    
    try {
        const { error } = await supabaseDb
            .from('user_settings')
            .update({
                caregiver1_label: caregiver1Label,
                caregiver1_emoji: caregiver1Emoji,
                caregiver2_label: caregiver2Label,
                caregiver2_emoji: caregiver2Emoji,
                both_label: bothLabel,
                both_emoji: bothEmoji
            })
            .eq('user_id', currentUserId);
        
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
        
        showSuccess('Caregiver labels saved successfully!');
        
    } catch (error) {
        console.error('Error saving caregiver labels:', error);
        showError('Failed to save caregiver labels');
    } finally {
        saveCaregiverLabelsBtn.disabled = false;
        saveCaregiverLabelsBtn.textContent = 'Save Caregiver Labels';
    }
}

// ===== RECOMMENDATION SETTINGS SECTION =====

// Load current recommendation settings
async function loadRecommendationSettings() {
    try {
        const { data, error } = await supabaseDb
            .from('recommendation_rules')
            .select('*')
            .eq('user_id', currentUserId);
        
        if (error) throw error;
        
        // Convert array to object keyed by rule_type
        rules = {};
        data.forEach(rule => {
            rules[rule.rule_type] = rule;
        });
        
        // Update UI with loaded values
        updateSlidersFromRules();
        
    } catch (error) {
        console.error('Error loading recommendation settings:', error);
        showError('Error loading recommendation settings: ' + error.message);
    }
}

// Update sliders from rules object
function updateSlidersFromRules() {
    Object.keys(ruleMapping).forEach(ruleType => {
        const elementId = ruleMapping[ruleType];
        const slider = document.getElementById(elementId);
        const valueDisplay = document.getElementById(elementId.replace('Weight', 'Value'));
        
        if (slider && rules[ruleType]) {
            const percentValue = Math.round(rules[ruleType].weight * 100);
            slider.value = percentValue;
            if (valueDisplay) {
                valueDisplay.textContent = percentValue + '%';
            }
        }
    });
}

// Apply a preset
function applyPreset(presetName) {
    const preset = presets[presetName];
    if (!preset) return;
    
    Object.keys(preset).forEach(ruleType => {
        const elementId = ruleMapping[ruleType];
        const slider = document.getElementById(elementId);
        const valueDisplay = document.getElementById(elementId.replace('Weight', 'Value'));
        
        if (slider) {
            const percentValue = Math.round(preset[ruleType] * 100);
            slider.value = percentValue;
            if (valueDisplay) {
                valueDisplay.textContent = percentValue + '%';
            }
        }
    });
    
    hasChanges = true;
}

// Save recommendation settings
async function saveRecommendationSettings() {
    const saveButton = document.getElementById('saveRecommendationBtn');
    saveButton.disabled = true;
    saveButton.textContent = 'Saving...';
    
    try {
        // Collect current values from sliders
        const updates = [];
        
        Object.keys(ruleMapping).forEach(ruleType => {
            const elementId = ruleMapping[ruleType];
            const slider = document.getElementById(elementId);
            
            if (slider) {
                const weight = parseFloat(slider.value) / 100;
                updates.push({
                    user_id: currentUserId,
                    rule_type: ruleType,
                    weight: weight,
                    is_enabled: true
                });
            }
        });
        
        // Upsert all rules
        for (const update of updates) {
            const { error } = await supabaseDb
                .from('recommendation_rules')
                .upsert(update, {
                    onConflict: 'user_id,rule_type'
                });
            
            if (error) throw error;
        }
        
        showSuccess('Recommendation settings saved successfully!');
        
        hasChanges = false;
        
        // Reload settings to ensure sync
        await loadRecommendationSettings();
        
    } catch (error) {
        console.error('Error saving recommendation settings:', error);
        showError('Error saving recommendation settings: ' + error.message);
    } finally {
        saveButton.disabled = false;
        saveButton.textContent = 'Save Recommendation Settings';
    }
}

// ===== EVENT LISTENERS =====

function setupEventListeners() {
    // Google Sheets
    const testSheetBtn = document.getElementById('testSheetBtn');
    const saveSheetBtn = document.getElementById('saveSheetBtn');
    if (testSheetBtn) testSheetBtn.addEventListener('click', testSheetConnection);
    if (saveSheetBtn) saveSheetBtn.addEventListener('click', saveSheetId);
    
    // Caregiver Labels
    const saveCaregiverLabelsBtn = document.getElementById('saveCaregiverLabelsBtn');
    if (saveCaregiverLabelsBtn) saveCaregiverLabelsBtn.addEventListener('click', saveCaregiverLabels);
    
    // Recommendation Settings - Preset buttons
    document.querySelectorAll('.preset-button').forEach(button => {
        button.addEventListener('click', () => {
            const preset = button.dataset.preset;
            applyPreset(preset);
            
            // Update active state
            document.querySelectorAll('.preset-button').forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');
        });
    });
    
    // Recommendation Settings - Sliders
    Object.keys(ruleMapping).forEach(ruleType => {
        const elementId = ruleMapping[ruleType];
        const slider = document.getElementById(elementId);
        const valueDisplay = document.getElementById(elementId.replace('Weight', 'Value'));
        
        if (slider) {
            slider.addEventListener('input', (e) => {
                const value = e.target.value;
                if (valueDisplay) {
                    valueDisplay.textContent = value + '%';
                }
                hasChanges = true;
                
                // Clear preset active state when manually adjusting
                document.querySelectorAll('.preset-button').forEach(btn => btn.classList.remove('active'));
            });
        }
    });
    
    // Save and Reset buttons
    const saveRecommendationBtn = document.getElementById('saveRecommendationBtn');
    const resetButton = document.getElementById('resetButton');
    
    if (saveRecommendationBtn) {
        saveRecommendationBtn.addEventListener('click', saveRecommendationSettings);
    }
    
    if (resetButton) {
        resetButton.addEventListener('click', () => {
            if (confirm('Are you sure you want to reset to default balanced settings?')) {
                applyPreset('balanced');
                saveRecommendationSettings();
            }
        });
    }
}

// ===== UTILITY FUNCTIONS =====

function showSuccess(message) {
    const successMessage = document.getElementById('successMessage');
    successMessage.textContent = message;
    successMessage.style.display = 'block';
    setTimeout(() => {
        successMessage.style.display = 'none';
    }, 3000);
}

function showError(message) {
    alert('Error: ' + message);
    console.error(message);
}

// Warn before leaving if there are unsaved changes
window.addEventListener('beforeunload', (e) => {
    if (hasChanges) {
        e.preventDefault();
        e.returnValue = '';
    }
});
