// 测试 PostgreSQL JSONB 查询
const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'music_emotion_db',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
});

async function testQuery() {
  try {
    const result = await pool.query(`
      SELECT file_name, scenarios
      FROM music_analyses
      WHERE scenarios::jsonb ? '对峙'
      LIMIT 5
    `);

    console.log(`Found ${result.rows.length} records`);
    result.rows.forEach(row => {
      console.log(`  - ${row.file_name}: ${row.scenarios}`);
    });

    // 测试另一个查询
    const result2 = await pool.query(`
      SELECT file_name, scenarios
      FROM music_analyses
      WHERE scenarios::jsonb ? '婚外情'
      LIMIT 5
    `);

    console.log(`\nFound ${result2.rows.length} records for '婚外情'`);
    result2.rows.forEach(row => {
      console.log(`  - ${row.file_name}: ${row.scenarios}`);
    });

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await pool.end();
  }
}

testQuery();
