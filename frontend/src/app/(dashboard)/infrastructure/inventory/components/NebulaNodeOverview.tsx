'use client'

import type { ReactNode } from 'react'

import {
  Box,
  Chip,
  IconButton,
  LinearProgress,
  Stack,
  Tooltip,
  Typography,
} from '@mui/material'
import { useTranslations } from 'next-intl'

import { formatBytes } from '@/utils/format'

import { formatUptime } from '../helpers'
import type { DetailsPayload, Status, UtilMetric } from '../types'

type NebulaNodeHeaderProps = {
  data: DetailsPayload
  selectionId: string
  onBack?: () => void
  actions: ReactNode
  tags?: ReactNode
  externalHref?: string | null
}

type NebulaNodeSummaryProps = {
  data: DetailsPayload
  selectionId: string
}

const panelSx = {
  minWidth: 0,
  minHeight: { md: 240 },
  border: '1px solid',
  borderColor: 'divider',
  borderRadius: '10px',
  bgcolor: 'background.paper',
  p: { xs: '16px', md: '18px' },
  boxShadow: 'inset 0 1px 0 color-mix(in srgb, var(--mui-palette-primary-main) 10%, transparent)',
}

function statusPresentation(status: Status, t: ReturnType<typeof useTranslations>) {
  if (status === 'ok') return { label: t('common.online'), color: 'success' as const, icon: 'ri-checkbox-circle-fill' }
  if (status === 'warn') return { label: t('common.warning'), color: 'warning' as const, icon: 'ri-alert-fill' }
  if (status === 'crit') return { label: t('common.offline'), color: 'error' as const, icon: 'ri-close-circle-fill' }

  return { label: t('common.unknown'), color: 'default' as const, icon: 'ri-question-fill' }
}

function clampPercent(value?: number) {
  if (!Number.isFinite(value)) return 0

  return Math.min(100, Math.max(0, Number(value)))
}

function metricDetail(metric?: UtilMetric) {
  if (metric?.used == null || metric?.max == null || metric.max <= 0) return null

  return `${formatBytes(metric.used)} / ${formatBytes(metric.max)}`
}

function SummaryRow({ label, children }: { label: ReactNode; children: ReactNode }) {
  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: '56px minmax(0, 1fr)', gap: '12px', alignItems: 'center' }}>
      <Typography variant='inherit' sx={{ color: 'text.secondary', fontSize: '13px', lineHeight: 1.6 }}>{label}</Typography>
      <Box sx={{ minWidth: 0, color: 'text.primary', fontSize: '14px', fontWeight: 600 }}>{children}</Box>
    </Box>
  )
}

function CapacityRow({
  label,
  metric,
  color,
  showDetail = true,
}: {
  label: ReactNode
  metric?: UtilMetric
  color: string
  showDetail?: boolean
}) {
  const percent = clampPercent(metric?.pct)
  const detail = showDetail ? metricDetail(metric) : null

  return (
    <Box>
      <Stack direction='row' alignItems='baseline' justifyContent='space-between' gap={2} sx={{ mb: 0.75 }}>
        <Typography variant='inherit' sx={{ color: 'text.secondary', fontSize: '13px', fontWeight: 500 }}>{label}</Typography>
        <Stack direction='row' alignItems='baseline' gap={1} sx={{ minWidth: 0 }}>
          {detail ? (
            <Typography variant='inherit' sx={{ color: 'text.secondary', fontFamily: 'var(--nebula-font-family-mono, monospace)', fontSize: '11px' }}>
              {detail}
            </Typography>
          ) : null}
          <Typography variant='inherit' sx={{ color: 'text.primary', fontFamily: 'var(--nebula-font-family-mono, monospace)', fontSize: '13px', fontWeight: 700 }}>
            {Math.round(percent)}%
          </Typography>
        </Stack>
      </Stack>
      <LinearProgress
        className='nebula-linear-progress'
        variant='determinate'
        value={percent}
        aria-label={`${String(label)} ${Math.round(percent)}%`}
        sx={{
          height: 8,
          borderRadius: '999px',
          '--nebula-progress-color': color,
          bgcolor: 'action.hover',
          '& .MuiLinearProgress-bar': { borderRadius: '999px' },
        }}
      />
    </Box>
  )
}

