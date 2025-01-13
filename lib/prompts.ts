import { getFormattedArchitecture } from './architecture-service'

export const boundaryAnalysisPromptTemplate = `
<Role_Goal>
你作为一个有着丰富经验、认真细心的的需求分析助理，善于结合相关的业务知识，识别出需求初稿中可能遗漏的重要需求点，尤其是边界Case。
</Role_Goal>

<Input>
<需求初稿>{requirements_doc}</需求初稿>
<检查项>
{rules_table}
</检查项>
</Input>

<Rules>
1. **禁止杜撰需求内容，必须以<需求初稿>内容为准**
2. **严格按照<Instructions>中的步骤和方法进行分析，禁止跳过任何步骤**
3. **禁止生成重复或相似的Case**，**每个步骤最多输出 2 个遗漏 case**，**每个场景最多输出  6 个遗漏 case**
4. **注意输出时场景的层次结构与初稿保持一致**
5. **禁止添加"补充Case"之类的前缀**，节省Token
</Rules>

<Instruction>
1. 先通读<需求初稿>，确保完全理解
2. 依次针对<需求初稿>分析涉及的功能点，一步一步仔细思考，分析识别遗漏的边界case
3. 找到<需求初稿>中功能的主要使用场景，依次针对<需求初稿>中的每个<场景>，一步一步仔细思考，分析识别遗漏的Case**：
    3.1 逐句阅读每个<场景>下的每一条<交互步骤>及<预期结果>，确保完全理解
        - 逐行阅读<检查项>列表，获得每一行的<检查项>及对应的<边界Case检查点>
        - 针对<边界Case检查点>中的每一条检查点，分析识别对应<步骤>中遗漏的Case，每个Case列为1个条目，表达格式参考该<检查项>对应的<示例-识别出的遗漏Case>：如"1、用户背景已设置为非空背景时，默认处理规则？ 2、用户当前背景已是背景4时，是否重复切换？ 3、服务端无背景数据返回时，如何处理？"
        - **每个步骤最多输出3个遗漏case**，**每个场景最多输出6个遗漏case**
        - **确保选取与使用场景最相关且最重要的case**
        - 直到<检查项>的每一行的都完成
    3.2 进行下一个<场景>的检查，直至完成所有<场景>的遗漏Case补充。
4 按照<Rules>进行检查和纠正。
5 按照<Output>中的Markdown代码格式，整理输出所有遗漏case。
</Instruction>

<Output>示例
- **XXX** (场景名称，同初稿中的小标题，层次与初稿保持一致）
    1. XXX  (步骤描述，同初稿中的小标题，层次与初稿保持一致）
        - 补充Case简述XXXX  (30字以内的初稿中遗漏的Case简述)
        - 补充Case简述XXXX  (30字以内的初稿中遗漏的Case简述)
    2. XXX (步骤描述，同初稿中的小标题，层次与初稿保持一致）
        - 补充Case简述XXXX  (30字以内的初稿中遗漏的Case简述)
    ...
</Output>
`

export const userJourneyPromptTemplate = `
<Role_Goal>
你作为一个专业的产品经理，善于结合相关的业务知识和需求背景，分析用户场景和用户交互旅程。
</Role_Goal>

<Input>
<需求初稿>{requirements_doc}</需求初稿>
</Input>

<Rules>
1. **禁止杜撰需求内容，必须以<需求初稿>内容为准**
2. **场景和交互步骤、预期结果输出措辞简洁精炼，避免冗余词汇**
3. **严格按照<Instructions>中的步骤和方法进行分析，禁止跳过任何步骤**
4. **注意输出的层次结构与初稿保持一致**
</Rules>

<Instruction>
# 1. <需求初稿>是针对该功能的初稿描述，进行通读，确保完全理解
# 2. **聚焦该功能的完整使用**，分析绕该功能使用的主要场景，通常包括成功使用的主路径、分支路径场景：
    - 成功使用该功能的主路径场景：起点可能为进入到功能如功能入口，终点为功能使用完成如退出，其中操作步骤为大多数用户惯常使用的交互操作流程步骤
    - 成功使用该功能的分支路径场景：起点和终点与主路径相同，但其中的交互操作步骤不同
# 3. 针对每个使用场景，分析列出用户操作时的交互步骤和每一步骤对应的预期结果，注意**场景命名/交互步骤和预期结果描述简洁精炼，避免冗余词汇**
# 4. 注意合并差异较小的使用场景，比如就是其中一个步骤操作细节或预期结果不同，此时进行合并，尽量减少输出内容的重复，**最多输出３个场景**
# 5. 按照<Rules>进行检查和纠正
# 6. 严格按markdown代码格式，输出用户场景及对应的旅程步骤结果 
</Instruction>

<Output>示例
- **XXX** (场景名称，同初稿中的小标题，层次与初稿保持一致）
    1. XXX  (步骤描述，同初稿中的小标题，层次与初稿保持一致）
        - 补充Case简述XXXX  (30字以内的初稿中遗漏的Case简述)
        - 补充Case简述XXXX  (30字以内的初稿中遗漏的Case简述)
    2. XXX (步骤描述，同初稿中的小标题，层次与初稿保持一致）
        - 补充Case简述XXXX  (30字以内的初稿中遗漏的Case简述)
    ...
</Output>
`

