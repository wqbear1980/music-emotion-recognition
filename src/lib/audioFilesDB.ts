/**
 * IndexedDB 工具类：用于持久化存储音频文件列表数据
 * 解决 File 对象无法直接存储到 localStorage 的问题
 */

const DB_NAME = 'MusicEmotionDB';
const DB_VERSION = 1;
const STORE_NAME = 'audioFiles';

// 扩展 IDBDatabase 类型，添加 closed 属性
interface IDBDatabaseWithClosed extends IDBDatabase {
  closed: boolean;
}

export interface AudioFileItemDB {
  id: string;
  fileName: string;
  fileSize: number;
  fileType: string;
  fileData?: Blob; // 存储 File 对象的二进制数据
  audioUrl?: string;
  features: any;
  result: any;
  isAnalyzing: boolean;
  error: string;
  isUploading: boolean;
  uploadProgress?: number;
  uploadStatus: 'pending' | 'uploading' | 'success' | 'error';
  uploadError?: string;
  fileKey: string | null;
  isUploaded: boolean;
  isOnline: boolean;
  uploadedAt: string | null;
  selected: boolean;
  reAnalyzing: boolean;
  musicMd5?: string; // 文件MD5值，用于重复检测和本地缓存
}

class AudioFilesDB {
  private db: IDBDatabaseWithClosed | null = null;
  private isInitializing = false;
  private initPromise: Promise<void> | null = null;

  /**
   * 确保数据库连接有效
   */
  private async ensureConnected(): Promise<void> {
    // 如果正在初始化，等待初始化完成
    if (this.isInitializing && this.initPromise) {
      return this.initPromise;
    }

    // 如果数据库已打开且未关闭，直接返回
    if (this.db && this.db.closed === false) {
      return;
    }

    // 重新初始化
    this.isInitializing = true;
    this.initPromise = this.init();
    await this.initPromise;
    this.isInitializing = false;
  }

  /**
   * 执行带重试的事务操作
   * 在事务失败时自动重连并重试一次
   */
  private async executeWithRetry<T>(
    operation: (db: IDBDatabase) => Promise<T>
  ): Promise<T> {
    try {
      await this.ensureConnected();

      if (!this.db || this.db.closed) {
        throw new Error('数据库连接无效');
      }

      return await operation(this.db);
    } catch (error: any) {
      // 如果是 InvalidStateError 或连接错误，尝试重新连接后重试
      if (
        error.name === 'InvalidStateError' ||
        error.message?.includes('database connection is closing') ||
        error.message?.includes('数据库连接无效')
      ) {
        console.log('[AudioFilesDB] 检测到连接错误，尝试重新连接并重试...');

        // 强制重新初始化
        this.isInitializing = false;
        this.initPromise = null;
        if (this.db) {
          this.db.close();
        }
        this.db = null;

        // 重新连接
        await this.ensureConnected();

        if (!this.db || (this.db as IDBDatabaseWithClosed).closed === true) {
          throw new Error('重新连接失败');
        }

        // 重试操作
        return await operation(this.db);
      }

      throw error;
    }
  }

