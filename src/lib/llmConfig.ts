/**
 * LLM配置管理模块
 *
 * 支持云端大模型和本地大模型的统一配置和切换
 */

import { Config } from 'coze-coding-dev-sdk';
import { llmOptimizer } from './llmPerformanceOptimizer';

export type LLMType = 'cloud' | 'local' | 'auto';

export interface LLMProviderConfig {
  type: LLMType;
  provider: 'coze' | 'openai-compatible';
  config: Config;
  model: string;
  defaultTemperature: number;
  defaultStreaming: boolean;
  defaultThinking: 'enabled' | 'disabled';
  defaultCaching: 'enabled' | 'disabled';
}

/**
 * 获取环境变量
 */
function getEnv(key: string, defaultValue: string = ''): string {
  if (typeof process !== 'undefined' && process.env) {
    return process.env[key] || defaultValue;
  }
  return defaultValue;
}

/**
 * 获取数字环境变量
 */
function getNumberEnv(key: string, defaultValue: number): number {
  const value = getEnv(key, defaultValue.toString());
  return parseInt(value, 10) || defaultValue;
}

/**
 * 获取布尔环境变量
 */
function getBooleanEnv(key: string, defaultValue: boolean): boolean {
  const value = getEnv(key, defaultValue.toString());
  return value === 'true' || value === '1';
}

/**
 * 获取枚举环境变量（enabled/disabled）
 */
function getEnumEnv(key: string, defaultValue: 'enabled' | 'disabled'): 'enabled' | 'disabled' {
  const value = getEnv(key, defaultValue);
  if (value === 'enabled' || value === 'disabled') {
    return value;
  }
  return defaultValue;
}

/**
 * 创建云端LLM配置（Coze）
 */
function createCloudConfig(): Config {
  const apiKey = getEnv('COZE_WORKLOAD_IDENTITY_API_KEY', '');
  const baseUrl = getEnv('COZE_INTEGRATION_BASE_URL', 'https://api.coze.com');
  const modelBaseUrl = getEnv('COZE_INTEGRATION_MODEL_BASE_URL', 'https://model.coze.com');
  const timeout = getNumberEnv('LLM_TIMEOUT', 120000);
  const retryTimes = getNumberEnv('LLM_RETRY_TIMES', 3);
  const retryDelay = getNumberEnv('LLM_RETRY_DELAY', 1000);

  return new Config({
    apiKey,
    baseUrl,
    modelBaseUrl,
    timeout,
    retryTimes,
    retryDelay,
  });
}

/**
 * 创建本地LLM配置（OpenAI兼容）
 */
function createLocalConfig(): Config {
  const apiKey = getEnv('LOCAL_LLM_API_KEY', 'dummy');
  const modelBaseUrl = getEnv('LOCAL_LLM_BASE_URL', 'http://localhost:8000/v1');
  const timeout = getNumberEnv('LLM_TIMEOUT', 120000);
  const retryTimes = getNumberEnv('LLM_RETRY_TIMES', 3);
  const retryDelay = getNumberEnv('LLM_RETRY_DELAY', 1000);

  return new Config({
    apiKey,
    modelBaseUrl, // 本地LLM使用modelBaseUrl
    timeout,
    retryTimes,
    retryDelay,
  });
}

/**
 * 获取LLM类型
 */
function getLLMType(): LLMType {
  const type = getEnv('LLM_TYPE', 'cloud');
  if (type === 'local' || type === 'cloud' || type === 'auto') {
    return type;
  }
  return 'cloud';
}

/**
 * 获取LLM提供者配置
 */
export function getLLMProviderConfig(): LLMProviderConfig {
  const type = getLLMType();

  if (type === 'local') {
    console.log('[LLM配置] 使用本地LLM');
    return {
      type: 'local',
      provider: 'openai-compatible',
      config: createLocalConfig(),
      model: getEnv('LOCAL_LLM_MODEL', 'Qwen/Qwen2.5-7B-Instruct'),
      defaultTemperature: getNumberEnv('LLM_TEMPERATURE', 0.3),
      defaultStreaming: getBooleanEnv('LLM_STREAMING', true),
      defaultThinking: getEnumEnv('LLM_THINKING', 'disabled'),
      defaultCaching: getEnumEnv('LLM_CACHING', 'disabled'),
    };
  }

  // 默认使用云端LLM
  console.log('[LLM配置] 使用云端LLM');
  return {
    type: 'cloud',
    provider: 'coze',
    config: createCloudConfig(),
    model: getEnv('CLOUD_LLM_MODEL', 'doubao-seed-1-6-251015'),
    defaultTemperature: getNumberEnv('LLM_TEMPERATURE', 0.3),
    defaultStreaming: getBooleanEnv('LLM_STREAMING', true),
    defaultThinking: getEnumEnv('LLM_THINKING', 'disabled'),
    defaultCaching: getEnumEnv('LLM_CACHING', 'disabled'),
  };
}

