import { NextRequest, NextResponse } from 'next/server';
import {
  isNeutralMusicTerm,
  standardizeTerm,
  analyzeVocabulary,
  extractNeutralMusicTerms,
  isNeutralMusic,
  getNeutralMusicVocabulary,
} from '@/lib/vocabularyAnalyzer';

/**
 * 词库分析 API
 * 用于分析音乐描述文本，提取中性音乐相关词汇
 */

/**
 * POST /api/vocabulary/analyze
 * 分析文本中的词汇，返回中性音乐相关词汇
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { text, terms } = body;

    // 获取词库
    if (body.action === 'getVocabulary') {
      const vocabulary = getNeutralMusicVocabulary();
      return NextResponse.json({
        success: true,
        data: vocabulary,
      });
    }

    // 单个词汇分析
    if (body.action === 'analyzeTerm' && body.term) {
      const analysis = analyzeVocabulary(body.term);
      return NextResponse.json({
        success: true,
        data: analysis,
      });
    }

    // 标准化词汇
    if (body.action === 'standardize' && body.term) {
      const standardized = standardizeTerm(body.term);
      return NextResponse.json({
        success: true,
        data: {
          original: body.term,
          standardized,
        },
      });
    }

    // 判断是否为中性音乐词汇
    if (body.action === 'isNeutral' && body.term) {
      const isNeutral = isNeutralMusicTerm(body.term);
      return NextResponse.json({
        success: true,
        data: {
          term: body.term,
          isNeutral,
        },
      });
    }

    // 从文本中提取中性音乐词汇
    if (text) {
      const extractedTerms = extractNeutralMusicTerms(text);
      return NextResponse.json({
        success: true,
        data: {
          text,
          extractedTerms,
          count: extractedTerms.length,
        },
      });
    }

    // 判断音乐是否为中性音乐（基于词汇列表）
    if (terms && Array.isArray(terms)) {
      const isNeutral = isNeutralMusic(terms);
      const neutralTerms = terms.filter(term => isNeutralMusicTerm(term));

      return NextResponse.json({
        success: true,
        data: {
          isNeutral,
          totalTerms: terms.length,
          neutralTerms,
          neutralCount: neutralTerms.length,
          ratio: neutralTerms.length / terms.length,
        },
      });
    }

    return NextResponse.json(
      {
        success: false,
        error: 'Invalid request. Please provide either "text", "terms", or specify an "action".',
      },
      { status: 400 }
    );
  } catch (error) {
    console.error('Error in vocabulary analysis:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/vocabulary/analyze
 * 获取中性音乐词库
 */
export async function GET() {
  try {
    const vocabulary = getNeutralMusicVocabulary();

    return NextResponse.json({
      success: true,
      data: vocabulary,
      stats: {
        totalEmotions: vocabulary.emotions.length,
        totalStyles: vocabulary.styles.length,
        totalScenarios: vocabulary.scenarios.length,
        totalCharacteristics: vocabulary.characteristics.length,
        totalInstruments: vocabulary.instruments.length,
        total: Object.values(vocabulary).reduce((sum, arr) => sum + arr.length, 0),
      },
    });
  } catch (error) {
    console.error('Error getting vocabulary:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
      },
      { status: 500 }
    );
  }
}
