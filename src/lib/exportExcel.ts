import * as XLSX from 'xlsx-js-style';
import { AnalysisResult, AudioFileItem } from '@/lib/types';
import { generateMergedTableData } from './generateMergedTable';

// 导出分析结果到Excel（带样式）
export function exportAnalysisToExcel(result: AnalysisResult, fileName: string = '音乐分析结果') {
  // 创建工作簿
  const wb = XLSX.utils.book_new();

  // 生成带样式的表格数据
  const mergedData = generateMergedTableData(result);

  // 创建工作表（保留样式）
  const ws = XLSX.utils.aoa_to_sheet(mergedData);

  // 设置列宽
  ws['!cols'] = [
    { wch: 18 },  // 第一列宽度 - 标签列
    { wch: 45 },  // 第二列宽度 - 内容列
    { wch: 20 },  // 第三列宽度 - 备注列
    { wch: 35 },  // 第四列宽度 - 详情列
  ];

  // 设置行高（为带样式的行设置更高行高）
  if (!ws['!rows']) ws['!rows'] = [];
  const rowsCount = mergedData.length;
  for (let i = 0; i < rowsCount; i++) {
    // 分类标题行和表头行行高稍大
    const firstCell = mergedData[i][0];
    const cellValue = firstCell && typeof firstCell === 'object' && 'v' in firstCell ? firstCell.v : '';
    const isStringValue = typeof cellValue === 'string';

    if (
      isStringValue &&
      (cellValue.startsWith('===') ||
       cellValue.startsWith('📊') ||
       cellValue.startsWith('🎵') ||
       cellValue.startsWith('🎸') ||
       cellValue.startsWith('📝') ||
       cellValue.startsWith('🎼') ||
       cellValue.startsWith('🥁') ||
       cellValue.startsWith('🎬') ||
       cellValue.startsWith('💿') ||
       cellValue.startsWith('🌍'))
    ) {
      ws['!rows'][i] = { hpt: 28, hpx: 28 };
    }
    // 数据行
    else {
      ws['!rows'][i] = { hpt: 22, hpx: 22 };
    }
  }

  // 设置标题行合并
  ws['!merges'] = [
    // 合并主标题
    { s: { r: 0, c: 0 }, e: { r: 0, c: 3 } },
    // 合并分析时间
    { s: { r: 1, c: 1 }, e: { r: 1, c: 3 } },
  ];

  // 合并分类标题
  const categoryRows = mergedData
    .map((row, idx) => ({ row, idx }))
    .filter(({ row }) => {
      const firstCell = row[0];
      return (
        firstCell &&
        'v' in firstCell &&
        typeof firstCell.v === 'string' &&
        firstCell.v.match(/^(📊|🎵|🎸|📝|🎼|🥁|🎬|💿|🌍)/)
      );
    });

  categoryRows.forEach(({ idx }) => {
    ws['!merges']?.push({ s: { r: idx, c: 0 }, e: { r: idx, c: 3 } });
  });

  // 添加工作表
  XLSX.utils.book_append_sheet(wb, ws, '音乐分析报告');

  // 生成文件名（包含时间戳）
  const timestamp = new Date().toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
    .replace(/[/:]/g, '-')
    .replace(/\s/g, '_');

  const finalFileName = `${fileName}_${timestamp}.xlsx`;

  // 导出文件
  XLSX.writeFile(wb, finalFileName);
}

// 导出为CSV（使用纯文本数据，不带样式）
export function exportAnalysisToCSV(result: AnalysisResult, fileName: string = '音乐分析结果') {
  const mergedData = generateMergedTableData(result);

  // 转换为纯文本数据（移除样式）
  const plainData = mergedData.map(row =>
    row.map(cell => {
      if (typeof cell === 'object' && 'v' in cell) {
        return String(cell.v);
      }
      return String(cell);
    })
  );

  const ws = XLSX.utils.aoa_to_sheet(plainData);
  const csv = XLSX.utils.sheet_to_csv(ws);

  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);

  const timestamp = new Date().toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
    .replace(/[/:]/g, '-')
    .replace(/\s/g, '_');

  link.setAttribute('href', url);
  link.setAttribute('download', `${fileName}_${timestamp}.csv`);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * 批量导出分析结果到Excel（带样式）
 * 每首音乐的分析数据之间插入空行进行分隔
 */
