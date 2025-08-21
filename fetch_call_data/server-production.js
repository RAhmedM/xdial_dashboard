require('dotenv').config();
const express = require('express');
const { Pool } = require('pg');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const compression = require('compression');
const cors = require('cors');

// Production configuration
const config = {
    port: process.env.PORT || 3000,
    database: {
        user: process.env.DB_USER || 'admin',
        host: process.env.DB_HOST || 'localhost',
        database: process.env.DB_NAME || 'xlite',
        password: process.env.DB_PASSWORD || 'admin8686',
        port: process.env.DB_PORT || 5432,
        ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
        max: 20,
        min: 5,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 10000,
        maxUses: 7500,
    },
    rateLimitMax: parseInt(process.env.API_RATE_LIMIT) || 1000,
    rateLimitWindow: parseInt(process.env.API_RATE_WINDOW) || 60000,
    maxBatchSize: parseInt(process.env.MAX_BATCH_SIZE) || 1000
};

// No manual clustering - let PM2 handle it
const app = express();

// Database connection pool
const pool = new Pool(config.database);

// Middleware
app.use(helmet({
    crossOriginEmbedderPolicy: false,
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            scriptSrc: ["'self'"],
            imgSrc: ["'self'", "data:", "https:"],
        },
    },
}));

app.use(compression());
app.use(cors({
    origin: [
        'https://dashboard.xdialnetworks.com',
        'https://fetchapi.dashboard.xdialnetworks.com'
    ],
    credentials: true
}));

app.use(express.json({ limit: '10mb' }));

// Rate limiting
const limiter = rateLimit({
    windowMs: config.rateLimitWindow,
    max: config.rateLimitMax,
    message: {
        error: 'Too many requests from this IP, please try again later.',
        retryAfter: Math.ceil(config.rateLimitWindow / 1000)
    },
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
        res.status(429).json({
            error: 'Too many requests from this IP, please try again later.',
            retryAfter: Math.ceil(config.rateLimitWindow / 1000)
        });
    }
});

app.use('/api/', limiter);

// Health check with more info
app.get('/health', async (req, res) => {
    try {
        // Test database connection
        const client = await pool.connect();
        await client.query('SELECT 1');
        client.release();
        
        res.status(200).json({ 
            status: 'OK',
            timestamp: new Date().toISOString(),
            worker: process.pid,
            environment: process.env.NODE_ENV,
            version: process.env.npm_package_version || '1.0.0',
            database: 'connected',
            instance: process.env.pm_id || 'unknown'
        });
    } catch (error) {
        res.status(503).json({
            status: 'ERROR',
            timestamp: new Date().toISOString(),
            worker: process.pid,
            error: 'Database connection failed'
        });
    }
});

// API Info endpoint
app.get('/api/info', (req, res) => {
    res.json({
        name: 'Calls API',
        version: '1.0.0',
        description: 'High-performance REST API for managing calls database',
        instance: process.env.pm_id || 'unknown',
        endpoints: {
            health: 'GET /health',
            calls: 'GET /api/calls',
            createCall: 'POST /api/calls',
            batchCalls: 'POST /api/calls/batch',
            getCall: 'GET /api/calls/:id',
            updateCall: 'PUT /api/calls/:id',
            deleteCall: 'DELETE /api/calls/:id'
        },
        limits: {
            rateLimit: `${config.rateLimitMax} requests per ${config.rateLimitWindow/1000} seconds`,
            maxBatchSize: config.maxBatchSize
        }
    });
});

// Input validation middleware
const validateCallData = (req, res, next) => {
    const { client_id, phone_number } = req.body;
    
    if (!client_id || !phone_number) {
        return res.status(400).json({
            error: 'Missing required fields: client_id and phone_number are required'
        });
    }
    
    if (!Number.isInteger(client_id) || client_id <= 0) {
        return res.status(400).json({
            error: 'client_id must be a positive integer'
        });
    }
    
    if (typeof phone_number !== 'string' || phone_number.length > 20) {
        return res.status(400).json({
            error: 'phone_number must be a string with maximum 20 characters'
        });
    }
    
    next();
};

