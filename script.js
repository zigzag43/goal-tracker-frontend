// Global state
let allGoals = [];
let filteredGoals = [];
let currentFilter = 'all';
let currentSort = 'date-desc';
let timerInterval = null;
let timerSeconds = TIMER_CONFIG.POMODORO;
let isTimerRunning = false;

// DOM Ready
document.addEventListener('DOMContentLoaded', () => {
    // Initialize
    initializeApp();
    
    // Event Listeners
    setupEventListeners();
});

// Initialize app
function initializeApp() {
    // Set default date to today
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('goal-deadline').min = today;
    
    // Load saved timer state
    loadTimerState();
    
    // Initialize tooltips, etc.
    console.log('Goal Tracker initialized');
}

// Setup all event listeners
function setupEventListeners() {
    // Goal form submission
    const goalForm = document.getElementById('goal-form');
    goalForm.addEventListener('submit', handleGoalSubmit);
    
    // Timer session change
    const sessionSelect = document.getElementById('session-select');
    sessionSelect.addEventListener('change', (e) => {
        if (!isTimerRunning) {
            timerSeconds = parseInt(e.target.value) * 60;
            updateTimerDisplay();
        }
    });
    
    // Import file
    const importFile = document.getElementById('import-file');
    importFile.addEventListener('change', handleImportFile);
    
    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
        // Ctrl/Cmd + N for new goal
        if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
            e.preventDefault();
            document.getElementById('goal-title').focus();
        }
        
        // Escape to close modals
        if (e.key === 'Escape') {
            closeAllModals();
        }
    });
}

// ==================== GOAL MANAGEMENT ====================

// Handle goal form submission
async function handleGoalSubmit(e) {
    e.preventDefault();
    
    if (!isAuthenticated()) {
        showNotification('Please login first', 'error');
        return;
    }
    
    // Get form data
    const goalData = {
        title: document.getElementById('goal-title').value.trim(),
        description: document.getElementById('goal-description').value.trim(),
        category: document.getElementById('goal-category').value,
        priority: document.getElementById('goal-priority').value,
        deadline: document.getElementById('goal-deadline').value,
        reminder: document.getElementById('goal-reminder').value,
        userId: getCurrentUserId(),
        completed: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
    };
    
    // Validation
    if (!goalData.title) {
        showNotification('Goal title is required', 'error');
        return;
    }
    
    try {
        showNotification('Adding goal...', 'info');
        
        const token = await getUserToken();
        
        const response = await fetch(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.GOALS}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(goalData)
        });
        
        if (!response.ok) {
            throw new Error('Failed to add goal');
        }
        
        const newGoal = await response.json();
        console.log('Goal added:', newGoal);
        
        // Add to local array
        allGoals.unshift(newGoal);
        
        // Update UI
        renderGoals();
        updateStats();
        
        // Reset form
        goalForm.reset();
        document.getElementById('goal-deadline').min = new Date().toISOString().split('T')[0];
        
        showNotification('Goal added successfully!', 'success');
        
    } catch (error) {
        console.error('Error adding goal:', error);
        showNotification('Failed to add goal', 'error');
    }
}

