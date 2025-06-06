import { streamingAICall } from '@/lib/services/ai-service'
import { requirementBookPrompt } from '@/lib/prompts/requirement-book'
import { RequirementParserService } from '@/lib/services/requirement-parser-service'
import { RequirementParseResult } from '@/lib/services/requirement-parser-service'
import { RequirementData } from '@/lib/services/task-control'
import { useRequirementAnalysisStore } from '@/lib/stores/requirement-analysis-store'

export class RequirementBookService {
  /**
   * 获取需求书模板
   * @param systemId 系统ID
   * @returns 需求书模板内容
   */
  public static async getRequirementTemplate(systemId: string): Promise<string> {
    if (!systemId) {
      throw new Error('请先选择一个系统')
    }

    try {
      // 从store中获取模板ID
      const store = useRequirementAnalysisStore.getState()
      
      // 确保当前系统ID匹配
      if (store.currentSystemId !== systemId) {
        console.warn('系统ID不匹配，可能导致模板获取错误')
      }
      
      // 检查是否已设置模板ID
      if (store.templateId) {
        console.log(`使用模板ID: ${store.templateId} 获取需求书模板`)
        
        // 通过API获取模板内容
        const response = await fetch(`/api/templates/${store.templateId}`)
        
        if (!response.ok) {
          throw new Error(`获取模板内容失败: ${response.status}`)
        }
        
        const templateData = await response.json()
        
        if (templateData && templateData.content) {
          console.log('成功获取需求书模板')
          return templateData.content
        } else {
          console.warn('模板内容为空，将使用默认模板')
          return this.getDefaultTemplate()
        }
      } else {
        // 如果没有设置模板ID，则尝试使用旧的API获取模板
        console.log('未设置模板ID，尝试使用系统默认模板')
        const response = await fetch(`/api/requirement-templates?systemId=${systemId}`)
        const data = await response.json()
        
        if (data.template?.content) {
          console.log('成功获取系统默认需求书模板')
          return data.template.content
        } else {
          console.log('未找到系统默认需求书模板，将使用默认模板')
          return this.getDefaultTemplate()
        }
      }
    } catch (error) {
      console.error('获取需求书模板失败:', error)
      throw new Error('获取需求书模板失败，请稍后重试')
    }
  }

  /**
   * 获取系统信息
   * @param systemId 系统ID
   * @returns 系统信息（电梯演讲和信息架构）
   */
  public static async getSystemInfo(systemId: string): Promise<{ overview: string, architecture: any[] }> {
    if (!systemId) {
      return { overview: '', architecture: [] }
    }

    try {
      console.log('开始获取系统信息...')
      const response = await fetch(`/api/systems/${systemId}/product-info`)
      
      if (!response.ok) {
        throw new Error(`获取系统信息失败: ${response.status}`)
      }
      
      const data = await response.json()
      console.log('成功获取系统信息')
      
      // 从响应中提取电梯演讲和信息架构
      return {
        overview: data.overview || '',
        architecture: Array.isArray(data.architecture) ? data.architecture : []
      }
    } catch (error) {
      console.error('获取系统信息失败:', error)
      // 出错时返回空信息，但不阻止流程继续
      return { overview: '', architecture: [] }
    }
  }

  /**
   * 生成需求书内容
   * @param originalRequirement 原始需求分析结果
   * @param systemId 系统ID
   * @param onContentUpdate 内容更新回调
   * @returns 生成的需求书内容
   */
  public static async generateRequirementBook(
    originalRequirement: string,
    systemId: string,
    onContentUpdate?: (content: string) => void
  ): Promise<string> {
    if (!originalRequirement.trim()) {
      throw new Error('需求内容不能为空')
    }

    if (!systemId) {
      throw new Error('请先选择一个系统')
    }

    console.log('开始获取需求书模版...')
    const reqTemplate = await this.getRequirementTemplate(systemId)
    
    console.log('开始获取系统信息...')
    const systemInfo = await this.getSystemInfo(systemId)
    
    // 将信息架构转换为文本描述
    const architectureText = this.formatArchitectureToText(systemInfo.architecture)

    console.log('开始生成需求书...')
    const prompt = requirementBookPrompt(
      originalRequirement, 
      reqTemplate, 
      systemInfo.overview,
      architectureText
    )
    
    let accumulatedContent = ''
    
    await streamingAICall(
      prompt,
      (content: string) => {
        accumulatedContent += content
        if (onContentUpdate) {
          onContentUpdate(accumulatedContent)
        }
      },
      (error: string) => {
        throw new Error(`需求书衍化失败: ${error}`)
      }
    )
    
    console.log('需求书生成完成')
    return accumulatedContent
  }

  /**
   * 将信息架构数组转换为文本描述
   * @param architecture 信息架构数组
   * @returns 格式化的信息架构文本
   */
  private static formatArchitectureToText(architecture: any[] = []): string {
    let architectureText = '';
    
    if (architecture && architecture.length > 0) {
      architectureText = '系统的信息架构结构如下：\n';
      
      const formatNode = (node: any, level = 0) => {
        const indent = '  '.repeat(level);
        let result = `${indent}- ${node.title}${node.description ? `: ${node.description}` : ''}\n`;
        
        if (node.children && node.children.length > 0) {
          node.children.forEach((child: any) => {
            result += formatNode(child, level + 1);
          });
        }
        return result;
      };
      
      architecture.forEach(node => {
        architectureText += formatNode(node);
      });
    }
    
    return architectureText;
  }

