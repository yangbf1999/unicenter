// Menu data with translation support
// Pass the t function from useTranslations() to get translated labels
// requiredFeature: feature ID from license that is required to access this menu item
export const menuData = (t = (key) => key) => [
  {
    label: t('navigation.dashboard'),
    icon: 'ri-dashboard-line',
    href: '/home',
    requires: { hasVdc: false }, // provider / tenant-without-vdc landing
  },
  {
    label: t('navigation.myVdc'),
    icon: 'ri-cloud-line',
    href: '/my-vdc',
    permissions: ['sdn.vnet.view'],
    requires: { hasVdc: true }, // tenant cockpit
  },

  {
    isSection: true,
    label: t('navigation.infrastructure'),
    icon: 'ri-server-line',
    children: [
      {
        label: t('navigation.inventory'),
        icon: 'ri-database-fill',
        href: '/infrastructure/inventory',
        permissions: ['vm.view', 'node.view'] // Au moins une de ces permissions
      },
      {
        label: t('navigation.instances'),
        icon: 'ri-instance-line',
        href: '/infrastructure/instances',
        permissions: ['vm.view']
      },
      {
        label: t('navigation.topology'),
        icon: 'ri-mind-map',
        href: '/infrastructure/topology',
        permissions: ['vm.view', 'node.view'],
        // Cluster-wide layout (nodes / shared storages / SDN graph) is a
        // provider concern. Hidden for tenants (isProviderTenant) and for
        // VM / tag / pool scoped roles (infraScope). Both would re-leak the
        // node names we hide everywhere else in those views, even though such
        // roles legitimately keep vm.view to see and start/stop their guests.
        requires: { isProviderTenant: true, infraScope: true }
      },
      {
        label: t('navigation.storage'),
        icon: 'ri-database-2-fill',
        href: '/storage/overview',
        permissions: ['storage.admin']
      },
      {
        label: t('navigation.ceph'),
        icon: 'ri-stack-line',
        href: '/storage/ceph',
        permissions: ['storage.admin']
      },
      {
        label: t('navigation.backups'),
        icon: 'ri-file-copy-fill',
        href: '/operations/backups',
        permissions: ['backup.view', 'backup.job.view']
      },
      {
        label: t('navigation.templates'),
        icon: 'ri-instance-line',
        // Tenants need to see the catalogue to deploy cloud images into their
        // vDC. Provider keeps automation.view for full management (upload,
        // delete, blueprints). Tenants only need vm.create to use the wizard.
        href: '/automation/templates',
        permissions: ['automation.view', 'vm.create']
      }
    ]
  },

  {
    isSection: true,
    label: t('navigation.orchestration'),
    icon: 'ri-robot-line',
    permissions: ['automation.view'], // Provider-scope orchestration: DRS, SR, flows, resources
    requires: { isProviderTenant: true }, // Hidden in tenant view: these pages drive fleet-wide ops the tenant can't act on
    requiredFeature: 'drs', // Whole section requires DRS feature
    children: [
      {
        label: t('navigation.drs'),
        icon: 'ri-loop-left-fill',
        href: '/automation/drs',
        permissions: ['automation.view'],
        requires: { isProviderTenant: true },
        requiredFeature: 'drs'
      },
      {
        label: t('navigation.siteRecovery'),
        icon: 'ri-shield-star-line',
        href: '/automation/site-recovery',
        permissions: ['automation.view'],
        requires: { isProviderTenant: true },
        requiredFeature: 'ceph_replication'
      },
      {
        label: t('navigation.networkSecurity'),
        icon: 'ri-shield-flash-fill',
        href: '/automation/network',
        permissions: ['automation.view'],
        requires: { isProviderTenant: true },
        requiredFeature: 'microsegmentation'
      },
      {
        label: t('navigation.networkFlows'),
        icon: 'ri-flow-chart',
        href: '/operations/network-flows',
        permissions: ['automation.view'],
        requires: { isProviderTenant: true },
        requiredFeature: 'sflow_monitoring'
      },
      {
        label: t('navigation.resources'),
        icon: 'ri-pie-chart-fill',
        href: '/infrastructure/resources',
        permissions: ['automation.view'],
        requires: { isProviderTenant: true },
        requiredFeature: 'green_metrics' // Requires Enterprise license
      }
    ]
  },

  {
    isSection: true,
    label: t('navigation.operations'),
    icon: 'ri-pulse-line',
    children: [
      {
        label: t('navigation.events'),
        icon: 'ri-calendar-event-line',
        href: '/operations/events',
        permissions: ['events.view']
      },
      {
        label: t('navigation.changes'),
        icon: 'ri-git-commit-line',
        href: '/operations/changes',
        // Permissions removed to expose the page in vDC tenant menus for
        // scoping evaluation. API still enforces CONNECTION_VIEW at runtime.
        requiredFeature: 'change_tracking'
      },
      {
        label: t('navigation.alerts'),
        icon: 'ri-notification-3-line',
        href: '/operations/alerts',
        // Permissions removed to expose the page in vDC tenant menus for
        // scoping evaluation. API still enforces ALERTS_VIEW at runtime.
        requiredFeature: 'alerts'
      },
      {
        label: t('navigation.jobs'),
        icon: 'ri-play-list-2-line',
        href: '/operations/task-center',
        permissions: ['tasks.view'],
        requiredFeature: 'task_center' // Requires Enterprise license
      },
      {
        label: t('navigation.reports'),
        icon: 'ri-file-chart-line',
        href: '/operations/reports',
        // Permissions removed to expose the page in vDC tenant menus for
        // scoping evaluation. API still enforces REPORTS_VIEW at runtime.
        requiredFeature: 'reports'
      }
    ]
  },

  {
    isSection: true,
    label: t('navigation.securityAccess'),
    icon: 'ri-shield-keyhole-line',
    // Section gate removed so the Audit item can appear for vDC tenants
    // (scoping evaluation). Each child still enforces its own permissions,
    // so users/rbac/compliance stay admin-only as before.
    children: [
      {
        label: t('navigation.users'),
        icon: 'ri-user-line',
        href: '/security/users',
        permissions: ['admin.users']
      },
      {
        label: t('navigation.rbacRoles'),
        icon: 'ri-lock-2-line',
        href: '/security/rbac',
        permissions: ['admin.rbac'],
        requiredFeature: 'rbac' // Requires Enterprise license
      },
      {
        label: t('navigation.auditLogs'),
        icon: 'ri-file-search-line',
        href: '/security/audit',
        permissions: ['admin.audit']
      },
      {
        label: t('navigation.compliance'),
        icon: 'ri-shield-check-line',
        href: '/security/compliance',
        permissions: ['admin.compliance'],
        requiredFeature: 'compliance'
      }
    ]
  },

  {
    isSection: true,
    label: t('navigation.settings'),
    icon: 'ri-settings-4-line',
    permissions: ['admin.settings', 'connection.manage'],
    children: [
      {
        label: t('navigation.settings'),
        icon: 'ri-settings-3-line',
        href: '/settings',
        permissions: ['connection.manage', 'admin.settings']
      }
    ]
  }
]

