'use client'

import { useState, useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/use-toast'
import { MemberFormDialog, MemberFormData } from '@/components/ai-team/member-form-dialog'
import { ApplicationDialog } from '@/components/ai-team/ApplicationDialog'
import { TeamCard } from '@/components/ai-team/TeamCard'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from '@/components/ui/alert-dialog'
import { Card, CardHeader } from '@/components/ui/card'
import { ExternalLink, Pencil, Trash2, UserCircle2, Send } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { McpClient, McpServerConfig } from '@/lib/mcp/client'

type AITeamMember = MemberFormData & { id: string; mcpConfigJson?: string | null }

interface Application {
  id: string
  name: string
  introduction: string
  entryUrl: string
  category?: string
}

interface Message {
  role: 'user' | 'assistant'
  content: string
}

// 定义MCP配置接口
interface LocalMcpServerConfig { // 重命名局部接口以避免冲突
  command?: string; 
  args?: string[];  
  url?: string;     
  headers?: Record<string, string>; 
}

interface McpConfig {
  mcpServers: {
    [key: string]: LocalMcpServerConfig; // 使用重命名后的接口
  };
}

export default function AITeamPage() {
  const [activeTab, setActiveTab] = useState('members')
  const [members, setMembers] = useState<AITeamMember[]>([])
  const [applications, setApplications] = useState<Application[]>([])
  const [isMemberDialogOpen, setIsMemberDialogOpen] = useState(false)
  const [isApplicationDialogOpen, setIsApplicationDialogOpen] = useState(false)
  const [editingMember, setEditingMember] = useState<MemberFormData | null>(null)
  const [editingApplication, setEditingApplication] = useState<Application | null>(null)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [deletingAppId, setDeletingAppId] = useState<string | null>(null)
  const { toast } = useToast()
  
  // 聊天相关状态
  const [isChatDialogOpen, setIsChatDialogOpen] = useState(false)
  const [chatMember, setChatMember] = useState<AITeamMember | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [inputValue, setInputValue] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [sessionId, setSessionId] = useState<string | null>(null)

  // 在组件顶部添加消息滚动的引用
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // 定义会话准备状态
  const [isSessionReady, setIsSessionReady] = useState(false);

  // 加载团队成员列表
  const loadMembers = async () => {
    try {
      const response = await fetch('/api/settings/ai-team')
      if (!response.ok) throw new Error('加载失败')
      const data = await response.json()
      setMembers(data)
    } catch (error) {
      toast({
        title: '错误',
        description: '加载AI团队成员失败',
        variant: 'destructive',
      })
    }
  }

  // 加载应用列表
  const loadApplications = async () => {
    try {
      const response = await fetch('/api/ai-team/applications')
      if (!response.ok) throw new Error('加载失败')
      const data = await response.json()
      setApplications(data)
    } catch (error) {
      toast({
        title: '错误',
        description: '加载应用列表失败',
        variant: 'destructive',
      })
    }
  }

  useEffect(() => {
    loadMembers()
    loadApplications()
  }, [])

  // 在useEffect中添加滚动逻辑
  useEffect(() => {
    // 滚动到最新消息
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleOpenMemberDialog = (member?: AITeamMember) => {
    if (member) {
      setEditingMember(member)
    } else {
      setEditingMember({
        name: '',
        introduction: '',
        role: '',
        responsibilities: '',
        greeting: '',
        category: ''
      })
    }
    setIsMemberDialogOpen(true)
  }

  const handleCloseMemberDialog = () => {
    setIsMemberDialogOpen(false)
    setEditingMember(null)
  }

  // 提交成员表单（添加或编辑）
  const handleSubmitMember = async (data: MemberFormData & { mcpConfigJson?: string | null }) => {
    if (!data.name?.trim() || !data.introduction?.trim() || !data.role?.trim() || !data.responsibilities?.trim()) {
      toast({
        title: '错误',
        description: '请填写所有必填字段',
        variant: 'destructive',
      })
      return
    }
    
    try {
      const url = editingMember?.id 
        ? `/api/settings/ai-team?id=${editingMember.id}`
        : '/api/settings/ai-team'
      
      const response = await fetch(url, {
        method: editingMember?.id ? 'PATCH' : 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...data,
          greeting: data.greeting?.trim() || null,
          category: data.category?.trim() || null,
          mcpConfigJson: data.mcpConfigJson || null,
        }),
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(errorText || (editingMember?.id ? '更新失败' : '添加失败'))
      }

      toast({
        title: '成功',
        description: `AI团队成员${editingMember?.id ? '更新' : '添加'}成功`,
      })
      handleCloseMemberDialog()
      loadMembers()
    } catch (error) {
      console.error('Form submission error:', error)
      toast({
        title: '错误',
        description: error instanceof Error ? error.message : `${editingMember?.id ? '更新' : '添加'}AI团队成员失败`,
        variant: 'destructive',
      })
    }
  }

  // 删除成员
  const handleDeleteMember = async (id: string) => {
    try {
      const response = await fetch(`/api/settings/ai-team?id=${id}`, {
        method: 'DELETE',
      })

      if (!response.ok) throw new Error('删除失败')

      toast({
        title: '成功',
        description: 'AI团队成员删除成功',
      })
      loadMembers()
    } catch (error) {
      toast({
        title: '错误',
        description: '删除AI团队成员失败',
        variant: 'destructive',
      })
    }
  }

  const handleOpenApplicationDialog = (application?: Application) => {
    console.log('handleOpenApplicationDialog 被调用，应用:', application)
    if (application) {
      setEditingApplication(application)
    } else {
      setEditingApplication(null)
    }
    console.log('设置 isApplicationDialogOpen = true')
    setIsApplicationDialogOpen(true)
    console.log('当前 editingApplication 状态:', application)
  }

  const handleCloseApplicationDialog = () => {
    console.log('handleCloseApplicationDialog 被调用')
    setIsApplicationDialogOpen(false)
    setEditingApplication(null)
  }

  // 准备删除应用
  const handlePrepareDeleteApplication = (id: string) => {
    setDeletingAppId(id)
    setIsDeleteDialogOpen(true)
  }

  // 删除应用
  const handleDeleteApplication = async () => {
    if (!deletingAppId) return;
    
    try {
      const response = await fetch(`/api/ai-team/applications/${deletingAppId}`, {
        method: 'DELETE',
      })

      if (!response.ok) throw new Error('删除失败')

      toast({
        title: '成功',
        description: '应用删除成功',
      })
      loadApplications()
    } catch (error) {
      toast({
        title: '错误',
        description: '删除应用失败',
        variant: 'destructive',
      })
    } finally {
      setIsDeleteDialogOpen(false)
      setDeletingAppId(null)
    }
  }
  
  // 创建MCP会话
  const createMcpSession = async (configJson: string): Promise<string | null> => {
    try {
      // 解析MCP配置
      const config = JSON.parse(configJson) as McpConfig;
      if (!config || !config.mcpServers) {
        throw new Error('无效的MCP配置');
      }
      
      const serverName = Object.keys(config.mcpServers)[0];
      if (!serverName) {
        throw new Error('未找到MCP服务器配置');
      }
      
      // 创建MCP会话
      const response = await fetch('/api/mcp/session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          command: config.mcpServers[serverName].command,
          args: config.mcpServers[serverName].args,
        }),
      });
      
      if (!response.ok) {
        throw new Error('创建MCP会话失败');
      }
      
      const result = await response.json();
      console.log('已创建MCP会话:', result.sessionId);
      return result.sessionId;
    } catch (error) {
      console.error('创建MCP会话失败:', error);
      return null;
    }
  };
  
  // 打开聊天对话框
  const handleOpenChat = async (member: AITeamMember) => {
    setChatMember(member);
    setIsChatDialogOpen(true);
    setIsSessionReady(false); 
    setMessages([{ role: 'assistant', content: '正在准备会话环境，请稍候...' }]);
    setInputValue('');
    setSessionId(null); // 清空旧会话ID
    
    let welcomeMessage = member.greeting || `你好！我是${member.name}，有什么可以帮你的吗？`;
    
    if (member.mcpConfigJson) {
      try {
        console.log('开始创建MCP会话...');
        
        let newSessionId: string | null = null;
        let retryCount = 0;
        const maxRetries = 3;
        
        while (retryCount < maxRetries && !newSessionId) {
          try {
            // 解析MCP配置
            const config = JSON.parse(member.mcpConfigJson) as McpConfig;
            if (!config || typeof config.mcpServers !== 'object' || Object.keys(config.mcpServers).length === 0) {
              throw new Error('无效或空的MCP配置');
            }
            
            const serverName = Object.keys(config.mcpServers)[0];
            const serverConfig = config.mcpServers[serverName];
            if (!serverConfig) {
                throw new Error(`未找到名为 "${serverName}" 的服务器配置`);
            }
            
            // 准备成员信息
            const memberInfo = {
              name: member.name,
              role: member.role,
              responsibilities: member.responsibilities
            };
            const userSessionKey = `mcp-session-${member.id}`;
            
            // --- 核心修改：根据配置类型构造请求体 ---
            let requestBody: any;
            if (serverConfig.url && typeof serverConfig.url === 'string') {
              // Streamable HTTP 类型
              console.log(`[handleOpenChat] 检测到 Streamable HTTP 配置: ${serverConfig.url}`);
              requestBody = {
                command: '_STREAMABLE_HTTP_', // 特殊标识符
                url: serverConfig.url,
                memberInfo,
                userSessionKey
              };
            } else if (serverConfig.command && Array.isArray(serverConfig.args)) {
              // 命令行类型
              console.log(`[handleOpenChat] 检测到命令行配置: ${serverConfig.command} ${serverConfig.args.join(' ')}`);
              requestBody = {
                command: serverConfig.command,
                args: serverConfig.args,
                memberInfo,
                userSessionKey
              };
            } else {
              // 配置格式无效
              throw new Error('MCP服务器配置无效: 必须包含 url 或 command/args');
            }
            // --- 修改结束 ---
            
            console.log(`[handleOpenChat] 发送到 /api/mcp/session 的请求体:`, requestBody);

            // 创建MCP会话 - 使用构造好的 requestBody
            const response = await fetch('/api/mcp/session', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify(requestBody), // 使用构造好的请求体
            });
            
            if (!response.ok) {
              // 抛出错误以触发重试
              throw new Error(`创建MCP会话失败 (${response.status})`);
            }
            
            const result = await response.json();
            if (result.sessionId) { // <-- 检查响应中是否包含参数
                console.log('已创建MCP会话:', result.sessionId);
                newSessionId = result.sessionId;
            } else {
                throw new Error('创建会话响应无效: 缺少 sessionId');
            }
          } catch (error) {
            console.error(`创建会话失败(尝试 ${retryCount + 1}/${maxRetries}):`, error);
            retryCount++;
            if (retryCount < maxRetries) {
              await new Promise(resolve => setTimeout(resolve, 1000));
              console.log(`重试创建会话 (${retryCount}/${maxRetries})...`);
            }
          }
        }
        
        if (newSessionId) { // <-- 确保参数也获取成功
          setSessionId(newSessionId);
          console.log('会话ID已设置:', newSessionId);
          welcomeMessage = `${welcomeMessage} (工具服务已配置)`; 
        } else {
          welcomeMessage = `${welcomeMessage} (无法配置工具服务，仅提供普通对话)`;
          throw new Error('多次尝试后仍无法配置会话');
        }
      } catch (error) {
        console.error('初始化MCP会话失败:', error);
        toast({ title: '警告', description: '无法配置工具服务，将使用普通对话模式', variant: 'destructive' });
        // 即使失败，也设置会话准备就绪，进行普通对话
        setMessages([{ role: 'assistant', content: welcomeMessage }]);
        setIsSessionReady(true);
        return; // 提前返回，避免覆盖消息
      }
    }
    
    setMessages([{ role: 'assistant', content: welcomeMessage }]);
    setIsSessionReady(true);
  }
  
  // 关闭聊天对话框
  const handleCloseChat = async () => {
    console.log('执行handleCloseChat函数');
    
    // 先将状态更新为关闭，以改善用户体验
    setIsChatDialogOpen(false)
    
    // 只有在有会话ID的情况下才尝试关闭会话
    if (sessionId) {
      console.log('正在关闭MCP会话:', sessionId);
      let retryCount = 0;
      const maxRetries = 2; // 减少重试次数，因为会话不存在是常见情况
      let successfullyClosed = false;
      
      try {
        // 先验证会话是否存在
        const checkResponse = await fetch(`/api/mcp/session?sessionId=${sessionId}`, {
          method: 'GET',
        });
        
        if (checkResponse.status === 404) {
          // 会话不存在，无需关闭
          console.log('会话已不存在，无需关闭:', sessionId);
          successfullyClosed = true;
        } else if (checkResponse.ok) {
          // 会话存在，尝试关闭
          const response = await fetch(`/api/mcp/session?sessionId=${sessionId}`, {
            method: 'DELETE',
          });
          
          if (response.ok) {
            const result = await response.json();
            console.log('已成功关闭MCP会话:', sessionId, result);
            successfullyClosed = true;
          } else {
            // 如果状态码为404，表示会话不存在，也视为关闭成功
            if (response.status === 404) {
              console.log('会话不存在，视为已关闭:', sessionId);
              successfullyClosed = true;
            } else {
              // 其他错误状态码，需要重试
              throw new Error(`关闭会话失败 (${response.status})`);
            }
          }
        }
      } catch (error) {
        console.error('关闭MCP会话出现异常:', error);
        
        // 只有在重试次数用尽且未标记为成功关闭时才显示警告
        if (!successfullyClosed) {
          // 静默处理错误，不显示警告
          console.log('无法关闭会话，但不显示警告以避免影响用户体验');
        }
      }
    } else {
      console.log('没有活跃会话，无需关闭');
    }
    
    // 无论会话关闭是否成功，都清理UI状态
    setChatMember(null)
    setMessages([])
    setSessionId(null)
  }
  
  // 添加一个用于监听浏览器关闭/刷新事件的处理函数
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      // 如果有活跃会话，尝试关闭
      if (sessionId) {
        console.log('页面关闭/刷新前尝试关闭会话:', sessionId);
        
        // 创建一个同步的请求来关闭会话
        const xhr = new XMLHttpRequest();
        xhr.open('DELETE', `/api/mcp/session?sessionId=${sessionId}`, false); // 同步请求
        try {
          xhr.send();
          console.log('页面关闭前已发送会话关闭请求');
        } catch (err) {
          console.error('页面关闭前发送会话关闭请求失败:', err);
        }
      }
    };

    // 添加beforeunload事件监听
    window.addEventListener('beforeunload', handleBeforeUnload);
    
    // 组件卸载时移除事件监听
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      
      // 如果组件卸载且有活跃会话，尝试关闭
      if (sessionId) {
        console.log('组件卸载时关闭会话:', sessionId);
        fetch(`/api/mcp/session?sessionId=${sessionId}`, { method: 'DELETE' })
          .catch(err => console.error('组件卸载时关闭会话失败:', err));
      }
    };
  }, [sessionId]);

  // 发送消息
  const handleSendMessage = async () => {
    if (!inputValue.trim() || isLoading || !chatMember) return
    
    const userMessage = { role: 'user' as const, content: inputValue }
    setMessages(prev => [...prev, userMessage])
    setInputValue('')
    setIsLoading(true)
    setMessages(prev => [...prev, { role: 'assistant', content: '' }])
    
    try {
      console.log('[SendMessage] 会话状态:', { 
        sessionId, 
        chatMember: chatMember?.name 
      });
      
      const requestData: any = {
        userMessage: inputValue,
        memberInfo: { // 始终发送成员信息
          name: chatMember.name,
          role: chatMember.role,
          responsibilities: chatMember.responsibilities,
        }
      };
      
      // 只添加 sessionId
      if (sessionId) {
        requestData.sessionId = sessionId;
      }
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 120000); 
      
      const response = await fetch('/api/mcp/conversation/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestData),
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || '对话请求失败');
      }
      
      // 处理流式响应
      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('无法读取响应流');
      }
      
      // 追踪我们是否已经显示了工具调用消息
      let toolCallMessageShown = false;
      let toolCallMessage = '';
      let currentContent = '';
      
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        // 解析收到的数据
        const chunk = new TextDecoder().decode(value);
        const lines = chunk.split('\n').filter(line => line.trim() !== '');
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.substring(6));
              
              // 处理工具调用事件
              if (data.type === 'tool_call') {
                const toolName = data.name || 'unknown';
                const formattedArgs = data.arguments || '{}';
                
                // 创建或更新工具调用消息
                toolCallMessage = `🔧 正在使用工具: ${toolName}; \n参数: ${formattedArgs}`;
                
                // 如果尚未显示工具消息，则显示它
                if (!toolCallMessageShown) {
                  setMessages(prev => {
                    const newMessages = [...prev];
                    newMessages[newMessages.length - 1].content = toolCallMessage;
                    return newMessages;
                  });
                  
                  // 添加一个新消息来接收后续内容
                  setMessages(prev => [...prev, { role: 'assistant', content: '处理中...' }]);
                  toolCallMessageShown = true;
                }
              }
              // 处理内容更新事件
              else if (data.type === 'content') {
                const newContent = data.content || '';
                // 累积内容而不是替换
                currentContent += newContent;
                
                // 更新最后一条消息内容
                setMessages(prev => {
                  const newMessages = [...prev];
                  
                  // 始终更新最后一条消息
                  const lastIndex = newMessages.length - 1;
                  newMessages[lastIndex].content = currentContent;
                  
                  return newMessages;
                });
              }
            } catch (error) {
              console.error('解析流数据出错:', error, line);
            }
          }
        }
      }
    } catch (error) {
      console.error('对话错误:', error);
      
      // 更新最后一条消息为错误信息
      setMessages(prev => {
        const newMessages = [...prev];
        newMessages[newMessages.length - 1].content = `对话出错: ${error instanceof Error ? error.message : '未知错误'}`;
        return newMessages;
      });
      
      toast({
        title: '错误',
        description: '对话处理出错，请稍后再试',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
      
      // 滚动到底部
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    }
  }

  return (
    <div className="mx-auto py-6 w-[90%]">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">AI团队工厂</h1>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <div className="flex justify-between items-center">
          <TabsList>
            <TabsTrigger value="members">团队成员</TabsTrigger>
            <TabsTrigger value="applications">集成应用</TabsTrigger>
          </TabsList>
          {activeTab === 'members' ? (
            <Button onClick={() => handleOpenMemberDialog()}>添加成员</Button>
          ) : (
            <div className="flex gap-2">
              <Button onClick={() => {
                console.log('点击了引入应用按钮')
                handleOpenApplicationDialog()
              }}>引入应用</Button>
            </div>
          )}
        </div>

        <TabsContent value="members" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {members.map((member) => (
              <TeamCard
                key={member.id}
                id={member.id}
                type="member"
                name={member.name}
                introduction={member.introduction}
                category={member.category || undefined}
                onEdit={() => handleOpenMemberDialog(member)}
                onDelete={() => handleDeleteMember(member.id)}
                onChat={() => handleOpenChat(member)}
              />
            ))}
          </div>
        </TabsContent>

        <TabsContent value="applications" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {applications.map((app) => (
              <TeamCard
                key={app.id}
                id={app.id}
                type="application"
                name={app.name}
                introduction={app.introduction}
                category={app.category}
                entryUrl={app.entryUrl}
                onEdit={() => handleOpenApplicationDialog(app)}
                onDelete={() => handlePrepareDeleteApplication(app.id)}
              />
            ))}
          </div>
        </TabsContent>
      </Tabs>

      <MemberFormDialog
        open={isMemberDialogOpen}
        onOpenChange={setIsMemberDialogOpen}
        editingMember={editingMember}
        onSubmit={handleSubmitMember}
        onClose={handleCloseMemberDialog}
      />

      <ApplicationDialog
        open={isApplicationDialogOpen}
        onOpenChange={(open) => {
          console.log('ApplicationDialog onOpenChange:', open)
          if (open) {
            console.log('打开对话框')
          } else {
            console.log('关闭对话框')
            handleCloseApplicationDialog()
          }
        }}
        onSuccess={() => {
          console.log('ApplicationDialog onSuccess')
          loadApplications()
        }}
        editingApplication={editingApplication}
      />

      {/* 删除确认对话框 */}
      <AlertDialog 
        open={isDeleteDialogOpen} 
        onOpenChange={(open) => {
          console.log('删除对话框 onOpenChange:', open)
          if (!open) {
            console.log('关闭删除对话框，重置 deletingAppId')
            setDeletingAppId(null)
          }
          setIsDeleteDialogOpen(open)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除</AlertDialogTitle>
            <AlertDialogDescription>
              您确定要删除此应用吗？此操作无法撤销。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => {
              console.log('取消删除')
              setIsDeleteDialogOpen(false)
              setDeletingAppId(null)
            }}>取消</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteApplication} className="bg-red-600 hover:bg-red-700">
              删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      
      {/* 聊天对话框 */}
      <Dialog 
        open={isChatDialogOpen} 
        onOpenChange={(open) => {
          console.log('对话框状态变更:', open);
          if (!open) {
            console.log('用户关闭了聊天框，调用handleCloseChat()');
            handleCloseChat();
          }
          else setIsChatDialogOpen(open);
        }}
      >
        <DialogContent className="sm:max-w-[75%] w-[75%] h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-orange-600 flex items-center justify-center text-white">
                {chatMember?.name.charAt(0) || '?'}
              </div>
              <span>{chatMember?.name || '团队成员'}</span>
            </DialogTitle>
          </DialogHeader>
          
          {/* 消息列表区域 */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 my-4 border rounded-md">
            {messages.map((message, index) => (
              <div key={index} className={`flex items-start space-x-2 ${message.role === 'user' ? 'justify-end' : ''}`}>
                {message.role === 'assistant' && (
                  <div className="w-8 h-8 rounded-full bg-orange-600 flex items-center justify-center text-white">
                    {chatMember?.name.charAt(0) || '?'}
                  </div>
                )}
                <div className={`p-3 rounded-lg max-w-[80%] ${
                  message.role === 'assistant' ? "bg-muted" : "bg-primary text-primary-foreground"
                }`}>
                  <p className="whitespace-pre-line">{message.content}</p>
                </div>
                {message.role === 'user' && (
                  <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-white">
                    <UserCircle2 className="w-5 h-5" />
                  </div>
                )}
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
          
          {/* 输入框区域 */}
          <div className="p-2 border-t mt-auto">
            <div className="flex gap-2">
              <input
                type="text"
                placeholder={isSessionReady ? "输入消息..." : "正在准备会话环境..."}
                className="flex-1 min-h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    handleSendMessage()
                  }
                }}
                disabled={isLoading || !isSessionReady}
              />
              <Button 
                onClick={handleSendMessage}
                disabled={isLoading || !inputValue.trim() || !isSessionReady}
                className="px-4"
              >
                {isLoading ? 
                  <div className="h-5 w-5 animate-spin rounded-full border-2 border-current border-t-transparent" /> :
                  <Send className="h-4 w-4" />
                }
              </Button>
            </div>
            {!isSessionReady && (
              <div className="mt-2 text-center text-sm text-muted-foreground flex items-center justify-center gap-2">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                <span>正在初始化会话...</span>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}