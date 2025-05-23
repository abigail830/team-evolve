'use client'

import { useState, useRef, useEffect } from 'react'
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { useToast } from "@/components/ui/use-toast"
import { streamingAICall } from '@/lib/services/ai-service'
import { Card } from "@/components/ui/card"
import { Loader2, Copy, Download, Edit2, Save, ArrowRight, Pin, PinOff } from "lucide-react"
import { requirementAnalysisPrompt } from '@/lib/prompts/requirement-analysis'
import { updateTask } from '@/lib/services/task-service'
import { useRouter } from 'next/navigation'
import { Toaster } from "@/components/ui/toaster"
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { recordRequirementAction } from '@/lib/services/requirement-action-service'
import { useRequirementAnalysisStore } from '@/lib/stores/requirement-analysis-store'
import { useSystemStore, type System } from '@/lib/stores/system-store'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { SystemInfoService } from '@/lib/services/system-info-service'

export default function RequirementAnalysis() {
  // 获取当前选中的系统
  const { systems, selectedSystemId } = useSystemStore()
  const selectedSystem = systems.find(s => s.id === selectedSystemId) || null
  
  // 使用新的 store 结构，直接获取当前激活系统的字段
  const { 
    currentSystemId,
    requirement,
    pinnedAnalysis,
    isPinned,
    setCurrentSystem,
    setRequirement, 
    pinAnalysis, 
    unpinAnalysis,
    getActiveAnalysis
  } = useRequirementAnalysisStore()

  // 自定义函数保存到localStorage - 修复linter错误
  const saveCurrentSystemToRedis = async (): Promise<void> => {
    if (!currentSystemId) {
      console.error('无法保存：没有选中的系统ID')
      return
    }

    try {
      // 从store获取当前相关字段并保存
      const store = useRequirementAnalysisStore.getState()
      
      // 确保当前系统的ID匹配
      if (store.currentSystemId !== currentSystemId) {
        console.error('系统ID不匹配，无法保存')
        return
      }

      // 构建需要保存的数据
      const systemData = {
        requirement: store.requirement,
        pinnedAnalysis: store.pinnedAnalysis,
        requirementBook: store.requirementBook,
        pinnedRequirementBook: store.pinnedRequirementBook,
        isPinned: store.isPinned,
        isRequirementBookPinned: store.isRequirementBookPinned,
        imageDraft: store.imageDraft,
      }
      
      // 保存到localStorage
      const systemKey = `req_analysis_system_${currentSystemId}`
      localStorage.setItem(systemKey, JSON.stringify(systemData))
      console.log(`已保存系统 ${currentSystemId} 的状态到 localStorage`)
    } catch (error) {
      console.error('保存到localStorage失败:', error)
      throw error
    }
  }

  // 确保已设置当前系统
  useEffect(() => {
    if (selectedSystem?.id && selectedSystem.id !== currentSystemId) {
      console.log('设置当前系统:', selectedSystem.id)
      setCurrentSystem(selectedSystem.id)

      // 尝试从localStorage获取数据，检查是否有缓存的数据
      try {
        const storageKey = `req_analysis_system_${selectedSystem.id}`
        const cachedData = localStorage.getItem(storageKey)
        if (cachedData) {
          console.log('找到缓存的需求分析数据:', storageKey)
          // localStorage中存在数据，会通过setCurrentSystem自动加载
        } else {
          console.log('未找到缓存的需求分析数据:', storageKey)
        }
      } catch (error) {
        console.error('读取localStorage缓存失败:', error)
      }
    }
  }, [selectedSystem, currentSystemId, setCurrentSystem])

  // 使用本地state管理当前分析结果
  const [analysis, setAnalysis] = useState<string>('')
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [editedAnalysis, setEditedAnalysis] = useState('')
  const [editStartTime, setEditStartTime] = useState<number | null>(null)
  const [editTarget, setEditTarget] = useState<'main' | 'pinned'>('main')
  const originalContent = useRef<string>('')
  const { toast } = useToast()
  const router = useRouter()

  // 页面加载后打印数据状态
  useEffect(() => {
    // 延迟执行以确保数据加载完成
    const timer = setTimeout(() => {
      // 安全地获取长度，避免undefined错误
      const requirementLength = requirement ? requirement.length : 0
      const pinnedAnalysisLength = pinnedAnalysis ? pinnedAnalysis.length : 0
      const currentAnalysisLength = analysis ? analysis.length : 0
      
      console.log('当前数据状态:', {
        系统ID: currentSystemId,
        需求内容长度: requirementLength,
        固定分析内容长度: pinnedAnalysisLength,
        是否固定: isPinned,
        当前分析内容长度: currentAnalysisLength
      })
    }, 1000)
    
    return () => clearTimeout(timer)
  }, [currentSystemId, requirement, pinnedAnalysis, isPinned, analysis])

  // 页面卸载时保存数据到Redis
  useEffect(() => {
    return () => {
      if (currentSystemId) {
        saveCurrentSystemToRedis()
          .catch((err: Error) => console.error('保存到Redis失败:', err))
      }
    }
  }, [currentSystemId])

  // 当需求内容变化时，保存到 store
  const handleRequirementChange = (value: string) => {
    if (selectedSystem?.id) {
      setRequirement(value)
    }
  }

  const handleSubmit = async () => {
    if (!selectedSystem?.id) {
      toast({
        title: "请先选择系统",
        description: "需要先选择一个系统才能进行分析",
        variant: "destructive",
        duration: 3000
      })
      return
    }

    if (!requirement.trim()) {
      toast({
        title: "请输入需求",
        description: "需求内容不能为空",
        variant: "destructive",
        duration: 3000
      })
      return
    }

    setIsAnalyzing(true)
    setAnalysis('')

    try {
      // 获取系统特定的模板数据
      console.log(`正在获取系统 ${selectedSystem.id} 的模板数据...`)
      const templateData = await SystemInfoService.prepareRequirementAnalysisTemplateData(selectedSystem.id)
      
      // 生成提示词 - 传递系统特定的模板数据
      console.log('正在生成提示词...')
      const prompt = requirementAnalysisPrompt(requirement, templateData)
      
      let currentAnalysis = '';
      await streamingAICall(
        prompt,
        (content: string) => {
          currentAnalysis += content;
          setAnalysis(currentAnalysis);
        },
        (error: string) => {
          toast({
            title: "分析失败",
            description: error,
            variant: "destructive",
            duration: 3000
          })
        }
      )
    } catch (error) {
      console.error('需求分析失败:', error)
      toast({
        title: "分析失败",
        description: error instanceof Error ? error.message : "请稍后重试",
        variant: "destructive",
        duration: 3000
      })
    } finally {
      setIsAnalyzing(false)
    }
  }

  const handleCopy = async (content: string) => {
    try {
      await navigator.clipboard.writeText(content)
      toast({
        title: "复制成功",
        description: "分析内容已复制到剪贴板",
        duration: 3000
      })
    } catch (error) {
      toast({
        title: "复制失败",
        description: "请手动选择并复制内容",
        variant: "destructive",
        duration: 3000
      })
    }
  }

  const handleDownload = (content: string, suffix: string = '') => {
    try {
      const blob = new Blob([content], { type: 'text/markdown' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
      a.href = url
      a.download = `需求分析${suffix}-${timestamp}.md`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      
      toast({
        title: "下载成功",
        description: "分析内容已保存为 Markdown 文件",
        duration: 3000
      })
    } catch (error) {
      toast({
        title: "下载失败",
        description: "请手动复制内容并保存",
        variant: "destructive",
        duration: 3000
      })
    }
  }

  const handleEdit = (target: 'main' | 'pinned' = 'main') => {
    setIsEditing(true)
    setEditTarget(target)
    
    if (target === 'main') {
      setEditedAnalysis(analysis)
      originalContent.current = analysis
    } else {
      setEditedAnalysis(pinnedAnalysis || '')
      originalContent.current = pinnedAnalysis || ''
    }
    
    setEditStartTime(Date.now())
  }

  const handleSave = async () => {
    if (!selectedSystem?.id) return

    const editEndTime = Date.now()
    const editDuration = editStartTime ? (editEndTime - editStartTime) / 1000 : 0
    const contentDiff = editedAnalysis.length - originalContent.current.length

    // 确保内容不为空或未定义
    const originalText = originalContent.current || '';
    const editedText = editedAnalysis || '';
    
    console.log('当前编辑内容信息', {
      originalLength: originalText.length,
      editedLength: editedText.length,
      diff: contentDiff,
      duration: editDuration,
      systemId: selectedSystem.id
    });
    
    // 降低条件阈值以方便测试，以后可以改回正常值
    if (editDuration > 5 && Math.abs(contentDiff) > 5) {
      try {
        // 显式传递内容，确保非空
        const result = await recordRequirementAction(
          selectedSystem.id,
          {
            type: 'edit',
            duration: editDuration,
            contentBefore: originalText,
            contentAfter: editedText,
          }
        )
        console.log('编辑记录结果', result);
      } catch (error) {
        console.error('记录编辑动作失败:', error)
      }
    }

    if (editTarget === 'main') {
      setAnalysis(editedAnalysis)
    } else if (editTarget === 'pinned' && isPinned) {
      // 更新固定的分析内容
      pinAnalysis(editedAnalysis)
    }
    
    setIsEditing(false)
    setEditStartTime(null)
    
    toast({
      title: "保存成功",
      description: "分析内容已更新",
      duration: 3000
    })
  }

  const handleTogglePin = () => {
    if (!selectedSystem?.id) return
    
    if (isPinned) {
      // 取消固定时，如果当前没有analysis内容，将pinnedAnalysis的内容移到analysis中
      // 这样内容不会因为取消pin而消失
      if (!analysis && pinnedAnalysis) {
        setAnalysis(pinnedAnalysis)
      }
      unpinAnalysis()
      toast({
        title: "已取消固定",
        description: "分析内容已取消固定",
        duration: 3000
      })
    } else {
      pinAnalysis(analysis)
      // 固定后清空当前分析结果，这样就不会立即显示两列
      setAnalysis('')
      toast({
        title: "已固定",
        description: "分析内容已固定，可以生成新的分析进行对比",
        duration: 3000
      })
    }

    // 自动保存到Redis
    if (currentSystemId) {
      saveCurrentSystemToRedis()
        .catch((err: Error) => console.error('保存到Redis失败:', err))
    }
  }

  const handleConfirm = async () => {
    if (!selectedSystem?.id) return
    
    try {
      // 获取活跃的分析内容（优先使用固定的内容）
      const activeAnalysis = getActiveAnalysis() || analysis
      
      // 如果内容没有被pin，则自动pin到store中
      if (!isPinned && analysis) {
        pinAnalysis(analysis)
      }
      
      // 保存到Redis
      await saveCurrentSystemToRedis()
      
      // 记录需求分析完成的动作
      await recordRequirementAction(
        selectedSystem.id,
        {
          type: 'analyze',
          duration: 0,  // 这里的持续时间不重要
          contentAfter: activeAnalysis,  // 最终的分析结果
        }
      );
      
      await updateTask('requirement-analysis', {
        status: 'completed'
      })
      toast({
        title: "需求分析完成",
        description: "已更新任务状态",
        duration: 3000
      })
      router.push('/ai-capability/book')
    } catch (error) {
      toast({
        title: "状态更新失败",
        description: error instanceof Error ? error.message : "请稍后重试",
        variant: "destructive",
        duration: 3000
      })
    }
  }

  // 确认对话框
  const handleConfirmWithDialog = async () => {
    if (!selectedSystem?.id) return

    if (isPinned && pinnedAnalysis && analysis) {
      // 如果有固定的内容和新的内容，弹窗确认使用哪个
      if (confirm('您有固定的分析内容和新的分析内容，是否使用固定的内容继续？点击"确定"使用固定内容，点击"取消"使用新内容。')) {
        // 使用固定的内容
        await handleConfirm()
      } else {
        // 使用新内容，先更新活跃内容
        pinAnalysis(analysis)
        await handleConfirm()
      }
    } else {
      // 只有一个内容，直接确认
      // 注意：handleConfirm中会自动处理pin的逻辑
      await handleConfirm()
    }
  }

  // 渲染图标按钮
  const renderIconButton = (icon: React.ReactNode, label: string, onClick: () => void, className: string = "", disabled: boolean = false) => {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              onClick={onClick}
              className={`h-8 w-8 rounded-full ${className}`}
              disabled={disabled}
            >
              {icon}
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            {label}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    )
  }

  return (
    <>
      <div className="mx-auto py-6 w-[90%]">
        <div className="space-y-6">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">原始需求分析</h1>
            <p className="text-muted-foreground mt-2 text-sm">
              请输入您的初步需求想法，我们将帮助您逐步细化和完善它。
            </p>
          </div>
          
          <div className="space-y-4">
            <Textarea
              placeholder="请描述您的需求想法..."
              className="min-h-[100px]"
              value={requirement}
              onChange={(e) => handleRequirementChange(e.target.value)}
            />
            <Button 
              onClick={handleSubmit} 
              className="w-full bg-orange-500 hover:bg-orange-600"
              disabled={isAnalyzing}
            >
              {isAnalyzing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  正在分析...
                </>
              ) : (
                '开始分析'
              )}
            </Button>

            {/* 只有当有固定内容和新分析内容时才显示两列 */}
            {isPinned && pinnedAnalysis && analysis ? (
              // 双列显示模式（固定内容 + 新内容）
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  {/* 固定的内容（左侧） */}
                  <div className="space-y-4">
                    <div className="flex justify-end gap-1">
                      {renderIconButton(<Copy className="h-4 w-4" />, "复制内容", () => handleCopy(pinnedAnalysis), "text-gray-500 hover:text-gray-700", isAnalyzing)}
                      {renderIconButton(<Download className="h-4 w-4" />, "下载分析", () => handleDownload(pinnedAnalysis, '-固定'), "text-gray-500 hover:text-gray-700", isAnalyzing)}
                      {renderIconButton(<Edit2 className="h-4 w-4" />, "编辑内容", () => handleEdit('pinned'), "text-gray-500 hover:text-gray-700", isAnalyzing || isEditing)}
                      {renderIconButton(<PinOff className="h-4 w-4" />, "取消固定", handleTogglePin, "text-orange-600 hover:text-orange-700", isAnalyzing)}
                    </div>
                    <Card className="p-6 mt-4 border-orange-300 border-2">
                      <div className="text-sm font-medium text-orange-600 mb-2">固定的分析内容</div>
                      {isEditing && editTarget === 'pinned' ? (
                        <Textarea
                          value={editedAnalysis}
                          onChange={(e) => setEditedAnalysis(e.target.value)}
                          className="min-h-[600px] w-full resize-y"
                          disabled={isAnalyzing}
                        />
                      ) : (
                        <div className="space-y-4">
                          <ReactMarkdown 
                            remarkPlugins={[remarkGfm]}
                            components={{
                              h1: ({children}: {children: React.ReactNode}) => <h1 className="text-xl font-bold mb-2 pb-1 border-b">{children}</h1>,
                              h2: ({children}: {children: React.ReactNode}) => <h2 className="text-lg font-semibold mb-2 mt-3">{children}</h2>,
                              h3: ({children}: {children: React.ReactNode}) => <h3 className="text-base font-medium mb-1 mt-2">{children}</h3>,
                              p: ({children}: {children: React.ReactNode}) => <p className="text-gray-600 my-1 leading-normal text-sm">{children}</p>,
                              ul: ({children}: {children: React.ReactNode}) => <ul className="list-disc pl-4 my-1 space-y-0.5">{children}</ul>,
                              ol: ({children}: {children: React.ReactNode}) => <ol className="list-decimal pl-4 my-1 space-y-0.5">{children}</ol>,
                              li: ({children}: {children: React.ReactNode}) => <li className="text-gray-600 text-sm">{children}</li>,
                              blockquote: ({children}: {children: React.ReactNode}) => <blockquote className="border-l-4 border-gray-300 pl-3 my-1 italic text-sm">{children}</blockquote>,
                              code: ({children}: {children: React.ReactNode}) => <code className="bg-gray-100 rounded px-1 py-0.5 text-xs">{children}</code>,
                              table: ({children}: {children: React.ReactNode}) => <div className="overflow-x-auto my-4"><table className="min-w-full divide-y divide-gray-200 border border-gray-300 text-sm">{children}</table></div>,
                              thead: ({children}: {children: React.ReactNode}) => <thead className="bg-gray-50">{children}</thead>,
                              tbody: ({children}: {children: React.ReactNode}) => <tbody className="divide-y divide-gray-200">{children}</tbody>,
                              tr: ({children}: {children: React.ReactNode}) => <tr>{children}</tr>,
                              th: ({children}: {children: React.ReactNode}) => <th className="px-3 py-2 text-left font-medium text-gray-700 border-r border-gray-300 last:border-r-0">{children}</th>,
                              td: ({children}: {children: React.ReactNode}) => <td className="px-3 py-2 text-gray-600 border-r border-gray-300 last:border-r-0">{children}</td>,
                              pre: ({children}: {children: React.ReactNode}) => (
                                <div className="relative">
                                  <pre className="bg-gray-50 rounded-lg p-3 my-2 overflow-auto text-sm">{children}</pre>
                                  <div className="absolute top-0 right-0 p-1">
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-6 px-1.5 text-gray-500 hover:text-gray-700"
                                      onClick={() => {
                                        const codeContent = children?.toString() || '';
                                        navigator.clipboard.writeText(codeContent);
                                      }}
                                    >
                                      <Copy className="h-3 w-3" />
                                    </Button>
                                  </div>
                                </div>
                              )
                            }}
                          >
                            {pinnedAnalysis}
                          </ReactMarkdown>
                        </div>
                      )}
                    </Card>
                  </div>
                  
                  {/* 新的内容（右侧） */}
                  <div className="space-y-4">
                    <div className="flex justify-end gap-1">
                      {renderIconButton(<Copy className="h-4 w-4" />, "复制内容", () => handleCopy(analysis), "text-gray-500 hover:text-gray-700", isAnalyzing)}
                      {renderIconButton(<Download className="h-4 w-4" />, "下载分析", () => handleDownload(analysis, '-新'), "text-gray-500 hover:text-gray-700", isAnalyzing)}
                      {renderIconButton(<Edit2 className="h-4 w-4" />, "编辑内容", () => handleEdit('main'), "text-gray-500 hover:text-gray-700", isAnalyzing || isEditing)}
                      {renderIconButton(<Pin className="h-4 w-4" />, "固定此版本", handleTogglePin, "text-gray-500 hover:text-gray-700", isAnalyzing)}
                    </div>
                    <Card className="p-6 mt-4">
                      <div className="text-sm font-medium text-gray-600 mb-2">新的分析内容</div>
                      {isEditing && editTarget === 'main' ? (
                        <Textarea
                          value={editedAnalysis}
                          onChange={(e) => setEditedAnalysis(e.target.value)}
                          className="min-h-[600px] w-full resize-y"
                          disabled={isAnalyzing}
                        />
                      ) : (
                        <div className="space-y-4">
                          <ReactMarkdown 
                            remarkPlugins={[remarkGfm]}
                            components={{
                              h1: ({children}: {children: React.ReactNode}) => <h1 className="text-xl font-bold mb-2 pb-1 border-b">{children}</h1>,
                              h2: ({children}: {children: React.ReactNode}) => <h2 className="text-lg font-semibold mb-2 mt-3">{children}</h2>,
                              h3: ({children}: {children: React.ReactNode}) => <h3 className="text-base font-medium mb-1 mt-2">{children}</h3>,
                              p: ({children}: {children: React.ReactNode}) => <p className="text-gray-600 my-1 leading-normal text-sm">{children}</p>,
                              ul: ({children}: {children: React.ReactNode}) => <ul className="list-disc pl-4 my-1 space-y-0.5">{children}</ul>,
                              ol: ({children}: {children: React.ReactNode}) => <ol className="list-decimal pl-4 my-1 space-y-0.5">{children}</ol>,
                              li: ({children}: {children: React.ReactNode}) => <li className="text-gray-600 text-sm">{children}</li>,
                              blockquote: ({children}: {children: React.ReactNode}) => <blockquote className="border-l-4 border-gray-300 pl-3 my-1 italic text-sm">{children}</blockquote>,
                              code: ({children}: {children: React.ReactNode}) => <code className="bg-gray-100 rounded px-1 py-0.5 text-xs">{children}</code>,
                              table: ({children}: {children: React.ReactNode}) => <div className="overflow-x-auto my-4"><table className="min-w-full divide-y divide-gray-200 border border-gray-300 text-sm">{children}</table></div>,
                              thead: ({children}: {children: React.ReactNode}) => <thead className="bg-gray-50">{children}</thead>,
                              tbody: ({children}: {children: React.ReactNode}) => <tbody className="divide-y divide-gray-200">{children}</tbody>,
                              tr: ({children}: {children: React.ReactNode}) => <tr>{children}</tr>,
                              th: ({children}: {children: React.ReactNode}) => <th className="px-3 py-2 text-left font-medium text-gray-700 border-r border-gray-300 last:border-r-0">{children}</th>,
                              td: ({children}: {children: React.ReactNode}) => <td className="px-3 py-2 text-gray-600 border-r border-gray-300 last:border-r-0">{children}</td>,
                              pre: ({children}: {children: React.ReactNode}) => (
                                <div className="relative">
                                  <pre className="bg-gray-50 rounded-lg p-3 my-2 overflow-auto text-sm">{children}</pre>
                                  <div className="absolute top-0 right-0 p-1">
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-6 px-1.5 text-gray-500 hover:text-gray-700"
                                      onClick={() => {
                                        const codeContent = children?.toString() || '';
                                        navigator.clipboard.writeText(codeContent);
                                      }}
                                    >
                                      <Copy className="h-3 w-3" />
                                    </Button>
                                  </div>
                                </div>
                              )
                            }}
                          >
                            {analysis}
                          </ReactMarkdown>
                        </div>
                      )}
                    </Card>
                  </div>
                </div>
                
                {!isEditing && (
                  <Button 
                    onClick={handleConfirmWithDialog}
                    className="w-full bg-orange-500 hover:bg-orange-600 mt-4"
                    disabled={isAnalyzing}
                  >
                    <ArrowRight className="mr-2 h-4 w-4" />
                    确认并继续
                  </Button>
                )}
              </div>
            ) : (
              // 单列显示模式 - 显示固定内容或新分析内容
              (isPinned && pinnedAnalysis) || analysis ? (
                <div className="space-y-4">
                  <div className="flex justify-end gap-1">
                    {renderIconButton(<Copy className="h-4 w-4" />, "复制内容", () => handleCopy(isPinned && pinnedAnalysis ? pinnedAnalysis : analysis), "text-gray-500 hover:text-gray-700", isAnalyzing)}
                    {renderIconButton(<Download className="h-4 w-4" />, "下载分析", () => handleDownload(isPinned && pinnedAnalysis ? pinnedAnalysis : analysis), "text-gray-500 hover:text-gray-700", isAnalyzing)}
                    {!isEditing ? (
                      <>
                        {renderIconButton(<Edit2 className="h-4 w-4" />, "编辑内容", () => handleEdit(isPinned ? 'pinned' : 'main'), "text-gray-500 hover:text-gray-700", isAnalyzing)}
                        {isPinned ? 
                          renderIconButton(<PinOff className="h-4 w-4" />, "取消固定", handleTogglePin, "text-orange-600 hover:text-orange-700", isAnalyzing) :
                          renderIconButton(<Pin className="h-4 w-4" />, "固定内容", handleTogglePin, "text-gray-500 hover:text-gray-700", isAnalyzing)
                        }
                      </>
                    ) : (
                      renderIconButton(<Save className="h-4 w-4" />, "保存修改", handleSave, "text-orange-600 hover:text-orange-700", isAnalyzing)
                    )}
                  </div>
                  <Card className={`p-6 mt-4 ${isPinned ? 'border-orange-300 border-2' : ''}`}>
                    {isPinned && <div className="text-sm font-medium text-orange-600 mb-2">已固定的分析内容</div>}
                    {isEditing ? (
                      <Textarea
                        value={editedAnalysis}
                        onChange={(e) => setEditedAnalysis(e.target.value)}
                        className="min-h-[600px] w-full resize-y"
                        disabled={isAnalyzing}
                      />
                    ) : (
                      <div className="space-y-4">
                        <ReactMarkdown 
                          remarkPlugins={[remarkGfm]}
                          components={{
                            h1: ({children}: {children: React.ReactNode}) => <h1 className="text-xl font-bold mb-2 pb-1 border-b">{children}</h1>,
                            h2: ({children}: {children: React.ReactNode}) => <h2 className="text-lg font-semibold mb-2 mt-3">{children}</h2>,
                            h3: ({children}: {children: React.ReactNode}) => <h3 className="text-base font-medium mb-1 mt-2">{children}</h3>,
                            p: ({children}: {children: React.ReactNode}) => <p className="text-gray-600 my-1 leading-normal text-sm">{children}</p>,
                            ul: ({children}: {children: React.ReactNode}) => <ul className="list-disc pl-4 my-1 space-y-0.5">{children}</ul>,
                            ol: ({children}: {children: React.ReactNode}) => <ol className="list-decimal pl-4 my-1 space-y-0.5">{children}</ol>,
                            li: ({children}: {children: React.ReactNode}) => <li className="text-gray-600 text-sm">{children}</li>,
                            blockquote: ({children}: {children: React.ReactNode}) => <blockquote className="border-l-4 border-gray-300 pl-3 my-1 italic text-sm">{children}</blockquote>,
                            code: ({children}: {children: React.ReactNode}) => <code className="bg-gray-100 rounded px-1 py-0.5 text-xs">{children}</code>,
                            table: ({children}: {children: React.ReactNode}) => <div className="overflow-x-auto my-4"><table className="min-w-full divide-y divide-gray-200 border border-gray-300 text-sm">{children}</table></div>,
                            thead: ({children}: {children: React.ReactNode}) => <thead className="bg-gray-50">{children}</thead>,
                            tbody: ({children}: {children: React.ReactNode}) => <tbody className="divide-y divide-gray-200">{children}</tbody>,
                            tr: ({children}: {children: React.ReactNode}) => <tr>{children}</tr>,
                            th: ({children}: {children: React.ReactNode}) => <th className="px-3 py-2 text-left font-medium text-gray-700 border-r border-gray-300 last:border-r-0">{children}</th>,
                            td: ({children}: {children: React.ReactNode}) => <td className="px-3 py-2 text-gray-600 border-r border-gray-300 last:border-r-0">{children}</td>,
                            pre: ({children}: {children: React.ReactNode}) => (
                              <div className="relative">
                                <pre className="bg-gray-50 rounded-lg p-3 my-2 overflow-auto text-sm">{children}</pre>
                                <div className="absolute top-0 right-0 p-1">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-6 px-1.5 text-gray-500 hover:text-gray-700"
                                    onClick={() => {
                                      const codeContent = children?.toString() || '';
                                      navigator.clipboard.writeText(codeContent);
                                    }}
                                  >
                                    <Copy className="h-3 w-3" />
                                  </Button>
                                </div>
                              </div>
                            )
                          }}
                        >
                          {isPinned && pinnedAnalysis ? pinnedAnalysis : analysis}
                        </ReactMarkdown>
                      </div>
                    )}
                  </Card>
                  
                  {!isEditing && (
                    <Button 
                      onClick={handleConfirmWithDialog}
                      className="w-full bg-orange-500 hover:bg-orange-600 mt-4"
                      disabled={isAnalyzing}
                    >
                      <ArrowRight className="mr-2 h-4 w-4" />
                      确认并继续
                    </Button>
                  )}
                </div>
              ) : null
            )}
          </div>
        </div>
      </div>
      <Toaster />
    </>
  )
} 