  /**
   * 初始化数据库连接
   */
  async init(): Promise<void> {
    // 如果已有有效连接，关闭旧连接
    if (this.db && !this.db.closed) {
      this.db.close();
      this.db = null;
    }

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => {
        console.error('[AudioFilesDB] 数据库打开失败:', request.error);
        this.isInitializing = false;
        reject(request.error);
      };

      request.onsuccess = () => {
        this.db = request.result as IDBDatabaseWithClosed;
        console.log('[AudioFilesDB] 数据库打开成功');
        this.isInitializing = false;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // 创建对象仓库
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
          // 创建索引以提高查询性能
          store.createIndex('fileName', 'fileName', { unique: false });
          store.createIndex('musicMd5', 'musicMd5', { unique: false });
          store.createIndex('isOnline', 'isOnline', { unique: false });
          store.createIndex('isUploaded', 'isUploaded', { unique: false });
          console.log('[AudioFilesDB] 对象仓库创建成功');
        }
      };
    });
  }

  /**
   * 保存所有音频文件（覆盖式）
   */
  async saveAll(audioFiles: any[]): Promise<void> {
    return this.executeWithRetry(async (db) => {
      return new Promise<void>((resolve, reject) => {
        try {
          const transaction = db.transaction([STORE_NAME], 'readwrite');
          const store = transaction.objectStore(STORE_NAME);

          // 先清空所有数据
          const clearRequest = store.clear();

          clearRequest.onsuccess = () => {
            // 然后逐个添加
            let addedCount = 0;
            const totalCount = audioFiles.length;

            if (totalCount === 0) {
              resolve();
              return;
            }

            audioFiles.forEach((item) => {
              const dbItem: AudioFileItemDB = {
                id: item.id,
                fileName: item.file?.name || item.fileName || '',
                fileSize: item.file?.size || 0,
                fileType: item.file?.type || '',
                fileData: item.file, // 存储 File 对象（Blob）
                audioUrl: item.audioUrl,
                features: item.features,
                result: item.result,
                isAnalyzing: item.isAnalyzing || false,
                error: item.error || '',
                isUploading: item.isUploading || false,
                uploadProgress: item.uploadProgress,
                uploadStatus: item.uploadStatus || 'pending',
                uploadError: item.uploadError,
                fileKey: item.fileKey || null,
                isUploaded: item.isUploaded || false,
                isOnline: item.isOnline !== undefined ? item.isOnline : true,
                uploadedAt: item.uploadedAt || null,
                selected: item.selected || false,
                reAnalyzing: item.reAnalyzing || false,
                musicMd5: item.musicMd5, // 保存MD5值用于本地缓存
              };

              const request = store.add(dbItem);

              request.onsuccess = () => {
                addedCount++;
                if (addedCount === totalCount) {
                  console.log(`[AudioFilesDB] 成功保存 ${addedCount} 个音频文件`);
                  resolve();
                }
              };

              request.onerror = () => {
                console.error('[AudioFilesDB] 保存失败:', request.error);
                reject(request.error);
              };
            });
          };

          clearRequest.onerror = () => {
            console.error('[AudioFilesDB] 清空失败:', clearRequest.error);
            reject(clearRequest.error);
          };
        } catch (error) {
          console.error('[AudioFilesDB] 创建事务失败:', error);
          reject(error);
        }
      });
    });
  }

  /**
   * 保存单个音频文件
   */
  async saveOne(audioFile: any): Promise<void> {
    return this.executeWithRetry(async (db) => {
      return new Promise<void>((resolve, reject) => {
        try {
          const transaction = db.transaction([STORE_NAME], 'readwrite');
          const store = transaction.objectStore(STORE_NAME);

          const dbItem: AudioFileItemDB = {
            id: audioFile.id,
            fileName: audioFile.file?.name || audioFile.fileName || '',
            fileSize: audioFile.file?.size || 0,
            fileType: audioFile.file?.type || '',
            fileData: audioFile.file,
            audioUrl: audioFile.audioUrl,
            features: audioFile.features,
            result: audioFile.result,
            isAnalyzing: audioFile.isAnalyzing || false,
            error: audioFile.error || '',
            isUploading: audioFile.isUploading || false,
            uploadProgress: audioFile.uploadProgress,
            uploadStatus: audioFile.uploadStatus || 'pending',
            uploadError: audioFile.uploadError,
            fileKey: audioFile.fileKey || null,
            isUploaded: audioFile.isUploaded || false,
            isOnline: audioFile.isOnline !== undefined ? audioFile.isOnline : true,
            uploadedAt: audioFile.uploadedAt || null,
            selected: audioFile.selected || false,
            reAnalyzing: audioFile.reAnalyzing || false,
            musicMd5: audioFile.musicMd5, // 保存MD5值用于本地缓存
          };

          const request = store.put(dbItem);

          request.onsuccess = () => {
            console.log(`[AudioFilesDB] 成功保存音频文件: ${dbItem.fileName}`);
            resolve();
          };

          request.onerror = () => {
            console.error('[AudioFilesDB] 保存失败:', request.error);
            reject(request.error);
          };
        } catch (error) {
          console.error('[AudioFilesDB] 创建事务失败:', error);
          reject(error);
        }
      });
    });
  }

  /**
   * 读取所有音频文件
   */
  async loadAll(): Promise<AudioFileItemDB[]> {
    return this.executeWithRetry(async (db) => {
      return new Promise<AudioFileItemDB[]>((resolve, reject) => {
        try {
          const transaction = db.transaction([STORE_NAME], 'readonly');
          const store = transaction.objectStore(STORE_NAME);
          const request = store.getAll();

          request.onsuccess = () => {
            console.log(`[AudioFilesDB] 成功加载 ${request.result.length} 个音频文件`);
            resolve(request.result);
          };

          request.onerror = () => {
            console.error('[AudioFilesDB] 读取失败:', request.error);
            reject(request.error);
          };
        } catch (error) {
          console.error('[AudioFilesDB] 创建事务失败:', error);
          reject(error);
        }
      });
    });
  }

  /**
   * 删除所有音频文件
   */
  async clearAll(): Promise<void> {
    return this.executeWithRetry(async (db) => {
      return new Promise<void>((resolve, reject) => {
        try {
          const transaction = db.transaction([STORE_NAME], 'readwrite');
          const store = transaction.objectStore(STORE_NAME);
          const request = store.clear();

          request.onsuccess = () => {
            console.log('[AudioFilesDB] 已清空所有音频文件');
            resolve();
          };

          request.onerror = () => {
            console.error('[AudioFilesDB] 清空失败:', request.error);
            reject(request.error);
          };
        } catch (error) {
          console.error('[AudioFilesDB] 创建事务失败:', error);
          reject(error);
        }
      });
    });
  }

  /**
   * 删除单个音频文件
   */
  async deleteOne(id: string): Promise<void> {
    return this.executeWithRetry(async (db) => {
      return new Promise<void>((resolve, reject) => {
        try {
          const transaction = db.transaction([STORE_NAME], 'readwrite');
          const store = transaction.objectStore(STORE_NAME);
          const request = store.delete(id);

          request.onsuccess = () => {
            console.log(`[AudioFilesDB] 已删除音频文件: ${id}`);
            resolve();
          };

          request.onerror = () => {
            console.error('[AudioFilesDB] 删除失败:', request.error);
            reject(request.error);
          };
        } catch (error) {
          console.error('[AudioFilesDB] 创建事务失败:', error);
          reject(error);
        }
      });
    });
  }

  /**
   * 根据MD5查询音频文件
   * 用于本地缓存，如果找到则返回该文件的分析结果
   */
  async getByMD5(musicMd5: string): Promise<AudioFileItemDB | null> {
    return this.executeWithRetry(async (db) => {
      return new Promise<AudioFileItemDB | null>((resolve, reject) => {
        try {
          const transaction = db.transaction([STORE_NAME], 'readonly');
          const store = transaction.objectStore(STORE_NAME);
          const index = store.index('musicMd5');
          const request = index.get(musicMd5);

          request.onsuccess = () => {
            if (request.result) {
              console.log(`[AudioFilesDB] 根据MD5 ${musicMd5} 找到本地缓存文件: ${request.result.fileName}`);
              resolve(request.result);
            } else {
              console.log(`[AudioFilesDB] 未找到MD5 ${musicMd5} 的本地缓存`);
              resolve(null);
            }
          };

          request.onerror = () => {
            console.error('[AudioFilesDB] 根据MD5查询失败:', request.error);
            reject(request.error);
          };
        } catch (error) {
          console.error('[AudioFilesDB] 创建事务失败:', error);
          reject(error);
        }
      });
    });
  }

  /**
   * 关闭数据库连接
   */
  async close(): Promise<void> {
    if (this.db) {
      this.db.close();
      this.db = null;
      console.log('[AudioFilesDB] 数据库连接已关闭');
    }
  }
}

// 导出单例
export const audioFilesDB = new AudioFilesDB();
