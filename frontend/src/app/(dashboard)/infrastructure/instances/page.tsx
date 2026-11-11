'use client'

import { useDeferredValue, useEffect, useMemo, useState } from 'react'

import dynamic from 'next/dynamic'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useTranslations } from 'next-intl'

import {
  Alert,
  Box,
  Button,
  Card,
  Chip,
  FormControl,
  InputAdornment,
  InputLabel,
  Menu,
  MenuItem,
  Select,
  Stack,
  Tab,
  Tabs,
  TextField,
  Typography,
} from '@mui/material'
import type { GridRowSelectionModel } from '@mui/x-data-grid'

import VmsTable, { type VmRow } from '@/components/VmsTable'
import { usePageTitle } from '@/contexts/PageTitleContext'
import { useSWRFetch } from '@/hooks/useSWRFetch'
import { resolveSelectedRowIds } from '@/utils/gridSelection'
import { useSettings } from '@core/hooks/useSettings'

const CreateVmDialog = dynamic(
  () => import('../inventory/CreateVmDialog'),
  { ssr: false },
)
const CreateLxcDialog = dynamic(
  () => import('../inventory/CreateLxcDialog'),
  { ssr: false },
)

type InstanceTab = 'all' | 'qemu' | 'lxc' | 'templates'
type DialogType = 'vm' | 'lxc' | null

type InstancesResponse = {
  data?: {
    vms?: Array<VmRow & { connectionName?: string }>
    stats?: {
      total?: number
      running?: number
      stopped?: number
      paused?: number
      templates?: number
      qemu?: number
      lxc?: number
    }
  }
}

const VALID_TABS = new Set<InstanceTab>(['all', 'qemu', 'lxc', 'templates'])
const VALID_STATUSES = new Set(['all', 'running', 'stopped', 'paused', 'unknown'])
const EMPTY_SELECTION: GridRowSelectionModel = { type: 'include', ids: new Set() }

