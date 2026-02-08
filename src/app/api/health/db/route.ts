import { NextRequest, NextResponse } from 'next/server';
import { checkDbHealth, getHealthStatus } from '@/lib/db-enhanced';

/**
 * GET /api/health/db
 * 数据库健康检查接口
 * 
 * 用于监控数据库连接状态，返回当前健康状态和降级模式信息
 */
export async function GET(request: NextRequest) {
  try {
    // 执行健康检查
    const healthStatus = await checkDbHealth();

    // 判断是否启用降级模式
    const isFallbackMode = healthStatus.consecutiveFailures >= 3;

    // 根据健康状态生成合适的消息
    let message: string;
    if (healthStatus.status === 'healthy') {
      message = '数据库连接正常';
    } else if (isFallbackMode) {
      message = `数据库连续失败${healthStatus.consecutiveFailures}次，已启用降级模式`;
    } else {
      message = `数据库连接不稳定（已失败${healthStatus.consecutiveFailures}次），正在重试`;
    }

    return NextResponse.json({
      status: 'ok',
      database: {
        status: healthStatus.status,
        consecutiveFailures: healthStatus.consecutiveFailures,
        lastCheck: healthStatus.timestamp,
        isFallbackMode,
        message,
        ...(healthStatus.error && { error: healthStatus.error }),
      },
    });
  } catch (error: any) {
    console.error('[数据库健康检查] 失败:', error);
    
    return NextResponse.json({
      status: 'error',
      database: {
        status: 'error',
        error: error.message,
        isFallbackMode: true,
      },
    }, { status: 500 });
  }
}
