// State
let currentKidId = null;
let currentContext = {};
let recommendations = [];
let supabaseDb = null;

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
    // Get Supabase client
    await window.supabaseUtils.initSupabase();
    supabaseDb = window.supabaseUtils.getClient();
    
    await loadPlatformNav();
    await checkAuth();
    await loadKids();
    setupEventListeners();
});

// Load platform navigation
async function loadPlatformNav() {
    try {
        const response = await fetch('platform-nav.html');
        const html = await response.text();
        document.getElementById('platform-nav-container').innerHTML = html;
        
        // Initialize platform nav if the script is available
        if (window.initializePlatformNav) {
            window.initializePlatformNav();
        }
    } catch (error) {
        console.error('Error loading platform nav:', error);
    }
}

// Check authentication
async function checkAuth() {
    const user = await window.supabaseUtils.getCurrentUser();
    
    if (!user) {
        window.location.href = 'auth.html';
        return;
    }
}

// Load kids
async function loadKids() {
    try {
        const user = await window.supabaseUtils.getCurrentUser();
        
        const { data: kids, error } = await supabaseDb
            .from('kids')
            .select('*')
            .eq('parent_id', user.id)
            .eq('is_active', true)
            .order('name');
        
        if (error) throw error;
        
        const kidButtons = document.getElementById('kidButtons');
        
        if (kids.length === 0) {
            kidButtons.innerHTML = `
                <div class="empty-state">
                    <h3>No kids found</h3>
                    <p>Add kids in the <a href="kid-preferences-manager.html">Kid Preferences Manager</a> first.</p>
                </div>
            `;
            return;
        }
        
        kidButtons.innerHTML = kids.map(kid => `
            <button class="kid-button" data-kid-id="${kid.id}">
                <span style="font-size: 24px;">${kid.avatar_emoji || '👶'}</span>
                <span>${kid.name}</span>
            </button>
        `).join('');
        
    } catch (error) {
        console.error('Error loading kids:', error);
        document.getElementById('kidButtons').innerHTML = `
            <div class="error-message">Error loading kids: ${error.message}</div>
        `;
    }
}

// Setup event listeners
function setupEventListeners() {
    // Kid selection
    document.getElementById('kidButtons').addEventListener('click', (e) => {
        const button = e.target.closest('.kid-button');
        if (!button) return;
        
        // Update active state
        document.querySelectorAll('.kid-button').forEach(btn => btn.classList.remove('active'));
        button.classList.add('active');
        
        // Set current kid and load recommendations
        currentKidId = button.dataset.kidId;
        document.getElementById('contextFilters').style.display = 'block';
        loadRecommendations();
    });
    
    // Context filters
    document.getElementById('contextFilters').addEventListener('click', (e) => {
        const button = e.target.closest('.filter-button');
        if (!button) return;
        
        // Update active state
        document.querySelectorAll('.filter-button').forEach(btn => btn.classList.remove('active'));
        button.classList.add('active');
        
        // Set context and reload recommendations
        const contextStr = button.dataset.context;
        currentContext = contextStr === 'all' ? {} : JSON.parse(contextStr);
        loadRecommendations();
    });
}

