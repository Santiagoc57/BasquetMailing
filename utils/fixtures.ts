import type { Match, Team, TimeZoneConfig, League } from "@/types"

// Función para calcular los horarios en diferentes zonas horarias
export const calculateTimes = (baseTime: string, timeZones: TimeZoneConfig[]) => {
  // Parsear la hora base (formato: "HH:MM")
  const [hours, minutes] = baseTime.split(":").map(Number)

  // Calcular horarios para cada país según la configuración
  const times: Record<string, string> = {}

  timeZones.forEach((tz) => {
    const tzHours = (hours + tz.diffHours + 24) % 24
    // Mostrar hora sin cero a la izquierda (ej: 8:30)
    times[tz.name] = `${tzHours}:${minutes.toString().padStart(2, "0")}`
  })

  if (!times.CHI) {
    times.CHI = times.BOL
  }

  return times as { ARG: string; BOL: string; ECU: string; CHI: string }
}

// Función para formatear la fecha sin ceros a la izquierda en el mes
export const formatDate = (dateStr: string) => {
  const [day, month] = dateStr.split("-").map(Number)
  return `${day}/${month}`
}

// Función para encontrar o crear un equipo
export const findOrCreateTeam = (
  teamName: string,
  leagueName: string,
  teams: Team[],
  addTeam: (team: Team) => void,
): Team => {
  // Primero buscar por nombre exacto
  let team = teams.find((t) => t.name.toLowerCase() === teamName.trim().toLowerCase())

  // Si no se encuentra, buscar por coincidencia parcial
  if (!team) {
    team = teams.find(
      (t) =>
        t.name.toLowerCase().includes(teamName.trim().toLowerCase()) ||
        teamName.trim().toLowerCase().includes(t.name.toLowerCase()),
    )
  }

  // Si aún no se encuentra, crear un nuevo equipo
  if (!team) {
    team = {
      id: `new-${Date.now()}-${teamName}`,
      name: teamName.trim(),
      logo: "/placeholder.svg?height=100&width=100",
      league: leagueName,
    }
    addTeam(team)
  }

  return team
}

// Función para encontrar o crear una liga
export const findOrCreateLeague = (
  leagueName: string,
  leagues: League[],
  addLeague: (league: League) => void,
): League => {
  let league = leagues.find((l) => l.name.toLowerCase() === leagueName.trim().toLowerCase())

  if (!league) {
    league = {
      name: leagueName.trim(),
      color: "#000000",
    }
    addLeague(league)
  }

  return league
}

// Función para agrupar fixtures por liga y fecha
export const groupFixturesByLeague = (fixtures: Match[]) => {
  return fixtures.reduce(
    (groups, fixture) => {
      if (!groups[fixture.league]) {
        groups[fixture.league] = {}
      }

      if (!groups[fixture.league][fixture.date]) {
        groups[fixture.league][fixture.date] = []
      }

      groups[fixture.league][fixture.date].push(fixture)
      return groups
    },
    {} as Record<string, Record<string, Match[]>>,
  )
}

// Función para precargar imágenes
export const preloadImage = (src: string): Promise<void> => {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve()
    img.onerror = () => reject()
    img.crossOrigin = "anonymous"
    img.src = src
  })
}
