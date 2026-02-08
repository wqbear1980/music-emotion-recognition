/**
 * 音乐文件状态统一处理工具
 *
 * 状态枚举值：
 * - 状态1：在线（isOnline=true && isUploaded=false，仅本地存储，未上传云端）
 * - 状态2：云端（isUploaded=true，已上传至云端）
 * - 状态3：未在线（isOnline=false && isUploaded=false，文件不可访问）
 *
 * 【状态判断核心原则】
 * 1. 云端状态（isUploaded=true）优先级最高：只要文件已上传到云端，无论 isOnline 的值，都显示「云端」
 * 2. 这样可以确保分析操作或其他操作不会错误地将已上传文件标记为其他状态
 * 3. is_online 和 is_uploaded 状态只在上传操作（cloud-music/upload-file）时更新，不在分析操作中修改
 */

export interface MusicStatus {
  type: 'online' | 'uploaded' | 'offline';
  label: string;
  icon: string;
  colorClass: string;
  bgColorClass: string;
}

/**
 * 获取音乐文件状态
 *
 * 状态判断逻辑（按优先级）：
 * 1. 云端（isUploaded=true）→ 显示「云端」
 * 2. 在线（isOnline=true && isUploaded=false）→ 显示「在线」
 * 3. 未在线（其他情况）→ 显示「未在线」
 *
 * @param isOnline - 文件在线状态
 * @param isUploaded - 是否已上传至云端
 * @returns 音乐状态对象
 */
export function getMusicStatus(
  isOnline: boolean | undefined,
  isUploaded: boolean | undefined
): MusicStatus {
  // 优先级1：云端（只要已上传至云端，无论在线状态如何都显示「云端」）
  if (isUploaded === true) {
    return {
      type: 'uploaded',
      label: '云端',
      icon: '☁️',
      colorClass: 'text-emerald-300',
      bgColorClass: 'bg-emerald-500/20',
    };
  }

  // 优先级2：在线（仅本地存储，未上传云端）
  if (isOnline === true) {
    return {
      type: 'online',
      label: '在线',
      icon: '📍',
      colorClass: 'text-cyan-300',
      bgColorClass: 'bg-cyan-500/20',
    };
  }

  // 优先级3：未在线（文件不可访问）
  return {
    type: 'offline',
    label: '离线',
    icon: '⚪',
    colorClass: 'text-yellow-300',
    bgColorClass: 'bg-yellow-500/20',
  };
}

/**
 * 判断文件是否可以在线访问
 * @param isOnline - 文件在线状态
 * @returns 是否可以在线访问
 */
export function isFileAccessible(isOnline: boolean | undefined): boolean {
  return isOnline === true;
}
