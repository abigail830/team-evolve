'use client'

import { useState, useEffect } from 'react'
import { 
  Search, 
  PlusCircle, 
  Clock, 
  Tag,
  Edit,
  Trash2,
  Loader2
} from "lucide-react"
import { Standard } from '@/lib/services/standard-service'
import { useRouter } from '@/i18n/navigation'
import { useToast } from '@/components/ui/use-toast'
import { formatDistanceToNow } from 'date-fns'
import { zhCN } from 'date-fns/locale'
import { useTranslations } from 'next-intl'
import dynamic from 'next/dynamic'
import { useSystemStore } from '@/lib/stores/system-store'

// 动态导入UI组件
const Button = dynamic(() => import('@/components/ui/button').then(mod => mod.Button))
const Input = dynamic(() => import('@/components/ui/input').then(mod => mod.Input))
const Card = dynamic(() => import('@/components/ui/card').then(mod => mod.Card))
const CardContent = dynamic(() => import('@/components/ui/card').then(mod => mod.CardContent))
const CardDescription = dynamic(() => import('@/components/ui/card').then(mod => mod.CardDescription))
const CardFooter = dynamic(() => import('@/components/ui/card').then(mod => mod.CardFooter))
const CardHeader = dynamic(() => import('@/components/ui/card').then(mod => mod.CardHeader))
const CardTitle = dynamic(() => import('@/components/ui/card').then(mod => mod.CardTitle))
const Badge = dynamic(() => import('@/components/ui/badge').then(mod => mod.Badge))
const Tabs = dynamic(() => import('@/components/ui/tabs').then(mod => mod.Tabs))
const TabsContent = dynamic(() => import('@/components/ui/tabs').then(mod => mod.TabsContent))
const TabsList = dynamic(() => import('@/components/ui/tabs').then(mod => mod.TabsList))
const TabsTrigger = dynamic(() => import('@/components/ui/tabs').then(mod => mod.TabsTrigger))

