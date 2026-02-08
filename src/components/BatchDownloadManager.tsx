'use client';

import React, { useState } from 'react';
import { Download, Package, Cloud, Wifi, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';

/**
 * 批量打包下载管理组件
 * 支持批量下载"在线"和"云端"状态的音乐文件
 */
export function BatchDownloadManager() {
  const [statusFilter, setStatusFilter] = useState<'online' | 'cloud' | 'all'>('all');
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadStatus, setDownloadStatus] = useState<'idle' | 'preparing' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // 下载选项
  const downloadOptions = [
    {
      value: 'online' as const,
      label: '仅在线',
      description: '下载所有在线状态的文件（isOnline = true）',
      icon: Wifi,
      color: 'text-blue-400',
      bgColor: 'bg-blue-500/10',
      borderColor: 'border-blue-500/30',
    },
    {
      value: 'cloud' as const,
      label: '仅云端',
      description: '下载所有已上传至云端的文件（isUploaded = true）',
      icon: Cloud,
      color: 'text-green-400',
      bgColor: 'bg-green-500/10',
      borderColor: 'border-green-500/30',
    },
    {
      value: 'all' as const,
      label: '全部',
      description: '下载所有在线或云端的文件',
      icon: Package,
      color: 'text-purple-400',
      bgColor: 'bg-purple-500/10',
      borderColor: 'border-purple-500/30',
    },
  ];

  // 处理批量下载
  const handleBatchDownload = async () => {
    setIsDownloading(true);
    setDownloadStatus('preparing');
    setErrorMessage(null);

    try {
      // 直接执行下载，后端自动过滤未在线文件
      const response = await fetch('/api/batch-download', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          statusFilter,
          packBy: 'none', // 不按分类，直接打包
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || '批量打包下载失败');
      }

      // 获取文件名
      const contentDisposition = response.headers.get('Content-Disposition');
      const filenameMatch = contentDisposition && contentDisposition.match(/filename="(.+)"/);
      const filename = filenameMatch ? decodeURIComponent(filenameMatch[1]) : 'music_files.zip';

      // 创建下载链接
      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(downloadUrl);

      setDownloadStatus('success');
    } catch (error) {
      console.error('批量打包下载失败:', error);
      setDownloadStatus('error');
      setErrorMessage(error instanceof Error ? error.message : '批量打包下载失败');
    } finally {
      setIsDownloading(false);
      // 3秒后重置状态
      setTimeout(() => {
        setDownloadStatus('idle');
      }, 3000);
    }
  };

  return (
    <div className="space-y-6">
      {/* 下载选项 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {downloadOptions.map((option) => {
          const Icon = option.icon;
          const isSelected = statusFilter === option.value;
          return (
            <button
              key={option.value}
              onClick={() => !isDownloading && setStatusFilter(option.value)}
              disabled={isDownloading}
              className={`relative rounded-xl p-6 border-2 transition-all ${
                isSelected
                  ? `${option.bgColor} ${option.borderColor} border-2`
                  : 'bg-white/5 border-white/10 hover:border-white/20'
              } ${isDownloading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
            >
              <div className="flex flex-col items-center text-center space-y-3">
                <div className={`p-3 rounded-lg ${isSelected ? option.bgColor : 'bg-white/10'}`}>
                  <Icon className={`h-6 w-6 ${isSelected ? option.color : 'text-gray-400'}`} />
                </div>
                <div>
                  <h4 className={`font-semibold ${isSelected ? 'text-white' : 'text-gray-300'}`}>
                    {option.label}
                  </h4>
                  <p className="text-xs text-gray-400 mt-1">{option.description}</p>
                </div>
                {isSelected && (
                  <div className={`absolute top-3 right-3 h-3 w-3 rounded-full ${option.color.replace('text-', 'bg-')}`} />
                )}
              </div>
            </button>
          );
        })}
      </div>

      {/* 状态提示 */}
      {downloadStatus === 'preparing' && (
        <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
          <div className="flex gap-3 items-center">
            <Loader2 className="h-5 w-5 text-blue-400 animate-spin" />
            <div>
              <h4 className="font-semibold text-blue-400 mb-1">正在准备打包下载</h4>
              <p className="text-sm text-blue-200">
                系统正在查询和打包文件，请稍候...大量文件可能需要较长时间。
              </p>
            </div>
          </div>
        </div>
      )}

      {downloadStatus === 'success' && (
        <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4">
          <div className="flex gap-3 items-center">
            <CheckCircle2 className="h-5 w-5 text-green-400" />
            <div>
              <h4 className="font-semibold text-green-400 mb-1">下载成功</h4>
              <p className="text-sm text-green-200">文件已成功打包并开始下载。</p>
            </div>
          </div>
        </div>
      )}

      {downloadStatus === 'error' && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
          <div className="flex gap-3 items-center">
            <AlertCircle className="h-5 w-5 text-red-400" />
            <div>
              <h4 className="font-semibold text-red-400 mb-1">下载失败</h4>
              <p className="text-sm text-red-200">{errorMessage || '打包下载过程中出现错误，请稍后重试。'}</p>
            </div>
          </div>
        </div>
      )}

      {/* 下载按钮 */}
      <div className="flex items-center justify-center pt-4">
        <button
          onClick={handleBatchDownload}
          disabled={isDownloading}
          className="bg-purple-600 hover:bg-purple-700 text-white font-medium py-3 px-8 rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 text-lg shadow-lg shadow-purple-500/20 hover:shadow-purple-500/30"
        >
          {isDownloading ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin" />
              打包中...
            </>
          ) : (
            <>
              <Download className="h-5 w-5" />
              批量打包下载
            </>
          )}
        </button>
      </div>

      {/* 提示信息 */}
      <div className="bg-white/5 border border-white/10 rounded-lg p-4">
        <div className="flex gap-2">
          <AlertCircle className="h-4 w-4 text-yellow-400 mt-0.5 flex-shrink-0" />
          <div className="text-sm text-gray-400">
            <p className="mb-2">
              <strong className="text-gray-300">提示：</strong>
            </p>
            <ul className="list-disc list-inside space-y-1 ml-4">
              <li>系统只会下载"在线"或"云端"状态的文件</li>
              <li>未在线状态的文件会被自动忽略</li>
              <li>如果某个文件无法读取，打包过程会继续处理其他文件</li>
              <li>打包大量文件可能需要较长时间，请耐心等待</li>
              <li>下载完成后请检查 ZIP 文件是否完整</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
