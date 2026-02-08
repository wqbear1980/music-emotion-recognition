import { NextRequest, NextResponse } from 'next/server';

/**
 * 连接到Ollama服务并获取模型列表
 * 使用后端代理来避免CORS问题
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const ollamaUrl = searchParams.get('url') || 'http://127.0.0.1:11434';

    console.log('[Ollama连接] 正在连接:', ollamaUrl);

    // 调用Ollama的API
    const response = await fetch(`${ollamaUrl}/api/tags`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[Ollama连接] 响应错误:', response.status, errorText);

      return NextResponse.json({
        success: false,
        error: `Ollama服务响应异常: ${response.status} ${response.statusText}`,
        details: errorText.substring(0, 500),
      }, { status: 200 });
    }

    const data = await response.json();
    console.log('[Ollama连接] 成功获取模型列表:', data.models?.length || 0, '个模型');

    return NextResponse.json({
      success: true,
      models: data.models?.map((m: any) => m.name) || [],
      baseUrl: ollamaUrl,
    });

  } catch (error) {
    console.error('[Ollama连接] 连接失败:', error);

    let errorMessage = error instanceof Error ? error.message : '未知错误';
    let errorCode = '';

    // 检查错误对象中的cause字段
    if (error instanceof Error && 'cause' in error) {
      const cause = (error as any).cause;
      if (cause && cause.code) {
        errorCode = cause.code;
      }
      if (cause && cause.message) {
        errorMessage = cause.message;
      }
    }

    // 提供详细的诊断信息
    let diagnostic = '';
    if (errorCode === 'ECONNREFUSED' || errorMessage.includes('ECONNREFUSED')) {
      diagnostic = '❌ 连接被拒绝\n\n原因：无法连接到Ollama服务\n\n解决方案：\n1. 在本地终端运行：ollama serve\n2. 如果使用ngrok，确保ngrok正在运行\n3. 检查Ollama服务地址是否正确';
    } else if (errorCode === 'ETIMEDOUT' || errorMessage.includes('timeout') || errorMessage.includes('ETIMEDOUT')) {
      diagnostic = '❌ 连接超时\n\n原因：连接Ollama服务超时\n\n解决方案：\n1. 检查网络连接\n2. 检查防火墙设置\n3. 确保Ollama服务正常启动';
    } else if (errorCode === 'ENOTFOUND' || errorMessage.includes('ENOTFOUND')) {
      diagnostic = '❌ 找不到地址\n\n原因：Ollama服务地址不正确\n\n解决方案：\n请检查Ollama服务地址格式，例如：\n- 本地：http://127.0.0.1:11434\n- ngrok：https://xxx.ngrok-free.app';
    } else {
      diagnostic = `❌ 连接失败\n\n错误信息：${errorMessage}`;
    }

    return NextResponse.json({
      success: false,
      error: diagnostic,
    }, { status: 200 });
  }
}
