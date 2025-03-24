'use client'

import { useState, useRef, useEffect, useCallback, memo } from 'react'
import { useToast } from "@/components/ui/use-toast"
import { getDefaultAIConfig } from '@/lib/services/ai-config-service'
import type { AIModelConfig } from '@/lib/services/ai-service'
import { RequirementToMdService } from '@/lib/services/requirement-to-md-service'
import { RequirementToTestService } from '@/lib/services/requirement-to-test-service'
import { RequirementBoundaryComparisonService } from '@/lib/services/requirement-boundary-comparison-service'
import { RequirementTerminologyService } from '@/lib/services/requirement-terminology-service'
import { RequirementArchitectureService } from '@/lib/services/requirement-architecture-service'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Checkbox } from "@/components/ui/checkbox"
import { Button } from "@/components/ui/button"
import { Upload, File as FileIcon, X, Trash2, Download, Book, Loader2, AlertCircle, FileText, HelpCircle } from 'lucide-react'
import { Toaster } from "@/components/ui/toaster"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { flushSync } from 'react-dom'

// 添加全局样式
import './requirement-styles.css'

// 已上传文件类型定义
type UploadedFile = {
  id: string;
  name: string;
  uploadTime: Date;
  selected?: boolean;  // 新增：是否被选中
  provider: string; // 新增：文件提供者
};

// 添加内容显示组件，使用ReactMarkdown展示Markdown内容
const ContentDisplay = memo(({ content }: { content: string }) => {
  // 使用state存储当前渲染时间和状态
  const [renderTime, setRenderTime] = useState<string>(new Date().toISOString());
  const [isScrolling, setIsScrolling] = useState<boolean>(false);
  const [renderError, setRenderError] = useState<string | null>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  // 用于计算内容变化的参考
  const prevContentLength = useRef<number>(0);
  
  // 用于管理滚动和防抖
  const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // 内容变化时的处理
  useEffect(() => {
    try {
      // 设置渲染时间
      const now = new Date();
      setRenderTime(now.toISOString());
      
      // 计算内容长度变化
      const currentLength = content?.length || 0;
      const lengthDiff = currentLength - prevContentLength.current;
      
      // 只有内容有增加时才记录日志
      if (lengthDiff > 0) {
        console.log(`📄 [ContentDisplay] 内容更新: +${lengthDiff}字符，总计: ${currentLength}字符，时间: ${now.toISOString()}`);
      }
      
      // 更新前一次内容长度
      prevContentLength.current = currentLength;
      
      // 当内容变化且有实际内容时，立即滚动到底部
      if (contentRef.current && lengthDiff > 0) {
        // 清除之前的定时器
        if (scrollTimeoutRef.current) {
          clearTimeout(scrollTimeoutRef.current);
        }
        
        // 标记正在滚动
        setIsScrolling(true);
        
        // 使用RAF+setTimeout确保在DOM更新后再执行滚动
        scrollTimeoutRef.current = setTimeout(() => {
          if (contentRef.current) {
            try {
              // 使用 requestAnimationFrame 延迟到浏览器下一帧，确保DOM已更新
              requestAnimationFrame(() => {
                if (contentRef.current) {
                  // 使用scrollTo方法，更可靠
                  contentRef.current.scrollTo({
                    top: contentRef.current.scrollHeight,
                    behavior: 'auto' // 使用 'auto' 而非 'smooth'，避免流式内容时的连续滚动效果
                  });
                  
                  // 兜底方案：直接设置scrollTop
                  contentRef.current.scrollTop = contentRef.current.scrollHeight;
                  
                  // 确保滚动完成后更新状态
                  setTimeout(() => setIsScrolling(false), 50);
                }
              });
            } catch (e) {
              console.warn('滚动尝试失败，使用简单方法', e);
              // 兜底方案
              contentRef.current.scrollTop = contentRef.current.scrollHeight;
              setIsScrolling(false);
            }
          }
        }, 10);
      } else if (lengthDiff === 0) {
        // 内容没变化，不需要滚动
        setIsScrolling(false);
      }
      
      // 清除错误状态
      setRenderError(null);
    } catch (error) {
      console.error('内容处理错误', error);
      setRenderError(error instanceof Error ? error.message : '未知错误');
    }
    
    return () => {
      // 组件卸载时清除定时器
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
    };
  }, [content]); // 只在content变化时触发
  
  // 直接显示内容长度，便于调试
  const contentLength = content?.length || 0;

  // 如果内容为空，显示提示
  if (!content) {
    return (
      <div className="text-gray-500 text-sm flex items-center gap-2">
        <span>暂无内容</span>
      </div>
    );
  }

  // 如果内容是空白字符，也显示提示
  if (content.trim() === '') {
    return (
      <div className="text-gray-500 text-sm">
        内容为空白字符
      </div>
    );
  }

  // 如果有渲染错误
  if (renderError) {
    return (
      <div className="text-red-500 text-sm border border-red-300 p-2 rounded">
        <p>内容渲染错误: {renderError}</p>
        <p className="mt-1">原始内容长度: {contentLength} 字符</p>
        <pre className="mt-2 text-xs bg-gray-100 p-2 overflow-auto max-h-[200px]">{content}</pre>
      </div>
    );
  }

  // 尝试渲染Markdown
  const formattedTime = (() => {
    try {
      if (renderTime && renderTime.includes('T')) {
        return renderTime.split('T')[1].split('.')[0];
      }
      return new Date().toTimeString().split(' ')[0];
    } catch (e) {
      return new Date().toTimeString().split(' ')[0];
    }
  })();

  // 渲染内容
  return (
    <div ref={contentRef} className="prose prose-sm max-w-none break-words whitespace-pre-wrap relative">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
      <div className="text-xs text-gray-400 mt-2 flex justify-between">
        <span>当前内容长度: {contentLength} 字符</span>
        {isScrolling && <span className="text-orange-500">内容更新中...</span>}
        <span className="text-gray-400">更新时间: {formattedTime}</span>
      </div>
    </div>
  );
}, (prevProps, nextProps) => {
  // 优化：仅在内容实际变化时重渲染
  if (prevProps.content === nextProps.content) {
    return true; // 内容相同，不重渲染
  }
  
  // 当内容为空时，优先重渲染
  if (!prevProps.content || !nextProps.content) {
    return false;
  }
  
  // 内容长度变化超过阈值时，强制重渲染
  const lengthDiff = nextProps.content.length - prevProps.content.length;
  if (lengthDiff > 0) { // 任何内容增加都重渲染，确保实时更新流式内容
    return false;
  }
  
  // 默认重渲染
  return false;
});

