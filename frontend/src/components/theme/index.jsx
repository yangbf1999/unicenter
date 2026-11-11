'use client'

// React Imports
import { useMemo } from 'react'

// MUI Imports
import { deepmerge } from '@mui/utils'
import { ThemeProvider, lighten, darken, createTheme } from '@mui/material/styles'
import { AppRouterCacheProvider } from '@mui/material-nextjs/v14-appRouter'
import CssBaseline from '@mui/material/CssBaseline'
import GlobalStyles from '@mui/material/GlobalStyles'

// Third-party Imports
import stylisRTLPlugin from 'stylis-plugin-rtl'

// Component Imports
import ModeChanger from './ModeChanger'

// Config Imports
import { lockedMuiModeStorageKey, lockedThemeSettings } from '@configs/themeConfig'
import globalThemesConfig, { getGlobalTheme, densityConfig, transitionConfig } from '@configs/globalThemesConfig'
import lightBackgroundConfig, { getLightBackground } from '@configs/lightBackgroundConfig'
import nebulaTokens from '@configs/nebula.tokens.json'
import { nebulaInteractionStyles } from '@/lib/theme/nebulaInteractionStyles'
import { createNebulaMetricStyles } from '@/lib/theme/nebulaMetricStyles'

// Hook Imports
import { useSettings } from '@core/hooks/useSettings'

// Core Theme Imports
import defaultCoreTheme from '@core/theme'

const createNebulaPalette = (mode, primaryColor) => {
  const colors = nebulaTokens.color[mode] || nebulaTokens.color.dark
  const { action, brand } = nebulaTokens.color
  const { bg, border, status, text } = colors
  const statusContrast = mode === 'dark' ? bg.canvas : action.onPrimary
  const errorMain = mode === 'dark' ? status.error.foreground : action.danger
  const errorContrast = mode === 'dark' ? bg.canvas : action.onPrimary

  return {
    primary: {
      main: primaryColor,
      light: lighten(primaryColor, 0.2),
      dark: darken(primaryColor, 0.1),
      contrastText: action.onPrimary
    },
    secondary: {
      main: brand.violet,
      light: lighten(brand.violet, 0.2),
      dark: darken(brand.violet, 0.1),
      contrastText: action.onPrimary
    },
    error: {
      main: errorMain,
      light: status.error.foreground,
      dark: darken(errorMain, 0.1),
      contrastText: errorContrast
    },
    warning: {
      main: status.warning.foreground,
      light: lighten(status.warning.foreground, 0.12),
      dark: darken(status.warning.foreground, 0.16),
      contrastText: statusContrast
    },
    info: {
      main: status.info.foreground,
      light: lighten(status.info.foreground, 0.12),
      dark: darken(status.info.foreground, 0.16),
      contrastText: statusContrast
    },
    success: {
      main: status.success.foreground,
      light: lighten(status.success.foreground, 0.12),
      dark: darken(status.success.foreground, 0.16),
      contrastText: statusContrast
    },
    background: {
      default: bg.canvas,
      paper: bg.surface
    },
    text: {
      primary: text.primary,
      secondary: text.secondary,
      disabled: text.disabled,
      muted: text.muted
    },
    brand: {
      blue: brand.blue,
      cyan: brand.cyan,
      violet: brand.violet
    },
    link: {
      main: colors.link
    },
    status,
    divider: border.subtle,
    action: {
      active: text.secondary,
      hover: bg.hover,
      selected: bg.selected,
      focus: bg.selected,
      disabled: text.disabled,
      disabledBackground: status.neutral.background,
      disabledOpacity: 1
    },
    Tooltip: {
      bg: bg.elevated
    },
    TableCell: {
      border: border.subtle
    },
    customColors: {
      bodyBg: bg.canvas,
      chatBg: bg.surface,
      greyLightBg: bg.hover,
      inputBorder: border.control,
      tableHeaderBg: bg.elevated,
      tooltipText: text.primary,
      trackBg: status.neutral.background
    }
  }
}

const createVcenterPalette = mode => {
  const dark = mode === 'dark'

  return {
    primary: {
      main: dark ? '#53B6E8' : '#0079B8',
      light: dark ? '#79C8EE' : '#3294C8',
      dark: dark ? '#3294C8' : '#00669D',
      contrastText: '#FFFFFF'
    },
    secondary: {
      main: dark ? '#B4C3CD' : '#637785',
      contrastText: dark ? '#17232D' : '#FFFFFF'
    },
    error: {
      main: dark ? '#F08B81' : '#B23427'
    },
    warning: {
      main: dark ? '#E1B75E' : '#A86B00'
    },
    info: {
      main: dark ? '#53B6E8' : '#0079B8'
    },
    success: {
      main: dark ? '#77C868' : '#348322'
    },
    background: {
      default: dark ? '#17232D' : '#FFFFFF',
      paper: dark ? '#223542' : '#FFFFFF'
    },
    text: {
      primary: dark ? '#E7EEF3' : '#293741',
      secondary: dark ? '#B4C3CD' : '#637785',
      disabled: dark ? '#728A99' : '#98ACB9'
    },
    divider: dark ? '#435866' : '#D5DCE2',
    action: {
      active: dark ? '#B4C3CD' : '#637785',
      hover: dark ? '#244C63' : '#E8F0F5',
      selected: dark ? '#244C63' : '#DCEEF7',
      focus: dark ? '#244C63' : '#DCEEF7',
      disabled: dark ? '#728A99' : '#98ACB9',
      disabledBackground: dark ? '#1D303C' : '#F4F6F8'
    },
    Tooltip: {
      bg: dark ? '#1D303C' : '#293741'
    },
    TableCell: {
      border: dark ? '#435866' : '#D5DCE2'
    },
    customColors: {
      bodyBg: dark ? '#17232D' : '#FFFFFF',
      chatBg: dark ? '#223542' : '#FFFFFF',
      greyLightBg: dark ? '#1D303C' : '#F4F6F8',
      inputBorder: dark ? '#728A99' : '#98ACB9',
      tableHeaderBg: dark ? '#1D303C' : '#F4F6F8',
      tooltipText: '#FFFFFF',
      trackBg: dark ? '#1D303C' : '#E9EDF1'
    }
  }
}

const createNebulaGlobalStyles = mode => ({
  'html, body': {
    backgroundColor: 'var(--nebula-bg-canvas)',
    color: 'var(--nebula-text-primary)',
    colorScheme: mode
  },
  body: {
    fontFamily: 'var(--nebula-font-family)',
    fontSize: 'var(--nebula-font-size-body)',
    lineHeight: 'var(--nebula-line-height-body)'
  },
  'body::before': {
    height: '360px',
    background:
      'radial-gradient(circle at 78% 0%, rgb(var(--mui-palette-primary-mainChannel) / 0.12), transparent 44%), radial-gradient(circle at 24% 12%, color-mix(in srgb, var(--nebula-brand-violet) 8%, transparent), transparent 38%)',
    opacity: 1
  },
  'main, .ts-vertical-layout-content, .ts-horizontal-layout-content': {
    backgroundColor: 'var(--nebula-bg-canvas)',
    color: 'var(--nebula-text-primary)'
  },
  '.ts-vertical-nav-root .ts-menu-button': {
    borderInlineStart: '3px solid transparent',
    borderStartEndRadius: 'var(--nebula-radius-control) !important',
    borderEndEndRadius: 'var(--nebula-radius-control) !important'
  },
  '.ts-vertical-nav-root .ts-menuitem-root > .ts-menu-button:hover, .ts-vertical-nav-root .ts-submenu-root > .ts-menu-button:hover': {
    color: 'var(--nebula-text-primary) !important',
    backgroundColor: 'var(--nebula-bg-elevated) !important',
    backgroundImage: 'none !important'
  },
  '.ts-vertical-nav-root .ts-menuitem-root.ts-active > .ts-menu-button, .ts-vertical-nav-root .ts-submenu-root.ts-active > .ts-menu-button': {
    color: 'var(--nebula-text-primary) !important',
    backgroundColor: mode === 'dark' ? 'transparent !important' : 'var(--nebula-bg-selected) !important',
    backgroundImage: mode === 'dark' ? `${nebulaTokens.gradient.navigationActive} !important` : 'none !important',
    boxShadow: mode === 'dark' ? 'inset 8px 0 16px #2563eb1a, 0 0 16px #3b82f638' : 'none',
    borderInlineStartColor: 'var(--nebula-brand-blue) !important'
  },
  '.ts-vertical-nav-root .ts-menuitem-root.ts-active > .ts-menu-button .ts-menu-icon, .ts-vertical-nav-root .ts-submenu-root.ts-active > .ts-menu-button .ts-menu-icon': {
    color: 'var(--nebula-brand-blue) !important',
    filter: mode === 'dark' ? 'drop-shadow(0 0 6px #06b6d47a)' : 'none'
  },
  'a, .MuiLink-root': {
    color: 'var(--nebula-action-link)'
  },
  '.MuiPaper-root': {
    color: 'var(--nebula-text-primary)',
    backgroundColor: 'var(--nebula-bg-surface)',
    backgroundImage: 'none'
  },
  '.MuiCard-root': {
    backgroundColor: 'var(--nebula-bg-surface)',
    border: '1px solid var(--nebula-border-subtle)',
    boxShadow: 'var(--nebula-shadow-panel)'
  },
  '.MuiCardHeader-root, .MuiCardContent-root, .MuiCardActions-root': {
    color: 'inherit'
  },
  '.MuiDivider-root': {
    borderColor: 'var(--nebula-border-subtle)'
  },
  '.MuiButton-root': {
    minHeight: 'var(--nebula-control-height)',
    fontWeight: 500
  },
  '.MuiButton-root.MuiButton-sizeSmall': {
    minHeight: 'var(--nebula-control-height-compact)'
  },
  '.MuiButton-root.MuiButton-containedPrimary:not(.Mui-disabled)': {
    color: 'var(--mui-palette-primary-contrastText)',
    backgroundColor: 'var(--mui-palette-primary-main)',
    backgroundImage: mode === 'dark' ? nebulaTokens.gradient.primary : 'none',
    boxShadow: mode === 'dark' ? '0 0 18px #3b82f63d, inset 0 1px 0 #ffffff2e' : 'none'
  },
  '.MuiButton-root.MuiButton-containedPrimary:not(.Mui-disabled):hover': {
    backgroundColor: 'var(--mui-palette-primary-dark)',
    backgroundImage: mode === 'dark' ? nebulaTokens.gradient.primaryHover : 'none',
    boxShadow: mode === 'dark' ? '0 0 22px #3b82f657, inset 0 1px #ffffff38' : 'none'
  },
  '.MuiButton-root.MuiButton-containedPrimary:not(.Mui-disabled):active': {
    backgroundColor: 'var(--mui-palette-primary-dark)',
    backgroundImage: mode === 'dark' ? nebulaTokens.gradient.primary : 'none',
    boxShadow: mode === 'dark' ? 'inset 0 2px 4px rgb(0 0 0 / 25%)' : 'none'
  },
  '.MuiButton-root.MuiButton-outlinedPrimary:not(.Mui-disabled)': {
    color: 'var(--nebula-action-link)',
    borderColor: 'var(--nebula-border-control)',
    backgroundColor: 'transparent',
    boxShadow: 'none'
  },
  '.MuiButton-root.MuiButton-textPrimary:not(.Mui-disabled)': {
    color: 'var(--nebula-action-link)'
  },
  '.MuiButton-root.MuiButton-outlinedPrimary:not(.Mui-disabled):hover, .MuiButton-root.MuiButton-textPrimary:not(.Mui-disabled):hover': {
    color: 'var(--nebula-action-link)',
    backgroundColor: 'var(--nebula-bg-hover)',
    borderColor: 'var(--nebula-action-link)'
  },
  '.MuiButton-root.MuiButton-outlinedPrimary:not(.Mui-disabled):active, .MuiButton-root.MuiButton-textPrimary:not(.Mui-disabled):active': {
    backgroundColor: 'var(--nebula-bg-selected)'
  },
  '.MuiButton-root.Mui-disabled': {
    color: 'var(--nebula-text-disabled)',
    boxShadow: 'none'
  },
  '.MuiOutlinedInput-root, .MuiFilledInput-root, .MuiInput-root': {
    color: 'var(--nebula-text-primary)',
    backgroundColor: 'var(--nebula-bg-input)'
  },
  '.MuiOutlinedInput-root:not(.MuiInputBase-multiline)': {
    minHeight: 'var(--nebula-control-height)'
  },
  '.MuiOutlinedInput-root.MuiInputBase-sizeSmall:not(.MuiInputBase-multiline)': {
    minHeight: 'var(--nebula-control-height-compact)'
  },
  '.MuiOutlinedInput-root .MuiOutlinedInput-notchedOutline': {
    borderColor: 'var(--nebula-border-control)'
  },
  '.MuiOutlinedInput-root:hover .MuiOutlinedInput-notchedOutline': {
    borderColor: 'var(--mui-palette-primary-light)'
  },
  '.MuiOutlinedInput-root.Mui-focused .MuiOutlinedInput-notchedOutline': {
    borderColor: 'var(--mui-palette-primary-light)'
  },
  '.MuiInputLabel-root, .MuiFormHelperText-root': {
    color: 'var(--nebula-text-secondary)'
  },
  '.MuiInputLabel-root.Mui-focused:not(.Mui-error):not(.Mui-disabled)': {
    color: 'var(--nebula-action-link)'
  },
  '.MuiInputLabel-root.Mui-disabled, .MuiFormHelperText-root.Mui-disabled, .MuiInputBase-input.Mui-disabled': {
    color: 'var(--nebula-text-disabled)',
    WebkitTextFillColor: 'var(--nebula-text-disabled)'
  },
  '.MuiTableContainer-root': {
    backgroundColor: 'var(--nebula-bg-surface)'
  },
  '.MuiTableHead-root .MuiTableCell-root': {
    height: 'var(--nebula-table-header-height)',
    color: 'var(--nebula-text-secondary)',
    backgroundColor: 'var(--nebula-bg-elevated)',
    borderColor: 'var(--nebula-border-subtle)',
    fontSize: 'var(--nebula-font-size-table)',
    lineHeight: 'var(--nebula-line-height-table)',
    fontWeight: 600
  },
  '.MuiTableBody-root .MuiTableRow-root': {
    height: 'var(--nebula-table-row-height)',
    backgroundColor: 'var(--nebula-bg-surface)'
  },
  '.MuiTableBody-root .MuiTableRow-root:hover': {
    backgroundColor: 'var(--nebula-bg-hover)'
  },
  '.MuiTableBody-root .MuiTableRow-root.Mui-selected, .MuiTableBody-root .MuiTableRow-root.Mui-selected:hover': {
    backgroundColor: 'var(--nebula-bg-selected)'
  },
  '.MuiTableBody-root .MuiTableCell-root': {
    color: 'var(--nebula-text-primary)',
    borderColor: 'var(--nebula-border-subtle)',
    fontSize: 'var(--nebula-font-size-table)',
    lineHeight: 'var(--nebula-line-height-table)'
  },
  '.MuiDataGrid-root': {
    color: 'var(--nebula-text-primary)',
    backgroundColor: 'var(--nebula-bg-surface)',
    borderColor: 'var(--nebula-border-subtle)'
  },
  '.MuiDataGrid-columnHeaders, .MuiDataGrid-columnHeader': {
    minHeight: 'var(--nebula-table-header-height)',
    color: 'var(--nebula-text-secondary)',
    backgroundColor: 'var(--nebula-bg-elevated)'
  },
  '.MuiDataGrid-row': {
    minHeight: 'var(--nebula-table-row-height)',
    borderColor: 'var(--nebula-border-subtle)'
  },
  '.MuiDataGrid-row:hover': {
    backgroundColor: 'var(--nebula-bg-hover)'
  },
  '.MuiDataGrid-row.Mui-selected, .MuiDataGrid-row.Mui-selected:hover': {
    backgroundColor: 'var(--nebula-bg-selected)'
  },
  '.MuiTabs-root': {
    minHeight: '44px',
    borderColor: 'var(--nebula-border-subtle)'
  },
  '.MuiTabs-root .MuiTab-root:not(.Mui-disabled)': {
    minHeight: '44px',
    color: 'var(--nebula-text-secondary)',
    fontWeight: 400
  },
  '.MuiTabs-root .MuiTab-root:not(.Mui-disabled):hover': {
    color: 'var(--nebula-text-primary)',
    backgroundColor: 'var(--nebula-bg-hover)'
  },
  '.MuiTabs-root .MuiTab-root.Mui-selected:not(.Mui-disabled), .MuiTabs-root .MuiTab-root.Mui-selected:not(.Mui-disabled):hover': {
    color: 'var(--nebula-action-link)',
    fontWeight: 500
  },
  '.MuiTabs-root .MuiTab-root:not(.Mui-disabled) .MuiTab-icon': {
    color: 'inherit'
  },
  '.MuiTabs-indicator': {
    height: '2px',
    backgroundColor: 'var(--mui-palette-primary-main)'
  },
  ...createNebulaMetricStyles(mode),
  '.MuiMenu-paper, .MuiPopover-paper, .MuiAutocomplete-paper, .MuiDialog-paper, .MuiDrawer-paper, .MuiPickersPopper-paper, .MuiPickersLayout-root, .MuiSnackbarContent-root': {
    color: 'var(--nebula-text-primary)',
    backgroundColor: 'var(--nebula-bg-elevated)',
    backgroundImage: 'none',
    border: '1px solid var(--nebula-border-subtle)',
    boxShadow: 'var(--nebula-shadow-elevated) !important'
  },
  '.MuiBackdrop-root': {
    backgroundColor: 'color-mix(in srgb, var(--nebula-bg-canvas) 72%, transparent)'
  },
  '.MuiDialog-paper': {
    borderRadius: 'var(--nebula-radius-dialog)'
  },
  '.MuiDrawer-paper': {
    borderColor: 'var(--nebula-border-subtle)'
  },
  '.MuiMenuItem-root:hover, .MuiMenuItem-root.Mui-selected, .MuiAutocomplete-option[aria-selected="true"]': {
    backgroundColor: 'var(--nebula-bg-hover)'
  },
  '.MuiMenuItem-root.Mui-selected, .MuiAutocomplete-option[aria-selected="true"]': {
    backgroundColor: 'var(--nebula-bg-selected)'
  },
  '.MuiTooltip-tooltip': {
    color: 'var(--nebula-text-primary)',
    backgroundColor: 'var(--nebula-bg-elevated)',
    border: '1px solid var(--nebula-border-subtle)',
    boxShadow: 'var(--nebula-shadow-elevated)'
  },
  '.MuiChip-root': {
    color: 'var(--nebula-status-neutral)',
    backgroundColor: 'var(--nebula-status-neutral-bg)',
    borderColor: 'var(--nebula-border-subtle)'
  },
  '.MuiChip-root.MuiChip-colorSuccess': {
    color: 'var(--nebula-status-success)',
    backgroundColor: 'var(--nebula-status-success-bg)'
  },
  '.MuiChip-root.MuiChip-colorInfo': {
    color: 'var(--nebula-status-info)',
    backgroundColor: 'var(--nebula-status-info-bg)'
  },
  '.MuiChip-root.MuiChip-colorWarning': {
    color: 'var(--nebula-status-warning)',
    backgroundColor: 'var(--nebula-status-warning-bg)'
  },
  '.MuiChip-root.MuiChip-colorError': {
    color: 'var(--nebula-status-error)',
    backgroundColor: 'var(--nebula-status-error-bg)'
  },
  ':where(a, button, input, textarea, select, [tabindex]):not(.MuiInputBase-input):focus-visible, .MuiButtonBase-root.Mui-focusVisible, .MuiDataGrid-cell:focus-visible, .MuiDataGrid-columnHeader:focus-visible': {
    outline: '2px solid var(--nebula-border-focus)',
    outlineOffset: '2px'
  },
  '*': {
    scrollbarColor: 'var(--nebula-border-control) var(--nebula-bg-canvas)',
    scrollbarWidth: 'thin'
  },
  '*::-webkit-scrollbar': {
    width: '8px',
    height: '8px'
  },
  '*::-webkit-scrollbar-track': {
    backgroundColor: 'var(--nebula-bg-canvas)'
  },
  '*::-webkit-scrollbar-thumb': {
    backgroundColor: 'var(--nebula-border-control)',
    border: '2px solid var(--nebula-bg-canvas)',
    borderRadius: '999px'
  },
  '*::-webkit-scrollbar-thumb:hover': {
    backgroundColor: 'var(--mui-palette-primary-main)'
  },
  ...nebulaInteractionStyles,
  '@media (prefers-reduced-motion: reduce)': {
    ...createNebulaMetricStyles(mode)['@media (prefers-reduced-motion: reduce)'],
    '*, *::before, *::after': {
      animationDuration: '0.01ms !important',
      animationIterationCount: '1 !important',
      scrollBehavior: 'auto !important',
      transitionDelay: '0ms !important',
      transitionDuration: '0.01ms !important'
    }
  }
})

