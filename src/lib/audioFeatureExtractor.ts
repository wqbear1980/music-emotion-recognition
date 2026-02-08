/**
 * 音频特征提取模块（纯前端，使用Web Audio API）
 * 不上传任何文件，完全在浏览器本地处理
 */

export interface AudioFeatures {
  // 频谱特征
  spectralCentroid: number;      // 频谱重心（音频亮度）
  spectralRolloff: number;       // 频谱滚降点
  spectralFlux: number;          // 频谱波动

  // 能量特征
  rmsEnergy: number;             // 均方根能量（音量强度）
  lowFrequencyEnergy: number;    // 低频能量比例（0-1）
  midFrequencyEnergy: number;    // 中频能量比例（0-1）
  highFrequencyEnergy: number;   // 高频能量比例（0-1）

  // 节奏特征
  tempo: number;                 // 估算BPM
  rhythmStrength: number;       // 节奏强度（0-1）

  // 音色特征
  zeroCrossingRate: number;      // 过零率（音色明亮度）
  harmonicRatio: number;         // 谐波比（纯度）
}

export interface AudioAnalysisResult {
  features: AudioFeatures;
  duration: number;              // 音频时长（秒）
  sampleRate: number;            // 采样率
}

/**
 * 音频特征提取器
 */
export class AudioFeatureExtractor {
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;