// Load user goals
async function loadUserGoals() {
    if (!isAuthenticated()) return;
    
    const container = document.getElementById('goals-container');
    container.innerHTML = '<div class="loading">Loading your goals...</div>';
    
    try {
        const token = await getUserToken();
        const userId = getCurrentUserId();
        
        const response = await fetch(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.GOALS}?userId=${userId}`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (!response.ok) {
            throw new Error('Failed to load goals');
        }
        
        const goals = await response.json();
        allGoals = goals;
        
        // Cache goals locally
        localStorage.setItem(APP_CONFIG.STORAGE_KEYS.GOALS_CACHE, JSON.stringify(goals));
        
        renderGoals();
        updateStats();
        
    } catch (error) {
        console.error('Error loading goals:', error);
        
        // Try to load from cache
        const cachedGoals = localStorage.getItem(APP_CONFIG.STORAGE_KEYS.GOALS_CACHE);
        if (cachedGoals) {
            allGoals = JSON.parse(cachedGoals);
            renderGoals();
            updateStats();
            showNotification('Loaded from cache (offline mode)', 'warning');
        } else {
            container.innerHTML = '<div class="error-message">Failed to load goals</div>';
        }
    }
}

// Render goals list
function renderGoals() {
    const container = document.getElementById('goals-container');
    
    // Apply current filter
    filterGoals(currentFilter);
    
    // Apply current sort
    sortGoals(currentSort);
    
    if (filteredGoals.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <p>No goals found</p>
                <button onclick="clearFilters()" class="btn btn-outline">Clear Filters</button>
            </div>
        `;
        return;
    }
    
    const goalsHTML = filteredGoals.map(goal => {
        const deadline = new Date(goal.deadline);
        const today = new Date();
        const daysLeft = Math.ceil((deadline - today) / (1000 * 60 * 60 * 24));
        const isOverdue = daysLeft < 0 && !goal.completed;
        
        return `
            <div class="goal-item ${goal.priority}-priority ${goal.completed ? 'completed' : ''} ${isOverdue ? 'overdue' : ''}" 
                 id="goal-${goal._id || goal.id}">
                <div class="goal-header">
                    <h3 class="goal-title">${escapeHtml(goal.title)}</h3>
                    <span class="goal-category" style="background-color: ${APP_CONFIG.CATEGORIES[goal.category].color}">
                        ${APP_CONFIG.CATEGORIES[goal.category].name}
                    </span>
                </div>
                
                ${goal.description ? `<p class="goal-description">${escapeHtml(goal.description)}</p>` : ''}
                
                <div class="goal-meta">
                    <div class="goal-deadline">
                        <svg width="16" height="16" fill="currentColor">
                            <path d="M8 3.5a.5.5 0 0 0-1 0V9a.5.5 0 0 0 .252.434l3.5 2a.5.5 0 0 0 .496-.868L8 8.71V3.5z"/>
                            <path d="M8 16A8 8 0 1 0 8 0a8 8 0 0 0 0 16zm7-8A7 7 0 1 1 1 8a7 7 0 0 1 14 0z"/>
                        </svg>
                        <span>${formatDate(goal.deadline)} (${daysLeft >= 0 ? `${daysLeft} days left` : `${Math.abs(daysLeft)} days overdue`})</span>
                    </div>
                    <div class="priority-badge" style="color: ${APP_CONFIG.PRIORITIES[goal.priority].color}">
                        ${APP_CONFIG.PRIORITIES[goal.priority].name} Priority
                    </div>
                </div>
                
                <div class="goal-actions">
                    ${!goal.completed ? 
                        `<button onclick="toggleGoalComplete('${goal._id || goal.id}')" class="complete-btn">
                            Mark Complete
                        </button>` :
                        `<button onclick="toggleGoalComplete('${goal._id || goal.id}')" class="complete-btn">
                            Mark Incomplete
                        </button>`
                    }
                    <button onclick="editGoal('${goal._id || goal.id}')" class="edit-btn">Edit</button>
                    <button onclick="deleteGoal('${goal._id || goal.id}')" class="delete-btn">Delete</button>
                </div>
            </div>
        `;
    }).join('');
    
    container.innerHTML = goalsHTML;
}

