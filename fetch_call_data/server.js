const express = require('express');
const { Pool } = require('pg');
const cluster = require('cluster');
const numCPUs = require('os').cpus().length;
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const compression = require('compression');

// If this is the master process, fork workers
if (cluster.isMaster) {
    console.log(`Master ${process.pid} is running`);
    
    // Fork workers equal to CPU cores
    for (let i = 0; i < numCPUs; i++) {
        cluster.fork();
    }
    
    cluster.on('exit', (worker, code, signal) => {
        console.log(`Worker ${worker.process.pid} died`);
        cluster.fork(); // Restart worker if it dies
    });
} else {
    // Worker process
    const app = express();
    const PORT = process.env.PORT || 3000;

    // Database connection pool configuration
    const pool = new Pool({
        user: 'admin',
        host: 'localhost',
        database: 'xlite',
        password: 'admin8686',
        port: 5432,
        // Connection pool settings for high concurrency
        max: 20, // Maximum number of connections in the pool
        min: 5,  // Minimum number of connections to keep
        idleTimeoutMillis: 30000, // Close idle connections after 30 seconds
        connectionTimeoutMillis: 10000, // Return error after 10 seconds if connection could not be established
        maxUses: 7500, // Close connection after 7500 uses (helps prevent memory leaks)
    });

    // Middleware for security and performance
    app.use(helmet()); // Security headers
    app.use(compression()); // Gzip compression
    app.use(express.json({ limit: '10mb' })); // Parse JSON bodies

    // Rate limiting to prevent abuse
    const limiter = rateLimit({
        windowMs: 1 * 60 * 1000, // 1 minute
        max: 1000, // Limit each IP to 1000 requests per windowMs
        message: 'Too many requests from this IP, please try again later.',
        standardHeaders: true,
        legacyHeaders: false,
    });
    app.use('/api/', limiter);

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
        
        // Validate optional fields
        const { response_category, recording_url, recording_length } = req.body;
        
        if (response_category && typeof response_category !== 'string') {
            return res.status(400).json({
                error: 'response_category must be a string'
            });
        }
        
        if (recording_url && typeof recording_url !== 'string') {
            return res.status(400).json({
                error: 'recording_url must be a string'
            });
        }
        
        if (recording_length && (isNaN(recording_length) || recording_length < 0)) {
            return res.status(400).json({
                error: 'recording_length must be a positive number'
            });
        }
        
        next();
    };

    // Health check endpoint
    app.get('/health', (req, res) => {
        res.status(200).json({ 
            status: 'OK', 
            timestamp: new Date().toISOString(),
            worker: process.pid 
        });
    });

    // GET all calls (with pagination)
    app.get('/api/calls', async (req, res) => {
        try {
            const page = parseInt(req.query.page) || 1;
            const limit = Math.min(parseInt(req.query.limit) || 50, 1000); // Max 1000 per page
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
                // First verify that the client exists
                const clientCheck = await client.query(
                    'SELECT client_id FROM clients WHERE client_id = $1',
                    [client_id]
                );
                
                if (clientCheck.rows.length === 0) {
                    return res.status(400).json({ error: 'Client ID does not exist' });
                }
                
                // Insert the new call
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
            
            // Handle specific database errors
            if (error.code === '23503') { // Foreign key violation
                res.status(400).json({ error: 'Invalid client_id' });
            } else {
                res.status(500).json({ error: 'Internal server error' });
            }
        }
    });

    // POST - Batch create calls (for high-volume inserts)
    app.post('/api/calls/batch', async (req, res) => {
        try {
            const { calls } = req.body;
            
            if (!Array.isArray(calls) || calls.length === 0) {
                return res.status(400).json({ error: 'calls must be a non-empty array' });
            }
            
            if (calls.length > 1000) {
                return res.status(400).json({ error: 'Maximum 1000 calls per batch' });
            }
            
            // Validate each call in the batch
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
    process.on('SIGTERM', async () => {
        console.log('SIGTERM received, shutting down gracefully');
        await pool.end();
        process.exit(0);
    });

    process.on('SIGINT', async () => {
        console.log('SIGINT received, shutting down gracefully');
        await pool.end();
        process.exit(0);
    });

    // Start server
    app.listen(PORT, () => {
        console.log(`Worker ${process.pid} started on port ${PORT}`);
    });
}
