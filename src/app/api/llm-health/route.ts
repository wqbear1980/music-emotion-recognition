import { NextRequest, NextResponse } from 'next/server';
import { LOCAL_LLM_MODELS, getModelNameForService } from '@/lib/llmModels';

/**
 * 检查本地 LLM 服务的健康状态
 * 支持多种本地 LLM 服务：Ollama, vLLM, 以及其他 OpenAI 兼容服务
 * 支持 DeepSeek、Qwen、Gemma、GPT、Llama 等多种模型
 */

/**
 * 检查 Ollama 服务的健康状态
 */
async function checkOllamaHealth(baseUrl: string, timeout: number = 5000): Promise<{
  healthy: boolean;
  message: string;
  details?: any;
}> {
  let cleanBaseUrl = '';

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    // Ollama 使用 /api/tags 或 /api/version 端点
    // 清理baseUrl，去掉可能的 /v1 后缀
    cleanBaseUrl = baseUrl.replace(/\/v1\/?$/, '');
    const healthUrl = `${cleanBaseUrl}/api/tags`;

    console.log('[Ollama 健康检查] 请求详情:', { originalBaseUrl: baseUrl, cleanBaseUrl, healthUrl });

    const response = await fetch(healthUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (response.ok) {
      const data = await response.json();
      console.log('[Ollama 健康检查] 检查成功:', { models: data.models?.map((m: any) => m.name) });
      return {
        healthy: true,
        message: 'Ollama 服务正常运行',
        details: {
          service: 'Ollama',
          models: data.models?.map((m: any) => m.name) || [],
          baseUrl: cleanBaseUrl,
        },
      };
    }

    // 尝试读取错误响应体
    let errorBody = '';
    try {
      errorBody = await response.text();
      console.error('[Ollama 健康检查] 错误响应:', { status: response.status, errorBody });
    } catch (e) {
      console.error('[Ollama 健康检查] 无法读取错误响应');
    }

    return {
      healthy: false,
      message: `Ollama 服务响应异常: ${response.status} ${response.statusText}`,
      details: { service: 'Ollama', baseUrl: cleanBaseUrl, errorBody },
    };
  } catch (error) {
    console.error('[Ollama 健康检查] 连接失败:', error);
    return {
      healthy: false,
      message: `Ollama 服务连接失败: ${error instanceof Error ? error.message : String(error)}`,
      details: { service: 'Ollama', baseUrl: cleanBaseUrl || baseUrl },
    };
  }
}

/**
 * 检查 vLLM 服务的健康状态
 */
async function checkVLLMHealth(baseUrl: string, timeout: number = 5000): Promise<{
  healthy: boolean;
  message: string;
  details?: any;
}> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    // vLLM 使用 /health 或 /v1/health 端点
    const healthUrl = `${baseUrl}/health`;
    const response = await fetch(healthUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (response.ok) {
      const data = await response.json();
      return {
        healthy: true,
        message: 'vLLM 服务正常运行',
        details: {
          service: 'vLLM',
          model: data.model,
          backend: data.backend,
          baseUrl,
        },
      };
    }

    // 尝试 /v1/models 端点
    const modelsUrl = `${baseUrl}/v1/models`;
    const modelsResponse = await fetch(modelsUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (modelsResponse.ok) {
      const data = await modelsResponse.json();
      return {
        healthy: true,
        message: 'vLLM 服务正常运行（通过 models 端点检测）',
        details: {
          service: 'vLLM',
          models: data.data?.map((m: any) => m.id) || [],
          baseUrl,
        },
      };
    }

    return {
      healthy: false,
      message: `vLLM 服务响应异常: ${response.status} ${response.statusText}`,
      details: { service: 'vLLM', baseUrl },
    };
  } catch (error) {
    return {
      healthy: false,
      message: `vLLM 服务连接失败: ${error instanceof Error ? error.message : String(error)}`,
      details: { service: 'vLLM', baseUrl },
    };
  }
}

