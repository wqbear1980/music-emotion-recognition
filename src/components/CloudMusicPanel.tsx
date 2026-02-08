'use client';

import { useState, useEffect } from 'react';
import { Cloud, Trash2, RefreshCw, Search, SortAsc, SortDesc, Copy, Check } from 'lucide-react';
import { useClipboard } from '@/hooks/useClipboard';

interface CloudMusicFile {
  id: string;
  fileName: string;
  fileKey: string;
  fileSize: number;
  uploadedAt: string;
  duration?: number;
  bpm?: number;
  emotionTags?: string[];
  filmType?: string;
  scenarios?: string[];
  isOnline: boolean;
  isUploaded: boolean;
}

interface CloudMusicPanelProps {
  onClose?: () => void;
}

export default function CloudMusicPanel({ onClose }: CloudMusicPanelProps) {
  const [files, setFiles] = useState<CloudMusicFile[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'uploadedAt' | 'fileName'>('uploadedAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [diagnosing, setDiagnosing] = useState(false);
  const [forceDeleting, setForceDeleting] = useState(false);
  const [copyingId, setCopyingId] = useState<string | null>(null);
  const { copyToClipboard } = useClipboard();

  // 加载云端文件列表
  const loadCloudFiles = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (searchQuery) params.append('query', searchQuery);
      params.append('sortBy', sortBy);
      params.append('sortOrder', sortOrder);
      params.append('page', currentPage.toString());
      params.append('limit', '20');

      const response = await fetch(`/api/cloud-music/list?${params.toString()}`);
      const data = await response.json();

      if (data.success) {
        setFiles(data.data.files);
        setTotal(data.data.pagination.total);
        setTotalPages(data.data.pagination.totalPages);
      } else {
        console.error('加载云端文件列表失败:', data.error);
        alert('加载云端文件列表失败：' + data.error);
      }
    } catch (error) {
      console.error('加载云端文件列表失败:', error);
      alert('加载云端文件列表失败');
    } finally {
      setLoading(false);
    }
  };

  // 删除选中的云端文件
  const handleDelete = async () => {
    if (selectedIds.length === 0) {
      alert('请先选择要删除的文件');
      return;
    }

    const confirmed = confirm(`确定要删除选中的 ${selectedIds.length} 个云端文件吗？\n\n注意：此操作仅删除云端文件，不影响本地文件。`);
    if (!confirmed) return;

    setDeleting(true);
    try {
      console.log(`[云端删除] 开始删除 ${selectedIds.length} 个文件`);
      
      // 设置请求超时（30秒）
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000);

      const response = await fetch('/api/cloud-music/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileIds: selectedIds }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      
      const data = await response.json();

      if (data.success) {
        const { deleted, failed } = data.data;
        
        // 构建详细的提示信息
        let message = `✅ 成功删除 ${deleted.length} 个文件`;
        if (failed.length > 0) {
          message += `\n\n❌ 失败 ${failed.length} 个文件:\n`;
          failed.slice(0, 5).forEach((item: any) => {
            message += `• ${item.fileName}: ${item.error}\n`;
          });
          if (failed.length > 5) {
            message += `... 还有 ${failed.length - 5} 个失败`;
          }
          message += `\n\n💡 提示: 失败的文件可能是网络问题或文件不存在，建议稍后重试。`;
        }
        
        alert(message);
        console.log(`[云端删除] 删除完成: ${deleted.length} 成功, ${failed.length} 失败`);
        
        setSelectedIds([]);
        loadCloudFiles(); // 重新加载列表
      } else {
        console.error('[云端删除] 服务器返回错误:', data.error);
        alert(`删除失败：${data.error}\n\n💡 建议：\n1. 检查网络连接\n2. 稍后重试\n3. 如果持续失败，请联系管理员`);
      }
    } catch (error: any) {
      console.error('[云端删除] 请求失败:', error);
      
      let errorMessage = '删除云端文件失败';
      if (error.name === 'AbortError') {
        errorMessage = '删除请求超时（30秒），请检查网络后重试';
      } else if (error.message) {
        errorMessage = `删除失败：${error.message}`;
      }
      
      alert(`${errorMessage}\n\n💡 建议：\n1. 检查网络连接\n2. 刷新页面后重试\n3. 尝试减少批量删除的数量`);
    } finally {
      setDeleting(false);
    }
  };

  // 诊断选中的云端文件
  const handleDiagnose = async () => {
    if (selectedIds.length === 0) {
      alert('请先选择要诊断的文件');
      return;
    }

    setDiagnosing(true);
    try {
      console.log(`[云端诊断] 开始诊断 ${selectedIds.length} 个文件`);

      const response = await fetch('/api/cloud-music/diagnose', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileIds: selectedIds }),
      });

      const data = await response.json();

      if (data.success) {
        const { results } = data.data;

        // 构建详细的诊断报告
        let report = `📋 诊断报告（共 ${results.length} 个文件）\n\n`;

        results.forEach((item: any, index: number) => {
          report += `${index + 1}. ${item.fileName}\n`;
          report += `   状态: ${item.existsInDb ? '✅ 数据库存在' : '❌ 数据库不存在'}\n`;
          report += `   已上传: ${item.isUploaded ? '✅ 是' : '❌ 否'}\n`;
          report += `   fileKey: ${item.fileKey || '无'}\n`;
          report += `   对象存储: ${item.existsInStorage === true ? '✅ 存在' : item.existsInStorage === false ? '❌ 不存在' : '⚠️ 无法验证'}\n`;

          if (item.issue) {
            report += `   ⚠️ 问题: ${item.issue}\n`;
          }
          if (item.recommendation) {
            report += `   💡 建议: ${item.recommendation}\n`;
          }
          report += '\n';
        });

        // 统计可修复的数量
        const canFixCount = results.filter((r: any) => r.canDelete).length;
        if (canFixCount > 0) {
          report += `\n✅ 可使用"强制删除"功能修复 ${canFixCount} 个文件`;
        }

        console.log('[云端诊断] 诊断完成:', results);
        alert(report);
      } else {
        console.error('[云端诊断] 服务器返回错误:', data.error);
        alert(`诊断失败：${data.error}`);
      }
    } catch (error: any) {
      console.error('[云端诊断] 请求失败:', error);
      alert(`诊断失败：${error.message}`);
    } finally {
      setDiagnosing(false);
    }
  };

  // 强制删除选中的云端文件
  const handleForceDelete = async () => {
    if (selectedIds.length === 0) {
      alert('请先选择要强制删除的文件');
      return;
    }

    const confirmed = confirm(
      `⚠️ 警告：即将强制删除选中的 ${selectedIds.length} 个文件！\n\n` +
      `此操作会：\n` +
      `1. 直接更新数据库状态（清除fileKey、标记为未上传）\n` +
      `2. 尝试从对象存储删除（失败不影响数据库更新）\n` +
      `3. 即使对象存储删除失败，数据库状态也会被更新\n\n` +
      `是否继续？`
    );

    if (!confirmed) return;

    setForceDeleting(true);
    try {
      console.log(`[强制删除] 开始强制删除 ${selectedIds.length} 个文件`);

      const response = await fetch('/api/cloud-music/force-delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileIds: selectedIds, force: true }),
      });

      const data = await response.json();

      if (data.success) {
        const { deleted, failed } = data.data;

        let message = `✅ 强制删除完成：成功 ${deleted.length} 个，失败 ${failed.length} 个\n\n`;
        if (deleted.length > 0) {
          message += `已删除的文件：\n`;
          deleted.slice(0, 5).forEach((item: any) => {
            message += `✓ ${item.fileName}\n`;
          });
          if (deleted.length > 5) {
            message += `... 还有 ${deleted.length - 5} 个\n`;
          }
        }
        if (failed.length > 0) {
          message += `\n失败的文件：\n`;
          failed.forEach((item: any) => {
            message += `✗ ${item.fileName}: ${item.error}\n`;
          });
        }

        console.log('[强制删除] 删除完成:', data);
        alert(message);

        setSelectedIds([]);
        loadCloudFiles(); // 重新加载列表
      } else {
        console.error('[强制删除] 服务器返回错误:', data.error);
        alert(`强制删除失败：${data.error}`);
      }
    } catch (error: any) {
      console.error('[强制删除] 请求失败:', error);
      alert(`强制删除失败：${error.message}`);
    } finally {
      setForceDeleting(false);
    }
  };

  // 切换全选
  const handleSelectAll = () => {
    if (selectedIds.length === files.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(files.map(f => f.id));
    }
  };

  // 切换单个文件选中状态
  const handleSelectFile = (id: string) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  // 格式化文件大小
  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
  };

  // 格式化时间
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // 格式化时长
  const formatDuration = (seconds?: number) => {
    if (!seconds) return '-';
    const minutes = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  // 复制链接
  const handleCopyLink = async (fileId: string, fileName: string) => {
    setCopyingId(fileId);

    try {
      // 获取签名 URL（使用 URLSearchParams 正确编码参数）
      const params = new URLSearchParams({ id: fileId });
      const response = await fetch(`/api/download-music?${params.toString()}`);
      const data = await response.json();

      if (!data.success) {
        alert('获取链接失败：' + data.error);
        setCopyingId(null);
        return;
      }

      const downloadUrl = data.data.downloadUrl;

      // 使用安全的剪贴板操作
      const { success, message } = await copyToClipboard(downloadUrl);

      if (success) {
        alert(`✓ 链接已复制到剪贴板\n\n文件：${fileName}\n\n有效期：1小时\n\n分享后对方即可直接下载该音乐文件`);
      } else {
        alert(`❌ ${message}`);
      }
    } catch (error) {
      console.error('复制链接失败:', error);
      alert('复制链接失败，请重试');
    } finally {
      // 延迟重置状态，让用户看到复制成功的反馈
      setTimeout(() => setCopyingId(null), 2000);
    }
  };

  // 初始加载
  useEffect(() => {
    loadCloudFiles();
  }, [searchQuery, sortBy, sortOrder, currentPage]);

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-gray-900 rounded-2xl border border-white/10 w-full max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* 标题栏 */}
        <div className="flex items-center justify-between p-6 border-b border-white/10">
        <div className="flex items-center gap-3">
          <Cloud className="w-6 h-6 text-blue-400" />
          <h2 className="text-2xl font-bold text-white">云端音乐管理</h2>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 text-sm text-gray-400">
            <span className="font-medium">已上传:</span>
            <span className="text-blue-400 font-bold">{total}</span>
            <span>首</span>
          </div>
          {onClose && (
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-white transition-colors"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* 工具栏 */}
      <div className="p-4 border-b border-white/10 bg-gray-800/50">
          <div className="flex items-center gap-4">
              {/* 搜索框 */}
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <input
              type="text"
              placeholder="搜索文件名或ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-gray-700/50 border border-white/10 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-white placeholder-gray-500"
            />
          </div>

          {/* 排序 */}
          <div className="flex items-center gap-2">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as 'uploadedAt' | 'fileName')}
              className="px-3 py-2 bg-gray-700/50 border border-white/10 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-white"
            >
              <option value="uploadedAt">上传时间</option>
              <option value="fileName">文件名</option>
            </select>
            <button
              onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
              className="p-2 border border-white/10 rounded-md hover:bg-white/10 text-gray-400 hover:text-white"
              title={sortOrder === 'asc' ? '升序' : '降序'}
            >
              {sortOrder === 'asc' ? <SortAsc className="w-4 h-4" /> : <SortDesc className="w-4 h-4" />}
            </button>
          </div>

          {/* 刷新按钮 */}
          <button
            onClick={loadCloudFiles}
            disabled={loading}
            className="p-2 border border-white/10 rounded-md hover:bg-white/10 disabled:opacity-50 text-gray-400 hover:text-white"
            title="刷新"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>

          {/* 批量删除按钮 */}
          <button
            onClick={handleDelete}
            disabled={deleting || selectedIds.length === 0}
            className="px-4 py-2 bg-red-600/80 text-white rounded-md hover:bg-red-600 disabled:bg-gray-700 disabled:cursor-not-allowed flex items-center gap-2"
          >
            <Trash2 className="w-4 h-4" />
            {deleting ? '删除中...' : `删除 (${selectedIds.length})`}
          </button>

          {/* 诊断按钮 */}
          <button
            onClick={handleDiagnose}
            disabled={diagnosing || selectedIds.length === 0}
            className="px-4 py-2 bg-yellow-600/80 text-white rounded-md hover:bg-yellow-600 disabled:bg-gray-700 disabled:cursor-not-allowed flex items-center gap-2"
            title="诊断删除失败的原因"
          >
            🔍 {diagnosing ? '诊断中...' : '诊断'}
          </button>

          {/* 强制删除按钮 */}
          <button
            onClick={handleForceDelete}
            disabled={forceDeleting || selectedIds.length === 0}
            className="px-4 py-2 bg-orange-600/80 text-white rounded-md hover:bg-orange-600 disabled:bg-gray-700 disabled:cursor-not-allowed flex items-center gap-2"
            title="强制删除（跳过对象存储验证）"
          >
            ⚡ {forceDeleting ? '强制删除中...' : '强制删除'}
          </button>
        </div>
      </div>

      {/* 文件列表 */}
      <div className="flex-1 overflow-auto p-4">
        {files.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-gray-500">
            <Cloud className="w-16 h-16 mb-4 opacity-50" />
            <p className="text-gray-400">云端暂无音乐文件</p>
            <p className="text-sm mt-2 text-gray-500">上传音乐文件后，将在此显示</p>
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-800/50 sticky top-0">
              <tr>
                <th className="px-4 py-3 text-left text-gray-400 font-medium">
                  <input
                    type="checkbox"
                    checked={selectedIds.length === files.length && files.length > 0}
                    onChange={handleSelectAll}
                    className="w-4 h-4"
                  />
                </th>
                <th className="px-4 py-3 text-left text-gray-400 font-medium">文件名</th>
                <th className="px-4 py-3 text-left text-gray-400 font-medium">大小</th>
                <th className="px-4 py-3 text-left text-gray-400 font-medium">时长</th>
                <th className="px-4 py-3 text-left text-gray-400 font-medium">上传时间</th>
                <th className="px-4 py-3 text-left text-gray-400 font-medium">主情绪</th>
                <th className="px-4 py-3 text-left text-gray-400 font-medium">影片类型</th>
                <th className="px-4 py-3 text-left text-gray-400 font-medium">场景建议</th>
                <th className="px-4 py-3 text-center text-gray-400 font-medium">操作</th>
              </tr>
            </thead>
            <tbody>
              {files.map((file) => (
                <tr key={file.id} className="border-b border-white/10 hover:bg-white/5">
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(file.id)}
                      onChange={() => handleSelectFile(file.id)}
                      className="w-4 h-4"
                    />
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-medium text-white">{file.fileName}</div>
                    <div className="text-xs text-gray-500">ID: {file.id}</div>
                  </td>
                  <td className="px-4 py-3 text-gray-300">{formatFileSize(file.fileSize)}</td>
                  <td className="px-4 py-3 text-gray-300">{formatDuration(file.duration)}</td>
                  <td className="px-4 py-3 text-gray-300">{formatDate(file.uploadedAt)}</td>
                  <td className="px-4 py-3">
                    {file.emotionTags && file.emotionTags.length > 0 ? (
                      <span className="px-2 py-1 bg-purple-900/50 text-purple-300 text-xs rounded border border-purple-700/50">
                        {file.emotionTags[0]}
                      </span>
                    ) : (
                      <span className="text-gray-500">-</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {file.filmType ? (
                      <span className="px-2 py-1 bg-blue-900/50 text-blue-300 text-xs rounded border border-blue-700/50">
                        {file.filmType}
                      </span>
                    ) : <span className="text-gray-500">-</span>}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {file.scenarios?.slice(0, 2).map((scenario, i) => (
                        <span key={i} className="px-2 py-1 bg-green-900/50 text-green-300 text-xs rounded border border-green-700/50">
                          {scenario}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <button
                      onClick={() => handleCopyLink(file.id, file.fileName)}
                      disabled={copyingId === file.id}
                      className="p-2 bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 border border-blue-500/30 rounded-md transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                      title="复制分享链接"
                    >
                      {copyingId === file.id ? (
                        <Check className="w-4 h-4" />
                      ) : (
                        <Copy className="w-4 h-4" />
                      )}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* 分页 */}
      {totalPages > 1 && (
        <div className="p-4 border-t border-white/10 bg-gray-800/50 flex items-center justify-between">
          <div className="text-sm text-gray-400">
            共 {total} 条，第 {currentPage} / {totalPages} 页
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="px-3 py-1 border border-white/10 rounded hover:bg-white/10 disabled:opacity-50 text-gray-400 hover:text-white"
            >
              上一页
            </button>
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              const pageNum = Math.max(1, Math.min(totalPages, currentPage - 2 + i));
              return (
                <button
                  key={pageNum}
                  onClick={() => setCurrentPage(pageNum)}
                  className={`px-3 py-1 border border-white/10 rounded ${
                    pageNum === currentPage
                      ? 'bg-blue-600 text-white'
                      : 'hover:bg-white/10 text-gray-400 hover:text-white'
                  }`}
                >
                  {pageNum}
                </button>
              );
            })}
            <button
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="px-3 py-1 border border-white/10 rounded hover:bg-white/10 disabled:opacity-50 text-gray-400 hover:text-white"
            >
              下一页
            </button>
          </div>
        </div>
      )}
    </div>
    </div>
  );
}
