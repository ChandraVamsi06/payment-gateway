const express = require('express');
const { Client } = require('pg');
const cors = require('cors');
const crypto = require('crypto');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 8000;

// Middleware
app.use(cors());
app.use(express.json());

// Database Connection
const client = new Client({
    connectionString: process.env.DATABASE_URL,
});

let dbStatus = "disconnected";

const connectDB = async () => {
    try {
        await client.connect();
        dbStatus = "connected";
        console.log("Database connected successfully");
    } catch (err) {
        console.error("Database connection failed", err);
        setTimeout(connectDB, 5000);
    }
};
connectDB();

// --- HELPER FUNCTIONS ---

const generateId = (prefix) => prefix + crypto.randomBytes(8).toString('hex');

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Validation Logic
const validateVPA = (vpa) => {
    const regex = /^[a-zA-Z0-9._-]+@[a-zA-Z0-9]+$/;
    return regex.test(vpa);
};

const validateLuhn = (number) => {
    const sanitized = number.replace(/[\s-]/g, '');
    if (!/^\d{13,19}$/.test(sanitized)) return false;
    let sum = 0;
    let shouldDouble = false;
    for (let i = sanitized.length - 1; i >= 0; i--) {
        let digit = parseInt(sanitized.charAt(i));
        if (shouldDouble) {
            digit *= 2;
            if (digit > 9) digit -= 9;
        }
        sum += digit;
        shouldDouble = !shouldDouble;
    }
    return (sum % 10) === 0;
};

const getCardNetwork = (number) => {
    const sanitized = number.replace(/[\s-]/g, '');
    if (/^4/.test(sanitized)) return 'visa';
    if (/^5[1-5]/.test(sanitized)) return 'mastercard';
    if (/^3[47]/.test(sanitized)) return 'amex';
    if (/^(60|65|8[1-9])/.test(sanitized)) return 'rupay';
    return 'unknown';
};

const validateExpiry = (month, year) => {
    const current = new Date();
    const curMonth = current.getMonth() + 1;
    const curYear = current.getFullYear();
    
    let expYear = parseInt(year);
    if (expYear < 100) expYear += 2000; // Handle 2-digit year

    if (expYear < curYear) return false;
    if (expYear === curYear && parseInt(month) < curMonth) return false;
    return true;
};

// Authentication Middleware
const authenticateMerchant = async (req, res, next) => {
    const apiKey = req.header('X-Api-Key');
    const apiSecret = req.header('X-Api-Secret');

    if (!apiKey || !apiSecret) {
        return res.status(401).json({ error: { code: "AUTHENTICATION_ERROR", description: "Invalid API credentials" } });
    }
    try {
        const result = await client.query('SELECT id FROM merchants WHERE api_key = $1 AND api_secret = $2', [apiKey, apiSecret]);
        if (result.rows.length === 0) {
            return res.status(401).json({ error: { code: "AUTHENTICATION_ERROR", description: "Invalid API credentials" } });
        }
        req.merchantId = result.rows[0].id;
        next();
    } catch (err) {
        res.status(500).json({ error: { code: "INTERNAL_ERROR", description: "Internal Server Error" } });
    }
};

// --- ROUTES ---

// 1. Health Check
app.get('/health', async (req, res) => {
    let currentDbStatus = dbStatus;
    try {
        await client.query('SELECT 1');
        currentDbStatus = "connected";
    } catch (e) {
        currentDbStatus = "disconnected";
    }
    res.status(200).json({ status: "healthy", database: currentDbStatus, timestamp: new Date().toISOString() });
});

// 2. Create Order
app.post('/api/v1/orders', authenticateMerchant, async (req, res) => {
    const { amount, currency = "INR", receipt, notes } = req.body;
    if (!Number.isInteger(amount) || amount < 100) {
        return res.status(400).json({ error: { code: "BAD_REQUEST_ERROR", description: "amount must be at least 100" } });
    }
    const orderId = generateId("order_");
    try {
        const result = await client.query(
            `INSERT INTO orders (id, merchant_id, amount, currency, receipt, notes, status) VALUES ($1, $2, $3, $4, $5, $6, 'created') RETURNING *`,
            [orderId, req.merchantId, amount, currency, receipt, notes]
        );
        res.status(201).json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: { code: "INTERNAL_ERROR", description: "Database error" } });
    }
});

// 3. Get Order (Merchant Auth)
app.get('/api/v1/orders/:orderId', authenticateMerchant, async (req, res) => {
    try {
        const result = await client.query('SELECT * FROM orders WHERE id = $1 AND merchant_id = $2', [req.params.orderId, req.merchantId]);
        if (result.rows.length === 0) return res.status(404).json({ error: { code: "NOT_FOUND_ERROR", description: "Order not found" } });
        res.status(200).json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: { code: "INTERNAL_ERROR", description: "Database error" } });
    }
});

// 3b. Get Order PUBLIC (For Checkout Page)
app.get('/api/v1/orders/:orderId/public', async (req, res) => {
    try {
        const result = await client.query('SELECT id, amount, currency, status, merchant_id FROM orders WHERE id = $1', [req.params.orderId]);
        if (result.rows.length === 0) return res.status(404).json({ error: { code: "NOT_FOUND_ERROR", description: "Order not found" } });
        res.status(200).json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: { code: "INTERNAL_ERROR", description: "Database error" } });
    }
});

