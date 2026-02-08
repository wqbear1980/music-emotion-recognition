import { AnalysisResult } from '@/lib/types';
import {
  CellStyle,
  TITLE_STYLE,
  getCategoryStyle,
  HEADER_STYLE,
  ROW_STYLE,
  getAltRowStyle,
  SEPARATOR_STYLE,
  SCORE_LABEL_STYLE,
  SCORE_VALUE_STYLE,
  SCORE_MAX_STYLE,
} from './tableStyles';

// 单元格接口
interface Cell {
  v: string | number;
  t?: 's' | 'n';
  s?: CellStyle;
}

// 单元格行接口
export type Row = Array<Cell>;

/**
 * 格式化音乐出处信息
 */
function formatMusicOrigin(musicOrigin: AnalysisResult['musicOrigin']): string {
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
}

/**
 * 创建带样式的单元格
 */
function createStyledCell(
  value: string | number,
  style?: CellStyle
): Cell {
  const cell: Cell = {
    v: value,
    t: typeof value === 'number' ? 'n' : 's',
  };
  if (style) {
    cell.s = style;
  }
  return cell;
}

/**
 * 创建空白单元格
 */
function createEmptyCell(): Cell {
  return createStyledCell('', SEPARATOR_STYLE);
}

/**
 * 创建分类标题行
 */
function createCategoryRow(category: keyof typeof import('./tableStyles').COLORS, title: string): Row {
  return [
    createStyledCell(title, getCategoryStyle(category)),
    createEmptyCell(),
    createEmptyCell(),
    createEmptyCell(),
  ];
}

/**
 * 创建分隔行
 */
function createSeparatorRow(): Row {
  return [
    createEmptyCell(),
    createEmptyCell(),
    createEmptyCell(),
    createEmptyCell(),
  ];
}

/**
 * 创建数据行（带交替背景）
 */
function createDataRow(
  label: string,
  value: string | number,
  note?: string,
  category?: keyof typeof import('./tableStyles').COLORS,
  labelWidth = 1
): Row {
  const baseStyle = category ? getAltRowStyle(category) : ROW_STYLE;
  const cellStyle = category ? undefined : ROW_STYLE;

  if (labelWidth === 1) {
    return [
      createStyledCell(label, baseStyle),
      createStyledCell(value, cellStyle),
      createStyledCell(note || '', ROW_STYLE),
      createStyledCell('', SEPARATOR_STYLE),
    ];
  } else {
    return [
      createStyledCell(label, baseStyle),
      createStyledCell(value, cellStyle),
      createStyledCell(note || '', ROW_STYLE),
      createStyledCell('', SEPARATOR_STYLE),
    ];
  }
}

/**
 * 创建表头行
 */
function createHeaderRow(headers: string[]): Row {
  return [
    createStyledCell(headers[0], HEADER_STYLE),
    createStyledCell(headers[1], HEADER_STYLE),
    createStyledCell(headers[2], HEADER_STYLE),
    createStyledCell(headers[3] || '', HEADER_STYLE),
  ];
}

/**
 * 生成合并后的完整表格数据
 * 将所有分析结果合并到一个表格中，并应用样式
 */