  /**
   * 处理需求书确认
   * 创建需求结构化任务和场景边界分析任务
   * @param requirementBook 需求书内容
   * @param systemId 系统ID（可选）
   * @returns 解析的需求内容
   */
  public static async processConfirmation(requirementBook: string, systemId?: string): Promise<RequirementParseResult> {
    try {
      // 解析需求书内容
      console.log('解析需求书内容...')
      const parser = new RequirementParserService()
      // 直接传递systemId给parseRequirement方法
      const parsedRequirement = parser.parseRequirement(requirementBook, systemId)
      
      // 只在有系统ID的情况下保存
      console.log('保存新的结构化内容...')
      if (systemId) {
        console.log(`按系统ID(${systemId})保存结构化内容...`)
        const storageKey = `requirement-structured-content-${systemId}`
        localStorage.setItem(storageKey, JSON.stringify(parsedRequirement))
      } else {
        console.warn('未提供系统ID，无法保存结构化内容到系统特定存储')
      }
      
      // 确保当前系统的状态被正确保存到localStorage,避免页面跳转导致的数据丢失问题
      if (systemId) {
        console.log(`确保系统 ${systemId} 的状态被正确保存...`)
        try {
          const store = useRequirementAnalysisStore.getState();
          // 检查当前是否是处理中的系统
          if (store.currentSystemId === systemId) {
            // 当前数据已经在store中，确保立即保存到localStorage
            // 从store获取当前相关字段并保存
            const systemData = {
              requirement: store.requirement,
              pinnedAnalysis: store.pinnedAnalysis,
              requirementBook: store.requirementBook,
              pinnedRequirementBook: store.pinnedRequirementBook,
              isPinned: store.isPinned,
              isRequirementBookPinned: store.isRequirementBookPinned,
              imageDraft: store.imageDraft,
            };
            
            // 获取localStorage键名
            const systemKey = `req_analysis_system_${systemId}`;
            
            // 直接保存到localStorage，确保数据不会丢失
            localStorage.setItem(systemKey, JSON.stringify(systemData));
            console.log(`已保存系统 ${systemId} 的状态到 localStorage`);
          }
        } catch (error) {
          console.warn(`保存系统 ${systemId} 状态失败:`, error);
          // 这里的错误不应该中断主要流程
        }
      }
      
      console.log('所有任务状态更新完成') 
      return parsedRequirement

    } catch (error) {
      console.error('任务状态更新失败:', error)
      throw error
    }
  }

  /**
   * 将解析结果适配为RequirementData格式
   * @param parsedRequirement 解析的需求
   * @returns RequirementData格式的数据
   */
  private static adaptToRequirementData(parsedRequirement: RequirementParseResult): RequirementData {
    return {
      reqBackground: parsedRequirement.contentBeforeScenes,
      reqBrief: parsedRequirement.contentAfterScenes,
      scenes: parsedRequirement.scenes
    }
  }

  /**
   * 获取默认的需求书模板
   * @returns 默认需求书模板
   */
  private static getDefaultTemplate(): string {
    return `# 需求书：{系统名称} 功能开发

## 修订记录

| 版本号 | 作者 | 操作日期 | 操作说明 |
|--------|------|----------|:---------|
| V1.0   |      |          | 创建     |

## 一. 需求背景

_描述项目的背景和起因，解释为什么需要开发此功能_

## 二. 需求概述

_概述本需求的核心目标、主要功能、关键价值主张等_

## 三. 功能需求

### 3.1 核心功能

_列出所有核心功能点_

### 3.2 业务规则

_描述相关的业务规则和限制条件_

## 四. 用户场景

_对于每个主要场景进行展开，描述目标用户和使用场景、使用流程_

### 场景1：{场景名称}

#### 场景概述

_描述该场景的目标用户、使用场景、解决的问题等_

#### 用户旅程

_详细描述用户在该场景中的操作步骤、系统响应、预期结果等_

### 场景2：{场景名称}

#### 场景概述

_描述该场景的目标用户、使用场景、解决的问题等_

#### 用户旅程

_详细描述用户在该场景中的操作步骤、系统响应、预期结果等_

## 五. 非功能需求

### 5.1 性能需求

_描述性能相关的需求，如响应时间、并发数等_

### 5.2 安全需求

_描述安全相关的需求，如数据加密、权限控制等_

### 5.3 可用性需求

_描述可用性相关的需求，如易用性、可访问性等_

## 六. 界面要求

_描述UI/UX相关的要求，可包含原型图或设计说明_

## 七. 技术要求

_描述技术实现相关的要求，如技术栈、架构要求等_

## 八. 数据要求

_描述数据相关的要求，如数据存储、迁移、备份等_

## 九. 验收标准

_描述验收的标准和条件，明确何时视为需求实现完成_

## 十. 附录

_其他相关信息，如术语表、参考文档等_`
  }
} 