'use client'

// React Imports
import { useEffect, useRef, useState } from 'react'

// Next Imports
import Link from 'next/link'

// MUI Imports
import { styled, useColorScheme, useTheme } from '@mui/material/styles'
import Box from '@mui/material/Box'

// Component Imports
import VerticalNav, { NavHeader, NavCollapseIcons } from '@menu/vertical-menu'
import VerticalMenu from './VerticalMenu'
import Logo from '@components/layout/shared/Logo'

// Hook Imports
import useVerticalNav from '@menu/hooks/useVerticalNav'
import { useSettings } from '@core/hooks/useSettings'

// Style Imports
import navigationCustomStyles from '@core/styles/vertical/navigationCustomStyles'
import { verticalNavClasses } from '@menu/utils/menuClasses'

const StyledBoxForShadow = styled('div')(({ theme }) => ({
  top: 'var(--nebula-header-height, 60px)',
  left: -8,
  zIndex: 2,
  opacity: 0,
  position: 'absolute',
  pointerEvents: 'none',
  width: 'calc(100% + 15px)',
  height: theme.mixins.toolbar.minHeight,
  transition: 'opacity .15s ease-in-out',
  background: `linear-gradient(var(--mui-palette-background-default) ${theme.direction === 'rtl' ? '95%' : '5%'}, color-mix(in srgb, var(--mui-palette-background-default) 85%, transparent) 30%, color-mix(in srgb, var(--mui-palette-background-default) 50%, transparent) 65%, color-mix(in srgb, var(--mui-palette-background-default) 30%, transparent) 75%, transparent)`,
}))

// Zone de déclenchement pour faire réapparaître la sidebar
const HoverTriggerZone = styled('div')({
  position: 'fixed',
  left: 0,
  // Keeps the strip below a fixed top banner and above the fixed tasks bar; each var is 0px when hidden.
  top: 'var(--top-banner-height, 0px)',
  width: 12,
  height: 'calc(100vh - var(--top-banner-height, 0px) - var(--taskbar-height, 0px))',
  zIndex: 1300,
  cursor: 'pointer',
})

