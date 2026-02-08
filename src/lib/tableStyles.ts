/**
 * 表格样式配置
 * 为不同分类定义不同的颜色和样式
 */

// 颜色定义
export const COLORS = {
  // 主标题 - 深蓝色
  title: {
    bg: '2c3e50',
    font: 'FFFFFF',
  } as const,
  // 情绪识别 - 红色系
  mood: {
    bg: 'e74c3c',
    font: 'FFFFFF',
    alt: 'fadbd8',
  } as const,
  // 音乐风格 - 橙色系
  style: {
    bg: 'e67e22',
    font: 'FFFFFF',
    alt: 'fad7a0',
  } as const,
  // 乐器分析 - 黄色系
  instruments: {
    bg: 'f39c12',
    font: 'FFFFFF',
    alt: 'fdebd0',
  } as const,
  // 音乐结构 - 绿色系
  structure: {
    bg: '27ae60',
    font: 'FFFFFF',
    alt: 'd5f5e3',
  } as const,
  // 和声特征 - 青色系
  harmony: {
    bg: '16a085',
    font: 'FFFFFF',
    alt: 'd1f2eb',
  } as const,
  // 节奏特征 - 蓝色系
  rhythm: {
    bg: '2980b9',
    font: 'FFFFFF',
    alt: 'd6eaf8',
  } as const,
  // 影视配乐 - 紫色系
  filmMusic: {
    bg: '8e44ad',
    font: 'FFFFFF',
    alt: 'e8daef',
  } as const,
  // 音乐出处 - 粉色系
  album: {
    bg: 'd98880',
    font: 'FFFFFF',
    alt: 'f5e7e2',
  } as const,
  // 文化背景 - 灰色系
  culture: {
    bg: '7f8c8d',
    font: 'FFFFFF',
    alt: 'ebedef',
  } as const,
  // 表头 - 深灰色
  header: {
    bg: '34495e',
    font: 'FFFFFF',
  } as const,
  // 普通行 - 浅灰色
  row: {
    bg: 'f8f9fa',
    font: '2c3e50',
  } as const,
  // 分隔线
  separator: {
    bg: '95a5a6',
    font: 'FFFFFF',
  } as const,
} as const;

// 单元格样式接口
export interface CellStyle {
  fill?: {
    fgColor?: { rgb: string };
    patternType?: string;
  };
  font?: {
    bold?: boolean;
    color?: { rgb: string };
    sz?: number;
    name?: string;
  };
  alignment?: {
    horizontal?: 'left' | 'center' | 'right';
    vertical?: 'center' | 'top' | 'bottom';
    wrapText?: boolean;
  };
  border?: {
    top?: { style: string; color: { auto?: number; rgb?: string } };
    bottom?: { style: string; color: { auto?: number; rgb?: string } };
    left?: { style: string; color: { auto?: number; rgb?: string } };
    right?: { style: string; color: { auto?: number; rgb?: string } };
  };
}

// 基础样式
export const BASE_STYLE: CellStyle = {
  alignment: {
    horizontal: 'left',
    vertical: 'center',
    wrapText: true,
  },
  font: {
    name: '微软雅黑',
    sz: 11,
  },
};

// 标题样式
export const TITLE_STYLE: CellStyle = {
  ...BASE_STYLE,
  fill: {
    fgColor: { rgb: COLORS.title.bg },
    patternType: 'solid',
  },
  font: {
    bold: true,
    color: { rgb: COLORS.title.font },
    sz: 14,
  },
  alignment: {
    horizontal: 'center',
    vertical: 'center',
    wrapText: false,
  },
};

// 分类标题样式
export function getCategoryStyle(category: keyof typeof COLORS): CellStyle {
  const color = COLORS[category];
  return {
    ...BASE_STYLE,
    fill: {
      fgColor: { rgb: color.bg },
      patternType: 'solid',
    },
    font: {
      bold: true,
      color: { rgb: color.font },
      sz: 12,
    },
    alignment: {
      horizontal: 'center',
      vertical: 'center',
      wrapText: false,
    },
  };
}

