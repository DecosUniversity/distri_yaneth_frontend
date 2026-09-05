import { lazy, Suspense } from 'react'
import UpcomingVehicleServicesWidget from './UpcomingVehicleServicesWidget'
import UpcomingMaturationLotsWidget from './UpcomingMaturationLotsWidget'
import ProductionStatusWidget from './ProductionStatusWidget'
import PendingAssignmentsWidget from './PendingAssignmentsWidget'
import CollapsibleSection from './CollapsibleSection'

const DashboardCharts = lazy(() => import('./DashboardCharts'))

function DashboardOverview({
  token,
  roleName,
  showUpcomingVehicleServices = true,
  showUpcomingMaturationLots = true,
  showProductionStatus = true,
  showPendingAssignments = false,
  showProductionCharts = false,
  showOrderCharts = false,
  showInventoryCharts = false,
}) {
  const showAnyChart = showProductionCharts || showOrderCharts || showInventoryCharts

  return (
    <>
      <CollapsibleSection title="Resumen en tiempo real" storageKey="dashboard:collapsed:widgets">
        <div className="dashboard-widgets">
          {showPendingAssignments ? <PendingAssignmentsWidget token={token} roleName={roleName} /> : null}
          {showUpcomingVehicleServices ? <UpcomingVehicleServicesWidget token={token} /> : null}
          {showUpcomingMaturationLots ? <UpcomingMaturationLotsWidget token={token} /> : null}
          {showProductionStatus ? <ProductionStatusWidget token={token} /> : null}
        </div>
      </CollapsibleSection>

      {showAnyChart ? (
        <div style={{ marginTop: 24 }}>
          <Suspense fallback={<p className="widget-muted">Cargando graficas...</p>}>
            <DashboardCharts
              token={token}
              showProductionCharts={showProductionCharts}
              showOrderCharts={showOrderCharts}
              showInventoryCharts={showInventoryCharts}
            />
          </Suspense>
        </div>
      ) : null}
    </>
  )
}

export default DashboardOverview
