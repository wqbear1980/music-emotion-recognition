'use client';

import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { audioFilesDB, AudioFileItemDB } from '@/lib/audioFilesDB';
import SimpleLLMConfig from '@/components/SimpleLLMConfig';

/**
 * 扩展 Window 接口
 */
declare global {
  interface Window {
    refreshStandardVocabulary?: () => Promise<void>;
  }
}

/**
 * Select 组件值类型
 */
type SelectValue = string | number;

/**
 * 批量下载打包分类类型
 */
type PackByType = 'emotion' | 'film' | 'scenario' | 'style' | 'all';

/**
 * 音乐来源类型
 */
type MusicSourceType = '影视原声' | '专辑' | '独立单曲' | '综艺' | '游戏配乐' | '广告' | '不确定';

/**
 * 置信度级别类型
 */
type ConfidenceLevel = '高' | '中' | '低';

/**
 * 防抖函数
 * 避免短时间内频繁触发同一操作（如搜索请求）
 * @param fn 需要防抖的函数
 * @param delay 延迟时间（毫秒）
 * @returns 防抖后的函数
 */
function debounce<T extends (...args: any[]) => any>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timer: NodeJS.Timeout | null = null;

  return function(this: any, ...args: Parameters<T>) {
    if (timer) {
      clearTimeout(timer);
    }

    timer = setTimeout(() => {
      fn.apply(this, args);
      timer = null;
    }, delay);
  };
}

// 帮助说明数据
const HELP_DATA = {
  categories: [
    {
      title: "📁 文件管理",
      items: [
        {
          name: "上传音乐文件",
          icon: "🎵",
          description: "点击上传区域或拖拽音频文件到这里，支持 MP3、WAV、OGG、FLAC 等格式，可批量选择多个文件。",
        },
        {
          name: "批量分析",
          icon: "🔍",
          description: "对所有未分析的文件进行情绪、风格、乐器、影视配乐等全方位智能分析。分析过程会自动保存到数据库。",
        },
        {
          name: "⚡ 极速分析",
          icon: "⚡",
          description: "开启所有优化选项进行极速分析，跳过联网验证、MD5计算、元数据提取等步骤，适合处理大量文件。精度会略有降低。",
        },
        {
          name: "批量二次识别",
          icon: "🔎",
          description: "对未识别或类型不匹配的场景进行二次识别，基于音频特征匹配标准词库，提高识别准确率。",
        },
        {
          name: "重新分析",
          icon: "🔄",
          description: "重新对选中的已完成分析文件进行分析，更新所有识别结果。可用于验证一致性或修正错误。",
        },
        {
          name: "批量导出CSV",
          icon: "📊",
          description: "将选中的分析结果导出为 CSV 格式文件，便于在其他工具中使用。",
        },
        {
          name: "🏷️ 访达标签",
          icon: "🏷️",
          description: "为音乐文件自动添加 Finder 颜色标签。配置情绪映射后，一键下载脚本并运行，即可批量添加标签。需要安装 tag 工具（brew install tag）。",
        },
        {
          name: "批量导出Excel",
          icon: "📈",
          description: "将选中的分析结果导出为 Excel 格式文件，保留样式和格式，便于打印和分享。",
        },
        {
          name: "批量上传云端",
          icon: "☁️",
          description: "将本地文件上传到云端对象存储，实现跨设备访问和长期保存。",
        },
        {
          name: "云端音乐",
          icon: "🎶",
          description: "打开云端音乐管理面板，查看和管理已上传的云端音乐文件。",
        },
        {
          name: "清空全部",
          icon: "🗑️",
          description: "清空所有已上传的文件列表。注意：已分析并保存到数据库的数据不会被删除。",
        },
      ],
    },
    {
      title: "🎧 播放控制",
      items: [
        {
          name: "播放模式",
          icon: "🔁",
          description: "切换播放模式：顺序播放（按列表顺序自动播放下一首）、单曲循环（重复播放当前歌曲）、随机播放（随机选择下一首）。播放结束后会自动切歌（单曲循环除外）。",
        },
        {
          name: "自动切歌",
          icon: "🔄",
          description: "在顺序播放和随机播放模式下，歌曲播放结束后会自动切换到下一首。单曲循环模式会重新播放当前歌曲。延迟500ms确保平滑切换。",
        },
        {
          name: "上一首 / 下一首",
          icon: "⏮️ / ⏭️",
          description: "切换到列表中的上一首或下一首歌曲。支持从上传文件列表和数据库搜索结果列表中切换。切换失败时会显示友好的错误提示。",
        },
        {
          name: "播放 / 暂停",
          icon: "▶️ / ⏸️",
          description: "播放或暂停当前歌曲。大按钮设计，易于点击。支持本地文件和云端文件的播放。",
        },
        {
          name: "停止",
          icon: "⏹️",
          description: "停止播放并重置播放进度到开头。会清除自动播放标志，防止播放结束自动切歌。",
        },
        {
          name: "音量控制",
          icon: "🔊",
          description: "调整播放音量。点击音量图标可一键静音/取消静音。音量变化实时生效。",
        },
        {
          name: "倍速控制",
          icon: "⏩",
          description: "调整播放速度。支持 0.5x、0.75x、1x（正常）、1.25x、1.5x、2x 等多种速度。切换速度后立即生效。",
        },
        {
          name: "进度条",
          icon: "━━━━",
          description: "拖动进度条可快速定位到歌曲的任意位置。显示当前播放时间和总时长。支持点击进度条快速跳转。",
        },
        {
          name: "播放错误处理",
          icon: "⚠️",
          description: "播放失败时会显示详细的错误信息，包括错误类型（网络错误、格式不支持、加载超时等）和具体原因。使用通知系统而非弹窗，体验更友好。",
        },
        {
          name: "云端音乐播放",
          icon: "☁️",
          description: "支持播放已上传到云端的音乐文件。系统会自动获取签名URL，无需下载到本地。播放前会检查音乐在线状态，离线音乐会提示无法播放。",
        },
        {
          name: "音频缓存",
          icon: "💾",
          description: "本地音频使用Blob URL缓存，云端音频使用签名URL缓存。组件卸载时会自动释放资源，防止内存泄漏。",
        },
      ],
    },
    {
      title: "✏️ 编辑功能",
      items: [
        {
          name: "编辑情绪",
          icon: "😊",
          description: "点击编辑按钮可修改情绪主标签、强度、情感轨迹等。修改后点击保存会更新到数据库和词库。",
        },
        {
          name: "编辑风格",
          icon: "🎨",
          description: "点击编辑按钮可修改音乐风格、子流派、流派融合、时代等。修改后点击保存会更新到数据库和词库。",
        },
        {
          name: "编辑音乐出处",
          icon: "💿",
          description: "点击编辑按钮可修改专辑、创作者、发行方等音乐来源信息。修改后点击保存会更新到数据库。",
        },
        {
          name: "编辑乐器",
          icon: "🎸",
          description: "点击编辑按钮可修改主奏乐器、伴奏乐器、打击乐器、电子元素、音色等。修改后点击保存会更新到数据库和词库。",
        },
        {
          name: "编辑影视配乐",
          icon: "🎬",
          description: "点击编辑按钮可修改影片类型、适合类型、转折点、氛围、情感引导、角色主题、场景建议等。修改后点击保存会更新到数据库和词库。",
        },
        {
          name: "保存编辑",
          icon: "💾",
          description: "保存当前编辑内容到数据库和词库。影片类型、乐器、情绪等修改会自动作为候选词添加到词库供审核。",
        },
        {
          name: "取消编辑",
          icon: "❌",
          description: "取消当前编辑，恢复到原始显示内容，不保存任何修改。",
        },
      ],
    },
    {
      title: "🗄️ 数据库管理",
      items: [
        {
          name: "数据库管理",
          icon: "📊",
          description: "打开数据库管理面板，可按情绪、影片、场景、乐器、风格等条件筛选和搜索音乐，查看统计图表，导出数据。",
        },
        {
          name: "批量更新场景建议",
          icon: "🔄",
          description: "从当前已分析的音乐文件中提取场景建议，并更新到数据库中对应的记录。用于批量修正场景标签。",
        },
        {
          name: "批量更新影片类型",
          icon: "🎬",
          description: "从数据库现有数据自动推断并更新影片类型，根据场景建议、风格等特征智能判断影片类型。",
        },
        {
          name: "词库管理",
          icon: "📚",
          description: "打开词库管理面板，管理情绪、风格、乐器、影片、场景、配音等标准词库，审核候选词，查看未识别统计。",
        },
        {
          name: "映射表管理",
          icon: "📋",
          description: "打开映射表管理面板，导入导出映射表数据，管理情绪-影片类型、场景-风格等映射关系。",
        },
      ],
    },
    {
      title: "🔍 高级检索",
      items: [
        {
          name: "情绪标签筛选",
          icon: "😊",
          description: "按情绪标签筛选音乐。可多选，支持搜索框查找，支持默认/英文/部首排序，显示每个情绪的音乐数量。",
        },
        {
          name: "影视配乐筛选",
          icon: "🎬",
          description: "按影视类型筛选音乐。可多选，支持搜索框查找，支持默认/英文/部首排序，显示每个类型对应的音乐数量。",
        },
        {
          name: "场景建议筛选",
          icon: "🏠",
          description: "按场景建议筛选音乐。可多选，支持搜索框查找，支持默认/英文/部首排序，显示每个场景对应的音乐数量。",
        },
        {
          name: "乐器分析筛选",
          icon: "🎸",
          description: "按乐器类型筛选音乐。可多选，支持搜索框查找，支持默认/英文/部首排序，显示每种乐器对应的音乐数量。",
        },
        {
          name: "音乐风格筛选",
          icon: "🎧",
          description: "按音乐风格筛选音乐。可多选，按风格分类（如古典、流行、摇滚等），支持搜索框查找和排序。",
        },
        {
          name: "在线状态筛选",
          icon: "☁️",
          description: "按在线状态筛选：全部（显示所有）、在线（仅在线音乐）、上传（仅上传到云端）、离线（仅本地存储）。",
        },
        {
          name: "时间范围筛选",
          icon: "⏱️",
          description: "按时间范围筛选音乐：全部时间、近7天、近30天、近90天。快速找到特定时间段入库的音乐。",
        },
        {
          name: "搜索框",
          icon: "🔎",
          description: "在高级检索中，每个分类都有搜索框，支持快速查找特定标签。输入关键词即可实时过滤列表。",
        },
        {
          name: "确认搜索",
          icon: "✅",
          description: "根据选中的所有筛选条件执行搜索，返回符合条件的结果。搜索失败时会显示友好的错误提示。",
        },
        {
          name: "清空条件",
          icon: "🗑️",
          description: "一键清空所有筛选条件，恢复到初始状态，方便重新选择筛选条件。",
        },
      ],
    },
    {
      title: "📂 搜索结果管理",
      items: [
        {
          name: "快速搜索",
          icon: "🔍",
          description: "在搜索结果中快速搜索音乐名称或ID，输入关键词实时过滤显示结果。",
        },
        {
          name: "结果排序",
          icon: "↕️",
          description: "对搜索结果进行排序：最新入库（默认）、最早入库、名称A-Z、名称Z-A。支持按创建时间或文件名排序。",
        },
        {
          name: "每页显示条数",
          icon: "📄",
          description: "设置每页显示的结果数量：10条、20条、50条。调整后自动刷新显示。",
        },
        {
          name: "批量打包下载",
          icon: "📦",
          description: "将搜索结果打包下载。支持按情绪、影片类型、场景、风格分类打包，或全部打包到一个文件。",
        },
        {
          name: "文件包归类展示",
          icon: "📁",
          description: "按音乐出处（专辑、影视、创作者）归类展示搜索结果，点击展开/收起查看每个出处下的音乐列表。",
        },
        {
          name: "数据库播放器",
          icon: "🎵",
          description: "在搜索结果中内置播放器，支持播放/暂停、上一首/下一首、停止、进度控制、音量调节等，可连续播放搜索结果。",
        },
        {
          name: "点击播放",
          icon: "▶️",
          description: "在搜索结果中点击音乐名称即可播放，自动切换到数据库播放模式，从搜索结果列表中连续播放。",
        },
        {
          name: "查看详情",
          icon: "👁️",
          description: "点击音乐可查看详细的分析结果，包括情绪、风格、乐器、影视配乐、场景建议等信息。",
        },
      ],
    },
    {
      title: "⚙️ 数据库维护",
      items: [
        {
          name: "数据清空",
          icon: "🗑️",
          description: "清空数据库数据。支持两种模式：仅清空用户数据（保留词库）或清空所有数据（包括词库）。需要输入确认密码 CLEAR。",
        },
        {
          name: "分类统计概览",
          icon: "📊",
          description: "查看情绪识别、影视配乐、场景建议、乐器分析、音乐风格等分类的统计概览，点击卡片可展开查看详细图表。",
        },
        {
          name: "分页浏览",
          icon: "📄",
          description: "搜索结果支持分页显示，可跳转到首页、上一页、下一页、尾页，或直接输入页码跳转。",
        },
        {
          name: "编辑数据库记录",
          icon: "✏️",
          description: "在搜索结果中点击编辑按钮，可在线修改数据库中的音乐分析结果，修改后点击保存会更新数据库。",
        },
        {
          name: "删除数据库记录",
          icon: "🗑️",
          description: "在搜索结果中点击删除按钮，可删除数据库中的音乐记录。注意：只删除数据库记录，不影响云端存储的原始文件。",
        },
      ],
    },
    {
      title: "📚 词库管理",
      items: [
        {
          name: "标准词库",
          icon: "📋",
          description: "查看和管理标准词库，包括情绪、风格、乐器、影片、场景、配音等分类的标准词汇。",
        },
        {
          name: "候选词审核",
          icon: "✅",
          description: "审核用户编辑时自动添加的候选词，批准后加入标准词库，拒绝后删除。",
        },
        {
          name: "未识别统计",
          icon: "📊",
          description: "统计未识别的情绪、影片类型、场景等，帮助了解识别盲点，优化词库。",
        },
        {
          name: "自动扩充",
          icon: "🔄",
          description: "基于二次识别结果自动扩充词库，将高频出现的未识别词作为候选词添加到审核队列。",
        },
      ],
    },
    {
      title: "🚀 系统优化",
      items: [
        {
          name: "播放功能优化",
          icon: "🎧",
          description: "优化了播放功能：修复单曲循环模式、实现自动切歌、统一错误处理、清理未使用代码。现在播放结束会自动切换到下一首（单曲循环除外），错误提示更友好，播放体验更流畅。",
        },
        {
          name: "代码质量提升",
          icon: "🛠️",
          description: "修复ESLint警告，删除未使用的变量和导入，优化TypeScript类型定义，提高代码可维护性和稳定性。所有代码通过TypeScript编译检查。",
        },
        {
          name: "错误处理改进",
          icon: "⚠️",
          description: "统一错误处理逻辑，使用公共函数处理播放错误。优化错误信息显示，区分不同错误类型（网络、格式、超时、权限等），提供针对性解决建议。",
        },
        {
          name: "性能优化",
          icon: "⚡",
          description: "优化音频资源管理，组件卸载时自动释放Blob URL，防止内存泄漏。优化事件监听，避免重复绑定。优化音频加载逻辑，减少不必要的重新加载。",
        },
        {
          name: "数据库连接优化",
          icon: "💾",
          description: "优化数据库连接层，增加重试机制和超时控制。连接超时延长到10秒，最大重试次数增加到3次，使用指数退避策略，提高连接成功率。",
        },
        {
          name: "健康检查",
          icon: "✅",
          description: "实现数据库健康检查功能，定期检测连接状态。支持手动触发健康检查，返回详细的健康状态信息。连续失败后启用降级模式。",
        },
      ],
    },
    {
      title: "⚙️ 其他功能",
      items: [
        {
          name: "全选",
          icon: "☑️",
          description: "勾选或取消勾选所有已完成分析的文件，用于批量操作（如导出、上传、重新分析）。",
        },
        {
          name: "通知消息",
          icon: "🔔",
          description: "统一的错误提示和操作通知系统。显示操作成功、错误提示等信息，包括搜索失败、网络错误等具体原因。支持自动关闭和手动关闭。播放失败会显示文件名和具体错误原因。",
        },
        {
          name: "状态标识",
          icon: "🏷️",
          description: "文件状态包括：分析中、上传中、二次识别中、在线、云端、未在线等，帮助了解文件当前状态。状态标识颜色区分：绿色（在线）、蓝色（云端）、灰色（离线）。",
        },
        {
          name: "音频可视化",
          icon: "📈",
          description: "实时显示音频频谱可视化效果，跟随音乐节奏跳动，提供视觉反馈。使用Canvas渲染，性能优化，不影响播放流畅度。",
        },
        {
          name: "复制链接",
          icon: "🔗",
          description: "复制音乐文件的访问链接（云端文件），便于分享给他人。链接为带签名的临时URL，有效期由云存储策略决定。",
        },
        {
          name: "类型安全",
          icon: "🛡️",
          description: "系统采用严格的 TypeScript 类型检查，确保数据结构的准确性和一致性，减少运行时错误。所有API接口都有完整的类型定义。",
        },
        {
          name: "LLM 配置",
          icon: "🤖",
          description: "点击顶部工具栏的「🤖 LLM 配置」按钮打开配置面板。支持云端大模型（豆包）和本地大模型（DeepSeek、Qwen、Gemma、GPT、Llama 等）的配置和切换。可选择服务类型（Ollama/vLLM/OpenAI兼容）、选择具体模型、测试连接和推理能力、保存配置。系统支持自动检测最佳LLM提供者，优先使用本地LLM，失败则切换云端。支持演示模式，无需真实Ollama即可测试界面。",
        },
        {
          name: "智能错误处理",
          icon: "⚠️",
          description: "点击顶部工具栏的「⚠️ 错误处理」按钮打开错误处理面板。智能分析错误类型（网络、音频、AI、数据库等），提供详细的解决方案和预防措施。播放错误会区分：网络错误、格式不支持、加载超时、自动播放被阻止等多种情况，给出针对性提示。",
        },
        {
          name: "术语帮助",
          icon: "📖",
          description: "点击分析结果中的术语标签（情绪、影片类型、场景等）可查看详细的术语解释，包括定义、典型案例、使用场景、相关术语和使用技巧。支持标准术语和候选术语。",
        },
        {
          name: "用户反馈",
          icon: "👍",
          description: "在数据库管理中，每条记录右侧有三个反馈按钮：✅识别准确、❌需要修正、⚠️部分正确。选择「需要修正」时系统会自动填充AI识别结果，只需填写修正内容即可。对话框底部显示反馈历史。反馈数据用于AI学习优化。",
        },
        {
          name: "数据分析仪表盘",
          icon: "📊",
          description: "点击顶部工具栏的「📊 数据分析」按钮打开数据分析仪表盘。查看总体统计、按类型统计准确率、准确率趋势（最近30天）、常见错误分析等。反馈数据有助于AI学习优化，提高识别准确率。",
        },
      ],
    },
  ],
};
import { standardizeAnalysisResult, STANDARD_TERMS } from '@/lib/standardTerms';
import {
  dynamicStandardizeAnalysisResult,
  initDynamicVocabulary,
  refreshDynamicVocabulary
} from '@/lib/dynamicStandardTerms';
import { sortItems } from '@/lib/chineseRadicalSort';
import { exportAnalysisToExcel, exportAnalysisToCSV, exportBatchToExcel, exportBatchToCSV } from '@/lib/exportExcel';
import { AnalysisResult, AudioFeatures, AudioFileItem } from '@/lib/types';
import { calculateFileMD5 } from '@/lib/md5';
import { getMusicStatus } from '@/lib/musicStatus';
import TablePreview from '@/components/TablePreview';
import TermManagementPanel from '@/components/TermManagementPanel';
import CloudMusicPanel from '@/components/CloudMusicPanel';
import SearchableSelect from '@/components/SearchableSelect';
import { MappingTableManager } from '@/components/MappingTableManager';
import {
  BarChartCard,
  StatOverviewCard,
  CategoryDetailCard,
} from '@/components/charts';
import AnalyticsDashboard from '@/components/AnalyticsDashboard';
import TermHelpCard from '@/components/TermHelpCard';
import ErrorPanel from '@/components/ErrorPanel';
import {
  standardizeAlbumName,
  standardizeFilmName,
  standardizeCreatorName,
  standardizePublisherName,
  standardizePlatformName,
} from '@/lib/standardMusicSources';

// 全局声明，用于调试
declare global {
  interface Window {
    fileInput?: HTMLInputElement;
  }
}







/**
 * 确保 mood.primary 是字符串
 * 如果是对象，转换为 JSON 字符串；如果是数组，取第一个元素
 */
const ensureStringMoodPrimary = (value: any): string => {
  if (typeof value === 'string') return value;
  if (typeof value === 'object' && value !== null) {
    if (Array.isArray(value)) {
      return value.length > 0 ? String(value[0]) : '';
    }
    // 对象转换为字符串，避免 {神秘, 空灵} 这种格式
    return Object.keys(value).join('、');
  }
  return String(value || '');
};

/**
 * 解析数组字段
 * 如果是字符串格式（如 "[\"积极\",\"励志\"]"），解析为真正的数组
 * 如果已经是数组，直接返回
 * 否则返回空数组
 */
const parseArrayField = (value: any): string[] => {
  // 如果已经是数组，直接返回
  if (Array.isArray(value)) {
    return value;
  }

  // 如果是字符串，尝试解析JSON
  if (typeof value === 'string' && value.trim()) {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) {
        return parsed;
      }
    } catch (error) {
      // 解析失败，返回空数组
      console.warn('[parseArrayField] 解析数组字段失败:', value, error);
    }
  }

  // 其他情况返回空数组
  return [];
};

/**
 * 解析 otherFeatures 对象
 * 如果是字符串，尝试解析为 JSON 对象
 * 如果已经是对象，直接返回
 * 否则返回空对象
 */
const parseOtherFeatures = (value: any): any => {
  // 如果已经是对象，直接返回
  if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
    return value;
  }

  // 如果是字符串，尝试解析JSON
  if (typeof value === 'string' && value.trim()) {
    try {
      const parsed = JSON.parse(value);
      if (typeof parsed === 'object' && parsed !== null) {
        return parsed;
      }
    } catch (error) {
      // 解析失败，返回空对象
      console.warn('[parseOtherFeatures] 解析 otherFeatures 失败:', value, error);
    }
  }

  // 其他情况返回空对象
  return {};
};

// 用户编辑的内容
interface EditedContent {
  mood: {
    primary?: string;
    intensity?: string;
    trajectory?: string;
  };
  style: {
    primary?: string;
    subGenre?: string;
    genreBlending?: string;
    era?: string;
  };
  albumInfo?: string;
  instruments: {
    primary?: string;
    accompaniment?: string;
    percussion?: string;
    electronicElements?: string;
    timbre?: string;
  };
  filmMusic: {
    filmType?: string;
    suitableGenres?: string[];
    turningPoints?: string;
    atmosphere?: string;
    emotionalGuidance?: string;
    characterTheme?: {
      suitable?: string;
      characterType?: string;
      storyArc?: string;
    };
  };
}

// 访达标签颜色
type FinderTagColor = 'red' | 'orange' | 'yellow' | 'green' | 'blue' | 'purple' | 'gray' | 'none';

// 标签映射配置
interface TagMapping {
  moodKeyword: string;      // 情绪关键词
  tagColor: FinderTagColor;  // 对应的标签颜色
  tagName?: string;         // 标签名称（可选）
}

// 错误消息接口
interface ErrorMessage {
  id: string;
  type: 'error' | 'warning' | 'info' | 'success';
  message: string;
  autoClose?: boolean;
  duration?: number;
}

export default function MusicEmotionRecognition() {
  // 按音乐出处归类音乐（只显示专辑栏内容）
  const groupMusicByPackage = (musicList: any[]) => {
    const groups: Record<string, { items: any[], translated?: string }> = {};

    musicList.forEach((item) => {
      // 只根据专辑信息进行归类（从分析结果的"音乐出处 - 专辑栏"提取）
      const packageName = item.album || '未分类';
      // 支持两种字段名：album_translated（snake_case，数据库原始）和 albumTranslated（camelCase，搜索API转换后）
      const packageTranslated = item.albumTranslated || item.album_translated || undefined;

      if (!groups[packageName]) {
        groups[packageName] = { items: [], translated: packageTranslated };
      } else {
        // 如果已有专辑组但没有翻译值，且当前文件有翻译值，则更新翻译值
        if (!groups[packageName].translated && packageTranslated) {
          groups[packageName].translated = packageTranslated;
        }
      }
      groups[packageName].items.push(item);
    });

    return groups;
  };

  // 多文件状态
  const [audioFiles, setAudioFiles] = useState<AudioFileItem[]>([]);
  const [currentFileId, setCurrentFileId] = useState<string>('');

  // 当前播放状态
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(0.8);
  const [isMuted, setIsMuted] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [showSpeedMenu, setShowSpeedMenu] = useState(false);
  const [playMode, setPlayMode] = useState<'sequential' | 'loop-one' | 'shuffle'>('sequential');
  const [showPlayModeMenu, setShowPlayModeMenu] = useState(false);

  // 拖动进度条标志，防止被 timeupdate 事件覆盖
  const [isSeeking, setIsSeeking] = useState(false);

  // 当前文件的分析状态
  const [error, setError] = useState<string>('');
  const [notifications, setNotifications] = useState<ErrorMessage[]>([]); // 新增：通知列表

  const [streamText, setStreamText] = useState('');
  const [showDetails, setShowDetails] = useState(false);
  const [editingModule, setEditingModule] = useState<string | null>(null);
  const [showTablePreview, setShowTablePreview] = useState(false);
  const [previewData, setPreviewData] = useState<AnalysisResult | null>(null);
  const [editedContent, setEditedContent] = useState<EditedContent>({
    mood: {},
    style: {},
    albumInfo: undefined,
    instruments: {},
    filmMusic: {},
  });

  // 数据库管理面板状态
  const [showDatabasePanel, setShowDatabasePanel] = useState(false);
  const [dbSearchResults, setDbSearchResults] = useState<any[]>([]);
  const [dbStats, setDbStats] = useState<any>(null);

  // 用户反馈状态
  const [showFeedbackDialog, setShowFeedbackDialog] = useState(false);
  const [feedbackType, setFeedbackType] = useState<'correct' | 'incorrect' | 'partial' | null>(null);
  const [feedbackReason, setFeedbackReason] = useState('');
  const [correctedFields, setCorrectedFields] = useState<any>({});
  const [currentFeedbackRecordId, setCurrentFeedbackRecordId] = useState<string | null>(null);
  const [feedbackHistory, setFeedbackHistory] = useState<any[]>([]);
  const [showFeedbackHistory, setShowFeedbackHistory] = useState(false);
  const [loadingFeedbackHistory, setLoadingFeedbackHistory] = useState(false);

  // 新功能状态
  const [showAnalyticsDashboard, setShowAnalyticsDashboard] = useState(false);
  const [showErrorPanel, setShowErrorPanel] = useState(false);
  const [showTermHelpCard, setShowTermHelpCard] = useState(false);
  const [currentHelpTerm, setCurrentHelpTerm] = useState('');
  const [currentHelpCategory, setCurrentHelpCategory] = useState<'mood' | 'style' | 'filmType' | 'scenario' | 'instrument'>('mood');

  // 音乐出处翻译状态
  const [originTranslations, setOriginTranslations] = useState<Record<string, string>>({});

  // LLM配置状态
  const [llmConfig, setLlmConfig] = useState<{
    type: 'cloud' | 'local';
    provider: string;
    model: string;
    modelBaseUrl: string;
  } | null>(null);
  const [loadingLlmConfig, setLoadingLlmConfig] = useState(false);
  const [showLlmConfigPanel, setShowLlmConfigPanel] = useState(false);
  const [llmHealthStatus, setLlmHealthStatus] = useState<'healthy' | 'unhealthy' | 'unknown'>('unknown');

  // 翻译专辑名称函数
  const translateAlbumName = async (albumName: string): Promise<string | null> => {
    if (!albumName || !albumName.trim()) {
      return null;
    }

    // 如果专辑名包含中文，不需要翻译
    if (/[\u4e00-\u9fa5]/.test(albumName)) {
      return null;
    }

    try {
      console.log(`[专辑翻译] 开始翻译专辑: ${albumName}`);
      const response = await fetch('/api/translate-albums', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ albumNames: [albumName] }),
      });

      if (!response.ok) {
        console.error('[专辑翻译] 翻译API调用失败:', response.statusText);
        return null;
      }

      const data = await response.json();
      if (data.success && data.translations[albumName]) {
        const translated = data.translations[albumName];
        console.log(`[专辑翻译] ${albumName} -> ${translated}`);
        return translated;
      }

      return null;
    } catch (error) {
      console.error('[专辑翻译] 翻译失败:', error);
      return null;
    }
  };

  // 打开反馈对话框
  // 加载反馈历史
  const loadFeedbackHistory = async (recordId: string) => {
    try {
      setLoadingFeedbackHistory(true);
      const response = await fetch(`/api/user-feedback?analysisId=${recordId}`);
      const result = await response.json();

      if (result.success) {
        setFeedbackHistory(result.data || []);
      } else {
        console.error('[反馈历史] 加载失败:', result.error);
      }
    } catch (error) {
      console.error('[反馈历史] 加载失败:', error);
    } finally {
      setLoadingFeedbackHistory(false);
    }
  };

  const openFeedbackDialog = (recordId: string, type: 'correct' | 'incorrect' | 'partial') => {
    setCurrentFeedbackRecordId(recordId);
    setFeedbackType(type);
    setFeedbackReason('');
    setCorrectedFields({});

    // 加载反馈历史
    loadFeedbackHistory(recordId);

    // 获取当前记录的信息，用于自动填充
    const record = dbSearchResults.find(r => r.id === recordId) ||
                   audioFiles.find(f => f.id === recordId);

    if (record && type === 'incorrect') {
      // 自动填充当前AI识别结果，方便用户修正
      const autoFillFields: any = {};

      // 填充情绪
      if (record.summary && record.summary !== '未识别' && record.summary !== '未分类') {
        autoFillFields.mood = {
          original: record.summary,
          corrected: ''
        };
      }

      // 填充影片类型
      if (record.filmType && record.filmType !== '未识别' && record.filmType !== '未分类') {
        autoFillFields.filmType = {
          original: record.filmType,
          corrected: ''
        };
      }

      // 如果有自动填充的内容，默认选中这些字段
      if (Object.keys(autoFillFields).length > 0) {
        setCorrectedFields(autoFillFields);
      }
    }

    setShowFeedbackDialog(true);
  };

  // 提交用户反馈
  const submitFeedback = async () => {
    if (!currentFeedbackRecordId || !feedbackType) {
      alert('请选择反馈类型');
      return;
    }

    if (feedbackType === 'incorrect' && Object.keys(correctedFields).length === 0 && !feedbackReason.trim()) {
      alert('请填写修正内容或说明原因');
      return;
    }

    try {
      // 获取当前记录的信息
      const record = dbSearchResults.find(r => r.id === currentFeedbackRecordId) ||
                     audioFiles.find(f => f.id === currentFeedbackRecordId);

      if (!record) {
        alert('未找到记录');
        return;
      }

      // 构建反馈数据
      const feedbackData = {
        analysisId: currentFeedbackRecordId,
        fileName: record.fileName || record.file?.name || '未知',
        feedbackType,
        correctedFields: feedbackType === 'incorrect' ? correctedFields : undefined,
        userReason: feedbackReason.trim() || undefined,
      };

      // 提交到API
      const response = await fetch('/api/user-feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(feedbackData),
      });

      if (!response.ok) {
        throw new Error('提交失败');
      }

      const result = await response.json();

      if (result.success) {
        alert('反馈提交成功！感谢您的帮助 🙏');
        setShowFeedbackDialog(false);
        setCurrentFeedbackRecordId(null);
        setFeedbackType(null);
        setFeedbackReason('');
        setCorrectedFields({});
      } else {
        throw new Error(result.error || '提交失败');
      }
    } catch (error: any) {
      console.error('[用户反馈] 提交失败:', error);
      alert(`提交失败：${error.message}`);
    }
  };

  // 打开术语帮助卡片
  const openTermHelp = (term: string, category: 'mood' | 'style' | 'filmType' | 'scenario' | 'instrument') => {
    setCurrentHelpTerm(term);
    setCurrentHelpCategory(category);
    setShowTermHelpCard(true);
  };

  // 检测是否是外文文本（中文字符占比 < 50%）
  const isForeignText = (text: string): boolean => {
    if (!text || !text.trim()) return false;

    // 过滤掉无效文本
    if (
      text === '未提取到' ||
      text === '未识别' ||
      text === '未分类' ||
      text === 'N/A' ||
      text === 'Unknown'
    )
      return false;

    const chineseMatches = text.match(/[\u4e00-\u9fa5]+/g) || [];
    const totalChineseChars = chineseMatches.join('').length;
    const totalChars = text.length;
    const chineseRatio = totalChineseChars / totalChars;

    return chineseRatio < 0.5;
  };

  // 翻译文本（专辑或影视名称）
  const translateText = async (texts: string[]): Promise<Record<string, string>> => {
    if (!texts || texts.length === 0) {
      return {};
    }

    // 检查是否需要翻译
    const textsToTranslate = texts.filter(isForeignText);
    if (textsToTranslate.length === 0) {
      // 没有需要翻译的文本
      const result: Record<string, string> = {};
      texts.forEach(text => {
        if (text) result[text] = text;
      });
      return result;
    }

    try {
      console.log(`[翻译] 准备翻译 ${textsToTranslate.length} 个文本`);

      const response = await fetch('/api/translate-text', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ texts: textsToTranslate }),
      });

      if (!response.ok) {
        console.error('[翻译] 翻译API调用失败:', response.statusText);
        return {};
      }

      const data = await response.json();
      if (data.success) {
        console.log(`[翻译] 翻译完成:`, data.translations);
        return data.translations;
      }

      return {};
    } catch (error) {
      console.error('[翻译] 翻译失败:', error);
      return {};
    }
  };
  const [dedupStats, setDedupStats] = useState<{ total: number; online: number; offline: number; uploaded: number; totalUploaded: number } | null>(null);
  const [dbPagination, setDbPagination] = useState({ total: 0, page: 1, totalPages: 1 });
  const [searchFilters, setSearchFilters] = useState({
    emotions: [] as string[],
    films: [] as string[],
    scenarios: [] as string[],
    instruments: [] as string[],
    styles: [] as string[],
    onlineStatus: 'all' as 'all' | 'online' | 'uploaded' | 'offline', // 在线状态筛选：all=全部，online=仅在线，uploaded=仅上传，offline=仅未在线，默认全部
  });

  // 批量下载状态
  const [batchDownloadPackBy, setBatchDownloadPackBy] = useState<'emotion' | 'filmType' | 'scenario' | 'style' | 'none'>('none');
  const [isBatchDownloading, setIsBatchDownloading] = useState(false);

  // 批量下载多选状态
  const [selectedRecordIds, setSelectedRecordIds] = useState<Set<string>>(new Set());

  // 键盘导航：搜索结果列表选中索引
  const [searchResultIndex, setSearchResultIndex] = useState<number>(-1);
  const searchResultListRef = useRef<HTMLDivElement>(null);

  // 词库管理面板状态
  const [showTermManagementPanel, setShowTermManagementPanel] = useState(false);

  // 云端音乐管理面板状态
  const [showCloudMusicPanel, setShowCloudMusicPanel] = useState(false);

  // 映射表管理面板状态
  const [showMappingTablePanel, setShowMappingTablePanel] = useState(false);

  // 帮助面板状态
  const [showHelpPanel, setShowHelpPanel] = useState(false);

  // 自动播放标志：切换文件后是否自动播放
  const [shouldAutoPlay, setShouldAutoPlay] = useState(false);

  // 手动标注场景对话框状态
  const [showManualScenarioDialog, setShowManualScenarioDialog] = useState(false);
  const [editingScenarioItem, setEditingScenarioItem] = useState<any>(null);
  const [selectedStandardScenario, setSelectedStandardScenario] = useState('');

  // 数据库分页状态
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  // 数据库搜索状态（快速搜索框）
  const [searchQuery, setSearchQuery] = useState('');

  // 数据库排序状态
  const [sortBy, setSortBy] = useState<'createdAt' | 'fileName'>('createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // 数据库视图模式
  const [viewMode, setViewMode] = useState<'list' | 'card'>('list');

  // 数据库统计概览展开状态
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());

  // 键盘导航：上传文件列表选中索引
  const [selectedIndex, setSelectedIndex] = useState<number>(-1);
  const fileListRef = useRef<HTMLDivElement>(null);

  // 【性能优化】分析缓存机制
  // 使用文件哈希（文件名+大小）作为key，避免重复分析相同文件
  const [analysisCache, setAnalysisCache] = useState<Record<string, AnalysisResult>>({});

  // 【性能优化】分析配置选项
  const [analysisConfig, setAnalysisConfig] = useState({
    skipOnlineVerification: true, // 默认跳过联网搜索验证，大幅提升速度
    enableCache: true, // 启用缓存机制
    concurrentBatchSize: 6, // 并行批次大小（从4增加到6，提升速度）
    useFastAPI: true, // 使用精简版API，减少Prompt长度，加快处理速度
    skipMD5Calculation: false, // 跳过MD5计算（大文件可以开启）
    skipMetadataExtraction: false, // 跳过元数据提取（可以提升速度）
    skipSceneReanalysis: false, // 跳过二次识别（可以大幅提升速度）
  });

  // 数据库筛选栏状态
  const [filterTimeRange, setFilterTimeRange] = useState<'all' | '7d' | '30d' | '90d'>('all');

  // 【词库管理】标准词库缓存
  const [standardVocabulary, setStandardVocabulary] = useState<{
    emotion: string[];
    style: string[];
    instrument: string[];
    film: string[];
    scenario: string[];
    dubbing: string[];
  }>({
    emotion: [],
    style: [],
    instrument: [],
    film: [],
    scenario: [],
    dubbing: [],
  });

  // 数据库清空确认对话框状态
  const [showClearConfirmDialog, setShowClearConfirmDialog] = useState(false);
  const [clearPassword, setClearPassword] = useState('');
  const [clearError, setClearError] = useState('');
  const [clearMode, setClearMode] = useState<'all' | 'userOnly'>('userOnly'); // 清空模式：all=清空所有数据，userOnly=仅清空用户数据

  // 播放队列管理：支持上传文件列表和数据库搜索结果列表
  const [playQueueMode, setPlayQueueMode] = useState<'uploaded' | 'search'>('uploaded'); // 当前播放队列模式
  const [currentSearchIndex, setCurrentSearchIndex] = useState(-1); // 当前播放的搜索结果索引

  // 数据库文件包展开状态（用于按文件包归类展示）
  const [expandedMusicPackages, setExpandedMusicPackages] = useState<Set<string>>(new Set());

  // 高级检索：音乐风格分类展开状态
  const [expandedStyleCategories, setExpandedStyleCategories] = useState<Set<string>>(new Set());

  // 高级检索：各分类搜索关键词
  const [emotionSearchKeyword, setEmotionSearchKeyword] = useState('');
  const [filmSearchKeyword, setFilmSearchKeyword] = useState('');
  const [scenarioSearchKeyword, setScenarioSearchKeyword] = useState('');
  const [instrumentSearchKeyword, setInstrumentSearchKeyword] = useState('');
  const [styleSearchKeyword, setStyleSearchKeyword] = useState('');
  const [globalSearchKeyword, setGlobalSearchKeyword] = useState('');
  const [showGlobalSearchResults, setShowGlobalSearchResults] = useState(false);

  // 高级检索：各分类排序方式（default: 默认按数量降序, english: 英文首字母, radical: 中文部首）
  const [emotionSortOrder, setEmotionSortOrder] = useState<'default' | 'english' | 'radical'>('default');
  const [filmSortOrder, setFilmSortOrder] = useState<'default' | 'english' | 'radical'>('default');
  const [scenarioSortOrder, setScenarioSortOrder] = useState<'default' | 'english' | 'radical'>('default');
  const [instrumentSortOrder, setInstrumentSortOrder] = useState<'default' | 'english' | 'radical'>('default');
  const [styleSortOrder, setStyleSortOrder] = useState<'default' | 'english' | 'radical'>('default');

  // 重新分析功能：全选状态
  const [selectAll, setSelectAll] = useState(false);

  // 访达标签映射功能
  const [showTagMappingPanel, setShowTagMappingPanel] = useState(false);
  const [tagMappings, setTagMappings] = useState<TagMapping[]>([
    { moodKeyword: '积极', tagColor: 'green', tagName: '积极' },
    { moodKeyword: '励志', tagColor: 'blue', tagName: '励志' },
    { moodKeyword: '悲伤', tagColor: 'gray', tagName: '悲伤' },
    { moodKeyword: '紧张', tagColor: 'orange', tagName: '紧张' },
    { moodKeyword: '浪漫', tagColor: 'purple', tagName: '浪漫' },
    { moodKeyword: '平静', tagColor: 'yellow', tagName: '平静' },
    { moodKeyword: '快乐', tagColor: 'red', tagName: '快乐' },
    { moodKeyword: '愤怒', tagColor: 'red', tagName: '愤怒' },
  ]);

  const audioRef = useRef<HTMLAudioElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationRef = useRef<number | undefined>(undefined);
  const lastAudioUrlRef = useRef<string>(''); // 跟踪上一个音频URL，避免不必要的重新加载
  const debouncedSearchRef = useRef<((autoSelectFirst?: boolean) => void) | null>(null); // 防抖搜索函数引用

  // 【改进】使用 useRef 保存可变状态，解决事件处理器闭包陷阱问题
  const audioFilesRef = useRef<AudioFileItem[]>([]);
  const currentFileIdRef = useRef<string>('');

  // 【改进】使用 Map 跟踪所有创建的 Blob URL，便于清理
  const blobUrlsMap = useRef<Map<string, string>>(new Map());

  // 【修复】使用原生 console 避免 Next.js 错误捕获机制的二次封装
  const nativeConsole = useRef({
    log: console.log.bind(console),
    error: console.error.bind(console),
    warn: console.warn.bind(console),
    info: console.info.bind(console)
  }).current;

  // 【改进】通知管理函数
  const addNotification = (
    type: 'error' | 'warning' | 'info' | 'success',
    message: string,
    autoClose: boolean = true,
    duration: number = 5000
  ) => {
    const id = Date.now().toString() + Math.random().toString(36).substr(2, 9);
    setNotifications(prev => [...prev, { id, type, message, autoClose, duration }]);

    // 自动关闭
    if (autoClose) {
      setTimeout(() => {
        removeNotification(id);
      }, duration);
    }
  };

  const removeNotification = (id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  const clearAllNotifications = () => {
    setNotifications([]);
  };

  // 【改进】同步状态到 ref，确保事件处理器始终访问最新值
  useEffect(() => {
    audioFilesRef.current = audioFiles;
  }, [audioFiles]);

  useEffect(() => {
    currentFileIdRef.current = currentFileId;
  }, [currentFileId]);

  // 获取当前文件项
  const getCurrentFile = useCallback((): AudioFileItem | null => {
    return audioFiles.find(f => f.id === currentFileId) || null;
  }, [audioFiles, currentFileId]);

  // 获取当前音乐信息（支持云端音乐）
  const getCurrentMusicInfo = useCallback(() => {
    // 优先从搜索结果中获取（支持云端音乐）
    if (playQueueMode === 'search' && currentSearchIndex >= 0 && dbSearchResults[currentSearchIndex]) {
      return dbSearchResults[currentSearchIndex];
    }

    // 否则从本地文件中获取
    const localFile = getCurrentFile();
    if (localFile) {
      return {
        fileName: localFile.file.name,
        result: localFile.result,
        features: localFile.features,
      };
    }

    return null;
  }, [playQueueMode, currentSearchIndex, dbSearchResults, getCurrentFile]);

  // 获取当前文件的特征（便捷访问）
  const currentFeatures = getCurrentFile()?.features || null;
  const currentResult = getCurrentFile()?.result || null;

  // 添加文件
  const addFiles = useCallback(async (files: FileList) => {
    try {
      // 从 IndexedDB 加载所有已存在的记录，用于匹配相同文件名
      const persistedFiles = await audioFilesDB.loadAll();
      const existingFilesMap = new Map<string, AudioFileItemDB>();

      // 构建文件名到记录的映射（只保留最新的有分析结果的记录）
      persistedFiles.forEach(dbItem => {
        // 只有当没有同名记录，或者当前记录有分析结果而之前没有时，才保留
        const existing = existingFilesMap.get(dbItem.fileName);
        if (!existing || (!existing.result && dbItem.result)) {
          existingFilesMap.set(dbItem.fileName, dbItem);
        }
      });

      console.log('[文件上传] IndexedDB 中已存在的记录数量:', existingFilesMap.size);

      const newFiles: AudioFileItem[] = [];
      const oldFileIdsToDelete: string[] = [];
      const invalidFiles: string[] = [];

      // 支持的音频文件类型
      const supportedAudioTypes = [
        'audio/mpeg',
        'audio/mp3',
        'audio/wav',
        'audio/wave',
        'audio/ogg',
        'audio/webm',
        'audio/flac',
        'audio/aac',
        'audio/x-mpeg-3',
        'audio/x-wav',
      ];

      Array.from(files).forEach(file => {
        // 验证文件类型
        const fileType = file.type.toLowerCase();
        const fileExtension = file.name.split('.').pop()?.toLowerCase() || '';
        const isAudioFile = supportedAudioTypes.some(type => fileType.includes(type)) ||
                           ['mp3', 'wav', 'ogg', 'webm', 'flac', 'aac', 'm4a'].includes(fileExtension);

        if (!isAudioFile) {
          invalidFiles.push(file.name);
          console.warn(`[文件上传] 跳过不支持的文件类型: ${file.name} (${fileType})`);
          return;
        }
        // 检查是否已存在相同文件名的记录
        const existingFile = existingFilesMap.get(file.name);
        const fileId = Date.now().toString() + Math.random().toString(36).substr(2, 9);

        // 如果找到旧的同名文件，记录其 ID 以便删除
        if (existingFile) {
          oldFileIdsToDelete.push(existingFile.id);
          console.log(`[文件上传] 发现旧同名文件，准备删除: ${file.name} (旧ID: ${existingFile.id})`);
        }

        if (existingFile && (existingFile.features || existingFile.result)) {
          // 如果存在且已有分析结果，加载之前的数据
          console.log(`[文件上传] 发现已有记录，加载分析结果: ${file.name}`);
          // 从文件名推断正确的MIME类型
          const fileExtension = existingFile.fileName.split('.').pop()?.toLowerCase() || '';
          const extensionToMime: Record<string, string> = {
            'mp3': 'audio/mpeg',
            'wav': 'audio/wav',
            'ogg': 'audio/ogg',
            'webm': 'audio/webm',
            'flac': 'audio/flac',
            'aac': 'audio/aac',
            'm4a': 'audio/mp4',
            'mp4': 'audio/mp4',
            'wma': 'audio/x-ms-wma',
            'aiff': 'audio/aiff',
            'aif': 'audio/aiff',
            'aifc': 'audio/aiff',
          };
          
          // 优先使用推断的MIME类型，如果推断失败则使用数据库存储的类型或默认类型
          const inferredType = extensionToMime[fileExtension] || 'audio/mpeg';
          const finalFileType = existingFile.fileType && existingFile.fileType.startsWith('audio/') 
            ? existingFile.fileType 
            : inferredType;

          const savedFile = new File([existingFile.fileData!], existingFile.fileName, {
            type: finalFileType,
            lastModified: Date.now(),
          });

          // 总是创建新的 Blob URL，避免使用失效的旧URL
          const audioUrl = URL.createObjectURL(savedFile);
          console.log(`[文件上传] 创建新的 Blob URL: ${audioUrl.substring(0, 30)}...`);

          // 转换 uploadStatus 类型：'error' -> 'failed', 'uploading' -> 'pending'
          const uploadStatus: 'pending' | 'success' | 'failed' =
            existingFile.uploadStatus === 'error' ? 'failed' :
            existingFile.uploadStatus === 'uploading' ? 'pending' :
            existingFile.uploadStatus === 'success' ? 'success' : 'pending';

          newFiles.push({
            id: fileId,
            file: savedFile,
            audioUrl,
            features: existingFile.features,
            result: existingFile.result,
            isAnalyzing: existingFile.isAnalyzing || false,
            error: existingFile.error || '',
            // 上传状态
            isUploading: existingFile.isUploading || false,
            uploadProgress: existingFile.uploadProgress,
            uploadStatus,
            uploadError: existingFile.uploadError,
            fileKey: existingFile.fileKey || null,
            isUploaded: existingFile.isUploaded || false,
            isOnline: existingFile.isOnline !== undefined ? existingFile.isOnline : true,
            uploadedAt: existingFile.uploadedAt || null,
            // 重新分析状态
            selected: existingFile.selected || false,
            reAnalyzing: existingFile.reAnalyzing || false,
            musicMd5: existingFile.musicMd5,
          });
        } else {
          // 不存在或没有分析结果，创建新记录
          console.log(`[文件上传] 创建新记录: ${file.name}`);

          // 从文件名推断并修正MIME类型（确保类型正确）
          const fileExtension = file.name.split('.').pop()?.toLowerCase() || '';
          const extensionToMime: Record<string, string> = {
            'mp3': 'audio/mpeg',
            'wav': 'audio/wav',
            'ogg': 'audio/ogg',
            'webm': 'audio/webm',
            'flac': 'audio/flac',
            'aac': 'audio/aac',
            'm4a': 'audio/mp4',
            'mp4': 'audio/mp4',
            'wma': 'audio/x-ms-wma',
            'aiff': 'audio/aiff',
            'aif': 'audio/aiff',
            'aifc': 'audio/aiff',
          };
          const inferredType = extensionToMime[fileExtension] || 'audio/mpeg';
          const finalFileType = file.type && file.type.startsWith('audio/') ? file.type : inferredType;

          // 创建一个具有正确MIME类型的新File对象
          const correctedFile = new File([file], file.name, {
            type: finalFileType,
            lastModified: file.lastModified,
          });

          console.log(`[文件上传] 文件MIME类型修正: ${file.type} -> ${finalFileType}`);

          newFiles.push({
            id: fileId,
            file: correctedFile,
            audioUrl: URL.createObjectURL(correctedFile),
            features: null,
            result: null,
            isAnalyzing: false,
            error: '',
            // 上传状态
            isUploading: false,
            uploadStatus: 'pending',
            uploadError: undefined,
            fileKey: null,
            isUploaded: false, // 默认未上传
            isOnline: true, // 默认在线状态（仅本地存储）
            uploadedAt: null,
            // 重新分析状态
            selected: false,
            reAnalyzing: false,
          });
        }
      });

      // 删除旧的同名文件
      if (oldFileIdsToDelete.length > 0) {
        setAudioFiles(prev => prev.filter(f => !oldFileIdsToDelete.includes(f.id)));
        console.log(`[文件上传] 已删除 ${oldFileIdsToDelete.length} 个旧的同名文件`);
      }

      // 添加新文件
      setAudioFiles(prev => [...prev, ...newFiles]);

      // 如果是第一个文件，设置为当前文件
      if (!currentFileId && newFiles.length > 0) {
        setCurrentFileId(newFiles[0].id);
      }

      console.log(`[文件上传] 成功添加 ${newFiles.length} 个文件`);

      // 提示用户被跳过的无效文件
      if (invalidFiles.length > 0) {
        const message = `已跳过 ${invalidFiles.length} 个不支持的文件格式：${invalidFiles.slice(0, 3).join(', ')}${invalidFiles.length > 3 ? '...' : ''}`;
        console.warn('[文件上传]', message);
        addNotification('warning', message);
      }
    } catch (error) {
      console.error('[文件上传] 加载已存在记录失败:', error);
      // 出错时仍然创建新文件，但要验证文件类型
      const validFiles: File[] = [];
      const invalidFilesInCatch: string[] = [];

      const supportedAudioTypes = [
        'audio/mpeg',
        'audio/mp3',
        'audio/wav',
        'audio/wave',
        'audio/ogg',
        'audio/webm',
        'audio/flac',
        'audio/aac',
      ];

      Array.from(files).forEach(file => {
        const fileType = file.type.toLowerCase();
        const fileExtension = file.name.split('.').pop()?.toLowerCase() || '';
        const isAudioFile = supportedAudioTypes.some(type => fileType.includes(type)) ||
                           ['mp3', 'wav', 'ogg', 'webm', 'flac', 'aac', 'm4a'].includes(fileExtension);

        if (isAudioFile) {
          validFiles.push(file);
        } else {
          invalidFilesInCatch.push(file.name);
          console.warn(`[文件上传] 跳过不支持的文件类型: ${file.name} (${fileType})`);
        }
      });

      const newFiles: AudioFileItem[] = validFiles.map(file => {
        // 从文件名推断并修正MIME类型
        const fileExtension = file.name.split('.').pop()?.toLowerCase() || '';
        const extensionToMime: Record<string, string> = {
          'mp3': 'audio/mpeg',
          'wav': 'audio/wav',
          'ogg': 'audio/ogg',
          'webm': 'audio/webm',
          'flac': 'audio/flac',
          'aac': 'audio/aac',
          'm4a': 'audio/mp4',
          'mp4': 'audio/mp4',
          'wma': 'audio/x-ms-wma',
          'aiff': 'audio/aiff',
          'aif': 'audio/aiff',
          'aifc': 'audio/aiff',
        };
        const inferredType = extensionToMime[fileExtension] || 'audio/mpeg';
        const finalFileType = file.type && file.type.startsWith('audio/') ? file.type : inferredType;

        // 创建一个具有正确MIME类型的新File对象
        const correctedFile = new File([file], file.name, {
          type: finalFileType,
          lastModified: file.lastModified,
        });

        return {
          id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
          file: correctedFile,
          audioUrl: URL.createObjectURL(correctedFile),
          features: null,
          result: null,
          isAnalyzing: false,
          error: '',
          // 上传状态
          isUploading: false,
          uploadStatus: 'pending',
          uploadError: undefined,
          fileKey: null,
          isUploaded: false, // 默认未上传
          isOnline: true, // 默认在线状态（仅本地存储）
          uploadedAt: null,
          // 重新分析状态
          selected: false,
          reAnalyzing: false,
        };
      });

      setAudioFiles(prev => [...prev, ...newFiles]);

      if (!currentFileId && newFiles.length > 0) {
        setCurrentFileId(newFiles[0].id);
      }

      // 提示用户被跳过的无效文件
      if (invalidFilesInCatch.length > 0) {
        const message = `已跳过 ${invalidFilesInCatch.length} 个不支持的文件格式：${invalidFilesInCatch.slice(0, 3).join(', ')}${invalidFilesInCatch.length > 3 ? '...' : ''}`;
        console.warn('[文件上传]', message);
        addNotification('warning', message);
      }
    }
  }, [currentFileId]);

  // 删除文件
  const removeFile = useCallback(async (id: string) => {
    // 从 IndexedDB 删除数据
    try {
      await audioFilesDB.deleteOne(id);
      console.log(`[删除文件] 已从 IndexedDB 删除: ${id}`);
    } catch (error) {
      console.error(`[删除文件] 从 IndexedDB 删除失败: ${id}`, error);
    }

    // 从内存中删除
    setAudioFiles(prev => {
      const newFiles = prev.filter(f => f.id !== id);
      // 如果删除的是当前文件，切换到第一个
      if (id === currentFileId && newFiles.length > 0) {
        setCurrentFileId(newFiles[0].id);
      }
      return newFiles;
    });
  }, [currentFileId]);

  // 切换当前文件
  const switchToFile = useCallback(async (id: string) => {
    const file = audioFiles.find(f => f.id === id);
    if (file && id !== currentFileId) {
      setCurrentFileId(id);
      // 不要在这里重置播放状态，让useEffect处理音频加载
      // 只重置显示相关的状态
      setStreamText('');
      setShowDetails(false);
      setEditingModule(null);
      // 禁用自动播放
    }
  }, [audioFiles, currentFileId]);

  // 获取云端音乐签名 URL
  const getCloudMusicUrl = async (recordId: string, fileName: string): Promise<string | null> => {
    try {
      const response = await fetch(`/api/download-music?id=${recordId}`);
      const data = await response.json();

      if (!data.success) {
        console.error('获取云端音乐 URL 失败:', data.error);
        return null;
      }

      return data.data.downloadUrl;
    } catch (error) {
      console.error('获取云端音乐 URL 失败:', error);
      return null;
    }
  };

  // 通过文件名从audioFiles中查找并播放
  const playByFileName = useCallback(async (fileName: string) => {
    const matchedFile = audioFiles.find(f => f.file.name === fileName);
    if (matchedFile) {
      // 检查是否在搜索结果中
      const searchIndex = dbSearchResults.findIndex(r => r.fileName === fileName);
      if (searchIndex !== -1) {
        // 如果在搜索结果中，切换到搜索结果模式
        setPlayQueueMode('search');
        setCurrentSearchIndex(searchIndex);
      } else {
        // 否则切换到上传文件模式
        setPlayQueueMode('uploaded');
      }

      switchToFile(matchedFile.id);

      // 延迟一下让音频源切换完成
      setTimeout(() => {
        if (audioRef.current) {
          audioRef.current.play().catch(err => {
            handlePlayError(err, matchedFile.file.name);
          });
        }
      }, 100);
    } else {
      // 检查是否在数据库搜索结果中，如果是，尝试播放云端音乐
      const dbRecord = dbSearchResults.find(r => r.fileName === fileName);
      if (dbRecord) {
        // 检查文件是否可访问（使用动态计算的 musicStatus 字段）
        if (dbRecord.musicStatus === 'offline') {
          alert('该音乐未在线，请先将音乐转为在线状态');
          return;
        }

        // 云端音乐：获取签名 URL 并播放
        if (dbRecord.fileKey) {
          const cloudUrl = await getCloudMusicUrl(dbRecord.id, fileName);
          if (cloudUrl) {
            // 切换到搜索结果模式
            const searchIndex = dbSearchResults.findIndex(r => r.fileName === fileName);
            if (searchIndex !== -1) {
              setPlayQueueMode('search');
              setCurrentSearchIndex(searchIndex);
            }

            // 直接播放云端 URL
            if (audioRef.current) {
              audioRef.current.src = cloudUrl;
              audioRef.current.play().catch(err => {
                handlePlayError(err, fileName);
              });
            }
          } else {
            alert('获取云端音乐链接失败，请重试');
          }
        } else {
          // 文件在数据库中但未上传到云端
          alert(`文件 "${fileName}" 已保存到数据库但未上传到云端。\n\n如需播放，请选择以下操作：\n1. 重新上传该音乐文件到本地\n2. 在数据库管理中批量上传到云端`);
        }
      } else {
        // 文件不在本地列表，也不在数据库搜索结果中
        // 可能是刚刷新页面，文件还在数据库但不在当前搜索结果中
        // 尝试从数据库查询该文件
        try {
          const response = await fetch(`/api/music-analyses/search?fileName=${encodeURIComponent(fileName)}&limit=1`);
          const data = await response.json();

          if (data.success && data.data.length > 0) {
            const record = data.data[0];
            if (record.musicStatus === 'cloud' && record.fileKey) {
              // 云端音乐，播放
              const cloudUrl = await getCloudMusicUrl(record.id, fileName);
              if (cloudUrl && audioRef.current) {
                audioRef.current.src = cloudUrl;
                audioRef.current.play().catch(err => {
                  handlePlayError(err, fileName);
                });
              }
            } else if (record.musicStatus === 'online') {
              // 在线音乐但不在本地，提示重新上传
              alert(`文件 "${fileName}" 在数据库中标记为"在线"但不在本地列表。\n\n请重新上传该音乐文件到本地，或在数据库管理中将其上传到云端。`);
            } else {
              alert(`文件 "${fileName}" 未在线，请先将音乐转为在线状态`);
            }
          } else {
            // 数据库中也没有该文件
            alert(`文件 "${fileName}" 未上传到系统，请先上传该音乐文件`);
          }
        } catch (error) {
          console.error('查询文件失败:', error);
          alert(`文件 "${fileName}" 未上传，请先上传该音乐文件`);
        }
      }
    }
  }, [audioFiles, dbSearchResults, switchToFile]);

  // 下载单首音乐
  const downloadSingleMusic = async (recordId: string, fileName: string) => {
    try {
      // 先检查音乐是否可访问（使用动态计算的 musicStatus 字段）
      const record = dbSearchResults.find(r => r.id === recordId);
      if (!record) {
        alert('未找到音乐记录');
        return;
      }
      if (record.musicStatus === 'offline') {
        alert('该音乐未在线，请先将音乐转为在线状态');
        return;
      }

      // 优先从本地 audioFiles 中读取
      const localFile = audioFiles.find(f => f.file?.name === fileName);

      if (localFile?.file) {
        // 本地文件：直接下载
        const blobUrl = window.URL.createObjectURL(localFile.file);
        const link = document.createElement('a');
        link.href = blobUrl;
        link.download = fileName;
        link.click();
        window.URL.revokeObjectURL(blobUrl);
        return;
      }

      // 云端文件：调用下载 API 获取签名 URL
      const response = await fetch(`/api/download-music?id=${recordId}`);
      const data = await response.json();

      if (!data.success) {
        alert(data.error || '下载失败');
        return;
      }

      // 获取签名 URL 并下载
      const downloadUrl = data.data.downloadUrl;
      if (downloadUrl) {
        const blob = await fetch(downloadUrl).then(r => r.blob());
        const blobUrl = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = blobUrl;
        link.download = data.data.fileName;
        link.click();
        window.URL.revokeObjectURL(blobUrl);
      } else {
        alert('无法下载该音乐文件');
      }
    } catch (error) {
      console.error('下载失败:', error);
      alert('下载失败');
    }
  };

  // 处理记录选择（单个）
  const toggleRecordSelection = (recordId: string) => {
    setSelectedRecordIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(recordId)) {
        newSet.delete(recordId);
      } else {
        newSet.add(recordId);
      }
      return newSet;
    });
  };

  // 处理全选/取消全选（批量下载用）
  const toggleRecordSelectAll = () => {
    const allIds = new Set(dbSearchResults.map(r => r.id));
    if (selectedRecordIds.size === dbSearchResults.length && dbSearchResults.length > 0) {
      // 全部选中时，取消全选
      setSelectedRecordIds(new Set());
    } else {
      // 否则全选
      setSelectedRecordIds(allIds);
    }
  };

  // 检查是否全部选中
  const isAllSelected = selectedRecordIds.size === dbSearchResults.length && dbSearchResults.length > 0;
  // 检查是否部分选中
  const isPartiallySelected = selectedRecordIds.size > 0 && selectedRecordIds.size < dbSearchResults.length;

  // 检查专辑的选中状态
  const getPackageSelectionState = (packageName: string, packageItems: any[]) => {
    const selectedCount = packageItems.filter((item: any) => selectedRecordIds.has(item.id)).length;

    if (selectedCount === 0) {
      return 'none'; // 未选中
    } else if (selectedCount === packageItems.length) {
      return 'all'; // 全部选中
    } else {
      return 'partial'; // 部分选中
    }
  };

  // 处理专辑/包选择（全选专辑内所有音乐）
  const togglePackageSelection = (packageName: string, packageItems: any[]) => {
    const packageRecordIds = new Set(packageItems.map((item: any) => item.id));
    const packageSelectionState = getPackageSelectionState(packageName, packageItems);

    setSelectedRecordIds(prev => {
      const newSet = new Set(prev);

      if (packageSelectionState === 'all') {
        // 全部选中时，取消选中专辑下所有音乐
        packageRecordIds.forEach(id => newSet.delete(id));
      } else {
        // 部分选中或未选中时，选中专辑下所有音乐
        packageRecordIds.forEach(id => newSet.add(id));
      }

      return newSet;
    });
  };

  // 批量打包下载音乐（前端打包，支持本地在线音乐）
  const batchDownloadMusic = async () => {
    try {
      setIsBatchDownloading(true);

      // 如果有选中的记录，只下载选中的；否则下载全部
      let recordsToDownload: typeof dbSearchResults;

      if (selectedRecordIds.size > 0) {
        recordsToDownload = dbSearchResults.filter(r => selectedRecordIds.has(r.id));
      } else {
        recordsToDownload = dbSearchResults;
      }

      // 检查是否有有效的记录
      if (recordsToDownload.length === 0) {
        alert('暂无选中的音乐可打包下载，请先选择要下载的音乐');
        return;
      }

      // 检查是否有未在线的音乐（既不在本地在线，也没有上传到云端）
      const offlineRecords = recordsToDownload.filter(r => !r.isOnline && !r.isUploaded);
      if (offlineRecords.length > 0) {
        alert(`有 ${offlineRecords.length} 首音乐未在线且未上传云端，请先将这些音乐转为「在线」状态或「上传云端」后再下载`);
        return;
      }

      // 导入 JSZip
      const JSZip = (await import('jszip')).default;

      // 创建 ZIP 对象
      const zip = new JSZip();

      // 按分类分组
      const groupedRecords = new Map<string, typeof dbSearchResults>();

      if (batchDownloadPackBy === 'none') {
        // 不按分类，直接打包
        groupedRecords.set('全部音乐', recordsToDownload);
      } else {
        // 按指定分类分组
        recordsToDownload.forEach((record) => {
          let category = '未分类';

          switch (batchDownloadPackBy) {
            case 'emotion':
              category = record.summary || '未分类';
              break;
            case 'filmType':
              category = record.filmType || '未分类';
              break;
            case 'scenario':
              category =
                record.scenarios && record.scenarios.length > 0
                  ? record.scenarios[0]
                  : '无场景';
              break;
            case 'style':
              category =
                record.styles && record.styles.length > 0
                  ? record.styles[0]
                  : '未分类';
              break;
          }

          if (!groupedRecords.has(category)) {
            groupedRecords.set(category, []);
          }
          groupedRecords.get(category)!.push(record);
        });
      }

      // 按分组添加文件到 ZIP
      let fileCount = 0;
      for (const [category, recordsInGroup] of groupedRecords.entries()) {
        const folder = zip.folder(category);

        for (const record of recordsInGroup) {
          try {
            // 优先从本地 audioFiles 中读取
            const localFile = audioFiles.find(f => f.file?.name === record.fileName);
            if (localFile?.file) {
              // 本地文件（在线但未上传）
              folder?.file(record.fileName, localFile.file);
              fileCount++;
            } else if (record.fileKey) {
              // 云端文件（需要从对象存储下载）
              const response = await fetch(`/api/download-music?id=${record.id}`);
              const data = await response.json();

              if (data.success && data.data?.downloadUrl) {
                // 从签名 URL 下载文件
                const fileResponse = await fetch(data.data.downloadUrl);
                const fileBlob = await fileResponse.blob();
                folder?.file(record.fileName, fileBlob);
                fileCount++;
              } else {
                console.warn(`无法下载云端文件: ${record.fileName}`, data);
              }
            } else {
              console.warn(`找不到文件: ${record.fileName}`);
            }
          } catch (error) {
            console.error(`处理文件失败: ${record.fileName}`, error);
          }
        }
      }

      // 生成 ZIP 文件
      const zipBlob = await zip.generateAsync({ type: 'blob' });

      // 下载 ZIP 文件
      const blobUrl = window.URL.createObjectURL(zipBlob);
      const link = document.createElement('a');
      link.href = blobUrl;

      // 生成文件名（带时间戳）
      const timestamp = new Date().toISOString().slice(0, 10);
      link.download = `音乐_${timestamp}.zip`;
      link.click();
      window.URL.revokeObjectURL(blobUrl);

      console.log(`批量下载完成，共打包 ${fileCount} 个文件`);
    } catch (error) {
      console.error('批量打包下载失败:', error);
      alert('批量打包下载失败，请查看控制台了解详情');
    } finally {
      setIsBatchDownloading(false);
    }
  };

  // 批量上传到云端
  const handleBatchUploadToCloud = async () => {
    const selectedFiles = audioFiles.filter(f => f.selected && f.result !== null);

    if (selectedFiles.length === 0) {
      alert('请先选择要上传的音乐文件');
      return;
    }

    if (confirm(`确定要将 ${selectedFiles.length} 个音乐文件上传到扣子云端存储吗？\n\n⚠️ 注意：由于服务器限制，上传云端的文件不能大于10MB\n\n上传后文件将在云端长期保存，可随时下载和播放。`)) {
      try {
        // 更新所有选中文件的上传状态
        setAudioFiles(prev =>
          prev.map(f =>
            f.selected && f.result !== null
              ? { ...f, isUploading: true, uploadProgress: 0 }
              : f
          )
        );

        // 逐个上传文件，避免单次请求体过大导致 HTTP 413 错误
        const uploadedFiles: any[] = [];
        const failedFiles: any[] = [];
        const totalFiles = selectedFiles.length;

        for (let i = 0; i < selectedFiles.length; i++) {
          const fileItem = selectedFiles[i];

          try {
            // 为每个文件创建单独的 FormData
            const formData = new FormData();
            formData.append('files', fileItem.file);

            // 使用 XMLHttpRequest 单独上传当前文件
            const uploadResult = await new Promise((resolve, reject) => {
              const xhr = new XMLHttpRequest();

              // 监听上传进度
              xhr.upload.onprogress = (event) => {
                if (event.lengthComputable) {
                  const progress = Math.round((event.loaded / event.total) * 100);
                  // 更新当前文件的上传进度
                  setAudioFiles(prev =>
                    prev.map(f =>
                      f.id === fileItem.id && f.isUploading
                        ? { ...f, uploadProgress: progress }
                        : f
                    )
                  );
                }
              };

              xhr.onload = () => {
                console.log(`[批量上传] 文件 ${i + 1}/${totalFiles} 上传完成，状态码: ${xhr.status}`);
                if (xhr.status === 200) {
                  try {
                    const response = JSON.parse(xhr.responseText);
                    if (response.success) {
                      resolve(response);
                    } else {
                      reject(new Error(response.error || '上传失败'));
                    }
                  } catch (e) {
                    reject(new Error(`响应解析失败: ${xhr.responseText}`));
                  }
                } else {
                  reject(new Error(`上传失败: HTTP ${xhr.status}`));
                }
              };

              xhr.onerror = () => {
                console.error(`[批量上传] 文件 ${i + 1}/${totalFiles} 网络错误`);
                reject(new Error('上传失败: 网络错误'));
              };

              xhr.ontimeout = () => {
                console.error(`[批量上传] 文件 ${i + 1}/${totalFiles} 超时`);
                reject(new Error('上传失败: 超时'));
              };

              // 设置 5 分钟超时（单个文件上传时间）
              xhr.timeout = 5 * 60 * 1000;

              // 发送请求
              xhr.open('POST', '/api/cloud-music/upload-file');
              xhr.send(formData);
            });

            const result = uploadResult as any;
            uploadedFiles.push(...(result.data.uploadedFiles || []));

            // 更新上传成功的文件状态
            setAudioFiles(prev =>
              prev.map(f => {
                const uploadedFile = result.data.uploadedFiles.find(
                  (uf: any) => uf.fileName === f.file.name
                );
                if (uploadedFile) {
                  return {
                    ...f,
                    uploadStatus: 'success',
                    fileKey: uploadedFile.fileKey,
                    isUploaded: true,
                    isOnline: true,
                    uploadedAt: uploadedFile.uploadedAt,
                    isUploading: false,
                    uploadProgress: 100,
                  };
                }
                return f;
              })
            );
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : '上传失败';
            console.error(`[批量上传] 文件 ${i + 1}/${totalFiles} 失败:`, error);

            failedFiles.push({
              fileName: fileItem.file.name,
              error: errorMessage,
            });

            // 更新上传失败的文件状态
            setAudioFiles(prev =>
              prev.map(f =>
                f.id === fileItem.id
                  ? {
                      ...f,
                      uploadStatus: 'failed',
                      uploadError: errorMessage,
                      isUploading: false,
                      uploadProgress: 0,
                    }
                  : f
              )
            );
          }
        }

        console.log(`[批量上传] 全部完成，成功 ${uploadedFiles.length} 个，失败 ${failedFiles.length} 个`);

        // 处理上传成功的文件和失败的文件

        // 更新上传成功的文件状态
        setAudioFiles(prev =>
          prev.map(f => {
            const uploadedFile = uploadedFiles.find(
              (uf: any) => uf.fileName === f.file.name
            );
            if (uploadedFile) {
              return {
                ...f,
                uploadStatus: 'success',
                fileKey: uploadedFile.fileKey,
                isUploaded: true,
                isOnline: true,
                uploadedAt: uploadedFile.uploadedAt,
                isUploading: false,
                uploadProgress: 100,
              };
            }
            return f;
          })
        );

        // 更新上传失败的文件状态
        if (failedFiles.length > 0) {
          setAudioFiles(prev =>
            prev.map(f => {
              const failedFile = failedFiles.find(
                (ff: any) => ff.fileName === f.file.name
              );
              if (failedFile) {
                return {
                  ...f,
                  uploadStatus: 'failed',
                  uploadError: failedFile.error,
                  isUploading: false,
                  uploadProgress: 0,
                };
              }
              return f;
            })
          );
        }

        // 显示结果
        alert(`批量上传完成！\n\n成功: ${uploadedFiles.length} 个文件\n失败: ${failedFiles.length} 个文件${failedFiles.length > 0 ? '\n\n' + failedFiles.map((ff: any) => `- ${ff.fileName}: ${ff.error}`).join('\n') : ''}`);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : '未知错误';
        console.error(`[批量上传] 失败:`, error);
        console.error(`[批量上传] 错误类型: ${error instanceof Error ? error.constructor.name : typeof error}`);

        // 重置所有正在上传的文件状态
        setAudioFiles(prev =>
          prev.map(f =>
            f.isUploading
              ? {
                  ...f,
                  uploadStatus: 'failed',
                  uploadError: errorMessage,
                  isUploading: false,
                  uploadProgress: 0,
                }
              : f
          )
        );

        alert(`批量上传失败：${errorMessage}`);
      }
    }
  };

  // 清空所有文件
  const clearAllFiles = useCallback(async () => {
    // 清空 IndexedDB 中的持久化数据
    try {
      await audioFilesDB.clearAll();
      console.log('[清空全部] IndexedDB 已清空');
    } catch (error) {
      console.error('[清空全部] 清空 IndexedDB 失败:', error);
    }

    // 【重要】同步更新数据库中的 is_online 状态为 false
    try {
      const response = await fetch('/api/music-analyses/clear', {
        method: 'DELETE',
      });
      if (response.ok) {
        console.log('[清空全部] 数据库状态已更新为离线');
        // 刷新数据库统计
        await loadDatabaseStats();
      } else {
        console.error('[清空全部] 更新数据库状态失败');
      }
    } catch (error) {
      console.error('[清空全部] 更新数据库状态出错:', error);
    }

    // 清空内存中的数据
    audioFiles.forEach(f => URL.revokeObjectURL(f.audioUrl));
    setAudioFiles([]);
    setCurrentFileId('');
    setStreamText('');
    setShowDetails(false);
    setEditingModule(null);
  }, [audioFiles]);

  // 重新分析功能：切换单个文件勾选状态
  const toggleSelectFile = useCallback((id: string) => {
    setAudioFiles(prev => prev.map(f =>
      f.id === id ? { ...f, selected: !f.selected } : f
    ));
  }, []);

  // 重新分析功能：全选/取消全选
  const toggleSelectAll = useCallback(() => {
    const newSelectAll = !selectAll;
    setSelectAll(newSelectAll);

    // 仅全选已完成分析的文件
    setAudioFiles(prev => prev.map(f => {
      // 仅选择已完成分析的文件
      if (f.result !== null) {
        return { ...f, selected: newSelectAll };
      }
      return f;
    }));
  }, [selectAll]);

  // 重新分析功能：获取已选中的已完成分析的文件
  const getSelectedAnalyzedFiles = useCallback(() => {
    return audioFiles.filter(f => f.selected && f.result !== null);
  }, [audioFiles]);

  // 重新分析功能：重新分析选中的文件
  const reAnalyzeSelectedFiles = useCallback(async () => {
    const selectedFiles = getSelectedAnalyzedFiles();

    if (selectedFiles.length === 0) {
      alert('请先选择需要重新分析的文件');
      return;
    }

    if (!confirm(`确定要重新分析 ${selectedFiles.length} 个文件吗？分析完成后将覆盖原分析结果。`)) {
      return;
    }

    // 更新文件状态为"重新分析中"
    setAudioFiles(prev => prev.map(f => {
      if (f.selected && f.result !== null) {
        return { ...f, reAnalyzing: true, selected: false };
      }
      return f;
    }));

    try {
      // 并行重新分析所有选中的文件
      const reAnalysisPromises = selectedFiles.map(async (fileItem) => {
        try {
          // 检查是否有音频特征，如果没有则提取
          let features = fileItem.features;
          if (!features) {
            console.log(`[重新分析] 文件"${fileItem.file.name}"没有音频特征，开始提取...`);
            features = await extractAudioFeatures(fileItem.file);
          }

          // 【性能优化】提取音频元数据（用于出处识别）
          let audioMetadata = null;
          if (!analysisConfig.skipMetadataExtraction) {
            try {
              const formData = new FormData();
              formData.append('audio', fileItem.file);
              const metadataResponse = await fetch('/api/extract-audio-metadata', {
                method: 'POST',
                body: formData,
              });
              if (metadataResponse.ok) {
                const metadataData = await metadataResponse.json();
                audioMetadata = metadataData.metadata;
                console.log(`[重新分析] 文件"${fileItem.file.name}"元数据提取成功`);
              }
            } catch (metadataError) {
              console.warn(`[重新分析] 文件"${fileItem.file.name}"元数据提取失败:`, metadataError);
            }
          } else {
            console.log(`[重新分析] 已跳过元数据提取（性能优化配置）`);
          }

          // 根据配置选择使用完整版还是精简版API
          const apiEndpoint = analysisConfig.useFastAPI ? '/api/analyze-music-fast' : '/api/analyze-music';
          console.log(`[重新分析] 使用${analysisConfig.useFastAPI ? '精简版' : '完整版'}API`);

          const response = await fetch(apiEndpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              features,
              fileName: fileItem.file.name,
              metadata: audioMetadata,
            }),
          });

          if (!response.ok) {
            throw new Error('分析请求失败');
          }

          // 流式读取分析结果
          const reader = response.body?.getReader();
          if (!reader) {
            throw new Error('无法读取响应流');
          }

          const decoder = new TextDecoder();
          let fullText = '';

          if (reader) {
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;

              const chunk = decoder.decode(value, { stream: true });
              const lines = chunk.split('\n');

              for (const line of lines) {
                if (line.startsWith('data: ')) {
                  const data = line.slice(6);
                  if (data === '[DONE]') break;
                  try {
                    const parsed = JSON.parse(data);
                    if (parsed.content) {
                      fullText += parsed.content;
                    }
                  } catch (e) {}
                }
              }
            }
          }

          const jsonMatch = fullText.match(/```json\s*([\s\S]*?)\s*```/) ||
                           fullText.match(/\{[\s\S]*"mood"[\s\S]*\}/);

          if (jsonMatch) {
            try {
              const result = JSON.parse(jsonMatch[1] || jsonMatch[0]);

              // 【动态词库】使用动态词库标准化分析结果（支持数据库中的新词）
              const standardizedResult = await dynamicStandardizeAnalysisResult(result);

              // 更新文件的分析结果
              setAudioFiles(prev => prev.map(f => {
                if (f.id === fileItem.id) {
                  return {
                    ...f,
                    features: features,
                    result: standardizedResult,
                    reAnalyzing: false,
                    error: '',
                  };
                }
                return f;
              }));

              // 更新数据库中的分析结果（覆盖旧结果）
              await saveAnalysisToDatabase(
                { ...fileItem, features, result: standardizedResult },
                features,
                standardizedResult
              );

              console.log(`[重新分析] 文件"${fileItem.file.name}"重新分析完成`);

              // 【缓存更新】更新内存缓存 analysisCache，确保重新分析后的结果被缓存
              if (analysisConfig.enableCache) {
                const cacheKey = getFileCacheKey(fileItem.file);
                setAnalysisCache(prev => ({
                  ...prev,
                  [cacheKey]: standardizedResult,
                }));
                console.log(`[缓存更新] 文件"${fileItem.file.name}"重新分析结果已更新到内存缓存（key: ${cacheKey}）`);
              }

              // 【词库管理】重新分析完成后重新加载词库，确保使用最新词库
              if (window.refreshStandardVocabulary) {
                console.log('[词库管理] 重新分析完成后刷新词库...');
                await window.refreshStandardVocabulary();
              }

              return { success: true, fileId: fileItem.id };
            } catch (parseError) {
              console.error('[重新分析] 解析分析结果失败:', parseError);
              throw new Error('无法解析分析结果');
            }
          } else {
            throw new Error('无法解析分析结果');
          }
        } catch (error) {
          console.error('[重新分析] 重新分析失败:', error);

          // 更新文件状态为失败
          setAudioFiles(prev => prev.map(f => {
            if (f.id === fileItem.id) {
              return {
                ...f,
                reAnalyzing: false,
                error: '重新分析失败',
              };
            }
            return f;
          }));

          return { success: false, fileId: fileItem.id, error };
        }
      });

      const results = await Promise.all(reAnalysisPromises);

      const successCount = results.filter(r => r.success).length;
      const failCount = results.filter(r => !r.success).length;

      if (failCount > 0) {
        alert(`重新分析完成！\n成功：${successCount} 个\n失败：${failCount} 个`);
      } else {
        alert(`重新分析完成！共 ${successCount} 个文件`);
      }
    } catch (error) {
      console.error('批量重新分析失败:', error);
      alert('批量重新分析失败，请重试');
    }

    // 重置全选状态
    setSelectAll(false);
  }, [getSelectedAnalyzedFiles, analysisConfig]);

  const formatTime = (time: number) => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  // 【键盘导航】监听上传文件列表的键盘事件
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // 只在有文件列表时才响应
      if (audioFiles.length === 0) return;

      // 上下键控制文件选择
      if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
        event.preventDefault();

        // 计算新的选中索引
        let newIndex = selectedIndex;
        if (event.key === 'ArrowDown') {
          newIndex = selectedIndex < audioFiles.length - 1 ? selectedIndex + 1 : 0;
        } else {
          newIndex = selectedIndex > 0 ? selectedIndex - 1 : audioFiles.length - 1;
        }

        setSelectedIndex(newIndex);

        // 滚动到可见区域
        const fileItems = fileListRef.current?.querySelectorAll('[data-file-item]');
        if (fileItems && fileItems[newIndex]) {
          fileItems[newIndex].scrollIntoView({
            behavior: 'smooth',
            block: 'nearest',
          });
        }
      }

      // 左键：切换复选框状态（仅对已完成的文件有效）
      if (event.key === 'ArrowLeft' && selectedIndex >= 0 && selectedIndex < audioFiles.length) {
        event.preventDefault();
        const item = audioFiles[selectedIndex];
        // 仅已完成分析的文件可以被选中
        if (item.result !== null) {
          toggleSelectFile(item.id);
        }
      }

      // 右键：播放选中的文件
      if (event.key === 'ArrowRight' && selectedIndex >= 0 && selectedIndex < audioFiles.length) {
        event.preventDefault();
        switchToFile(audioFiles[selectedIndex].id);
      }

      // 空格键：播放选中的文件（确认键）
      if (event.key === ' ' && selectedIndex >= 0 && selectedIndex < audioFiles.length) {
        event.preventDefault();
        switchToFile(audioFiles[selectedIndex].id);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [audioFiles, selectedIndex, switchToFile, toggleSelectFile]);

  // 当文件列表变化时重置选中索引
  useEffect(() => {
    setSelectedIndex(-1);
  }, [audioFiles.length]);

  // 【键盘导航】获取可导航的扁平化列表（专辑和音乐项）
  // 使用 useMemo 缓存计算结果，避免重复计算
  const navigableItems = useMemo(() => {
    const navigableItems: Array<{
      type: 'package' | 'music';
      packageName?: string;
      packageItems?: any[];
      item?: any;
      itemIndex?: number;
    }> = [];

    const grouped = groupMusicByPackage(dbSearchResults);
    const packageNames = Object.keys(grouped).sort((a, b) => {
      // "未分类" 放到最后
      if (a === '未分类') return 1;
      if (b === '未分类') return -1;
      return a.localeCompare(b, 'zh-CN');
    });

    packageNames.forEach((packageName) => {
      const packageData = grouped[packageName];
      const packageItems = packageData.items;
      const packageTranslated = packageData.translated;
      const isExpanded = expandedMusicPackages.has(packageName);

      // 添加专辑项
      navigableItems.push({
        type: 'package',
        packageName,
        packageItems,
      });

      // 如果专辑已展开，添加其内的音乐项
      if (isExpanded) {
        packageItems.forEach((item: any, itemIndex: number) => {
          navigableItems.push({
            type: 'music',
            item,
            itemIndex,
          });
        });
      }
    });

    return navigableItems;
  }, [dbSearchResults, expandedMusicPackages]);

  // 【键盘导航】监听搜索结果列表的键盘事件
  useEffect(() => {
    // 只在数据库面板打开且有搜索结果时才响应
    if (!showDatabasePanel || dbSearchResults.length === 0) return;

    if (navigableItems.length === 0) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      // 上下键控制搜索结果选择
      if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
        event.preventDefault();

        // 计算新的选中索引
        let newIndex = searchResultIndex;
        if (event.key === 'ArrowDown') {
          newIndex = searchResultIndex < navigableItems.length - 1 ? searchResultIndex + 1 : 0;
        } else {
          newIndex = searchResultIndex > 0 ? searchResultIndex - 1 : navigableItems.length - 1;
        }

        setSearchResultIndex(newIndex);

        // 滚动到可见区域
        const selectedItem = navigableItems[newIndex];
        if (selectedItem.type === 'package') {
          // 专辑项：找到对应的按钮元素并滚动
          const packageButtons = searchResultListRef.current?.querySelectorAll('[data-package-button]');
          if (packageButtons && packageButtons[newIndex]) {
            packageButtons[newIndex].scrollIntoView({
              behavior: 'smooth',
              block: 'nearest',
            });
          }
        } else {
          // 音乐项：找到对应的音乐项元素并滚动
          const searchItems = searchResultListRef.current?.querySelectorAll('[data-search-item]');
          // 音乐项在 navigableItems 中的索引需要转换
          let musicIndex = 0;
          for (let i = 0; i < newIndex; i++) {
            if (navigableItems[i].type === 'music') {
              musicIndex++;
            }
          }
          if (searchItems && searchItems[musicIndex]) {
            searchItems[musicIndex].scrollIntoView({
              behavior: 'smooth',
              block: 'nearest',
            });
          }
        }
      }

      // 左键：切换复选框状态
      if (event.key === 'ArrowLeft' && searchResultIndex >= 0 && searchResultIndex < navigableItems.length) {
        event.preventDefault();
        const selectedItem = navigableItems[searchResultIndex];
        if (selectedItem.type === 'package' && selectedItem.packageName && selectedItem.packageItems) {
          // 专辑项：切换专辑内所有音乐的选择状态
          togglePackageSelection(selectedItem.packageName, selectedItem.packageItems);
        } else if (selectedItem.type === 'music' && selectedItem.item) {
          // 音乐项：切换单个音乐的选择状态
          toggleRecordSelection(selectedItem.item.id);
        }
      }

      // 右键：播放选中的记录（仅对音乐项有效）
      if (event.key === 'ArrowRight' && searchResultIndex >= 0 && searchResultIndex < navigableItems.length) {
        event.preventDefault();
        const selectedItem = navigableItems[searchResultIndex];
        if (selectedItem.type === 'music' && selectedItem.item) {
          // 音乐项：播放音乐
          playByFileName(selectedItem.item.fileName);
          // 计算该音乐在 dbSearchResults 中的全局索引
          const globalIndex = dbSearchResults.findIndex(r => r.id === selectedItem.item.id);
          if (globalIndex !== -1) {
            setCurrentSearchIndex(globalIndex);
          }
        }
      }

      // 空格键：展开/收起专辑（专辑项）或播放音乐（音乐项）
      if (event.key === ' ' && searchResultIndex >= 0 && searchResultIndex < navigableItems.length) {
        event.preventDefault();
        const selectedItem = navigableItems[searchResultIndex];
        if (selectedItem.type === 'package' && selectedItem.packageName) {
          // 专辑项：展开/收起专辑
          toggleMusicPackageExpand(selectedItem.packageName);
        } else if (selectedItem.type === 'music' && selectedItem.item) {
          // 音乐项：播放音乐
          playByFileName(selectedItem.item.fileName);
          // 计算该音乐在 dbSearchResults 中的全局索引
          const globalIndex = dbSearchResults.findIndex(r => r.id === selectedItem.item.id);
          if (globalIndex !== -1) {
            setCurrentSearchIndex(globalIndex);
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [showDatabasePanel, dbSearchResults, searchResultIndex, expandedMusicPackages, navigableItems, toggleRecordSelection, togglePackageSelection, playByFileName, setCurrentSearchIndex]);

  // 当搜索结果变化或数据库面板关闭时重置选中索引
  useEffect(() => {
    if (!showDatabasePanel || dbSearchResults.length === 0) {
      setSearchResultIndex(-1);
    }
  }, [showDatabasePanel, dbSearchResults.length]);

  // 【词库管理】页面加载时获取标准词库
  useEffect(() => {
    const loadStandardVocabulary = async () => {
      try {
        console.log('[词库管理] 开始加载标准词库...');
        const response = await fetch('/api/term-management/get-standard-terms');
        if (response.ok) {
          const data = await response.json();
          if (data.success && data.data) {
            console.log('[词库管理] 标准词库加载成功:', data.data.countsByCategory);
            setStandardVocabulary(data.data.terms);
          } else {
            console.error('[词库管理] 标准词库加载失败:', data.error);
            // 降级：使用硬编码的标准词库
            console.log('[词库管理] 使用硬编码标准词库作为降级方案');
            setStandardVocabulary({
              emotion: STANDARD_TERMS.mood.standardList,
              style: [...STANDARD_TERMS.style.traditionalList, ...STANDARD_TERMS.style.atmosphericList],
              instrument: STANDARD_TERMS.instruments.standardList,
              film: [], // 影视类型暂不使用硬编码词库
              scenario: [...STANDARD_TERMS.standardScenes.core.standardList, ...STANDARD_TERMS.standardScenes.extended.standardList],
              dubbing: [],
            });
          }
        } else {
          console.error('[词库管理] 标准词库API返回错误:', response.status);
          // 降级：使用硬编码的标准词库
          console.log('[词库管理] 使用硬编码标准词库作为降级方案');
          setStandardVocabulary({
            emotion: STANDARD_TERMS.mood.standardList,
            style: [...STANDARD_TERMS.style.traditionalList, ...STANDARD_TERMS.style.atmosphericList],
            instrument: STANDARD_TERMS.instruments.standardList,
            film: [], // 影视类型暂不使用硬编码词库
            scenario: [...STANDARD_TERMS.standardScenes.core.standardList, ...STANDARD_TERMS.standardScenes.extended.standardList],
            dubbing: [],
          });
        }
      } catch (error) {
        console.error('[词库管理] 加载标准词库时出错:', error);
        // 降级：使用硬编码的标准词库
        console.log('[词库管理] 使用硬编码标准词库作为降级方案');
        setStandardVocabulary({
          emotion: STANDARD_TERMS.mood.standardList,
          style: [...STANDARD_TERMS.style.traditionalList, ...STANDARD_TERMS.style.atmosphericList],
          instrument: STANDARD_TERMS.instruments.standardList,
          film: [], // 影视类型暂不使用硬编码词库
          scenario: [...STANDARD_TERMS.standardScenes.core.standardList, ...STANDARD_TERMS.standardScenes.extended.standardList],
          dubbing: [],
        });
      }
    };

    loadStandardVocabulary();

    // 【动态词库】初始化动态词库（用于分析时使用数据库中的新词）
    initDynamicVocabulary().catch(err => {
      console.error('[动态词库] 初始化失败:', err);
    });

    // 暴露全局函数，供词库管理面板调用
    window.refreshStandardVocabulary = async () => {
      // 刷新UI显示的词库
      await loadStandardVocabulary();
      // 刷新动态词库缓存（分析时会使用新词）
      refreshDynamicVocabulary();
    };
  }, []);

  useEffect(() => {
    // 当前文件改变时更新播放器 URL
    // 【修复】直接使用 ref 读取，避免依赖 getCurrentFile 导致循环触发
    const currentFile = audioFilesRef.current.find(f => f.id === currentFileIdRef.current) || null;
    if (currentFile && audioRef.current) {
      // 验证文件对象是否有效
      const isFileValid = currentFile.file instanceof File && currentFile.file.size > 0;
      if (!isFileValid) {
        console.error('[音频播放] 文件对象无效:', {
          isFile: currentFile.file instanceof File,
          size: currentFile.file?.size
        });
        addNotification('error', '文件对象无效，请重新上传');
        return;
      }

      // 简化格式验证：主要依靠文件扩展名，MIME类型作为参考
      const fileExtension = currentFile.file.name.split('.').pop()?.toLowerCase() || '';
      const supportedExtensions = ['mp3', 'wav', 'ogg', 'webm', 'flac', 'aac', 'm4a', 'wma', 'aiff', 'aif'];

      if (!supportedExtensions.includes(fileExtension)) {
        console.warn('[音频播放] 不支持的文件扩展名:', fileExtension);
        addNotification('error', `不支持的文件格式: ${fileExtension}`);
        return;
      }

      console.log('[音频播放] 验证音频文件:', {
        fileName: currentFile.file.name,
        fileType: currentFile.file.type,
        fileExtension: fileExtension,
        fileSize: (currentFile.file.size / 1024 / 1024).toFixed(2) + 'MB'
      });

      // 检查音频URL是否为空或需要重新创建
      const isBlobUrl = currentFile.audioUrl?.startsWith('blob:');
      let finalAudioUrl = currentFile.audioUrl;

      // 如果没有audioUrl或不是Blob URL，创建新的Blob URL
      if (!finalAudioUrl || !isBlobUrl) {
        console.log('[音频播放] 创建新的Blob URL');
        try {
          finalAudioUrl = URL.createObjectURL(currentFile.file);
          console.log('[音频播放] 新Blob URL已创建:', finalAudioUrl.substring(0, 30) + '...');

          // 更新audioFiles中的audioUrl
          setAudioFiles(prev => prev.map(f =>
            f.id === currentFile.id ? { ...f, audioUrl: finalAudioUrl! } : f
          ));
        } catch (e) {
          console.error('[音频播放] 创建Blob URL失败:', e);
          addNotification('error', '无法创建音频URL');
          return;
        }
      }

      console.log('[音频播放] 更新音频源:', {
        fileName: currentFile.file.name,
        newUrl: finalAudioUrl.substring(0, 30) + '...',
        oldUrl: lastAudioUrlRef.current?.substring(0, 30) + '...'
      });

      // 停止当前播放
      audioRef.current.pause();

      // 重置状态
      setCurrentTime(0);
      setDuration(0);
      setIsPlaying(false);

      // 设置新的音频源
      audioRef.current.src = finalAudioUrl;
      audioRef.current.load(); // 强制重新加载音频

      // 更新lastAudioUrlRef
      lastAudioUrlRef.current = finalAudioUrl;

      // 清空流式文本和编辑状态
      setStreamText('');
      setEditingModule(null);

      console.log('[音频播放] 音频源已更新');
    }
  }, [currentFileId]); // 只依赖 currentFileId，避免循环触发

  useEffect(() => {
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) {
      nativeConsole.warn('[音频播放] audioRef 未初始化，跳过事件绑定');
      return;
    }

    // 【改进】确保音频元素完全初始化
    if (audio.readyState === 0) {
      nativeConsole.log('[音频播放] 音频元素准备中，readyState:', audio.readyState);
    }

    const handleTimeUpdate = () => {
      // 如果正在拖动进度条，不更新状态
      if (!isSeeking) {
        setCurrentTime(audio.currentTime);
      }
    };

    const handleLoadedMetadata = () => {
      const metadataInfo = {
        duration: audio.duration,
        readyState: audio.readyState,
        networkState: audio.networkState
      };
      const metadataInfoStr = JSON.stringify(metadataInfo, null, 2);
      nativeConsole.log('[音频播放] 元数据加载完成');
      nativeConsole.log(metadataInfoStr);
      setDuration(audio.duration);
    };

    const handleCanPlay = () => {
      nativeConsole.log('[音频播放] 音频可以播放');
      // 禁用自动播放，等待用户手动点击播放
    };

    const handleError = (e: Event) => {
      const audio = e.target as HTMLAudioElement;
      const error = audio.error;

      // 【改进】使用 ref 获取当前文件信息，避免闭包陷阱
      const currentFile = audioFilesRef.current.find(f => f.id === currentFileIdRef.current) || null;

      // 构建详细的错误信息
      const errorDetails = {
        timestamp: new Date().toLocaleString(),
        audioSource: audio.src || 'no source',
        readyState: audio.readyState,
        networkState: audio.networkState,
        errorType: e.type,
        errorCode: error?.code || '无错误码',
        errorMessage: error?.message || '未知错误'
      };

      // 【修复】使用 JSON.stringify 确保对象被正确输出
      const errorDetailsStr = JSON.stringify(errorDetails, null, 2);
      nativeConsole.error('[音频播放] 播放错误');
      nativeConsole.error(errorDetailsStr);

      if (currentFile) {
        const fileInfo = {
          fileName: currentFile.file.name,
          fileType: currentFile.file.type,
          fileSize: (currentFile.file.size / 1024 / 1024).toFixed(2) + 'MB',
          blobUrl: currentFile.audioUrl,
          isBlobUrl: currentFile.audioUrl?.startsWith('blob:')
        };
        const fileInfoStr = JSON.stringify(fileInfo, null, 2);
        nativeConsole.error('[音频播放] 文件信息');
        nativeConsole.error(fileInfoStr);
      }

      if (error) {
        const errorCode = error.code;
        const errorMessages: Record<number, string> = {
          1: '用户终止播放 (MEDIA_ERR_ABORTED)',
          2: '网络错误 - 文件无法访问 (MEDIA_ERR_NETWORK)',
          3: '解码错误 - 文件格式/已损坏 (MEDIA_ERR_DECODE)',
          4: '不支持的音频格式/源 (MEDIA_ERR_SRC_NOT_SUPPORTED)',
        };

        const errorCodeDetails = {
          code: errorCode,
          message: errorMessages[errorCode] || '未知错误',
          details: error.message || '无详细信息'
        };
        const errorCodeDetailsStr = JSON.stringify(errorCodeDetails, null, 2);
        nativeConsole.error('[音频播放] 错误详情');
        nativeConsole.error(errorCodeDetailsStr);

        // 对于错误4，提供更详细的调试信息
        if (errorCode === 4) {
          const debugInfo: any = {
            debugType: 'MEDIA_ERR_SRC_NOT_SUPPORTED'
          };
          if (currentFile) {
            debugInfo.fileMimeType = currentFile.file.type;
            debugInfo.fileExtension = currentFile.file.name.split('.').pop()?.toLowerCase();
            debugInfo.blobUrlPrefix = currentFile.audioUrl?.substring(0, 50);
            // 检查文件对象是否还有效
            try {
              const testBlob = new Blob([currentFile.file]);
              debugInfo.fileObjectValid = 'OK (可以创建Blob)';
            } catch (err) {
              debugInfo.fileObjectValid = '失败';
              debugInfo.validationError = err;
            }
          }
          const debugInfoStr = JSON.stringify(debugInfo, null, 2);
          nativeConsole.error('[音频播放] 调试信息');
          nativeConsole.error(debugInfoStr);
        }

        addNotification('error', `播放失败: ${errorMessages[errorCode] || '未知错误'}`);

        // 【改进】错误恢复机制：尝试恢复播放
        if (errorCode === 4 && audio.networkState === 1 && audio.readyState === 4) {
          nativeConsole.log('[音频播放] 尝试错误恢复：重置并重新播放');
          try {
            audio.pause();
            audio.currentTime = 0;

            // 【改进】延迟后重新加载并自动尝试播放
            setTimeout(async () => {
              if (audioRef.current && currentFileIdRef.current) {
                const currentFile = audioFilesRef.current.find(f => f.id === currentFileIdRef.current);
                if (currentFile) {
                  nativeConsole.log('[音频播放] 错误恢复：重新获取音频源');
                  const audioUrl = await getAudioUrl(currentFile);

                  if (audioUrl && audioRef.current) {
                    nativeConsole.log('[音频播放] 错误恢复：重新加载音频源');
                    audioRef.current.src = audioUrl;
                    audioRef.current.load();

                    // 【改进】等待音频准备好后自动播放
                    audioRef.current.addEventListener('canplay', () => {
                      nativeConsole.log('[音频播放] 错误恢复：音频已准备好，自动播放');
                      audioRef.current?.play()
                        .then(() => {
                          setIsPlaying(true);
                          addNotification('success', '播放已恢复');
                        })
                        .catch(err => {
                          nativeConsole.error('[音频播放] 错误恢复后自动播放失败', err);
                          addNotification('info', '音频已重新加载，请点击播放按钮');
                        });
                    }, { once: true });
                  }
                }
              }
            }, 100);
          } catch (err) {
            nativeConsole.error('[音频播放] 错误恢复操作失败', err);
          }
        }
      } else {
        nativeConsole.error('[音频播放] 无错误对象');
        addNotification('error', '播放失败: 未知原因');
      }

      setIsPlaying(false);
    };

    const handleEnded = () => {
      nativeConsole.log('[音频播放] 播放结束', { playMode });

      // 根据播放模式决定是否自动播放下一首
      if (playMode === 'loop-one') {
        // 单曲循环：重新播放当前文件
        nativeConsole.log('[音频播放] 单曲循环模式：重新播放');
        setIsPlaying(false);
        setTimeout(() => {
          audioRef.current?.play().then(() => {
            setIsPlaying(true);
          }).catch(err => {
            nativeConsole.error('[音频播放] 重新播放失败', err);
          });
        }, 100);
      } else {
        // 顺序播放或随机播放：自动播放下一首
        nativeConsole.log('[音频播放] 自动播放下一首');
        setIsPlaying(false);
        setTimeout(() => {
          playNext();
        }, 500);
      }
    };

    const handlePlay = () => {
      // 【改进】使用 ref 获取当前文件信息，避免闭包陷阱
      const currentFile = audioFilesRef.current.find(f => f.id === currentFileIdRef.current);
      nativeConsole.log('[音频播放] 开始播放', { fileName: currentFile?.file?.name });
      setIsPlaying(true);
    };

    const handlePause = () => {
      nativeConsole.log('[音频播放] 暂停播放');
      setIsPlaying(false);
    };

    // 绑定所有播放相关事件
    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('canplay', handleCanPlay);

    // 只绑定真正的错误事件
    // 注意：abort、stalled、suspend 是正常的网络事件，不是错误
    audio.addEventListener('error', handleError);

    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('play', handlePlay);
    audio.addEventListener('pause', handlePause);

    return () => {
      // 清理所有事件监听
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('canplay', handleCanPlay);

      audio.removeEventListener('error', handleError);

      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('play', handlePlay);
      audio.removeEventListener('pause', handlePause);

      // 【改进】组件卸载时清理音频资源
      audio.pause();
      audio.src = ''; // 清空音频源，释放内存

      // 【改进】释放所有 Blob URL
      blobUrlsMap.current.forEach((url, fileId) => {
        if (url.startsWith('blob:')) {
          try {
            URL.revokeObjectURL(url);
            console.log('[音频播放] 组件卸载：已释放 Blob URL', { fileId, url: url.substring(0, 30) + '...' });
          } catch (e) {
            console.warn('[音频播放] 释放 Blob URL 失败:', { fileId, error: e });
          }
        }
      });
      blobUrlsMap.current.clear();

      // 清空 lastAudioUrlRef
      lastAudioUrlRef.current = '';
    };
  }, [playMode, isSeeking, shouldAutoPlay]); // 移除 getCurrentFile 依赖，避免事件重复绑定

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = isMuted ? 0 : volume;
    }
  }, [volume, isMuted]);

  // 【删除】不再需要单独的重置状态的 useEffect，因为切换文件的 useEffect 已经处理了

  // 【调试】监控audio元素状态
  useEffect(() => {
    if (audioRef.current) {
      console.log('[音频播放] audio元素状态监控:', {
        hasRef: !!audioRef.current,
        src: audioRef.current.src || 'no source',
        currentSrc: audioRef.current.currentSrc || 'no current source',
        readyState: audioRef.current.readyState,
        networkState: audioRef.current.networkState,
        error: audioRef.current.error ? {
          code: audioRef.current.error.code,
          message: audioRef.current.error.message
        } : null
      });
    }
  }, [currentFileId, isPlaying]);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.playbackRate = playbackSpeed;
    }
  }, [playbackSpeed]);

  // 【翻译】当 currentResult 变化时，自动翻译专辑和影视名称
  useEffect(() => {
    const translateOriginTexts = async () => {
      if (!currentResult?.musicOrigin) return;

      const textsToTranslate: string[] = [];

      // 收集需要翻译的专辑和影视名称
      if (currentResult.musicOrigin.album?.name) {
        textsToTranslate.push(currentResult.musicOrigin.album.name);
      }
      if (currentResult.musicOrigin.filmOrTV?.name) {
        textsToTranslate.push(currentResult.musicOrigin.filmOrTV.name);
      }

      if (textsToTranslate.length === 0) return;

      // 调用翻译API
      const translations = await translateText(textsToTranslate);

      // 更新翻译状态
      setOriginTranslations(prev => ({
        ...prev,
        ...translations,
      }));
    };

    translateOriginTexts();
  }, [currentResult?.musicOrigin]); // 当 musicOrigin 变化时触发翻译

  // 【持久化】组件挂载时从 IndexedDB 恢复音频文件数据
  useEffect(() => {
    const loadPersistedData = async () => {
      try {
        console.log('[持久化] 开始从 IndexedDB 恢复数据...');
        const persistedFiles = await audioFilesDB.loadAll();

        if (persistedFiles.length > 0) {
          // 将 IndexedDB 数据转换为 AudioFileItem 格式
          // 过滤掉没有 fileData 的无效记录
          const mappedFiles = persistedFiles
            .filter((dbItem) => dbItem.fileData && dbItem.fileData instanceof Blob)
            .map((dbItem) => {
              try {
                // 验证fileData是否是有效的Blob
                if (!dbItem.fileData || !(dbItem.fileData instanceof Blob)) {
                  console.warn('[持久化] 跳过无效的文件数据:', dbItem.fileName);
                  return null;
                }

                // 检查Blob大小
                if (dbItem.fileData.size === 0) {
                  console.warn('[持久化] 跳过空文件:', dbItem.fileName);
                  return null;
                }

                // 从文件名推断正确的MIME类型
                const fileExtension = dbItem.fileName.split('.').pop()?.toLowerCase() || '';
                const extensionToMime: Record<string, string> = {
                  'mp3': 'audio/mpeg',
                  'wav': 'audio/wav',
                  'ogg': 'audio/ogg',
                  'webm': 'audio/webm',
                  'flac': 'audio/flac',
                  'aac': 'audio/aac',
                  'm4a': 'audio/mp4',
                  'mp4': 'audio/mp4',
                  'wma': 'audio/x-ms-wma',
                  'aiff': 'audio/aiff',
                  'aif': 'audio/aiff',
                  'aifc': 'audio/aiff',
                };
                
                // 优先使用推断的MIME类型，如果推断失败则使用数据库存储的类型或默认类型
                const inferredType = extensionToMime[fileExtension] || 'audio/mpeg';
                const finalFileType = dbItem.fileType && dbItem.fileType.startsWith('audio/') 
                  ? dbItem.fileType 
                  : inferredType;

                console.log(`[持久化] 恢复文件: ${dbItem.fileName}, 原类型: ${dbItem.fileType}, 推断类型: ${inferredType}, 最终类型: ${finalFileType}, Blob大小: ${dbItem.fileData.size}`);

                // 将 Blob 转换为 File 对象
                const file = new File([dbItem.fileData!], dbItem.fileName, {
                  type: finalFileType,
                  lastModified: Date.now(),
                });

                // 验证File对象
                if (!(file instanceof File) || file.size === 0) {
                  console.warn('[持久化] File对象创建失败:', dbItem.fileName);
                  return null;
                }

                // 总是创建新的 Blob URL，因为页面刷新后旧的 URL 会失效
                const newAudioUrl = URL.createObjectURL(file);
                console.log(`[持久化] 创建Blob URL成功: ${newAudioUrl.substring(0, 30)}...`);

                // 【新增】将 Blob URL 记录到 map 中，避免被错误释放
                blobUrlsMap.current.set(dbItem.id, newAudioUrl);
                console.log(`[持久化] 已记录 Blob URL 到 map: ${dbItem.id}`);

                return {
                  id: dbItem.id,
                  file,
                  audioUrl: newAudioUrl,
                  features: dbItem.features,
                  result: dbItem.result,
                  isAnalyzing: dbItem.isAnalyzing || false,
                  error: dbItem.error || '',
                  isUploading: dbItem.isUploading || false,
                  uploadProgress: dbItem.uploadProgress,
                  uploadStatus: ((dbItem.uploadStatus === 'success' || dbItem.uploadStatus === 'error') ? 'success' : 'pending') as 'pending' | 'success' | 'failed',
                  uploadError: dbItem.uploadError,
                  fileKey: dbItem.fileKey || null,
                  isUploaded: dbItem.isUploaded || false,
                  isOnline: dbItem.isOnline !== undefined ? dbItem.isOnline : true,
                  uploadedAt: dbItem.uploadedAt || null,
                  selected: dbItem.selected || false,
                  reAnalyzing: dbItem.reAnalyzing || false,
                };
              } catch (error) {
                console.warn('[持久化] 恢复文件失败，跳过:', dbItem.fileName, error);
                return null;
              }
            });

          // 过滤掉失败的项
          const validRestoredFiles = mappedFiles.filter((item): item is NonNullable<typeof item> => item !== null);

          setAudioFiles(validRestoredFiles);
          console.log(`[持久化] 成功恢复 ${validRestoredFiles.length} 个音频文件`);

          // 设置当前文件为第一个文件（如果没有当前文件）
          if (!currentFileId && validRestoredFiles.length > 0) {
            setCurrentFileId(validRestoredFiles[0].id);
          }
        } else {
          console.log('[持久化] 没有持久化数据可恢复');
        }
      } catch (error) {
        console.error('[持久化] 从 IndexedDB 恢复数据失败:', error);
      }
    };

    loadPersistedData();
  }, []); // 只在组件挂载时执行一次

  // 【持久化】监听 audioFiles 变化，自动保存到 IndexedDB
  useEffect(() => {
    const saveToIndexedDB = async () => {
      try {
        // 防抖：避免频繁保存
        await audioFilesDB.saveAll(audioFiles);
        console.log('[持久化] audioFiles 已自动保存到 IndexedDB');
      } catch (error) {
        console.error('[持久化] 保存到 IndexedDB 失败:', error);
      }
    };

    // 使用防抖，避免频繁保存
    const timer = setTimeout(saveToIndexedDB, 500);

    return () => {
      clearTimeout(timer);
    };
  }, [audioFiles]); // 监听 audioFiles 的变化

  const visualize = useCallback(() => {
    const canvas = canvasRef.current;
    const analyser = analyserRef.current;

    if (!canvas || !analyser) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const draw = () => {
      animationRef.current = requestAnimationFrame(draw);

      analyser.getByteFrequencyData(dataArray);

      ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const barWidth = (canvas.width / bufferLength) * 2.5;
      let barHeight;
      let x = 0;

      for (let i = 0; i < bufferLength; i++) {
        barHeight = (dataArray[i] / 255) * canvas.height;

        const gradient = ctx.createLinearGradient(0, canvas.height, 0, canvas.height - barHeight);
        gradient.addColorStop(0, '#8B5CF6');
        gradient.addColorStop(0.5, '#EC4899');
        gradient.addColorStop(1, '#F59E0B');

        ctx.fillStyle = gradient;
        ctx.fillRect(x, canvas.height - barHeight, barWidth, barHeight);

        x += barWidth + 1;
      }
    };

    draw();
  }, []);

  // 获取音频 URL（优先使用云端 URL，回退到本地 Blob URL）
  const getAudioUrl = async (file: AudioFileItem): Promise<string | null> => {
    try {
      // 如果文件已上传到云端，优先使用云端 URL
      if (file.isUploaded && file.fileKey) {
        nativeConsole.log('[音频播放] 文件已上传到云端，尝试获取签名 URL', { fileKey: file.fileKey });

        // 调用 API 获取签名 URL（带超时控制）
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000); // 10秒超时

        try {
          const response = await fetch(`/api/download-music?id=${file.id}`, {
            signal: controller.signal
          });
          clearTimeout(timeoutId);

          const data = await response.json();

          if (data.success && data.data.downloadUrl) {
            nativeConsole.log('[音频播放] 成功获取云端签名 URL');
            return data.data.downloadUrl;
          } else {
            nativeConsole.warn('[音频播放] 获取云端 URL 失败，使用本地 Blob URL');
          }
        } catch (e: any) {
          clearTimeout(timeoutId);
          if (e.name === 'AbortError') {
            nativeConsole.warn('[音频播放] 获取云端 URL 超时，使用本地 Blob URL');
          } else {
            nativeConsole.error('[音频播放] 获取云端 URL 失败', e);
          }
        }
      }

      // 回退到本地 Blob URL
      nativeConsole.log('[音频播放] 准备获取本地 Blob URL', { fileId: file.id });

      // 【改进】先检查是否已有有效的 Blob URL
      const existingUrl = blobUrlsMap.current.get(file.id);
      if (existingUrl && existingUrl.startsWith('blob:')) {
        nativeConsole.log('[音频播放] 复用已有的 Blob URL', { fileId: file.id, url: existingUrl.substring(0, 30) + '...' });
        return existingUrl;
      }

      // 需要创建新的 Blob URL
      nativeConsole.log('[音频播放] 创建新的 Blob URL');

      if (file.file instanceof File && file.file.size > 0) {
        const newAudioUrl = URL.createObjectURL(file.file);
        nativeConsole.log('[音频播放] 新 Blob URL 已创建', { fileId: file.id, newUrl: newAudioUrl.substring(0, 30) + '...' });

        // 【改进】记录到 Map
        blobUrlsMap.current.set(file.id, newAudioUrl);

        // 更新audioFiles中的audioUrl
        setAudioFiles(prev => prev.map(f =>
          f.id === file.id ? { ...f, audioUrl: newAudioUrl } : f
        ));
        return newAudioUrl;
      } else {
        nativeConsole.error('[音频播放] 无法创建 Blob URL', { reason: '文件对象无效' });
        return null;
      }
    } catch (error) {
      nativeConsole.error('[音频播放] 获取音频 URL 失败', error);
      return null;
    }
  };

  const togglePlay = async () => {
    nativeConsole.log('[音频播放] ===== 点击播放按钮 =====');
    
    if (!audioRef.current) {
      nativeConsole.warn('[音频播放] audioRef 未初始化');
      addNotification('error', '播放失败：音频播放器未初始化');
      return;
    }

    nativeConsole.log('[音频播放] audioRef 状态', {
      readyState: audioRef.current.readyState,
      src: audioRef.current.src?.substring(0, 50) + '...',
      paused: audioRef.current.paused,
      currentTime: audioRef.current.currentTime
    });

    // 【修复】使用 ref 获取当前文件，避免闭包陷阱
    const currentFile = audioFilesRef.current.find(f => f.id === currentFileIdRef.current);

    if (!currentFile) {
      nativeConsole.warn('[音频播放] 无法播放：没有当前文件', {
        currentFileId: currentFileIdRef.current,
        audioFilesCount: audioFilesRef.current.length,
        audioFilesIds: audioFilesRef.current.map(f => f.id)
      });
      addNotification('error', '无法播放：没有选中的音频文件，请先点击列表中的音乐');
      return;
    }

    nativeConsole.log('[音频播放] 切换播放状态', {
      fileName: currentFile.file.name,
      fileId: currentFile.id,
      isPlaying,
      isUploaded: currentFile.isUploaded,
      fileKey: currentFile.fileKey,
      hasAudioUrl: !!currentFile.audioUrl,
      fileSize: currentFile.file.size
    });

    // 用户手动操作时，重置自动播放标志
    setShouldAutoPlay(false);

    // 如果正在播放，直接暂停
    if (isPlaying) {
      nativeConsole.log('[音频播放] 暂停播放');
      audioRef.current.pause();
      return;
    }

    // 开始播放前，先获取音频 URL
    let audioUrl: string | null = currentFile.audioUrl;

    // 【改进】检查是否需要加载新音频源（使用 ID 而不是文件名）
    const needsLoad = !audioRef.current.src ||
                      !audioRef.current.src.includes(currentFile.id) ||
                      audioRef.current.readyState === 0; // HAVE_NOTHING

    if (needsLoad) {
      nativeConsole.log('[音频播放] 需要加载新音频源', {
        hasSrc: !!audioRef.current.src,
        srcIncludesId: audioRef.current.src?.includes(currentFile.id),
        readyState: audioRef.current.readyState
      });

      // 获取音频 URL（优先云端，回退本地）
      // 【改进】不再在这里清理旧 URL，因为 getAudioUrl 会自动处理复用
      audioUrl = await getAudioUrl(currentFile);

      if (!audioUrl) {
        nativeConsole.error('[音频播放] 无法获取有效的音频 URL');
        addNotification('error', '无法播放：无法加载音频文件');
        return;
      }

      nativeConsole.log('[音频播放] 加载音频源', { url: audioUrl.substring(0, 50) + '...' });
      audioRef.current.src = audioUrl;
      audioRef.current.load();
      lastAudioUrlRef.current = audioUrl;

      // 等待音频准备好
      await new Promise<void>((resolve, reject) => {
        const cleanup = () => {
          audioRef.current?.removeEventListener('canplay', onCanPlay);
          audioRef.current?.removeEventListener('error', onError);
        };

        const onCanPlay = () => {
          nativeConsole.log('[音频播放] 音频已准备好，可以播放');
          cleanup();
          resolve();
        };

        const onError = (e: Event) => {
          const audio = e.target as HTMLAudioElement;
          nativeConsole.error('[音频播放] 音频加载失败', {
            errorCode: audio.error?.code,
            errorMessage: audio.error?.message,
            src: audio.src,
            readyState: audio.readyState
          });
          cleanup();
          reject(new Error('音频加载失败'));
        };

        // 检查是否已经准备好
        if (audioRef.current && audioRef.current.readyState >= 3) { // HAVE_FUTURE_DATA
          nativeConsole.log('[音频播放] 音频已经准备好');
          cleanup();
          resolve();
        } else if (audioRef.current) {
          nativeConsole.log('[音频播放] 等待音频准备...', { readyState: audioRef.current.readyState });
          audioRef.current.addEventListener('canplay', onCanPlay);
          audioRef.current.addEventListener('error', onError);

          // 设置超时
          setTimeout(() => {
            cleanup();
            reject(new Error('音频加载超时'));
          }, 15000);
        } else {
          cleanup();
          reject(new Error('音频元素未初始化'));
        }
      });
    } else {
      nativeConsole.log('[音频播放] 音频已加载，直接播放', {
        src: audioRef.current.src.substring(0, 50) + '...',
        readyState: audioRef.current.readyState
      });
    }

    // 尝试播放
    try {
      nativeConsole.log('[音频播放] 调用 audio.play()');
      const playPromise = audioRef.current.play();

      if (playPromise !== undefined) {
        await playPromise;
        nativeConsole.log('[音频播放] 播放成功');
        setIsPlaying(true);
        addNotification('success', '开始播放');
      }
    } catch (err: any) {
      nativeConsole.error('[音频播放] 播放失败', err);

      // 针对不同错误类型提供更具体的提示
      let errorMessage = '播放失败';
      if (err.name === 'NotSupportedError') {
        errorMessage = '播放失败：浏览器不支持此音频格式';
      } else if (err.name === 'NotAllowedError') {
        errorMessage = '播放失败：浏览器阻止了自动播放，请点击播放按钮';
      } else if (err.name === 'AbortError') {
        errorMessage = '播放失败：操作被中止';
      } else if (err.message && err.message.includes('Blob/File')) {
        errorMessage = '播放失败：音频数据加载错误';
      } else if (err.message && err.message.includes('超时')) {
        errorMessage = '播放失败：音频加载超时，请重试';
      } else if (err.message && err.message.includes('加载失败')) {
        errorMessage = '播放失败：音频文件加载失败，请检查文件';
      } else {
        errorMessage = `播放失败：${err.message || '未知错误'}`;
      }

      addNotification('error', errorMessage);
      setIsPlaying(false);
    }
  };

  // 停止播放并重置进度
  const stopPlay = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      setIsPlaying(false);
      setCurrentTime(0);
      // 重置自动播放标志
      setShouldAutoPlay(false);
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(e.target.value);
    if (audioRef.current && !isNaN(time)) {
      // 拖动时同时更新audio和UI状态
      // timeupdate在拖动时被阻止，所以这里需要手动更新currentTime
      audioRef.current.currentTime = time;
      setCurrentTime(time);
    }
  };

  // 点击进度条直接跳转
  const handleProgressClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percentage = Math.max(0, Math.min(1, x / rect.width)); // 限制在0-1之间
    const newTime = percentage * (duration || 0);

    if (audioRef.current && duration > 0 && !isNaN(newTime)) {
      audioRef.current.currentTime = newTime;
      setCurrentTime(newTime);
    }
  };

  const skip = (seconds: number) => {
    if (audioRef.current) {
      audioRef.current.currentTime = Math.max(0, Math.min(duration, currentTime + seconds));
    }
  };

  // 【新功能】生成智能访达标签脚本（直接使用情绪词汇作为标签）
  const generateFinderTagScript = (): string => {
    if (audioFiles.length === 0) {
      return '# 没有音乐文件\n';
    }

    // 构建文件名到情绪的映射
    const fileMoodMap: Record<string, string> = {};
    audioFiles.forEach(file => {
      const mood = file.result?.mood?.primary || '';
      if (mood) {
        fileMoodMap[file.file.name] = mood;
      }
    });

    // 脚本头部
    let script = `#!/bin/bash`;
    script += `\n# 🏷️ 音乐情绪标签自动添加脚本`;
    script += `\n# 生成时间: ${new Date().toLocaleString('zh-CN')}`;
    script += `\n#`;
    script += `\n# 使用方法：`;
    script += `\n# 1. 将脚本保存到包含音乐文件的文件夹`;
    script += `\n# 2. 在终端中执行：chmod +x apply_tags.sh && ./apply_tags.sh`;

    script += `\n#`;
    script += `\n# ⚠️ 前置要求：需要安装 tag 工具`;
    script += `\n#    安装命令：brew install tag`;

    // 配置区域
    script += `\n`;
    script += `\n# ===== 配置区域 =====`;
    script += `\n`;
    script += `\n# 支持的音乐文件格式`;
    script += `\nMUSIC_EXTENSIONS=("mp3" "wav" "flac" "m4a" "aac" "ogg" "wma" "aiff")`;

    // 生成文件名到情绪的映射数据（使用更可靠的方式）
    script += `\n`;
    script += `\n# 文件名到情绪的映射数据（临时文件）`;
    script += `\n# 使用 Tab 字符作为分隔符，避免文件名中的特殊字符冲突`;
    script += `\nMAP_FILE="/tmp/music_mood_map_\$\$.txt"`;

    // 写入映射数据 - 使用 printf 和 Tab 分隔符，更可靠
    script += `\n`;
    script += `\n# 写入文件名和情绪的映射`;
    Object.entries(fileMoodMap).forEach(([fileName, mood]) => {
      // 使用 printf 的格式化字符串，避免特殊字符问题
      // %s 表示字符串，中间用 Tab (\t) 分隔
      script += `\nprintf '%s\\t%s\\n' '${fileName.replace(/'/g, "'\\''")}' '${mood.replace(/'/g, "'\\''")}' >> "\$MAP_FILE"`;
    });

    // 主逻辑
    script += `\n`;
    script += `\n# ===== 脚本逻辑 =====`;

    script += `\n`;
    script += `\n# 检查 tag 命令是否存在`;
    script += `\nif ! command -v tag &> /dev/null; then`;
    script += `\n    echo "❌ 错误: 未找到 tag 命令"`;
    script += `\n    echo ""`;
    script += `\n    echo "请先安装 tag 工具："`;
    script += `\n    echo "  brew install tag"`;
    script += `\n    rm -f "\$MAP_FILE"`;
    script += `\n    exit 1`;
    script += `\nfi`;

    script += `\n`;
    script += `\n# 获取当前脚本所在目录`;
    script += `\nSCRIPT_DIR="\$(cd "\$(dirname "\${BASH_SOURCE[0]}")" && pwd)"`;
    script += `\ncd "\$SCRIPT_DIR"`;

    script += `\n`;
    script += `\necho "🎵 音乐情绪标签自动添加脚本"`;
    script += `\necho "================================"`;
    script += `\necho "📁 工作目录: \$SCRIPT_DIR"`;
    script += `\necho ""`;
    script += `\n# 显示映射文件内容（用于调试）`;
    script += `\necho "📋 映射文件内容 (前5行):"`;
    script += `\nif [[ -f "\$MAP_FILE" ]]; then`;
    script += `\n    cat "\$MAP_FILE" | head -5`;
    script += `\n    map_count=\$(wc -l < "\$MAP_FILE")`;
    script += `\n    echo "   总共 $map_count 条映射记录"`;
    script += `\nelse`;
    script += `\n    echo "   ⚠️ 映射文件不存在！请在网页上先分析音乐文件，然后再下载脚本。"`;
    script += `\nfi`;
    script += `\necho ""`;
    script += `\necho "正在扫描音乐文件..."`;

    script += `\n`;
    script += `\n# 统计变量`;
    script += `\ntotal_files=0`;
    script += `\ntagged_files=0`;
    script += `\nskipped_files=0`;
    script += `\nerror_files=0`;

    script += `\n`;
    script += `\n# 遍历当前目录的所有文件`;
    script += `\nfor file in *; do`;
    script += `\n    # 跳过目录和脚本本身`;
    script += `\n    if [[ -d "\$file" ]] || [[ "\$file" == "apply_tags.sh" ]]; then`;
    script += `\n        continue`;
    script += `\n    fi`;

    script += `\n`;
    script += `\n    # 获取文件扩展名`;
    script += `\n    ext="\${file##*.}"`;
    script += `\n    ext_lower="\$(echo "\$ext" | tr '[:upper:]' '[:lower:]')"`;

    script += `\n`;
    script += `\n    # 检查是否是音乐文件`;
    script += `\n    is_music_file=false`;
    script += `\n    for music_ext in "\${MUSIC_EXTENSIONS[@]}"; do`;
    script += `\n        if [[ "\$ext_lower" == "\$music_ext" ]]; then`;
    script += `\n            is_music_file=true`;
    script += `\n            break`;
    script += `\n        fi`;
    script += `\n    done`;

    script += `\n`;
    script += `\n    if [[ "\$is_music_file" == false ]]; then`;
    script += `\n        continue`;
    script += `\n    fi`;

    script += `\n`;
    script += `\n    ((total_files++))`;

    script += `\n`;
    script += `\n    # 从映射文件中查找文件对应的情绪（使用精确匹配）`;
    script += `\n    mood="\$(awk -F'\\t' -v fname="\$file" '\$1 == fname {print \$2}' "\$MAP_FILE")"`;

    script += `\n`;
    script += `\n    if [[ -z "\$mood" ]]; then`;
    script += `\n        echo "⊘ 跳过: \$file (未找到情绪信息)"`;
    script += `\n        echo "   文件名: '\$file'"`;
    script += `\n        echo "   映射文件内容:"`;
    script += `\n        cat "\$MAP_FILE" | head -5`;
    script += `\n        ((skipped_files++))`;
    script += `\n        continue`;
    script += `\n    fi`;

    script += `\n`;
    script += `\n    # 添加标签（直接使用情绪词汇作为标签）`;
    script += `\n    if tag -a "\$mood" "\$file" 2>/dev/null; then`;
    script += `\n        echo "✅ 已添加标签: \$file"`;
    script += `\n        echo "   标签: \$mood"`;
    script += `\n        ((tagged_files++))`;
    script += `\n    else`;
    script += `\n        echo "❌ 失败: \$file"`;
    script += `\n        ((error_files++))`;
    script += `\n    fi`;
    script += `\ndone`;

    script += `\n`;
    script += `\n# 清理临时文件`;
    script += `\nrm -f "\$MAP_FILE"`;

    script += `\n`;
    script += `\n# 输出统计信息`;
    script += `\necho ""`;
    script += `\necho "================================"`;
    script += `\necho "📊 处理完成！"`;
    script += `\necho "   总文件数: \$total_files"`;
    script += `\necho "   已添加标签: \$tagged_files"`;
    script += `\necho "   跳过: \$skipped_files"`;
    script += `\necho "   失败: \$error_files"`;
    script += `\necho ""`;
    script += `\necho "✨ 在 Finder 中打开此文件夹，查看带有情绪标签的音乐文件！"`;
    script += `\necho "   open ."`;

    // 将 \$ 替换为 $（用于 Shell 脚本中的变量）
    return script.replace(/\\\$/g, '$');
  };

  // 【新功能】生成 AppleScript 应用（双击运行版本）
  const generateAppleScriptApp = (): string => {
    if (audioFiles.length === 0) {
      return '-- 没有音乐文件\n';
    }

    // 构建文件名到情绪的映射
    const fileMoodMap: Record<string, string> = {};
    audioFiles.forEach(file => {
      const mood = file.result?.mood?.primary || '';
      if (mood) {
        fileMoodMap[file.file.name] = mood;
      }
    });

    const appScript = `-- 🎵 音乐情绪标签自动添加脚本
-- 生成时间: ${new Date().toLocaleString('zh-CN')}
-- 
-- 使用方法：
-- 1. 双击此文件，会自动打开"脚本编辑器"
-- 2. 点击"运行"按钮（或按 ⌘R）
-- 3. 选择包含音乐文件的文件夹
-- 4. 等待处理完成

property supportedExtensions : {"mp3", "wav", "flac", "m4a", "aac", "ogg", "wma", "aiff"}

on run
  try
    -- 显示开始提示
    display dialog "音乐情绪标签自动添加器" & return & return & "即将扫描您选择的文件夹，为所有已分析的音乐文件添加情绪标签。" & return & return & "点击'开始'按钮继续..." buttons {"取消", "开始"} default button 2 with icon note
    
    -- 选择文件夹
    set folderPath to choose folder with prompt "请选择包含音乐文件的文件夹："
    
    -- 处理文件
    processFolder(folderPath)
    
    -- 显示完成提示
    display dialog "✨ 处理完成！" & return & return & "所有情绪标签已添加完成。现在可以在 Finder 中查看带有情绪标签的音乐文件了。" buttons {"好的"} default button 1 with icon note
    
  on error errMsg
    display dialog "❌ 发生错误：" & return & errMsg buttons {"确定"} default button 1 with icon stop
  end try
end run

on processFolder(folderPath)
  -- 设置 PATH 环境变量（包含 Homebrew 路径）
  set shellPath to "/bin/zsh"
  set shellCommand to "export PATH=/opt/homebrew/bin:/usr/local/bin:$PATH && which tag"
  
  -- 先检查 tag 命令是否可用
  try
    do shell script shellCommand
  on error
    display dialog "⚠️ 警告：未找到 tag 命令" & return & return & "请先安装 tag 工具：" & return & "  brew install tag" & return & return & "安装完成后，请重新运行此脚本。" buttons {"确定"} default button 1 with icon caution
    return
  end try
  
  tell application "Finder"
    set fileList to files of folderPath
    
    set totalFiles to 0
    set taggedFiles to 0
    set skippedFiles to 0
    set failedFiles to 0
    
    -- 处理每个文件
    repeat with currentFile in fileList
      set fileName to name of currentFile
      set fileExt to my getFileExtension(fileName)
      set filePath to POSIX path of (currentFile as alias)
      
      -- 检查是否是支持的音乐文件
      if fileExt is in supportedExtensions then
        set totalFiles to totalFiles + 1
        
        -- 查找情绪标签
        set moodTag to my lookupMood(fileName)
        
        if moodTag is not "" then
          try
            -- 使用 tag 命令添加标签（带 PATH）
            set tagCommand to "export PATH=/opt/homebrew/bin:/usr/local/bin:$PATH && tag -a " & quoted form of moodTag & space & quoted form of filePath
            do shell script tagCommand
            set taggedFiles to taggedFiles + 1
          on error errMsg
            -- 如果 tag 命令失败，记录错误
            set failedFiles to failedFiles + 1
            log "失败：" & fileName & " - " & errMsg
          end try
        else
          set skippedFiles to skippedFiles + 1
          log "跳过：" & fileName & "（未找到情绪标签）"
        end if
      end if
    end repeat
    
    -- 显示统计信息
    set resultMessage to "处理完成！" & return & return
    set resultMessage to resultMessage & "总文件数：" & totalFiles & return
    set resultMessage to resultMessage & "已添加标签：" & taggedFiles & return
    set resultMessage to resultMessage & "跳过：" & skippedFiles & return
    set resultMessage to resultMessage & "失败：" & failedFiles
    
    if taggedFiles = 0 then
      set resultMessage to resultMessage & return & return & "⚠️ 提示：请确保在网页上先分析这些音乐文件，然后再下载脚本。"
    end if
    
    display dialog resultMessage buttons {"好的"} default button 1 with icon note
  end tell

end processFolder

on getFileExtension(fileName)
  set oldDelimiters to AppleScript's text item delimiters
  set AppleScript's text item delimiters to "."
  set extension to last text item of fileName
  set AppleScript's text item delimiters to oldDelimiters
  return extension
end getFileExtension

on lookupMood(fileName)
  -- 文件名到情绪的映射表
  -- 使用 if-else 查找（比 where 子句更可靠）
${Object.entries(fileMoodMap).map(([fileName, mood]) => {
    // 转义文件名中的特殊字符
    const escapedFileName = fileName.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
    const escapedMood = mood.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
    return `  if fileName is "${escapedFileName}" then
    return "${escapedMood}"
  end if`;
}).join('\n  ')}
  
  return ""
end lookupMood
`;

    return appScript;
  };

  // 【新功能】生成 Finder 服务（右键菜单版本）
  const generateFinderService = (): string => {
    if (audioFiles.length === 0) {
      return '-- 没有音乐文件\n';
    }

    // 构建文件名到情绪的映射
    const fileMoodMap: Record<string, string> = {};
    audioFiles.forEach(file => {
      const mood = file.result?.mood?.primary || '';
      if (mood) {
        fileMoodMap[file.file.name] = mood;
      }
    });

    const serviceScript = `-- 🏷️ 音乐情绪标签服务
-- 生成时间: ${new Date().toLocaleString('zh-CN')}
-- 使用方法：在 Finder 中右键点击文件/文件夹，选择"添加情绪标签"

on run {input, parameters}
  -- input 可以是文件列表或文件夹
  
  tell application "Finder"
    set fileList to {}
    
    -- 处理输入：如果是文件夹，则获取其中的所有文件
    repeat with itemRef in input
      if kind of itemRef is "文件夹" then
        set fileList to fileList & (files of itemRef)
      else
        set fileList to fileList & {itemRef}
      end if
    end repeat
    
    -- 处理每个文件
    repeat with currentFile in fileList
      set fileName to name of currentFile
      set moodTag to lookupMood(fileName)
      
      if moodTag is not "" then
        try
          -- 添加标签
          set comment of currentFile to moodTag
        on error
          -- 备用方案：使用 tag 命令
          try
            do shell script "tag -a " & quoted form of moodTag & space & quoted form of (POSIX path of (currentFile as alias))
          end try
        end try
      end if
    end repeat
    
    -- 显示通知
    display notification "✨ 已完成情绪标签添加" with title "音乐情绪分析"
  end tell
  
  return input
end run

on lookupMood(fileName)
  -- 文件名到情绪的映射
  set moodMap to {
${Object.entries(fileMoodMap).map(([fileName, mood]) => 
    `    "${fileName}":"${mood}"`
  ).join(',\n')}
  }
  
  try
    return item 2 of moodMap where item 1 is fileName
  on error
    return ""
  end try
end lookupMood
`;

    return serviceScript;
  };

  // 【新功能】下载标签脚本（简化版）
  const downloadTagScript = () => {
    if (audioFiles.length === 0) {
      addNotification('warning', '请先上传音乐文件');
      return;
    }

    const script = generateFinderTagScript();
    const blob = new Blob([script], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = url;
    link.download = 'apply_tags.sh';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    addNotification(
      'success',
      `✅ Shell 脚本已下载！包含 ${audioFiles.length} 个音乐的标签映射。请将脚本放到音乐文件夹，然后运行 chmod +x apply_tags.sh && ./apply_tags.sh`
    );
  };

  // 【新功能】下载 AppleScript 应用（双击运行）
  const downloadAppleScriptApp = () => {
    if (audioFiles.length === 0) {
      addNotification('warning', '请先上传音乐文件');
      return;
    }

    const appScript = generateAppleScriptApp();
    const blob = new Blob([appScript], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = url;
    link.download = '添加情绪标签.applescript';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    addNotification(
      'success',
      `✅ AppleScript 脚本已下载！使用方法：1. 双击打开"脚本编辑器" 2. 点击"运行"按钮 3. 选择音乐文件夹 4. 完成！`
    );
  };

  // 【新功能】下载 Finder 服务（右键菜单）
  const downloadFinderService = () => {
    if (audioFiles.length === 0) {
      addNotification('warning', '请先上传音乐文件');
      return;
    }

    const serviceScript = generateFinderService();
    const blob = new Blob([serviceScript], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = url;
    link.download = '添加情绪标签.workflow.scpt';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    addNotification(
      'success',
      `✅ Finder 服务已下载！请将文件保存到 ~/Library/Services/ 文件夹，然后在 Finder 右键菜单中选择"添加情绪标签"`
    );
  };

  // 【新功能】添加标签映射
  const addTagMapping = () => {
    const newMapping: TagMapping = {
      moodKeyword: '',
      tagColor: 'none',
      tagName: ''
    };
    setTagMappings([...tagMappings, newMapping]);
  };

  // 【新功能】删除标签映射
  const removeTagMapping = (index: number) => {
    setTagMappings(tagMappings.filter((_, i) => i !== index));
  };

  // 【新功能】更新标签映射
  const updateTagMapping = (index: number, field: keyof TagMapping, value: any) => {
    setTagMappings(tagMappings.map((mapping, i) =>
      i === index ? { ...mapping, [field]: value } : mapping
    ));
  };

  // 【优化】公共的播放错误处理函数
  const handlePlayError = (err: unknown, fileName: string) => {
    console.error(`[音频播放] 播放失败 (${fileName}):`, err);
    const errorMessage = err instanceof Error ? err.message : String(err);
    addNotification('error', `播放失败 (${fileName}): ${errorMessage}`);
  };

  // 切换播放模式
  const togglePlayMode = () => {
    const modes: Array<'sequential' | 'loop-one' | 'shuffle'> = ['sequential', 'loop-one', 'shuffle'];
    const currentIndex = modes.indexOf(playMode);
    const nextIndex = (currentIndex + 1) % modes.length;
    setPlayMode(modes[nextIndex]);
    setShowPlayModeMenu(false);
  };

  // 播放上一首
  const playPrevious = () => {
    console.log('[音频播放] 播放上一首');
    if (playQueueMode === 'search' && dbSearchResults.length > 0) {
      // 搜索结果队列模式
      const currentIndex = currentSearchIndex;
      const prevIndex = currentIndex > 0 ? currentIndex - 1 : dbSearchResults.length - 1;
      const prevResult = dbSearchResults[prevIndex];

      console.log('[音频播放] 切换到上一首（搜索结果）:', prevResult.fileName);

      if (prevResult) {
        setCurrentSearchIndex(prevIndex);
        const matchedFile = audioFiles.find(f => f.file.name === prevResult.fileName);
        // 保存文件名供错误处理使用
        const fileNameForError = prevResult.fileName;

        if (matchedFile) {
          switchToFile(matchedFile.id);
          setTimeout(() => {
            if (audioRef.current) {
              audioRef.current.play().catch(err => {
                handlePlayError(err, prevResult.fileName);
              });
            }
          }, 100);
        } else {
          // 如果文件未上传，显示提示
          addNotification('warning', `文件 "${prevResult.fileName}" 未上传`);
        }
      }
    } else {
      // 上传文件队列模式
      if (audioFiles.length <= 1) return;

      const currentIndex = audioFiles.findIndex(f => f.id === currentFileId);
      const prevIndex = currentIndex > 0 ? currentIndex - 1 : audioFiles.length - 1;
      const prevFile = audioFiles[prevIndex];

      console.log('[音频播放] 切换到上一首（上传文件）:', prevFile.file.name);

      if (prevFile) {
        switchToFile(prevFile.id);
        setTimeout(() => {
          if (audioRef.current) {
            audioRef.current.play().catch(err => {
              handlePlayError(err, prevFile.file.name);
            });
          }
        }, 100);
      }
    }
  };

  // 播放下一首
  const playNext = () => {
    console.log('[音频播放] 播放下一首');
    if (playQueueMode === 'search' && dbSearchResults.length > 0) {
      // 搜索结果队列模式
      let nextIndex = 0;

      if (playMode === 'shuffle') {
        // 随机播放
        nextIndex = Math.floor(Math.random() * dbSearchResults.length);
      } else {
        // 顺序播放
        const currentIndex = currentSearchIndex;
        nextIndex = currentIndex < dbSearchResults.length - 1 ? currentIndex + 1 : 0;
      }

      const nextResult = dbSearchResults[nextIndex];
      if (nextResult) {
        console.log('[音频播放] 切换到下一首（搜索结果）:', nextResult.fileName);
        setCurrentSearchIndex(nextIndex);
        const matchedFile = audioFiles.find(f => f.file.name === nextResult.fileName);
        // 保存文件名供错误处理使用
        const fileNameForError = nextResult.fileName;

        if (matchedFile) {
          switchToFile(matchedFile.id);
          setTimeout(() => {
            if (audioRef.current) {
              audioRef.current.play().catch(err => {
                handlePlayError(err, nextResult.fileName);
              });
            }
          }, 100);
        } else {
          // 如果文件未上传，显示提示并继续播放下一首
          addNotification('warning', `文件 "${nextResult.fileName}" 未上传`);
          // 延迟后尝试播放下一首
          setTimeout(() => {
            playNext();
          }, 500);
        }
      }
    } else {
      // 上传文件队列模式
      if (audioFiles.length === 0) return;

      let nextIndex = 0;

      if (playMode === 'shuffle') {
        // 随机播放
        nextIndex = Math.floor(Math.random() * audioFiles.length);
      } else {
        const currentIndex = audioFiles.findIndex(f => f.id === currentFileId);
        nextIndex = currentIndex < audioFiles.length - 1 ? currentIndex + 1 : 0;
      }

      const nextFile = audioFiles[nextIndex];
      if (nextFile) {
        console.log('[音频播放] 切换到下一首（上传文件）:', nextFile.file.name);
        switchToFile(nextFile.id);
        setTimeout(() => {
          if (audioRef.current) {
            audioRef.current.play().catch(err => {
              handlePlayError(err, nextFile.file.name);
            });
          }
        }, 100);
      }
    }
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVolume = parseFloat(e.target.value);
    setVolume(newVolume);
    setIsMuted(false);
    // 立即应用到音频元素，确保无延迟
    if (audioRef.current) {
      audioRef.current.volume = newVolume;
    }
  };

  const toggleMute = () => {
    setIsMuted(prev => {
      const newState = !prev;
      if (audioRef.current) {
        audioRef.current.volume = newState ? 0 : volume;
      }
      return newState;
    });
  };

  /**
   * 处理播放速度变化
   * @param speed 播放速度（0.5x-2x）
   */
  const handleSpeedChange = (speed: number) => {
    setPlaybackSpeed(speed);
    setShowSpeedMenu(false);
    // 立即应用到音频元素
    if (audioRef.current) {
      audioRef.current.playbackRate = speed;
    }
  };

  /**
   * 处理文件上传事件
   * @param e 文件输入变化事件
   */
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    console.log('[文件上传] 触发文件选择事件');
    const files = e.target.files;
    console.log('[文件上传] 选择的文件:', files, '数量:', files?.length);

    if (files && files.length > 0) {
      console.log('[文件上传] 调用addFiles添加文件');
      await addFiles(files);
      // 清空错误消息
      setError('');
      // 不要重置播放状态，保持当前播放状态不变
      // 只有在第一次添加文件时才设置当前文件
      if (audioFiles.length === 0) {
        setCurrentTime(0);
        setDuration(0);
        setIsPlaying(false);
      }
    }
  };

  const extractAudioFeatures = async (file: File): Promise<AudioFeatures> => {
    return new Promise((resolve, reject) => {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const reader = new FileReader();

      reader.onload = async () => {
        try {
          const arrayBuffer = reader.result as ArrayBuffer;
          const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

          const bpm = await estimateBPM(audioBuffer, audioContext);
          const frequencyProfile = analyzeFrequency(audioBuffer);
          const energy = analyzeEnergy(audioBuffer);
          const dynamics = analyzeDynamics(audioBuffer);
          const rhythm = analyzeRhythm(audioBuffer);
          const harmonic = analyzeHarmonic(audioBuffer);
          const texture = analyzeTexture(audioBuffer);

          resolve({
            bpm: Math.round(bpm),
            duration: audioBuffer.duration,
            frequencyProfile,
            energy,
            dynamics,
            rhythm,
            harmonic,
            texture,
          });
        } catch (err) {
          reject(err);
        }
      };

      reader.onerror = () => reject(reader.error);
      reader.readAsArrayBuffer(file);
    });
  };

  const estimateBPM = async (buffer: AudioBuffer, audioContext: AudioContext): Promise<number> => {
    const rawData = buffer.getChannelData(0);
    const sampleRate = buffer.sampleRate;
    const samples = buffer.length;

    const windowSize = Math.floor(sampleRate / 10);
    const envelope = [];
    for (let i = 0; i < samples - windowSize; i += windowSize) {
      let sum = 0;
      for (let j = 0; j < windowSize; j++) {
        sum += Math.abs(rawData[i + j]);
      }
      envelope.push(sum / windowSize);
    }

    const peaks = [];
    for (let i = 1; i < envelope.length - 1; i++) {
      if (envelope[i] > envelope[i - 1] && envelope[i] > envelope[i + 1]) {
        if (envelope[i] > envelope.reduce((a, b) => a + b, 0) / envelope.length) {
          peaks.push(i);
        }
      }
    }

    if (peaks.length < 2) return 120;

    const intervals = [];
    for (let i = 1; i < peaks.length; i++) {
      intervals.push(peaks[i] - peaks[i - 1]);
    }
    const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;

    const bpm = (60 * sampleRate) / (avgInterval * windowSize);
    return Math.min(Math.max(bpm, 60), 200);
  };

  const analyzeFrequency = (buffer: AudioBuffer) => {
    const low = 0.3 + Math.random() * 0.2;
    const mid = 0.4 + Math.random() * 0.2;
    const high = 0.1 + Math.random() * 0.1;

    return {
      low: parseFloat(low.toFixed(2)),
      mid: parseFloat(mid.toFixed(2)),
      high: parseFloat(high.toFixed(2)),
    };
  };

  const analyzeEnergy = (buffer: AudioBuffer) => {
    const rawData = buffer.getChannelData(0);
    let sum = 0;
    for (let i = 0; i < rawData.length; i++) {
      sum += rawData[i] * rawData[i];
    }
    const rms = Math.sqrt(sum / rawData.length);
    return parseFloat((rms * 100).toFixed(2));
  };

  const analyzeDynamics = (buffer: AudioBuffer) => {
    const rawData = buffer.getChannelData(0);
    let sum = 0;
    let max = 0;
    for (let i = 0; i < rawData.length; i++) {
      const absVal = Math.abs(rawData[i]);
      sum += absVal;
      if (absVal > max) max = absVal;
    }
    const average = sum / rawData.length;
    return {
      average: parseFloat((average * 100).toFixed(2)),
      max: parseFloat((max * 100).toFixed(2)),
      range: parseFloat(((max - average) * 100).toFixed(2)),
    };
  };

  const analyzeRhythm = (buffer: AudioBuffer) => {
    const rawData = buffer.getChannelData(0);
    const sampleRate = buffer.sampleRate;
    
    const windowSize = Math.floor(sampleRate / 20);
    const windows = [];
    for (let i = 0; i < rawData.length - windowSize; i += windowSize) {
      let sum = 0;
      for (let j = 0; j < windowSize; j++) {
        sum += Math.abs(rawData[i + j]);
      }
      windows.push(sum / windowSize);
    }
    
    const mean = windows.reduce((a, b) => a + b, 0) / windows.length;
    const variance = windows.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / windows.length;
    const consistency = Math.max(0, Math.min(1, 1 - variance / mean));
    
    const complexity = Math.min(1, (buffer.sampleRate / buffer.duration) / 1000000);
    
    return {
      consistency: parseFloat(consistency.toFixed(2)),
      complexity: parseFloat(complexity.toFixed(2)),
    };
  };

  const analyzeHarmonic = (buffer: AudioBuffer) => {
    const rawData = buffer.getChannelData(0);
    const sampleRate = buffer.sampleRate;
    
    const fftSize = 2048;
    const spectrogram = [];
    
    for (let i = 0; i < Math.min(rawData.length, sampleRate * 5); i += fftSize / 2) {
      let sum = 0;
      for (let j = 0; j < fftSize && i + j < rawData.length; j++) {
        sum += Math.abs(rawData[i + j]);
      }
      spectrogram.push(sum / fftSize);
    }
    
    const midPoint = Math.floor(spectrogram.length / 2);
    const highFreq = spectrogram.slice(midPoint).reduce((a, b) => a + b, 0);
    const lowFreq = spectrogram.slice(0, midPoint).reduce((a, b) => a + b, 0);
    const brightness = lowFreq > 0 ? highFreq / (highFreq + lowFreq) : 0;
    
    const warmth = 1 - brightness;
    
    return {
      brightness: parseFloat(brightness.toFixed(2)),
      warmth: parseFloat(warmth.toFixed(2)),
    };
  };

  const analyzeTexture = (buffer: AudioBuffer) => {
    const rawData = buffer.getChannelData(0);
    
    let totalEnergy = 0;
    let peakCount = 0;
    const threshold = 0.3;
    
    for (let i = 0; i < rawData.length; i++) {
      totalEnergy += Math.abs(rawData[i]);
      if (Math.abs(rawData[i]) > threshold) peakCount++;
    }
    
    const density = peakCount / rawData.length * 100;
    
    const layering = buffer.numberOfChannels > 1 ? 0.7 + Math.random() * 0.2 : 0.3 + Math.random() * 0.3;
    
    return {
      density: parseFloat(density.toFixed(2)),
      layering: parseFloat(layering.toFixed(2)),
    };
  };

  // 生成文件的缓存key（基于文件名和大小）
  const getFileCacheKey = (file: File): string => {
    return `${file.name}_${file.size}`;
  };

  // 生成搜索查询
  const generateSearchQuery = (result: AnalysisResult, fileName: string): string => {
    const parts: string[] = [];

    // 添加文件名（可能包含有用信息）
    if (fileName) {
      parts.push(fileName.replace(/\.[^/.]+$/, '')); // 去除扩展名
    }

    // 添加风格
    if (result.style?.primary) {
      parts.push(result.style.primary);
    }

    // 添加主要乐器
    if (result.instruments?.primary && result.instruments.primary.length > 0) {
      parts.push(result.instruments.primary.slice(0, 3).join(' '));
    }

    // 添加情绪
    if (result.mood?.primary) {
      parts.push(ensureStringMoodPrimary(result.mood.primary));
    }

    // 如果AI已经给出了影视名称，包含在搜索中
    if (result.musicOrigin?.filmOrTV?.name) {
      parts.push(result.musicOrigin.filmOrTV.name);
    }

    // 如果AI已经给出了专辑名，包含在搜索中
    if (result.musicOrigin?.album?.name) {
      parts.push(result.musicOrigin.album.name);
    }

    // 构建查询
    return parts.slice(0, 5).join(' ');
  };

  // 格式化音乐出处信息
  const formatMusicOrigin = (musicOrigin: AnalysisResult['musicOrigin']): string => {
    if (!musicOrigin) return '';

    const parts: string[] = [];

    if (musicOrigin.sourceType) {
      parts.push(`来源类型：${musicOrigin.sourceType}`);
    }

    if (musicOrigin.filmOrTV?.name) {
      const tvParts = [`影视/综艺：${musicOrigin.filmOrTV.name}`];
      if (musicOrigin.filmOrTV.episode) tvParts.push(`（${musicOrigin.filmOrTV.episode}）`);
      if (musicOrigin.filmOrTV.scene) tvParts.push(` - ${musicOrigin.filmOrTV.scene}`);
      parts.push(tvParts.join(''));
    }

    if (musicOrigin.album?.name) {
      const albumParts = [`专辑：${musicOrigin.album.name}`];
      if (musicOrigin.album.releaseYear) albumParts.push(`（${musicOrigin.album.releaseYear}）`);
      if (musicOrigin.album.label) albumParts.push(` - ${musicOrigin.album.label}`);
      parts.push(albumParts.join(''));
    }

    if (musicOrigin.creators) {
      const creatorParts: string[] = [];
      if (musicOrigin.creators.composer) creatorParts.push(`作曲：${musicOrigin.creators.composer}`);
      if (musicOrigin.creators.singer) creatorParts.push(`演唱：${musicOrigin.creators.singer}`);
      if (musicOrigin.creators.arranger) creatorParts.push(`编曲：${musicOrigin.creators.arranger}`);
      if (musicOrigin.creators.lyricist) creatorParts.push(`作词：${musicOrigin.creators.lyricist}`);
      if (creatorParts.length > 0) parts.push(creatorParts.join(' | '));
    }

    if (musicOrigin.reasoning) {
      parts.push(`判断依据：${musicOrigin.reasoning}`);
    }

    if (musicOrigin.uncertaintyReason) {
      parts.push(`不确定原因：${musicOrigin.uncertaintyReason}`);
    }

    return parts.join('\n');
  };

  // 二次识别：触发场景二次识别
  const triggerSceneReanalysis = async (
    fileItem: AudioFileItem,
    features: AudioFeatures,
    result: AnalysisResult
  ): Promise<void> => {
    try {
      // 更新状态为"二次识别中"
      setAudioFiles(prev =>
        prev.map(f =>
          f.id === fileItem.id ? { ...f, sceneReanalyzing: true } : f
        )
      );

      // 构建情绪特征
      const emotionalFeatures: any = {
        primary: result.mood.primary,
        intensity: result.mood.intensity || 'medium',
        secondary: [],
      };

      // 从次要情绪中提取情绪
      if (result.mood.trajectory) {
        emotionalFeatures.secondary.push(result.mood.trajectory);
      }
      if (result.filmMusic.emotionalGuidance) {
        emotionalFeatures.secondary.push(result.filmMusic.emotionalGuidance);
      }

      // 调用二次识别API
      const reanalysisResponse = await fetch('/api/reanalyze-scene', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileName: fileItem.file.name,
          audioFeatures: features,
          emotionalFeatures,
          filmType: result.filmMusic.filmType,
        }),
      });

      if (!reanalysisResponse.ok) {
        throw new Error('二次识别请求失败');
      }

      const reanalysisData = await reanalysisResponse.json();

      if (reanalysisData.success) {
        const { matched, bestMatch, allMatches, candidateScenes } = reanalysisData;

        if (matched && bestMatch) {
          // 匹配成功：更新场景标签
          console.log(`[二次识别] 文件"${fileItem.file.name}"匹配成功: ${bestMatch.sceneName}`);

          // 更新分析结果中的场景标签
          const updatedResult = {
            ...result,
            filmMusic: {
              ...result.filmMusic,
              scenes: [
                {
                  type: bestMatch.sceneName,
                  description: bestMatch.reason,
                  emotionalImpact: '',
                  usageTips: '',
                },
              ],
            },
          };

          // 更新文件状态
          setAudioFiles(prev =>
            prev.map(f =>
              f.id === fileItem.id
                ? {
                    ...f,
                    result: updatedResult,
                    sceneReanalyzing: false,
                    sceneReanalysisResult: { matched, bestMatch },
                  }
                : f
            )
          );

          // 更新数据库中的场景标签
          await updateSceneTagInDatabase(fileItem.file.name, bestMatch.sceneName);

          // 如果有候选场景词，自动纳入词库待审核列表
          if (candidateScenes && candidateScenes.length > 0) {
            await saveCandidateScenesToTermLibrary(
              candidateScenes,
              result.filmMusic.filmType
            );
          }

          // 提示用户
          console.log(`[二次识别] 已更新场景标签为"${bestMatch.sceneName}"`);
        } else {
          // 匹配失败：存入待优化样本库
          console.log(`[二次识别] 文件"${fileItem.file.name}"匹配失败，存入待优化样本库`);

          // 保存到待优化样本库
          await saveToOptimizationSamples(
            fileItem,
            features,
            emotionalFeatures,
            allMatches
          );

          // 更新文件状态
          setAudioFiles(prev =>
            prev.map(f =>
              f.id === fileItem.id
                ? {
                    ...f,
                    sceneReanalyzing: false,
                    sceneReanalysisResult: { matched: false },
                  }
                : f
            )
          );

          // 如果有候选场景词，自动纳入词库待审核列表
          if (candidateScenes && candidateScenes.length > 0) {
            await saveCandidateScenesToTermLibrary(
              candidateScenes,
              result.filmMusic.filmType
            );
          }
        }
      } else {
        throw new Error(reanalysisData.error || '二次识别失败');
      }
    } catch (error) {
      console.error(`[二次识别] 文件"${fileItem.file.name}"二次识别失败:`, error);

      // 更新文件状态
      setAudioFiles(prev =>
        prev.map(f =>
          f.id === fileItem.id
            ? { ...f, sceneReanalyzing: false }
            : f
        )
      );
    }
  };

  // 二次识别：更新数据库中的场景标签
  const updateSceneTagInDatabase = async (
    fileName: string,
    sceneName: string
  ): Promise<void> => {
    try {
      const response = await fetch(`/api/music-analyses?fileName=${encodeURIComponent(fileName)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scenarios: [sceneName],
        }),
      });

      if (response.ok) {
        console.log(`[二次识别] 已更新数据库中"${fileName}"的场景标签`);
      }
    } catch (error) {
      console.error('[二次识别] 更新数据库场景标签失败:', error);
    }
  };

  // 二次识别：保存到待优化样本库
  const saveToOptimizationSamples = async (
    fileItem: AudioFileItem,
    features: AudioFeatures,
    emotionalFeatures: any,
    matchResults: any[]
  ): Promise<void> => {
    try {
      const bestMatch = matchResults[0];

      await fetch('/api/scene-optimization-samples', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileName: fileItem.file.name,
          fileKey: fileItem.fileKey,
          audioFeatures: features,
          emotionalFeatures,
          matchResults,
          bestMatch: bestMatch
            ? {
                sceneName: bestMatch.sceneName,
                matchScore: bestMatch.matchScore,
                confidence:
                  bestMatch.matchScore >= 85
                    ? 'high'
                    : bestMatch.matchScore >= 75
                    ? 'medium'
                    : 'low',
                reason: '',
              }
            : null,
          candidateScenes: [],
        }),
      });

      console.log(`[二次识别] 已保存"${fileItem.file.name}"到待优化样本库`);
    } catch (error) {
      console.error('[二次识别] 保存待优化样本失败:', error);
    }
  };

  // 二次识别：保存候选场景词到词库待审核列表
  const saveCandidateScenesToTermLibrary = async (
    candidateScenes: any[],
    filmType?: string
  ): Promise<void> => {
    try {
      for (const candidate of candidateScenes) {
        await fetch('/api/term-management/auto-expand-scene', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            term: candidate.sceneName,
            category: 'scenario',
            filmTypes: filmType ? [filmType] : [],
            confidence: candidate.confidence,
            reason: candidate.reason,
          }),
        });
      }

      console.log(`[二次识别] 已保存${candidateScenes.length}个候选场景词到词库待审核列表`);
    } catch (error) {
      console.error('[二次识别] 保存候选场景词失败:', error);
    }
  };

  // 二次识别：手动触发二次识别（单个文件）
  const manualTriggerSceneReanalysis = async (
    fileItem: AudioFileItem
  ): Promise<void> => {
    if (!fileItem.result) {
      alert('该文件尚未完成分析，无法进行二次识别');
      return;
    }

    if (!confirm(`确定要对文件"${fileItem.file.name}"进行二次识别吗？`)) {
      return;
    }

    // 如果没有音频特征，先提取
    let features = fileItem.features;
    if (!features) {
      try {
        features = await extractAudioFeatures(fileItem.file);
        setAudioFiles(prev =>
          prev.map(f =>
            f.id === fileItem.id ? { ...f, features } : f
          )
        );
      } catch (error) {
        alert('提取音频特征失败');
        return;
      }
    }

    await triggerSceneReanalysis(fileItem, features, fileItem.result);
  };

  // 二次识别：批量手动触发二次识别
  const batchTriggerSceneReanalysis = async (
    selectedFileIds: string[]
  ): Promise<void> => {
    if (selectedFileIds.length === 0) {
      alert('请先选择需要二次识别的文件');
      return;
    }

    const filesToReanalyze = audioFiles.filter(
      f => selectedFileIds.includes(f.id) && f.result
    );

    if (filesToReanalyze.length === 0) {
      alert('没有可进行二次识别的文件');
      return;
    }

    if (
      !confirm(
        `确定要对 ${filesToReanalyze.length} 个文件进行二次识别吗？`
      )
    ) {
      return;
    }

    // 并行处理
    const promises = filesToReanalyze.map(fileItem =>
      manualTriggerSceneReanalysis(fileItem)
    );

    await Promise.allSettled(promises);
  };

  // 分析单个文件
  const analyzeSingleFile = async (fileItem: AudioFileItem): Promise<void> => {
    // 计算文件MD5值（用于重复检测）
    let musicMd5: string | undefined;
    if (!analysisConfig.skipMD5Calculation) {
      try {
        musicMd5 = await calculateFileMD5(fileItem.file);
        console.log(`[MD5计算] 文件"${fileItem.file.name}"的MD5: ${musicMd5}`);
        // 更新fileItem中的musicMd5字段
        setAudioFiles(prev =>
          prev.map(f =>
            f.id === fileItem.id ? { ...f, musicMd5 } : f
          )
        );
      } catch (error) {
        console.warn(`[MD5计算] 计算文件"${fileItem.file.name}"的MD5失败:`, error);
      }
    } else {
      console.log(`[MD5计算] 已跳过MD5计算（性能优化配置）`);
    }

    // 【本地缓存优先】检查本地 IndexedDB 中是否已存在该文件的分析结果
    try {
      if (musicMd5) {
        const localCache = await audioFilesDB.getByMD5(musicMd5);
        if (localCache && localCache.result) {
          console.log(`[本地缓存命中] 文件"${fileItem.file.name}"已存在于本地 IndexedDB（MD5: ${musicMd5}），直接复用结果`);

          // 提取音频特征（用于显示）
          let features: AudioFeatures | null = null;
          try {
            features = await extractAudioFeatures(fileItem.file);
          } catch (error) {
            console.warn('[本地缓存命中] 提取音频特征失败:', error);
          }

          // 更新文件状态为使用本地缓存结果
          setAudioFiles(prev =>
            prev.map(f =>
              f.id === fileItem.id
                ? {
                    ...f,
                    features: features,
                    result: localCache.result,
                    musicMd5: musicMd5,
                    isAnalyzing: false,
                    error: '',
                    // 保留本地缓存中的上传状态
                    isUploaded: localCache.isUploaded || false,
                    isOnline: localCache.isOnline || false,
                    uploadedAt: localCache.uploadedAt || null,
                  }
                : f
            )
          );

          // 如果是当前文件，更新 streamText
          if (fileItem.id === currentFileId) {
            setStreamText(JSON.stringify(localCache.result, null, 2));
          }

          return; // 跳过后续分析流程
        } else {
          console.log(`[本地缓存未命中] 文件"${fileItem.file.name}"在本地 IndexedDB 中未找到（MD5: ${musicMd5}），继续查询数据库`);
        }
      }
    } catch (error) {
      console.warn('[本地缓存优先] 查询本地 IndexedDB 失败，继续查询数据库:', error);
    }

    // 【重复上传免分析】检查数据库中是否已存在该文件的分析结果（通过MD5查询）
    try {
      if (musicMd5) {
        const checkResponse = await fetch(`/api/music-analyses/check-md5?md5=${encodeURIComponent(musicMd5)}`);
        if (checkResponse.ok) {
          const checkData = await checkResponse.json();
          if (checkData.success && checkData.data) {
            console.log(`[重复上传免分析] 文件"${fileItem.file.name}"已存在于数据库（MD5: ${musicMd5}），复用已有结果`);

          // 从数据库中获取已有的分析结果
          const existingAnalysis = checkData.data;

          // 构建分析结果对象
          const analysisResult: AnalysisResult = {
            mood: {
              primary: existingAnalysis.summary || '未识别',
              intensity: existingAnalysis.otherFeatures?.moodIntensity || '',
              trajectory: existingAnalysis.otherFeatures?.moodTrajectory || '',
              emotionalDimensions: existingAnalysis.otherFeatures?.emotionalDimensions || {
                happiness: 0,
                sadness: 0,
                tension: 0,
                romance: 0,
                epic: 0,
              },
            },
            instruments: {
              primary: (existingAnalysis.instruments || []).slice(0, 3),
              accompaniment: (existingAnalysis.instruments || []).slice(3),
              percussion: [],
              electronicElements: '',
              timbre: '',
            },
            style: {
              primary: (existingAnalysis.styles || [])[0] || '未识别',
              subGenre: (existingAnalysis.styles || [])[1] || '',
              genreBlending: '',
              era: '',
            },
            filmMusic: {
              filmType: existingAnalysis.filmType || '未分类',
              suitableGenres: existingAnalysis.filmScenes || [],
              scenes: (existingAnalysis.scenarios || []).map((s: string) => ({
                type: s,
                description: '',
                emotionalImpact: '',
                usageTips: ''
              })),
              turningPoints: '',
              characterTheme: {
                suitable: '',
                characterType: '',
                storyArc: ''
              },
              atmosphere: '',
              emotionalGuidance: ''
            },
            musicalStructure: {
              form: existingAnalysis.otherFeatures?.structure || '',
              chorus: '',
              bridge: '',
              repeatPatterns: ''
            },
            harmony: {
              tonality: existingAnalysis.otherFeatures?.harmony || '',
              key: '',
              chordProgression: '',
              modulation: ''
            },
            rhythm: {
              timeSignature: '',
              rhythmPattern: '',
              groove: existingAnalysis.otherFeatures?.rhythm || ''
            },
            culturalContext: {
              origin: existingAnalysis.otherFeatures?.culture || '',
              influences: [],
              modernInterpretation: ''
            },
            musicOrigin: existingAnalysis.sourceType ? {
              confidenceLevel: existingAnalysis.confidence === 'high' ? '高' : existingAnalysis.confidence === 'medium' ? '中' : '低',
              sourceType: existingAnalysis.sourceType as '影视原声' | '专辑' | '独立单曲' | '综艺' | '游戏配乐' | '广告' | '不确定',
              filmOrTV: existingAnalysis.filmName ? {
                name: existingAnalysis.filmName,
                episode: existingAnalysis.filmScene,
                scene: '',
                platform: existingAnalysis.platform
              } : undefined,
              album: existingAnalysis.album ? {
                name: existingAnalysis.album,
                releaseYear: existingAnalysis.metadata?.year,
                genre: existingAnalysis.metadata?.genre,
                trackNumber: existingAnalysis.metadata?.track
              } : undefined,
              creators: existingAnalysis.creators ? {
                composers: existingAnalysis.creators.composer || [],
                singers: existingAnalysis.creators.singer || [],
                arrangers: existingAnalysis.creators.arranger || [],
                lyricists: existingAnalysis.creators.lyricist || [],
                producers: existingAnalysis.creators.producer || []
              } : undefined,
              reasoning: existingAnalysis.confidenceReason || ''
            } as any : undefined,
            candidateTerms: existingAnalysis.candidateTerms || undefined,
          };

          // 提取音频特征（用于显示）
          let features: AudioFeatures | null = null;
          try {
            features = await extractAudioFeatures(fileItem.file);
          } catch (error) {
            console.warn('[重复上传免分析] 提取音频特征失败:', error);
          }

          // 更新文件状态为使用已有结果
          setAudioFiles(prev =>
            prev.map(f =>
              f.id === fileItem.id
                ? {
                    ...f,
                    features: features,
                    result: analysisResult,
                    musicMd5: musicMd5, // 保留MD5值
                    isAnalyzing: false,
                    error: '',
                    // 保留数据库中的上传状态
                    isUploaded: existingAnalysis.isUploaded || false,
                    isOnline: existingAnalysis.isOnline || false,
                    uploadedAt: existingAnalysis.uploadedAt || null,
                    isUploading: true,
                    uploadStatus: 'pending',
                  }
                : f
            )
          );

          // 上传文件到对象存储
          let fileKey: string | null = null;
          let uploadError: string | undefined = undefined;

          try {
            const uploadResponse = await fetch('/api/upload-music', {
              method: 'POST',
              headers: {
                'Content-Type': fileItem.file.type || 'audio/mpeg',
                'x-file-name': encodeURIComponent(fileItem.file.name),
                'x-file-size': fileItem.file.size.toString(),
              },
              body: fileItem.file,
            });

            if (uploadResponse.ok) {
              const uploadData = await uploadResponse.json();
              fileKey = uploadData.data.fileKey;
              console.log('[重复上传免分析] 文件已上传到对象存储:', fileKey);
            } else {
              const errorText = await uploadResponse.text();
              uploadError = `文件上传失败: ${errorText}`;
              console.error('[重复上传免分析] 文件上传失败:', errorText);
            }
          } catch (error) {
            uploadError = `上传文件到对象存储时出错: ${error instanceof Error ? error.message : '未知错误'}`;
            console.error('[重复上传免分析] 上传文件到对象存储时出错:', error);
          }

          // 更新上传状态
          if (fileKey) {
            setAudioFiles(prev =>
              prev.map(f =>
                f.id === fileItem.id
                  ? {
                      ...f,
                      uploadStatus: 'success',
                      fileKey: fileKey,
                      isUploading: false,
                    }
                  : f
              )
            );
          } else {
            setAudioFiles(prev =>
              prev.map(f =>
                f.id === fileItem.id
                  ? {
                      ...f,
                      uploadStatus: uploadError ? 'failed' : 'pending',
                      uploadError: uploadError,
                      isUploading: false,
                    }
                  : f
              )
            );
          }

          // 更新数据库中的 isOnline 状态为 true
          if (fileKey) {
            try {
              await fetch('/api/music-analyses/set-online', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  fileName: fileItem.file.name,
                  isOnline: true,
                }),
              });
              console.log('[重复上传免分析] 已更新数据库在线状态');
            } catch (error) {
              console.error('[重复上传免分析] 更新数据库在线状态失败:', error);
            }
          }

          // 如果是当前文件，更新 streamText
          if (fileItem.id === currentFileId) {
            setStreamText(JSON.stringify(analysisResult, null, 2));
          }

          return; // 跳过后续分析流程
        }
      }
    }
    } catch (error) {
      console.warn('[重复上传免分析] 检查数据库失败，继续正常分析流程:', error);
    }

    // 【数据库优先】检查数据库中是否已存在该文件名的分析结果（通过文件名查询）
    // 这个检查用于优先使用批量更新后的数据（scenarios、filmType等）
    try {
      const fileName = fileItem.file.name;
      const fileNameResponse = await fetch(`/api/music-analyses?fileName=${encodeURIComponent(fileName)}`);
      if (fileNameResponse.ok) {
        const fileNameData = await fileNameResponse.json();
        if (fileNameData.success && fileNameData.data) {
          console.log(`[数据库优先] 文件"${fileName}"已存在于数据库，复用已有结果（包括批量更新后的数据）`);

          // 从数据库中获取已有的分析结果
          const existingAnalysis = fileNameData.data;

          // 构建分析结果对象
          const analysisResult: AnalysisResult = {
            mood: {
              primary: existingAnalysis.summary || '未识别',
              intensity: existingAnalysis.otherFeatures?.moodIntensity || '',
              trajectory: existingAnalysis.otherFeatures?.moodTrajectory || '',
              emotionalDimensions: existingAnalysis.otherFeatures?.emotionalDimensions || {
                happiness: 0,
                sadness: 0,
                tension: 0,
                romance: 0,
                epic: 0,
              },
            },
            instruments: {
              primary: (existingAnalysis.instruments || []).slice(0, 3),
              accompaniment: (existingAnalysis.instruments || []).slice(3),
              percussion: [],
              electronicElements: '',
              timbre: '',
            },
            style: {
              primary: (existingAnalysis.styles || [])[0] || '未识别',
              subGenre: (existingAnalysis.styles || [])[1] || '',
              genreBlending: '',
              era: '',
            },
            filmMusic: {
              filmType: existingAnalysis.filmType || '未分类',
              suitableGenres: existingAnalysis.filmScenes || [],
              // 【重要】使用数据库中的 scenarios（批量更新后的场景建议）
              scenes: (existingAnalysis.scenarios || []).map((s: string) => ({
                type: s,
                description: '',
                emotionalImpact: '',
                usageTips: ''
              })),
              turningPoints: '',
              characterTheme: {
                suitable: '',
                characterType: '',
                storyArc: ''
              },
              atmosphere: '',
              emotionalGuidance: ''
            },
            musicalStructure: {
              form: existingAnalysis.otherFeatures?.structure || '',
              chorus: '',
              bridge: '',
              repeatPatterns: ''
            },
            harmony: {
              tonality: existingAnalysis.otherFeatures?.harmony || '',
              key: '',
              chordProgression: '',
              modulation: ''
            },
            rhythm: {
              timeSignature: '',
              rhythmPattern: '',
              groove: existingAnalysis.otherFeatures?.rhythm || ''
            },
            culturalContext: {
              origin: existingAnalysis.otherFeatures?.culture || '',
              influences: [],
              modernInterpretation: ''
            },
            musicOrigin: existingAnalysis.sourceType ? {
              confidenceLevel: existingAnalysis.confidence === 'high' ? '高' : existingAnalysis.confidence === 'medium' ? '中' : '低',
              sourceType: existingAnalysis.sourceType as '影视原声' | '专辑' | '独立单曲' | '综艺' | '游戏配乐' | '广告' | '不确定',
              filmOrTV: existingAnalysis.filmName ? {
                name: existingAnalysis.filmName,
                episode: existingAnalysis.filmScene,
                scene: '',
                platform: existingAnalysis.platform
              } : undefined,
              album: existingAnalysis.album ? {
                name: existingAnalysis.album,
                releaseYear: existingAnalysis.metadata?.year,
                genre: existingAnalysis.metadata?.genre,
                trackNumber: existingAnalysis.metadata?.track
              } : undefined,
              creators: existingAnalysis.creators ? {
                composers: existingAnalysis.creators.composer || [],
                singers: existingAnalysis.creators.singer || [],
                arrangers: existingAnalysis.creators.arranger || [],
                lyricists: existingAnalysis.creators.lyricist || [],
                producers: existingAnalysis.creators.producer || []
              } : undefined,
              reasoning: existingAnalysis.confidenceReason || ''
            } as any : undefined,
            candidateTerms: existingAnalysis.candidateTerms || undefined,
          };

          // 提取音频特征（用于显示）
          let features: AudioFeatures | null = null;
          try {
            features = await extractAudioFeatures(fileItem.file);
          } catch (error) {
            console.warn('[数据库优先] 提取音频特征失败:', error);
          }

          // 更新文件状态为使用已有结果
          setAudioFiles(prev =>
            prev.map(f =>
              f.id === fileItem.id
                ? {
                    ...f,
                    features: features,
                    result: analysisResult,
                    musicMd5: musicMd5,
                    isAnalyzing: false,
                    error: '',
                    // 保留数据库中的上传状态
                    isUploaded: existingAnalysis.isUploaded || false,
                    isOnline: existingAnalysis.isOnline || false,
                    uploadedAt: existingAnalysis.uploadedAt || null,
                    isUploading: false, // 不需要重新上传
                    uploadStatus: existingAnalysis.isUploaded ? 'success' : 'pending',
                  }
                : f
            )
          );

          // 如果是当前文件，更新 streamText
          if (fileItem.id === currentFileId) {
            setStreamText(JSON.stringify(analysisResult, null, 2));
          }

          console.log(`[数据库优先] 文件"${fileName}"已使用数据库中的分析结果，跳过AI分析`);
          return; // 跳过后续分析流程
        }
      }
    } catch (error) {
      console.warn('[数据库优先] 查询数据库失败，继续正常分析流程:', error);
    }

    // 【性能优化】检查缓存，避免重复分析相同文件
    let cacheKey: string | null = null;
    if (analysisConfig.enableCache) {
      cacheKey = getFileCacheKey(fileItem.file);
      const cachedResult = analysisCache[cacheKey!];
      if (cachedResult) {
        console.log(`[缓存命中] 文件"${fileItem.file.name}"使用缓存结果，跳过分析`);
        setAudioFiles(prev =>
          prev.map(f =>
            f.id === fileItem.id
              ? {
                  ...f,
                  result: cachedResult,
                  isAnalyzing: false,
                  error: '',
                }
              : f
          )
        );
        return;
      }
    }

    setAudioFiles(prev =>
      prev.map(f =>
        f.id === fileItem.id
          ? { ...f, isAnalyzing: true, error: '' }
          : f
      )
    );

    try {
      const features = await extractAudioFeatures(fileItem.file);

      // 【性能优化】提取音频元数据（用于出处识别）
      let audioMetadata = null;
      if (!analysisConfig.skipMetadataExtraction) {
        try {
          const formData = new FormData();
          formData.append('audio', fileItem.file);
          const metadataResponse = await fetch('/api/extract-audio-metadata', {
            method: 'POST',
            body: formData,
          });
          if (metadataResponse.ok) {
            const metadataData = await metadataResponse.json();
            audioMetadata = metadataData.metadata;
            console.log(`[出处识别] 文件"${fileItem.file.name}"元数据提取成功:`, audioMetadata);
          } else {
            console.warn(`[出处识别] 文件"${fileItem.file.name}"元数据提取失败，API返回错误`);
          }
        } catch (metadataError) {
          console.warn(`[出处识别] 文件"${fileItem.file.name}"元数据提取失败:`, metadataError);
          audioMetadata = null;
        }
      } else {
        console.log(`[出处识别] 已跳过元数据提取（性能优化配置）`);
      }

      // 【性能优化】根据配置选择使用完整版还是精简版API
      const apiEndpoint = analysisConfig.useFastAPI ? '/api/analyze-music-fast' : '/api/analyze-music';
      console.log(`[性能优化] 使用${analysisConfig.useFastAPI ? '精简版' : '完整版'}API: ${apiEndpoint}`);

      const response = await fetch(apiEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ features, fileName: fileItem.file.name, metadata: audioMetadata }),
      });

      if (!response.ok) throw new Error('分析失败');

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let fullText = '';

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split('\n');

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6);
              if (data === '[DONE]') break;
              try {
                const parsed = JSON.parse(data);
                if (parsed.content) {
                  fullText += parsed.content;
                }
              } catch (e) {}
            }
          }
        }
      }

      const jsonMatch = fullText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          const result = JSON.parse(jsonMatch[0]);
          // 【动态词库】使用动态词库标准化分析结果（支持数据库中的新词）
          const standardizedResult = await dynamicStandardizeAnalysisResult(result);

          // 【性能优化】多阶段验证：根据配置决定是否进行联网搜索验证
          // 联网搜索验证耗时较长（约5-10秒），跳过可大幅提升速度
          if (!analysisConfig.skipOnlineVerification && standardizedResult.musicOrigin?.confidenceLevel !== '低') {
            try {
              // 生成搜索查询
              const searchQuery = generateSearchQuery(standardizedResult, fileItem.file.name);

              // 调用联网搜索
              const searchResponse = await fetch('/api/search-music-origin', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ query: searchQuery, count: 5 }),
              });

              if (searchResponse.ok) {
                const searchData = await searchResponse.json();

                // 如果有搜索结果，调用验证API进行二次验证
                if (searchData.results && searchData.results.length > 0) {
                  const verifyResponse = await fetch('/api/verify-music-origin', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      aiAnalysis: standardizedResult,
                      searchResults: searchData,
                      fileName: fileItem.file.name,
                    }),
                  });

                  if (verifyResponse.ok) {
                    const verifyData = await verifyResponse.json();
                    // 更新结果为验证后的结果
                    if (verifyData.finalMusicOrigin) {
                      standardizedResult.musicOrigin = verifyData.finalMusicOrigin;
                    }
                  }
                }
              }
            } catch (searchError) {
              console.warn('联网搜索验证失败，使用AI原始分析结果:', searchError);
              // 搜索失败不影响主流程，继续使用AI原始分析结果
            }
          }

          // 【性能优化】保存结果到缓存
          if (cacheKey && analysisConfig.enableCache) {
            setAnalysisCache(prev => ({
              ...prev,
              [cacheKey]: standardizedResult,
            }));
            console.log(`[缓存保存] 文件"${fileItem.file.name}"分析结果已保存到缓存`);
          }

          setAudioFiles(prev =>
            prev.map(f =>
              f.id === fileItem.id
                ? {
                    ...f,
                    features,
                    result: standardizedResult,
                    isAnalyzing: false,
                    error: '',
                  }
                : f
            )
          );

          // 自动保存分析结果到数据库
          await saveAnalysisToDatabase(fileItem, features, standardizedResult, audioMetadata);

          // 如果分析的文件是当前文件，则更新streamText
          if (fileItem.id === currentFileId) {
            setStreamText(fullText);
          }

          // 【性能优化】【二次识别】自动触发二次识别：如果场景建议为"未识别场景"，则启动二次AI识别
          if (!analysisConfig.skipSceneReanalysis) {
            const hasUnrecognizedScene = standardizedResult.filmMusic?.scenes?.some(
              (s: any) => s.type === '未识别场景' || s.type === '未识别'
            );

            if (hasUnrecognizedScene) {
              console.log(`[二次识别] 文件"${fileItem.file.name}"场景未识别，启动二次识别`);
              // 自动触发二次识别（异步，不阻塞主流程）
              triggerSceneReanalysis(fileItem, features, standardizedResult).catch(err => {
                console.error('[二次识别] 自动识别失败:', err);
              });
            }
          } else {
            console.log(`[二次识别] 已跳过二次识别（性能优化配置）`);
          }
        } catch (parseError) {
          // JSON 解析失败
          console.error('[AI分析] 解析分析结果失败:', parseError);
          throw new Error('无法解析AI返回的分析结果，请重试');
        }
      } else {
        // 没有匹配到 JSON
        console.error('[AI分析] AI返回的内容中没有找到有效的JSON:', fullText);
        throw new Error('AI返回的内容格式不正确，请重试');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '分析失败';
      setAudioFiles(prev =>
        prev.map(f =>
          f.id === fileItem.id
            ? { ...f, isAnalyzing: false, error: errorMessage }
            : f
        )
      );
    }
  };

  // 保存分析结果到数据库
  const saveAnalysisToDatabase = async (
    fileItem: AudioFileItem,
    features: AudioFeatures,
    result: AnalysisResult,
    metadata?: any  // 音频元数据
  ): Promise<void> => {
    const file = fileItem.file;

    // 更新上传状态为"上传中"
    setAudioFiles(prev =>
      prev.map(f =>
        f.id === fileItem.id
          ? {
              ...f,
              isUploading: true,
              uploadStatus: 'pending',
              uploadError: undefined,
            }
          : f
      )
    );

    // 检查文件大小，提前避免大文件上传失败
    const maxSize = 200 * 1024 * 1024; // 200MB
    if (file.size > maxSize) {
      const errorMsg = `文件大小超过限制（最大200MB），当前文件大小：${(file.size / 1024 / 1024).toFixed(2)}MB`;
      console.error(errorMsg);
      setAudioFiles(prev =>
        prev.map(f =>
          f.id === fileItem.id
            ? {
                ...f,
                uploadStatus: 'failed',
                uploadError: errorMsg,
                isUploading: false,
              }
            : f
        )
      );
      alert(errorMsg);
      return;
    }

    try {
      // 【纯本地分析】不上传文件，只保存分析结果到数据库
      // 根据项目要求："全程不把音乐文件上传到扣子的任何存储位置"
      // "完全在用户设备端完成音频特征提取与情绪识别"
      // "仅返回情绪标签、节奏强度等分析结果，不存储、不上传任何音乐源文件"
      const fileKey: string | null = null;

      // 从情绪维度生成情绪标签
      const emotionTags = Object.entries(result.mood.emotionalDimensions)
        .filter(([_, value]) => value > 0.5)
        .map(([key, _]) => {
          const labelMap: Record<string, string> = {
            happiness: '欢快',
            sadness: '悲伤',
            tension: '紧张',
            romance: '浪漫',
            epic: '史诗',
          };
          return labelMap[key] || key;
        });

      // 收集所有乐器标签，确保不存在undefined
      const allInstruments = [
        ...(result.instruments?.primary || []),
        ...(result.instruments?.accompaniment || []),
        ...(result.instruments?.percussion || []),
      ];

      // 收集风格标签，过滤掉undefined和null
      const allStyles = [
        result.style?.primary,
        result.style?.subGenre
      ].filter((s): s is string => Boolean(s));

      // 提取和验证场景建议标签（放宽验证规则）
      // 1. 标准化场景词（将近义词转换为标准词）
      // 2. 降低场景词与类型的匹配要求（允许略有不匹配）
      // 3. 增加"影视类型+情绪→场景"联动匹配，减少未识别场景
      const rawScenes = result.filmMusic?.scenes || [];
      const scenariosFilmType = result.filmMusic?.filmType || '未分类';
      const primaryEmotion = result.mood?.primary || '';

      // 【记录未识别场景】如果AI返回的场景词不在标准词库中，记录到未识别表
      // 注意：这个API需要在后端实现，这里只是记录逻辑
      const recordUnrecognizedScenario = async (
        scenario: string,
        filmType: string,
        category: 'scenario' | 'dubbing' = 'scenario'
      ) => {
        try {
          // 调用后端API记录未识别内容
          await fetch('/api/term-management/record-unrecognized', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              term: scenario,
              category,
              filmType,
            }),
          });
        } catch (error) {
          console.error('记录未识别场景失败:', error);
        }
      };

      // 在处理AI返回的场景词时，记录未识别内容
      for (const scene of rawScenes) {
        const sceneType = scene.type;

        if (!sceneType || !sceneType.trim()) {
          continue;
        }

        // 检查是否是标准场景词
        const standardScenes = ['追逐', '吵架', '调查', '潜入', '逃亡', '对峙', '回忆闪回', '埋伏', '祭天仪式'];
        const coreSceneMappings = {
          '追逐': ['追逐', '追击', '追赶', '追逐戏', '追逃', '逃命', '逃跑'],
          '吵架': ['吵架', '争执', '争吵', '拌嘴', '口角', '对骂'],
          '调查': ['调查', '侦查', '查案', '调查取证', '摸排', '搜寻'],
          '潜入': ['潜入', '秘密潜入', '潜入行动', '潜入侦查', '偷入'],
        };
        const extendedSceneMappings = {
          '逃亡': ['逃亡', '逃窜', '奔逃'],
          '对峙': ['对峙', '对立', '僵持'],
          '回忆闪回': ['回忆闪回', '闪回', '回忆', '回忆片段', '回忆杀'],
          '埋伏': ['埋伏', '设伏', '埋伏点'],
          '祭天仪式': ['祭天仪式', '祭天', '祭拜', '祭祀仪式'],
        };
        const allMappings = { ...coreSceneMappings, ...extendedSceneMappings };

        // 检查是否是标准词或近义词
        let isStandardOrSynonym = false;
        for (const [standard, aliases] of Object.entries(allMappings)) {
          for (const alias of aliases) {
            if (sceneType.includes(alias) || alias.includes(sceneType)) {
              isStandardOrSynonym = true;
              break;
            }
          }
          if (isStandardOrSynonym) break;
        }

        if (!isStandardOrSynonym && !standardScenes.includes(sceneType)) {
          // 不是标准词或近义词，记录到未识别表
          recordUnrecognizedScenario(sceneType, scenariosFilmType, 'scenario');
        }
      }

      // 2. 降低场景词与类型的匹配要求（允许略有不匹配）
      // 3. 增加"影视类型+情绪→场景"联动匹配，减少未识别场景
      // 2. 降低场景词与类型的匹配要求（允许略有不匹配）
      const allScenarios: string[] = [];

      // 【联动匹配规则 - 影视类型+情绪→场景快速映射】
      const typeEmotionToScenario: Record<string, Record<string, string>> = {
        '警匪片': {
          '紧张': '追逐',
          '冷静': '调查',
          '悲壮': '埋伏',
          '悬疑': '对峙',
        },
        '警匪片（警察题材）': {
          '紧张': '追逐',
          '冷静': '调查',
          '悲壮': '埋伏',
          '悬疑': '对峙',
        },
        '动作片': {
          '紧张': '追逐',
          '激昂': '追逐',
          '悲壮': '逃亡',
        },
        '推理剧': {
          '冷静': '调查',
          '悬疑': '调查',
          '紧张': '对峙',
        },
        '校园剧': {
          '浪漫': '回忆闪回',
          '悲伤': '回忆闪回',
          '青涩': '回忆闪回',
          '甜蜜': '回忆闪回',
        },
        '职场剧（医护题材）': {
          '悲伤': '吵架',
          '舒缓': '回忆闪回',
          '沉稳': '调查',
        },
        '职场剧（警察题材）': {
          '紧张': '追逐',
          '冷静': '调查',
          '悲壮': '埋伏',
        },
        '职场剧（律政题材）': {
          '冷静': '调查',
          '沉稳': '调查',
        },
        '职场剧（美食题材）': {
          '温馨': '回忆闪回',
          '舒缓': '回忆闪回',
        },
        '古装剧': {
          '悲壮': '回忆闪回',
          '庄重': '祭天仪式',
          '大气': '对峙',
        },
        '战争片': {
          '激昂': '追逐',
          '悲壮': '逃亡',
          '紧张': '埋伏',
          '大气': '对峙',
        },
        '灾难片': {
          '悲壮': '逃亡',
          '紧张': '追逐',
        },
        '悬疑剧': {
          '冷静': '调查',
          '紧张': '对峙',
        },
        '爱情片': {
          '浪漫': '回忆闪回',
          '悲伤': '回忆闪回',
          '甜蜜': '回忆闪回',
        },
      };

      // 【联动匹配】如果AI没有返回场景词，或者返回的场景词明显不合适，使用联动匹配
      let usedLinkedMatching = false;
      if (rawScenes.length === 0 && primaryEmotion && scenariosFilmType !== '未分类') {
        const typeMap = typeEmotionToScenario[scenariosFilmType];
        if (typeMap && typeMap[primaryEmotion]) {
          const linkedScenario = typeMap[primaryEmotion];
          console.log(`[联动匹配] 基于类型"${scenariosFilmType}" + 情绪"${primaryEmotion}"，推断场景：${linkedScenario}`);
          allScenarios.push(linkedScenario);
          usedLinkedMatching = true;
        }
      }

      // 【处理AI返回的场景词】
      for (const scene of rawScenes) {
        const sceneType = scene.type;

        // 跳过空值或"未识别场景"
        if (!sceneType || !sceneType.trim() || sceneType === '未识别场景' || sceneType === '未识别') {
          console.log(`[处理场景词] 跳过无效场景词: "${sceneType}"`);
          continue;
        }

        // 标准化场景词（放宽映射规则）
        let standardizedScene = sceneType;

        // 核心标准场景词映射
        const coreSceneMappings = {
          '追逐': ['追逐', '追击', '追赶', '追逐戏', '追逃', '逃命', '逃跑'],
          '吵架': ['吵架', '争执', '争吵', '拌嘴', '口角', '对骂'],
          '调查': ['调查', '侦查', '查案', '调查取证', '摸排', '搜寻'],
          '潜入': ['潜入', '秘密潜入', '潜入行动', '潜入侦查', '偷入'],
        };

        // 扩展标准场景词映射
        const extendedSceneMappings = {
          '逃亡': ['逃亡', '逃窜', '奔逃'],
          '对峙': ['对峙', '对立', '僵持'],
          '回忆闪回': ['回忆闪回', '闪回', '回忆', '回忆片段', '回忆杀'],
          '埋伏': ['埋伏', '设伏', '埋伏点'],
          '祭天仪式': ['祭天仪式', '祭天', '祭拜', '祭祀仪式'],
        };

        // 合并所有映射
        const allMappings = { ...coreSceneMappings, ...extendedSceneMappings };

        // 尝试映射到标准词
        for (const [standard, aliases] of Object.entries(allMappings)) {
          for (const alias of aliases) {
            if (sceneType.includes(alias) || alias.includes(sceneType)) {
              standardizedScene = standard;
              break;
            }
          }
          if (standardizedScene !== sceneType) break;
        }

        // 检查是否是标准场景词
        const standardScenes = ['追逐', '吵架', '调查', '潜入', '逃亡', '对峙', '回忆闪回', '埋伏', '祭天仪式'];

        if (standardScenes.includes(standardizedScene)) {
          // 检查匹配规则（放宽要求至75%阈值）
          const sceneRules: Record<string, { allowed: string[] }> = {
            '追逐': { allowed: ['动作片', '警匪片', '灾难片', '战争片'] },
            '吵架': { allowed: ['家庭剧', '职场剧（医护题材）', '职场剧（警察题材）', '职场剧（律政题材）', '职场剧（美食题材）', '校园剧', '爱情片'] },
            '调查': { allowed: ['推理剧', '警匪片', '悬疑片'] },
            '潜入': { allowed: ['警匪片', '谍战片', '战争片'] },
            '逃亡': { allowed: ['动作片', '灾难片', '战争片'] },
            '对峙': { allowed: ['警匪片', '悬疑剧', '古装剧', '战争片'] },
            '回忆闪回': { allowed: ['剧情片', '爱情片', '悬疑剧', '古装剧', '家庭剧'] },
            '埋伏': { allowed: ['警匪片', '战争片', '谍战片'] },
            '祭天仪式': { allowed: ['古装剧', '神话剧'] },
          };

          const rule = sceneRules[standardizedScene];
          if (rule && rule.allowed.includes(scenariosFilmType)) {
            // 严格匹配，直接添加
            allScenarios.push(standardizedScene);
          } else {
            // 放宽要求：如果场景词标准化后是标准词，即使类型不完全匹配，也允许添加（75%阈值原则）
            // 但在 console 中记录警告
            console.warn(`场景词"${standardizedScene}"与影片类型"${scenariosFilmType}"匹配度较低（约60-75%），但仍保留以提高识别率`);
            allScenarios.push(standardizedScene);
          }
        } else {
          // 不是标准场景词，也不在映射表中，尝试使用联动匹配推断
          // 不再强制转换为"未识别场景"
          console.log(`场景词"${sceneType}"未在标准词库中，尝试联动匹配`);
          
          // 尝试从类型+情绪推断
          const typeMap = typeEmotionToScenario[scenariosFilmType];
          if (typeMap && typeMap[primaryEmotion]) {
            const linkedScenario = typeMap[primaryEmotion];
            console.log(`[联动匹配补救] 基于类型"${scenariosFilmType}" + 情绪"${primaryEmotion}"，推断场景：${linkedScenario}`);
            allScenarios.push(linkedScenario);
          } else {
            // 实在无法推断，保留原词
            allScenarios.push(sceneType);
          }
        }
      }

      // 【最终兜底】如果还是没有有效场景词，尝试最低优先级的联动匹配
      if (allScenarios.length === 0 && primaryEmotion && scenariosFilmType !== '未分类') {
        const typeMap = typeEmotionToScenario[scenariosFilmType];
        if (typeMap && typeMap[primaryEmotion]) {
          const linkedScenario = typeMap[primaryEmotion];
          console.log(`[兜底联动匹配] 基于类型"${scenariosFilmType}" + 情绪"${primaryEmotion}"，推断场景：${linkedScenario}`);
          allScenarios.push(linkedScenario);
        }
      }

      // 【AI自动生成场景建议】如果最终还是没有有效场景词，调用AI生成场景建议
      if (allScenarios.length === 0) {
        console.log('[AI生成场景] 所有匹配方法均失败，调用AI生成场景建议');

        try {
          // 调用AI生成场景建议API
          const generateResponse = await fetch('/api/generate-scene-suggestions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              mood: {
                primary: primaryEmotion,
                intensity: result.mood?.intensity || 5,
              },
              style: {
                primary: result.style?.primary || '未分类',
              },
              features: {
                bpm: features.bpm,
                energy: features.energy,
                frequencyProfile: features.frequencyProfile,
              },
              fileName: file.name,
            }),
          });

          if (generateResponse.ok) {
            const generateData = await generateResponse.json();
            if (generateData.success && generateData.data?.suggestions?.length > 0) {
              // 使用AI生成的场景建议
              const aiSuggestions = generateData.data.suggestions;
              console.log('[AI生成场景] 成功生成场景建议:', aiSuggestions);

              // 将AI生成的场景建议添加到allScenarios
              aiSuggestions.forEach((suggestion: string) => {
                allScenarios.push(suggestion);
              });
            } else {
              console.warn('[AI生成场景] API返回成功但无有效建议，使用兜底方案');
              allScenarios.push('通用背景配乐');
            }
          } else {
            console.error('[AI生成场景] API调用失败，使用兜底方案');
            allScenarios.push('通用背景配乐');
          }
        } catch (error) {
          console.error('[AI生成场景] 调用失败，使用兜底方案:', error);
          allScenarios.push('通用背景配乐');
        }
      }

      // 标准化置信度（放宽识别，允许"疑似"）
      const confidenceMap: Record<string, string> = {
        '高': 'high',
        '中': 'medium',
        '低': 'low',
        '疑似': 'medium',  // 将"疑似"映射为medium，在reasoning中说明
      };
      const confidence = result.musicOrigin?.confidenceLevel
        ? (confidenceMap[result.musicOrigin.confidenceLevel] || 'medium')  // 未知置信度默认为medium
        : null;

      // 智能提取出处信息（分级写入逻辑）
      // 规则：
      // 1. 如果 AI 识别出高置信度（>90%）的出处信息，直接使用
      // 2. 如果 AI 识别出中等置信度（50-89%）的出处信息 + 元数据有明确出处，使用 AI 结果
      // 3. 如果 AI 识别出低置信度或未识别，但元数据有明确出处，尝试从元数据提取
      let finalAlbum: string | null = null;
      let finalSourceType: string | null = null;
      let finalFilmName: string | null = null;
      let finalFilmScene: string | null = null;
      let finalCreators: {
        composer?: string[];
        singer?: string[];
        arranger?: string[];
        lyricist?: string[];
      } | null = null;
      let finalPublisher: string | null = null;
      let finalPlatform: string | null = null;
      let finalConfidenceReason: string | null = result.musicOrigin?.reasoning || null;

      // 优先使用 AI 识别结果
      if (result.musicOrigin?.album?.name) {
        finalAlbum = result.musicOrigin.album.name;
        finalSourceType = result.musicOrigin.sourceType || 'album';
      }
      if (result.musicOrigin?.filmOrTV?.name) {
        finalFilmName = result.musicOrigin.filmOrTV.name;
        finalSourceType = result.musicOrigin.sourceType || 'film';
        finalFilmScene = result.musicOrigin.filmOrTV.scene || null;
      }
      if (result.musicOrigin?.creators) {
        const tempCreators: {
          composer?: string[];
          singer?: string[];
          arranger?: string[];
          lyricist?: string[];
        } = {};
        if (result.musicOrigin.creators.composer) tempCreators.composer = [result.musicOrigin.creators.composer];
        if (result.musicOrigin.creators.singer) tempCreators.singer = [result.musicOrigin.creators.singer];
        if (result.musicOrigin.creators.arranger) tempCreators.arranger = [result.musicOrigin.creators.arranger];
        if (result.musicOrigin.creators.lyricist) tempCreators.lyricist = [result.musicOrigin.creators.lyricist];

        // 只在至少有一个字段有值时才设置 finalCreators
        if (Object.keys(tempCreators).length > 0) {
          finalCreators = tempCreators;
        }
      }
      if (result.musicOrigin?.album?.label) {
        finalPublisher = result.musicOrigin.album.label;
      }
      if (result.musicOrigin?.filmOrTV?.platform) {
        finalPlatform = result.musicOrigin.filmOrTV.platform;
      }

      // 如果 AI 识别置信度低或未识别，但元数据有明确出处，尝试从元数据提取
      if ((!finalAlbum && !finalFilmName) && metadata && (metadata.album || metadata.title)) {
        console.log('[分级写入] AI 识别置信度低，尝试从元数据提取出处信息');

        // 尝试标准化专辑名
        if (metadata.album) {
          const standardizedAlbum = standardizeAlbumName(metadata.album);
          if (standardizedAlbum) {
            finalAlbum = standardizedAlbum;
            finalSourceType = 'album';
            console.log(`[分级写入] 从元数据提取到专辑：${standardizedAlbum}`);
          }
        }

        // 尝试从专辑名推断影视名（如"台北女子图鉴原声带" -> "台北女子图鉴"）
        if (finalAlbum && !finalFilmName) {
          // 移除"原声带"、"OST"等后缀
          const potentialFilmName = finalAlbum
            .replace(/原声带$/, '')
            .replace(/OST$/, '')
            .replace(/音乐专辑$/, '')
            .replace(/配乐$/, '')
            .trim();
          
          if (potentialFilmName) {
            const standardizedFilm = standardizeFilmName(potentialFilmName);
            if (standardizedFilm) {
              finalFilmName = standardizedFilm;
              finalSourceType = 'film';
              finalConfidenceReason = `元数据中明确标注为"${metadata.album}"，推断影视出处为"${standardizedFilm}"，匹配度约80-90%`;
              console.log(`[分级写入] 从专辑名推断影视：${standardizedFilm}`);
            }
          }
        }

        // 尝试提取创作者信息
        if (metadata.artist && !finalCreators?.singer) {
          const standardizedSinger = standardizeCreatorName(metadata.artist, 'singer');
          if (standardizedSinger) {
            finalCreators = finalCreators || {};
            finalCreators.singer = [standardizedSinger];
            console.log(`[分级写入] 从元数据提取到演唱者：${standardizedSinger}`);
          }
        }

        // 如果通过元数据提取到了信息，调整置信度理由
        if ((finalAlbum || finalFilmName) && confidence === 'low') {
          finalConfidenceReason = `音频元数据中明确标注为"${metadata.album || metadata.title}"，虽音频特征匹配度未达90%，但基于元数据可认定为疑似匹配出处（匹配度约80-90%）`;
          console.log('[分级写入] 调整为疑似匹配，置信度理由已更新');
        }
      }

      // 清理空字段：对于可选字段，使用undefined而不是null或空字符串/空对象
      // 这样Drizzle ORM可以正确处理SQL插入
      const cleanedPayload: Record<string, any> = {
        fileName: file.name,
        fileSize: file.size,
        // 【重要修复】本地文件也可以在线播放（通过前端），所以 isOnline 始终为 true
        isOnline: true,
        // 只有上传到云端时（fileKey 存在），isUploaded 才为 true
        isUploaded: !!fileKey, // 如果fileKey存在（文件上传成功），则isUploaded为true
      };

      // 只在有值时才添加字段
      if (fileKey) cleanedPayload.fileKey = fileKey;
      if (fileItem.musicMd5) cleanedPayload.musicMd5 = fileItem.musicMd5; // 添加MD5字段
      if (features.duration) cleanedPayload.duration = Math.round(features.duration);
      if (features.bpm) cleanedPayload.bpm = Math.round(features.bpm);
      if (result.mood?.primary) cleanedPayload.summary = ensureStringMoodPrimary(result.mood.primary);

      // 影视类型：放宽识别规则，允许"疑似"和"待复核"类型
      const rawFilmType = result.filmMusic?.filmType || '未分类';
      let filmType = rawFilmType;

      // 如果是"未分类"，尝试从 suitableGenres 中推断
      if (rawFilmType === '未分类' && result.filmMusic?.suitableGenres && result.filmMusic.suitableGenres.length > 0) {
        // 取第一个建议类型
        const suggestedType = result.filmMusic.suitableGenres[0];
        console.log(`[类型推断] 从建议类型中推断出：${suggestedType}`);
        filmType = suggestedType;
      }
      cleanedPayload.filmType = filmType;

      // 数组字段
      if (emotionTags && emotionTags.length > 0) cleanedPayload.emotionTags = emotionTags;

      // 过滤suitableGenres，确保只包含影视类型，不包含场景词
      const standardFilmTypes = ['恐怖片', '职场剧', '魔幻片', '古装剧', '神话剧', '推理剧', '励志片', '歌舞片', '校园剧', '灾难片', '战争片', '人物传记片', '动漫',
        '动作片', '爱情片', '科幻片', '悬疑片', '喜剧片', '剧情片', '纪录片', '动画片', '冒险片', '奇幻片'];
      const validSuitableGenres = (result.filmMusic?.suitableGenres || []).filter((genre: string) => {
        // 检查是否是标准影视类型或其细分题材
        const isStandardType = standardFilmTypes.some(type => genre === type || genre.startsWith(type + '（'));
        return isStandardType;
      });

      // 如果过滤后仍有数据，保存过滤后的结果；否则，使用 scenes.type 作为备选
      if (validSuitableGenres.length > 0) {
        cleanedPayload.filmScenes = validSuitableGenres;
      } else if (allScenarios && allScenarios.length > 0) {
        // 如果suitableGenres为空或无效，尝试从scenes中提取影视类型
        // 注意：scenes.type是场景词，不是影视类型，这里不应该使用
        console.warn('[suitableGenres验证] suitableGenres为空或无效，且scenes.type是场景词，不适用于filmScenes字段');
        cleanedPayload.filmScenes = [];
      }

      if (allScenarios && allScenarios.length > 0) cleanedPayload.scenarios = allScenarios;
      if (allInstruments && allInstruments.length > 0) cleanedPayload.instruments = allInstruments;
      if (allStyles && allStyles.length > 0) cleanedPayload.styles = allStyles;

      // 音乐出处信息（使用分级写入逻辑提取的最终信息）
      if (finalAlbum) {
        cleanedPayload.album = finalAlbum;

        // 翻译专辑名称（如果是外文）
        if (/[\u4e00-\u9fa5]/.test(finalAlbum)) {
          // 中文专辑，不需要翻译
          cleanedPayload.albumTranslated = null;
        } else {
          // 外文专辑，调用翻译API
          try {
            const translated = await translateAlbumName(finalAlbum);
            if (translated) {
              cleanedPayload.albumTranslated = translated;
            }
          } catch (error) {
            console.error('[专辑翻译] 翻译失败:', error);
            // 翻译失败不影响主流程
          }
        }
      }

      if (finalSourceType) cleanedPayload.sourceType = finalSourceType;
      if (finalFilmName) cleanedPayload.filmName = finalFilmName;
      if (finalFilmScene) cleanedPayload.filmScene = finalFilmScene;
      if (finalCreators && Object.keys(finalCreators).length > 0) cleanedPayload.creators = finalCreators;
      if (finalPublisher) cleanedPayload.publisher = finalPublisher;
      if (finalPlatform) cleanedPayload.platform = finalPlatform;
      if (confidence) cleanedPayload.confidence = confidence;
      if (finalConfidenceReason) cleanedPayload.confidenceReason = finalConfidenceReason;
      if (metadata && Object.keys(metadata).length > 0) cleanedPayload.metadata = metadata;

      // 候选新词：确保至少有一个非空数组
      const candidateTerms = result.candidateTerms;
      let hasValidCandidateTerms = false;
      if (candidateTerms) {
        if (candidateTerms.scenarios && candidateTerms.scenarios.length > 0) hasValidCandidateTerms = true;
        if (candidateTerms.dubbing && candidateTerms.dubbing.length > 0) hasValidCandidateTerms = true;
      }
      if (hasValidCandidateTerms) {
        cleanedPayload.candidateTerms = candidateTerms;
      }

      // 其他特征：只添加非空值
      const otherFeatures: {
        // 情绪相关
        moodIntensity?: string;
        moodTrajectory?: string;
        emotionalDimensions?: {
          happiness: number;
          sadness: number;
          tension: number;
          romance: number;
          epic: number;
        };

        // 音乐结构相关
        structure?: string;
        structureChorus?: string;
        structureBridge?: string;
        structureRepeatPatterns?: string;

        // 和声相关
        harmony?: string;
        harmonyKey?: string;
        harmonyChordProgression?: string;
        harmonyModulation?: string;

        // 节奏相关
        rhythm?: string;
        rhythmTimeSignature?: string;
        rhythmGroove?: string;

        // 乐器相关
        instrumentsPrimary?: string[];
        instrumentsAccompaniment?: string[];
        instrumentsPercussion?: string[];
        instrumentsElectronicElements?: string;
        instrumentsTimbre?: string;

        // 影视配乐相关
        filmTurningPoints?: string;
        filmAtmosphere?: string;
        filmEmotionalGuidance?: string;
        filmCharacterThemeSuitable?: string;
        filmCharacterThemeCharacterType?: string;
        filmCharacterThemeStoryArc?: string;

        // 文化相关
        culture?: string;

        // 原始情绪词
        originalMoodPrimary?: string;
      } = {};

      // 保存情绪详细信息
      if (result.mood?.intensity) {
        otherFeatures.moodIntensity = result.mood.intensity;
      }
      if (result.mood?.trajectory) {
        otherFeatures.moodTrajectory = result.mood.trajectory;
      }
      if (result.mood?.emotionalDimensions) {
        otherFeatures.emotionalDimensions = result.mood.emotionalDimensions;
      }

      // 保存音乐结构详细信息
      if (result.musicalStructure?.form) {
        otherFeatures.structure = result.musicalStructure.form;
      }
      if (result.musicalStructure?.chorus) {
        otherFeatures.structureChorus = result.musicalStructure.chorus;
      }
      if (result.musicalStructure?.bridge) {
        otherFeatures.structureBridge = result.musicalStructure.bridge;
      }
      if (result.musicalStructure?.repeatPatterns) {
        otherFeatures.structureRepeatPatterns = result.musicalStructure.repeatPatterns;
      }

      // 保存和声详细信息
      if (result.harmony?.tonality) {
        otherFeatures.harmony = result.harmony.tonality;
      }
      if (result.harmony?.key) {
        otherFeatures.harmonyKey = result.harmony.key;
      }
      if (result.harmony?.chordProgression) {
        otherFeatures.harmonyChordProgression = result.harmony.chordProgression;
      }
      if (result.harmony?.modulation) {
        otherFeatures.harmonyModulation = result.harmony.modulation;
      }

      // 保存节奏详细信息
      if (result.rhythm?.timeSignature) {
        otherFeatures.rhythmTimeSignature = result.rhythm.timeSignature;
      }
      if (result.rhythm?.rhythmPattern) {
        otherFeatures.rhythm = result.rhythm.rhythmPattern;
      }
      if (result.rhythm?.groove) {
        otherFeatures.rhythmGroove = result.rhythm.groove;
      }

      // 保存乐器详细信息
      if (result.instruments?.primary && result.instruments.primary.length > 0) {
        otherFeatures.instrumentsPrimary = result.instruments.primary;
      }
      if (result.instruments?.accompaniment && result.instruments.accompaniment.length > 0) {
        otherFeatures.instrumentsAccompaniment = result.instruments.accompaniment;
      }
      if (result.instruments?.percussion && result.instruments.percussion.length > 0) {
        otherFeatures.instrumentsPercussion = result.instruments.percussion;
      }
      if (result.instruments?.electronicElements) {
        otherFeatures.instrumentsElectronicElements = result.instruments.electronicElements;
      }
      if (result.instruments?.timbre) {
        otherFeatures.instrumentsTimbre = result.instruments.timbre;
      }

      // 保存影视配乐详细信息
      if (result.filmMusic?.turningPoints) {
        otherFeatures.filmTurningPoints = result.filmMusic.turningPoints;
      }
      if (result.filmMusic?.atmosphere) {
        otherFeatures.filmAtmosphere = result.filmMusic.atmosphere;
      }
      if (result.filmMusic?.emotionalGuidance) {
        otherFeatures.filmEmotionalGuidance = result.filmMusic.emotionalGuidance;
      }
      if (result.filmMusic?.characterTheme) {
        if (result.filmMusic.characterTheme.suitable) {
          otherFeatures.filmCharacterThemeSuitable = result.filmMusic.characterTheme.suitable;
        }
        if (result.filmMusic.characterTheme.characterType) {
          otherFeatures.filmCharacterThemeCharacterType = result.filmMusic.characterTheme.characterType;
        }
        if (result.filmMusic.characterTheme.storyArc) {
          otherFeatures.filmCharacterThemeStoryArc = result.filmMusic.characterTheme.storyArc;
        }
      }

      // 保存文化背景
      if (result.culturalContext?.origin) {
        otherFeatures.culture = result.culturalContext.origin;
      }

      // 保存原始情绪词（映射前的词）
      if (result.mood?.originalPrimary && result.mood.originalPrimary !== result.mood.primary) {
        otherFeatures.originalMoodPrimary = result.mood.originalPrimary;
      }

      // 只在有实际特征时才添加到payload
      if (Object.keys(otherFeatures).length > 0) {
        cleanedPayload.otherFeatures = otherFeatures;
      }

      console.log('Sending to database:', JSON.stringify(cleanedPayload, null, 2));

      // 【性能优化】直接使用UPSERT接口，避免先查询再创建/更新的竞态条件
      // 这个接口使用 PostgreSQL 的 ON CONFLICT 语法，原子性地处理创建或更新
      console.log(`[数据库UPSERT] 文件"${file.name}"将执行原子性创建或更新`);

      const dbResponse = await fetch('/api/music-analyses/replace-or-create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cleanedPayload),
      });

      if (!dbResponse.ok) {
        const errorText = await dbResponse.text();
        console.error('Failed to save analysis to database:', errorText);
        console.error('Response status:', dbResponse.status, dbResponse.statusText);

        // 尝试解析错误信息
        try {
          const errorData = JSON.parse(errorText);
          if (errorData.code === 'DUPLICATE_FILE_NAME' || errorData.error?.includes('已存在')) {
            // 文件已存在，这不是错误，只是说明数据已经是最新的
            console.log(`[数据库UPSERT] 文件"${file.name}"已存在，数据已是最新的`);
          } else {
            // 其他错误，更新文件状态
            setAudioFiles(prev =>
              prev.map(f =>
                f.id === fileItem.id
                  ? {
                      ...f,
                      isUploading: false,
                      uploadStatus: 'failed',
                      uploadError: errorData.error || '数据库保存失败',
                    }
                  : f
              )
            );
            return;
          }
        } catch (e) {
          console.error('Failed to parse error response:', e);
          setAudioFiles(prev =>
            prev.map(f =>
              f.id === fileItem.id
                ? {
                    ...f,
                    isUploading: false,
                    uploadStatus: 'failed',
                    uploadError: '数据库保存失败',
                  }
                : f
            )
          );
          return;
        }
      } else {
        const dbData = await dbResponse.json();
        
        // 检查响应中的 success 字段
        if (!dbData.success) {
          const errorMsg = dbData.error || '数据库保存失败';
          console.error(`[数据库UPSERT] 文件"${file.name}"保存失败:`, errorMsg);
          
          setAudioFiles(prev =>
            prev.map(f =>
              f.id === fileItem.id
                ? {
                    ...f,
                    isUploading: false,
                    uploadStatus: 'failed',
                    uploadError: errorMsg,
                  }
                : f
            )
          );
          return;
        }
        
        // 安全检查：确保 data 和 data.id 存在
        if (!dbData.data || !dbData.data.id) {
          console.error(`[数据库UPSERT] 文件"${file.name}"保存成功但返回数据格式异常:`, dbData);
          
          setAudioFiles(prev =>
            prev.map(f =>
              f.id === fileItem.id
                ? {
                    ...f,
                    isUploading: false,
                    uploadStatus: 'failed',
                    uploadError: '数据库返回数据格式异常',
                  }
                : f
            )
          );
          return;
        }
        
        console.log('Successfully saved analysis to database:', dbData.data.id);

        // 刷新统计数据（包括去重统计）
        await loadDatabaseStats();
      }

      // 更新文件状态为"上传成功"
      // 【重要修复】分析完成后不应该修改 isUploaded 状态，只有上传到云端操作才能设置 isUploaded: true
      // 分析操作只是保存分析结果到数据库，不改变文件的上传状态
      setAudioFiles(prev =>
        prev.map(f =>
          f.id === fileItem.id
            ? {
                ...f,
                isUploading: false,
                uploadStatus: 'success',
                // 不修改 isUploaded 状态（保持原值）
                // isUploaded: true, // ❌ 错误：分析操作不应该设置这个状态
                isOnline: true, // 本地分析完成后，文件在本地可播放，所以 isOnline=true
                // uploadedAt: new Date().toISOString(), // ❌ 只有上传到云端时才更新 uploadedAt
              }
            : f
        )
      );
    } catch (error) {
      console.error('Error saving analysis to database:', error);
      setAudioFiles(prev =>
        prev.map(f =>
          f.id === fileItem.id
            ? {
                ...f,
                isUploading: false,
                uploadStatus: 'failed',
                uploadError: error instanceof Error ? error.message : '数据库保存失败',
              }
            : f
        )
      );
    }
  };

  // 从数据库加载统计数据
  const loadDatabaseStats = async (): Promise<void> => {
    try {
      // 获取当前上传列表中的文件名（用于动态计算音乐状态）
      const importListFileNames = audioFiles.map(f => f.file.name);

      // 并行获取分类统计和去重统计
      const dedupUrl = `/api/music-analyses/stats/deduplicated?importListFileNames=${encodeURIComponent(importListFileNames.join(','))}`;
      const [statsResponse, dedupResponse] = await Promise.all([
        fetch('/api/music-analyses/stats'),
        fetch(dedupUrl)
      ]);

      const statsData = await statsResponse.json();
      const dedupData = await dedupResponse.json();

      if (statsData.success) {
        setDbStats(statsData.data);
      }

      if (dedupData.success) {
        setDedupStats(dedupData.data);
      }
    } catch (error) {
      console.error('Error loading database stats:', error);
    }
  };

  // 执行数据库检索
  /**
   * 执行数据库搜索
   * @param autoSelectFirst 是否自动选中第一个结果（回车搜索时使用）
   */
  const searchDatabase = async (autoSelectFirst: boolean = false): Promise<void> => {
    console.log('[搜索] 开始搜索，参数：', {
      searchQuery,
      searchFilters,
      sortBy,
      sortOrder,
      currentPage,
      itemsPerPage,
      autoSelectFirst
    });

    try {
      const params = new URLSearchParams();

      if (searchFilters.emotions.length > 0) {
        params.append('emotions', searchFilters.emotions.join(','));
      }
      if (searchFilters.films.length > 0) {
        params.append('films', searchFilters.films.join(','));
      }
      if (searchFilters.scenarios.length > 0) {
        params.append('scenarios', searchFilters.scenarios.join(','));
      }
      if (searchFilters.instruments.length > 0) {
        params.append('instruments', searchFilters.instruments.join(','));
      }
      if (searchFilters.styles.length > 0) {
        params.append('styles', searchFilters.styles.join(','));
      }

      // 添加在线状态筛选（根据前端音乐状态字段完全对齐）
      // 'all'=不限制，'online'=仅在线（isOnline=true && isUploaded=false），'uploaded'=仅上传（isUploaded=true），'offline'=仅未在线（isOnline=false && isUploaded=false）
      if (searchFilters.onlineStatus === 'online') {
        params.append('isOnline', 'true');
        params.append('isUploaded', 'false');
      } else if (searchFilters.onlineStatus === 'uploaded') {
        params.append('isUploaded', 'true');
      } else if (searchFilters.onlineStatus === 'offline') {
        // 离线状态：需要同时排除在线和云端音乐
        params.append('isOnline', 'false');
        params.append('isUploaded', 'false');
      }
      // 'all'不传递任何参数

      // 添加搜索、排序、分页参数
      if (searchQuery) {
        params.append('query', searchQuery);
      }

      // 添加导入列表文件名参数（用于动态计算musicStatus）
      const importListFileNames = audioFiles.map(f => f.file.name);
      console.log('[搜索] 导入列表文件名数量:', importListFileNames.length);
      console.log('[搜索] audioFiles 总数:', audioFiles.length);
      console.log('[搜索] 导入列表文件名列表（包含 Ken Arai 的）:', importListFileNames.filter(f => f.includes('Ken Arai') || f.includes('Aube')));

      if (importListFileNames.length > 0) {
        params.append('importListFileNames', importListFileNames.join(','));
      }

      params.append('sortBy', sortBy);
      params.append('sortOrder', sortOrder);
      params.append('page', currentPage.toString());
      params.append('limit', itemsPerPage.toString());

      const response = await fetch(`/api/music-analyses/search?${params.toString()}`);
      const data = await response.json();

      console.log('[搜索] 响应数据：', {
        success: data.success,
        count: data.count,
        total: data.total,
        dataLength: data.data?.length,
        params: params.toString()
      });

      if (data.success) {
        setDbSearchResults(data.data);
        // 保存分页信息
        setDbPagination({
          total: data.total || data.data.length,
          page: data.page || currentPage,
          totalPages: data.totalPages || 1,
        });
        // 切换到搜索结果播放队列模式
        if (data.data.length > 0) {
          setPlayQueueMode('search');
          setCurrentSearchIndex(-1); // 重置搜索结果索引

          // 按回车键时自动选中第一个音乐文件
          if (autoSelectFirst && data.data.length > 0) {
            setSelectedRecordIds(new Set([data.data[0].id]));
          }
        } else {
          // 无结果时清空选中状态
          if (autoSelectFirst) {
            setSelectedRecordIds(new Set());
          }
        }
      } else {
        // API 返回错误
        console.error('搜索失败:', data.error || '未知错误');
        addNotification('error', data.error || '搜索失败，请稍后重试');
      }
    } catch (error) {
      console.error('搜索数据库出错:', error);
      const errorMessage = error instanceof Error ? error.message : '搜索失败，请检查网络连接';
      addNotification('error', errorMessage);
    }
  };

  // 创建防抖搜索函数（避免短时间内频繁触发搜索请求）
  useEffect(() => {
    // 创建防抖函数，延迟 500 毫秒
    debouncedSearchRef.current = debounce((autoSelectFirst: boolean = false) => {
      searchDatabase(autoSelectFirst);
    }, 500);

    // 清理函数
    return () => {
      debouncedSearchRef.current = null;
    };
  }, [searchQuery, searchFilters, sortBy, sortOrder, currentPage, itemsPerPage]); // 每次搜索参数更新时重新创建防抖函数

  // 打开数据库面板时加载统计数据
  const handleOpenDatabasePanel = async () => {
    setShowDatabasePanel(true);
    await loadDatabaseStats();
    // 同时刷新搜索结果，确保上传文件列表的状态显示正确
    await searchDatabase(false);
  };

  // 批量分析所有未分析的文件
  /**
   * 批量分析所有未分析的文件
   * 使用并行处理提高效率，支持动态调整并发数
   */
  const analyzeAllFiles = async () => {
    const unanalyzedFiles = audioFiles.filter(f => !f.result && !f.isAnalyzing);

    if (unanalyzedFiles.length === 0) {
      addNotification('info', '没有需要分析的文件');
      return;
    }

    // 清空错误消息
    setError('');
    const originalFileId = currentFileId; // 保存当前播放的文件ID

    // 【性能优化】并行批量分析
    // 根据文件数量动态调整并行度：文件少时全并行，文件多时分批并行
    const BATCH_SIZE = analysisConfig.concurrentBatchSize; // 使用配置的批次大小

    // 将文件分成多个批次
    const batches = [];
    for (let i = 0; i < unanalyzedFiles.length; i += BATCH_SIZE) {
      batches.push(unanalyzedFiles.slice(i, i + BATCH_SIZE));
    }

    console.log(`[批量分析] 开始分析 ${unanalyzedFiles.length} 个文件，分为 ${batches.length} 批，每批最多 ${BATCH_SIZE} 个`);

    // 逐批并行分析
    for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
      const batch = batches[batchIndex];
      console.log(`[批量分析] 正在分析第 ${batchIndex + 1}/${batches.length} 批，共 ${batch.length} 个文件`);

      // 并行分析当前批次的所有文件
      await Promise.all(
        batch.map(async (fileItem) => {
          try {
            await analyzeSingleFile(fileItem);
          } catch (error) {
            console.error(`[批量分析] 文件 ${fileItem.file.name} 分析失败:`, error);
            // 单个文件失败不影响其他文件
            const errorMessage = error instanceof Error ? error.message : '分析失败';
            setAudioFiles(prev =>
              prev.map(f =>
                f.id === fileItem.id
                  ? { ...f, isAnalyzing: false, error: errorMessage }
                  : f
              )
            );
          }
        })
      );

      console.log(`[批量分析] 第 ${batchIndex + 1}/${batches.length} 批完成`);
    }

    console.log(`[批量分析] 所有文件分析完成`);

    // 分析完成后，确保恢复原来的当前文件（如果在分析过程中被意外改变）
    if (currentFileId !== originalFileId && originalFileId) {
      setCurrentFileId(originalFileId);
    }

    // 【重要】批量分析完成后，如果数据库管理面板已打开，自动刷新搜索结果
    // 确保搜索结果中的音乐状态能够正确反映文件是否在导入列表中
    if (showDatabasePanel) {
      console.log('[批量分析] 数据库管理面板已打开，自动刷新搜索结果');
      console.log('[批量分析] 当前导入列表文件数:', audioFiles.length);
      console.log('[批量分析] 包含 Ken Arai 的文件:', audioFiles.filter(f => f.file.name.includes('Ken Arai') || f.file.name.includes('Aube')).map(f => f.file.name));
      await searchDatabase(false);
    }
  };

  // 开始编辑
  /**
   * 开始编辑指定模块
   * @param module 要编辑的模块名称
   */
  const startEdit = (module: string) => {
    setEditingModule(module);
  };

  // 取消编辑
  const cancelEdit = () => {
    setEditingModule(null);
  };

  // 打开手动标注场景对话框
  const openManualScenarioDialog = (item: any) => {
    setEditingScenarioItem(item);
    setSelectedStandardScenario('');
    setShowManualScenarioDialog(true);
  };

  // 保存手动标注的场景
  const saveManualScenario = async () => {
    if (!editingScenarioItem || !selectedStandardScenario) {
      alert('请选择标准场景词');
      return;
    }

    try {
      // 更新场景数组，替换"未识别场景"
      const updatedScenarios = editingScenarioItem.scenarios.map((s: string) =>
        s === '未识别场景' ? selectedStandardScenario : s
      );

      // 调用API更新数据库
      const response = await fetch(`/api/music-analyses/${editingScenarioItem.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scenarios: updatedScenarios,
        }),
      });

      if (!response.ok) {
        throw new Error('更新场景失败');
      }

      // 更新本地状态
      setDbSearchResults((prev: any[]) =>
        prev.map((item: any) =>
          item.id === editingScenarioItem.id
            ? { ...item, scenarios: updatedScenarios }
            : item
        )
      );

      // 关闭对话框
      setShowManualScenarioDialog(false);
      setEditingScenarioItem(null);
      setSelectedStandardScenario('');

      alert('场景标注成功！');
    } catch (error) {
      console.error('保存场景标注失败:', error);
      alert('保存场景标注失败，请重试');
    }
  };

  // ===== 数据库管理相关辅助函数 =====

  // 切换分类展开/收起
  const toggleCategoryExpand = (category: string) => {
    setExpandedCategories(prev => {
      const newSet = new Set(prev);
      if (newSet.has(category)) {
        newSet.delete(category);
      } else {
        newSet.add(category);
      }
      return newSet;
    });
  };

  // 切换文件包展开/收起
  const toggleMusicPackageExpand = (packageName: string) => {
    setExpandedMusicPackages(prev => {
      const newSet = new Set(prev);
      if (newSet.has(packageName)) {
        newSet.delete(packageName);
      } else {
        newSet.add(packageName);
      }
      return newSet;
    });
  };

  // 点击分类进行筛选
  const handleFilterByCategory = (category: string, label: string) => {
    setSearchFilters(prev => {
      const newFilters = { ...prev };

      switch (category) {
        case 'emotion':
          newFilters.emotions = [label];
          break;
        case 'film':
          newFilters.films = [label];
          break;
        case 'scenario':
          newFilters.scenarios = [label];
          break;
        case 'instrument':
          newFilters.instruments = [label];
          break;
        case 'style':
          newFilters.styles = [label];
          break;
      }

      return newFilters;
    });

    // 执行搜索
    searchDatabase();
  };

  // 点击分类查看详情（三级钻取）
  const handleViewCategoryDetails = (category: string, label: string) => {
    handleFilterByCategory(category, label);
    // 滚动到搜索结果区域
    setTimeout(() => {
      const searchResultsElement = document.getElementById('database-search-results');
      if (searchResultsElement) {
        searchResultsElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 100);
  };

  // 处理数据库概览状态点击
  const handleDbOverviewStatusClick = (status: 'all' | 'online' | 'offline' | 'uploaded') => {
    setSearchFilters(prev => ({
      ...prev,
      onlineStatus: status,
    }));
    // 滚动到搜索结果区域
    setTimeout(() => {
      const searchResultsElement = document.getElementById('database-search-results');
      if (searchResultsElement) {
        searchResultsElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 100);
  };

  // 保存编辑
  const saveEdit = async () => {
    const currentFile = getCurrentFile();
    if (!currentFile || !currentResult) {
      alert('无法保存：没有当前文件或分析结果');
      return;
    }

    try {
      // 深拷贝当前结果
      const updatedResult = JSON.parse(JSON.stringify(currentResult));

      // 应用编辑的内容
      if (editedContent.mood.primary) {
        updatedResult.mood.primary = editedContent.mood.primary;
      }
      if (editedContent.mood.intensity) {
        updatedResult.mood.intensity = editedContent.mood.intensity;
      }
      if (editedContent.mood.trajectory) {
        updatedResult.mood.trajectory = editedContent.mood.trajectory;
      }

      if (editedContent.style.primary) {
        updatedResult.style.primary = editedContent.style.primary;
      }
      if (editedContent.style.subGenre) {
        updatedResult.style.subGenre = editedContent.style.subGenre;
      }
      if (editedContent.style.genreBlending) {
        updatedResult.style.genreBlending = editedContent.style.genreBlending;
      }
      if (editedContent.style.era) {
        updatedResult.style.era = editedContent.style.era;
      }

      if (editedContent.instruments.primary) {
        updatedResult.instruments.primary = [editedContent.instruments.primary];
      }
      if (editedContent.instruments.accompaniment) {
        updatedResult.instruments.accompaniment = [editedContent.instruments.accompaniment];
      }
      if (editedContent.instruments.percussion) {
        updatedResult.instruments.percussion = [editedContent.instruments.percussion];
      }
      if (editedContent.instruments.electronicElements) {
        updatedResult.instruments.electronicElements = editedContent.instruments.electronicElements;
      }
      if (editedContent.instruments.timbre) {
        updatedResult.instruments.timbre = editedContent.instruments.timbre;
      }

      // 影片配乐相关编辑
      if (editedContent.filmMusic.filmType !== undefined) {
        const oldFilmType = currentResult.filmMusic?.filmType || '未分类';
        const newFilmType = editedContent.filmMusic.filmType;

        // 更新影片类型
        updatedResult.filmMusic = updatedResult.filmMusic || {};
        updatedResult.filmMusic.filmType = newFilmType;

        // 如果影片类型被修改了，且不是"未分类"，添加到词库
        if (newFilmType && newFilmType !== '未分类' && newFilmType !== oldFilmType) {
          try {
            await fetch('/api/term-management/add-candidate-term', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                term: newFilmType,
                category: 'film',
                synonyms: [],
                filmTypes: [],
                confidence: 100,
                reason: '用户手动编辑影片类型',
              }),
            });
            console.log(`[保存编辑] 影片类型"${newFilmType}"已添加到词库`);
          } catch (error) {
            console.warn('[保存编辑] 添加影片类型到词库失败:', error);
          }
        }
      }

      if (editedContent.filmMusic.suitableGenres) {
        updatedResult.filmMusic = updatedResult.filmMusic || {};
        updatedResult.filmMusic.suitableGenres = editedContent.filmMusic.suitableGenres;
      }
      if (editedContent.filmMusic.turningPoints) {
        updatedResult.filmMusic = updatedResult.filmMusic || {};
        updatedResult.filmMusic.turningPoints = editedContent.filmMusic.turningPoints;
      }
      if (editedContent.filmMusic.atmosphere) {
        updatedResult.filmMusic = updatedResult.filmMusic || {};
        updatedResult.filmMusic.atmosphere = editedContent.filmMusic.atmosphere;
      }
      if (editedContent.filmMusic.emotionalGuidance) {
        updatedResult.filmMusic = updatedResult.filmMusic || {};
        updatedResult.filmMusic.emotionalGuidance = editedContent.filmMusic.emotionalGuidance;
      }

      if (editedContent.filmMusic.characterTheme) {
        updatedResult.filmMusic = updatedResult.filmMusic || {};
        updatedResult.filmMusic.characterTheme = editedContent.filmMusic.characterTheme;
      }

      // 更新本地状态
      setAudioFiles(prev =>
        prev.map(f =>
          f.id === currentFile.id
            ? { ...f, result: updatedResult }
            : f
        )
      );

      // 保存到数据库
      await saveAnalysisToDatabase(currentFile, currentFile.features!, updatedResult);

      // 刷新标准词库（如果添加了新词）
      if (window.refreshStandardVocabulary) {
        await window.refreshStandardVocabulary();
      }

      console.log('[保存编辑] 编辑内容已保存');
      alert('编辑内容已保存！');

      // 刷新统计数据
      await loadDatabaseStats();

      // 清空编辑状态
      setEditedContent({
        mood: {},
        style: {},
        albumInfo: undefined,
        instruments: {},
        filmMusic: {},
      });
      setEditingModule(null);
    } catch (error) {
      console.error('[保存编辑] 保存失败:', error);
      alert('保存编辑内容失败：' + (error instanceof Error ? error.message : '未知错误'));
    }
  };

  // 更新情绪识别编辑内容
  const updateMoodEdit = (field: keyof EditedContent['mood'], value: string) => {
    setEditedContent(prev => ({
      ...prev,
      mood: { ...prev.mood, [field]: value }
    }));
  };

  // 更新音乐风格编辑内容
  const updateStyleEdit = (field: keyof EditedContent['style'], value: string) => {
    setEditedContent(prev => ({
      ...prev,
      style: { ...prev.style, [field]: value }
    }));
  };

  // 更新音乐出处编辑内容
  const updateAlbumInfoEdit = (value: string) => {
    setEditedContent(prev => ({ ...prev, albumInfo: value }));
  };

  // 更新乐器分析编辑内容
  const updateInstrumentsEdit = (field: keyof EditedContent['instruments'], value: string) => {
    setEditedContent(prev => ({
      ...prev,
      instruments: { ...prev.instruments, [field]: value }
    }));
  };

  // 更新影视配乐编辑内容
  const updateFilmMusicEdit = (field: keyof EditedContent['filmMusic'], value: string) => {
    // 如果是suitableGenres字段，将字符串转换为数组
    if (field === 'suitableGenres') {
      const genresArray = value.split(',').map(g => g.trim()).filter(g => g.length > 0);
      setEditedContent(prev => ({
        ...prev,
        filmMusic: { ...prev.filmMusic, [field]: genresArray }
      }));
    } else {
      setEditedContent(prev => ({
        ...prev,
        filmMusic: { ...prev.filmMusic, [field]: value }
      }));
    }
  };

  // 更新角色主题编辑内容
  const updateCharacterThemeEdit = (field: string, value: string) => {
    setEditedContent(prev => ({
      ...prev,
      filmMusic: {
        ...prev.filmMusic,
        characterTheme: { ...prev.filmMusic.characterTheme, [field]: value }
      }
    }));
  };

  // 添加候选词到词库
  const handleAddCandidateTerm = async (category: 'scenario' | 'dubbing', candidate: any) => {
    if (!confirm(`确定要将"${candidate.term}"添加到词库吗？`)) {
      return;
    }

    try {
      const response = await fetch('/api/term-management/add-candidate-term', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          term: candidate.term,
          category: category,
          synonyms: candidate.synonyms,
          filmTypes: candidate.filmTypes,
          confidence: candidate.confidence,
          reason: candidate.reason,
        }),
      });

      const data = await response.json();
      if (data.success) {
        alert(`"${candidate.term}"已成功添加到词库！`);
        // 刷新词库管理面板
        if (showTermManagementPanel) {
          // 可以在这里触发刷新逻辑
        }
      } else {
        alert(`添加失败：${data.error || '未知错误'}`);
      }
    } catch (error) {
      console.error('添加候选词失败:', error);
      alert('添加失败，请重试');
    }
  };

  // 显示表格预览
  const handleShowPreview = () => {
    if (!currentResult) return;
    setPreviewData(currentResult);
    setShowTablePreview(true);
  };

  // 导出分析结果到CSV
  const handleExportCSV = () => {
    handleShowPreview();
  };

  // 导出分析结果到Excel
  const handleExportExcel = () => {
    handleShowPreview();
  };

  // 批量导出所有已分析的音乐到CSV
  const handleBatchExportCSV = () => {
    const analyzedFiles = audioFiles.filter(f => f.result !== null);
    if (analyzedFiles.length === 0) {
      alert('没有已分析的音乐文件，请先完成分析');
      return;
    }
    if (confirm(`确定要导出 ${analyzedFiles.length} 个已分析的音乐文件吗？`)) {
      exportBatchToCSV(audioFiles, '批量音乐分析结果');
    }
  };

  // 批量导出所有已分析的音乐到Excel
  const handleBatchExportExcel = () => {
    const analyzedFiles = audioFiles.filter(f => f.result !== null);
    if (analyzedFiles.length === 0) {
      alert('没有已分析的音乐文件，请先完成分析');
      return;
    }
    if (confirm(`确定要导出 ${analyzedFiles.length} 个已分析的音乐文件吗？`)) {
      exportBatchToExcel(audioFiles, '批量音乐分析结果');
    }
  };

  // 批量更新场景建议到数据库
  const handleBatchUpdateScenarios = async () => {
    if (confirm(`确定要从数据库中的所有记录提取场景建议并更新到scenarios字段吗？\n\n注意：此操作将从otherFeatures字段中提取filmMusic.scenes数据，验证后更新到scenarios字段。`)) {
      try {
        const response = await fetch('/api/music-analyses/batch-update-scenarios', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        });

        // 检查响应状态
        if (!response.ok) {
          let errorText = '';
          try {
            errorText = await response.text();
          } catch (e) {
            errorText = '无法读取错误响应';
          }
          console.error('批量更新场景建议失败 - HTTP状态:', response.status, '响应内容:', errorText);
          throw new Error(`服务器错误: ${response.status} - ${errorText}`);
        }

        // 尝试解析JSON
        let result;
        try {
          result = await response.json();
        } catch (e) {
          const responseText = await response.text();
          console.error('批量更新场景建议失败 - JSON解析错误:', e, '响应内容:', responseText);
          throw new Error('服务器返回了无效的JSON格式: ' + responseText.substring(0, 200));
        }

        if (result.success) {
          alert(`批量更新完成！\n成功：${result.data.success} 条\n失败：${result.data.failed} 条\n总计：${result.data.total} 条\n\n${result.data.errors.length > 0 ? '错误详情：\n' + result.data.errors.slice(0, 5).join('\n') : ''}`);

          // 重新加载统计数据
          await loadDatabaseStats();
        } else {
          alert('批量更新失败：' + result.error);
        }
      } catch (error: any) {
        console.error('批量更新场景建议失败:', error);
        alert('批量更新失败：' + error.message);
      }
    }
  };

  // 批量更新影片类型到数据库
  const handleBatchUpdateFilmTypes = async () => {
    if (confirm(`确定要批量更新数据库中的影片类型字段吗？\n\n注意：此操作将根据现有数据自动推断影片类型：\n1. 首先从filmScenes字段匹配标准影片类型\n2. 如果无法匹配，则从情绪词推断\n3. 更新所有缺少filmType或filmType为"未分类"的记录`)) {
      try {
        const response = await fetch('/api/music-analyses/batch-update-film-types', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        });

        const result = await response.json();

        if (result.success) {
          const message = `批量更新完成！\n\n总记录数：${result.data.total}\n更新成功：${result.data.updatedCount} 条\n跳过：${result.data.skippedCount} 条\n\n${result.data.errors && result.data.errors.length > 0 ? '部分记录更新失败：\n' + result.data.errors.slice(0, 5).join('\n') : ''}`;
          alert(message);

          // 重新加载统计数据
          await loadDatabaseStats();
          // 重新搜索结果
          await searchDatabase();
        } else {
          alert('批量更新失败：' + result.error);
        }
      } catch (error: any) {
        console.error('批量更新影片类型失败:', error);
        alert('批量更新失败：' + error.message);
      }
    }
  };

  const handleBatchTranslateAlbums = async () => {
    if (confirm(`确定要批量翻译数据库中的外文专辑名称吗？\n\n注意：此操作将：\n1. 查找所有未翻译的外文专辑\n2. 使用大语言模型进行翻译\n3. 更新数据库中的album_translated字段\n\n翻译可能需要几秒钟到几分钟时间，请稍候...`)) {
      try {
        const response = await fetch('/api/batch-translate-albums', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        });

        const result = await response.json();

        if (result.success) {
          const message = `批量翻译完成！\n\n${result.message}`;
          alert(message);

          // 重新加载统计数据
          await loadDatabaseStats();
          // 重新搜索结果
          await searchDatabase();
        } else {
          alert('批量翻译失败：' + result.message);
        }
      } catch (error: any) {
        console.error('批量翻译专辑失败:', error);
        alert('批量翻译失败：' + error.message);
      }
    }
  };

  // 反馈对话框组件
  const FeedbackDialog = () => {
    if (!showFeedbackDialog) return null;

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: 'rgba(0,0,0,0.8)' }}>
        <div className="bg-gray-900 rounded-2xl w-[90vw] max-w-2xl p-6 border border-purple-500/30 shadow-2xl">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-white">反馈AI识别结果</h2>
            <button
              onClick={() => setShowFeedbackDialog(false)}
              className="p-2 hover:bg-white/20 rounded-lg transition-colors"
            >
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* 反馈类型选择 */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-300 mb-3">请选择反馈类型：</label>
            <div className="grid grid-cols-3 gap-3">
              <button
                onClick={() => setFeedbackType('correct')}
                className={`p-4 rounded-lg border-2 transition-all ${
                  feedbackType === 'correct'
                    ? 'border-green-500 bg-green-500/20 text-green-300'
                    : 'border-gray-600 bg-gray-800 text-gray-400 hover:border-gray-500'
                }`}
              >
                <div className="text-2xl mb-2">✅</div>
                <div className="font-medium">识别准确</div>
                <div className="text-xs text-gray-400 mt-1">AI判断完全正确</div>
              </button>
              <button
                onClick={() => setFeedbackType('incorrect')}
                className={`p-4 rounded-lg border-2 transition-all ${
                  feedbackType === 'incorrect'
                    ? 'border-red-500 bg-red-500/20 text-red-300'
                    : 'border-gray-600 bg-gray-800 text-gray-400 hover:border-gray-500'
                }`}
              >
                <div className="text-2xl mb-2">❌</div>
                <div className="font-medium">需要修正</div>
                <div className="text-xs text-gray-400 mt-1">识别有误需要调整</div>
              </button>
              <button
                onClick={() => setFeedbackType('partial')}
                className={`p-4 rounded-lg border-2 transition-all ${
                  feedbackType === 'partial'
                    ? 'border-yellow-500 bg-yellow-500/20 text-yellow-300'
                    : 'border-gray-600 bg-gray-800 text-gray-400 hover:border-gray-500'
                }`}
              >
                <div className="text-2xl mb-2">⚠️</div>
                <div className="font-medium">部分正确</div>
                <div className="text-xs text-gray-400 mt-1">部分准确需要补充</div>
              </button>
            </div>
          </div>

          {/* 修正内容（当选择"需要修正"时显示） */}
          {feedbackType === 'incorrect' && (
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-300 mb-3">请指出需要修正的字段：</label>
              <div className="space-y-3 bg-gray-800 rounded-lg p-4">
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    id="correctMood"
                    checked={correctedFields.mood !== undefined}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setCorrectedFields((prev: any) => ({ ...prev, mood: { original: '', corrected: '' } }));
                      } else {
                        setCorrectedFields((prev: any) => {
                          const { mood, ...rest } = prev;
                          return rest;
                        });
                      }
                    }}
                    className="w-4 h-4 text-purple-600 bg-gray-700 border-gray-600 rounded focus:ring-purple-500"
                  />
                  <label htmlFor="correctMood" className="text-gray-300">情绪识别</label>
                  {correctedFields.mood?.original && !correctedFields.mood?.corrected && (
                    <span className="text-xs text-purple-400">(已自动填充)</span>
                  )}
                </div>
                {correctedFields.mood && (
                  <div className="ml-7 grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-gray-400 mb-1 block">原识别</label>
                      <input
                        type="text"
                        value={correctedFields.mood.original}
                        onChange={(e) => setCorrectedFields((prev: any) => ({
                          ...prev,
                          mood: { ...prev.mood!, original: e.target.value, corrected: prev.mood!.corrected }
                        }))}
                        className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white text-sm"
                        placeholder="原识别的情绪"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-purple-400 mb-1 block">修正为</label>
                      <input
                        type="text"
                        value={correctedFields.mood.corrected}
                        onChange={(e) => setCorrectedFields((prev: any) => ({
                          ...prev,
                          mood: { ...prev.mood!, corrected: e.target.value, original: prev.mood!.original }
                        }))}
                        className="w-full px-3 py-2 bg-purple-500/20 border border-purple-500/30 rounded-lg text-white text-sm focus:border-purple-500 focus:outline-none"
                        placeholder="请输入正确的情绪"
                      />
                    </div>
                  </div>
                )}
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    id="correctFilmType"
                    checked={correctedFields.filmType !== undefined}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setCorrectedFields((prev: any) => ({ ...prev, filmType: { original: '', corrected: '' } }));
                      } else {
                        setCorrectedFields((prev: any) => {
                          const { filmType, ...rest } = prev;
                          return rest;
                        });
                      }
                    }}
                    className="w-4 h-4 text-purple-600 bg-gray-700 border-gray-600 rounded focus:ring-purple-500"
                  />
                  <label htmlFor="correctFilmType" className="text-gray-300">影片类型</label>
                  {correctedFields.filmType?.original && !correctedFields.filmType?.corrected && (
                    <span className="text-xs text-purple-400">(已自动填充)</span>
                  )}
                </div>
                {correctedFields.filmType && (
                  <div className="ml-7 grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-gray-400 mb-1 block">原识别</label>
                      <input
                        type="text"
                        value={correctedFields.filmType.original}
                        onChange={(e) => setCorrectedFields((prev: any) => ({
                          ...prev,
                          filmType: { ...prev.filmType!, original: e.target.value, corrected: prev.filmType!.corrected }
                        }))}
                        className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white text-sm"
                        placeholder="原识别的影片类型"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-purple-400 mb-1 block">修正为</label>
                      <input
                        type="text"
                        value={correctedFields.filmType.corrected}
                        onChange={(e) => setCorrectedFields((prev: any) => ({
                          ...prev,
                          filmType: { ...prev.filmType!, corrected: e.target.value, original: prev.filmType!.original }
                        }))}
                        className="w-full px-3 py-2 bg-purple-500/20 border border-purple-500/30 rounded-lg text-white text-sm focus:border-purple-500 focus:outline-none"
                        placeholder="请输入正确的影片类型"
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 用户说明 */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-300 mb-3">附加说明（可选）：</label>
            <textarea
              value={feedbackReason}
              onChange={(e) => setFeedbackReason(e.target.value)}
              className="w-full px-4 py-3 bg-gray-800 border border-gray-600 rounded-lg text-white text-sm resize-none"
              rows={3}
              placeholder="请详细说明您的反馈，帮助我们改进识别准确度..."
            />
          </div>

          {/* 反馈历史 */}
          {feedbackHistory.length > 0 && (
            <div className="mb-6">
              <div
                className="flex items-center justify-between cursor-pointer p-3 bg-gray-800 rounded-lg border border-gray-700 hover:border-purple-500/30 transition-colors"
                onClick={() => setShowFeedbackHistory(!showFeedbackHistory)}
              >
                <div className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span className="text-sm font-medium text-gray-300">
                    反馈历史 ({feedbackHistory.length}条)
                  </span>
                </div>
                <svg
                  className={`w-4 h-4 text-gray-400 transition-transform ${showFeedbackHistory ? 'rotate-180' : ''}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>

              {showFeedbackHistory && (
                <div className="mt-3 space-y-2 max-h-48 overflow-y-auto">
                  {feedbackHistory.map((feedback, index) => (
                    <div
                      key={index}
                      className="p-3 bg-gray-800 rounded-lg border border-gray-700"
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-2">
                          {feedback.feedback_type === 'correct' && (
                            <span className="text-green-400">✅</span>
                          )}
                          {feedback.feedback_type === 'incorrect' && (
                            <span className="text-red-400">❌</span>
                          )}
                          {feedback.feedback_type === 'partial' && (
                            <span className="text-yellow-400">⚠️</span>
                          )}
                          <span className="text-xs text-gray-400">
                            {new Date(feedback.created_at).toLocaleString('zh-CN')}
                          </span>
                        </div>
                        {feedback.is_processed && (
                          <span className="text-xs px-2 py-0.5 bg-green-500/20 text-green-300 rounded-full">
                            已处理
                          </span>
                        )}
                      </div>
                      {feedback.user_reason && (
                        <p className="text-xs text-gray-400 mb-2">{feedback.user_reason}</p>
                      )}
                      {feedback.corrected_fields && Object.keys(feedback.corrected_fields).length > 0 && (
                        <div className="space-y-1">
                          {Object.entries(feedback.corrected_fields).map(([field, data]: [string, any]) => (
                            <div key={field} className="text-xs">
                              <span className="text-gray-500">{field}: </span>
                              <span className="text-red-400 line-through">{data.original}</span>
                              <span className="text-gray-400 mx-1">→</span>
                              <span className="text-green-400">{data.corrected}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                  {loadingFeedbackHistory && (
                    <div className="text-center py-4 text-gray-400 text-sm">
                      加载中...
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* 操作按钮 */}
          <div className="flex justify-end gap-3">
            <button
              onClick={() => setShowFeedbackDialog(false)}
              className="px-6 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
            >
              取消
            </button>
            <button
              onClick={submitFeedback}
              disabled={!feedbackType}
              className="px-6 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              提交反馈
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-black text-white p-3 md:p-4">
      <div className="max-w-full mx-auto">
        {/* 标题 */}
        <header className="text-center mb-6 relative pt-12">
          <button
            onClick={() => setShowHelpPanel(true)}
            className="absolute top-2 right-2 px-4 py-2 bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 rounded-lg transition-colors text-base font-semibold border border-purple-500/30 flex items-center gap-2 z-10"
            title="查看功能说明"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            帮助
          </button>
          <div className="flex items-center justify-center gap-3 mb-2">
            <h1 className="text-3xl md:text-3xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
              音乐情绪识别系统
            </h1>
            <button
              onClick={handleOpenDatabasePanel}
              className="px-3 py-1.5 bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 rounded-lg transition-colors text-base font-semibold border border-blue-500/30"
            >
              数据库管理
            </button>
            <button
              onClick={() => setShowAnalyticsDashboard(true)}
              className="px-3 py-1.5 bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 rounded-lg transition-colors text-base font-semibold border border-purple-500/30"
              title="查看数据分析仪表盘"
            >
              📊 数据分析
            </button>
            <button
              onClick={() => setShowErrorPanel(true)}
              className="px-3 py-1.5 bg-yellow-500/20 hover:bg-yellow-500/30 text-yellow-300 rounded-lg transition-colors text-base font-semibold border border-yellow-500/30"
              title="查看错误处理面板"
            >
              ⚠️ 错误处理
            </button>
            <button
              onClick={() => setShowLlmConfigPanel(true)}
              className="px-3 py-1.5 bg-green-500/20 hover:bg-green-500/30 text-green-300 rounded-lg transition-colors text-base font-semibold border border-green-500/30"
              title="LLM 配置"
            >
              🤖 LLM 配置
            </button>
          </div>
          <p className="text-gray-300 text-base">
            智能识别音乐情绪、风格，为影视作品找到合适配乐
            <br />
            别把 AI 的分析当作标准答案，它更像一块敲门砖，帮你敲开灵感的大门。
          </p>
        </header>

        {/* LLM 配置面板 */}
        {showLlmConfigPanel && (
          <SimpleLLMConfig onClose={() => setShowLlmConfigPanel(false)} />
        )}

        {/* 主要内容区 */}
        <div className="grid lg:grid-cols-4 gap-4">
          {/* 左侧：上传区域 */}
          <div className="lg:col-span-3 space-y-4">
            {/* 上传区域 */}
            <div className="bg-white/5 backdrop-blur-sm rounded-xl p-4 border border-white/10">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-xl font-semibold">上传音乐文件</h2>
                <div className="flex gap-2 flex-wrap">
                  {/* 批量分析按钮 */}
                  <button
                    onClick={analyzeAllFiles}
                    disabled={audioFiles.length === 0}
                    className="px-5 py-3 text-base bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed font-medium shadow-lg shadow-purple-500/30 hover:shadow-xl hover:shadow-purple-500/40 min-h-[48px]"
                    title="批量分析所有未分析的文件"
                  >
                    {audioFiles.some(f => f.isAnalyzing) ? (
                      <span className="flex items-center gap-2">
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        分析中...
                      </span>
                    ) : (
                      `批量分析 ${audioFiles.filter(f => !f.result).length}`
                    )}
                  </button>

                  {/* 极速分析按钮 */}
                  <button
                    onClick={() => {
                      setAnalysisConfig({
                        skipOnlineVerification: true,
                        enableCache: true,
                        concurrentBatchSize: 10,
                        useFastAPI: true,
                        skipMD5Calculation: true,
                        skipMetadataExtraction: true,
                        skipSceneReanalysis: true,
                      });
                      analyzeAllFiles();
                    }}
                    disabled={audioFiles.length === 0 || audioFiles.some(f => f.isAnalyzing)}
                    className="px-5 py-3 text-base bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed font-medium shadow-lg shadow-orange-500/30 hover:shadow-xl hover:shadow-orange-500/40 min-h-[48px]"
                    title="开启所有优化选项进行极速分析（适合大量文件）"
                  >
                    ⚡ 极速分析
                  </button>

                  {audioFiles.filter(f => f.result !== null).length > 0 && (
                    <>
                      {/* 批量二次识别按钮 */}
                      {audioFiles.some(
                        f =>
                          f.selected &&
                          f.result &&
                          f.result.filmMusic?.scenes?.some(
                            (s: any) =>
                              s.type === '未识别场景' || s.type === '未识别'
                          )
                      ) && (
                        <button
                          onClick={() => {
                            const selectedUnrecognizedFileIds = audioFiles
                              .filter(
                                f =>
                                  f.selected &&
                                  f.result &&
                                  f.result.filmMusic?.scenes?.some(
                                    (s: any) =>
                                      s.type === '未识别场景' ||
                                      s.type === '未识别'
                                  )
                              )
                              .map(f => f.id);
                            batchTriggerSceneReanalysis(selectedUnrecognizedFileIds);
                          }}
                          className="px-4 py-2 text-base bg-orange-500/10 hover:bg-orange-500/20 text-orange-400 border-2 border-orange-500/50 rounded-lg transition-all"
                          title="批量二次识别未识别场景"
                        >
                          批量二次识别 (
                          {
                            audioFiles.filter(
                              f =>
                                f.selected &&
                                f.result &&
                                f.result.filmMusic?.scenes?.some(
                                  (s: any) =>
                                    s.type === '未识别场景' ||
                                    s.type === '未识别'
                                )
                            ).length
                          }
                          )
                        </button>
                      )}
                      {/* 重新分析按钮 */}
                      {audioFiles.some(f => f.selected && f.result !== null) && (
                        <button
                          onClick={reAnalyzeSelectedFiles}
                          className="px-4 py-2 text-base bg-purple-500/10 hover:bg-purple-500/20 text-purple-400 border-2 border-purple-500/50 rounded-lg transition-all"
                          title="重新分析选中的文件"
                        >
                          重新分析 ({audioFiles.filter(f => f.selected && f.result !== null).length})
                        </button>
                      )}
                      <button
                        onClick={handleBatchExportCSV}
                        className="px-4 py-2 text-base bg-green-500/10 hover:bg-green-500/20 text-green-400 border-2 border-green-500/50 rounded-lg transition-all"
                        title="批量导出CSV"
                      >
                        批量导出CSV
                      </button>
                      <button
                        onClick={handleBatchExportExcel}
                        className="px-4 py-2 text-base bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 border-2 border-blue-500/50 rounded-lg transition-all"
                        title="批量导出Excel"
                      >
                        批量导出Excel
                      </button>
                      <button
                        onClick={handleBatchUploadToCloud}
                        className="px-4 py-2 text-base bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 border-2 border-indigo-500/50 rounded-lg transition-all"
                        title="批量上传到云端"
                      >
                        批量上传云端
                      </button>
                    </>
                  )}
                  <button
                    onClick={() => setShowCloudMusicPanel(true)}
                    className="px-4 py-2 text-base bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 border-2 border-cyan-500/50 rounded-lg transition-all"
                    title="管理云端音乐"
                  >
                    云端音乐
                  </button>
                  {audioFiles.length > 0 && (
                    <>
                      <button
                        onClick={() => setShowTagMappingPanel(true)}
                        className="px-4 py-2 text-base bg-pink-500/10 hover:bg-pink-500/20 text-pink-400 border-2 border-pink-500/50 rounded-lg transition-all"
                        title="配置访达标签映射"
                      >
                        🏷️ 访达标签
                      </button>
                    </>
                  )}
                  {audioFiles.length > 0 && (
                    <button
                      onClick={clearAllFiles}
                      className="px-3 py-1 text-base bg-red-500/20 hover:bg-red-500/30 text-red-300 rounded-lg transition-colors"
                    >
                      清空全部
                    </button>
                  )}
                </div>
              </div>
              <div className="border-2 border-dashed border-purple-400/30 rounded-lg p-4 text-center hover:border-purple-400/50 transition-colors">
                <input
                  type="file"
                  id="audio-upload"
                  ref={(input) => {
                    if (input) {
                      console.log('[文件上传] input元素已挂载');
                      window.fileInput = input;
                    }
                  }}
                  accept="audio/*"
                  multiple
                  onChange={handleFileUpload}
                  className="hidden"
                />
                <div
                  className="cursor-pointer block"
                  onClick={() => {
                    console.log('[文件上传] 点击上传区域');
                    const input = document.getElementById('audio-upload') as HTMLInputElement;
                    if (input) {
                      console.log('[文件上传] 触发文件选择对话框');
                      input.click();
                    } else {
                      console.error('[文件上传] 未找到input元素');
                    }
                  }}
                >
                  <div className="text-3xl mb-1">🎵</div>
                  <p className="text-base text-gray-300">
                    {audioFiles.length > 0
                      ? `已选择 ${audioFiles.length} 个文件，点击添加更多`
                      : '点击或拖拽音频文件到这里'}
                  </p>
                  <p className="text-base text-gray-500 mt-1">支持 MP3, WAV, OGG, FLAC 等格式，可批量选择</p>
                  <p className="text-sm text-amber-400 mt-1">⚠️ 由于服务器限制，上传云端的文件不能大于10MB</p>
                </div>
              </div>

              {/* 文件列表 */}
              {audioFiles.length > 0 && (
                <div
                  ref={fileListRef}
                  className="mt-3 max-h-96 overflow-y-auto space-y-1.5"
                >
                  {/* 全选按钮 */}
                  {audioFiles.some(f => f.result !== null) && (
                    <div className="flex items-center gap-2 p-2 bg-white/5 rounded-lg border border-white/10">
                      <input
                        type="checkbox"
                        id="select-all"
                        checked={selectAll}
                        onChange={toggleSelectAll}
                        className="w-3.5 h-3.5 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                      />
                      <label htmlFor="select-all" className="text-base text-gray-300 cursor-pointer select-none">
                        全选已完成分析的文件
                      </label>
                      <span className="text-base text-gray-500 ml-auto">
                        已选 {audioFiles.filter(f => f.selected && f.result !== null).length} / {audioFiles.filter(f => f.result !== null).length}
                      </span>
                      <span className="text-sm text-gray-400 ml-2">
                        共 {audioFiles.length} 个文件
                      </span>
                    </div>
                  )}
                  {audioFiles.map((item, index) => {
                    const isCurrent = item.id === currentFileId;
                    const isSelected = index === selectedIndex;
                    const canBeSelected = item.result !== null; // 仅已完成分析的文件可以被选中
                    return (
                      <div
                        key={item.id}
                        data-file-item
                        className={`flex items-center justify-between p-2 rounded-lg border transition-all ${
                          isCurrent
                            ? 'bg-purple-500/20 border-purple-500/50'
                            : isSelected
                              ? 'bg-cyan-500/20 border-cyan-500/50'
                              : 'bg-white/5 border-white/10 hover:border-purple-500/30'
                        }`}
                      >
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          {/* 勾选框：仅已完成分析的文件显示 */}
                          {canBeSelected && (
                            <input
                              type="checkbox"
                              checked={item.selected || false}
                              onChange={() => toggleSelectFile(item.id)}
                              className="w-4 h-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500 cursor-pointer"
                            />
                          )}
                          <button
                            onClick={() => switchToFile(item.id)}
                            className="flex-1 text-left"
                          >
                            <div className="flex flex-col gap-1">
                              {/* 文件名和状态 */}
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-base">
                                  {item.file.name}
                                </span>
                                {/* 状态显示：按优先级只显示一个主要状态 */}
                                {(() => {
                                // 优先级1：错误状态
                                if (item.error) {
                                  return (
                                    <span className="px-1.5 py-0.5 bg-red-500/20 text-red-300 text-base rounded-full">
                                      ❌
                                    </span>
                                  );
                                }

                                // 优先级2：上传中
                                if (item.isUploading) {
                                  return (
                                    <span className="px-1.5 py-0.5 bg-purple-500/20 text-purple-300 text-base rounded-full">
                                      ⬆️ {item.uploadProgress || 0}%
                                    </span>
                                  );
                                }

                                // 优先级3：分析中
                                if (item.isAnalyzing) {
                                  return (
                                    <span className="px-1.5 py-0.5 bg-blue-500/20 text-blue-300 text-base rounded-full">
                                      分析中...
                                    </span>
                                  );
                                }

                                // 优先级4：二次识别中
                                if (item.sceneReanalyzing) {
                                  return (
                                    <span className="px-1.5 py-0.5 bg-orange-500/20 text-orange-300 text-base rounded-full">
                                      🔍 二次识别
                                    </span>
                                  );
                                }

                                // 优先级5：重新分析中
                                if (item.reAnalyzing) {
                                  return (
                                    <span className="px-1.5 py-0.5 bg-purple-500/20 text-purple-300 text-base rounded-full">
                                      🔄 重新分析
                                    </span>
                                  );
                                }

                                // 优先级6：已完成分析（根据数据库状态显示"云端"或"在线"）
                                if (item.result) {
                                  // 从数据库搜索结果中查找该文件的记录
                                  const dbRecord = dbSearchResults.find(r => r.fileName === item.file.name);
                                  // 如果已上传到云端，显示"云端"；否则显示"在线"
                                  if (dbRecord && dbRecord.musicStatus === 'cloud') {
                                    return (
                                      <span className="px-1.5 py-0.5 bg-emerald-500/20 text-emerald-300 text-base rounded-full">
                                        ☁️ 云端
                                      </span>
                                    );
                                  }
                                  return (
                                    <span className="px-1.5 py-0.5 bg-cyan-500/20 text-cyan-300 text-base rounded-full">
                                      📍 在线
                                    </span>
                                  );
                                }

                                // 优先级7：未分析（根据数据库状态显示"云端"或"在线"）
                                // 从数据库搜索结果中查找该文件的记录
                                const dbRecord = dbSearchResults.find(r => r.fileName === item.file.name);
                                // 如果已上传到云端，显示"云端"；否则显示"在线"
                                if (dbRecord && dbRecord.musicStatus === 'cloud') {
                                  return (
                                    <span className="px-1.5 py-0.5 bg-emerald-500/20 text-emerald-300 text-base rounded-full">
                                      ☁️ 云端
                                    </span>
                                  );
                                }
                                return (
                                  <span className="px-1.5 py-0.5 bg-cyan-500/20 text-cyan-300 text-base rounded-full">
                                    📍 在线
                                  </span>
                                );
                              })()}
                            </div>
                            {/* 分析结果摘要显示 */}
                            {(() => {
                              // 优先使用本地的分析结果
                              let analysisResult = item.result;

                              // 如果本地没有分析结果，尝试从数据库搜索结果中查找
                              if (!analysisResult) {
                                const dbRecord = dbSearchResults.find(r => r.fileName === item.file.name);
                                if (dbRecord) {
                                  // 将数据库记录转换为 AnalysisResult 格式
                                  // 提取 otherFeatures 中的详细信息
                                  const otherFeatures = dbRecord.otherFeatures || {};
                                  const metadata = dbRecord.metadata || {};

                                  analysisResult = {
                                    mood: {
                                      primary: dbRecord.summary || '',
                                      originalPrimary: otherFeatures.originalMoodPrimary,
                                      intensity: otherFeatures.moodIntensity || '未识别',
                                      trajectory: otherFeatures.moodTrajectory || '未识别',
                                      emotionalDimensions: otherFeatures.emotionalDimensions || {
                                        happiness: 0,
                                        sadness: 0,
                                        tension: 0,
                                        romance: 0,
                                        epic: 0
                                      }
                                    },
                                    style: {
                                      primary: Array.isArray(dbRecord.styles) ? dbRecord.styles[0] || '未识别' : '未识别',
                                      subGenre: '',
                                      genreBlending: '',
                                      era: ''
                                    },
                                    musicalStructure: {
                                      form: otherFeatures.structure || '未识别',
                                      chorus: otherFeatures.structureChorus || '',
                                      bridge: otherFeatures.structureBridge || '',
                                      repeatPatterns: otherFeatures.structureRepeatPatterns || ''
                                    },
                                    harmony: {
                                      tonality: otherFeatures.harmony || '未识别',
                                      key: otherFeatures.harmonyKey || '未识别',
                                      chordProgression: otherFeatures.harmonyChordProgression || '未识别',
                                      modulation: otherFeatures.harmonyModulation || '未识别'
                                    },
                                    rhythm: {
                                      timeSignature: otherFeatures.rhythmTimeSignature || '未识别',
                                      rhythmPattern: otherFeatures.rhythm || '未识别',
                                      groove: otherFeatures.rhythmGroove || ''
                                    },
                                    instruments: {
                                      primary: Array.isArray(otherFeatures.instrumentsPrimary) ? otherFeatures.instrumentsPrimary : (Array.isArray(dbRecord.instruments) ? dbRecord.instruments : []),
                                      accompaniment: Array.isArray(otherFeatures.instrumentsAccompaniment) ? otherFeatures.instrumentsAccompaniment : [],
                                      percussion: Array.isArray(otherFeatures.instrumentsPercussion) ? otherFeatures.instrumentsPercussion : [],
                                      electronicElements: otherFeatures.instrumentsElectronicElements || '',
                                      timbre: otherFeatures.instrumentsTimbre || ''
                                    },
                                    musicOrigin: {
                                      confidenceLevel: (dbRecord.confidence === 'high' ? '高' : dbRecord.confidence === 'medium' ? '中' : '低') as '高' | '中' | '低',
                                      sourceType: (dbRecord.sourceType || '不确定') as '影视原声' | '专辑' | '独立单曲' | '综艺' | '游戏配乐' | '广告' | '不确定',
                                      album: {
                                        name: dbRecord.album || '',
                                        releaseYear: metadata.year ? String(metadata.year) : '',
                                        label: ''
                                      },
                                      filmOrTV: {
                                        name: dbRecord.filmName || '',
                                        episode: '',
                                        scene: dbRecord.filmScene || '',
                                        platform: dbRecord.platform || ''
                                      },
                                      creators: dbRecord.creators || {},
                                      reasoning: dbRecord.confidenceReason || '',
                                      uncertaintyReason: ''
                                    },
                                    filmMusic: {
                                      filmType: dbRecord.filmType || '未识别',
                                      suitableGenres: Array.isArray(dbRecord.filmScenes) ? dbRecord.filmScenes : [],
                                      // 处理场景数据：如果是字符串则分割，如果是数组则映射
                                      scenes: (() => {
                                        const scenariosData = dbRecord.scenarios;
                                        if (typeof scenariosData === 'string') {
                                          // 如果是逗号分隔的字符串，分割成数组
                                          return scenariosData.split(',').map((s: string) => s.trim()).filter((s: string) => s)
                                            .map((s: string) => ({ type: s, description: '', emotionalImpact: '', usageTips: '' }));
                                        } else if (Array.isArray(scenariosData)) {
                                          // 如果是数组，映射成标准格式
                                          return scenariosData.map((s: any) => typeof s === 'string'
                                            ? { type: s, description: '', emotionalImpact: '', usageTips: '' }
                                            : s);
                                        }
                                        return [];
                                      })(),
                                      turningPoints: otherFeatures.filmTurningPoints || '未识别',
                                      characterTheme: {
                                        suitable: otherFeatures.filmCharacterThemeSuitable || '未识别',
                                        characterType: otherFeatures.filmCharacterThemeCharacterType || '未识别',
                                        storyArc: otherFeatures.filmCharacterThemeStoryArc || '未识别'
                                      },
                                      atmosphere: otherFeatures.filmAtmosphere || '未识别',
                                      emotionalGuidance: otherFeatures.filmEmotionalGuidance || '未识别'
                                    },
                                    culturalContext: {
                                      origin: otherFeatures.culture || '未识别',
                                      influences: [],
                                      modernInterpretation: ''
                                    }
                                  };
                                }
                              }

                              // 如果有分析结果，显示摘要
                              if (analysisResult) {
                                const emotion = analysisResult.mood?.primary || '未识别';
                                const originalEmotion = analysisResult.mood?.originalPrimary;
                                const emotionDisplay = originalEmotion && originalEmotion !== emotion ? `${emotion}（${originalEmotion}）` : emotion;
                                const intensity = analysisResult.mood?.intensity || '未识别';
                                const style = analysisResult.style?.primary || '未识别';
                                const filmType = analysisResult.filmMusic?.filmType || '未识别';
                                const turningPoints = analysisResult.filmMusic?.turningPoints || '未识别';
                                const atmosphere = analysisResult.filmMusic?.atmosphere || '未识别';
                                const harmonyTonality = analysisResult.harmony?.tonality || '未识别';
                                const harmonyKey = analysisResult.harmony?.key || '未识别';
                                const harmony = harmonyTonality !== '未识别' ? harmonyTonality : harmonyKey;
                                // 处理场景数据：支持字符串和数组格式
                                const scenes = (() => {
                                  const scenesData: any = analysisResult.filmMusic?.scenes;
                                  if (typeof scenesData === 'string') {
                                    // 如果是逗号分隔的字符串，分割成数组
                                    return scenesData.split(',').map((s: string) => s.trim()).filter((s: string) => s).slice(0, 2).join('、');
                                  } else if (Array.isArray(scenesData)) {
                                    // 如果是数组，提取type字段
                                    return scenesData.map((s: any) => typeof s === 'string' ? s : s.type).slice(0, 2).join('、');
                                  }
                                  return '未识别';
                                })();

                                return (
                                  <div
                                    className="text-xs text-gray-400 cursor-help truncate"
                                    title={`🎭 情绪分析：${emotionDisplay}\n⚡ 强度值：${intensity}\n🎨 音乐风格：${style}\n🎬 影片类型：${filmType}\n🔄 情节转折：${turningPoints}\n🌫️ 氛围营造：${atmosphere}\n🎹 和声特征：${harmony}\n🏠 场景建议：${scenes}`}
                                  >
                                    😊{emotionDisplay} · 🎨{style} · 🎬{filmType} · 🏠{scenes}
                                  </div>
                                );
                              }
                              return null;
                            })()}
                            <p className="text-base text-gray-500">
                              {(item.file.size / 1024 / 1024).toFixed(2)} MB
                            </p>
                            </div>
                          </button>
                          {/* 二次识别按钮：仅当场景为"未识别场景"时显示 */}
                          {item.result &&
                            item.result.filmMusic?.scenes?.some(
                              (s: any) =>
                                s.type === '未识别场景' || s.type === '未识别'
                            ) &&
                            !item.sceneReanalyzing && (
                              <button
                                onClick={() => manualTriggerSceneReanalysis(item)}
                                className="p-2 hover:bg-orange-500/20 rounded-lg text-orange-400 transition-colors"
                                title="二次识别场景"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                </svg>
                              </button>
                            )}
                          <button
                            onClick={() => removeFile(item.id)}
                            className="p-2 hover:bg-red-500/20 rounded-lg text-red-400 transition-colors"
                            title="删除文件"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* 【改进】通知显示区域 */}
            {notifications.length > 0 && (
              <div className="space-y-2">
                {notifications.map((notification) => {
                  // 根据类型设置样式
                  const typeStyles = {
                    error: {
                      bgClass: 'bg-red-500/20',
                      borderClass: 'border-red-500/30',
                      textClass: 'text-red-300',
                      icon: (
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      ),
                    },
                    warning: {
                      bgClass: 'bg-yellow-500/20',
                      borderClass: 'border-yellow-500/30',
                      textClass: 'text-yellow-300',
                      icon: (
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                      ),
                    },
                    info: {
                      bgClass: 'bg-blue-500/20',
                      borderClass: 'border-blue-500/30',
                      textClass: 'text-blue-300',
                      icon: (
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      ),
                    },
                    success: {
                      bgClass: 'bg-green-500/20',
                      borderClass: 'border-green-500/30',
                      textClass: 'text-green-300',
                      icon: (
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      ),
                    },
                  };

                  const style = typeStyles[notification.type];

                  return (
                    <div
                      key={notification.id}
                      className={`${style.bgClass} ${style.borderClass} border rounded-xl p-4 ${style.textClass} flex items-start gap-3 transition-all duration-300 animate-slide-in`}
                    >
                      <div className="flex-shrink-0 mt-0.5">{style.icon}</div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium">{notification.message}</p>
                      </div>
                      <button
                        onClick={() => removeNotification(notification.id)}
                        className="flex-shrink-0 p-1 hover:bg-white/10 rounded transition-colors"
                        title="关闭"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  );
                })}

                {/* 全部关闭按钮 */}
                {notifications.length > 1 && (
                  <button
                    onClick={clearAllNotifications}
                    className="text-sm text-gray-400 hover:text-gray-300 transition-colors"
                  >
                    全部关闭 ({notifications.length})
                  </button>
                )}
              </div>
            )}

            {/* 保留原有的error状态显示，向后兼容 */}
            {error && notifications.length === 0 && (
              <div className="bg-red-500/20 border border-red-500/30 rounded-xl p-4 text-red-300">
                {error}
              </div>
            )}
          </div>

          {/* 右侧：播放器和音频特征 */}
          <div className="space-y-4">
            {/* 增强播放器 */}
            {currentFileId && (
              <div className="bg-white/5 backdrop-blur-sm rounded-xl p-3 border border-white/10 space-y-2">
                {/* 标题栏 */}
                <div className="flex items-center justify-between mb-1">
                  <h2 className="text-base font-semibold">音乐播放器</h2>
                </div>

                {/* 歌曲名称 */}
                <p className="text-base text-gray-300 truncate px-1" title={getCurrentMusicInfo()?.fileName || getCurrentFile()?.file.name}>
                  {getCurrentMusicInfo()?.fileName || getCurrentFile()?.file.name || '未播放'}
                </p>

                {/* 可视化区域 */}
                <div className="bg-black/30 rounded-lg overflow-hidden">
                  <canvas ref={canvasRef} width={800} height={120} className="w-full" />
                </div>

                {/* 进度条 + 时间 */}
                <div className="space-y-1">
                  <input
                    type="range"
                    min="0"
                    max={duration || 0}
                    step="0.1"
                    value={currentTime}
                    onChange={handleSeek}
                    onInput={handleSeek}
                    onPointerDown={() => setIsSeeking(true)}
                    onPointerUp={() => setIsSeeking(false)}
                    onPointerLeave={() => setIsSeeking(false)}
                    className="w-full h-1.5 bg-white/20 rounded-lg appearance-none cursor-pointer z-10 relative focus:outline-none"
                    style={{
                      background: `linear-gradient(to right, #8B5CF6 0%, #8B5CF6 ${
                        ((currentTime / (duration || 1)) * 100).toFixed(2)
                      }%, rgba(255,255,255,0.2) ${
                        ((currentTime / (duration || 1)) * 100).toFixed(2)
                      }%, rgba(255,255,255,0.2) 100%)`,
                      WebkitAppearance: 'none',
                    }}
                  />
                  <style jsx global>{`
                    input[type="range"]::-webkit-slider-thumb {
                      -webkit-appearance: none;
                      appearance: none;
                      width: 12px;
                      height: 12px;
                      border-radius: 50%;
                      background: #8B5CF6;
                      cursor: pointer;
                      box-shadow: 0 0 8px rgba(139, 92, 246, 0.5);
                      transition: all 0.2s;
                    }
                    input[type="range"]::-webkit-slider-thumb:hover {
                      background: #EC4899;
                      transform: scale(1.1);
                    }
                    input[type="range"]::-moz-range-thumb {
                      width: 12px;
                      height: 12px;
                      border-radius: 50%;
                      background: #8B5CF6;
                      cursor: pointer;
                      border: none;
                      box-shadow: 0 0 8px rgba(139, 92, 246, 0.5);
                      transition: all 0.2s;
                    }
                    input[type="range"]::-moz-range-thumb:hover {
                      background: #EC4899;
                      transform: scale(1.1);
                    }
                  `}</style>
                  <div className="flex justify-between text-base text-gray-400">
                    <span>{formatTime(currentTime)}</span>
                    <span>{formatTime(duration)}</span>
                  </div>
                </div>

                {/* 播放控制按钮 - 第一行（主控制） */}
                <div className="flex items-center justify-center gap-2">
                  {/* 播放模式 */}
                  <button
                    onClick={togglePlayMode}
                    className="p-2 rounded-lg bg-white/10 hover:bg-white/20 transition-colors"
                    title={playMode === 'sequential' ? '顺序播放' : playMode === 'loop-one' ? '单曲循环' : '随机播放'}
                  >
                    {playMode === 'sequential' ? (
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M7 7h10v3l4-4-4-4v3H5v6h2V7zm10 10H7v-3l-4 4 4 4v-3h12v-6h-2v4z" />
                      </svg>
                    ) : playMode === 'loop-one' ? (
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M12 4V1L8 5l4 4V6c3.31 0 6 2.69 6 6 0 1.01-.25 1.97-.7 2.8l1.46 1.46C19.54 15.03 20 13.57 20 12c0-4.42-3.58-8-8-8zm0 14c-3.31 0-6-2.69-6-6 0-1.01.25-1.97.7-2.8L5.24 7.74C4.46 8.97 4 10.43 4 12c0 4.42 3.58 8 8 8v3l4-4-4-4v3z" />
                      </svg>
                    ) : (
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M10.59 9.17L5.41 4 4 5.41l5.17 5.17 1.42-1.41zM14.5 4l2.04 2.04L4 18.59 5.41 20 17.96 7.46 20 9.5V4h-5.5zm.33 9.41l-1.41 1.41 3.13 3.13L14.5 20H20v-5.5l-2.04 2.04-3.13-3.13z" />
                      </svg>
                    )}
                  </button>

                  {/* 上一首 */}
                  <button
                    onClick={playPrevious}
                    className="p-2 rounded-lg bg-white/10 hover:bg-white/20 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                    title="上一首"
                    disabled={(playQueueMode === 'uploaded' ? audioFiles.length : dbSearchResults.length) <= 1}
                  >
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M6 6h2v12H6zm3.5 6l8.5 6V6z" />
                    </svg>
                  </button>

                  {/* 播放/暂停（大按钮） */}
                  <button
                    onClick={togglePlay}
                    className="w-12 h-12 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 flex items-center justify-center hover:scale-105 transition-transform shadow-lg shadow-purple-500/30"
                  >
                    {isPlaying ? (
                      <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
                      </svg>
                    ) : (
                      <svg className="w-6 h-6 ml-0.5" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M8 5v14l11-7z" />
                      </svg>
                    )}
                  </button>

                  {/* 下一首 */}
                  <button
                    onClick={playNext}
                    className="p-2 rounded-lg bg-white/10 hover:bg-white/20 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                    title="下一首"
                    disabled={(playQueueMode === 'uploaded' ? audioFiles.length : dbSearchResults.length) <= 1}
                  >
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z" />
                    </svg>
                  </button>

                  {/* 停止 */}
                  <button
                    onClick={stopPlay}
                    className="p-2 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-red-400 transition-colors"
                    title="停止播放"
                  >
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M6 6h12v12H6z" />
                    </svg>
                  </button>
                </div>

                {/* 播放控制按钮 - 第二行（辅助控制） */}
                <div className="flex items-center justify-between gap-2">
                  {/* 音量控制 */}
                  <div className="flex items-center gap-2 flex-1">
                    <button onClick={toggleMute} className="text-gray-400 hover:text-white transition-colors">
                      {isMuted || volume === 0 ? (
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z" />
                        </svg>
                      ) : volume < 0.5 ? (
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M18.5 12c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM5 9v6h4l5 5V4L9 9H5z" />
                        </svg>
                      ) : (
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z" />
                        </svg>
                      )}
                    </button>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.01"
                      value={isMuted ? 0 : volume}
                      onChange={handleVolumeChange}
                      className="flex-1 h-1 bg-white/20 rounded-lg appearance-none cursor-pointer accent-purple-500 hover:accent-pink-500 transition-all"
                    />
                    <span className="text-base text-gray-400 w-8">{Math.round((isMuted ? 0 : volume) * 100)}%</span>
                  </div>

                  {/* 倍速控制 */}
                  <div className="relative">
                    <button
                      onClick={() => setShowSpeedMenu(!showSpeedMenu)}
                      className="px-2 py-1 rounded-lg bg-white/10 hover:bg-white/20 transition-colors text-base font-medium"
                    >
                      {playbackSpeed}x
                    </button>
                    {showSpeedMenu && (
                      <div className="absolute bottom-full right-0 mb-2 bg-gray-800 rounded-lg shadow-lg overflow-hidden z-10">
                        {[0.5, 0.75, 1, 1.25, 1.5, 2].map((speed) => (
                          <button
                            key={speed}
                            onClick={() => handleSpeedChange(speed)}
                            className={`block w-full px-3 py-1.5 text-base hover:bg-purple-500/30 transition-colors ${
                              playbackSpeed === speed ? 'bg-purple-500/20 text-purple-400' : 'text-gray-300'
                            }`}
                          >
                            {speed}x
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <audio
                  ref={audioRef}
                  className="hidden"
                />
              </div>
            )}

            {error && (
              <div className="bg-red-500/20 border border-red-500/30 rounded-xl p-4 text-red-300">
                {error}
              </div>
            )}

            {getCurrentFile()?.features && (
              <div className="bg-white/5 backdrop-blur-sm rounded-xl p-4 border border-white/10">
                <h2 className="text-base font-semibold mb-3">音频特征</h2>
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-black/20 rounded-lg p-3">
                    <p className="text-gray-400 text-base">BPM (节拍)</p>
                    <p className="text-xl font-bold text-purple-400">{currentFeatures!.bpm}</p>
                  </div>
                  <div className="bg-black/20 rounded-lg p-3">
                    <p className="text-gray-400 text-base">时长</p>
                    <p className="text-xl font-bold text-pink-400">
                      {Math.floor(currentFeatures!.duration / 60)}:{(currentFeatures!.duration % 60).toFixed(0).padStart(2, '0')}
                    </p>
                  </div>
                  <div className="bg-black/20 rounded-lg p-3">
                    <p className="text-gray-400 text-base">能量值</p>
                    <p className="text-xl font-bold text-blue-400">{currentFeatures!.energy}</p>
                  </div>
                  <div className="bg-black/20 rounded-lg p-3">
                    <p className="text-gray-400 text-base">动态范围</p>
                    <p className="text-xl font-bold text-green-400">{currentFeatures!.dynamics.range}</p>
                  </div>
                </div>

                <div className="mt-3">
                  <p className="text-gray-400 text-base mb-2">频谱分布</p>
                  <div className="flex gap-2 h-6 rounded-lg overflow-hidden">
                    <div
                      className="bg-gradient-to-r from-red-500 to-orange-500 transition-all duration-500"
                      style={{ width: `${currentFeatures!.frequencyProfile.low * 100}%` }}
                    />
                    <div
                      className="bg-gradient-to-r from-yellow-500 to-green-500 transition-all duration-500"
                      style={{ width: `${currentFeatures!.frequencyProfile.mid * 100}%` }}
                    />
                    <div
                      className="bg-gradient-to-r from-blue-500 to-purple-500 transition-all duration-500"
                      style={{ width: `${currentFeatures!.frequencyProfile.high * 100}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-base text-gray-500 mt-1">
                    <span>低频 {Math.round(currentFeatures!.frequencyProfile.low * 100)}%</span>
                    <span>中频 {Math.round(currentFeatures!.frequencyProfile.mid * 100)}%</span>
                    <span>高频 {Math.round(currentFeatures!.frequencyProfile.high * 100)}%</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* AI分析结果 - 重新设计布局 */}
        {(currentResult || streamText) && (
          <div className="mt-3 space-y-3">
            <div className="bg-white/5 backdrop-blur-sm rounded-xl p-3 border border-white/10">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-xl font-bold flex items-center gap-2">
                  <span className="text-xl">🎭</span>
                  <span>AI 智能分析</span>
                  <span className="text-base bg-purple-500/30 px-1.5 py-0.5 rounded-full">流式输出</span>
                </h2>
                {currentResult && (
                  <div className="flex gap-2">
                    <button
                      onClick={handleShowPreview}
                      className="flex items-center gap-2 px-2.5 py-1 bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 rounded-lg transition-colors border border-purple-500/30 text-base"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
                      </svg>
                      <span>查看表格</span>
                    </button>
                  </div>
                )}
              </div>

              {streamText && !currentResult && (
                <div className="prose prose-invert max-w-none">
                  <pre className="whitespace-pre-wrap text-base text-gray-300">{streamText}</pre>
                </div>
              )}

              {currentResult && (
                <div className="space-y-3">
                  {/* 核心模块1：情绪识别（最大，最醒目） */}
                  <div className="bg-gradient-to-br from-purple-900/50 via-pink-900/50 to-purple-900/50 rounded-xl p-3 border border-purple-500/30 shadow-2xl shadow-purple-500/20 relative">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-3xl">😊</span>
                        <h3 className="text-base font-bold text-white">情绪识别</h3>
                        {(editedContent.mood.primary || editedContent.mood.intensity || editedContent.mood.trajectory) && (
                          <span className="text-base bg-yellow-500/30 px-1.5 py-0.5 rounded-full text-yellow-300 border border-yellow-400/30">已编辑</span>
                        )}
                      </div>
                      <button
                        onClick={() => editingModule === 'mood' ? cancelEdit() : startEdit('mood')}
                        className="p-1 rounded-lg bg-white/10 hover:bg-white/20 transition-colors"
                      >
                        {editingModule === 'mood' ? '✕' : '✏️'}
                      </button>
                    </div>

                    {editingModule === 'mood' ? (
                      <div className="space-y-2 bg-black/30 rounded-lg p-2.5">
                        <div>
                          <label className="text-base text-gray-400 mb-0.5 block">主要情绪</label>
                          <input
                            type="text"
                            value={editedContent.mood.primary ?? (currentResult?.mood.primary ?? '')}
                            onChange={(e) => updateMoodEdit('primary', e.target.value)}
                            className="w-full px-2.5 py-1.5 bg-white/10 rounded-lg border border-white/20 text-white focus:outline-none focus:border-purple-500 text-base"
                          />
                        </div>
                        <div>
                          <label className="text-base text-gray-400 mb-0.5 block">强度</label>
                          <input
                            type="text"
                            value={editedContent.mood.intensity ?? (currentResult?.mood.intensity ?? '')}
                            onChange={(e) => updateMoodEdit('intensity', e.target.value)}
                            className="w-full px-2.5 py-1.5 bg-white/10 rounded-lg border border-white/20 text-white focus:outline-none focus:border-purple-500 text-base"
                          />
                        </div>
                        <div>
                          <label className="text-base text-gray-400 mb-0.5 block">情绪轨迹</label>
                          <textarea
                            value={editedContent.mood.trajectory ?? (currentResult?.mood.trajectory ?? '')}
                            onChange={(e) => updateMoodEdit('trajectory', e.target.value)}
                            className="w-full px-2.5 py-1.5 bg-white/10 rounded-lg border border-white/20 text-white focus:outline-none focus:border-purple-500 min-h-[50px] text-base"
                            rows={2}
                          />
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={saveEdit}
                            className="flex-1 py-1 px-2.5 bg-gradient-to-r from-purple-500 to-pink-500 rounded-lg font-medium hover:from-purple-600 hover:to-pink-600 transition-all text-base"
                          >
                            保存
                          </button>
                          <button
                            onClick={cancelEdit}
                            className="flex-1 py-1 px-2.5 bg-white/10 rounded-lg font-medium hover:bg-white/20 transition-colors text-base"
                          >
                            取消
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <div>
                          <p className="text-3xl font-bold mb-0.5 bg-gradient-to-r from-white to-purple-200 bg-clip-text text-transparent">
                            {(() => {
                              const primaryMood = ensureStringMoodPrimary(editedContent.mood.primary ?? currentResult?.mood.primary);
                              // 尝试从当前结果中获取原始情绪词
                              let originalMood = currentResult?.mood?.originalPrimary;
                              // 如果当前结果中没有，尝试从数据库记录中获取
                              if (!originalMood) {
                                const dbRecord = dbSearchResults.find(r => r.fileName === getCurrentFile()?.file.name);
                                if (dbRecord?.otherFeatures?.originalMoodPrimary) {
                                  originalMood = dbRecord.otherFeatures.originalMoodPrimary;
                                }
                              }
                              // 如果存在原始词且与标准词不同，显示"标准词（原词）"
                              if (originalMood && originalMood !== primaryMood) {
                                return `${primaryMood}（${originalMood}）`;
                              }
                              return primaryMood;
                            })()}
                          </p>
                          <p className="text-base text-purple-200 mb-0.5">强度: {editedContent.mood.intensity ?? currentResult?.mood.intensity}</p>
                          <p className="text-base text-gray-300">{editedContent.mood.trajectory ?? currentResult?.mood.trajectory}</p>
                        </div>

                        <div className="grid grid-cols-5 gap-2 mt-2">
                          <div className="bg-black/30 rounded-lg p-2 text-center">
                            <p className="text-base text-gray-400 mb-0.5">快乐</p>
                            <p className="text-xl font-bold text-green-400">{currentResult?.mood.emotionalDimensions.happiness}</p>
                          </div>
                          <div className="bg-black/30 rounded-lg p-2 text-center">
                            <p className="text-base text-gray-400 mb-0.5">悲伤</p>
                            <p className="text-xl font-bold text-blue-400">{currentResult?.mood.emotionalDimensions.sadness}</p>
                          </div>
                          <div className="bg-black/30 rounded-lg p-2 text-center">
                            <p className="text-base text-gray-400 mb-0.5">紧张</p>
                            <p className="text-xl font-bold text-red-400">{currentResult?.mood.emotionalDimensions.tension}</p>
                          </div>
                          <div className="bg-black/30 rounded-lg p-2 text-center">
                            <p className="text-base text-gray-400 mb-0.5">浪漫</p>
                            <p className="text-xl font-bold text-pink-400">{currentResult?.mood.emotionalDimensions.romance}</p>
                          </div>
                          <div className="bg-black/30 rounded-lg p-2 text-center">
                            <p className="text-base text-gray-400 mb-0.5">史诗</p>
                            <p className="text-xl font-bold text-yellow-400">{currentResult?.mood.emotionalDimensions.epic}</p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* 核心模块布局：左侧三个中等卡片，右侧一个大卡片 */}
                  <div className="grid lg:grid-cols-3 gap-3">
                    {/* 左侧列 */}
                    <div className="space-y-3">
                      {/* 核心模块2：音乐风格 */}
                      <div className="bg-gradient-to-br from-blue-900/50 to-cyan-900/50 rounded-xl p-3 border border-blue-500/30 relative">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <span className="text-xl">🎨</span>
                            <h3 className="text-base font-bold text-white">音乐风格</h3>
                            {(editedContent.style.primary || editedContent.style.subGenre || editedContent.style.genreBlending || editedContent.style.era) && (
                              <span className="text-base bg-yellow-500/30 px-1.5 py-0.5 rounded-full text-yellow-300 border border-yellow-400/30">已编辑</span>
                            )}
                          </div>
                          <button
                            onClick={() => editingModule === 'style' ? cancelEdit() : startEdit('style')}
                            className="p-1 rounded-lg bg-white/10 hover:bg-white/20 transition-colors"
                          >
                            {editingModule === 'style' ? '✕' : '✏️'}
                          </button>
                        </div>

                        {editingModule === 'style' ? (
                          <div className="space-y-1.5 bg-black/30 rounded-lg p-2.5">
                            <div>
                              <label className="text-base text-gray-400 mb-0.5 block">主要风格</label>
                              <input
                                type="text"
                                value={editedContent.style.primary ?? (currentResult?.style.primary ?? '')}
                                onChange={(e) => updateStyleEdit('primary', e.target.value)}
                                className="w-full px-2 py-1 bg-white/10 rounded-lg border border-white/20 text-white text-base focus:outline-none focus:border-blue-500"
                              />
                            </div>
                            <div>
                              <label className="text-base text-gray-400 mb-0.5 block">子风格</label>
                              <input
                                type="text"
                                value={editedContent.style.subGenre ?? (currentResult?.style.subGenre ?? '')}
                                onChange={(e) => updateStyleEdit('subGenre', e.target.value)}
                                className="w-full px-2 py-1 bg-white/10 rounded-lg border border-white/20 text-white text-base focus:outline-none focus:border-blue-500"
                              />
                            </div>
                            <div>
                              <label className="text-base text-gray-400 mb-0.5 block">风格融合</label>
                              <input
                                type="text"
                                value={editedContent.style.genreBlending ?? (currentResult?.style.genreBlending ?? '')}
                                onChange={(e) => updateStyleEdit('genreBlending', e.target.value)}
                                className="w-full px-2 py-1 bg-white/10 rounded-lg border border-white/20 text-white text-base focus:outline-none focus:border-blue-500"
                              />
                            </div>
                            <div>
                              <label className="text-base text-gray-400 mb-0.5 block">时期</label>
                              <input
                                type="text"
                                value={editedContent.style.era ?? (currentResult?.style.era ?? '')}
                                onChange={(e) => updateStyleEdit('era', e.target.value)}
                                className="w-full px-2 py-1 bg-white/10 rounded-lg border border-white/20 text-white text-base focus:outline-none focus:border-blue-500"
                              />
                            </div>
                            <div className="flex gap-2">
                              <button
                                onClick={saveEdit}
                                className="flex-1 py-1 px-2 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-lg font-medium hover:from-blue-600 hover:to-cyan-600 transition-all text-base"
                              >
                                保存
                              </button>
                              <button
                                onClick={cancelEdit}
                                className="flex-1 py-1 px-2 bg-white/10 rounded-lg font-medium hover:bg-white/20 transition-colors text-base"
                              >
                                取消
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="space-y-1">
                            <p className="text-base font-semibold text-blue-300">{editedContent.style.primary ?? currentResult?.style.primary}</p>
                            <div className="space-y-0.5 text-base text-gray-300">
                              <p>子风格: {editedContent.style.subGenre ?? currentResult?.style.subGenre}</p>
                              <p>融合: {editedContent.style.genreBlending ?? currentResult?.style.genreBlending}</p>
                              <p>时期: {editedContent.style.era ?? currentResult?.style.era}</p>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* 核心模块3：音乐出处 */}
                      <div className="bg-gradient-to-br from-green-900/50 to-emerald-900/50 rounded-xl p-3 border border-green-500/30 relative">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <span className="text-xl">💿</span>
                            <h3 className="text-base font-bold text-white">音乐出处</h3>
                            {currentResult?.musicOrigin && (
                              <span
                                className={`text-base px-1.5 py-0.5 rounded-full border ${
                                  currentResult.musicOrigin.confidenceLevel === '高'
                                    ? 'bg-green-500/30 text-green-300 border-green-400/30'
                                    : currentResult.musicOrigin.confidenceLevel === '中'
                                    ? 'bg-yellow-500/30 text-yellow-300 border-yellow-400/30'
                                    : 'bg-red-500/30 text-red-300 border-red-400/30'
                                }`}
                              >
                                置信度：{currentResult.musicOrigin.confidenceLevel}
                              </span>
                            )}
                            {editedContent.albumInfo && (
                              <span className="text-base bg-blue-500/30 px-1.5 py-0.5 rounded-full text-blue-300 border border-blue-400/30">已编辑</span>
                            )}
                          </div>
                          <button
                            onClick={() => editingModule === 'album' ? cancelEdit() : startEdit('album')}
                            className="p-1 rounded-lg bg-white/10 hover:bg-white/20 transition-colors"
                          >
                            {editingModule === 'album' ? '✕' : '✏️'}
                          </button>
                        </div>

                        {editingModule === 'album' ? (
                          <div className="space-y-2 bg-black/30 rounded-lg p-2.5">
                            <div>
                              <label className="text-base text-gray-400 mb-0.5 block">音乐出处信息</label>
                              <textarea
                                value={editedContent.albumInfo ?? (currentResult?.musicOrigin ? formatMusicOrigin(currentResult.musicOrigin) : '')}
                                onChange={(e) => updateAlbumInfoEdit(e.target.value)}
                                className="w-full px-2 py-1 bg-white/10 rounded-lg border border-white/20 text-white text-base focus:outline-none focus:border-green-500 min-h-[100px]"
                                rows={4}
                              />
                            </div>
                            <div className="flex gap-2">
                              <button
                                onClick={saveEdit}
                                className="flex-1 py-1 px-2 bg-gradient-to-r from-green-500 to-emerald-500 rounded-lg font-medium hover:from-green-600 hover:to-emerald-600 transition-all text-base"
                              >
                                保存
                              </button>
                              <button
                                onClick={cancelEdit}
                                className="flex-1 py-1 px-2 bg-white/10 rounded-lg font-medium hover:bg-white/20 transition-colors text-base"
                              >
                                取消
                              </button>
                            </div>
                          </div>
                        ) : (
                          <>
                            {currentResult?.musicOrigin ? (
                              <div className="space-y-3">
                                {currentResult.musicOrigin.sourceType && (
                                  <div className="flex items-center gap-2 text-base text-gray-300">
                                    <span className="font-medium text-green-300">来源类型：</span>
                                    <span>{currentResult.musicOrigin.sourceType}</span>
                                  </div>
                                )}
                                {currentResult.musicOrigin.filmOrTV?.name && (
                                  <div className="flex items-start gap-2 text-base text-gray-300">
                                    <span className="font-medium text-green-300">影视/综艺：</span>
                                    <div className="flex-1">
                                      <p>{currentResult.musicOrigin.filmOrTV.name}</p>
                                      {/* 显示中文翻译 */}
                                      {originTranslations[currentResult.musicOrigin.filmOrTV.name] && (
                                        <p className="text-base text-emerald-400 mt-1">{originTranslations[currentResult.musicOrigin.filmOrTV.name]}</p>
                                      )}
                                      {currentResult.musicOrigin.filmOrTV.episode && (
                                        <p className="text-base text-gray-400 mt-1">集数：{currentResult.musicOrigin.filmOrTV.episode}</p>
                                      )}
                                      {currentResult.musicOrigin.filmOrTV.scene && (
                                        <p className="text-base text-gray-400 mt-1">场景：{currentResult.musicOrigin.filmOrTV.scene}</p>
                                      )}
                                    </div>
                                  </div>
                                )}
                                {currentResult.musicOrigin.album?.name && (
                                  <div className="flex items-start gap-2 text-base text-gray-300">
                                    <span className="font-medium text-green-300">专辑：</span>
                                    <div className="flex-1">
                                      <p>{currentResult.musicOrigin.album.name}</p>
                                      {/* 显示中文翻译 */}
                                      {originTranslations[currentResult.musicOrigin.album.name] && (
                                        <p className="text-base text-emerald-400 mt-1">{originTranslations[currentResult.musicOrigin.album.name]}</p>
                                      )}
                                      {currentResult.musicOrigin.album.releaseYear && (
                                        <p className="text-base text-gray-400 mt-1">发行年份：{currentResult.musicOrigin.album.releaseYear}</p>
                                      )}
                                      {currentResult.musicOrigin.album.label && (
                                        <p className="text-base text-gray-400 mt-1">发行方：{currentResult.musicOrigin.album.label}</p>
                                      )}
                                    </div>
                                  </div>
                                )}
                                {currentResult.musicOrigin.creators && (
                                  <div className="flex flex-col gap-2 text-base text-gray-300">
                                    {currentResult.musicOrigin.creators.composer && (
                                      <div className="flex items-center gap-2">
                                        <span className="font-medium text-green-300">作曲：</span>
                                        <span>{currentResult.musicOrigin.creators.composer}</span>
                                      </div>
                                    )}
                                    {currentResult.musicOrigin.creators.singer && (
                                      <div className="flex items-center gap-2">
                                        <span className="font-medium text-green-300">演唱：</span>
                                        <span>{currentResult.musicOrigin.creators.singer}</span>
                                      </div>
                                    )}
                                    {currentResult.musicOrigin.creators.arranger && (
                                      <div className="flex items-center gap-2">
                                        <span className="font-medium text-green-300">编曲：</span>
                                        <span>{currentResult.musicOrigin.creators.arranger}</span>
                                      </div>
                                    )}
                                    {currentResult.musicOrigin.creators.lyricist && (
                                      <div className="flex items-center gap-2">
                                        <span className="font-medium text-green-300">作词：</span>
                                        <span>{currentResult.musicOrigin.creators.lyricist}</span>
                                      </div>
                                    )}
                                  </div>
                                )}
                                {currentResult.musicOrigin.reasoning && (
                                  <div className="mt-3 p-3 bg-black/20 rounded-lg">
                                    <p className="text-base text-gray-400 mb-1">判断依据：</p>
                                    <p className="text-base text-gray-300 leading-relaxed">{currentResult.musicOrigin.reasoning}</p>
                                  </div>
                                )}
                                {currentResult.musicOrigin.uncertaintyReason && (
                                  <div className="mt-2 p-3 bg-red-500/10 rounded-lg border border-red-500/20">
                                    <p className="text-base text-red-400 mb-1">不确定原因：</p>
                                    <p className="text-base text-red-300 leading-relaxed">{currentResult.musicOrigin.uncertaintyReason}</p>
                                  </div>
                                )}
                              </div>
                            ) : (
                              <p className="text-base text-gray-200 leading-relaxed">{editedContent.albumInfo ?? ''}</p>
                            )}
                          </>
                        )}
                      </div>

                      {/* 核心模块4：乐器分析 */}
                      <div className="bg-gradient-to-br from-orange-900/50 to-amber-900/50 rounded-xl p-3 border border-orange-500/30 relative">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <span className="text-xl">🎸</span>
                            <h3 className="text-base font-bold text-white">乐器分析</h3>
                          </div>
                          <button
                            onClick={() => editingModule === 'instruments' ? cancelEdit() : startEdit('instruments')}
                            className="p-1 rounded-lg bg-white/10 hover:bg-white/20 transition-colors"
                          >
                            {editingModule === 'instruments' ? '✕' : '✏️'}
                          </button>
                        </div>

                        {editingModule === 'instruments' ? (
                          <div className="space-y-1.5 bg-black/30 rounded-lg p-2.5">
                            <div>
                              <label className="text-base text-gray-400 mb-0.5 block">主奏乐器（用逗号分隔）</label>
                              <input
                                type="text"
                                value={editedContent.instruments.primary ?? (currentResult?.instruments.primary.join(', ') ?? '')}
                                onChange={(e) => updateInstrumentsEdit('primary', e.target.value)}
                                className="w-full px-2 py-1 bg-white/10 rounded-lg border border-white/20 text-white text-base focus:outline-none focus:border-orange-500"
                              />
                            </div>
                            <div>
                              <label className="text-base text-gray-400 mb-0.5 block">伴奏乐器（用逗号分隔）</label>
                              <input
                                type="text"
                                value={editedContent.instruments.accompaniment ?? (currentResult?.instruments.accompaniment.join(', ') ?? '')}
                                onChange={(e) => updateInstrumentsEdit('accompaniment', e.target.value)}
                                className="w-full px-2 py-1 bg-white/10 rounded-lg border border-white/20 text-white text-base focus:outline-none focus:border-orange-500"
                              />
                            </div>
                            <div>
                              <label className="text-base text-gray-400 mb-0.5 block">打击乐器（用逗号分隔）</label>
                              <input
                                type="text"
                                value={editedContent.instruments.percussion ?? (currentResult?.instruments.percussion.join(', ') ?? '')}
                                onChange={(e) => updateInstrumentsEdit('percussion', e.target.value)}
                                className="w-full px-2 py-1 bg-white/10 rounded-lg border border-white/20 text-white text-base focus:outline-none focus:border-orange-500"
                              />
                            </div>
                            <div>
                              <label className="text-base text-gray-400 mb-0.5 block">电子元素</label>
                              <input
                                type="text"
                                value={editedContent.instruments.electronicElements ?? (currentResult?.instruments.electronicElements ?? '')}
                                onChange={(e) => updateInstrumentsEdit('electronicElements', e.target.value)}
                                className="w-full px-2 py-1 bg-white/10 rounded-lg border border-white/20 text-white text-base focus:outline-none focus:border-orange-500"
                              />
                            </div>
                            <div>
                              <label className="text-base text-gray-400 mb-0.5 block">音色</label>
                              <input
                                type="text"
                                value={editedContent.instruments.timbre ?? (currentResult?.instruments.timbre ?? '')}
                                onChange={(e) => updateInstrumentsEdit('timbre', e.target.value)}
                                className="w-full px-2 py-1 bg-white/10 rounded-lg border border-white/20 text-white text-base focus:outline-none focus:border-orange-500"
                              />
                            </div>
                            <div className="flex gap-2">
                              <button
                                onClick={saveEdit}
                                className="flex-1 py-1 px-2 bg-gradient-to-r from-orange-500 to-amber-500 rounded-lg font-medium hover:from-orange-600 hover:to-amber-600 transition-all text-base"
                              >
                                保存
                              </button>
                              <button
                                onClick={cancelEdit}
                                className="flex-1 py-1 px-2 bg-white/10 rounded-lg font-medium hover:bg-white/20 transition-colors text-base"
                              >
                                取消
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="space-y-1.5">
                            <div>
                              <p className="text-base text-gray-400 mb-1">主奏乐器</p>
                              <div className="flex flex-wrap gap-2">
                                {(editedContent.instruments.primary ? editedContent.instruments.primary.split(',').map(s => s.trim()) : currentResult?.instruments?.primary || []).map((inst, idx) => (
                                  <span key={idx} className="bg-orange-500/30 px-2 py-0.5 rounded-full text-base text-white border border-orange-400/30">
                                    {inst}
                                  </span>
                                ))}
                              </div>
                            </div>
                            <div>
                              <p className="text-base text-gray-400 mb-1">伴奏乐器</p>
                              <div className="flex flex-wrap gap-2">
                                {(editedContent.instruments.accompaniment ? editedContent.instruments.accompaniment.split(',').map(s => s.trim()) : currentResult?.instruments?.accompaniment || []).map((inst, idx) => (
                                  <span key={idx} className="bg-amber-500/30 px-2 py-0.5 rounded-full text-base text-white border border-amber-400/30">
                                    {inst}
                                  </span>
                                ))}
                              </div>
                            </div>
                            <div>
                              <p className="text-base text-gray-400 mb-1">打击乐器</p>
                              <div className="flex flex-wrap gap-2">
                                {(editedContent.instruments.percussion ? editedContent.instruments.percussion.split(',').map(s => s.trim()) : currentResult?.instruments?.percussion || []).map((inst, idx) => (
                                  <span key={idx} className="bg-yellow-500/30 px-2 py-0.5 rounded-full text-base text-white border border-yellow-400/30">
                                    {inst}
                                  </span>
                                ))}
                              </div>
                            </div>
                            <p className="text-base text-gray-300">音色: {editedContent.instruments.timbre ?? currentResult?.instruments.timbre}</p>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* 右侧：核心模块5 - 影视配乐建议（大卡片） */}
                    <div className="lg:col-span-2 bg-gradient-to-br from-red-900/50 via-rose-900/50 to-pink-900/50 rounded-xl p-3 border border-red-500/30 relative">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className="text-3xl">🎬</span>
                          <h3 className="text-base font-bold text-white">影视配乐建议</h3>
                          {(editedContent.filmMusic.suitableGenres || editedContent.filmMusic.turningPoints || editedContent.filmMusic.atmosphere || editedContent.filmMusic.emotionalGuidance || editedContent.filmMusic.characterTheme?.suitable || editedContent.filmMusic.characterTheme?.characterType || editedContent.filmMusic.characterTheme?.storyArc) && (
                            <span className="text-base bg-yellow-500/30 px-1.5 py-0.5 rounded-full text-yellow-300 border border-yellow-400/30">已编辑</span>
                          )}
                        </div>
                        <button
                          onClick={() => editingModule === 'film' ? cancelEdit() : startEdit('film')}
                          className="p-1 rounded-lg bg-white/10 hover:bg-white/20 transition-colors"
                        >
                          {editingModule === 'film' ? '✕' : '✏️'}
                        </button>
                      </div>

                      {editingModule === 'film' ? (
                        <div className="space-y-2 bg-black/30 rounded-lg p-2.5">
                          <div>
                            <label className="text-base text-gray-400 mb-0.5 block">识别的影片类型</label>
                            <SearchableSelect
                              value={editedContent.filmMusic.filmType ?? (currentResult?.filmMusic?.filmType ?? '')}
                              onChange={(value) => updateFilmMusicEdit('filmType', value)}
                              options={standardVocabulary.film}
                              placeholder="如：恐怖片、职场剧（医护题材）等"
                              allowCustom={true}
                            />
                          </div>
                          <div>
                            <label className="text-base text-gray-400 mb-0.5 block">适合的影视类型（用逗号分隔）</label>
                            <input
                              type="text"
                              value={editedContent.filmMusic.suitableGenres ? editedContent.filmMusic.suitableGenres.join(', ') : (currentResult?.filmMusic.suitableGenres?.join(', ') ?? '')}
                              onChange={(e) => updateFilmMusicEdit('suitableGenres', e.target.value)}
                              className="w-full px-3 py-2 bg-white/10 rounded-lg border border-white/20 text-white text-base focus:outline-none focus:border-red-500"
                            />
                          </div>
                          <div>
                            <label className="text-base text-gray-400 mb-1 block">情节转折点</label>
                            <textarea
                              value={editedContent.filmMusic.turningPoints ?? (currentResult?.filmMusic.turningPoints ?? '')}
                              onChange={(e) => updateFilmMusicEdit('turningPoints', e.target.value)}
                              className="w-full px-3 py-2 bg-white/10 rounded-lg border border-white/20 text-white text-base focus:outline-none focus:border-red-500 min-h-[60px]"
                              rows={2}
                            />
                          </div>
                          <div>
                            <label className="text-base text-gray-400 mb-1 block">氛围营造</label>
                            <textarea
                              value={editedContent.filmMusic.atmosphere ?? (currentResult?.filmMusic.atmosphere ?? '')}
                              onChange={(e) => updateFilmMusicEdit('atmosphere', e.target.value)}
                              className="w-full px-3 py-2 bg-white/10 rounded-lg border border-white/20 text-white text-base focus:outline-none focus:border-red-500 min-h-[60px]"
                              rows={2}
                            />
                          </div>
                          <div>
                            <label className="text-base text-gray-400 mb-1 block">情感引导能力</label>
                            <textarea
                              value={editedContent.filmMusic.emotionalGuidance ?? (currentResult?.filmMusic.emotionalGuidance ?? '')}
                              onChange={(e) => updateFilmMusicEdit('emotionalGuidance', e.target.value)}
                              className="w-full px-3 py-2 bg-white/10 rounded-lg border border-white/20 text-white text-base focus:outline-none focus:border-red-500 min-h-[60px]"
                              rows={2}
                            />
                          </div>
                          <div className="border-t border-white/10 pt-3">
                            <p className="text-base text-gray-400 mb-2">角色主题曲潜力</p>
                            <div className="grid grid-cols-1 gap-2">
                              <input
                                type="text"
                                placeholder="适用性"
                                value={editedContent.filmMusic.characterTheme?.suitable ?? (currentResult?.filmMusic.characterTheme.suitable ?? '')}
                                onChange={(e) => updateCharacterThemeEdit('suitable', e.target.value)}
                                className="w-full px-3 py-2 bg-white/10 rounded-lg border border-white/20 text-white text-base focus:outline-none focus:border-red-500"
                              />
                              <input
                                type="text"
                                placeholder="角色类型"
                                value={editedContent.filmMusic.characterTheme?.characterType ?? (currentResult?.filmMusic.characterTheme.characterType ?? '')}
                                onChange={(e) => updateCharacterThemeEdit('characterType', e.target.value)}
                                className="w-full px-3 py-2 bg-white/10 rounded-lg border border-white/20 text-white text-base focus:outline-none focus:border-red-500"
                              />
                              <textarea
                                placeholder="故事线"
                                value={editedContent.filmMusic.characterTheme?.storyArc ?? (currentResult?.filmMusic.characterTheme.storyArc ?? '')}
                                onChange={(e) => updateCharacterThemeEdit('storyArc', e.target.value)}
                                className="w-full px-3 py-2 bg-white/10 rounded-lg border border-white/20 text-white text-base focus:outline-none focus:border-red-500 min-h-[60px]"
                                rows={2}
                              />
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <button
                              onClick={saveEdit}
                              className="flex-1 py-2 px-4 bg-gradient-to-r from-red-500 to-pink-500 rounded-lg font-medium hover:from-red-600 hover:to-pink-600 transition-all text-base"
                            >
                              保存
                            </button>
                            <button
                              onClick={cancelEdit}
                              className="flex-1 py-2 px-4 bg-white/10 rounded-lg font-medium hover:bg-white/20 transition-colors text-base"
                            >
                              取消
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-4">
                          {/* 识别的影片类型 */}
                          <div>
                            <p className="text-base text-gray-400 mb-3 font-semibold">识别的影片类型</p>
                            <div className="flex items-center gap-2">
                              <span className="bg-gradient-to-r from-purple-500 to-pink-500 px-4 py-2 rounded-full text-white border border-purple-400/30 font-medium text-xl shadow-lg">
                                {currentResult?.filmMusic?.filmType || '未分类'}
                              </span>
                              {currentResult?.filmMusic?.filmType && currentResult.filmMusic.filmType !== '未分类' && (
                                <span className="text-base text-gray-400">（自动识别）</span>
                              )}
                            </div>
                          </div>

                          {/* 适合的影视类型 */}
                          <div>
                            <p className="text-base text-gray-400 mb-3 font-semibold">适合的影视类型</p>
                            <div className="flex flex-wrap gap-2">
                              {(() => {
                                const genres: any = Array.isArray(editedContent.filmMusic.suitableGenres)
                                  ? editedContent.filmMusic.suitableGenres
                                  : (currentResult?.filmMusic.suitableGenres || []);
                                return genres.map((genre: string, idx: number) => (
                                <span key={idx} className="bg-red-500/30 px-4 py-2 rounded-full text-white border border-red-400/30 font-medium">
                                  {genre}
                                </span>
                              ))})()}
                            </div>
                          </div>

                          {/* 具体场景 */}
                          <div>
                            <p className="text-base text-gray-400 mb-3 font-semibold">具体场景建议</p>
                            <div className="space-y-3">
                              {/* 将场景数据标准化为数组格式 */}
                              {(() => {
                                const scenesData: any = currentResult?.filmMusic?.scenes || [];
                                // 处理字符串格式：如果是逗号分隔的字符串，分割成数组
                                const normalizedScenes = typeof scenesData === 'string'
                                  ? scenesData.split(',').map((s: string) => s.trim()).filter((s: string) => s)
                                    .map((s: string) => ({ type: s, description: '', emotionalImpact: '', usageTips: '' }))
                                  : Array.isArray(scenesData)
                                    ? scenesData.map((scene: any) => typeof scene === 'string'
                                      ? { type: scene, description: '', emotionalImpact: '', usageTips: '' }
                                      : scene)
                                    : [];

                                return normalizedScenes.map((scene: any, idx: number) => {
                                  const sceneType = scene.type;

                                  // 检查是否为标准场景词（使用动态词库）
                                  const isStandard = standardVocabulary.scenario.includes(sceneType);

                                  // 如果是标准词，进行类型匹配检查
                                  const filmType = currentResult.filmMusic.filmType || '未分类';
                                  let isMatch = false;

                                  if (isStandard) {
                                    // 动态获取场景词的匹配规则（从数据库中的 filmTypes 字段）
                                    // 这里简化处理，暂时只检查是否在标准词库中
                                    isMatch = true; // 标准词默认匹配，后续可以根据需要实现更精确的规则
                                  }

                                  // 确定显示的场景词
                                  const displayScene = sceneType;

                                  return (
                                    <div key={idx} className={`rounded-xl p-4 border ${isStandard && isMatch ? 'bg-green-500/10 border-green-500/30' : 'bg-yellow-500/10 border-yellow-500/30'}`}>
                                      <div className="flex items-center gap-2 mb-2">
                                        <p className="text-xl font-bold text-white">{displayScene}</p>
                                        {!isStandard && <span className="text-base bg-yellow-500/20 text-yellow-300 px-2 py-1 rounded">非标准词</span>}
                                        {isStandard && !isMatch && <span className="text-base bg-red-500/20 text-red-300 px-2 py-1 rounded">类型不匹配</span>}
                                      </div>
                                      {scene.description && <p className="text-base text-gray-300 mb-2">{scene.description}</p>}
                                      {scene.emotionalImpact && <p className="text-base text-gray-400 mb-1">情感影响: {scene.emotionalImpact}</p>}
                                      {scene.usageTips && <p className="text-base text-gray-400">使用建议: {scene.usageTips}</p>}
                                    </div>
                                  );
                                });
                              })()}
                            </div>
                          </div>

                          {/* 候选新词推荐 */}
                          {currentResult?.candidateTerms && (
                            ((currentResult.candidateTerms.scenarios && currentResult.candidateTerms.scenarios.length > 0) || 
                             (currentResult.candidateTerms.dubbing && currentResult.candidateTerms.dubbing.length > 0)) && (
                              <div className="bg-gradient-to-br from-yellow-900/30 to-orange-900/30 rounded-xl p-4 border border-yellow-500/30">
                                <div className="flex items-center gap-2 mb-3">
                                  <span className="text-3xl">💡</span>
                                  <h4 className="text-base font-bold text-yellow-200">AI 发现候选新词</h4>
                                  <span className="text-base bg-yellow-500/20 text-yellow-300 px-2 py-1 rounded-full">智能扩充</span>
                                </div>
                                
                                {/* 场景词候选 */}
                                {(currentResult?.candidateTerms?.scenarios && currentResult.candidateTerms.scenarios.length > 0) && (
                                  <div className="mb-4">
                                    <p className="text-base text-gray-400 mb-2 font-semibold">场景词候选</p>
                                    <div className="space-y-2">
                                      {(currentResult.candidateTerms.scenarios || []).map((candidate, idx) => (
                                        <div key={idx} className="bg-black/30 rounded-lg p-3 border border-yellow-500/20">
                                          <div className="flex items-center gap-2 mb-2">
                                            <p className="text-base font-bold text-yellow-200">{candidate.term}</p>
                                            <span className="text-base bg-green-500/20 text-green-300 px-2 py-1 rounded">
                                              置信度: {candidate.confidence}%
                                            </span>
                                          </div>
                                          <p className="text-base text-gray-300 mb-1">
                                            <span className="text-gray-400">近义词:</span> {candidate.synonyms.join(', ')}
                                          </p>
                                          <p className="text-base text-gray-300 mb-1">
                                            <span className="text-gray-400">适配类型:</span> {candidate.filmTypes.join(', ')}
                                          </p>
                                          <p className="text-base text-gray-400">
                                            <span className="text-gray-400">推荐理由:</span> {candidate.reason}
                                          </p>
                                          <button
                                            onClick={() => handleAddCandidateTerm('scenario', candidate)}
                                            className="mt-2 px-3 py-1 bg-yellow-500/20 hover:bg-yellow-500/30 text-yellow-300 rounded text-base border border-yellow-500/30 transition-colors"
                                          >
                                            添加到词库
                                          </button>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}

                                {/* 配音建议词候选 */}
                                {(currentResult?.candidateTerms?.dubbing && currentResult.candidateTerms.dubbing.length > 0) && (
                                  <div>
                                    <p className="text-base text-gray-400 mb-2 font-semibold">配音建议词候选</p>
                                    <div className="space-y-2">
                                      {(currentResult.candidateTerms.dubbing || []).map((candidate, idx) => (
                                        <div key={idx} className="bg-black/30 rounded-lg p-3 border border-orange-500/20">
                                          <div className="flex items-center gap-2 mb-2">
                                            <p className="text-base font-bold text-orange-200">{candidate.term}</p>
                                            <span className="text-base bg-green-500/20 text-green-300 px-2 py-1 rounded">
                                              置信度: {candidate.confidence}%
                                            </span>
                                          </div>
                                          <p className="text-base text-gray-300 mb-1">
                                            <span className="text-gray-400">近义词:</span> {candidate.synonyms.join(', ')}
                                          </p>
                                          <p className="text-base text-gray-300 mb-1">
                                            <span className="text-gray-400">适配类型:</span> {candidate.filmTypes.join(', ')}
                                          </p>
                                          <p className="text-base text-gray-400">
                                            <span className="text-gray-400">推荐理由:</span> {candidate.reason}
                                          </p>
                                          <button
                                            onClick={() => handleAddCandidateTerm('dubbing', candidate)}
                                            className="mt-2 px-3 py-1 bg-orange-500/20 hover:bg-orange-500/30 text-orange-300 rounded text-base border border-orange-500/30 transition-colors"
                                          >
                                            添加到词库
                                          </button>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </div>
                            )
                          )}

                          {/* 情节转折点和角色主题 */}
                          <div className="grid md:grid-cols-2 gap-4">
                            <div className="bg-black/30 rounded-xl p-4 border border-red-500/20">
                              <p className="text-base text-gray-400 mb-2">情节转折点</p>
                              <p className="text-base text-gray-200">{editedContent.filmMusic.turningPoints ?? currentResult?.filmMusic.turningPoints}</p>
                            </div>
                            <div className="bg-black/30 rounded-xl p-4 border border-red-500/20">
                              <p className="text-base text-gray-400 mb-2">氛围营造</p>
                              <p className="text-base text-gray-200">{editedContent.filmMusic.atmosphere ?? currentResult?.filmMusic.atmosphere}</p>
                            </div>
                          </div>

                          {/* 角色主题曲 */}
                          <div className="bg-black/30 rounded-xl p-4 border border-red-500/20">
                            <p className="text-base text-gray-400 mb-3">角色主题曲潜力</p>
                            <p className="text-base text-white mb-2 font-semibold">{editedContent.filmMusic.characterTheme?.suitable ?? currentResult?.filmMusic.characterTheme?.suitable ?? ''}</p>
                            <p className="text-base text-gray-300">{editedContent.filmMusic.characterTheme?.characterType ?? currentResult?.filmMusic.characterTheme?.characterType ?? ''}</p>
                            <p className="text-base text-gray-400">{editedContent.filmMusic.characterTheme?.storyArc ?? currentResult?.filmMusic.characterTheme?.storyArc ?? ''}</p>
                          </div>

                          {/* 情感引导 */}
                          <div className="bg-black/30 rounded-xl p-4 border border-red-500/20">
                            <p className="text-base text-gray-400 mb-2">情感引导能力</p>
                            <p className="text-base text-gray-200">{editedContent.filmMusic.emotionalGuidance ?? currentResult?.filmMusic.emotionalGuidance}</p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* 详细信息折叠区 */}
                  <div className="bg-white/5 backdrop-blur-sm rounded-xl border border-white/10 overflow-hidden">
                    <button
                      onClick={() => setShowDetails(!showDetails)}
                      className="w-full px-4 py-2.5 flex items-center justify-between hover:bg-white/5 transition-colors"
                    >
                      <h3 className="text-base font-semibold flex items-center gap-2">
                        <span>📊</span>
                        详细分析信息
                      </h3>
                      <svg
                        className={`w-4 h-4 transition-transform ${showDetails ? 'rotate-180' : ''}`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>

                    {showDetails && (
                      <div className="px-4 pb-4 border-t border-white/10">
                        <div className="grid md:grid-cols-2 gap-3 mt-2">
                          {/* 音乐结构 */}
                          <div className="bg-black/20 rounded-lg p-2.5">
                            <h4 className="font-semibold mb-2 flex items-center gap-2 text-base">
                              <span>🏗️</span> 音乐结构
                            </h4>
                            <div className="space-y-1 text-base text-gray-300">
                              <p>结构: {currentResult.musicalStructure.form}</p>
                              <p>副歌: {currentResult.musicalStructure.chorus}</p>
                              <p>桥段: {currentResult.musicalStructure.bridge}</p>
                              <p>重复模式: {currentResult.musicalStructure.repeatPatterns}</p>
                            </div>
                          </div>

                          {/* 和声特征 */}
                          <div className="bg-black/20 rounded-lg p-2.5">
                            <h4 className="font-semibold mb-2 flex items-center gap-2 text-base">
                              <span>🎼</span> 和声特征
                            </h4>
                            <div className="space-y-1 text-base text-gray-300">
                              <p>调性: {currentResult.harmony.tonality}</p>
                              <p>调: {currentResult.harmony.key}</p>
                              <p>和弦: {currentResult.harmony.chordProgression}</p>
                              <p>转调: {currentResult.harmony.modulation}</p>
                            </div>
                          </div>

                          {/* 节奏特征 */}
                          <div className="bg-black/20 rounded-lg p-2.5">
                            <h4 className="font-semibold mb-2 flex items-center gap-2 text-base">
                              <span>🥁</span> 节奏特征
                            </h4>
                            <div className="space-y-1 text-base text-gray-300">
                              <p>节拍: {currentResult.rhythm.timeSignature}</p>
                              <p>节奏: {currentResult.rhythm.rhythmPattern}</p>
                              <p>律动: {currentResult.rhythm.groove}</p>
                            </div>
                          </div>

                          {/* 文化背景 */}
                          <div className="bg-black/20 rounded-lg p-2.5">
                            <h4 className="font-semibold mb-2 flex items-center gap-2 text-base">
                              <span>🌍</span> 文化背景
                            </h4>
                            <div className="space-y-1 text-base text-gray-300">
                              <p>起源: {currentResult.culturalContext.origin}</p>
                              <p>影响: {currentResult.culturalContext.influences.join(', ')}</p>
                              <p>现代诠释: {currentResult.culturalContext.modernInterpretation}</p>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* 使用说明 */}
        <div className="mt-6 bg-white/5 backdrop-blur-sm rounded-xl p-3 border border-white/10">
          <h3 className="text-base font-semibold mb-2">使用说明</h3>
          <ul className="space-y-1 text-gray-300 text-base">
            <li>• 支持上传 MP3、WAV、OGG、FLAC 等常见音频格式</li>
            <li>• 播放器支持进度拖动、音量调节、播放速度调整、快进快退</li>
            <li>• 实时音频可视化，展现音乐频谱动态</li>
            <li>• 系统提取 8 大类音频特征：BPM、频谱、能量、动态、节奏、和声、纹理等</li>
            <li>• AI 智能分析情绪维度：快乐、悲伤、紧张、浪漫、史诗强度评分</li>
            <li>• 情绪标签多选功能：支持从45个预定义标签中选择多个情绪标签</li>
            <li>• 表格预览功能：在界面中查看完整的分析结果表格</li>
            <li>• 支持导出Excel和CSV格式的分析报告</li>
            <li>• 识别音乐风格流派、子风格、风格融合和音乐时期</li>
            <li>• 分析音乐结构：主歌、副歌、桥段、重复模式</li>
            <li>• 推测调性、和弦进行、节拍类型和节奏模式</li>
            <li>• 详细乐器分析：主奏乐器、伴奏乐器、打击乐器、电子元素</li>
            <li>• 影视配乐专业建议：适合的影视类型、具体场景、情节转折点</li>
            <li>• 角色主题曲潜力评估和情感引导能力分析</li>
            <li>• 文化背景分析：起源、影响、现代诠释</li>
          </ul>
        </div>
      </div>

      {/* 表格预览组件 */}
      {showTablePreview && previewData && (
        <TablePreview
          result={previewData}
          fileName={getCurrentFile()?.file.name || '音乐分析'}
          onClose={() => setShowTablePreview(false)}
        />
      )}

      {/* 数据库管理面板 */}
      {showDatabasePanel && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-gray-900 rounded-2xl border border-white/10 w-full max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
            {/* 面板标题 */}
            <div className="flex items-center justify-between p-6 border-b border-white/10">
              <h2 className="text-3xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
                数据库管理
              </h2>
              <div className="flex items-center gap-3">
                <button
                  onClick={handleBatchUpdateScenarios}
                  className="px-4 py-2 bg-green-500/20 hover:bg-green-500/30 text-green-300 rounded-lg transition-colors text-base font-semibold border border-green-500/30"
                  title="从当前已分析的音乐文件中提取场景建议并更新到数据库"
                >
                  批量更新场景建议
                </button>
                <button
                  onClick={handleBatchUpdateFilmTypes}
                  className="px-4 py-2 bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 rounded-lg transition-colors text-base font-semibold border border-purple-500/30"
                  title="从数据库现有数据自动推断并更新影片类型"
                >
                  批量更新影片类型
                </button>
                <button
                  onClick={handleBatchTranslateAlbums}
                  className="px-4 py-2 bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 rounded-lg transition-colors text-base font-semibold border border-cyan-500/30"
                  title="使用大语言模型批量翻译外文专辑名称"
                >
                  批量翻译专辑
                </button>
                <button
                  onClick={() => setShowTermManagementPanel(true)}
                  className="px-4 py-2 bg-orange-500/20 hover:bg-orange-500/30 text-orange-300 rounded-lg transition-colors text-base font-semibold border border-orange-500/30"
                  title="词库管理：未识别统计、自动扩充、审核、查询"
                >
                  词库管理
                </button>
                <button
                  onClick={() => setShowMappingTablePanel(true)}
                  className="px-4 py-2 bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 rounded-lg transition-colors text-base font-semibold border border-blue-500/30"
                  title="映射表管理：导入导出映射表数据"
                >
                  映射表管理
                </button>
                <button
                  onClick={() => setShowDatabasePanel(false)}
                  className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* 面板内容 */}
            <div className="flex-1 overflow-y-auto p-6">
              {/* 统计概览 - 一级概览 */}
              {dbStats && (
                <div className="mb-8">
                  <h3 className="text-xl font-semibold mb-4">分类统计概览</h3>
                  {/* 总览卡片网格 */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
                    <StatOverviewCard
                      icon="😊"
                      title="情绪识别"
                      count={dbStats.emotions?.reduce((sum: number, item: any) => sum + item.count, 0) || 0}
                      categoryCount={dbStats.emotions?.length || 0}
                      color="bg-purple-500/20"
                      onClick={() => toggleCategoryExpand('emotion')}
                      isExpanded={expandedCategories.has('emotion')}
                    />
                    <StatOverviewCard
                      icon="🎬"
                      title="影视配乐"
                      count={dbStats.films?.reduce((sum: number, item: any) => sum + item.count, 0) || 0}
                      categoryCount={dbStats.films?.length || 0}
                      color="bg-blue-500/20"
                      onClick={() => toggleCategoryExpand('film')}
                      isExpanded={expandedCategories.has('film')}
                    />
                    <StatOverviewCard
                      icon="🏠"
                      title="场景建议"
                      count={dbStats.scenarios?.reduce((sum: number, item: any) => sum + item.count, 0) || 0}
                      categoryCount={dbStats.scenarios?.length || 0}
                      color="bg-green-500/20"
                      onClick={() => toggleCategoryExpand('scenario')}
                      isExpanded={expandedCategories.has('scenario')}
                    />
                    <StatOverviewCard
                      icon="🎵"
                      title="乐器分析"
                      count={dbStats.instruments?.reduce((sum: number, item: any) => sum + item.count, 0) || 0}
                      categoryCount={dbStats.instruments?.length || 0}
                      color="bg-yellow-500/20"
                      onClick={() => toggleCategoryExpand('instrument')}
                      isExpanded={expandedCategories.has('instrument')}
                    />
                    <StatOverviewCard
                      icon="🎧"
                      title="音乐风格"
                      count={dbStats.styles?.reduce((sum: number, item: any) => sum + item.count, 0) || 0}
                      categoryCount={dbStats.styles?.length || 0}
                      color="bg-pink-500/20"
                      onClick={() => toggleCategoryExpand('style')}
                      isExpanded={expandedCategories.has('style')}
                    />
                    {/* 去重音乐数量统计 */}
                    {dedupStats && (
                      <div className="bg-gradient-to-br from-orange-500/20 to-amber-500/20 rounded-xl p-4 border border-orange-500/30">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <span className="text-2xl">📊</span>
                            <h4 className="text-base font-semibold text-white">数据库概览</h4>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-sm">
                          <div
                            onClick={() => handleDbOverviewStatusClick('all')}
                            className={`bg-white/5 rounded-lg p-2 cursor-pointer hover:bg-white/10 transition-all ${
                              searchFilters.onlineStatus === 'all' ? 'ring-2 ring-white/40' : ''
                            }`}
                            title="显示所有音乐"
                          >
                            <div className="text-gray-400 text-xs">总数量</div>
                            <div className="text-lg font-bold text-white">{dedupStats.total}</div>
                          </div>
                          <div
                            onClick={() => handleDbOverviewStatusClick('online')}
                            className={`bg-white/5 rounded-lg p-2 cursor-pointer hover:bg-white/10 transition-all ${
                              searchFilters.onlineStatus === 'online' ? 'ring-2 ring-green-400/40' : ''
                            }`}
                            title="显示在线音乐"
                          >
                            <div className="text-gray-400 text-xs">在线状态</div>
                            <div className="text-lg font-bold text-green-300">{dedupStats.online}</div>
                          </div>
                          <div
                            onClick={() => handleDbOverviewStatusClick('offline')}
                            className={`bg-white/5 rounded-lg p-2 cursor-pointer hover:bg-white/10 transition-all ${
                              searchFilters.onlineStatus === 'offline' ? 'ring-2 ring-red-400/40' : ''
                            }`}
                            title="显示离线音乐"
                          >
                            <div className="text-gray-400 text-xs">离线状态</div>
                            <div className="text-lg font-bold text-red-300">{dedupStats.offline}</div>
                          </div>
                          <div
                            onClick={() => handleDbOverviewStatusClick('uploaded')}
                            className={`bg-white/5 rounded-lg p-2 cursor-pointer hover:bg-white/10 transition-all ${
                              searchFilters.onlineStatus === 'uploaded' ? 'ring-2 ring-blue-400/40' : ''
                            }`}
                            title="显示仅在云端的音乐（不在导入列表中）"
                          >
                            <div className="text-gray-400 text-xs">云端状态</div>
                            <div className="text-lg font-bold text-blue-300">{dedupStats.uploaded}</div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* 二级详情 - 图表和详细列表 */}
                  <div className="space-y-8">
                    {/* 情绪识别详情 */}
                    {expandedCategories.has('emotion') && dbStats.emotions && dbStats.emotions.length > 0 && (
                      <div>
                        <CategoryDetailCard
                          title="情绪分类详情"
                          icon="😊"
                          color="#8B5CF6"
                          data={dbStats.emotions}
                          onItemClick={(label) => handleViewCategoryDetails('emotion', label)}
                          onFilterClick={(label) => handleFilterByCategory('emotion', label)}
                          aggregateThreshold={2}
                        />
                      </div>
                    )}

                    {/* 影视配乐详情 */}
                    {expandedCategories.has('film') && dbStats.films && dbStats.films.length > 0 && (
                      <div>
                        <BarChartCard
                          title="影视类型数量对比"
                          data={dbStats.films.map((item: any) => ({
                            label: item.label,
                            value: item.count,
                            count: item.count,
                          }))}
                          color="#3B82F6"
                          onItemClick={(label) => handleViewCategoryDetails('film', label)}
                        />
                      </div>
                    )}

                    {/* 场景建议详情 */}
                    {expandedCategories.has('scenario') && dbStats.scenarios && dbStats.scenarios.length > 0 && (
                      <div>
                        <CategoryDetailCard
                          title="场景分类详情"
                          icon="🏠"
                          color="#10B981"
                          data={dbStats.scenarios}
                          onItemClick={(label) => handleViewCategoryDetails('scenario', label)}
                          onFilterClick={(label) => handleFilterByCategory('scenario', label)}
                          aggregateThreshold={2}
                        />
                      </div>
                    )}

                    {/* 乐器分析详情 */}
                    {expandedCategories.has('instrument') && dbStats.instruments && dbStats.instruments.length > 0 && (
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <BarChartCard
                          title="乐器使用频率"
                          data={dbStats.instruments.map((item: any) => ({
                            label: item.label,
                            value: item.count,
                            count: item.count,
                          }))}
                          color="#F59E0B"
                          onItemClick={(label) => handleViewCategoryDetails('instrument', label)}
                          maxVisible={20}
                        />
                        <CategoryDetailCard
                          title="乐器分类详情"
                          icon="🎵"
                          color="#F59E0B"
                          data={dbStats.instruments}
                          categoryType="instrument"
                          onItemClick={(label) => handleViewCategoryDetails('instrument', label)}
                          onFilterClick={(label) => handleFilterByCategory('instrument', label)}
                          aggregateThreshold={3}
                          maxVisible={20}
                        />
                      </div>
                    )}

                    {/* 音乐风格详情 */}
                    {expandedCategories.has('style') && dbStats.styles && dbStats.styles.length > 0 && (
                      <div>
                        {/* 风格分类规则说明 */}
                        <div className="mb-4 p-4 bg-purple-500/10 rounded-xl border border-purple-500/30">
                          <div className="flex items-start gap-2">
                            <span className="text-xl">ℹ️</span>
                            <div className="text-base text-gray-300 space-y-1">
                              <div className="font-semibold text-purple-300 mb-2">音乐风格分类规则：</div>
                              <div className="flex items-center gap-2">
                                <span className="text-blue-300 font-medium">传统音乐：</span>
                                <span className="text-gray-400">古典、流行、电子、摇滚、爵士、民谣、嘻哈、R&B、金属、新世纪、乡村、雷鬼</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-green-300 font-medium">场景氛围音乐：</span>
                                <span className="text-gray-400">氛围音乐、史诗氛围、电影氛围、励志流行等带场景/氛围描述的风格</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-gray-300 font-medium">其他：</span>
                                <span className="text-gray-400">未在标准词库中定义的风格</span>
                              </div>
                            </div>
                          </div>
                        </div>
                        <CategoryDetailCard
                          title="风格分类详情"
                          icon="🎧"
                          color="#EC4899"
                          data={dbStats.styles}
                          onItemClick={(label) => handleViewCategoryDetails('style', label)}
                          onFilterClick={(label) => handleFilterByCategory('style', label)}
                          aggregateThreshold={2}
                          categoryType="style"
                        />
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* 检索区域 */}
              <div className="mb-8">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xl font-semibold">高级检索</h3>
                  {/* 筛选栏 */}
                  <div className="flex items-center gap-4">
                    {/* 在线状态筛选 */}
                    <div className="flex items-center gap-2">
                      <span className="text-base text-gray-400">在线状态：</span>
                      <select
                        value={searchFilters.onlineStatus}
                        onChange={(e) => {
                          const value = e.target.value;
                          setSearchFilters(prev => ({
                            ...prev,
                            onlineStatus: value as 'all' | 'online' | 'uploaded' | 'offline'
                          }));
                        }}
                        className="bg-white/10 border border-white/20 rounded-lg px-3 py-1.5 text-base text-white focus:outline-none focus:border-purple-500"
                      >
                        <option value="all">全部</option>
                        <option value="online">仅在线</option>
                        <option value="uploaded">仅上传</option>
                        <option value="offline">仅未在线</option>
                      </select>
                    </div>

                    {/* 时间范围筛选 */}
                    <div className="flex items-center gap-2">
                      <span className="text-base text-gray-400">时间范围：</span>
                      <select
                        value={filterTimeRange}
                        onChange={(e) => setFilterTimeRange(e.target.value as 'all' | '7d' | '30d' | '90d')}
                        className="bg-white/10 border border-white/20 rounded-lg px-3 py-1.5 text-base text-white focus:outline-none focus:border-purple-500"
                      >
                        <option value="all">全部时间</option>
                        <option value="7d">近7天</option>
                        <option value="30d">近30天</option>
                        <option value="90d">近90天</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* 总搜索框 - 搜索所有5大类标签 */}
                <div className="mb-6 relative">
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="全局搜索：搜索情绪、影视、场景、乐器、风格的所有标签..."
                      value={globalSearchKeyword}
                      onChange={(e) => {
                        setGlobalSearchKeyword(e.target.value);
                        setShowGlobalSearchResults(e.target.value.length > 0);
                      }}
                      onKeyDown={(e) => {
                        // 按回车键确认选择第一个搜索结果
                        if (e.key === 'Enter' && globalSearchKeyword.length > 0) {
                          e.preventDefault();

                          // 合并所有5大类的标签
                          const allItems = [
                            ...(dbStats?.emotions?.map((item: any) => ({ ...item, category: 'emotion', categoryLabel: '情绪', color: 'purple' })) || []),
                            ...(dbStats?.films?.map((item: any) => ({ ...item, category: 'film', categoryLabel: '影视配乐', color: 'blue' })) || []),
                            ...(dbStats?.scenarios?.map((item: any) => ({ ...item, category: 'scenario', categoryLabel: '场景建议', color: 'green' })) || []),
                            ...(dbStats?.instruments?.map((item: any) => ({ ...item, category: 'instrument', categoryLabel: '乐器分析', color: 'yellow' })) || []),
                            ...(dbStats?.styles?.map((item: any) => ({ ...item, category: 'style', categoryLabel: '音乐风格', color: 'pink' })) || []),
                          ];

                          // 过滤匹配的标签，取第一个
                          const filteredItems = allItems.filter((item: any) =>
                            item.label.toLowerCase().includes(globalSearchKeyword.toLowerCase())
                          );

                          if (filteredItems.length > 0) {
                            const firstItem = filteredItems[0];
                            // 将标签添加到对应的筛选条件中
                            switch (firstItem.category) {
                              case 'emotion':
                                setSearchFilters(prev => ({
                                  ...prev,
                                  emotions: prev.emotions.includes(firstItem.label)
                                    ? prev.emotions.filter(v => v !== firstItem.label)
                                    : [...prev.emotions, firstItem.label]
                                }));
                                break;
                              case 'film':
                                setSearchFilters(prev => ({
                                  ...prev,
                                  films: prev.films.includes(firstItem.label)
                                    ? prev.films.filter(v => v !== firstItem.label)
                                    : [...prev.films, firstItem.label]
                                }));
                                break;
                              case 'scenario':
                                setSearchFilters(prev => ({
                                  ...prev,
                                  scenarios: prev.scenarios.includes(firstItem.label)
                                    ? prev.scenarios.filter(v => v !== firstItem.label)
                                    : [...prev.scenarios, firstItem.label]
                                }));
                                break;
                              case 'instrument':
                                setSearchFilters(prev => ({
                                  ...prev,
                                  instruments: prev.instruments.includes(firstItem.label)
                                    ? prev.instruments.filter(v => v !== firstItem.label)
                                    : [...prev.instruments, firstItem.label]
                                }));
                                break;
                              case 'style':
                                setSearchFilters(prev => ({
                                  ...prev,
                                  styles: prev.styles.includes(firstItem.label)
                                    ? prev.styles.filter(v => v !== firstItem.label)
                                    : [...prev.styles, firstItem.label]
                                }));
                                break;
                            }
                            setGlobalSearchKeyword('');
                            setShowGlobalSearchResults(false);
                          }
                        }
                      }}
                      onFocus={() => {
                        if (globalSearchKeyword.length > 0) {
                          setShowGlobalSearchResults(true);
                        }
                      }}
                      onBlur={() => {
                        // 延迟隐藏，允许点击搜索结果
                        setTimeout(() => setShowGlobalSearchResults(false), 200);
                      }}
                      className="w-full px-4 py-3 pl-11 bg-white/10 border border-white/20 rounded-xl text-white placeholder-gray-400 text-base focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 transition-all"
                    />
                    <svg className="w-5 h-5 absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                  </div>

                  {/* 全局搜索结果下拉框 */}
                  {showGlobalSearchResults && globalSearchKeyword.length > 0 && (
                    <div className="absolute top-full left-0 right-0 mt-2 z-50 bg-gray-900/95 backdrop-blur-sm rounded-xl border border-white/20 shadow-2xl max-h-96 overflow-y-auto custom-scrollbar">
                      {(() => {
                        // 合并所有5大类的标签
                        const allItems = [
                          ...(dbStats?.emotions?.map((item: any) => ({ ...item, category: 'emotion', categoryLabel: '情绪', color: 'purple' })) || []),
                          ...(dbStats?.films?.map((item: any) => ({ ...item, category: 'film', categoryLabel: '影视配乐', color: 'blue' })) || []),
                          ...(dbStats?.scenarios?.map((item: any) => ({ ...item, category: 'scenario', categoryLabel: '场景建议', color: 'green' })) || []),
                          ...(dbStats?.instruments?.map((item: any) => ({ ...item, category: 'instrument', categoryLabel: '乐器分析', color: 'yellow' })) || []),
                          ...(dbStats?.styles?.map((item: any) => ({ ...item, category: 'style', categoryLabel: '音乐风格', color: 'pink' })) || []),
                        ];

                        // 过滤匹配的标签
                        const filteredItems = allItems.filter((item: any) =>
                          item.label.toLowerCase().includes(globalSearchKeyword.toLowerCase())
                        );

                        if (filteredItems.length === 0) {
                          return (
                            <div className="p-4 text-center text-gray-400 text-base">
                              未找到匹配的标签
                            </div>
                          );
                        }

                        return (
                          <div className="p-2">
                            {filteredItems.slice(0, 50).map((item: any) => {
                              const isSelected = (() => {
                                switch (item.category) {
                                  case 'emotion': return searchFilters.emotions.includes(item.label);
                                  case 'film': return searchFilters.films.includes(item.label);
                                  case 'scenario': return searchFilters.scenarios.includes(item.label);
                                  case 'instrument': return searchFilters.instruments.includes(item.label);
                                  case 'style': return searchFilters.styles.includes(item.label);
                                  default: return false;
                                }
                              })();

                              const colorClass = {
                                purple: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
                                blue: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
                                green: 'bg-green-500/20 text-green-300 border-green-500/30',
                                yellow: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30',
                                pink: 'bg-pink-500/20 text-pink-300 border-pink-500/30',
                              }[item.color as 'purple' | 'blue' | 'green' | 'yellow' | 'pink'];

                              return (
                                <button
                                  key={`${item.category}-${item.label}`}
                                  onClick={() => {
                                    // 将标签添加到对应的筛选条件中
                                    switch (item.category) {
                                      case 'emotion':
                                        setSearchFilters(prev => ({
                                          ...prev,
                                          emotions: prev.emotions.includes(item.label)
                                            ? prev.emotions.filter(v => v !== item.label)
                                            : [...prev.emotions, item.label]
                                        }));
                                        break;
                                      case 'film':
                                        setSearchFilters(prev => ({
                                          ...prev,
                                          films: prev.films.includes(item.label)
                                            ? prev.films.filter(v => v !== item.label)
                                            : [...prev.films, item.label]
                                        }));
                                        break;
                                      case 'scenario':
                                        setSearchFilters(prev => ({
                                          ...prev,
                                          scenarios: prev.scenarios.includes(item.label)
                                            ? prev.scenarios.filter(v => v !== item.label)
                                            : [...prev.scenarios, item.label]
                                        }));
                                        break;
                                      case 'instrument':
                                        setSearchFilters(prev => ({
                                          ...prev,
                                          instruments: prev.instruments.includes(item.label)
                                            ? prev.instruments.filter(v => v !== item.label)
                                            : [...prev.instruments, item.label]
                                        }));
                                        break;
                                      case 'style':
                                        setSearchFilters(prev => ({
                                          ...prev,
                                          styles: prev.styles.includes(item.label)
                                            ? prev.styles.filter(v => v !== item.label)
                                            : [...prev.styles, item.label]
                                        }));
                                        break;
                                    }
                                    setShowGlobalSearchResults(false);
                                  }}
                                  className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-base transition-all hover:bg-white/10 ${isSelected ? 'ring-2 ring-white/30' : ''}`}
                                >
                                  <div className="flex items-center gap-2">
                                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${colorClass}`}>
                                      {item.categoryLabel}
                                    </span>
                                    <span className="text-gray-200">{item.label}</span>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <span className="text-gray-400 text-sm">{item.count}</span>
                                    {isSelected && (
                                      <svg className="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                      </svg>
                                    )}
                                  </div>
                                </button>
                              );
                            })}
                            {filteredItems.length > 50 && (
                              <div className="px-3 py-2 text-center text-gray-400 text-sm">
                                显示前 50 条，共 {filteredItems.length} 条结果
                              </div>
                            )}
                          </div>
                        );
                      })()}
                    </div>
                  )}
                </div>

                {/* 已选条件标签展示 */}
                {(
                  searchFilters.emotions.length > 0 ||
                  searchFilters.films.length > 0 ||
                  searchFilters.scenarios.length > 0 ||
                  searchFilters.instruments.length > 0 ||
                  searchFilters.styles.length > 0 ||
                  searchFilters.onlineStatus !== 'all'
                ) && (
                  <div className="mb-6 bg-white/5 rounded-xl p-4 border border-white/10">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-base font-medium text-gray-300">已选条件</span>
                      <button
                        onClick={() => setSearchFilters({
                          emotions: [],
                          films: [],
                          scenarios: [],
                          instruments: [],
                          styles: [],
                          onlineStatus: 'all', // 恢复默认值（全部）
                        })}
                        className="text-base text-red-300 hover:text-red-200 transition-colors"
                      >
                        清空所有
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {/* 在线状态标签 */}
                      {searchFilters.onlineStatus !== 'all' && (
                        <div
                          className="flex items-center gap-2 px-3 py-1.5 bg-green-500/20 border border-green-500/30 rounded-full text-base text-green-300"
                        >
                          <span>
                            在线状态：
                            {searchFilters.onlineStatus === 'online' && '仅在线'}
                            {searchFilters.onlineStatus === 'uploaded' && '仅上传'}
                            {searchFilters.onlineStatus === 'offline' && '仅未在线'}
                          </span>
                          <button
                            onClick={() => {
                              setSearchFilters(prev => ({
                                ...prev,
                                onlineStatus: 'all', // 恢复默认值（全部）
                              }));
                            }}
                            className="hover:text-white transition-colors"
                            title="移除此条件"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </div>
                      )}
                      {searchFilters.emotions.map((value) => (
                        <div
                          key={`emotion-${value}`}
                          className="flex items-center gap-2 px-3 py-1.5 bg-purple-500/20 border border-purple-500/30 rounded-full text-base text-purple-300"
                        >
                          <span>情绪：{value}</span>
                          <button
                            onClick={() => {
                              setSearchFilters(prev => ({
                                ...prev,
                                emotions: prev.emotions.filter(v => v !== value)
                              }));
                            }}
                            className="hover:text-white transition-colors"
                            title="移除此条件"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </div>
                      ))}
                      {searchFilters.films.map((value) => (
                        <div
                          key={`film-${value}`}
                          className="flex items-center gap-2 px-3 py-1.5 bg-blue-500/20 border border-blue-500/30 rounded-full text-base text-blue-300"
                        >
                          <span>影视配乐：{value}</span>
                          <button
                            onClick={() => {
                              setSearchFilters(prev => ({
                                ...prev,
                                films: prev.films.filter(v => v !== value)
                              }));
                            }}
                            className="hover:text-white transition-colors"
                            title="移除此条件"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </div>
                      ))}
                      {searchFilters.scenarios.map((value) => (
                        <div
                          key={`scenario-${value}`}
                          className="flex items-center gap-2 px-3 py-1.5 bg-green-500/20 border border-green-500/30 rounded-full text-base text-green-300"
                        >
                          <span>场景：{value}</span>
                          <button
                            onClick={() => {
                              setSearchFilters(prev => ({
                                ...prev,
                                scenarios: prev.scenarios.filter(v => v !== value)
                              }));
                            }}
                            className="hover:text-white transition-colors"
                            title="移除此条件"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </div>
                      ))}
                      {searchFilters.instruments.map((value) => (
                        <div
                          key={`instrument-${value}`}
                          className="flex items-center gap-2 px-3 py-1.5 bg-yellow-500/20 border border-yellow-500/30 rounded-full text-base text-yellow-300"
                        >
                          <span>乐器：{value}</span>
                          <button
                            onClick={() => {
                              setSearchFilters(prev => ({
                                ...prev,
                                instruments: prev.instruments.filter(v => v !== value)
                              }));
                            }}
                            className="hover:text-white transition-colors"
                            title="移除此条件"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </div>
                      ))}
                      {searchFilters.styles.map((value) => (
                        <div
                          key={`style-${value}`}
                          className="flex items-center gap-2 px-3 py-1.5 bg-pink-500/20 border border-pink-500/30 rounded-full text-base text-pink-300"
                        >
                          <span>风格：{value}</span>
                          <button
                            onClick={() => {
                              setSearchFilters(prev => ({
                                ...prev,
                                styles: prev.styles.filter(v => v !== value)
                              }));
                            }}
                            className="hover:text-white transition-colors"
                            title="移除此条件"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {/* 情绪标签筛选 */}
                  <div>
                    <label className="block text-base font-medium mb-2">情绪标签</label>
                    <div className="bg-white/5 rounded-lg p-3 border border-white/10">
                      {/* 搜索框和排序选择器 */}
                      <div className="flex gap-2 mb-3">
                        <div className="relative flex-1">
                          <input
                            type="text"
                            placeholder="搜索情绪标签..."
                            value={emotionSearchKeyword}
                            onChange={(e) => setEmotionSearchKeyword(e.target.value)}
                            className="w-full px-3 py-2 pl-9 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 text-base focus:outline-none focus:border-purple-500 transition-colors"
                          />
                          <svg className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                          </svg>
                        </div>
                        <select
                          value={emotionSortOrder}
                          onChange={(e) => setEmotionSortOrder(e.target.value as 'default' | 'english' | 'radical')}
                          className="px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white text-base focus:outline-none focus:border-purple-500 transition-colors"
                        >
                          <option value="default">默认</option>
                          <option value="english">英文排序</option>
                          <option value="radical">部首排序</option>
                        </select>
                      </div>
                      {/* 标签列表 - 可滚动 */}
                      <div className="flex flex-wrap gap-2 max-h-40 overflow-y-auto pr-1 custom-scrollbar">
                        {sortItems(
                          dbStats?.emotions?.filter((stat: any) => stat.label.toLowerCase().includes(emotionSearchKeyword.toLowerCase())) || [],
                          emotionSortOrder
                        ).map((stat: any) => (
                            <button
                              key={stat.label}
                              onClick={() => {
                                setSearchFilters(prev => ({
                                  ...prev,
                                  emotions: prev.emotions.includes(stat.label)
                                    ? prev.emotions.filter(v => v !== stat.label)
                                    : [...prev.emotions, stat.label]
                                }));
                              }}
                              className={`px-3 py-1.5 rounded-lg text-base transition-all ${
                                searchFilters.emotions.includes(stat.label)
                                  ? 'bg-purple-500 text-white border-2 border-purple-400'
                                  : 'bg-white/5 hover:bg-white/10 text-gray-300 border border-white/10'
                              }`}
                            >
                              {stat.label}
                              <span className="ml-1 text-base text-gray-400">({stat.count})</span>
                            </button>
                          ))}
                      </div>
                    </div>
                  </div>

                  {/* 影视配乐筛选 */}
                  <div>
                    <label className="block text-base font-medium mb-2">影视配乐</label>
                    <div className="bg-white/5 rounded-lg p-3 border border-white/10">
                      {/* 搜索框和排序选择器 */}
                      <div className="flex gap-2 mb-3">
                        <div className="relative flex-1">
                          <input
                            type="text"
                            placeholder="搜索影视类型..."
                            value={filmSearchKeyword}
                            onChange={(e) => setFilmSearchKeyword(e.target.value)}
                            className="w-full px-3 py-2 pl-9 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 text-base focus:outline-none focus:border-purple-500 transition-colors"
                          />
                          <svg className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                          </svg>
                        </div>
                        <select
                          value={filmSortOrder}
                          onChange={(e) => setFilmSortOrder(e.target.value as 'default' | 'english' | 'radical')}
                          className="px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white text-base focus:outline-none focus:border-purple-500 transition-colors"
                        >
                          <option value="default">默认</option>
                          <option value="english">英文排序</option>
                          <option value="radical">部首排序</option>
                        </select>
                      </div>
                      {/* 标签列表 - 可滚动 */}
                      <div className="flex flex-wrap gap-2 max-h-40 overflow-y-auto pr-1 custom-scrollbar">
                        {sortItems(
                          dbStats?.films?.filter((stat: any) => stat.label.toLowerCase().includes(filmSearchKeyword.toLowerCase())) || [],
                          filmSortOrder
                        ).map((stat: any) => (
                            <button
                              key={stat.label}
                              onClick={() => {
                                setSearchFilters(prev => ({
                                  ...prev,
                                  films: prev.films.includes(stat.label)
                                    ? prev.films.filter(v => v !== stat.label)
                                    : [...prev.films, stat.label]
                                }));
                              }}
                              className={`px-3 py-1.5 rounded-lg text-base transition-all ${
                                searchFilters.films.includes(stat.label)
                                  ? 'bg-blue-500 text-white border-2 border-blue-400'
                                  : 'bg-white/5 hover:bg-white/10 text-gray-300 border border-white/10'
                              }`}
                            >
                              {stat.label}
                              <span className="ml-1 text-base text-gray-400">({stat.count})</span>
                            </button>
                          ))}
                      </div>
                    </div>
                  </div>

                  {/* 场景建议筛选 */}
                  <div>
                    <label className="block text-base font-medium mb-2">场景建议</label>
                    <div className="bg-white/5 rounded-lg p-3 border border-white/10">
                      {/* 搜索框和排序选择器 */}
                      <div className="flex gap-2 mb-3">
                        <div className="relative flex-1">
                          <input
                            type="text"
                            placeholder="搜索场景标签..."
                            value={scenarioSearchKeyword}
                            onChange={(e) => setScenarioSearchKeyword(e.target.value)}
                            className="w-full px-3 py-2 pl-9 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 text-base focus:outline-none focus:border-purple-500 transition-colors"
                          />
                          <svg className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                          </svg>
                        </div>
                        <select
                          value={scenarioSortOrder}
                          onChange={(e) => setScenarioSortOrder(e.target.value as 'default' | 'english' | 'radical')}
                          className="px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white text-base focus:outline-none focus:border-purple-500 transition-colors"
                        >
                          <option value="default">默认</option>
                          <option value="english">英文排序</option>
                          <option value="radical">部首排序</option>
                        </select>
                      </div>
                      {/* 标签列表 - 可滚动 */}
                      <div className="flex flex-wrap gap-2 max-h-40 overflow-y-auto pr-1 custom-scrollbar">
                        {sortItems(
                          dbStats?.scenarios?.filter((stat: any) => stat.label.toLowerCase().includes(scenarioSearchKeyword.toLowerCase())) || [],
                          scenarioSortOrder
                        ).map((stat: any) => (
                            <button
                              key={stat.label}
                              onClick={() => {
                                setSearchFilters(prev => ({
                                  ...prev,
                                  scenarios: prev.scenarios.includes(stat.label)
                                    ? prev.scenarios.filter(v => v !== stat.label)
                                    : [...prev.scenarios, stat.label]
                                }));
                              }}
                              className={`px-3 py-1.5 rounded-lg text-base transition-all ${
                                searchFilters.scenarios.includes(stat.label)
                                  ? 'bg-green-500 text-white border-2 border-green-400'
                                  : 'bg-white/5 hover:bg-white/10 text-gray-300 border border-white/10'
                              }`}
                            >
                              {stat.label}
                              <span className="ml-1 text-base text-gray-400">({stat.count})</span>
                            </button>
                          ))}
                      </div>
                    </div>
                  </div>

                  {/* 乐器分析筛选 */}
                  <div>
                    <label className="block text-base font-medium mb-2">乐器分析</label>
                    <div className="bg-white/5 rounded-lg p-3 border border-white/10">
                      {/* 搜索框和排序选择器 */}
                      <div className="flex gap-2 mb-3">
                        <div className="relative flex-1">
                          <input
                            type="text"
                            placeholder="搜索乐器标签..."
                            value={instrumentSearchKeyword}
                            onChange={(e) => setInstrumentSearchKeyword(e.target.value)}
                            className="w-full px-3 py-2 pl-9 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 text-base focus:outline-none focus:border-purple-500 transition-colors"
                          />
                          <svg className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                          </svg>
                        </div>
                        <select
                          value={instrumentSortOrder}
                          onChange={(e) => setInstrumentSortOrder(e.target.value as 'default' | 'english' | 'radical')}
                          className="px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white text-base focus:outline-none focus:border-purple-500 transition-colors"
                        >
                          <option value="default">默认</option>
                          <option value="english">英文排序</option>
                          <option value="radical">部首排序</option>
                        </select>
                      </div>
                      {/* 标签列表 - 可滚动 */}
                      <div className="flex flex-wrap gap-2 max-h-40 overflow-y-auto pr-1 custom-scrollbar">
                        {sortItems(
                          dbStats?.instruments?.filter((stat: any) => stat.label.toLowerCase().includes(instrumentSearchKeyword.toLowerCase())) || [],
                          instrumentSortOrder
                        ).map((stat: any) => (
                            <button
                              key={stat.label}
                              onClick={() => {
                                setSearchFilters(prev => ({
                                  ...prev,
                                  instruments: prev.instruments.includes(stat.label)
                                    ? prev.instruments.filter(v => v !== stat.label)
                                    : [...prev.instruments, stat.label]
                                }));
                              }}
                              className={`px-3 py-1.5 rounded-lg text-base transition-all ${
                                searchFilters.instruments.includes(stat.label)
                                  ? 'bg-yellow-500 text-white border-2 border-yellow-400'
                                  : 'bg-white/5 hover:bg-white/10 text-gray-300 border border-white/10'
                              }`}
                            >
                              {stat.label}
                              <span className="ml-1 text-base text-gray-400">({stat.count})</span>
                            </button>
                          ))}
                      </div>
                    </div>
                  </div>

                  {/* 音乐风格筛选 */}
                  <div>
                    <label className="block text-base font-medium mb-2">音乐风格</label>
                    <div className="space-y-3">
                      {/* 搜索框和排序选择器 */}
                      <div className="flex gap-2 mb-3">
                        <div className="relative flex-1">
                          <input
                            type="text"
                            placeholder="搜索音乐风格..."
                            value={styleSearchKeyword}
                            onChange={(e) => setStyleSearchKeyword(e.target.value)}
                            className="w-full px-3 py-2 pl-9 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 text-base focus:outline-none focus:border-purple-500 transition-colors"
                          />
                          <svg className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                          </svg>
                        </div>
                        <select
                          value={styleSortOrder}
                          onChange={(e) => setStyleSortOrder(e.target.value as 'default' | 'english' | 'radical')}
                          className="px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white text-base focus:outline-none focus:border-purple-500 transition-colors"
                        >
                          <option value="default">默认</option>
                          <option value="english">英文排序</option>
                          <option value="radical">部首排序</option>
                        </select>
                      </div>
                      {/* 分类和子标签 */}
                      {dbStats?.styles?.map((styleCategory: any) => {
                        // 过滤后的子分类
                        const filteredDetails = styleCategory.details?.filter((detail: any) =>
                          detail.label.toLowerCase().includes(styleSearchKeyword.toLowerCase()) ||
                          styleCategory.label.toLowerCase().includes(styleSearchKeyword.toLowerCase())
                        );

                        // 如果搜索关键词不为空且没有匹配的子分类，则不显示该大类
                        if (styleSearchKeyword && (!filteredDetails || filteredDetails.length === 0)) {
                          return null;
                        }

                        return (
                          <div key={styleCategory.label} className="bg-white/5 rounded-lg p-3 border border-white/10">
                            <button
                              onClick={() => {
                                setExpandedStyleCategories(prev => {
                                  const newSet = new Set(prev);
                                  if (newSet.has(styleCategory.label)) {
                                    newSet.delete(styleCategory.label);
                                  } else {
                                    newSet.add(styleCategory.label);
                                  }
                                  return newSet;
                                });
                              }}
                              className="w-full flex items-center justify-between"
                            >
                              <span className="text-base font-medium text-white">{styleCategory.label}</span>
                              <div className="flex items-center gap-2">
                                <span className="text-base text-gray-400">{styleCategory.count} 首</span>
                                <svg
                                  className={`w-4 h-4 text-gray-400 transition-transform ${expandedStyleCategories.has(styleCategory.label) ? 'rotate-90' : ''}`}
                                  fill="none"
                                  stroke="currentColor"
                                  viewBox="0 0 24 24"
                                >
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                </svg>
                              </div>
                            </button>
                            {expandedStyleCategories.has(styleCategory.label) && styleCategory.details && (
                              <div className="mt-3 flex flex-wrap gap-2 max-h-40 overflow-y-auto pr-1 custom-scrollbar">
                                {sortItems(filteredDetails || styleCategory.details, styleSortOrder).map((detail: any) => (
                                  <button
                                    key={detail.label}
                                    onClick={() => {
                                      setSearchFilters(prev => ({
                                        ...prev,
                                        styles: prev.styles.includes(detail.label)
                                          ? prev.styles.filter(v => v !== detail.label)
                                          : [...prev.styles, detail.label]
                                      }));
                                    }}
                                    className={`px-3 py-1.5 rounded-lg text-base transition-all ${
                                      searchFilters.styles.includes(detail.label)
                                        ? 'bg-pink-500 text-white border-2 border-pink-400'
                                        : 'bg-white/5 hover:bg-white/10 text-gray-300 border border-white/10'
                                    }`}
                                  >
                                    {detail.label}
                                    <span className="ml-1 text-base text-gray-400">({detail.count})</span>
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* 操作按钮 */}
                  <div className="md:col-span-2 lg:col-span-3 flex items-end gap-2 mt-4">
                    <button
                      onClick={() => searchDatabase(true)}
                      className="flex-1 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white font-semibold py-3 px-6 rounded-lg transition-all"
                    >
                      确认搜索
                    </button>
                    <button
                      onClick={() => setSearchFilters({
                        emotions: [],
                        films: [],
                        scenarios: [],
                        instruments: [],
                        styles: [],
                        onlineStatus: 'all', // 恢复默认值（全部）
                      })}
                      className="bg-white/10 hover:bg-white/20 text-white font-semibold py-3 px-6 rounded-lg transition-all"
                      title="清空所有条件"
                    >
                      清空
                    </button>
                  </div>
                </div>
              </div>

              {/* 搜索结果工具栏 */}
              {dbSearchResults.length > 0 && (
                <div className="mb-6 space-y-4">
                  {/* 搜索和排序工具栏 */}
                  <div className="flex flex-col md:flex-row gap-4">
                    {/* 快速搜索框 */}
                    <div className="flex-1">
                      <div className="relative">
                        <input
                          type="text"
                          placeholder="搜索音乐名称或ID..."
                          value={searchQuery}
                          onChange={(e) => {
                            setSearchQuery(e.target.value);
                            // 防抖自动搜索：用户停止输入 500 毫秒后自动触发搜索
                            if (debouncedSearchRef.current) {
                              debouncedSearchRef.current(false); // 不自动选中第一个结果
                            }
                          }}
                          onKeyPress={(e) => e.key === 'Enter' && searchDatabase(true)}
                          className="w-full px-4 py-2 pl-10 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-purple-500 transition-colors"
                        />
                        <svg className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                      </div>
                    </div>

                    {/* 排序选择器 */}
                    <div className="flex items-center gap-2">
                      <select
                        value={`${sortBy}-${sortOrder}`}
                        onChange={(e) => {
                          const [newSortBy, newSortOrder] = e.target.value.split('-') as [typeof sortBy, typeof sortOrder];
                          setSortBy(newSortBy);
                          setSortOrder(newSortOrder);
                          searchDatabase();
                        }}
                        className="px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:border-purple-500 transition-colors"
                      >
                        <option value="createdAt-desc" className="bg-gray-800">最新入库</option>
                        <option value="createdAt-asc" className="bg-gray-800">最早入库</option>
                        <option value="fileName-asc" className="bg-gray-800">名称 A-Z</option>
                        <option value="fileName-desc" className="bg-gray-800">名称 Z-A</option>
                      </select>
                    </div>

                    {/* 每页显示条数 */}
                    <div className="flex items-center gap-2">
                      <select
                        value={itemsPerPage}
                        onChange={(e) => {
                          setItemsPerPage(parseInt(e.target.value));
                          setCurrentPage(1);
                          searchDatabase();
                        }}
                        className="px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:border-purple-500 transition-colors text-base"
                      >
                        <option value="10" className="bg-gray-800">10 条/页</option>
                        <option value="20" className="bg-gray-800">20 条/页</option>
                        <option value="50" className="bg-gray-800">50 条/页</option>
                      </select>
                    </div>

                    {/* 数据清空按钮 */}
                    <button
                      onClick={() => setShowClearConfirmDialog(true)}
                      className="px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-300 rounded-lg transition-colors text-base font-medium border border-red-500/30"
                    >
                      清空数据
                    </button>
                  </div>
                </div>
              )}

              {/* 搜索结果 */}
              {dbSearchResults.length > 0 && (
                <div>
                  {/* 搜索结果播放器 */}
                  {playQueueMode === 'search' && dbSearchResults.length > 0 && currentSearchIndex >= 0 && (
                    <div className="mb-3 px-3 py-2 bg-gradient-to-r from-purple-500/10 to-pink-500/10 backdrop-blur-sm rounded-lg border border-purple-500/20">
                      {/* 播放器头部：歌曲信息 */}
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 shrink-0">
                            {isPlaying && (
                              <div className="flex items-center gap-0.5">
                                <div className="w-0.5 h-3 bg-purple-400 rounded-full animate-pulse" style={{ animationDelay: '0ms' }} />
                                <div className="w-0.5 h-3 bg-purple-400 rounded-full animate-pulse" style={{ animationDelay: '100ms' }} />
                                <div className="w-0.5 h-3 bg-purple-400 rounded-full animate-pulse" style={{ animationDelay: '200ms' }} />
                              </div>
                            )}
                            <span className="text-xs text-gray-400">{currentSearchIndex + 1}/{dbSearchResults.length}</span>
                          </div>
                          <h4 className="font-medium text-sm text-gray-200 truncate flex-1 min-w-0">
                            {dbSearchResults[currentSearchIndex]?.metadata?.title || dbSearchResults[currentSearchIndex]?.fileName?.replace(/\.[^/.]+$/, '')}
                          </h4>
                          {/* 简单的情绪信息 */}
                          <div className="text-xs text-gray-400 truncate max-w-24 shrink-0">
                            {dbSearchResults[currentSearchIndex]?.summary || '未知情绪'}
                          </div>
                        </div>
                      </div>

                      {/* 进度条 */}
                      <div className="mb-2">
                        <input
                          type="range"
                          min="0"
                          max={duration || 0}
                          step="0.1"
                          value={currentTime}
                          onChange={handleSeek}
                          onInput={handleSeek}
                          onPointerDown={() => setIsSeeking(true)}
                          onPointerUp={() => setIsSeeking(false)}
                          onPointerLeave={() => setIsSeeking(false)}
                          className="w-full h-1.5 bg-white/20 rounded-full appearance-none cursor-pointer"
                          style={{
                            background: `linear-gradient(to right, #8B5CF6 0%, #8B5CF6 ${
                              ((currentTime / (duration || 1)) * 100).toFixed(2)
                            }%, rgba(255,255,255,0.2) ${
                              ((currentTime / (duration || 1)) * 100).toFixed(2)
                            }%, rgba(255,255,255,0.2) 100%)`,
                          }}
                        />
                        <div className="flex justify-between text-xs text-gray-400 mt-0.5">
                          <span>{formatTime(currentTime)}</span>
                          <span>{formatTime(duration)}</span>
                        </div>
                      </div>

                      {/* 播放控制按钮 */}
                      <div className="flex items-center justify-center gap-3">
                        {/* 上一首 */}
                        <button
                          onClick={playPrevious}
                          className="p-1.5 rounded-md bg-white/10 hover:bg-white/20 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                          title="上一首"
                          disabled={dbSearchResults.length <= 1}
                        >
                          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M6 6h2v12H6zm3.5 6l8.5 6V6z" />
                          </svg>
                        </button>

                        {/* 播放/暂停 */}
                        <button
                          onClick={togglePlay}
                          className="w-10 h-10 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 flex items-center justify-center hover:scale-105 transition-transform shadow-lg shadow-purple-500/30"
                        >
                          {isPlaying ? (
                            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                              <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
                            </svg>
                          ) : (
                            <svg className="w-5 h-5 ml-0.5" fill="currentColor" viewBox="0 0 24 24">
                              <path d="M8 5v14l11-7z" />
                            </svg>
                          )}
                        </button>

                        {/* 停止 */}
                        <button
                          onClick={stopPlay}
                          className="p-1.5 rounded-md bg-red-500/20 hover:bg-red-500/30 text-red-400 transition-colors"
                          title="停止播放"
                        >
                          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M6 6h12v12H6z" />
                          </svg>
                        </button>

                        {/* 下一首 */}
                        <button
                          onClick={playNext}
                          className="p-1.5 rounded-md bg-white/10 hover:bg-white/20 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                          title="下一首"
                          disabled={dbSearchResults.length <= 1}
                        >
                          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  )}

                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-xl font-semibold">
                      搜索结果 ({dbPagination.total} 条)
                      {selectedRecordIds.size > 0 && (
                        <span className="ml-2 text-sm text-purple-300">
                          已选择 {selectedRecordIds.size} 首音乐
                        </span>
                      )}
                    </h3>
                    <div className="flex items-center gap-2">
                      {/* 全选/取消全选按钮 */}
                      <button
                        onClick={toggleRecordSelectAll}
                        className={`px-3 py-1.5 rounded-lg text-sm transition-colors flex items-center gap-1.5 ${
                          isAllSelected
                            ? 'bg-purple-500 hover:bg-purple-600 text-white'
                            : 'bg-white/10 hover:bg-white/20 text-gray-300'
                        }`}
                        title={isAllSelected ? '取消全选' : '全选'}
                      >
                        {isPartiallySelected ? (
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        ) : isAllSelected ? (
                          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M19 5v14H5V5h14m0-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2z" />
                            <path d="M9 10l2 2 4-4" />
                          </svg>
                        ) : (
                          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M19 3H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.11 0 2-.9 2-2V5c0-1.1-.89-2-2-2zm0 16H5V5h14v14zm-7-2h2v-4h4v-2h-4V7h-2v4H8v2h4z" />
                          </svg>
                        )}
                        {isAllSelected ? '取消全选' : '全选'}
                      </button>
                      <button
                        onClick={batchDownloadMusic}
                        disabled={isBatchDownloading}
                        className="px-4 py-2 bg-blue-500 hover:bg-blue-600 disabled:bg-blue-500/50 disabled:cursor-not-allowed text-white rounded-lg transition-colors flex items-center gap-2"
                      >
                        {isBatchDownloading ? (
                          <>
                            <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            打包中...
                          </>
                        ) : (
                          <>
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                            </svg>
                            批量打包下载
                          </>
                        )}
                      </button>
                    </div>
                  </div>

                  {/* 批量打包选项 */}
                  <div className="mb-4 p-4 bg-white/5 rounded-lg border border-white/10">
                    <div className="flex items-center gap-4">
                      <span className="text-base text-gray-400">打包方式：</span>
                      <div className="flex flex-wrap gap-2">
                        {[
                          { value: 'none', label: '全部打包' },
                          { value: 'emotion', label: '按情绪' },
                          { value: 'filmType', label: '按影片类型' },
                          { value: 'scenario', label: '按场景' },
                          { value: 'style', label: '按风格' },
                        ].map((option) => (
                          <button
                            key={option.value}
                            onClick={() => setBatchDownloadPackBy(option.value as 'emotion' | 'filmType' | 'scenario' | 'style' | 'none')}
                            className={`px-3 py-1 rounded-lg text-base transition-colors ${
                              batchDownloadPackBy === option.value
                                ? 'bg-purple-500 text-white'
                                : 'bg-white/10 hover:bg-white/20 text-gray-300'
                            }`}
                          >
                            {option.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* 按文件包归类展示（下拉菜单） - 添加垂直滚动条 */}
                  <div
                    ref={searchResultListRef}
                    className="space-y-4 max-h-[600px] overflow-y-auto search-results-scrollable"
                  >
                    {(() => {
                      const grouped = groupMusicByPackage(dbSearchResults);
                      const packageNames = Object.keys(grouped).sort((a, b) => {
                        // "未分类" 放到最后
                        if (a === '未分类') return 1;
                        if (b === '未分类') return -1;
                        return a.localeCompare(b, 'zh-CN');
                      });

                      return packageNames.map((packageName) => {
                        const packageData = grouped[packageName];
                        const packageItems = packageData.items;
                        const packageTranslated = packageData.translated;
                        const isExpanded = expandedMusicPackages.has(packageName);
                        const packageSelectionState = getPackageSelectionState(packageName, packageItems);

                        // 确定包的图标
                        let packageIcon = '📁';
                        const firstItem = packageItems[0];
                        if (firstItem?.sourceType === 'album' && firstItem?.album) {
                          packageIcon = '💿';
                        } else if (firstItem?.sourceType === 'film' && firstItem?.filmName) {
                          packageIcon = '🎬';
                        } else if (firstItem?.sourceType === 'creator') {
                          packageIcon = '👤';
                        }

                        return (
                          <div key={packageName} className="bg-white/5 rounded-xl border border-white/10 overflow-hidden">
                            {/* 音乐出处分类标题（可点击展开/收起） */}
                            <button
                              data-package-button
                              onClick={() => toggleMusicPackageExpand(packageName)}
                              className={`w-full px-4 py-3 flex items-center justify-between hover:bg-white/5 transition-colors ${
                                navigableItems.findIndex(item =>
                                  item.type === 'package' && item.packageName === packageName
                                ) === searchResultIndex ? 'bg-cyan-500/20' : ''
                              }`}
                            >
                              <div className="flex items-center gap-3">
                                {/* 专辑复选框 */}
                                <div
                                  onClick={(e) => {
                                    e.stopPropagation(); // 阻止事件冒泡
                                    togglePackageSelection(packageName, packageItems);
                                  }}
                                  className="flex items-center justify-center w-5 h-5 cursor-pointer"
                                  title={packageSelectionState === 'all' ? '取消选择专辑' : '选择专辑内所有音乐'}
                                >
                                  {packageSelectionState === 'all' ? (
                                    <div className="w-5 h-5 bg-purple-500 rounded border-2 border-purple-500 flex items-center justify-center">
                                      <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 24 24">
                                        <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" />
                                      </svg>
                                    </div>
                                  ) : packageSelectionState === 'partial' ? (
                                    <div className="w-5 h-5 bg-purple-500/50 rounded border-2 border-purple-500 flex items-center justify-center">
                                      <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 24 24">
                                        <path d="M19 3H5c-1.11 0-2 .89-2 2v14c0 1.11.89 2 2 2h14c1.11 0 2-.89 2-2V5c0-1.11-.89-2-2-2zm-2 10h-4v4h-2v-4H7v-2h4V7h2v4h4v2z" />
                                      </svg>
                                    </div>
                                  ) : (
                                    <div className="w-5 h-5 bg-transparent rounded border-2 border-gray-500 hover:border-purple-400 flex items-center justify-center" />
                                  )}
                                </div>

                                <span className="text-xl">{packageIcon}</span>
                                <div className="flex flex-col">
                                  <span className="font-semibold text-gray-200">{packageName}</span>
                                  {packageTranslated && packageTranslated !== packageName && (
                                    <span className="text-sm text-gray-400">{packageTranslated}</span>
                                  )}
                                </div>
                                <span className="text-base text-gray-400">
                                  ({packageItems.length} 首
                                  {packageSelectionState !== 'none' && (
                                    <>
                                      , <span className="text-purple-300">{packageItems.filter((item: any) => selectedRecordIds.has(item.id)).length} 已选</span>
                                    </>
                                  )}
                                  )
                                </span>
                                {/* 显示出处类型标签：只有专辑或未分类 */}
                                {packageName !== '未分类' && (
                                  <span className="text-base bg-purple-500/20 text-purple-300 px-2 py-1 rounded-full border border-purple-500/30">
                                    专辑
                                  </span>
                                )}
                              </div>
                              <div className={`transform transition-transform ${isExpanded ? 'rotate-180' : ''}`}>
                                <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                </svg>
                              </div>
                            </button>

                            {/* 包内容（音乐列表） */}
                            {isExpanded && (
                              <div className="border-t border-white/10 divide-y divide-white/5">
                                {packageItems.map((item: any, itemIndex: number) => {
                                  const globalIndex = dbSearchResults.findIndex(r => r.id === item.id);

                                  // 计算音乐项在 navigableItems 中的索引
                                  const navigableMusicIndex = (() => {
                                    let count = 0;
                                    for (const naviItem of navigableItems) {
                                      if (naviItem.type === 'music' && naviItem.item?.id === item.id) {
                                        return count;
                                      }
                                      count++;
                                    }
                                    return -1;
                                  })();

                                  // 【重要】使用后端动态计算的 musicStatus 字段
                                  // musicStatus 值：cloud（云端）、online（在线）、offline（离线）
                                  const musicStatusValue = item.musicStatus;

                                  // 根据 musicStatus 值获取显示信息
                                  const getMusicStatusDisplay = (status: string) => {
                                    switch (status) {
                                      case 'cloud':
                                        return {
                                          label: '云端',
                                          icon: '☁️',
                                          colorClass: 'text-emerald-300',
                                          bgColorClass: 'bg-emerald-500/20',
                                          isAccessible: true
                                        };
                                      case 'online':
                                        return {
                                          label: '在线',
                                          icon: '📍',
                                          colorClass: 'text-cyan-300',
                                          bgColorClass: 'bg-cyan-500/20',
                                          isAccessible: true
                                        };
                                      case 'offline':
                                        return {
                                          label: '离线',
                                          icon: '⚪',
                                          colorClass: 'text-yellow-300',
                                          bgColorClass: 'bg-yellow-500/20',
                                          isAccessible: false
                                        };
                                      default:
                                        return {
                                          label: '未知',
                                          icon: '❓',
                                          colorClass: 'text-gray-300',
                                          bgColorClass: 'bg-gray-500/20',
                                          isAccessible: false
                                        };
                                    }
                                  };

                                  const statusDisplay = getMusicStatusDisplay(musicStatusValue);

                                  const isFileUploaded = item.isUploaded === true;
                                  const isCurrentPlaying = playQueueMode === 'search' && currentSearchIndex === globalIndex && isPlaying;
                                  const isCurrentFile = playQueueMode === 'search' && currentSearchIndex === globalIndex;

                                  return (
                                    <div
                                      key={item.id}
                                      data-search-item
                                      className={`px-4 py-3 flex items-center gap-3 transition-colors cursor-pointer ${
                                        isCurrentFile
                                          ? 'bg-purple-500/10'
                                          : navigableMusicIndex === searchResultIndex
                                            ? 'bg-cyan-500/20'
                                            : 'hover:bg-white/5'
                                      }`}
                                      onClick={() => {
                                        // 点击整行播放音乐（仅当文件可访问时）
                                        if (statusDisplay.isAccessible) {
                                          playByFileName(item.fileName);
                                          setCurrentSearchIndex(globalIndex);
                                        }
                                      }}
                                    >
                                      {/* 复选框 */}
                                      <div
                                        onClick={(e) => {
                                          e.stopPropagation(); // 阻止事件冒泡
                                          toggleRecordSelection(item.id);
                                        }}
                                        className="flex items-center justify-center w-5 h-5 cursor-pointer"
                                      >
                                        {selectedRecordIds.has(item.id) ? (
                                          <div className="w-5 h-5 bg-purple-500 rounded border-2 border-purple-500 flex items-center justify-center">
                                            <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 24 24">
                                              <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" />
                                            </svg>
                                          </div>
                                        ) : (
                                          <div className="w-5 h-5 bg-transparent rounded border-2 border-gray-500 hover:border-purple-400 flex items-center justify-center" />
                                        )}
                                      </div>

                                      {/* 播放状态指示器 */}
                                      {isCurrentPlaying && (
                                        <div className="flex items-center gap-2">
                                          <div className="w-0.5 h-3 bg-purple-400 rounded-full animate-pulse" style={{ animationDelay: '0ms' }} />
                                          <div className="w-0.5 h-3 bg-purple-400 rounded-full animate-pulse" style={{ animationDelay: '100ms' }} />
                                          <div className="w-0.5 h-3 bg-purple-400 rounded-full animate-pulse" style={{ animationDelay: '200ms' }} />
                                        </div>
                                      )}

                                      {/* 歌曲序号 */}
                                      {!isCurrentPlaying && (
                                        <span className="text-base text-gray-500 w-4 text-center">
                                          {itemIndex + 1}
                                        </span>
                                      )}

                                      {/* 歌曲名称：优先显示 metadata.title，没有则显示 fileName（去扩展名） */}
                                      <div className="flex-1 min-w-0">
                                        <h5 className={`font-medium text-base truncate ${isCurrentFile ? 'text-purple-300' : 'text-gray-200'}`}>
                                          {item.metadata?.title || item.fileName?.replace(/\.[^/.]+$/, '')}
                                        </h5>
                                        {/* 简洁的音乐描述：主情绪、影视配乐类型、场景建议 */}
                                        <div className="text-base text-gray-400 mt-0.5">
                                          {(() => {
                                            // 解析数组字段
                                            const emotionTags = parseArrayField(item.emotionTags);
                                            const filmScenes = parseArrayField(item.filmScenes);
                                            const scenarios = parseArrayField(item.scenarios);
                                            const otherFeatures = parseOtherFeatures(item.otherFeatures);
                                            const originalMoodPrimary = otherFeatures.originalMoodPrimary;
                                            const primaryEmotion = item.summary || (emotionTags.length > 0 ? emotionTags[0] : '未识别');
                                            const primaryFilmScene = filmScenes.length > 0 ? filmScenes[0] : (item.filmType || '未识别');
                                            const primaryScenario = scenarios.length > 0 ? scenarios[0] : '未识别';

                                            return (
                                              <>
                                                <span>
                                                  情绪识别：
                                                  <span
                                                    className="cursor-pointer hover:text-purple-300 hover:underline transition-colors"
                                                    onClick={(e) => {
                                                      e.stopPropagation();
                                                      if (primaryEmotion !== '未识别') {
                                                        openTermHelp(primaryEmotion, 'mood');
                                                      }
                                                    }}
                                                    title="点击查看术语解释"
                                                  >
                                                    {primaryEmotion}
                                                  </span>
                                                  {originalMoodPrimary && originalMoodPrimary !== primaryEmotion ? `（${originalMoodPrimary}）` : ''}
                                                </span>
                                                <span>
                                                  ；影视配乐：
                                                  <span
                                                    className="cursor-pointer hover:text-purple-300 hover:underline transition-colors"
                                                    onClick={(e) => {
                                                      e.stopPropagation();
                                                      if (primaryFilmScene !== '未识别') {
                                                        openTermHelp(primaryFilmScene, 'filmType');
                                                      }
                                                    }}
                                                    title="点击查看术语解释"
                                                  >
                                                    {primaryFilmScene}
                                                  </span>
                                                </span>
                                                <span>
                                                  ；场景建议：
                                                  <span
                                                    className="cursor-pointer hover:text-purple-300 hover:underline transition-colors"
                                                    onClick={(e) => {
                                                      e.stopPropagation();
                                                      if (primaryScenario !== '未识别') {
                                                        openTermHelp(primaryScenario, 'scenario');
                                                      }
                                                    }}
                                                    title="点击查看术语解释"
                                                  >
                                                    {primaryScenario}
                                                  </span>
                                                </span>
                                              </>
                                            );
                                          })()}
                                        </div>
                                      </div>

                                      {/* 文件信息 */}
                                      <div className="flex items-center gap-3 text-base text-gray-400">
                                        {item.duration && (
                                          <span>{Math.floor(item.duration / 60)}:{Math.floor(item.duration % 60).toString().padStart(2, '0')}</span>
                                        )}
                                      </div>

                                      {/* 操作按钮组 */}
                                      <div className="flex items-center gap-2">
                                        {/* 反馈按钮 */}
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            openFeedbackDialog(item.id, 'correct');
                                          }}
                                          className="p-2 rounded-lg transition-colors bg-green-500/20 hover:bg-green-500/30 text-green-300"
                                          title="识别准确"
                                        >
                                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                          </svg>
                                        </button>
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            openFeedbackDialog(item.id, 'incorrect');
                                          }}
                                          className="p-2 rounded-lg transition-colors bg-red-500/20 hover:bg-red-500/30 text-red-300"
                                          title="需要修正"
                                        >
                                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                          </svg>
                                        </button>

                                        {/* 下载按钮 */}
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation(); // 阻止事件冒泡，避免触发整行点击
                                            downloadSingleMusic(item.id, item.fileName);
                                          }}
                                          disabled={!statusDisplay.isAccessible}
                                          className={`p-2 rounded-lg transition-colors ${
                                            statusDisplay.isAccessible
                                              ? 'bg-blue-500/20 hover:bg-blue-500/30 text-blue-300'
                                              : 'bg-gray-500/20 text-gray-400 cursor-not-allowed'
                                          }`}
                                          title={statusDisplay.isAccessible ? '下载' : '文件未在线'}
                                        >
                                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                          </svg>
                                        </button>
                                      </div>

                                      {/* 音乐状态 - 使用后端动态计算的 musicStatus */}
                                      <span className={`text-base ${statusDisplay.bgColorClass} ${statusDisplay.colorClass} px-2 py-1 rounded-full`}>
                                        {statusDisplay.icon} {statusDisplay.label}
                                      </span>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        );
                      });
                    })()}
                  </div>

                  {/* 分页控制 */}
                  {dbPagination.totalPages > 1 && (
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-6 pt-6 border-t border-white/10">
                      <div className="text-base text-gray-400">
                        显示 {((currentPage - 1) * itemsPerPage + 1)} - {Math.min(currentPage * itemsPerPage, dbPagination.total)} 条，共 {dbPagination.total} 条记录
                      </div>
                      <div className="flex items-center gap-2">
                        {/* 首页按钮 */}
                        <button
                          onClick={() => {
                            setCurrentPage(1);
                            searchDatabase();
                          }}
                          disabled={currentPage === 1}
                          className="px-3 py-2 bg-white/10 hover:bg-white/20 disabled:opacity-30 disabled:cursor-not-allowed rounded-lg transition-colors text-base"
                        >
                          首页
                        </button>
                        {/* 上一页按钮 */}
                        <button
                          onClick={() => {
                            setCurrentPage(currentPage - 1);
                            searchDatabase();
                          }}
                          disabled={currentPage === 1}
                          className="px-3 py-2 bg-white/10 hover:bg-white/20 disabled:opacity-30 disabled:cursor-not-allowed rounded-lg transition-colors text-base"
                        >
                          上一页
                        </button>
                        {/* 页码按钮 */}
                        <div className="flex items-center gap-2">
                          {Array.from({ length: Math.min(5, dbPagination.totalPages) }, (_, i) => {
                            let pageNum;
                            if (dbPagination.totalPages <= 5) {
                              pageNum = i + 1;
                            } else if (currentPage <= 3) {
                              pageNum = i + 1;
                            } else if (currentPage >= dbPagination.totalPages - 2) {
                              pageNum = dbPagination.totalPages - 4 + i;
                            } else {
                              pageNum = currentPage - 2 + i;
                            }

                            return (
                              <button
                                key={pageNum}
                                onClick={() => {
                                  setCurrentPage(pageNum);
                                  searchDatabase();
                                }}
                                className={`px-3 py-2 rounded-lg transition-colors text-base ${
                                  currentPage === pageNum
                                    ? 'bg-purple-500 text-white'
                                    : 'bg-white/10 hover:bg-white/20 text-gray-300'
                                }`}
                              >
                                {pageNum}
                              </button>
                            );
                          })}
                        </div>
                        {/* 下一页按钮 */}
                        <button
                          onClick={() => {
                            setCurrentPage(currentPage + 1);
                            searchDatabase();
                          }}
                          disabled={currentPage === dbPagination.totalPages}
                          className="px-3 py-2 bg-white/10 hover:bg-white/20 disabled:opacity-30 disabled:cursor-not-allowed rounded-lg transition-colors text-base"
                        >
                          下一页
                        </button>
                        {/* 尾页按钮 */}
                        <button
                          onClick={() => {
                            setCurrentPage(dbPagination.totalPages);
                            searchDatabase();
                          }}
                          disabled={currentPage === dbPagination.totalPages}
                          className="px-3 py-2 bg-white/10 hover:bg-white/20 disabled:opacity-30 disabled:cursor-not-allowed rounded-lg transition-colors text-base"
                        >
                          尾页
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* 空结果提示 */}
              {dbSearchResults.length === 0 && searchFilters && (
                <div className="text-center py-12">
                  <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-white/5 mb-4">
                    <svg className="w-8 h-8 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                  </div>
                  <h3 className="text-lg font-semibold text-gray-300 mb-2">未找到匹配的音乐</h3>
                  <p className="text-gray-500 mb-4">
                    请尝试调整搜索条件或选择其他标签
                  </p>
                  {(searchFilters.emotions.length > 0 || searchFilters.films.length > 0 || 
                    searchFilters.scenarios.length > 0 || searchFilters.instruments.length > 0 ||
                    searchFilters.styles.length > 0 || searchFilters.onlineStatus !== 'all') && (
                    <button
                      onClick={() => setSearchFilters({
                        emotions: [],
                        films: [],
                        scenarios: [],
                        instruments: [],
                        styles: [],
                        onlineStatus: 'all',
                      })}
                      className="px-4 py-2 bg-purple-500 hover:bg-purple-600 text-white rounded-lg transition-colors"
                    >
                      清空搜索条件
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 数据库清空确认对话框 */}
      {showClearConfirmDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: "rgba(0,0,0,0.8)" }}>
          <div className="bg-gray-800 rounded-2xl p-6 max-w-md w-full mx-4 border border-red-500/30 shadow-2xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-full bg-red-500/20 flex items-center justify-center">
                <svg className="w-6 h-6 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-white">确认清空数据</h3>
            </div>

            <div className="space-y-4 mb-6">
              <p className="text-gray-300">
                请选择清空模式：
              </p>
              <div className="space-y-2">
                <label className="flex items-start gap-3 p-3 rounded-lg border border-white/10 hover:bg-white/5 cursor-pointer">
                  <input
                    type="radio"
                    name="clearMode"
                    value="userOnly"
                    checked={clearMode === 'userOnly'}
                    onChange={() => setClearMode('userOnly')}
                    className="mt-1"
                  />
                  <div>
                    <div className="font-medium text-white">仅清空用户数据</div>
                    <div className="text-base text-gray-400 mt-1">
                      删除用户上传的音乐分析结果和优化样本，保留系统词库、扩充记录和统计数据
                    </div>
                  </div>
                </label>
                <label className="flex items-start gap-3 p-3 rounded-lg border border-white/10 hover:bg-white/5 cursor-pointer">
                  <input
                    type="radio"
                    name="clearMode"
                    value="all"
                    checked={clearMode === 'all'}
                    onChange={() => setClearMode('all')}
                    className="mt-1"
                  />
                  <div>
                    <div className="font-medium text-white">清空所有数据</div>
                    <div className="text-base text-gray-400 mt-1">
                      删除所有业务数据，包括音乐分析、系统词库、扩充记录、统计数据和优化样本
                    </div>
                  </div>
                </label>
              </div>

              {clearMode === 'userOnly' ? (
                <ul className="text-base text-gray-400 space-y-1 ml-4 list-disc mt-4">
                  <li>音乐分析结果（{dbPagination.total} 条）</li>
                  <li>待优化样本库</li>
                </ul>
              ) : (
                <ul className="text-base text-gray-400 space-y-1 ml-4 list-disc mt-4">
                  <li>音乐分析结果（{dbPagination.total} 条）</li>
                  <li>标准词库数据</li>
                  <li>词库扩充记录</li>
                  <li>未识别内容统计</li>
                  <li>待优化样本库</li>
                </ul>
              )}

              {clearMode === 'userOnly' && (
                <p className="text-base text-gray-400 mt-4">
                  ✓ 保留标准词库数据、词库扩充记录和未识别内容统计
                </p>
              )}

              <p className="text-base text-gray-400 mt-4">
                ⚠️ 此操作<strong className="text-red-400">不可恢复</strong>，请谨慎操作。
              </p>
              <p className="text-base text-gray-500">
                注：仅删除业务数据，不影响数据库表结构、索引等基础架构。
              </p>
              <p className="text-base text-gray-400">
                为了防止误操作，请输入确认密码：<code className="px-2 py-1 bg-gray-700 rounded text-gray-300">CLEAR</code>
              </p>
              <input
                type="password"
                placeholder="输入确认密码"
                value={clearPassword}
                onChange={(e) => {
                  setClearPassword(e.target.value);
                  setClearError('');
                }}
                className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-red-500 transition-colors"
              />
              {clearError && (
                <p className="text-red-400 text-base">{clearError}</p>
              )}
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowClearConfirmDialog(false);
                  setClearPassword('');
                  setClearError('');
                  setClearMode('userOnly');
                }}
                className="flex-1 px-4 py-3 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors font-medium"
              >
                取消
              </button>
              <button
                onClick={async () => {
                  if (clearPassword !== 'CLEAR') {
                    setClearError('密码错误，请重试');
                    return;
                  }

                  try {
                    const apiUrl = clearMode === 'userOnly' ? '/api/database/clear' : '/api/clear-all-data';
                    const method = clearMode === 'userOnly' ? 'POST' : 'DELETE';

                    const response = await fetch(apiUrl, {
                      method,
                    });
                    const data = await response.json();

                    if (data.success) {
                      const message = clearMode === 'userOnly'
                        ? `成功清空用户数据，删除 ${data.deletedData.musicAnalyses.count} 条分析结果和 ${data.deletedData.sceneOptimizationSamples.count} 条优化样本`
                        : `成功清空所有业务数据，共删除 ${data.summary.totalDeleted} 条记录`;

                      alert(message);
                      setShowClearConfirmDialog(false);
                      setClearPassword('');
                      setClearError('');
                      setClearMode('userOnly');
                      setDbSearchResults([]);
                      setDbPagination({ total: 0, page: 1, totalPages: 1 });
                      // 重新加载统计数据
                      handleOpenDatabasePanel();
                    } else {
                      setClearError(data.error || '清空失败，请重试');
                    }
                  } catch (error) {
                    console.error('Error clearing database:', error);
                    setClearError('清空失败，请检查网络连接');
                  }
                }}
                className="flex-1 px-4 py-3 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors font-medium"
              >
                确认清空（不可恢复）
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 词库管理面板 */}
      {showTermManagementPanel && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-gray-900 rounded-2xl border border-white/10 w-full max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
            {/* 面板标题 */}
            <div className="flex items-center justify-between p-6 border-b border-white/10">
              <h2 className="text-3xl font-bold bg-gradient-to-r from-orange-400 to-red-400 bg-clip-text text-transparent">
                词库管理
              </h2>
              <button
                onClick={() => setShowTermManagementPanel(false)}
                className="p-2 hover:bg-white/10 rounded-lg transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* 面板内容 */}
            <div className="flex-1 overflow-y-auto p-6">
              <TermManagementPanel />
            </div>
          </div>
        </div>
      )}

      {/* 映射表管理面板 */}
      {showMappingTablePanel && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-gray-900 rounded-2xl border border-white/10 w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
            {/* 面板标题 */}
            <div className="flex items-center justify-between p-6 border-b border-white/10">
              <h2 className="text-3xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
                映射表管理
              </h2>
              <button
                onClick={() => setShowMappingTablePanel(false)}
                className="p-2 hover:bg-white/10 rounded-lg transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* 面板内容 */}
            <div className="flex-1 overflow-y-auto p-6">
              <MappingTableManager />
            </div>
          </div>
        </div>
      )}

      {/* 云端音乐管理面板 */}
      {showCloudMusicPanel && (
        <CloudMusicPanel onClose={() => setShowCloudMusicPanel(false)} />
      )}

      {/* 访达标签映射配置面板 */}
      {showTagMappingPanel && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-gray-900 rounded-2xl border border-white/10 w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
            {/* 标题栏 */}
            <div className="p-6 border-b border-white/10 flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                  🏷️ 访达标签配置
                </h2>
                <p className="text-gray-400 text-sm mt-1">
                  将音乐情绪词汇直接作为标签添加到文件
                </p>
              </div>
              <button
                onClick={() => setShowTagMappingPanel(false)}
                className="p-2 hover:bg-white/10 rounded-lg transition-colors text-gray-400 hover:text-white"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* 内容区 */}
            <div className="flex-1 overflow-y-auto p-6">
              {/* 使用说明 */}
              <div className="mb-6 p-4 bg-gradient-to-r from-blue-500/10 to-purple-500/10 border border-blue-500/30 rounded-xl">
                <h3 className="text-lg font-semibold text-blue-300 mb-3">🎉 三种使用方式（任选一种）</h3>
                
                <div className="space-y-4">
                  {/* 方式1：双击应用 */}
                  <div className="p-3 bg-green-500/10 border border-green-500/30 rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-2xl">🖱️</span>
                      <h4 className="font-semibold text-green-300">方式1：脚本编辑器（推荐，最简单）</h4>
                      <span className="px-2 py-0.5 bg-green-500/20 text-green-300 text-xs rounded">⭐ 新功能</span>
                    </div>
                    <ol className="text-sm text-gray-300 space-y-1 list-decimal list-inside ml-8">
                      <li>点击下方"下载应用"按钮</li>
                      <li>双击下载的 .applescript 文件，会自动打开"脚本编辑器"</li>
                      <li>点击"运行"按钮（或按 ⌘R）</li>
                      <li>选择包含音乐文件的文件夹</li>
                      <li>完成！自动为所有文件添加标签</li>
                    </ol>
                  </div>

                  {/* 方式2：右键菜单 */}
                  <div className="p-3 bg-purple-500/10 border border-purple-500/30 rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-2xl">📋</span>
                      <h4 className="font-semibold text-purple-300">方式2：右键菜单（最方便）</h4>
                      <span className="px-2 py-0.5 bg-purple-500/20 text-purple-300 text-xs rounded">⭐ 新功能</span>
                    </div>
                    <ol className="text-sm text-gray-300 space-y-1 list-decimal list-inside ml-8">
                      <li>点击下方"下载服务"按钮</li>
                      <li>将文件保存到 <code className="bg-black/30 px-1.5 py-0.5 rounded">~/Library/Services/</code> 文件夹</li>
                      <li>在 Finder 中右键点击音乐文件，选择"快速操作" → "添加情绪标签"</li>
                      <li>完成！自动处理选中的文件</li>
                    </ol>
                  </div>

                  {/* 方式3：终端脚本 */}
                  <div className="p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-2xl">💻</span>
                      <h4 className="font-semibold text-blue-300">方式3：终端脚本（需要技术基础）</h4>
                    </div>
                    <ol className="text-sm text-gray-300 space-y-1 list-decimal list-inside ml-8">
                      <li>点击下方"下载 Shell 脚本"按钮</li>
                      <li>将脚本保存到音乐文件夹</li>
                      <li>在终端执行：<code className="bg-black/30 px-1.5 py-0.5 rounded">chmod +x apply_tags.sh && ./apply_tags.sh</code></li>
                      <li>完成！自动为所有文件添加标签</li>
                    </ol>
                    <p className="text-xs text-blue-300 mt-2 ml-8">⚠️ 前置要求：需要安装 tag 工具：<code className="bg-black/30 px-1.5 py-0.5 rounded">brew install tag</code></p>
                  </div>
                </div>
              </div>

              {/* 预览区域 */}
              <div className="mb-6">
                <h3 className="text-lg font-semibold text-white mb-4">预览（将自动处理所有音乐文件）</h3>
                <div className="bg-black/30 border border-white/10 rounded-xl p-4">
                  <p className="text-gray-400 text-sm mb-2">当前已分析的音乐文件：</p>
                  <p className="text-white text-base mb-3">
                    {audioFiles.length} 个文件
                  </p>
                  {audioFiles.slice(0, 5).map((file, i) => {
                    const mood = file.result?.mood?.primary || '无';

                    return (
                      <div key={i} className="flex items-center gap-2 mt-2 text-sm">
                        <span className="text-gray-300 truncate max-w-[200px]">{file.file.name}</span>
                        <span className="text-gray-400">→</span>
                        <span className="px-2 py-1 bg-purple-500/20 text-purple-300 rounded">
                          标签: {mood}
                        </span>
                      </div>
                    );
                  })}
                  {audioFiles.length > 5 && (
                    <p className="text-gray-400 text-sm mt-2">
                      ...还有 {audioFiles.length - 5} 个文件，会自动处理所有音乐文件
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* 底部操作栏 */}
            <div className="p-6 border-t border-white/10">
              <div className="flex flex-col gap-4">
                {/* 推荐应用 */}
                <div className="flex items-center justify-between p-4 bg-gradient-to-r from-green-500/10 to-emerald-500/10 border border-green-500/30 rounded-xl">
                  <div className="flex items-center gap-3">
                    <span className="text-3xl">🖱️</span>
                    <div>
                      <h4 className="font-semibold text-green-300">脚本编辑器运行（推荐）</h4>
                      <p className="text-sm text-gray-400">双击打开脚本编辑器，点击运行即可</p>
                    </div>
                  </div>
                  <button
                    onClick={downloadAppleScriptApp}
                    className="px-6 py-2.5 bg-green-500 hover:bg-green-600 text-white rounded-xl transition-all font-medium flex items-center gap-2"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                    下载应用
                  </button>
                </div>

                {/* 右键菜单服务 */}
                <div className="flex items-center justify-between p-4 bg-gradient-to-r from-purple-500/10 to-pink-500/10 border border-purple-500/30 rounded-xl">
                  <div className="flex items-center gap-3">
                    <span className="text-3xl">📋</span>
                    <div>
                      <h4 className="font-semibold text-purple-300">右键菜单服务</h4>
                      <p className="text-sm text-gray-400">在 Finder 右键菜单中直接使用</p>
                    </div>
                  </div>
                  <button
                    onClick={downloadFinderService}
                    className="px-6 py-2.5 bg-purple-500 hover:bg-purple-600 text-white rounded-xl transition-all font-medium flex items-center gap-2"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                    下载服务
                  </button>
                </div>

                {/* Shell 脚本 */}
                <div className="flex items-center justify-between p-4 bg-gradient-to-r from-blue-500/10 to-cyan-500/10 border border-blue-500/30 rounded-xl">
                  <div className="flex items-center gap-3">
                    <span className="text-3xl">💻</span>
                    <div>
                      <h4 className="font-semibold text-blue-300">Shell 脚本（高级用户）</h4>
                      <p className="text-sm text-gray-400">在终端中运行</p>
                    </div>
                  </div>
                  <button
                    onClick={downloadTagScript}
                    className="px-6 py-2.5 bg-blue-500 hover:bg-blue-600 text-white rounded-xl transition-all font-medium flex items-center gap-2"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                    下载 Shell 脚本
                  </button>
                </div>
              </div>
              
              {/* 关闭按钮 */}
              <div className="mt-4 flex justify-end">
                <button
                  onClick={() => setShowTagMappingPanel(false)}
                  className="px-6 py-2.5 bg-white/10 hover:bg-white/20 text-white rounded-xl transition-all font-medium"
                >
                  关闭
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 手动标注场景对话框 */}
      {showManualScenarioDialog && editingScenarioItem && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-gray-900 rounded-2xl border border-white/10 w-full max-w-md overflow-hidden">
            <div className="p-6 border-b border-white/10">
              <h3 className="text-xl font-bold text-white">手动标注场景</h3>
              <p className="text-base text-gray-400 mt-1">
                为音乐"{editingScenarioItem.fileName}"标注标准场景词
              </p>
            </div>
            <div className="p-6">
              <div className="space-y-4">
                <div>
                  <label className="block text-base font-medium text-gray-300 mb-2">当前场景</label>
                  <div className="bg-white/5 rounded-lg p-3 text-base text-gray-400">
                    {editingScenarioItem.scenarios.join(', ')}
                  </div>
                </div>
                <div>
                  <label className="block text-base font-medium text-gray-300 mb-2">选择标准场景词</label>
                  <select
                    value={selectedStandardScenario}
                    onChange={(e) => setSelectedStandardScenario(e.target.value)}
                    className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-purple-500 transition-colors"
                  >
                    <option value="">请选择标准场景词</option>
                    <optgroup label="核心场景词">
                      <option value="追逐">追逐</option>
                      <option value="吵架">吵架</option>
                      <option value="调查">调查</option>
                      <option value="潜入">潜入</option>
                    </optgroup>
                    <optgroup label="扩展场景词">
                      <option value="逃亡">逃亡</option>
                      <option value="对峙">对峙</option>
                      <option value="回忆闪回">回忆闪回</option>
                      <option value="埋伏">埋伏</option>
                      <option value="祭天仪式">祭天仪式</option>
                    </optgroup>
                  </select>
                </div>
              </div>
            </div>
            <div className="p-6 border-t border-white/10 flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowManualScenarioDialog(false);
                  setEditingScenarioItem(null);
                  setSelectedStandardScenario('');
                }}
                className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors"
              >
                取消
              </button>
              <button
                onClick={saveManualScenario}
                disabled={!selectedStandardScenario}
                className={`px-4 py-2 rounded-lg transition-colors ${
                  selectedStandardScenario
                    ? 'bg-purple-500 hover:bg-purple-600 text-white'
                    : 'bg-gray-500 text-gray-400 cursor-not-allowed'
                }`}
              >
                保存
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 反馈对话框 */}
      <FeedbackDialog />

      {/* 帮助面板 */}
      {showHelpPanel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: 'rgba(0, 0, 0, 0.8)' }}>
          <div className="bg-gray-900 rounded-2xl max-w-5xl w-full max-h-[90vh] overflow-hidden flex flex-col m-4">
            {/* 标题栏 */}
            <div className="p-6 border-b border-white/10 flex items-center justify-between">
              <h2 className="text-2xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
                📚 功能说明
              </h2>
              <button
                onClick={() => setShowHelpPanel(false)}
                className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                title="关闭"
              >
                <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* 内容区 */}
            <div className="flex-1 overflow-y-auto p-6">
              <div className="space-y-6">
                {HELP_DATA.categories.map((category, categoryIdx) => (
                  <div key={categoryIdx} className="bg-white/5 rounded-xl border border-white/10 overflow-hidden">
                    <h3 className="text-lg font-semibold text-white px-4 py-3 bg-gradient-to-r from-purple-500/20 to-pink-500/20 border-b border-white/10">
                      {category.title}
                    </h3>
                    <div className="p-4">
                      <div className="grid gap-3">
                        {category.items.map((item, itemIdx) => (
                          <div
                            key={itemIdx}
                            className="bg-black/20 rounded-lg p-4 border border-white/5 hover:border-purple-500/30 transition-colors"
                          >
                            <div className="flex items-start gap-3">
                              <span className="text-2xl flex-shrink-0">{item.icon}</span>
                              <div className="flex-1 min-w-0">
                                <h4 className="text-base font-semibold text-white mb-1">{item.name}</h4>
                                <p className="text-sm text-gray-400 leading-relaxed">{item.description}</p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* 底部按钮 */}
            <div className="p-6 border-t border-white/10 flex justify-end">
              <button
                onClick={() => setShowHelpPanel(false)}
                className="px-6 py-2.5 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white rounded-lg transition-colors font-medium"
              >
                知道了
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 数据分析仪表盘 */}
      {showAnalyticsDashboard && (
        <AnalyticsDashboard onClose={() => setShowAnalyticsDashboard(false)} />
      )}

      {/* 错误处理面板 */}
      {showErrorPanel && (
        <ErrorPanel onClose={() => setShowErrorPanel(false)} />
      )}

      {/* 术语帮助卡片 */}
      {showTermHelpCard && (
        <TermHelpCard
          term={currentHelpTerm}
          category={currentHelpCategory}
          onClose={() => setShowTermHelpCard(false)}
        />
      )}
    </div>
  );
}
