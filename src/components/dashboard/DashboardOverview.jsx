import UpcomingVehicleServicesWidget from './UpcomingVehicleServicesWidget'
import UpcomingMaturationLotsWidget from './UpcomingMaturationLotsWidget'

function DashboardOverview({ token, showUpcomingVehicleServices = true, showUpcomingMaturationLots = true }) {

  return (
    <section className="dashboard-widgets" aria-label="Resumen general">
      {showUpcomingVehicleServices ? <UpcomingVehicleServicesWidget token={token} /> : null}
      {showUpcomingMaturationLots ? <UpcomingMaturationLotsWidget token={token} /> : null}
    </section>
  )
}

export default DashboardOverview
