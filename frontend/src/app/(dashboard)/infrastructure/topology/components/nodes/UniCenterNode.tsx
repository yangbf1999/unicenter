'use client'

import { memo } from 'react'

import { Handle, Position } from '@xyflow/react'
import type { NodeProps } from '@xyflow/react'
import { Box, Typography, useTheme } from '@mui/material'

import type { UniCenterNodeData } from '../../types'

function LogoIcon({ size = 28 }: { size?: number }) {
  return <i className='ri-server-line' aria-hidden='true' style={{ fontSize: size }} />
}

function UniCenterNodeComponent({ data }: NodeProps) {
  const d = data as unknown as UniCenterNodeData
  const theme = useTheme()
  const primaryColor = theme.palette.primary.main

  return (
    <Box
      sx={{
        width: d.width,
        height: d.height,
        bgcolor: 'background.paper',
        border: '2px solid',
        borderColor: primaryColor,
        borderRadius: 2.5,
        px: 2,
        py: 1,
        display: 'flex',
        alignItems: 'center',
        gap: 1.5,
        boxShadow: `0 4px 16px rgba(242, 146, 33, 0.2)`,
        cursor: 'pointer',
        '&:hover': {
          boxShadow: `0 6px 24px rgba(242, 146, 33, 0.3)`,
        },
      }}
    >
      <LogoIcon size={44} />

      <Box sx={{ flex: 1 }}>
        <Typography variant='body1' fontWeight={800} sx={{ fontSize: '1rem' }}>
          {d.label}
        </Typography>
        <Box sx={{ display: 'flex', gap: 2, mt: 0.5 }}>
          <Typography variant='caption' color='text.secondary' sx={{ fontSize: '0.7rem' }}>
            {d.clusterCount} clusters
          </Typography>
          <Typography variant='caption' color='text.secondary' sx={{ fontSize: '0.7rem' }}>
            {d.totalNodes} nodes
          </Typography>
          <Typography variant='caption' color='text.secondary' sx={{ fontSize: '0.7rem' }}>
            {d.totalVms} VMs
          </Typography>
          {(d.pbsCount ?? 0) > 0 && (
            <Typography variant='caption' color='text.secondary' sx={{ fontSize: '0.7rem' }}>
              {d.pbsCount} PBS
            </Typography>
          )}
        </Box>
      </Box>

      <Handle type='source' position={Position.Bottom} style={{ background: primaryColor }} />
    </Box>
  )
}

export const UniCenterNode = memo(UniCenterNodeComponent)