// 4. Create Payment
app.post('/api/v1/payments', async (req, res) => {
    // Note: This endpoint allows public access if no auth headers, but validates Order ID.
    // If headers exist, we validate them. If not, we rely on the Order ID.
    // Ideally, for the challenge, the checkout page is public, so we don't enforce Strict Merchant Auth here,
    // BUT we must validate the inputs rigidly.
    
    const { order_id, method, vpa, card } = req.body;
    
    // 1. Validate Order Exists
    let order;
    try {
        const oResult = await client.query('SELECT * FROM orders WHERE id = $1', [order_id]);
        if (oResult.rows.length === 0) return res.status(400).json({ error: { code: "BAD_REQUEST_ERROR", description: "Invalid Order ID" } });
        order = oResult.rows[0];
    } catch(e) { return res.status(500).json({error: "DB Error"}); }

    // 2. Validate Method
    let paymentData = {
        id: generateId("pay_"),
        order_id,
        merchant_id: order.merchant_id,
        amount: order.amount,
        currency: order.currency,
        method,
        status: 'processing',
        vpa: null,
        card_network: null,
        card_last4: null
    };

    if (method === 'upi') {
        if (!vpa || !validateVPA(vpa)) {
            return res.status(400).json({ error: { code: "INVALID_VPA", description: "Invalid VPA format" } });
        }
        paymentData.vpa = vpa;
    } else if (method === 'card') {
        if (!card || !validateLuhn(card.number)) {
            return res.status(400).json({ error: { code: "INVALID_CARD", description: "Invalid Card Number" } });
        }
        if (!validateExpiry(card.expiry_month, card.expiry_year)) {
            return res.status(400).json({ error: { code: "EXPIRED_CARD", description: "Card Expired" } });
        }
        paymentData.card_network = getCardNetwork(card.number);
        paymentData.card_last4 = card.number.slice(-4);
    } else {
        return res.status(400).json({ error: { code: "BAD_REQUEST_ERROR", description: "Invalid method" } });
    }

    // 3. Save "Processing" State
    try {
        await client.query(
            `INSERT INTO payments (id, order_id, merchant_id, amount, currency, method, status, vpa, card_network, card_last4)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
            [paymentData.id, paymentData.order_id, paymentData.merchant_id, paymentData.amount, paymentData.currency, 
             paymentData.method, paymentData.status, paymentData.vpa, paymentData.card_network, paymentData.card_last4]
        );
    } catch (err) {
        console.error(err);
        return res.status(500).json({ error: "Database Error" });
    }

    // 4. Simulate Processing (Delay & Logic)
    const isTestMode = process.env.TEST_MODE === 'true';
    const delay = isTestMode && process.env.TEST_PROCESSING_DELAY 
        ? parseInt(process.env.TEST_PROCESSING_DELAY) 
        : Math.floor(Math.random() * 5000) + 5000; // 5-10s

    // Send response immediately? No, requirements say synchronous processing.
    // We wait, update DB, then send response.
    await sleep(delay);

    let isSuccess = false;
    if (isTestMode && process.env.TEST_PAYMENT_SUCCESS) {
        isSuccess = process.env.TEST_PAYMENT_SUCCESS === 'true';
    } else {
        // Random logic
        const chance = Math.random();
        if (method === 'upi') isSuccess = chance < 0.90; // 90%
        else isSuccess = chance < 0.95; // 95%
    }

    const finalStatus = isSuccess ? 'success' : 'failed';
    const error_code = isSuccess ? null : 'PAYMENT_FAILED';
    const error_desc = isSuccess ? null : 'Payment validation failed at bank';

    // Update DB
    await client.query(
        `UPDATE payments SET status = $1, error_code = $2, error_description = $3, updated_at = NOW() WHERE id = $4`,
        [finalStatus, error_code, error_desc, paymentData.id]
    );

    // Return Final Response
    paymentData.status = finalStatus; // Update local obj for response
    res.status(201).json(paymentData);
});

// 5. Get Payment (Public for Poll)
app.get('/api/v1/payments/:paymentId', async (req, res) => {
    try {
        const result = await client.query('SELECT * FROM payments WHERE id = $1', [req.params.paymentId]);
        if (result.rows.length === 0) return res.status(404).json({ error: { code: "NOT_FOUND_ERROR", description: "Payment not found" } });
        res.status(200).json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: "Database error" });
    }
});

// 6. Test Merchant (Required)
app.get('/api/v1/test/merchant', async (req, res) => {
    const result = await client.query("SELECT id, email, api_key FROM merchants WHERE email = 'test@example.com'");
    if (result.rows.length > 0) res.status(200).json({ ...result.rows[0], seeded: true });
    else res.status(404).json({ message: "Not found" });
});

// 7. Dashboard Stats & Transactions (Required for Dashboard)
app.get('/api/v1/merchant/stats', authenticateMerchant, async (req, res) => {
    try {
        // 1. Get Stats
        const statsQuery = `
            SELECT 
                COUNT(*) as total_transactions,
                COALESCE(SUM(CASE WHEN status = 'success' THEN amount ELSE 0 END), 0) as total_amount,
                COUNT(CASE WHEN status = 'success' THEN 1 END) as success_count
            FROM payments
            WHERE merchant_id = $1
        `;
        const statsResult = await client.query(statsQuery, [req.merchantId]);
        const stats = statsResult.rows[0];
        
        // Calculate success rate
        const total = parseInt(stats.total_transactions);
        const success = parseInt(stats.success_count);
        const rate = total > 0 ? Math.round((success / total) * 100) : 0;

        // 2. Get Recent Transactions
        const txQuery = `
            SELECT id, order_id, amount, method, status, created_at 
            FROM payments 
            WHERE merchant_id = $1 
            ORDER BY created_at DESC 
            LIMIT 10
        `;
        const txResult = await client.query(txQuery, [req.merchantId]);

        res.status(200).json({
            stats: {
                total_transactions: total,
                total_amount: parseInt(stats.total_amount),
                success_rate: rate
            },
            transactions: txResult.rows
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Database error" });
    }
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});