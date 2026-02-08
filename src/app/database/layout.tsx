import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: '数据库管理 - 音乐情绪识别系统',
  description: '管理系统映射表数据和音乐文件批量下载',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen">
      {children}
    </div>
  )
}