export default function InstancesPage() {
  const t = useTranslations('instances')
  const { setPageInfo } = usePageTitle()
  const { settings } = useSettings()
  const isVcenterClassic = settings.globalTheme === 'vcenterClassic'
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [selectionModel, setSelectionModel] =
    useState<GridRowSelectionModel>(EMPTY_SELECTION)
  const [createMenuAnchor, setCreateMenuAnchor] = useState<HTMLElement | null>(null)
  const [dialogType, setDialogType] = useState<DialogType>(() => {
    const requested = searchParams.get('create')
    return requested === 'vm' || requested === 'lxc' ? requested : null
  })

  const requestedTab = searchParams.get('tab') as InstanceTab | null
  const tab = requestedTab && VALID_TABS.has(requestedTab) ? requestedTab : 'all'
  const query = searchParams.get('query') ?? ''
  const deferredQuery = useDeferredValue(query.trim().toLocaleLowerCase())
  const host = searchParams.get('host') ?? 'all'
  const requestedStatus = searchParams.get('status') ?? 'all'
  const status = VALID_STATUSES.has(requestedStatus) ? requestedStatus : 'all'

  const {
    data,
    error,
    isLoading,
    isValidating,
    mutate,
  } = useSWRFetch<InstancesResponse>('/api/v1/vms', {
    keepPreviousData: true,
    revalidateOnFocus: false,
  })

  const vms = useMemo(() => data?.data?.vms ?? [], [data?.data?.vms])
  const counts = useMemo(
    () => ({
      total: vms.length,
      qemu: vms.filter((vm) => vm.type === 'qemu' && !vm.template).length,
      lxc: vms.filter((vm) => vm.type === 'lxc' && !vm.template).length,
      templates: vms.filter((vm) => vm.template).length,
    }),
    [vms],
  )

  const hosts = useMemo(() => {
    const labels = new Map<string, string>()
    for (const vm of vms) {
      const key = `${vm.connId}:${vm.node}`
      labels.set(
        key,
        vm.connectionName ? `${vm.connectionName} / ${vm.node}` : vm.node,
      )
    }
    return Array.from(labels, ([value, label]) => ({ value, label }))
      .sort((a, b) => a.label.localeCompare(b.label))
  }, [vms])

  const filteredVms = useMemo(() => {
    return vms.filter((vm) => {
      if (tab === 'templates' && !vm.template) return false
      if (tab === 'qemu' && (vm.type !== 'qemu' || vm.template)) return false
      if (tab === 'lxc' && (vm.type !== 'lxc' || vm.template)) return false
      if (host !== 'all' && `${vm.connId}:${vm.node}` !== host) return false
      if (status !== 'all' && (vm.status || 'unknown') !== status) return false
      if (
        deferredQuery &&
        !`${vm.name} ${vm.vmid}`.toLocaleLowerCase().includes(deferredQuery)
      ) {
        return false
      }
      return true
    })
  }, [deferredQuery, host, status, tab, vms])

  const selectedIds = useMemo(
    () => resolveSelectedRowIds(selectionModel, filteredVms),
    [filteredVms, selectionModel],
  )

  useEffect(() => {
    setPageInfo(t('title'), '', 'ri-instance-line')
    return () => setPageInfo('', '', '')
  }, [setPageInfo, t])

  const updateFilters = (updates: Record<string, string>) => {
    const next = new URLSearchParams(searchParams.toString())
    for (const [key, value] of Object.entries(updates)) {
      if (!value || value === 'all') next.delete(key)
      else next.set(key, value)
    }
    setSelectionModel(EMPTY_SELECTION)
    const search = next.toString()
    router.replace(search ? `${pathname}?${search}` : pathname, { scroll: false })
  }

  const openDetails = (vm: VmRow) => {
    const params = new URLSearchParams({
      view: 'vms',
      vmid: String(vm.vmid),
      connId: vm.connId,
      node: vm.node,
      type: vm.type,
    })
    router.push(`/infrastructure/inventory?${params.toString()}`)
  }

  const openCreateDialog = (type: Exclude<DialogType, null>) => {
    setCreateMenuAnchor(null)
    setDialogType(type)
  }

  const handleCreated = async () => {
    setDialogType(null)
    await mutate()
  }

  const allVms = useMemo(
    () =>
      vms.map((vm) => ({
        connId: vm.connId,
        connName: vm.connectionName ?? vm.connId,
        node: vm.node,
        type: vm.type,
        vmid: String(vm.vmid),
        name: vm.name,
        status: vm.status,
        cpu: vm.cpu,
        maxcpu: vm.maxcpu,
        maxmem: vm.maxmem,
        maxdisk: vm.maxdisk,
        uptime: vm.uptime,
        ip: vm.ip,
        snapshots: vm.snapshots,
        tags: vm.tags,
        template: vm.template,
        hastate: vm.hastate,
        hagroup: vm.hagroup,
        lock: vm.lock,
        isCluster: vm.isCluster,
        osInfo: vm.osInfo,
      })),
    [vms],
  )

  const forbidden = error instanceof Error && error.message.includes('403')
  const hasFilters =
    tab !== 'all' || query.trim() !== '' || host !== 'all' || status !== 'all'

  return (
    <Box
      className={isVcenterClassic ? 'vcenter-classic-instances' : undefined}
      sx={{ p: isVcenterClassic ? 0 : { xs: 2, lg: 3 }, minWidth: 0 }}
    >
      <Stack
        direction={{ xs: 'column', md: 'row' }}
        alignItems={{ md: 'center' }}
        justifyContent={isVcenterClassic ? 'flex-start' : 'space-between'}
        spacing={2}
        sx={{ mb: isVcenterClassic ? '14px' : 2.5 }}
      >
        {!isVcenterClassic ? (
          <Box>
            <Typography component='h1' sx={{ fontSize: 28, lineHeight: '36px', fontWeight: 600 }}>{t('title')}</Typography>
            <Typography sx={{ mt: 0.5, fontSize: 14, color: 'text.secondary' }}>{t('subtitle')}</Typography>
          </Box>
        ) : null}
        <Stack direction='row' spacing={1}>
          {isVcenterClassic ? (
            <>
              <Button
                variant='contained'
                startIcon={<i className='ri-add-line' />}
                onClick={() => openCreateDialog('vm')}
              >
                {t('createVm')}
              </Button>
              <Button
                variant='outlined'
                startIcon={<i className='ri-add-line' />}
                onClick={() => openCreateDialog('lxc')}
              >
                {t('createContainer')}
              </Button>
            </>
          ) : null}
          <Button
            variant='outlined'
            startIcon={<i className='ri-refresh-line' />}
            onClick={() => mutate()}
            disabled={isValidating}
          >
            {isValidating ? t('refreshing') : t('refresh')}
          </Button>
          {!isVcenterClassic ? (
            <Button
              variant='contained'
              startIcon={<i className='ri-add-line' />}
              endIcon={<i className='ri-arrow-down-s-line' />}
              onClick={(event) => setCreateMenuAnchor(event.currentTarget)}
            >
              {t('create')}
            </Button>
          ) : null}
          <Menu
            anchorEl={createMenuAnchor}
            open={Boolean(createMenuAnchor)}
            onClose={() => setCreateMenuAnchor(null)}
          >
            <MenuItem onClick={() => openCreateDialog('vm')}>
              <i className='ri-computer-line' style={{ marginRight: 10 }} />
              {t('createVm')}
            </MenuItem>
            <MenuItem onClick={() => openCreateDialog('lxc')}>
              <i className='ri-instance-line' style={{ marginRight: 10 }} />
              {t('createContainer')}
            </MenuItem>
          </Menu>
        </Stack>
      </Stack>

      {error ? (
        <Alert severity={forbidden ? 'warning' : 'error'} sx={{ mb: 2 }}>
          {forbidden ? t('forbidden') : t('loadError')}
          {!forbidden ? (
            <Button size='small' onClick={() => mutate()} sx={{ ml: 1 }}>
              {t('retry')}
            </Button>
          ) : null}
        </Alert>
      ) : null}

      <Card variant='outlined' sx={{ overflow: 'hidden' }}>
        <Tabs
          value={tab}
          onChange={(_, value: InstanceTab) => updateFilters({ tab: value })}
          variant='scrollable'
          scrollButtons='auto'
          sx={{ px: 1.5, borderBottom: 1, borderColor: 'divider' }}
        >
          <Tab value='all' label={`${t('tabs.all')} (${counts.total})`} />
          <Tab value='qemu' label={`${t('tabs.vms')} (${counts.qemu})`} />
          <Tab value='lxc' label={`${t('tabs.containers')} (${counts.lxc})`} />
          <Tab value='templates' label={`${t('tabs.templates')} (${counts.templates})`} />
        </Tabs>

        <Stack
          direction={{ xs: 'column', lg: 'row' }}
          spacing={1.5}
          sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}
        >
          <TextField
            size='small'
            value={query}
            onChange={(event) => updateFilters({ query: event.target.value })}
            placeholder={t('searchPlaceholder')}
            sx={{ minWidth: { lg: 300 } }}
            slotProps={{
              input: {
                startAdornment: (
                  <InputAdornment position='start'>
                    <i className='ri-search-line' />
                  </InputAdornment>
                ),
              },
            }}
          />
          <FormControl size='small' sx={{ minWidth: 220 }}>
            <InputLabel>{t('host')}</InputLabel>
            <Select
              value={hosts.some((item) => item.value === host) ? host : 'all'}
              label={t('host')}
              onChange={(event) => updateFilters({ host: event.target.value })}
            >
              <MenuItem value='all'>{t('allHosts')}</MenuItem>
              {hosts.map((item) => (
                <MenuItem key={item.value} value={item.value}>{item.label}</MenuItem>
              ))}
            </Select>
          </FormControl>
          <FormControl size='small' sx={{ minWidth: 170 }}>
            <InputLabel>{t('status')}</InputLabel>
            <Select
              value={status}
              label={t('status')}
              onChange={(event) => updateFilters({ status: event.target.value })}
            >
              <MenuItem value='all'>{t('statuses.all')}</MenuItem>
              <MenuItem value='running'>{t('statuses.running')}</MenuItem>
              <MenuItem value='stopped'>{t('statuses.stopped')}</MenuItem>
              <MenuItem value='paused'>{t('statuses.paused')}</MenuItem>
              <MenuItem value='unknown'>{t('statuses.unknown')}</MenuItem>
            </Select>
          </FormControl>
          {hasFilters ? (
            <Button onClick={() => updateFilters({ tab: 'all', query: '', host: 'all', status: 'all' })}>
              {t('clearFilters')}
            </Button>
          ) : null}
        </Stack>

        {selectedIds.length > 0 ? (
          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            alignItems={{ sm: 'center' }}
            justifyContent='space-between'
            spacing={1}
            sx={{
              px: 2,
              py: 1.25,
              bgcolor: 'action.selected',
              borderBottom: 1,
              borderColor: 'divider',
            }}
          >
            <Stack direction='row' alignItems='center' spacing={1}>
              <Chip color='primary' size='small' label={selectedIds.length} />
              <Typography variant='body2'>{t('selected')}</Typography>
            </Stack>
            <Stack direction='row' spacing={1}>
              <Button
                size='small'
                onClick={() => setSelectionModel(EMPTY_SELECTION)}
              >
                {t('clearSelection')}
              </Button>
              <Button size='small' disabled>
                {t('batchUnavailable')}
              </Button>
            </Stack>
          </Stack>
        ) : null}

        {!isLoading && !error && vms.length === 0 ? (
          <Box sx={{ p: 6, textAlign: 'center' }}>
            <i className='ri-instance-line' style={{ fontSize: 36, opacity: 0.5 }} />
            <Typography variant='h6' sx={{ mt: 1 }}>{t('emptyTitle')}</Typography>
            <Typography color='text.secondary' sx={{ mb: 2 }}>{t('emptyDescription')}</Typography>
            <Button variant='contained' onClick={() => openCreateDialog('vm')}>
              {t('createVm')}
            </Button>
          </Box>
        ) : !isLoading && !error && filteredVms.length === 0 ? (
          <Box sx={{ p: 6, textAlign: 'center' }}>
            <Typography variant='h6'>{t('noResultsTitle')}</Typography>
            <Typography color='text.secondary' sx={{ mb: 2 }}>{t('noResultsDescription')}</Typography>
            <Button onClick={() => updateFilters({ tab: 'all', query: '', host: 'all', status: 'all' })}>
              {t('clearFilters')}
            </Button>
          </Box>
        ) : (
          <VmsTable
            vms={filteredVms}
            loading={isLoading}
            onVmClick={openDetails}
            maxHeight='calc(100vh - 390px)'
            showNode
            showIpSnap
            selectable
            rowSelectionModel={selectionModel}
            onRowSelectionModelChange={setSelectionModel}
            defaultPageSize={20}
            pageSizeOptions={[20, 50, 100]}
            defaultHiddenColumns={['favorite', 'ha', 'trend', 'trendIoNet', 'actions', 'tags', 'ip', 'snapshots', 'osInfo']}
          />
        )}
      </Card>

      {dialogType === 'vm' ? (
        <CreateVmDialog
          open
          onClose={() => setDialogType(null)}
          allVms={allVms}
          onCreated={handleCreated}
        />
      ) : null}
      {dialogType === 'lxc' ? (
        <CreateLxcDialog
          open
          onClose={() => setDialogType(null)}
          allVms={allVms}
          onCreated={handleCreated}
        />
      ) : null}
    </Box>
  )
}