export const testCasePromptTemplate = `作为一位专业的软件测试专家，你精通测试用例设计方法如路径测试、决策表法、边界值分析法、场景法、错误推测法和等价类分析法，并能准确应用；善于一步步仔细分析，能全面、系统地识别所有可能的测试用例，确保测试覆盖全面

请根据以下需求信息，设计完整的测试用例。测试用例应该充分考虑 Happy Path、Sad Path 和 Exception Path。
需求信息：
{requirements_doc}

请按照以下规则设计测试用例：
1. 使用YAML格式输出，每个测试用例包含以下字段：
- type: 用例类型（HappyPath、SadPath、ExceptionPath）
- summary: 测试用例概述（15字内，简洁易懂）
- preconditions: 前提条件（明确列出所有前提条件）
- steps: 用例步骤(通常包含多个步骤，用1.2.3.4.5...表示；每个步骤只包含一个具体操作)
- expected_result: 预期结果（预期结果要具体且可验证）

2. 测试覆盖要求：
- 核心功能正常场景的用例
- 功能对应的边界条件的用例
- 功能对应的异常场景的用例(包括并不限于用户操作错误场景、系统异常处理场景)

请直接生成YAML格式内容，不要包含其他任何表格信息以外的文字描述：

test_cases:
  - type: "HappyPath"
    summary: "正常登录"
    preconditions: "系统正常运行，用户已注册"
    steps: |
      1.输入正确用户名
      2.输入正确密码
      3.点击登录按钮
    expected_result: "成功登录系统，跳转到首页"
  - type: ExceptionPath
    summary: "发送过程中出现未知异常"
    preconditions: "客户端安装并启动，尝试发送图片，出现未知异常"
    steps: |
      1. 打开聊天界面
      2. 选择图片并发送
      3. 模拟发生未知异常
    expected_result: "提示发送失败，出现未知异常"
`

export const optimizeRequirementsPromptTemplate = `请基于以下内容，优化原来的需求描述，并补充边界场景的处理方式。新的需求描述应该：
1. 逐个功能进行检视和生成
2. 针对每个功能描述生成测试用例：
    - 保持原始需求的核心功能不变，针对核心功能生成正常场景的测试用例
    - 补充所有已识别出的边界场景、异常场景对应的测试用例，严格遵循需求中已经包含的处理方式，不要篡改
    - 使用清晰的结构化格式,可参考输出示例

原始需求：
{requirements_doc}

基于旅程的边界分析结果：
{boundary_analysis_result}

<输出示例>
1. **需求概述**
本需求文档旨在扩展手机银行、公众号、网页等渠道中的机器人交互功能，主要包括客户发送图片及拍照的功能、机器人对图片内容的识别能力，以及在自研平台的数据看板中查看客户发送的图片聊天记录的功能。
2. **核心功能描述**
2.1 **客户发送图片并查看缩略图**
2.1.1 **功能概述**：客户在聊天界面可以选择"发送图片"或"拍照"功能。选择后，聊天框将反显客户所发送的图片缩略图，并支持查看原图。
2.1.2 **边界场景**：
- 客户在聊天界面点击"发送图片"或"拍照"按钮时：
    - 图片格式不支持：系统提示用户"格式不支持，请选择其他图片格式"。
    - 图片大小限制：限制上传图片的最大尺寸为5MB，超出限制时提示"图片大小超过5MB，请选择更小的图片"。
- 聊天框中显示所发送图片的缩略图。
    - 图片加载失败：聊天框提示"图片加载失败，请检查网络或重新发送"。
    - 加载动画或占位图：在图片加载过程中显示加载动画，确保用户体验。
- 客户点击缩略图查看原图。
    - 放大缩小操作：支持双指缩放操作以放大或缩小原图。
    - 原图加载失败处理：若原图无法加载，提示"原图加载失败，请检查网络或重试"。
2.2 **机器人识别客户发送的图片内容**
2.2.1 **功能概述**：机器人能够识别客户发送的图片内容并根据识别结果解答客户的问题。
2.2.2 **边界场景**：
- 机器人自动识别客户发送的图片。
    - 未能识别内容：返回默认回复"抱歉，我无法识别您发送的图片内容，请提供更多信息"。
    - 图片内容不符合识别范围：提示"您发送的图片不在识别范围内，请尝试发送其他类型的图片"。
- 机器人进行内容识别时。
    - 网络延迟处理：在识别过程中若出现网络延迟，显示"正在处理，请稍候..."的提示。
    - 识别结果不准确：允许客户反馈不准确的识别结果，提供"此结果不准确，反馈"功能。
- 机器人根据识别结果回复客户。
    - 回复内容为空：若机器人未能生成回复，提示"我暂时无法提供相关信息，请稍后再试"。
    - 多种内容识别：若识别出多种内容，机器人需优先回复最相关的内容，并提供"查看其他相关内容"选项。
...
</输出示例>

# 指令
请生成优化后的需求片段描述
` 

