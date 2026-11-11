'use client'

import { useRouter } from 'next/navigation'

import { Features, useLicense } from '@/contexts/LicenseContext'
import { useRBAC } from '@/contexts/RBACContext'
import { useTenant } from '@/contexts/TenantContext'
import { useTaskEvents } from '@/hooks/useTaskEvents'
import ClassicOverviewSkeleton from './ClassicOverviewSkeleton'

type Props = {
  data: any
  loading?: boolean
  refreshing?: boolean
  lastUpdated?: Date | null
  onRefresh?: () => void
}

const safe = (value: unknown, fallback = 0) => {
  const parsed = Number(value)

  return Number.isFinite(parsed) ? parsed : fallback
}

const optionalNumber = (value: unknown) => {
  if (value === null || value === undefined || value === '') return null
  const parsed = Number(value)

  return Number.isFinite(parsed) ? parsed : null
}

const pct = (value: unknown) => {
  const parsed = optionalNumber(value)

  return parsed === null ? null : Math.max(0, Math.min(100, parsed))
}

const ClassicOverview = ({ data, loading = false, refreshing = false, lastUpdated, onRefresh }: Props) => {
  const router = useRouter()
  const { hasFeature } = useLicense()
  const { hasAnyPermission, hasPermission, isAdmin } = useRBAC()
  const { isProvider } = useTenant()
  const canViewAlerts = hasFeature(Features.ALERTS) && hasPermission('connection.view')
  const canViewTasks = hasFeature(Features.TASK_CENTER) && hasPermission('tasks.view')
  const canManageConnections = isAdmin && isProvider && hasPermission('connection.manage')
  const canCreateVm = hasPermission('vm.create')
  const canManageGreen = isAdmin && isProvider && hasPermission('admin.settings') && hasFeature(Features.GREEN_METRICS)
  const { data: taskResponse } = useTaskEvents(5, canViewTasks)
  const summary = data?.summary || {}
  const alerts = Array.isArray(data?.alerts) ? data.alerts : []
  const instanceTotal = safe(summary.vmsTotal) + safe(summary.lxcTotal)
  const hasInstanceSummary = optionalNumber(summary.vmsTotal) !== null || optionalNumber(summary.lxcTotal) !== null
  const hasDatacenterSummary = optionalNumber(summary.clusters) !== null || optionalNumber(summary.standalones) !== null
  const alertSummaryTotal = safe(data?.alertsSummary?.crit) + safe(data?.alertsSummary?.warn) + safe(data?.alertsSummary?.info)
  const alertTotal = alerts.length || alertSummaryTotal
  const metrics = [
    ['集群 / 单节点', hasDatacenterSummary ? safe(summary.clusters) + safe(summary.standalones) : '—'],
    ['主机', optionalNumber(summary.nodes) ?? '—'],
    ['虚拟机 / 容器', hasInstanceSummary ? instanceTotal : '—'],
    ...(canViewAlerts ? [['待处理告警', alertTotal]] : []),
  ]
  const resources = [
    ['CPU', pct(data?.resources?.cpuPct)],
    ['内存', pct(data?.resources?.ramPct)],
    ['存储', pct(data?.resources?.storagePct)],
  ]
  const clusters = Array.isArray(data?.clusters) ? data.clusters.slice(0, 4) : []
  const todos = canViewAlerts ? alerts.slice(0, 3) : []
  const recentTasks = Array.isArray(taskResponse?.data) ? taskResponse.data.slice(0, 5) : []
  const healthLinks = [
    ...(hasAnyPermission(['vm.view', 'node.view'])
      ? [{ label: '资源清单', action: '查看主机和集群', path: '/infrastructure/inventory' }]
      : []),
    ...(isProvider && hasFeature(Features.DRS) && hasPermission('automation.view')
      ? [{ label: 'DRS 调度', action: '查看调度建议', path: '/automation/drs' }]
      : []),
    ...(isProvider && hasFeature(Features.HA) && hasPermission('admin.settings')
      ? [{ label: '平台高可用', action: '查看集群状态', path: '/settings?tab=ha' }]
      : []),
    ...(hasAnyPermission(['backup.view', 'backup.job.view'])
      ? [{ label: '备份与恢复', action: '查看备份记录', path: '/operations/backups' }]
      : []),
  ]
  const open = (path: string) => router.push(path)

  if (loading) {
    return <ClassicOverviewSkeleton />
  }

  return (
    <div className='vcenter-classic-overview'>
      <div className='vcenter-classic-actions'>
        {canManageConnections && (
          <>
            <button className='is-primary' type='button' onClick={() => open('/settings?tab=connections&add=unisphere')}>添加 UNISPHERE</button>
            <button type='button' onClick={() => open('/settings?tab=connections&add=pbs')}>添加 PBS</button>
          </>
        )}
        {canCreateVm && (
          <button type='button' onClick={() => open('/infrastructure/inventory?action=create-vm')}>创建虚拟机</button>
        )}
        {canManageGreen && (
          <button type='button' onClick={() => open('/settings?tab=green&create=datacenter')}>创建数据中心</button>
        )}
        <div className='vcenter-classic-refresh-status'>
          <span>{lastUpdated ? `数据更新于 ${lastUpdated.toLocaleTimeString('zh-CN')}` : '等待实时数据'}</span>
          {onRefresh && (
            <button className='is-refresh' type='button' onClick={onRefresh} disabled={refreshing}>
              <i className={`ri-refresh-line${refreshing ? ' vcenter-spin' : ''}`} aria-hidden />
              {refreshing ? '正在刷新' : '刷新数据'}
            </button>
          )}
        </div>
      </div>

      <div className='vcenter-classic-metrics'>
        {metrics.map(([label, value]) => <article key={String(label)}><span>{label}</span><strong>{value}</strong></article>)}
      </div>

      <div className='vcenter-classic-grid'>
        <section className='vcenter-classic-panel'>
          <header>资源使用</header>
          <div className='vcenter-classic-resource-list'>
            {resources.map(([label, value]) => (
              <div key={String(label)}>
                <div><span>{label}</span><span>{value === null ? '—' : `${Math.round(Number(value))}%`}</span></div>
                <div className='vcenter-classic-progress'><span style={{ width: `${value ?? 0}%` }} /></div>
              </div>
            ))}
          </div>
        </section>

        <section className='vcenter-classic-panel'>
          <header>服务与健康</header>
          <dl className='vcenter-classic-health'>
            {healthLinks.length ? healthLinks.map(item => (
              <div key={item.label}>
                <dt>{item.label}</dt>
                <dd><button type='button' onClick={() => open(item.path)}>{item.action}</button></dd>
              </div>
            )) : <div className='vcenter-classic-empty'>当前账号没有可用的运维入口</div>}
          </dl>
        </section>

        <section className={`vcenter-classic-panel${canViewAlerts ? '' : ' is-wide'}`}>
          <header>集群与主机</header>
          <table>
            <thead><tr><th>名称</th><th>在线主机</th><th>状态</th><th>操作</th></tr></thead>
            <tbody>
              {clusters.length ? clusters.map((cluster: any, index: number) => {
                const totalNodes = safe(cluster.nodes)
                const onlineNodes = safe(cluster.onlineNodes)
                const quorumError = cluster.quorum?.quorate === false
                const status = quorumError
                  ? '仲裁异常'
                  : totalNodes > 0 && onlineNodes >= totalNodes
                    ? '正常'
                    : onlineNodes > 0
                      ? '部分离线'
                      : '离线'
                const statusClass = status === '正常'
                  ? 'vcenter-classic-ok'
                  : status === '离线' || status === '仲裁异常'
                    ? 'vcenter-classic-error'
                    : 'vcenter-classic-warning'

                return (
                  <tr key={cluster.id || cluster.name || index}>
                    <td>{cluster.name || '未命名集群'}</td>
                    <td>{onlineNodes} / {totalNodes}</td>
                    <td><span className={statusClass}>{status}</span></td>
                    <td><button type='button' onClick={() => open('/infrastructure/inventory')}>查看资源</button></td>
                  </tr>
                )
              }) : <tr><td colSpan={4} className='vcenter-classic-empty'>暂无集群数据</td></tr>}
            </tbody>
          </table>
        </section>

        {canViewAlerts && (
          <section className='vcenter-classic-panel'>
            <header>待处理告警</header>
            <table>
              <thead><tr><th>告警</th><th>级别</th><th>操作</th></tr></thead>
              <tbody>
                {todos.length ? todos.map((alert: any, index: number) => (
                  <tr key={alert.id || index}>
                    <td>{alert.message || '未命名告警'}</td>
                    <td>{alert.severity === 'critical' ? '严重' : alert.severity === 'warning' ? '警告' : '信息'}</td>
                    <td><button type='button' onClick={() => open('/operations/alerts')}>查看告警</button></td>
                  </tr>
                )) : <tr><td colSpan={3} className='vcenter-classic-empty'>暂无待处理告警</td></tr>}
              </tbody>
            </table>
          </section>
        )}
      </div>

      {canViewTasks && (
        <section className='vcenter-classic-panel vcenter-classic-recent-tasks'>
          <header>
            <span>最近任务</span>
            <button type='button' onClick={() => open('/operations/task-center')}>查看全部任务</button>
          </header>
          <table>
            <thead><tr><th>任务</th><th>对象</th><th>状态</th><th>开始时间</th></tr></thead>
            <tbody>
              {recentTasks.length ? recentTasks.map((task: any, index: number) => (
                <tr key={task.id || index}>
                  <td><button type='button' onClick={() => open('/operations/task-center')}>{task.typeLabel || task.message || task.type || '平台任务'}</button></td>
                  <td>{task.entityName || task.entity || task.node || task.connectionName || '平台'}</td>
                  <td><span className={task.status === 'OK' ? 'vcenter-classic-ok' : ''}>{task.status === 'running' ? '运行中' : task.status === 'OK' ? '已完成' : task.status || '未知'}</span></td>
                  <td>{task.ts ? new Date(task.ts).toLocaleString('zh-CN') : '—'}</td>
                </tr>
              )) : <tr><td colSpan={4} className='vcenter-classic-empty'>暂无最近任务</td></tr>}
            </tbody>
          </table>
        </section>
      )}
    </div>
  )
}

export default ClassicOverview