/**
 * 检查通用 OpenAI 兼容服务的健康状态
 */
async function checkOpenAICompatibleHealth(baseUrl: string, timeout: number = 5000): Promise<{
  healthy: boolean;
  message: string;
  details?: any;
}> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    // 尝试 /v1/models 端点
    const modelsUrl = `${baseUrl}/v1/models`;
    const response = await fetch(modelsUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (response.ok) {
      const data = await response.json();
      return {
        healthy: true,
        message: 'OpenAI 兼容服务正常运行',
        details: {
          service: 'OpenAI-Compatible',
          models: data.data?.map((m: any) => m.id) || [],
          baseUrl,
        },
      };
    }

    return {
      healthy: false,
      message: `OpenAI 兼容服务响应异常: ${response.status} ${response.statusText}`,
      details: { service: 'OpenAI-Compatible', baseUrl },
    };
  } catch (error) {
    return {
      healthy: false,
      message: `OpenAI 兼容服务连接失败: ${error instanceof Error ? error.message : String(error)}`,
      details: { service: 'OpenAI-Compatible', baseUrl },
    };
  }
}

/**
 * GET - 检查本地 LLM 服务健康状态
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const serviceType = searchParams.get('serviceType') || 'auto'; // ollama, vllm, openai-compatible, auto
    const baseUrl = searchParams.get('baseUrl') || process.env.LOCAL_LLM_BASE_URL || 'http://localhost:8000/v1';
    const timeout = parseInt(searchParams.get('timeout') || '5000', 10);

    console.log('[LLM 健康检查] 开始检查:', { serviceType, baseUrl, timeout });

    let result;

    switch (serviceType) {
      case 'ollama':
        result = await checkOllamaHealth(baseUrl, timeout);
        break;
      case 'vllm':
        result = await checkVLLMHealth(baseUrl, timeout);
        break;
      case 'openai-compatible':
        result = await checkOpenAICompatibleHealth(baseUrl, timeout);
        break;
      case 'auto':
      default:
        // 自动检测：按顺序尝试不同的服务类型
        console.log('[LLM 健康检查] 自动检测模式，尝试 Ollama...');
        result = await checkOllamaHealth(baseUrl, timeout);

        if (!result.healthy) {
          console.log('[LLM 健康检查] Ollama 检测失败，尝试 vLLM...');
          result = await checkVLLMHealth(baseUrl, timeout);
        }

        if (!result.healthy) {
          console.log('[LLM 健康检查] vLLM 检测失败，尝试 OpenAI 兼容服务...');
          result = await checkOpenAICompatibleHealth(baseUrl, timeout);
        }
        break;
    }

    console.log('[LLM 健康检查] 检查完成:', result);

    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error('[LLM 健康检查] 检查失败:', error);
    return NextResponse.json(
      {
        success: false,
        healthy: false,
        message: '健康检查失败',
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

/**
 * POST - 测试本地 LLM 服务的推理能力
 */
