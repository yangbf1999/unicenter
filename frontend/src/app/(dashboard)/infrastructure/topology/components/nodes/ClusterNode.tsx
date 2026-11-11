'use client'

import { nebulaMetricColor } from '@/lib/theme/nebulaMetricColor'
import { memo } from 'react'

import { Handle, Position } from '@xyflow/react'
import type { NodeProps } from '@xyflow/react'
import { Box, Typography, LinearProgress } from '@mui/material'

import type { ClusterNodeData } from '../../types'
import {
  getStatusColor,
  getStatusBorderColor,
  getStatusIndicatorColor,
  getStatusIndicatorShadow,
} from '../../lib/topologyColors'

function ClusterNodeComponent({ data }: NodeProps) {
  const d = data as unknown as ClusterNodeData
  const indicatorColor = getStatusIndicatorColor(d.status)

  return (
    <Box
      sx={{
        width: d.width,
        height: d.height,
        bgcolor: 'background.paper',
        border: '2px solid',
        borderColor: getStatusBorderColor(d.status),
        borderRadius: 2,
        px: 1.5,
        py: 1,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
        cursor: 'pointer',
        '&:hover': {
          boxShadow: '0 4px 16px rgba(0,0,0,0.18)',
        },
      }}
    >
      <Handle type='target' position={Position.Top} style={{ background: '#666' }} />

      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
        <i className='ri-server-line' aria-hidden='true' style={{ flexShrink: 0, fontSize: 18 }} />
        <Typography variant='body2' fontWeight={700} noWrap sx={{ flex: 1 }}>
          {d.label}
        </Typography>
        <Box
          sx={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            bgcolor: indicatorColor,
            boxShadow: getStatusIndicatorShadow(indicatorColor),
            flexShrink: 0,
          }}
        />
      </Box>

      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
        <Typography variant='caption' color='text.secondary'>
          {d.nodeCount} nodes
        </Typography>
        <Typography variant='caption' color='text.secondary'>
          {d.vmCount} VMs
        </Typography>
      </Box>

      <Box sx={{ mt: 0.5 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.25 }}>
          <Typography variant='caption' color='text.secondary' sx={{ fontSize: '0.65rem' }}>
            CPU
          </Typography>
          <Typography variant='caption' sx={{ fontSize: '0.65rem', ml: 'auto' }}>
            {(d.cpuUsage * 100).toFixed(0)}%
          </Typography>
        </Box>
        <LinearProgress className="nebula-linear-progress"
          variant='determinate'
          value={Math.min(d.cpuUsage * 100, 100)}
          sx={{ '--nebula-progress-color': nebulaMetricColor(getStatusColor(d.status), 'cpu'),
            height: 4,
            borderRadius: 2,
            bgcolor: 'action.hover',
            '& .MuiLinearProgress-bar': {
              bgcolor: getStatusColor(d.status),
              borderRadius: 2,
            },
          }}
        />
      </Box>

      <Box sx={{ mt: 0.25 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.25 }}>
          <Typography variant='caption' color='text.secondary' sx={{ fontSize: '0.65rem' }}>
            RAM
          </Typography>
          <Typography variant='caption' sx={{ fontSize: '0.65rem', ml: 'auto' }}>
            {(d.ramUsage * 100).toFixed(0)}%
          </Typography>
        </Box>
        <LinearProgress className="nebula-linear-progress"
          variant='determinate'
          value={Math.min(d.ramUsage * 100, 100)}
          sx={{ '--nebula-progress-color': nebulaMetricColor('#9c27b0', 'memory'),
            height: 4,
            borderRadius: 2,
            bgcolor: 'action.hover',
            '& .MuiLinearProgress-bar': {
              bgcolor: '#9c27b0',
              borderRadius: 2,
            },
          }}
        />
      </Box>

      <Handle type='source' position={Position.Bottom} style={{ background: '#666' }} />
    </Box>
  )
}

export const ClusterNode = memo(ClusterNodeComponent)
