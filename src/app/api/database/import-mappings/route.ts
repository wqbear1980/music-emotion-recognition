import { NextRequest, NextResponse } from 'next/server';
import * as XLSX from 'xlsx';

/**
 * 导入映射表 API
 * 支持 Excel (.xlsx/.xls)、CSV、JSON 三种格式
 * 提供字段校验、重复检测、预览功能
 */
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const category = formData.get('category') as string;
    const mode = formData.get('mode') as string; // 'append' 或 'replace'
    const sheetName = formData.get('sheetName') as string | null; // 可选，指定工作表名称

    // 验证必要参数
    if (!file) {
      return NextResponse.json(
        { error: '缺少文件' },
        { status: 400 }
      );
    }

    if (!category) {
      return NextResponse.json(
        { error: '缺少 category 参数' },
        { status: 400 }
      );
    }

    if (!mode || !['append', 'replace'].includes(mode)) {
      return NextResponse.json(
        { error: 'mode 参数必须是 "append" 或 "replace"' },
        { status: 400 }
      );
    }

    // 读取文件
    const fileBuffer = await file.arrayBuffer();
    const fileName = file.name.toLowerCase();

    // 根据文件类型解析数据
    let parsedData: MappingRecord[];
    if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
      parsedData = await parseExcel(fileBuffer, sheetName);
    } else if (fileName.endsWith('.csv')) {
      parsedData = await parseCsv(fileBuffer);
    } else if (fileName.endsWith('.json')) {
      parsedData = await parseJson(fileBuffer);
    } else {
      return NextResponse.json(
        { error: '不支持的文件格式，仅支持 .xlsx, .xls, .csv, .json' },
        { status: 400 }
      );
    }

    // 验证数据格式
    const validationResult = validateMappingData(parsedData, category);
    if (!validationResult.valid) {
      return NextResponse.json(
        {
          error: '数据格式验证失败',
          details: validationResult.errors,
        },
        { status: 400 }
      );
    }

    // 获取当前映射表数据
    const currentMappings = getCurrentMappings(category);

    // 检测重复数据
    const duplicateCheckResult = checkDuplicates(
      parsedData,
      currentMappings,
      mode
    );

    // 生成导入预览
    const preview = generateImportPreview(
      parsedData,
      currentMappings,
      duplicateCheckResult,
      mode
    );

    return NextResponse.json({
      success: true,
      preview,
      validation: validationResult,
      duplicates: duplicateCheckResult,
      message: `成功解析 ${parsedData.length} 条记录，请确认后再执行导入`,
    });
  } catch (error) {
    console.error('导入映射表失败:', error);
    return NextResponse.json(
      {
        error: '导入失败',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

/**
 * 解析 Excel 文件
 */
async function parseExcel(
  buffer: ArrayBuffer,
  sheetName: string | null
): Promise<MappingRecord[]> {
  const workbook = XLSX.read(buffer, { type: 'buffer' });

  // 确定要读取的工作表
  let worksheet: XLSX.WorkSheet;
  if (sheetName) {
    worksheet = workbook.Sheets[sheetName];
    if (!worksheet) {
      throw new Error(`找不到工作表: ${sheetName}`);
    }
  } else {
    // 读取第一个工作表
    const firstSheetName = workbook.SheetNames[0];
    worksheet = workbook.Sheets[firstSheetName];
  }

  // 转换为 JSON（以第一行作为表头）
  const data = XLSX.utils.sheet_to_json<MappingRecord>(worksheet, {
    defval: '', // 空单元格使用空字符串
  });

  // 过滤掉空行
  return data.filter(row => {
    const keys = Object.keys(row);
    return keys.some(key => row[key] !== '' && row[key] !== null && row[key] !== undefined);
  });
}

/**
 * 解析 CSV 文件
 */
async function parseCsv(buffer: ArrayBuffer): Promise<MappingRecord[]> {
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const firstSheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[firstSheetName];

  const data = XLSX.utils.sheet_to_json<MappingRecord>(worksheet, {
    defval: '',
  });

  return data.filter(row => {
    const keys = Object.keys(row);
    return keys.some(key => row[key] !== '' && row[key] !== null && row[key] !== undefined);
  });
}

/**
 * 解析 JSON 文件
 * 【增强】添加详细的JSON解析错误处理
 */
async function parseJson(buffer: ArrayBuffer): Promise<MappingRecord[]> {
  try {
    const text = new TextDecoder().decode(buffer);

    // 1. 检查文本是否为空
    if (!text || text.trim() === '') {
      throw new Error('JSON 文件内容为空');
    }

    // 2. 检查文件大小（防止超大文件）
    if (text.length > 10 * 1024 * 1024) { // 10MB
      throw new Error('JSON 文件过大（超过 10MB），请分批导入');
    }

    // 3. 解析 JSON（使用 try-catch 捕获语法错误）
    let json;
    try {
      json = JSON.parse(text);
    } catch (parseError) {
      if (parseError instanceof SyntaxError) {
        // 提取错误位置信息
        const match = parseError.message.match(/position (\d+)/);
        const position = match ? match[1] : '未知位置';
        
        // 获取错误附近的文本片段
        const start = Math.max(0, parseInt(position) - 50);
        const end = Math.min(text.length, parseInt(position) + 50);
        const snippet = text.substring(start, end);
        
        throw new Error(
          `JSON 语法错误（位置 ${position}）: ${parseError.message}\n` +
          `错误附近内容: ${snippet}...`
        );
      }
      throw new Error(`JSON 解析失败: ${parseError instanceof Error ? parseError.message : String(parseError)}`);
    }

    // 4. 验证数据结构
    if (!json) {
      throw new Error('JSON 内容为 null');
    }

    if (!json.data) {
      throw new Error('JSON 格式不正确，缺少 data 字段');
    }

    if (!Array.isArray(json.data)) {
      throw new Error(`JSON 格式不正确，data 应为数组，实际为 ${typeof json.data}`);
    }

    // 5. 检查数据量
    if (json.data.length === 0) {
      throw new Error('JSON 文件中 data 数组为空');
    }

    if (json.data.length > 50000) {
      throw new Error(`JSON 文件数据量过大（${json.data.length} 条），建议分批导入（每批不超过 10000 条）`);
    }

    // 6. 检查每条记录的类型
    for (let i = 0; i < json.data.length; i++) {
      const item = json.data[i];
      if (typeof item !== 'object' || item === null || Array.isArray(item)) {
        throw new Error(`第 ${i + 1} 条记录格式错误：应为对象，实际为 ${typeof item}`);
      }
    }

    return json.data;
  } catch (error) {
    // 统一错误处理
    if (error instanceof Error) {
      throw error; // 重新抛出已知错误
    }
    throw new Error(`解析 JSON 文件时发生未知错误: ${String(error)}`);
  }
}

/**
 * 验证映射表数据格式
 * 【增强】添加字段类型校验、非法值处理、长度限制检查
 */
function validateMappingData(
  data: MappingRecord[],
  category: string
): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const expectedFields = getExpectedFields(category);

  if (data.length === 0) {
    return {
      valid: false,
      errors: ['文件内容为空'],
      warnings: [],
    };
  }

  // 1. 检查字段存在性
  const actualFields = Object.keys(data[0]);
  const missingFields = expectedFields.filter(
    field => !actualFields.includes(field)
  );
  const extraFields = actualFields.filter(
    field => !expectedFields.includes(field)
  );

  if (missingFields.length > 0) {
    errors.push(`缺少必需字段: ${missingFields.join(', ')}`);
  }

  if (extraFields.length > 0) {
    warnings.push(`多余字段: ${extraFields.join(', ')}`);
  }

  // 2. 检查数据完整性和合法性
  for (let i = 0; i < data.length; i++) {
    const row = data[i];
    const rowNum = i + 2; // 第一行是表头，所以从第 2 行开始

    // 2.1 检查必填字段是否为空
    for (const field of expectedFields) {
      const value = row[field];
      const isEmpty = value === null || value === undefined || String(value).trim() === '';
      
      if (isEmpty) {
        errors.push(`第 ${rowNum} 行: 字段 "${field}" 为空`);
        continue;
      }

      // 2.2 检查非法值（如 "N/A"、"无"、"-" 等占位符）
      const stringValue = String(value).trim();
      const invalidPatterns = ['N/A', 'n/a', '无', '-', 'null', 'undefined', 'na'];
      if (invalidPatterns.some(pattern => stringValue.toLowerCase() === pattern.toLowerCase())) {
        errors.push(`第 ${rowNum} 行: 字段 "${field}" 包含非法值 "${value}"`);
      }

      // 2.3 检查字符串长度限制（防止超长字符串导致数据库错误）
      if (typeof value === 'string' && value.length > 500) {
        warnings.push(`第 ${rowNum} 行: 字段 "${field}" 超长（${value.length} 字符），可能被截断`);
      }

      // 2.4 检查特殊字符（防止SQL注入或XSS）
      if (typeof value === 'string') {
        const dangerousPatterns = ['<script', 'javascript:', 'onerror=', 'onload='];
        if (dangerousPatterns.some(pattern => value.toLowerCase().includes(pattern))) {
          errors.push(`第 ${rowNum} 行: 字段 "${field}" 包含危险字符`);
        }
      }

      // 2.5 检查数字字段
      if (typeof value === 'number') {
        // 检查是否为 NaN
        if (isNaN(value)) {
          errors.push(`第 ${rowNum} 行: 字段 "${field}" 为 NaN（非数字）`);
        }
        // 检查是否为 Infinity
        if (!isFinite(value)) {
          errors.push(`第 ${rowNum} 行: 字段 "${field}" 为 Infinity（无穷大）`);
        }
      }

      // 2.6 检查是否为字符串类型的数字（如 "123"）
      if (typeof value === 'string' && !isNaN(Number(value)) && value.trim() !== '') {
        warnings.push(`第 ${rowNum} 行: 字段 "${field}" 为数字字符串 "${value}"，建议转换为数字类型`);
      }
    }
  }

  // 3. 检查重复行（基于所有字段）
  const seenRows = new Set<string>();
  for (let i = 0; i < data.length; i++) {
    const row = data[i];
    const rowKey = JSON.stringify(row);
    if (seenRows.has(rowKey)) {
      warnings.push(`第 ${i + 2} 行: 与前文重复`);
    } else {
      seenRows.add(rowKey);
    }
  }

  // 4. 检查主键重复（基于"原词"或"标准类型"字段）
  const keyField = expectedFields[0]; // 第一个字段通常是主键
  const seenKeys = new Set<string>();
  for (let i = 0; i < data.length; i++) {
    const row = data[i];
    const key = row[keyField];
    if (seenKeys.has(String(key))) {
      errors.push(`第 ${i + 2} 行: "${key}" 字段值重复`);
    } else {
      seenKeys.add(String(key));
    }
  }

  // 5. 数据量检查（防止一次性导入过多数据）
  if (data.length > 10000) {
    warnings.push(`数据量过大（${data.length} 条），建议分批导入（每批不超过 5000 条）`);
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    stats: {
      totalRows: data.length,
      emptyFields: errors.filter(e => e.includes('为空')).length,
      invalidValues: errors.filter(e => e.includes('非法值')).length,
      duplicateKeys: errors.filter(e => e.includes('重复')).length,
    }
  };
}

/**
 * 获取预期字段
 */
function getExpectedFields(category: string): string[] {
  switch (category) {
    case 'mood':
    case 'style':
    case 'instruments':
    case 'filmGenres':
    case 'sceneTypes':
    case 'moodExtended':
    case 'standardScenes':
      return ['原词', '标准词'];
    case 'filmTypes':
      return ['标准类型'];
    default:
      return [];
  }
}

/**
 * 获取当前映射表数据
 */
function getCurrentMappings(category: string): Record<string, string> {
  const { STANDARD_TERMS } = require('@/lib/standardTerms');

  switch (category) {
    case 'mood':
      return STANDARD_TERMS.mood.mapping;
    case 'style':
      return STANDARD_TERMS.style.mapping;
    case 'instruments':
      return STANDARD_TERMS.instruments.mapping;
    case 'filmGenres':
      return STANDARD_TERMS.filmGenres.mapping;
    case 'sceneTypes':
      return STANDARD_TERMS.sceneTypes.mapping;
    case 'moodExtended':
      return STANDARD_TERMS.moodExtended.mapping;
    case 'standardScenes':
      return {
        ...STANDARD_TERMS.standardScenes.core.mapping,
        ...STANDARD_TERMS.standardScenes.extended.mapping,
      };
    default:
      return {};
  }
}

/**
 * 检测重复数据
 */
function checkDuplicates(
  importedData: MappingRecord[],
  currentMappings: Record<string, string>,
  mode: string
): DuplicateCheckResult {
  const duplicates: DuplicateEntry[] = [];
  const newEntries: MappingRecord[] = [];

  // 基于"原词"或"标准类型"作为唯一键
  const keyField = importedData[0]?.hasOwnProperty('原词') ? '原词' : '标准类型';

  for (const row of importedData) {
    const key = row[keyField] as string;
    const currentValue = currentMappings[key];

    if (currentValue !== undefined) {
      // 重复数据
      duplicates.push({
        key,
        current: currentValue,
        incoming: keyField === '原词' ? (row['标准词'] as string) : key,
        row,
      });
    } else {
      // 新数据
      newEntries.push(row);
    }
  }

  return {
    total: importedData.length,
    duplicates: duplicates.length,
    newEntries: newEntries.length,
    duplicateList: duplicates,
    newEntryList: newEntries,
  };
}

/**
 * 生成导入预览
 */
function generateImportPreview(
  importedData: MappingRecord[],
  currentMappings: Record<string, string>,
  duplicateCheckResult: DuplicateCheckResult,
  mode: string
): ImportPreview {
  const { duplicates, newEntries, total } = duplicateCheckResult;

  let finalCount = 0;
  let description = '';

  if (mode === 'replace') {
    finalCount = total;
    description = `替换模式：将清空原表数据，导入 ${total} 条新记录`;
  } else {
    // append 模式
    finalCount = Object.keys(currentMappings).length + newEntries;
    description = `追加模式：保留现有 ${Object.keys(currentMappings).length} 条记录，新增 ${newEntries} 条记录`;
  }

  return {
    mode,
    totalRecords: total,
    currentRecords: Object.keys(currentMappings).length,
    newRecords: newEntries,
    duplicateRecords: duplicates,
    finalRecordCount: finalCount,
    description,
    sampleData: importedData.slice(0, 5), // 前 5 条作为示例
    allData: importedData, // 完整数据，用于实际导入
  };
}

/**
 * 类型定义
 */
interface MappingRecord {
  [key: string]: string | number;
}

interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  stats?: {
    totalRows: number;
    emptyFields: number;
    invalidValues: number;
    duplicateKeys: number;
  };
}

interface DuplicateEntry {
  key: string;
  current: string;
  incoming: string;
  row: MappingRecord;
}

interface DuplicateCheckResult {
  total: number;
  duplicates: number;
  newEntries: number;
  duplicateList: DuplicateEntry[];
  newEntryList: MappingRecord[];
}

interface ImportPreview {
  mode: string;
  totalRecords: number;
  currentRecords: number;
  newRecords: number;
  duplicateRecords: number;
  finalRecordCount: number;
  description: string;
  sampleData: MappingRecord[];
  allData: MappingRecord[]; // 完整数据，用于实际导入
}
