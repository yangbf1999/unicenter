// Resolve legacy MUI palette names and common metric colors without changing
// their fallback appearance in other product skins.
const semanticColors = {
  '#22c55e': 'status-success', '#4caf50': 'status-success', '#4ade80': 'status-success',
  '#ef4444': 'status-error', '#f44336': 'status-error', '#f87171': 'status-error',
  '#eab308': 'status-warning', '#f59e0b': 'status-warning', '#ff9800': 'status-warning', '#fbbf24': 'status-warning',
  '#3b82f6': 'brand-blue', '#06b6d4': 'brand-cyan', '#8b5cf6': 'brand-violet',
  'primary.main': 'brand-blue', 'secondary.main': 'brand-violet',
  'success.main': 'status-success', 'warning.main': 'status-warning',
  'error.main': 'status-error', 'info.main': 'status-info',
}

export function nebulaMetricColor(color, metric) {
  const raw = String(color || 'primary.main')
  const fallback = /^[a-z]+\.(main|light|dark)$/.test(raw)
    ? `var(--mui-palette-${raw.replace('.', '-')})`
    : raw
  const semantic = semanticColors[raw.toLowerCase()]
  const token = metric === 'storage-capacity'
    ? (semantic === 'status-error' || semantic === 'status-warning' ? semantic : 'brand-violet')
    : { cpu: 'brand-blue', memory: 'brand-cyan', storage: 'brand-violet' }[metric] || semantic

  return token ? `var(--nebula-${token}, ${fallback})` : fallback
}
