// Activity Administration JavaScript
// Manages activities and illustration generation

let allActivities = [];
let categories = [];
let isAdmin = false;

// Initialize page
document.addEventListener('DOMContentLoaded', async () => {
    await checkAdminAccess();
});

// Check if user is admin
async function checkAdminAccess() {
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        window.location.href = '/index.html';
        return;
    }

    // Select all columns and check whichever exists
    const { data: userData, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', user.id)
        .single();

    // Check ALL possible admin indicators
    let userIsAdmin = false;
    if (Array.isArray(userData?.user_types) && userData.user_types.includes('admin')) {
        userIsAdmin = true;
    } else if (userData?.user_type === 'admin') {
        userIsAdmin = true;
    } else if (userData?.role === 'admin') {
        userIsAdmin = true;
    }

    if (error || !userIsAdmin) {
        document.getElementById('accessDenied').style.display = 'block';
        document.getElementById('adminContent').style.display = 'none';
        return;
    }

    isAdmin = true;
    document.getElementById('adminContent').style.display = 'block';
    await loadActivities();
}

// Load all activities
async function loadActivities() {
    showLoading(true);

    try {
        // Load categories
        const { data: categoryData, error: catError } = await supabase
            .from('activity_categories')
            .select('*')
            .order('display_order');

        if (catError) throw catError;
        categories = categoryData || [];

        // Populate category filter
        const categoryFilter = document.getElementById('categoryFilter');
        categoryFilter.innerHTML = '<option value="">All Categories</option>';
        categories.forEach(cat => {
            categoryFilter.innerHTML += `<option value="${cat.id}">${cat.emoji} ${cat.name}</option>`;
        });

        // Load all activities (universal activities from kid_activities)
        const { data: activityData, error: actError } = await supabase
            .from('kid_activities')
            .select('*, activity_categories(id, name, emoji)')
            .order('name');

        if (actError) throw actError;
        allActivities = activityData || [];

        updateStats();
        renderActivities();
        showLoading(false);

    } catch (error) {
        console.error('Error loading activities:', error);
        showError('Failed to load activities: ' + error.message);
        showLoading(false);
    }
}

// Update statistics
function updateStats() {
    const total = allActivities.length;
    const withIllustrations = allActivities.filter(a => a.illustration_url).length;
    const needIllustrations = total - withIllustrations;

    document.getElementById('totalActivities').textContent = total;
    document.getElementById('withIllustrations').textContent = withIllustrations;
    document.getElementById('needIllustrations').textContent = needIllustrations;

    // Update bulk generate button
    const bulkBtn = document.getElementById('bulkGenerateBtn');
    if (needIllustrations === 0) {
        bulkBtn.disabled = true;
        bulkBtn.textContent = '✓ All Illustrations Generated';
    } else {
        bulkBtn.disabled = false;
        bulkBtn.textContent = `🎨 Generate Missing (${needIllustrations})`;
    }
}

