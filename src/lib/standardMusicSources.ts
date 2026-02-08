/**
 * 标准音乐信息库
 * 用于音乐出处识别的标准化、纠错和校验
 */

// 置信度等级
export enum ConfidenceLevel {
  HIGH = 'high', // 90%以上：音频特征与已知作品高度一致
  MEDIUM = 'medium', // 50-89%：音频特征与某作品有相似性，但无法完全确认
  LOW = 'low', // <50%：无法确定具体出处
}

// 出处类型
export enum SourceType {
  ALBUM = 'album', // 专辑
  FILM = 'film', // 影视/综艺
  CREATOR = 'creator', // 创作者
  UNKNOWN = 'unknown', // 未识别
}

// 标准专辑信息
export interface StandardAlbum {
  standardName: string; // 标准名称（唯一标识）
  aliases: string[]; // 近义词/变体列表
  artist: string; // 艺术家
  year?: number; // 发行年份
  trackCount?: number; // 曲目数量
  durationRange?: { min: number; max: number }; // 每首歌的时长范围（秒）
  publisher?: string; // 发行方
  platform?: string; // 首发平台
  description?: string; // 描述信息
}

// 标准影视信息
export interface StandardFilm {
  standardName: string; // 标准名称（唯一标识）
  aliases: string[]; // 近义词/变体列表
  type: string; // 影视类型：电视剧、电影、综艺等
  year?: number; // 上映/首播年份
  composer?: string[]; // 主要作曲家
  publisher?: string; // 制作方/发行方
  platform?: string; // 首播平台
  description?: string; // 描述信息
}

// 标准创作者信息
export interface StandardCreator {
  standardName: string; // 标准名称（唯一标识）
  aliases: string[]; // 近义词/变体列表
  role: 'composer' | 'singer' | 'arranger' | 'lyricist' | 'producer'; // 角色
  works?: string[]; // 代表作（专辑/影视）
}

// 标准发行方信息
export interface StandardPublisher {
  standardName: string; // 标准名称（唯一标识）
  aliases: string[]; // 近义词/变体列表
  type: 'record' | 'film' | 'game'; // 类型：唱片公司/影视公司/游戏公司
}

// 标准平台信息
export interface StandardPlatform {
  standardName: string; // 标准名称（唯一标识）
  aliases: string[]; // 近义词/变体列表
  type: 'music' | 'video' | 'game'; // 类型：音乐平台/视频平台/游戏平台
}

// ========== 标准专辑库 ==========
export const STANDARD_ALBUMS: StandardAlbum[] = [
  {
    standardName: '寄了一整個春天',
    aliases: [
      '寄了整个春天',
      '一整個春天',
      '一整个春天',
      '寄了一整个春天',
      '寄了個春天',
      'Spring Sent in Full',
    ],
    artist: '田馥甄',
    year: 2024,
    trackCount: 10,
    durationRange: { min: 180, max: 300 }, // 3-5分钟
    publisher: '华研国际音乐',
    platform: '腾讯音乐',
    description: '田馥甄2024年发行的专辑，包含《寄了一整個春天》等歌曲',
  },
  {
    standardName: '琅琊榜原声带',
    aliases: ['琅琊榜OST', '琅琊榜音乐专辑', '琅琊榜配乐', 'Nirvana in Fire OST'],
    artist: '孟可',
    year: 2015,
    trackCount: 20,
    durationRange: { min: 120, max: 240 },
    publisher: '正午阳光',
    platform: '腾讯音乐',
    description: '电视剧《琅琊榜》原声带',
  },
  {
    standardName: '甄嬛传原声带',
    aliases: ['甄嬛传OST', '甄嬛传音乐专辑', '甄嬛传配乐', 'Empresses in the Palace OST'],
    artist: '刘欢',
    year: 2011,
    trackCount: 15,
    durationRange: { min: 150, max: 270 },
    publisher: '华谊兄弟',
    platform: '网易云音乐',
    description: '电视剧《甄嬛传》原声带',
  },
  {
    standardName: '台北女子图鉴原声带',
    aliases: [
      '台北女子图鉴OST',
      '台北女子图鉴音乐专辑',
      '台北女子图鉴配乐',
      'Taipei Girl OST'
    ],
    artist: '多位艺术家',
    year: 2022,
    trackCount: 12,
    durationRange: { min: 180, max: 300 },
    publisher: '腾讯音乐',
    platform: '腾讯音乐',
    description: '电视剧《台北女子图鉴》原声带，包含《缩影》等歌曲',
  },
  // 可以继续添加更多标准专辑...
];

