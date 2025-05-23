export const requirementToMdPrompt = `你需要把给定的<需求文档>整理为markdown代码格式。遵循<Rules>，按照给定的<Instructions>进行整理输出。

<Rules>
1. 认真仔细，严格根据<workflow>要求仔细整理
2. **禁止改变原来内容、措辞和语义**
3. **禁止添加、杜撰内容**
4. **Markdownd表格中**禁止加空格**，保持精炼节约token
5. **禁止加空行和分隔符(---)，保持精炼以节约token**
6. **输出语言与给定需求文档语言一致**，禁止翻译
</Rules>

<Instructions>
#1. 先通读<需求文档>内容，理解主要内容
#2. 识别并删除无效内容：
    - 仔细阅读原文，如果原文中章节标题后明确标注了**（先不做）**、**(不需要）**，在整理输出时把这个章节删除；
    - 如果原文中中某一行内容标注了**（先不做）**、**(不需要）**，则整理输出时把这行内容移除。
#3. 逐句阅读文档内容，做格式整理：
    - **除了2中删除的内容，禁止遗漏文档中的任何依据原文和细节文字**
#4. 格式整理要求
##4.1 区分背景和需求正文
    - 文档中除了具体的产品需求内容，可能会通过**需求概述**、**需求背景**、**术语解释**之类的信息，是具体需求的上下文，但不是具体要细化分析的需求主体。 
    - 如果识别出了这类信息**需求概述**、**需求背景**、**术语解释**这类与需求主体无关的信息，统一放在第一章节"需求背景"下；如果没有，则直接输出需求主体内容。
##4.2 层次结构：
    - 标题层次：根据内容逻辑调整标题层级（一级标题#，二级标题##，三级标题###，四级标题####等），尽量与原文层次保持一致。   
    - 标题内部层次结构：使用合适的列表（如-、1.等）标注层级关系，子项应以缩进或嵌套列表体现，尽量与原文层次保持一致。
    - 章节序号：对照原有内容，整理章节序号，确保每层内的内容序号正确合理。
##4.3 表格处理：
    - 将文档中的表格内容整理为Markdown表格，确保表头、列对齐清晰。
    - Markdownd表格中**禁止加空格**，保持精炼节约token
##4.4 关键内容突出：
    - 使用加粗（**）或斜体（*）格式化文档中的重点内容或关键字。
##4.5 图片、代码、URL等处理：
    - 路径及代码格式：对操作路径、指令等内容使用反引号（\`\`）进行代码格式化 
    - 对图片、资源等保留占位符，使用![Image](#)形式标记
##4.6 错别字、笔误处理：
    - 对文档中可能的错别字、拼写错误、笔误，在其后加(?)表示提醒
    - 对文档中提到的参考XXX、参照XXX，但给定文档中又未能找到的，也在其后加(?)表示提醒
#5. 整理检查，使用markdown代码格式输出（只输出markdown内容，不要输出其他markdown以外的描述/补充说明等）
    - 对照整理结果和原文文档，确保除了标注不要的内容之外，没有遗漏任何细节
    - 确保遵守原文内容、措辞和语义
    - 根据<Rules>做检查和纠正
</Instructions>` 