function ContextItem({ icon, label, value }: { icon: string; label: ReactNode; value?: ReactNode }) {
  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: '32px minmax(0, 1fr)', gap: 1.25, alignItems: 'start', minWidth: 0 }}>
      <Box
        aria-hidden='true'
        sx={{
          width: 32,
          height: 32,
          display: 'grid',
          placeItems: 'center',
          border: '1px solid',
          borderColor: 'divider',
          borderRadius: 2,
          color: 'primary.light',
          bgcolor: 'action.hover',
        }}
      >
        <i className={icon} style={{ fontSize: 16 }} />
      </Box>
      <Box sx={{ minWidth: 0 }}>
        <Typography variant='inherit' sx={{ color: 'text.secondary', fontSize: '12px', lineHeight: 1.4 }}>{label}</Typography>
        <Typography variant='inherit' sx={{ color: 'text.primary', fontSize: '13px', fontWeight: 600, lineHeight: 1.55, overflowWrap: 'anywhere' }}>
          {value || '—'}
        </Typography>
      </Box>
    </Box>
  )
}

export function NebulaNodeHeader({ data, onBack, actions, tags, externalHref }: NebulaNodeHeaderProps) {
  const t = useTranslations()
  const state = statusPresentation(data.status, t)
  const path = data.breadcrumb?.length ? `/${data.breadcrumb.join('/')}` : data.subtitle

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: { xs: 'flex-start', md: 'center' },
        justifyContent: 'space-between',
        flexWrap: { xs: 'wrap', md: 'nowrap' },
        gap: '16px',
        px: { xs: '16px', md: '8px' },
        pt: '20px',
        pb: '8px',
      }}
    >
      <Stack direction='row' alignItems='center' gap={1.5} sx={{ minWidth: 0, flex: '1 1 0' }}>
        {onBack ? (
          <Tooltip title={t('common.back')}>
            <IconButton
              aria-label={t('common.back')}
              onClick={onBack}
              size='small'
              sx={{ display: { xs: 'inline-flex', md: 'none' }, flexShrink: 0 }}
            >
              <i className='ri-arrow-left-line' style={{ fontSize: 18 }} />
            </IconButton>
          </Tooltip>
        ) : null}

        <Box
          aria-hidden='true'
          sx={{
            width: 42,
            height: 42,
            display: 'grid',
            placeItems: 'center',
            flexShrink: 0,
            border: '1px solid',
            borderColor: 'primary.main',
            borderRadius: '10px',
            color: 'primary.light',
            bgcolor: 'color-mix(in srgb, var(--mui-palette-primary-main) 12%, transparent)',
            boxShadow: '0 0 20px color-mix(in srgb, var(--mui-palette-primary-main) 14%, transparent)',
          }}
        >
          <i className='ri-server-line' style={{ fontSize: 20 }} />
        </Box>

        <Box sx={{ minWidth: 0, flex: 1, overflow: 'hidden' }}>
          <Stack direction='row' alignItems='center' gap={1} sx={{ minWidth: 0 }}>
            <Typography
              component='h2'
              variant='h4'
              sx={{
                minWidth: 0,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                color: 'text.primary',
                fontSize: { xs: '24px', md: '28px' },
                fontWeight: 700,
                lineHeight: 1.2,
              }}
            >
              {data.title}
            </Typography>
            {externalHref ? (
              <Tooltip title={t('inventory.openeSageUi')}>
                <IconButton
                  aria-label={t('inventory.openeSageUi')}
                  component='a'
                  href={externalHref}
                  target='_blank'
                  rel='noopener noreferrer'
                  size='small'
                  sx={{ color: 'text.secondary', flexShrink: 0 }}
                >
                  <i className='ri-external-link-line' style={{ fontSize: 16 }} />
                </IconButton>
              </Tooltip>
            ) : null}
          </Stack>
          {path ? (
            <Typography variant='inherit' sx={{ mt: 0.125, color: 'text.secondary', fontSize: '12px', lineHeight: 1.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {path}
            </Typography>
          ) : null}
        </Box>
      </Stack>

      <Stack
        direction='row'
        alignItems='center'
        justifyContent='flex-end'
        gap={1}
        sx={{ minWidth: 0, flexShrink: 0, flexWrap: { xs: 'wrap', md: 'nowrap' } }}
      >
        <Chip
          size='small'
          color={state.color}
          icon={<i className={state.icon} style={{ fontSize: 14 }} />}
          label={state.label}
          sx={{ height: 24, fontSize: '12px', fontWeight: 600 }}
        />
        {data.hostInfo?.maintenance ? (
          <Chip
            size='small'
            color='warning'
            icon={<i className='ri-tools-fill' style={{ fontSize: 14 }} />}
            label={t('inventory.maintenanceModeActive')}
            sx={{ height: 24, fontSize: '12px', fontWeight: 600 }}
          />
        ) : null}
        {tags}
        {actions}
      </Stack>
    </Box>
  )
}

