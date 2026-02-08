import { NextRequest, NextResponse } from 'next/server';
import { STANDARD_TERMS } from '@/lib/standardTerms';
import * as XLSX from 'xlsx';
import * as XLSXStyle from 'xlsx-js-style';

/**
 * 导出映射表 API
 * 支持 Excel (.xlsx/.xls)、CSV、JSON 三种格式
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const category = searchParams.get('category'); // mood, style, instruments, filmGenres, sceneTypes, standardScenes
    const format = searchParams.get('format') || 'xlsx'; // xlsx, csv, json

    // 验证分类参数
    if (!category) {
      return NextResponse.json(
        { error: '缺少 category 参数' },
        { status: 400 }
      );
    }

    // 获取映射表数据
    const mappingData = getMappingData(category);
    if (!mappingData) {
      return NextResponse.json(
        { error: `不支持的分类: ${category}` },
        { status: 400 }
      );
    }

    // 根据格式导出
    if (format === 'json') {
      return exportAsJson(mappingData, category);
    } else if (format === 'csv') {
      return exportAsCsv(mappingData, category);
    } else if (format === 'xlsx') {
      return exportAsExcel(mappingData, category);
    } else {
      return NextResponse.json(
        { error: `不支持的格式: ${format}` },
        { status: 400 }
      );
    }
  } catch (error) {
    console.error('导出映射表失败:', error);
    return NextResponse.json(
      { error: '导出失败' },
      { status: 500 }
    );
  }
}

/**
 * 获取指定分类的映射表数据
 */
function getMappingData(category: string): MappingData | null {
  switch (category) {
    case 'mood':
      return {
        category: '情绪标签',
        data: Object.entries(STANDARD_TERMS.mood.mapping).map(([key, value]) => ({
          原词: key,
          标准词: value,
        })),
      };

    case 'style':
      return {
        category: '音乐风格',
        data: Object.entries(STANDARD_TERMS.style.mapping).map(([key, value]) => ({
          原词: key,
          标准词: value,
        })),
      };

    case 'instruments':
      return {
        category: '乐器名称',
        data: Object.entries(STANDARD_TERMS.instruments.mapping).map(([key, value]) => ({
          原词: key,
          标准词: value,
        })),
      };

    case 'filmGenres':
      return {
        category: '影视类型',
        data: Object.entries(STANDARD_TERMS.filmGenres.mapping).map(([key, value]) => ({
          原词: key,
          标准词: value,
        })),
      };

    case 'filmTypes':
      return {
        category: '影片类型（细分）',
        data: STANDARD_TERMS.filmTypes.getAllStandardTypes().map(type => ({
          标准类型: type,
        })),
      };

    case 'sceneTypes':
      return {
        category: '场景类型',
        data: Object.entries(STANDARD_TERMS.sceneTypes.mapping).map(([key, value]) => ({
          原词: key,
          标准词: value,
        })),
      };

    case 'standardScenes':
      // 合并 core 和 extended 的映射
      const coreMapping = STANDARD_TERMS.standardScenes.core.mapping;
      const extendedMapping = STANDARD_TERMS.standardScenes.extended.mapping;
      const allMapping = { ...coreMapping, ...extendedMapping };

      return {
        category: '标准场景词',
        data: Object.entries(allMapping).map(([key, value]) => ({
          原词: key,
          标准词: value,
        })),
      };

    case 'moodExtended':
      return {
        category: '扩展情绪词',
        data: Object.entries(STANDARD_TERMS.moodExtended.mapping).map(([key, value]) => ({
          原词: key,
          标准词: value,
        })),
      };

    default:
      return null;
  }
}

/**
 * 导出为 JSON 格式
 */
function exportAsJson(mappingData: MappingData, category: string): NextResponse {
  const filename = `${category}_mappings_${Date.now()}.json`;

  const jsonData = {
    category: mappingData.category,
    exportedAt: new Date().toISOString(),
    data: mappingData.data,
  };

  return NextResponse.json(jsonData, {
    headers: {
      'Content-Disposition': `attachment; filename="${encodeURIComponent(filename)}"`,
      'Content-Type': 'application/json',
    },
  });
}

/**
 * 导出为 CSV 格式
 */
function exportAsCsv(mappingData: MappingData, category: string): NextResponse {
  const filename = `${category}_mappings_${Date.now()}.csv`;

  if (mappingData.data.length === 0) {
    return NextResponse.json(
      { error: '映射表数据为空' },
      { status: 400 }
    );
  }

  // 获取表头
  const headers = Object.keys(mappingData.data[0]);

  // 生成 CSV 内容
  const csvRows = [headers.join(',')];

  for (const row of mappingData.data) {
    const values = headers.map(header => {
      const value = row[header] ?? '';
      // 处理包含逗号或引号的值
      const stringValue = String(value);
      if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
        return `"${stringValue.replace(/"/g, '""')}"`;
      }
      return stringValue;
    });
    csvRows.push(values.join(','));
  }

  const csvContent = csvRows.join('\n');
  const bom = '\uFEFF'; // 添加 BOM 以支持中文

  return new NextResponse(bom + csvContent, {
    headers: {
      'Content-Disposition': `attachment; filename="${encodeURIComponent(filename)}"`,
      'Content-Type': 'text/csv; charset=utf-8',
    },
  });
}

/**
 * 导出为 Excel 格式
 */
function exportAsExcel(mappingData: MappingData, category: string): NextResponse {
  const filename = `${category}_mappings_${Date.now()}.xlsx`;

  if (mappingData.data.length === 0) {
    return NextResponse.json(
      { error: '映射表数据为空' },
      { status: 400 }
    );
  }

  // 创建工作簿
  const workbook = XLSX.utils.book_new();

  // 创建工作表
  const worksheet = XLSX.utils.json_to_sheet(mappingData.data);

  // 设置列宽
  const colWidths = Object.keys(mappingData.data[0]).map(() => ({ wch: 30 }));
  worksheet['!cols'] = colWidths;

  // 添加工作表到工作簿
  XLSX.utils.book_append_sheet(workbook, worksheet, mappingData.category);

  // 生成 Excel 文件
  const excelBuffer = XLSXStyle.write(workbook, {
    bookType: 'xlsx',
    type: 'buffer',
  });

  return new NextResponse(excelBuffer, {
    headers: {
      'Content-Disposition': `attachment; filename="${encodeURIComponent(filename)}"`,
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    },
  });
}

/**
 * 映射数据接口
 */
interface MappingData {
  category: string;
  data: Record<string, string | number>[];
}
