const express = require('express');
const mongoose = require('mongoose');
const os = require('os');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// MongoDB Connection
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/amazon-reviewer';

console.log('🔌 اتصال MongoDB...');
mongoose.connect(MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true
})
.then(() => console.log('✅ MongoDB متصل بنجاح!'))
.catch(err => {
    console.error('❌ خطأ MongoDB:', err.message);
    console.log('⚠️ استخدام الذاكرة المحلية بدلاً من MongoDB');
});

// Schema
const productSchema = new mongoose.Schema({
    _id: mongoose.Schema.Types.ObjectId,
    id: Number,
    link: String,
    name: String,
    price: String,
    asin: String,
    brand: String,
    category: String,
    notes: String,
    addedAt: String
}, { strict: false });

const reviewSchema = new mongoose.Schema({
    productId: Number,
    status: String,
    purchasePrice: mongoose.Schema.Types.Mixed,
    quantity: Number,
    purchased: Boolean,
    notes: String,
    reviewedAt: String
}, { strict: false });

const Product = mongoose.model('Product', productSchema);
const Review = mongoose.model('Review', reviewSchema);

// Middleware
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Serve static files
const publicPath = path.join(__dirname, 'public');
console.log('📁 Serving static files from:', publicPath);
app.use(express.static(publicPath));

// Root route - serve index.html
app.get('/', (req, res) => {
    res.sendFile(path.join(publicPath, 'index.html'));
});

// Helper functions
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

// API Routes

// Get all products
app.get('/api/products', async (req, res) => {
    try {
        const products = await Product.find({});
        const reviews = await Review.find({});
        
        const reviewsObj = {};
        reviews.forEach(r => {
            reviewsObj[r.productId] = {
                status: r.status,
                purchasePrice: r.purchasePrice,
                quantity: r.quantity,
                purchased: r.purchased,
                notes: r.notes,
                reviewedAt: r.reviewedAt
            };
        });

        res.json({ products, reviews: reviewsObj });
    } catch (error) {
        console.error('Error:', error);
        res.json({ products: [], reviews: {} });
    }
});

// Add product
app.post('/api/products', async (req, res) => {
    try {
        console.log('📤 طلب إضافة منتج:', req.body);
        
        if (!req.body.name || !req.body.link) {
            return res.status(400).json({ 
                success: false, 
                error: 'الاسم والرابط مطلوبان' 
            });
        }

        const product = new Product({
            _id: new mongoose.Types.ObjectId(),
            id: Date.now(),
            link: req.body.link,
            name: req.body.name,
            price: req.body.price || '',
            asin: req.body.asin || '',
            brand: req.body.brand || '',
            category: req.body.category || '',
            notes: req.body.notes || '',
            addedAt: new Date().toLocaleString('ar-EG')
        });

        const savedProduct = await product.save();
        console.log('✅ تم حفظ المنتج:', savedProduct._id);
        
        res.json({ success: true, product: savedProduct });
    } catch (error) {
        console.error('❌ خطأ في إضافة المنتج:', error);
        res.status(500).json({ 
            success: false, 
            error: error.message || 'خطأ في الخادم' 
        });
    }
});

// Save review
app.post('/api/reviews/:productId', async (req, res) => {
    try {
        const productId = parseInt(req.params.productId);
        
        await Review.findOneAndUpdate(
            { productId },
            {
                productId,
                status: req.body.status,
                purchasePrice: req.body.purchasePrice || null,
                quantity: req.body.quantity || 0,
                purchased: req.body.purchased || false,
                notes: req.body.notes || '',
                reviewedAt: new Date().toLocaleString('ar-EG')
            },
            { upsert: true, new: true }
        );

        res.json({ success: true });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ success: false });
    }
});

// Update review
app.put('/api/reviews/:productId', async (req, res) => {
    try {
        const productId = parseInt(req.params.productId);
        
        await Review.findOneAndUpdate(
            { productId },
            {
                ...req.body,
                reviewedAt: new Date().toLocaleString('ar-EG')
            },
            { upsert: true, new: true }
        );

        res.json({ success: true });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ success: false });
    }
});

// Delete review (reset)
app.delete('/api/reviews/:productId', async (req, res) => {
    try {
        const productId = parseInt(req.params.productId);
        await Review.deleteOne({ productId });
        res.json({ success: true });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ success: false });
    }
});

// Delete product
app.delete('/api/products/:productId', async (req, res) => {
    try {
        const productId = parseInt(req.params.productId);
        
        await Product.deleteOne({ id: productId });
        await Review.deleteOne({ productId });
        
        res.json({ success: true });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ success: false });
    }
});

// Clear all data
app.delete('/api/all', async (req, res) => {
    try {
        await Product.deleteMany({});
        await Review.deleteMany({});
        res.json({ success: true });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ success: false });
    }
});

// Health check
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', server: 'running' });
});

// 404 handler
app.use((req, res) => {
    console.warn('⚠️ طلب غير معروف:', req.method, req.path);
    res.status(404).json({ error: 'Not found' });
});

// Helper functions
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

// Start server
const localIP = getLocalIP();
app.listen(PORT, '0.0.0.0', () => {
    console.log(`
╔════════════════════════════════════════════════════════════╗
║    📦 مراجع منتجات أمازون - متشغل بنجاح!         ║
╚════════════════════════════════════════════════════════════╝

🌐 الرابط المحلي:     http://localhost:${PORT}
🌍 الرابط للمشتري:   http://${localIP}:${PORT}

✅ Server Status: Running
✅ MongoDB: ${mongoose.connection.readyState === 1 ? 'Connected ✓' : 'Connecting...'}
✅ Static Files: /public/index.html
✅ API Health: /api/health

🔍 اختبر الموقع الآن!

⚠️  اضغط Ctrl+C لإيقاف السيرفر
    `);
});
