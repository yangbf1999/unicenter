'use client'

import { useEffect, useMemo } from 'react'

import { useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'
import { Alert, Box, Button, CircularProgress } from '@mui/material'

import WidgetGrid from '@/components/dashboard/WidgetGrid'
import { useSettings } from '@core/hooks/useSettings'
import { usePageTitle } from '@/contexts/PageTitleContext'
import { useDashboard } from '@/hooks/useDashboard'
import { useMyVdcs } from '@/hooks/useMyVdcs'
import ClassicOverviewSkeleton from '@/components/dashboard/ClassicOverviewSkeleton'

const NebulaOverview = dynamic(() => import('@/components/dashboard/NebulaOverview'), {
  loading: () => <Box sx={{ minHeight: 480 }} />,
})
const ClassicOverview = dynamic(() => import('@/components/dashboard/ClassicOverview'), {
  loading: ClassicOverviewSkeleton,
})

function useTimeAgo() {
  const t = useTranslations('time')

  return (date) => {
    const now = new Date()
    const past = new Date(date)
    const diff = Math.floor((now - past) / 1000)

    if (diff < 60) return t('secondsAgo')
    if (diff < 3600) return t('minutesAgo', { count: Math.floor(diff / 60) })
    if (diff < 86400) return t('hoursAgo', { count: Math.floor(diff / 3600) })

return t('daysAgo', { count: Math.floor(diff / 86400) })
  }
}

export default function HomePage() {
  const t = useTranslations()
  const timeAgo = useTimeAgo()
  const { setPageInfo } = usePageTitle()
  const { settings } = useSettings()
  const isNebula = settings.globalTheme === 'nebula'
  const isVcenterClassic = settings.globalTheme === 'vcenterClassic'

  const router = useRouter()
  const { hasVdc, loading: vdcLoading } = useMyVdcs()

  useEffect(() => {
    if (!vdcLoading && hasVdc) {
      router.replace('/my-vdc')
    }
  }, [vdcLoading, hasVdc, router])

  const { data: dashboardResponse, error, isLoading, isValidating, mutate } = useDashboard()
  const data = dashboardResponse?.data ?? null
  const loading = isLoading
  const lastRefresh = useMemo(() => dashboardResponse ? new Date() : null, [dashboardResponse])

  // Mettre à jour le titre dans le header
  useEffect(() => {
    setPageInfo(t('dashboard.title'), lastRefresh ? t('time.synced', { time: timeAgo(lastRefresh) }) : t('common.loading'), 'ri-dashboard-line')
  }, [lastRefresh, setPageInfo, t, timeAgo])

  // Nettoyer le titre quand on quitte la page
  useEffect(() => {
    return () => setPageInfo('', '', '')
  }, [setPageInfo])

  if (vdcLoading || hasVdc) {
    if (isVcenterClassic && vdcLoading) return <ClassicOverviewSkeleton />

    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh' }}>
        <CircularProgress />
      </Box>
    )
  }

  if (error && !data) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity='error'>{t('dashboard.loadingError')}: {error.message}</Alert>
        <Button variant='outlined' onClick={() => mutate()} sx={{ mt: 2 }}>{t('common.retry')}</Button>
      </Box>
    )
  }

  if (isNebula) {
    return (
      <Box sx={{ height: '100%', minHeight: 0, overflow: 'auto' }}>
        <NebulaOverview
          data={data}
          loading={loading && !data}
          refreshing={isValidating}
          refreshError={error}
          onRefresh={() => mutate()}
        />
      </Box>
    )
  }

  if (isVcenterClassic) {
    return (
      <ClassicOverview
        data={data}
        loading={loading && !data}
        refreshing={isValidating}
        lastUpdated={lastRefresh}
        onRefresh={() => mutate()}
      />
    )
  }

  return (
    <Box sx={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      minHeight: 0,
      mt: isNebula ? 0 : -1.5,
    }}>
      {/* Widget Grid - avec boutons refresh et personnaliser */}
      <Box sx={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
        <WidgetGrid data={data} loading={loading && !data} onRefresh={() => mutate()} refreshLoading={isValidating} />
      </Box>
    </Box>
  )
}
