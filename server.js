const express = require('express');
const fs = require('fs');
const path = require('path');
const os = require('os');
const auth = require('./auth');

const app = express();
const PORT = process.env.PORT || 3000;

// ============================================
// 🔒 IN-MEMORY CACHE SYSTEM (Radical Fix)
// ============================================

// Memory cache لتجنب read conflicts
let CACHE = {
    products: [],
    reviews: {},
    lastSaved: {
        products: 0,
        reviews: 0
    }
};

// Write queue لتجنب concurrent writes
let writeQueue = {
    products: null,
    reviews: null
};

const BACKUP_DIR = path.join(process.cwd(), '.backup');

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

// Data file paths
const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), '.data');
const PRODUCTS_FILE = path.join(DATA_DIR, 'products.json');
const REVIEWS_FILE = path.join(DATA_DIR, 'reviews.json');

// Ensure directories exist
[DATA_DIR, BACKUP_DIR].forEach(dir => {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
});

console.log('✓ Data directories ready');

// ===== BACKUP SYSTEM =====
function createBackup(type) {
    try {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const sourceFile = type === 'products' ? PRODUCTS_FILE : REVIEWS_FILE;
        const backupFile = path.join(BACKUP_DIR, `${type}_backup_${timestamp}.json`);
        
        if (fs.existsSync(sourceFile)) {
            fs.copyFileSync(sourceFile, backupFile);
            
            // احتفظ بآخر 10 backups فقط
            const backups = fs.readdirSync(BACKUP_DIR)
                .filter(f => f.startsWith(`${type}_backup_`))
                .sort()
                .reverse();
            
            if (backups.length > 10) {
                backups.slice(10).forEach(f => {
                    fs.unlinkSync(path.join(BACKUP_DIR, f));
                });
            }
            
            return true;
        }
    } catch (e) {
        console.error(`Backup error for ${type}:`, e);
    }
    return false;
}

// ===== CACHE-BASED READ SYSTEM =====
function readProducts() {
    // أولاً حاول قراءة من cache إذا كانت حديثة
    const fileTime = fs.existsSync(PRODUCTS_FILE) 
        ? fs.statSync(PRODUCTS_FILE).mtime.getTime() 
        : 0;
    
    if (CACHE.lastSaved.products >= fileTime && CACHE.products.length > 0) {
        return CACHE.products;
    }
    
    // إذا كان الملف أحدث، اقرأ من الـ disk
    try {
        if (fs.existsSync(PRODUCTS_FILE)) {
            const data = JSON.parse(fs.readFileSync(PRODUCTS_FILE, 'utf8'));
            CACHE.products = data;
            CACHE.lastSaved.products = Date.now();
            return data;
        }
    } catch (e) {
        console.error('❌ Error reading products:', e);
    }
    
    return CACHE.products;
}

function readReviews() {
    // نفس النظام للـ reviews
    const fileTime = fs.existsSync(REVIEWS_FILE) 
        ? fs.statSync(REVIEWS_FILE).mtime.getTime() 
        : 0;
    
    if (CACHE.lastSaved.reviews >= fileTime && Object.keys(CACHE.reviews).length > 0) {
        return CACHE.reviews;
    }
    
    try {
        if (fs.existsSync(REVIEWS_FILE)) {
            const data = JSON.parse(fs.readFileSync(REVIEWS_FILE, 'utf8'));
            CACHE.reviews = data;
            CACHE.lastSaved.reviews = Date.now();
            return data;
        }
    } catch (e) {
        console.error('❌ Error reading reviews:', e);
    }
    
    return CACHE.reviews;
}

// ===== DEBOUNCED WRITE SYSTEM =====
function saveProducts(products) {
    try {
        // تحديث الـ cache فوراً
        CACHE.products = products;
        
        // إنشاء backup قبل الكتابة
        createBackup('products');
        
        // إلغاء أي write معلق
        if (writeQueue.products) clearTimeout(writeQueue.products);
        
        // جدول write جديد (debounced بـ 500ms)
        writeQueue.products = setTimeout(() => {
            try {
                fs.writeFileSync(PRODUCTS_FILE, JSON.stringify(products, null, 2), 'utf8');
                CACHE.lastSaved.products = Date.now();
                console.log('✓ Products saved to disk');
            } catch (e) {
                console.error('❌ Error writing products:', e);
            }
        }, 500);
        
        return true;
    } catch (e) {
        console.error('❌ Error in saveProducts:', e);
        return false;
    }
}