export function generateMergedTableData(result: AnalysisResult): Row[] {
  return [
    // 主标题
    [
      createStyledCell('音乐情绪识别分析报告', TITLE_STYLE),
      createStyledCell('', TITLE_STYLE),
      createStyledCell('', TITLE_STYLE),
      createStyledCell('', TITLE_STYLE),
    ],
    [
      createStyledCell('分析时间', ROW_STYLE),
      createStyledCell(new Date().toLocaleString('zh-CN'), ROW_STYLE),
      createStyledCell('', ROW_STYLE),
      createStyledCell('', SEPARATOR_STYLE),
    ],
    createSeparatorRow(),
    createSeparatorRow(),

    // 情绪识别 - 红色系
    createCategoryRow('mood', '📊 情绪识别'),
    createDataRow('主要情绪', result.mood.primary, '', 'mood'),
    createDataRow('情绪强度', result.mood.intensity, '', 'mood'),
    createDataRow('情绪轨迹', result.mood.trajectory, '', 'mood'),
    createSeparatorRow(),
    createSeparatorRow(),
    // 情绪维度评分表格
    createHeaderRow(['情绪维度', '评分', '满分', '']),
    createDataRow('快乐', result.mood.emotionalDimensions.happiness, '10分', 'mood'),
    createDataRow('悲伤', result.mood.emotionalDimensions.sadness, '10分', 'mood'),
    createDataRow('紧张', result.mood.emotionalDimensions.tension, '10分', 'mood'),
    createDataRow('浪漫', result.mood.emotionalDimensions.romance, '10分', 'mood'),
    createDataRow('史诗', result.mood.emotionalDimensions.epic, '10分', 'mood'),
    createSeparatorRow(),
    createSeparatorRow(),

    // 音乐风格 - 橙色系
    createCategoryRow('style', '🎵 音乐风格'),
    createDataRow('主要风格', result.style.primary, '', 'style'),
    createDataRow('子风格', result.style.subGenre, '', 'style'),
    createDataRow('风格融合', result.style.genreBlending, '', 'style'),
    createDataRow('音乐时期', result.style.era, '', 'style'),
    createSeparatorRow(),
    createSeparatorRow(),

    // 乐器分析 - 黄色系
    createCategoryRow('instruments', '🎸 乐器分析'),
    createDataRow('主奏乐器', result.instruments.primary.join('、'), '', 'instruments'),
    createDataRow('伴奏乐器', result.instruments.accompaniment.join('、'), '', 'instruments'),
    createDataRow('打击乐器', result.instruments.percussion.join('、'), '', 'instruments'),
    createDataRow('电子元素', result.instruments.electronicElements, '', 'instruments'),
    createDataRow('音色特点', result.instruments.timbre, '', 'instruments'),
    createSeparatorRow(),
    createSeparatorRow(),

    // 音乐结构 - 绿色系
    createCategoryRow('structure', '📝 音乐结构'),
    createDataRow('结构形式', result.musicalStructure.form, '', 'structure'),
    createDataRow('副歌', result.musicalStructure.chorus, '', 'structure'),
    createDataRow('桥段', result.musicalStructure.bridge, '', 'structure'),
    createDataRow('重复模式', result.musicalStructure.repeatPatterns, '', 'structure'),
    createSeparatorRow(),
    createSeparatorRow(),

    // 和声特征 - 青色系
    createCategoryRow('harmony', '🎼 和声特征'),
    createDataRow('调性', result.harmony.tonality, '', 'harmony'),
    createDataRow('调', result.harmony.key, '', 'harmony'),
    createDataRow('和弦进行', result.harmony.chordProgression, '', 'harmony'),
    createDataRow('转调', result.harmony.modulation, '', 'harmony'),
    createSeparatorRow(),
    createSeparatorRow(),

    // 节奏特征 - 蓝色系
    createCategoryRow('rhythm', '🥁 节奏特征'),
    createDataRow('节拍', result.rhythm.timeSignature, '', 'rhythm'),
    createDataRow('节奏模式', result.rhythm.rhythmPattern, '', 'rhythm'),
    createDataRow('律动', result.rhythm.groove, '', 'rhythm'),
    createSeparatorRow(),
    createSeparatorRow(),

    // 影视配乐建议 - 紫色系
    createCategoryRow('filmMusic', '🎬 影视配乐建议'),
    createDataRow('适合的影视类型', result.filmMusic.suitableGenres.join('、'), '', 'filmMusic'),
    createSeparatorRow(),
    createSeparatorRow(),
    createHeaderRow(['场景类型', '场景描述', '情感影响', '使用建议']),
    ...result.filmMusic.scenes.map(scene => [
      createStyledCell(scene.type, getAltRowStyle('filmMusic')),
      createStyledCell(scene.description, ROW_STYLE),
      createStyledCell(scene.emotionalImpact, ROW_STYLE),
      createStyledCell(scene.usageTips, ROW_STYLE),
    ]),
    createSeparatorRow(),
    createSeparatorRow(),
    createDataRow('情节转折点', result.filmMusic.turningPoints, '', 'filmMusic'),
    createDataRow('氛围营造', result.filmMusic.atmosphere, '', 'filmMusic'),
    createDataRow('情感引导', result.filmMusic.emotionalGuidance, '', 'filmMusic'),
    createSeparatorRow(),
    createSeparatorRow(),
    // 角色主题曲潜力
    createDataRow('角色主题曲潜力', '', '', 'filmMusic'),
    createDataRow('  适用性', result.filmMusic.characterTheme.suitable, '', 'filmMusic'),
    createDataRow('  角色类型', result.filmMusic.characterTheme.characterType, '', 'filmMusic'),
    createDataRow('  故事线', result.filmMusic.characterTheme.storyArc, '', 'filmMusic'),
    createSeparatorRow(),
    createSeparatorRow(),

    // 音乐出处 - 粉色系
    createCategoryRow('album', '💿 音乐出处'),
    createDataRow('专辑信息', formatMusicOrigin(result.musicOrigin), '', 'album'),
    createSeparatorRow(),
    createSeparatorRow(),

    // 文化背景 - 灰色系
    createCategoryRow('culture', '🌍 文化背景'),
    createDataRow('起源', result.culturalContext.origin, '', 'culture'),
    createDataRow('影响因素', result.culturalContext.influences.join('、'), '', 'culture'),
    createDataRow('现代诠释', result.culturalContext.modernInterpretation, '', 'culture'),
  ];
}

/**
 * 为表格预览生成纯文本数据（移除样式）
 */
export function generatePreviewTableData(result: AnalysisResult): string[][] {
  const styledData = generateMergedTableData(result);
  return styledData.map(row =>
    row.map(cell => {
      if (typeof cell === 'object' && 'v' in cell) {
        return String(cell.v);
      }
      return String(cell);
    })
  );
}