const Navigation = props => {
  // Props
  const { mode } = props

  // Hooks
  const verticalNavOptions = useVerticalNav()
  const { updateSettings, settings } = useSettings()
  const { mode: muiMode, systemMode: muiSystemMode } = useColorScheme()
  const theme = useTheme()

  // Refs
  const shadowRef = useRef(null)
  const hoverTimeoutRef = useRef(null)

  // State pour le mode hidden hover
  const [isHiddenHovered, setIsHiddenHovered] = useState(false)

  // Vars
  const { isCollapsed, isHovered, collapseVerticalNav, isBreakpointReached } = verticalNavOptions
  const isSemiDark = settings.semiDark
  const currentMode = muiMode === 'system' ? muiSystemMode : muiMode || mode
  const isDark = currentMode === 'dark'
  const isHidden = settings.layout === 'hidden' && settings.globalTheme !== 'vcenterClassic'
  const isNebula = settings.globalTheme === 'nebula'
  const isVcenterClassic = settings.globalTheme === 'vcenterClassic'
  const navigationWidth = isNebula ? 224 : isVcenterClassic ? 180 : undefined
  const collapsedNavigationWidth = isNebula ? 64 : isVcenterClassic ? 56 : 68
  const navigationBackground = isNebula
    ? 'var(--nebula-bg-navigation)'
    : isVcenterClassic
      ? 'var(--vcenter-navigation)'
      : 'var(--mui-palette-background-default)'
  const baseNavigationStyles = navigationCustomStyles(verticalNavOptions, theme)
  const navigationStyles = {
    ...baseNavigationStyles,
    ...((isNebula || isVcenterClassic) && {
      [`& .${verticalNavClasses.header}`]: {
        ...baseNavigationStyles[`& .${verticalNavClasses.header}`],
        display: isVcenterClassic ? 'none' : undefined,
        blockSize: isVcenterClassic ? 0 : 'var(--nebula-header-height, 56px)',
        minBlockSize: isVcenterClassic ? 0 : 'var(--nebula-header-height, 56px)',
        paddingBlock: 0,
        borderBlockEnd: isVcenterClassic ? 0 : '1px solid var(--mui-palette-divider)'
      },
      [`& .${verticalNavClasses.container}`]: {
        ...baseNavigationStyles[`& .${verticalNavClasses.container}`],
        borderColor: 'var(--mui-palette-divider)'
      }
    })
  }

  const scrollMenu = (container, isPerfectScrollbar) => {
    container = isBreakpointReached || !isPerfectScrollbar ? container.target : container

    if (shadowRef && container.scrollTop > 0) {
      if (!shadowRef.current?.classList.contains('scrolled')) {
        shadowRef.current?.classList.add('scrolled')
      }
    } else {
      shadowRef.current?.classList.remove('scrolled')
    }
  }

  useEffect(() => {
    if (isVcenterClassic) {
      collapseVerticalNav(false)
    } else if (settings.layout === 'collapsed') {
      collapseVerticalNav(true)
    } else if (settings.layout === 'hidden') {
      collapseVerticalNav(true)
    } else {
      collapseVerticalNav(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings.layout, isVcenterClassic])

  // Quand on entre en mode hidden+hovered, on force le menu à être déplié
  useEffect(() => {
    if (isHidden && isHiddenHovered) {
      collapseVerticalNav(false)
    } else if (isHidden && !isHiddenHovered) {
      collapseVerticalNav(true)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isHiddenHovered, isHidden])

  // Gestion du hover sur la zone de déclenchement
  const handleTriggerMouseEnter = () => {
    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current)
    setIsHiddenHovered(true)
  }

  const handleNavMouseLeave = () => {
    if (isHidden) {
      hoverTimeoutRef.current = setTimeout(() => {
        setIsHiddenHovered(false)
      }, 300)
    }
  }

  const handleNavMouseEnter = () => {
    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current)
  }

  // Cycle des modes: vertical -> collapsed -> hidden -> vertical
  const cycleLayout = () => {
    if (settings.layout === 'vertical') {
      updateSettings({ layout: 'collapsed' })
    } else if (settings.layout === 'collapsed') {
      updateSettings({ layout: 'hidden' })
    } else {
      updateSettings({ layout: 'vertical' })
      setIsHiddenHovered(false)
    }
  }

  // Si mode hidden et pas survolé, afficher seulement la zone de déclenchement
  if (isHidden && !isHiddenHovered) {
    return (
      <HoverTriggerZone 
        onMouseEnter={handleTriggerMouseEnter}
        sx={{
          '&::after': {
            content: '""',
            position: 'absolute',
            left: 3,
            top: '50%',
            transform: 'translateY(-50%)',
            width: 4,
            height: 48,
            borderRadius: 2,
            bgcolor: 'divider',
            opacity: 0.3,
            transition: 'all 0.2s',
          },
          '&:hover::after': {
            opacity: 1,
            bgcolor: 'primary.main',
            height: 64,
          }
        }}
      />
    )
  }

  // Si mode hidden et survolé, afficher le menu déplié en overlay fixe
  if (isHidden && isHiddenHovered) {
    return (
      <Box
        onMouseEnter={handleNavMouseEnter}
        onMouseLeave={handleNavMouseLeave}
        sx={{
          position: 'fixed',
          left: 0,
          // Keeps the overlay below a fixed top banner and above the fixed tasks bar; each var is 0px when hidden.
          top: 'var(--top-banner-height, 0px)',
          height: 'calc(100vh - var(--top-banner-height, 0px) - var(--taskbar-height, 0px))',
          zIndex: 1300,
          boxShadow: '4px 0 24px rgba(0,0,0,0.25)',
        }}
      >
        <VerticalNav
          customStyles={{
            ...navigationStyles,
            // The nav is a sibling of the padded content wrapper, so it must make
            // room for a fixed top banner and the fixed tasks bar on its own. Zero when neither is shown.
            insetBlockStart: 'var(--top-banner-height, 0px)',
            blockSize: 'calc(100dvh - var(--top-banner-height, 0px) - var(--taskbar-height, 0px))',
          }}
          width={navigationWidth}
          collapsedWidth={collapsedNavigationWidth}
          backgroundColor={navigationBackground}
          {...(isSemiDark && !isDark && { 'data-dark': '' })}
        >
          <NavHeader>
            <Link href='/'>
              <Logo />
            </Link>
            <NavCollapseIcons
              lockedIcon={<i className='ri-radio-button-line text-xl' />}
              unlockedIcon={<i className='ri-checkbox-blank-circle-line text-xl' />}
              closeIcon={<i className='ri-close-line text-xl' />}
              className='text-textSecondary'
              onClick={cycleLayout}
            />
          </NavHeader>
          <StyledBoxForShadow ref={shadowRef} />
          <VerticalMenu scrollMenu={scrollMenu} />
        </VerticalNav>
      </Box>
    )
  }

  // Mode normal (vertical ou collapsed)
  return (
    <VerticalNav
      customStyles={{
        ...navigationStyles,
        // The nav is a sibling of the padded content wrapper, so it must make
        // room for a fixed top banner and the fixed tasks bar on its own. Zero when neither is shown.
        insetBlockStart: isVcenterClassic ? '121px' : 'var(--top-banner-height, 0px)',
        blockSize: isVcenterClassic
          ? 'calc(100dvh - 121px - var(--top-banner-height, 0px) - var(--taskbar-height, 0px))'
          : 'calc(100dvh - var(--top-banner-height, 0px) - var(--taskbar-height, 0px))',
      }}
      width={navigationWidth}
      collapsedWidth={collapsedNavigationWidth}
      customBreakpoint={isVcenterClassic ? '560px' : undefined}
      backgroundColor={navigationBackground}
      {...(isSemiDark &&
        !isDark && {
          'data-dark': ''
        })}
    >
      {/* Nav Header including Logo & nav toggle icons  */}
      <NavHeader>
        <Link href='/' className={isVcenterClassic ? 'vcenter-classic-brand' : undefined}>
          {isVcenterClassic ? (
            <>
              <i className='ri-menu-line' aria-hidden />
              <strong>UniCenter</strong>
              <span>Infrastructure Client</span>
            </>
          ) : (
            <Logo />
          )}
        </Link>
        {!isVcenterClassic && !(isCollapsed && !isHovered) && (
          <NavCollapseIcons
            lockedIcon={<i className='ri-radio-button-line text-xl' />}
            unlockedIcon={<i className='ri-checkbox-blank-circle-line text-xl' />}
            closeIcon={<i className='ri-close-line text-xl' />}
            className='text-textSecondary'
            onClick={cycleLayout}
          />
        )}
      </NavHeader>
      <StyledBoxForShadow ref={shadowRef} />
      <VerticalMenu scrollMenu={scrollMenu} />
    </VerticalNav>
  )
}

export default Navigation