// 表头样式
export const HEADER_STYLE: CellStyle = {
  ...BASE_STYLE,
  fill: {
    fgColor: { rgb: COLORS.header.bg },
    patternType: 'solid',
  },
  font: {
    bold: true,
    color: { rgb: COLORS.header.font },
    sz: 11,
  },
  alignment: {
    horizontal: 'center',
    vertical: 'center',
    wrapText: false,
  },
  border: {
    top: { style: 'thin', color: { auto: 1 } },
    bottom: { style: 'thin', color: { auto: 1 } },
    left: { style: 'thin', color: { auto: 1 } },
    right: { style: 'thin', color: { auto: 1 } },
  },
};

// 数据行样式
export const ROW_STYLE: CellStyle = {
  ...BASE_STYLE,
  fill: {
    fgColor: { rgb: COLORS.row.bg },
    patternType: 'solid',
  },
  font: {
    color: { rgb: COLORS.row.font },
    sz: 11,
  },
  border: {
    top: { style: 'thin', color: { rgb: 'e0e0e0' } },
    bottom: { style: 'thin', color: { rgb: 'e0e0e0' } },
    left: { style: 'thin', color: { rgb: 'e0e0e0' } },
    right: { style: 'thin', color: { rgb: 'e0e0e0' } },
  },
};

// 交替行样式（用于区分不同类别）
export function getAltRowStyle(category: keyof typeof COLORS): CellStyle {
  const color = COLORS[category];
  // 获取alt属性，如果不存在则使用默认的浅灰色
  const altColor = (color as any).alt || 'f8f9fa';

  return {
    ...BASE_STYLE,
    fill: {
      fgColor: { rgb: altColor },
      patternType: 'solid',
    },
    font: {
      color: { rgb: '2c3e50' },
      sz: 11,
    },
    border: {
      top: { style: 'thin', color: { rgb: 'e0e0e0' } },
      bottom: { style: 'thin', color: { rgb: 'e0e0e0' } },
      left: { style: 'thin', color: { rgb: 'e0e0e0' } },
      right: { style: 'thin', color: { rgb: 'e0e0e0' } },
    },
  };
}

// 分隔线样式
export const SEPARATOR_STYLE: CellStyle = {
  fill: {
    fgColor: { rgb: 'ecf0f1' },
    patternType: 'solid',
  },
};

// 分数栏样式（用于情绪维度）
export const SCORE_LABEL_STYLE: CellStyle = {
  ...BASE_STYLE,
  fill: {
    fgColor: { rgb: COLORS.mood.alt },
    patternType: 'solid',
  },
  font: {
    bold: true,
    sz: 11,
  },
  alignment: {
    horizontal: 'center',
    vertical: 'center',
    wrapText: false,
  },
  border: {
    top: { style: 'thin', color: { rgb: 'e0e0e0' } },
    bottom: { style: 'thin', color: { rgb: 'e0e0e0' } },
    left: { style: 'thin', color: { rgb: 'e0e0e0' } },
    right: { style: 'thin', color: { rgb: 'e0e0e0' } },
  },
};

export const SCORE_VALUE_STYLE: CellStyle = {
  ...BASE_STYLE,
  font: {
    bold: true,
    color: { rgb: 'e74c3c' },
    sz: 11,
  },
  alignment: {
    horizontal: 'center',
    vertical: 'center',
    wrapText: false,
  },
  border: {
    top: { style: 'thin', color: { rgb: 'e0e0e0' } },
    bottom: { style: 'thin', color: { rgb: 'e0e0e0' } },
    left: { style: 'thin', color: { rgb: 'e0e0e0' } },
    right: { style: 'thin', color: { rgb: 'e0e0e0' } },
  },
};

export const SCORE_MAX_STYLE: CellStyle = {
  ...BASE_STYLE,
  font: {
    color: { rgb: '7f8c8d' },
    sz: 10,
  },
  alignment: {
    horizontal: 'center',
    vertical: 'center',
    wrapText: false,
  },
  border: {
    top: { style: 'thin', color: { rgb: 'e0e0e0' } },
    bottom: { style: 'thin', color: { rgb: 'e0e0e0' } },
    left: { style: 'thin', color: { rgb: 'e0e0e0' } },
    right: { style: 'thin', color: { rgb: 'e0e0e0' } },
  },
};