// ========== 标准影视库 ==========
export const STANDARD_FILMS: StandardFilm[] = [
  {
    standardName: '琅琊榜',
    aliases: ['Nirvana in Fire', '琅琊榜电视剧', '琅琊榜2015'],
    type: '电视剧',
    year: 2015,
    composer: ['孟可'],
    publisher: '正午阳光',
    platform: '腾讯视频',
    description: '古装权谋剧',
  },
  {
    standardName: '甄嬛传',
    aliases: ['Empresses in the Palace', '甄嬛传电视剧', '甄嬛传2011'],
    type: '电视剧',
    year: 2011,
    composer: ['刘欢'],
    publisher: '华谊兄弟',
    platform: '腾讯视频',
    description: '古装宫廷剧',
  },
  {
    standardName: '流浪地球',
    aliases: ['The Wandering Earth', '流浪地球电影', '流浪地球2019'],
    type: '电影',
    year: 2019,
    composer: ['阿鲲'],
    publisher: '中国电影股份有限公司',
    platform: 'Netflix',
    description: '科幻电影',
  },
  {
    standardName: '台北女子图鉴',
    aliases: ['Taipei Girl', '台北女子图鉴电视剧', '台北女子图鉴2022'],
    type: '电视剧',
    year: 2022,
    composer: ['多位作曲家'],
    publisher: '八大电视',
    platform: 'LINE TODAY',
    description: '都市女性职场剧',
  },
  // 可以继续添加更多标准影视...
];

// ========== 标准创作者库 ==========
export const STANDARD_CREATORS: StandardCreator[] = [
  {
    standardName: '田馥甄',
    aliases: ['Hebe', 'Hebe Tien', 'Hebe田馥甄'],
    role: 'singer',
    works: ['寄了一整個春天', '小幸运', '魔鬼中的天使'],
  },
  {
    standardName: '刘若英',
    aliases: ['Rene Liu', '刘若英', '奶茶'],
    role: 'singer',
    works: ['缩影', '后来', '为爱痴狂'],
  },
  {
    standardName: '孟可',
    aliases: ['孟可作曲'],
    role: 'composer',
    works: ['琅琊榜原声带', '人民的名义'],
  },
  {
    standardName: '刘欢',
    aliases: ['Liu Huan'],
    role: 'composer',
    works: ['甄嬛传原声带', '好汉歌'],
  },
  {
    standardName: '阿鲲',
    aliases: ['阿鲲作曲'],
    role: 'composer',
    works: ['流浪地球原声带', '舌尖上的中国'],
  },
  // 可以继续添加更多标准创作者...
];

// ========== 标准发行方库 ==========
export const STANDARD_PUBLISHERS: StandardPublisher[] = [
  {
    standardName: '华研国际音乐',
    aliases: ['HIM International Music', '华研', '华研音乐'],
    type: 'record',
  },
  {
    standardName: '正午阳光',
    aliases: ['Daylight Entertainment', '正午阳光影视'],
    type: 'film',
  },
  {
    standardName: '华谊兄弟',
    aliases: ['Huayi Brothers', '华谊'],
    type: 'film',
  },
  {
    standardName: '中国电影股份有限公司',
    aliases: ['China Film', '中影'],
    type: 'film',
  },
  {
    standardName: '滚石唱片',
    aliases: ['Rock Records', '滚石'],
    type: 'record',
  },
  // 可以继续添加更多标准发行方...
];

// ========== 标准平台库 ==========
export const STANDARD_PLATFORMS: StandardPlatform[] = [
  {
    standardName: '腾讯音乐',
    aliases: ['Tencent Music', 'QQ音乐', '酷狗音乐', '酷我音乐', '全民K歌'],
    type: 'music',
  },
  {
    standardName: '网易云音乐',
    aliases: ['NetEase Cloud Music', '网易云音乐', '网易音乐'],
    type: 'music',
  },
  {
    standardName: 'Apple Music',
    aliases: ['苹果音乐'],
    type: 'music',
  },
  {
    standardName: 'Spotify',
    aliases: ['Spotify Music'],
    type: 'music',
  },
  {
    standardName: '腾讯视频',
    aliases: ['Tencent Video', '腾讯视频平台', '腾讯影业'],
    type: 'video',
  },
  {
    standardName: '爱奇艺',
    aliases: ['iQIYI', '爱奇艺视频', '爱奇艺平台'],
    type: 'video',
  },
  {
    standardName: 'Netflix',
    aliases: ['网飞', '奈飞'],
    type: 'video',
  },
  // 可以继续添加更多标准平台...
];

// ========== 工具函数 ==========

/**
 * 标准化专辑名称
 * @param name 输入的专辑名称
 * @returns 标准化的专辑名称，如果未找到则返回null
 */
export function standardizeAlbumName(name: string | null | undefined): string | null {
  if (!name) return null;

  const cleanName = name.trim();
  
  // 检查标准专辑库
  for (const album of STANDARD_ALBUMS) {
    // 精确匹配标准名称
    if (album.standardName === cleanName) {
      return album.standardName;
    }
    // 模糊匹配近义词
    for (const alias of album.aliases) {
      if (cleanName.toLowerCase() === alias.toLowerCase()) {
        return album.standardName;
      }
    }
  }

  return null;
}

