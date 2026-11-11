// Foreground emphasis is deliberately separate from the primary button fill.
// Keep semantic status colors and disabled controls outside these selectors.
export const nebulaInteractionStyles = {
  '.MuiLink-root.MuiLink-root:not([aria-disabled="true"])': {
    color: 'var(--nebula-action-link)',
  },
  '.MuiIconButton-root.MuiIconButton-colorPrimary:not(.Mui-disabled)': {
    color: 'var(--nebula-action-link)',
  },
  '.MuiIconButton-root.MuiIconButton-colorPrimary:not(.Mui-disabled):hover': {
    color: 'var(--nebula-action-link)',
    backgroundColor: 'var(--nebula-bg-hover)',
  },
  '.MuiToggleButtonGroup-root .MuiToggleButton-root:is(.MuiToggleButton-primary, .MuiToggleButton-standard).Mui-selected:not(.Mui-disabled), .MuiToggleButtonGroup-root .MuiToggleButton-root:is(.MuiToggleButton-primary, .MuiToggleButton-standard).Mui-selected:not(.Mui-disabled):hover': {
    color: 'var(--nebula-action-link)',
    backgroundColor: 'var(--nebula-bg-selected)',
  },
  '.MuiToggleButton-root.MuiToggleButton-primary.Mui-selected:not(.Mui-disabled)': {
    color: 'var(--nebula-action-link)',
    backgroundColor: 'var(--nebula-bg-selected)',
  },
  '.MuiPagination-root .MuiPaginationItem-root.MuiPaginationItem-colorPrimary.Mui-selected:not(.Mui-disabled), .MuiPagination-root .MuiPaginationItem-root.MuiPaginationItem-colorPrimary.Mui-selected:not(.Mui-disabled):hover': {
    color: 'var(--nebula-action-link)',
    backgroundColor: 'var(--nebula-bg-selected)',
  },
  '.MuiChip-root.MuiChip-colorPrimary:not(.Mui-disabled)': {
    color: 'var(--nebula-action-link)',
    backgroundColor: 'var(--nebula-bg-selected)',
  },
  '.MuiChip-root.MuiChip-colorPrimary:not(.Mui-disabled) .MuiChip-icon': {
    color: 'inherit',
  },
  '.MuiInputLabel-root.Mui-focused:not(.Mui-error):not(.Mui-disabled)': {
    color: 'var(--nebula-action-link)',
  },
  '.MuiOutlinedInput-root.MuiOutlinedInput-root:not(.Mui-focused):not(.Mui-error):not(.Mui-disabled):hover .MuiOutlinedInput-notchedOutline': {
    borderColor: 'var(--nebula-action-link)',
  },
  '.MuiOutlinedInput-root.MuiOutlinedInput-root.Mui-focused:not(.Mui-error):not(.Mui-disabled) .MuiOutlinedInput-notchedOutline': {
    borderColor: 'var(--nebula-border-focus)',
  },
}
