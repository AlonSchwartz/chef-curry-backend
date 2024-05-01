import { config } from 'dotenv'
import pkg from 'pg';

config()

const { Pool } = pkg;
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        require: true,
    },
});

pool.on('error', (err) => {
    console.error('Unexpected error on idle client', err);
});

pool.query('SELECT NOW()', (err, res) => {
    if (err) {
        console.error('Error executing query', err.stack);
    } else {
        console.log('Neon DB: Connected successfully');
    }
});

export { pool };	