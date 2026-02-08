import { NextRequest, NextResponse } from 'next/server';
import * as fs from 'fs';
import * as path from 'path';
import { getDb } from 'coze-coding-dev-sdk';
import { standardTerms, termExpansionRecords } from '@/storage/database/shared/schema';
import { eq, and } from 'drizzle-orm';
import { randomUUID } from 'crypto';

/**
 * 确认导入映射表 API
 * 执行实际的导入操作（同时更新文件和数据库）
 *
 * 改进：双词库同步机制
 * 1. 更新 standardTerms.ts 文件（静态词库，离线分析使用）
 * 2. 写入数据库 standardTerms 表（动态词库，在线分析使用）
 * 3. 支持审核状态选择（approved/pending）
 */
export async function POST(request: NextRequest) {
  try {
    const { category, mode, data, autoApprove } = await request.json();
    const autoApproveValue = autoApprove ?? true; // 确保 autoApprove 一定是 boolean 类型

    // 验证参数
    if (!category || !mode || !data) {
      return NextResponse.json(
        { error: '缺少必要参数' },
        { status: 400 }
      );
    }

    if (!['append', 'replace'].includes(mode)) {
      return NextResponse.json(
        { error: 'mode 参数必须是 "append" 或 "replace"' },
        { status: 400 }
      );
    }

    // 步骤1：准备数据
    const importResult = prepareImportData(category, data);
    if (!importResult.success) {
      return NextResponse.json(
        { error: importResult.error },
        { status: 400 }
      );
    }

    const { dbCategory, standardTermsList, mappingEntries } = importResult;

    // 步骤2：更新文件（标准词库）
    const fileUpdateResult = await updateStandardTermsFile(category, mode, data);
    if (!fileUpdateResult.success) {
      return NextResponse.json(
        { error: fileUpdateResult.error },
        { status: 500 }
      );
    }

    // 步骤3：写入数据库（动态词库）
    const dbUpdateResult = await updateDatabase(
      dbCategory!,
      standardTermsList!,
      mappingEntries!,
      mode as 'append' | 'replace',
      autoApproveValue
    );

    if (!dbUpdateResult.success) {
      // 数据库写入失败，回滚文件更新
      const backupPath = path.join(process.cwd(), 'src/lib/standardTerms.ts.backup');
      if (fs.existsSync(backupPath)) {
        fs.copyFileSync(backupPath, path.join(process.cwd(), 'src/lib/standardTerms.ts'));
        fs.unlinkSync(backupPath);
      }

      return NextResponse.json(
        { error: dbUpdateResult.error },
        { status: 500 }
      );
    }

    // 返回成功结果
    return NextResponse.json({
      success: true,
      message: `成功导入 ${data.length} 条记录`,
      dataSummary: {
        totalRecords: data.length,
        fileUpdated: true,
        databaseUpdated: true,
        dbStats: dbUpdateResult.stats,
        reviewStatus: autoApprove ? 'approved' : 'pending',
      },
    });
  } catch (error) {
    console.error('确认导入失败:', error);
    return NextResponse.json(
      {
        error: '确认导入失败',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

/**
 * 准备导入数据
 * 将映射表分类转换为数据库分类，提取标准词和映射关系
 */
function prepareImportData(
  category: string,
  data: any[]
): { success: boolean; dbCategory?: string; standardTermsList?: Set<string>; mappingEntries?: Array<{ term: string; synonyms: string[]; filmTypes: string[] }>; error?: string } {
  try {
    // 映射表分类到数据库分类的转换
    const categoryMapping: Record<string, string> = {
      'mood': 'emotion',
      'style': 'style',
      'instruments': 'instrument',
      'filmGenres': 'film',
      'filmTypes': 'film',
      'sceneTypes': 'scenario',
      'standardScenes': 'scenario',
      'moodExtended': 'emotion',
    };

    const dbCategory = categoryMapping[category];
    if (!dbCategory) {
      return {
        success: false,
        error: `不支持的映射表分类: ${category}`
      };
    }

    // 提取标准词和映射关系
    const standardTermsList = new Set<string>();
    const mappingEntries: Array<{ term: string; synonyms: string[]; filmTypes: string[] }> = [];

    data.forEach(item => {
      if (item['标准词']) {
        standardTermsList.add(item['标准词']);

        // 收集映射关系
        const entry: { term: string; synonyms: string[]; filmTypes: string[] } = {
          term: item['标准词'],
          synonyms: [],
          filmTypes: [],
        };

        // 提取近义词（从"原词"字段）
        if (item['原词'] && item['原词'] !== item['标准词']) {
          entry.synonyms.push(item['原词']);
        }

        // 提取适配类型（从"适配类型"字段）
        if (item['适配类型']) {
          if (Array.isArray(item['适配类型'])) {
            entry.filmTypes = item['适配类型'];
          } else if (typeof item['适配类型'] === 'string') {
            // 支持逗号分隔的字符串
            entry.filmTypes = item['适配类型'].split(',').map(t => t.trim()).filter(Boolean);
          }
        }

        mappingEntries.push(entry);
      } else if (item['标准类型']) {
        // 对于只有标准类型的记录（如部分分类）
        standardTermsList.add(item['标准类型']);
        mappingEntries.push({
          term: item['标准类型'],
          synonyms: [],
          filmTypes: [],
        });
      }
    });

    return {
      success: true,
      dbCategory,
      standardTermsList,
      mappingEntries,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

/**
 * 更新 standardTerms.ts 文件
 */
async function updateStandardTermsFile(
  category: string,
  mode: 'append' | 'replace',
  data: any[]
): Promise<{ success: boolean; error?: string }> {
  try {
    const filePath = path.join(process.cwd(), 'src/lib/standardTerms.ts');

    // 创建备份
    const backupPath = path.join(process.cwd(), 'src/lib/standardTerms.ts.backup');
    fs.copyFileSync(filePath, backupPath);

    // 读取文件内容
    let fileContent = fs.readFileSync(filePath, 'utf-8');

    // 根据分类更新对应的映射表
    try {
      switch (category) {
        case 'mood':
          fileContent = updateSimpleMapping(
            fileContent,
            'mood',
            'mapping',
            data,
            mode
          );
          fileContent = updateStandardList(fileContent, 'mood', data, mode);
          break;

        case 'instruments':
          fileContent = updateSimpleMapping(
            fileContent,
            'instruments',
            'mapping',
            data,
            mode
          );
          fileContent = updateStandardList(fileContent, 'instruments', data, mode);
          break;

        case 'filmGenres':
          fileContent = updateSimpleMapping(
            fileContent,
            'filmGenres',
            'mapping',
            data,
            mode
          );
          break;

        case 'sceneTypes':
          fileContent = updateSimpleMapping(
            fileContent,
            'sceneTypes',
            'mapping',
            data,
            mode
          );
          fileContent = updateStandardList(fileContent, 'sceneTypes', data, mode);
          break;

        case 'moodExtended':
          fileContent = updateSimpleMapping(
            fileContent,
            'moodExtended',
            'mapping',
            data,
            mode
          );
          break;

        default:
          fs.unlinkSync(backupPath);
          return {
            success: false,
            error: `暂不支持 ${category} 类型的自动导入，请手动编辑文件`
          };
      }

      // 写入更新后的内容
      fs.writeFileSync(filePath, fileContent, 'utf-8');

      // 删除备份
      fs.unlinkSync(backupPath);

      return { success: true };
    } catch (updateError) {
      // 更新失败，恢复备份
      fs.copyFileSync(backupPath, filePath);
      fs.unlinkSync(backupPath);
      throw updateError;
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

/**
 * 更新数据库（动态词库）
 */
async function updateDatabase(
  category: string,
  standardTermsList: Set<string>,
  mappingEntries: Array<{ term: string; synonyms: string[]; filmTypes: string[] }>,
  mode: 'append' | 'replace',
  autoApprove: boolean
): Promise<{ success: boolean; stats?: any; error?: string }> {
  try {
    const db = await getDb();
    const now = new Date();

    let addedCount = 0;
    let updatedCount = 0;
    let skippedCount = 0;
    const errors: string[] = [];

    // 替换模式：先清空该分类的审核通过的词
    if (mode === 'replace') {
      if (autoApprove) {
        // 只清空已审核通过的词
        await db
          .delete(standardTerms)
          .where(
            and(
              eq(standardTerms.category, category),
              eq(standardTerms.reviewStatus, 'approved')
            )
          );
      }
    }

    // 插入或更新标准词
    for (const entry of mappingEntries) {
      try {
        // 检查词是否已存在
        const existingTerms = await db
          .select()
          .from(standardTerms)
          .where(eq(standardTerms.term, entry.term))
          .limit(1);

        const termId = existingTerms.length > 0 ? existingTerms[0].id : randomUUID();
        const existingTerm = existingTerms.length > 0 ? existingTerms[0] : null;

        // 合并近义词（如果已存在）
        let mergedSynonyms = entry.synonyms;
        if (existingTerm && existingTerm.synonyms) {
          const existingSynonyms = Array.isArray(existingTerm.synonyms) ? existingTerm.synonyms : [];
          mergedSynonyms = [...new Set([...existingSynonyms, ...entry.synonyms])];
        }

        // 合并影视类型（如果已存在）
        let mergedFilmTypes = entry.filmTypes;
        if (existingTerm && existingTerm.filmTypes) {
          const existingFilmTypes = Array.isArray(existingTerm.filmTypes) ? existingTerm.filmTypes : [];
          mergedFilmTypes = [...new Set([...existingFilmTypes, ...entry.filmTypes])];
        }

        if (existingTerm) {
          // 更新已存在的词
          await db
            .update(standardTerms)
            .set({
              synonyms: mergedSynonyms,
              filmTypes: mergedFilmTypes,
              reviewStatus: autoApprove ? 'approved' : existingTerm.reviewStatus,
              updatedAt: now,
            })
            .where(eq(standardTerms.id, termId));

          updatedCount++;
        } else {
          // 插入新词
          await db.insert(standardTerms).values({
            id: termId,
            term: entry.term,
            category,
            termType: 'core', // 映射表导入的词默认为核心词
            filmTypes: mergedFilmTypes,
            synonyms: mergedSynonyms,
            isAutoExpanded: false,
            expansionSource: 'manual-import',
            expansionReason: '通过映射表导入',
            reviewStatus: autoApprove ? 'approved' : 'pending',
            usageCount: 0,
            createdAt: now,
            updatedAt: now,
          });

          addedCount++;
        }

        // 记录扩充历史
        const existingRecords = await db
          .select()
          .from(termExpansionRecords)
          .where(eq(termExpansionRecords.term, entry.term))
          .limit(1);

        if (existingRecords.length === 0) {
          await db.insert(termExpansionRecords).values({
            termId,
            term: entry.term,
            category,
            termType: 'core',
            triggerCount: 0,
            boundFilmTypes: mergedFilmTypes,
            validationPassed: true,
            validationDetails: {
              namingNormalized: true,
              synonymsChecked: true,
              conflictsResolved: true,
            },
            expansionType: 'manual-import',
            expandedBy: 'manual',
            expansionBatchId: `import-${Date.now()}`,
            createdAt: now,
          });
        }
      } catch (termError) {
        console.error(`[导入词汇失败] ${entry.term}:`, termError);
        errors.push(`"${entry.term}": ${termError instanceof Error ? termError.message : String(termError)}`);
        skippedCount++;
      }
    }

    return {
      success: true,
      stats: {
        added: addedCount,
        updated: updatedCount,
        skipped: skippedCount,
        errors,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

/**
 * 更新简单的映射表（包含 mapping 字段的分类）
 */
function updateSimpleMapping(
  fileContent: string,
  category: string,
  mappingKey: string,
  data: any[],
  mode: 'append' | 'replace'
): string {
  // 解析导入的数据
  const newMappings: { [key: string]: string } = {};
  const newStandards = new Set<string>();

  data.forEach(item => {
    if (item['原词'] && item['标准词']) {
      newMappings[item['原词']] = item['标准词'];
      newStandards.add(item['标准词']);
    }
  });

  // 构建新的映射表字符串
  const newMappingLines = Object.entries(newMappings)
    .map(([key, value]) => `      '${key}': '${value}',`)
    .join('\n');

  // 查找并替换映射表内容
  // 匹配模式：找到 category 开始位置，然后找到 mapping 对象的开始和结束
  const regex = new RegExp(
    `(${category}: \\{[^}]*${mappingKey}: \\{\\s*)([\\s\\S]*?)(\\s*\\},\\s*standardList:|\\s*\\},)`,
    'm'
  );

  if (mode === 'replace') {
    // 替换模式：完全替换映射表内容
    fileContent = fileContent.replace(regex, `$1\n${newMappingLines}\n$3`);
  } else {
    // 追加模式：在现有映射表基础上追加新数据
    const match = fileContent.match(regex);
    if (match) {
      const currentMappings = match[2];
      fileContent = fileContent.replace(
        regex,
        `$1\n${currentMappings}\n${newMappingLines}\n$3`
      );
    }
  }

  return fileContent;
}

/**
 * 更新标准词列表（standardList）
 */
function updateStandardList(
  fileContent: string,
  category: string,
  data: any[],
  mode: 'append' | 'replace'
): string {
  // 提取标准词
  const standardTerms = new Set<string>();
  data.forEach(item => {
    if (item['标准词']) {
      standardTerms.add(item['标准词']);
    }
  });

  // 构建新的标准词列表字符串
  const newStandardList = Array.from(standardTerms)
    .map(term => `    '${term}',`)
    .join('\n');

  // 查找并替换标准词列表
  const regex = new RegExp(
    `(${category}: \\{[^}]*standardList: \\[\\s*)([\\s\\S]*?)(\\s*\\]\\s*\\},)`,
    'm'
  );

  if (mode === 'replace') {
    // 替换模式：完全替换标准词列表
    fileContent = fileContent.replace(regex, `$1\n${newStandardList}\n$3`);
  } else {
    // 追加模式：在现有列表基础上追加
    const match = fileContent.match(regex);
    if (match) {
      const currentList = match[2];
      fileContent = fileContent.replace(
        regex,
        `$1\n${currentList}\n${newStandardList}\n$3`
      );
    }
  }

  return fileContent;
}