// Filter goals
function filterGoals(filter) {
    currentFilter = filter;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    switch (filter) {
        case 'all':
            filteredGoals = [...allGoals];
            break;
            
        case 'today':
            filteredGoals = allGoals.filter(goal => {
                const goalDate = new Date(goal.deadline);
                goalDate.setHours(0, 0, 0, 0);
                return goalDate.getTime() === today.getTime();
            });
            break;
            
        case 'week':
            const weekEnd = new Date(today);
            weekEnd.setDate(weekEnd.getDate() + 7);
            filteredGoals = allGoals.filter(goal => {
                const goalDate = new Date(goal.deadline);
                return goalDate >= today && goalDate <= weekEnd;
            });
            break;
            
        case 'month':
            const monthEnd = new Date(today);
            monthEnd.setMonth(monthEnd.getMonth() + 1);
            filteredGoals = allGoals.filter(goal => {
                const goalDate = new Date(goal.deadline);
                return goalDate >= today && goalDate <= monthEnd;
            });
            break;
            
        case 'completed':
            filteredGoals = allGoals.filter(goal => goal.completed);
            break;
            
        case 'pending':
            filteredGoals = allGoals.filter(goal => !goal.completed);
            break;
            
        default:
            filteredGoals = [...allGoals];
    }
    
    // Update active filter button
    document.querySelectorAll('.week-day').forEach(btn => {
        btn.classList.remove('active');
    });
    event.target.classList.add('active');
    
    renderGoals();
}

// Sort goals
function sortGoals(sortBy) {
    currentSort = sortBy;
    
    switch (sortBy) {
        case 'date-desc':
            filteredGoals.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
            break;
            
        case 'date-asc':
            filteredGoals.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
            break;
            
        case 'priority':
            const priorityOrder = { high: 0, medium: 1, low: 2 };
            filteredGoals.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);
            break;
            
        case 'deadline':
            filteredGoals.sort((a, b) => new Date(a.deadline) - new Date(b.deadline));
            break;
    }
}

// Toggle goal completion
async function toggleGoalComplete(goalId) {
    const goal = allGoals.find(g => (g._id || g.id) === goalId);
    if (!goal) return;
    
    try {
        const token = await getUserToken();
        const newStatus = !goal.completed;
        
        const response = await fetch(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.GOALS}/${goalId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ 
                completed: newStatus,
                updatedAt: new Date().toISOString()
            })
        });
        
        if (!response.ok) {
            throw new Error('Failed to update goal');
        }
        
        // Update local data
        goal.completed = newStatus;
        goal.updatedAt = new Date().toISOString();
        
        // Update UI
        renderGoals();
        updateStats();
        
        if (newStatus) {
            showNotification('Goal completed! 🎉', 'success');
            updateProgress();
        } else {
            showNotification('Goal marked as incomplete', 'info');
        }
        
    } catch (error) {
        console.error('Error updating goal:', error);
        showNotification('Failed to update goal', 'error');
    }
}

// Edit goal
function editGoal(goalId) {
    const goal = allGoals.find(g => (g._id || g.id) === goalId);
    if (!goal) return;
    
    // Populate form with goal data
    document.getElementById('goal-title').value = goal.title;
    document.getElementById('goal-description').value = goal.description || '';
    document.getElementById('goal-category').value = goal.category;
    document.getElementById('goal-priority').value = goal.priority;
    document.getElementById('goal-deadline').value = goal.deadline.split('T')[0];
    document.getElementById('goal-reminder').value = goal.reminder;
    
    // Scroll to form
    document.querySelector('.goal-form').scrollIntoView({ behavior: 'smooth' });
    
    // Change submit button to update
    const submitBtn = document.querySelector('#goal-form button[type="submit"]');
    submitBtn.textContent = 'Update Goal';
    submitBtn.onclick = (e) => {
        e.preventDefault();
        updateGoal(goalId);
    };
}

// Update goal
async function updateGoal(goalId) {
    if (!isAuthenticated()) {
        showNotification('Please login first', 'error');
        return;
    }
    
    const updatedData = {
        title: document.getElementById('goal-title').value.trim(),
        description: document.getElementById('goal-description').value.trim(),
        category: document.getElementById('goal-category').value,
        priority: document.getElementById('goal-priority').value,
        deadline: document.getElementById('goal-deadline').value,
        reminder: document.getElementById('goal-reminder').value,
        updatedAt: new Date().toISOString()
    };
    
    try {
        const token = await getUserToken();
        
        const response = await fetch(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.GOALS}/${goalId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(updatedData)
        });
        
        if (!response.ok) {
            throw new Error('Failed to update goal');
        }
        
        // Update local data
        const goalIndex = allGoals.findIndex(g => (g._id || g.id) === goalId);
        if (goalIndex !== -1) {
            allGoals[goalIndex] = { ...allGoals[goalIndex], ...updatedData };
        }
        
        // Reset form
        document.getElementById('goal-form').reset();
        const submitBtn = document.querySelector('#goal-form button[type="submit"]');
        submitBtn.textContent = 'Add Goal';
        submitBtn.onclick = handleGoalSubmit;
        
        // Update UI
        renderGoals();
        showNotification('Goal updated successfully!', 'success');
        
    } catch (error) {
        console.error('Error updating goal:', error);
        showNotification('Failed to update goal', 'error');
    }
}

