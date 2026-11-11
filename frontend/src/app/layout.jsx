// MUI Imports
import InitColorSchemeScript from '@mui/material/InitColorSchemeScript'

// Third-party Imports
import 'react-grid-layout/css/styles.css'
import 'react-resizable/css/styles.css'
import { NextIntlClientProvider } from 'next-intl'
import { getLocale, getMessages } from 'next-intl/server'

// Context Imports
import { BrandingProvider } from '@/contexts/BrandingContext'
import AuthProvider from '@components/AuthProvider'

// Util Imports
import { getSystemMode } from '@core/utils/serverHelpers'
import { lockedMuiModeStorageKey } from '@configs/themeConfig'

// Style Imports
import '@/app/globals.css'

// Generated Icon CSS Imports
import '@assets/iconify-icons/generated-icons.css'

export const metadata = {
  title: 'UniCenter',
  description: 'UniCenter 管理控制台',
  // Change the URL when the bundled favicon changes so browsers do not keep
  // showing a previously cached tab icon.
  icons: {
    icon: '/favicon.ico?v=unicenter-20261116',
    shortcut: '/favicon.ico?v=unicenter-20261116',
  }
}

const RootLayout = async props => {
  const { children } = props

  // Get locale and messages for i18n
  const locale = await getLocale()
  const messages = await getMessages()

  // Vars
  const systemMode = await getSystemMode()
  const direction = 'ltr'

  return (
    <html id='__next' lang={locale} dir={direction} suppressHydrationWarning>
      <body className='flex is-full min-bs-full flex-auto flex-col'>
        <InitColorSchemeScript
          attribute='data'
          defaultMode={systemMode}
          modeStorageKey={lockedMuiModeStorageKey}
        />
        <NextIntlClientProvider locale={locale} messages={messages}>
          {/* SessionProvider lives at the root so BrandingProvider (which now
              subscribes to the session to refetch on login / tenant switch)
              has access to it. The dashboard's Providers no longer wraps an
              AuthProvider — the single instance here covers /login, /setup,
              and the authenticated dashboard tree alike. */}
          <AuthProvider>
            <BrandingProvider>
              {children}
            </BrandingProvider>
          </AuthProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  )
}

export default RootLayout
