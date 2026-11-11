'use client'

// React Imports
import { useState } from 'react'
import { useTranslations } from 'next-intl'

// MUI Imports
import Tooltip from '@mui/material/Tooltip'
import IconButton from '@mui/material/IconButton'
import Popper from '@mui/material/Popper'
import Fade from '@mui/material/Fade'
import Paper from '@mui/material/Paper'
import ClickAwayListener from '@mui/material/ClickAwayListener'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Divider from '@mui/material/Divider'

// Config Imports
import primaryColorConfig from '@configs/primaryColorConfig'
import { selectableGlobalThemes } from '@configs/globalThemesConfig'
import { themeSwitchingEnabled } from '@configs/themeConfig'
import { LogoIcon } from '@components/layout/shared/Logo'

// Hook Imports
import { useSettings } from '@core/hooks/useSettings'
import { useBranding } from '@/contexts/BrandingContext'

// Noms des thèmes pour l'affichage (réutilisé par le widget Logo du thème)
export const themeNames = {
  'primary-1': { name: 'UNICENTER', icon: 'esage-logo' },
  'primary-2': { name: 'Ocean', icon: 'ri-water-flash-fill' },
  'primary-3': { name: 'Cherry', icon: 'ri-heart-fill' },
  'primary-4': { name: 'Sunrise', icon: 'ri-sun-fill' },
  'primary-5': { name: 'Azure', icon: 'ri-cloud-fill' },
  'primary-6': { name: 'Lavender', icon: 'ri-flower-fill' },
  'primary-7': { name: 'Emerald', icon: 'ri-leaf-fill' },
  'primary-8': { name: 'Ruby', icon: 'ri-vip-diamond-fill' },
  'primary-9': { name: 'Cyan', icon: 'ri-drop-fill' },
  'primary-10': { name: 'Amber', icon: 'ri-flashlight-fill' },
  'primary-11': { name: 'Violet', icon: 'ri-magic-fill' },
  'primary-12': { name: 'Mint', icon: 'ri-seedling-fill' },
}

// Fonction pour rendre l'icône (soit UniCenter logo, soit Remix Icon)
const ThemeIcon = ({ icon, size = 14, color }) => {
  if (icon === 'esage-logo') {
    return <LogoIcon size={size} />
  }


return <i className={icon} style={{ fontSize: size, color }} />
}

