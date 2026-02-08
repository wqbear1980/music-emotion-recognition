'use client';

import React, { useState } from 'react';
import { Download, Upload, FileText, FileSpreadsheet, AlertCircle, CheckCircle2, Info, X } from 'lucide-react';

/**
 * 映射表管理组件
 * 支持导出和导入映射表数据
 */
export function MappingTableManager() {
  const [exportCategory, setExportCategory] = useState<string>('mood');
  const [exportFormat, setExportFormat] = useState<string>('xlsx');
  const [isExporting, setIsExporting] = useState(false);

  const [importCategory, setImportCategory] = useState<string>('mood');
  const [importMode, setImportMode] = useState<string>('append');
  const [autoApprove, setAutoApprove] = useState<boolean>(true); // 新增：自动审核状态
  const [importFile, setImportFile] = useState<File | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [activeTab, setActiveTab] = useState<'export' | 'import'>('export');

  // 映射表分类列表
  const categories = [
    { value: 'mood', label: '情绪标签' },
    { value: 'style', label: '音乐风格' },
    { value: 'instruments', label: '乐器名称' },
    { value: 'filmGenres', label: '影视类型' },
    { value: 'filmTypes', label: '影片类型（细分）' },
    { value: 'sceneTypes', label: '场景类型' },
    { value: 'standardScenes', label: '标准场景词' },
    { value: 'moodExtended', label: '扩展情绪词' },
  ];

  // 导出格式列表
  const formats = [
    { value: 'xlsx', label: 'Excel (.xlsx)', icon: FileSpreadsheet },
    { value: 'csv', label: 'CSV (.csv)', icon: FileText },
    { value: 'json', label: 'JSON (.json)', icon: FileText },
  ];

  // 处理导出
  const handleExport = async () => {
    setIsExporting(true);
    try {
      const url = `/api/database/export-mappings?category=${exportCategory}&format=${exportFormat}`;
      const response = await fetch(url);

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || '导出失败');
      }

      const blob = await response.blob();
      const contentDisposition = response.headers.get('Content-Disposition');
      const filenameMatch = contentDisposition && contentDisposition.match(/filename="(.+)"/);
      const filename = filenameMatch ? filenameMatch[1] : `mappings.${exportFormat}`;

      // 创建下载链接
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(downloadUrl);
    } catch (error) {
      console.error('导出失败:', error);
      alert(error instanceof Error ? error.message : '导出失败');
    } finally {
      setIsExporting(false);
    }
  };

  // 处理导入文件选择
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImportFile(file);
      setImportResult(null);
      setShowPreview(false);
    }
  };

  // 处理导入预览
  const handleImportPreview = async () => {
    if (!importFile) {
      alert('请选择要导入的文件');
      return;
    }

    setIsImporting(true);
    try {
      const formData = new FormData();
      formData.append('file', importFile);
      formData.append('category', importCategory);
      formData.append('mode', importMode);

      const response = await fetch('/api/database/import-mappings', {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || '导入失败');
      }

      setImportResult(result);
      setShowPreview(true);
    } catch (error) {
      console.error('导入失败:', error);
      alert(error instanceof Error ? error.message : '导入失败');
    } finally {
      setIsImporting(false);
    }
  };

  // 处理确认导入
  const handleConfirmImport = async () => {
    if (!importResult) return;

    try {
      const response = await fetch('/api/database/confirm-import', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          category: importCategory,
          mode: importMode,
          data: importResult.preview.allData, // 使用完整数据而不是示例数据
          autoApprove: autoApprove, // 是否自动审核通过
        }),
      });

      const result = await response.json();

      if (!result.success) {
        alert(result.message || '导入失败');
      } else {
        // 导入成功
        const { fileUpdated, databaseUpdated, dbStats, reviewStatus } = result.dataSummary;
        const message = [
          '✅ 导入成功！',
          fileUpdated ? '📄 静态词库已更新' : '',
          databaseUpdated ? '🗄️ 动态词库已同步' : '',
          dbStats ? `📊 数据库统计：新增 ${dbStats.added} 条，更新 ${dbStats.updated} 条` : '',
          reviewStatus ? `📝 审核状态：${reviewStatus === 'approved' ? '已通过' : '待审核'}` : '',
        ].filter(Boolean).join('\n');

        alert(message);

        // 如果自动审核通过，需要刷新动态词库
        if (autoApprove && (window as any).refreshStandardVocabulary) {
          try {
            await (window as any).refreshStandardVocabulary();
            console.log('[映射表管理] 已刷新动态词库');
          } catch (error) {
            console.error('[映射表管理] 刷新动态词库失败:', error);
          }
        }

        setShowPreview(false);
        setImportFile(null);
        setImportResult(null);
      }
    } catch (error) {
      console.error('确认导入失败:', error);
      alert(error instanceof Error ? error.message : '确认导入失败');
    }
  };

  // 取消导入
  const handleCancelImport = () => {
    setShowPreview(false);
    setImportFile(null);
    setImportResult(null);
  };

  return (
    <div className="space-y-6">
      {/* Tab 切换 */}
      <div className="flex gap-2 border-b border-white/10 pb-2">
        <button
          onClick={() => setActiveTab('export')}
          className={`px-4 py-2 rounded-lg transition-colors ${
            activeTab === 'export'
              ? 'bg-blue-600 text-white'
              : 'text-gray-300 hover:bg-white/10'
          }`}
        >
          导出映射表
        </button>
        <button
          onClick={() => setActiveTab('import')}
          className={`px-4 py-2 rounded-lg transition-colors ${
            activeTab === 'import'
              ? 'bg-green-600 text-white'
              : 'text-gray-300 hover:bg-white/10'
          }`}
        >
          导入映射表
        </button>
      </div>

      {/* 导出选项卡 */}
      {activeTab === 'export' && (
        <div className="bg-white/5 backdrop-blur-sm rounded-2xl p-6 border border-white/10 space-y-4">
          <div className="flex items-center gap-2 mb-4">
            <Download className="h-5 w-5 text-blue-400" />
            <h3 className="text-lg font-semibold text-white">导出映射表</h3>
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-300">选择映射表</label>
            <select
              value={exportCategory}
              onChange={(e) => setExportCategory(e.target.value)}
              className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {categories.map((cat) => (
                <option key={cat.value} value={cat.value} className="bg-gray-900">
                  {cat.label}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-300">导出格式</label>
            <select
              value={exportFormat}
              onChange={(e) => setExportFormat(e.target.value)}
              className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {formats.map((fmt) => (
                <option key={fmt.value} value={fmt.value} className="bg-gray-900">
                  {fmt.label}
                </option>
              ))}
            </select>
          </div>

          <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
            <div className="flex gap-2">
              <Info className="h-4 w-4 text-blue-400 mt-0.5 flex-shrink-0" />
              <p className="text-sm text-blue-200">
                <strong className="text-blue-300">Excel 格式推荐：</strong>
                最适合人工编辑，支持单元格格式和批注。Excel 会自动生成表头，第一行为字段名。
              </p>
            </div>
          </div>

          <button
            onClick={handleExport}
            disabled={isExporting}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-4 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isExporting ? (
              '导出中...'
            ) : (
              <>
                <Download className="h-4 w-4" />
                导出映射表
              </>
            )}
          </button>
        </div>
      )}

      {/* 导入选项卡 */}
      {activeTab === 'import' && (
        <div className="bg-white/5 backdrop-blur-sm rounded-2xl p-6 border border-white/10 space-y-4">
          <div className="flex items-center gap-2 mb-4">
            <Upload className="h-5 w-5 text-green-400" />
            <h3 className="text-lg font-semibold text-white">导入映射表</h3>
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-300">选择映射表</label>
            <select
              value={importCategory}
              onChange={(e) => setImportCategory(e.target.value)}
              className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-green-500"
            >
              {categories.map((cat) => (
                <option key={cat.value} value={cat.value} className="bg-gray-900">
                  {cat.label}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-300">导入模式</label>
            <div className="space-y-2">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="radio"
                  name="importMode"
                  value="append"
                  checked={importMode === 'append'}
                  onChange={(e) => setImportMode(e.target.value)}
                  className="w-4 h-4 text-green-600 focus:ring-green-500"
                />
                <span className="text-sm text-gray-300">
                  <strong className="text-white">追加模式：</strong>保留现有数据，新增导入的数据
                </span>
              </label>
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="radio"
                  name="importMode"
                  value="replace"
                  checked={importMode === 'replace'}
                  onChange={(e) => setImportMode(e.target.value)}
                  className="w-4 h-4 text-green-600 focus:ring-green-500"
                />
                <span className="text-sm text-gray-300">
                  <strong className="text-white">替换模式：</strong>清空原表数据，全量导入新数据
                </span>
              </label>
            </div>
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-300">审核状态</label>
            <div className="bg-white/5 border border-white/20 rounded-lg p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-green-400" />
                    <span className="text-sm font-medium text-white">自动审核通过</span>
                  </div>
                  <p className="text-xs text-gray-400 mt-1">
                    导入的词汇直接标记为"已通过"，无需人工审核，立即在分析时生效
                  </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={autoApprove}
                    onChange={(e) => setAutoApprove(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-600 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-green-500 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-600"></div>
                </label>
              </div>

              {!autoApprove && (
                <div className="flex items-start gap-2 pt-2 border-t border-white/10">
                  <AlertCircle className="h-4 w-4 text-yellow-400 mt-0.5 flex-shrink-0" />
                  <div className="text-xs text-yellow-200">
                    <p><strong>待审核模式：</strong>导入的词汇进入审核队列，需要在"词库管理"中人工审核通过后才会生效。</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-300">选择文件</label>
            <input
              type="file"
              accept=".xlsx,.xls,.csv,.json"
              onChange={handleFileSelect}
              className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-2 text-white file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-white/20 file:text-white hover:file:bg-white/30"
            />
            {importFile && (
              <p className="text-sm text-gray-400 mt-1">
                已选择: {importFile.name} ({(importFile.size / 1024).toFixed(2)} KB)
              </p>
            )}
          </div>

          <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4">
            <div className="flex gap-2 mb-2">
              <Info className="h-4 w-4 text-green-400 mt-0.5 flex-shrink-0" />
              <p className="text-sm text-green-200 font-medium">
                Excel 导入规则
              </p>
            </div>
            <ul className="text-xs text-green-200 space-y-1 ml-6 list-disc">
              <li>第一行自动识别为表头，从第二行开始读取数据</li>
              <li>空行自动跳过。如果文件有多个 Sheet，默认读取第一个</li>
            </ul>
            <div className="mt-3 pt-3 border-t border-green-500/20">
              <p className="text-xs text-green-300">
                <strong className="text-green-200">双词库同步机制：</strong>
              </p>
              <ul className="text-xs text-green-200 space-y-1 ml-4 mt-1">
                <li>📄 更新静态词库文件（离线分析使用）</li>
                <li>🗄️ 同步到数据库动态词库（在线分析使用）</li>
                <li>{autoApprove ? '✅ 自动审核通过，立即生效' : '⏳ 进入审核队列，需人工审核'}</li>
              </ul>
            </div>
          </div>

          <button
            onClick={handleImportPreview}
            disabled={!importFile || isImporting}
            className="w-full bg-green-600 hover:bg-green-700 text-white font-medium py-3 px-4 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isImporting ? (
              '解析中...'
            ) : (
              <>
                <Upload className="h-4 w-4" />
                预览导入
              </>
            )}
          </button>
        </div>
      )}

      {/* 导入预览对话框 */}
      {showPreview && importResult && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto border border-white/10 shadow-2xl">
            <div className="sticky top-0 bg-gray-900 border-b border-white/10 p-6 z-10 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-white">导入预览</h2>
                <p className="text-sm text-gray-400 mt-1">{importResult.preview.description}</p>
              </div>
              <button
                onClick={() => setShowPreview(false)}
                className="text-gray-400 hover:text-white transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {/* 校验结果 */}
              {importResult.validation.errors.length > 0 ? (
                <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
                  <div className="flex gap-2">
                    <AlertCircle className="h-5 w-5 text-red-400 mt-0.5 flex-shrink-0" />
                    <div>
                      <h4 className="font-semibold text-red-400 mb-2">数据校验失败</h4>
                      <ul className="list-disc list-inside space-y-1 text-sm text-red-200">
                        {importResult.validation.errors.slice(0, 5).map((error, idx) => (
                          <li key={idx}>{error}</li>
                        ))}
                        {importResult.validation.errors.length > 5 && (
                          <li>...还有 {importResult.validation.errors.length - 5} 条错误</li>
                        )}
                      </ul>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4">
                  <div className="flex gap-2">
                    <CheckCircle2 className="h-5 w-5 text-green-400 mt-0.5 flex-shrink-0" />
                    <div>
                      <h4 className="font-semibold text-green-400 mb-1">数据校验通过</h4>
                      <p className="text-sm text-green-200">文件格式正确，字段完整性检查通过</p>
                    </div>
                  </div>
                </div>
              )}

              {/* 重复数据检测 */}
              {importResult.duplicates.duplicates > 0 && (
                <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4">
                  <div className="flex gap-2">
                    <AlertCircle className="h-5 w-5 text-yellow-400 mt-0.5 flex-shrink-0" />
                    <div>
                      <h4 className="font-semibold text-yellow-400 mb-1">发现重复数据</h4>
                      <p className="text-sm text-yellow-200">
                        共发现 {importResult.duplicates.duplicates} 条重复记录，{importResult.duplicates.newEntries} 条新记录
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* 统计信息 */}
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                <div className="bg-white/5 rounded-lg p-3 text-center">
                  <div className="text-2xl font-bold text-white">{importResult.preview.totalRecords}</div>
                  <div className="text-sm text-gray-400">文件记录数</div>
                </div>
                <div className="bg-white/5 rounded-lg p-3 text-center">
                  <div className="text-2xl font-bold text-white">{importResult.preview.currentRecords}</div>
                  <div className="text-sm text-gray-400">当前记录数</div>
                </div>
                <div className="bg-white/5 rounded-lg p-3 text-center">
                  <div className="text-2xl font-bold text-green-400">{importResult.preview.newRecords}</div>
                  <div className="text-sm text-gray-400">新增记录数</div>
                </div>
                <div className="bg-white/5 rounded-lg p-3 text-center">
                  <div className="text-2xl font-bold text-yellow-400">{importResult.preview.duplicateRecords}</div>
                  <div className="text-sm text-gray-400">重复记录数</div>
                </div>
                <div className="bg-white/5 rounded-lg p-3 text-center">
                  <div className="text-2xl font-bold text-blue-400">{importResult.preview.finalRecordCount}</div>
                  <div className="text-sm text-gray-400">导入后总数</div>
                </div>
              </div>

              {/* 示例数据 */}
              {importResult.preview.sampleData.length > 0 && (
                <div>
                  <h4 className="font-semibold text-white mb-3">示例数据（前 5 条）</h4>
                  <div className="border border-white/10 rounded-lg overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-white/10">
                        <tr>
                          {Object.keys(importResult.preview.sampleData[0]).map((key) => (
                            <th key={key} className="px-4 py-2 text-left font-medium text-white">
                              {key}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/10">
                        {importResult.preview.sampleData.map((row: any, idx: number) => (
                          <tr key={idx} className="bg-white/5 hover:bg-white/10">
                            {Object.values(row).map((value: any, cellIdx) => (
                              <td key={cellIdx} className="px-4 py-2 text-gray-300">
                                {String(value)}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* 操作按钮 */}
              <div className="flex gap-3 pt-4 border-t border-white/10">
                <button
                  onClick={handleCancelImport}
                  className="flex-1 bg-gray-700 hover:bg-gray-600 text-white font-medium py-3 px-4 rounded-lg transition-colors"
                >
                  取消
                </button>
                <button
                  onClick={handleConfirmImport}
                  disabled={!importResult.validation.valid}
                  className="flex-1 bg-green-600 hover:bg-green-700 text-white font-medium py-3 px-4 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  确认导入
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * 导入结果类型
 */
interface ImportResult {
  success: boolean;
  preview: {
    mode: string;
    totalRecords: number;
    currentRecords: number;
    newRecords: number;
    duplicateRecords: number;
    finalRecordCount: number;
    description: string;
    sampleData: any[];
    allData: any[]; // 完整数据，用于实际导入
  };
  validation: {
    valid: boolean;
    errors: string[];
  };
  duplicates: {
    total: number;
    duplicates: number;
    newEntries: number;
    duplicateList: any[];
    newEntryList: any[];
  };
  message: string;
}
