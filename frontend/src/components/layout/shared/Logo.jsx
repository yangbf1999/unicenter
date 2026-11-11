'use client'

// React Imports
import { useEffect, useRef } from 'react'

// Third-party Imports
import styled from '@emotion/styled'

// Config Imports
import themeConfig from '@configs/themeConfig'

// Hook Imports
import useVerticalNav from '@menu/hooks/useVerticalNav'
import { useSettings } from '@core/hooks/useSettings'
import { useBranding } from '@/contexts/BrandingContext'

const LogoText = styled.span`
  color: ${({ color }) => color ?? 'var(--mui-palette-text-primary)'};
  font-size: 0.875rem;
  line-height: 1.2;
  font-weight: 700;
  letter-spacing: 0.02em;
  text-transform: uppercase;
  transition: ${({ transitionDuration }) =>
    `margin-inline-start ${transitionDuration}ms ease-in-out, opacity ${transitionDuration}ms ease-in-out`};

  ${({ isHovered, isCollapsed, isBreakpointReached }) =>
    !isBreakpointReached && isCollapsed && !isHovered
      ? 'opacity: 0; margin-inline-start: 0;'
      : 'opacity: 1; margin-inline-start: 10px;'}
`

export const BRAND_ICON_SRC = '/images/unicenter-icon.png'
export const BRAND_LOGO_SRC = '/images/unicenter-logo.png'

export const LogoIcon = ({ size = 24 }) => (
  <img
    src={BRAND_ICON_SRC}
    alt=''
    width={size}
    height={size}
    style={{ display: 'block', width: size, height: size, objectFit: 'cover', borderRadius: '18%' }}
  />
)

const Logo = ({ color }) => {
  // Refs
  const logoTextRef = useRef(null)

  // Hooks
  const { isHovered, transitionDuration, isBreakpointReached } = useVerticalNav()
  const { settings } = useSettings()
  const { branding, loading: brandingLoading } = useBranding()

  // Vars
  const { layout } = settings

  useEffect(() => {
    if (layout !== 'collapsed') {
      return
    }

    if (logoTextRef && logoTextRef.current) {
      if (!isBreakpointReached && layout === 'collapsed' && !isHovered) {
        logoTextRef.current?.classList.add('hidden')
      } else {
        logoTextRef.current.classList.remove('hidden')
      }
    }
  }, [isHovered, layout, isBreakpointReached])

  return (
    <div className='flex items-center min-bs-[24px]' style={{ opacity: brandingLoading ? 0 : 1, transition: 'opacity 0.2s ease-in' }}>
      {branding.logoUrl ? (
        <>
          <img src={branding.logoUrl} alt={branding.appName || themeConfig.templateName} style={{ height: 24, width: 'auto', objectFit: 'contain', borderRadius: 4 }} />
          <LogoText
            color={color}
            ref={logoTextRef}
            isHovered={isHovered}
            isCollapsed={layout === 'collapsed'}
            transitionDuration={transitionDuration}
            isBreakpointReached={isBreakpointReached}
          >
            {branding.appName || themeConfig.templateName}
          </LogoText>
        </>
      ) : !isBreakpointReached && layout === 'collapsed' && !isHovered ? (
        <LogoIcon size={28} />
      ) : (
        <img
          src={BRAND_LOGO_SRC}
          alt={themeConfig.templateName}
          style={{ display: 'block', width: 'auto', height: 30, maxWidth: 132, objectFit: 'contain', borderRadius: 4 }}
        />
      )}
    </div>
  )
}

export default Logo
