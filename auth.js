// Firebase initialize
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();

// Current user state
let currentUser = null;

// Auth state listener
auth.onAuthStateChanged((user) => {
    if (user) {
        // User logged in
        currentUser = user;
        showMainApp(user);
        console.log('User logged in:', user.email);
    } else {
        // User logged out
        currentUser = null;
        showAuthModal();
        console.log('User not logged in');
    }
});

// Show/Hide auth modal
function showAuthModal() {
    document.getElementById('auth-overlay').style.display = 'flex';
    document.getElementById('main-app').style.display = 'none';
}

function showMainApp(user) {
    document.getElementById('auth-overlay').style.display = 'none';
    document.getElementById('main-app').style.display = 'block';
    document.getElementById('user-email-display').textContent = user.email;
    
    // Load user data
    loadUserGoals();
    updateStats();
}

// Switch between login and signup forms
function showLogin() {
    document.getElementById('login-form').style.display = 'block';
    document.getElementById('signup-form').style.display = 'none';
}

function showSignup() {
    document.getElementById('login-form').style.display = 'none';
    document.getElementById('signup-form').style.display = 'block';
}

// Handle Login
async function handleLogin() {
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;
    
    // Validation
    if (!email || !password) {
        showNotification('Please fill all fields', 'error');
        return;
    }
    
    try {
        // Show loading
        showNotification('Logging in...', 'info');
        
        const userCredential = await auth.signInWithEmailAndPassword(email, password);
        console.log('Login successful:', userCredential.user);
        
        showNotification('Welcome back!', 'success');
        
        // Clear form
        document.getElementById('login-email').value = '';
        document.getElementById('login-password').value = '';
        
    } catch (error) {
        console.error('Login error:', error);
        
        // Handle specific errors
        let errorMessage = 'Login failed';
        switch (error.code) {
            case 'auth/user-not-found':
                errorMessage = 'No account found with this email';
                break;
            case 'auth/wrong-password':
                errorMessage = 'Incorrect password';
                break;
            case 'auth/invalid-email':
                errorMessage = 'Invalid email address';
                break;
            case 'auth/too-many-requests':
                errorMessage = 'Too many failed attempts. Try again later';
                break;
            default:
                errorMessage = error.message;
        }
        
        showNotification(errorMessage, 'error');
    }
}

// Handle Signup
async function handleSignup() {
    const email = document.getElementById('signup-email').value;
    const password = document.getElementById('signup-password').value;
    const confirmPassword = document.getElementById('confirm-password').value;
    
    // Validation
    if (!email || !password || !confirmPassword) {
        showNotification('Please fill all fields', 'error');
        return;
    }
    
    if (password !== confirmPassword) {
        showNotification('Passwords do not match', 'error');
        return;
    }
    
    if (password.length < 6) {
        showNotification('Password must be at least 6 characters', 'error');
        return;
    }
    
    try {
        showNotification('Creating account...', 'info');
        
        const userCredential = await auth.createUserWithEmailAndPassword(email, password);
        console.log('Signup successful:', userCredential.user);
        
        // Initialize user data in backend
        await initializeUserData(userCredential.user);
        
        showNotification('Account created successfully!', 'success');
        
        // Clear form
        document.getElementById('signup-email').value = '';
        document.getElementById('signup-password').value = '';
        document.getElementById('confirm-password').value = '';
        
    } catch (error) {
        console.error('Signup error:', error);
        
        let errorMessage = 'Signup failed';
        switch (error.code) {
            case 'auth/email-already-in-use':
                errorMessage = 'Email already registered';
                break;
            case 'auth/invalid-email':
                errorMessage = 'Invalid email address';
                break;
            case 'auth/weak-password':
                errorMessage = 'Password is too weak';
                break;
            default:
                errorMessage = error.message;
        }
        
        showNotification(errorMessage, 'error');
    }
}

// Handle Logout
async function handleLogout() {
    if (confirm('Are you sure you want to logout?')) {
        try {
            await auth.signOut();
            showNotification('Logged out successfully', 'success');
            
            // Clear local data
            localStorage.removeItem(APP_CONFIG.STORAGE_KEYS.GOALS_CACHE);
            localStorage.removeItem(APP_CONFIG.STORAGE_KEYS.USER_DATA);
            
        } catch (error) {
            console.error('Logout error:', error);
            showNotification('Logout failed', 'error');
        }
    }
}

// Initialize user data in backend
async function initializeUserData(user) {
    try {
        const token = await user.getIdToken();
        
        const response = await fetch(`${API_CONFIG.BASE_URL}/user/initialize`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                uid: user.uid,
                email: user.email,
                createdAt: new Date().toISOString()
            })
        });
        
        if (!response.ok) {
            throw new Error('Failed to initialize user data');
        }
        
        const data = await response.json();
        console.log('User data initialized:', data);
        
    } catch (error) {
        console.error('Error initializing user data:', error);
        // Non-critical error - user can still use the app
    }
}

// Get current user token
async function getUserToken() {
    if (!currentUser) {
        throw new Error('No user logged in');
    }
    
    try {
        const token = await currentUser.getIdToken();
        return token;
    } catch (error) {
        console.error('Error getting user token:', error);
        
        // Token refresh failed, try to re-authenticate
        if (error.code === 'auth/id-token-expired') {
            showNotification('Session expired. Please login again', 'warning');
            await auth.signOut();
        }
        
        throw error;
    }
}

// Check if user is authenticated
function isAuthenticated() {
    return currentUser !== null;
}

// Get current user ID
function getCurrentUserId() {
    return currentUser ? currentUser.uid : null;
}

// Get current user email
function getCurrentUserEmail() {
    return currentUser ? currentUser.email : null;
}

// Password reset
async function sendPasswordReset(email) {
    try {
        await auth.sendPasswordResetEmail(email);
        showNotification('Password reset email sent!', 'success');
    } catch (error) {
        console.error('Password reset error:', error);
        showNotification('Failed to send reset email', 'error');
    }
}

// Update user profile (optional)
async function updateUserProfile(displayName, photoURL) {
    if (!currentUser) return;
    
    try {
        await currentUser.updateProfile({
            displayName: displayName,
            photoURL: photoURL
        });
        
        showNotification('Profile updated', 'success');
    } catch (error) {
        console.error('Profile update error:', error);
        showNotification('Failed to update profile', 'error');
    }
}
