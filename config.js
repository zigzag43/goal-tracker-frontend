// Firebase configuration - yo Firebase console bata copy garnus
const firebaseConfig = {
  apiKey: "AIzaSyDKPSB7GKdZulDN-IlziyxDM5eFYxw3x8s",
  authDomain: "goal-tracker-603fd.firebaseapp.com",
  projectId: "goal-tracker-603fd",
  storageBucket: "goal-tracker-603fd.firebasestorage.app",
  messagingSenderId: "738934868779",
  appId: "1:738934868779:web:a45c12092102f69d49536e"
};

// Backend API configuration
const API_CONFIG = {
    // Development ma localhost, production ma actual URL
    BASE_URL: window.location.hostname === 'localhost' 
        ? 'http://localhost:5000/api' 
        : 'https://goal-tracker-backend-9ksu.onrender.com',
    
    // API endpoints
    ENDPOINTS: {
        GOALS: '/goals',
        USER: '/user',
        STATS: '/stats'
    }
};

// App configuration
const APP_CONFIG = {
    // Goal categories
    CATEGORIES: {
        skill: { name: 'Skill Development', color: '#6C5CE7' },
        health: { name: 'Health & Fitness', color: '#00B894' },
        career: { name: 'Career', color: '#00CEFF' },
        personal: { name: 'Personal', color: '#FDCB6E' },
        finance: { name: 'Finance', color: '#55EFC4' },
        education: { name: 'Education', color: '#FF6B6B' }
    },
    
    // Priority levels
    PRIORITIES: {
        high: { name: 'High', color: '#D63031' },
        medium: { name: 'Medium', color: '#FDCB6E' },
        low: { name: 'Low', color: '#00B894' }
    },
    
    // Reminder options
    REMINDERS: {
        none: 'No Reminder',
        daily: 'Daily',
        weekly: 'Weekly',
        monthly: 'Monthly'
    },
    
    // Local storage keys
    STORAGE_KEYS: {
        USER_DATA: 'goalTracker_userData',
        GOALS_CACHE: 'goalTracker_goalsCache',
        PREFERENCES: 'goalTracker_preferences'
    }
};

// Timer configuration (original values maintain gareko)
const TIMER_CONFIG = {
    POMODORO: 25 * 60,      // 25 minutes
    DEEP_WORK: 50 * 60,     // 50 minutes
    EXTENDED: 90 * 60       // 90 minutes
};