// Render activities table
function renderActivities() {
    const tbody = document.getElementById('activitiesTableBody');
    const filtered = getFilteredActivities();

    if (filtered.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="4" style="text-align: center; padding: 40px; color: #666;">
                    No activities found matching your filters.
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = filtered.map(activity => {
        const category = activity.activity_categories || {};
        const hasImage = !!activity.illustration_url;

        return `
            <tr data-activity-id="${activity.id}">
                <td>
                    <div class="activity-name">${activity.name}</div>
                    ${activity.description ? `<div class="activity-description">${activity.description}</div>` : ''}
                </td>
                <td>
                    <span class="category-badge">
                        ${category.emoji || '📋'} ${category.name || 'Unknown'}
                    </span>
                </td>
                <td>
                    <div class="illustration-cell">
                        <div class="illustration-preview" id="preview-${activity.id}">
                            ${hasImage
                                ? `<img src="${activity.illustration_url}" alt="${activity.name}">`
                                : (category.emoji || '📋')}
                        </div>
                        <div>
                            <div class="illustration-status ${hasImage ? 'has-image' : 'no-image'}">
                                ${hasImage ? '✓ Has image' : '○ No image'}
                            </div>
                        </div>
                    </div>
                </td>
                <td>
                    <button class="btn btn-sm ${hasImage ? 'btn-secondary' : 'btn-generate'}"
                            onclick="generateIllustration('${activity.id}')"
                            id="btn-${activity.id}">
                        ${hasImage ? '🔄 Regenerate' : '🎨 Generate'}
                    </button>
                </td>
            </tr>
        `;
    }).join('');
}

// Get filtered activities based on current filters
function getFilteredActivities() {
    const searchTerm = document.getElementById('searchInput').value.toLowerCase();
    const categoryId = document.getElementById('categoryFilter').value;
    const illustrationStatus = document.getElementById('illustrationFilter').value;

    return allActivities.filter(activity => {
        // Search filter
        if (searchTerm) {
            const nameMatch = activity.name.toLowerCase().includes(searchTerm);
            const descMatch = activity.description?.toLowerCase().includes(searchTerm);
            if (!nameMatch && !descMatch) return false;
        }

        // Category filter
        if (categoryId && activity.category_id !== categoryId) {
            return false;
        }

        // Illustration filter
        if (illustrationStatus === 'has' && !activity.illustration_url) {
            return false;
        }
        if (illustrationStatus === 'needs' && activity.illustration_url) {
            return false;
        }

        return true;
    });
}

// Filter activities (called from UI)
function filterActivities() {
    renderActivities();
}

// Generate illustration for a single activity
async function generateIllustration(activityId) {
    const activity = allActivities.find(a => a.id === activityId);
    if (!activity) return;

    const btn = document.getElementById(`btn-${activityId}`);
    const preview = document.getElementById(`preview-${activityId}`);
    const originalBtnText = btn.innerHTML;

    btn.disabled = true;
    btn.innerHTML = '⏳ Generating...';
    btn.classList.add('generating');

    try {
        const response = await fetch('/.netlify/functions/generate-activity-image', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                activityId: activity.id,
                activityName: activity.name,
                categoryName: activity.activity_categories?.name || 'Activity'
            })
        });

        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.error || 'Failed to generate illustration');
        }

        // Update local data
        activity.illustration_url = result.imageUrl;

        // Update UI
        preview.innerHTML = `<img src="${result.imageUrl}" alt="${activity.name}">`;
        btn.innerHTML = '🔄 Regenerate';
        btn.classList.remove('btn-generate');
        btn.classList.add('btn-secondary');

        // Update the row's illustration status
        const row = document.querySelector(`tr[data-activity-id="${activityId}"]`);
        if (row) {
            const statusEl = row.querySelector('.illustration-status');
            if (statusEl) {
                statusEl.className = 'illustration-status has-image';
                statusEl.textContent = '✓ Has image';
            }
        }

        updateStats();
        showSuccess(`Illustration generated for "${activity.name}"`);

    } catch (error) {
        console.error('Error generating illustration:', error);
        showError(`Failed to generate illustration: ${error.message}`);
        btn.innerHTML = originalBtnText;
    } finally {
        btn.disabled = false;
        btn.classList.remove('generating');
    }
}

// Bulk generate missing illustrations
async function bulkGenerateIllustrations() {
    const activitiesNeedingImages = allActivities.filter(a => !a.illustration_url);

    if (activitiesNeedingImages.length === 0) {
        showSuccess('All activities already have illustrations!');
        return;
    }

    const confirmed = confirm(
        `This will generate illustrations for ${activitiesNeedingImages.length} activities.\n\n` +
        `This may take a while and uses AI image generation credits.\n\n` +
        `Continue?`
    );

    if (!confirmed) return;

    // Show progress
    const progressContainer = document.getElementById('bulkProgress');
    const progressCurrent = document.getElementById('progressCurrent');
    const progressTotal = document.getElementById('progressTotal');
    const progressFill = document.getElementById('progressFill');
    const progressStatus = document.getElementById('progressStatus');

    progressContainer.classList.add('visible');
    progressTotal.textContent = activitiesNeedingImages.length;

    const bulkBtn = document.getElementById('bulkGenerateBtn');
    bulkBtn.disabled = true;

    let completed = 0;
    let failed = 0;

    for (const activity of activitiesNeedingImages) {
        progressStatus.textContent = `Generating: ${activity.name}`;

        try {
            const response = await fetch('/.netlify/functions/generate-activity-image', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    activityId: activity.id,
                    activityName: activity.name,
                    categoryName: activity.activity_categories?.name || 'Activity'
                })
            });

            const result = await response.json();

            if (response.ok) {
                activity.illustration_url = result.imageUrl;
                completed++;
            } else {
                console.error(`Failed for ${activity.name}:`, result.error);
                failed++;
            }

        } catch (error) {
            console.error(`Error for ${activity.name}:`, error);
            failed++;
        }

        // Update progress
        const total = completed + failed;
        progressCurrent.textContent = total;
        progressFill.style.width = `${(total / activitiesNeedingImages.length) * 100}%`;

        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 1000));
    }

    // Done
    progressStatus.textContent = `Completed! ${completed} succeeded, ${failed} failed.`;

    setTimeout(() => {
        progressContainer.classList.remove('visible');
    }, 5000);

    updateStats();
    renderActivities();
    bulkBtn.disabled = false;

    if (failed > 0) {
        showError(`Generated ${completed} illustrations. ${failed} failed.`);
    } else {
        showSuccess(`Successfully generated ${completed} illustrations!`);
    }
}

// UI Helpers
function showLoading(show) {
    document.getElementById('loading').style.display = show ? 'block' : 'none';
}

function showError(message) {
    const el = document.getElementById('error');
    el.textContent = message;
    el.style.display = 'block';
    setTimeout(() => { el.style.display = 'none'; }, 5000);
}

function showSuccess(message) {
    const el = document.getElementById('success');
    el.textContent = message;
    el.style.display = 'block';
    setTimeout(() => { el.style.display = 'none'; }, 3000);
}