const ThemeDropdown = ({ label = '', triggerClassName = '' }) => {
  // States
  const [open, setOpen] = useState(false)
  const [tooltipOpen, setTooltipOpen] = useState(false)
  const [anchorEl, setAnchorEl] = useState(null)

  // Hooks
  const { settings, updateSettings } = useSettings()
  const { branding } = useBranding()
  const t = useTranslations('navbar')
  const brandingHasPrimaryColor = !!branding.primaryColor

  if (!themeSwitchingEnabled) return null

  const handleClose = () => {
    setOpen(false)
    setAnchorEl(null)
    setTooltipOpen(false)
  }

  const handleToggle = event => {
    setOpen(prevOpen => {
      const nextOpen = !prevOpen

      setAnchorEl(nextOpen ? event.currentTarget : null)

      return nextOpen
    })
  }

  const handleModeSwitch = mode => {
    if (settings.mode !== mode) {
      updateSettings({ mode: mode })
    }
  }

  const handleColorSwitch = color => {
    if (settings.primaryColor !== color) {
      updateSettings({ primaryColor: color })
    }
  }

  const handleGlobalThemeSwitch = themeId => {
    updateSettings(
      themeId === 'vcenterClassic'
        ? { globalTheme: themeId, mode: 'light', primaryColor: '#0079B8', semiDark: false }
        : { globalTheme: themeId, mode: 'dark', primaryColor: '#2563EB', semiDark: true }
    )
    handleClose()
  }

  const getModeIcon = () => {
    if (settings.mode === 'system') {
      return 'ri-computer-line'
    } else if (settings.mode === 'dark') {
      return 'ri-moon-clear-line'
    } else {
      return 'ri-sun-line'
    }
  }

  // Trouver le thème actuel
  const currentTheme = primaryColorConfig.find(c => c.main === settings.primaryColor) || primaryColorConfig[0]

  return (
    <>
      {label ? (
        <Box component='button' type='button' className={triggerClassName} onClick={handleToggle}>
          <i className='ri-palette-line' aria-hidden />
          {label}
        </Box>
      ) : (
        <Tooltip
          title={t('theme')}
          onOpen={() => setTooltipOpen(true)}
          onClose={() => setTooltipOpen(false)}
          open={open ? false : tooltipOpen ? true : false}
        >
          <IconButton onClick={handleToggle} sx={{ color: 'text.primary' }}>
            <i className={getModeIcon()} />
          </IconButton>
        </Tooltip>
      )}
      <Popper
        open={open}
        transition
        placement='bottom-end'
        anchorEl={anchorEl}
        className='min-is-[240px] !mbs-4'
        sx={{ zIndex: 1400 }}
      >
        {({ TransitionProps, placement }) => (
          <Fade
            {...TransitionProps}
            style={{ transformOrigin: placement === 'bottom-end' ? 'right top' : 'left top' }}
          >
            <Paper
              className={settings.skin === 'bordered' ? 'border shadow-none' : 'shadow-lg'}
              elevation={8}
              sx={{ p: 2, bgcolor: 'background.paper' }}
            >
              <ClickAwayListener onClickAway={handleClose}>
                <Box>
                  <Typography variant="caption" sx={{ fontWeight: 700, opacity: 0.7, textTransform: 'uppercase', letterSpacing: 1 }}>
                    界面风格
                  </Typography>
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75, mt: 1, mb: 2 }}>
                    {selectableGlobalThemes.map(globalTheme => {
                      const selected = settings.globalTheme === globalTheme.id

                      return (
                        <Box
                          key={globalTheme.id}
                          onClick={() => handleGlobalThemeSwitch(globalTheme.id)}
                          sx={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 1.25,
                            minWidth: 210,
                            p: 1,
                            border: '1px solid',
                            borderColor: selected ? 'primary.main' : 'divider',
                            borderRadius: 1,
                            cursor: 'pointer',
                            bgcolor: selected ? 'action.selected' : 'transparent',
                            '&:hover': { bgcolor: 'action.hover' }
                          }}
                        >
                          <Box
                            sx={{
                              width: 38,
                              height: 26,
                              flexShrink: 0,
                              border: '1px solid',
                              borderColor: 'divider',
                              borderRadius: 0.5,
                              background: globalTheme.preview.cardBg,
                              boxShadow: `inset 0 -3px 0 ${globalTheme.preview.accent}`
                            }}
                          />
                          <Box sx={{ minWidth: 0, flex: 1 }}>
                            <Typography variant="body2" sx={{ fontWeight: selected ? 700 : 500 }}>
                              {globalTheme.id === 'nebula' ? 'Nebula 科技版' : 'vCenter 经典版'}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              {globalTheme.id === 'nebula' ? '深空蓝运维控制台' : '浅色企业基础设施客户端'}
                            </Typography>
                          </Box>
                          {selected && <i className='ri-check-line' />}
                        </Box>
                      )
                    })}
                  </Box>
                  <Divider sx={{ my: 1.5 }} />

                  {/* Section Mode */}
                  <Typography variant="caption" sx={{ fontWeight: 700, opacity: 0.7, textTransform: 'uppercase', letterSpacing: 1 }}>
                    Mode
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 1, mt: 1, mb: 2 }}>
                    <IconButton
                      size="small"
                      onClick={() => handleModeSwitch('light')}
                      sx={{
                        border: '2px solid',
                        borderColor: settings.mode === 'light' ? 'primary.main' : 'divider',
                        bgcolor: settings.mode === 'light' ? 'primary.lightOpacity' : 'transparent',
                        color: settings.mode === 'light' ? 'primary.main' : 'text.primary',
                        '&:hover': { bgcolor: 'action.hover' }
                      }}
                    >
                      <i className='ri-sun-line' />
                    </IconButton>
                    <IconButton
                      size="small"
                      onClick={() => handleModeSwitch('dark')}
                      sx={{
                        border: '2px solid',
                        borderColor: settings.mode === 'dark' ? 'primary.main' : 'divider',
                        bgcolor: settings.mode === 'dark' ? 'primary.lightOpacity' : 'transparent',
                        color: settings.mode === 'dark' ? 'primary.main' : 'text.primary',
                        '&:hover': { bgcolor: 'action.hover' }
                      }}
                    >
                      <i className='ri-moon-clear-line' />
                    </IconButton>
                    <IconButton
                      size="small"
                      onClick={() => handleModeSwitch('system')}
                      sx={{
                        border: '2px solid',
                        borderColor: settings.mode === 'system' ? 'primary.main' : 'divider',
                        bgcolor: settings.mode === 'system' ? 'primary.lightOpacity' : 'transparent',
                        color: settings.mode === 'system' ? 'primary.main' : 'text.primary',
                        '&:hover': { bgcolor: 'action.hover' }
                      }}
                    >
                      <i className='ri-computer-line' />
                    </IconButton>
                  </Box>

                  {!brandingHasPrimaryColor && (
                    <>
                      <Divider sx={{ my: 1.5 }} />

                      {/* Section Couleurs */}
                      <Typography variant="caption" sx={{ fontWeight: 700, opacity: 0.7, textTransform: 'uppercase', letterSpacing: 1 }}>
                        Couleur
                      </Typography>
                      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, mt: 1 }}>
                        {primaryColorConfig.map((color) => {
                          const isSelected = settings.primaryColor === color.main
                          const themeInfo = themeNames[color.name] || { name: color.name, icon: 'ri-palette-fill' }
                          const iseSage = themeInfo.icon === 'esage-logo'

                          return (
                            <Box
                              key={color.name}
                              onClick={() => handleColorSwitch(color.main)}
                              sx={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 1.5,
                                p: 1,
                                borderRadius: 1,
                                cursor: 'pointer',
                                border: '2px solid',
                                borderColor: isSelected ? color.main : 'transparent',
                                bgcolor: isSelected ? `${color.main}18` : 'transparent',
                                '&:hover': {
                                  bgcolor: `${color.main}12`,
                                },
                                transition: 'all 0.2s ease'
                              }}
                            >
                              {iseSage ? (

                                // Logo eSage sans fond rond
                                <Box
                                  sx={{
                                    width: 28,
                                    height: 28,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                  }}
                                >
                                  <ThemeIcon icon={themeInfo.icon} size={24} color={color.main} chevronColor={settings.mode === 'dark' || (settings.mode === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches) ? '#e0e0e0' : '#333'} />
                                </Box>
                              ) : (

                                // Autres thèmes avec fond rond
                                <Box
                                  sx={{
                                    width: 28,
                                    height: 28,
                                    borderRadius: '50%',
                                    bgcolor: color.main,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    color: '#fff',
                                    fontSize: 14,
                                    boxShadow: isSelected ? `0 0 0 3px ${color.main}40` : 'none',
                                    transition: 'all 0.2s ease'
                                  }}
                                >
                                  <ThemeIcon icon={themeInfo.icon} size={14} color="#fff" />
                                </Box>
                              )}
                              <Typography
                                variant="body2"
                                sx={{
                                  fontWeight: isSelected ? 700 : 500,
                                  color: isSelected ? color.main : 'text.primary'
                                }}
                              >
                                {themeInfo.name}
                              </Typography>
                              {isSelected && (
                                <i className='ri-check-line' style={{ marginLeft: 'auto', color: color.main }} />
                              )}
                            </Box>
                          )
                        })}
                      </Box>
                    </>
                  )}
                </Box>
              </ClickAwayListener>
            </Paper>
          </Fade>
        )}
      </Popper>
    </>
  )
}

export default ThemeDropdown
