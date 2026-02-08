/**
 * 智能错误处理系统
 * 提供错误分类、诊断、解决方案推荐等功能
 */

/**
 * 错误类型
 */
export enum ErrorType {
  NETWORK = 'network',
  FORMAT = 'format',
  API = 'api',
  VALIDATION = 'validation',
  UNKNOWN = 'unknown',
}

/**
 * 错误严重程度
 */
export enum ErrorSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
}

/**
 * 错误分类结果
 */
export interface ErrorClassification {
  type: ErrorType;
  severity: ErrorSeverity;
  canRetry: boolean;
  userActionRequired: boolean;
}

/**
 * 错误诊断结果
 */
export interface ErrorDiagnosis {
  rootCause: string;
  affectedComponents: string[];
  similarCases: Array<{ description: string; solution: string }>;
}

/**
 * 解决方案
 */
export interface Solution {
  solution: string;
  priority: number; // 1-10，数字越大优先级越高
  estimatedTime: string;
  steps: string[];
}

/**
 * 完整的错误处理结果
 */
export interface ErrorHandlingResult {
  classification: ErrorClassification;
  diagnosis: ErrorDiagnosis;
  solutions: Solution[];
  userFriendlyMessage: string;
}

/**
 * 错误处理器类
 */
export class SmartErrorHandler {
  /**
   * 分类错误
   */
  classifyError(error: Error | any): ErrorClassification {
    // 网络错误
    if (error.message?.includes('network') ||
        error.message?.includes('fetch') ||
        error.message?.includes('timeout') ||
        error.name?.includes('NetworkError')) {
      return {
        type: ErrorType.NETWORK,
        severity: ErrorSeverity.MEDIUM,
        canRetry: true,
        userActionRequired: false,
      };
    }

    // 格式错误
    if (error.message?.includes('format') ||
        error.message?.includes('decode') ||
        error.message?.includes('unsupported') ||
        error.message?.includes('invalid format')) {
      return {
        type: ErrorType.FORMAT,
        severity: ErrorSeverity.HIGH,
        canRetry: false,
        userActionRequired: true,
      };
    }

    // API错误
    if (error.message?.includes('API') ||
        error.message?.includes('request failed') ||
        error.status) {
      const statusCode = error.status || 0;
      const severity = statusCode >= 500 ? ErrorSeverity.HIGH : ErrorSeverity.MEDIUM;
      return {
        type: ErrorType.API,
        severity,
        canRetry: statusCode >= 500 || statusCode === 429,
        userActionRequired: statusCode === 401 || statusCode === 403,
      };
    }

    // 验证错误
    if (error.message?.includes('validation') ||
        error.message?.includes('invalid') ||
        error.message?.includes('required')) {
      return {
        type: ErrorType.VALIDATION,
        severity: ErrorSeverity.LOW,
        canRetry: false,
        userActionRequired: true,
      };
    }

    // 未知错误
    return {
      type: ErrorType.UNKNOWN,
      severity: ErrorSeverity.MEDIUM,
      canRetry: true,
      userActionRequired: false,
    };
  }

  /**
   * 诊断错误
   */
  diagnose(error: Error | any): ErrorDiagnosis {
    const classification = this.classifyError(error);

    switch (classification.type) {
      case ErrorType.NETWORK:
        return {
          rootCause: '网络连接问题或服务器无响应',
          affectedComponents: ['网络请求', '数据传输'],
          similarCases: [
            {
              description: '网络连接中断',
              solution: '检查网络连接后重试',
            },
            {
              description: '服务器超时',
              solution: '等待几分钟后重试，或联系管理员',
            },
          ],
        };

      case ErrorType.FORMAT:
        return {
          rootCause: '音频文件格式不支持或文件已损坏',
          affectedComponents: ['音频解码', '格式转换'],
          similarCases: [
            {
              description: '不支持的音频格式',
              solution: '请使用MP3、WAV、FLAC等常见格式',
            },
            {
              description: '文件已损坏',
              solution: '重新下载或获取原始音频文件',
            },
          ],
        };

      case ErrorType.API:
        return {
          rootCause: 'API服务异常或请求参数错误',
          affectedComponents: ['API调用', '数据处理'],
          similarCases: [
            {
              description: '服务器内部错误',
              solution: '稍后重试，如持续出现请联系技术支持',
            },
            {
              description: '请求频率过高',
              solution: '降低请求频率，等待几分钟后重试',
            },
            {
              description: '认证失败',
              solution: '检查登录状态，重新登录',
            },
          ],
        };

      case ErrorType.VALIDATION:
        return {
          rootCause: '输入数据不符合要求',
          affectedComponents: ['数据验证', '表单提交'],
          similarCases: [
            {
              description: '必填字段缺失',
              solution: '请填写所有必填字段',
            },
            {
              description: '数据格式错误',
              solution: '请检查输入格式是否正确',
            },
          ],
        };

      default:
        return {
          rootCause: '未知错误',
          affectedComponents: ['未知'],
          similarCases: [
            {
              description: '系统异常',
              solution: '请刷新页面或联系技术支持',
            },
          ],
        };
    }
  }