export const testFormatPromptTemplate = `作为一位专业的软件测试专家，请将以下测试描述格式化为标准的测试用例格式。

测试描述：
{test_description}

请遵循以下规则：
1. 分析测试描述中的内容，识别并拆分其中的不同用例场景，只识别原描述中包含的，不要额外再添加其他边界、异常场景
2.然后对每个用例场景分别提取以下信息：
   - 测试类型（HappyPath、SadPath、ExceptionPath）
   - 测试用例概述（20字内、简洁明了、准确反映测试意图，格式：功能模块_特定场景_关键操作和预期结果
   - 前提条件
   - 测试步骤
   - 预期结果
3. 格式化要求：
   - 用例步骤应该按1.2.3.4.5...编号
   - 每个步骤只包含一个具体操作
   - 预期结果要具体且可验证
   - 前提条件要完整且明确
4. 如果原始描述缺少某些信息，需要严谨合理地补充

请严格按照以下YAML格式输出，注意缩进和换行：
test_cases:
  - type: "HappyPath"
    summary: "登录成功"
    preconditions: "系统正常运行，用户已注册"
    steps: |
      1.输入正确用户名
      2.输入正确密码
      3.点击登录按钮
    expected_result: "成功登录系统，跳转到首页"
  - type: "SadPath"
    summary: "密码错误"
    preconditions: "系统正常运行，用户已注册"
    steps: |
      1.输入正确用户名
      2.输入错误密码
      3.点击登录按钮
    expected_result: "提示密码错误，停留在登录页面"

请直接生成YAML格式内容，不要包含其他任何描述：` 

export const generateFromStepsPromptTemplate = `作为一位专业的测试专家，请基于以下信息生成详细的测试步骤。

用例概述：
{summary}

操作路径：
{path}

请将简要的操作路径扩展为详细的测试步骤，每个步骤应该是一个具体的操作。
要求：
1. 每个步骤应该足够具体，能指导测试人员准确执行
2. 步骤应该按照合理的顺序排列
3. 每个步骤只包含一个具体操作
4. 尽量控制在7步以内

请使用以下YAML格式返回：

steps: |
  1. xxx
  2. xxx
  3. xxx`

export const generateSummaryPromptTemplate = `作为一位专业的测试专家，请基于以下测试用例细节，生成一个简洁而准确的用例概述。

前提条件：
{preconditions}

测试步骤：
{steps}

预期结果：
{expected_result}

请分析上述内容，生成一个能够概括测试要点的用例概述（15字以内）。

请使用JSON格式返回，包含以下字段：
- summary: 用例概述

示例输出：
{
  "summary": "验证知识库意图创建功能"
}`

export const optimizeSummaryPromptTemplate = `作为一位专业的测试专家，请帮助优化以下测试用例概述。

当前概述：
{current_summary}

一个好的测试用例概述应该：
1. 简洁明了（15字以内）
2. 准确反映测试意图
3. 包含以下要素：
   - 功能描述：明确测试的功能或模块
   - 场景或条件：指明测试的特定场景或前提条件
   - 行为或操作：描述用户将执行的关键操作
   - 预期结果：简单提及预期的结果或效应

好的概述示例：
- "登录功能-输入正确凭据时应成功登录"
- "知识库创建-必填项为空时应提示错误"
- "意图编辑-修改后应正确保存更新"

不好的概述示例：
- "测试登录功能"：过于笼统，没有具体说明测试的场景或条件
- "用户登录测试"：缺乏具体性，没有明确测试的类型或结果
- "创建知识库"：没有说明测试场景和预期结果

请分析当前概述并提供优化建议。请使用以下YAML格式返回：

optimized_summary: 优化后的概述
analysis: 分析当前概述存在的问题
improvements: 具体改进建议` 

export const generateDetailPromptTemplate = `你是一个专业的测试工程师，请根据以下信息生成完整的测试用例。

当前产品的功能架构信息如下：
{architecture_info}

用例概述：
{summary}

请基于产品功能架构信息，生成完整的测试用例细节。要求：
1. 前提条件要完整且明确，包括必要的环境、权限、数据等准备工作
2. 测试步骤要具体且符合产品的实际功能结构，每个步骤都要清晰可执行
3. 预期结果要对应每个测试步骤，且要有明确的验证点
4. 所有步骤和操作路径必须严格遵循产品的实际功能架构

请使用以下 YAML 格式返回：

preconditions: |
  前提条件内容...
steps: |
  1. 第一步...
  2. 第二步...
expected_result: |
  1. 第一步的预期结果...
  2. 第二步的预期结果...`
