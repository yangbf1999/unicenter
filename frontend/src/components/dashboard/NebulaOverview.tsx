'use client'

import { useMemo } from 'react'

import { useLocale } from 'next-intl'
import { useRouter } from 'next/navigation'
import {
  Alert,
  Box,
  Button,
  Chip,
  LinearProgress,
  Skeleton,
  Typography,
} from '@mui/material'

type DashboardData = {
  summary?: {
    clusters?: number
    standalones?: number
    nodes?: number
    nodesOnline?: number
    nodesOffline?: number
    vmsRunning?: number
    vmsTotal?: number
    lxcRunning?: number
    lxcTotal?: number
  }
  clusters?: Array<{
    id?: string
    name?: string
    isCluster?: boolean
    nodes?: number
    onlineNodes?: number
    quorum?: { quorate?: boolean } | null
    cephHealth?: string | null
  }>
  nodes?: Array<{
    node?: string
    name?: string
    status?: string
    connectionId?: string
  }>
  resources?: {
    cpuPct?: number
    ramPct?: number
    storagePct?: number
    memUsedFormatted?: string
    memMaxFormatted?: string
    storageUsedFormatted?: string
    storageMaxFormatted?: string
  }
  pbs?: {
    servers?: number
    backups24h?: { total?: number; ok?: number; error?: number }
  }
  alerts?: Array<{
    id?: string
    severity?: string
    message?: string
    source?: string
    time?: string
  }>
  alertsSummary?: {
    crit?: number
    warn?: number
    info?: number
  }
  lastUpdated?: string
}

type NebulaOverviewProps = {
  data: DashboardData | null
  loading: boolean
  refreshing: boolean
  refreshError?: Error | null
  onRefresh: () => void
}

type Copy = {
  title: string
  description: string
  refresh: string
  refreshing: string
  createVm: string
  addConnection: string
  updated: string
  stale: string
  datacenters: string
  hosts: string
  instances: string
  alerts: string
  resourceUsage: string
  topology: string
  serviceHealth: string
  attention: string
  noData: string
  noResources: string
  unknown: string
  notConfigured: string
  connected: string
  running: string
  stopped: string
  online: string
  offline: string
  cpu: string
  memory: string
  storage: string
  viewAll: string
  clusters: string
  standaloneConnections: string
  critical: string
  warning: string
  info: string
  sampleNote: string
  healthDisclaimer: string
  noOpenAlerts: string
  platformHa: string
  backupRecovery: string
}

const COPY: Record<'zh' | 'en', Copy> = {
  zh: {
    title: '全局摘要',
    description: '资源、服务健康、待办与告警的统一运行视图',
    refresh: '刷新',
    refreshing: '正在更新',
    createVm: '创建虚拟机',
    addConnection: '添加 UNISPHERE / PBS',
    updated: '更新于',
    stale: '后台刷新失败，当前保留最后一次有效数据。',
    datacenters: '数据中心',
    hosts: '主机',
    instances: '虚拟机 / 容器',
    alerts: '待处理告警',
    resourceUsage: '资源使用',
    topology: '数据中心拓扑',
    serviceHealth: '服务健康',
    attention: '待办与告警',
    noData: '暂无数据',
    noResources: '尚未接入基础设施资源',
    unknown: '未知',
    notConfigured: '未配置',
    connected: '已接入',
    running: '运行中',
    stopped: '已停止',
    online: '已连接',
    offline: '已断开',
    cpu: 'CPU',
    memory: '内存',
    storage: '存储',
    viewAll: '查看全部',
    clusters: '集群',
    standaloneConnections: '独立连接',
    critical: '严重',
    warning: '警告',
    info: '信息',
    sampleNote: '当前采样 · 使用量与总量采用后端返回口径',
    healthDisclaimer: '未返回健康状态的服务不会默认显示正常',
    noOpenAlerts: '当前无待处理告警',
    platformHa: '平台 HA',
    backupRecovery: '备份与恢复',
  },
  en: {
    title: 'Global overview',
    description: 'A unified operational view of resources, service health, actions and alerts',
    refresh: 'Refresh',
    refreshing: 'Refreshing',
    createVm: 'Create virtual machine',
    addConnection: 'Add UNISPHERE / PBS',
    updated: 'Updated',
    stale: 'Background refresh failed. The last valid data is still displayed.',
    datacenters: 'Datacenters',
    hosts: 'Hosts',
    instances: 'VMs / containers',
    alerts: 'Open alerts',
    resourceUsage: 'Resource usage',
    topology: 'Datacenter topology',
    serviceHealth: 'Service health',
    attention: 'Actions and alerts',
    noData: 'No data',
    noResources: 'No infrastructure resources are connected',
    unknown: 'Unknown',
    notConfigured: 'Not configured',
    connected: 'Connected',
    running: 'Running',
    stopped: 'Stopped',
    online: 'Connected',
    offline: 'Disconnected',
    cpu: 'CPU',
    memory: 'Memory',
    storage: 'Storage',
    viewAll: 'View all',
    clusters: 'clusters',
    standaloneConnections: 'standalone connections',
    critical: 'Critical',
    warning: 'Warning',
    info: 'Info',
    sampleNote: 'Current sample · Usage and totals use backend-provided values',
    healthDisclaimer: 'Services without a reported health state are never assumed healthy',
    noOpenAlerts: 'There are no open alerts',
    platformHa: 'Platform HA',
    backupRecovery: 'Backup and recovery',
  },
}