// GET all calls (with pagination)
app.get('/api/calls', async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = Math.min(parseInt(req.query.limit) || 50, 1000);
        const offset = (page - 1) * limit;
        
        const client = await pool.connect();
        
        try {
            const countResult = await client.query('SELECT COUNT(*) FROM calls');
            const totalCalls = parseInt(countResult.rows[0].count);
            
            const result = await client.query(
                'SELECT * FROM calls ORDER BY timestamp DESC LIMIT $1 OFFSET $2',
                [limit, offset]
            );
            
            res.json({
                calls: result.rows,
                pagination: {
                    page,
                    limit,
                    total: totalCalls,
                    totalPages: Math.ceil(totalCalls / limit)
                }
            });
        } finally {
            client.release();
        }
    } catch (error) {
        console.error('Error fetching calls:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// GET call by ID
app.get('/api/calls/:id', async (req, res) => {
    try {
        const callId = parseInt(req.params.id);
        
        if (!Number.isInteger(callId) || callId <= 0) {
            return res.status(400).json({ error: 'Invalid call ID' });
        }
        
        const client = await pool.connect();
        
        try {
            const result = await client.query(
                'SELECT * FROM calls WHERE call_id = $1',
                [callId]
            );
            
            if (result.rows.length === 0) {
                return res.status(404).json({ error: 'Call not found' });
            }
            
            res.json(result.rows[0]);
        } finally {
            client.release();
        }
    } catch (error) {
        console.error('Error fetching call:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// POST - Create new call
app.post('/api/calls', validateCallData, async (req, res) => {
    try {
        const {
            client_id,
            phone_number,
            response_category,
            recording_url,
            recording_length
        } = req.body;
        
        const client = await pool.connect();
        
        try {
            const clientCheck = await client.query(
                'SELECT client_id FROM clients WHERE client_id = $1',
                [client_id]
            );
            
            if (clientCheck.rows.length === 0) {
                return res.status(400).json({ error: 'Client ID does not exist' });
            }
            
            const result = await client.query(
                `INSERT INTO calls (client_id, phone_number, response_category, recording_url, recording_length)
                 VALUES ($1, $2, $3, $4, $5)
                 RETURNING *`,
                [client_id, phone_number, response_category, recording_url, recording_length]
            );
            
            res.status(201).json({
                message: 'Call created successfully',
                call: result.rows[0]
            });
        } finally {
            client.release();
        }
    } catch (error) {
        console.error('Error creating call:', error);
        
        if (error.code === '23503') {
            res.status(400).json({ error: 'Invalid client_id' });
        } else {
            res.status(500).json({ error: 'Internal server error' });
        }
    }
});

// POST - Batch create calls
app.post('/api/calls/batch', async (req, res) => {
    try {
        const { calls } = req.body;
        
        if (!Array.isArray(calls) || calls.length === 0) {
            return res.status(400).json({ error: 'calls must be a non-empty array' });
        }
        
        if (calls.length > config.maxBatchSize) {
            return res.status(400).json({ 
                error: `Maximum ${config.maxBatchSize} calls per batch` 
            });
        }
        
        for (let i = 0; i < calls.length; i++) {
            const call = calls[i];
            if (!call.client_id || !call.phone_number) {
                return res.status(400).json({
                    error: `Call at index ${i}: Missing required fields client_id and phone_number`
                });
            }
        }
        
        const client = await pool.connect();
        
        try {
            await client.query('BEGIN');
            
            const insertedCalls = [];
            
            for (const call of calls) {
                const result = await client.query(
                    `INSERT INTO calls (client_id, phone_number, response_category, recording_url, recording_length)
                     VALUES ($1, $2, $3, $4, $5)
                     RETURNING *`,
                    [
                        call.client_id,
                        call.phone_number,
                        call.response_category,
                        call.recording_url,
                        call.recording_length
                    ]
                );
                insertedCalls.push(result.rows[0]);
            }
            
            await client.query('COMMIT');
            
            res.status(201).json({
                message: `${insertedCalls.length} calls created successfully`,
                calls: insertedCalls
            });
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    } catch (error) {
        console.error('Error in batch create:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// PUT - Update call by ID
app.put('/api/calls/:id', validateCallData, async (req, res) => {
    try {
        const callId = parseInt(req.params.id);
        
        if (!Number.isInteger(callId) || callId <= 0) {
            return res.status(400).json({ error: 'Invalid call ID' });
        }
        
        const {
            client_id,
            phone_number,
            response_category,
            recording_url,
            recording_length
        } = req.body;
        
        const client = await pool.connect();
        
        try {
            const result = await client.query(
                `UPDATE calls 
                 SET client_id = $1, phone_number = $2, response_category = $3, 
                     recording_url = $4, recording_length = $5
                 WHERE call_id = $6
                 RETURNING *`,
                [client_id, phone_number, response_category, recording_url, recording_length, callId]
            );
            
            if (result.rows.length === 0) {
                return res.status(404).json({ error: 'Call not found' });
            }
            
            res.json({
                message: 'Call updated successfully',
                call: result.rows[0]
            });
        } finally {
            client.release();
        }
    } catch (error) {
        console.error('Error updating call:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// DELETE call by ID
app.delete('/api/calls/:id', async (req, res) => {
    try {
        const callId = parseInt(req.params.id);
        
        if (!Number.isInteger(callId) || callId <= 0) {
            return res.status(400).json({ error: 'Invalid call ID' });
        }
        
        const client = await pool.connect();
        
        try {
            const result = await client.query(
                'DELETE FROM calls WHERE call_id = $1 RETURNING *',
                [callId]
            );
            
            if (result.rows.length === 0) {
                return res.status(404).json({ error: 'Call not found' });
            }
            
            res.json({
                message: 'Call deleted successfully',
                call: result.rows[0]
            });
        } finally {
            client.release();
        }
    } catch (error) {
        console.error('Error deleting call:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Error handling middleware
app.use((error, req, res, next) => {
    console.error('Unhandled error:', error);
    res.status(500).json({ error: 'Internal server error' });
});

// 404 handler
app.use('*', (req, res) => {
    res.status(404).json({ error: 'Endpoint not found' });
});

// Graceful shutdown
const gracefulShutdown = async () => {
    console.log('Shutting down gracefully...');
    await pool.end();
    process.exit(0);
};

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

// Start server
const server = app.listen(config.port, '127.0.0.1', () => {
    console.log(`Worker ${process.pid} started on port ${config.port} (PM2 instance: ${process.env.pm_id || 'unknown'})`);
});

// Increase server timeout for high load
server.timeout = 30000; // 30 seconds
