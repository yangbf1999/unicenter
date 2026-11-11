import nebulaTokens from './nebula.tokens.json'

// Historical skins stay registered so stored preferences and older clients
// remain compatible. The current product runtime exposes only locked Nebula.
export const themeSwitchingEnabled = false

export const productThemePresets = Object.freeze({
  nebula: Object.freeze({
    mode: 'dark',
    globalTheme: 'nebula',
    primaryColor: nebulaTokens.color.action.primary
  }),
  vcenterClassic: Object.freeze({
    mode: 'light',
    globalTheme: 'vcenterClassic',
    primaryColor: '#0079B8'
  })
})

export const productThemeIds = Object.freeze(Object.keys(productThemePresets))
export const lockedThemeSettings = productThemePresets.nebula
export const lockedMuiModeStorageKey = 'unicenter-fixed-theme-mode'

// Historical theme values remain valid persistence inputs for backwards
// compatibility, but the current product only ships the dark Nebula runtime.
// Keep the locked fields last so no cookie, stored row or caller can override
// the product policy after sources have been merged.
export const applyProductThemePolicy = settings => ({
  ...(settings || {}),
  ...lockedThemeSettings
})

/*
 * Except for the locked product skin above, these settings can be stored in a
 * cookie and may take priority over themeConfig:
 * 1. mode
 * 2. skin
 * 3. semiDark
 * 4. layout
 * 5. navbar.contentWidth
 * 6. contentWidth
 * 7. footer.contentWidth
 *
 * To see the effect of the above items, you can click on the reset button from the Customizer
 * which is on the top-right corner of the customizer besides the close button.
 * This will reset the cookie to the values provided in the config object below.
 *
 * Another way is to clear the cookie from the browser's Application/Storage tab and then reload the page.
 */
const themeConfig = {
  templateName: 'UniCenter',
  homePageUrl: '/home',
  settingsCookieName: 'materio-mui-next-demo',
  mode: lockedThemeSettings.mode, // 'system', 'light', 'dark'
  skin: 'default', // 'default', 'bordered'
  semiDark: true, // true, false
  layout: 'vertical', // 'vertical', 'collapsed', 'horizontal'
  layoutPadding: 12, // Common padding for header, content, footer layout components (in px)
  compactContentWidth: 1440, // in px
  navbar: {
    type: 'fixed', // 'fixed', 'static'
    contentWidth: 'wide', // 'compact', 'wide'
    floating: false, //! true, false (This will not work in the Horizontal Layout)
    detached: true, //! true, false (This will not work in the Horizontal Layout or floating navbar is enabled)
    blur: true // true, false
  },
  contentWidth: 'wide', // 'compact', 'wide'
  footer: {
    type: 'static', // 'fixed', 'static'
    contentWidth: 'wide', // 'compact', 'wide'
    detached: true //! true, false (This will not work in the Horizontal Layout)
  },
  disableRipple: false // true, false
}

export default themeConfig