export async function POST(request: NextRequest) {
  let apiUrl = '';
  let serviceType = 'auto';
  let actualBaseUrl = '';
  let actualModel = '';

  try {
    const body = await request.json();
    serviceType = body.serviceType || 'auto';
    const baseUrl = body.baseUrl;
    const model = body.model;
    const prompt = body.prompt || 'Hello, world!';

    actualBaseUrl = baseUrl || process.env.LOCAL_LLM_BASE_URL || 'http://localhost:8000/v1';
    const originalModel = model || process.env.LOCAL_LLM_MODEL || 'Qwen/Qwen2.5-7B-Instruct';

    // 根据服务类型获取正确的模型名称
    actualModel = getModelNameForService(
      originalModel,
      serviceType as 'ollama' | 'vllm' | 'openai-compatible' | 'auto'
    );

    console.log('[LLM 测试] 开始测试推理能力:', {
      serviceType,
      baseUrl: actualBaseUrl,
      originalModel,
      actualModel,
    });

    const controller = new AbortController();
    // 根据模型大小动态设置超时时间
    const modelSize = parseInt(actualModel.match(/\d+(?=b)/i)?.[0] || '7');
    const timeoutMs = modelSize >= 32 ? 180000 : 120000; // 32B以上3分钟，其他2分钟
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    console.log('[LLM 测试] 超时设置:', {
      model: actualModel,
      modelSize: modelSize + 'B',
      timeout: timeoutMs / 1000 + '秒',
    });

    let requestBody: any = {};

    // 根据服务类型使用不同的API格式
    if (serviceType === 'ollama') {
      // Ollama使用 /api/chat 端点
      // 清理baseUrl，去掉可能的 /v1 后缀
      const cleanBaseUrl = actualBaseUrl.replace(/\/v1\/?$/, '');
      apiUrl = `${cleanBaseUrl}/api/chat`;
      requestBody = {
        model: actualModel,
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
        stream: false,
      };
    } else if (serviceType === 'vllm' || serviceType === 'openai-compatible' || serviceType === 'auto') {
      // vLLM和OpenAI兼容服务使用 /chat/completions 端点
      // 确保baseUrl以 /v1 结尾
      let cleanBaseUrl = actualBaseUrl.replace(/\/+$/, '');
      if (!cleanBaseUrl.endsWith('/v1')) {
        cleanBaseUrl = `${cleanBaseUrl}/v1`;
      }
      apiUrl = `${cleanBaseUrl}/chat/completions`;
      requestBody = {
        model: actualModel,
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
        max_tokens: 50,
        temperature: 0.7,
      };
    } else {
      throw new Error(`不支持的服务类型: ${serviceType}`);
    }

    console.log('[LLM 测试] 请求详情:', {
      serviceType,
      originalBaseUrl: actualBaseUrl,
      apiUrl,
      model: actualModel,
      requestBody: JSON.stringify(requestBody)
    });

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    console.log('[LLM 测试] 响应状态:', {
      status: response.status,
      statusText: response.statusText,
      ok: response.ok
    });

    if (response.ok) {
      const data = await response.json();
      let content = '';

      // 根据不同的响应格式提取内容
      if (serviceType === 'ollama') {
        content = data.message?.content || '';
      } else {
        content = data.choices?.[0]?.message?.content || '';
      }

      console.log('[LLM 测试] 推理成功:', { content, serviceType, model: actualModel });

      return NextResponse.json({
        success: true,
        healthy: true,
        message: '推理测试成功',
        details: {
          service: serviceType,
          baseUrl: actualBaseUrl,
          model: actualModel,
          response: content,
          usage: data.usage,
        },
      });
    }

    // 尝试读取错误响应体
    let errorBody = '';
    try {
      errorBody = await response.text();
      console.error('[LLM 测试] 错误响应体:', errorBody);
    } catch (e) {
      console.error('[LLM 测试] 无法读取错误响应体');
    }

    console.error('[LLM 测试] 推理失败:', {
      status: response.status,
      statusText: response.statusText,
      apiUrl,
      errorBody
    });

    return NextResponse.json({
      success: false,
      healthy: false,
      message: `推理测试失败: ${response.status} ${response.statusText}`,
      details: {
        service: serviceType,
        baseUrl: actualBaseUrl,
        model: actualModel,
        apiUrl,
        errorBody,
      },
    });
  } catch (error) {
    console.error('[LLM 测试] 测试失败:', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      cause: error instanceof Error ? error.cause : undefined,
      service: serviceType,
      baseUrl: actualBaseUrl,
      model: actualModel,
      apiUrl,
    });

    return NextResponse.json(
      {
        success: false,
        healthy: false,
        message: '推理测试失败',
        error: error instanceof Error ? error.message : String(error),
        details: {
          service: serviceType,
          baseUrl: actualBaseUrl,
          model: actualModel,
          apiUrl,
          cause: error instanceof Error ? error.cause : undefined,
        },
      },
      { status: 500 }
    );
  }
}
