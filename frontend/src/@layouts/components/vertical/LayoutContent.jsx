'use client'

// Third-party Imports
import classnames from 'classnames'
import { usePathname } from 'next/navigation'

// Hook Imports
import { useSettings } from '@core/hooks/useSettings'
import { usePageTitle } from '@/contexts/PageTitleContext'

// Util Imports
import { verticalLayoutClasses } from '@layouts/utils/layoutClasses'

// Styled Component Imports
import StyledMain from '@layouts/styles/shared/StyledMain'

const LayoutContent = ({ children }) => {
  // Hooks
  const { settings } = useSettings()
  const pathname = usePathname()
  const { title, subtitle } = usePageTitle()

  // Vars
  const contentCompact = settings.contentWidth === 'compact'
  const contentWide = settings.contentWidth === 'wide'
  const isVcenterClassic = settings.globalTheme === 'vcenterClassic'
  const isHome = pathname === '/home'
  const classicTitle = isHome ? '全局摘要' : title || 'UniCenter'
  const classicSubtitle = isHome ? '统一查看集群、单节点、虚拟机与服务状态' : subtitle

  return (
    <StyledMain
      isContentCompact={contentCompact}
      className={classnames(verticalLayoutClasses.content, 'flex-auto', {
        [`${verticalLayoutClasses.contentCompact} is-full`]: contentCompact,
        [verticalLayoutClasses.contentWide]: contentWide
      })}
    >
      {isVcenterClassic && (
        <section className='vcenter-classic-page-heading'>
          <div className='vcenter-classic-breadcrumb'>UniCenter / 首页 / {classicTitle}</div>
          <div className='vcenter-classic-page-heading__row'>
            <div>
              <h1>{classicTitle}</h1>
              {classicSubtitle && <p>{classicSubtitle}</p>}
            </div>
            <span className='vcenter-classic-source'>UniCenter 实时环境</span>
          </div>
        </section>
      )}
      {children}
    </StyledMain>
  )
}

export default LayoutContent
