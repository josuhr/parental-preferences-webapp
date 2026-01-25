import { supabase } from './supabase-config.js';

// State
let currentUserId = null;
let rules = {};
let hasChanges = false;

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
    await loadPlatformNav();
    await checkAuth();
    await loadSettings();
    setupEventListeners();
});

// Load platform navigation
async function loadPlatformNav() {
    try {
        const response = await fetch('platform-nav.html');
        const html = await response.text();
        document.getElementById('platform-nav-container').innerHTML = html;
        
        if (window.initializePlatformNav) {
            window.initializePlatformNav();
        }
    } catch (error) {
        console.error('Error loading platform nav:', error);
    }
}

// Check authentication
async function checkAuth() {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
        window.location.href = 'auth.html';
        return;
    }
    
    currentUserId = user.id;
}

// Load current settings
async function loadSettings() {
    try {
        const { data, error } = await supabase
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
        console.error('Error loading settings:', error);
        alert('Error loading settings: ' + error.message);
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

// Setup event listeners
function setupEventListeners() {
    // Preset buttons
    document.querySelectorAll('.preset-button').forEach(button => {
        button.addEventListener('click', () => {
            const preset = button.dataset.preset;
            applyPreset(preset);
            
            // Update active state
            document.querySelectorAll('.preset-button').forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');
        });
    });
    
    // Sliders
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
    
    // Save button
    document.getElementById('saveButton').addEventListener('click', saveSettings);
    
    // Reset button
    document.getElementById('resetButton').addEventListener('click', () => {
        if (confirm('Are you sure you want to reset to default balanced settings?')) {
            applyPreset('balanced');
            saveSettings();
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

// Save settings
async function saveSettings() {
    const saveButton = document.getElementById('saveButton');
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
            const { error } = await supabase
                .from('recommendation_rules')
                .upsert(update, {
                    onConflict: 'user_id,rule_type'
                });
            
            if (error) throw error;
        }
        
        // Show success message
        const successMessage = document.getElementById('successMessage');
        successMessage.style.display = 'block';
        setTimeout(() => {
            successMessage.style.display = 'none';
        }, 3000);
        
        hasChanges = false;
        
        // Reload settings to ensure sync
        await loadSettings();
        
    } catch (error) {
        console.error('Error saving settings:', error);
        alert('Error saving settings: ' + error.message);
    } finally {
        saveButton.disabled = false;
        saveButton.textContent = 'Save Settings';
    }
}

// Warn before leaving if there are unsaved changes
window.addEventListener('beforeunload', (e) => {
    if (hasChanges) {
        e.preventDefault();
        e.returnValue = '';
    }
});

export { applyPreset, saveSettings };
