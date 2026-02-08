import { getDb } from 'coze-coding-dev-sdk';

/**
 * 获取数据库原始client
 * 用于绕过Drizzle ORM的bug
 */
export async function getRawClient() {
  const db = await getDb();
  // @ts-ignore - 访问内部的client属性
  return db._.session.client;
}
