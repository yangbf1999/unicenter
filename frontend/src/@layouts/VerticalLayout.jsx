'use client'

// Third-party Imports
import classnames from 'classnames'

// Component Imports
import LayoutContent from './components/vertical/LayoutContent'

// Hook Imports
import { useSettings } from '@core/hooks/useSettings'

// Util Imports
import { verticalLayoutClasses } from './utils/layoutClasses'

// Styled Component Imports
import StyledContentWrapper from './styles/vertical/StyledContentWrapper'

const VerticalLayout = props => {
  // Props
  const { navbar, footer, navigation, children } = props
  const { settings } = useSettings()
  const isVcenterClassic = settings.globalTheme === 'vcenterClassic'

  return (
    <div
      className={classnames(verticalLayoutClasses.root, {
        'flex flex-auto': !isVcenterClassic,
        'vcenter-classic-layout': isVcenterClassic
      })}
    >
      {navigation || null}
      <StyledContentWrapper
        className={classnames(verticalLayoutClasses.contentWrapper, 'min-is-0 is-full', {
          'flex flex-col': !isVcenterClassic
        })}
      >
        {navbar || null}
        {/* Content */}
        <LayoutContent>{children}</LayoutContent>
        {footer || null}
      </StyledContentWrapper>
    </div>
  )
}

export default VerticalLayout
