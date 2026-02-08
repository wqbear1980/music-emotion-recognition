import { NextRequest, NextResponse } from 'next/server';
import { LLMClient, Config } from 'coze-coding-dev-sdk';
import { getRawClient } from '@/storage/database/rawClient';

/**
 * 批量翻译专辑名称API
 * 为数据库中所有未翻译的外文专辑填充中文翻译
 */
export async function POST(_request: NextRequest) {
  try {
    const client = await getRawClient();

    // 查询所有未翻译的外文专辑（album不为空，但album_translated为空）
    const query = `
      SELECT DISTINCT id, album
      FROM music_analyses
      WHERE album IS NOT NULL
        AND album != ''
        AND (album_translated IS NULL OR album_translated = '')
      ORDER BY album
    `;

    const result = await client.query(query);

    if (result.rows.length === 0) {
      return NextResponse.json({
        success: true,
        message: '没有需要翻译的专辑',
        translatedCount: 0,
      });
    }

    // 构建专辑名称映射（去重）
    const albumMap = new Map<string, string[]>();
    for (const row of result.rows) {
      const albumName = row.album;
      if (!albumMap.has(albumName)) {
        albumMap.set(albumName, []);
      }
      albumMap.get(albumName)!.push(row.id);
    }

    const albumsToTranslate = Array.from(albumMap.keys());

    // 过滤掉中文专辑和无效专辑（假设中文专辑不需要翻译）
    const foreignAlbums = albumsToTranslate.filter((album) => {
      if (!album || !album.trim()) return false;

      // 过滤掉无效专辑名
      if (album === '未提取到' || album === '未识别' || album === '未分类') return false;

      // 检查是否主要是中文（连续的中文字符占比超过50%）
      const chineseMatches = album.match(/[\u4e00-\u9fa5]+/g) || [];
      const totalChineseChars = chineseMatches.join('').length;
      const totalChars = album.length;
      const chineseRatio = totalChineseChars / totalChars;

      // 如果中文字符占比超过50%，则认为是中文专辑，不需要翻译
      // 否则认为是外文专辑，需要翻译
      return chineseRatio < 0.5;
    });

    if (foreignAlbums.length === 0) {
      return NextResponse.json({
        success: true,
        message: '没有外文专辑需要翻译',
        translatedCount: 0,
      });
    }

    console.log(`[批量翻译] 准备翻译 ${foreignAlbums.length} 个专辑`);

    // 初始化 LLM 客户端
    const config = new Config();
    const llmClient = new LLMClient(config);

    // 构建翻译提示词
    const prompt = `你是一个专业的音乐专辑翻译专家。请将以下专辑名称翻译成中文。

要求：
1. 保持专有名词（如人名、地名、作品名）的准确性
2. 翻译要简洁、专业，符合音乐专辑的命名习惯
3. 如果专辑本身就是中文或不需要翻译，返回原名称
4. 请以JSON格式返回翻译结果，格式为：{"原专辑名": "中文翻译"}

专辑列表：
${foreignAlbums.map((album, index) => `${index + 1}. ${album}`).join('\n')}

请直接返回JSON格式的翻译结果，不要包含其他解释：`;

    const messages = [
      {
        role: 'system' as const,
        content:
          '你是一个专业的音乐专辑翻译专家，擅长将英文、日文、韩文等外文专辑名称翻译成中文。',
      },
      {
        role: 'user' as const,
        content: prompt,
      },
    ];

    // 调用 LLM API
    const response = await llmClient.invoke(messages, {
      model: 'doubao-seed-1-6-251015',
      temperature: 0.3,
    });

    // 解析翻译结果
    let translations: Record<string, string> = {};

    try {
      const content = response.content.trim();
      const jsonMatch = content.match(/\{[\s\S]*\}/);

      if (jsonMatch) {
        translations = JSON.parse(jsonMatch[0]);
      } else {
        translations = JSON.parse(content);
      }
    } catch (parseError) {
      console.error('[批量翻译] 解析翻译结果失败:', parseError);
      return NextResponse.json(
        {
          success: false,
          message: '解析翻译结果失败',
          translations: {},
        },
        { status: 500 }
      );
    }

    // 更新数据库
    let updateCount = 0;
    for (const [albumName, translated] of Object.entries(translations)) {
      const ids = albumMap.get(albumName);
      if (ids && ids.length > 0) {
        await client.query(
          `UPDATE music_analyses SET album_translated = $1 WHERE id = ANY($2)`,
          [translated, ids]
        );
        updateCount += ids.length;
        console.log(`[批量翻译] ${albumName} -> ${translated} (更新了 ${ids.length} 条记录)`);
      }
    }

    return NextResponse.json({
      success: true,
      message: `成功翻译 ${Object.keys(translations).length} 个专辑，更新了 ${updateCount} 条记录`,
      translatedCount: updateCount,
      translations,
    });
  } catch (error) {
    console.error('[批量翻译] 批量翻译失败:', error);
    return NextResponse.json(
      {
        success: false,
        message: '批量翻译失败',
        error: error instanceof Error ? error.message : '未知错误',
        translations: {},
      },
      { status: 500 }
    );
  }
}
