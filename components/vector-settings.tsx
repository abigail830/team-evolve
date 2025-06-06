'use client'

import React, { useCallback, useMemo, useState, useEffect } from 'react'
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Plus, Trash2, Zap, AlertCircle } from 'lucide-react'
import { toast } from "@/components/ui/use-toast"
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { useVectorConfigStore } from '@/lib/stores/vector-config-store'
import { cn } from '@/lib/utils'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { useTranslations } from 'next-intl'
import { VectorModelConfig, addVectorConfig, deleteVectorConfig, getAllVectorConfigs, setVectorConfig } from '@/lib/services/vector-config-service'

// 可用的向量模型预设
const vectorModelPresets = [
  {
    name: 'OpenAI',
    baseURL: 'https://api.openai.com/v1',
    models: [
      'text-embedding-3-small',   // 更小、更快、更便宜
      'text-embedding-3-large',   // 最强性能
      'text-embedding-ada-002'    // 旧版本，向后兼容
    ],
    dimensions: {  // 不同模型的维度
      'text-embedding-3-small': 1536,
      'text-embedding-3-large': 3072, 
      'text-embedding-ada-002': 1536
    } as Record<string, number>
  },
  {
    name: '智谱AI',
    baseURL: 'https://open.bigmodel.cn/api/paas/v4',
    models: [
      'embedding-2',     // 通用文本向量
      'embedding-2-1',   // 增强版文本向量
      'embedding-3'      // 最新版本
    ],
    dimensions: {  // 不同模型的维度
      'embedding-2': 1024,
      'embedding-2-1': 1024,
      'embedding-3': 1536
    } as Record<string, number>
  }
]