const createVcenterGlobalStyles = mode => ({
  'html, body': {
    colorScheme: mode,
    color: 'var(--vcenter-text)',
    backgroundColor: 'var(--vcenter-canvas)',
    overflowX: 'hidden'
  },
  body: {
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", "Microsoft YaHei", sans-serif',
    fontSize: '13px',
    lineHeight: 1.5
  },
  'body::before': {
    display: 'none'
  },
  'main, .ts-vertical-layout-content, .ts-horizontal-layout-content': {
    color: 'var(--vcenter-text)',
    backgroundColor: 'var(--vcenter-canvas) !important'
  },
  '.ts-vertical-layout-header, .ts-horizontal-layout-header': {
    minHeight: '57px',
    color: '#FFFFFF',
    backgroundColor: 'var(--vcenter-header) !important',
    borderBottom: '1px solid color-mix(in srgb, var(--vcenter-header) 72%, white) !important',
    boxShadow: 'none !important',
    '& *': {
      color: 'inherit'
    },
    '& .MuiIconButton-root': {
      color: '#FFFFFF'
    },
    '& .MuiTypography-root': {
      color: '#FFFFFF'
    }
  },
  '.ts-vertical-layout-navbar, .ts-horizontal-layout-navbar': {
    color: '#FFFFFF',
    backgroundColor: 'var(--vcenter-header) !important'
  },
  '.ts-vertical-nav-root, .ts-vertical-nav-container, .ts-vertical-nav-bg-color-container': {
    backgroundColor: 'var(--vcenter-navigation) !important',
    borderColor: 'var(--vcenter-border) !important'
  },
  '.ts-vertical-nav-root .ts-menu-root': {
    paddingBlock: '9px !important'
  },
  '.ts-vertical-nav-root .ts-menuitem-root, .ts-vertical-nav-root .ts-submenu-root': {
    marginBlockStart: '0 !important'
  },
  '.ts-vertical-nav-root .ts-menu-button': {
    minHeight: '32px',
    paddingBlock: '7px !important',
    paddingInlineStart: '14px !important',
    paddingInlineEnd: '12px !important',
    color: 'var(--vcenter-text) !important',
    borderInlineStart: '3px solid transparent',
    borderRadius: '0 !important'
  },
  '.ts-vertical-nav-root .ts-submenu-root': {
    paddingBlock: '3px',
    borderBottom: '1px solid #E2E7EB'
  },
  '.ts-vertical-nav-root .ts-submenu-root > .ts-menu-button': {
    minHeight: '38px',
    color: 'var(--vcenter-text-secondary) !important',
    fontSize: '12px'
  },
  '.ts-vertical-nav-root .ts-submenu-content .ts-menu-button': {
    paddingInlineStart: '30px !important',
    fontSize: '12px'
  },
  '.ts-vertical-nav-root .ts-menu-icon, .ts-vertical-nav-root .ts-menu-section-label': {
    color: 'var(--vcenter-text-secondary) !important'
  },
  '.ts-vertical-nav-root .ts-menuitem-root > .ts-menu-button:hover, .ts-vertical-nav-root .ts-submenu-root > .ts-menu-button:hover': {
    color: 'var(--vcenter-accent) !important',
    backgroundColor: 'var(--vcenter-selected) !important',
    backgroundImage: 'none !important'
  },
  '.ts-vertical-nav-root .ts-menuitem-root.ts-active > .ts-menu-button, .ts-vertical-nav-root .ts-submenu-root.ts-active > .ts-menu-button': {
    color: 'var(--vcenter-accent) !important',
    backgroundColor: 'var(--vcenter-selected) !important',
    backgroundImage: 'none !important',
    borderInlineStartColor: 'var(--vcenter-accent) !important'
  },
  'h1, h2, .MuiTypography-h1, .MuiTypography-h2': {
    fontWeight: '400 !important'
  },
  '.MuiPaper-root': {
    color: 'var(--vcenter-text)',
    backgroundColor: 'var(--vcenter-surface)',
    backgroundImage: 'none'
  },
  '.MuiCard-root': {
    color: 'var(--vcenter-text)',
    backgroundColor: 'var(--vcenter-surface) !important',
    border: '1px solid var(--vcenter-border) !important',
    borderRadius: '2px !important',
    boxShadow: 'none !important'
  },
  '.MuiCardHeader-root': {
    backgroundColor: 'var(--vcenter-surface-alt)',
    borderBottom: '1px solid var(--vcenter-border)'
  },
  '.MuiDivider-root': {
    borderColor: 'var(--vcenter-border)'
  },
  '.MuiButton-root': {
    minHeight: '32px',
    borderRadius: '2px !important',
    boxShadow: 'none !important',
    fontSize: '12px'
  },
  '.MuiButton-outlined': {
    color: 'var(--vcenter-accent)',
    backgroundColor: 'var(--vcenter-surface)',
    borderColor: 'var(--vcenter-border-control)'
  },
  '.MuiButton-outlined:hover': {
    color: 'var(--vcenter-accent-hover)',
    backgroundColor: 'var(--vcenter-selected)',
    borderColor: 'var(--vcenter-accent)'
  },
  '.MuiButton-containedPrimary': {
    color: '#FFFFFF',
    backgroundColor: 'var(--vcenter-accent) !important'
  },
  '.MuiButton-containedPrimary:hover': {
    backgroundColor: 'var(--vcenter-accent-hover) !important'
  },
  '.MuiOutlinedInput-root, .MuiFilledInput-root, .MuiInput-root': {
    minHeight: '32px',
    color: 'var(--vcenter-text)',
    backgroundColor: 'var(--vcenter-surface) !important',
    borderRadius: '1px !important'
  },
  '.MuiOutlinedInput-root .MuiOutlinedInput-notchedOutline': {
    borderColor: 'var(--vcenter-border-control) !important'
  },
  '.MuiOutlinedInput-root:hover .MuiOutlinedInput-notchedOutline, .MuiOutlinedInput-root.Mui-focused .MuiOutlinedInput-notchedOutline': {
    borderColor: 'var(--vcenter-accent) !important'
  },
  '.MuiInputLabel-root, .MuiFormHelperText-root': {
    color: 'var(--vcenter-text-secondary)'
  },
  '.MuiTableContainer-root': {
    backgroundColor: 'var(--vcenter-surface)'
  },
  '.MuiTableHead-root .MuiTableCell-root': {
    padding: '9px 11px',
    color: 'var(--vcenter-text-secondary)',
    backgroundColor: 'var(--vcenter-surface-alt) !important',
    borderColor: '#E0E6EB',
    fontSize: '12px',
    fontWeight: 500
  },
  '.MuiTableBody-root .MuiTableRow-root': {
    backgroundColor: 'var(--vcenter-surface)'
  },
  '.MuiTableBody-root .MuiTableRow-root:hover': {
    backgroundColor: 'var(--vcenter-selected)'
  },
  '.MuiTableBody-root .MuiTableCell-root': {
    padding: '9px 11px',
    color: 'var(--vcenter-text)',
    borderColor: '#E0E6EB',
    fontSize: '12px'
  },
  '.MuiDataGrid-root': {
    color: 'var(--vcenter-text)',
    backgroundColor: 'var(--vcenter-surface)',
    borderColor: 'var(--vcenter-border)',
    borderRadius: '2px'
  },
  '.MuiDataGrid-columnHeaders, .MuiDataGrid-columnHeader': {
    color: 'var(--vcenter-text-secondary)',
    backgroundColor: 'var(--vcenter-surface-alt) !important'
  },
  '.MuiDataGrid-row:hover, .MuiDataGrid-row.Mui-selected, .MuiDataGrid-row.Mui-selected:hover': {
    backgroundColor: 'var(--vcenter-selected) !important'
  },
  '.MuiTabs-root': {
    minHeight: '38px',
    borderBottom: '1px solid var(--vcenter-border)'
  },
  '.MuiTab-root': {
    minHeight: '38px',
    color: 'var(--vcenter-text-secondary)',
    fontSize: '12px',
    fontWeight: 400
  },
  '.MuiTab-root.Mui-selected': {
    color: 'var(--vcenter-accent)',
    fontWeight: 500
  },
  '.MuiTabs-indicator': {
    height: '3px',
    backgroundColor: 'var(--vcenter-accent)'
  },
  '.MuiMenu-paper, .MuiPopover-paper, .MuiAutocomplete-paper, .MuiDialog-paper, .MuiDrawer-paper, .MuiPickersPopper-paper, .MuiPickersLayout-root, .MuiSnackbarContent-root': {
    color: 'var(--vcenter-text)',
    backgroundColor: 'var(--vcenter-surface)',
    backgroundImage: 'none',
    border: '1px solid var(--vcenter-border)',
    borderRadius: '2px !important',
    boxShadow: '0 15px 45px rgb(0 0 0 / 27%) !important'
  },
  '.MuiDialog-paper': {
    margin: '0 !important',
    outline: 'none'
  },
  '.MuiDialog-container': {
    alignItems: 'flex-start !important',
    boxSizing: 'border-box',
    padding: '42px 20px'
  },
  '.MuiBackdrop-root': {
    backgroundColor: 'rgb(18 49 74 / 60%) !important'
  },
  '.MuiDialogTitle-root': {
    minHeight: '0',
    padding: '17px 23px !important',
    fontSize: '17px !important',
    fontWeight: '500 !important',
    lineHeight: '1.5 !important',
    borderBottom: '1px solid var(--vcenter-border) !important'
  },
  '.MuiDialogContent-root': {
    padding: '19px 22px'
  },
  '.MuiDialogContent-root.MuiDialogContent-dividers': {
    borderTop: 0,
    borderBottom: 0
  },
  '.MuiDialogActions-root': {
    gap: '8px',
    padding: '14px 20px !important',
    borderTop: '1px solid var(--vcenter-border) !important'
  },
  '.MuiMenuItem-root:hover, .MuiMenuItem-root.Mui-selected, .MuiAutocomplete-option[aria-selected="true"]': {
    color: 'var(--vcenter-accent)',
    backgroundColor: 'var(--vcenter-selected) !important'
  },
  '.ts-vertical-layout': {
    display: 'grid !important',
    gridTemplateColumns: '180px minmax(0, 1fr)',
    gridTemplateRows: '121px minmax(0, 1fr)',
    minHeight: '100dvh'
  },
  '.ts-vertical-layout > .ts-vertical-nav-root': {
    gridColumn: '1',
    gridRow: '2'
  },
  '.ts-vertical-layout > .ts-vertical-layout-content-wrapper': {
    display: 'contents !important'
  },
  '.ts-vertical-layout-header': {
    gridColumn: '1 / -1',
    gridRow: '1',
    position: 'relative',
    zIndex: 1201,
    inlineSize: '100% !important',
    marginInlineStart: 0,
    blockSize: '121px !important',
    minBlockSize: '121px !important'
  },
  '.ts-vertical-layout-content': {
    gridColumn: '2',
    gridRow: '2',
    minInlineSize: 0
  },
  '.ts-vertical-layout-footer': {
    gridColumn: '2'
  },
  '.ts-vertical-layout-header .ts-vertical-layout-navbar': {
    padding: '0 !important',
    blockSize: '121px',
    minBlockSize: '121px'
  },
  '.vcenter-classic-navbar': {
    display: 'grid',
    gridTemplateRows: '57px 32px 32px',
    width: '100%',
    height: '121px',
    fontSize: '12px'
  },
  '.vcenter-classic-navbar button': {
    font: 'inherit'
  },
  '.vcenter-classic-navbar__primary': {
    display: 'flex',
    alignItems: 'center',
    gap: '15px',
    padding: '10px 100px 10px 17px',
    color: '#FFFFFF',
    backgroundColor: 'var(--vcenter-header)'
  },
  '.vcenter-classic-navbar__brand': {
    display: 'flex',
    alignItems: 'center',
    gap: '15px',
    whiteSpace: 'nowrap'
  },
  '.vcenter-classic-navbar__brand > button, .vcenter-classic-navbar__brand-name': {
    display: 'inline-flex',
    alignItems: 'center',
    padding: 0,
    color: '#FFFFFF',
    background: 'transparent',
    border: 0,
    cursor: 'pointer'
  },
  '.vcenter-classic-navbar__brand > button': {
    fontSize: '16px'
  },
  '.vcenter-classic-navbar__brand-name': {
    gap: '7px'
  },
  '.vcenter-classic-navbar__brand-name strong': {
    fontSize: '20px',
    fontWeight: 400,
    lineHeight: 1
  },
  '.vcenter-classic-navbar__brand-name span': {
    color: '#C4D8E6',
    fontSize: '11px'
  },
  '.vcenter-classic-navbar__primary-actions': {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    marginInlineStart: 'auto'
  },
  '.vcenter-classic-navbar__primary .MuiIconButton-root': {
    color: '#FFFFFF'
  },
  '.vcenter-classic-search': {
    display: 'flex',
    alignItems: 'center',
    gap: '7px',
    width: '230px',
    maxWidth: '230px',
    padding: '4px 0',
    color: '#FFFFFF',
    background: 'transparent',
    border: 0,
    borderBottom: '1px solid #7794A7',
    cursor: 'pointer'
  },
  '.vcenter-classic-search:hover': {
    borderBottomColor: '#FFFFFF'
  },
  '.vcenter-classic-user': {
    display: 'flex',
    alignItems: 'center',
    gap: '3px',
    color: '#FFFFFF',
    background: 'transparent',
    border: 0,
    cursor: 'pointer'
  },
  '.vcenter-classic-navbar__meta, .vcenter-classic-navbar__tools': {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingInline: '17px',
    color: 'var(--vcenter-text-secondary) !important',
    backgroundColor: '#EEF4F7',
    borderBottom: '1px solid var(--vcenter-border)'
  },
  '.vcenter-classic-navbar__tools': {
    justifyContent: 'flex-end',
    gap: '18px',
    paddingInline: '22px',
    backgroundColor: 'var(--vcenter-surface-alt)'
  },
  '.vcenter-classic-navbar__meta > div': {
    display: 'flex',
    gap: '16px'
  },
  '.vcenter-classic-navbar__meta *, .vcenter-classic-navbar__tools *': {
    color: 'inherit !important'
  },
  '.vcenter-classic-navbar__meta button, .vcenter-classic-navbar__tools > button': {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '5px',
    padding: 0,
    color: 'var(--vcenter-accent) !important',
    background: 'transparent',
    border: 0,
    cursor: 'pointer'
  },
  '.vcenter-classic-navbar__tools .MuiIconButton-root': {
    width: '24px',
    height: '24px',
    color: 'var(--vcenter-accent) !important'
  },
  '.vcenter-classic-catalog': {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
    gap: '18px',
    padding: '19px !important'
  },
  '.vcenter-classic-dialog': {
    width: '740px',
    maxWidth: 'calc(100vw - 40px)'
  },
  '.vcenter-classic-dialog-title': {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  '.vcenter-classic-dialog-title .MuiIconButton-root': {
    margin: '-9px -12px -9px 0',
    color: 'var(--vcenter-text-secondary)'
  },
  '.vcenter-classic-catalog-dialog .MuiDialogActions-root > span': {
    marginInlineEnd: 'auto',
    color: 'var(--vcenter-text-secondary)',
    fontSize: '11px'
  },
  '.vcenter-classic-catalog section h3': {
    margin: '0 0 7px',
    paddingBottom: '6px',
    color: 'var(--vcenter-text-secondary)',
    fontSize: '14px',
    fontWeight: 500,
    borderBottom: '1px solid var(--vcenter-border)'
  },
  '.vcenter-classic-catalog section > div': {
    display: 'block'
  },
  '.vcenter-classic-catalog section button': {
    display: 'block',
    width: '100%',
    padding: '5px 0',
    color: 'var(--vcenter-accent)',
    textAlign: 'left',
    background: 'transparent',
    border: 0,
    cursor: 'pointer'
  },
  '.vcenter-classic-catalog section button:hover': {
    color: 'var(--vcenter-accent-hover)',
    textDecoration: 'underline'
  },
  '.vcenter-classic-vm-wizard': {
    width: '740px !important',
    maxWidth: 'calc(100vw - 40px) !important',
    maxHeight: 'calc(100dvh - 84px) !important'
  },
  '.vcenter-classic-vm-wizard .MuiDialogContent-root': {
    minHeight: '420px',
    padding: '0 !important',
    overflow: 'hidden'
  },
  '.vcenter-classic-vm-wizard .MuiDialogContent-root > .MuiBox-root': {
    minHeight: '420px'
  },
  '.vcenter-classic-vm-wizard .MuiDialogContent-root > .MuiBox-root > .MuiBox-root:last-child': {
    minWidth: 0,
    padding: '22px',
    overflow: 'auto'
  },
  '.vcenter-classic-wizard-steps': {
    boxSizing: 'border-box',
    width: '165px !important',
    flex: '0 0 165px !important',
    gap: '0 !important',
    padding: '18px 14px !important',
    backgroundColor: 'var(--vcenter-surface-alt)'
  },
  '.vcenter-classic-wizard-steps .MuiButton-root': {
    minWidth: '0 !important',
    minHeight: '40px !important',
    padding: '9px 0 !important',
    color: 'var(--vcenter-text-secondary) !important',
    background: 'transparent !important',
    border: '0 !important',
    boxShadow: 'none !important',
    opacity: '1 !important'
  },
  '.vcenter-classic-wizard-steps .MuiButton-root[aria-current="step"]': {
    color: 'var(--vcenter-accent) !important'
  },
  '.vcenter-classic-wizard-steps .MuiButton-startIcon': {
    margin: '0 8px 0 0 !important'
  },
  '.vcenter-classic-wizard-steps .MuiTypography-root:first-of-type': {
    fontSize: '12px !important',
    fontWeight: '400 !important'
  },
  '.vcenter-classic-wizard-steps .MuiTypography-root:last-of-type': {
    display: 'none !important'
  },
  '.vcenter-classic-wizard-step-number': {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '22px',
    height: '22px',
    color: 'var(--vcenter-text-secondary)',
    fontSize: '11px',
    lineHeight: 1,
    backgroundColor: 'var(--vcenter-surface)',
    border: '1px solid var(--vcenter-border-control)',
    borderRadius: '50%'
  },
  '.vcenter-classic-wizard-steps .MuiButton-root[aria-current="step"] .vcenter-classic-wizard-step-number': {
    color: '#FFFFFF',
    backgroundColor: 'var(--vcenter-accent)',
    borderColor: 'var(--vcenter-accent)'
  },
  '.vcenter-classic-coverage': {
    display: 'grid',
    gap: '10px',
    margin: 0,
    paddingInlineStart: '20px',
    lineHeight: 1.6
  },
  '.vcenter-classic-brand': {
    display: 'flex',
    alignItems: 'baseline',
    gap: '10px',
    width: '100%',
    height: '57px',
    paddingTop: '17px',
    color: '#FFFFFF !important',
    textDecoration: 'none',
    visibility: 'hidden'
  },
  '.vcenter-classic-brand > i': {
    alignSelf: 'center',
    fontSize: '17px'
  },
  '.vcenter-classic-brand > strong': {
    fontSize: '18px',
    fontWeight: 400,
    lineHeight: 1
  },
  '.vcenter-classic-brand > span': {
    fontSize: '6px',
    whiteSpace: 'nowrap'
  },
  '.ts-vertical-layout-content': {
    '--content-padding': '0px',
    padding: '0 22px calc(22px + var(--taskbar-height, 0px)) !important'
  },
  '.vcenter-classic-page-heading': {
    padding: 0
  },
  '.vcenter-classic-breadcrumb': {
    paddingTop: '12px',
    color: 'var(--vcenter-text-secondary)',
    fontSize: '11px'
  },
  '.vcenter-classic-page-heading__row': {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '10px',
    padding: '10px 0 15px'
  },
  '.vcenter-classic-page-heading h1': {
    margin: 0,
    color: 'var(--vcenter-text)',
    fontSize: '23px',
    fontWeight: '400 !important',
    lineHeight: 1.5
  },
  '.vcenter-classic-page-heading p': {
    margin: '4px 0 0',
    color: 'var(--vcenter-text-secondary)',
    fontSize: '12px'
  },
  '.vcenter-classic-source': {
    padding: '3px 7px',
    color: 'var(--vcenter-text-secondary)',
    border: '1px solid var(--vcenter-border)',
    backgroundColor: '#FFFFFF',
    whiteSpace: 'nowrap'
  },
  '.vcenter-classic-overview': {
    minWidth: 0
  },
  '.vcenter-classic-actions': {
    display: 'flex',
    alignItems: 'center',
    gap: '7px',
    marginBottom: '30px'
  },
  '.vcenter-classic-actions button': {
    minHeight: '32px',
    padding: '5px 11px',
    color: 'var(--vcenter-text)',
    backgroundColor: '#FFFFFF',
    border: '1px solid var(--vcenter-border-control)',
    borderRadius: '2px',
    cursor: 'pointer'
  },
  '.vcenter-classic-actions button:hover': {
    color: 'var(--vcenter-accent)',
    backgroundColor: 'var(--vcenter-selected)',
    borderColor: 'var(--vcenter-accent)'
  },
  '.vcenter-classic-actions .is-primary': {
    color: '#FFFFFF',
    backgroundColor: 'var(--vcenter-accent)',
    borderColor: 'var(--vcenter-accent)'
  },
  '.vcenter-classic-actions .is-refresh': {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '5px'
  },
  '.vcenter-classic-actions button:disabled': {
    color: 'var(--vcenter-text-disabled, #98ACB9)',
    backgroundColor: 'var(--vcenter-surface-alt)',
    borderColor: 'var(--vcenter-border)',
    cursor: 'default'
  },
  '.vcenter-classic-refresh-status': {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    marginInlineStart: 'auto',
    color: 'var(--vcenter-text-secondary)',
    fontSize: '11px'
  },
  '.vcenter-classic-refresh-status .is-refresh': {
    minHeight: '28px'
  },
  '.vcenter-classic-metrics': {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
    gap: '12px',
    marginBottom: '18px'
  },
  '.vcenter-classic-metrics article': {
    minHeight: '87px',
    padding: '12px 14px',
    backgroundColor: '#FFFFFF',
    border: '1px solid var(--vcenter-border)',
    borderRadius: '2px'
  },
  '.vcenter-classic-metrics span': {
    display: 'block',
    color: 'var(--vcenter-text-secondary)',
    fontSize: '12px'
  },
  '.vcenter-classic-metrics strong': {
    display: 'block',
    marginTop: '4px',
    color: '#006EAA',
    fontSize: '26px',
    fontWeight: 400,
    lineHeight: 1.5
  },
  '.vcenter-classic-grid': {
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)',
    gap: '16px'
  },
  '.vcenter-classic-panel': {
    minWidth: 0,
    minHeight: '194px',
    backgroundColor: '#FFFFFF',
    border: '1px solid var(--vcenter-border)',
    borderRadius: '2px',
    overflow: 'hidden'
  },
  '.vcenter-classic-panel.is-wide': {
    gridColumn: '1 / -1'
  },
  '.vcenter-classic-panel > header': {
    minHeight: '36px',
    padding: '9px 13px',
    color: 'var(--vcenter-text)',
    backgroundColor: 'var(--vcenter-surface-alt)',
    borderBottom: '1px solid var(--vcenter-border)',
    fontSize: '12px',
    fontWeight: 500
  },
  '.vcenter-classic-resource-list': {
    padding: '13px'
  },
  '.vcenter-classic-resource-list > div > div:first-of-type': {
    display: 'flex',
    justifyContent: 'space-between',
    marginBottom: '5px'
  },
  '.vcenter-classic-resource-list > div:not(:last-child) .vcenter-classic-progress': {
    marginBottom: '13px'
  },
  '.vcenter-classic-progress': {
    height: '7px',
    backgroundColor: '#E9EDF1'
  },
  '.vcenter-classic-progress span': {
    display: 'block',
    height: '100%',
    backgroundColor: '#3294C8'
  },
  '.vcenter-classic-health': {
    display: 'grid',
    gap: '7px',
    margin: 0,
    padding: '13px'
  },
  '.vcenter-classic-health > div': {
    display: 'grid',
    gridTemplateColumns: '42% 58%'
  },
  '.vcenter-classic-health dt': {
    color: 'var(--vcenter-text-secondary)'
  },
  '.vcenter-classic-health dd': {
    margin: 0
  },
  '.vcenter-classic-panel button': {
    padding: 0,
    color: 'var(--vcenter-accent)',
    background: 'transparent',
    border: 0,
    cursor: 'pointer'
  },
  '.vcenter-classic-panel table': {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: '12px'
  },
  '.vcenter-classic-panel th, .vcenter-classic-panel td': {
    padding: '9px 11px',
    textAlign: 'left',
    borderBottom: '1px solid #E0E6EB'
  },
  '.vcenter-classic-panel th': {
    color: 'var(--vcenter-text-secondary)',
    backgroundColor: 'var(--vcenter-surface-alt)',
    fontWeight: 500
  },
  '.vcenter-classic-empty': {
    color: 'var(--vcenter-text-secondary)',
    textAlign: 'center !important'
  },
  '.vcenter-classic-ok': {
    color: '#348322'
  },
  '.vcenter-classic-warning': {
    color: '#A86B00'
  },
  '.vcenter-classic-error': {
    color: '#B23427'
  },
  '.vcenter-classic-skeleton span, .vcenter-classic-skeleton strong, .vcenter-classic-skeleton header': {
    color: 'transparent !important',
    backgroundImage: 'linear-gradient(90deg, #E8EDF1 25%, #F6F8FA 45%, #E8EDF1 65%)',
    backgroundSize: '220% 100%',
    animation: 'vcenter-skeleton 1.25s ease-in-out infinite'
  },
  '.vcenter-classic-skeleton__actions': {
    display: 'flex',
    gap: '8px',
    marginBottom: '30px'
  },
  '.vcenter-classic-skeleton__actions span': {
    width: '92px',
    height: '32px',
    border: '1px solid var(--vcenter-border)'
  },
  '.vcenter-classic-skeleton .vcenter-classic-metrics article > span': {
    width: '45%',
    height: '12px'
  },
  '.vcenter-classic-skeleton .vcenter-classic-metrics article > strong': {
    width: '25%',
    height: '25px',
    marginTop: '10px'
  },
  '.vcenter-classic-skeleton .vcenter-classic-panel > header': {
    display: 'block'
  },
  '.vcenter-classic-skeleton__lines, .vcenter-classic-skeleton__table': {
    display: 'grid',
    gap: '12px',
    padding: '16px'
  },
  '.vcenter-classic-skeleton__lines span, .vcenter-classic-skeleton__table span': {
    width: '100%',
    height: '14px'
  },
  '.vcenter-classic-skeleton__lines span:nth-of-type(2)': {
    width: '76%'
  },
  '.vcenter-classic-skeleton__lines span:nth-of-type(3)': {
    width: '58%'
  },
  '@keyframes vcenter-skeleton': {
    to: { backgroundPosition: '-220% 0' }
  },
  '.vcenter-classic-recent-tasks': {
    minHeight: '0',
    marginTop: '16px'
  },
  '.vcenter-classic-recent-tasks > header': {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  '.vcenter-spin': {
    animation: 'vcenter-spin 0.8s linear infinite'
  },
  '@keyframes vcenter-spin': {
    to: { transform: 'rotate(360deg)' }
  },
  '@media (prefers-reduced-motion: reduce)': {
    '.vcenter-classic-skeleton span, .vcenter-classic-skeleton strong, .vcenter-classic-skeleton header, .vcenter-spin': {
      animation: 'none'
    }
  },
  '@media (max-width: 800px)': {
    '.ts-vertical-layout': {
      gridTemplateColumns: '150px minmax(0, 1fr)'
    },
    '.ts-vertical-layout > .ts-vertical-nav-root': {
      inlineSize: '150px !important',
      minInlineSize: '150px !important'
    },
    '.ts-vertical-layout-content': {
      paddingInline: '15px !important'
    },
    '.vcenter-classic-metrics': {
      gridTemplateColumns: 'repeat(2, minmax(0, 1fr))'
    },
    '.vcenter-classic-grid': {
      gridTemplateColumns: '1fr'
    },
    '.vcenter-classic-search span': {
      display: 'none'
    },
    '.vcenter-classic-navbar__brand-name span': {
      display: 'none'
    },
    '.vcenter-classic-refresh-status > span': {
      display: 'none'
    }
  },
  '@media (max-width: 560px)': {
    '.ts-vertical-layout': {
      gridTemplateColumns: 'minmax(0, 1fr)'
    },
    '.ts-vertical-layout > .ts-vertical-nav-root': {
      display: 'none'
    },
    '.ts-vertical-layout-content': {
      gridColumn: '1'
    },
    '.vcenter-classic-page-heading h1': {
      fontSize: '21px'
    },
    '.vcenter-classic-navbar__primary': {
      paddingInline: '15px'
    },
    '.vcenter-classic-search': {
      width: 'min(230px, 42vw)'
    },
    '.vcenter-classic-navbar__meta button:last-child, .vcenter-classic-navbar__tools > button': {
      display: 'none'
    },
    '.vcenter-classic-catalog': {
      gridTemplateColumns: 'repeat(2, minmax(0, 1fr))'
    },
    '.MuiDialog-container': {
      padding: '15px 7px'
    }
  },
  '.MuiTooltip-tooltip': {
    borderRadius: '2px !important'
  },
  ':where(a, button, input, textarea, select, [tabindex]):not(.MuiInputBase-input):not([role="dialog"]):focus-visible, .MuiButtonBase-root.Mui-focusVisible': {
    outline: '2px solid var(--vcenter-accent)',
    outlineOffset: '2px'
  },
  '*': {
    scrollbarColor: 'var(--vcenter-border-control) var(--vcenter-surface-alt)',
    scrollbarWidth: 'thin'
  }
})

// Helper: generates 17-group content area overrides from CSS variable names
// Each theme provides a mapping of semantic names to its own CSS variable names
const createContentOverrides = (vars) => ({
  'main, .ts-vertical-layout-content': {
    backgroundColor: `var(${vars.bg}) !important`
  },
  '.MuiCard-root': {
    backgroundColor: `var(${vars.surface}) !important`,
    borderColor: `var(${vars.border}) !important`
  },
  '.MuiTableHead-root .MuiTableCell-root': {
    backgroundColor: `var(${vars.surfaceAlt || vars.surface}) !important`,
    borderBottom: `1px solid var(${vars.border}) !important`,
    color: `var(${vars.text}) !important`,
    fontWeight: '600 !important'
  },
  '.MuiTableBody-root .MuiTableRow-root': {
    backgroundColor: `var(${vars.surface}) !important`,
    '&:hover': {
      backgroundColor: `var(${vars.hover}) !important`
    }
  },
  '.MuiTableBody-root .MuiTableRow-root:nth-of-type(even)': {
    backgroundColor: `var(${vars.bg}) !important`
  },
  '.MuiTableBody-root .MuiTableCell-root': {
    borderBottom: `1px solid var(${vars.border}) !important`,
    color: `var(${vars.text}) !important`
  },
  '.MuiOutlinedInput-root': {
    backgroundColor: `var(${vars.surface}) !important`,
    '& .MuiOutlinedInput-notchedOutline': {
      borderColor: `var(${vars.border}) !important`
    },
    '&:hover .MuiOutlinedInput-notchedOutline': {
      borderColor: `var(${vars.accent}) !important`
    },
    '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
      borderColor: `var(${vars.accent}) !important`
    }
  },
  '.MuiInputBase-input': {
    color: `var(${vars.text}) !important`
  },
  '.MuiInputLabel-root': {
    color: `var(${vars.textSecondary || vars.text}) !important`
  },
  '.MuiButton-containedPrimary': {
    backgroundColor: `var(${vars.accent}) !important`,
    color: `var(${vars.accentText || vars.bg}) !important`,
    '&:hover': {
      backgroundColor: `var(${vars.accentHover || vars.accent}) !important`
    }
  },
  '.MuiTab-root.Mui-selected': {
    color: `var(${vars.accent}) !important`
  },
  '.MuiTabs-indicator': {
    backgroundColor: `var(${vars.accent}) !important`
  },
  '.MuiDialog-paper, .MuiPopover-paper, .MuiMenu-paper': {
    backgroundColor: `var(${vars.surface}) !important`,
    border: `1px solid var(${vars.border}) !important`
  },
  '.MuiMenuItem-root': {
    color: `var(${vars.text}) !important`,
    '&:hover': {
      backgroundColor: `var(${vars.hover}) !important`
    }
  },
  '.MuiDivider-root': {
    borderColor: `var(${vars.border}) !important`
  },
  '*::-webkit-scrollbar-track': {
    backgroundColor: `var(${vars.bg}) !important`
  },
  '*::-webkit-scrollbar-thumb': {
    backgroundColor: `var(${vars.border}) !important`,
    '&:hover': {
      backgroundColor: `var(${vars.accent}) !important`
    }
  },
  '.MuiLinearProgress-bar': {
    backgroundColor: `var(${vars.accent}) !important`
  },
  '.MuiTreeItem-root, .MuiListItem-root': {
    '&:hover': {
      backgroundColor: `var(${vars.hover}) !important`
    }
  }
})