export function exportBatchToExcel(audioFiles: AudioFileItem[], fileName: string = '批量音乐分析结果') {
  // 创建工作簿
  const wb = XLSX.utils.book_new();

  // 收集所有已分析的文件
  const analyzedFiles = audioFiles.filter(f => f.result !== null);

  if (analyzedFiles.length === 0) {
    alert('没有已分析的音乐文件，请先完成分析');
    return;
  }

  // 生成合并后的表格数据，每首音乐之间插入空行
  const allData: any[] = [];

  analyzedFiles.forEach((file, index) => {
    // 生成当前文件的表格数据
    const fileData = generateMergedTableData(file.result!);

    // 添加文件标识行（只在每个文件的第一行添加）
    const fileHeader: any[] = [
      { v: `📁 文件 ${index + 1}/${analyzedFiles.length}: ${file.file.name}`, t: 's', s: { font: { bold: true, color: { rgb: 'FFFFFF' } }, fill: { fgColor: { rgb: '4F46E5' } } } },
      { v: '', t: 's', s: { fill: { fgColor: { rgb: '4F46E5' } } } },
      { v: '', t: 's', s: { fill: { fgColor: { rgb: '4F46E5' } } } },
      { v: '', t: 's', s: { fill: { fgColor: { rgb: '4F46E5' } } } },
    ];
    allData.push(fileHeader);

    // 添加当前文件的数据
    allData.push(...fileData);

    // 在每首音乐之间插入空行（除了最后一首）
    if (index < analyzedFiles.length - 1) {
      const emptyRow: any[] = [
        { v: '', t: 's' },
        { v: '', t: 's' },
        { v: '', t: 's' },
        { v: '', t: 's' },
      ];
      allData.push(emptyRow);
      allData.push(emptyRow); // 插入两行空行，使分隔更明显
    }
  });

  // 创建工作表（保留样式）
  const ws = XLSX.utils.aoa_to_sheet(allData);

  // 设置列宽
  ws['!cols'] = [
    { wch: 20 },  // 第一列宽度 - 标签列
    { wch: 45 },  // 第二列宽度 - 内容列
    { wch: 20 },  // 第三列宽度 - 备注列
    { wch: 35 },  // 第四列宽度 - 详情列
  ];

  // 设置行高
  if (!ws['!rows']) ws['!rows'] = [];
  const rowsCount = allData.length;
  for (let i = 0; i < rowsCount; i++) {
    const firstCell = allData[i][0];
    const cellValue = firstCell && typeof firstCell === 'object' && 'v' in firstCell ? firstCell.v : '';
    const isStringValue = typeof cellValue === 'string';

    // 文件标题行和分类标题行行高更大
    if (
      isStringValue &&
      (cellValue.startsWith('📁') ||
       cellValue.startsWith('===') ||
       cellValue.startsWith('📊') ||
       cellValue.startsWith('🎵') ||
       cellValue.startsWith('🎸') ||
       cellValue.startsWith('📝') ||
       cellValue.startsWith('🎼') ||
       cellValue.startsWith('🥁') ||
       cellValue.startsWith('🎬') ||
       cellValue.startsWith('💿') ||
       cellValue.startsWith('🌍'))
    ) {
      ws['!rows'][i] = { hpt: 28, hpx: 28 };
    }
    // 数据行
    else {
      ws['!rows'][i] = { hpt: 22, hpx: 22 };
    }
  }

  // 合并文件标题行
  const fileHeaderIndices = allData
    .map((row, idx) => ({ row, idx }))
    .filter(({ row }) => {
      const firstCell = row[0];
      return (
        firstCell &&
        'v' in firstCell &&
        typeof firstCell.v === 'string' &&
        firstCell.v.startsWith('📁')
      );
    });

  if (!ws['!merges']) ws['!merges'] = [];
  fileHeaderIndices.forEach(({ idx }) => {
    ws['!merges']?.push({ s: { r: idx, c: 0 }, e: { r: idx, c: 3 } });
  });

  // 合并分类标题
  const categoryRows = allData
    .map((row, idx) => ({ row, idx }))
    .filter(({ row }) => {
      const firstCell = row[0];
      return (
        firstCell &&
        'v' in firstCell &&
        typeof firstCell.v === 'string' &&
        firstCell.v.match(/^(📊|🎵|🎸|📝|🎼|🥁|🎬|💿|🌍)/)
      );
    });

  categoryRows.forEach(({ idx }) => {
    ws['!merges']?.push({ s: { r: idx, c: 0 }, e: { r: idx, c: 3 } });
  });

  // 添加工作表
  XLSX.utils.book_append_sheet(wb, ws, '批量音乐分析报告');

  // 生成文件名（包含时间戳）
  const timestamp = new Date().toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
    .replace(/[/:]/g, '-')
    .replace(/\s/g, '_');

  const finalFileName = `${fileName}_${timestamp}_${analyzedFiles.length}首.xlsx`;

  // 导出文件
  XLSX.writeFile(wb, finalFileName);
}

/**
 * 批量导出分析结果到CSV（纯文本）
 * 每首音乐的分析数据之间插入空行进行分隔
 */
export function exportBatchToCSV(audioFiles: AudioFileItem[], fileName: string = '批量音乐分析结果') {
  // 收集所有已分析的文件
  const analyzedFiles = audioFiles.filter(f => f.result !== null);

  if (analyzedFiles.length === 0) {
    alert('没有已分析的音乐文件，请先完成分析');
    return;
  }

  // 生成合并后的表格数据，每首音乐之间插入空行
  const allData: string[][] = [];

  analyzedFiles.forEach((file, index) => {
    // 添加文件标识行
    allData.push([`📁 文件 ${index + 1}/${analyzedFiles.length}: ${file.file.name}`, '', '', '']);

    // 生成当前文件的表格数据
    const fileData = generateMergedTableData(file.result!);

    // 转换为纯文本数据（移除样式）
    const plainData = fileData.map(row =>
      row.map(cell => {
        if (typeof cell === 'object' && 'v' in cell) {
          return String(cell.v);
        }
        return String(cell);
      })
    );

    // 添加当前文件的数据
    allData.push(...plainData);

    // 在每首音乐之间插入空行（除了最后一首）
    if (index < analyzedFiles.length - 1) {
      allData.push(['', '', '', '']);
      allData.push(['', '', '', '']); // 插入两行空行，使分隔更明显
    }
  });

  // 创建工作表
  const ws = XLSX.utils.aoa_to_sheet(allData);
  const csv = XLSX.utils.sheet_to_csv(ws);

  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);

  const timestamp = new Date().toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
    .replace(/[/:]/g, '-')
    .replace(/\s/g, '_');

  link.setAttribute('href', url);
  link.setAttribute('download', `${fileName}_${timestamp}_${analyzedFiles.length}首.csv`);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
