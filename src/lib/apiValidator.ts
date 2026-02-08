/**
 * API 参数验证工具
 * 提供统一的参数验证和错误处理
 */

import { NextResponse } from 'next/server';

// ==================== 类型定义 ====================

export interface ValidationError {
  field: string;
  message: string;
  code: string;
}

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
}

// ==================== 枚举定义 ====================

export const CATEGORIES = ['scenario', 'dubbing'] as const;
export type Category = typeof CATEGORIES[number];

export const TERM_TYPES = ['core', 'extended'] as const;
export type TermType = typeof TERM_TYPES[number];

export const REVIEW_STATUSES = ['pending', 'approved', 'rejected'] as const;
export type ReviewStatus = typeof REVIEW_STATUSES[number];

export const REVIEW_ACTIONS = ['approve', 'reject'] as const;
export type ReviewAction = typeof REVIEW_ACTIONS[number];

// ==================== 验证函数 ====================

/**
 * 验证必填字段
 */
export function validateRequired(
  body: any,
  fieldName: string,
  displayName?: string
): ValidationResult {
  const errors: ValidationError[] = [];

  if (body[fieldName] === undefined || body[fieldName] === null || body[fieldName] === '') {
    errors.push({
      field: fieldName,
      message: `${displayName || fieldName}不能为空`,
      code: 'REQUIRED_FIELD_MISSING',
    });
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * 验证字段类型
 */
export function validateType(
  body: any,
  fieldName: string,
  expectedType: 'string' | 'number' | 'boolean' | 'array' | 'object',
  displayName?: string
): ValidationResult {
  const errors: ValidationError[] = [];

  if (body[fieldName] === undefined || body[fieldName] === null) {
    // 如果字段不存在，由 validateRequired 处理
    return { isValid: true, errors: [] };
  }

  const actualType = Array.isArray(body[fieldName])
    ? 'array'
    : typeof body[fieldName];

  if (actualType !== expectedType) {
    errors.push({
      field: fieldName,
      message: `${displayName || fieldName}类型错误，期望${expectedType}类型`,
      code: 'INVALID_TYPE',
    });
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * 验证枚举值
 */
export function validateEnum<T extends readonly string[]>(
  body: any,
  fieldName: string,
  enumValues: T,
  displayName?: string
): ValidationResult {
  const errors: ValidationError[] = [];

  if (body[fieldName] === undefined || body[fieldName] === null) {
    // 如果字段不存在，由 validateRequired 处理
    return { isValid: true, errors: [] };
  }

  if (!enumValues.includes(body[fieldName] as any)) {
    errors.push({
      field: fieldName,
      message: `${displayName || fieldName}值无效，可选值：${enumValues.join(', ')}`,
      code: 'INVALID_ENUM_VALUE',
    });
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * 验证数组不为空
 */
export function validateArrayNotEmpty(
  body: any,
  fieldName: string,
  displayName?: string
): ValidationResult {
  const errors: ValidationError[] = [];

  if (!Array.isArray(body[fieldName])) {
    return {
      isValid: true,
      errors: [], // 由 validateType 处理
    };
  }

  if (body[fieldName].length === 0) {
    errors.push({
      field: fieldName,
      message: `${displayName || fieldName}不能为空数组`,
      code: 'EMPTY_ARRAY',
    });
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * 批量验证
 */
export function validateMultiple(...validations: (ValidationResult | null | undefined)[]): ValidationResult {
  const allErrors = validations
    .filter((v): v is ValidationResult => v !== null && v !== undefined)
    .flatMap(v => v.errors);

  return {
    isValid: allErrors.length === 0,
    errors: allErrors,
  };
}

// ==================== 特定业务验证 ====================

/**
 * 验证分类
 */
export function validateCategory(
  body: any,
  fieldName = 'category'
): ValidationResult {
  return validateEnum(body, fieldName, CATEGORIES, '分类');
}

/**
 * 验证词类型
 */
export function validateTermType(
  body: any,
  fieldName = 'termType'
): ValidationResult {
  return validateEnum(body, fieldName, TERM_TYPES, '词类型');
}

/**
 * 验证审核状态
 */
export function validateReviewStatus(
  body: any,
  fieldName = 'reviewStatus'
): ValidationResult {
  return validateEnum(body, fieldName, REVIEW_STATUSES, '审核状态');
}

/**
 * 验证审核动作
 */
export function validateReviewAction(
  body: any,
  fieldName = 'action'
): ValidationResult {
  return validateEnum(body, fieldName, REVIEW_ACTIONS, '审核动作');
}

// ==================== 错误响应生成 ====================

/**
 * 生成错误响应
 */
export function createErrorResponse(
  errors: ValidationError[],
  statusCode: number = 400,
  requestId?: string
): NextResponse {
  return NextResponse.json(
    {
      success: false,
      error: '参数验证失败',
      errors,
      requestId,
    },
    { status: statusCode }
  );
}

/**
 * 生成简单的错误响应
 */
export function createSimpleErrorResponse(
  message: string,
  statusCode: number = 400,
  errorCode?: string,
  requestId?: string
): NextResponse {
  return NextResponse.json(
    {
      success: false,
      error: message,
      errorCode,
      requestId,
    },
    { status: statusCode }
  );
}

/**
 * 生成成功响应
 */
export function createSuccessResponse<T>(
  data: T,
  message?: string
): NextResponse {
  return NextResponse.json({
    success: true,
    message,
    data,
  });
}

// ==================== 请求ID生成 ====================

/**
 * 生成请求ID（用于追踪和调试）
 */
export function generateRequestId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}