// Generate global CSS based on theme
const getGlobalThemeStyles = (globalTheme, mode, customBorderRadius, blurIntensity, fontSize, uiScale) => {
  const themeStyles = globalTheme.styles
  const cssOverrides = globalTheme.cssOverrides?.[mode] || {}
  const densityValue = densityConfig[themeStyles.density]?.multiplier || 1
  const transitions = transitionConfig[themeStyles.transitions] || transitionConfig.normal
  
  // Use custom border radius if provided, otherwise use theme default
  const cardRadius = customBorderRadius !== null && customBorderRadius !== undefined 
    ? customBorderRadius 
    : themeStyles.card.borderRadius

  const buttonRadius = customBorderRadius !== null && customBorderRadius !== undefined
    ? Math.max(customBorderRadius - 2, 0)
    : themeStyles.button.borderRadius

  const badgeRadius = Math.max(buttonRadius * 2, 12)

  const inputRadius = customBorderRadius !== null && customBorderRadius !== undefined
    ? Math.max(customBorderRadius - 2, 0)
    : themeStyles.input.borderRadius

  // Use custom blur intensity if provided and theme supports it
  const effectiveBlur = globalTheme.id === 'glassmorphism' && blurIntensity !== null && blurIntensity !== undefined
    ? `blur(${blurIntensity}px) saturate(180%)`
    : themeStyles.card.backdropFilter

  // Font size and UI scale
  const baseFontSize = fontSize || 14
  const scale = (uiScale || 100) / 100

  // En mode light, on n'applique pas les backgrounds custom des thèmes pour éviter les problèmes de contraste
  const isLightMode = mode === 'light'
  const shouldApplyCustomBackground = !isLightMode && themeStyles.card.background !== 'var(--mui-palette-background-paper)'

  // Thèmes avec header/sidebar toujours sombres (même en mode clair)
  const themesWithDarkChrome = ['vcenterClassic', 'esageClassic', 'terminal', 'cyberpunk', 'nord', 'dracula', 'oneDark']
  const hasDarkChrome = themesWithDarkChrome.includes(globalTheme.id)

  // Font families par thème
  const themeFonts = {
    vcenterClassic: '-apple-system, BlinkMacSystemFont, "Segoe UI", "Microsoft YaHei", sans-serif',
    esageClassic: '"Lato", "Segoe UI", -apple-system, BlinkMacSystemFont, sans-serif',
    terminal: '"JetBrains Mono", "Fira Code", "Consolas", "Monaco", monospace',
    cyberpunk: '"Orbitron", "Rajdhani", "Share Tech", "Segoe UI", sans-serif',
    nord: '"Inter", "Nunito Sans", "Segoe UI", -apple-system, sans-serif',
    dracula: '"Fira Sans", "Source Sans Pro", "Segoe UI", sans-serif',
    oneDark: '"Source Sans Pro", "Segoe UI", -apple-system, sans-serif',
    glassmorphism: '"SF Pro Display", "Inter", "Segoe UI", -apple-system, sans-serif',
    neumorphism: '"Poppins", "Inter", "Segoe UI", sans-serif'
  }

  const themeFont = themeFonts[globalTheme.id]

  return {
    ':root': {
      // Density
      '--unicenter-density': densityValue,

      // Transitions  
      '--unicenter-transition-duration': transitions.duration,
      '--unicenter-transition-easing': transitions.easing,

      // Card styles
      '--unicenter-card-radius': `${cardRadius}px`,
      '--unicenter-card-shadow': isLightMode 
        ? '0 2px 8px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.06)' 
        : themeStyles.card.boxShadow,
      '--unicenter-card-backdrop': effectiveBlur,
      '--unicenter-card-border': themeStyles.card.border,

      // Button styles
      '--unicenter-button-radius': `${buttonRadius}px`,
      '--unicenter-badge-radius': `${badgeRadius}px`,

      // Input styles
      '--unicenter-input-radius': `${inputRadius}px`,

      // Typography
      '--unicenter-font-size': `${baseFontSize}px`,
      '--unicenter-ui-scale': scale,

      // Theme-specific CSS vars
      ...cssOverrides
    },
    
    // Apply base font size globally
    'html': {
      fontSize: `${baseFontSize}px !important`
    },
    
    // Apply UI scale
    'body': {
      zoom: scale !== 1 ? scale : undefined
    },
    
    // Apply theme font globally
    ...(themeFont && {
      'body, .MuiTypography-root, .MuiButton-root, .MuiInputBase-root, .MuiMenuItem-root': {
        fontFamily: `${themeFont} !important`
      }
    }),
    
    // ============================================================
    // DARK CHROME FIX - For themes with dark header in light mode
    // Forces header icons/text to be white when header is dark
    // ============================================================
    ...(hasDarkChrome && isLightMode && {
      // Force all header elements to have light text
      '.ts-vertical-layout-header, .ts-horizontal-layout-header': {
        '& *': {
          color: '#ffffff !important'
        },
        '& .MuiIconButton-root': {
          color: '#ffffff !important'
        },
        '& .MuiTypography-root': {
          color: '#ffffff !important'
        },
        '& .MuiBadge-badge': {
          color: '#ffffff !important'
        }
      },
      '.ts-vertical-layout-navbar, .ts-horizontal-layout-navbar': {
        '& *': {
          color: '#ffffff !important'
        },
        '& .MuiIconButton-root': {
          color: '#ffffff !important'
        },
        '& i': {
          color: '#ffffff !important'
        }
      }
    }),
    
    
    // Apply card styles globally - mais PAS aux cartes qui ont un style inline ou une classe spécifique
    '.MuiCard-root:not([style*="background"]):not(.no-theme-override)': {
      borderRadius: 'var(--unicenter-card-radius) !important',
      boxShadow: 'var(--unicenter-card-shadow) !important',
      backdropFilter: !isLightMode && effectiveBlur !== 'none' 
        ? `${effectiveBlur} !important` 
        : undefined,
      background: shouldApplyCustomBackground 
        ? `${themeStyles.card.background} !important` 
        : undefined,
      border: themeStyles.card.border !== 'none' 
        ? `${themeStyles.card.border} !important` 
        : undefined,
      transition: `all var(--unicenter-transition-duration) var(--unicenter-transition-easing) !important`
    },

    // Cartes avec style inline - seulement le radius et transition
    '.MuiCard-root[style*="background"]': {
      borderRadius: 'var(--unicenter-card-radius) !important',
      transition: `all var(--unicenter-transition-duration) var(--unicenter-transition-easing) !important`
    },

    // Apply button styles
    '.MuiButton-root': {
      borderRadius: 'var(--unicenter-button-radius) !important',
      textTransform: `${themeStyles.button.textTransform} !important`,
      fontWeight: `${themeStyles.button.fontWeight} !important`,
      letterSpacing: themeStyles.button.letterSpacing || 'normal',
      transition: `all var(--unicenter-transition-duration) var(--unicenter-transition-easing) !important`,
      ...(themeStyles.button.boxShadow && !isLightMode && {
        boxShadow: themeStyles.button.boxShadow
      })
    },

    // Apply input styles
    '.MuiOutlinedInput-root, .MuiFilledInput-root': {
      borderRadius: 'var(--unicenter-input-radius) !important',
      transition: `all var(--unicenter-transition-duration) var(--unicenter-transition-easing) !important`,
      ...(themeStyles.input.boxShadow && !isLightMode && {
        boxShadow: themeStyles.input.boxShadow
      }),
      ...(themeStyles.input.backdropFilter && !isLightMode && {
        backdropFilter: themeStyles.input.backdropFilter
      })
    },

    // Chip styles
    '.MuiChip-root': {
      borderRadius: 'var(--unicenter-badge-radius) !important',
      transition: `all var(--unicenter-transition-duration) var(--unicenter-transition-easing) !important`
    },

    '.MuiBadge-badge': {
      borderRadius: 'var(--unicenter-badge-radius) !important'
    },

    // Dialog styles
    '.MuiDialog-paper': {
      borderRadius: 'var(--unicenter-card-radius) !important',
      backdropFilter: !isLightMode && effectiveBlur !== 'none' 
        ? effectiveBlur 
        : undefined,
      background: shouldApplyCustomBackground 
        ? themeStyles.card.background 
        : undefined
    },

    // Menu styles
    '.MuiMenu-paper, .MuiPopover-paper': {
      borderRadius: 'var(--unicenter-card-radius) !important',
      backdropFilter: !isLightMode && effectiveBlur !== 'none' 
        ? effectiveBlur 
        : undefined,
      boxShadow: 'var(--unicenter-card-shadow) !important'
    },

    // Tab styles
    '.MuiTab-root': {
      transition: `color var(--unicenter-transition-duration) var(--unicenter-transition-easing), background-color var(--unicenter-transition-duration) var(--unicenter-transition-easing) !important`
    },

    // Tooltip
    '.MuiTooltip-tooltip': {
      borderRadius: `calc(var(--unicenter-card-radius) / 2) !important`
    },

    // Alert
    '.MuiAlert-root': {
      borderRadius: 'var(--unicenter-card-radius) !important'
    },

    // Apply font override for terminal theme
    ...(globalTheme.fontOverride && {
      'body, .MuiTypography-root': {
        fontFamily: `${globalTheme.fontOverride.body} !important`
      },
      'h1, h2, h3, h4, h5, h6, .MuiTypography-h1, .MuiTypography-h2, .MuiTypography-h3, .MuiTypography-h4, .MuiTypography-h5, .MuiTypography-h6': {
        fontFamily: `${globalTheme.fontOverride.heading} !important`
      }
    }),
    
    // ============================================================
    // THEME-SPECIFIC STYLES - Header, Sidebar, and accent colors
    // ============================================================
    
    // eSage Classic Theme
    ...(globalTheme.id === 'esageClassic' && {
      // Header - eSage blue-grey
      '.ts-vertical-layout-header, .ts-horizontal-layout-header': {
        backgroundColor: '#354759 !important',
        borderBottom: '1px solid #4a6785 !important'
      },
      '.ts-vertical-layout-navbar, .ts-horizontal-layout-navbar': {
        backgroundColor: '#354759 !important'
      },
      '.ts-vertical-layout-navbar *, .ts-horizontal-layout-navbar *': {
        color: '#ffffff !important'
      },

      // Sidebar - Dark eSage
      '.ts-vertical-nav-root, .ts-vertical-nav-container, .ts-vertical-nav-bg-color-container': {
        backgroundColor: '#2a3a4a !important'
      },
      '.ts-vertical-nav-root .ts-menu-button': {
        color: '#c8d4e0 !important'
      },
      '.ts-vertical-nav-root .ts-menu-icon': {
        color: '#e57000 !important'
      },
      '.ts-vertical-nav-root .ts-menu-section-label': {
        color: '#6a8aa8 !important',
        textTransform: 'uppercase !important',
        fontSize: '11px !important',
        fontWeight: '600 !important'
      },
      '.ts-vertical-nav-root .ts-menuitem-root > .ts-menu-button:hover': {
        backgroundColor: 'rgba(229, 112, 0, 0.15) !important',
        color: '#ffffff !important'
      },
      '.ts-vertical-nav-root .ts-menuitem-root.ts-active > .ts-menu-button': {
        backgroundColor: 'rgba(229, 112, 0, 0.25) !important',
        color: '#ffffff !important',
        borderLeft: '3px solid #e57000 !important'
      },
      '.ts-vertical-nav-root .ts-menuitem-root.ts-active > .ts-menu-button .ts-menu-icon': {
        color: '#e57000 !important'
      },

      // Content area
      'main, .ts-vertical-layout-content': {
        backgroundColor: `${isLightMode ? '#f5f5f5' : '#1e2a38'} !important`
      },

      // Cards
      '.MuiCard-root': {
        backgroundColor: `${isLightMode ? '#ffffff' : '#2a3a4a'} !important`,
        borderColor: `${isLightMode ? '#ddd' : '#4a6785'} !important`
      },

      // Tables
      '.MuiTableHead-root .MuiTableCell-root': {
        backgroundColor: `${isLightMode ? '#f0f0f0' : '#354759'} !important`,
        borderBottom: `1px solid ${isLightMode ? '#ddd' : '#4a6785'} !important`,
        color: `${isLightMode ? '#333' : '#c8d4e0'} !important`,
        fontWeight: '600 !important'
      },
      '.MuiTableBody-root .MuiTableRow-root': {
        backgroundColor: `${isLightMode ? '#ffffff' : '#2a3a4a'} !important`,
        '&:hover': {
          backgroundColor: `${isLightMode ? '#fff5eb' : '#354759'} !important`
        }
      },
      '.MuiTableBody-root .MuiTableRow-root:nth-of-type(even)': {
        backgroundColor: `${isLightMode ? '#fafafa' : '#2f4050'} !important`
      },
      '.MuiTableBody-root .MuiTableCell-root': {
        borderBottom: `1px solid ${isLightMode ? '#eee' : '#4a6785'} !important`
      },

      // Inputs
      '.MuiOutlinedInput-root': {
        backgroundColor: `${isLightMode ? '#ffffff' : '#2a3a4a'} !important`,
        '& .MuiOutlinedInput-notchedOutline': {
          borderColor: `${isLightMode ? '#ccc' : '#4a6785'} !important`
        },
        '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
          borderColor: '#e57000 !important'
        }
      },

      // Buttons
      '.MuiButton-containedPrimary': {
        backgroundColor: '#e57000 !important',
        '&:hover': {
          backgroundColor: '#c96000 !important'
        }
      },

      // Tabs
      '.MuiTab-root.Mui-selected': {
        color: '#e57000 !important'
      },
      '.MuiTabs-indicator': {
        backgroundColor: '#e57000 !important'
      },

      // Dividers
      '.MuiDivider-root': {
        borderColor: `${isLightMode ? '#ddd' : '#4a6785'} !important`
      }
    }),

    // Terminal Theme - Hacker style - TOUT EN VERT
    ...(globalTheme.id === 'terminal' && {
      // Header
      '.ts-vertical-layout-header, .ts-horizontal-layout-header': {
        backgroundColor: '#0d1117 !important',
        borderBottom: '1px solid #30363d !important'
      },
      '.ts-vertical-layout-navbar, .ts-horizontal-layout-navbar': {
        backgroundColor: '#0d1117 !important'
      },
      '.ts-vertical-layout-navbar *, .ts-horizontal-layout-navbar *': {
        color: '#00ff00 !important'
      },

      // Sidebar
      '.ts-vertical-nav-root, .ts-vertical-nav-container, .ts-vertical-nav-bg-color-container': {
        backgroundColor: '#0d1117 !important',
        borderRight: '1px solid #30363d !important'
      },
      '.ts-vertical-nav-root .ts-menu-button': {
        color: '#00ff00 !important',
        fontFamily: '"JetBrains Mono", "Fira Code", monospace !important'
      },
      '.ts-vertical-nav-root .ts-menu-icon': {
        color: '#00cc00 !important'
      },
      '.ts-vertical-nav-root .ts-menu-section-label': {
        color: '#008800 !important',
        fontFamily: '"JetBrains Mono", "Fira Code", monospace !important',
        textTransform: 'uppercase !important'
      },
      '.ts-vertical-nav-root .ts-menuitem-root > .ts-menu-button:hover': {
        backgroundColor: 'rgba(0, 255, 0, 0.1) !important',
        color: '#00ff00 !important',
        textShadow: '0 0 10px #00ff00 !important'
      },
      '.ts-vertical-nav-root .ts-menuitem-root.ts-active > .ts-menu-button': {
        backgroundColor: 'rgba(0, 255, 0, 0.15) !important',
        color: '#00ff00 !important',
        borderLeft: '3px solid #00ff00 !important',
        textShadow: '0 0 10px #00ff00 !important'
      },

      // ============================================================
      // GLOBAL - Tout le contenu en vert sur fond noir
      // ============================================================
      'main, .ts-vertical-layout-content, .ts-vertical-layout-content-wrapper': {
        backgroundColor: '#0d1117 !important'
      },
      'body': {
        backgroundColor: '#0d1117 !important'
      },

      // ALL TEXT GREEN
      'body, p, span, div, h1, h2, h3, h4, h5, h6, label, a': {
        color: '#00ff00 !important',
        fontFamily: '"JetBrains Mono", "Fira Code", monospace !important'
      },
      '.MuiTypography-root': {
        color: '#00ff00 !important',
        fontFamily: '"JetBrains Mono", "Fira Code", monospace !important'
      },

      // Muted text (secondary)
      '.MuiTypography-colorTextSecondary, [class*="text-secondary"], [class*="textSecondary"]': {
        color: '#00aa00 !important'
      },

      // ============================================================
      // CARDS - Fond noir, bordure verte
      // ============================================================
      '.MuiCard-root, .MuiPaper-root': {
        backgroundColor: '#0d1117 !important',
        borderColor: '#30363d !important',
        border: '1px solid #30363d !important'
      },
      '.MuiCardContent-root, .MuiCardHeader-root': {
        backgroundColor: '#0d1117 !important'
      },

      // ============================================================
      // TABLES - Terminal style complet
      // ============================================================
      '.MuiTable-root, .MuiTableContainer-root': {
        backgroundColor: '#0d1117 !important'
      },
      '.MuiTableHead-root': {
        backgroundColor: '#161b22 !important'
      },
      '.MuiTableHead-root .MuiTableCell-root': {
        backgroundColor: '#161b22 !important',
        borderBottom: '1px solid #30363d !important',
        color: '#00ff00 !important',
        fontFamily: '"JetBrains Mono", monospace !important',
        textTransform: 'uppercase !important',
        fontWeight: '600 !important'
      },
      '.MuiTableBody-root .MuiTableRow-root': {
        backgroundColor: '#0d1117 !important',
        '&:hover': {
          backgroundColor: '#1a2332 !important'
        }
      },
      '.MuiTableBody-root .MuiTableRow-root:nth-of-type(even)': {
        backgroundColor: '#111922 !important'
      },
      '.MuiTableBody-root .MuiTableCell-root': {
        borderBottom: '1px solid #21262d !important',
        color: '#00ff00 !important',
        fontFamily: '"JetBrains Mono", monospace !important'
      },

      // ============================================================
      // INPUTS - Terminal style
      // ============================================================
      '.MuiOutlinedInput-root, .MuiInputBase-root': {
        backgroundColor: '#0d1117 !important',
        fontFamily: '"JetBrains Mono", monospace !important',
        '& .MuiOutlinedInput-notchedOutline': {
          borderColor: '#30363d !important'
        },
        '&:hover .MuiOutlinedInput-notchedOutline': {
          borderColor: '#00aa00 !important'
        },
        '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
          borderColor: '#00ff00 !important',
          boxShadow: '0 0 10px rgba(0, 255, 0, 0.3) !important'
        }
      },
      '.MuiInputBase-input': {
        color: '#00ff00 !important',
        fontFamily: '"JetBrains Mono", monospace !important'
      },
      '.MuiInputLabel-root': {
        color: '#00aa00 !important',
        fontFamily: '"JetBrains Mono", monospace !important'
      },
      '.MuiSelect-select': {
        color: '#00ff00 !important',
        backgroundColor: '#0d1117 !important'
      },

      // ============================================================
      // BUTTONS - Terminal style
      // ============================================================
      '.MuiButton-root': {
        fontFamily: '"JetBrains Mono", monospace !important',
        textTransform: 'uppercase !important',
        borderRadius: '0 !important'
      },
      '.MuiButton-containedPrimary': {
        backgroundColor: '#238636 !important',
        color: '#ffffff !important',
        '&:hover': {
          backgroundColor: '#2ea043 !important',
          boxShadow: '0 0 15px rgba(0, 255, 0, 0.4) !important'
        }
      },
      '.MuiButton-outlinedPrimary': {
        borderColor: '#00ff00 !important',
        color: '#00ff00 !important',
        '&:hover': {
          backgroundColor: 'rgba(0, 255, 0, 0.1) !important'
        }
      },
      '.MuiButton-text': {
        color: '#00ff00 !important'
      },
      '.MuiIconButton-root': {
        color: '#00ff00 !important',
        '&:hover': {
          backgroundColor: 'rgba(0, 255, 0, 0.1) !important'
        }
      },

      // ============================================================
      // CHIPS - Terminal style (carrés)
      // ============================================================
      '.MuiChip-root': {
        fontFamily: '"JetBrains Mono", monospace !important',
        borderRadius: 'var(--unicenter-badge-radius) !important',
        backgroundColor: '#161b22 !important',
        color: '#00ff00 !important',
        border: '1px solid #30363d !important'
      },
      '.MuiChip-colorSuccess': {
        backgroundColor: 'rgba(0, 255, 0, 0.15) !important',
        color: '#00ff00 !important',
        border: '1px solid #00ff00 !important'
      },
      '.MuiChip-colorError': {
        backgroundColor: 'rgba(255, 0, 0, 0.15) !important',
        color: '#ff4444 !important',
        border: '1px solid #ff4444 !important'
      },
      '.MuiChip-colorWarning': {
        backgroundColor: 'rgba(255, 165, 0, 0.15) !important',
        color: '#ffa500 !important',
        border: '1px solid #ffa500 !important'
      },
      '.MuiChip-colorInfo': {
        backgroundColor: 'rgba(0, 255, 255, 0.15) !important',
        color: '#00ffff !important',
        border: '1px solid #00ffff !important'
      },

      // ============================================================
      // TABS - Terminal style
      // ============================================================
      '.MuiTabs-root': {
        borderBottom: '1px solid #30363d !important'
      },
      '.MuiTab-root': {
        color: '#00aa00 !important',
        fontFamily: '"JetBrains Mono", monospace !important',
        textTransform: 'uppercase !important',
        '&.Mui-selected': {
          color: '#00ff00 !important',
          textShadow: '0 0 10px #00ff00 !important'
        }
      },
      '.MuiTabs-indicator': {
        backgroundColor: '#00ff00 !important',
        boxShadow: '0 0 10px #00ff00 !important'
      },

      // ============================================================
      // DIALOGS & MENUS - Terminal style
      // ============================================================
      '.MuiDialog-paper, .MuiPopover-paper, .MuiMenu-paper': {
        backgroundColor: '#0d1117 !important',
        border: '1px solid #30363d !important',
        color: '#00ff00 !important'
      },
      '.MuiMenuItem-root': {
        color: '#00ff00 !important',
        fontFamily: '"JetBrains Mono", monospace !important',
        '&:hover': {
          backgroundColor: 'rgba(0, 255, 0, 0.1) !important'
        }
      },
      '.MuiListItemIcon-root': {
        color: '#00ff00 !important'
      },

      // ============================================================
      // DIVIDERS & BORDERS
      // ============================================================
      '.MuiDivider-root': {
        borderColor: '#30363d !important'
      },

      // ============================================================
      // TOOLTIPS
      // ============================================================
      '.MuiTooltip-tooltip': {
        backgroundColor: '#161b22 !important',
        color: '#00ff00 !important',
        border: '1px solid #30363d !important',
        fontFamily: '"JetBrains Mono", monospace !important'
      },

      // ============================================================
      // PROGRESS BARS
      // ============================================================
      '.MuiLinearProgress-root': {
        backgroundColor: '#30363d !important'
      },
      '.MuiLinearProgress-bar': {
        backgroundColor: '#00ff00 !important'
      },

      // ============================================================
      // SCROLLBARS
      // ============================================================
      '*::-webkit-scrollbar': {
        width: '8px !important',
        height: '8px !important'
      },
      '*::-webkit-scrollbar-track': {
        backgroundColor: '#0d1117 !important'
      },
      '*::-webkit-scrollbar-thumb': {
        backgroundColor: '#30363d !important',
        '&:hover': {
          backgroundColor: '#00ff00 !important'
        }
      },

      // ============================================================
      // ICONS
      // ============================================================
      'i, [class^="ri-"], [class*=" ri-"], .MuiSvgIcon-root': {
        color: '#00ff00 !important'
      },

      // ============================================================
      // LINKS
      // ============================================================
      'a, .MuiLink-root': {
        color: '#00ff00 !important',
        '&:hover': {
          color: '#44ff44 !important',
          textShadow: '0 0 5px #00ff00 !important'
        }
      },

      // ============================================================
      // ALERTS
      // ============================================================
      '.MuiAlert-root': {
        backgroundColor: '#161b22 !important',
        border: '1px solid #30363d !important'
      },
      '.MuiAlert-message': {
        color: '#00ff00 !important'
      },

      // ============================================================
      // BADGES
      // ============================================================
      '.MuiBadge-badge': {
        backgroundColor: '#00ff00 !important',
        color: '#0d1117 !important'
      },

      // ============================================================
      // TREE VIEW / LISTS
      // ============================================================
      '.MuiTreeItem-root, .MuiListItem-root, .MuiListItemButton-root': {
        color: '#00ff00 !important',
        '&:hover': {
          backgroundColor: 'rgba(0, 255, 0, 0.1) !important'
        }
      },
      '.MuiTreeItem-label': {
        color: '#00ff00 !important',
        fontFamily: '"JetBrains Mono", monospace !important'
      }
    }),

    // Cyberpunk Theme - Neon style - MAGENTA/CYAN COMPLET
    ...(globalTheme.id === 'cyberpunk' && {
      // Header
      '.ts-vertical-layout-header, .ts-horizontal-layout-header': {
        backgroundColor: '#0a0a0f !important',
        borderBottom: '1px solid rgba(255, 0, 255, 0.4) !important',
        boxShadow: '0 0 20px rgba(255, 0, 255, 0.2), inset 0 -1px 0 rgba(0, 255, 255, 0.2) !important'
      },
      '.ts-vertical-layout-navbar, .ts-horizontal-layout-navbar': {
        backgroundColor: '#0a0a0f !important'
      },
      '.ts-vertical-layout-navbar *, .ts-horizontal-layout-navbar *': {
        color: '#ff00ff !important'
      },

      // Sidebar
      '.ts-vertical-nav-root, .ts-vertical-nav-container, .ts-vertical-nav-bg-color-container': {
        backgroundColor: '#0a0a0f !important',
        borderRight: '1px solid rgba(255, 0, 255, 0.3) !important'
      },
      '.ts-vertical-nav-root .ts-menu-button': {
        color: '#e0e0e0 !important'
      },
      '.ts-vertical-nav-root .ts-menu-icon': {
        color: '#ff00ff !important'
      },
      '.ts-vertical-nav-root .ts-menu-section-label': {
        color: '#00ffff !important',
        textTransform: 'uppercase !important',
        letterSpacing: '0.1em !important'
      },
      '.ts-vertical-nav-root .ts-menuitem-root > .ts-menu-button:hover': {
        backgroundColor: 'rgba(255, 0, 255, 0.15) !important',
        color: '#ff00ff !important',
        textShadow: '0 0 10px #ff00ff !important'
      },
      '.ts-vertical-nav-root .ts-menuitem-root.ts-active > .ts-menu-button': {
        backgroundColor: 'rgba(255, 0, 255, 0.2) !important',
        color: '#00ffff !important',
        borderLeft: '3px solid #ff00ff !important'
      },
      '.ts-vertical-nav-root .ts-menuitem-root.ts-active > .ts-menu-button .ts-menu-icon': {
        color: '#00ffff !important'
      },

      // ============================================================
      // GLOBAL - Fond noir, texte magenta/cyan
      // ============================================================
      'main, .ts-vertical-layout-content, .ts-vertical-layout-content-wrapper, body': {
        backgroundColor: '#0a0a0f !important'
      },
      'body, p, span, div, h1, h2, h3, h4, h5, h6, label': {
        color: '#e0e0e0 !important'
      },
      '.MuiTypography-root': {
        color: '#e0e0e0 !important'
      },
      '.MuiTypography-colorTextSecondary': {
        color: '#888 !important'
      },

      // ============================================================
      // CARDS - Cyberpunk style
      // ============================================================
      '.MuiCard-root, .MuiPaper-root': {
        backgroundColor: '#12121a !important',
        border: '1px solid rgba(255, 0, 255, 0.2) !important',
        boxShadow: '0 0 10px rgba(255, 0, 255, 0.1) !important'
      },

      // ============================================================
      // TABLES - Cyberpunk style
      // ============================================================
      '.MuiTable-root, .MuiTableContainer-root': {
        backgroundColor: '#0a0a0f !important'
      },
      '.MuiTableHead-root .MuiTableCell-root': {
        backgroundColor: '#12121a !important',
        borderBottom: '1px solid rgba(255, 0, 255, 0.3) !important',
        color: '#00ffff !important',
        textTransform: 'uppercase !important',
        letterSpacing: '0.05em !important'
      },
      '.MuiTableBody-root .MuiTableRow-root': {
        backgroundColor: '#0a0a0f !important',
        '&:hover': {
          backgroundColor: 'rgba(255, 0, 255, 0.1) !important'
        }
      },
      '.MuiTableBody-root .MuiTableRow-root:nth-of-type(even)': {
        backgroundColor: '#0f0f18 !important'
      },
      '.MuiTableBody-root .MuiTableCell-root': {
        borderBottom: '1px solid rgba(255, 0, 255, 0.15) !important',
        color: '#e0e0e0 !important'
      },

      // ============================================================
      // INPUTS - Cyberpunk style
      // ============================================================
      '.MuiOutlinedInput-root, .MuiInputBase-root': {
        backgroundColor: '#12121a !important',
        '& .MuiOutlinedInput-notchedOutline': {
          borderColor: 'rgba(255, 0, 255, 0.3) !important'
        },
        '&:hover .MuiOutlinedInput-notchedOutline': {
          borderColor: '#ff00ff !important'
        },
        '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
          borderColor: '#00ffff !important',
          boxShadow: '0 0 10px rgba(0, 255, 255, 0.3) !important'
        }
      },
      '.MuiInputBase-input': {
        color: '#e0e0e0 !important'
      },
      '.MuiInputLabel-root': {
        color: '#888 !important'
      },

      // ============================================================
      // BUTTONS - Cyberpunk style
      // ============================================================
      '.MuiButton-containedPrimary': {
        backgroundColor: '#ff00ff !important',
        color: '#ffffff !important',
        boxShadow: '0 0 15px rgba(255, 0, 255, 0.4) !important',
        '&:hover': {
          backgroundColor: '#cc00cc !important',
          boxShadow: '0 0 25px rgba(255, 0, 255, 0.6) !important'
        }
      },
      '.MuiButton-outlinedPrimary': {
        borderColor: '#ff00ff !important',
        color: '#ff00ff !important',
        '&:hover': {
          backgroundColor: 'rgba(255, 0, 255, 0.1) !important',
          boxShadow: '0 0 10px rgba(255, 0, 255, 0.3) !important'
        }
      },
      '.MuiIconButton-root': {
        color: '#ff00ff !important',
        '&:hover': {
          backgroundColor: 'rgba(255, 0, 255, 0.1) !important'
        }
      },

      // ============================================================
      // CHIPS - Cyberpunk style
      // ============================================================
      '.MuiChip-root': {
        backgroundColor: 'rgba(255, 0, 255, 0.15) !important',
        color: '#ff00ff !important',
        border: '1px solid rgba(255, 0, 255, 0.3) !important'
      },
      '.MuiChip-colorSuccess': {
        backgroundColor: 'rgba(0, 255, 255, 0.15) !important',
        color: '#00ffff !important',
        border: '1px solid #00ffff !important'
      },
      '.MuiChip-colorError': {
        backgroundColor: 'rgba(255, 50, 50, 0.15) !important',
        color: '#ff3232 !important',
        border: '1px solid #ff3232 !important'
      },
      '.MuiChip-colorWarning': {
        backgroundColor: 'rgba(255, 200, 0, 0.15) !important',
        color: '#ffc800 !important',
        border: '1px solid #ffc800 !important'
      },

      // ============================================================
      // TABS - Cyberpunk style
      // ============================================================
      '.MuiTabs-root': {
        borderBottom: '1px solid rgba(255, 0, 255, 0.3) !important'
      },
      '.MuiTab-root': {
        color: '#888 !important',
        '&.Mui-selected': {
          color: '#00ffff !important',
          textShadow: '0 0 10px #00ffff !important'
        }
      },
      '.MuiTabs-indicator': {
        backgroundColor: '#ff00ff !important',
        boxShadow: '0 0 10px #ff00ff !important'
      },

      // ============================================================
      // DIALOGS & MENUS
      // ============================================================
      '.MuiDialog-paper, .MuiPopover-paper, .MuiMenu-paper': {
        backgroundColor: '#12121a !important',
        border: '1px solid rgba(255, 0, 255, 0.3) !important'
      },
      '.MuiMenuItem-root': {
        color: '#e0e0e0 !important',
        '&:hover': {
          backgroundColor: 'rgba(255, 0, 255, 0.15) !important',
          color: '#ff00ff !important'
        }
      },

      // ============================================================
      // DIVIDERS
      // ============================================================
      '.MuiDivider-root': {
        borderColor: 'rgba(255, 0, 255, 0.2) !important'
      },

      // ============================================================
      // SCROLLBARS
      // ============================================================
      '*::-webkit-scrollbar-track': {
        backgroundColor: '#0a0a0f !important'
      },
      '*::-webkit-scrollbar-thumb': {
        backgroundColor: 'rgba(255, 0, 255, 0.3) !important',
        '&:hover': {
          backgroundColor: '#ff00ff !important'
        }
      },

      // ============================================================
      // ICONS
      // ============================================================
      'i, [class^="ri-"], [class*=" ri-"], .MuiSvgIcon-root': {
        color: '#ff00ff !important'
      },

      // ============================================================
      // PROGRESS & BADGES
      // ============================================================
      '.MuiLinearProgress-bar': {
        backgroundColor: '#ff00ff !important'
      },
      '.MuiBadge-badge': {
        backgroundColor: '#ff00ff !important'
      },

      // ============================================================
      // TREE VIEW / LISTS
      // ============================================================
      '.MuiTreeItem-root, .MuiListItem-root': {
        color: '#e0e0e0 !important',
        '&:hover': {
          backgroundColor: 'rgba(255, 0, 255, 0.1) !important'
        }
      }
    }),

    // Nord Theme - Arctic palette
    ...(globalTheme.id === 'nord' && {
      // Header - Polar Night
      '.ts-vertical-layout-header, .ts-horizontal-layout-header': {
        backgroundColor: '#2e3440 !important',
        borderBottom: '1px solid #3b4252 !important'
      },
      '.ts-vertical-layout-navbar, .ts-horizontal-layout-navbar': {
        backgroundColor: '#2e3440 !important'
      },
      '.ts-vertical-layout-navbar *, .ts-horizontal-layout-navbar *': {
        color: '#eceff4 !important'
      },

      // Sidebar
      '.ts-vertical-nav-root, .ts-vertical-nav-container, .ts-vertical-nav-bg-color-container': {
        backgroundColor: '#3b4252 !important'
      },
      '.ts-vertical-nav-root .ts-menu-button': {
        color: '#d8dee9 !important'
      },
      '.ts-vertical-nav-root .ts-menu-icon': {
        color: '#81a1c1 !important'
      },
      '.ts-vertical-nav-root .ts-menu-section-label': {
        color: '#4c566a !important'
      },
      '.ts-vertical-nav-root .ts-menuitem-root > .ts-menu-button:hover': {
        backgroundColor: '#434c5e !important',
        color: '#eceff4 !important'
      },
      '.ts-vertical-nav-root .ts-menuitem-root.ts-active > .ts-menu-button': {
        backgroundColor: 'rgba(136, 192, 208, 0.2) !important',
        color: '#88c0d0 !important',
        borderLeft: '3px solid #88c0d0 !important'
      },
      '.ts-vertical-nav-root .ts-menuitem-root.ts-active > .ts-menu-button .ts-menu-icon': {
        color: '#88c0d0 !important'
      },

      // Content area overrides via CSS vars
      ...createContentOverrides({
        bg: '--nord-bg-primary',
        surface: '--nord-bg-secondary',
        surfaceAlt: '--nord-bg-secondary',
        border: '--nord-border',
        text: '--nord-text',
        textSecondary: '--nord-text-secondary',
        accent: '--nord-accent',
        accentHover: '--nord-accent-secondary',
        accentText: '--nord-bg-primary',
        hover: '--nord-bg-tertiary'
      }),
      // #538 : badges pleins (couleurs sémantiques par défaut), lisibles en clair comme en sombre
      '.MuiChip-colorSuccess': { backgroundColor: 'var(--mui-palette-success-main) !important', color: 'var(--mui-palette-success-contrastText) !important', border: 'none !important' },
      '.MuiChip-colorError': { backgroundColor: 'var(--mui-palette-error-main) !important', color: 'var(--mui-palette-error-contrastText) !important', border: 'none !important' },
      '.MuiChip-colorWarning': { backgroundColor: 'var(--mui-palette-warning-main) !important', color: 'var(--mui-palette-warning-contrastText) !important', border: 'none !important' },
      '.MuiChip-colorInfo': { backgroundColor: 'var(--mui-palette-info-main) !important', color: 'var(--mui-palette-info-contrastText) !important', border: 'none !important' }
    }),

    // Dracula Theme
    ...(globalTheme.id === 'dracula' && {
      // Header
      '.ts-vertical-layout-header, .ts-horizontal-layout-header': {
        backgroundColor: '#282a36 !important',
        borderBottom: '1px solid #44475a !important'
      },
      '.ts-vertical-layout-navbar, .ts-horizontal-layout-navbar': {
        backgroundColor: '#282a36 !important'
      },
      '.ts-vertical-layout-navbar *, .ts-horizontal-layout-navbar *': {
        color: '#f8f8f2 !important'
      },

      // Sidebar
      '.ts-vertical-nav-root, .ts-vertical-nav-container, .ts-vertical-nav-bg-color-container': {
        backgroundColor: '#21222c !important'
      },
      '.ts-vertical-nav-root .ts-menu-button': {
        color: '#f8f8f2 !important'
      },
      '.ts-vertical-nav-root .ts-menu-icon': {
        color: '#bd93f9 !important'
      },
      '.ts-vertical-nav-root .ts-menu-section-label': {
        color: '#6272a4 !important'
      },
      '.ts-vertical-nav-root .ts-menuitem-root > .ts-menu-button:hover': {
        backgroundColor: '#44475a !important',
        color: '#f8f8f2 !important'
      },
      '.ts-vertical-nav-root .ts-menuitem-root.ts-active > .ts-menu-button': {
        backgroundColor: 'rgba(189, 147, 249, 0.2) !important',
        color: '#bd93f9 !important',
        borderLeft: '3px solid #bd93f9 !important'
      },
      '.ts-vertical-nav-root .ts-menuitem-root.ts-active > .ts-menu-button .ts-menu-icon': {
        color: '#ff79c6 !important'
      },

      // Content area overrides via CSS vars
      ...createContentOverrides({
        bg: '--dracula-bg',
        surface: '--dracula-surface',
        surfaceAlt: '--dracula-surface',
        border: '--dracula-border',
        text: '--dracula-text',
        textSecondary: '--dracula-comment',
        accent: '--dracula-accent',
        accentText: '--dracula-bg',
        hover: '--dracula-hover'
      }),
      // #538 : badges pleins (couleurs sémantiques par défaut), lisibles en clair comme en sombre
      '.MuiChip-colorSuccess': { backgroundColor: 'var(--mui-palette-success-main) !important', color: 'var(--mui-palette-success-contrastText) !important', border: 'none !important' },
      '.MuiChip-colorError': { backgroundColor: 'var(--mui-palette-error-main) !important', color: 'var(--mui-palette-error-contrastText) !important', border: 'none !important' },
      '.MuiChip-colorWarning': { backgroundColor: 'var(--mui-palette-warning-main) !important', color: 'var(--mui-palette-warning-contrastText) !important', border: 'none !important' },
      '.MuiChip-colorInfo': { backgroundColor: 'var(--mui-palette-info-main) !important', color: 'var(--mui-palette-info-contrastText) !important', border: 'none !important' }
    }),

    // One Dark Theme (Atom/VS Code)
    ...(globalTheme.id === 'oneDark' && {
      // Header
      '.ts-vertical-layout-header, .ts-horizontal-layout-header': {
        backgroundColor: '#21252b !important',
        borderBottom: '1px solid #181a1f !important'
      },
      '.ts-vertical-layout-navbar, .ts-horizontal-layout-navbar': {
        backgroundColor: '#21252b !important'
      },
      '.ts-vertical-layout-navbar *, .ts-horizontal-layout-navbar *': {
        color: '#abb2bf !important'
      },

      // Sidebar
      '.ts-vertical-nav-root, .ts-vertical-nav-container, .ts-vertical-nav-bg-color-container': {
        backgroundColor: '#282c34 !important'
      },
      '.ts-vertical-nav-root .ts-menu-button': {
        color: '#abb2bf !important'
      },
      '.ts-vertical-nav-root .ts-menu-icon': {
        color: '#61afef !important'
      },
      '.ts-vertical-nav-root .ts-menu-section-label': {
        color: '#5c6370 !important'
      },
      '.ts-vertical-nav-root .ts-menuitem-root > .ts-menu-button:hover': {
        backgroundColor: '#2c313a !important',
        color: '#d7dae0 !important'
      },
      '.ts-vertical-nav-root .ts-menuitem-root.ts-active > .ts-menu-button': {
        backgroundColor: 'rgba(97, 175, 239, 0.15) !important',
        color: '#61afef !important',
        borderLeft: '3px solid #61afef !important'
      },
      '.ts-vertical-nav-root .ts-menuitem-root.ts-active > .ts-menu-button .ts-menu-icon': {
        color: '#61afef !important'
      },

      // Content area overrides via CSS vars
      ...createContentOverrides({
        bg: '--onedark-bg',
        surface: '--onedark-bg-secondary',
        surfaceAlt: '--onedark-bg-secondary',
        border: '--onedark-border',
        text: '--onedark-text',
        textSecondary: '--onedark-text-secondary',
        accent: '--onedark-accent',
        accentText: '--onedark-bg',
        hover: '--onedark-hover'
      }),
      // #538 : badges pleins (couleurs sémantiques par défaut), lisibles en clair comme en sombre
      '.MuiChip-colorSuccess': { backgroundColor: 'var(--mui-palette-success-main) !important', color: 'var(--mui-palette-success-contrastText) !important', border: 'none !important' },
      '.MuiChip-colorError': { backgroundColor: 'var(--mui-palette-error-main) !important', color: 'var(--mui-palette-error-contrastText) !important', border: 'none !important' },
      '.MuiChip-colorWarning': { backgroundColor: 'var(--mui-palette-warning-main) !important', color: 'var(--mui-palette-warning-contrastText) !important', border: 'none !important' },
      '.MuiChip-colorInfo': { backgroundColor: 'var(--mui-palette-info-main) !important', color: 'var(--mui-palette-info-contrastText) !important', border: 'none !important' }
    }),

    // Glassmorphism Theme - special glass effects on sidebar too
    ...(globalTheme.id === 'glassmorphism' && !isLightMode && {
      // Sidebar with glass effect
      '.ts-vertical-nav-root, .ts-vertical-nav-container, .ts-vertical-nav-bg-color-container': {
        backgroundColor: 'rgba(30, 30, 45, 0.8) !important',
        backdropFilter: `${effectiveBlur} !important`,
        borderRight: '1px solid rgba(255, 255, 255, 0.08) !important'
      },
      '.ts-vertical-layout-header, .ts-horizontal-layout-header': {
        backgroundColor: 'rgba(30, 30, 45, 0.85) !important',
        backdropFilter: `${effectiveBlur} !important`,
        borderBottom: '1px solid rgba(255, 255, 255, 0.08) !important'
      },
      '.ts-vertical-layout-navbar, .ts-horizontal-layout-navbar': {
        backgroundColor: 'transparent !important'
      }
    }),

    // Neumorphism Theme - soft shadows (sidebar only, dark mode)
    ...(globalTheme.id === 'neumorphism' && !isLightMode && {
      '.ts-vertical-nav-root, .ts-vertical-nav-container, .ts-vertical-nav-bg-color-container': {
        backgroundColor: '#1e1e2d !important',
        boxShadow: 'inset -4px 0 8px rgba(0,0,0,0.3), inset 4px 0 8px rgba(255,255,255,0.02) !important'
      }
    }),

    // ============================================================
    // GLASSMORPHISM CONTENT OVERRIDES - via CSS vars + backdrop-blur
    // ============================================================
    ...(globalTheme.id === 'glassmorphism' && {
      ...createContentOverrides({
        bg: '--glass-body',
        surface: '--glass-card',
        surfaceAlt: '--glass-surface',
        border: '--glass-border',
        text: '--glass-text',
        textSecondary: '--glass-text-secondary',
        accent: '--glass-accent',
        hover: '--glass-hover'
      }),
      // Override selectors that need backdrop-filter
      '.MuiCard-root': {
        backgroundColor: 'var(--glass-card) !important',
        borderColor: 'var(--glass-border) !important',
        backdropFilter: `${effectiveBlur} !important`
      },
      '.MuiTableHead-root .MuiTableCell-root': {
        backgroundColor: 'var(--glass-surface) !important',
        borderBottom: '1px solid var(--glass-border) !important',
        color: 'var(--glass-text) !important',
        fontWeight: '600 !important',
        backdropFilter: 'blur(8px) !important'
      },
      '.MuiOutlinedInput-root': {
        backgroundColor: 'var(--glass-surface) !important',
        backdropFilter: 'blur(8px) !important',
        '& .MuiOutlinedInput-notchedOutline': {
          borderColor: 'var(--glass-border) !important'
        },
        '&:hover .MuiOutlinedInput-notchedOutline': {
          borderColor: 'var(--glass-accent) !important'
        },
        '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
          borderColor: 'var(--glass-accent) !important'
        }
      },
      '.MuiButton-containedPrimary': {
        backgroundColor: 'var(--glass-accent) !important',
        color: '#ffffff !important',
        backdropFilter: 'blur(8px) !important',
        '&:hover': {
          filter: 'brightness(1.1) !important'
        }
      },
      '.MuiChip-root': {
        backdropFilter: 'blur(4px) !important'
      },
      '.MuiDialog-paper, .MuiPopover-paper, .MuiMenu-paper': {
        backgroundColor: 'var(--glass-dialog) !important',
        backdropFilter: `${effectiveBlur} !important`,
        border: '1px solid var(--glass-border) !important'
      }
    }),

    // ============================================================
    // NEUMORPHISM CONTENT OVERRIDES - via CSS vars + neumorphic shadows
    // ============================================================
    ...(globalTheme.id === 'neumorphism' && {
      ...createContentOverrides({
        bg: '--neu-bg',
        surface: '--neu-surface',
        surfaceAlt: '--neu-surface-alt',
        border: '--neu-border',
        text: '--neu-text',
        textSecondary: '--neu-text-secondary',
        accent: '--neu-accent',
        accentHover: '--neu-accent-hover',
        hover: '--neu-hover'
      }),
      // Override with neumorphic shadows
      '.MuiCard-root': {
        backgroundColor: 'var(--neu-surface) !important',
        border: 'none !important',
        boxShadow: 'var(--neu-card-shadow) !important'
      },
      '.MuiOutlinedInput-root': {
        backgroundColor: 'var(--neu-surface) !important',
        boxShadow: 'var(--neu-input-shadow) !important',
        '& .MuiOutlinedInput-notchedOutline': {
          borderColor: 'transparent !important'
        },
        '&:hover .MuiOutlinedInput-notchedOutline': {
          borderColor: 'var(--neu-accent) !important'
        },
        '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
          borderColor: 'var(--neu-accent) !important'
        }
      },
      '.MuiButton-containedPrimary': {
        backgroundColor: 'var(--neu-accent) !important',
        color: '#ffffff !important',
        boxShadow: 'var(--neu-button-shadow) !important',
        '&:hover': {
          backgroundColor: 'var(--neu-accent-hover) !important'
        }
      },
      '.MuiChip-root': {
        boxShadow: 'var(--neu-chip-shadow) !important',
        border: 'none !important'
      },
      '.MuiDialog-paper, .MuiPopover-paper, .MuiMenu-paper': {
        backgroundColor: 'var(--neu-surface) !important',
        boxShadow: 'var(--neu-dialog-shadow) !important',
        border: 'none !important'
      },
      '*::-webkit-scrollbar-thumb': {
        backgroundColor: 'var(--neu-border) !important',
        borderRadius: '10px !important',
        '&:hover': {
          backgroundColor: 'var(--neu-accent) !important'
        }
      }
    }),

    // ============================================================
    // CORPORATE THEME - via CSS vars
    // ============================================================
    ...(globalTheme.id === 'corporate' && {
      ...createContentOverrides({
        bg: '--corp-bg',
        surface: '--corp-surface',
        surfaceAlt: '--corp-surface-alt',
        border: '--corp-border',
        text: '--corp-text',
        textSecondary: '--corp-text-secondary',
        accent: '--corp-accent',
        accentHover: '--corp-accent-hover',
        hover: '--corp-hover'
      }),
      // #538 : badges pleins (couleurs sémantiques par défaut), lisibles en clair comme en sombre
      '.MuiChip-colorSuccess': { backgroundColor: 'var(--mui-palette-success-main) !important', color: 'var(--mui-palette-success-contrastText) !important', border: 'none !important' },
      '.MuiChip-colorError': { backgroundColor: 'var(--mui-palette-error-main) !important', color: 'var(--mui-palette-error-contrastText) !important', border: 'none !important' },
      '.MuiChip-colorWarning': { backgroundColor: 'var(--mui-palette-warning-main) !important', color: 'var(--mui-palette-warning-contrastText) !important', border: 'none !important' },
      '.MuiChip-colorInfo': { backgroundColor: 'var(--mui-palette-info-main) !important', color: 'var(--mui-palette-info-contrastText) !important', border: 'none !important' },
      '.MuiButton-containedPrimary': {
        backgroundColor: 'var(--corp-accent) !important',
        color: '#ffffff !important',
        '&:hover': {
          backgroundColor: 'var(--corp-accent-hover) !important'
        }
      }
    }),

    // ============================================================
    // MINIMAL THEME - via CSS vars
    // ============================================================
    ...(globalTheme.id === 'minimal' && {
      ...createContentOverrides({
        bg: '--min-bg',
        surface: '--min-surface',
        surfaceAlt: '--min-surface-alt',
        border: '--min-border',
        text: '--min-text',
        textSecondary: '--min-text-secondary',
        accent: '--min-accent',
        accentHover: '--min-accent-hover',
        hover: '--min-hover'
      }),
      '.MuiCard-root': {
        backgroundColor: 'var(--min-surface) !important',
        borderColor: 'var(--min-border) !important',
        boxShadow: 'none !important'
      },
      '.MuiButton-containedPrimary': {
        backgroundColor: 'var(--min-accent) !important',
        color: '#ffffff !important',
        boxShadow: 'none !important',
        '&:hover': {
          backgroundColor: 'var(--min-accent-hover) !important',
          boxShadow: 'none !important'
        }
      },
      '.MuiDialog-paper, .MuiPopover-paper, .MuiMenu-paper': {
        backgroundColor: 'var(--min-surface) !important',
        border: '1px solid var(--min-border) !important',
        boxShadow: '0 2px 8px rgba(0,0,0,0.15) !important'
      }
    }),

    // ============================================================
    // ROUNDED THEME - via CSS vars
    // ============================================================
    ...(globalTheme.id === 'rounded' && {
      ...createContentOverrides({
        bg: '--round-bg',
        surface: '--round-surface',
        surfaceAlt: '--round-surface-alt',
        border: '--round-border',
        text: '--round-text',
        textSecondary: '--round-text-secondary',
        accent: '--round-accent',
        accentHover: '--round-accent-hover',
        hover: '--round-hover'
      }),
      // #538 : badges pleins (couleurs sémantiques par défaut), lisibles en clair comme en sombre
      '.MuiChip-colorSuccess': { backgroundColor: 'var(--mui-palette-success-main) !important', color: 'var(--mui-palette-success-contrastText) !important', border: 'none !important' },
      '.MuiChip-colorError': { backgroundColor: 'var(--mui-palette-error-main) !important', color: 'var(--mui-palette-error-contrastText) !important', border: 'none !important' },
      '.MuiChip-colorWarning': { backgroundColor: 'var(--mui-palette-warning-main) !important', color: 'var(--mui-palette-warning-contrastText) !important', border: 'none !important' },
      '.MuiChip-colorInfo': { backgroundColor: 'var(--mui-palette-info-main) !important', color: 'var(--mui-palette-info-contrastText) !important', border: 'none !important' },
      '.MuiButton-containedPrimary': {
        backgroundColor: 'var(--round-accent) !important',
        color: 'var(--round-bg) !important',
        '&:hover': {
          backgroundColor: 'var(--round-accent-hover) !important'
        }
      }
    }),

    // ============================================================
    // HIGH CONTRAST THEME - via CSS vars, WCAG AAA
    // ============================================================
    ...(globalTheme.id === 'highContrast' && {
      ...createContentOverrides({
        bg: '--hc-bg',
        surface: '--hc-surface',
        surfaceAlt: '--hc-surface-alt',
        border: '--hc-border',
        text: '--hc-text',
        accent: '--hc-focus',
        hover: '--hc-hover'
      }),
      // Override with thick borders and no shadows
      '.MuiCard-root': {
        backgroundColor: 'var(--hc-surface) !important',
        border: '2px solid var(--hc-border) !important',
        boxShadow: 'none !important'
      },
      '.MuiTableHead-root .MuiTableCell-root': {
        backgroundColor: 'var(--hc-hover) !important',
        borderBottom: '2px solid var(--hc-border) !important',
        color: 'var(--hc-text) !important',
        fontWeight: '700 !important'
      },
      '.MuiTableBody-root .MuiTableCell-root': {
        borderBottom: '2px solid var(--hc-border) !important',
        color: 'var(--hc-text) !important'
      },
      '.MuiOutlinedInput-root': {
        backgroundColor: 'var(--hc-surface) !important',
        '& .MuiOutlinedInput-notchedOutline': {
          borderColor: 'var(--hc-border) !important',
          borderWidth: '2px !important'
        },
        '&:hover .MuiOutlinedInput-notchedOutline': {
          borderColor: 'var(--hc-focus) !important'
        },
        '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
          borderColor: 'var(--hc-focus) !important',
          borderWidth: '3px !important'
        }
      },
      '.MuiButton-containedPrimary': {
        backgroundColor: 'var(--hc-focus) !important',
        color: 'var(--hc-bg) !important',
        fontWeight: '700 !important',
        boxShadow: 'none !important',
        border: '2px solid var(--hc-border) !important',
        '&:hover': {
          filter: 'brightness(0.85) !important'
        }
      },
      '.MuiButton-root:focus-visible': {
        outline: '3px solid var(--hc-focus) !important',
        outlineOffset: '2px !important'
      },
      '.MuiChip-root': {
        border: '2px solid var(--hc-border) !important',
        fontWeight: '600 !important',
        boxShadow: 'none !important'
      },
      '.MuiChip-colorSuccess': {
        backgroundColor: 'var(--hc-success) !important',
        color: 'var(--hc-bg) !important'
      },
      '.MuiChip-colorError': {
        backgroundColor: 'var(--hc-error) !important',
        color: '#ffffff !important'
      },
      '.MuiChip-colorWarning': {
        backgroundColor: 'var(--hc-warning) !important',
        color: 'var(--hc-bg) !important'
      },
      '.MuiTabs-indicator': {
        backgroundColor: 'var(--hc-focus) !important',
        height: '3px !important'
      },
      '.MuiTab-root.Mui-selected': {
        color: 'var(--hc-focus) !important',
        fontWeight: '700 !important'
      },
      '.MuiDialog-paper, .MuiPopover-paper, .MuiMenu-paper': {
        backgroundColor: 'var(--hc-surface) !important',
        border: '2px solid var(--hc-border) !important',
        boxShadow: 'none !important'
      },
      '.MuiDivider-root': {
        borderColor: 'var(--hc-border) !important',
        borderWidth: '1px !important'
      },
      'a, .MuiLink-root': {
        color: 'var(--hc-link) !important',
        textDecoration: 'underline !important'
      },
      '*::-webkit-scrollbar-thumb': {
        backgroundColor: 'var(--hc-text) !important',
        border: '2px solid var(--hc-border) !important',
        '&:hover': {
          backgroundColor: 'var(--hc-focus) !important'
        }
      },
      '*:focus-visible': {
        outline: '3px solid var(--hc-focus) !important',
        outlineOffset: '2px !important'
      }
    }),

    // Nebula is intentionally last so its semantic component states win over
    // the generic theme geometry above without changing any other theme.
    ...(globalTheme.id === 'nebula' && createNebulaGlobalStyles(mode)),
    ...(globalTheme.id === 'vcenterClassic' && createVcenterGlobalStyles(mode))
  }
}