// Delete goal
async function deleteGoal(goalId) {
    if (!confirm('Are you sure you want to delete this goal?')) return;
    
    try {
        const token = await getUserToken();
        
        const response = await fetch(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.GOALS}/${goalId}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (!response.ok) {
            throw new Error('Failed to delete goal');
        }
        
        // Remove from local array
        allGoals = allGoals.filter(g => (g._id || g.id) !== goalId);
        
        // Update UI
        renderGoals();
        updateStats();
        
        showNotification('Goal deleted', 'success');
        
    } catch (error) {
        console.error('Error deleting goal:', error);
        showNotification('Failed to delete goal', 'error');
    }
}

// ==================== TIMER FUNCTIONS ====================

// Start timer
function startTimer() {
    if (isTimerRunning) return;
    
    isTimerRunning = true;
    document.getElementById('start-timer').disabled = true;
    document.getElementById('reset-timer').disabled = false;
    
    timerInterval = setInterval(() => {
        timerSeconds--;
        updateTimerDisplay();
        
        if (timerSeconds <= 0) {
            clearInterval(timerInterval);
            isTimerRunning = false;
            document.getElementById('start-timer').disabled = false;
            
            // Play sound or notification
            showNotification('Timer completed! Take a break 🎉', 'success');
            playTimerSound();
            
            // Save timer session
            saveTimerSession();
        }
    }, 1000);
    
    // Save state
    saveTimerState();
}

// Reset timer
function resetTimer() {
    clearInterval(timerInterval);
    isTimerRunning = false;
    
    const sessionValue = document.getElementById('session-select').value;
    timerSeconds = parseInt(sessionValue) * 60;
    
    updateTimerDisplay();
    
    document.getElementById('start-timer').disabled = false;
    document.getElementById('reset-timer').disabled = true;
    
    saveTimerState();
}

