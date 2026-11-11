// Third-party Imports
import styled from '@emotion/styled'

// Config Imports
import themeConfig from '@configs/themeConfig'

// Util Imports
import { commonLayoutClasses } from '@layouts/utils/layoutClasses'

const StyledMain = styled.main`
  --content-padding: var(--nebula-content-padding, ${themeConfig.layoutPadding}px);
  padding: var(--content-padding);
  padding-bottom: calc(var(--content-padding) + var(--taskbar-height, 0px));
  flex: 1;
  display: flex;
  flex-direction: column;
  transition: padding-bottom 0.2s ease;
  overflow-y: auto;
  min-block-size: 0;
  min-inline-size: 0;

  @media (max-width: 1439.95px) {
    --content-padding: var(--nebula-content-padding-narrow, ${themeConfig.layoutPadding}px);
  }

  @media (max-width: 680px) {
    --content-padding: var(--nebula-content-padding-mobile, ${themeConfig.layoutPadding}px);
  }

  ${({ isContentCompact }) =>
    isContentCompact &&
    `
    margin-inline: auto;
    max-inline-size: ${themeConfig.compactContentWidth}px;
  `}

  &:has(.${commonLayoutClasses.contentHeightFixed}) {
    overflow: hidden;
  }

  /* No animation while the taskbar is being drag-resized (TasksFooter #582) */
  html[data-taskbar-resizing] & {
    transition: none;
  }
`

export default StyledMain