const CustomThemeProvider = props => {
  // Props
  const { children, direction } = props

  // Hooks
  const { settings } = useSettings()
  const currentMode = lockedThemeSettings.mode

  // Get global theme configuration
  const globalTheme = useMemo(() => {
    return getGlobalTheme(lockedThemeSettings.globalTheme)
  }, [])

  // Get light background configuration
  const lightBg = useMemo(() => {
    return getLightBackground(settings.lightBackground || 'neutral')
  }, [settings.lightBackground])

  // Generate global styles for the selected theme
  const globalStyles = useMemo(() => {
    const customBorderRadius = settings.customBorderRadius
    const blurIntensity = settings.blurIntensity
    const fontSize = settings.fontSize
    const uiScale = settings.uiScale
    const baseStyles = getGlobalThemeStyles(globalTheme, currentMode, customBorderRadius, blurIntensity, fontSize, uiScale)
    
    // Add light background overrides if in light mode (for non-neutral tints)
    if (globalTheme.id !== 'nebula' && currentMode === 'light' && lightBg.id !== 'neutral') {
      return {
        ...baseStyles,
        ':root': {
          ...baseStyles[':root'],
          '--light-bg-body': lightBg.colors.body,
          '--light-bg-paper': lightBg.colors.paper,
          '--light-bg-paper-alt': lightBg.colors.paperAlt,
          '--light-bg-default': lightBg.colors.default,
          '--light-bg-hover': lightBg.colors.hover,
          '--light-bg-border': lightBg.colors.border,

          // Override MUI CSS variables for background
          '--mui-palette-background-default': lightBg.colors.body,
          '--mui-palette-background-paper': lightBg.colors.paper
        },

        // Page background - multiple selectors for specificity
        'body': {
          ...baseStyles['body'],
          backgroundColor: `${lightBg.colors.body} !important`
        },
        'html body': {
          backgroundColor: `${lightBg.colors.body} !important`
        },

        // Main content area
        'main': {
          backgroundColor: `${lightBg.colors.body} !important`
        },
        '.MuiContainer-root': {
          backgroundColor: 'transparent !important'
        },

        // Sidebar & Header
        '.MuiDrawer-paper': {
          backgroundColor: `${lightBg.colors.paper} !important`
        },
        '.MuiAppBar-root': {
          backgroundColor: `${lightBg.colors.paper} !important`
        },

        // ALL Paper components - maximum specificity
        '.MuiPaper-root': {
          backgroundColor: `${lightBg.colors.paper} !important`
        },
        'div.MuiPaper-root': {
          backgroundColor: `${lightBg.colors.paper} !important`
        },

        // Cards - multiple selectors for maximum coverage
        '.MuiCard-root': {
          backgroundColor: `${lightBg.colors.paper} !important`,
          borderColor: `${lightBg.colors.border} !important`
        },
        'div.MuiCard-root': {
          backgroundColor: `${lightBg.colors.paper} !important`,
          borderColor: `${lightBg.colors.border} !important`
        },
        '.MuiCard-root.MuiPaper-root': {
          backgroundColor: `${lightBg.colors.paper} !important`,
          borderColor: `${lightBg.colors.border} !important`
        },

        // Card content
        '.MuiCardContent-root': {
          backgroundColor: 'transparent !important'
        },

        // Cards with custom inline background - preserve their colors but add tinted border
        '.MuiCard-root[style*="background"]': {
          borderRadius: 'var(--unicenter-card-radius, 12px) !important'
        },
        '.MuiCard-root[style*="linear-gradient"]': {
          borderRadius: 'var(--unicenter-card-radius, 12px) !important'
        },

        // Dialogs
        '.MuiDialog-paper': {
          backgroundColor: `${lightBg.colors.paper} !important`
        },
        '.MuiDialog-paper.MuiPaper-root': {
          backgroundColor: `${lightBg.colors.paper} !important`
        },

        // Menus & Popovers
        '.MuiMenu-paper': {
          backgroundColor: `${lightBg.colors.paper} !important`,
          borderColor: `${lightBg.colors.border} !important`
        },
        '.MuiPopover-paper': {
          backgroundColor: `${lightBg.colors.paper} !important`,
          borderColor: `${lightBg.colors.border} !important`
        },
        '.MuiAutocomplete-paper': {
          backgroundColor: `${lightBg.colors.paper} !important`,
          borderColor: `${lightBg.colors.border} !important`
        },

        // Table
        '.MuiTableContainer-root': {
          backgroundColor: `${lightBg.colors.paper} !important`
        },
        '.MuiTableHead-root': {
          backgroundColor: `${lightBg.colors.default} !important`
        },
        '.MuiTableCell-head': {
          backgroundColor: `${lightBg.colors.default} !important`
        },
        '.MuiTableCell-root': {
          borderColor: `${lightBg.colors.border} !important`
        },

        // Inputs - outlined
        '.MuiOutlinedInput-root': {
          backgroundColor: `${lightBg.colors.paper} !important`
        },
        '.MuiOutlinedInput-notchedOutline': {
          borderColor: `${lightBg.colors.border} !important`
        },

        // Inputs - filled
        '.MuiFilledInput-root': {
          backgroundColor: `${lightBg.colors.default} !important`
        },
        '.MuiFilledInput-root:hover': {
          backgroundColor: `${lightBg.colors.hover} !important`
        },

        // Tabs
        '.MuiTabs-root': {
          backgroundColor: `${lightBg.colors.default} !important`
        },
        '.MuiTab-root': {
          backgroundColor: 'transparent !important'
        },

        // Tab panel
        '.MuiTabPanel-root': {
          backgroundColor: 'transparent !important'
        },

        // Accordion
        '.MuiAccordion-root': {
          backgroundColor: `${lightBg.colors.paper} !important`
        },

        // Alert standard variants
        '.MuiAlert-standard': {
          backgroundColor: `${lightBg.colors.default} !important`
        },
        '.MuiAlert-standardInfo': {
          backgroundColor: `${lightBg.colors.default} !important`
        },

        // Chip
        '.MuiChip-root': {
          borderColor: `${lightBg.colors.border} !important`
        },
        '.MuiChip-outlined': {
          borderColor: `${lightBg.colors.border} !important`
        },

        // Dividers
        '.MuiDivider-root': {
          borderColor: `${lightBg.colors.border} !important`
        },

        // List
        '.MuiList-root': {
          backgroundColor: 'transparent !important'
        },
        '.MuiListItem-root:hover': {
          backgroundColor: `${lightBg.colors.hover} !important`
        },

        // Select
        '.MuiSelect-select': {
          backgroundColor: 'transparent !important'
        },

        // Toggle buttons
        '.MuiToggleButtonGroup-root': {
          backgroundColor: `${lightBg.colors.default} !important`
        },
        '.MuiToggleButton-root': {
          borderColor: `${lightBg.colors.border} !important`
        }
      }
    }
    
    return baseStyles
  }, [globalTheme, currentMode, lightBg, settings.customBorderRadius, settings.blurIntensity, settings.fontSize, settings.uiScale])

  // Merge the primary color scheme override with the core theme
  const theme = useMemo(() => {
    // The current product runtime is fixed to Nebula. Tenant branding and
    // historical appearance values remain stored for compatibility, but they
    // must not alter the application palette in this release.
    const isNebula = globalTheme.id === 'nebula'
    const isVcenterClassic = globalTheme.id === 'vcenterClassic'
    const effectivePrimaryColor = lockedThemeSettings.primaryColor

    // Build light palette with custom background
    const defaultLightPalette = {
      primary: {
        main: effectivePrimaryColor,
        light: lighten(effectivePrimaryColor, 0.2),
        dark: darken(effectivePrimaryColor, 0.1)
      },
      background: {
        default: lightBg.colors.body,
        paper: lightBg.colors.paper
      },
      divider: lightBg.colors.border
    }

    const lightPalette = isNebula
      ? createNebulaPalette('light', effectivePrimaryColor)
      : isVcenterClassic
        ? createVcenterPalette('light')
        : defaultLightPalette
    const darkPalette = isNebula
      ? createNebulaPalette('dark', effectivePrimaryColor)
      : isVcenterClassic
        ? createVcenterPalette('dark')
        : {
          primary: {
            main: effectivePrimaryColor,
            light: lighten(effectivePrimaryColor, 0.2),
            dark: darken(effectivePrimaryColor, 0.1)
          }
        }

    const newTheme = {
      colorSchemes: {
        light: {
          palette: lightPalette
        },
        dark: {
          palette: darkPalette
        }
      },
      cssVariables: {
        colorSchemeSelector: 'data'
      }
    }

    const coreTheme = deepmerge(defaultCoreTheme(settings, currentMode, direction), newTheme)

    return createTheme(coreTheme)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings.skin, settings.lightBackground, settings.customBorderRadius, settings.blurIntensity, settings.density, currentMode, lightBg])

  return (
    <AppRouterCacheProvider
      options={{
        prepend: true,
        ...(direction === 'rtl' && {
          key: 'rtl',
          stylisPlugins: [stylisRTLPlugin]
        })
      }}
    >
      <ThemeProvider
        theme={theme}
        defaultMode={lockedThemeSettings.mode}
        modeStorageKey={lockedMuiModeStorageKey}
        forceThemeRerender
      >
        <>
          <ModeChanger />
          <CssBaseline />
          <GlobalStyles styles={globalStyles} />
          {children}
        </>
      </ThemeProvider>
    </AppRouterCacheProvider>
  )
}

export default CustomThemeProvider
