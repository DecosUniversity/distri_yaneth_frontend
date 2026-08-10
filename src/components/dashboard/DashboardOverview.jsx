import UpcomingVehicleServicesWidget from './UpcomingVehicleServicesWidget'
import UpcomingMaturationLotsWidget from './UpcomingMaturationLotsWidget'
import ProductionStatusWidget from './ProductionStatusWidget'

function DashboardOverview({
  token,
  showUpcomingVehicleServices = true,
  showUpcomingMaturationLots = true,
  showProductionStatus = true,
}) {

  return (
    <section className="dashboard-widgets" aria-label="Resumen general">
      {showUpcomingVehicleServices ? <UpcomingVehicleServicesWidget token={token} /> : null}
      {showUpcomingMaturationLots ? <UpcomingMaturationLotsWidget token={token} /> : null}
      {showProductionStatus ? <ProductionStatusWidget token={token} /> : null}
    </section>
  )
}

export default DashboardOverview
