'use client'

import { useEffect, useState } from 'react'
// import { useRouter } from 'next/navigation' 
import { useSession } from 'next-auth/react'
import { PlusCircle, Pencil, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { useSystemStore, type System } from '@/lib/stores/system-store'
import { CreateSystemDialog } from '@/components/create-system-dialog'
import { EditSystemDialog } from '@/components/edit-system-dialog'
import { useRequirementAnalysisStore } from '@/lib/stores/requirement-analysis-store'
import { toast } from '@/components/ui/use-toast'

import {useTranslations} from 'next-intl';
// import {setRequestLocale} from 'next-intl/server'; // Removed
import {routing} from '@/i18n/routing';
import {useRouter} from '@/i18n/navigation';

export function generateStaticParams() {
  return routing.locales.map((locale) => ({locale}));
}

export default function Page({params: {locale}}: {params: {locale: string}}) {
  // setRequestLocale(locale); // Removed

  const t = useTranslations('HomePage'); 
  const tCommon = useTranslations('Common');
  const router = useRouter(); 
  const { data: session, status } = useSession()
  const { systems, isLoading, error, fetchSystems, setSelectedSystem, clearSystems } = useSystemStore()
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [editingSystem, setEditingSystem] = useState<System | null>(null)
  const [isCacheLoading, setIsCacheLoading] = useState(false)
  
  const { 
    setCurrentSystem
  } = useRequirementAnalysisStore()

  useEffect(() => {
    if (status === 'authenticated') {
      fetchSystems()
    } else if (status === 'unauthenticated') {
      clearSystems()
      localStorage.removeItem('system-storage')
    }
  }, [fetchSystems, clearSystems, status])

  const handleSystemSelect = async (system: System) => {
    if (!system.id) return
    
    setSelectedSystem(system)
    
    try {
      setIsCacheLoading(true)
      setCurrentSystem(system.id)
      
      // 使用i18n的路由，确保保留当前的语言环境
      router.push(`/systems/${system.id}`)
    } catch (error) {
      console.error('加载系统缓存数据失败:', error)
      toast({
        title: t('loadCacheErrorTitle'),
        description: t('loadCacheErrorDescription'),
        variant: 'destructive'
      })
      router.push(`/systems/${system.id}`)
    } finally {
      setIsCacheLoading(false)
    }
  }

  const handleEditClick = (e: React.MouseEvent, system: System) => {
    e.stopPropagation()
    setEditingSystem(system)
  }

  const handleSystemCreated = () => {
    fetchSystems()
  }

  return (
    <div className="min-h-[calc(100vh-3.5rem)] bg-gradient-to-b from-gray-50 to-gray-100 flex flex-col items-center">
      <div className="w-full max-w-7xl px-4 py-12">
        <div className="mb-12 text-center">
          <h1 className="text-3xl sm:text-4xl font-bold mb-4 text-gray-800 tracking-tight">
            <span className="block text-orange-500 mt-1 text-2xl sm:text-3xl">{t('sloganSubtitle')}</span> 
          </h1>
          <p className="text-base sm:text-lg text-gray-600 mb-8 max-w-2xl mx-auto">
            {session?.user ? t('exploreOrNewLabel_user') : t('exploreOrNewLabel_guest')}
          </p>
          {session?.user && (
            <Button 
              onClick={() => setIsCreateDialogOpen(true)}
              className="bg-orange-500 hover:bg-orange-600 text-base px-5 py-2 h-auto shadow-md"
            >
              <PlusCircle className="mr-2 h-4 w-4" />
              {t('createSystemButton')} 
            </Button>
          )}
        </div>

        {status === 'loading' || isCacheLoading ? (
          <div className="flex justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
            {isCacheLoading && <span className="ml-2 text-orange-500">{t('loadingSystemData')}</span>}
          </div>
        ) : !session?.user ? (
          <div className="text-center">
            <div className="bg-gradient-to-r from-orange-50 to-amber-50 rounded-2xl p-8 max-w-2xl mx-auto">
              <h3 className="text-xl font-semibold text-orange-700 mb-3">{t('welcomeMessage')}</h3>
              <Button 
                onClick={() => router.push('/auth/signin')}
                className="bg-orange-500 hover:bg-orange-600 text-base px-5 py-2 h-auto shadow-md"
              >
                {t('loginButton')}
              </Button>
            </div>
          </div>
        ) : isLoading ? (
          <div className="flex justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
          </div>
        ) : error ? (
          <div className="text-center py-12 bg-white/50 rounded-xl shadow-sm">
            <p className="text-red-500 mb-4">{t('loadCacheErrorTitle')}: {error}</p>
            <Button variant="outline" onClick={() => fetchSystems()} className="mt-2">
              {t('retryButton')}
            </Button>
          </div>
        ) : systems.length === 0 ? (
          <div className="text-center">
            <p className="text-gray-500 mb-6">{t('noSystemsMessage')}</p>
            <Button 
              onClick={() => setIsCreateDialogOpen(true)}
              className="bg-orange-500 hover:bg-orange-600 text-base px-5 py-2 h-auto shadow-md"
            >
              <PlusCircle className="mr-2 h-4 w-4" />
               {t('createFirstSystemButton')}
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {systems.map((system) => (
              <Card 
                key={system.id} 
                className="hover:shadow-lg transition-all duration-200 cursor-pointer bg-white/90 backdrop-blur-sm border-gray-100 relative group min-h-[180px] flex flex-col" 
                onClick={() => handleSystemSelect(system)}
              >
                <CardHeader className="pb-2 flex-none">
                  <CardTitle className="text-lg text-gray-800 pr-8">{system.name}</CardTitle>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={(e) => handleEditClick(e, system)}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                </CardHeader>
                <CardContent className="flex-1">
                  <p className="text-sm text-gray-600 line-clamp-3">
                    {system.description || tCommon('noDescription')}
                  </p>
                </CardContent>
                <CardFooter className="text-xs text-gray-500 pt-2 border-t border-gray-100 flex-none">
                  创建于: {new Date(system.createdAt as Date).toLocaleDateString('zh-CN')}
                </CardFooter>
              </Card>
            ))}
          </div>
        )}
      </div>

      {session?.user && (
        <>
          <CreateSystemDialog 
            open={isCreateDialogOpen} 
            onOpenChange={setIsCreateDialogOpen}
            onSuccess={handleSystemCreated}
          />
          {editingSystem && (
            <EditSystemDialog
              system={editingSystem}
              open={!!editingSystem}
              onOpenChange={(open) => !open && setEditingSystem(null)}
              onSuccess={handleSystemCreated}
            />
          )}
        </>
      )}
    </div>
  )
} 