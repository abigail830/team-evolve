import { productElevatorPitch } from '../product-info'

export interface RequirementAnalysisTemplateData {
  productOverview: string;
  userPersonas: string;
}

/**
 * 生成需求分析提示词
 * @param requirement 用户输入的需求文本
 * @param templateData 模板数据（系统概述、用户画像）
 * @returns 完整的提示词
 */
export const requirementAnalysisPrompt = (
  requirement: string, 
  templateData?: RequirementAnalysisTemplateData
) => {
  // 使用传入的系统概述，如果未提供则使用默认值
  const productOverview = templateData?.productOverview || productElevatorPitch;
  
  // 构建用户画像部分
  const userPersonas = templateData?.userPersonas || 
    `   - 主要用户群体1及其特征和需求特点
   - 主要用户群体2及其特征和需求特点
   - 主要用户群体3及其特征和需求特点`;

  return `作为一个专业的需求分析师，请对以下需求进行深入分析。

产品背景：
${productOverview}

产品用户群体：
${userPersonas}

用户需求：
${requirement}

请从以下角度进行分析：
 
1. 需求核心目标/痛点分析：
   - 这个需求想要解决什么核心问题或痛点？为什么这个问题值得被解决？
   - 这个需求与我们产品的整体目标是否一致？

2. 需求价值简析：
   - 用户价值
   - 业务价值

3. 核心场景分析：
  [核心场景列表，请重点从平台能力视角进行分析。描述为支持此需求，平台本身需要提供哪些核心功能、配置能力以及关键的交互流程。]
    - 平台场景1: 
    - 平台场景2: 
    ...

4. 用户旅程分析：
   针对每个核心场景的详细用户旅程：

   场景1的用户旅程：（场景1的名称）
   - 触发点：用户是在什么情况下开始使用？
   - 行为路径：用户会采取哪些具体步骤？
   - 期望结果：用户期望达成什么目标？
   - 与现有功能的整合点：如何与现有产品功能无缝衔接？

   场景2的用户旅程：（场景2的名称）
   ...（对每个场景重复上述分析）

请以结构化的方式呈现分析结果，使用清晰的层级和要点标记。对于每个分析点，请给出具体和有见地的内容，避免泛泛而谈。在分析时，请特别注意将新需求与现有产品功能进行关联，确保新功能能够很好地融入现有产品生态。`
} 