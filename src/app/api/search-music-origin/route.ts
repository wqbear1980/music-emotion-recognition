import { NextRequest, NextResponse } from 'next/server';
import { SearchClient, Config } from 'coze-coding-dev-sdk';

interface SearchRequest {
  query: string;
  count?: number;
}

export async function POST(request: NextRequest) {
  try {
    const body: SearchRequest = await request.json();
    const { query, count = 10 } = body;

    if (!query || query.trim().length === 0) {
      return NextResponse.json(
        { error: '搜索查询不能为空' },
        { status: 400 }
      );
    }

    // 初始化搜索客户端
    const config = new Config();
    const searchClient = new SearchClient(config);

    // 执行联网搜索
    const searchResponse = await searchClient.webSearchWithSummary(
      query,
      count
    );

    // 返回搜索结果
    return NextResponse.json({
      query,
      summary: searchResponse.summary || '',
      results: searchResponse.web_items || [],
      count: searchResponse.web_items?.length || 0,
    });
  } catch (error) {
    console.error('Search Error:', error);
    return NextResponse.json(
      { error: '搜索失败，请稍后重试' },
      { status: 500 }
    );
  }
}