// Update timer display
function updateTimerDisplay() {
    const minutes = Math.floor(timerSeconds / 60);
    const seconds = timerSeconds % 60;
    
    document.getElementById('timer-display').textContent = 
        `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

// Save timer state
function saveTimerState() {
    const state = {
        seconds: timerSeconds,
        isRunning: isTimerRunning,
        session: document.getElementById('session-select').value
    };
    
    localStorage.setItem('timerState', JSON.stringify(state));
}

// Load timer state
function loadTimerState() {
    const saved = localStorage.getItem('timerState');
    if (saved) {
        const state = JSON.parse(saved);
        timerSeconds = state.seconds;
        document.getElementById('session-select').value = state.session;
        updateTimerDisplay();
        
        if (state.isRunning) {
            startTimer();
        }
    }
}

// Save completed timer session
function saveTimerSession() {
    const sessions = JSON.parse(localStorage.getItem('timerSessions') || '[]');
    sessions.push({
        date: new Date().toISOString(),
        duration: parseInt(document.getElementById('session-select').value),
        userId: getCurrentUserId()
    });
    
    localStorage.setItem('timerSessions', JSON.stringify(sessions));
}

// Play timer completion sound
function playTimerSound() {
    const audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBT2Gy+7ZhjQIHGHA7+OZURE');
    audio.play().catch(e => console.log('Could not play sound'));
}

// ==================== STATISTICS ====================

// Update statistics
function updateStats() {
    const total = allGoals.length;
    const completed = allGoals.filter(g => g.completed).length;
    const pending = allGoals.filter(g => !g.completed).length;
    const today = new Date();
    const overdue = allGoals.filter(g => {
        return !g.completed && new Date(g.deadline) < today;
    }).length;
    
    // Update stat cards
    document.getElementById('stat-total').textContent = total;
    document.getElementById('stat-completed').textContent = completed;
    document.getElementById('stat-progress').textContent = pending;
    document.getElementById('stat-overdue').textContent = overdue;
    
    // Update header stats
    document.getElementById('total-goals').textContent = `Total Goals: ${total}`;
    document.getElementById('completed-goals').textContent = completed;
    document.getElementById('active-goals-count').textContent = `${pending} active`;
    
    // Calculate completion rate
    const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;
    document.getElementById('completion-rate').textContent = `${completionRate}% completion rate`;
    
    // Update progress bar
    updateProgress();
    
    // Update category chart
    updateCategoryChart();
}

// Update main progress bar
function updateProgress() {
    const total = allGoals.length;
    const completed = allGoals.filter(g => g.completed).length;
    const progress = total > 0 ? (completed / total) * 100 : 0;
    
    document.getElementById('main-progress-bar').style.width = `${progress}%`;
    document.getElementById('current-milestone').textContent = `Current Progress: ${Math.round(progress)}%`;
}

// Update category chart
function updateCategoryChart() {
    const container = document.getElementById('category-chart');
    const categories = {};
    
    // Count goals by category
    allGoals.forEach(goal => {
        if (!categories[goal.category]) {
            categories[goal.category] = { total: 0, completed: 0 };
        }
        categories[goal.category].total++;
        if (goal.completed) {
            categories[goal.category].completed++;
        }
    });
    
    // Create progress bars
    const html = Object.entries(categories).map(([category, data]) => {
        const percentage = data.total > 0 ? (data.completed / data.total) * 100 : 0;
        
        return `
            <div class="category-bar">
                <div class="category-name">
                    <span>${APP_CONFIG.CATEGORIES[category].name}</span>
                    <span>${data.completed}/${data.total}</span>
                </div>
                <div class="category-progress-bar">
                    <div class="category-progress-fill" 
                         style="width: ${percentage}%; background-color: ${APP_CONFIG.CATEGORIES[category].color}">
                    </div>
                </div>
            </div>
        `;
    }).join('');
    
    container.innerHTML = html || '<p>No goals yet</p>';
}

// ==================== IMPORT/EXPORT ====================

// Export goals
function exportGoals() {
    const exportData = {
        version: '1.0',
        exportDate: new Date().toISOString(),
        user: getCurrentUserEmail(),
        goals: allGoals,
        stats: {
            total: allGoals.length,
            completed: allGoals.filter(g => g.completed).length
        }
    };
    
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { 
        type: 'application/json' 
    });
    
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `goals-backup-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    showNotification('Goals exported successfully', 'success');
}

// Import goals
function importGoals() {
    document.getElementById('import-file').click();
}

