import { getRawClient } from '../src/storage/database/rawClient';

async function checkDatabaseStats() {
  const client = await getRawClient();

  console.log('=== 检查数据库概览统计数据 ===\n');

  // 1. 查询所有记录的基本信息
  console.log('1. 所有记录总数:');
  const allRecords = await client.query('SELECT COUNT(*) as count FROM music_analyses');
  console.log(`   总记录数: ${allRecords.rows[0].count}\n`);

  // 2. 查询已分析的数据（至少一个字段不为空）
  console.log('2. 已分析的数据:');
  const analyzedRecords = await client.query(`
    SELECT COUNT(*) as count
    FROM music_analyses
    WHERE
      (summary IS NOT NULL AND summary != '')
      OR (styles IS NOT NULL AND styles != '')
      OR (instruments IS NOT NULL AND instruments != '')
      OR (film_scenes IS NOT NULL AND film_scenes != '')
      OR (scenarios IS NOT NULL AND scenarios != '')
  `);
  console.log(`   已分析记录数: ${analyzedRecords.rows[0].count}\n`);

  // 3. 去重统计（与getDeduplicatedStats相同的逻辑）
  console.log('3. 去重统计（按MD5或文件名+大小）:');
  const dedupSQL = `
    WITH deduplicated_records AS (
      SELECT DISTINCT ON (
        COALESCE(music_md5, file_name || '|' || file_size)
      )
        id,
        is_online,
        is_uploaded,
        file_name,
        music_md5,
        summary,
        styles
      FROM music_analyses
      WHERE
        (summary IS NOT NULL AND summary != '')
        OR (styles IS NOT NULL AND styles != '')
        OR (instruments IS NOT NULL AND instruments != '')
        OR (film_scenes IS NOT NULL AND film_scenes != '')
        OR (scenarios IS NOT NULL AND scenarios != '')
    )
    SELECT
      COUNT(*) as total,
      COUNT(CASE WHEN is_uploaded = false AND is_online = true THEN 1 END) as online,
      COUNT(CASE WHEN is_uploaded = false AND is_online = false THEN 1 END) as offline,
      COUNT(CASE WHEN is_uploaded = true THEN 1 END) as uploaded
    FROM deduplicated_records
  `;
  const dedupResult = await client.query(dedupSQL);
  const dedupStats = dedupResult.rows[0];
  console.log(`   总数量: ${dedupStats.total}`);
  console.log(`   在线状态: ${dedupStats.online} (is_uploaded=false AND is_online=true)`);
  console.log(`   离线状态: ${dedupStats.offline} (is_uploaded=false AND is_online=false)`);
  console.log(`   云端状态: ${dedupStats.uploaded} (is_uploaded=true)\n`);

  // 4. 查看去重后的具体记录（最多20条）
  console.log('4. 去重后的具体记录（前20条）:');
  const sampleRecords = await client.query(`
    WITH deduplicated_records AS (
      SELECT DISTINCT ON (
        COALESCE(music_md5, file_name || '|' || file_size)
      )
        id,
        file_name,
        is_online,
        is_uploaded,
        music_md5,
        summary,
        styles
      FROM music_analyses
      WHERE
        (summary IS NOT NULL AND summary != '')
        OR (styles IS NOT NULL AND styles != '')
        OR (instruments IS NOT NULL AND instruments != '')
        OR (film_scenes IS NOT NULL AND film_scenes != '')
        OR (scenarios IS NOT NULL AND scenarios != '')
      ORDER BY COALESCE(music_md5, file_name || '|' || file_size)
    )
    SELECT
      id,
      file_name,
      is_online,
      is_uploaded,
      music_md5,
      summary,
      styles
    FROM deduplicated_records
    LIMIT 20
  `);

  console.log('   ID | 文件名 | is_online | is_uploaded | music_md5 | summary');
  console.log('   ' + '-'.repeat(100));
  for (const row of sampleRecords.rows) {
    const is_online = row.is_online ? 'true' : 'false';
    const is_uploaded = row.is_uploaded ? 'true' : 'false';
    const music_md5 = row.music_md5 || '(null)';
    const summary = row.summary || '(null)';
    console.log(`   ${row.id.substring(0,8)} | ${row.file_name.substring(0,30)} | ${is_online} | ${is_uploaded} | ${music_md5.substring(0,10)} | ${summary.substring(0,20)}`);
  }

  // 5. 验证状态分布
  console.log('\n5. 状态分布验证:');
  const statusCheck = await client.query(`
    WITH deduplicated_records AS (
      SELECT DISTINCT ON (
        COALESCE(music_md5, file_name || '|' || file_size)
      )
        is_online,
        is_uploaded
      FROM music_analyses
      WHERE
        (summary IS NOT NULL AND summary != '')
        OR (styles IS NOT NULL AND styles != '')
        OR (instruments IS NOT NULL AND instruments != '')
        OR (film_scenes IS NOT NULL AND film_scenes != '')
        OR (scenarios IS NOT NULL AND scenarios != '')
    )
    SELECT
      CASE
        WHEN is_uploaded = true THEN '云端'
        WHEN is_online = true THEN '在线'
        ELSE '离线'
      END as status,
      COUNT(*) as count
    FROM deduplicated_records
    GROUP BY status
    ORDER BY count DESC
  `);

  console.log('   状态 | 数量');
  console.log('   ' + '-'.repeat(20));
  for (const row of statusCheck.rows) {
    console.log(`   ${row.status} | ${row.count}`);
  }

  console.log('\n=== 检查完成 ===');

  await client.end();
}

checkDatabaseStats().catch(console.error);