  /**
   * 推荐解决方案
   */
  recommendSolutions(error: Error | any): Solution[] {
    const classification = this.classifyError(error);

    switch (classification.type) {
      case ErrorType.NETWORK:
        return [
          {
            solution: '检查网络连接是否正常',
            priority: 10,
            estimatedTime: '1分钟',
            steps: [
              '打开浏览器，访问其他网站确认网络是否正常',
              '检查本地网络设置',
              '尝试切换网络（如从WiFi切换到移动网络）',
            ],
          },
          {
            solution: '刷新页面重试',
            priority: 8,
            estimatedTime: '10秒',
            steps: [
              '点击浏览器刷新按钮',
              '或按F5键刷新页面',
              '重新执行刚才的操作',
            ],
          },
          {
            solution: '清除浏览器缓存',
            priority: 6,
            estimatedTime: '2分钟',
            steps: [
              '按Ctrl+Shift+Delete打开清除缓存对话框',
              '选择"缓存的图片和文件"',
              '点击"清除数据"',
              '刷新页面重试',
            ],
          },
        ];

      case ErrorType.FORMAT:
        return [
          {
            solution: '转换音频文件格式',
            priority: 10,
            estimatedTime: '3分钟',
            steps: [
              '使用音频转换工具（如Audacity、Format Factory）',
              '将音频转换为MP3格式',
              '重新上传转换后的文件',
            ],
          },
          {
            solution: '检查音频文件完整性',
            priority: 8,
            estimatedTime: '2分钟',
            steps: [
              '尝试用其他播放器打开该文件',
              '如果无法播放，说明文件已损坏',
              '重新下载或获取原始音频文件',
            ],
          },
        ];

      case ErrorType.API:
        const statusCode = error.status || 0;

        if (statusCode >= 500) {
          return [
            {
              solution: '等待后重试',
              priority: 10,
              estimatedTime: '5分钟',
              steps: [
                '服务器暂时不可用',
                '等待5-10分钟后重试',
                '如果问题持续，请联系技术支持',
              ],
            },
          ];
        } else if (statusCode === 429) {
          return [
            {
              solution: '降低请求频率',
              priority: 10,
              estimatedTime: '2分钟',
              steps: [
                '暂停当前操作',
                '等待1-2分钟后重试',
                '避免频繁点击按钮',
              ],
            },
          ];
        } else if (statusCode === 401 || statusCode === 403) {
          return [
            {
              solution: '重新登录',
              priority: 10,
              estimatedTime: '1分钟',
              steps: [
                '退出当前账户',
                '重新登录',
                '重试刚才的操作',
              ],
            },
          ];
        } else {
          return [
            {
              solution: '刷新页面重试',
              priority: 8,
              estimatedTime: '10秒',
              steps: [
                '刷新页面',
                '重新执行操作',
              ],
            },
            {
              solution: '联系技术支持',
              priority: 6,
              estimatedTime: '不确定',
              steps: [
                '记录错误信息和操作步骤',
                '联系技术支持团队',
                '提供详细的错误日志',
              ],
            },
          ];
        }

      case ErrorType.VALIDATION:
        return [
          {
            solution: '检查输入数据',
            priority: 10,
            estimatedTime: '1分钟',
            steps: [
              '查看错误提示信息',
              '检查所有必填字段是否已填写',
              '验证数据格式是否正确',
              '修正错误后重新提交',
            ],
          },
        ];

      default:
        return [
          {
            solution: '刷新页面',
            priority: 8,
            estimatedTime: '10秒',
            steps: [
              '刷新页面',
              '重新执行操作',
            ],
          },
          {
            solution: '联系技术支持',
            priority: 6,
            estimatedTime: '不确定',
            steps: [
              '记录错误信息',
              '联系技术支持',
            ],
          },
        ];
    }
  }

  /**
   * 生成用户友好的错误消息
   */
  getUserFriendlyMessage(error: Error | any): string {
    const classification = this.classifyError(error);

    switch (classification.type) {
      case ErrorType.NETWORK:
        return '网络连接异常，请检查网络后重试';
      case ErrorType.FORMAT:
        return '音频文件格式不支持，请使用MP3、WAV或FLAC格式';
      case ErrorType.API:
        const statusCode = error.status || 0;
        if (statusCode >= 500) {
          return '服务器暂时不可用，请稍后重试';
        } else if (statusCode === 429) {
          return '请求过于频繁，请稍后再试';
        } else if (statusCode === 401 || statusCode === 403) {
          return '认证失败，请重新登录';
        } else {
          return '操作失败，请重试';
        }
      case ErrorType.VALIDATION:
        return '输入数据有误，请检查后重新提交';
      default:
        return '操作失败，请刷新页面重试';
    }
  }

  /**
   * 完整的错误处理流程
   */
  handle(error: Error | any): ErrorHandlingResult {
    return {
      classification: this.classifyError(error),
      diagnosis: this.diagnose(error),
      solutions: this.recommendSolutions(error),
      userFriendlyMessage: this.getUserFriendlyMessage(error),
    };
  }
}

// 导出单例
export const errorHandler = new SmartErrorHandler();
