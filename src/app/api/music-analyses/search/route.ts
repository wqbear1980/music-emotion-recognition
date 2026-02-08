import { NextRequest, NextResponse } from "next/server";
import { musicAnalysisManager } from "@/storage/database";

/**
 * 计算音乐状态（根据导入列表和存储位置动态计算）
 *
 * 优先级规则：
 * 1. 在导入列表中（fileName 在 importListFileNames 中）→ "online"（在线）
 * 2. 已上传到云端（isUploaded = true）→ "cloud"（云端）
 * 3. 不在导入列表中，且未上传到云端（isUploaded = false）→ "offline"（离线）
 *
 * 说明：
 * - "在线"状态表示文件当前在上传列表中，可以本地播放
 * - "云端"状态表示文件已上传到云端存储，但当前不在上传列表中
 * - "离线"状态表示文件既不在上传列表中，也未上传到云端
 *
 * @param isUploaded - 是否已上传到云端
 * @param fileName - 文件名
 * @param importListFileNames - 导入列表中的文件名数组
 * @returns 音乐状态："cloud" | "online" | "offline"
 */
function calculateMusicStatus(
  isUploaded: boolean,
  fileName: string,
  importListFileNames: string[]
): "cloud" | "online" | "offline" {
  // 优先级1：已上传到云端（可云端播放）
  if (isUploaded === true) {
    return "cloud";
  }

  // 优先级2：在导入列表中（可本地播放）
  // 使用更宽松的匹配逻辑：忽略大小写和首尾空格
  const normalizedFileName = fileName.trim().toLowerCase();
  const isInImportList = importListFileNames.some(
    (importFileName) => importFileName.trim().toLowerCase() === normalizedFileName
  );

  // 调试日志：打印文件名匹配情况（仅对特定文件名或匹配失败时）
  if (!isInImportList && fileName.includes('Ken Arai')) {
    console.log('[音乐状态] 文件匹配失败:', {
      fileName,
      normalizedFileName,
      isUploaded,
      isInImportList,
      importListFileNamesCount: importListFileNames.length,
      importListFileNamesSample: importListFileNames.filter(f => f.includes('Ken Arai') || f.includes('Aube')),
      importListFileNamesNormalized: importListFileNames
        .filter(f => f.includes('Ken Arai') || f.includes('Aube'))
        .map(f => ({ original: f, normalized: f.trim().toLowerCase() }))
    });
  }

  if (isInImportList) {
    return "online";
  }

  // 优先级3：离线（无法播放）
  return "offline";
}

/**
 * 将数据库字段名（snake_case）转换为前端字段名（camelCase）
 * 并解析JSON字符串字段
 */
function convertToCamelCase<T extends Record<string, any>>(
  item: T,
  importListFileNames: string[] = []
): Record<string, any> {
  const result: Record<string, any> = {};

  // 需要解析为JSON的字段名（snake_case格式）
  const jsonFields = ['instruments', 'scenarios', 'film_scenes', 'styles', 'creators', 'metadata', 'other_features', 'candidate_terms', 'emotion_tags'];

  for (const [key, value] of Object.entries(item)) {
    // 转换 snake_case 到 camelCase
    const camelKey = key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());

    // 如果是需要解析的字段且是字符串，尝试解析JSON
    if (jsonFields.includes(key) && typeof value === 'string' && value.trim()) {
      try {
        result[camelKey] = JSON.parse(value);
      } catch (error) {
        // 解析失败，保持原样
        result[camelKey] = value;
      }
    } else {
      result[camelKey] = value;
    }
  }

  // 动态计算 musicStatus 字段
  result.musicStatus = calculateMusicStatus(
    result.isUploaded,
    result.fileName,
    importListFileNames
  );

  return result;
}

