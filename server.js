const express = require('express');
const fs = require('fs');
const path = require('path');
const os = require('os');
const auth = require('./auth');

const app = express();
const PORT = process.env.PORT || 3000;

// Helper function FIRST
function getLocalIP() {
    const interfaces = os.networkInterfaces();
    for (const name of Object.keys(interfaces)) {
        for (const iface of interfaces[name]) {
            if (iface.family === 'IPv4' && !iface.internal) {
                return iface.address;
            }
        }
    }
    return 'localhost';
}

// Data file paths - استخدام /tmp للتخزين المؤقت أو /home/user للدائم
const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), '.data');
const PRODUCTS_FILE = path.join(DATA_DIR, 'products.json');
const REVIEWS_FILE = path.join(DATA_DIR, 'reviews.json');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    console.log('✓ Data directory created');
}

// Load/save data from JSON files (SUPER FAST!)
function readProducts() {
    try {
        if (fs.existsSync(PRODUCTS_FILE)) {
            return JSON.parse(fs.readFileSync(PRODUCTS_FILE, 'utf8'));
        }
    } catch (e) {
        console.error('Error reading products:', e);
    }
    return [];
}

function readReviews() {
    try {
        if (fs.existsSync(REVIEWS_FILE)) {
            return JSON.parse(fs.readFileSync(REVIEWS_FILE, 'utf8'));
        }
    } catch (e) {
        console.error('Error reading reviews:', e);
    }
    return {};
}

function saveProducts(products) {
    try {
        // Ensure data directory exists
        if (!fs.existsSync(DATA_DIR)) {
            fs.mkdirSync(DATA_DIR, { recursive: true });
        }
        fs.writeFileSync(PRODUCTS_FILE, JSON.stringify(products, null, 2), 'utf8');
        return true;
    } catch (e) {
        console.error('Error saving products:', e);
        return false;
    }
}

function saveReviews(reviews) {
    try {
        // Ensure data directory exists
        if (!fs.existsSync(DATA_DIR)) {
            fs.mkdirSync(DATA_DIR, { recursive: true });
        }
        fs.writeFileSync(REVIEWS_FILE, JSON.stringify(reviews, null, 2), 'utf8');
        return true;
    } catch (e) {
        console.error('Error saving reviews:', e);
        return false;
    }
}

// Middleware
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Serve static files
const publicPath = path.join(__dirname, 'public');
console.log('📁 Serving static files from:', publicPath);
app.use(express.static(publicPath));

// Root route
app.get('/', (req, res) => {
    res.sendFile(path.join(publicPath, 'index.html'));
});

// ============= API ROUTES =============

// Health check
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', server: 'running', storage: 'JSON files (FAST!)' });
});

// ============= AUTH ROUTES =============

