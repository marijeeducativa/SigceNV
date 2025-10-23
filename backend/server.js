require('dotenv').config();
const express = require('express');
const { Client } = require('pg');
const cors = require('cors');

const app = express();
const port = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// CockroachDB configuration
const cockroachConfig = {
  connectionString: process.env.COCKROACHDB_URL || 'postgresql://marijeeducativa:uBQQSwn-pWNygC3SvlRx1Q@navy-python-17387.j77.aws-us-east-1.cockroachlabs.cloud:26257/defaultdb?sslmode=verify-full'
};

// API endpoint for database queries
app.post('/api/query', async (req, res) => {
  const client = new Client(cockroachConfig);

  try {
    const { sql, params = [] } = req.body;

    if (!sql) {
      return res.status(400).json({ error: 'SQL query is required' });
    }

    console.log('Executing query:', sql, params);

    // Connect for this specific query
    await client.connect();

    const result = await client.query(sql, params);

    // Special handling for COUNT queries to ensure proper number conversion
    if (sql.toUpperCase().includes('COUNT(*)')) {
      const count = parseInt(result.rows[0].count);
      console.log('Count result:', count, 'Type:', typeof count);
      res.json({ ...result, rows: [{ count: count }] });
    } else {
      res.json(result);
    }
  } catch (error) {
    console.error('Query error:', error);
    res.status(500).json({ error: error.message });
  } finally {
    // Always close the connection
    try {
      await client.end();
    } catch (err) {
      console.error('Error closing connection:', err);
    }
  }
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

app.listen(port, () => {
  console.log(`🚀 Backend server running on port ${port}`);
});