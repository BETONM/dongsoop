const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL, 
    
    // ssl 설정
    ssl: {
        rejectUnauthorized: false
    }
});

// 예기치 않은 에러 발생 시 처리하는 부분
pool.on('error', (err, client) => {
    console.error('Unexpected error on idle client', err);
    process.exit(-1);
});

module.exports = pool;