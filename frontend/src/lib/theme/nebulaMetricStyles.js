export const metricGlow = color =>
  `drop-shadow(0 0 3px color-mix(in srgb, ${color} 65%, transparent)) drop-shadow(0 0 8px color-mix(in srgb, ${color} 30%, transparent))`

export const metricGradient = color =>
  `linear-gradient(90deg, color-mix(in srgb, ${color} 78%, var(--nebula-bg-elevated)) 0%, ${color} 72%, color-mix(in srgb, ${color} 76%, white) 100%)`

export function createNebulaMetricStyles(mode) {
  const glow = color => mode === 'dark' ? metricGlow(color) : 'none'

  return {
    '.nebula-usage-track.nebula-usage-track': {
      backgroundColor: 'var(--nebula-bg-hover)',
      borderRadius: '999px',
      overflow: 'visible',
    },
    '.nebula-usage-fill.nebula-usage-fill': {
      background: metricGradient('var(--nebula-progress-color)'),
      backgroundSize: '100% 100%',
      borderRadius: '999px',
      filter: glow('var(--nebula-progress-color)'),
      '&::after': { display: 'none' },
    },
    '.nebula-circular-gauge-svg': { overflow: 'visible' },
    '.nebula-circular-gauge-svg > circle:first-child': {
      stroke: 'var(--nebula-bg-hover)',
    },
    '.nebula-circular-gauge-value': {
      filter: glow('var(--nebula-gauge-color)'),
    },
    '.nebula-donut-value': {
      filter: glow('var(--nebula-gauge-color)'),
    },
    '.nebula-metric-ring.MuiCircularProgress-root': {
      filter: glow('var(--nebula-gauge-color)'),
      '& .MuiCircularProgress-circle': { strokeLinecap: 'round' },
    },
    '.nebula-auto-ring.MuiCircularProgress-root': {
      color: 'var(--nebula-gauge-color)',
      filter: glow('var(--nebula-gauge-color)'),
      '& .MuiCircularProgress-circle': { strokeLinecap: 'round' },
    },
    'svg:has(.nebula-auto-arc), svg:has(.nebula-auto-donut)': { overflow: 'visible' },
    '.nebula-auto-arc, .nebula-auto-donut': { filter: glow('currentColor') },
    '.nebula-auto-arc': { stroke: 'currentColor' },
    '.nebula-auto-donut': { fill: 'currentColor' },
    '.nebula-quota-track.MuiCircularProgress-root': {
      color: 'var(--nebula-bg-hover)',
    },
    '.nebula-quota-value.MuiCircularProgress-root': {
      filter: glow('currentColor'),
      '& .MuiCircularProgress-circle': { strokeLinecap: 'round' },
    },
    '.nebula-quota-value.MuiCircularProgress-colorPrimary': { color: 'var(--nebula-brand-blue)' },
    '.nebula-quota-value.MuiCircularProgress-colorWarning': { color: 'var(--nebula-status-warning)' },
    '.nebula-quota-value.MuiCircularProgress-colorError': { color: 'var(--nebula-status-error)' },
    '.MuiLinearProgress-root.MuiLinearProgress-root': {
      backgroundColor: 'var(--nebula-bg-hover)',
      borderRadius: '999px',
      filter: glow('var(--nebula-progress-color, var(--nebula-brand-blue))'),
    },
    ...Object.fromEntries([
      ['Primary', 'var(--nebula-brand-blue)'],
      ['Secondary', 'var(--nebula-brand-violet)'],
      ['Info', 'var(--nebula-status-info)'],
      ['Success', 'var(--nebula-status-success)'],
      ['Warning', 'var(--nebula-status-warning)'],
      ['Error', 'var(--nebula-status-error)'],
    ].map(([name, color]) => [
      `.MuiLinearProgress-root.MuiLinearProgress-color${name}:not(.nebula-linear-progress)`,
      { '--nebula-progress-color': color },
    ])),
    '.MuiLinearProgress-root .MuiLinearProgress-bar': {
      borderRadius: '999px',
      backgroundColor: 'var(--nebula-progress-color, var(--nebula-brand-blue))',
      // A translucent overlay preserves page-specific warning/error fills.
      // Resource metrics opt into the token-derived gradient below.
      backgroundImage: 'linear-gradient(90deg, rgb(0 0 0 / 18%) 0%, transparent 72%, rgb(255 255 255 / 24%) 100%)',
      boxShadow: 'none',
    },
    // Explicit metric colors win over the MUI primary variant.
    '.nebula-linear-progress': {
      '--nebula-metric-gradient': metricGradient('var(--nebula-progress-color)'),
    },
    '.nebula-linear-progress .MuiLinearProgress-bar': {
      backgroundColor: 'var(--nebula-progress-color) !important',
      backgroundImage: 'var(--nebula-metric-gradient) !important',
      backgroundSize: '100% 100% !important',
    },
    '@media (prefers-reduced-motion: reduce)': {
      '.nebula-circular-gauge-value, .nebula-donut-value, .nebula-quota-value, .nebula-metric-ring.MuiCircularProgress-root, .nebula-auto-ring.MuiCircularProgress-root, .nebula-auto-arc, .nebula-auto-donut, .nebula-usage-fill.nebula-usage-fill, .MuiLinearProgress-root.MuiLinearProgress-root': {
        filter: 'none',
      },
    },
  }
}