  /**
   * 初始化音频上下文
   */
  async init(): Promise<void> {
    if (!this.audioContext) {
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    if (this.audioContext.state === 'suspended') {
      await this.audioContext.resume();
    }
  }

  /**
   * 从文件提取音频特征
   * @param file 音频文件
   * @returns 音频分析结果
   */
  async extractFromFile(file: File): Promise<AudioAnalysisResult> {
    await this.init();

    // 读取文件为ArrayBuffer
    const arrayBuffer = await file.arrayBuffer();

    // 解码音频数据
    const audioBuffer = await this.audioContext!.decodeAudioData(arrayBuffer);

    // 提取特征
    const features = await this.extractFeatures(audioBuffer);

    // 返回结果（包含时长和采样率）
    return {
      features,
      duration: audioBuffer.duration,
      sampleRate: audioBuffer.sampleRate,
    };
  }

  /**
   * 从AudioBuffer提取特征
   */
  private async extractFeatures(audioBuffer: AudioBuffer): Promise<AudioFeatures> {
    // 创建分析器
    const analyser = this.audioContext!.createAnalyser();
    analyser.fftSize = 2048;
    analyser.smoothingTimeConstant = 0.8;

    // 创建音频源
    const source = this.audioContext!.createBufferSource();
    source.buffer = audioBuffer;

    // 连接节点
    source.connect(analyser);

    // 提取音频数据
    const channelData = audioBuffer.getChannelData(0); // 使用单声道
    const sampleRate = audioBuffer.sampleRate;
    const duration = audioBuffer.duration;

    // 计算各种特征
    const rmsEnergy = this.calculateRMSEnergy(channelData);
    const { spectralCentroid, spectralRolloff, spectralFlux } = this.calculateSpectralFeatures(channelData, sampleRate);
    const { lowEnergy, midEnergy, highEnergy } = this.calculateFrequencyBands(analyser);
    const { tempo, rhythmStrength } = this.estimateTempo(channelData, sampleRate);
    const zeroCrossingRate = this.calculateZeroCrossingRate(channelData);
    const harmonicRatio = this.estimateHarmonicRatio(channelData);

    // 释放资源
    source.disconnect();

    return {
      spectralCentroid,
      spectralRolloff,
      spectralFlux,
      rmsEnergy,
      lowFrequencyEnergy: lowEnergy,
      midFrequencyEnergy: midEnergy,
      highFrequencyEnergy: highEnergy,
      tempo,
      rhythmStrength,
      zeroCrossingRate,
      harmonicRatio,
    };
  }

  /**
   * 计算均方根能量（音量强度）
   */
  private calculateRMSEnergy(data: Float32Array): number {
    let sum = 0;
    for (let i = 0; i < data.length; i++) {
      sum += data[i] * data[i];
    }
    return Math.sqrt(sum / data.length);
  }

  /**
   * 计算频谱特征
   */
  private calculateSpectralFeatures(data: Float32Array, sampleRate: number): {
    spectralCentroid: number;
    spectralRolloff: number;
    spectralFlux: number;
  } {
    // 简化版：使用快速傅里叶变换的近似计算
    const fftSize = 2048;
    const magnitude = new Float32Array(fftSize / 2);

    // 计算幅度谱（简化版，实际应用中应使用真正的FFT）
    for (let i = 0; i < magnitude.length; i++) {
      magnitude[i] = Math.abs(data[i * 2] || 0);
    }

    // 频谱重心
    let weightedSum = 0;
    let totalEnergy = 0;
    for (let i = 0; i < magnitude.length; i++) {
      const frequency = (i * sampleRate) / fftSize;
      weightedSum += frequency * magnitude[i];
      totalEnergy += magnitude[i];
    }
    const spectralCentroid = totalEnergy > 0 ? weightedSum / totalEnergy : 0;

    // 频谱滚降点（85%能量点）
    let energyAccum = 0;
    const rolloffEnergy = 0.85 * totalEnergy;
    let spectralRolloff = 0;
    for (let i = 0; i < magnitude.length; i++) {
      energyAccum += magnitude[i];
      if (energyAccum >= rolloffEnergy) {
        spectralRolloff = (i * sampleRate) / fftSize;
        break;
      }
    }

    // 频谱波动（简化版）
    let flux = 0;
    for (let i = 1; i < magnitude.length; i++) {
      flux += Math.pow(magnitude[i] - magnitude[i - 1], 2);
    }
    const spectralFlux = Math.sqrt(flux / magnitude.length);

    return { spectralCentroid, spectralRolloff, spectralFlux };
  }

  /**
   * 计算频段能量分布
   */
  private calculateFrequencyBands(analyser: AnalyserNode): {
    lowEnergy: number;
    midEnergy: number;
    highEnergy: number;
  } {
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    analyser.getByteFrequencyData(dataArray);

    // 频段划分
    const lowEnd = Math.floor(bufferLength * 0.1);  // 低频：0-10%
    const midEnd = Math.floor(bufferLength * 0.5);  // 中频：10-50%
    // 高频：50-100%

    let lowSum = 0, midSum = 0, highSum = 0;

    for (let i = 0; i < bufferLength; i++) {
      const value = dataArray[i];
      if (i < lowEnd) {
        lowSum += value;
      } else if (i < midEnd) {
        midSum += value;
      } else {
        highSum += value;
      }
    }

    const total = lowSum + midSum + highSum;
    return {
      lowEnergy: total > 0 ? lowSum / total : 0,
      midEnergy: total > 0 ? midSum / total : 0,
      highEnergy: total > 0 ? highSum / total : 0,
    };
  }

  /**
   * 估算BPM和节奏强度（简化版）
   */
  private estimateTempo(data: Float32Array, sampleRate: number): {
    tempo: number;
    rhythmStrength: number;
  } {
    // 基于能量包络检测节拍
    const hopSize = Math.floor(sampleRate * 0.01); // 10ms hop
    const envelope: number[] = [];

    for (let i = 0; i < data.length; i += hopSize) {
      let sum = 0;
      const windowSize = Math.min(hopSize * 4, data.length - i);
      for (let j = 0; j < windowSize; j++) {
        sum += Math.abs(data[i + j]);
      }
      envelope.push(sum / windowSize);
    }

    // 计算自相关函数找到周期
    const maxLag = Math.floor(envelope.length / 2);
    let maxCorrelation = 0;
    let bestLag = 0;

    for (let lag = 10; lag < maxLag; lag++) {
      let correlation = 0;
      for (let i = 0; i < envelope.length - lag; i++) {
        correlation += envelope[i] * envelope[i + lag];
      }

      if (correlation > maxCorrelation) {
        maxCorrelation = correlation;
        bestLag = lag;
      }
    }

    // 计算BPM
    const tempo = bestLag > 0 ? (60 / (bestLag * hopSize / sampleRate)) : 0;

    // 节奏强度（基于包络的清晰度）
    const envelopeMean = envelope.reduce((a, b) => a + b, 0) / envelope.length;
    const envelopeVariance = envelope.reduce((sum, val) => sum + Math.pow(val - envelopeMean, 2), 0) / envelope.length;
    const rhythmStrength = envelopeVariance > 0 ? Math.min(envelopeVariance / envelopeMean, 1) : 0;

    return { tempo, rhythmStrength };
  }

  /**
   * 计算过零率（音色特征）
   */
  private calculateZeroCrossingRate(data: Float32Array): number {
    let crossings = 0;
    for (let i = 1; i < data.length; i++) {
      if ((data[i] >= 0 && data[i - 1] < 0) || (data[i] < 0 && data[i - 1] >= 0)) {
        crossings++;
      }
    }
    return crossings / data.length;
  }

  /**
   * 估算谐波比（音色纯度）
   */
  private estimateHarmonicRatio(data: Float32Array): number {
    // 简化版：基于零交叉率的反向指标
    // 零交叉率越高，噪声越大，谐波比越低
    const zcr = this.calculateZeroCrossingRate(data);
    return Math.max(0, 1 - zcr * 10);
  }

  /**
   * 释放资源
   */
  dispose(): void {
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
    this.analyser = null;
  }
}
