/**
 * 计算文件的MD5值
 * 用于音乐文件的唯一标识，检测重复上传
 */
export async function calculateFileMD5(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = async (event) => {
      try {
        const arrayBuffer = event.target?.result as ArrayBuffer;
        const hashBuffer = await crypto.subtle.digest('SHA-256', arrayBuffer);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
        resolve(hashHex);
      } catch (error) {
        reject(error);
      }
    };

    reader.onerror = () => {
      reject(new Error('Failed to read file'));
    };

    reader.readAsArrayBuffer(file);
  });
}

/**
 * 批量计算文件的MD5值
 * @param files 文件数组
 * @returns MD5值数组（与输入文件的顺序一致）
 */
export async function calculateBatchMD5(files: File[]): Promise<string[]> {
  const md5Promises = files.map(file => calculateFileMD5(file));
  return Promise.all(md5Promises);
}