// Handle import file
async function handleImportFile(e) {
    const file = e.target.files[0];
    if (!file) return;
    
    try {
        const text = await file.text();
        const data = JSON.parse(text);
        
        if (!data.goals || !Array.isArray(data.goals)) {
            throw new Error('Invalid file format');
        }
        
        // Confirm import
        const confirmMsg = `Import ${data.goals.length} goals from backup?\nThis will ADD to your existing goals.`;
        if (!confirm(confirmMsg)) return;
        
        // Import each goal
        let imported = 0;
        for (const goal of data.goals) {
            try {
                // Remove ID to create new goal
                delete goal._id;
                delete goal.id;
                
                // Set current user ID
                goal.userId = getCurrentUserId();
                
                // Add to backend
                const token = await getUserToken();
                const response = await fetch(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.GOALS}`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify(goal)
                });
                
                if (response.ok) {
                    imported++;
                }
            } catch (error) {
                console.error('Error importing goal:', error);
            }
        }
        
        // Reload goals
        await loadUserGoals();
        
        showNotification(`Imported ${imported} out of ${data.goals.length} goals`, 'success');
        
    } catch (error) {
        console.error('Import error:', error);
        showNotification('Failed to import goals', 'error');
    }
    
    // Clear file input
    e.target.value = '';
}

// Clear completed goals
async function clearCompleted() {
    const completedGoals = allGoals.filter(g => g.completed);
    
    if (completedGoals.length === 0) {
        showNotification('No completed goals to clear', 'info');
        return;
    }
    
    if (!confirm(`Delete ${completedGoals.length} completed goals? This cannot be undone.`)) {
        return;
    }
    
    try {
        const token = await getUserToken();
        let deleted = 0;
        
        for (const goal of completedGoals) {
            try {
                const response = await fetch(
                    `${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.GOALS}/${goal._id || goal.id}`, 
                    {
                        method: 'DELETE',
                        headers: {
                            'Authorization': `Bearer ${token}`
                        }
                    }
                );
                
                if (response.ok) {
                    deleted++;
                }
            } catch (error) {
                console.error('Error deleting goal:', error);
            }
        }
        
        // Reload goals
        await loadUserGoals();
        
        showNotification(`Cleared ${deleted} completed goals`, 'success');
        
    } catch (error) {
        console.error('Error clearing goals:', error);
        showNotification('Failed to clear completed goals', 'error');
    }
}

// ==================== UTILITY FUNCTIONS ====================

// Show notification
function showNotification(message, type = 'info') {
    const container = document.getElementById('notification-container');
    
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.innerHTML = `
        <span>${message}</span>
        <button onclick="this.parentElement.remove()">×</button>
    `;
    
    container.appendChild(notification);
    
    // Auto remove after 5 seconds
    setTimeout(() => {
        notification.remove();
    }, 5000);
}

// Escape HTML
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Format date
function formatDate(dateString) {
    const date = new Date(dateString);
    const options = { year: 'numeric', month: 'short', day: 'numeric' };
    return date.toLocaleDateString('en-US', options);
}

// Clear filters
function clearFilters() {
    currentFilter = 'all';
    document.querySelectorAll('.week-day').forEach(btn => {
        btn.classList.remove('active');
    });
    document.querySelector('.week-day:first-child').classList.add('active');
    renderGoals();
}

// Close all modals
function closeAllModals() {
    // Add modal closing logic if needed
}

// Auto-save draft
let autoSaveTimeout;
function autoSaveDraft() {
    clearTimeout(autoSaveTimeout);
    
    autoSaveTimeout = setTimeout(() => {
        const draft = {
            title: document.getElementById('goal-title').value,
            description: document.getElementById('goal-description').value,
            category: document.getElementById('goal-category').value,
            priority: document.getElementById('goal-priority').value,
            deadline: document.getElementById('goal-deadline').value,
            reminder: document.getElementById('goal-reminder').value
        };
        
        localStorage.setItem('goalDraft', JSON.stringify(draft));
    }, 1000);
}

// Load draft
function loadDraft() {
    const draft = localStorage.getItem('goalDraft');
    if (draft) {
        const data = JSON.parse(draft);
        if (confirm('Restore unsaved goal?')) {
            document.getElementById('goal-title').value = data.title || '';
            document.getElementById('goal-description').value = data.description || '';
            document.getElementById('goal-category').value = data.category || 'skill';
            document.getElementById('goal-priority').value = data.priority || 'medium';
            document.getElementById('goal-deadline').value = data.deadline || '';
            document.getElementById('goal-reminder').value = data.reminder || 'none';
        }
        localStorage.removeItem('goalDraft');
    }
}

// Check for drafts on load
window.addEventListener('load', loadDraft);

// Add auto-save listeners
document.getElementById('goal-title').addEventListener('input', autoSaveDraft);
document.getElementById('goal-description').addEventListener('input', autoSaveDraft);
