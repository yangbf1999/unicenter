'use client'

import Link from 'next/link'
import { Box, Button, Typography, useTheme, alpha } from '@mui/material'
import { useTranslations } from 'next-intl'
import { useBranding } from '@/contexts/BrandingContext'
import { LogoIcon } from '@components/layout/shared/Logo'

const errorIcons = {
  404: 'ri-file-unknow-line',
  500: 'ri-server-line',
  403: 'ri-lock-line',
  401: 'ri-user-unfollow-line',
  503: 'ri-tools-line',
}

export default function ErrorPage({
  code = 404,
  title,
  description,
  showHomeButton = true,
  showRetryButton = false,
  onRetry,
}) {
  const theme = useTheme()
  const t = useTranslations('errorPages')
  const { branding } = useBranding()
  const icon = errorIcons[code] || errorIcons[404]
  const codeStr = String(code)

  const displayTitle = title || t(`${codeStr}.title`)
  const displayDescription = description || t(`${codeStr}.description`)

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        bgcolor: 'background.default',
        p: 3,
        textAlign: 'center',
      }}
    >
      {/* Logo */}
      <Box sx={{ mb: 4 }}>
        <LogoIcon size={80} />
      </Box>

      {/* Code d'erreur */}
      <Typography
        variant="h1"
        sx={{
          fontSize: { xs: '6rem', sm: '8rem', md: '10rem' },
          fontWeight: 800,
          lineHeight: 1,
          background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.primary.dark} 100%)`,
          backgroundClip: 'text',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          mb: 2,
        }}
      >
        {code}
      </Typography>

      {/* Icône */}
      <Box
        sx={{
          width: 80,
          height: 80,
          borderRadius: '50%',
          bgcolor: alpha(theme.palette.primary.main, 0.1),
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          mb: 3,
        }}
      >
        <i
          className={icon}
          style={{
            fontSize: 40,
            color: theme.palette.primary.main,
          }}
        />
      </Box>

      {/* Titre */}
      <Typography
        variant="h4"
        sx={{
          fontWeight: 700,
          mb: 1.5,
          color: 'text.primary',
        }}
      >
        {displayTitle}
      </Typography>

      {/* Description */}
      <Typography
        variant="body1"
        sx={{
          color: 'text.secondary',
          maxWidth: 480,
          mb: 4,
          lineHeight: 1.6,
        }}
      >
        {displayDescription}
      </Typography>

      {/* Boutons */}
      <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', justifyContent: 'center' }}>
        {showHomeButton && (
          <Button
            component={Link}
            href="/home"
            variant="contained"
            size="large"
            startIcon={<i className="ri-home-4-line" />}
            sx={{
              px: 4,
              py: 1.5,
              borderRadius: 2,
              textTransform: 'none',
              fontWeight: 600,
            }}
          >
            {t('backToHome')}
          </Button>
        )}
        {showRetryButton && onRetry && (
          <Button
            onClick={onRetry}
            variant="outlined"
            size="large"
            startIcon={<i className="ri-refresh-line" />}
            sx={{
              px: 4,
              py: 1.5,
              borderRadius: 2,
              textTransform: 'none',
              fontWeight: 600,
            }}
          >
            {t('retry')}
          </Button>
        )}
      </Box>

      {/* Footer */}
      <Typography
        variant="caption"
        sx={{
          position: 'absolute',
          bottom: 24,
          color: 'text.disabled',
        }}
      >
        {branding.appName || 'UniCenter'} — eSage Management Platform
      </Typography>
    </Box>
  )
}
