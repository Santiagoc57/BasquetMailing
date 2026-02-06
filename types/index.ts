export interface Team {
  id: string
  name: string
  logo: string
  league?: string
}

export interface Match {
  id: string
  date: string
  time: string
  homeTeam: Team
  awayTeam: Team
  times: {
    ARG: string // Argentina (hora base)
    BOL: string // Bolivia (1 hora menos)
    ECU: string // Ecuador (2 horas menos)
    CHI: string // Chile (configurable, por defecto igual a Bolivia)
  }
  league: string // Liga a la que pertenece el partido
  leagueColor?: string // Color personalizado para la liga
  textColor?: string // Color del texto (white o black)
}

export interface League {
  name: string
  color: string
  gradient?: {
    enabled: boolean
    startColor: string
    endColor: string
    direction: "to right" | "to left" | "to bottom" | "to top"
  }
}

export interface UploadedLogo {
  id: string
  name: string
  url: string
  teamName: string
  confirmed: boolean
}

export interface TimeZoneConfig {
  name: string
  diffHours: number
  label: string
}

export interface AppState {
  fixtures: Match[]
  teams: Team[]
  leagues: League[]
  timeZones: TimeZoneConfig[]
  showTimeLabels: boolean
  showDividers: boolean
  showTeamNames: boolean
  exportTextColorBlack: boolean
  exportHorario: string
  backgroundColor: string

  // Offsets y tamaños
  timeBlockOffset: number
  countryLabelOffset: number
  teamNamesOffset: number
  teamNamesFontSize: number
  timesFontSize: number
  dividerHeight: number
  horizontalTimeOffset: number // Nuevo offset horizontal para horarios

  // Espaciados de exportación
  exportSpacing: number
  exportDateSpacing: number
  exportDateFontSize: number
  fixtureSpacing: number
  fixtureMarginTop: number
  fixtureMarginBottom: number
}