export default function VectorSettings({ onStatusChange }: { onStatusChange?: (loading: boolean) => void }) {
  const t = useTranslations('VectorSettings')
  
  // 使用 Zustand store 获取配置
  const { defaultConfig, setDefaultConfig, clearDefaultConfig } = useVectorConfigStore()
  
  // 本地状态
  const [configs, setConfigs] = useState<VectorModelConfig[]>([])
  const [showAddForm, setShowAddForm] = useState(false)
  const [newConfig, setNewConfig] = useState<Partial<VectorModelConfig>>({})
  const [testingId, setTestingId] = useState<string | null>(null)
  const [testResults, setTestResults] = useState<Record<string, boolean>>({})
  const [isDefault, setIsDefault] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  // 更新父组件加载状态
  useEffect(() => {
    onStatusChange?.(isLoading)
  }, [isLoading, onStatusChange])

  // 加载所有配置
  useEffect(() => {
    const loadConfigs = async () => {
      try {
        setIsLoading(true)
        const allConfigs = await getAllVectorConfigs()
        setConfigs(allConfigs)
      } catch (error) {
        console.error('加载配置失败:', error)
        toast({
          title: t('messages.loadFailed'),
          description: t('messages.loadFailedDetail'),
          variant: 'destructive',
        })
      } finally {
        setIsLoading(false)
      }
    }
    loadConfigs()
  }, [t])

  // 处理预设选择
  const handlePresetChange = useCallback((preset: string) => {
    // 找到第一个连字符的位置
    const firstHyphenIndex = preset.indexOf('-');
    
    // 提取提供商名称和模型名称
    const provider = preset.slice(0, firstHyphenIndex);
    const model = preset.slice(firstHyphenIndex + 1);
    
    let baseURL = '';
    
    const providerData = vectorModelPresets.find(p => p.name === provider);
    if (providerData) {
      baseURL = providerData.baseURL;
    }
    
    setNewConfig({
      ...newConfig,
      name: `${provider}-${model}`,
      model,
      baseURL
    });
  }, [newConfig])

  // 添加新配置
  const handleAddConfig = useCallback(async () => {
    if (!newConfig.name || !newConfig.baseURL || !newConfig.apiKey || !newConfig.model) {
      toast({
        title: t('messages.validationFailed'),
        description: t('messages.requiredFields'),
        variant: 'destructive',
      })
      return
    }

    // 为新配置生成唯一ID
    const id = Date.now().toString()
    
    // 确定模型维度
    let dimension = 1536; // 默认维度
    
    // 从预设中查找维度
    const [provider] = newConfig.name?.split('-') || [];
    const modelName = newConfig.model || '';
    const presetProvider = vectorModelPresets.find(p => p.name === provider);
    
    if (presetProvider?.dimensions && modelName in presetProvider.dimensions) {
      dimension = presetProvider.dimensions[modelName as keyof typeof presetProvider.dimensions];
    }
    
    const configToAdd: VectorModelConfig = {
      id,
      name: newConfig.name,
      baseURL: newConfig.baseURL.trim(),
      apiKey: newConfig.apiKey.trim(),
      model: newConfig.model.trim(),
      isDefault: isDefault,
      dimension,
      provider
    }
    
    try {
      setIsLoading(true)
      // 添加到数据库
      const savedConfig = await addVectorConfig(configToAdd)
      
      // 如果是默认配置，更新store（使用返回的加密配置）
      if (isDefault) {
        await setVectorConfig(savedConfig)
        setDefaultConfig(savedConfig)
      }
      
      // 重新加载配置列表
      const allConfigs = await getAllVectorConfigs()
      setConfigs(allConfigs)
      
      // 重置表单
      setNewConfig({})
      setIsDefault(false)
      setShowAddForm(false)
      
      toast({
        title: t('messages.addSuccess'),
        description: t('messages.addSuccessDetail'),
      })
    } catch (error) {
      console.error('添加配置失败:', error)
      toast({
        title: t('messages.addFailed'),
        description: t('messages.addFailedDetail'),
        variant: 'destructive',
      })
    } finally {
      setIsLoading(false)
    }
  }, [newConfig, isDefault, setDefaultConfig, t])

  // 删除配置
  const handleDeleteConfig = useCallback(async (id: string) => {
    if (!confirm(t('messages.deleteConfirm'))) return
    
    try {
      setIsLoading(true)
      const configToDelete = configs.find(c => c.id === id)
      await deleteVectorConfig(id)
      
      // 如果删除的是默认配置
      if (configToDelete?.isDefault) {
        // 获取剩余配置中最新的一个
        const remainingConfigs = configs.filter(c => c.id !== id)
        if (remainingConfigs.length > 0) {
          const newDefault = remainingConfigs[remainingConfigs.length - 1]
          await setVectorConfig(newDefault)
          setDefaultConfig(newDefault)
        } else {
          clearDefaultConfig()
        }
      }
      
      // 重新加载配置列表
      const allConfigs = await getAllVectorConfigs()
      setConfigs(allConfigs)
      
      // 清除该配置的测试结果
      setTestResults((prev) => {
        const newResults = { ...prev }
        delete newResults[id]
        return newResults
      })
      
      toast({
        title: t('messages.deleteSuccess'),
        description: t('messages.deleteSuccessDetail'),
      })
    } catch (error) {
      console.error('删除配置失败:', error)
      toast({
        title: t('messages.deleteFailed'),
        description: t('messages.deleteFailedDetail'),
        variant: 'destructive',
      })
    } finally {
      setIsLoading(false)
    }
  }, [configs, setDefaultConfig, clearDefaultConfig, t])

  // 设置默认配置
  const handleSetDefault = useCallback(async (id: string) => {
    try {
      setIsLoading(true)
      const configToSetDefault = configs.find(c => c.id === id)
      if (!configToSetDefault) return
      
      await setVectorConfig(configToSetDefault)
      setDefaultConfig(configToSetDefault)
      
      // 重新加载配置列表
      const allConfigs = await getAllVectorConfigs()
      setConfigs(allConfigs)
      
      toast({
        title: t('messages.defaultUpdated'),
        description: t('messages.defaultUpdatedDetail'),
      })
    } catch (error) {
      console.error('设置默认配置失败:', error)
      toast({
        title: t('messages.defaultFailed'),
        description: t('messages.defaultFailedDetail'),
        variant: 'destructive',
      })
    } finally {
      setIsLoading(false)
    }
  }, [configs, setDefaultConfig, t])

  // 测试连接
  const handleTestConfig = useCallback(async (config: VectorModelConfig) => {
    if (!config.id) return;
    
    setTestingId(config.id)
    
    try {
      const response = await fetch('/api/vector-config/test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          baseURL: config.baseURL,
          apiKey: config.apiKey,
          model: config.model
        }),
      })

      if (!response.ok) {
        throw new Error(await response.text())
      }

      const data = await response.json()
      
      setTestResults((prev: Record<string, boolean>) => ({ 
        ...prev, 
        [config.id as string]: true 
      }))
      toast({
        title: t('messages.testSuccess'),
        description: t('messages.testSuccessDetail', {
          name: config.name,
          testText: data.data.testText,
          dimensions: data.data.dimensions,
          embedding: data.data.embedding.join(', ')
        }),
      })
    } catch (error) {
      setTestResults((prev: Record<string, boolean>) => ({ 
        ...prev, 
        [config.id as string]: false 
      }))
      toast({
        title: t('messages.testFailed'),
        description: error instanceof Error ? error.message : t('messages.testFailedDetail'),
        variant: 'destructive',
      })
    } finally {
      setTestingId(null)
    }
  }, [t])

  // 使用 useMemo 缓存配置列表渲染
  const configRows = useMemo(() => {
    return configs.map((config) => {
      // 确保配置有id
      if (!config.id) return null;
      
      return (
        <TableRow key={config.id}>
          <TableCell className="py-2 text-sm">{config.name}</TableCell>
          <TableCell className="py-2 text-sm">{config.model}</TableCell>
          <TableCell className="py-2 text-sm">{config.baseURL}</TableCell>
          <TableCell className="py-2 text-center">
            <div
              className={cn(
                "h-3 w-3 rounded-full border border-primary cursor-pointer",
                config.isDefault && "bg-primary"
              )}
              onClick={() => handleSetDefault(config.id as string)}
            />
          </TableCell>
          <TableCell className="py-2">
            <div className="flex gap-1">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleTestConfig(config)}
                disabled={testingId === config.id}
                className={cn(
                  "h-7 text-xs",
                  testResults[config.id] === true && "bg-green-50 text-green-600 hover:bg-green-100",
                  testResults[config.id] === false && "bg-red-50 text-red-600 hover:bg-red-100"
                )}
              >
                {testingId === config.id ? (
                  <>
                    <Zap className="mr-1 h-3 w-3 animate-spin" />
                    {t('actions.testing')}
                  </>
                ) : (
                  <>
                    <Zap className="mr-1 h-3 w-3" />
                    {t('actions.testConnection')}
                  </>
                )}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => handleDeleteConfig(config.id as string)}
                disabled={testingId === config.id}
                className="h-7 w-7 text-muted-foreground hover:text-destructive"
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          </TableCell>
        </TableRow>
      );
    }).filter(Boolean)
  }, [configs, testingId, testResults, handleTestConfig, handleDeleteConfig, handleSetDefault, t])

  // 使用 useMemo 缓存添加表单渲染
  const addForm = useMemo(() => {
    if (!showAddForm) return null
    
    return (
      <div className="space-y-3 border p-3 rounded-md bg-slate-50">
        <h2 className="text-sm font-semibold">{t('addForm.title')}</h2>
        <div className="space-y-2">
          <div className="grid grid-cols-[100px,1fr] items-center gap-3">
            <Label htmlFor="vector-preset" className="text-xs">{t('addForm.fields.preset')}</Label>
            <Select onValueChange={handlePresetChange}>
              <SelectTrigger id="vector-preset" className="h-8 text-sm">
                <SelectValue placeholder={t('addForm.fields.presetPlaceholder')} />
              </SelectTrigger>
              <SelectContent>
                {vectorModelPresets.map(provider => (
                  <React.Fragment key={provider.name}>
                    {provider.models.map(model => (
                      <SelectItem key={`${provider.name}-${model}`} value={`${provider.name}-${model}`} className="text-sm">
                        {provider.name} - {model}
                      </SelectItem>
                    ))}
                  </React.Fragment>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-[100px,1fr] items-center gap-3">
            <Label htmlFor="vector-name" className="text-xs">{t('addForm.fields.name')}</Label>
            <Input
              id="vector-name"
              value={newConfig.name || ''}
              onChange={(e) => setNewConfig(prev => ({ ...prev, name: e.target.value }))}
              placeholder={t('addForm.fields.namePlaceholder')}
              className="h-8 text-sm"
            />
          </div>

          <div className="grid grid-cols-[100px,1fr] items-center gap-3">
            <Label htmlFor="vector-model" className="text-xs">{t('addForm.fields.model')}</Label>
            <Input
              id="vector-model"
              value={newConfig.model || ''}
              onChange={(e) => setNewConfig(prev => ({ ...prev, model: e.target.value }))}
              placeholder={t('addForm.fields.modelPlaceholder')}
              className="h-8 text-sm"
            />
          </div>

          <div className="grid grid-cols-[100px,1fr] items-center gap-3">
            <Label htmlFor="vector-url" className="text-xs">{t('addForm.fields.apiUrl')}</Label>
            <Input
              id="vector-url"
              value={newConfig.baseURL || ''}
              onChange={(e) => setNewConfig(prev => ({ ...prev, baseURL: e.target.value }))}
              placeholder={t('addForm.fields.apiUrlPlaceholder')}
              className="h-8 text-sm"
            />
          </div>

          <div className="grid grid-cols-[100px,1fr] items-center gap-3">
            <Label htmlFor="vector-api-key" className="text-xs">{t('addForm.fields.apiKey')}</Label>
            <Input
              id="vector-api-key"
              type="password"
              value={newConfig.apiKey || ''}
              onChange={(e) => setNewConfig(prev => ({ ...prev, apiKey: e.target.value }))}
              placeholder={t('addForm.fields.apiKeyPlaceholder')}
              className="h-8 text-sm"
            />
          </div>

          <div className="grid grid-cols-[100px,1fr] items-center gap-3">
            <Label htmlFor="vector-default" className="text-xs">{t('addForm.fields.setDefault')}</Label>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="vector-default"
                checked={isDefault}
                onCheckedChange={(checked) => setIsDefault(checked as boolean)}
              />
              <Label htmlFor="vector-default" className="text-sm">{t('addForm.fields.defaultLabel')}</Label>
            </div>
          </div>

          <div className="flex justify-end gap-2 mt-3">
            <Button variant="outline" size="sm" onClick={() => {
              setShowAddForm(false)
              setIsDefault(false)
              setNewConfig({})
            }}>
              {t('addForm.buttons.cancel')}
            </Button>
            <Button size="sm" onClick={handleAddConfig}>
              {t('addForm.buttons.add')}
            </Button>
          </div>
        </div>
      </div>
    )
  }, [showAddForm, newConfig, handlePresetChange, handleAddConfig, isDefault, t])

  return (
    <Card className="w-full">
      <CardHeader className="pb-6">
        <div className="flex justify-between items-center">
          <div>
            <CardTitle className="text-xl font-bold mb-3">{t('card.title')}</CardTitle>
            <CardDescription className="text-base">
              {t('card.description')}
            </CardDescription>
          </div>
          {!showAddForm && (
            <Button size="sm" onClick={() => setShowAddForm(true)}>
              <Plus className="mr-2 h-4 w-4" />
              {t('card.addButton')}
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="pt-4">
        <div className="space-y-8">
          {addForm}
          
          {configs.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="h-8 text-xs">{t('tableHeaders.name')}</TableHead>
                  <TableHead className="h-8 text-xs">{t('tableHeaders.model')}</TableHead>
                  <TableHead className="h-8 text-xs">{t('tableHeaders.apiUrl')}</TableHead>
                  <TableHead className="h-8 text-xs">{t('tableHeaders.default')}</TableHead>
                  <TableHead className="h-8 text-xs">{t('tableHeaders.actions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {configRows}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-6 text-sm text-muted-foreground">
              {t('noConfigs')}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
} 