// Load recommendations
async function loadRecommendations() {
    if (!currentKidId) return;
    
    const container = document.getElementById('recommendationsContainer');
    container.innerHTML = '<div class="loading">Loading recommendations...</div>';
    
    try {
        // Call the get_recommendations_for_kid function with context filter
        // Context is passed as JSONB to match activity_contexts mappings
        const contextParam = Object.keys(currentContext).length > 0 ? currentContext : null;
        const { data, error } = await supabaseDb.rpc('get_recommendations_for_kid', {
            p_kid_id: currentKidId,
            p_context: contextParam,
            p_limit: 20
        });
        
        if (error) throw error;
        
        recommendations = data || [];
        
        if (recommendations.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <h3>No recommendations available</h3>
                    <p>Add some activity preferences to get personalized recommendations!</p>
                </div>
            `;
            return;
        }
        
        renderRecommendations();
        
    } catch (error) {
        console.error('Error loading recommendations:', error);
        container.innerHTML = `
            <div class="error-message">
                <strong>Error loading recommendations:</strong><br>
                ${error.message}
            </div>
        `;
    }
}

// Render recommendations
function renderRecommendations() {
    const container = document.getElementById('recommendationsContainer');
    
    const html = `
        <div class="recommendations-grid">
            ${recommendations.map(rec => renderRecommendationCard(rec)).join('')}
        </div>
    `;
    
    container.innerHTML = html;
    
    // Add event listeners for action buttons
    container.querySelectorAll('.action-button').forEach(button => {
        button.addEventListener('click', (e) => handleRecommendationAction(e));
    });
}

// Render a single recommendation card
function renderRecommendationCard(rec) {
    // Convert score (0-5 scale) to percentage for display
    // Clamp to valid range to handle any unexpected values
    const rawScore = parseFloat(rec.score) || 0;
    const scorePercent = Math.max(0, Math.min(100, Math.round((rawScore / 5) * 100)));
    const stars = getStarsForConfidence(scorePercent);
    const reasons = extractReasons(rec.explanation);
    
    return `
        <div class="recommendation-card" data-activity-id="${rec.activity_id}">
            <div class="recommendation-header">
                <div class="recommendation-title">${rec.activity_name}</div>
                <div class="confidence-badge">
                    <span class="stars">${stars}</span>
                    <span>${scorePercent}%</span>
                </div>
            </div>
            
            <div class="recommendation-score">Score: ${rec.score ? rec.score.toFixed(2) : 'N/A'}</div>
            
            ${rec.activity_description ? `
                <div class="recommendation-description">${rec.activity_description}</div>
            ` : ''}
            
            <div class="recommendation-reasons">
                <h4>Why we recommend this:</h4>
                ${reasons.map(reason => `
                    <span class="reason-tag ${reason.type}">${reason.text}</span>
                `).join('')}
            </div>
            
            <div class="recommendation-actions">
                <button class="action-button primary" data-action="selected">
                    ✓ Try This
                </button>
                <button class="action-button secondary" data-action="saved">
                    ⭐ Save for Later
                </button>
                <button class="action-button dismiss" data-action="dismissed">
                    ✕ Not Interested
                </button>
            </div>
        </div>
    `;
}

// Get stars for confidence level
function getStarsForConfidence(confidence) {
    // Clamp confidence to 0-100 range to prevent errors
    const clampedConfidence = Math.max(0, Math.min(100, confidence || 0));
    const fullStars = Math.min(5, Math.floor(clampedConfidence / 20));
    const halfStar = (clampedConfidence % 20) >= 10 && fullStars < 5 ? '½' : '';
    const emptyStars = Math.max(0, 5 - fullStars - (halfStar ? 1 : 0));
    return '★'.repeat(fullStars) + halfStar + '☆'.repeat(emptyStars);
}

// Extract human-readable reasons from explanation JSON
function extractReasons(explanation) {
    const reasons = [];
    
    if (explanation.preference && explanation.preference.level !== 'unknown') {
        const level = explanation.preference.level;
        if (level === 'loves') {
            reasons.push({ type: 'preference', text: '❤️ Your kid loves this!' });
        } else if (level === 'likes') {
            reasons.push({ type: 'preference', text: '👍 Your kid likes this' });
        }
    }
    
    if (explanation.parent && explanation.parent.level !== 'unknown') {
        const level = explanation.parent.level;
        if (level === 'both') {
            reasons.push({ type: 'parent', text: '👨‍👩‍👧 Both parents enjoy this' });
        } else if (level === 'mom' || level === 'dad') {
            reasons.push({ type: 'parent', text: `Parent preference: ${level}` });
        }
    }
    
    if (explanation.similar_kids && explanation.similar_kids.count > 0) {
        reasons.push({ 
            type: 'similar-kids', 
            text: `👥 ${explanation.similar_kids.count} similar kid(s) love this` 
        });
    }
    
    if (explanation.teacher && explanation.teacher.count > 0) {
        reasons.push({ 
            type: 'teacher', 
            text: `👩‍🏫 Teacher observed interest (${explanation.teacher.count})` 
        });
    }
    
    if (explanation.context && explanation.context.matched) {
        reasons.push({ type: 'context', text: '🎯 Perfect for current context' });
    }
    
    if (reasons.length === 0) {
        reasons.push({ type: 'context', text: '✨ Something new to try' });
    }
    
    return reasons;
}

// Handle recommendation action
async function handleRecommendationAction(e) {
    const button = e.target.closest('.action-button');
    if (!button) return;
    
    const card = button.closest('.recommendation-card');
    const activityId = card.dataset.activityId;
    const action = button.dataset.action;
    
    // Find the recommendation data
    const recommendation = recommendations.find(r => r.activity_id === activityId);
    if (!recommendation) return;
    
    try {
        // Record feedback
        const { error } = await supabaseDb.rpc('record_recommendation_feedback', {
            p_kid_id: currentKidId,
            p_activity_id: activityId,
            p_action: action,
            p_recommendation_score: recommendation.score,
            p_explanation: recommendation.explanation,
            p_context: currentContext
        });
        
        if (error) throw error;
        
        // Visual feedback
        button.textContent = action === 'selected' ? '✓ Added!' : 
                            action === 'saved' ? '⭐ Saved!' : 
                            '✕ Hidden';
        button.disabled = true;
        
        // If dismissed, fade out the card
        if (action === 'dismissed') {
            card.style.opacity = '0.3';
            card.style.pointerEvents = 'none';
        }
        
        // If selected, optionally redirect to preferences manager
        if (action === 'selected') {
            setTimeout(() => {
                if (confirm('Would you like to add this to your kid\'s preferences?')) {
                    window.location.href = `kid-prefs.html?kid=${currentKidId}&activity=${activityId}`;
                }
            }, 500);
        }
        
    } catch (error) {
        console.error('Error recording feedback:', error);
        alert('Error recording feedback: ' + error.message);
    }
}

// Export for use in other modules if needed
// (Keep for backwards compatibility but note: no ES6 exports used)
// export { loadRecommendations, currentKidId };