// The classic client uses the compact, collapsible information architecture
// from the approved vCenter reference. Routes and access gates intentionally
// stay aligned with the regular product menu.
export const vcenterClassicMenuData = (t = (key) => key) => [
  {
    label: '全局摘要',
    icon: 'ri-dashboard-line',
    href: '/home',
    requires: { hasVdc: false }
  },
  {
    label: '资源与基础设施',
    icon: 'ri-server-line',
    defaultOpen: true,
    children: [
      {
        label: '主机和集群',
        icon: 'ri-server-line',
        href: '/infrastructure/inventory',
        permissions: ['vm.view', 'node.view']
      },
      {
        label: '虚拟机和容器',
        icon: 'ri-instance-line',
        href: '/infrastructure/instances',
        permissions: ['vm.view']
      },
      {
        label: '模板与镜像',
        icon: 'ri-file-copy-line',
        href: '/automation/templates',
        permissions: ['automation.view', 'vm.create']
      },
      {
        label: '资源拓扑',
        icon: 'ri-mind-map',
        href: '/infrastructure/topology',
        permissions: ['vm.view', 'node.view'],
        requires: { isProviderTenant: true, infraScope: true }
      },
      {
        label: '容量与能耗',
        icon: 'ri-pie-chart-line',
        href: '/infrastructure/resources',
        permissions: ['automation.view'],
        requires: { isProviderTenant: true },
        requiredFeature: 'green_metrics'
      },
      {
        label: '租户资源池',
        icon: 'ri-cloud-line',
        href: '/my-vdc',
        permissions: ['sdn.vnet.view'],
        requires: { hasVdc: true }
      }
    ]
  },
  {
    label: '存储与网络',
    icon: 'ri-database-2-line',
    children: [
      {
        label: t('navigation.storage'),
        icon: 'ri-database-2-line',
        href: '/storage/overview',
        permissions: ['storage.admin']
      },
      {
        label: 'Ceph',
        icon: 'ri-stack-line',
        href: '/storage/ceph',
        permissions: ['storage.admin']
      },
      {
        label: '网络与安全',
        icon: 'ri-shield-flash-line',
        href: '/automation/network',
        permissions: ['automation.view'],
        requires: { isProviderTenant: true },
        requiredFeature: 'microsegmentation'
      }
    ]
  },
  {
    label: '可用性与自动化',
    icon: 'ri-node-tree',
    children: [
      {
        label: 'DRS 调度',
        icon: 'ri-loop-left-fill',
        href: '/automation/drs',
        permissions: ['automation.view'],
        requires: { isProviderTenant: true },
        requiredFeature: 'drs'
      },
      {
        label: '站点恢复',
        icon: 'ri-shield-star-line',
        href: '/automation/site-recovery',
        permissions: ['automation.view'],
        requires: { isProviderTenant: true },
        requiredFeature: 'ceph_replication'
      }
    ]
  },
  {
    label: '运维管理',
    icon: 'ri-pulse-line',
    children: [
      {
        label: t('navigation.events'),
        icon: 'ri-calendar-event-line',
        href: '/operations/events',
        permissions: ['events.view']
      },
      {
        label: t('navigation.backups'),
        icon: 'ri-file-copy-fill',
        href: '/operations/backups',
        permissions: ['backup.view', 'backup.job.view']
      },
      {
        label: '告警',
        icon: 'ri-notification-3-line',
        href: '/operations/alerts',
        requiredFeature: 'alerts'
      },
      {
        label: '任务中心',
        icon: 'ri-play-list-2-line',
        href: '/operations/task-center',
        permissions: ['tasks.view'],
        requiredFeature: 'task_center'
      },
      {
        label: '报表',
        icon: 'ri-file-chart-line',
        href: '/operations/reports',
        requiredFeature: 'reports'
      }
    ]
  },
  {
    label: '安全与访问',
    icon: 'ri-shield-line',
    children: [
      {
        label: t('navigation.users'),
        icon: 'ri-user-line',
        href: '/security/users',
        permissions: ['admin.users']
      },
      {
        label: '角色与权限',
        icon: 'ri-lock-2-line',
        href: '/security/rbac',
        permissions: ['admin.rbac'],
        requiredFeature: 'rbac'
      },
      {
        label: t('navigation.auditLogs'),
        icon: 'ri-file-search-line',
        href: '/security/audit',
        permissions: ['admin.audit']
      }
    ]
  },
  {
    label: '平台管理',
    icon: 'ri-settings-4-line',
    permissions: ['admin.settings', 'connection.manage'],
    children: [
      {
        label: t('navigation.settings'),
        icon: 'ri-settings-3-line',
        href: '/settings',
        permissions: ['connection.manage', 'admin.settings']
      }
    ]
  }
]
