import { imageToProductInfoPrompt, systemRoleTemplate } from '@/lib/prompts/image-to-product-info'
import { VisionService } from './vision-service'

/**
 * 系统信息接口
 */
export interface SystemInfo {
  id: string;
  name: string;
  description?: string;
}

/**
 * 处理图片提炼产品基础信息的服务
 */
export class ImageToProductInfoService {
  /**
   * 从图片中提炼产品基础信息
   * @param imageUrls 图片URL列表
   * @param onContent 普通内容流式回调
   * @param onReasoning 推理过程内容流式回调
   * @param systemInfo 系统信息
   * @param userSupplement 用户补充信息
   */
  async extractProductInfo(
    imageUrls: string[],
    onContent: (content: string) => void,
    onReasoning?: (content: string) => void,
    systemInfo?: SystemInfo,
    userSupplement?: string
  ): Promise<void> {
    try {
      if (imageUrls.length === 0) {
        throw new Error('请至少选择一个图片文件进行分析')
      }

      console.log('处理图片文件，图片URL数量:', imageUrls.length);
      
      // 构建提示词
      const prompt = this.buildPrompt(systemInfo, userSupplement);
      
      // 构建系统角色提示
      const systemPrompt = systemRoleTemplate;
      
      // 使用VisionService处理
      const visionService = new VisionService();
      await visionService.analyzeImage(
        imageUrls,
        prompt,
        onReasoning || (() => {}),
        onContent,
        systemPrompt
      );
    } catch (error) {
      console.error(`提炼产品基础信息失败:`, error)
      throw error
    }
  }
  
  /**
   * 构建完整提示词，替换所有占位符
   * @param systemInfo 系统信息
   * @param userSupplement 用户补充信息
   * @returns 完整提示词
   */
  private buildPrompt(systemInfo?: SystemInfo, userSupplement?: string): string {
    // 复制模板
    let finalPrompt = imageToProductInfoPrompt;
    
    // 简单替换系统信息
    if (systemInfo) {
      finalPrompt = finalPrompt.replace('{{SYSTEM_NAME}}', systemInfo.name);
      finalPrompt = finalPrompt.replace('{{SYSTEM_DESCRIPTION}}', systemInfo.description || '未提供系统描述');
      
      console.log('添加系统信息到提示词:', {
        systemName: systemInfo.name,
        hasDescription: !!systemInfo.description
      });
    } else {
      finalPrompt = finalPrompt.replace('{{SYSTEM_NAME}}', '未知系统');
      finalPrompt = finalPrompt.replace('{{SYSTEM_DESCRIPTION}}', '未提供系统描述');
    }
    
    // 替换用户补充信息
    finalPrompt = finalPrompt.replace('{{USER_SUPPLEMENT}}', userSupplement || '无补充信息');
    
    return finalPrompt;
  }
} 