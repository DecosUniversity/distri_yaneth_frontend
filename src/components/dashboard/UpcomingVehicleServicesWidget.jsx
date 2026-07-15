import { useEffect, useMemo, useState } from 'react'
import { listServiceTypesRequest } from '../../services/serviceType.service'
import { listVehiclesRequest } from '../../services/vehicle.service'
import { listVehicleServicesRequest } from '../../services/vehicleService.service'

const MAX_ITEMS = 4

const parseDateScore = (value) => {
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? 0 : parsed.getTime()
}

const formatKm = (value) => {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return '-'
  }

  return new Intl.NumberFormat('es-GT', {
    maximumFractionDigits: 2,
  }).format(Number(value))
}

function UpcomingVehicleServicesWidget({ token }) {
  const [services, setServices] = useState([])
  const [vehicles, setVehicles] = useState([])
  const [serviceTypes, setServiceTypes] = useState([])
  const [isLoading, setIsLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(() => {
    const loadWidgetData = async () => {
      setErrorMessage('')
      setIsLoading(true)

      try {
        const [servicesData, vehiclesData, serviceTypesData] = await Promise.all([
          listVehicleServicesRequest(token),
          listVehiclesRequest(token),
          listServiceTypesRequest(token),
        ])

        setServices(Array.isArray(servicesData) ? servicesData : [])
        setVehicles(Array.isArray(vehiclesData) ? vehiclesData : [])
        setServiceTypes(Array.isArray(serviceTypesData) ? serviceTypesData : [])
      } catch (error) {
        setErrorMessage(error.message || 'No se pudieron cargar los proximos servicios')
      } finally {
        setIsLoading(false)
      }
    }

    loadWidgetData()
  }, [token])

  const upcomingServices = useMemo(() => {
    const vehiclesById = new Map(vehicles.map((vehicle) => [Number(vehicle.id_vehiculo), vehicle]))
    const serviceTypesById = new Map(
      serviceTypes.map((serviceType) => [Number(serviceType.id_tipo_servicio), serviceType])
    )
    const latestByVehicleAndType = new Map()

    services.forEach((service) => {
      const vehicleId = Number(service.id_vehiculo)
      const serviceTypeId = Number(service.id_tipo_servicio)
      const key = `${vehicleId}-${serviceTypeId}`
      const current = latestByVehicleAndType.get(key)

      if (!current) {
        latestByVehicleAndType.set(key, service)
        return
      }

      const currentScore = parseDateScore(current.fecha_servicio || current.fecha_reporte || 0)
      const nextScore = parseDateScore(service.fecha_servicio || service.fecha_reporte || 0)

      if (nextScore >= currentScore) {
        latestByVehicleAndType.set(key, service)
      }
    })

    return Array.from(latestByVehicleAndType.values())
      .map((service) => {
        const vehicle = vehiclesById.get(Number(service.id_vehiculo))
        const serviceType = serviceTypesById.get(Number(service.id_tipo_servicio))

        if (!vehicle || !serviceType) {
          return null
        }

        const vehicleMileage = Number(vehicle.kilometraje_actual)
        const lastMileage = Number(service.km_en_servicio)
        const targetMileage = Number(service.proximo_servicio_km)
        const frequency = Number(serviceType.km_frecuencia)

        if (Number.isNaN(vehicleMileage)) {
          return null
        }

        const dueMileage = Number.isNaN(targetMileage) ? lastMileage + frequency : targetMileage
        const remainingKm = dueMileage - vehicleMileage

        return {
          id: `${vehicle.id_vehiculo}-${serviceType.id_tipo_servicio}`,
          vehicleLabel: `${vehicle.placa || 'Vehiculo'}${vehicle.modelo ? ` · ${vehicle.modelo}` : ''}`,
          serviceLabel: serviceType.nombre_servicio || 'Servicio',
          dueMileage,
          remainingKm,
          vehicleMileage,
        }
      })
      .filter(Boolean)
      .sort((left, right) => left.remainingKm - right.remainingKm)
      .slice(0, MAX_ITEMS)
  }, [services, serviceTypes, vehicles])

  return (
    <article className="widget-card widget-card--compact widget-card--mileage" aria-label="Servicios proximos a vencer">
      <div className="widget-compact-header">
        <h3>Servicios proximos</h3>
        <span className="widget-badge">km</span>
      </div>

      {isLoading ? <p className="widget-muted">Cargando proximos servicios...</p> : null}
      {errorMessage ? <p className="widget-error">{errorMessage}</p> : null}

      {!isLoading && !errorMessage ? (
        upcomingServices.length > 0 ? (
          <ul className="widget-list widget-list--compact">
            {upcomingServices.map((item) => (
              <li key={item.id}>
                <strong>{item.serviceLabel}</strong>
                <span>{item.vehicleLabel}</span>
                <small>
                  {item.remainingKm <= 0
                    ? item.remainingKm < 0
                      ? `Servicio vencido por ${formatKm(Math.abs(item.remainingKm))} km`
                      : 'Faltan 0 km para el servicio'
                    : `Faltan ${formatKm(item.remainingKm)} km para el servicio`}
                </small>
              </li>
            ))}
          </ul>
        ) : (
          <p className="widget-muted">No hay servicios proximos por mostrar.</p>
        )
      ) : null}
    </article>
  )
}

export default UpcomingVehicleServicesWidget