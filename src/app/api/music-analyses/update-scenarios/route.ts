import { NextRequest, NextResponse } from 'next/server';
import { getDb } from 'coze-coding-dev-sdk';
import { musicAnalyses } from '@/storage/database/shared/schema';
import { eq, and } from 'drizzle-orm';
import {
  validateMultiple,
  validateRequired,
  validateType,
  createErrorResponse,
  createSuccessResponse,
  createSimpleErrorResponse,
  generateRequestId,
} from '@/lib/apiValidator';

/**
 * 更新数据库场景词API
 * POST /api/music-analyses/update-scenarios
 *
 * 功能：
 * 更新指定音乐文件的场景词（基于最新的标准词库）
 *
 * 请求体：
 * {
 *   fileName: string;     // 文件名
 *   scenarios: string[];  // 新的场景词列表
 * }
 *
 * 响应：
 * {
 *   success: true,
 *   data: {
 *     updated: boolean,  // 是否进行了更新
 *     oldScenarios: string[],  // 旧场景词
 *     newScenarios: string[],  // 新场景词
 *     changes: string[],  // 变化的词
 *   }
 * }
 */
export async function POST(request: NextRequest) {
  const requestId = generateRequestId();
  try {
    const db = await getDb();
    const body = await request.json();
    const { fileName, scenarios } = body;

    // 参数验证
    const validationResult = validateMultiple(
      validateRequired(body, 'fileName', '文件名'),
      validateType(body, 'fileName', 'string', '文件名'),
      validateRequired(body, 'scenarios', '场景词列表'),
      validateType(body, 'scenarios', 'array', '场景词列表'),
    );

    if (!validationResult.isValid) {
      return createErrorResponse(validationResult.errors, 400, requestId);
    }

    console.log(`[更新场景词] 开始更新文件"${fileName}"的场景词`);

    // 查询现有记录
    const existingRecords = await db
      .select()
      .from(musicAnalyses)
      .where(eq(musicAnalyses.fileName, fileName))
      .limit(1);

    if (existingRecords.length === 0) {
      return createSimpleErrorResponse(
        `未找到文件"${fileName}"的分析记录`,
        404,
        'RECORD_NOT_FOUND',
        requestId
      );
    }

    const existingRecord = existingRecords[0];
    const oldScenarios = existingRecord.scenarios || [];

    // 比较新旧场景词
    const oldSorted = [...oldScenarios].sort();
    const newSorted = [...scenarios].sort();

    const hasChanges = oldSorted.length !== newSorted.length ||
                       oldSorted.some((s, i) => s !== newSorted[i]);

    if (!hasChanges) {
      console.log(`[更新场景词] 场景词未发生变化，跳过更新`);
      return createSuccessResponse({
        updated: false,
        oldScenarios,
        newScenarios: scenarios,
        changes: [],
      });
    }

    // 计算变化的词
    const addedScenarios = newSorted.filter(s => !oldSorted.includes(s));
    const removedScenarios = oldSorted.filter(s => !newSorted.includes(s));
    const changes = [
      ...addedScenarios.map(s => `+${s}`),
      ...removedScenarios.map(s => `-${s}`),
    ];

    console.log(`[更新场景词] 场景词发生变化：${changes.join(', ')}`);

    // 更新数据库
    await db
      .update(musicAnalyses)
      .set({
        scenarios,
        updatedAt: new Date(),
      })
      .where(eq(musicAnalyses.fileName, fileName));

    console.log(`[更新场景词] 更新完成`);

    return createSuccessResponse({
      updated: true,
      oldScenarios,
      newScenarios: scenarios,
      changes,
    }, `场景词已更新：${changes.join(', ')}`);
  } catch (error: any) {
    console.error(`[更新场景词失败] RequestID: ${requestId}`, error);
    return createSimpleErrorResponse(
      error.message || '更新场景词失败',
      500,
      'UPDATE_SCENARIOS_FAILED',
      requestId
    );
  }
}

export async function GET(request: NextRequest) {
  return NextResponse.json({
    success: false,
    error: '请使用POST方法更新场景词',
  }, { status: 405 });
}
