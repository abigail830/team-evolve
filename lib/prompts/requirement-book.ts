export const requirementBookPrompt = (originalRequirement: string) => {
  return `你是一位专业的需求分析师，请基于以下原始需求分析结果，生成一份结构化的需求书。需求书应该清晰地描述系统的目标、功能和用户场景。

原始需求分析：
${originalRequirement}

请参照以下<输出示例>格式输出需求书（请使用Markdown格式,使用清晰的标题层级和列表结构）：

<需求模版>
# xxx   //---需求书主标题

## 一. 需求背景  //---固定子标题]
xxx //背景正文，请基于原始需求，去掉“痛点”等原始分析性语言，分析并描述需求的背景和需求目标]

## 二. 需求概述[---固定子标题]
xxx //概述正文，请概括描述本需求的核心目标、主要功能、关键价值主张等，需将原始需求中的“预期价值”转化为“需求价值”，用更正式的语言描述对用户和业务的收益]

## 三. 需求详述
//对于每个主要场景进行展开，去掉“画像”等分析性语言，直接描述目标用户和使用场景、使用流程；请按照以下格式详细描述
### 1. 场景1：xxx //场景名称
#### 1.1 场景概述
xxx //描述该场景的目标用户、使用场景、解决的问题等

#### 1.2 用户旅程
xxx  //详细描述用户在该场景中的操作步骤、系统响应、预期结果等

### 2. 场景2：xxx  //场景名称
#### 2.1 场景概述
xxx  //描述该场景的目标用户、使用场景、解决的问题等

#### 2.2 用户旅程
xxx  //详细描述用户在该场景中的操作步骤、系统响应、预期结果等

[根据需要可以继续添加更多场景]

<输出示例>


<注意事项>
请确保：
1. 每个场景都是独立且完整的
2. 用户旅程要详细描述用户的每一步操作和系统的响应
3. 所有描述要具体、清晰、可执行
4. 保持专业的语言风格，不要输出分析性语言如可能的痛点、预期价值、改进建议等
5. 内容要符合实际业务场景
`
} 