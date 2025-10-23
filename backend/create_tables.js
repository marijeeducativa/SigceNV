const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

const cockroachConfig = {
  connectionString: process.env.COCKROACHDB_URL || 'postgresql://marijeeducativa:uBQQSwn-pWNygC3SvlRx1Q@navy-python-17387.j77.aws-us-east-1.cockroachlabs.cloud:26257/defaultdb?sslmode=verify-full'
};

async function createTables() {
  const client = new Client(cockroachConfig);

  try {
    console.log('Connecting to CockroachDB...');
    await client.connect();
    console.log('✅ Connected to CockroachDB');

    // Read SQL file
    const sqlFile = path.join(__dirname, 'create_tables.sql');
    const sql = fs.readFileSync(sqlFile, 'utf8');

    console.log('Executing SQL script...');
    await client.query(sql);
    console.log('✅ Tables created successfully');

  } catch (error) {
    console.error('❌ Error creating tables:', error);
  } finally {
    await client.end();
    console.log('Database connection closed');
  }
}

createTables();