'use client';

import React, { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { AnalysisResult } from '@/lib/types';
import { generatePreviewTableData } from '@/lib/generateMergedTable';

interface TablePreviewProps {
  result: AnalysisResult;
  fileName: string;
  onClose: () => void;
}

export default function TablePreview({ result, fileName, onClose }: TablePreviewProps) {
  const [tableData, setTableData] = useState<string[][]>([]);

  // 生成表格数据
  useEffect(() => {
    const data = generatePreviewTableData(result);
    setTableData(data);
  }, [result]);

  // 下载Excel
  const downloadExcel = () => {
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(tableData);

    // 设置列宽
    ws['!cols'] = [
      { wch: 15 },
      { wch: 40 },
      { wch: 25 },
      { wch: 30 },
    ];

    XLSX.utils.book_append_sheet(wb, ws, '音乐分析报告');

    const timestamp = new Date().toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    }).replace(/[/:]/g, '-').replace(/\s/g, '_');

    const finalFileName = `${fileName}_${timestamp}.xlsx`;
    XLSX.writeFile(wb, finalFileName);
  };

  // 下载CSV
  const downloadCSV = () => {
    const ws = XLSX.utils.aoa_to_sheet(tableData);
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
      second: '2-digit'
    }).replace(/[/:]/g, '-').replace(/\s/g, '_');

    link.setAttribute('href', url);
    link.setAttribute('download', `${fileName}_${timestamp}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: 'rgba(0,0,0,0.8)' }}>
      <div className="bg-gray-900 rounded-2xl w-[95vw] h-[90vh] flex flex-col overflow-hidden border border-purple-500/30 shadow-2xl shadow-purple-500/20">
        {/* 标题栏 */}
        <div className="bg-gradient-to-r from-purple-600 to-pink-600 px-6 py-4 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <span className="text-2xl">📊</span>
            <div>
              <h2 className="text-xl font-bold text-white">音乐分析报告</h2>
              <p className="text-sm text-purple-100">{fileName}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/20 rounded-lg transition-colors"
            title="关闭"
          >
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* 表格内容 */}
        <div className="flex-1 overflow-auto p-6 bg-gray-900">
          <div className="bg-gray-800 rounded-xl overflow-hidden shadow-lg">
            <table className="w-full border-collapse">
              <tbody>
                {tableData.map((row, rowIndex) => {
                  // 判断是否为标题行或分类行
                  const isTitle = rowIndex === 0;
                  const isSection = row[0]?.startsWith('===');
                  const isSubSection = rowIndex > 0 && row[0] && !row[1] && !row[0].startsWith('===');
                  const isHeader = row[1] && !row[0] && row[1].length > 5;

                  return (
                    <tr
                      key={rowIndex}
                      className={
                        isTitle
                          ? 'bg-gradient-to-r from-purple-600 to-pink-600 border-b-2 border-purple-400'
                          : isSection
                          ? 'bg-purple-500/20 border-b border-purple-500/30'
                          : isHeader
                          ? 'bg-purple-500/10 border-b border-purple-500/20'
                          : 'border-b border-gray-700 hover:bg-gray-700/50'
                      }
                    >
                      {row.map((cell, cellIndex) => (
                        <td
                          key={cellIndex}
                          className={`px-4 py-3 text-left ${
                            isTitle
                              ? 'font-bold text-white text-lg'
                              : isSection
                              ? 'font-semibold text-purple-200'
                              : isHeader
                              ? 'font-medium text-purple-300'
                              : 'text-gray-300'
                          } ${cellIndex === 0 ? 'w-1/6' : cellIndex === 1 ? 'w-2/5' : ''}`}
                        >
                          {cell || ''}
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* 底部操作栏 */}
        <div className="bg-gray-800 px-6 py-4 border-t border-gray-700 flex items-center justify-between flex-shrink-0">
          <div className="text-sm text-gray-400">
            共 <span className="text-purple-400 font-medium">{tableData.length}</span> 行数据
          </div>
          <div className="flex gap-3">
            <button
              onClick={downloadCSV}
              className="flex items-center gap-2 px-6 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              下载CSV
            </button>
            <button
              onClick={downloadExcel}
              className="flex items-center gap-2 px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              下载Excel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