/**
 * GET /api/music-analyses/search
 * 按分类维度检索音乐分析记录
 * 支持单维度或多维度组合检索
 * 支持搜索、排序、分页
 *
 * 查询参数：
 * - category: 分类维度（emotion, film, scenario, instrument, style）- 多维度时不使用此参数
 * - labels: 标签值数组，逗号分隔（如："治愈,欢快"）- 单维度时使用
 * - emotions: 情绪标签，逗号分隔 - 多维度时使用
 * - films: 影视配乐标签，逗号分隔 - 多维度时使用
 * - scenarios: 场景标签，逗号分隔 - 多维度时使用
 * - instruments: 乐器标签，逗号分隔 - 多维度时使用
 * - styles: 风格标签，逗号分隔 - 多维度时使用
 * - query: 快速搜索文本（支持按文件名、ID搜索）
 * - isOnline: 在线状态过滤（true=仅在线，false=仅未在线，undefined=全部，默认undefined）
 * - isUploaded: 上传状态过滤（true=仅上传，undefined=不限制，默认undefined）
 * - importListFileNames: 导入列表中的文件名数组，逗号分隔（用于动态计算musicStatus）
 * - sortBy: 排序字段（createdAt, fileName）
 * - sortOrder: 排序方向（asc, desc）
 * - page: 页码（从1开始）
 * - limit: 每页条数
 *
 * 【重要】isOnline 和 isUploaded 的组合用法：
 * - 在线状态（musicStatus='online'）：isOnline=true && isUploaded=false
 * - 云端状态（musicStatus='cloud'）：isUploaded=true
 * - 离线状态（musicStatus='offline'）：isOnline=false && isUploaded=false
 *
 * 返回数据：
 * - musicStatus: 动态计算的状态字段（"cloud" | "online" | "offline"）
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    console.log('[搜索API] 收到搜索请求，完整参数：', searchParams.toString());

    const category = searchParams.get("category") as
      | "emotion"
      | "film"
      | "scenario"
      | "instrument"
      | "style"
      | null;

    // 获取分页参数
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "10");
    const skip = (page - 1) * limit;

    // 获取排序参数
    const sortBy = searchParams.get("sortBy") as "createdAt" | "fileName" || "createdAt";
    const sortOrder = searchParams.get("sortOrder") as "asc" | "desc" || "desc";

    // 获取快速搜索参数
    const query = searchParams.get("query") || "";
    console.log('[搜索API] 快速搜索参数 query:', query);

    // 获取在线状态参数（undefined=全部，默认返回全部数据）
    const isOnlineParam = searchParams.get("isOnline");
    let isOnline: boolean | undefined = undefined; // 默认返回全部数据
    if (isOnlineParam !== null) {
      isOnline = isOnlineParam === "true" ? true : (isOnlineParam === "false" ? false : undefined);
    }

    // 获取上传状态参数（undefined=不限制，默认不限制）
    const isUploadedParam = searchParams.get("isUploaded");
    let isUploaded: boolean | undefined = undefined;
    if (isUploadedParam !== null) {
      isUploaded = isUploadedParam === "true";
    }

    // 获取导入列表文件名参数（用于动态计算musicStatus）
    const importListFileNamesParam = searchParams.get("importListFileNames");
    const importListFileNames = importListFileNamesParam
      ? importListFileNamesParam.split(",").map(s => s.trim())
      : [];

    console.log('[搜索API] 导入列表文件名数量:', importListFileNames.length);
    console.log('[搜索API] 导入列表文件名列表（前5个）:', importListFileNames.slice(0, 5));

    // 单维度检索
    if (category) {
      const labelsParam = searchParams.get("labels");
      if (!labelsParam) {
        return NextResponse.json(
          {
            success: false,
            error: "Missing labels parameter",
          },
          { status: 400 }
        );
      }

      const labels = labelsParam.split(",").map((s) => s.trim());
      const results = await musicAnalysisManager.searchByCategory(
        category,
        labels,
        isOnline
      ) as any[]; // 使用 any 类型绕过类型检查，因为原始 SQL 返回 snake_case 字段

      // 调试：打印单维度检索原始数据（前3条）
      console.log('[搜索API] 单维度检索原始数据（前3条）:', results.slice(0, 3).map(r => ({
        id: r.id,
        fileName: r.file_name,
        isOnline: r.is_online,
        isUploaded: r.is_uploaded
      })));

      // 在客户端进行过滤和分页（简化实现）
      let filteredResults = results;

      // 快速搜索过滤
      if (query) {
        const queryLower = query.toLowerCase();
        filteredResults = results.filter(
          (item) =>
            (item.file_name || '').toLowerCase().includes(queryLower) ||
            item.id.toLowerCase().includes(queryLower)
        );
      }

      // 排序
      filteredResults.sort((a, b) => {
        if (sortBy === "fileName") {
          const aValue = (a.file_name || '').toLowerCase();
          const bValue = (b.file_name || '').toLowerCase();
          return sortOrder === "asc" ? (aValue > bValue ? 1 : -1) : aValue < bValue ? 1 : -1;
        } else {
          // createdAt 可能是Date对象或字符串，也可能为null/undefined
          const aTime = a.created_at ? (typeof a.created_at === 'string' ? new Date(a.created_at).getTime() : a.created_at.getTime()) : 0;
          const bTime = b.created_at ? (typeof b.created_at === 'string' ? new Date(b.created_at).getTime() : b.created_at.getTime()) : 0;
          return sortOrder === "asc" ? (aTime > bTime ? 1 : -1) : aTime < bTime ? 1 : -1;
        }
      });

      // 分页
      const paginatedResults = filteredResults.slice(skip, skip + limit);

      // 转换字段名（snake_case -> camelCase）并动态计算 musicStatus
      const camelCaseResults = paginatedResults.map(item =>
        convertToCamelCase(item, importListFileNames)
      );

      // 调试：打印前3条数据的在线状态（单维度检索）
      console.log('[搜索API] 单维度检索返回数据示例（前3条）:', camelCaseResults.slice(0, 3).map(r => ({
        id: r.id,
        fileName: r.fileName,
        isOnline: r.isOnline,
        isUploaded: r.isUploaded,
        musicStatus: r.musicStatus
      })));

      return NextResponse.json({
        success: true,
        data: camelCaseResults,
        count: paginatedResults.length,
        total: filteredResults.length,
        page,
        totalPages: Math.ceil(filteredResults.length / limit),
      });
    }

    // 多维度组合检索
    const filters: {
      emotions?: string[];
      films?: string[];
      scenarios?: string[];
      instruments?: string[];
      styles?: string[];
    } = {};

    if (searchParams.has("emotions")) {
      filters.emotions = searchParams
        .get("emotions")!
        .split(",")
        .map((s) => s.trim());
    }
    if (searchParams.has("films")) {
      filters.films = searchParams
        .get("films")!
        .split(",")
        .map((s) => s.trim());
    }
    if (searchParams.has("scenarios")) {
      filters.scenarios = searchParams
        .get("scenarios")!
        .split(",")
        .map((s) => s.trim());
    }
    if (searchParams.has("instruments")) {
      filters.instruments = searchParams
        .get("instruments")!
        .split(",")
        .map((s) => s.trim());
    }
    if (searchParams.has("styles")) {
      filters.styles = searchParams
        .get("styles")!
        .split(",")
        .map((s) => s.trim());
    }

    // 如果没有任何过滤参数，返回所有记录
    let results;
    if (Object.keys(filters).length === 0) {
      results = await musicAnalysisManager.getAnalyses({
        skip: 0,
        limit: 10000, // 获取所有记录，然后在客户端进行过滤
        sortBy,
        sortOrder,
        isOnline, // 添加在线状态过滤
        isUploaded, // 添加上传状态过滤
      }) as any[]; // 使用 any 类型绕过类型检查
    } else {
      results = await musicAnalysisManager.searchByFilters(filters, isOnline, isUploaded) as any[]; // 使用 any 类型绕过类型检查
    }

    // 在客户端进行过滤、排序和分页
    let filteredResults = results;

    // 快速搜索过滤
    if (query) {
      const queryLower = query.toLowerCase();
      console.log('[搜索API] 开始快速搜索过滤，query:', query, '原始结果数:', results.length);
      filteredResults = results.filter(
        (item) =>
          (item.file_name || '').toLowerCase().includes(queryLower) ||
          item.id.toLowerCase().includes(queryLower)
      );
      console.log('[搜索API] 快速搜索过滤后结果数:', filteredResults.length);
    }

    // 排序（如果后端已经排序，这里会重新排序）
    filteredResults.sort((a, b) => {
      if (sortBy === "fileName") {
        const aValue = (a.file_name || '').toLowerCase();
        const bValue = (b.file_name || '').toLowerCase();
        return sortOrder === "asc" ? (aValue > bValue ? 1 : -1) : aValue < bValue ? 1 : -1;
      } else {
        // createdAt 可能是Date对象或字符串，也可能为null/undefined
        const aTime = a.created_at ? (typeof a.created_at === 'string' ? new Date(a.created_at).getTime() : a.created_at.getTime()) : 0;
        const bTime = b.created_at ? (typeof b.created_at === 'string' ? new Date(b.created_at).getTime() : b.created_at.getTime()) : 0;
        return sortOrder === "asc" ? (aTime > bTime ? 1 : -1) : aTime < bTime ? 1 : -1;
      }
    });

    // 分页
    const paginatedResults = filteredResults.slice(skip, skip + limit);

    // 调试：打印前3条数据的在线状态（转换前）
    console.log('[搜索API] 原始数据示例（转换前，前3条）:', results.slice(0, 3).map(r => ({
      id: r.id,
      fileName: r.file_name,
      isOnline: r.is_online,
      isUploaded: r.is_uploaded
    })));

    // 转换字段名（snake_case -> camelCase）并动态计算 musicStatus
    const camelCaseResults = paginatedResults.map(item =>
      convertToCamelCase(item, importListFileNames)
    );

    // 调试：打印前3条数据的在线状态（转换后）
    console.log('[搜索API] 返回数据示例（转换后，前3条）:', camelCaseResults.slice(0, 3).map(r => ({
      id: r.id,
      fileName: r.fileName,
      isOnline: r.isOnline,
      isUploaded: r.isUploaded,
      musicStatus: r.musicStatus
    })));

    return NextResponse.json({
      success: true,
      data: camelCaseResults,
      count: paginatedResults.length,
      total: filteredResults.length,
      page,
      totalPages: Math.ceil(filteredResults.length / limit),
      filters,
    });
  } catch (error: any) {
    console.error("Error searching music analyses:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Failed to search music analyses",
      },
      { status: 500 }
    );
  }
}
