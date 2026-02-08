import { getDb } from 'coze-coding-dev-sdk';
import { standardTerms } from '@/storage/database/shared/schema';
import { eq, and } from 'drizzle-orm';

async function getEmotionTerms() {
  try {
    const db = await getDb();
    const emotions = await db
      .select({ term: standardTerms.term })
      .from(standardTerms)
      .where(
        and(
          eq(standardTerms.category, 'emotion'),
          eq(standardTerms.reviewStatus, 'approved')
        )
      )
      .orderBy(standardTerms.term);

    console.log('数据库中已审核通过的情绪词库（可显示为主情绪）：');
    console.log('='.repeat(60));
    console.log(`共 ${emotions.length} 个情绪词`);
    console.log('='.repeat(60));

    emotions.forEach((item, index) => {
      process.stdout.write(`${item.term.padEnd(8)} `);
      if ((index + 1) % 10 === 0) console.log();
    });
    console.log('\n' + '='.repeat(60));

  } catch (error) {
    console.error('查询失败:', error.message);
  }

  process.exit(0);
}

getEmotionTerms();
