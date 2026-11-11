'use client'

import { useEffect, useMemo } from 'react'

const translations = {
  en: { title: 'Critical error', description: 'A critical error occurred. The application encountered an unexpected problem.', retry: 'Retry', home: 'Home' },
  fr: { title: 'Erreur critique', description: "Une erreur critique s'est produite. L'application a rencontré un problème inattendu.", retry: 'Réessayer', home: 'Accueil' },
}

function getLocale() {
  if (typeof document === 'undefined') return 'fr'
  const match = document.cookie.match(/NEXT_LOCALE=(\w+)/)
  return match?.[1] === 'en' ? 'en' : 'fr'
}

const LogoIcon = ({ size = 60 }) => (
  <img
    className='ri-server-line'
    aria-hidden='true'
    alt=''
    width={size}
    height={size}
    style={{ display: 'block', width: size, height: size, objectFit: 'cover', borderRadius: '18%' }}
  />
)

export default function GlobalError({ error, reset }) {
  const locale = useMemo(() => getLocale(), [])
  const t = translations[locale]

  useEffect(() => {
    console.error('Global error:', error)
  }, [error])

  return (
    <html lang={locale}>
      <body>
        <div
          style={{
            minHeight: '100vh',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: '#1a1a2e',
            padding: '24px',
            textAlign: 'center',
            fontFamily: 'system-ui, -apple-system, sans-serif',
          }}
        >
          {/* Logo */}
          <div style={{ marginBottom: '32px' }}>
            <LogoIcon size={80} />
          </div>

          {/* Code d'erreur */}
          <h1
            style={{
              fontSize: '8rem',
              fontWeight: 800,
              lineHeight: 1,
              color: '#F29221',
              margin: '0 0 16px 0',
            }}
          >
            500
          </h1>

          {/* Icône */}
          <div
            style={{
              width: '80px',
              height: '80px',
              borderRadius: '50%',
              backgroundColor: 'rgba(242, 146, 33, 0.1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '24px',
            }}
          >
            <span style={{ fontSize: '40px' }}>⚠️</span>
          </div>

          {/* Titre */}
          <h2
            style={{
              fontSize: '1.5rem',
              fontWeight: 700,
              marginBottom: '12px',
              color: '#ffffff',
            }}
          >
            {t.title}
          </h2>

          {/* Description */}
          <p
            style={{
              color: 'rgba(255, 255, 255, 0.7)',
              maxWidth: '480px',
              marginBottom: '32px',
              lineHeight: 1.6,
            }}
          >
            {t.description}
          </p>

          {/* Boutons */}
          <div style={{ display: 'flex', gap: '16px' }}>
            <button
              onClick={() => reset()}
              style={{
                padding: '12px 32px',
                fontSize: '1rem',
                fontWeight: 600,
                color: '#ffffff',
                backgroundColor: '#F29221',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
              }}
            >
              {t.retry}
            </button>
            <button
              onClick={() => (window.location.href = '/home')}
              style={{
                padding: '12px 32px',
                fontSize: '1rem',
                fontWeight: 600,
                color: '#F29221',
                backgroundColor: 'transparent',
                border: '2px solid #F29221',
                borderRadius: '8px',
                cursor: 'pointer',
              }}
            >
              {t.home}
            </button>
          </div>

          {/* Footer */}
          <p
            style={{
              position: 'absolute',
              bottom: '24px',
              color: 'rgba(255, 255, 255, 0.4)',
              fontSize: '0.75rem',
            }}
          >
            UniCenter — eSage Management Platform
          </p>
        </div>
      </body>
    </html>
  )
}
