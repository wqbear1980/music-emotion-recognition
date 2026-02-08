'use client';

import React from 'react';
import { MappingTableManager } from '@/components/MappingTableManager';
import { BatchDownloadManager } from '@/components/BatchDownloadManager';
import { Database, FileText, Shield, Settings, Download } from 'lucide-react';

/**
 * 数据库管理页面
 * 包含映射表导入导出功能和批量打包下载功能
 */
export default function DatabaseManagementPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900">
      <div className="container mx-auto py-8 px-4">
        {/* 页面标题 */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <Database className="h-8 w-8 text-blue-600" />
            <h1 className="text-3xl font-bold tracking-tight">数据库管理</h1>
          </div>
          <p className="text-slate-600 dark:text-slate-400">
            管理系统映射表数据和音乐文件批量下载
          </p>
        </div>

        {/* 功能说明卡片 */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <div className="bg-white/5 backdrop-blur-sm rounded-2xl p-6 border border-white/10">
            <div className="flex items-center gap-2 mb-3">
              <FileText className="h-5 w-5 text-blue-400" />
              <h3 className="text-base font-semibold text-white">映射表导出</h3>
            </div>
            <p className="text-sm text-gray-400">
              将映射表数据导出为 Excel、CSV 或 JSON 格式，便于人工编辑、备份或迁移
            </p>
          </div>

          <div className="bg-white/5 backdrop-blur-sm rounded-2xl p-6 border border-white/10">
            <div className="flex items-center gap-2 mb-3">
              <Shield className="h-5 w-5 text-green-400" />
              <h3 className="text-base font-semibold text-white">映射表导入</h3>
            </div>
            <p className="text-sm text-gray-400">
              从编辑后的文件导入映射表数据，支持追加和替换模式，自动校验数据格式
            </p>
          </div>

          <div className="bg-white/5 backdrop-blur-sm rounded-2xl p-6 border border-white/10">
            <div className="flex items-center gap-2 mb-3">
              <Download className="h-5 w-5 text-purple-400" />
              <h3 className="text-base font-semibold text-white">批量打包下载</h3>
            </div>
            <p className="text-sm text-gray-400">
              批量打包下载"在线"和"云端"状态的音乐文件，自动过滤未在线文件
            </p>
          </div>
        </div>

        {/* 映射表管理组件 */}
        <div className="bg-white/5 backdrop-blur-sm rounded-2xl p-6 border border-white/10 mb-6">
          <div className="mb-6">
            <h2 className="text-xl font-bold text-white">映射表导入导出</h2>
            <p className="text-sm text-gray-400 mt-1">
              选择映射表类型，执行导出或导入操作。支持 8 种映射表类型：
              情绪标签、音乐风格、乐器名称、影视类型、影片类型、场景类型、标准场景词、扩展情绪词
            </p>
          </div>
          <MappingTableManager />
        </div>

        {/* 批量打包下载组件 */}
        <div className="bg-white/5 backdrop-blur-sm rounded-2xl p-6 border border-white/10 mb-6">
          <div className="mb-6">
            <h2 className="text-xl font-bold text-white">音乐文件批量打包下载</h2>
            <p className="text-sm text-gray-400 mt-1">
              选择要下载的文件状态，系统会自动打包下载符合条件的音乐文件。只下载"在线"和"云端"状态的文件，忽略未在线文件。
            </p>
          </div>
          <BatchDownloadManager />
        </div>

        {/* 使用说明 */}
        <div className="bg-white/5 backdrop-blur-sm rounded-2xl p-6 border border-white/10 mt-6">
          <h2 className="text-lg font-bold text-white mb-4">使用说明</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">
            <div className="space-y-4">
              <div>
                <h4 className="font-semibold text-white mb-2 flex items-center gap-2">
                  <FileText className="h-4 w-4 text-blue-400" />
                  映射表导出操作
                </h4>
                <ul className="list-disc list-inside space-y-1 text-gray-400 ml-6">
                  <li>选择要导出的映射表类型（如情绪标签、音乐风格等）</li>
                  <li>选择导出格式：Excel（推荐）、CSV、JSON</li>
                  <li>点击导出按钮，系统会自动生成并下载文件</li>
                  <li>Excel 格式包含完整的表头和数据，可直接编辑</li>
                </ul>
              </div>

              <div>
                <h4 className="font-semibold text-white mb-2 flex items-center gap-2">
                  <Shield className="h-4 w-4 text-green-400" />
                  映射表导入规则
                </h4>
                <ul className="list-disc list-inside space-y-1 text-gray-400 ml-6">
                  <li><strong>Excel 文件：</strong>第一行自动识别为表头，从第二行开始读取数据</li>
                  <li><strong>字段校验：</strong>自动检查表头/列名/键名与数据库字段的一致性</li>
                  <li><strong>重复检测：</strong>基于"原词"或"标准类型"作为唯一键进行重复检测</li>
                  <li><strong>追加模式：</strong>保留现有数据，新增不重复的导入数据</li>
                  <li><strong>替换模式：</strong>清空原表数据后全量导入（谨慎使用）</li>
                </ul>
              </div>

              <div>
                <h4 className="font-semibold text-white mb-2 flex items-center gap-2">
                  <Download className="h-4 w-4 text-purple-400" />
                  批量打包下载操作
                </h4>
                <ul className="list-disc list-inside space-y-1 text-gray-400 ml-6">
                  <li>选择要下载的文件状态：仅在线、仅云端、或全部</li>
                  <li><strong>仅在线：</strong>下载所有 isOnline = true 的文件</li>
                  <li><strong>仅云端：</strong>下载所有 isUploaded = true 的文件</li>
                  <li><strong>全部：</strong>下载所有在线或云端的文件</li>
                  <li>系统自动过滤掉未在线的文件，不进行打包</li>
                  <li>文件会打包成 ZIP 格式，文件名包含下载日期</li>
                </ul>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <h4 className="font-semibold text-white mb-2 flex items-center gap-2">
                  <FileText className="h-4 w-4 text-green-400" />
                  映射表导入操作
                </h4>
                <ul className="list-disc list-inside space-y-1 text-gray-400 ml-6">
                  <li>选择映射表类型和导入模式（追加/替换）</li>
                  <li>上传编辑后的文件（支持 .xlsx/.xls/.csv/.json）</li>
                  <li>点击"预览导入"查看数据校验结果</li>
                  <li>确认无误后点击"确认导入"完成数据更新</li>
                </ul>
              </div>

              <div>
                <h4 className="font-semibold text-white mb-2 flex items-center gap-2">
                  <Settings className="h-4 w-4 text-purple-400" />
                  注意事项
                </h4>
                <ul className="list-disc list-inside space-y-1 text-gray-400 ml-6">
                  <li>建议先导出当前数据作为备份</li>
                  <li>导入前请仔细检查文件格式和数据内容</li>
                  <li>如遇到字段不匹配错误，请确保文件表头与导出时的格式一致</li>
                  <li>重复数据可在预览界面查看详细信息</li>
                  <li>出于安全考虑，最终导入操作需要手动更新代码文件</li>
                  <li>批量下载功能仅支持下载已上传至对象存储的文件</li>
                  <li>大量文件打包下载可能需要较长时间，请耐心等待</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