/**
 * 标准化影视名称
 * @param name 输入的影视名称
 * @returns 标准化的影视名称，如果未找到则返回null
 */
export function standardizeFilmName(name: string | null | undefined): string | null {
  if (!name) return null;

  const cleanName = name.trim();
  
  // 检查标准影视库
  for (const film of STANDARD_FILMS) {
    // 精确匹配标准名称
    if (film.standardName === cleanName) {
      return film.standardName;
    }
    // 模糊匹配近义词
    for (const alias of film.aliases) {
      if (cleanName.toLowerCase() === alias.toLowerCase()) {
        return film.standardName;
      }
    }
  }

  return null;
}

/**
 * 标准化创作者名称
 * @param name 输入的创作者名称
 * @param role 创作者角色
 * @returns 标准化的创作者名称，如果未找到则返回null
 */
export function standardizeCreatorName(
  name: string | null | undefined,
  role: 'composer' | 'singer' | 'arranger' | 'lyricist' | 'producer'
): string | null {
  if (!name) return null;

  const cleanName = name.trim();
  
  // 检查标准创作者库
  for (const creator of STANDARD_CREATORS) {
    // 角色匹配
    if (creator.role !== role) continue;
    
    // 精确匹配标准名称
    if (creator.standardName === cleanName) {
      return creator.standardName;
    }
    // 模糊匹配近义词
    for (const alias of creator.aliases) {
      if (cleanName.toLowerCase() === alias.toLowerCase()) {
        return creator.standardName;
      }
    }
  }

  return null;
}

/**
 * 标准化发行方名称
 * @param name 输入的发行方名称
 * @returns 标准化的发行方名称，如果未找到则返回null
 */
export function standardizePublisherName(name: string | null | undefined): string | null {
  if (!name) return null;

  const cleanName = name.trim();
  
  // 检查标准发行方库
  for (const publisher of STANDARD_PUBLISHERS) {
    // 精确匹配标准名称
    if (publisher.standardName === cleanName) {
      return publisher.standardName;
    }
    // 模糊匹配近义词
    for (const alias of publisher.aliases) {
      if (cleanName.toLowerCase() === alias.toLowerCase()) {
        return publisher.standardName;
      }
    }
  }

  return null;
}

/**
 * 标准化平台名称
 * @param name 输入的平台名称
 * @returns 标准化的平台名称，如果未找到则返回null
 */
export function standardizePlatformName(name: string | null | undefined): string | null {
  if (!name) return null;

  const cleanName = name.trim();
  
  // 检查标准平台库
  for (const platform of STANDARD_PLATFORMS) {
    // 精确匹配标准名称
    if (platform.standardName === cleanName) {
      return platform.standardName;
    }
    // 模糊匹配近义词
    for (const alias of platform.aliases) {
      if (cleanName.toLowerCase() === alias.toLowerCase()) {
        return platform.standardName;
      }
    }
  }

  return null;
}

/**
 * 验证专辑时长是否合理
 * @param albumName 专辑名称
 * @param duration 时长（秒）
 * @returns 是否在合理范围内
 */
export function validateAlbumDuration(albumName: string, duration: number): boolean {
  const album = STANDARD_ALBUMS.find(a => a.standardName === albumName);
  if (!album || !album.durationRange) return true;

  return duration >= album.durationRange.min && duration <= album.durationRange.max;
}

/**
 * 获取专辑标准信息
 * @param albumName 专辑名称（可以是标准名或近义词）
 * @returns 标准专辑信息，如果未找到则返回null
 */
export function getAlbumInfo(albumName: string): StandardAlbum | null {
  const standardName = standardizeAlbumName(albumName);
  if (!standardName) return null;

  return STANDARD_ALBUMS.find(a => a.standardName === standardName) || null;
}

/**
 * 获取影视标准信息
 * @param filmName 影视名称（可以是标准名或近义词）
 * @returns 标准影视信息，如果未找到则返回null
 */
export function getFilmInfo(filmName: string): StandardFilm | null {
  const standardName = standardizeFilmName(filmName);
  if (!standardName) return null;

  return STANDARD_FILMS.find(f => f.standardName === standardName) || null;
}

/**
 * 判断是否为标准专辑
 * @param albumName 专辑名称
 * @returns 是否为标准专辑
 */
export function isStandardAlbum(albumName: string): boolean {
  return standardizeAlbumName(albumName) !== null;
}

/**
 * 判断是否为标准影视
 * @param filmName 影视名称
 * @returns 是否为标准影视
 */
export function isStandardFilm(filmName: string): boolean {
  return standardizeFilmName(filmName) !== null;
}