ContentDisplay.displayName = 'ContentDisplay';

export default function RequirementUpload() {
  const [file, setFile] = useState<File | null>(null)
  const [error, setError] = useState<string>('')
  const [uploading, setUploading] = useState<boolean>(false)
  const [fileId, setFileId] = useState<string>('')
  const [aiConfig, setAiConfig] = useState<AIModelConfig | null>(null)
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([])
  const [mdContent, setMdContent] = useState<string>('')
  const [testContent, setTestContent] = useState<string>('')
  const [boundaryContent, setBoundaryContent] = useState<string>('')
  const [terminologyContent, setTerminologyContent] = useState<string>('')
  const [architectureContent, setArchitectureContent] = useState<string>('')
  const [isConverting, setIsConverting] = useState(false)
  const [isGeneratingTest, setIsGeneratingTest] = useState(false)
  const [isComparing, setIsComparing] = useState(false)
  const [isExtractingTerminology, setIsExtractingTerminology] = useState(false)
  const [isExtractingArchitecture, setIsExtractingArchitecture] = useState(false)
  const [fileSelectionAlert, setFileSelectionAlert] = useState<string>('')
  const [showChapterDialog, setShowChapterDialog] = useState(false)
  const [requirementChapter, setRequirementChapter] = useState('')
  const { toast } = useToast()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const dropAreaRef = useRef<HTMLDivElement>(null)
  const mdContentRef = useRef<HTMLDivElement>(null)
  const testContentRef = useRef<HTMLDivElement>(null)
  const boundaryContentRef = useRef<HTMLDivElement>(null)
  const terminologyContentRef = useRef<HTMLDivElement>(null)
  const terminologyTextRef = useRef<string>('')
  const architectureContentRef = useRef<HTMLDivElement>(null)
  
  // 批处理设置参数
  const batchSizeRef = useRef<number>(200); // 默认批量大小
  
  // 添加一个强制重新渲染的机制
  const [, forceUpdate] = useState({});
  
  // 添加标签页状态
  const [activeTab, setActiveTab] = useState<'md' | 'test' | 'boundary' | 'terminology' | 'architecture'>('md');
  
  // 创建一个状态来跟踪最后一次内容更新
  const [lastUpdateTime, setLastUpdateTime] = useState<number>(0);
  const pendingContentRef = useRef<string>('');
  
  // 监听内容变化，自动滚动到底部
  useEffect(() => {
    if (mdContentRef.current) {
      mdContentRef.current.scrollTop = mdContentRef.current.scrollHeight;
    }
    console.log('mdContent变化了，新长度:', mdContent.length);
  }, [mdContent]);

  useEffect(() => {
    if (testContentRef.current) {
      testContentRef.current.scrollTop = testContentRef.current.scrollHeight;
    }
    console.log('testContent变化了，新长度:', testContent.length);
  }, [testContent]);

  useEffect(() => {
    if (boundaryContentRef.current) {
      boundaryContentRef.current.scrollTop = boundaryContentRef.current.scrollHeight;
    }
    console.log('boundaryContent变化了，新长度:', boundaryContent.length);
  }, [boundaryContent]);

  useEffect(() => {
    if (terminologyContentRef.current) {
      terminologyContentRef.current.scrollTop = terminologyContentRef.current.scrollHeight;
    }
    console.log('terminologyContent变化了，新长度:', terminologyContent.length);
  }, [terminologyContent]);

  useEffect(() => {
    if (architectureContentRef.current) {
      architectureContentRef.current.scrollTop = architectureContentRef.current.scrollHeight;
    }
    console.log('architectureContent变化了，新长度:', architectureContent.length);
  }, [architectureContent]);

  // 当内容变化时，强制重新渲染
  useEffect(() => {
    // 确保只在客户端运行
    if (typeof window === 'undefined') return;
    
    const timer = setInterval(() => {
      if (isConverting || isGeneratingTest || isComparing || isExtractingTerminology || isExtractingArchitecture) {
        console.log('⏱️ 定时检查状态:', {
          isConverting,
          isGeneratingTest,
          isComparing,
          isExtractingTerminology,
          isExtractingArchitecture,
          时间: new Date().toISOString()
        });
        
        // 仅在有处理过程进行时才更新
        forceUpdate({});
      }
    }, 1000); // 降低到每秒更新一次，减少性能负担
    
    return () => clearInterval(timer);
  }, [isConverting, isGeneratingTest, isComparing, isExtractingTerminology, isExtractingArchitecture]);

  // 获取AI配置
  useEffect(() => {
    // 异步获取配置
    const loadConfig = async () => {
      const config = await getDefaultAIConfig()
      setAiConfig(config)
      
      if (!config) {
        setError('未设置AI模型配置，请先在设置中配置模型')
      } else {
        console.log('获取到AI模型配置:', {
          model: config.model,
          baseURL: config.baseURL
        })
      }
    }

    loadConfig()

    // 从localStorage恢复已上传文件列表
    const storedFiles = localStorage.getItem('uploaded-requirement-files')
    if (storedFiles) {
      try {
        const parsedFiles = JSON.parse(storedFiles)
        // 将字符串日期转换回Date对象
        const filesWithDates = parsedFiles.map((file: any) => ({
          ...file,
          uploadTime: new Date(file.uploadTime),
          selected: parsedFiles.length === 1 ? true : false, // 只有一个文件时默认选中
          provider: file.provider || 'openai' // 记录文件提供者
        }))
        setUploadedFiles(filesWithDates)
      } catch (e) {
        console.error('Failed to parse stored files:', e)
      }
    }
  }, [])

  // 当上传文件列表变化时，保存到localStorage
  useEffect(() => {
    if (uploadedFiles.length > 0) {
      localStorage.setItem('uploaded-requirement-files', JSON.stringify(uploadedFiles))
    }
  }, [uploadedFiles])

  const validateAndSetFile = (selectedFile: File) => {
    // 支持的文件类型列表
    const validTypes = [
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // docx
      'text/plain', // txt
      'application/pdf', // pdf
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // xlsx
      'text/markdown', // md
      'text/x-markdown' // md (别名)
    ];
    
    // 检查文件扩展名作为备选验证方式
    const fileExtension = selectedFile.name.split('.').pop()?.toLowerCase();
    const validExtensions = ['docx', 'txt', 'pdf', 'xlsx', 'md'];
    
    if (!validTypes.includes(selectedFile.type) && !validExtensions.includes(fileExtension || '')) {
      setError('不支持的文件格式，请上传 Word、TXT、PDF、Excel 或 Markdown 文件');
      return false;
    }

    setFile(selectedFile);
    return true;
  }
  
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    setError('')

    if (!selectedFile) {
      return
    }

    validateAndSetFile(selectedFile)
    
    // 选择文件后自动上传
    if (selectedFile) {
      setTimeout(() => {
        handleUploadFile(selectedFile);
      }, 100);
    }
  }

  // 处理拖拽事件
  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    if (dropAreaRef.current) {
      dropAreaRef.current.classList.add('border-orange-500')
    }
  }

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    if (dropAreaRef.current) {
      dropAreaRef.current.classList.remove('border-orange-500')
    }
  }

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    
    if (dropAreaRef.current) {
      dropAreaRef.current.classList.remove('border-orange-500')
    }
    
    const droppedFile = e.dataTransfer.files[0]
    if (droppedFile) {
      const isValid = validateAndSetFile(droppedFile)
      // 如果文件有效，自动上传
      if (isValid) {
        setTimeout(() => {
          handleUploadFile(droppedFile);
        }, 100);
      }
    }
  }

  const handleUploadFile = async (fileToUpload: File) => {
    if (!fileToUpload) {
      setError('请先选择文件')
      return
    }

    setUploading(true)
    setError('')

    try {
      const formData = new FormData()
      formData.append('file', fileToUpload)

      console.log(`正在上传文件...`)

      const response = await fetch('/api/upload-requirement', {
        method: 'POST',
        body: formData
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || '上传失败')
      }

      console.log('上传成功:', result)

      // 添加到文件列表
      setUploadedFiles(prev => [
        ...prev,
        {
          id: result.file.id,
          name: result.file.name,
          uploadTime: new Date(),
          selected: true,
          provider: result.file.provider
        }
      ])

      // 重置文件选择
      setFile(null)
      setError('')
      setFileId(result.file.id)
      toast({
        title: "上传成功",
        description: `文件 ${result.file.name} 已成功上传，文件ID: ${result.file.id}`,
      })
    } catch (error) {
      console.error('上传文件出错:', error)
      setError(error instanceof Error ? error.message : '未知错误')
      toast({
        variant: "destructive",
        title: "上传失败",
        description: error instanceof Error ? error.message : "未知错误",
      })
    } finally {
      setUploading(false)
    }
  }
  
  // 保留原有的handleUpload函数，但修改为使用handleUploadFile
  const handleUpload = async () => {
    if (!file) {
      setError('请先选择文件')
      return
    }
    
    await handleUploadFile(file);
  }

  const handleDeleteFile = (fileId: string) => {
    // 从已上传文件列表中移除文件
    const updatedFiles = uploadedFiles.filter(file => file.id !== fileId)
    
    // 如果删除后只剩一个文件，则自动选中
    if (updatedFiles.length === 1) {
      updatedFiles[0].selected = true
    }
    
    setUploadedFiles(updatedFiles)
    
    // 更新localStorage
    localStorage.setItem('uploaded-requirement-files', JSON.stringify(updatedFiles))
    
    // 显示删除成功的提示
    toast({
      title: "删除成功",
      description: "文件已从列表中移除",
    });
  };
  
  // 处理文件选择状态变更
  const handleSelectFile = (fileId: string, checked: boolean) => {
    // 更新为支持多选功能
    const updatedFiles = uploadedFiles.map(file => ({
      ...file,
      selected: file.id === fileId ? checked : file.selected
    }))
    
    setUploadedFiles(updatedFiles)
    localStorage.setItem('uploaded-requirement-files', JSON.stringify(updatedFiles))
  }

  // 处理需求书转MD
  const handleConvertToMd = async () => {
    if (uploadedFiles.length === 0) {
      toast({
        title: "转换失败",
        description: "请先上传至少一个文件",
        variant: "destructive",
      });
      return;
    }

    const selectedFiles = uploadedFiles.filter(file => file.selected);
    if (selectedFiles.length !== 1) {
      setFileSelectionAlert("需求书转MD功能一次只能处理一个文件，请只选择一个文件");
      return;
    }

    setFileSelectionAlert("");

    if (!aiConfig) {
      toast({
        title: "转换失败",
        description: "请先配置AI模型",
        variant: "destructive",
      });
      return;
    }

    // 清空之前的内容
    setMdContent('');
    setIsConverting(true);
    // 激活MD标签页
    setActiveTab('md');

    try {
      const service = new RequirementToMdService();

      await service.convertToMd(
        [selectedFiles[0].id],
        (content: string) => {
          console.log('收到新内容，长度:', content.length);
          // 使用函数式更新，确保基于最新状态
          setMdContent(prev => prev + content);
        }
      );
    } catch (error) {
      console.error('转换失败:', error);
      toast({
        title: "转换失败",
        description: error instanceof Error ? error.message : "未知错误",
        variant: "destructive",
      });
    } finally {
      console.log('转换完成');
      setIsConverting(false);
    }
  };

  // 处理下载MD文件
  const handleDownloadMd = () => {
    try {
      const blob = new Blob([mdContent], { type: 'text/markdown' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
      a.href = url
      a.download = `需求书-${timestamp}.md`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      
      toast({
        title: "下载成功",
        description: "需求书内容已保存为 Markdown 文件",
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

  // 处理打开需求章节输入弹窗
  const handleOpenTestDialog = () => {
    // 检查是否有文件上传
    if (uploadedFiles.length === 0) {
      toast({
        title: "转换失败",
        description: "请先上传至少一个文件",
        variant: "destructive",
      })
      return
    }
    
    // 检查是否有选中的文件
    const selectedFiles = uploadedFiles.filter(file => file.selected)
    if (selectedFiles.length === 0) {
      setFileSelectionAlert("请至少选择一个需求文件进行转换")
      return
    }
    
    setFileSelectionAlert("")

    if (!aiConfig) {
      toast({
        title: "转换失败",
        description: "请先配置AI模型",
        variant: "destructive",
      })
      return
    }

    // 打开弹窗
    setRequirementChapter('')
    setShowChapterDialog(true)
  }

  const handleConvertToTest = async () => {
    // 关闭弹窗
    setShowChapterDialog(false);
    
    // 清空之前的内容
    setTestContent('');
    setIsGeneratingTest(true);
    // 激活测试用例标签页
    setActiveTab('test');
    
    // 添加一个更明显的调试标记，确认函数被调用
    console.log('开始生成测试用例 - ' + new Date().toISOString());

    try {
      const service = new RequirementToTestService()
      const selectedFiles = uploadedFiles.filter(file => file.selected)
      const fileIds = selectedFiles.map(file => file.id)

      await service.convertToTest(
        fileIds,
        (content: string) => {
          console.log('收到新内容，长度:', content.length);
          // 使用函数式更新，确保基于最新状态
          setTestContent(prev => prev + content);
        },
        requirementChapter || undefined
      )

      console.log('生成测试用例完成 - ' + new Date().toISOString());
    } catch (error) {
      console.error('转换失败:', error)
      toast({
        title: "转换失败",
        description: error instanceof Error ? error.message : "未知错误",
        variant: "destructive",
      })
    } finally {
      setIsGeneratingTest(false);
      console.log('测试用例生成完成');
    }
  }

  // 处理下载测试用例
  const handleDownloadTest = () => {
    try {
      if (!testContent) {
        toast({
          title: "下载失败",
          description: "没有可下载的测试用例内容",
          variant: "destructive",
          duration: 3000
        })
        return
      }

      const blob = new Blob([testContent], { type: 'text/markdown' })
      const url = URL.createObjectURL(blob)
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
      
      const a = document.createElement('a')
      a.href = url
      a.download = `测试用例-${timestamp}.md`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      
      toast({
        title: "下载成功",
        description: "测试用例内容已保存为 Markdown 文件",
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

  // 处理需求对比抽取边界知识
  const handleCompareRequirements = async () => {
    if (uploadedFiles.length < 2) {
      toast({
        title: "对比失败",
        description: "请先上传至少两个文件",
        variant: "destructive",
      });
      return;
    }

    const selectedFiles = uploadedFiles.filter(file => file.selected);
    if (selectedFiles.length !== 2) {
      setFileSelectionAlert("需求对比功能需要选择两个文件（初稿和终稿），请确保选择且仅选择两个文件");
      return;
    }

    setFileSelectionAlert("");

    if (!aiConfig) {
      toast({
        title: "对比失败",
        description: "请先配置AI模型",
        variant: "destructive",
      });
      return;
    }

    // 清空之前的内容
    setBoundaryContent('');
    setIsComparing(true);
    // 激活边界知识标签页
    setActiveTab('boundary');

    try {
      const service = new RequirementBoundaryComparisonService();

      await service.compareRequirements(
        [selectedFiles[0].id, selectedFiles[1].id],
        (content: string) => {
          console.log('收到新内容，长度:', content.length);
          // 使用函数式更新，确保基于最新状态
          setBoundaryContent(prev => prev + content);
        }
      );
    } catch (error) {
      console.error('对比失败:', error);
      toast({
        title: "对比失败",
        description: error instanceof Error ? error.message : "未知错误",
        variant: "destructive",
      });
    } finally {
      console.log('对比完成');
      setIsComparing(false);
    }
  };

  // 处理下载边界知识
  const handleDownloadBoundary = () => {
    try {
      if (!boundaryContent) {
        toast({
          title: "下载失败",
          description: "没有可下载的边界知识内容",
          variant: "destructive",
          duration: 3000
        });
        return;
      }

      const blob = new Blob([boundaryContent], { type: 'text/markdown' });
      const url = URL.createObjectURL(blob);
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      
      const a = document.createElement('a');
      a.href = url;
      a.download = `需求边界知识-${timestamp}.md`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      toast({
        title: "下载成功",
        description: "边界知识内容已保存为 Markdown 文件",
        duration: 3000
      });
    } catch (error) {
      toast({
        title: "下载失败",
        description: "请手动复制内容并保存",
        variant: "destructive",
        duration: 3000
      });
    }
  };

  // 使用DOM操作直接更新内容的回调函数
  const directUpdateCallback = useCallback((content: string) => {
    console.log(`[${new Date().toISOString()}] 旧回调被调用，但已不使用`);
    // 这个函数已不再使用，我们使用simpleCallback替代
  }, []);
  
  // 使用一个定时器来定期更新DOM，作为备份机制
  useEffect(() => {
    // 这个useEffect已不再需要，已被simpleCallback替代
    return () => {};
  }, [isExtractingTerminology]);

  const handleExtractTerminology = async () => {
    console.log('🚀 开始抽取术语知识');
    
    // 检查是否有文件上传和选择
    if (uploadedFiles.length === 0) {
      toast({
        title: "抽取失败",
        description: "请先上传至少一个文件",
        variant: "destructive",
      });
      return;
    }
    
    const selectedFiles = uploadedFiles.filter(file => file.selected);
    if (selectedFiles.length === 0) {
      toast({
        title: "请选择文件",
        variant: "destructive",
      });
      return;
    }
    
    // 清空已有内容，并设置状态
    setTerminologyContent("等待大模型处理文件中...\n正在连接API，请耐心等待首次响应（通常需要5-20秒）...");
    setIsExtractingTerminology(true);
    
    // 激活术语知识标签页
    setActiveTab('terminology');
    
    toast({
      title: "开始抽取术语知识",
      description: "正在处理，可能需要一段时间等待首次响应...",
    });
    
    // 设置超时保护
    const maxTimeoutMs = 180000; // 3分钟
    const timeoutId = setTimeout(() => {
      console.error('🔶 术语抽取超时，已运行', maxTimeoutMs/1000, '秒');
      if (isExtractingTerminology) {
        // 如果还在进行中，则强制结束
        setIsExtractingTerminology(false);
        setTerminologyContent(prev => 
          prev + '\n\n[系统提示] 请求处理时间过长（3分钟），已自动停止。您可以查看已获取的内容或重试。'
        );
        toast({
          title: "抽取超时",
          description: "处理时间超过3分钟，已自动停止",
          variant: "destructive",
        });
      }
    }, maxTimeoutMs);
    
    try {
      // 准备服务和回调
      const service = new RequirementTerminologyService();
      
      // 记录起始时间
      const startTime = Date.now();
      
      // 显示进度更新
      let waitSeconds = 0;
      const waitInterval = setInterval(() => {
        waitSeconds += 5;
        if (waitSeconds <= 90 && isExtractingTerminology) {
          setTerminologyContent(prev => {
            // 只在还没有收到实际内容时更新等待消息
            if (prev.includes("已等待") || prev.includes("等待大模型处理") || prev.includes("正在连接API")) {
              if (prev.includes("已等待")) {
                return prev.replace(/已等待 \d+ 秒/, `已等待 ${waitSeconds} 秒`);
              } else {
                return prev + `\n已等待 ${waitSeconds} 秒，模型处理较大文件需要一定时间...`;
              }
            } 
            return prev; // 已经有实际内容，不再更新等待消息
          });
        } else {
          clearInterval(waitInterval);
        }
      }, 5000);
      
      // 标记是否已收到第一个实际内容
      let receivedFirstContent = false;
      
      // 使用回调函数直接更新状态
      await service.extractTerminology(
        selectedFiles.map(file => file.id),
        (content: string) => {
          console.log(`🔶 收到内容，长度: ${content.length}字符, 首次内容?: ${!receivedFirstContent}`);
          
          // 检查是否是错误消息
          if (content.includes('[错误]')) {
            console.error('🔶 收到错误:', content);
            toast({
              title: "抽取出错",
              description: "请查看错误信息",
              variant: "destructive",
            });
          }
          
          try {
            // 处理第一个实际内容（非等待消息）
            if (!receivedFirstContent && content.length > 0) {
              receivedFirstContent = true;
              clearInterval(waitInterval);
              
              // 检查内容是否是服务端的等待提示
              if (content.includes("正在连接模型API") || content.includes("请耐心等待")) {
                // 如果是服务端的等待提示，保留原来的等待信息，不重置内容
                console.log('🔶 收到服务端等待提示，保留当前内容');
                // 不替换当前内容，但也要确保这条消息显示出来
                setTerminologyContent(prev => prev + "\n" + content);
              } else {
                // 如果是实际内容，完全替换掉等待提示
                console.log('🔶 收到第一个实际内容，替换等待提示');
                setTerminologyContent(content);
              }
            } else if (receivedFirstContent) {
              // 后续内容直接追加
              setTerminologyContent(prev => prev + content);
            } else if (content.includes("正在连接模型API") || content.includes("请耐心等待")) {
              // 服务端发来的等待提示，替换前端的等待提示
              console.log('🔶 收到服务端等待提示，设置为当前内容');
              setTerminologyContent(content);
            } else {
              // 其他情况追加内容
              console.log('🔶.其他内容，追加显示');
              setTerminologyContent(prev => prev + content);
            }
          } catch (err) {
            // 如果内容处理出错，确保不会阻断后续内容显示
            console.error('🔶 内容处理错误:', err);
            // 安全地追加内容
            setTerminologyContent(prev => prev + "\n[内容处理错误，继续接收...]" + content);
          }
          
          // 滚动到底部
          const terminologyArea = document.getElementById('terminology-knowledge-area');
          if (terminologyArea) {
            terminologyArea.scrollTop = terminologyArea.scrollHeight;
          }
          
          // 强制刷新UI - 确保React渲染内容
          forceUpdate({});
        }
      );
      
      clearInterval(waitInterval);
      
      const timeElapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      console.log(`🔶 术语抽取完成，耗时: ${timeElapsed}秒`);
      
      toast({
        title: "术语抽取完成",
        description: `耗时: ${timeElapsed}秒`,
      });
    } catch (error) {
      console.error('🔶 术语抽取错误:', error);
      toast({
        title: "术语抽取失败",
        description: error instanceof Error ? error.message : "未知错误",
        variant: "destructive",
      });
    } finally {
      clearTimeout(timeoutId);
      setIsExtractingTerminology(false);
    }
  };

  // 处理下载术语知识
  const handleDownloadTerminology = () => {
    try {
      if (!terminologyContent) {
        toast({
          title: "下载失败",
          description: "没有可下载的术语知识内容",
          variant: "destructive",
          duration: 3000
        });
        return;
      }

      // 显示下载进度
      toast({
        title: "准备下载",
        description: `正在准备 ${(terminologyContent.length / 1024).toFixed(2)} KB 内容...`,
        duration: 2000
      });

      // 创建Blob并下载
      const blob = new Blob([terminologyContent], { type: 'text/markdown' });
      const url = URL.createObjectURL(blob);
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      
      const a = document.createElement('a');
      a.href = url;
      a.download = `业务术语知识-${timestamp}.md`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      toast({
        title: "下载成功",
        description: `术语知识内容 (${(terminologyContent.length / 1024).toFixed(2)} KB) 已保存为 Markdown 文件`,
        duration: 3000
      });
    } catch (error) {
      console.error(`下载术语内容失败:`, error);
      toast({
        title: "下载失败",
        description: "请手动复制内容并保存",
        variant: "destructive",
        duration: 3000
      });
    }
  };

  // 处理信息架构树抽取
  const handleExtractArchitecture = async () => {
    if (uploadedFiles.length === 0) {
      toast({
        title: "抽取失败",
        description: "请先上传至少一个文件",
        variant: "destructive",
      });
      return;
    }

    const selectedFiles = uploadedFiles.filter(file => file.selected);
    if (selectedFiles.length === 0) {
      setFileSelectionAlert("请至少选择一个文件进行信息架构抽取");
      return;
    }

    setFileSelectionAlert("");

    if (!aiConfig) {
      toast({
        title: "抽取失败",
        description: "请先配置AI模型",
        variant: "destructive",
      });
      return;
    }

    // 清空之前的内容
    setArchitectureContent('');
    setIsExtractingArchitecture(true);
    // 激活信息架构标签页
    setActiveTab('architecture');

    try {
      const service = new RequirementArchitectureService();

      await service.extractArchitecture(
        selectedFiles.map(file => file.id),
        (content: string) => {
          console.log('收到新内容，长度:', content.length);
          // 使用函数式更新，确保基于最新状态
          setArchitectureContent(prev => prev + content);
        }
      );
    } catch (error) {
      console.error('信息架构抽取失败:', error);
      toast({
        title: "抽取失败",
        description: error instanceof Error ? error.message : "未知错误",
        variant: "destructive",
      });
    } finally {
      console.log('信息架构抽取完成');
      setIsExtractingArchitecture(false);
    }
  };

  // 处理下载信息架构
  const handleDownloadArchitecture = () => {
    try {
      if (!architectureContent) {
        toast({
          title: "下载失败",
          description: "没有可下载的信息架构内容",
          variant: "destructive",
          duration: 3000
        });
        return;
      }

      const blob = new Blob([architectureContent], { type: 'text/typescript' });
      const url = URL.createObjectURL(blob);
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      
      const a = document.createElement('a');
      a.href = url;
      a.download = `信息架构树-${timestamp}.ts`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      toast({
        title: "下载成功",
        description: "信息架构内容已保存为 TypeScript 文件",
        duration: 3000
      });
    } catch (error) {
      toast({
        title: "下载失败",
        description: "请手动复制内容并保存",
        variant: "destructive",
        duration: 3000
      });
    }
  };

  // 加载指示器管理
  useEffect(() => {
    // 加载指示器的管理
    if (isExtractingTerminology) {
      // 加载开始时，添加一个固定位置的加载指示器
      const indicator = document.createElement('div');
      indicator.id = 'fixed-loading-indicator';
      indicator.className = 'fixed bottom-4 right-4 bg-orange-500 text-white px-4 py-2 rounded-full shadow-lg z-50';
      indicator.innerHTML = `<div class="flex items-center gap-2">
        <div class="animate-spin h-4 w-4 border-2 border-white rounded-full border-t-transparent"></div>
        <span>接收内容中...</span>
      </div>`;
      document.body.appendChild(indicator);
    } else {
      // 加载结束时，移除加载指示器
      const indicator = document.getElementById('fixed-loading-indicator');
      if (indicator && indicator.parentNode) {
        indicator.parentNode.removeChild(indicator);
      }
      
      // 更新内容长度显示
      if (terminologyContentRef.current) {
        const lengthDisplay = terminologyContentRef.current.querySelector('.terminology-length');
        if (lengthDisplay) {
          lengthDisplay.innerHTML = `<span class="text-green-500 font-medium">完成</span> | 总内容长度: ${terminologyTextRef.current.length} 字符`;
        }
      }
    }
  }, [isExtractingTerminology]);

  return (
    <>
      <div className="w-full max-w-full overflow-x-hidden">
        <div className="space-y-4 px-4 py-4 mx-auto w-[90%]">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center">
                <h1 className="text-2xl font-bold tracking-tight">需求书综合处理</h1>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="ml-2 cursor-help">
                        <AlertCircle className="h-4 w-4 text-orange-500" />
                      </div>
                    </TooltipTrigger>
                    <TooltipContent className="max-w-md p-4 bg-white shadow-lg rounded-lg border border-gray-200">
                      <div className="text-sm">
                        <p className="font-bold text-gray-900 mb-1">重要提示</p>
                        <p className="text-gray-700">请确保选择<span className="font-bold text-orange-600">长上下文且支持docx附件</span>的大模型（如 qwen-long），以获得最佳处理效果。</p>
                      </div>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <p className="text-muted-foreground text-xs mt-1">
                请上传需求书文档（建议Qwen-long使用docx格式， Gemini使用PDF格式），我们将帮助您进行智能拆解。
              </p>
              {!aiConfig && (
                <p className="text-red-500 text-xs mt-1">
                  未检测到AI模型配置，请先在设置中配置模型
                </p>
              )}
            </div>
          </div>

          <div className="space-y-3 overflow-x-auto">
            <div className="border rounded-lg p-3">
              <div 
                ref={dropAreaRef}
                className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center transition-colors duration-200"
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
              >
                <div className="flex flex-col items-center justify-center space-y-2">
                  <Upload className="h-8 w-8 text-gray-400" />
                  <div className="text-xs text-gray-600">
                    {file ? (
                      <p className="text-green-600">已选择文件: {file.name}</p>
                    ) : (
                      <>
                        <p>拖拽文件到此处或</p>
                        <label className="cursor-pointer text-orange-600 hover:text-orange-700">
                          点击上传
                          <input
                            ref={fileInputRef}
                            type="file"
                            className="hidden"
                            accept=".docx,.txt,.pdf,.xlsx,.md"
                            onChange={handleFileChange}
                          />
                        </label>
                      </>
                    )}
                  </div>
                  {error && <p className="text-red-500 text-xs">{error}</p>}
                </div>
              </div>

              <div className="mt-3 flex justify-center gap-2">
                <button
                  onClick={handleUpload}
                  disabled={!file || uploading || !aiConfig}
                  className={`px-3 py-1.5 rounded-md text-white text-xs
                    ${file && !uploading && aiConfig
                      ? 'bg-orange-500 hover:bg-orange-600' 
                      : 'bg-gray-400 cursor-not-allowed'
                    }`}
                >
                  {uploading ? '上传中...' : '上传文件'}
                </button>
                
                {/* 需求书转MD按钮 */}
                <Button
                  onClick={handleConvertToMd}
                  disabled={uploadedFiles.length === 0 || isConverting}
                  className={`flex items-center gap-1 px-3 py-1.5 h-auto text-xs ${
                    uploadedFiles.length > 0 && !isConverting
                      ? 'bg-orange-500 hover:bg-orange-600 text-white' 
                      : 'bg-gray-400 text-gray-100 cursor-not-allowed'
                  }`}
                >
                  {isConverting ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Book className="h-3 w-3" />
                  )}
                  {isConverting ? '转换中...' : '需求书转MD'}
                </Button>
                
                {/* 需求书转测试用例按钮 */}
                <Button
                  onClick={handleOpenTestDialog}
                  disabled={uploadedFiles.length === 0 || isGeneratingTest}
                  className={`flex items-center gap-1 px-3 py-1.5 h-auto text-xs ${
                    uploadedFiles.length > 0 && !isGeneratingTest
                      ? 'bg-orange-500 hover:bg-orange-600 text-white' 
                      : 'bg-gray-400 text-gray-100 cursor-not-allowed'
                  }`}
                >
                  {isGeneratingTest ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <FileText className="h-3 w-3" />
                  )}
                  {isGeneratingTest ? '生成中...' : '需求书转测试用例'}
                </Button>
                
                {/* 需求对比抽取边界知识按钮 */}
                <Button
                  onClick={handleCompareRequirements}
                  disabled={uploadedFiles.length < 2 || isComparing}
                  className={`flex items-center gap-1 px-3 py-1.5 h-auto text-xs ${
                    uploadedFiles.length >= 2 && !isComparing
                      ? 'bg-orange-500 hover:bg-orange-600 text-white' 
                      : 'bg-gray-400 text-gray-100 cursor-not-allowed'
                  }`}
                >
                  {isComparing ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <HelpCircle className="h-3 w-3" />
                  )}
                  {isComparing ? '对比中...' : '抽取边界知识'}
                </Button>
                
                {/* 术语知识抽取按钮 */}
                <Button
                  onClick={handleExtractTerminology}
                  disabled={uploadedFiles.length === 0 || isExtractingTerminology}
                  className={`flex items-center gap-1 px-3 py-1.5 h-auto text-xs ${
                    uploadedFiles.length > 0 && !isExtractingTerminology
                      ? 'bg-orange-500 hover:bg-orange-600 text-white' 
                      : 'bg-gray-400 text-gray-100 cursor-not-allowed'
                  }`}
                >
                  {isExtractingTerminology ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Book className="h-3 w-3" />
                  )}
                  {isExtractingTerminology ? '抽取中...' : '抽取术语知识'}
                </Button>
                
                {/* 信息架构树抽取按钮 */}
                <Button
                  onClick={handleExtractArchitecture}
                  disabled={uploadedFiles.length === 0 || isExtractingArchitecture}
                  className={`flex items-center gap-1 px-3 py-1.5 h-auto text-xs ${
                    uploadedFiles.length > 0 && !isExtractingArchitecture
                      ? 'bg-orange-500 hover:bg-orange-600 text-white' 
                      : 'bg-gray-400 text-gray-100 cursor-not-allowed'
                  }`}
                >
                  {isExtractingArchitecture ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <FileText className="h-3 w-3" />
                  )}
                  {isExtractingArchitecture ? '抽取中...' : '抽取信息架构树'}
                </Button>

              </div>
              
              {/* 文件选择警告提示 */}
              {fileSelectionAlert && (
                <Alert variant="destructive" className="mt-2 py-2">
                  <AlertCircle className="h-3 w-3" />
                  <AlertTitle className="text-xs">警告</AlertTitle>
                  <AlertDescription className="text-xs">
                    {fileSelectionAlert}
                  </AlertDescription>
                </Alert>
              )}
              
              {/* 已上传文件列表和操作区域 */}
              {uploadedFiles.length > 0 && (
                <div className="mt-3">
                  <div className="flex justify-between items-center mb-1">
                    <div>
                      <h3 className="text-xs font-medium text-gray-700">已上传文件列表</h3>
                      <p className="text-xs text-gray-500 mt-0.5">可多选文件：需求书转MD仅支持单选，测试用例生成支持多选，需求对比需选择两个文件</p>
                    </div>
                  </div>
                  
                  <div className="border rounded-md overflow-hidden max-h-[150px] overflow-y-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th scope="col" className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            选择
                          </th>
                          <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            文件名
                          </th>
                          <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            文件ID
                          </th>
                          <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            上传时间
                          </th>
                          <th scope="col" className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                            操作
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {uploadedFiles.map((file) => (
                          <tr key={file.id}>
                            <td className="px-2 py-2 whitespace-nowrap text-sm text-gray-900">
                              <Checkbox
                                checked={file.selected}
                                onCheckedChange={(checked) => handleSelectFile(file.id, checked === true)}
                                aria-label={`选择文件 ${file.name}`}
                              />
                            </td>
                            <td className="px-3 py-2 whitespace-nowrap text-xs text-gray-900 flex items-center">
                              <FileIcon className="h-3 w-3 mr-1 text-orange-500" />
                              {file.name}
                            </td>
                            <td className="px-3 py-2 whitespace-nowrap text-xs text-gray-500">
                              {file.id}
                            </td>
                            <td className="px-3 py-2 whitespace-nowrap text-xs text-gray-500">
                              {file.uploadTime.toLocaleString('zh-CN')}
                            </td>
                            <td className="px-3 py-2 whitespace-nowrap text-xs text-gray-500 text-right">
                              <button
                                onClick={() => handleDeleteFile(file.id)}
                                className="text-red-500 hover:text-red-700 rounded-full p-0.5 hover:bg-red-50 transition-colors"
                                title="删除文件"
                                aria-label="删除文件"
                              >
                                <Trash2 className="h-3 w-3" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
            
            {/* 输出内容标签页UI */}
            <div className="border rounded-lg p-4 mt-3 overflow-hidden">
              <div className="flex border-b mb-3">
                <button
                  onClick={() => setActiveTab('md')}
                  className={`px-3 py-1.5 font-medium text-xs rounded-t-lg mr-2 transition-colors ${
                    activeTab === 'md' 
                      ? 'bg-orange-500 text-white' 
                      : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                  }`}
                >
                  需求书内容
                </button>
                <button
                  onClick={() => setActiveTab('test')}
                  className={`px-3 py-1.5 font-medium text-xs rounded-t-lg mr-2 transition-colors ${
                    activeTab === 'test' 
                      ? 'bg-orange-500 text-white' 
                      : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                  }`}
                >
                  测试用例
                </button>
                <button
                  onClick={() => setActiveTab('boundary')}
                  className={`px-3 py-1.5 font-medium text-xs rounded-t-lg mr-2 transition-colors ${
                    activeTab === 'boundary' 
                      ? 'bg-orange-500 text-white' 
                      : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                  }`}
                >
                  需求边界知识
                </button>
                <button
                  onClick={() => setActiveTab('terminology')}
                  className={`px-3 py-1.5 font-medium text-xs rounded-t-lg mr-2 transition-colors ${
                    activeTab === 'terminology' 
                      ? 'bg-orange-500 text-white' 
                      : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                  }`}
                >
                  术语知识
                </button>
                <button
                  onClick={() => setActiveTab('architecture')}
                  className={`px-3 py-1.5 font-medium text-xs rounded-t-lg transition-colors ${
                    activeTab === 'architecture' 
                      ? 'bg-orange-500 text-white' 
                      : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                  }`}
                >
                  信息架构树
                </button>
              </div>
              
              {/* 需求书内容 */}
              {activeTab === 'md' && (
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <h2 className="text-base font-semibold">需求书内容</h2>
                    <Button 
                      onClick={handleDownloadMd}
                      disabled={!mdContent}
                      className="bg-orange-500 hover:bg-orange-600 text-white flex items-center gap-1 px-3 py-1 h-8 text-xs"
                    >
                      <Download className="h-3 w-3" />
                      下载MD文件
                    </Button>
                  </div>
                  <div className="border rounded p-3 bg-gray-50 min-h-[800px] max-h-[1400px] overflow-auto w-full" ref={mdContentRef}>
                    {/* 添加调试信息，使用自执行函数避免返回void */}
                    {(() => {
                      console.log('渲染Markdown内容区域, isConverting:', isConverting, 'mdContent长度:', mdContent.length);
                      return null;
                    })()}
                    
                    {/* 显示内容，无论是否为空 */}
                    <ContentDisplay content={mdContent} />
                  </div>
                </div>
              )}
              
              {/* 测试用例 */}
              {activeTab === 'test' && (
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <h2 className="text-base font-semibold">测试用例</h2>
                    <Button 
                      onClick={handleDownloadTest}
                      disabled={!testContent}
                      className="bg-orange-500 hover:bg-orange-600 text-white flex items-center gap-1 px-3 py-1 h-8 text-xs"
                    >
                      <Download className="h-3 w-3" />
                      下载测试用例
                    </Button>
                  </div>
                  <div className="border rounded p-3 bg-gray-50 min-h-[800px] max-h-[1400px] overflow-auto w-full" ref={testContentRef}>
                    {/* 添加调试信息，使用自执行函数避免返回void */}
                    {(() => {
                      console.log('渲染测试用例区域, isGeneratingTest:', isGeneratingTest, 'testContent长度:', testContent.length);
                      return null;
                    })()}
                    
                    {/* 显示内容，无论是否为空 */}
                    <ContentDisplay content={testContent} />
                  </div>
                </div>
              )}
              
              {/* 边界知识 */}
              {activeTab === 'boundary' && (
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <h2 className="text-base font-semibold">需求边界知识</h2>
                    <Button 
                      onClick={handleDownloadBoundary}
                      disabled={!boundaryContent}
                      className="bg-orange-500 hover:bg-orange-600 text-white flex items-center gap-1 px-3 py-1 h-8 text-xs"
                    >
                      <Download className="h-3 w-3" />
                      下载边界知识
                    </Button>
                  </div>
                  <div className="border rounded p-3 bg-gray-50 min-h-[800px] max-h-[1400px] overflow-auto w-full" ref={boundaryContentRef}>
                    {/* 添加调试信息，使用自执行函数避免返回void */}
                    {(() => {
                      console.log('渲染边界知识区域, isComparing:', isComparing, 'boundaryContent长度:', boundaryContent.length);
                      return null;
                    })()}
                    
                    {/* 显示内容，无论是否为空 */}
                    <ContentDisplay content={boundaryContent} />
                  </div>
                </div>
              )}
              
              {/* 术语知识 */}
              {activeTab === 'terminology' && (
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <h2 className="text-base font-semibold">业务术语知识</h2>
                    <Button 
                      onClick={handleDownloadTerminology}
                      disabled={isExtractingTerminology || !terminologyContent}
                      className="bg-orange-500 hover:bg-orange-600 text-white flex items-center gap-1 px-3 py-1 h-8 text-xs"
                    >
                      <Download className="h-3 w-3" />
                      下载术语知识
                    </Button>
                  </div>
                  <div 
                    id="terminology-content"
                    className="border rounded p-3 bg-gray-50 min-h-[800px] max-h-[1400px] overflow-auto w-full relative" 
                    ref={terminologyContentRef}
                  >
                    {/* 添加调试信息，使用自执行函数避免返回void */}
                    {(() => {
                      console.log('渲染术语知识区域, isExtractingTerminology:', isExtractingTerminology, 'terminologyContent长度:', terminologyContent.length);
                      return null;
                    })()}
                    
                    {/* 显示内容，无论是否为空 */}
                    <ContentDisplay content={terminologyContent} />
                  </div>
                  
                  {/* 添加显式的状态指示器 */}
                  {isExtractingTerminology && (
                    <div className="mt-2 text-sm text-orange-600 flex items-center gap-2">
                      <div className="animate-spin h-3 w-3 border-2 border-orange-500 rounded-full border-t-transparent"></div>
                      正在接收内容...
                    </div>
                  )}
                </div>
              )}
              
              {/* 信息架构树 */}
              {activeTab === 'architecture' && (
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <h2 className="text-base font-semibold">信息架构树</h2>
                    <Button 
                      onClick={handleDownloadArchitecture}
                      disabled={!architectureContent}
                      className="bg-orange-500 hover:bg-orange-600 text-white flex items-center gap-1 px-3 py-1 h-8 text-xs"
                    >
                      <Download className="h-3 w-3" />
                      下载信息架构
                    </Button>
                  </div>
                  <div className="border rounded p-3 bg-gray-50 min-h-[800px] max-h-[1400px] overflow-auto w-full" ref={architectureContentRef}>
                    {/* 添加调试信息，使用自执行函数避免返回void */}
                    {(() => {
                      console.log('渲染信息架构区域, isExtractingArchitecture:', isExtractingArchitecture, 'architectureContent长度:', architectureContent.length);
                      return null;
                    })()}
                    
                    {/* 显示内容，无论是否为空 */}
                    <ContentDisplay content={architectureContent} />
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
      
      {/* 需求章节输入弹窗 */}
      <Dialog open={showChapterDialog} onOpenChange={setShowChapterDialog}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>输入需求章节</DialogTitle>
            <DialogDescription>
              请输入您想要处理的需求章节标题或描述（50字内），以便更精确地生成测试用例。
              如果不需要指定章节，可以留空。
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="requirementChapter" className="text-right">
                需求章节
              </Label>
              <Input
                id="requirementChapter"
                value={requirementChapter}
                onChange={(e) => setRequirementChapter(e.target.value)}
                maxLength={50}
                placeholder="例如：用户登录功能"
                className="col-span-3"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowChapterDialog(false)}>
              取消
            </Button>
            <Button onClick={handleConvertToTest}>
              开始生成
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      <Toaster />
    </>
  )
} 