// Login
app.post('/api/auth/login', (req, res) => {
    try {
        const { username, password } = req.body;
        
        if (!username || !password) {
            return res.status(400).json({ success: false, error: 'Username and password required' });
        }

        const user = auth.validateUser(username, password);
        if (!user) {
            return res.status(401).json({ success: false, error: 'Invalid credentials' });
        }

        // Create token (simple JWT-like token)
        const token = Buffer.from(JSON.stringify({ id: user.id, username: user.username })).toString('base64');
        
        res.json({ 
            success: true, 
            user: {
                id: user.id,
                username: user.username,
                role: user.role,
                permissions: user.permissions
            },
            token 
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Verify token
app.post('/api/auth/verify', (req, res) => {
    try {
        const token = req.headers.authorization?.split(' ')[1];
        
        if (!token) {
            return res.status(401).json({ success: false, error: 'No token' });
        }

        const decoded = JSON.parse(Buffer.from(token, 'base64').toString());
        const user = auth.getUserById(decoded.id);
        
        if (!user) {
            return res.status(401).json({ success: false, error: 'User not found' });
        }

        res.json({ 
            success: true, 
            user: {
                id: user.id,
                username: user.username,
                role: user.role,
                permissions: user.permissions
            }
        });
    } catch (error) {
        res.status(401).json({ success: false, error: 'Invalid token' });
    }
});

// Get current user
app.get('/api/auth/me', (req, res) => {
    try {
        const token = req.headers.authorization?.split(' ')[1];
        if (!token) return res.status(401).json({ success: false });

        const decoded = JSON.parse(Buffer.from(token, 'base64').toString());
        const user = auth.getUserById(decoded.id);
        
        if (!user) return res.status(401).json({ success: false });

        res.json({ success: true, user: {
            id: user.id,
            username: user.username,
            role: user.role,
            permissions: user.permissions
        }});
    } catch {
        res.status(401).json({ success: false });
    }
});

// ============= USER MANAGEMENT (Admin only) =============

// Get all users
app.get('/api/admin/users', (req, res) => {
    try {
        const token = req.headers.authorization?.split(' ')[1];
        const decoded = JSON.parse(Buffer.from(token, 'base64').toString());
        const user = auth.getUserById(decoded.id);

        if (!user || user.role !== 'admin') {
            return res.status(403).json({ success: false, error: 'Unauthorized' });
        }

        res.json({ success: true, users: auth.getAllUsers(), roles: auth.ROLES });
    } catch {
        res.status(500).json({ success: false });
    }
});

// Add user
app.post('/api/admin/users', (req, res) => {
    try {
        const token = req.headers.authorization?.split(' ')[1];
        const decoded = JSON.parse(Buffer.from(token, 'base64').toString());
        const currentUser = auth.getUserById(decoded.id);

        if (!currentUser || currentUser.role !== 'admin') {
            return res.status(403).json({ success: false, error: 'Unauthorized' });
        }

        const { username, password, role } = req.body;
        const newUser = auth.addUser(username, password, role);

        if (!newUser) {
            return res.status(400).json({ success: false, error: 'User already exists' });
        }

        res.json({ success: true, user: newUser });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Update user
app.put('/api/admin/users/:userId', (req, res) => {
    try {
        const token = req.headers.authorization?.split(' ')[1];
        const decoded = JSON.parse(Buffer.from(token, 'base64').toString());
        const currentUser = auth.getUserById(decoded.id);

        if (!currentUser || currentUser.role !== 'admin') {
            return res.status(403).json({ success: false, error: 'Unauthorized' });
        }

        const { userId } = req.params;
        const { password, role } = req.body;
        
        const updates = {};
        if (password) updates.password = password;
        if (role) updates.role = role;

        const updatedUser = auth.updateUser(parseInt(userId), updates);

        if (!updatedUser) {
            return res.status(404).json({ success: false, error: 'User not found' });
        }

        res.json({ success: true, user: updatedUser });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Delete user
app.delete('/api/admin/users/:userId', (req, res) => {
    try {
        const token = req.headers.authorization?.split(' ')[1];
        const decoded = JSON.parse(Buffer.from(token, 'base64').toString());
        const currentUser = auth.getUserById(decoded.id);

        if (!currentUser || currentUser.role !== 'admin') {
            return res.status(403).json({ success: false, error: 'Unauthorized' });
        }

        const { userId } = req.params;
        const success = auth.deleteUser(parseInt(userId));

        if (!success) {
            return res.status(404).json({ success: false, error: 'User not found' });
        }

        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get all products
app.get('/api/products', (req, res) => {
    try {
        const products = readProducts();
        const reviews = readReviews();
        res.json({ products, reviews });
    } catch (error) {
        console.error('Error:', error);
        res.json({ products: [], reviews: {} });
    }
});

// Bulk upload products (FASTEST METHOD)
app.post('/api/products/bulk', (req, res) => {
    try {
        console.log('📤 Bulk upload:', req.body.products?.length, 'products');
        const products = req.body.products || [];

        if (!Array.isArray(products) || products.length === 0) {
            return res.status(400).json({ success: false, error: 'products array required' });
        }

        const allProducts = readProducts();
        let success = 0, failed = 0;

        products.forEach((p, i) => {
            if (p.name && p.link) {
                allProducts.push({
                    id: Date.now() + i,
                    link: String(p.link).trim(),
                    name: String(p.name).trim(),
                    price: String(p.price || '').trim(),
                    asin: String(p.asin || '').trim(),
                    brand: String(p.brand || '').trim(),
                    category: String(p.category || '').trim(),
                    notes: String(p.notes || '').trim(),
                    addedAt: new Date().toLocaleString('ar-EG')
                });
                success++;
            } else {
                failed++;
            }
        });

        if (saveProducts(allProducts)) {
            console.log(`✓ Bulk complete: ${success} success, ${failed} failed`);
            res.json({ success: true, success, failed, message: `تم إضافة ${success} منتج!` });
        } else {
            res.status(500).json({ success: false, error: 'Failed to save' });
        }
    } catch (error) {
        console.error('❌ Bulk error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Add single product
app.post('/api/products', (req, res) => {
    try {
        const token = req.headers.authorization?.split(' ')[1];
        let userId = null;
        
        if (token) {
            try {
                const decoded = JSON.parse(Buffer.from(token, 'base64').toString());
                userId = decoded.id;
            } catch {}
        }

        if (!req.body.name || !req.body.link) {
            return res.status(400).json({ success: false, error: 'الاسم والرابط مطلوبان' });
        }

        const products = readProducts();
        const product = {
            id: Date.now(),
            link: req.body.link,
            name: req.body.name,
            price: req.body.price || '',
            asin: req.body.asin || '',
            brand: req.body.brand || '',
            category: req.body.category || '',
            notes: req.body.notes || '',
            addedBy: userId || null,
            addedAt: new Date().toLocaleString('ar-EG')
        };

        products.push(product);
        
        if (saveProducts(products)) {
            res.json({ success: true, product });
        } else {
            res.status(500).json({ success: false, error: 'Failed to save' });
        }
    } catch (error) {
        console.error('❌ Error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});


























// Save/Update review
app.post('/api/reviews/:productId', (req, res) => {
    try {
        const productId = req.params.productId;
        const { status, supplier, purchasePrice, quantity, purchased, notes } = req.body;
        
        const reviews = readReviews();
        
        reviews[productId] = {
            id: productId,
            status: status || '',
            supplier: supplier || '',
            purchasePrice: purchasePrice ? parseFloat(purchasePrice) : null,
            quantity: quantity ? parseInt(quantity) : 0,
            purchased: purchased || false,
            notes: notes || '',
            reviewedAt: new Date().toISOString(),
            reviewedBy: req.user?.id || 'unknown'
        };
        
        if (saveReviews(reviews)) {
            res.json({ success: true, review: reviews[productId] });
        } else {
            res.status(500).json({ success: false, error: 'Failed to save review' });
        }
    } catch (error) {
        console.error('❌ Error saving review:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Delete review
app.delete('/api/reviews/:productId', (req, res) => {
    try {
        const productId = req.params.productId;
        const reviews = readReviews();
        
        delete reviews[productId];
        
        if (saveReviews(reviews)) {
            res.json({ success: true });
        } else {
            res.status(500).json({ success: false });
        }
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ success: false });
    }
});

// Delete product
app.delete('/api/products/:productId', (req, res) => {
    try {
        const productId = parseInt(req.params.productId);
        const products = readProducts();
        const reviews = readReviews();
        
        const filtered = products.filter(p => p.id !== productId);
        delete reviews[productId];
        
        if (saveProducts(filtered) && saveReviews(reviews)) {
            res.json({ success: true });
        } else {
            res.status(500).json({ success: false });
        }
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ success: false });
    }
});

// Clear all data
app.delete('/api/all', (req, res) => {
    try {
        if (saveProducts([]) && saveReviews({})) {
            res.json({ success: true });
        } else {
            res.status(500).json({ success: false });
        }
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ success: false });
    }
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({ error: 'Not found' });
});

// Start server
const localIP = getLocalIP();
app.listen(PORT, '0.0.0.0', () => {
    console.log(`
╔════════════════════════════════════════════════════════════╗
║    📦 مراجع منتجات أمازون - متشغل بنجاح!         ║
╚════════════════════════════════════════════════════════════╝

🌐 الرابط المحلي:     http://localhost:${PORT}
🌍 الرابط للمشتري:   http://${localIP}:${PORT}

✅ Storage: JSON Files (SUPER FAST! ⚡)
✅ No MongoDB - No Delays!
✅ Data saved in /data/ folder

🚀 البرنامج سريع جداً الآن!

⚠️  اضغط Ctrl+C لإيقاف السيرفر
    `);
});
