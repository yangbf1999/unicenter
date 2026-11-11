'use client'

import React from 'react'

import { Box, CircularProgress } from '@mui/material'

import { vmIconOpacity } from '../helpers'

export const ONLINE_STATUS_COLOR = '#67ff9a'
export const ONLINE_STATUS_GLOW = `0 0 4px ${ONLINE_STATUS_COLOR}, 0 0 10px rgba(103, 255, 154, 0.72)`
export const OFFLINE_STATUS_COLOR = '#f44336'
export const OFFLINE_STATUS_GLOW = `0 0 4px ${OFFLINE_STATUS_COLOR}, 0 0 10px rgba(244, 67, 54, 0.68)`

/* ------------------------------------------------------------------ */
/* Helpers                                                            */
/* ------------------------------------------------------------------ */

// Retourne l'icône appropriée pour une VM (template ou non)
export function getVmIcon(type: string, isTemplate?: boolean, filled = true): string {
  if (isTemplate) {
    return filled ? 'ri-file-copy-fill' : 'ri-file-copy-line'
  }

  if (type === 'lxc') {
    return filled ? 'ri-instance-fill' : 'ri-instance-line'
  }

  return filled ? 'ri-computer-fill' : 'ri-computer-line'
}

/* ------------------------------------------------------------------ */
/* Status Icon Component                                              */
/* ------------------------------------------------------------------ */

export function StatusIcon({ status, type, isMigrating, isPendingAction, maintenance, template, vmType, size: propSize, lock }: { status?: string; type: 'node' | 'vm'; isMigrating?: boolean; isPendingAction?: boolean; maintenance?: string; template?: boolean; vmType?: string; size?: number; lock?: string }) {
  if (type === 'node') {
    return null // Use NodeIcon instead for nodes
  }

  // VM icon with status dot badge
  const iconClass = getVmIcon(vmType || 'qemu', template)
  const size = propSize || 16
  const dotSize = Math.round(size * 0.5)

  // Pending action: spinner instead of dot
  if (isPendingAction) {
    return (
      <Box component="span" sx={{ position: 'relative', display: 'inline-flex', width: size, height: size, flexShrink: 0 }}>
        <i className={iconClass} style={{ fontSize: size, opacity: 0.7 }} />
        <Box sx={{ position: 'absolute', bottom: -2, right: -3 }}>
          <CircularProgress size={dotSize} thickness={6} sx={{ color: '#ff9800' }} />
        </Box>
      </Box>
    )
  }

  // Migrating: pulsing orange dot
  if (isMigrating) {
    return (
      <Box component="span" sx={{
        position: 'relative', display: 'inline-flex', width: size, height: size, flexShrink: 0,
        '@keyframes pulse': { '0%, 100%': { opacity: 1 }, '50%': { opacity: 0.4 } },
        animation: 'pulse 1.5s ease-in-out infinite',
      }}>
        <i className={iconClass} style={{ fontSize: size, opacity: 0.7 }} />
        <Box sx={{ position: 'absolute', bottom: -2, right: -3, width: dotSize, height: dotSize, borderRadius: '50%', bgcolor: '#ff9800', border: '1.5px solid', borderColor: 'background.paper' }} />
      </Box>
    )
  }

  // Template: no dot
  if (template) {
    return (
      <Box component="span" sx={{ display: 'inline-flex', width: size, height: size, flexShrink: 0 }}>
        <i className={iconClass} style={{ fontSize: size, opacity: 0.5 }} />
      </Box>
    )
  }

  // Normal VM: icon + colored status dot. The glyph is dimmed when the guest
  // is off so on/off reads from brightness, not just the dot colour.
  const dotColor = status === 'running' ? ONLINE_STATUS_COLOR : status === 'paused' ? '#ed6c02' : OFFLINE_STATUS_COLOR
  const dotGlow = status === 'running' ? ONLINE_STATUS_GLOW : status === 'paused' ? 'none' : OFFLINE_STATUS_GLOW

  return (
    <Box component="span" sx={{ position: 'relative', display: 'inline-flex', width: size, height: size, flexShrink: 0 }}>
      <i className={iconClass} style={{ fontSize: size, opacity: vmIconOpacity(status, template) }} />
      <Box sx={{
        position: 'absolute', bottom: -2, right: -3,
        width: dotSize, height: dotSize, borderRadius: '50%',
        bgcolor: dotColor,
        border: '1.5px solid', borderColor: 'background.paper',
        boxShadow: dotGlow,
      }} />
      {lock && (
        <Box sx={{
          position: 'absolute', top: -4, left: -4,
          width: dotSize + 4, height: dotSize + 4, borderRadius: '50%',
          bgcolor: '#ff9800',
          border: '1.5px solid', borderColor: 'background.paper',
          boxShadow: '0 0 6px rgba(255, 152, 0, 0.8)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          '@keyframes lockPulse': {
            '0%, 100%': { boxShadow: '0 0 4px rgba(255, 152, 0, 0.6)' },
            '50%': { boxShadow: '0 0 10px rgba(255, 152, 0, 1)' },
          },
          animation: 'lockPulse 2s ease-in-out infinite',
        }}>
          <i className="ri-lock-fill" style={{ fontSize: dotSize, color: '#fff' }} />
        </Box>
      )}
    </Box>
  )
}

export function NodeIcon({ status, maintenance, size = 16 }: { status?: string; maintenance?: string; size?: number }) {
  const dotSize = Math.round(size * 0.5)

  let dotColor = status === 'online' ? ONLINE_STATUS_COLOR : OFFLINE_STATUS_COLOR
  let dotIcon = null as React.ReactNode

  if (maintenance) {
    dotColor = '#ff9800'
    dotIcon = <i className="ri-tools-fill" style={{ fontSize: dotSize - 2, color: '#fff' }} />
  }

  return (
    <Box component="span" sx={{ position: 'relative', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: size, height: size, flexShrink: 0 }}>
      <i
        className="ri-server-line"
        aria-hidden="true"
        style={{
          fontSize: size,
          opacity: status === 'online' || maintenance ? 1 : 0.45,
          filter: maintenance ? 'hue-rotate(-30deg) saturate(2)' : undefined,
        }}
      />
      <Box sx={{
        position: 'absolute', bottom: -2, right: -2,
        width: dotSize, height: dotSize, borderRadius: '50%',
        bgcolor: dotColor,
        border: '1.5px solid', borderColor: 'background.paper',
        boxShadow: maintenance ? 'none' : status === 'online' ? ONLINE_STATUS_GLOW : OFFLINE_STATUS_GLOW,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {dotIcon}
      </Box>
    </Box>
  )
}

export function ClusterIcon({ nodes, size = 14 }: { nodes: { status?: string }[]; size?: number }) {
  const dotSize = Math.round(size * 0.5)
  const allOnline = nodes.length > 0 && nodes.every(n => n.status === 'online')
  const dotColor = allOnline ? ONLINE_STATUS_COLOR : '#ff9800'

  return (
    <Box component="span" sx={{ position: 'relative', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: size, height: size, flexShrink: 0 }}>
      <i className="ri-server-fill" style={{ opacity: 0.8, fontSize: size }} />
      <Box sx={{
        position: 'absolute', bottom: -2, right: -2,
        width: dotSize, height: dotSize, borderRadius: '50%',
        bgcolor: dotColor,
        border: '1.5px solid', borderColor: 'background.paper',
        boxShadow: allOnline ? ONLINE_STATUS_GLOW : 'none',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }} />
    </Box>
  )
}
