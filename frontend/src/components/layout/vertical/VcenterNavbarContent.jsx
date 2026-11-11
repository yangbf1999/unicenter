'use client'

import { useMemo, useState } from 'react'

import { useRouter } from 'next/navigation'
import { signOut, useSession } from 'next-auth/react'
import { useTranslations } from 'next-intl'
import {
  Badge,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  ListItemIcon,
  Menu,
  MenuItem,
  Typography,
} from '@mui/material'

import CommandPalette from '@components/layout/shared/CommandPalette'
import { vcenterClassicMenuData } from '@menu/menuData'
import { Features, useLicense } from '@/contexts/LicenseContext'
import { useRBAC } from '@/contexts/RBACContext'
import { useTenant } from '@/contexts/TenantContext'
import { useMyVdcs } from '@/hooks/useMyVdcs'
import { useActiveAlerts } from '@/hooks/useNavbarNotifications'
import { hasInfraScope } from '@/lib/rbac/scopeKinds'

const VcenterNavbarContent = () => {
  const router = useRouter()
  const t = useTranslations()
  const { data: session } = useSession()
  const { hasFeature, loading: licenseLoading, isEnterprise } = useLicense()
  const { hasAnyPermission, hasPermission, scopeTypes, isAdmin, loading: rbacLoading } = useRBAC()
  const { hasVdc, loading: vdcLoading } = useMyVdcs()
  const { currentTenant, loading: tenantLoading } = useTenant()
  const isProviderTenant = currentTenant?.id === 'default'
  const infraScoped = hasInfraScope(scopeTypes, isAdmin)
  const canViewAlerts = isEnterprise && hasFeature(Features.ALERTS) && hasPermission('connection.view')
  const { data: alertsResponse } = useActiveAlerts(canViewAlerts)
  const [searchOpen, setSearchOpen] = useState(false)
  const [catalogOpen, setCatalogOpen] = useState(false)
  const [coverageOpen, setCoverageOpen] = useState(false)
  const [resetOpen, setResetOpen] = useState(false)
  const [userAnchor, setUserAnchor] = useState(null)
  const userName = session?.user?.name || session?.user?.email || 'administrator'
  const alertCount = useMemo(
    () => Array.isArray(alertsResponse?.data) ? alertsResponse.data.length : 0,
    [alertsResponse],
  )
  const catalogGroups = useMemo(() => {
    const canView = item => {
      if (rbacLoading || vdcLoading || tenantLoading) return true
      if (item.requires?.hasVdc === true && !hasVdc) return false
      if (item.requires?.hasVdc === false && hasVdc) return false
      if (item.requires?.isProviderTenant === true && !isProviderTenant) return false
      if (item.requires?.infraScope === true && !infraScoped) return false
      if (!item.permissions?.length) return true

      return hasAnyPermission(item.permissions)
    }
    const hasRequiredFeature = item => (
      licenseLoading || !item.requiredFeature || hasFeature(item.requiredFeature)
    )

    return vcenterClassicMenuData(t)
      .filter(group => group.children && canView(group) && hasRequiredFeature(group))
      .map(group => ({
        title: group.label,
        items: group.children.filter(item => canView(item) && hasRequiredFeature(item)),
      }))
      .filter(group => group.items.length)
  }, [
    hasAnyPermission,
    hasFeature,
    hasVdc,
    infraScoped,
    isProviderTenant,
    licenseLoading,
    rbacLoading,
    t,
    tenantLoading,
    vdcLoading,
  ])

  const navigate = path => {
    setCatalogOpen(false)
    setUserAnchor(null)
    router.push(path)
  }

  return (
    <Box className='vcenter-classic-navbar'>
      <Box className='vcenter-classic-navbar__primary'>
        <Box className='vcenter-classic-navbar__brand'>
          <button type='button' aria-label='打开全部功能菜单' onClick={() => setCatalogOpen(true)}>
            <i className='ri-menu-line' aria-hidden />
          </button>
          <button type='button' className='vcenter-classic-navbar__brand-name' onClick={() => navigate('/home')}>
            <strong>UniCenter</strong>
            <span>Infrastructure Client</span>
          </button>
        </Box>
        <Box className='vcenter-classic-navbar__primary-actions'>
          <Box component='button' type='button' className='vcenter-classic-search' onClick={() => setSearchOpen(true)}>
            <i className='ri-search-line' aria-hidden />
            <span>搜索资源或功能，回车跳转</span>
          </Box>
          {!licenseLoading && canViewAlerts && (
            <IconButton size='small' aria-label={`告警 ${alertCount} 条`} onClick={() => navigate('/operations/alerts')}>
              <Badge badgeContent={alertCount} color='error' max={99}>
                <i className='ri-notification-3-line' />
              </Badge>
            </IconButton>
          )}
          <Box
            component='button'
            type='button'
            className='vcenter-classic-user'
            aria-haspopup='menu'
            aria-expanded={Boolean(userAnchor)}
            onClick={event => setUserAnchor(event.currentTarget)}
          >
            {userName}
            <i className='ri-arrow-down-s-line' aria-hidden />
          </Box>
        </Box>
      </Box>
      <Box className='vcenter-classic-navbar__meta'>
        <Typography component='span'>UniCenter 管理平台 · 当前显示实时环境数据</Typography>
        <Box>
          <button type='button' onClick={() => setCatalogOpen(true)}>查看全部功能</button>
          <button type='button' onClick={() => setResetOpen(true)}>重新加载页面</button>
        </Box>
      </Box>
      <Box className='vcenter-classic-navbar__tools'>
        <button type='button' onClick={() => setCoverageOpen(true)}>功能覆盖核对</button>
      </Box>

      <CommandPalette open={searchOpen} onClose={() => setSearchOpen(false)} />

      <Menu anchorEl={userAnchor} open={Boolean(userAnchor)} onClose={() => setUserAnchor(null)}>
        <Box sx={{ px: 2, py: 1.25, minWidth: 220 }}>
          <Typography variant='subtitle2' fontWeight={600}>{userName}</Typography>
          {session?.user?.email && (
            <Typography variant='caption' color='text.secondary'>{session.user.email}</Typography>
          )}
        </Box>
        <Divider />
        <MenuItem onClick={() => navigate('/profile')}>
          <ListItemIcon><i className='ri-user-line' /></ListItemIcon>
          个人资料
        </MenuItem>
        {hasAnyPermission(['connection.manage', 'admin.settings']) && (
          <MenuItem onClick={() => navigate('/settings')}>
            <ListItemIcon><i className='ri-settings-3-line' /></ListItemIcon>
            平台设置
          </MenuItem>
        )}
        <Divider />
        <MenuItem
          sx={{ color: 'error.main' }}
          onClick={() => {
            setUserAnchor(null)
            void signOut({ callbackUrl: '/login' })
          }}
        >
          <ListItemIcon><i className='ri-logout-box-r-line' /></ListItemIcon>
          退出登录
        </MenuItem>
      </Menu>

      <Dialog
        open={catalogOpen}
        onClose={() => setCatalogOpen(false)}
        maxWidth={false}
        slotProps={{ paper: { className: 'vcenter-classic-dialog vcenter-classic-catalog-dialog' } }}
      >
        <DialogTitle className='vcenter-classic-dialog-title'>
          <span>全部功能 · 产品页面导航</span>
          <IconButton aria-label='关闭' onClick={() => setCatalogOpen(false)}>
            <i className='ri-close-line' aria-hidden />
          </IconButton>
        </DialogTitle>
        <DialogContent className='vcenter-classic-catalog'>
          {catalogGroups.map(group => (
            <section key={group.title}>
              <h3>{group.title}</h3>
              <div>
                {group.items.map(item => (
                  <button key={item.label} type='button' onClick={() => navigate(item.href)}>
                    <span>{item.label}</span>
                  </button>
                ))}
              </div>
            </section>
          ))}
        </DialogContent>
        <DialogActions>
          <Typography component='span'>仅展示当前账号和许可证可用的项目功能。</Typography>
          <Button onClick={() => setCatalogOpen(false)}>关闭</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={coverageOpen} onClose={() => setCoverageOpen(false)} maxWidth='sm' fullWidth>
        <DialogTitle>功能覆盖核对</DialogTitle>
        <DialogContent dividers>
          <Typography paragraph>
            经典版复用 UniCenter 的真实数据、权限、许可证和操作组件，仅调整信息架构与视觉呈现。
          </Typography>
          <Box component='ul' className='vcenter-classic-coverage'>
            <li><strong>功能范围：</strong>仅展示当前项目、当前许可证和当前账号已经可用的功能。</li>
            <li><strong>权限保持：</strong>经典版与项目菜单使用同一套 RBAC、租户范围和许可证校验。</li>
            <li><strong>数据口径：</strong>首页指标、资源、告警和任务只来自现有接口；无数据时展示真实空状态。</li>
          </Box>
        </DialogContent>
        <DialogActions><Button onClick={() => setCoverageOpen(false)}>关闭</Button></DialogActions>
      </Dialog>

      <Dialog open={resetOpen} onClose={() => setResetOpen(false)} maxWidth='xs' fullWidth>
        <DialogTitle>重新加载页面</DialogTitle>
        <DialogContent>
          <Typography>确认后将完整重新加载当前页面。首页中的“刷新数据”只会重新读取仪表盘接口。</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setResetOpen(false)}>取消</Button>
          <Button variant='contained' onClick={() => window.location.reload()}>确认重新加载</Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}

export default VcenterNavbarContent