export function NebulaNodeSummary({ data, selectionId }: NebulaNodeSummaryProps) {
  const t = useTranslations()
  const state = statusPresentation(data.status, t)
  const hostInfo = data.hostInfo
  const nodeType = data.kindLabel === 'HOST' ? 'UNISPHERE HOST' : data.kindLabel

  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'minmax(0, 1fr) minmax(0, 1fr)' }, gap: '16px' }}>
      <Box sx={panelSx}>
        <Typography component='h3' variant='h6' sx={{ mb: '16px', color: 'text.primary', fontSize: '18px', fontWeight: 700, lineHeight: 1.5 }}>
          {t('inventory.summary')}
        </Typography>
        <Stack sx={{ gap: '8px' }}>
          <SummaryRow label='ID'>
            <Box component='code' sx={{ display: 'inline-flex', maxWidth: '100%', px: 0.75, py: 0.25, borderRadius: 1, bgcolor: 'action.hover', fontFamily: 'var(--nebula-font-family-mono, monospace)', fontSize: '12px', overflowWrap: 'anywhere' }}>
              {selectionId}
            </Box>
          </SummaryRow>
          <SummaryRow label={t('common.type')}>{nodeType}</SummaryRow>
          <SummaryRow label={t('common.status')}>
            <Chip size='small' color={state.color} icon={<i className={state.icon} style={{ fontSize: 13 }} />} label={state.label} sx={{ height: 22, fontSize: '11px', fontWeight: 600 }} />
          </SummaryRow>
          <SummaryRow label={t('inventory.nebulaLastUpdated')}>{data.lastUpdated || '—'}</SummaryRow>
          <SummaryRow label={t('common.source')}>UNISPHERE API</SummaryRow>
        </Stack>
      </Box>

      <Box sx={panelSx}>
        <Stack direction='row' alignItems='flex-start' justifyContent='space-between' gap={2} sx={{ mb: '16px' }}>
          <Box>
            <Typography component='h3' variant='h6' sx={{ color: 'text.primary', fontSize: '18px', fontWeight: 700, lineHeight: 1.5 }}>
              {t('inventory.health.resourceUsage')}
            </Typography>
          </Box>
          <Typography variant='inherit' sx={{ color: 'text.secondary', fontSize: '11px', whiteSpace: 'nowrap' }}>{t('inventory.nebulaLastUpdated')}</Typography>
        </Stack>
        <Stack sx={{ gap: '12px' }}>
          <CapacityRow label='CPU' metric={data.metrics?.cpu} color='var(--nebula-brand-blue, #3b82f6)' showDetail={false} />
          <CapacityRow label={t('common.memory')} metric={data.metrics?.ram} color='var(--nebula-brand-cyan, #22d3ee)' />
          <CapacityRow label={t('inventory.storageUsage')} metric={data.metrics?.storage} color='var(--nebula-brand-violet, #8b5cf6)' />
        </Stack>
      </Box>

      <Box sx={{ ...panelSx, minHeight: 0, gridColumn: { md: '1 / -1' } }}>
        <Typography component='h3' variant='h6' sx={{ mb: '16px', color: 'text.primary', fontSize: '18px', fontWeight: 700, lineHeight: 1.5 }}>
          {t('common.details')}
        </Typography>
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))', xl: 'repeat(4, minmax(0, 1fr))' }, gap: '16px' }}>
          <ContextItem icon='ri-cpu-line' label='CPU' value={hostInfo?.cpuModel} />
          <ContextItem icon='ri-terminal-box-line' label={t('inventory.kernelVersion')} value={hostInfo?.kernelVersion} />
          <ContextItem icon='ri-settings-3-line' label={t('inventory.managerVersion')} value={hostInfo?.unisphereVersion} />
          <ContextItem icon='ri-time-line' label={t('vms.uptime')} value={hostInfo?.uptime != null ? formatUptime(hostInfo.uptime) : undefined} />
        </Box>
      </Box>
    </Box>
  )
}