const panelSx = {
  minWidth: 0,
  border: '1px solid var(--nebula-border-subtle)',
  borderRadius: 'var(--nebula-radius-panel)',
  bgcolor: 'var(--nebula-bg-surface)',
  boxShadow: 'var(--nebula-shadow-panel)',
}

function safeNumber(value: unknown) {
  const parsed = Number(value)

  return Number.isFinite(parsed) ? parsed : 0
}

function nullablePercent(value: unknown) {
  if (value == null || value === '') return null
  const parsed = Number(value)

  return Number.isFinite(parsed) ? parsed : null
}

function StatusPill({
  label,
  tone = 'neutral',
}: {
  label: string
  tone?: 'success' | 'warning' | 'error' | 'info' | 'neutral'
}) {
  const icon = tone === 'success'
    ? 'ri-checkbox-circle-fill'
    : tone === 'warning'
      ? 'ri-error-warning-fill'
      : tone === 'error'
        ? 'ri-close-circle-fill'
        : tone === 'info'
          ? 'ri-loader-4-line'
          : 'ri-question-fill'

  return (
    <Chip
      size="small"
      icon={<i className={icon} aria-hidden style={{ fontSize: 13 }} />}
      label={label}
      sx={{
        height: 24,
        display: 'inline-flex',
        alignItems: 'center',
        gap: '4px',
        px: '6px',
        flexShrink: 0,
        color: `var(--nebula-status-${tone === 'neutral' ? 'neutral' : tone})`,
        bgcolor: `var(--nebula-status-${tone === 'neutral' ? 'neutral' : tone}-bg)`,
        border: '1px solid',
        borderColor: `color-mix(in srgb, var(--nebula-status-${tone === 'neutral' ? 'neutral' : tone}) 34%, transparent)`,
        '& .MuiChip-label': {
          display: 'block',
          padding: 0,
          fontSize: 12,
          fontWeight: 600,
          lineHeight: '16px',
        },
        '& .MuiChip-icon': {
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '14px',
          height: '14px',
          margin: 0,
          flexShrink: 0,
          lineHeight: 1,
          color: 'inherit',
        },
      }}
    />
  )
}

