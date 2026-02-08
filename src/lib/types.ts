export interface AudioFeatures {
  bpm: number;
  duration: number;
  frequencyProfile: {
    low: number;
    mid: number;
    high: number;
  };
  energy: number;
  dynamics: {
    average: number;
    max: number;
    range: number;
  };
  rhythm: {
    consistency: number;
    complexity: number;
  };
  harmonic: {
    brightness: number;
    warmth: number;
  };
  texture: {
    density: number;
    layering: number;
  };
}

// 文件项接口
export interface AudioFileItem {
  id: string;
  file: File;
  audioUrl: string;
  features: AudioFeatures | null;
  result: AnalysisResult | null;
  isAnalyzing: boolean;
  error: string;
  // 文件唯一标识
  musicMd5?: string; // 音乐文件的MD5值，作为唯一标识，用于检测重复上传
  // 上传状态
  isUploading: boolean;
  uploadStatus: 'pending' | 'success' | 'failed';
  uploadError?: string;
  uploadProgress?: number; // 上传进度（0-100）
  fileKey?: string | null; // 对象存储的文件key
  isUploaded?: boolean; // 是否已上传至云端（true=本地+云端双存储，false=仅本地存储）
  isOnline?: boolean; // 文件在线状态（true=可以在线访问，false=未在线）
  uploadedAt?: string | null; // 上传时间（ISO字符串）
  // 重新分析状态
  selected?: boolean; // 是否被选中
  reAnalyzing?: boolean; // 是否正在重新分析
  // 二次识别状态
  sceneReanalyzing?: boolean; // 是否正在二次识别场景
  sceneReanalysisResult?: any; // 二次识别结果
}

export interface AnalysisResult {
  mood: {
    primary: string;
    originalPrimary?: string; // 原始情绪词（映射前的词）
    intensity: string;
    trajectory: string;
    emotionalDimensions: {
      happiness: number;
      sadness: number;
      tension: number;
      romance: number;
      epic: number;
    };
  };
  style: {
    primary: string;
    subGenre: string;
    genreBlending: string;
    era: string;
  };
  musicalStructure: {
    form: string;
    chorus: string;
    bridge: string;
    repeatPatterns: string;
  };
  harmony: {
    tonality: string;
    key: string;
    chordProgression: string;
    modulation: string;
  };
  rhythm: {
    timeSignature: string;
    rhythmPattern: string;
    groove: string;
  };
  instruments: {
    primary: string[];
    accompaniment: string[];
    percussion: string[];
    electronicElements: string;
    timbre: string;
  };
  musicOrigin: {
    confidenceLevel: '高' | '中' | '低';
    sourceType: '影视原声' | '专辑' | '独立单曲' | '综艺' | '游戏配乐' | '广告' | '不确定';
    filmOrTV?: {
      name?: string;
      episode?: string;
      scene?: string;
      platform?: string;
    };
    album?: {
      name?: string;
      releaseYear?: string;
      label?: string;
    };
    creators?: {
      composer?: string;
      arranger?: string;
      singer?: string;
      lyricist?: string;
    };
    reasoning: string;
    uncertaintyReason?: string;
  };
  filmMusic: {
    filmType?: string;
    suitableGenres: string[];
    scenes: Array<{
      type: string;
      description: string;
      emotionalImpact: string;
      usageTips: string;
    }>;
    turningPoints: string;
    characterTheme: {
      suitable: string;
      characterType: string;
      storyArc: string;
    };
    atmosphere: string;
    emotionalGuidance: string;
  };
  culturalContext: {
    origin: string;
    influences: string[];
    modernInterpretation: string;
  };
  // 候选新词字段 - 用于智能扩充
  candidateTerms?: {
    scenarios?: Array<{
      term: string;          // 候选词，如"埋伏行动"
      synonyms: string[];    // 近义词：["埋伏", "设伏", "埋伏点"]
      filmTypes: string[];   // 适配类型：["警匪片", "战争片", "谍战片"]
      confidence: number;    // 置信度：0-100
      reason: string;        // 理由：为什么推荐这个词
    }>;
    dubbing?: Array<{
      term: string;          // 候选词
      synonyms: string[];    // 近义词
      filmTypes: string[];   // 适配类型
      confidence: number;    // 置信度
      reason: string;        // 理由
    }>;
  };
}
