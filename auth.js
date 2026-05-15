// User Management and Authentication

// Default users with permissions
const DEFAULT_USERS = [
    {
        id: 1,
        username: 'khaled',
        password: '1997',
        role: 'admin',
        permissions: ['add_products', 'review_products', 'view_reports', 'manage_users'],
        createdAt: new Date().toLocaleString('ar-EG')
    },
    {
        id: 2,
        username: 'ye7ia',
        password: '123',
        role: 'editor',
        permissions: ['add_products', 'review_products', 'view_reports'],
        createdAt: new Date().toLocaleString('ar-EG')
    },
    {
        id: 3,
        username: 'arby',
        password: '123',
        role: 'reviewer',
        permissions: ['review_products', 'view_reports'],
        createdAt: new Date().toLocaleString('ar-EG')
    }
];

// Role definitions
const ROLES = {
    admin: {
        label: 'مسؤول النظام',
        permissions: ['add_products', 'review_products', 'view_reports', 'manage_users']
    },
    editor: {
        label: 'محرر',
        permissions: ['add_products', 'review_products', 'view_reports']
    },
    reviewer: {
        label: 'مراجع',
        permissions: ['review_products', 'view_reports']
    }
};

// In-memory storage for users (in production, use database)
let users = DEFAULT_USERS;

// Validate credentials
function validateUser(username, password) {
    const user = users.find(u => u.username === username && u.password === password);
    return user ? { ...user } : null;
}

// Get user by ID
function getUserById(userId) {
    return users.find(u => u.id === userId);
}

// Check permission
function hasPermission(userId, permission) {
    const user = getUserById(userId);
    if (!user) return false;
    return user.permissions.includes(permission);
}

// Add new user
function addUser(username, password, role) {
    // Check if user exists
    if (users.find(u => u.username === username)) {
        return null;
    }

    const newUser = {
        id: Math.max(...users.map(u => u.id), 0) + 1,
        username,
        password,
        role,
        permissions: ROLES[role]?.permissions || [],
        createdAt: new Date().toLocaleString('ar-EG')
    };

    users.push(newUser);
    return newUser;
}

// Update user
function updateUser(userId, updates) {
    const userIndex = users.findIndex(u => u.id === userId);
    if (userIndex === -1) return null;

    if (updates.role && ROLES[updates.role]) {
        updates.permissions = ROLES[updates.role].permissions;
    }

    users[userIndex] = { ...users[userIndex], ...updates };
    return users[userIndex];
}

// Delete user
function deleteUser(userId) {
    const index = users.findIndex(u => u.id === userId);
    if (index === -1) return false;
    
    users.splice(index, 1);
    return true;
}

// Get all users
function getAllUsers() {
    return users.map(u => ({
        id: u.id,
        username: u.username,
        role: u.role,
        permissions: u.permissions,
        createdAt: u.createdAt
    }));
}

module.exports = {
    validateUser,
    getUserById,
    hasPermission,
    addUser,
    updateUser,
    deleteUser,
    getAllUsers,
    ROLES
};
