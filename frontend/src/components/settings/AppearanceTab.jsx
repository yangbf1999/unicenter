'use client'

import { useState, useMemo } from 'react'
import { useTranslations } from 'next-intl'

import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Divider,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Slider,
  ToggleButton,
  ToggleButtonGroup,
  Typography
} from '@mui/material'

import { useSettings } from '@core/hooks/useSettings'
import { densityConfig, borderRadiusPresets, getGlobalTheme } from '@configs/globalThemesConfig'

/* ==================== Main AppearanceTab Component ==================== */

export default function AppearanceTab() {
  const t = useTranslations()
  const { settings, updateSettings, resetSettings } = useSettings()
  const [message, setMessage] = useState(null)

  // Get current theme config
  const currentThemeConfig = useMemo(() => {
    return getGlobalTheme(settings.globalTheme || 'default')
  }, [settings.globalTheme])

  const showMessage = (type, text) => {
    setMessage({ type, text })
    setTimeout(() => setMessage(null), 3000)
  }

  // Handlers - all changes are automatically persisted via updateSettings
  const handleLayoutChange = (e, newLayout) => {
    if (newLayout !== null) updateSettings({ layout: newLayout })
  }

  const handleDensityChange = (e, newDensity) => {
    if (newDensity !== null) {
      updateSettings({ density: newDensity })
      showMessage('success', t('settings.savedSuccess'))
    }
  }

  const handleCustomBorderRadiusChange = (e, newValue) => {
    updateSettings({ customBorderRadius: newValue })
  }

  const handleReset = () => {
    resetSettings()
    showMessage('info', t('common.reset'))
  }

  return (
    <Box>
      <Typography variant='body2' sx={{ opacity: 0.7, mb: 3 }}>
        {t('settings.appearanceDesc')}
      </Typography>

      {message && (
        <Alert severity={message.type} sx={{ mb: 3 }} onClose={() => setMessage(null)}>
          {message.text}
        </Alert>
      )}

      {/* Section: Data Refresh */}
      <Card variant='outlined' sx={{ mb: 3 }}>
        <CardContent>
          <Typography
            variant='subtitle1'
            fontWeight={700}
            sx={{ mb: 0.5, display: 'flex', alignItems: 'center', gap: 1 }}
          >
            <i
              className='ri-refresh-line'
              style={{ color: 'var(--nebula-action-link, var(--mui-palette-primary-main))' }}
            />
            {t('settings.dataRefresh')}
          </Typography>
          <Typography variant='caption' color='text.secondary' sx={{ display: 'block', mb: 2 }}>
            {t('settings.dataRefreshDescription')}
          </Typography>

          <FormControl size='small' sx={{ minWidth: 200 }}>
            <InputLabel>{t('settings.dataRefresh')}</InputLabel>
            <Select
              value={settings.refreshInterval ?? 30}
              label={t('settings.dataRefresh')}
              onChange={e => {
                updateSettings({ refreshInterval: e.target.value })
                showMessage('success', t('settings.savedSuccess'))
              }}
            >
              <MenuItem value={5}>5s</MenuItem>
              <MenuItem value={10}>10s</MenuItem>
              <MenuItem value={30}>30s {t('settings.refreshDefault')}</MenuItem>
              <MenuItem value={60}>1 min</MenuItem>
              <MenuItem value={300}>5 min</MenuItem>
              <MenuItem value={0}>{t('settings.refreshOff')}</MenuItem>
            </Select>
          </FormControl>
        </CardContent>
      </Card>

      {/* Section: Interface Details */}
      <Card variant='outlined' sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant='subtitle1' fontWeight={700} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <i
              className='ri-settings-4-line'
              style={{ color: 'var(--nebula-action-link, var(--mui-palette-primary-main))' }}
            />
            {t('settings.interfaceDetails')}
          </Typography>

          <Box sx={{ mt: 3 }}>
            {/* Taille de police */}
            <Box sx={{ mb: 3 }}>
              <Typography
                variant='body2'
                fontWeight={500}
                sx={{ mb: 1.5, display: 'flex', alignItems: 'center', gap: 1 }}
              >
                <i className='ri-font-size' style={{ fontSize: 16 }} />
                {t('settings.fontSize')}
              </Typography>
              <Box sx={{ px: 1 }}>
                <Slider
                  value={settings.fontSize ?? 14}
                  onChange={(e, v) => updateSettings({ fontSize: v })}
                  min={12}
                  max={18}
                  step={1}
                  marks={[
                    { value: 12, label: '12' },
                    { value: 14, label: '14' },
                    { value: 16, label: '16' },
                    { value: 18, label: '18' }
                  ]}
                  valueLabelDisplay='auto'
                  valueLabelFormat={v => `${v}px`}
                />
              </Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 1 }}>
                <Typography variant='caption' color='text.secondary'>
                  {t('settings.fontSizeSmall')}
                </Typography>
                <Typography variant='caption' color='text.secondary'>
                  {t('settings.fontSizeLarge')}
                </Typography>
              </Box>
            </Box>

            <Divider sx={{ my: 2 }} />

            {/* UI Scale */}
            <Box sx={{ mb: 3 }}>
              <Typography
                variant='body2'
                fontWeight={500}
                sx={{ mb: 1.5, display: 'flex', alignItems: 'center', gap: 1 }}
              >
                <i className='ri-aspect-ratio-line' style={{ fontSize: 16 }} />
                {t('settings.uiScale')}
              </Typography>
              <Box sx={{ px: 1 }}>
                <Slider
                  value={settings.uiScale ?? 100}
                  onChange={(e, v) => updateSettings({ uiScale: v })}
                  min={80}
                  max={120}
                  step={5}
                  marks={[
                    { value: 80, label: '80%' },
                    { value: 100, label: '100%' },
                    { value: 120, label: '120%' }
                  ]}
                  valueLabelDisplay='auto'
                  valueLabelFormat={v => `${v}%`}
                />
              </Box>
              <Typography variant='caption' color='text.secondary'>
                {t('settings.uiScaleDesc')}
              </Typography>
            </Box>

            <Divider sx={{ my: 2 }} />

            {/* Density */}
            <Box sx={{ mb: 3 }}>
              <Typography variant='body2' fontWeight={500} sx={{ mb: 1.5 }}>
                {t('settings.interfaceDensity')}
              </Typography>
              <ToggleButtonGroup
                value={settings.density || 'comfortable'}
                exclusive
                onChange={handleDensityChange}
                size='small'
              >
                {Object.entries(densityConfig).map(([key, config]) => (
                  <ToggleButton key={key} value={key} sx={{ px: 2 }}>
                    <Typography variant='caption' fontWeight={500}>
                      {t(config.labelKey)}
                    </Typography>
                  </ToggleButton>
                ))}
              </ToggleButtonGroup>
              <Typography variant='caption' color='text.secondary' sx={{ display: 'block', mt: 1 }}>
                {t(densityConfig[settings.density || 'comfortable']?.descriptionKey)}
              </Typography>
            </Box>

            <Divider sx={{ my: 2 }} />

            {/* Border radius */}
            <Box sx={{ mb: 3 }}>
              <Typography variant='body2' fontWeight={500} sx={{ mb: 1.5 }}>
                {t('settings.borderRadiusGlobal')}
              </Typography>
              <Box sx={{ px: 1 }}>
                <Slider
                  value={settings.customBorderRadius ?? currentThemeConfig.styles.card.borderRadius}
                  onChange={handleCustomBorderRadiusChange}
                  min={0}
                  max={24}
                  step={1}
                  marks={borderRadiusPresets.map(p => ({
                    value: p.value,
                    label: p.value === 0 || p.value === 24 ? `${p.value}px` : ''
                  }))}
                  valueLabelDisplay='auto'
                  valueLabelFormat={v => `${v}px`}
                />
              </Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 1 }}>
                <Typography variant='caption' color='text.secondary'>
                  {t('settings.borderRadiusSquare')}
                </Typography>
                <Typography variant='caption' color='text.secondary'>
                  {t('settings.borderRadiusRounded')}
                </Typography>
              </Box>
            </Box>
          </Box>
        </CardContent>
      </Card>

      {/* Section: Disposition */}
      <Card variant='outlined' sx={{ mb: 3 }}>
        <CardContent>
          <Typography
            variant='subtitle1'
            fontWeight={700}
            sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}
          >
            <i
              className='ri-layout-line'
              style={{ color: 'var(--nebula-action-link, var(--mui-palette-primary-main))' }}
            />
            {t('settings.layout')}
          </Typography>

          <Box sx={{ mb: 2 }}>
            <Typography variant='body2' sx={{ mb: 1 }}>
              {t('settings.sidebarMenu')}
            </Typography>
            <ToggleButtonGroup value={settings.layout} exclusive onChange={handleLayoutChange} size='small'>
              <ToggleButton value='vertical'>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <i className='ri-layout-left-line' />
                  <span>{t('settings.expanded')}</span>
                </Box>
              </ToggleButton>
              <ToggleButton value='collapsed'>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <i className='ri-layout-left-2-line' />
                  <span>{t('settings.collapsed')}</span>
                </Box>
              </ToggleButton>
              <ToggleButton value='horizontal'>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <i className='ri-layout-top-line' />
                  <span>{t('settings.horizontal')}</span>
                </Box>
              </ToggleButton>
            </ToggleButtonGroup>
          </Box>
        </CardContent>
      </Card>

      {/* Reset */}
      <Card variant='outlined'>
        <CardContent sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box>
            <Typography variant='body2' fontWeight={500}>
              {t('settings.resetSettings')}
            </Typography>
            <Typography variant='caption' color='text.secondary'>
              {t('settings.resetSettingsDesc')}
            </Typography>
          </Box>
          <Button
            variant='outlined'
            color='error'
            size='small'
            startIcon={<i className='ri-refresh-line' />}
            onClick={handleReset}
          >
            {t('common.reset')}
          </Button>
        </CardContent>
      </Card>
    </Box>
  )
}
