'use client'

import { useEffect, useState, useCallback, useRef, useMemo } from 'react'

import { Box, Button, Card, CardContent, Chip, CircularProgress, Skeleton, Typography, IconButton, Tooltip } from '@mui/material'
import { useSearchParams } from 'next/navigation'

import { useTranslations } from 'next-intl'

import { usePageTitle } from '@/contexts/PageTitleContext'
import { useTenant } from '@/contexts/TenantContext'
import { useRBACScopeProfile } from '@/hooks/useRBACScopeProfile'
import { useSettings } from '@core/hooks/useSettings'
import { useRunningTasks } from '@/hooks/useRunningTasks'
import { useUNISPHEREConnections } from '@/hooks/useConnections'
import { useSWRFetch } from '@/hooks/useSWRFetch'
import { extractTaskVmid } from '@/lib/tasks/scope'

import InventoryTree, { InventorySelection, ViewMode, AllVmItem, HostItem, PoolItem, TagItem, TreePbsServer, TreeClusterStorage } from './InventoryTree'
import InventoryDetails from './InventoryDetails'
import { parseNodeId } from './helpers'

type Connection = {
  id: string
  name: string
  baseUrl: string
  behindProxy?: boolean
  insecureTLS?: boolean
}

// Type pour les VMs en migration
type MigratingVm = {
  connId: string
  vmid: string
  sourceNode: string
  targetNode?: string
}

const LEGACY_LEFT_WIDTH = { min: 200, max: 500, default: 340 }
const NEBULA_LEFT_WIDTH = { min: 200, max: 320, default: 240, narrowDefault: 220 }
const CLASSIC_LEFT_WIDTH = { min: 185, max: 185, default: 185 }
const COLLAPSED_WIDTH = 52

