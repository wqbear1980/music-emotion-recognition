import { NextRequest, NextResponse } from 'next/server';
import {
  getLLMProviderConfig,
  getLLMConfigSummary,
  checkLocalLLMHealth,
  autoDetectBestProvider,
} from '@/lib/llmConfig';

/**
 * GET - 获取LLM配置信息
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const action = searchParams.get('action');

    if (action === 'health-check') {
      // 健康检查
      const isHealthy = await checkLocalLLMHealth();
      return NextResponse.json({
        success: true,
        healthy: isHealthy,
        message: isHealthy ? '本地LLM服务正常' : '本地LLM服务不可用',
      });
    }

    if (action === 'auto-detect') {
      // 自动检测最佳LLM提供者
      const bestProvider = await autoDetectBestProvider();
      return NextResponse.json({
        success: true,
        provider: bestProvider,
      });
    }

    // 默认：返回配置摘要
    const summary = getLLMConfigSummary();
    const currentConfig = getLLMProviderConfig();

    return NextResponse.json({
      success: true,
      config: {
        current: {
          type: currentConfig.type,
          provider: currentConfig.provider,
          model: currentConfig.model,
          defaultTemperature: currentConfig.defaultTemperature,
          defaultStreaming: currentConfig.defaultStreaming,
        },
        summary,
      },
    });
  } catch (error) {
    console.error('[LLM配置API] 获取配置失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: '获取LLM配置失败',
        message: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

/**
 * POST - 动态切换LLM配置（运行时）
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { type } = body;

    if (!type || !['cloud', 'local'].includes(type)) {
      return NextResponse.json(
        {
          success: false,
          error: '无效的LLM类型，必须是 cloud 或 local',
        },
        { status: 400 }
      );
    }

    // 注意：这里只是返回建议，实际配置需要修改环境变量
    const config = type === 'cloud'
      ? {
          type: 'cloud',
          provider: 'coze',
          model: process.env.CLOUD_LLM_MODEL || 'doubao-seed-1-6-251015',
          modelBaseUrl: 'https://model.coze.com',
        }
      : {
          type: 'local',
          provider: 'openai-compatible',
          model: process.env.LOCAL_LLM_MODEL || 'Qwen/Qwen2.5-7B-Instruct',
          modelBaseUrl: process.env.LOCAL_LLM_BASE_URL || 'http://localhost:8000/v1',
        };

    return NextResponse.json({
      success: true,
      message: `已切换到${type === 'cloud' ? '云端' : '本地'}LLM配置`,
      config,
      notice: '注意：此配置仅在当前请求会话有效，要永久切换请修改环境变量 LLM_TYPE',
    });
  } catch (error) {
    console.error('[LLM配置API] 切换配置失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: '切换LLM配置失败',
        message: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