function saveReviews(reviews) {
    try {
        // تحديث الـ cache فوراً
        CACHE.reviews = reviews;
        
        // إنشاء backup قبل الكتابة
        createBackup('reviews');
        
        // إلغاء أي write معلق
        if (writeQueue.reviews) clearTimeout(writeQueue.reviews);
        
        // جدول write جديد (debounced بـ 500ms)
        writeQueue.reviews = setTimeout(() => {
            try {
                fs.writeFileSync(REVIEWS_FILE, JSON.stringify(reviews, null, 2), 'utf8');
                CACHE.lastSaved.reviews = Date.now();
                console.log('✓ Reviews saved to disk');
            } catch (e) {
                console.error('❌ Error writing reviews:', e);
            }
        }, 500);
        
        return true;
    } catch (e) {
        console.error('❌ Error in saveReviews:', e);
        return false;
    }
}

// ============================================
// 🔐 SESSION TIMEOUT (Phase 3 - Step 1)
// ============================================
// مدة صلاحية الجلسة: 8 ساعات (بالملي ثانية)
const SESSION_DURATION_MS = 8 * 60 * 60 * 1000;

// دالة موحّدة لفك التوكن مع التحقق من انتهاء الصلاحية.
// ملاحظة: هذه الدالة معرّفة الآن لكنها غير مستخدمة بعد - سيتم
// استبدال أماكن فك التوكن بها لاحقاً على دفعات صغيرة بعد الاختبار.
// ترجع: { valid: true, payload } أو { valid: false, reason }
function decodeToken(token) {
    try {
        if (!token) {
            return { valid: false, reason: 'no_token' };
        }
        const payload = JSON.parse(Buffer.from(token, 'base64').toString());

        // التوكنات القديمة (قبل هذه الميزة) ليس بها iat - نقبلها للتوافق
        if (payload.iat) {
            const age = Date.now() - payload.iat;
            if (age > SESSION_DURATION_MS) {
                return { valid: false, reason: 'expired' };
            }
        }

        return { valid: true, payload };
    } catch (e) {
        return { valid: false, reason: 'invalid' };
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
        console.log('🔐 Login attempt:', req.body);
        const { username, password } = req.body;
        
        if (!username || !password) {
            console.log('❌ Missing credentials');
            return res.status(400).json({ success: false, error: 'Username and password required' });
        }

        const user = auth.validateUser(username, password);
        console.log('🔍 User found:', user ? `${user.username} (${user.role})` : 'null');
        
        if (!user) {
            console.log('❌ Invalid credentials for user:', username);
            return res.status(401).json({ success: false, error: 'Invalid credentials' });
        }

        // Create token (simple JWT-like token with issue time for session timeout)
        const token = Buffer.from(JSON.stringify({ id: user.id, username: user.username, iat: Date.now() })).toString('base64');
        
        const response = { 
            success: true, 
            user: {
                id: user.id,
                username: user.username,
                role: user.role,
                permissions: user.permissions
            },
            token 
        };
        
        console.log('✅ Login successful:', user.username);
        res.json(response);
    } catch (error) {
        console.error('❌ Login error:', error);
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
                    imageUrl: String(p.imageUrl || '').trim(),
                    description: String(p.description || '').trim(),
                    notes: String(p.notes || '').trim(),
                    addedAt: new Date().toISOString()
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
            id: Date.now().toString(),
            link: req.body.link,
            name: req.body.name,
            price: req.body.price || '',
            asin: req.body.asin || '',
            brand: req.body.brand || '',
            category: req.body.category || '',
            imageUrl: req.body.imageUrl || '',
            description: req.body.description || '',
            notes: req.body.notes || '',
            addedBy: userId || null,
            addedAt: new Date().toISOString()
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