export default function StandardsPage() {
  const { selectedSystemId, systems } = useSystemStore()
  const [standards, setStandards] = useState<Standard[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [searchTags, setSearchTags] = useState<string[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const router = useRouter()
  const { toast } = useToast()
  const t = useTranslations('StandardCenter')
  
  // 获取所有规范
  const fetchStandards = async (name?: string, tags?: string[]) => {
    if (!selectedSystemId) {
      console.warn('未选择系统，无法获取规范列表');
      setStandards([]);
      setIsLoading(false);
      return;
    }
    
    setIsLoading(true)
    try {
      const params = new URLSearchParams()
      if (name) params.append('name', name)
      if (tags && tags.length > 0) params.append('tags', tags.join(','))
      // 添加当前系统ID筛选
      params.append('systemId', selectedSystemId)
      
      const requestUrl = `/api/standards?${params.toString()}`;
      console.log(`获取系统[${selectedSystemId}]的规范列表, URL:`, requestUrl);
      
      const response = await fetch(requestUrl);
      if (!response.ok) throw new Error('获取规范失败')
      
      const data = await response.json();
      console.log(`规范列表数据:`, { count: data.length, systemId: selectedSystemId });
      
      // 直接使用API返回的数据，相信后端已经根据systemId正确过滤
      setStandards(data);
    } catch (error) {
      console.error('获取规范失败:', error)
      toast({
        title: t('fetchFailed'),
        description: t('fetchFailedDesc'),
        variant: "destructive"
      })
    } finally {
      setIsLoading(false)
    }
  }
  
  // 初始化加载
  useEffect(() => {
    if (selectedSystemId) {
      fetchStandards()
    }
  }, [selectedSystemId])
  
  // 处理搜索
  const handleSearch = () => {
    fetchStandards(searchQuery, searchTags)
  }
  
  // 添加标签搜索
  const addTagFilter = (tag: string) => {
    if (!searchTags.includes(tag)) {
      setSearchTags([...searchTags, tag])
    }
  }
  
  // 移除标签搜索
  const removeTagFilter = (tag: string) => {
    setSearchTags(searchTags.filter(t => t !== tag))
  }
  
  // 格式化日期
  const formatDate = (date: Date) => {
    return formatDistanceToNow(new Date(date), { addSuffix: true, locale: zhCN })
  }
  
  // 跳转到创建页面
  const goToCreatePage = () => {
    router.push('/knowledge/standards/create')
  }
  
  // 跳转到详情页面
  const goToDetailPage = (id: string) => {
    router.push(`/knowledge/standards/${id}`)
  }
  
  // 获取当前系统名称
  const currentSystemName = systems.find(s => s.id === selectedSystemId)?.name || ''
  
  return (
    <div className="min-h-[calc(100vh-3.5rem)] bg-gradient-to-b from-gray-50 to-gray-100">
      <div className="w-[90%] mx-auto py-7">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-bold text-gray-800 tracking-tight">{t('title')}</h1>
          <p className="text-sm text-muted-foreground">
            {currentSystemName ? `${t('subtitle')} - ${currentSystemName}` : t('subtitle')}
          </p>
        </div>

        {!selectedSystemId ? (
          <div className="text-center py-12 text-gray-500">
            请先选择一个系统，才能查看和管理规范
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between mt-6 mb-8">
              <div className="flex gap-4 flex-1 max-w-[600px]">
                <div className="flex-1 relative">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-500" />
                  <Input
                    placeholder={t('searchPlaceholder')}
                    className="pl-9 h-9"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                  />
                </div>
                <Button onClick={handleSearch} variant="secondary" className="h-9">{t('search')}</Button>
              </div>
              
              <Button 
                onClick={goToCreatePage}
                className="bg-orange-500 hover:bg-orange-600 text-white h-9"
              >
                <PlusCircle className="mr-2 h-4 w-4" />
                {t('createStandard')}
              </Button>
            </div>
            
            {/* 标签过滤器 */}
            {searchTags.length > 0 && (
              <div className="flex gap-2 mt-4 flex-wrap">
                <div className="text-sm text-gray-500 py-1">{t('filterTags')}:</div>
                {searchTags.map(tag => (
                  <Badge key={tag} variant="secondary" className="cursor-pointer" onClick={() => removeTagFilter(tag)}>
                    {tag} ×
                  </Badge>
                ))}
              </div>
            )}
            
            {isLoading ? (
              <div className="text-center py-12">
                <div className="flex justify-center">
                  <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
                </div>
              </div>
            ) : standards.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                {t('noStandards')}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {standards.map(standard => (
                  <Card key={standard.id} className="hover:shadow-lg transition-all duration-200 cursor-pointer bg-white/90 backdrop-blur-sm border-gray-100 relative group min-h-[160px] flex flex-col">
                    <CardHeader className="pb-1 flex-none space-y-1">
                      <CardTitle className="text-lg text-gray-800 truncate cursor-pointer hover:text-orange-600" onClick={() => goToDetailPage(standard.id)}>
                        {standard.name}
                      </CardTitle>
                      <CardDescription className="line-clamp-2">
                        {standard.description || t('noDescription')}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="flex-1 py-2">
                      <div className="flex flex-wrap gap-1.5">
                        {standard.tags.map(tag => (
                          <Badge key={tag} className="bg-orange-500 hover:bg-orange-600 text-white cursor-pointer" onClick={() => addTagFilter(tag)}>
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    </CardContent>
                    <CardFooter className="pt-1 border-t border-gray-100 flex justify-between text-xs text-gray-500">
                      <div className="flex items-center">
                        <Clock className="mr-1 h-3 w-3" />
                        {formatDate(standard.updatedAt)}
                      </div>
                      <div className="flex gap-2">
                        <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); goToDetailPage(standard.id); }}>
                          <Edit className="h-4 w-4" />
                        </Button>
                      </div>
                    </CardFooter>
                  </Card>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
} 