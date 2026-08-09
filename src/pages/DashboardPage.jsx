import { useEffect, useMemo, useState } from 'react'
import DashboardHeader from '../components/dashboard/DashboardHeader'
import DashboardOverview from '../components/dashboard/DashboardOverview'
import Sidebar from '../components/dashboard/Sidebar'
import EntriesModule from '../features/entries/EntriesModule'
import ClientsModule from '../features/clients/ClientsModule'
import InventoryModule from '../features/inventory/InventoryModule'
import ProductsModule from '../features/products/ProductsModule'
import ProvidersModule from '../features/providers/ProvidersModule'
import MaturationControlModule from '../features/maturation/MaturationControlModule'
import ProductionModule from '../features/production/ProductionModule'
import ServiceTypesModule from '../features/serviceTypes/ServiceTypesModule'
import UsersModule from '../features/users/UsersModule'
import VehiclesModule from '../features/vehicles/VehiclesModule'
import VehicleServicesModule from '../features/vehicleServices/VehicleServicesModule'
import { canAccessModule, getAllowedModules, MODULE_DEFINITIONS } from '../config/rolePermissions'

const MOBILE_BREAKPOINT = 979

function DashboardPage({ onLogout, session }) {
  const [activeMenu, setActiveMenu] = useState('dashboard')
  const [isSidebarVisible, setIsSidebarVisible] = useState(() => {
    if (typeof window === 'undefined') {
      return true
    }

    return window.innerWidth > MOBILE_BREAKPOINT
  })

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth <= MOBILE_BREAKPOINT) {
        setIsSidebarVisible(false)
      } else {
        setIsSidebarVisible(true)
      }
    }

    window.addEventListener('resize', handleResize)

    return () => {
      window.removeEventListener('resize', handleResize)
    }
  }, [])

  const roleName = session.user?.rol || 'Piloto'
  const allowedModules = useMemo(() => getAllowedModules(roleName), [roleName])
  const defaultModuleKey = allowedModules[0]?.key || 'dashboard'

  useEffect(() => {
    if (!canAccessModule(roleName, activeMenu)) {
      setActiveMenu(defaultModuleKey)
    }
  }, [activeMenu, defaultModuleKey, roleName])

  const handleMenuSelection = (menu) => {
    if (!canAccessModule(roleName, menu)) {
      return
    }

    setActiveMenu(menu)

    if (window.innerWidth <= MOBILE_BREAKPOINT) {
      setIsSidebarVisible(false)
    }
  }

  const activeModule = MODULE_DEFINITIONS[activeMenu] || MODULE_DEFINITIONS.dashboard
  const canUseUsers = canAccessModule(roleName, 'users')
  const canUseEntries = canAccessModule(roleName, 'entries')
  const canUseClients = canAccessModule(roleName, 'clients')
  const canUseProducts = canAccessModule(roleName, 'products')
  const canUseInventory = canAccessModule(roleName, 'inventory')
  const canUseProviders = canAccessModule(roleName, 'providers')
  const canUseVehicles = canAccessModule(roleName, 'vehicles')
  const canUseVehicleServices = canAccessModule(roleName, 'vehicleServices')
  const canUseServiceTypes = canAccessModule(roleName, 'serviceTypes')
  const canUseMaturation = canAccessModule(roleName, 'maturation')
  const canUseProduction = canAccessModule(roleName, 'production')

  return (
    <main className={`dashboard-layout ${isSidebarVisible ? 'sidebar-open' : 'sidebar-hidden'}`}>
      <Sidebar
        activeMenu={activeMenu}
        modules={allowedModules}
        onLogout={onLogout}
        onSelectMenu={handleMenuSelection}
      />

      <button
        type="button"
        className={`sidebar-backdrop ${isSidebarVisible ? 'visible' : ''}`}
        onClick={() => setIsSidebarVisible(false)}
        aria-label="Cerrar menu lateral"
      />

      <section className="dashboard-main">
        <DashboardHeader
          isSidebarVisible={isSidebarVisible}
          onToggleSidebar={() => setIsSidebarVisible((current) => !current)}
          roleName={roleName}
          subtitle={activeModule.summary}
          title={activeModule.label}
          userName={session.user?.nombre_completo || session.user?.username || 'Usuario'}
        />

        <div className="dashboard-content">
          {activeMenu === 'users' && canUseUsers ? (
            <UsersModule isActive={activeMenu === 'users'} token={session.token} />
          ) : activeMenu === 'entries' && canUseEntries ? (
            <EntriesModule isActive={activeMenu === 'entries'} token={session.token} userName={session.user?.nombre_completo || session.user?.username || 'Usuario'} />
          ) : activeMenu === 'clients' && canUseClients ? (
            <ClientsModule isActive={activeMenu === 'clients'} token={session.token} />
          ) : activeMenu === 'inventory' && canUseInventory ? (
            <InventoryModule isActive={activeMenu === 'inventory'} token={session.token} />
          ) : activeMenu === 'providers' && canUseProviders ? (
            <ProvidersModule isActive={activeMenu === 'providers'} token={session.token} />
          ) : activeMenu === 'maturation' && canUseMaturation ? (
            <MaturationControlModule isActive={activeMenu === 'maturation'} token={session.token} />
          ) : activeMenu === 'production' && canUseProduction ? (
            <ProductionModule isActive={activeMenu === 'production'} token={session.token} />
          ) : activeMenu === 'serviceTypes' && canUseServiceTypes ? (
            <ServiceTypesModule isActive={activeMenu === 'serviceTypes'} token={session.token} />
          ) : activeMenu === 'vehicles' && canUseVehicles ? (
            <VehiclesModule
              isActive={activeMenu === 'vehicles'}
              roleName={roleName}
              token={session.token}
            />
          ) : activeMenu === 'vehicleServices' && canUseVehicleServices ? (
            <VehicleServicesModule
              isActive={activeMenu === 'vehicleServices'}
              roleName={roleName}
              token={session.token}
            />
          ) : activeMenu === 'products' && canUseProducts ? (
            <ProductsModule isActive={activeMenu === 'products'} token={session.token} />
          ) : (
            <DashboardOverview
              showUpcomingVehicleServices={canUseVehicleServices}
              showUpcomingMaturationLots={canUseMaturation}
              token={session.token}
            />
          )}
        </div>
      </section>
    </main>
  )
}

export default DashboardPage
