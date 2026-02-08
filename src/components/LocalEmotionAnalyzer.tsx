'use client';

import { useState, useRef } from 'react';
import { AudioFeatureExtractor, AudioAnalysisResult } from '@/lib/audioFeatureExtractor';
import { emotionRecognizer, EmotionRecognitionResult } from '@/lib/emotionRecognizer';

/**
 * 纯前端音乐情绪识别组件
 * 完全不联网，在浏览器本地处理
 */
export default function LocalEmotionAnalyzer() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<EmotionRecognitionResult | null>(null);
  const [error, setError] = useState<string>('');
  const [audioFeatures, setAudioFeatures] = useState<AudioAnalysisResult | null>(null);

  const extractorRef = useRef<AudioFeatureExtractor | null>(null);

  /**
   * 初始化音频提取器
   */
  const initExtractor = async () => {
    if (!extractorRef.current) {
      extractorRef.current = new AudioFeatureExtractor();
    }
    await extractorRef.current.init();
  };

  /**
   * 处理文件选择
   */
  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    const file = files[0];

    // 验证文件类型
    const validTypes = ['audio/mpeg', 'audio/wav', 'audio/x-wav', 'audio/ogg', 'audio/flac'];
    if (!validTypes.includes(file.type) && !file.name.match(/\.(mp3|wav|ogg|flac)$/i)) {
      setError('不支持的文件格式，请选择 MP3、WAV、OGG 或 FLAC 格式');
      return;
    }

    setSelectedFile(file);
    setError('');
    setAnalysisResult(null);
    setAudioFeatures(null);

    // 自动开始分析
    await analyzeAudio(file);
  };

  /**
   * 分析音频
   */
  const analyzeAudio = async (file: File) => {
    setIsAnalyzing(true);
    setError('');

    try {
      // 初始化提取器
      await initExtractor();

      // 提取音频特征（完全在本地）
      const features = await extractorRef.current!.extractFromFile(file);
      setAudioFeatures(features);

      // 识别情绪（基于规则的匹配，不需要联网）
      const result = emotionRecognizer.recognize(features.features);
      setAnalysisResult(result);

    } catch (err) {
      console.error('分析失败:', err);
      setError(err instanceof Error ? err.message : '分析失败，请重试');
    } finally {
      setIsAnalyzing(false);
    }
  };

  /**
   * 重新分析
   */
  const handleReanalyze = () => {
    if (selectedFile) {
      analyzeAudio(selectedFile);
    }
  };

  /**
   * 获取置信度颜色
   */
  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.8) return 'text-green-600';
    if (confidence >= 0.6) return 'text-yellow-600';
    return 'text-red-600';
  };

  /**
   * 获取强度描述
   */
  const getIntensityLabel = (intensity: number) => {
    if (intensity >= 0.8) return '强烈';
    if (intensity >= 0.6) return '较强';
    if (intensity >= 0.4) return '中等';
    if (intensity >= 0.2) return '较弱';
    return '微弱';
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* 标题 */}
        <div className="text-center space-y-2">
          <div className="flex items-center justify-center gap-3">
            <svg className="w-12 h-12 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
            </svg>
            <h1 className="text-4xl font-bold text-gray-900">音乐情绪识别</h1>
          </div>
          <p className="text-gray-600 text-lg">
            纯本地分析 • 不上传文件 • 保护隐私
          </p>
        </div>

        {/* 文件上传区域 */}
        <div className="bg-white rounded-lg shadow-lg p-8">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                </svg>
                <span>选择本地音乐文件</span>
              </div>
              {selectedFile && (
                <div className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span className="text-sm text-gray-700">{selectedFile.name}</span>
                </div>
              )}
            </div>

            <div className="flex items-center gap-4">
              <input
                type="file"
                id="audio-input"
                accept="audio/*,.mp3,.wav,.ogg,.flac"
                onChange={handleFileSelect}
                className="hidden"
              />
              <label
                htmlFor="audio-input"
                className={`flex-1 border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
                  isAnalyzing
                    ? 'border-gray-300 bg-gray-50 cursor-not-allowed'
                    : 'border-blue-300 hover:border-blue-500 hover:bg-blue-50'
                }`}
              >
                <div className="flex flex-col items-center gap-2">
                  <svg className={`w-12 h-12 ${isAnalyzing ? 'text-gray-400' : 'text-blue-500'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                  </svg>
                  {isAnalyzing ? (
                    <p className="text-gray-600">正在分析...</p>
                  ) : (
                    <>
                      <p className="text-gray-700 font-medium">点击选择或拖拽音频文件</p>
                      <p className="text-gray-500 text-sm">支持 MP3、WAV、OGG、FLAC 格式</p>
                    </>
                  )}
                </div>
              </label>
            </div>

            {error && (
              <div className="flex items-start gap-2 p-4 bg-red-50 border border-red-200 rounded-lg">
                <svg className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div className="text-sm text-red-700">{error}</div>
              </div>
            )}
          </div>
        </div>

        {/* 分析结果 */}
        {analysisResult && (
          <div className="bg-white rounded-lg shadow-lg p-8">
            <div className="space-y-6">
              {/* 标题栏 */}
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold text-gray-900">分析结果</h2>
                <button
                  onClick={handleReanalyze}
                  disabled={isAnalyzing}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  <svg className={`w-4 h-4 ${isAnalyzing ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  重新分析
                </button>
              </div>

              {/* 情绪识别 */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-gray-900">情绪识别</h3>
                <div className="grid grid-cols-1 gap-4">
                  {/* 情绪标签云 */}
                  <div className="p-4 bg-gradient-to-br from-purple-50 to-pink-50 rounded-lg">
                    <div className="text-sm text-gray-600 mb-3">情绪标签 <span className="text-xs text-gray-400">（共 {1 + analysisResult.secondaryMoods.length} 个）</span></div>
                    <div className="flex flex-wrap gap-2">
                      {/* 主情绪 - 最大最醒目 */}
                      <span className="px-5 py-3 bg-purple-600 text-white rounded-full text-xl font-bold shadow-lg hover:shadow-xl transition-shadow cursor-default">
                        {analysisResult.primaryMood}
                      </span>

                      {/* 辅助情绪 - 渐变大小和颜色，形成标签云效果 */}
                      {analysisResult.secondaryMoods.map((mood, index) => {
                        // 根据位置设置不同的样式，形成视觉层次
                        const colors = [
                          'bg-white border-2 border-purple-300 text-purple-700 hover:bg-purple-50',
                          'bg-white border-2 border-pink-300 text-pink-700 hover:bg-pink-50',
                          'bg-white border-2 border-indigo-300 text-indigo-700 hover:bg-indigo-50',
                          'bg-white border-2 border-violet-300 text-violet-700 hover:bg-violet-50',
                          'bg-white border-2 border-fuchsia-300 text-fuchsia-700 hover:bg-fuchsia-50',
                          'bg-white border-2 border-rose-300 text-rose-700 hover:bg-rose-50',
                        ];
                        const sizes = [
                          'text-base font-medium px-4 py-2',
                          'text-base font-medium px-4 py-2',
                          'text-sm font-medium px-3 py-2',
                          'text-sm font-medium px-3 py-2',
                          'text-xs font-medium px-3 py-2',
                          'text-xs font-medium px-3 py-2',
                        ];

                        return (
                          <span
                            key={index}
                            className={`${colors[index]} ${sizes[index]} rounded-full shadow-sm hover:shadow-md transition-all cursor-default`}
                          >
                            {mood}
                          </span>
                        );
                      })}
                    </div>

                    {/* 情绪标签说明 */}
                    <div className="mt-3 text-xs text-gray-500 flex items-center gap-2">
                      <span className="inline-block w-3 h-3 bg-purple-600 rounded-full"></span>
                      <span>主情绪</span>
                      <span className="inline-block w-3 h-3 bg-white border-2 border-purple-300 rounded-full ml-2"></span>
                      <span>辅助情绪（按相关度排序）</span>
                    </div>
                  </div>

                  {/* 情绪强度 */}
                  <div className="p-4 bg-gradient-to-br from-blue-50 to-cyan-50 rounded-lg">
                    <div className="text-sm text-gray-600 mb-2">情绪强度</div>
                    <div className="flex items-center gap-2">
                      <div className="text-2xl font-bold text-blue-700">
                        {getIntensityLabel(analysisResult.intensity)}
                      </div>
                      <div className="text-sm text-gray-500">
                        ({(analysisResult.intensity * 100).toFixed(0)}%)
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* 影视类型和场景 */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-gray-900">影视配乐信息</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* 影视类型 */}
                  <div className="p-4 bg-gradient-to-br from-orange-50 to-yellow-50 rounded-lg">
                    <div className="text-sm text-gray-600 mb-2">影视类型</div>
                    <div className="text-xl font-bold text-orange-700">
                      {analysisResult.filmType}
                    </div>
                  </div>

                  {/* 具体场景 */}
                  <div className="p-4 bg-gradient-to-br from-green-50 to-teal-50 rounded-lg">
                    <div className="text-sm text-gray-600 mb-2">具体场景</div>
                    <div className="text-xl font-bold text-green-700">
                      {analysisResult.scene}
                    </div>
                  </div>
                </div>
              </div>

              {/* 音乐风格和乐器 */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-gray-900">音乐特征</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* 音乐风格 */}
                  <div className="p-4 bg-gradient-to-br from-indigo-50 to-purple-50 rounded-lg">
                    <div className="text-sm text-gray-600 mb-2">音乐风格</div>
                    <div className="text-xl font-bold text-indigo-700">
                      {analysisResult.style}
                    </div>
                  </div>

                  {/* 推荐乐器 */}
                  <div className="p-4 bg-gradient-to-br from-rose-50 to-pink-50 rounded-lg">
                    <div className="text-sm text-gray-600 mb-2">推荐乐器</div>
                    <div className="flex flex-wrap gap-2">
                      {analysisResult.instruments.map((instrument, index) => (
                        <span
                          key={index}
                          className="px-3 py-1 bg-white border border-rose-200 rounded-full text-sm"
                        >
                          {instrument}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* 音频特征详情 */}
              {audioFeatures && (
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-gray-900">音频特征</h3>
                  <div className="p-4 bg-gray-50 rounded-lg">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div>
                        <div className="text-gray-600 mb-1">时长</div>
                        <div className="font-semibold text-gray-900">
                          {Math.floor(audioFeatures.duration / 60)}:{(audioFeatures.duration % 60).toFixed(0).padStart(2, '0')}
                        </div>
                      </div>
                      <div>
                        <div className="text-gray-600 mb-1">BPM</div>
                        <div className="font-semibold text-gray-900">
                          {Math.round(audioFeatures.features.tempo)}
                        </div>
                      </div>
                      <div>
                        <div className="text-gray-600 mb-1">采样率</div>
                        <div className="font-semibold text-gray-900">
                          {audioFeatures.sampleRate / 1000} kHz
                        </div>
                      </div>
                      <div>
                        <div className="text-gray-600 mb-1">节奏强度</div>
                        <div className="font-semibold text-gray-900">
                          {(audioFeatures.features.rhythmStrength * 100).toFixed(0)}%
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* 置信度 */}
              <div className="flex items-center justify-between p-4 bg-blue-50 rounded-lg">
                <div className="flex items-center gap-2">
                  <svg className="w-5 h-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span className="text-sm text-gray-700">识别置信度</span>
                </div>
                <span className={`text-lg font-bold ${getConfidenceColor(analysisResult.confidence)}`}>
                  {(analysisResult.confidence * 100).toFixed(0)}%
                </span>
              </div>

              {/* 隐私说明 */}
              <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                <div className="flex items-start gap-2">
                  <svg className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <div className="text-sm text-green-800">
                    <div className="font-semibold mb-1">隐私保护说明</div>
                    <div className="text-green-700">
                      本次分析完全在您的浏览器本地进行，音乐文件未上传到任何服务器。
                      分析完成后，音频数据已从内存中释放。
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 底部说明 */}
        <div className="bg-white rounded-lg shadow-lg p-6">
          <div className="space-y-3 text-sm text-gray-600">
            <h3 className="font-semibold text-gray-900">使用说明</h3>
            <ul className="space-y-2 list-disc list-inside">
              <li>选择本地音乐文件（MP3、WAV、OGG、FLAC）</li>
              <li>系统自动提取音频特征并识别情绪</li>
              <li>基于规则的匹配算法，无需联网</li>
              <li>完全在浏览器本地处理，保护您的隐私</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
