const express = require('express');
const fs = require('fs');
const path = require('path');
const os = require('os');

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

// Data file paths
const DATA_DIR = path.join(__dirname, 'data');
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
        fs.writeFileSync(PRODUCTS_FILE, JSON.stringify(products, null, 2), 'utf8');
        return true;
    } catch (e) {
        console.error('Error saving products:', e);
        return false;
    }
}

function saveReviews(reviews) {
    try {
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

// Save review
app.post('/api/reviews/:productId', (req, res) => {
    try {
        const productId = req.params.productId;
        const reviews = readReviews();

        reviews[productId] = {
            status: req.body.status,
            purchasePrice: req.body.purchasePrice || null,
            quantity: req.body.quantity || 0,
            purchased: req.body.purchased || false,
            notes: req.body.notes || '',
            reviewedAt: new Date().toLocaleString('ar-EG')
        };

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

// Update review
app.put('/api/reviews/:productId', (req, res) => {
    try {
        const productId = req.params.productId;
        const reviews = readReviews();

        reviews[productId] = {
            ...reviews[productId],
            ...req.body,
            reviewedAt: new Date().toLocaleString('ar-EG')
        };

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
