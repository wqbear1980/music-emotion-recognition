'use client';

/**
 * 剪贴板操作 Hook
 * 封装安全的剪贴板读写操作，处理权限问题和浏览器兼容性
 *
 * 浏览器安全要求：
 * 1. navigator.clipboard.writeText() 必须在用户交互回调（onClick）中执行
 * 2. 首次调用会触发权限请求弹窗
 * 3. 非安全上下文（如 iframe、非 HTTPS）会被拒绝
 */
export const useClipboard = () => {
  /**
   * 写入剪贴板（带权限校验和错误处理）
   * @param text 要复制的文本
   * @returns 操作结果和提示信息
   */
  const copyToClipboard = async (text: string): Promise<{
    success: boolean;
    message: string;
  }> => {
    try {
      // 1. 检查浏览器是否支持剪贴板 API
      if (!navigator.clipboard) {
        // 降级方案：使用 textarea 模拟复制
        return fallbackCopyToClipboard(text);
      }

      // 2. 安全检查：必须在用户交互中执行
      const currentContext = document.visibilityState;
      if (currentContext !== 'visible') {
        return {
          success: false,
          message: '无法在后台执行复制操作，请回到页面后重试'
        };
      }

      // 3. 尝试写入剪贴板（自动触发权限请求）
      await navigator.clipboard.writeText(text);
      return {
        success: true,
        message: '复制成功'
      };
    } catch (error: any) {
      // 分类处理错误
      if (error.name === 'NotAllowedError') {
        return {
          success: false,
          message: '剪贴板权限被拒绝，请在浏览器设置中开启权限后重试\n\n' +
                  'Chrome: 设置 → 隐私和安全 → 网站设置 → 剪贴板\n' +
                  'Safari: 偏好设置 → 网站 → 剪贴板'
        };
      } else if (error.name === 'SecurityError') {
        return {
          success: false,
          message: '安全策略限制：仅支持在用户点击/触摸时复制'
        };
      } else {
        console.error('剪贴板操作失败:', error);
        return {
          success: false,
          message: `复制失败：${error.message || '未知错误'}`
        };
      }
    }
  };

  /**
   * 降级方案：不支持 Clipboard API 时用 textarea 模拟
   * @param text 要复制的文本
   * @returns 操作结果和提示信息
   */
  const fallbackCopyToClipboard = (text: string): {
    success: boolean;
    message: string;
  } => {
    try {
      const textArea = document.createElement('textarea');
      textArea.value = text;

      // 隐藏 textarea，避免影响页面
      textArea.style.position = 'fixed';
      textArea.style.top = '-999px';
      textArea.style.left = '-999px';
      textArea.style.opacity = '0';
      textArea.style.pointerEvents = 'none';

      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();

      // 执行复制（部分浏览器可能仍会拒绝）
      const successful = document.execCommand('copy');
      document.body.removeChild(textArea);

      if (successful) {
        return { success: true, message: '复制成功' };
      } else {
        return {
          success: false,
          message: '复制失败，请手动复制链接'
        };
      }
    } catch (error: any) {
      console.error('降级复制失败:', error);
      return {
        success: false,
        message: `复制失败：${error.message || '未知错误'}`
      };
    }
  };

  return { copyToClipboard };
};
