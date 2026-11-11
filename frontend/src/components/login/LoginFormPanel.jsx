'use client'

import {
  Alert, Box, Divider, Fade, Typography,
} from '@mui/material'
import { useTranslations } from 'next-intl'
import LoginAuthTabs from './LoginAuthTabs'
import LoginCredentialsForm from './LoginCredentialsForm'
import LoginSsoButton from './LoginSsoButton'

const LOGIN_LOGO_SRC = '/images/unicenter-logo-transparent.png'

export default function LoginFormPanel({
  branding,
  ldapEnabled,
  oidcEnabled,
  oidcProviderName,
  showLocalForm = true,
  authMethod,
  setAuthMethod,
  email, setEmail,
  username, setUsername,
  password, setPassword,
  isPasswordShown, setIsPasswordShown,
  rememberMe, setRememberMe,
  capsLock, onPasswordKey,
  loading,
  error,
  onSubmit,
  onSso,
  mounted,
}) {
  const t = useTranslations()

  const appName = branding.appName || 'UniCenter'
  const isCustomBrand = branding.enabled && branding.appName && branding.appName !== 'UniCenter'
  const tagline = branding.loginTagline
    ? branding.loginTagline
    : isCustomBrand
      ? ''
      : t('auth.defaultTagline')

  return (
    <Box sx={{ width: '100%', maxWidth: 420, position: 'relative' }}>
      <Fade in={mounted} timeout={600}>
        <Box sx={{ display: 'flex', flexDirection: 'column' }}>
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', mb: 5 }}>
            {(branding.loginLogoUrl || branding.logoUrl) ? (
              <img
                src={branding.loginLogoUrl || branding.logoUrl}
                alt={appName}
                style={{ height: 48, objectFit: 'contain', marginBottom: 14 }}
              />
            ) : (
              <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1, mb: 1.5 }}>
                <img
                  src={LOGIN_LOGO_SRC}
                  alt={appName}
                  style={{
                    display: 'block',
                    height: 64,
                    maxWidth: 280,
                    objectFit: 'contain',
                  }}
                />
              </Box>
            )}
            {tagline && (
              <Typography
                variant='body1'
                sx={{ color: '#e7eaf3', opacity: 0.7, textAlign: 'center', maxWidth: 360, mt: 0.5, lineHeight: 1.4 }}
              >
                {tagline}
              </Typography>
            )}
          </Box>

          {error && <Alert severity='error' sx={{ mb: 3 }}>{error}</Alert>}

          {oidcEnabled && (
            <Box sx={{ mb: 3 }}>
              <LoginSsoButton providerName={oidcProviderName} onClick={onSso} disabled={loading} />
            </Box>
          )}

          {oidcEnabled && showLocalForm && (
            <Divider sx={{ mb: 3 }}>
              <Typography variant='caption' sx={{ opacity: 0.5 }}>{t('auth.or')}</Typography>
            </Divider>
          )}

          {ldapEnabled && showLocalForm && (
            <LoginAuthTabs value={authMethod} onChange={setAuthMethod} disabled={loading} />
          )}

          {showLocalForm && (
            <LoginCredentialsForm
              authMethod={authMethod}
              email={email} setEmail={setEmail}
              username={username} setUsername={setUsername}
              password={password} setPassword={setPassword}
              isPasswordShown={isPasswordShown} setIsPasswordShown={setIsPasswordShown}
              rememberMe={rememberMe} setRememberMe={setRememberMe}
              capsLock={capsLock} onPasswordKey={onPasswordKey}
              loading={loading}
              onSubmit={onSubmit}
            />
          )}

        </Box>
      </Fade>
    </Box>
  )
}
