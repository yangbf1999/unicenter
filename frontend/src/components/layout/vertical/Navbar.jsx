'use client'

// Component Imports
import LayoutNavbar from '@layouts/components/vertical/Navbar'
import NavbarContent from './NavbarContent'
import VcenterNavbarContent from './VcenterNavbarContent'
import { useSettings } from '@core/hooks/useSettings'

const Navbar = () => {
  const { settings } = useSettings()

  return (
    <LayoutNavbar>
      {settings.globalTheme === 'vcenterClassic' ? <VcenterNavbarContent /> : <NavbarContent />}
    </LayoutNavbar>
  )
}

export default Navbar