/**
 * 检查本地LLM是否可用
 */
export async function checkLocalLLMHealth(): Promise<boolean> {
  try {
    const config = createLocalConfig();
    const baseUrl = config.modelBaseUrl;

    // 检查health endpoint
    const response = await fetch(`${baseUrl.replace('/v1', '')}/health`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      signal: AbortSignal.timeout(5000),
    });

    return response.ok;
  } catch (error) {
    console.warn('[LLM配置] 本地LLM健康检查失败:', error);
    return false;
  }
}

/**
 * 自动检测最佳LLM提供者
 */
export async function autoDetectBestProvider(): Promise<LLMProviderConfig> {
  console.log('[LLM配置] 开始自动检测最佳LLM提供者...');

  // 先检查本地LLM是否可用
  const localAvailable = await checkLocalLLMHealth();

  if (localAvailable) {
    console.log('[LLM配置] 本地LLM可用，优先使用本地LLM');
    return {
      type: 'local',
      provider: 'openai-compatible',
      config: createLocalConfig(),
      model: getEnv('LOCAL_LLM_MODEL', 'Qwen/Qwen2.5-7B-Instruct'),
      defaultTemperature: getNumberEnv('LLM_TEMPERATURE', 0.3),
      defaultStreaming: getBooleanEnv('LLM_STREAMING', true),
      defaultThinking: getEnumEnv('LLM_THINKING', 'disabled'),
      defaultCaching: getEnumEnv('LLM_CACHING', 'disabled'),
    };
  }

  console.log('[LLM配置] 本地LLM不可用，使用云端LLM');
  return {
    type: 'cloud',
    provider: 'coze',
    config: createCloudConfig(),
    model: getEnv('CLOUD_LLM_MODEL', 'doubao-seed-1-6-251015'),
    defaultTemperature: getNumberEnv('LLM_TEMPERATURE', 0.3),
    defaultStreaming: getBooleanEnv('LLM_STREAMING', true),
    defaultThinking: getEnumEnv('LLM_THINKING', 'disabled'),
    defaultCaching: getEnumEnv('LLM_CACHING', 'disabled'),
  };
}

/**
 * 获取LLM客户端配置（支持运行时切换）
 */
export function getLLMConfig(type?: LLMType): LLMProviderConfig {
  if (type === 'local') {
    return {
      type: 'local',
      provider: 'openai-compatible',
      config: createLocalConfig(),
      model: getEnv('LOCAL_LLM_MODEL', 'Qwen/Qwen2.5-7B-Instruct'),
      defaultTemperature: getNumberEnv('LLM_TEMPERATURE', 0.3),
      defaultStreaming: getBooleanEnv('LLM_STREAMING', true),
      defaultThinking: getEnumEnv('LLM_THINKING', 'disabled'),
      defaultCaching: getEnumEnv('LLM_CACHING', 'disabled'),
    };
  }

  if (type === 'cloud') {
    return {
      type: 'cloud',
      provider: 'coze',
      config: createCloudConfig(),
      model: getEnv('CLOUD_LLM_MODEL', 'doubao-seed-1-6-251015'),
      defaultTemperature: getNumberEnv('LLM_TEMPERATURE', 0.3),
      defaultStreaming: getBooleanEnv('LLM_STREAMING', true),
      defaultThinking: getEnumEnv('LLM_THINKING', 'disabled'),
      defaultCaching: getEnumEnv('LLM_CACHING', 'disabled'),
    };
  }

  // 默认根据环境变量配置
  return getLLMProviderConfig();
}

/**
 * 获取所有支持的LLM类型
 */
export function getSupportedLLMTypes(): LLMType[] {
  return ['cloud', 'local', 'auto'];
}

/**
 * 获取LLM配置摘要（用于前端显示）
 */
export function getLLMConfigSummary() {
  const type = getLLMType();
  const cloudConfig = createCloudConfig();
  const localConfig = createLocalConfig();

  return {
    currentType: type,
    cloud: {
      model: getEnv('CLOUD_LLM_MODEL', 'doubao-seed-1-6-251015'),
      modelBaseUrl: cloudConfig.modelBaseUrl,
    },
    local: {
      model: getEnv('LOCAL_LLM_MODEL', 'Qwen/Qwen2.5-7B-Instruct'),
      modelBaseUrl: localConfig.modelBaseUrl,
    },
  };
}
