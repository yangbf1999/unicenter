// Third-party Imports
import styled from '@emotion/styled'

// Config Imports
import themeConfig from '@configs/themeConfig'

// Util Imports
import { verticalLayoutClasses } from '@layouts/utils/layoutClasses'

const StyledHeader = styled.header`
  display: flex;
  align-items: center;
  justify-content: center;
  inline-size: 100%;
  shrink: 0;
  min-inline-size: 0;
  min-block-size: var(--nebula-header-height, var(--header-height));
  block-size: var(--nebula-header-height, auto);
  --navbar-padding: var(--nebula-content-padding, ${themeConfig.layoutPadding}px);

  @media (max-width: 1439.95px) {
    --navbar-padding: var(--nebula-content-padding-narrow, ${themeConfig.layoutPadding}px);
  }

  @media (max-width: 680px) {
    --navbar-padding: var(--nebula-content-padding-mobile, ${themeConfig.layoutPadding}px);
  }

  &.${verticalLayoutClasses.headerContentCompact} {
    &.${verticalLayoutClasses.headerFloating}
      .${verticalLayoutClasses.navbar},
      &.${verticalLayoutClasses.headerDetached}
      .${verticalLayoutClasses.navbar},
      &.${verticalLayoutClasses.headerAttached}
      .${verticalLayoutClasses.navbar} {
      margin-inline: auto;
    }

    &.${verticalLayoutClasses.headerFloating}
      .${verticalLayoutClasses.navbar},
      &.${verticalLayoutClasses.headerFixed}.${verticalLayoutClasses.headerDetached}
      .${verticalLayoutClasses.navbar} {
      max-inline-size: calc(${themeConfig.compactContentWidth}px - ${2 * themeConfig.layoutPadding}px);
    }

    .${verticalLayoutClasses.navbar} {
      max-inline-size: ${themeConfig.compactContentWidth}px;
    }
  }

  &.${verticalLayoutClasses.headerFixed} {
    position: sticky;
    /* Without this the sticky header pins to the viewport edge and slides
       UNDER the fixed top banner as soon as the page scrolls. */
    inset-block-start: var(--top-banner-height, 0px);
    z-index: var(--header-z-index);

    &:not(.${verticalLayoutClasses.headerBlur}).scrolled.${verticalLayoutClasses.headerAttached},
      &:not(.${verticalLayoutClasses.headerBlur}).scrolled.${verticalLayoutClasses.headerDetached}
      .${verticalLayoutClasses.navbar} {
      background-color: var(--mui-palette-background-paper);
    }

    &.${verticalLayoutClasses.headerDetached}.scrolled .${verticalLayoutClasses.navbar} {
      box-shadow: 0 4px 8px -4px rgb(var(--mui-mainColorChannels-shadow) / 0.42);

      [data-skin='bordered'] & {
        box-shadow: none;
        border-inline: 1px solid var(--border-color);
        border-block-end: 1px solid var(--border-color);
      }
    }
    &.${verticalLayoutClasses.headerDetached} .${verticalLayoutClasses.navbar} {
      border-end-start-radius: var(--border-radius);
      border-end-end-radius: var(--border-radius);
    }

    &.${verticalLayoutClasses.headerDetached}, &.${verticalLayoutClasses.headerFloating} {
      pointer-events: none;

      & .${verticalLayoutClasses.navbar} {
        pointer-events: auto;
      }
    }

    &.${verticalLayoutClasses.headerBlur} {
      &.scrolled.${verticalLayoutClasses.headerAttached},
        &.scrolled.${verticalLayoutClasses.headerDetached}
        .${verticalLayoutClasses.navbar},
        &.${verticalLayoutClasses.headerFloating}
        .${verticalLayoutClasses.navbar} {
        backdrop-filter: blur(9px);
        background-color: rgb(var(--mui-palette-background-paperChannel) / 0.85);
      }

      &.${verticalLayoutClasses.headerFloating} {
        &:before {
          content: '';
          position: absolute;
          z-index: -1;
          inset-block-start: 0;
          inset-inline: 0;
          block-size: 100%;
          background: linear-gradient(
            180deg,
            rgb(var(--mui-palette-background-defaultChannel) / 0.7) 44%,
            rgb(var(--mui-palette-background-defaultChannel) / 0.43) 73%,
            rgb(var(--mui-palette-background-defaultChannel) / 0)
          );
          backdrop-filter: blur(10px);
          mask: linear-gradient(
            var(--mui-palette-background-default),
            var(--mui-palette-background-default) 18%,
            transparent 100%
          );
        }
      }
    }

    &.${verticalLayoutClasses.headerAttached}.scrolled {
      box-shadow: 0 4px 8px -4px rgb(var(--mui-mainColorChannels-shadow) / 0.42);

      [data-skin='bordered'] & {
        box-shadow: none;
        border-block-end: 1px solid var(--border-color);
      }
    }

    &.${verticalLayoutClasses.headerFloating}
      .${verticalLayoutClasses.navbar},
      &:not(.${verticalLayoutClasses.headerFloating}).${verticalLayoutClasses.headerAttached},
      &:not(.${verticalLayoutClasses.headerFloating}).${verticalLayoutClasses.headerDetached}
      .${verticalLayoutClasses.navbar} {
      ${({ theme }) =>
        `transition: ${theme.transitions.create(['box-shadow', 'border-width', 'padding-inline', 'backdrop-filter'])}`};
    }
    &:not(.${verticalLayoutClasses.headerFloating}).${verticalLayoutClasses.headerAttached}
      .${verticalLayoutClasses.navbar},
      &:not(.${verticalLayoutClasses.headerFloating}).${verticalLayoutClasses.headerDetached}.scrolled
      .${verticalLayoutClasses.navbar} {
      padding-inline: var(--navbar-padding);
    }
  }

  &.${verticalLayoutClasses.headerFloating} {
    padding-block-start: 16px;

    .${verticalLayoutClasses.navbar} {
      background-color: var(--mui-palette-background-paper);
      border-radius: var(--border-radius);
      padding-inline: var(--navbar-padding);
      box-shadow: 0 4px 8px -4px rgb(var(--mui-mainColorChannels-shadow) / 0.42);

      [data-skin='bordered'] & {
        box-shadow: none;
        border: 1px solid var(--border-color);
      }
    }
  }

  &.${verticalLayoutClasses.headerFloating}
    .${verticalLayoutClasses.navbar},
    &.${verticalLayoutClasses.headerFixed}.${verticalLayoutClasses.headerDetached}
    .${verticalLayoutClasses.navbar} {
    inline-size: calc(100% - ${2 * themeConfig.layoutPadding}px);
  }

  &:not(.${verticalLayoutClasses.headerFloating}).${verticalLayoutClasses.headerStatic}
    .${verticalLayoutClasses.navbar} {
    padding-inline: var(--navbar-padding);
  }

  .${verticalLayoutClasses.navbar} {
    position: relative;
    padding-block: 10px;
    inline-size: 100%;
  }

  &[data-nebula] {
    flex-shrink: 0;
    background-color: var(--nebula-bg-navigation, var(--mui-palette-background-paper));
    border-block-end: 1px solid var(--mui-palette-divider);

    &.${verticalLayoutClasses.headerFixed}.${verticalLayoutClasses.headerAttached}.scrolled,
      &.${verticalLayoutClasses.headerFixed}.${verticalLayoutClasses.headerDetached}.scrolled
      .${verticalLayoutClasses.navbar} {
      background-color: var(--nebula-bg-navigation, var(--mui-palette-background-paper));
    }

    .${verticalLayoutClasses.navbar} {
      min-inline-size: 0;
      padding-block: 0;
    }

    &.${verticalLayoutClasses.headerAttached}.scrolled {
      box-shadow: none;
    }
  }

${({ overrideStyles }) => overrideStyles}
`

export default StyledHeader