function MetricCard({
  icon,
  label,
  value,
  detail,
  onClick,
  loading,
}: {
  icon: string
  label: string
  value: number
  detail: string
  onClick?: () => void
  loading: boolean
}) {
  const content = (
    <>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
        <Typography sx={{ color: 'text.secondary', fontSize: 13, fontWeight: 500 }}>{label}</Typography>
        <i className={icon} aria-hidden style={{ fontSize: 20, color: 'var(--nebula-brand-blue)' }} />
      </Box>
      {loading ? (
        <Skeleton width="54%" height={48} />
      ) : (
        <Typography sx={{ mt: 1, fontSize: 32, lineHeight: '40px', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
          {value}
        </Typography>
      )}
      <Typography sx={{ mt: 0.5, color: 'text.secondary', fontSize: 12 }}>{detail}</Typography>
    </>
  )

  const cardSx = {
    ...panelSx,
    width: '100%',
    p: 2,
    color: 'text.primary',
    font: 'inherit',
    textAlign: 'left',
  }

  if (!onClick) {
    return (
      <Box component="article" sx={cardSx}>
        {content}
      </Box>
    )
  }

  return (
    <Box
      component="button"
      type="button"
      onClick={onClick}
      sx={{
        ...cardSx,
        appearance: 'none',
        cursor: 'pointer',
        transition: 'border-color var(--nebula-duration-interaction) var(--nebula-motion-easing), background-color var(--nebula-duration-interaction) var(--nebula-motion-easing)',
        '&:hover': {
          borderColor: 'primary.main',
          bgcolor: 'var(--nebula-bg-hover)',
        },
        '&:focus-visible': {
          outline: '2px solid var(--nebula-border-focus)',
          outlineOffset: 2,
        },
      }}
    >
      {content}
    </Box>
  )
}

function ResourceRow({
  label,
  value,
  detail,
  color,
}: {
  label: string
  value: number | null
  detail: string
  color: string
}) {
  return (
    <Box>
      <Box sx={{ mb: 0.75, display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 2 }}>
        <Typography sx={{ fontSize: 13, fontWeight: 500 }}>{label}</Typography>
        <Typography sx={{ color: 'text.secondary', fontSize: 12, fontVariantNumeric: 'tabular-nums' }}>
          {value == null ? '—' : `${value.toFixed(1)}%`} {detail ? `· ${detail}` : ''}
        </Typography>
      </Box>
      <LinearProgress
        className="nebula-linear-progress"
        variant="determinate"
        value={value ?? 0}
        aria-label={label}
        aria-valuetext={value == null ? '暂无数据' : `${value.toFixed(1)}%`}
        sx={{
          '--nebula-progress-color': color,
          height: 8,
          borderRadius: 4,
          bgcolor: 'var(--nebula-status-neutral-bg)',
          '& .MuiLinearProgress-bar': { borderRadius: 4, bgcolor: color },
        }}
      />
    </Box>
  )
}

export default function NebulaOverview({
  data,
  loading,
  refreshing,
  refreshError,
  onRefresh,
}: NebulaOverviewProps) {
  const locale = useLocale()
  const router = useRouter()
  const copy = COPY[locale.startsWith('zh') ? 'zh' : 'en']

  const model = useMemo(() => {
    const summary = data?.summary ?? {}
    const alertSummary = data?.alertsSummary ?? {}
    const datacenters = safeNumber(summary.clusters) + safeNumber(summary.standalones)
    const hosts = safeNumber(summary.nodes)
    const onlineHosts = safeNumber(summary.nodesOnline)
    const vms = safeNumber(summary.vmsTotal)
    const containers = safeNumber(summary.lxcTotal)
    const running = safeNumber(summary.vmsRunning) + safeNumber(summary.lxcRunning)
    const alertCount = safeNumber(alertSummary.crit) + safeNumber(alertSummary.warn) + safeNumber(alertSummary.info)

    return {
      datacenters,
      hosts,
      onlineHosts,
      instances: vms + containers,
      running,
      alertCount,
      hasResources: datacenters > 0 || hosts > 0 || vms + containers > 0,
    }
  }, [data])

  const resources = data?.resources
  const resourceRows = [
    {
      label: copy.cpu,
      value: nullablePercent(resources?.cpuPct),
      detail: '',
      color: 'var(--nebula-brand-blue)',
    },
    {
      label: copy.memory,
      value: nullablePercent(resources?.ramPct),
      detail: resources ? `${resources.memUsedFormatted || '—'} / ${resources.memMaxFormatted || '—'}` : '',
      color: 'var(--nebula-brand-cyan)',
    },
    {
      label: copy.storage,
      value: nullablePercent(resources?.storagePct),
      detail: resources ? `${resources.storageUsedFormatted || '—'} / ${resources.storageMaxFormatted || '—'}` : '',
      color: 'var(--nebula-brand-violet)',
    },
  ]
  const visibleClusters = (data?.clusters ?? []).slice(0, 6)
  const visibleAlerts = (data?.alerts ?? []).slice(0, 5)
  const lastUpdated = data?.lastUpdated ? new Date(data.lastUpdated) : null

  return (
    <Box sx={{ minHeight: '100%', pb: 3 }}>
      <Box
        component="header"
        sx={{
          mb: 3,
          display: 'flex',
          alignItems: { xs: 'flex-start', md: 'center' },
          justifyContent: 'space-between',
          flexDirection: { xs: 'column', md: 'row' },
          gap: 2,
        }}
      >
        <Box>
          <Typography component="h1" sx={{ fontSize: 28, lineHeight: '36px', fontWeight: 600 }}>
            {copy.title}
          </Typography>
          <Typography sx={{ mt: 0.5, color: 'text.secondary', fontSize: 14 }}>{copy.description}</Typography>
          <Typography sx={{ mt: 0.75, color: 'var(--nebula-text-muted)', fontSize: 12 }}>
            {lastUpdated ? `${copy.updated} ${lastUpdated.toLocaleString(locale)}` : copy.unknown}
            {refreshing ? ` · ${copy.refreshing}` : ''}
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
          <Button variant="outlined" startIcon={<i className="ri-refresh-line" />} onClick={onRefresh} disabled={refreshing}>
            {refreshing ? copy.refreshing : copy.refresh}
          </Button>
          <Button
            variant="contained"
            startIcon={<i className="ri-add-line" />}
            onClick={() => router.push(model.hasResources ? '/infrastructure/instances?create=vm' : '/settings')}
          >
            {model.hasResources ? copy.createVm : copy.addConnection}
          </Button>
        </Box>
      </Box>

      {refreshError && data ? <Alert severity="warning" sx={{ mb: 2 }}>{copy.stale}</Alert> : null}

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))' },
          gap: 2,
          '@media (min-width: 1400px)': {
            gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
          },
        }}
      >
        <MetricCard
          icon="ri-building-2-line"
          label={copy.datacenters}
          value={model.datacenters}
          detail={model.datacenters === 0 ? copy.noResources : `${safeNumber(data?.summary?.clusters)} ${copy.clusters} · ${safeNumber(data?.summary?.standalones)} ${copy.standaloneConnections}`}
          onClick={() => router.push('/infrastructure/inventory')}
          loading={loading}
        />
        <MetricCard
          icon="ri-server-line"
          label={copy.hosts}
          value={model.hosts}
          detail={`${copy.online} ${model.onlineHosts} · ${copy.offline} ${Math.max(0, model.hosts - model.onlineHosts)}`}
          onClick={() => router.push('/infrastructure/inventory?view=hosts')}
          loading={loading}
        />
        <MetricCard
          icon="ri-computer-line"
          label={copy.instances}
          value={model.instances}
          detail={`${copy.running} ${model.running} · ${copy.stopped} ${Math.max(0, model.instances - model.running)}`}
          onClick={() => router.push('/infrastructure/instances')}
          loading={loading}
        />
        <MetricCard
          icon="ri-alarm-warning-line"
          label={copy.alerts}
          value={model.alertCount}
          detail={`${copy.critical} ${safeNumber(data?.alertsSummary?.crit)} · ${copy.warning} ${safeNumber(data?.alertsSummary?.warn)}`}
          loading={loading}
        />
      </Box>

      <Box
        sx={{
          mt: 2,
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', lg: 'minmax(280px, 350px) minmax(360px, 1fr)' },
          gap: 2,
          '@media (min-width: 1400px)': {
            gridTemplateColumns: '350px minmax(420px, 1fr) 326px',
          },
        }}
      >
        <Box component="section" sx={{ ...panelSx, p: 2.5 }}>
          <Typography component="h2" sx={{ mb: 2.5, fontSize: 18, lineHeight: '26px', fontWeight: 600 }}>{copy.resourceUsage}</Typography>
          <Box sx={{ display: 'grid', gap: 2.5 }}>
            {resourceRows.map(row => <ResourceRow key={row.label} {...row} />)}
          </Box>
          <Typography sx={{ mt: 2, color: 'text.secondary', fontSize: 12 }}>
            {resourceRows.some((row) => row.value != null) ? copy.sampleNote : copy.noData}
          </Typography>
        </Box>

        <Box component="section" sx={{ ...panelSx, p: 2.5, gridColumn: { lg: 'auto', xl: 'auto' } }}>
          <Box sx={{ mb: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2 }}>
            <Typography component="h2" sx={{ fontSize: 18, lineHeight: '26px', fontWeight: 600 }}>{copy.topology}</Typography>
            <Button size="small" onClick={() => router.push('/infrastructure/topology')}>{copy.viewAll}</Button>
          </Box>
          {visibleClusters.length === 0 ? (
            <Box sx={{ minHeight: 210, display: 'grid', placeItems: 'center', color: 'text.secondary' }}>
              <Box sx={{ textAlign: 'center' }}>
                <i className="ri-mind-map" aria-hidden style={{ fontSize: 36, opacity: 0.45 }} />
                <Typography sx={{ mt: 1, fontSize: 13 }}>{copy.noResources}</Typography>
              </Box>
            </Box>
          ) : (
            <Box sx={{ position: 'relative', display: 'grid', alignContent: 'start', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))' }, gap: 1.5 }}>
              {visibleClusters.map((cluster, index) => {
                const healthy = safeNumber(cluster.onlineNodes) === safeNumber(cluster.nodes) && safeNumber(cluster.nodes) > 0

                return (
                  <Box
                    component="button"
                    type="button"
                    key={cluster.id || `${cluster.name}-${index}`}
                    onClick={() => cluster.id && router.push(`/infrastructure/inventory?selectType=cluster&selectId=${encodeURIComponent(cluster.id)}`)}
                    sx={{
                      appearance: 'none',
                      p: 1.5,
                      color: 'text.primary',
                      font: 'inherit',
                      textAlign: 'left',
                      cursor: cluster.id ? 'pointer' : 'default',
                      border: '1px solid var(--nebula-border-subtle)',
                      borderRadius: 'var(--nebula-radius-control)',
                      bgcolor: 'var(--nebula-bg-elevated)',
                      '&:hover': cluster.id ? { borderColor: 'var(--nebula-brand-cyan)', bgcolor: 'var(--nebula-bg-hover)' } : undefined,
                      '&:focus-visible': { outline: '2px solid var(--nebula-border-focus)', outlineOffset: 2 },
                    }}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
                      <Box sx={{ minWidth: 0, display: 'flex', alignItems: 'center', gap: 1 }}>
                        <i className="ri-server-fill" aria-hidden style={{ fontSize: 18, color: 'var(--nebula-brand-cyan)' }} />
                        <Typography noWrap sx={{ fontSize: 13, fontWeight: 600 }}>{cluster.name || copy.unknown}</Typography>
                      </Box>
                      <StatusPill label={healthy ? copy.online : copy.unknown} tone={healthy ? 'success' : 'neutral'} />
                    </Box>
                    <Typography sx={{ mt: 1, color: 'text.secondary', fontSize: 12 }}>
                      {safeNumber(cluster.onlineNodes)} / {safeNumber(cluster.nodes)} {copy.online}
                    </Typography>
                  </Box>
                )
              })}
            </Box>
          )}
        </Box>

        <Box
          component="section"
          sx={{
            ...panelSx,
            p: 2.5,
            gridColumn: { lg: '1 / -1' },
            '@media (min-width: 1400px)': { gridColumn: 'auto' },
          }}
        >
          <Typography component="h2" sx={{ mb: 2, fontSize: 18, lineHeight: '26px', fontWeight: 600 }}>{copy.serviceHealth}</Typography>
          <Box sx={{ display: 'grid', gap: 1.25 }}>
            {[
              { label: 'UNISPHERE HA', state: copy.unknown, tone: 'neutral' as const },
              { label: 'DRS', state: copy.notConfigured, tone: 'neutral' as const },
              { label: copy.platformHa, state: copy.unknown, tone: 'neutral' as const },
              {
                label: copy.backupRecovery,
                state: safeNumber(data?.pbs?.servers) > 0 ? copy.connected : copy.notConfigured,
                tone: safeNumber(data?.pbs?.servers) > 0 ? 'info' as const : 'neutral' as const,
              },
            ].map(service => (
              <Box key={service.label} sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1, py: 0.75, borderBottom: '1px solid var(--nebula-border-subtle)' }}>
                <Typography sx={{ fontSize: 13 }}>{service.label}</Typography>
                <StatusPill label={service.state} tone={service.tone} />
              </Box>
            ))}
          </Box>
          <Typography sx={{ mt: 1.5, color: 'text.secondary', fontSize: 12 }}>{copy.healthDisclaimer}</Typography>
        </Box>
      </Box>

      <Box component="section" sx={{ ...panelSx, mt: 2, p: 2.5 }}>
        <Box sx={{ mb: 1.5, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2 }}>
          <Typography component="h2" sx={{ fontSize: 18, lineHeight: '26px', fontWeight: 600 }}>{copy.attention}</Typography>
        </Box>
        {visibleAlerts.length === 0 ? (
          <Typography sx={{ py: 2, color: 'text.secondary', fontSize: 13 }}>{copy.noOpenAlerts}</Typography>
        ) : (
          <Box sx={{ display: 'grid' }}>
            {visibleAlerts.map((alert, index) => {
              const severity = alert.severity === 'crit' ? 'error' : alert.severity === 'warn' ? 'warning' : 'info'

              return (
                <Box key={alert.id || `${alert.message}-${index}`} sx={{ minHeight: 44, display: 'grid', gridTemplateColumns: '104px minmax(0, 1fr) minmax(100px, auto)', alignItems: 'center', gap: 1.5, borderTop: index === 0 ? 'none' : '1px solid var(--nebula-border-subtle)' }}>
                  <StatusPill label={alert.severity === 'crit' ? copy.critical : alert.severity === 'warn' ? copy.warning : copy.info} tone={severity} />
                  <Typography noWrap title={alert.message} sx={{ fontSize: 13 }}>{alert.message || copy.unknown}</Typography>
                  <Typography noWrap sx={{ color: 'text.secondary', fontSize: 12, textAlign: 'right' }}>{alert.source || '—'}</Typography>
                </Box>
              )
            })}
          </Box>
        )}
      </Box>
    </Box>
  )
}
