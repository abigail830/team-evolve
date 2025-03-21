import { AIModelConfig } from '@/lib/services/ai-service'
import { getDefaultAIConfig } from '@/lib/services/ai-config-service'
import { streamingAICall } from '@/lib/services/ai-service'

/**
 * 处理需求书转测试用例的服务
 */
export class RequirementToTestService {
  /**
   * 流式调用API，将需求文档转换为测试用例
   * @param fileIds 上传的文件ID列表
   * @param onContent 流式返回内容回调
   * @param requirementChapter 需求章节描述（可选）
   */
  async convertToTest(
    fileIds: string[],
    onContent: (content: string) => void,
    requirementChapter?: string
  ): Promise<void> {
    try {
      const config = await getDefaultAIConfig()
      if (!config) {
        throw new Error('未找到AI配置信息')
      }

      console.log(`[${new Date().toISOString()}] 开始调用convertToTest，模型: ${config.model}，文件ID: ${fileIds.join(', ')}`)
      console.log(`需求章节信息: ${requirementChapter || '无'}`)

      if (fileIds.length === 0) {
        throw new Error('请至少选择一个文件进行转换')
      }

      // 获取文件内容
      const files = await this.getFilesData(fileIds)
      console.log(`获取到 ${files.length} 个文件的内容`)

      // 构建提示词
      const prompt = `请将以下文件转换为测试用例：
文件列表：${fileIds.join(', ')}
${requirementChapter ? `需求章节：${requirementChapter}` : ''}`

      // 使用统一的streamingAICall方法
      await streamingAICall(
        prompt,
        config,
        onContent,
        (error: string) => {
          throw new Error(`生成测试用例失败: ${error}`)
        }
      )

      console.log(`[${new Date().toISOString()}] 转换完成`)
    } catch (error) {
      console.error(`[${new Date().toISOString()}] 生成测试用例失败:`, error)
      throw error
    }
  }

  /**
   * 获取文件内容
   * @param fileIds 文件ID列表
   * @returns 文件内容数组
   */
  private async getFilesData(fileIds: string[]): Promise<Array<{id: string, name: string, type: string, base64Data: string}>> {
    // 从localStorage获取文件信息
    const filesData = []
    
    for (const fileId of fileIds) {
      const fileKey = `uploaded_file_${fileId}`
      const fileDataStr = localStorage.getItem(fileKey)
      
      if (fileDataStr) {
        const fileData = JSON.parse(fileDataStr)
        filesData.push({
          id: fileData.id,
          name: fileData.name,
          type: fileData.type,
          base64Data: fileData.base64Data
        })
      }
    }
    
    return filesData
  }
} 