export default function InventoryPage() {
  const t = useTranslations()
  const { settings } = useSettings()
  const isNebula = settings.globalTheme === 'nebula'
  const isVcenterClassic = settings.globalTheme === 'vcenterClassic'
  const leftPanelWidth = isNebula ? NEBULA_LEFT_WIDTH : isVcenterClassic ? CLASSIC_LEFT_WIDTH : LEGACY_LEFT_WIDTH
  const { setPageInfo } = usePageTitle()
  const { currentTenant, loading: tenantLoading, isFullClusterView } = useTenant()
  const allowBlankVm = !tenantLoading && (currentTenant === null || isFullClusterView)
  const searchParams = useSearchParams()
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  // Connections via shared SWR (dedup with other consumers)
  const { data: connectionsData, isLoading: connectionsLoading, error: connectionsError } = useUNISPHEREConnections()
  const connections: Connection[] = useMemo(() => connectionsData?.data ?? [], [connectionsData])

  // Favorites via shared SWR (dedup with InventoryTree/useFavorites)
  const { data: favoritesData, mutate: mutateFavorites } = useSWRFetch('/api/v1/favorites', { revalidateOnFocus: false })
  const [selection, setSelection] = useState<InventorySelection | null>({ type: 'root', id: 'root' })
  const [refreshTree, setRefreshTree] = useState<(() => void) | null>(null)

  // RBAC scope profile — determines default view & allowed view modes
  const { defaultViewMode, allowedViewModes, loading: rbacLoading } = useRBACScopeProfile()

  // Mode de vue actuel et listes de données
  const [viewMode, setViewMode] = useState<ViewMode>('tree')
  const [hosts, setHosts] = useState<HostItem[]>([])
  const [pools, setPools] = useState<PoolItem[]>([])
  const [tags, setTags] = useState<TagItem[]>([])
  const [pbsServers, setPbsServers] = useState<TreePbsServer[]>([])
  const [clusterStorages, setClusterStorages] = useState<TreeClusterStorage[]>([])
  const [externalHypervisors, setExternalHypervisors] = useState<any[]>([])
  const selectedNode = selection?.type === 'node' ? parseNodeId(selection.id) : null
  
  // État pour IP/Snapshots
  const [ipSnapLoading, setIpSnapLoading] = useState(false)
  const [ipSnapLoaded, setIpSnapLoaded] = useState(false)

  // Favoris (derived from SWR above)
  
  // État pour collapse la tree (persisté — #538)
  const [isTreeCollapsed, setIsTreeCollapsed] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('pxc-inventory-tree-collapsed') === 'true'
    }
    return false
  })

  // Show VM ID in tree
  const [showVmId, setShowVmId] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('pxc-show-vmid') === 'true'
    }
    return false
  })

  const toggleShowVmId = useCallback(() => {
    setShowVmId(prev => {
      const next = !prev
      localStorage.setItem('pxc-show-vmid', String(next))
      return next
    })
  }, [])

  // Create VM/LXC dialog requests from tree context menu
  const [createDialogRequest, setCreateDialogRequest] = useState<{ type: 'createVm' | 'createLxc'; connId: string; node: string; ts: number } | null>(null)
  const createActionHandled = useRef(false)

  useEffect(() => {
    if (createActionHandled.current || searchParams.get('action') !== 'create-vm' || connectionsLoading) return

    createActionHandled.current = true
    setViewMode('tree')
    setSelection({ type: 'root', id: 'root' })
    setCreateDialogRequest({
      type: 'createVm',
      connId: connections[0]?.id || '',
      node: '',
      ts: Date.now(),
    })
  }, [connections, connectionsLoading, searchParams])

  // Node action requests from tree context menu (reboot/shutdown)
  const [nodeActionRequest, setNodeActionRequest] = useState<{ action: 'reboot' | 'shutdown'; connId: string; node: string; ts: number } | null>(null)


  // Données brutes des VMs (depuis InventoryTree) et données enrichies (IP, snapshots, uptime)
  const [rawVms, setRawVms] = useState<AllVmItem[]>([])
  const resourceItemCount = hosts.length + rawVms.length
  const [enrichedData, setEnrichedData] = useState<Record<string, { ip?: string | null; snapshots?: number; uptime?: string | null; osInfo?: { type: 'linux' | 'windows' | 'other'; name: string | null; version: string | null; kernel: string | null } | null }>>({})

  // Apply RBAC-aware default view mode — re-apply when defaultViewMode changes
  // (RBAC may initially return 'vms' before roles load, then settle to 'tree' for admins)
  useEffect(() => {
    if (rbacLoading) return
    const requestedView = searchParams.get('view') as ViewMode | null
    const nextView = requestedView && allowedViewModes.has(requestedView)
      ? requestedView
      : defaultViewMode

    setViewMode(nextView)

    if (nextView === 'tree') {
      setSelection({ type: 'root', id: 'root' })
    }
  }, [rbacLoading, defaultViewMode, allowedViewModes, searchParams])

  // Deep-link: auto-select VM from URL search params (?vmid=123&connId=...&node=...&type=qemu)
  // Also handles ?selectType=node&selectId=connId:nodeName and ?selectType=pbs&selectId=pbsId
  const deepLinkHandled = useRef(false)

  useEffect(() => {
    if (deepLinkHandled.current) return

    const selectType = searchParams.get('selectType')
    const selectId = searchParams.get('selectId')

    // Handle node/pbs deep-links (don't need rawVms to be loaded)
    if (selectType === 'node' && selectId) {
      deepLinkHandled.current = true
      setSelection({ type: 'node', id: selectId })
      setViewMode('hosts')

      return
    }

    if (selectType === 'pbs' && selectId) {
      deepLinkHandled.current = true
      setSelection({ type: 'pbs', id: selectId })
      setViewMode('tree')

      return
    }

    if (selectType === 'cluster' && selectId) {
      deepLinkHandled.current = true
      setSelection({ type: 'cluster', id: selectId })
      setViewMode('tree')

      return
    }

    // VM deep-link — needs rawVms loaded
    if (rawVms.length === 0) return

    const vmid = searchParams.get('vmid')
    if (!vmid) return

    const connId = searchParams.get('connId')
    const node = searchParams.get('node')
    const vmType = searchParams.get('type')

    // Find the VM — prefer exact match with all params, fallback to vmid-only
    let found = rawVms.find(
      vm => String(vm.vmid) === vmid && (!connId || vm.connId === connId) && (!node || vm.node === node)
    )

    if (!found) {
      found = rawVms.find(vm => String(vm.vmid) === vmid)
    }

    if (found) {
      deepLinkHandled.current = true
      const selectionId = `${found.connId}:${found.node}:${found.type}:${found.vmid}`
      setSelection({ type: 'vm', id: selectionId })
      setViewMode('vms')

      // Scroll to the VM after the view switches and renders
      setTimeout(() => {
        const el = document.querySelector(`[data-vmkey="${CSS.escape(selectionId)}"]`)

        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' })
        }
      }, 300)
    }
  }, [rawVms, searchParams])

  // VMs en cours de migration
  const [migratingVms, setMigratingVms] = useState<MigratingVm[]>([])

  // Référence pour détecter les migrations terminées
  const prevMigratingVmsRef = useRef<MigratingVm[]>([])

  // Track every running task whose completion changes the inventory tree
  // (created/deleted/restored/cloned VMs and CTs). The migration watcher
  // below already handles the move case; this second ref catches the
  // template-deploy chain (qmcreate, vzcreate, qmrestore, qmclone, imgcopy
  // and their delete counterparts) which would otherwise require a manual
  // F5 to surface the new VM in the tree.
  const prevInventoryAffectingTaskIdsRef = useRef<Set<string>>(new Set())

  // UNISPHERE task types that should trigger an inventory refresh once they
  // disappear from /tasks/running. Kept narrow on purpose — config edits
  // / start / stop don't reshape the tree, so we skip them and let the
  // RRD polling refresh the badges instead.
  const INVENTORY_AFFECTING_TASK_TYPES = new Set([
    'qmcreate', 'vzcreate',     // template deploy / VM-CT create
    'qmrestore', 'vzrestore',   // restore from backup
    'qmclone',                  // clone (deploy from existing VM)
    'imgcopy',                  // image-copy step of a deploy chain
    'qmdel', 'vzdel', 'qmdestroy', 'vzdestroy', // deletion
  ])

  // Detect migrations from shared running-tasks SWR (no duplicate polling)
  const { data: runningTasksData } = useRunningTasks()

  useEffect(() => {
    const tasks = runningTasksData?.data || []

    // Filter migration tasks (qmigrate, vzmigrate, hamigrate). hamigrate
    // carries the HA service id (`vm:100`, optionally `vm:100@target`)
    // instead of a bare vmid, so route the entity through extractTaskVmid
    // to normalize to a vmid string.
    const migrations: MigratingVm[] = tasks
      .filter((t: any) => t.type === 'qmigrate' || t.type === 'vzmigrate' || t.type === 'hamigrate')
      .map((t: any) => ({
        connId: t.connectionId,
        vmid: extractTaskVmid(t.entity) || '',
        sourceNode: t.node,
        targetNode: undefined
      }))
      .filter((m: MigratingVm) => m.vmid)

    // Detect finished migrations
    const currentIds = new Set(migrations.map(m => `${m.connId}:${m.vmid}`))

    const finishedMigrations = prevMigratingVmsRef.current.filter(
      m => !currentIds.has(`${m.connId}:${m.vmid}`)
    )

    if (finishedMigrations.length > 0) {
      setTimeout(() => {
        if (refreshTree) refreshTree()
      }, 1000)
    }

    prevMigratingVmsRef.current = migrations

    // Detect finished create / delete / restore / clone tasks the same way.
    // We key on the UNISPHERE task UPID (unique per task) and treat "was running,
    // is no longer" as completion. Fires a single refresh after a small
    // debounce so a chain of imgcopy → qmcreate triggers only one reload.
    const currentInventoryTaskIds = new Set<string>(
      tasks
        .filter((t: any) => INVENTORY_AFFECTING_TASK_TYPES.has(t.type))
        .map((t: any) => String(t.id ?? t.upid ?? `${t.connectionId}:${t.node}:${t.type}:${t.entity}`))
    )

    let hasFinishedInventoryTask = false
    for (const prevId of prevInventoryAffectingTaskIdsRef.current) {
      if (!currentInventoryTaskIds.has(prevId)) {
        hasFinishedInventoryTask = true
        break
      }
    }

    if (hasFinishedInventoryTask) {
      // 1.5 s gives UNISPHERE time to flush /cluster/resources after the task
      // ends — without the delay the refresh sometimes lands while the new
      // VM is still in "creating" / pre-published state on the API.
      setTimeout(() => {
        if (refreshTree) refreshTree()
      }, 1500)
    }

    prevInventoryAffectingTaskIdsRef.current = currentInventoryTaskIds

    setMigratingVms(prev => {
      const prevKey = prev.map(m => `${m.connId}:${m.vmid}`).sort((a, b) => a.localeCompare(b)).join(',')
      const nextKey = migrations.map(m => `${m.connId}:${m.vmid}`).sort((a, b) => a.localeCompare(b)).join(',')

      return prevKey === nextKey ? prev : migrations
    })
  }, [runningTasksData, refreshTree])

  // Page title
  useEffect(() => {
    setPageInfo(t('navigation.inventory'), t('inventory.vms') + ' & ' + t('inventory.containers'), 'ri-database-fill')
    
return () => setPageInfo('', '', '')
  }, [setPageInfo, t])

  // Merger automatique des VMs brutes avec les données enrichies et le statut de migration
  const allVms = useMemo(() => {
    return rawVms.map(vm => {
      const key = `${vm.connId}:${vm.type}:${vm.node}:${vm.vmid}`
      const enriched = enrichedData[key]
      
      // Vérifier si cette VM est en cours de migration
      const migrating = migratingVms.find(m => 
        m.connId === vm.connId && m.vmid === vm.vmid
      )
      
      const result: AllVmItem = {
        ...vm,
        isMigrating: !!migrating,
        migrationTarget: migrating?.targetNode
      }
      
      if (enriched) {
        result.ip = enriched.ip ?? vm.ip
        result.snapshots = enriched.snapshots ?? vm.snapshots
        result.uptime = enriched.uptime ?? vm.uptime
        result.osInfo = enriched.osInfo ?? (vm as any).osInfo
      }
      
      return result
    })
  }, [rawVms, enrichedData, migratingVms])

  // Set des VMs en migration pour InventoryTree (format: "connId:vmid")
  const migratingVmIds = useMemo(() => {
    return new Set(migratingVms.map(m => `${m.connId}:${m.vmid}`))
  }, [migratingVms])

  // Set des VMs avec une action en cours (start, stop, etc.)
  const [pendingActionVmIds, setPendingActionVmIds] = useState<Set<string>>(new Set())

  const onVmActionStart = useCallback((connId: string, vmid: string) => {
    setPendingActionVmIds(prev => { const next = new Set(prev); next.add(`${connId}:${vmid}`); return next })
  }, [])

  const onVmActionEnd = useCallback((connId: string, vmid: string) => {
    setPendingActionVmIds(prev => { const next = new Set(prev); next.delete(`${connId}:${vmid}`); return next })
  }, [])

  const [treeOptimisticVmStatus, setTreeOptimisticVmStatus] = useState<((connId: string, vmid: string, status: string) => void) | null>(null)
  const treeOptimisticVmTagsRef = useRef<((connId: string, vmid: string, tags: string[]) => void) | null>(null)

  // Optimistic update: immediately reflect expected VM status in rawVms + tree clusters
  const onOptimisticVmStatus = useCallback((connId: string, vmid: string, status: string) => {
    setRawVms(prev => prev.map(vm =>
      vm.connId === connId && String(vm.vmid) === String(vmid) ? { ...vm, status } : vm
    ))
    treeOptimisticVmStatus?.(connId, vmid, status)
  }, [treeOptimisticVmStatus])

  // Optimistic update: immediately reflect expected VM tags in rawVms + tree clusters
  const onVmTagsChange = useCallback((connId: string, vmid: string, tags: string[]) => {
    setRawVms(prev => prev.map(vm =>
      vm.connId === connId && String(vm.vmid) === String(vmid) ? { ...vm, tags } : vm
    ))
    treeOptimisticVmTagsRef.current?.(connId, vmid, tags)
  }, [])

  // Derive favorites from SWR data
  const favorites = useMemo(() => {
    const favs = favoritesData?.data || []
    return new Set<string>(favs.map((f: any) => f.vm_key))
  }, [favoritesData])

  // Toggle favori
  const toggleFavorite = useCallback(async (vm: { connId: string; node: string; type: string; vmid: string | number; name?: string }) => {
    const vmKey = `${vm.connId}:${vm.node}:${vm.type}:${vm.vmid}`
    const isFav = favorites.has(vmKey)

    try {
      if (isFav) {
        const res = await fetch(`/api/v1/favorites?vmKey=${encodeURIComponent(vmKey)}`, { method: 'DELETE' })
        if (res.ok) mutateFavorites()
      } else {
        const res = await fetch('/api/v1/favorites', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            connectionId: vm.connId,
            node: vm.node,
            vmType: vm.type,
            vmid: vm.vmid,
            vmName: vm.name
          })
        })
        if (res.ok) mutateFavorites()
      }
    } catch (e) {
      console.error('Error toggling favorite:', e)
    }
  }, [favorites, mutateFavorites])

  // Largeur du panneau gauche (resizable, persistée — #538)
  const [leftWidth, setLeftWidth] = useState(() => {
    if (settings.globalTheme === 'vcenterClassic') return CLASSIC_LEFT_WIDTH.default

    if (typeof window !== 'undefined') {
      const saved = Number(localStorage.getItem('pxc-inventory-tree-width'))
      if (Number.isFinite(saved) && saved > 0) {
        return Math.min(leftPanelWidth.max, Math.max(leftPanelWidth.min, saved))
      }
    }
    return settings.globalTheme === 'nebula' && typeof window !== 'undefined' && window.innerWidth < 1440
      ? NEBULA_LEFT_WIDTH.narrowDefault
      : leftPanelWidth.default
  })
  const effectiveLeftWidth = isVcenterClassic ? CLASSIC_LEFT_WIDTH.default : leftWidth
  const [isResizing, setIsResizing] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  const handleRefreshRef = useCallback((refresh: () => void) => {
    setRefreshTree(() => refresh)
  }, [])

  const handleOptimisticRef = useCallback((fn: (connId: string, vmid: string, status: string) => void) => {
    setTreeOptimisticVmStatus(() => fn)
  }, [])

  // issue #378: the connections-list SWR only warms the shared cache for
  // dialogs — its result isn't rendered here, and the tree streams its own
  // data via SSE (and shows its own errors). A 403/500 on this fetch must NOT
  // blank the whole inventory, which is exactly what happened to low-privilege
  // roles. Log for diagnostics instead of gating the tree on it.
  useEffect(() => {
    if (connectionsError) console.warn('[inventory] connections list fetch failed:', connectionsError.message)
  }, [connectionsError])

  // Quand on passe en mode tree, sélectionner automatiquement 'root' pour afficher la vue arborescente
  useEffect(() => {
    if (viewMode === 'tree' && (!selection || selection.type !== 'root')) {
      setSelection({ type: 'root', id: 'root' })
    }
  }, [viewMode])

  // Gestion du resize
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    setIsResizing(true)
  }, [])

  useEffect(() => {
    if (!isResizing) return

    const handleMouseMove = (e: MouseEvent) => {
      if (!containerRef.current) return
      const containerRect = containerRef.current.getBoundingClientRect()
      const newWidth = e.clientX - containerRect.left

      setLeftWidth(Math.min(leftPanelWidth.max, Math.max(leftPanelWidth.min, newWidth)))
    }

    const handleMouseUp = () => {
      setIsResizing(false)
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isResizing, leftPanelWidth.max, leftPanelWidth.min])

  // Persiste la largeur du panneau pour la conserver après navigation/reload (#538).
  // Écrit une fois par redimensionnement (au relâchement), pas à chaque mousemove.
  useEffect(() => {
    if (isVcenterClassic || isResizing || typeof window === 'undefined') return
    localStorage.setItem('pxc-inventory-tree-width', String(leftWidth))
  }, [isResizing, isVcenterClassic, leftWidth])

  // Persiste l'état replié du panneau (#538).
  useEffect(() => {
    if (typeof window === 'undefined') return
    localStorage.setItem('pxc-inventory-tree-collapsed', String(isTreeCollapsed))
  }, [isTreeCollapsed])

  // Charger les IP, Snapshots et Uptime pour toutes les VMs
  const loadIpSnap = useCallback(async () => {
    if (ipSnapLoading || rawVms.length === 0) return
    
    setIpSnapLoading(true)
    
    // Grouper les VMs par connexion
    const byConnection: Record<string, typeof rawVms> = {}

    rawVms.forEach(vm => {
      if (!byConnection[vm.connId]) {
        byConnection[vm.connId] = []
      }

      byConnection[vm.connId].push(vm)
    })
    
    // Charger par connexion en parallèle
    try {
      const newEnrichedData: Record<string, { ip?: string | null; snapshots?: number; uptime?: string | null }> = { ...enrichedData }
      
      await Promise.all(
        Object.entries(byConnection).map(async ([connId, vms]) => {
          const vmsToFetch = vms.map(v => ({
            connId: v.connId,
            type: v.type,
            node: v.node,
            vmid: v.vmid,
            status: v.status
          }))
          
          try {
            const res = await fetch('/api/v1/vms/ips', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ vms: vmsToFetch })
            })
            
            if (!res.ok) return
            const json = await res.json()
            const data = json.data || {}
            
            // Stocker les données enrichies
            for (const [key, value] of Object.entries(data)) {
              newEnrichedData[key] = value as { ip?: string | null; snapshots?: number; uptime?: string | null; osInfo?: { type: 'linux' | 'windows' | 'other'; name: string | null; version: string | null; kernel: string | null } | null }
            }
          } catch (e) {
            console.error('Error loading IPs for connection:', connId, e)
          }
        })
      )
      
      setEnrichedData(newEnrichedData)
    } finally {
      setIpSnapLoading(false)
      setIpSnapLoaded(true)
    }
  }, [rawVms, ipSnapLoading, enrichedData])

  return (
    <Box
      ref={containerRef}
      className="ts-layout-content-height-fixed"
      sx={{
        // IMPORTANT: permettre aux enfants de scroller
        minHeight: 0,

        // Nebula adds a page heading above the two-panel workspace. Other
        // themes keep the original direct row/column layout.
        display: 'flex',
        flexDirection: isNebula ? 'column' : { xs: 'column', lg: 'row' },
        flex: { lg: 1 },

        // The fixed-height main area is a flex column. Let this page consume
        // its remaining space without duplicating navbar/taskbar arithmetic.
        overflow: 'hidden',
        transition: 'height 0.2s ease, max-height 0.2s ease',

        // Pas d'animation pendant le drag-resize de la taskbar (TasksFooter #582)
        'html[data-taskbar-resizing] &': { transition: 'none' },

        // Curseur de resize global pendant le drag
        cursor: isResizing ? 'col-resize' : 'default',
        userSelect: isResizing ? 'none' : 'auto',
      }}
    >
      {isNebula && (
        <Box
          component='header'
          sx={{
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: 2,
            mb: { xs: 2, md: 8.5 },
            flexShrink: 0,
          }}
        >
          <Box sx={{ minWidth: 0 }}>
            <Typography
              component='h1'
              sx={{
                color: 'text.primary',
                fontSize: { xs: 24, md: 28 },
                fontWeight: 800,
                letterSpacing: '-0.025em',
                lineHeight: 1.25,
              }}
            >
              {t('inventory.nebulaHostsTitle')}
            </Typography>
            <Typography sx={{ color: 'text.secondary', fontSize: 14, lineHeight: 1.6, mt: 0.25 }}>
              {t('inventory.nebulaHostsDescription')}
            </Typography>
          </Box>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            <Button
              size='small'
              variant='outlined'
              startIcon={<i className='ri-refresh-line' />}
              onClick={() => refreshTree?.()}
              disabled={!refreshTree || loading}
              sx={{ whiteSpace: 'nowrap' }}
            >
              {t('common.refresh')}
            </Button>
            {selectedNode && allowBlankVm && (
              <Button
                size='small'
                variant='contained'
                startIcon={<i className='ri-add-line' />}
                onClick={() => setCreateDialogRequest({
                  type: 'createVm',
                  connId: selectedNode.connId,
                  node: selectedNode.node,
                  ts: Date.now(),
                })}
                sx={{ whiteSpace: 'nowrap' }}
              >
                {t('common.create')} VM
              </Button>
            )}
          </Box>
        </Box>
      )}

      <Box
        sx={{
          display: isNebula ? 'flex' : 'contents',
          flexDirection: { xs: 'column', lg: 'row' },
          flex: 1,
          minHeight: 0,
          gap: isNebula ? { xs: '16px', lg: 0 } : undefined,
          overflowX: isNebula ? 'hidden' : undefined,
          overflowY: isNebula ? { xs: 'auto', lg: 'hidden' } : undefined,
          overscrollBehavior: isNebula ? 'contain' : undefined,
        }}
      >
      {/* LEFT: Tree */}
      <Card
        variant='outlined'
        sx={{
          height: { xs: isNebula ? 240 : 'auto', lg: 'auto' },
          minHeight: { xs: isNebula ? 240 : 0, lg: 0 },
          maxHeight: { xs: isNebula ? 240 : 'none', lg: 'none' },
          display: 'flex',
          flexDirection: 'column',
          width: { xs: '100%', lg: isTreeCollapsed ? COLLAPSED_WIDTH : effectiveLeftWidth },
          minWidth: { lg: isTreeCollapsed ? COLLAPSED_WIDTH : leftPanelWidth.min },
          maxWidth: { lg: isTreeCollapsed ? COLLAPSED_WIDTH : leftPanelWidth.max },
          flex: { xs: 'none', lg: '0 0 auto' },
          transition: 'width 0.2s ease, min-width 0.2s ease, max-width 0.2s ease',
          overflow: 'hidden',
          bgcolor: 'background.paper',
          borderColor: 'divider',
          borderRadius: isNebula ? 2.5 : undefined,
          boxShadow: isNebula ? 'var(--nebula-shadow-panel)' : undefined,
        }}
      >
        {isNebula && !isTreeCollapsed && (
          <Box sx={{ px: 2, pt: 2, pb: 0.5, flexShrink: 0 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
              <Typography component='h2' sx={{ color: 'text.primary', fontSize: 18, fontWeight: 700, lineHeight: 1.4 }}>
                {t('inventory.nebulaResourceTreeTitle')}
              </Typography>
              <Chip
                size='small'
                label={resourceItemCount}
                aria-label={`${t('common.total')}: ${resourceItemCount}`}
                sx={{ height: 22, minWidth: 36, fontSize: 11, fontWeight: 700 }}
              />
            </Box>
          </Box>
        )}

        {/* Header fixe (collapsed: juste le bouton expand) */}
        {isTreeCollapsed && (
          <CardContent sx={{ pt: 1.5, pb: 1, px: 1, display: 'flex', justifyContent: 'center' }}>
            <Tooltip title={t('common.showMore')}>
              <IconButton
                size='small'
                onClick={() => setIsTreeCollapsed(false)}
                sx={{
                  bgcolor: 'action.hover',
                  '&:hover': { bgcolor: 'action.selected' }
                }}
              >
                <i className='ri-side-bar-fill' style={{ fontSize: 16 }} />
              </IconButton>
            </Tooltip>
          </CardContent>
        )}

        {/* Contenu scrollable - masqué quand collapsed */}
        {!isTreeCollapsed && (
          <Box sx={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden', px: 2, pb: 2 }}>
          {loading ? (
            <Box sx={{ p: 1, display: 'flex', flexDirection: 'column', gap: 1 }}>
              <Skeleton variant="rounded" height={32} />
              <Skeleton variant="rounded" height={24} width="80%" />
              <Skeleton variant="rounded" height={24} width="60%" />
              <Skeleton variant="rounded" height={24} width="90%" />
              <Skeleton variant="rounded" height={24} width="70%" />
            </Box>
          ) : err ? (
            <Typography color='error'>{err}</Typography>
          ) : (
            <InventoryTree
              selected={selection}
              onSelect={(sel) => setSelection(sel)}
              onRefreshRef={handleRefreshRef}
              onOptimisticVmStatusRef={handleOptimisticRef}
              onOptimisticVmTagsRef={(fn) => { treeOptimisticVmTagsRef.current = fn }}
              viewMode={viewMode}
              onViewModeChange={setViewMode}
              onAllVmsChange={setRawVms}
              onHostsChange={setHosts}
              onPoolsChange={setPools}
              onTagsChange={setTags}
              onPbsServersChange={setPbsServers}
              favorites={favorites}
              onToggleFavorite={toggleFavorite}
              migratingVmIds={migratingVmIds}
              pendingActionVmIds={pendingActionVmIds}
              onRefresh={() => refreshTree?.()}
              refreshLoading={loading}
              onCollapse={() => setIsTreeCollapsed(!isTreeCollapsed)}
              isCollapsed={isTreeCollapsed}
              allowedViewModes={allowedViewModes}
              onCreateVm={(connId, node) => setCreateDialogRequest({ type: 'createVm', connId, node, ts: Date.now() })}
              onCreateLxc={(connId, node) => setCreateDialogRequest({ type: 'createLxc', connId, node, ts: Date.now() })}
              onNodeAction={(connId, node, action) => setNodeActionRequest({ action, connId, node, ts: Date.now() })}
              onStoragesChange={setClusterStorages}
              onExternalHypervisorsChange={setExternalHypervisors}
              showVmId={showVmId}
              onToggleShowVmId={toggleShowVmId}
            />
          )}
        </Box>
        )}
      </Card>

      {/* RESIZER - visible uniquement sur desktop et quand la tree n'est pas collapsed */}
      <Box
        onMouseDown={isTreeCollapsed || isVcenterClassic ? undefined : handleMouseDown}
        sx={{
          display: { xs: 'none', lg: isTreeCollapsed ? 'none' : 'flex' },
          alignItems: 'center',
          justifyContent: 'center',
          width: isNebula || isVcenterClassic ? 16 : 12,
          cursor: isTreeCollapsed || isVcenterClassic ? 'default' : 'col-resize',
          flexShrink: 0,
          '&:hover': {
            '& .resizer-handle': {
              bgcolor: 'primary.main',
              opacity: 0.5,
            }
          },
          ...(isResizing && {
            '& .resizer-handle': {
              bgcolor: 'primary.main',
              opacity: 0.7,
            }
          })
        }}
      >
        <Box
          className="resizer-handle"
          sx={{
            width: isNebula ? 2 : 4,
            height: 48,
            borderRadius: 2,
            bgcolor: 'divider',
            visibility: isVcenterClassic ? 'hidden' : 'visible',
            transition: 'background-color 0.15s, opacity 0.15s',
          }}
        />
      </Box>

      {/* RIGHT: Details */}
      <Card
        variant='outlined'
        sx={{
          height: { xs: isNebula ? 560 : 'auto', lg: 'auto' },
          minHeight: { xs: isNebula ? 560 : 0, lg: 0 },
          display: 'flex',
          flexDirection: 'column',
          flex: { xs: isNebula ? '0 0 560px' : 1, lg: 1 },
          width: '100%',
          overflow: 'hidden',
          bgcolor: 'background.paper',
          borderColor: 'divider',
          borderRadius: isNebula ? 2.5 : undefined,
          boxShadow: isNebula ? 'var(--nebula-shadow-panel)' : undefined,
        }}
      >
        <Box sx={{ flex: 1, minHeight: 0, overflow: 'auto', display: 'flex', flexDirection: 'column' }}>
          <InventoryDetails
            selection={selection}
            onSelect={(sel: any) => setSelection(sel)}
            onBack={() => setSelection(null)}
            viewMode={viewMode}
            onViewModeChange={setViewMode}
            allVms={allVms}
            hosts={hosts}
            pools={pools}
            tags={tags}
            pbsServers={pbsServers}
            showIpSnap={ipSnapLoaded}
            ipSnapLoading={ipSnapLoading}
            onLoadIpSnap={loadIpSnap}
            favorites={favorites}
            onToggleFavorite={toggleFavorite}
            migratingVmIds={migratingVmIds}
            pendingActionVmIds={pendingActionVmIds}
            onVmActionStart={onVmActionStart}
            onVmActionEnd={onVmActionEnd}
            onOptimisticVmStatus={onOptimisticVmStatus}
            onVmTagsChange={onVmTagsChange}
            clusterStorages={clusterStorages}
            externalHypervisors={externalHypervisors}
            externalDialogRequest={createDialogRequest}
            onExternalDialogHandled={() => setCreateDialogRequest(null)}
            nodeActionRequest={nodeActionRequest}
            onNodeActionHandled={() => setNodeActionRequest(null)}
            onRefresh={async () => {
              if (refreshTree) {
                refreshTree()

                // Attendre un peu pour que le refresh soit traité
                await new Promise(resolve => setTimeout(resolve, 500))
              }
            }}
          />
        </Box>
      </Card>
      </Box>
    </Box>
  )
}
