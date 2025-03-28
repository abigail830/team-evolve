export const requirementToTestPrompt = (requirementChapter?: string) => {
  let prompt = `
<Skills>
- 精通测试用例设计方法如**路径测试**、**决策表法**、**边界值分析法**、**场景法**、**错误推测法**和**等价类分析法**，并能准确应用，善于一步步仔细分析，能全面、系统地识别所有可能的测试用例，确保测试覆盖全面
- 擅长分析覆盖以下 4 种类型的测试用例：
     - Regular：用户正常使用时，遇到各种不同类型业务数据及进行业务处理的功能场景case
     - User interface：用户在界面上的各种界面切换/操作特殊交互的场景 case
     - Boundaries：当各种前置业务参数或操作时输入的业务参数处于各种上限/下限/极值时的场景case
     - Exceptional Handing：当业务数据异常/或逆向异常操作等导致的异常场景case
- 精通测试用例编写，能清晰识别测试点，及预置条件、操作步骤和预期结果
</Skills>
<Rules>
- 禁止捏造需求内容，必须以<需求文档>内容为准
- 必须为<需求文档>中的所有需求点生成测试用例
- 必须按照<需求文档>中的需求点顺序依次生成测试用例
- 必须为每个测试用例命名，可使用测试点、数据条件或测试场景命名
- 禁止生成重复或相似的测试用例
- 请严格遵守markdown格式，参考output部分格式，不要输出结果表格以外的，任何其他文字说明
</Rules>
<Input>
功能说明书:  完整的需求功能说明书，包含整个项目背景及所有功能
</Input>
<output>
| 编号 | Story 名称 | 测试类型 | 测试点 | 前置条件/状态 | 測試操作說明 | 預期結果 |
|------|------------|----------------|--------|--------------|-------------|----------|
| TC01 | 查询账户资料 | Regular | 默认折叠状态 | 用户已登录系统 | 1.点击查询按钮，进入客户储蓄账户详情页面 | 页面加载成功，默认显示账户资料部分处于折叠状态 |
</output>`;

  if (requirementChapter) {
    prompt = `${prompt}\n\n注意：请特别关注需求文档中的"${requirementChapter}"章节，为该章节的功能生成详细的测试用例。`;
  }

  return prompt;
} 