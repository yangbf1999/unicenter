// React Imports
import { useEffect } from 'react'

// MUI Imports
import { useColorScheme } from '@mui/material/styles'

const ModeChanger = () => {
  // Hooks
  const { setMode } = useColorScheme()

  useEffect(() => {
    setMode('dark')
  }, [setMode])

  return null
}

export default ModeChanger
