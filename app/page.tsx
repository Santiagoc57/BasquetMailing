"use client"

import React, { useCallback, useState, useRef, useEffect, useMemo } from "react"
import { useAppContext } from "@/context/AppContext"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Switch } from "@/components/ui/switch"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ToastAction } from "@/components/ui/toast"
import { Upload, Download, Edit, Trash, ChevronDown, Palette, Calendar, Users, Trophy, Settings, LayoutTemplate } from "lucide-react"
import GraphicFixtureTab, { GRAPHIC_STATE_STORAGE_KEY } from "@/components/GraphicFixtureTab"
import { useToast } from "@/hooks/use-toast"
import html2canvas from "html2canvas"
import JSZip from "jszip"
import { elementToSVG, inlineResources } from "dom-to-svg"
import { inferLeagueNameFromPath, resolveTeamNameAlias } from "@/utils/team-aliases"

interface Team {
  id: string
  name: string
  logo: string
  league?: string
}

const normalizeTeamName = (name: string) =>
  name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/gi, "")
    .toLowerCase()

const FIXTURE_LAYOUT_VERSION = 2
const FIXTURE_OFFSET_SCALE = 0.7

const scaleFixtureOffset = (offset: number) => Math.round(offset * FIXTURE_OFFSET_SCALE)

const LEAGUE_IMPORT_ALIASES: Record<string, string> = {
  u: "U22",
  ligau: "U22",
  chile: "Liga Chery",
  ligachile: "Liga Chery",
}

const sanitizeImportedLeagueHeader = (value: string) =>
  value
    .replace(/\s*[:(\[].*$/, "")
    .replace(/\s+-\s*(?:foto|fotos|imagen|imagenes)\b.*$/i, "")
    .replace(/\s+(?:foto|fotos|imagen|imagenes)\b.*$/i, "")
    .replace(/\s+/g, " ")
    .trim()

const resolveImportedLeagueName = (rawHeader: string, leagues: League[]) => {
  const cleaned = sanitizeImportedLeagueHeader(rawHeader)
  if (!cleaned) return ""

  const candidateWithoutLigaPrefix = cleaned.replace(/^liga\s+/i, "").trim()
  const normalizedLeagueMap = new Map<string, string>()

  for (const league of [...PREDEFINED_LEAGUES, ...leagues]) {
    const key = normalizeTeamName(league.name)
    if (!key || normalizedLeagueMap.has(key)) continue
    normalizedLeagueMap.set(key, league.name)
  }

  const candidates = [cleaned, candidateWithoutLigaPrefix].filter(Boolean)

  for (const candidate of candidates) {
    const alias = LEAGUE_IMPORT_ALIASES[normalizeTeamName(candidate)]
    if (alias) {
      return alias
    }
  }

  for (const candidate of candidates) {
    const existing = normalizedLeagueMap.get(normalizeTeamName(candidate))
    if (existing) {
      return existing
    }
  }

  return cleaned
}

const IMPORT_DATE_PREFIX_RE = /^\s*(?:[A-Za-zÁÉÍÓÚáéíóúñÑ]+\.?\s+)?(?:0?[1-9]|[12]\d|3[01])\/(?:0?[1-9]|1[0-2])(?:\/\d{4})?/
const IMPORT_INLINE_TIME_FIX_RE =
  /(\b(?:0?[1-9]|[12]\d|3[01])\/(?:0?[1-9]|1[0-2])(?:\/\d{4})?)(?=\d{1,2}:\d{2}\b)/
const IMPORT_FIXTURE_RE = new RegExp(
  String.raw`^\s*(?:[A-Za-zÁÉÍÓÚáéíóúñÑ]+\.?\s+)?(0?[1-9]|[12]\d|3[01])\/(0?[1-9]|1[0-2])(?:\/(\d{4}))?\s+(\d{1,2}:\d{2})(?:\s*\|\s*)?\s*(.+?)(?:\s*(?:-|–|—|vs|VS|Vs)\s*|\s{2,})(.+)$`,
)

const levenshteinDistance = (a: string, b: string) => {
  if (a === b) {
    return 0
  }
  if (a.length === 0) {
    return b.length
  }
  if (b.length === 0) {
    return a.length
  }

  const matrix: number[][] = Array.from({ length: a.length + 1 }, () => new Array(b.length + 1).fill(0))

  for (let i = 0; i <= a.length; i++) {
    matrix[i][0] = i
  }
  for (let j = 0; j <= b.length; j++) {
    matrix[0][j] = j
  }

  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      matrix[i][j] = Math.min(matrix[i - 1][j] + 1, matrix[i][j - 1] + 1, matrix[i - 1][j - 1] + cost)
    }
  }

  return matrix[a.length][b.length]
}

interface Match {
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
    BRA: string // Brasil (igual a Argentina)
    ESP?: string // España (3 horas más)
  }
  dates?: {
    ECU?: string
    ARG?: string
    ESP?: string
  }
  league: string // Liga a la que pertenece el partido
  leagueColor?: string // Color personalizado para la liga
  textColor?: string // Color del texto (white o black)
  dateTextColor?: string // Color del texto de la fecha (white o black)
  dateFontSize?: number // Tamaño de la fuente de la fecha
}

interface League {
  name: string
  color: string
  gradient?: {
    enabled: boolean
    startColor: string
    endColor: string
    direction: "to right" | "to left" | "to top" | "to bottom"
  }
}

const PREDEFINED_LEAGUES: League[] = [
  { name: "Euroliga", color: "#ff6b00", gradient: undefined },
  { name: "Endesa", color: "#ff2600", gradient: undefined },
  { name: "U22", color: "#405da8" },
  { name: "NBB", color: "#F7A813" },
  { name: "Liga Ouro", color: "#006636" },
  { name: "Liga Nacional", color: "#5e0b11" },
  { name: "Liga Argentina", color: "#08A3C7" },
  { name: "Primera FEB", color: "#ff1d25" },
  { name: "Liga Femenina", color: "#1F1A17" },
  { name: "LUB", color: "#29a8df" },
  { name: "Liga Chery", color: "#AF905C" },
  { name: "Liga Dos", color: "#929292" },
  { name: "Libo", color: "#008E00" },
  { name: "Liga Ecuador", color: "#FFE000" },
  { name: "Ecuador Femenino", color: "#ff40ff" },
  { name: "Liga Nacional Femenina Chile", color: "#002244" },
  { name: "Italia", color: "#B70821" },
  { name: "Proximo", color: "#263B00" },
]

// Añadir estas interfaces y estados después de las interfaces existentes
interface UploadedLogo {
  id: string
  name: string
  url: string
  teamName: string
  confirmed: boolean
}

interface TimeZoneConfig {
  name: string
  diffHours: number
  label: string
  enabled?: boolean
}

interface TimeWithDate {
  time: string
  date: string
  dateChanged: boolean
}

// Configuración de zonas horarias
const timeZonesConfig: TimeZoneConfig[] = [
  { name: "ECU", diffHours: -2, label: "ECU", enabled: true },
  { name: "BOL", diffHours: -1, label: "BOL / CHI", enabled: true },
  { name: "ARG", diffHours: 0, label: "ARG / BRA / URU", enabled: false },
  { name: "ESP", diffHours: 4, label: "ESP", enabled: false },
]

const SESSION_STORAGE_KEY = "fixture-generator-session-v1"

const getDefaultTimeZones = () => timeZonesConfig.map((tz) => ({ ...tz }))

const hasLegacyChileTimeZone = (timeZones?: TimeZoneConfig[]) =>
  Array.isArray(timeZones) && timeZones.some((tz) => tz.name === "ARG" && (tz.label || "").trim().toUpperCase() === "CHI")

const normalizeExportHorario = (horario?: string, timeZones?: TimeZoneConfig[]) => {
  if (horario === "ARG" && hasLegacyChileTimeZone(timeZones)) {
    return "BOL"
  }

  return horario || "BOL"
}

const normalizeTimeZones = (timeZones?: TimeZoneConfig[]) => {
  if (!Array.isArray(timeZones) || timeZones.length === 0) {
    return getDefaultTimeZones()
  }

  const hasLegacyChileZone = hasLegacyChileTimeZone(timeZones)

  return timeZones.map((tz) => {
    if (tz.name === "BOL") {
      return {
        ...tz,
        label: !tz.label || tz.label.trim().toUpperCase() === "BOL" ? "BOL / CHI" : tz.label,
        enabled: tz.enabled ?? true,
      }
    }

    if (tz.name === "ARG" && hasLegacyChileZone) {
      return {
        ...tz,
        label: "ARG / BRA / URU",
        enabled: false,
      }
    }

    if (tz.name === "ECU") {
      return { ...tz, enabled: tz.enabled ?? true }
    }

    if (tz.name === "ESP") {
      return { ...tz, enabled: tz.enabled ?? false }
    }

    return { ...tz, enabled: tz.enabled ?? true }
  })
}

// Función para calcular los horarios en diferentes zonas horarias
const calculateTimes = (baseTime: string, timeZones: TimeZoneConfig[], baseDate: string = "1") => {
  // Parsear la hora base (formato: "HH:MM")
  const [hours, minutes] = baseTime.split(":").map(Number)

  // Calcular horarios para cada país según la configuración
  const times: Record<string, string> = {}
  const dates: Record<string, string> = {}

  timeZones.forEach((tz) => {
    const totalHours = hours + tz.diffHours
    const tzHours = ((totalHours % 24) + 24) % 24
    const dayOffset = Math.floor(totalHours / 24)
    
    // Mostrar hora sin cero a la izquierda (ej: 8:30)
    times[tz.name] = `${tzHours}:${minutes.toString().padStart(2, "0")}`
    
    // Calcular la fecha si hay cambio de día
    if (dayOffset !== 0) {
      const [day, month] = baseDate.split("-").map(Number)
      const date = new Date(2024, month - 1, day)
      date.setDate(date.getDate() + dayOffset)
      dates[tz.name] = `${date.getDate()}-${(date.getMonth() + 1).toString().padStart(2, "0")}`
    }
  })

  if (!times.CHI) {
    times.CHI = times.BOL
  }
  
  if (!times.BRA) {
    times.BRA = times.ARG // Brasil tiene el mismo horario que Argentina
  }

  return { times: times as { ARG: string; BOL: string; ECU: string; CHI: string; BRA: string; ESP?: string }, dates }
}

export default function Home() {
  // Estado para mostrar alertas de error de almacenamiento
  const [storageError, setStorageError] = useState<string | null>(null)
  const [isSessionHydrated, setIsSessionHydrated] = useState(false)

  // Use AppContext for offsets so controls here affect live render
  const {
    timeBlockOffset: ctxTimeBlockOffset,
    setTimeBlockOffset: ctxSetTimeBlockOffset,
    timeBlockOffsetInput: ctxTimeBlockOffsetInput,
    setTimeBlockOffsetInput: ctxSetTimeBlockOffsetInput,
    teamNamesOffset: ctxTeamNamesOffset,
    setTeamNamesOffset: ctxSetTeamNamesOffset,
    teamNamesOffsetInput: ctxTeamNamesOffsetInput,
    setTeamNamesOffsetInput: ctxSetTeamNamesOffsetInput,
    compactTimeBlockOffset: ctxCompactTimeBlockOffset,
    setCompactTimeBlockOffset: ctxSetCompactTimeBlockOffset,
    compactTimeBlockOffsetInput: ctxCompactTimeBlockOffsetInput,
    setCompactTimeBlockOffsetInput: ctxSetCompactTimeBlockOffsetInput,
    compactTeamNamesOffset: ctxCompactTeamNamesOffset,
    setCompactTeamNamesOffset: ctxSetCompactTeamNamesOffset,
    compactTeamNamesOffsetInput: ctxCompactTeamNamesOffsetInput,
    setCompactTeamNamesOffsetInput: ctxSetCompactTeamNamesOffsetInput,
  } = useAppContext()
  const { toast } = useToast()

  // Reemplazar la línea del estado timeBlockOffset con estos dos estados separados
  const [timeBlockOffset, setTimeBlockOffset] = useState(scaleFixtureOffset(-35)) // Offset vertical para el bloque de horarios (valor negativo para subir)
  const [timeBlockOffsetInput, setTimeBlockOffsetInput] = useState(scaleFixtureOffset(-35))
  const [countryLabelOffset, setCountryLabelOffset] = useState(scaleFixtureOffset(-35)) // Offset vertical para las etiquetas de países
  const [countryLabelOffsetInput, setCountryLabelOffsetInput] = useState(scaleFixtureOffset(-35))
  const [editingLeague, setEditingLeague] = useState<League | null>(null)

  // Añadir estado para el equipo en edición
  const [editingTeam, setEditingTeam] = useState<Team | null>(null)

  // Add a new state for the display mode toggle after the other state declarations
  const [showTeamNames, setShowTeamNames] = useState<boolean>(false)
  
  // Estado para el preset de posiciones
  const [preset, setPreset] = useState<"Con HORARIOS" | "Con NOMBRES">("Con HORARIOS")

  // Añadir estos nuevos estados después de los estados existentes
  const [teamNamesFontSize, setTeamNamesFontSize] = useState<number>(20)
  const [teamNamesFontSizeInput, setTeamNamesFontSizeInput] = useState<number>(20)
  const [teamNamesOffset, setTeamNamesOffset] = useState<number>(scaleFixtureOffset(-45)) // Offset vertical para los nombres de equipos
  const [teamNamesOffsetInput, setTeamNamesOffsetInput] = useState<number>(scaleFixtureOffset(-45))

  // Añadir el estado y control para horizontalTimeOffset
  const [horizontalTimeOffset, setHorizontalTimeOffset] = useState<number>(0) // Offset horizontal para el bloque de horarios
  const [horizontalTimeOffsetInput, setHorizontalTimeOffsetInput] = useState<number>(0)

  // Posición vertical de la fecha y estilo de bloque (vista web)
  const [dateVerticalOffset, setDateVerticalOffset] = useState<number>(0)
  const [dateVerticalOffsetInput, setDateVerticalOffsetInput] = useState<number>(0)
  const [blockStyle, setBlockStyle] = useState<"normal" | "compact" | "five-fixtures" | "two-column">("normal")
  const [exportHorario, setExportHorario] = useState<string>("BOL") // Horario para exportación (usado internamente)
  const [exportFormat, setExportFormat] = useState<"PNG" | "SVG">("PNG")

  // Ajustes del modo normal
  const [normalLogoWidth, setNormalLogoWidth] = useState<number>(144)
  const [normalLogoHeight, setNormalLogoHeight] = useState<number>(128)
  const [normalBandWidth, setNormalBandWidth] = useState<number>(474)
  const [normalBandHeight, setNormalBandHeight] = useState<number>(108)
  const [normalInterDateGap, setNormalInterDateGap] = useState<number>(-20)
  const [normalDateBlockGap, setNormalDateBlockGap] = useState<number>(0)
  const [normalDateFontScale, setNormalDateFontScale] = useState<number>(0.7)

  // Ajustes del modo compacto (condensado)
  const [compactBandWidth, setCompactBandWidth] = useState<number>(450)
  const [compactBandHeight, setCompactBandHeight] = useState<number>(75)
  const [compactTimesFontDelta, setCompactTimesFontDelta] = useState<number>(-8)
  const [compactTeamNamesFontDelta, setCompactTeamNamesFontDelta] = useState<number>(-2)
  const [compactDividerHeight, setCompactDividerHeight] = useState<number>(40)
  const [compactFixtureMarginAdjust, setCompactFixtureMarginAdjust] = useState<number>(-4)
  const [compactDateFontScale, setCompactDateFontScale] = useState<number>(0.7)
  const [compactDateBlockGap, setCompactDateBlockGap] = useState<number>(0)
  const [compactInterDateGap, setCompactInterDateGap] = useState<number>(-21)
  const [compactPresetName, setCompactPresetName] = useState<string>("Personalizado")
  const [compactGradientEnabled, setCompactGradientEnabled] = useState<boolean>(false)
  const [compactGradientStart, setCompactGradientStart] = useState<string>("#EB5B27")
  const [compactGradientEnd, setCompactGradientEnd] = useState<string>("#FF8C00")
  const [compactGradientDirection, setCompactGradientDirection] = useState<"to right" | "to left" | "to top" | "to bottom">("to right")

  // Ajustes del modo 5 fixtures (configuración especial)
  const [fiveBandWidth, setFiveBandWidth] = useState<number>(620)
  const [fiveBandHeight, setFiveBandHeight] = useState<number>(80)
  const [fiveLogoWidth, setFiveLogoWidth] = useState<number>(120)
  const [fiveLogoHeight, setFiveLogoHeight] = useState<number>(110)
  const [fiveTimesFontDelta, setFiveTimesFontDelta] = useState<number>(-5)
  const [fiveFixtureMarginAdjust, setFiveFixtureMarginAdjust] = useState<number>(-4)
  const [fiveDateFontScale, setFiveDateFontScale] = useState<number>(0.85)
  const [fiveDateBlockGap, setFiveDateBlockGap] = useState<number>(0)
  const [fiveInterDateGap, setFiveInterDateGap] = useState<number>(-21)
  const [fiveFixtureSpacingBetweenDates, setFiveFixtureSpacingBetweenDates] = useState<number>(-22)

  // Ajustes del modo dos columnas
  const [twoColLogoSize, setTwoColLogoSize] = useState<number>(88)
  const [twoColLogoHeight, setTwoColLogoHeight] = useState<number>(78)
  const [twoColCardWidth, setTwoColCardWidth] = useState<number>(420)
  const [twoColBandWidth, setTwoColBandWidth] = useState<number>(150)
  const [twoColBandHeight, setTwoColBandHeight] = useState<number>(68)
  const [twoColBandRadius, setTwoColBandRadius] = useState<number>(0)
  const [twoColBandGap, setTwoColBandGap] = useState<number>(0)
  const [twoColGapY, setTwoColGapY] = useState<number>(7)       // Espacio entre filas
  const [twoColGapX, setTwoColGapX] = useState<number>(8)       // Espacio entre columnas
  const [twoColColumnOffset, setTwoColColumnOffset] = useState<number>(-80)
  const [twoColLogoBorderRadius, setTwoColLogoBorderRadius] = useState<number>(0)
  const [twoColTeamNameFont, setTwoColTeamNameFont] = useState<number>(16)
  const [twoColTimeFont, setTwoColTimeFont] = useState<number>(30)
  const [twoColTimeOffset, setTwoColTimeOffset] = useState<number>(-15)   // Offset vertical hora
  const [twoColNameOffset, setTwoColNameOffset] = useState<number>(-9)    // Offset vertical nombres
  const [twoColNamesWrap, setTwoColNamesWrap] = useState<boolean>(false)  // checkbox desactivado
  const [twoColNamesMaxWidth, setTwoColNamesMaxWidth] = useState<number>(-1800)
  const [twoColDateFontScale, setTwoColDateFontScale] = useState<number>(0.7)
  const [twoColInterDateGap, setTwoColInterDateGap] = useState<number>(15)   // Espacio arriba de la fecha
  const [twoColDateBlockGap, setTwoColDateBlockGap] = useState<number>(-5)   // Espacio entre fecha y bloques
  const [twoColNameHorizontalOffset, setTwoColNameHorizontalOffset] = useState<number>(-48)
  const [twoColTimeHorizontalOffset, setTwoColTimeHorizontalOffset] = useState<number>(0)
  const [twoColDateHorizontalOffset, setTwoColDateHorizontalOffset] = useState<number>(368)
  const [twoColDateVerticalOffset, setTwoColDateVerticalOffset] = useState<number>(-10)

  // Estado de ligas: SIEMPRE igual al array del código
  const [leagues, setLeagues] = useState<League[]>(PREDEFINED_LEAGUES)

  // Espaciado entre fixtures exportados
  const [exportSpacing, setExportSpacing] = useState<number>(90)
  const [exportSpacingInput, setExportSpacingInput] = useState<number>(90)
  // Espacio entre fecha y fixture en la exportación
  const [exportDateSpacing, setExportDateSpacing] = useState<number>(2)
  const [exportDateSpacingInput, setExportDateSpacingInput] = useState<number>(2)
  // Color de la tipografía de exportación (true = negro, false = blanco)
  const [exportTextColorBlack, setExportTextColorBlack] = useState<boolean>(false)
  // Tamaño de fuente de la fecha en la exportación
  const [fixtureDateFontSize, setFixtureDateFontSize] = useState<number>(125)
  const [fixtureDateFontSizeInput, setFixtureDateFontSizeInput] = useState(125)
  // Tamaño fijo para fecha cuando exporta en modo compacto

  // Espaciado visual entre fixture y fecha en la vista web
  const [fixtureSpacing, setFixtureSpacing] = useState<number>(8) // Espacio entre fixture y fecha (web)
  const [fixtureSpacingInput, setFixtureSpacingInput] = useState<number>(8)
  const [fixtureMarginTop, setFixtureMarginTop] = useState<number>(0) // Espacio superior de cada fixture (web)
  const [fixtureMarginTopInput, setFixtureMarginTopInput] = useState<number>(0)
  const [fixtureMarginBottom, setFixtureMarginBottom] = useState<number>(0) // Espacio inferior de cada fixture (web)
  const [fixtureMarginBottomInput, setFixtureMarginBottomInput] = useState<number>(0)

  // Configuración de zonas horarias
  const [timeZones, setTimeZones] = useState<TimeZoneConfig[]>(getDefaultTimeZones)

  // Controles para posición de fechas
  const [dateOriginalOffsetX, setDateOriginalOffsetX] = useState<number>(89) // Desplazamiento horizontal de fecha original (27)
  const [dateESPOffsetX, setDateESPOffsetX] = useState<number>(163) // Desplazamiento horizontal de fecha ESP (28)
  const [fixtureSpacingBetweenDates, setFixtureSpacingBetweenDates] = useState<number>(-8) // Espacio entre bloques de fechas diferentes
  const [fixtureSpacingBetweenDatesInput, setFixtureSpacingBetweenDatesInput] = useState<number>(-8)

  // Inicializar fixtures con un array vacío
  const [fixtures, setFixtures] = useState<Match[]>([])

  // Inicializar teams con un array vacío
  const [teams, setTeams] = useState<Team[]>([])

  const [newTeam, setNewTeam] = useState({ name: "", logo: "", league: "" })

  // Lista de equipos deduplicada por id para evitar keys repetidas en renders
  const uniqueTeams = useMemo(() => {
    const map = new Map<string, Team>()
    for (const t of teams) {
      if (!map.has(t.id)) map.set(t.id, t)
    }
    return Array.from(map.values())
  }, [teams])
  const [newLeague, setNewLeague] = useState({ name: "", color: "#000000" })
  const [bulkImportText, setBulkImportText] = useState("")
  const [showTimeLabels, setShowTimeLabels] = useState(true)
  const [backgroundColor, setBackgroundColor] = useState("#FF4500") // Naranja brillante como en la imagen
  const [showDividers, setShowDividers] = useState(true)
  const [exportMode, setExportMode] = useState(false)
  const [exportMinimalMode, setExportMinimalMode] = useState(false) // Exportar sin nombres, horarios ni divisores
  const [importSuccess, setImportSuccess] = useState(false)
  const exportContainerRef = useRef<HTMLDivElement>(null)
  const sessionFileInputRef = useRef<HTMLInputElement | null>(null)
  const [newTeamName, setNewTeamName] = useState("")
  const [uploadedLogos, setUploadedLogos] = useState<UploadedLogo[]>([])
  const [autoLogosLoaded, setAutoLogosLoaded] = useState(false)
  const [localLogosStatus, setLocalLogosStatus] = useState<"idle" | "loading" | "ok" | "error">("idle")
  const [localLogosError, setLocalLogosError] = useState<string | null>(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [showDeleteLeagueConfirm, setShowDeleteLeagueConfirm] = useState<string | null>(null)
  const [dividerHeight, setDividerHeight] = useState<number>(80)
  const [dividerHeightInput, setDividerHeightInput] = useState<number>(80)
  const [timesFontSize, setTimesFontSize] = useState<number>(45)
  const [timesFontSizeInput, setTimesFontSizeInput] = useState<number>(45)
  const [timeLabelsFontSize, setTimeLabelsFontSize] = useState<number>(14)
  const [timeLabelsFontSizeInput, setTimeLabelsFontSizeInput] = useState<number>(14)
  const [editingLeagueGroup, setEditingLeagueGroup] = useState<string | null>(null)
  
  // Estados para controlar secciones colapsables en Configuración
  const [settingsOpenSections, setSettingsOpenSections] = useState({
    ajustesModos: true,
    preview: true,
  })

  // Estados para controlar dropdowns de ajustes
  const [openDropdowns, setOpenDropdowns] = useState({
    modos: false,
    fechas: false,
    espaciado: false,
    tipografia: false,
    exportacion: false,
  })

  // Estados para tipografía avanzada
  const [fontFamily, setFontFamily] = useState<string>("Poppins")
  const [fontWeight, setFontWeight] = useState<"normal" | "bold" | "600">("normal")
  const [letterSpacing, setLetterSpacing] = useState<number>(0)
  const [lineHeight, setLineHeight] = useState<number>(1.5)


  const applySession = useCallback(
    (session: any) => {
      if (!session || typeof session !== "object") {
        setStorageError("No se pudo interpretar la sesión seleccionada.")
        return
      }

      const apply = <T,>(value: T | undefined, setter: (value: T) => void) => {
        if (value !== undefined) {
          setter(value)
        }
      }

      const layoutVersion = typeof session.layoutVersion === "number" ? session.layoutVersion : 0
      const shouldMigrateFixtureOffsets = layoutVersion < FIXTURE_LAYOUT_VERSION
      const readFixtureOffset = (value: unknown, fallback: number) => {
        if (typeof value !== "number") {
          return fallback
        }
        return shouldMigrateFixtureOffsets ? scaleFixtureOffset(value) : value
      }

      if (Array.isArray(session.fixtures)) {
        setFixtures(session.fixtures)
      }

      if (Array.isArray(session.teams)) {
        setTeams(session.teams)
      }

      if (Array.isArray(session.leagues) && session.leagues.length > 0) {
        setLeagues(session.leagues)
      }

      if (Array.isArray(session.timeZones)) {
        setTimeZones(normalizeTimeZones(session.timeZones))
      }

      setTimeBlockOffset(readFixtureOffset(session.timeBlockOffset, scaleFixtureOffset(-35)))
      setTimeBlockOffsetInput(readFixtureOffset(session.timeBlockOffsetInput, scaleFixtureOffset(-35)))
      setCountryLabelOffset(readFixtureOffset(session.countryLabelOffset, scaleFixtureOffset(-35)))
      setCountryLabelOffsetInput(readFixtureOffset(session.countryLabelOffsetInput, scaleFixtureOffset(-35)))
      apply(session.showTeamNames, setShowTeamNames)
      apply(session.preset, setPreset)
      apply(session.teamNamesFontSize, setTeamNamesFontSize)
      apply(session.teamNamesFontSizeInput, setTeamNamesFontSizeInput)
      setTeamNamesOffset(readFixtureOffset(session.teamNamesOffset, scaleFixtureOffset(-45)))
      setTeamNamesOffsetInput(readFixtureOffset(session.teamNamesOffsetInput, scaleFixtureOffset(-45)))
      if (session.exportHorario !== undefined || Array.isArray(session.timeZones)) {
        setExportHorario(normalizeExportHorario(session.exportHorario, session.timeZones))
      }
      apply(session.horizontalTimeOffset, setHorizontalTimeOffset)
      apply(session.horizontalTimeOffsetInput, setHorizontalTimeOffsetInput)
      apply(session.dateVerticalOffset, setDateVerticalOffset)
      apply(session.dateVerticalOffsetInput, setDateVerticalOffsetInput)
      apply(session.blockStyle, setBlockStyle)

      apply(session.normalLogoWidth, setNormalLogoWidth)
      apply(session.normalLogoHeight, setNormalLogoHeight)
      apply(session.normalBandWidth, setNormalBandWidth)
      apply(session.normalBandHeight, setNormalBandHeight)
      apply(session.normalInterDateGap, setNormalInterDateGap)
      apply(session.normalDateBlockGap, setNormalDateBlockGap)
      apply(session.normalDateFontScale, setNormalDateFontScale)

      apply(session.compactBandWidth, setCompactBandWidth)
      apply(session.compactBandHeight, setCompactBandHeight)
      apply(session.compactTimesFontDelta, setCompactTimesFontDelta)
      apply(session.compactTeamNamesFontDelta, setCompactTeamNamesFontDelta)
      apply(session.compactDividerHeight, setCompactDividerHeight)
      apply(session.compactFixtureMarginAdjust, setCompactFixtureMarginAdjust)
      apply(session.compactDateFontScale, setCompactDateFontScale)
      apply(session.compactDateBlockGap, setCompactDateBlockGap)
      apply(session.compactInterDateGap, setCompactInterDateGap)
      apply(session.compactPresetName, setCompactPresetName)
      apply(session.compactGradientEnabled, setCompactGradientEnabled)
      apply(session.compactGradientStart, setCompactGradientStart)
      apply(session.compactGradientEnd, setCompactGradientEnd)
      apply(session.compactGradientDirection, setCompactGradientDirection)

      apply(session.fiveBandWidth, setFiveBandWidth)
      apply(session.fiveBandHeight, setFiveBandHeight)
      apply(session.fiveLogoWidth, setFiveLogoWidth)
      apply(session.fiveLogoHeight, setFiveLogoHeight)
      apply(session.fiveTimesFontDelta, setFiveTimesFontDelta)
      apply(session.fiveFixtureMarginAdjust, setFiveFixtureMarginAdjust)
      apply(session.fiveDateFontScale, setFiveDateFontScale)
      apply(session.fiveDateBlockGap, setFiveDateBlockGap)
      apply(session.fiveInterDateGap, setFiveInterDateGap)

      apply(session.twoColLogoSize, setTwoColLogoSize)
      apply(session.twoColLogoHeight, setTwoColLogoHeight)
      apply(session.twoColCardWidth, setTwoColCardWidth)
      apply(session.twoColBandWidth, setTwoColBandWidth)
      apply(session.twoColBandHeight, setTwoColBandHeight)
      apply(session.twoColBandRadius, setTwoColBandRadius)
      apply(session.twoColBandGap, setTwoColBandGap)
      apply(session.twoColGapY, setTwoColGapY)
      apply(session.twoColGapX, setTwoColGapX)
      apply(session.twoColColumnOffset, setTwoColColumnOffset)
      apply(session.twoColLogoBorderRadius, setTwoColLogoBorderRadius)
      apply(session.twoColTeamNameFont, setTwoColTeamNameFont)
      apply(session.twoColTimeFont, setTwoColTimeFont)
      apply(session.twoColTimeOffset, setTwoColTimeOffset)
      apply(session.twoColNameOffset, setTwoColNameOffset)
      apply(session.twoColNamesWrap, setTwoColNamesWrap)
      apply(session.twoColNamesMaxWidth, setTwoColNamesMaxWidth)
      apply(session.twoColDateFontScale, setTwoColDateFontScale)
      apply(session.twoColInterDateGap, setTwoColInterDateGap)
      apply(session.twoColDateBlockGap, setTwoColDateBlockGap)
      apply(session.twoColNameHorizontalOffset, setTwoColNameHorizontalOffset)
      apply(session.twoColTimeHorizontalOffset, setTwoColTimeHorizontalOffset)
      apply(session.twoColDateHorizontalOffset, setTwoColDateHorizontalOffset)
      apply(session.twoColDateVerticalOffset, setTwoColDateVerticalOffset)

      apply(session.exportSpacing, setExportSpacing)
      apply(session.exportSpacingInput, setExportSpacingInput)
      apply(session.exportDateSpacing, setExportDateSpacing)
      apply(session.exportDateSpacingInput, setExportDateSpacingInput)
      apply(session.exportTextColorBlack, setExportTextColorBlack)
      apply(session.fixtureDateFontSize, setFixtureDateFontSize)
      apply(session.fixtureDateFontSizeInput, setFixtureDateFontSizeInput)
      apply(session.fixtureSpacing, setFixtureSpacing)
      apply(session.fixtureSpacingInput, setFixtureSpacingInput)
      apply(session.fixtureMarginTop, setFixtureMarginTop)
      apply(session.fixtureMarginTopInput, setFixtureMarginTopInput)
      apply(session.fixtureMarginBottom, setFixtureMarginBottom)
      apply(session.fixtureMarginBottomInput, setFixtureMarginBottomInput)

      apply(session.newTeam, setNewTeam)
      apply(session.newLeague, setNewLeague)
      apply(session.bulkImportText, setBulkImportText)
      apply(session.showTimeLabels, setShowTimeLabels)
      apply(session.backgroundColor, setBackgroundColor)
      apply(session.showDividers, setShowDividers)
      apply(session.newTeamName, setNewTeamName)

      if (Array.isArray(session.uploadedLogos)) {
        setUploadedLogos(session.uploadedLogos)
      }

      apply(session.dividerHeight, setDividerHeight)
      apply(session.dividerHeightInput, setDividerHeightInput)
      apply(session.timesFontSize, setTimesFontSize)
      apply(session.timesFontSizeInput, setTimesFontSizeInput)
      apply(session.timeLabelsFontSize, setTimeLabelsFontSize)
      apply(session.timeLabelsFontSizeInput, setTimeLabelsFontSizeInput)
      apply(session.settingsOpenSections, setSettingsOpenSections)
      apply(session.openDropdowns, setOpenDropdowns)
      apply(session.fontFamily, setFontFamily)
      apply(session.fontWeight, setFontWeight)
      apply(session.letterSpacing, setLetterSpacing)
      apply(session.lineHeight, setLineHeight)
      apply(session.dateOriginalOffsetX, setDateOriginalOffsetX)
      apply(session.dateESPOffsetX, setDateESPOffsetX)
      apply(session.fixtureSpacingBetweenDates, setFixtureSpacingBetweenDates)
      apply(session.fixtureSpacingBetweenDatesInput, setFixtureSpacingBetweenDatesInput)
      apply(session.fiveFixtureSpacingBetweenDates, setFiveFixtureSpacingBetweenDates)
      apply(session.exportMinimalMode, setExportMinimalMode)

      setStorageError(null)
    },
    [
      setStorageError,
      setFixtures,
      setTeams,
      setLeagues,
      setTimeZones,
      setTimeBlockOffset,
      setTimeBlockOffsetInput,
      setCountryLabelOffset,
      setCountryLabelOffsetInput,
      setShowTeamNames,
      setPreset,
      setTeamNamesFontSize,
      setTeamNamesFontSizeInput,
      setTeamNamesOffset,
      setTeamNamesOffsetInput,
      setExportHorario,
      setHorizontalTimeOffset,
      setHorizontalTimeOffsetInput,
      setDateVerticalOffset,
      setDateVerticalOffsetInput,
      setBlockStyle,
      setNormalLogoWidth,
      setNormalLogoHeight,
      setNormalBandWidth,
      setNormalBandHeight,
      setNormalInterDateGap,
      setNormalDateBlockGap,
      setNormalDateFontScale,
      setCompactBandWidth,
      setCompactBandHeight,
      setCompactTimesFontDelta,
      setCompactTeamNamesFontDelta,
      setCompactDividerHeight,
      setCompactFixtureMarginAdjust,
      setCompactDateFontScale,
      setCompactDateBlockGap,
      setCompactInterDateGap,
      setCompactPresetName,
      setCompactGradientEnabled,
      setCompactGradientStart,
      setCompactGradientEnd,
      setCompactGradientDirection,
      setFiveBandWidth,
      setFiveBandHeight,
      setFiveLogoWidth,
      setFiveLogoHeight,
      setFiveTimesFontDelta,
      setFiveFixtureMarginAdjust,
      setFiveDateFontScale,
      setFiveDateBlockGap,
      setFiveInterDateGap,
      setTwoColLogoSize,
      setTwoColLogoHeight,
      setTwoColCardWidth,
      setTwoColBandWidth,
      setTwoColBandHeight,
      setTwoColBandRadius,
      setTwoColBandGap,
      setTwoColGapY,
      setTwoColGapX,
      setTwoColColumnOffset,
      setTwoColLogoBorderRadius,
      setTwoColTeamNameFont,
      setTwoColTimeFont,
      setTwoColTimeOffset,
      setTwoColNameOffset,
      setTwoColNamesWrap,
      setTwoColNamesMaxWidth,
      setTwoColDateFontScale,
      setTwoColInterDateGap,
      setTwoColDateBlockGap,
      setTwoColNameHorizontalOffset,
      setTwoColTimeHorizontalOffset,
      setTwoColDateHorizontalOffset,
      setTwoColDateVerticalOffset,
      setExportSpacing,
      setExportSpacingInput,
      setExportDateSpacing,
      setExportDateSpacingInput,
      setExportTextColorBlack,
      setFixtureDateFontSize,
      setFixtureDateFontSizeInput,
      setFixtureSpacing,
      setFixtureSpacingInput,
      setFixtureMarginTop,
      setFixtureMarginTopInput,
      setFixtureMarginBottom,
      setFixtureMarginBottomInput,
      setNewTeam,
      setNewLeague,
      setBulkImportText,
      setShowTimeLabels,
      setBackgroundColor,
      setShowDividers,
      setNewTeamName,
      setUploadedLogos,
      setDividerHeight,
      setDividerHeightInput,
      setTimesFontSize,
      setTimesFontSizeInput,
      setTimeLabelsFontSize,
      setTimeLabelsFontSizeInput,
      setSettingsOpenSections,
      setOpenDropdowns,
      setFontFamily,
      setFontWeight,
      setLetterSpacing,
      setLineHeight,
      setDateOriginalOffsetX,
      setDateESPOffsetX,
      setFixtureSpacingBetweenDates,
      setFixtureSpacingBetweenDatesInput,
      setFiveFixtureSpacingBetweenDates,
      setExportMinimalMode,
    ],
  )

  const effectiveFixtureDateFontSize = useMemo(() => fixtureDateFontSize, [fixtureDateFontSize])

  const isPlaceholderLogo = (logo?: string) => !logo || logo.includes("placeholder")

  const loadLocalLogos = useCallback(
    async ({ seedIfEmpty = false, addMissing = false }: { seedIfEmpty?: boolean; addMissing?: boolean } = {}) => {
      setLocalLogosStatus("loading")
      setLocalLogosError(null)

      try {
        const response = await fetch("/api/local-logos", { cache: "no-store" })
        if (!response.ok) {
          const message = await response.text()
          throw new Error(message || "No se pudo leer la carpeta de logos locales.")
        }
        const data = await response.json()
        const logos = Array.isArray(data?.logos) ? data.logos : []
        if (logos.length === 0) {
          setLocalLogosStatus("ok")
          return
        }

        const logoMap = new Map<string, { url: string; displayName: string }>()
        for (const logo of logos) {
          const inferredLeague = inferLeagueNameFromPath(logo.relativePath)
          const rawDisplayName = (logo.baseName || "").replace(/[_-]+/g, " ").trim().normalize("NFC")
          const displayName = resolveTeamNameAlias(rawDisplayName, inferredLeague)
          const key = normalizeTeamName(displayName)
          if (!key) continue
          const fileQuery = logo.relativePath ? `path=${encodeURIComponent(logo.relativePath)}` : `name=${encodeURIComponent(logo.fileName)}`
          logoMap.set(key, {
            url: `/api/local-logos/file?${fileQuery}`,
            displayName: displayName || logo.baseName,
          })
        }

        if (logoMap.size === 0) {
          setLocalLogosStatus("ok")
          return
        }

        setTeams((prev) => {
          const existingKeys = new Set(
            prev.map((team) => normalizeTeamName(resolveTeamNameAlias(team.name, team.league))),
          )
          const next = prev.map((team) => {
            const key = normalizeTeamName(resolveTeamNameAlias(team.name, team.league))
            const match = logoMap.get(key)
            if (!match || !isPlaceholderLogo(team.logo)) return team
            return { ...team, logo: match.url }
          })

          const shouldSeed = seedIfEmpty && prev.length === 0
          if (!shouldSeed && !addMissing) {
            return next
          }

          const additions: Team[] = []
          for (const [key, value] of logoMap.entries()) {
            if (existingKeys.has(key)) continue
            additions.push({
              id: `local-${key}`,
              name: value.displayName,
              logo: value.url,
            })
          }

          return additions.length ? [...next, ...additions] : next
        })

        setFixtures((prev) =>
          prev.map((fixture) => {
            const updateTeam = (team: Team) => {
              const key = normalizeTeamName(resolveTeamNameAlias(team.name, team.league))
              const match = logoMap.get(key)
              if (!match || !isPlaceholderLogo(team.logo)) return team
              return { ...team, logo: match.url }
            }
            return {
              ...fixture,
              homeTeam: updateTeam(fixture.homeTeam),
              awayTeam: updateTeam(fixture.awayTeam),
            }
          }),
        )

        setLocalLogosStatus("ok")
      } catch (error: any) {
        setLocalLogosStatus("error")
        setLocalLogosError(error?.message || "No se pudieron cargar los logos locales.")
      }
    },
    [setFixtures, setTeams],
  )

  // Aplicar defaults al entrar al modo compacto (solo al entrar)
  const previousBlockStyleRef = useRef<typeof blockStyle>(blockStyle)
  useEffect(() => {
    const prev = previousBlockStyleRef.current
    previousBlockStyleRef.current = blockStyle

    if (blockStyle !== "compact" || prev === "compact") {
      return
    }

    setDateOriginalOffsetX(125)
    setDateESPOffsetX(205)
    setCompactDividerHeight(80)
    setDividerHeight(80)
    setDividerHeightInput(80)
    setCompactDateBlockGap(0)
  }, [blockStyle])

  // Recalcular horarios y fechas cuando cambian las zonas horarias
  useEffect(() => {
    setFixtures((prevFixtures) =>
      prevFixtures.map((fixture) => {
        const { times, dates } = calculateTimes(fixture.time, timeZones, fixture.date)
        return { ...fixture, times, dates }
      }),
    )
  }, [timeZones])

  const sessionData = useMemo(
    () => ({
      layoutVersion: FIXTURE_LAYOUT_VERSION,
      fixtures,
      teams,
      leagues,
      timeZones,
      timeBlockOffset,
      timeBlockOffsetInput,
      countryLabelOffset,
      countryLabelOffsetInput,
      showTeamNames,
      preset,
      teamNamesFontSize,
      teamNamesFontSizeInput,
      teamNamesOffset,
      teamNamesOffsetInput,
      exportHorario,
      horizontalTimeOffset,
      horizontalTimeOffsetInput,
      dateVerticalOffset,
      dateVerticalOffsetInput,
      blockStyle,
      normalLogoWidth,
      normalLogoHeight,
      normalBandWidth,
      normalBandHeight,
      normalInterDateGap,
      normalDateBlockGap,
      normalDateFontScale,
      compactBandWidth,
      compactBandHeight,
      compactTimesFontDelta,
      compactTeamNamesFontDelta,
      compactDividerHeight,
      compactFixtureMarginAdjust,
      compactDateFontScale,
      compactDateBlockGap,
      compactInterDateGap,
      compactPresetName,
      compactGradientEnabled,
      compactGradientStart,
      compactGradientEnd,
      compactGradientDirection,
      fiveBandWidth,
      fiveBandHeight,
      fiveLogoWidth,
      fiveLogoHeight,
      fiveTimesFontDelta,
      fiveFixtureMarginAdjust,
      fiveDateFontScale,
      fiveDateBlockGap,
      fiveInterDateGap,
      fiveFixtureSpacingBetweenDates,
      twoColLogoSize,
      twoColLogoHeight,
      twoColCardWidth,
      twoColBandWidth,
      twoColBandHeight,
      twoColBandRadius,
      twoColBandGap,
      twoColGapY,
      twoColGapX,
      twoColColumnOffset,
      twoColLogoBorderRadius,
      twoColTeamNameFont,
      twoColTimeFont,
      twoColTimeOffset,
      twoColNameOffset,
      twoColNamesWrap,
      twoColNamesMaxWidth,
      twoColDateFontScale,
      twoColInterDateGap,
      twoColDateBlockGap,
      twoColNameHorizontalOffset,
      twoColTimeHorizontalOffset,
      twoColDateHorizontalOffset,
      twoColDateVerticalOffset,
      exportSpacing,
      exportSpacingInput,
      exportDateSpacing,
      exportDateSpacingInput,
      exportTextColorBlack,
      fixtureDateFontSize,
      fixtureDateFontSizeInput,
      fixtureSpacing,
      fixtureSpacingInput,
      fixtureMarginTop,
      fixtureMarginTopInput,
      fixtureMarginBottom,
      fixtureMarginBottomInput,
      newTeam,
      newLeague,
      bulkImportText,
      showTimeLabels,
      backgroundColor,
      showDividers,
      newTeamName,
      uploadedLogos,
      dividerHeight,
      dividerHeightInput,
      timesFontSize,
      timesFontSizeInput,
      timeLabelsFontSize,
      timeLabelsFontSizeInput,
      settingsOpenSections,
      openDropdowns,
      fontFamily,
      fontWeight,
      letterSpacing,
      lineHeight,
      dateOriginalOffsetX,
      dateESPOffsetX,
      fixtureSpacingBetweenDates,
      fixtureSpacingBetweenDatesInput,
      exportMinimalMode,
    }),
    [
      fixtures,
      teams,
      leagues,
      timeZones,
      timeBlockOffset,
      timeBlockOffsetInput,
      countryLabelOffset,
      countryLabelOffsetInput,
      showTeamNames,
      preset,
      teamNamesFontSize,
      teamNamesFontSizeInput,
      teamNamesOffset,
      teamNamesOffsetInput,
      exportHorario,
      horizontalTimeOffset,
      horizontalTimeOffsetInput,
      dateVerticalOffset,
      dateVerticalOffsetInput,
      blockStyle,
      normalLogoWidth,
      normalLogoHeight,
      normalBandWidth,
      normalBandHeight,
      normalInterDateGap,
      normalDateBlockGap,
      normalDateFontScale,
      compactBandWidth,
      compactBandHeight,
      compactTimesFontDelta,
      compactTeamNamesFontDelta,
      compactDividerHeight,
      compactFixtureMarginAdjust,
      compactDateFontScale,
      compactDateBlockGap,
      compactInterDateGap,
      compactPresetName,
      compactGradientEnabled,
      compactGradientStart,
      compactGradientEnd,
      compactGradientDirection,
      fiveBandWidth,
      fiveBandHeight,
      fiveLogoWidth,
      fiveLogoHeight,
      fiveTimesFontDelta,
      fiveFixtureMarginAdjust,
      fiveDateFontScale,
      fiveDateBlockGap,
      fiveInterDateGap,
      fiveFixtureSpacingBetweenDates,
      twoColLogoSize,
      twoColLogoHeight,
      twoColCardWidth,
      twoColBandWidth,
      twoColBandHeight,
      twoColBandRadius,
      twoColBandGap,
      twoColGapY,
      twoColGapX,
      twoColColumnOffset,
      twoColLogoBorderRadius,
      twoColTeamNameFont,
      twoColTimeFont,
      twoColTimeOffset,
      twoColNameOffset,
      twoColNamesWrap,
      twoColNamesMaxWidth,
      twoColDateFontScale,
      twoColInterDateGap,
      twoColDateBlockGap,
      twoColNameHorizontalOffset,
      twoColTimeHorizontalOffset,
      twoColDateHorizontalOffset,
      twoColDateVerticalOffset,
      exportSpacing,
      exportSpacingInput,
      exportDateSpacing,
      exportDateSpacingInput,
      exportTextColorBlack,
      fixtureDateFontSize,
      fixtureDateFontSizeInput,
      fixtureSpacing,
      fixtureSpacingInput,
      fixtureMarginTop,
      fixtureMarginTopInput,
      fixtureMarginBottom,
      fixtureMarginBottomInput,
      newTeam,
      newLeague,
      bulkImportText,
      showTimeLabels,
      backgroundColor,
      showDividers,
      newTeamName,
      uploadedLogos,
      dividerHeight,
      dividerHeightInput,
      timesFontSize,
      timesFontSizeInput,
      timeLabelsFontSize,
      timeLabelsFontSizeInput,
      settingsOpenSections,
      openDropdowns,
      fontFamily,
      fontWeight,
      letterSpacing,
      lineHeight,
      dateOriginalOffsetX,
      dateESPOffsetX,
      fixtureSpacingBetweenDates,
      fixtureSpacingBetweenDatesInput,
      exportMinimalMode,
    ],
  )

  useEffect(() => {
    if (typeof window === "undefined") return

    try {
      const storedSession = window.localStorage.getItem(SESSION_STORAGE_KEY)
      if (storedSession) {
        const parsed = JSON.parse(storedSession)
        applySession(parsed)
      }
    } catch (error) {
      console.error("Error loading saved session", error)
      setStorageError("No se pudo restaurar la sesión guardada. Se usará la configuración por defecto.")
    } finally {
      setIsSessionHydrated(true)
    }
  }, [applySession])

  useEffect(() => {
    if (!isSessionHydrated) return
    setLeagues((prev) => {
      const existingNames = new Set(prev.map((l) => l.name))
      const missing = PREDEFINED_LEAGUES.filter((l) => !existingNames.has(l.name))
      if (missing.length === 0) return prev
      return [...prev, ...missing]
    })
  }, [isSessionHydrated])

  useEffect(() => {
    if (!isSessionHydrated || autoLogosLoaded) return
    let cancelled = false

    const run = async () => {
      await loadLocalLogos({ seedIfEmpty: true, addMissing: true })
      if (!cancelled) {
        setAutoLogosLoaded(true)
      }
    }

    run()

    return () => {
      cancelled = true
    }
  }, [autoLogosLoaded, isSessionHydrated, loadLocalLogos])

  useEffect(() => {
    if (!isSessionHydrated || typeof window === "undefined") {
      return
    }

    try {
      const serialized = JSON.stringify({
        ...sessionData,
        // Excluir logos subidos del autosave para mantener el tamaño bajo
        uploadedLogos: undefined,
      })
      const bytes = new Blob([serialized]).size
      if (bytes > 20000000) {
        setStorageError(
          "La sesión es demasiado grande para guardarse automáticamente. Exporta una copia para no perder los cambios.",
        )
        return
      }
      try {
        window.localStorage.setItem(SESSION_STORAGE_KEY, serialized)
        if (storageError) {
          setStorageError(null)
        }
      } catch (e: any) {
        if (e && (e.name === "QuotaExceededError" || e.name === "NS_ERROR_DOM_QUOTA_REACHED")) {
          setStorageError(
            "No se pudo guardar la sesión automáticamente por límite de almacenamiento. Exporta una copia para no perder los cambios.",
          )
          return
        }
        throw e
      }
    } catch (error: any) {
      console.error("Error saving session", error)
      setStorageError(
        "No se pudo guardar la sesión automáticamente. Exporta una copia para no perder los cambios.",
      )
    }
  }, [isSessionHydrated, sessionData, storageError])

  const handleExportSession = useCallback(() => {
    try {
      const blob = new Blob([JSON.stringify(sessionData, null, 2)], { type: "application/json" })
      const url = URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = url
      link.download = `fixture-session-${new Date().toISOString().slice(0, 10)}.json`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
    } catch (error) {
      console.error("Error exporting session", error)
      setStorageError("No se pudo exportar la sesión.")
    }
  }, [sessionData, setStorageError])

  const handleImportSession = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0]
      if (!file) {
        return
      }

      const reader = new FileReader()
      reader.onload = () => {
        try {
          const parsed = JSON.parse(reader.result as string)
          applySession(parsed)
          setIsSessionHydrated(true)
          setStorageError(null)
        } catch (error) {
          console.error("Error importing session", error)
          setStorageError("No se pudo importar la sesión. Verifica el archivo e inténtalo nuevamente.")
        } finally {
          event.target.value = ""
        }
      }

      reader.readAsText(file)
    },
    [applySession],
  )

  const handleImportSessionClick = useCallback(() => {
    sessionFileInputRef.current?.click()
  }, [])

  const applyCompactPresetFixture4 = () => {
    setBlockStyle("compact")
    setCompactPresetName("Fixture 4")
    setCompactBandWidth(545)
    setCompactBandHeight(40)
    setCompactTimesFontDelta(10)
    setCompactTeamNamesFontDelta(7)
    setCompactDividerHeight(35)
    setCompactFixtureMarginAdjust(-4)
    setCompactDateFontScale(0.7)
    setCompactDateBlockGap(0)
    setCompactInterDateGap(-21)

    setTimeBlockOffset(scaleFixtureOffset(-90))
    setTimeBlockOffsetInput(scaleFixtureOffset(-90))
    setCountryLabelOffset(scaleFixtureOffset(-24))
    setCountryLabelOffsetInput(scaleFixtureOffset(-24))
    setTeamNamesOffset(scaleFixtureOffset(-55))
    setTeamNamesOffsetInput(scaleFixtureOffset(-55))
    setTeamNamesFontSize(25)
    setTeamNamesFontSizeInput(25)
    setTimesFontSize(55)
    setTimesFontSizeInput(55)
    setTimeLabelsFontSize(13)
    setTimeLabelsFontSizeInput(13)
    setFixtureDateFontSize(125)
    setFixtureDateFontSizeInput(125)
    setFixtureMarginTop(-4)
    setFixtureMarginTopInput(-4)
    setFixtureMarginBottom(-21)
    setFixtureMarginBottomInput(-21)
    setCompactGradientEnabled(true)
    setCompactGradientStart("#FBD238")
    setCompactGradientEnd("#F07E05")
    setCompactGradientDirection("to right")
  }

  useEffect(() => {
    const isFixture4Preset =
      blockStyle === "compact" &&
      compactBandWidth === 545 &&
      compactBandHeight === 40 &&
      compactTimesFontDelta === 10 &&
      compactTeamNamesFontDelta === 7 &&
      compactDividerHeight === 35 &&
      compactFixtureMarginAdjust === -4 &&
      compactDateFontScale === 0.7 &&
      compactDateBlockGap === -8 &&
      compactInterDateGap === -21 &&
      timeBlockOffset === scaleFixtureOffset(-90) &&
      countryLabelOffset === scaleFixtureOffset(-24) &&
      teamNamesOffset === scaleFixtureOffset(-55) &&
      teamNamesFontSize === 25 &&
      timesFontSize === 55 &&
      fixtureDateFontSize === 125 &&
      fixtureMarginTop === -4 &&
      fixtureMarginBottom === -21 &&
      compactGradientEnabled === true &&
      compactGradientStart === "#FBD238" &&
      compactGradientEnd === "#F07E05" &&
      compactGradientDirection === "to right"

    if (isFixture4Preset) {
      if (compactPresetName !== "Fixture 4") {
        setCompactPresetName("Fixture 4")
      }
    } else if (compactPresetName !== "Personalizado") {
      setCompactPresetName("Personalizado")
    }
  }, [
    blockStyle,
    compactBandWidth,
    compactBandHeight,
    compactTimesFontDelta,
    compactTeamNamesFontDelta,
    compactDividerHeight,
    compactFixtureMarginAdjust,
    compactDateFontScale,
    compactDateBlockGap,
    compactInterDateGap,
    timeBlockOffset,
    countryLabelOffset,
    teamNamesOffset,
    teamNamesFontSize,
    timesFontSize,
    fixtureDateFontSize,
    fixtureMarginTop,
    fixtureMarginBottom,
    compactGradientEnabled,
    compactGradientStart,
    compactGradientEnd,
    compactGradientDirection,
    compactPresetName,
  ])

  const settingsPreviewFixture = useMemo((): Match => {
    const euroligaColor = leagues.find((l) => l.name === "Euroliga")?.color ?? "#EB5B27"
    return {
      id: "preview-fixture",
      date: "15-3",
      time: "20:00",
      homeTeam: {
        id: "preview-home",
        name: "Equipo A",
        logo: "/placeholder.svg?height=100&width=100",
        league: "Euroliga",
      },
      awayTeam: {
        id: "preview-away",
        name: "Equipo B",
        logo: "/placeholder.svg?height=100&width=100",
        league: "Euroliga",
      },
      times: calculateTimes("20:00", timeZones, "15-3").times,
      dates: calculateTimes("20:00", timeZones, "15-3").dates,
      league: "Euroliga",
      leagueColor: euroligaColor,
      textColor: exportTextColorBlack ? "black" : "white",
    }
  }, [leagues, timeZones, exportTextColorBlack])

  const settingsPreviewBackground = useMemo(() => {
    if (compactGradientEnabled) {
      return {
        background: `linear-gradient(${compactGradientDirection}, ${compactGradientStart}, ${compactGradientEnd})`,
      }
    }
    return {
      backgroundColor: settingsPreviewFixture.leagueColor ?? "#EB5B27",
    }
  }, [compactGradientEnabled, compactGradientDirection, compactGradientStart, compactGradientEnd, settingsPreviewFixture.leagueColor])

  const dateFontSizeDirty = fixtureDateFontSizeInput !== fixtureDateFontSize
  const dateVerticalOffsetDirty = dateVerticalOffsetInput !== dateVerticalOffset
  const fixtureSpacingBetweenDatesDirty = fixtureSpacingBetweenDatesInput !== fixtureSpacingBetweenDates
  const teamNamesSizeDirty = teamNamesFontSizeInput !== teamNamesFontSize
  const timesSizeDirty = timesFontSizeInput !== timesFontSize
  const timeLabelsSizeDirty = timeLabelsFontSizeInput !== timeLabelsFontSize
  const dividerHeightDirty = dividerHeightInput !== dividerHeight
  const horizontalOffsetDirty = horizontalTimeOffsetInput !== horizontalTimeOffset
  const timeBlockOffsetDirty = timeBlockOffsetInput !== timeBlockOffset
  const countryLabelOffsetDirty = countryLabelOffsetInput !== countryLabelOffset
  const teamNamesOffsetDirty = teamNamesOffsetInput !== teamNamesOffset
  const fixtureSpacingDirty = fixtureSpacingInput !== fixtureSpacing
  const fixtureMarginTopDirty = fixtureMarginTopInput !== fixtureMarginTop
  const fixtureMarginBottomDirty = fixtureMarginBottomInput !== fixtureMarginBottom
  const previewModes = [
    { style: "normal", label: "Normal" },
    { style: "compact", label: "Compacto" },
    { style: "five-fixtures", label: "Compacto 5 Partidos" },
    { style: "two-column", label: "2 Columnas" },
  ] as const

  // Función para mostrar la fecha como "Lunes 4 de Enero"
  const formatDate = (dateStr: string) => {
    const [dayStr, monthStr] = dateStr.split("-")
    const day = Number(dayStr)
    const month = Number(monthStr)

    // Si no se puede parsear, devolvemos el valor original sin romper la UI
    if (!day || !month) return dateStr.replace("-", "/")

    const monthNames = [
      "enero",
      "febrero",
      "marzo",
      "abril",
      "mayo",
      "junio",
      "julio",
      "agosto",
      "septiembre",
      "octubre",
      "noviembre",
      "diciembre",
    ]
    const dayNames = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"]

    const currentYear = new Date().getFullYear()
    const date = new Date(currentYear, month - 1, day)

    if (Number.isNaN(date.getTime())) return `${day}/${month}`

    const dayName = dayNames[date.getDay()]
    const monthName = monthNames[month - 1] ?? String(month)
    return `${dayName} ${day} de ${monthName}`
  }

  // Función para manejar la subida masiva de logos
  const handleBulkLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return

    const files = Array.from(e.target.files)
    const newLogos: UploadedLogo[] = []

    files.forEach((file) => {
      const fileName = file.name
      // Extraer el nombre del equipo del nombre del archivo (sin extensión)
      const teamName = resolveTeamNameAlias(fileName.substring(0, fileName.lastIndexOf(".")) || fileName)

      const reader = new FileReader()
      reader.onload = (event) => {
        if (event.target && event.target.result) {
          newLogos.push({
            id: Date.now() + Math.random().toString(),
            name: fileName,
            url: event.target.result.toString(),
            teamName: teamName,
            confirmed: false,
          })

          // Si todos los archivos se han procesado, actualizar el estado
          if (newLogos.length === files.length) {
            setUploadedLogos((prev) => [...prev, ...newLogos])
          }
        }
      }
      reader.readAsDataURL(file)
    })

    // Limpiar el input de archivo
    if (e.target) {
      e.target.value = ""
    }
  }

  // Función para actualizar el nombre de un logo subido
  const updateLogoTeamName = (id: string, newName: string) => {
    setUploadedLogos((prev) => prev.map((logo) => (logo.id === id ? { ...logo, teamName: newName } : logo)))
  }

  // Función para confirmar un logo
  const confirmLogo = (id: string) => {
    setUploadedLogos((prev) => prev.map((logo) => (logo.id === id ? { ...logo, confirmed: true } : logo)))

    // Obtener el logo confirmado
    const confirmedLogo = uploadedLogos.find((logo) => logo.id === id)

    if (confirmedLogo) {
      // Crear un nuevo equipo con el logo confirmado
      const newTeam: Team = {
        id: Date.now().toString() + confirmedLogo.teamName,
        name: confirmedLogo.teamName,
        logo: confirmedLogo.url,
        league: "",
      }

      setTeams((prev) => [...prev, newTeam])

      // Eliminar el logo de la lista de logos subidos
      setUploadedLogos((prev) => prev.filter((logo) => logo.id !== id))
    }
  }

  // Función para confirmar todos los logos
  const confirmAllLogos = () => {
    // Crear equipos para todos los logos
    const newTeams = uploadedLogos.map((logo) => ({
      id: Date.now().toString() + logo.teamName,
      name: logo.teamName,
      logo: logo.url,
      league: "",
    }))

    setTeams((prev) => [...prev, ...newTeams])

    // Limpiar la lista de logos subidos
    setUploadedLogos([])

    alert(`Se han agregado ${newTeams.length} equipos con éxito`)
  }

  // Función para eliminar un logo
  const removeLogo = (id: string) => {
    setUploadedLogos((prev) => prev.filter((logo) => logo.id !== id))
  }

  // Función para actualizar una zona horaria
  const updateTimeZone = (name: string, diffHours: number, label: string) => {
    setTimeZones((prev) => prev.map((tz) => (tz.name === name ? { ...tz, diffHours, label } : tz)))

    // Actualizar todos los fixtures con los nuevos horarios
    setFixtures((prev) =>
      prev.map((fixture) => {
        const { times, dates } = calculateTimes(fixture.time, timeZones, fixture.date)
        return {
          ...fixture,
          times,
          dates,
        }
      }),
    )
  }

  const handleTimeZoneLabelChange = (name: string, newLabel: string) => {
    setTimeZones((prev) => prev.map((tz) => (tz.name === name ? { ...tz, label: newLabel } : tz)))
  }

  const toggleTimeZoneEnabled = (name: string) => {
    setTimeZones((prev) =>
      prev.map((tz) => (tz.name === name ? { ...tz, enabled: !tz.enabled } : tz))
    )
  }

  // Función para obtener los timeZones a mostrar según la selección
  const getVisibleTimeZones = () => {
    return timeZones
      .filter((tz) => tz.enabled !== false)
      .sort((a, b) => (a.diffHours - b.diffHours) || a.name.localeCompare(b.name))
  }

  const showUndoToast = useCallback(
    (label: string, previousValue: number, nextValue: number, onUndo: () => void) => {
      toast({
        title: "Cambio aplicado",
        description: `${label}: ${previousValue} → ${nextValue}`,
        action: (
          <ToastAction altText="Deshacer" onClick={onUndo}>
            Deshacer
          </ToastAction>
        ),
      })
    },
    [toast],
  )

  const applyModeViewPreset = useCallback(
    (style: "normal" | "compact" | "five-fixtures" | "two-column", nextShowTeamNames: boolean) => {
      setShowTeamNames(nextShowTeamNames)

      if (style === "two-column") {
        return
      }

      if (style === "compact") {
        // Defaults: Compacto 4 (copiado de Compacto 5)
        setCompactBandWidth(450)
        setCompactBandHeight(75)
        setCompactTimesFontDelta(-8)
        setCompactTeamNamesFontDelta(-2)
        setCompactDividerHeight(80)
        setCompactFixtureMarginAdjust(-4)
        setCompactDateFontScale(0.85)
        setCompactInterDateGap(-21)
        setCompactDateBlockGap(0)

        setFixtureDateFontSize(133)
        setFixtureDateFontSizeInput(133)
        setDateVerticalOffset(3)
        setDateVerticalOffsetInput(3)
        setFixtureSpacingBetweenDates(-8)
        setFixtureSpacingBetweenDatesInput(-8)
        setTeamNamesFontSize(20)
        setTeamNamesFontSizeInput(20)
        setTimesFontSize(45)
        setTimesFontSizeInput(45)
        setTimeLabelsFontSize(13)
        setTimeLabelsFontSizeInput(13)
        setDividerHeight(80)
        setDividerHeightInput(80)
        setHorizontalTimeOffset(0)
        setHorizontalTimeOffsetInput(0)
        setFixtureSpacing(80)
        setFixtureSpacingInput(80)
        setFixtureMarginTop(0)
        setFixtureMarginTopInput(0)
        setFixtureMarginBottom(0)
        setFixtureMarginBottomInput(0)

        // HOR
        if (!nextShowTeamNames) {
          setShowTimeLabels(true)
          setTimeBlockOffset(scaleFixtureOffset(-33))
          setTimeBlockOffsetInput(scaleFixtureOffset(-33))
          ctxSetCompactTimeBlockOffset(scaleFixtureOffset(-33))
          ctxSetCompactTimeBlockOffsetInput(scaleFixtureOffset(-33))

          setCountryLabelOffset(scaleFixtureOffset(-33))
          setCountryLabelOffsetInput(scaleFixtureOffset(-33))

          setTeamNamesOffset(scaleFixtureOffset(-43))
          setTeamNamesOffsetInput(scaleFixtureOffset(-43))
          ctxSetCompactTeamNamesOffset(scaleFixtureOffset(-43))
          ctxSetCompactTeamNamesOffsetInput(scaleFixtureOffset(-43))
          return
        }

        // NOM
        setTimeBlockOffset(scaleFixtureOffset(-65))
        setTimeBlockOffsetInput(scaleFixtureOffset(-65))
        ctxSetCompactTimeBlockOffset(scaleFixtureOffset(-65))
        ctxSetCompactTimeBlockOffsetInput(scaleFixtureOffset(-65))

        setCountryLabelOffset(scaleFixtureOffset(-35))
        setCountryLabelOffsetInput(scaleFixtureOffset(-35))

        setTeamNamesOffset(scaleFixtureOffset(-38))
        setTeamNamesOffsetInput(scaleFixtureOffset(-38))
        ctxSetCompactTeamNamesOffset(scaleFixtureOffset(-38))
        ctxSetCompactTeamNamesOffsetInput(scaleFixtureOffset(-38))
        return
      }

      if (style === "five-fixtures") {
        // Defaults: Compacto 5 Partidos
        setFiveBandWidth(620)
        setFiveBandHeight(80)
        setFiveFixtureMarginAdjust(-4)
        setFiveDateFontScale(0.85)
        setFiveInterDateGap(-21)
        setFiveDateBlockGap(0)
        setFiveFixtureSpacingBetweenDates(-8)

        setFixtureDateFontSize(178)
        setFixtureDateFontSizeInput(178)
        setDateVerticalOffset(3)
        setDateVerticalOffsetInput(3)
        setFixtureSpacingBetweenDates(-8)
        setFixtureSpacingBetweenDatesInput(-8)
        setTeamNamesFontSize(20)
        setTeamNamesFontSizeInput(20)
        setTimesFontSize(50)
        setTimesFontSizeInput(50)
        setTimeLabelsFontSize(13)
        setTimeLabelsFontSizeInput(13)
        setDividerHeight(80)
        setDividerHeightInput(80)
        setHorizontalTimeOffset(0)
        setHorizontalTimeOffsetInput(0)
        setFixtureSpacing(80)
        setFixtureSpacingInput(80)
        setFixtureMarginTop(0)
        setFixtureMarginTopInput(0)
        setFixtureMarginBottom(0)
        setFixtureMarginBottomInput(0)

        // HOR
        if (!nextShowTeamNames) {
          setShowTimeLabels(true)
          const fiveFixturesHorOffset = Math.round(scaleFixtureOffset(-40) * 0.93)
          setTimeBlockOffset(fiveFixturesHorOffset)
          setTimeBlockOffsetInput(fiveFixturesHorOffset)
          setCountryLabelOffset(fiveFixturesHorOffset)
          setCountryLabelOffsetInput(fiveFixturesHorOffset)
          setTeamNamesOffset(scaleFixtureOffset(-43))
          setTeamNamesOffsetInput(scaleFixtureOffset(-43))
          return
        }

        // NOM
        setTimeBlockOffset(scaleFixtureOffset(-84))
        setTimeBlockOffsetInput(scaleFixtureOffset(-84))
        setCountryLabelOffset(scaleFixtureOffset(-45))
        setCountryLabelOffsetInput(scaleFixtureOffset(-45))
        setTeamNamesOffset(scaleFixtureOffset(-50))
        setTeamNamesOffsetInput(scaleFixtureOffset(-50))
        return
      }

      // normal
      if (nextShowTeamNames) {
        // Defaults: Compacto 3 (NOM)
        setFixtureDateFontSize(125)
        setFixtureDateFontSizeInput(125)
        setTeamNamesFontSize(18)
        setTeamNamesFontSizeInput(18)
        setTimesFontSize(45)
        setTimesFontSizeInput(45)
        setTimeLabelsFontSize(13)
        setTimeLabelsFontSizeInput(13)
        setDividerHeight(50)
        setDividerHeightInput(50)
        setHorizontalTimeOffset(0)
        setHorizontalTimeOffsetInput(0)
        setFixtureSpacing(80)
        setFixtureSpacingInput(80)
        setFixtureMarginTop(0)
        setFixtureMarginTopInput(0)
        setFixtureMarginBottom(0)
        setFixtureMarginBottomInput(0)

        setTimeBlockOffset(scaleFixtureOffset(-75))
        setTimeBlockOffsetInput(scaleFixtureOffset(-75))
        ctxSetTimeBlockOffset(scaleFixtureOffset(-75))
        ctxSetTimeBlockOffsetInput(scaleFixtureOffset(-75))

        setCountryLabelOffset(scaleFixtureOffset(-24))
        setCountryLabelOffsetInput(scaleFixtureOffset(-24))

        setTeamNamesOffset(scaleFixtureOffset(-45))
        setTeamNamesOffsetInput(scaleFixtureOffset(-45))
        ctxSetTeamNamesOffset(scaleFixtureOffset(-45))
        ctxSetTeamNamesOffsetInput(scaleFixtureOffset(-45))
      } else {
        // Defaults: Compacto 3 (HOR)
        setFixtureDateFontSize(125)
        setFixtureDateFontSizeInput(125)
        setTeamNamesFontSize(18)
        setTeamNamesFontSizeInput(18)
        setTimesFontSize(45)
        setTimesFontSizeInput(45)
        setTimeLabelsFontSize(13)
        setTimeLabelsFontSizeInput(13)
        setDividerHeight(50)
        setDividerHeightInput(50)
        setHorizontalTimeOffset(0)
        setHorizontalTimeOffsetInput(0)
        setFixtureSpacing(80)
        setFixtureSpacingInput(80)
        setFixtureMarginTop(0)
        setFixtureMarginTopInput(0)
        setFixtureMarginBottom(0)
        setFixtureMarginBottomInput(0)

        setTimeBlockOffset(scaleFixtureOffset(-35))
        setTimeBlockOffsetInput(scaleFixtureOffset(-35))
        ctxSetTimeBlockOffset(scaleFixtureOffset(-35))
        ctxSetTimeBlockOffsetInput(scaleFixtureOffset(-35))

        setCountryLabelOffset(scaleFixtureOffset(-35))
        setCountryLabelOffsetInput(scaleFixtureOffset(-35))
      }
    },
    [
      ctxSetCompactTeamNamesOffset,
      ctxSetCompactTeamNamesOffsetInput,
      ctxSetCompactTimeBlockOffset,
      ctxSetCompactTimeBlockOffsetInput,
      ctxSetTeamNamesOffset,
      ctxSetTeamNamesOffsetInput,
      ctxSetTimeBlockOffset,
      ctxSetTimeBlockOffsetInput,
      setCompactBandHeight,
      setCompactBandWidth,
      setCompactDateBlockGap,
      setCompactDateFontScale,
      setCompactDividerHeight,
      setCompactFixtureMarginAdjust,
      setCompactInterDateGap,
      setCompactTeamNamesFontDelta,
      setCompactTimesFontDelta,
      setDividerHeight,
      setDividerHeightInput,
      setFiveBandHeight,
      setFiveBandWidth,
      setFiveDateBlockGap,
      setFiveDateFontScale,
      setFiveFixtureMarginAdjust,
      setFiveFixtureSpacingBetweenDates,
      setFiveInterDateGap,
      setCountryLabelOffset,
      setCountryLabelOffsetInput,
      setFixtureDateFontSize,
      setFixtureDateFontSizeInput,
      setFixtureMarginBottom,
      setFixtureMarginBottomInput,
      setFixtureMarginTop,
      setFixtureMarginTopInput,
      setFixtureSpacing,
      setFixtureSpacingInput,
      setHorizontalTimeOffset,
      setHorizontalTimeOffsetInput,
      setShowTeamNames,
      setShowTimeLabels,
      setTeamNamesFontSize,
      setTeamNamesFontSizeInput,
      setTeamNamesOffset,
      setTeamNamesOffsetInput,
      setTimeBlockOffset,
      setTimeBlockOffsetInput,
      setTimeLabelsFontSize,
      setTimeLabelsFontSizeInput,
      setTimesFontSize,
      setTimesFontSizeInput,
    ],
  )

  const selectBlockStyle = useCallback(
    (style: "normal" | "compact" | "five-fixtures" | "two-column") => {
      if (style === "normal") {
        setBlockStyle("normal")
        applyModeViewPreset("normal", showTeamNames)
        return
      }
      if (style === "compact") {
        setBlockStyle("compact")
        applyModeViewPreset("compact", showTeamNames)
        return
      }
      if (style === "five-fixtures") {
        setBlockStyle("five-fixtures")
        applyModeViewPreset("five-fixtures", showTeamNames)
        return
      }
      if (style === "two-column") {
        setBlockStyle("two-column")
        return
      }
    },
    [
      setBlockStyle,
      setCountryLabelOffset,
      setCountryLabelOffsetInput,
      setDividerHeight,
      setDividerHeightInput,
      setFixtureDateFontSize,
      setFixtureDateFontSizeInput,
      setHorizontalTimeOffset,
      setHorizontalTimeOffsetInput,
      setFiveBandHeight,
      setFiveBandWidth,
      setFiveDateBlockGap,
      setFiveDateFontScale,
      setFiveFixtureMarginAdjust,
      setFiveFixtureSpacingBetweenDates,
      setFiveInterDateGap,
      setTeamNamesFontSize,
      setTeamNamesFontSizeInput,
      setTeamNamesOffset,
      setTeamNamesOffsetInput,
      setTimeBlockOffset,
      setTimeBlockOffsetInput,
      setTimeLabelsFontSize,
      setTimeLabelsFontSizeInput,
      setTimesFontSize,
      setTimesFontSizeInput,
      applyModeViewPreset,
      showTeamNames,
    ],
  )

  const getPreviewLayout = useCallback(
    (style: "normal" | "compact" | "five-fixtures" | "two-column") => {
      if (style === "compact") {
        return {
          logoWidth: 96,
          logoHeight: 96,
          bandWidth: compactBandWidth,
          bandHeight: compactBandHeight,
          dividerHeight: compactDividerHeight,
          teamFontSize: Math.max(8, teamNamesFontSize + compactTeamNamesFontDelta),
          timeFontSize: Math.max(10, timesFontSize + compactTimesFontDelta),
        }
      }
      if (style === "five-fixtures") {
        return {
          logoWidth: fiveLogoWidth,
          logoHeight: fiveLogoHeight,
          bandWidth: fiveBandWidth,
          bandHeight: fiveBandHeight,
          dividerHeight: dividerHeight,
          teamFontSize: teamNamesFontSize,
          timeFontSize: timesFontSize,
        }
      }
      if (style === "two-column") {
        return {
          logoWidth: twoColLogoSize,
          logoHeight: twoColLogoHeight,
          bandWidth: twoColBandWidth,
          bandHeight: twoColBandHeight,
          dividerHeight: dividerHeight,
          teamFontSize: teamNamesFontSize,
          timeFontSize: timesFontSize,
        }
      }
      return {
        logoWidth: normalLogoWidth,
        logoHeight: normalLogoHeight,
        bandWidth: normalBandWidth,
        bandHeight: normalBandHeight,
        dividerHeight: dividerHeight,
        teamFontSize: teamNamesFontSize,
        timeFontSize: timesFontSize,
      }
    },
    [
      compactBandHeight,
      compactBandWidth,
      compactDividerHeight,
      compactTeamNamesFontDelta,
      compactTimesFontDelta,
      dividerHeight,
      fiveBandHeight,
      fiveBandWidth,
      fiveLogoHeight,
      fiveLogoWidth,
      normalBandHeight,
      normalBandWidth,
      normalLogoHeight,
      normalLogoWidth,
      teamNamesFontSize,
      timesFontSize,
      twoColBandHeight,
      twoColBandWidth,
      twoColLogoHeight,
      twoColLogoSize,
    ],
  )

  const renderPreview = useCallback(
    (style: "normal" | "compact" | "five-fixtures" | "two-column", size: "full" | "thumb") => {
      const layout = getPreviewLayout(style)
      const scale = size === "thumb" ? 0.45 : 1
      const baseWidth = layout.logoWidth * 2 + layout.bandWidth + 16
      const baseHeight = Math.max(layout.logoHeight, layout.bandHeight)
      return (
        <div
          className="overflow-hidden"
          style={{
            width: `${baseWidth * scale}px`,
            height: `${baseHeight * scale}px`,
          }}
        >
          <div
            className="flex items-center justify-center gap-2"
            style={{ transform: `scale(${scale})`, transformOrigin: "top left" }}
          >
            <div
              className="relative flex items-center justify-center bg-white"
              style={{
                width: `${layout.logoWidth}px`,
                height: `${layout.logoHeight}px`,
              }}
            >
              <img
                src={settingsPreviewFixture.homeTeam.logo}
                alt={settingsPreviewFixture.homeTeam.name}
                className="object-contain"
                style={{ maxWidth: "90%", maxHeight: "90%" }}
              />
            </div>

            <div
              className="flex items-center justify-between text-white relative px-4"
              style={{
                ...settingsPreviewBackground,
                width: `${layout.bandWidth}px`,
                height: `${layout.bandHeight}px`,
                color: settingsPreviewFixture.textColor ?? "white",
                fontFamily: "Poppins, sans-serif",
              }}
            >
              {getVisibleTimeZones().map((tz, index) => (
                <React.Fragment key={`${style}-preview-${tz.name}`}>
                  <div
                    className="flex-1 flex flex-col items-center justify-center h-full"
                    style={{ transform: `translateX(${horizontalTimeOffset}px)` }}
                  >
                    {showTeamNames ? (
                      <div
                        className="text-center mb-1"
                        style={{
                          position: "relative",
                          top: `${teamNamesOffset}px`,
                          fontSize: `${layout.teamFontSize}px`,
                          color: settingsPreviewFixture.textColor ?? "white",
                        }}
                      >
                        {tz.name === "ECU"
                          ? settingsPreviewFixture.homeTeam.name
                          : tz.name === "BOL"
                            ? settingsPreviewFixture.awayTeam.name
                            : ""}
                      </div>
                    ) : (
                      showTimeLabels && (
                        <div
                          className="text-center mb-1"
                          style={{
                            position: "relative",
                            top: `${countryLabelOffset}px`,
                            fontSize: `${timeLabelsFontSize}px`,
                            color: settingsPreviewFixture.textColor ?? "white",
                          }}
                        >
                          {tz.label || tz.name}
                        </div>
                      )
                    )}
                    <div
                      className="text-center font-bold"
                      style={{
                        marginTop: `${timeBlockOffset}px`,
                        position: "relative",
                        top: "-5px",
                        fontSize: `${layout.timeFontSize}px`,
                        color: settingsPreviewFixture.textColor ?? "white",
                      }}
                    >
                      {showTeamNames && tz.name === "ARG"
                        ? settingsPreviewFixture.times[exportHorario as keyof typeof settingsPreviewFixture.times]
                        : !showTeamNames
                          ? settingsPreviewFixture.times[tz.name as keyof typeof settingsPreviewFixture.times]
                          : ""}
                    </div>
                  </div>
                  {index < getVisibleTimeZones().length - 1 && showDividers && (
                    <div
                      className="w-px"
                      style={{
                        height: `${layout.dividerHeight}%`,
                        backgroundColor: settingsPreviewFixture.textColor ?? "white",
                      }}
                    />
                  )}
                </React.Fragment>
              ))}
            </div>

            <div
              className="relative flex items-center justify-center bg-white"
              style={{
                width: `${layout.logoWidth}px`,
                height: `${layout.logoHeight}px`,
              }}
            >
              <img
                src={settingsPreviewFixture.awayTeam.logo}
                alt={settingsPreviewFixture.awayTeam.name}
                className="object-contain"
                style={{ maxWidth: "90%", maxHeight: "90%" }}
              />
            </div>
          </div>
        </div>
      )
    },
    [
      countryLabelOffset,
      exportHorario,
      getPreviewLayout,
      horizontalTimeOffset,
      settingsPreviewBackground,
      settingsPreviewFixture,
      showDividers,
      showTeamNames,
      showTimeLabels,
      teamNamesOffset,
      timeBlockOffset,
      timeLabelsFontSize,
      getVisibleTimeZones,
    ],
  )

  const handleLeagueGroupChange = (currentLeague: string, newLeague: string) => {
    setEditingLeagueGroup(null)
    if (!newLeague || currentLeague === newLeague) {
      return
    }

    const newColor = leagues.find((l) => l.name === newLeague)?.color || "#000000"

    setFixtures((prevFixtures) =>
      prevFixtures.map((fixture) =>
        fixture.league === currentLeague
          ? {
              ...fixture,
              league: newLeague,
              leagueColor: newColor,
            }
          : fixture,
      ),
    )
  }

  // Modificar la estructura de fixturesByLeague para agrupar por fecha dentro de cada liga
  const fixturesByLeague = fixtures.reduce(
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

  const addFixture = () => {
    if (leagues.length === 0) {
      alert("Debes crear al menos una liga primero")
      return
    }

    const defaultTime = "20:05"
    const defaultLeague = leagues[0].name
    const leagueColor = leagues.find((l) => l.name === defaultLeague)?.color || "#000000"
    const defaultDateTextColor = defaultLeague === "U22" ? "black" : "white"
    const defaultDate = new Date()
      .toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit" })
      .replace("/", "-")

    const newFixture: Match = {
      id: Date.now().toString(),
      date: new Date().toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit" }).replace("/", "-"),
      time: defaultTime,
      homeTeam:
        teams.length > 0
          ? teams[0]
          : { id: "temp", name: "Equipo Local", logo: "/placeholder.svg?height=100&width=100" },
      awayTeam:
        teams.length > 1
          ? teams[1]
          : { id: "temp2", name: "Equipo Visitante", logo: "/placeholder.svg?height=100&width=100" },
      times: calculateTimes(defaultTime, timeZones, defaultDate).times,
      dates: calculateTimes(defaultTime, timeZones, defaultDate).dates,
      league: defaultLeague,
      leagueColor: leagueColor,
      textColor: "white",
      dateTextColor: defaultDateTextColor,
      dateFontSize: fixtureDateFontSize,
    }
    setFixtures([...fixtures, newFixture])
  }

  const removeFixture = (id: string) => {
    setFixtures(fixtures.filter((fixture) => fixture.id !== id))
  }

  const deleteAllFixtures = () => {
    setFixtures([])
    setShowDeleteConfirm(false)
  }

  // Modificar la función findOrCreateTeam para asegurar que se mantenga la URL del logo
  const findOrCreateTeam = (teamName: string, leagueName: string): Team => {
    const trimmedName = teamName.trim()
    const canonicalInputName = resolveTeamNameAlias(trimmedName, leagueName)
    const normalizedInput = normalizeTeamName(canonicalInputName)

    const candidateData = teams.map((team) => ({
      team,
      normalized: normalizeTeamName(resolveTeamNameAlias(team.name, team.league ?? leagueName)),
    }))

    // Coincidencia exacta (normalizada)
    let match = candidateData.find((candidate) => candidate.normalized === normalizedInput)?.team

    // Coincidencia parcial por inclusión de cadenas
    if (!match && normalizedInput.length > 0) {
      match = candidateData.find(
        (candidate) =>
          candidate.normalized.includes(normalizedInput) || normalizedInput.includes(candidate.normalized),
      )?.team
    }

    // Coincidencia por tokens compartidos
    if (!match && normalizedInput.length > 0) {
      const inputTokens: string[] = normalizedInput.match(/[a-z0-9]+/g) ?? []
      match = candidateData.find((candidate) => {
        const candidateTokens: string[] = candidate.normalized.match(/[a-z0-9]+/g) ?? []
        return candidateTokens.some((token) => inputTokens.includes(token))
      })?.team
    }

    // Coincidencia difusa usando distancia de Levenshtein
    if (!match && normalizedInput.length > 0) {
      const bestCandidate = candidateData.reduce(
        (best, candidate) => {
          const distance = levenshteinDistance(normalizedInput, candidate.normalized)
          if (distance < best.distance) {
            return { team: candidate.team, distance }
          }
          return best
        },
        { team: undefined as Team | undefined, distance: Number.POSITIVE_INFINITY },
      )

      const threshold = normalizedInput.length <= 5 ? 1 : normalizedInput.length <= 10 ? 2 : 3
      if (bestCandidate.team && bestCandidate.distance <= threshold) {
        match = bestCandidate.team
      }
    }

    if (!match) {
      const baseId = normalizeTeamName(canonicalInputName) || `team-${Date.now()}`
      let uniqueId = baseId
      let attempt = 1
      while (teams.some((team) => team.id === uniqueId)) {
        uniqueId = `${baseId}-${attempt++}`
      }

      match = {
        id: uniqueId,
        name: canonicalInputName,
        logo: "/placeholder.svg?height=100&width=100",
        league: leagueName,
      }

      const newTeam = match
      setTeams((prev) => [...prev, newTeam])
    }

    return match
  }

  // Añadir estas funciones para editar y eliminar equipos
  const editTeam = (id: string, updatedTeam: Partial<Team>) => {
    setTeams((prev) => prev.map((team) => (team.id === id ? { ...team, ...updatedTeam } : team)))
  }

  const deleteTeam = (id: string) => {
    setTeams((prev) => prev.filter((team) => team.id !== id))
  }

  // Añadir función para iniciar la edición de un equipo
  const startEditTeam = (team: Team) => {
    setEditingTeam(team)
    setNewTeam({
      name: team.name,
      logo: team.logo,
      league: team.league || "",
    })
  }

  // Añadir función para cancelar la edición
  const cancelEditTeam = () => {
    setEditingTeam(null)
    setNewTeam({ name: "", logo: "", league: "" })
  }

  // Modificar la función addTeam para manejar también la actualización
  const addTeam = () => {
    if (newTeam.name) {
      if (editingTeam) {
        // Actualizar equipo existente
        editTeam(editingTeam.id, {
          name: newTeam.name,
          logo: newTeam.logo || editingTeam.logo,
          league: newTeam.league || undefined,
        })
        setEditingTeam(null)
      } else {
        // Crear nuevo equipo
        const team: Team = {
          id: Date.now().toString(),
          name: newTeam.name,
          logo: newTeam.logo || "/placeholder.svg?height=100&width=100",
          league: newTeam.league || undefined,
        }
        setTeams([...teams, team])
      }
      setNewTeam({ name: "", logo: "", league: "" })
    }
  }

  // Añadir función para eliminar todos los equipos predeterminados
  const deleteAllTeams = () => {
    if (confirm("¿Estás seguro de que quieres eliminar todos los equipos? Esta acción no se puede deshacer.")) {
      setTeams([])
      setStorageError(null)
      alert("Todos los equipos han sido eliminados")
    }
  }

  const addLeague = () => {
    if (newLeague.name) {
      const league: League = {
        name: newLeague.name,
        color: newLeague.color,
      }
      setLeagues([...leagues, league])
      setNewLeague({ name: "", color: "#000000" })
    }
  }

  const updateLeague = () => {
    if (editingLeague && editingLeague.name) {
      setLeagues((prev) => prev.map((league) => (league.name === editingLeague.name ? { ...editingLeague } : league)))
      setEditingLeague(null)
      setNewLeague({ name: "", color: "#000000" })
    }
  }

  const deleteLeague = (leagueName: string) => {
    // Eliminar la liga
    setLeagues((prev) => prev.filter((league) => league.name !== leagueName))

    // Actualizar los fixtures que usan esta liga
    setFixtures((prev) =>
      prev.map((fixture) => {
        if (fixture.league === leagueName) {
          const defaultLeague = leagues[0]?.name || ""
          const defaultColor = leagues[0]?.color || "#000000"
          return {
            ...fixture,
            league: defaultLeague,
            leagueColor: defaultColor,
          }
        }
        return fixture
      }),
    )

    setShowDeleteLeagueConfirm(null)
  }

  const startEditLeague = (league: League) => {
    setEditingLeague({ ...league })
    setNewLeague({ name: league.name, color: league.color })
  }

  const cancelEditLeague = () => {
    setEditingLeague(null)
    setNewLeague({ name: "", color: "#000000" })
  }

  // Modificar la función updateFixture para asegurar que se mantengan los logos
  const updateFixture = (id: string, field: string, value: any) => {
    setFixtures(
      fixtures.map((fixture) => {
        if (fixture.id === id) {
          if (field === "time") {
            const { times, dates } = calculateTimes(value, timeZones, fixture.date)
            return {
              ...fixture,
              time: value,
              times,
              dates,
            }
          } else if (field === "league") {
            // Actualizar también el color de la liga
            const leagueColor = leagues.find((l) => l.name === value)?.color || "#000000"
            return {
              ...fixture,
              league: value,
              leagueColor: leagueColor,
              dateTextColor: value === "U22" ? "black" : fixture.dateTextColor ?? "white",
            }
          } else if (field === "homeTeam") {
            // Si solo se está actualizando el nombre, mantener el logo
            if (typeof value === "object" && value.name && !value.logo) {
              const existingTeam = teams.find((t) => t.name.toLowerCase() === value.name.toLowerCase())
              if (existingTeam) {
                return {
                  ...fixture,
                  homeTeam: existingTeam,
                }
              } else {
                return {
                  ...fixture.homeTeam,
                  ...value,
                }
              }
            }
            return { ...fixture, homeTeam: value }
          } else if (field === "awayTeam") {
            // Si solo se está actualizando el nombre, mantener el logo
            if (typeof value === "object" && value.name && !value.logo) {
              const existingTeam = teams.find((t) => t.name.toLowerCase() === value.name.toLowerCase())
              if (existingTeam) {
                return {
                  ...fixture,
                  awayTeam: existingTeam,
                }
              } else {
                return {
                  ...fixture.awayTeam,
                  ...value,
                }
              }
            }
            return { ...fixture, awayTeam: value }
          } else if (field === "date") {
            // Actualizar fecha y recalcular fechas por zona horaria
            const { times, dates } = calculateTimes(fixture.time, timeZones, value)
            return {
              ...fixture,
              date: value,
              times,
              dates,
            }
          }
          return { ...fixture, [field]: value }
        }
        return fixture
      }),
    )
  }

  const handleInlineLogoUpload = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>, fixtureId: string, teamKey: "homeTeam" | "awayTeam") => {
      const file = event.target.files?.[0]
      if (!file) {
        return
      }

      const reader = new FileReader()
      reader.onload = () => {
        const result = reader.result
        if (typeof result === "string") {
          setFixtures((prevFixtures) =>
            prevFixtures.map((f) =>
              f.id === fixtureId
                ? {
                    ...f,
                    [teamKey]: {
                      ...f[teamKey],
                      logo: result,
                    },
                  }
                : f,
            ),
          )
        }
      }
      reader.readAsDataURL(file)

      event.target.value = ""
    },
    [setFixtures],
  )

  const updateFixtureColor = (id: string, color: string) => {
    setFixtures(
      fixtures.map((fixture) => {
        if (fixture.id === id) {
          return { ...fixture, leagueColor: color }
        }
        return fixture
      }),
    )
  }

  const findOrCreateLeague = (leagueName: string): League => {
    let league = leagues.find((l) => l.name.toLowerCase() === leagueName.trim().toLowerCase())

    if (!league) {
      league = {
        name: leagueName.trim(),
        color: "#000000",
      }
      setLeagues((prev) => [...prev, league!])
    }

    return league
  }

  const importFixturesFromText = () => {
    if (!bulkImportText.trim()) return

    const lines = bulkImportText.split("\n").filter((line) => line.trim())
    const newFixtures: Match[] = []
    const seenFixtureKeys = new Set(
      fixtures.map((fixture) => {
        const homeKey = normalizeTeamName(resolveTeamNameAlias(fixture.homeTeam.name, fixture.league))
        const awayKey = normalizeTeamName(resolveTeamNameAlias(fixture.awayTeam.name, fixture.league))
        return `${fixture.league}|${fixture.date}|${fixture.time}|${homeKey}|${awayKey}`.toLowerCase()
      }),
    )

    let currentLeague = ""

    lines.forEach((rawLine) => {
      const line = rawLine.trim().replace(IMPORT_INLINE_TIME_FIX_RE, "$1 ")
      if (!line) return

      // Si la línea comienza con (opcional) día y fecha (DD/MM o DD/MM/YYYY), intentamos parsear un fixture
      const startsWithDate = IMPORT_DATE_PREFIX_RE.test(line)

      if (!startsWithDate) {
        // Podría ser encabezado de liga. Limpiamos ruido editorial y rechazamos líneas con dígitos
        // (p.ej. 'DESDE EL 31 ...').
        const candidate = sanitizeImportedLeagueHeader(line)
        if (!candidate) {
          return
        }
        if (/\d/.test(candidate)) {
          // Ignorar líneas informativas con números que no son fixtures
          return
        }

        const leagueName = resolveImportedLeagueName(candidate, leagues)
        if (!leagueName) {
          return
        }

        findOrCreateLeague(leagueName)
        const normalized = leagues.find((l) => l.name.toLowerCase() === leagueName.toLowerCase())?.name
        if (normalized) {
          currentLeague = normalized
        } else {
          currentLeague = leagueName
        }
        return
      }

      // Patrones soportados:
      // [DayName ]DD/MM[/(YYYY)] HH:MM [| ] HOME <sep> AWAY
      // Separadores soportados: '-', '–', '—', 'VS' (cualquier mayúsc/minúsc)
      // o dos o más espacios entre equipos.
      const match = line.match(IMPORT_FIXTURE_RE)

      if (match && currentLeague) {
        const [, day, month, _year, time, homeTeamNameRaw, awayTeamNameRaw] = match
        const homeTeamName = homeTeamNameRaw.trim()
        const awayTeamName = awayTeamNameRaw.trim()

        const normalizedLeague =
          leagues.find((l) => l.name.toLowerCase() === currentLeague.toLowerCase())?.name || currentLeague
        const homeTeam = findOrCreateTeam(homeTeamName, normalizedLeague)
        const awayTeam = findOrCreateTeam(awayTeamName, normalizedLeague)

        const leagueColor =
          leagues.find((l) => l.name.toLowerCase() === currentLeague.toLowerCase())?.color || "#000000"

        const fixtureKey = `${currentLeague}|${day.padStart(2, "0")}-${month}|${time}|${normalizeTeamName(
          homeTeam.name,
        )}|${normalizeTeamName(awayTeam.name)}`.toLowerCase()
        if (seenFixtureKeys.has(fixtureKey)) {
          return
        }
        seenFixtureKeys.add(fixtureKey)

        newFixtures.push({
          id: Date.now().toString() + newFixtures.length,
          date: `${day.padStart(2, "0")}-${month}`,
          time: time,
          homeTeam: homeTeam,
          awayTeam: awayTeam,
          times: calculateTimes(time, timeZones, `${day.padStart(2, "0")}-${month}`).times,
          dates: calculateTimes(time, timeZones, `${day.padStart(2, "0")}-${month}`).dates,
          league: currentLeague,
          leagueColor: leagueColor,
          textColor: "white",
          dateTextColor: currentLeague.toLowerCase() === "u22" ? "black" : "white",
          dateFontSize: fixtureDateFontSize,
        })
      }
    })

    if (newFixtures.length > 0) {
      // Limitar el número de fixtures para evitar exceder la cuota de localStorage
      const maxFixtures = 100 // Ajustar según sea necesario
      const combinedFixtures = [...fixtures, ...newFixtures].slice(0, maxFixtures)

      if (combinedFixtures.length < fixtures.length + newFixtures.length) {
        setStorageError(
          `Se han importado solo ${maxFixtures - fixtures.length} de ${newFixtures.length} fixtures para evitar exceder el límite de almacenamiento.`,
        )
      }

      // Orden cronológico por fecha (DD/MM o DD-MM) y hora
      const sortedCombined = [...combinedFixtures].sort((a, b) => {
        const [da, ma] = (a.date || "01-01").split(/[\/-]/).map((n) => parseInt(n, 10))
        const [db, mb] = (b.date || "01-01").split(/[\/-]/).map((n) => parseInt(n, 10))
        const y = new Date().getFullYear()
        const ta = new Date(y, (ma || 1) - 1, da || 1).getTime()
        const tb = new Date(y, (mb || 1) - 1, db || 1).getTime()
        if (ta !== tb) return ta - tb
        const [h1, m1] = (a.time || "00:00").split(":").map((n) => parseInt(n, 10))
        const [h2, m2] = (b.time || "00:00").split(":").map((n) => parseInt(n, 10))
        return h1 !== h2 ? h1 - h2 : m1 - m2
      })
      setFixtures(sortedCombined)
      setImportSuccess(true)

      // Ocultar el mensaje de éxito después de 3 segundos
      setTimeout(() => {
        setImportSuccess(false)
      }, 3000)
    }
  }

  // Función para precargar imágenes
  const preloadImage = (src: string): Promise<void> => {
    return new Promise((resolve, reject) => {
      const img = new Image()
      img.onload = () => resolve()
      img.onerror = () => reject()
      img.crossOrigin = "anonymous"
      img.src = src
    })
  }

  // Modificar la función exportFixtures para exportar por liga
  const exportFixtures = async (leagueName?: string) => {
    setExportMode(true)

    // Dar tiempo para que el DOM se actualice
    setTimeout(async () => {
      try {
        if (leagueName) {
          // Exportar una liga específica como una sola imagen
          const leagueContainerId = `league-container-${leagueName.replace(/\s+/g, "-").toLowerCase()}`
          let container = document.getElementById(leagueContainerId)

          if (!container) {
            // Intentar buscar de otra manera
            const leagueContainers = document.querySelectorAll(".fixtures-container > div")
            for (const div of leagueContainers) {
              const heading = div.querySelector("h3")
              if (heading && heading.textContent?.includes(leagueName)) {
                container = div as HTMLElement
                break
              }
            }
          }

          if (!container) {
            alert("No se pudo encontrar la liga para exportar.")
            setExportMode(false)
            return
          }

          // Ocultar temporalmente los botones de control y el título de la liga
          const controlButtons = container.querySelectorAll("button")
          const leagueTitle = container.querySelector("h3")
          const controlBars = container.querySelectorAll(".fixture-control-bar")

          controlButtons.forEach((btn) => ((btn as HTMLElement).style.display = "none"))
          if (leagueTitle) (leagueTitle as HTMLElement).style.display = "none"
          controlBars.forEach((bar) => ((bar as HTMLElement).style.display = "none"))

          // Precargar imágenes
          const imageElements = container.querySelectorAll("img")
          await Promise.allSettled(
            Array.from(imageElements).map((img) => {
              const imgElement = img as HTMLImageElement
              if (imgElement.src && !imgElement.src.includes("undefined")) {
                return preloadImage(imgElement.src)
              }
              return Promise.resolve()
            }),
          )

          // Crear canvas de toda la liga
          const canvas = await html2canvas(container as HTMLElement, {
            backgroundColor: null,
            scale: 2,
            useCORS: true,
            allowTaint: true,
            logging: false,
          })

          // Restaurar visibilidad
          controlButtons.forEach((btn) => ((btn as HTMLElement).style.display = ""))
          if (leagueTitle) (leagueTitle as HTMLElement).style.display = ""
          controlBars.forEach((bar) => ((bar as HTMLElement).style.display = ""))

          // Descargar la imagen
          const currentHorario = exportHorario || "BOL"
          let horarioLabel = ""
          switch (currentHorario) {
            case "ARG":
              horarioLabel = "Arg-Bra-Uru"
              break
            case "BOL":
              horarioLabel = "Bol-Chi"
              break
            case "ECU":
              horarioLabel = "Ecu"
              break
            default:
              horarioLabel = currentHorario
          }

          const link = document.createElement("a")
          link.download = `${leagueName}-${horarioLabel}.png`
          link.href = canvas.toDataURL("image/png")
          link.click()
        } else {
          // Exportar todo en un ZIP
          const zip = new JSZip()
          const currentHorario = exportHorario || "BOL"
          let horarioLabel = ""
          switch (currentHorario) {
            case "ARG":
              horarioLabel = "Arg-Bra-Uru"
              break
            case "BOL":
              horarioLabel = "Bol-Chi"
              break
            case "ECU":
              horarioLabel = "Ecu"
              break
            default:
              horarioLabel = currentHorario
          }

          // Procesar cada liga
          for (const leagueName of Object.keys(fixturesByLeague)) {
            const leagueContainerId = `league-container-${leagueName.replace(/\s+/g, "-").toLowerCase()}`
            let container = document.getElementById(leagueContainerId)

            if (!container) {
              const leagueContainers = document.querySelectorAll(".fixtures-container > div")
              for (const div of leagueContainers) {
                const heading = div.querySelector("h3")
                if (heading && heading.textContent?.includes(leagueName)) {
                  container = div as HTMLElement
                  break
                }
              }
            }

            if (container) {
              // Ocultar controles
              const controlButtons = container.querySelectorAll("button")
              const leagueTitle = container.querySelector("h3")
              const controlBars = container.querySelectorAll(".fixture-control-bar")

              controlButtons.forEach((btn) => ((btn as HTMLElement).style.display = "none"))
              if (leagueTitle) (leagueTitle as HTMLElement).style.display = "none"
              controlBars.forEach((bar) => ((bar as HTMLElement).style.display = "none"))

              try {
                // Precargar imágenes
                const imageElements = container.querySelectorAll("img")
                await Promise.allSettled(
                  Array.from(imageElements).map((img) => {
                    const imgElement = img as HTMLImageElement
                    if (imgElement.src && !imgElement.src.includes("undefined")) {
                      return preloadImage(imgElement.src)
                    }
                    return Promise.resolve()
                  }),
                )

                // Crear canvas
                const canvas = await html2canvas(container as HTMLElement, {
                  backgroundColor: null,
                  scale: 2,
                  useCORS: true,
                  allowTaint: true,
                  logging: false,
                })

                // Añadir al ZIP
                const imgData = canvas.toDataURL("image/png").replace(/^data:image\/(png|jpg);base64,/, "")
                const fileName = `${leagueName}-${horarioLabel}.png`
                zip.file(fileName, imgData, { base64: true })
              } catch (error) {
                console.error(`Error al procesar liga ${leagueName}:`, error)
              }

              // Restaurar visibilidad
              controlButtons.forEach((btn) => ((btn as HTMLElement).style.display = ""))
              if (leagueTitle) (leagueTitle as HTMLElement).style.display = ""
              controlBars.forEach((bar) => ((bar as HTMLElement).style.display = ""))
            }
          }

          // Generar y descargar ZIP
          const content = await zip.generateAsync({ type: "blob" })
          const link = document.createElement("a")
          link.href = URL.createObjectURL(content)
          link.download = `fixtures-todas-las-ligas-${horarioLabel}.zip`
          link.click()
          URL.revokeObjectURL(link.href)
        }
      } catch (error) {
        console.error("Error al exportar:", error)
        alert("Hubo un error al exportar. Por favor, intenta de nuevo.")
      } finally {
        setExportMode(false)
      }
    }, 500)
  }

  // Función para exportar fixtures como SVG editable (con dimensiones exactas del modo imagen)
  const exportFixturesAsSVG = async (leagueName?: string) => {
    try {
      setExportMode(true)

      const normalizeSvgTextNodes = (root: ParentNode) => {
        const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
        let node = walker.nextNode()
        while (node) {
          if (node.nodeValue) {
            node.nodeValue = node.nodeValue.normalize("NFC")
          }
          node = walker.nextNode()
        }
      }

      const absolutizeImageSrcAttributes = (root: ParentNode) => {
        const images = Array.from(root.querySelectorAll("img")) as HTMLImageElement[]
        const previousSrcByImage = new Map<HTMLImageElement, string | null>()

        for (const image of images) {
          const previousSrc = image.getAttribute("src")
          previousSrcByImage.set(image, previousSrc)

          if (!previousSrc) {
            continue
          }

          // `img.src` devuelve la URL resuelta absoluta.
          const absoluteSrc = image.currentSrc || image.src
          if (absoluteSrc && absoluteSrc !== previousSrc) {
            image.setAttribute("src", absoluteSrc)
          }
        }

        return () => {
          for (const image of images) {
            const previousSrc = previousSrcByImage.get(image)
            if (typeof previousSrc === "string") {
              image.setAttribute("src", previousSrc)
            } else {
              image.removeAttribute("src")
            }
          }
        }
      }

      const blobToDataUrl = (blob: Blob): Promise<string> =>
        new Promise((resolve, reject) => {
          const reader = new FileReader()
          reader.onload = () => {
            if (typeof reader.result === "string") {
              resolve(reader.result)
            } else {
              reject(new Error("No se pudo convertir el blob a data URL"))
            }
          }
          reader.onerror = () => reject(reader.error || new Error("Error leyendo blob"))
          reader.readAsDataURL(blob)
        })

      const inlineSvgImageHrefs = async (svgRoot: SVGElement) => {
        const XLINK_NS = "http://www.w3.org/1999/xlink"
        const images = Array.from(svgRoot.querySelectorAll("image")) as SVGImageElement[]

        await Promise.allSettled(
          images.map(async (image) => {
            const href =
              image.getAttributeNS(XLINK_NS, "href") ||
              image.getAttribute("href") ||
              image.getAttribute("xlink:href")

            if (!href || href.startsWith("data:")) {
              return
            }

            try {
              const response = await fetch(href, { cache: "force-cache" })
              if (!response.ok) {
                return
              }
              const blob = await response.blob()
              const dataUrl = await blobToDataUrl(blob)
              // Evitar duplicados de href/xlink:href que invalidan el SVG para Illustrator.
              image.removeAttribute("href")
              image.removeAttribute("xlink:href")
              image.removeAttributeNS(XLINK_NS, "href")
              image.setAttributeNS(XLINK_NS, "href", dataUrl)
            } catch {
              // Si no se puede descargar (por CORS/red), mantenemos el href original.
            }
          }),
        )
      }

      // Dar tiempo para que el DOM se actualice
      setTimeout(async () => {
        try {
          if (leagueName) {
            // Exportar una liga específica
            const leagueContainerId = `league-container-${leagueName.replace(/\s+/g, "-").toLowerCase()}`
            let container = document.getElementById(leagueContainerId)

            if (!container) {
              const leagueContainers = document.querySelectorAll(".fixtures-container > div")
              for (const div of leagueContainers) {
                const heading = div.querySelector("h3")
                if (heading && heading.textContent?.includes(leagueName)) {
                  container = div as HTMLElement
                  break
                }
              }
            }

            if (!container) {
              alert("No se pudo encontrar la liga para exportar.")
              setExportMode(false)
              return
            }

            // Ocultar temporalmente los botones de control
            const controlButtons = container.querySelectorAll("button")
            const leagueTitle = container.querySelector("h3")
            const controlBars = container.querySelectorAll(".fixture-control-bar")

            controlButtons.forEach((btn) => ((btn as HTMLElement).style.display = "none"))
            if (leagueTitle) (leagueTitle as HTMLElement).style.display = "none"
            controlBars.forEach((bar) => ((bar as HTMLElement).style.display = "none"))

            // Precargar imágenes
            const imageElements = container.querySelectorAll("img")
            await Promise.allSettled(
              Array.from(imageElements).map((img) => {
                const imgElement = img as HTMLImageElement
                if (imgElement.src && !imgElement.src.includes("undefined")) {
                  return preloadImage(imgElement.src)
                }
                return Promise.resolve()
              }),
            )

            let svgContent = ""
            const restoreImageSrcAttributes = absolutizeImageSrcAttributes(container as HTMLElement)
            try {
              // Serializar DOM a SVG editable
              const rect = (container as HTMLElement).getBoundingClientRect()
              const svgDoc = elementToSVG(container as HTMLElement)
              const svgEl = svgDoc.documentElement as unknown as SVGElement
              await inlineResources(svgEl)
              await inlineSvgImageHrefs(svgEl)
              normalizeSvgTextNodes(svgDoc)
              svgEl.setAttribute("width", `${Math.ceil(rect.width)}`)
              svgEl.setAttribute("height", `${Math.ceil(rect.height)}`)
              svgEl.setAttribute("viewBox", `0 0 ${Math.ceil(rect.width)} ${Math.ceil(rect.height)}`)
              svgContent = new XMLSerializer().serializeToString(svgDoc)
            } finally {
              restoreImageSrcAttributes()

              // Restaurar visibilidad
              controlButtons.forEach((btn) => ((btn as HTMLElement).style.display = ""))
              if (leagueTitle) (leagueTitle as HTMLElement).style.display = ""
              controlBars.forEach((bar) => ((bar as HTMLElement).style.display = ""))
            }

            // Descargar SVG
            const blob = new Blob([svgContent], { type: "image/svg+xml" })
            const url = URL.createObjectURL(blob)
            const link = document.createElement("a")
            link.href = url
            link.download = `fixtures-${leagueName}-${new Date().toISOString().split("T")[0]}.svg`
            link.click()
            URL.revokeObjectURL(url)
          } else {
            // Exportar todas las ligas
            const fixturesContainer = document.querySelector(".fixtures-container")
            if (!fixturesContainer) {
              alert("No se encontró el contenedor de fixtures")
              setExportMode(false)
              return
            }

            // Ocultar temporalmente los botones de control
            const controlButtons = fixturesContainer.querySelectorAll("button")
            const leagueTitles = fixturesContainer.querySelectorAll("h3")
            const controlBars = fixturesContainer.querySelectorAll(".fixture-control-bar")

            controlButtons.forEach((btn) => ((btn as HTMLElement).style.display = "none"))
            leagueTitles.forEach((title) => ((title as HTMLElement).style.display = "none"))
            controlBars.forEach((bar) => ((bar as HTMLElement).style.display = "none"))

            // Precargar imágenes
            const imageElements = fixturesContainer.querySelectorAll("img")
            await Promise.allSettled(
              Array.from(imageElements).map((img) => {
                const imgElement = img as HTMLImageElement
                if (imgElement.src && !imgElement.src.includes("undefined")) {
                  return preloadImage(imgElement.src)
                }
                return Promise.resolve()
              }),
            )

            let svgContent = ""
            const restoreImageSrcAttributes = absolutizeImageSrcAttributes(fixturesContainer)
            try {
              // Serializar DOM a SVG editable
              const rectAll = (fixturesContainer as HTMLElement).getBoundingClientRect()
              const svgDocAll = elementToSVG(fixturesContainer as HTMLElement)
              const svgElAll = svgDocAll.documentElement as unknown as SVGElement
              await inlineResources(svgElAll)
              await inlineSvgImageHrefs(svgElAll)
              normalizeSvgTextNodes(svgDocAll)
              svgElAll.setAttribute("width", `${Math.ceil(rectAll.width)}`)
              svgElAll.setAttribute("height", `${Math.ceil(rectAll.height)}`)
              svgElAll.setAttribute("viewBox", `0 0 ${Math.ceil(rectAll.width)} ${Math.ceil(rectAll.height)}`)
              svgContent = new XMLSerializer().serializeToString(svgDocAll)
            } finally {
              restoreImageSrcAttributes()

              // Restaurar visibilidad
              controlButtons.forEach((btn) => ((btn as HTMLElement).style.display = ""))
              leagueTitles.forEach((title) => ((title as HTMLElement).style.display = ""))
              controlBars.forEach((bar) => ((bar as HTMLElement).style.display = ""))
            }

            // Descargar SVG
            const blob = new Blob([svgContent], { type: "image/svg+xml" })
            const url = URL.createObjectURL(blob)
            const link = document.createElement("a")
            link.href = url
            link.download = `fixtures-todas-${new Date().toISOString().split("T")[0]}.svg`
            link.click()
            URL.revokeObjectURL(url)
          }
        } catch (error) {
          console.error("Error al exportar SVG:", error)
          alert("Hubo un error al exportar como SVG. Por favor, intenta de nuevo.")
        } finally {
          setExportMode(false)
        }
      }, 500)
    } catch (error) {
      console.error("Error al exportar SVG:", error)
      alert("Hubo un error al exportar como SVG. Por favor, intenta de nuevo.")
      setExportMode(false)
    }
  }

  // Función para importar todos los datos
  const importAllData = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) {
      alert("No se seleccionó ningún archivo para importar.")
      return
    }

    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const jsonData = JSON.parse(e.target?.result as string)

        // Validar que jsonData tenga las propiedades esperadas
        if (
          jsonData &&
          typeof jsonData === "object" &&
          "fixtures" in jsonData &&
          "teamNamesFontSize" in jsonData &&
          "teamNamesOffset" in jsonData &&
          "showTimeLabels" in jsonData &&
          "showDividers" in jsonData &&
          "exportHorario" in jsonData &&
          "dividerHeight" in jsonData &&
          "timesFontSize" in jsonData
        ) {
          // Establecer los estados con los datos importados
          setFixtures(jsonData.fixtures)
          setTeams(jsonData.teams)
          setLeagues(jsonData.leagues)
          setTimeZones(normalizeTimeZones(jsonData.timeZones))
          setExportHorario(normalizeExportHorario(jsonData.exportHorario, jsonData.timeZones))
          setExportSpacing(jsonData.exportSpacing)
          setExportSpacingInput(jsonData.exportSpacing)
          setExportDateSpacing(jsonData.exportDateSpacing)
          setExportDateSpacingInput(jsonData.exportDateSpacing)
    
          setFixtureSpacing(jsonData.fixtureSpacing)
          setFixtureSpacingInput(jsonData.fixtureSpacing)
          setFixtureMarginTop(jsonData.fixtureMarginTop)
          setFixtureMarginTopInput(jsonData.fixtureMarginTop)
          setFixtureMarginBottom(jsonData.fixtureMarginBottom)
          setFixtureMarginBottomInput(jsonData.fixtureMarginBottom)
          setTimeBlockOffset(jsonData.timeBlockOffset)
          setTimeBlockOffsetInput(jsonData.timeBlockOffset)
          setCountryLabelOffset(jsonData.countryLabelOffset)
          setCountryLabelOffsetInput(jsonData.countryLabelOffset)
          setTeamNamesFontSize(jsonData.teamNamesFontSize)
          setTeamNamesFontSizeInput(jsonData.teamNamesFontSize)
          setTeamNamesOffset(jsonData.teamNamesOffset)
          setTeamNamesOffsetInput(jsonData.teamNamesOffset)
          setShowTimeLabels(jsonData.showTimeLabels)
          setShowDividers(jsonData.showDividers)
              setDividerHeight(jsonData.dividerHeight)
          setDividerHeightInput(jsonData.dividerHeight)
          setTimesFontSize(jsonData.timesFontSize)
          setTimesFontSizeInput(jsonData.timesFontSize)
          if ("fixtureDateFontSize" in jsonData) {
            setFixtureDateFontSize(jsonData.fixtureDateFontSize)
            setFixtureDateFontSizeInput(jsonData.fixtureDateFontSize)
          }
          if ("horizontalTimeOffset" in jsonData) {
            setHorizontalTimeOffset(jsonData.horizontalTimeOffset)
            setHorizontalTimeOffsetInput(jsonData.horizontalTimeOffset)
          }
          if ("timeLabelsFontSize" in jsonData) {
            setTimeLabelsFontSize(jsonData.timeLabelsFontSize)
            setTimeLabelsFontSizeInput(jsonData.timeLabelsFontSize)
          }

          alert("Datos importados correctamente.")
        } else {
          alert("El archivo importado no tiene el formato correcto.")
        }
      } catch (error) {
        console.error("Error al importar datos:", error)
        alert("Error al importar datos. Asegúrate de que el archivo sea un JSON válido.")
      }
    }
    reader.readAsText(file)
  }

  // Función para exportar todos los datos
  const exportAllData = () => {
    const data = {
      fixtures,
      teams,
      leagues,
      timeZones,
      exportSpacing,
      exportDateSpacing,
      fixtureSpacing,
      fixtureMarginTop,
      fixtureMarginBottom,
      timeBlockOffset,
      countryLabelOffset,
      horizontalTimeOffset,
      fixtureDateFontSize,
      teamNamesFontSize,
      teamNamesOffset,
      showTimeLabels,
      showDividers,
      dividerHeight,
      timesFontSize,
      timeLabelsFontSize,
    }

    const json = JSON.stringify(data)
    const blob = new Blob([json], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = "data.json"
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  // Función para limpiar todos los datos guardados
  const clearAllSavedData = () => {
    if (confirm("¿Estás seguro de que quieres eliminar todos los datos? Esta acción no se puede deshacer.")) {
      setFixtures([])
      setTeams([])
      setLeagues([])
      setTimeZones(getDefaultTimeZones())
      setExportSpacing(20)
      setExportSpacingInput(20)
      setExportDateSpacing(2)
      setExportDateSpacingInput(2)
      setFixtureDateFontSize(125)
      setFixtureDateFontSizeInput(125)
      setFixtureSpacing(12)
      setFixtureSpacingInput(12)
      setFixtureMarginTop(0)
      setFixtureMarginTopInput(0)
      setFixtureMarginBottom(0)
      setFixtureMarginBottomInput(0)
      setTimeBlockOffset(scaleFixtureOffset(-75))
      setTimeBlockOffsetInput(scaleFixtureOffset(-75))
      setCountryLabelOffset(scaleFixtureOffset(-24))
      setCountryLabelOffsetInput(scaleFixtureOffset(-24))
      setTeamNamesFontSize(20)
      setTeamNamesFontSizeInput(20)
      setTeamNamesOffset(0)
      setTeamNamesOffsetInput(0)
      setHorizontalTimeOffset(0)
      setHorizontalTimeOffsetInput(0)
      setShowTimeLabels(true)
      setShowDividers(true)
      setDividerHeight(80)
      setDividerHeightInput(80)
      setTimesFontSize(32)
      setTimesFontSizeInput(32)
      setTimeLabelsFontSize(14)
      setTimeLabelsFontSizeInput(14)

      alert("Todos los datos han sido eliminados.")
    }
  }

  return (
    <main
      className="flex min-h-screen flex-col items-center justify-between p-24"
      style={{ fontFamily: "Poppins, sans-serif" }}
	    >
	      <div className="z-10 max-w-5xl w-full items-center justify-between text-sm">
	        <Tabs defaultValue="importar" className="w-full">
	          <div className="flex justify-center">
	            <TabsList>
	              <TabsTrigger value="importar">
	                <Upload className="mr-2 h-4 w-4" />
	                Importar
	              </TabsTrigger>
	              <TabsTrigger value="fixtures">
	                <Calendar className="mr-2 h-4 w-4" />
	                Fixtures
	              </TabsTrigger>
	              <TabsTrigger value="teams">
	                <Users className="mr-2 h-4 w-4" />
	                Equipos
	              </TabsTrigger>
	              <TabsTrigger value="leagues">
	                <Trophy className="mr-2 h-4 w-4" />
	                Ligas
	              </TabsTrigger>
	              <TabsTrigger value="settings">
	                <Settings className="mr-2 h-4 w-4" />
	                Configuración
	              </TabsTrigger>
	              <TabsTrigger value="graficos">
	                <LayoutTemplate className="mr-2 h-4 w-4" />
	                Gráficos
	              </TabsTrigger>
	            </TabsList>
	          </div>

	          <TabsContent value="importar">
	            <div className="grid gap-6">
	              <Card>
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <Upload className="h-5 w-5 text-primary" />
                    <CardTitle>Importar Fixtures desde Texto</CardTitle>
                  </div>
                  <CardDescription className="mt-2">
                    Copia y pega tus partidos en el formato indicado. Agrupa por ligas para mejor organización.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {/* Ejemplo visual */}
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                      <h4 className="text-sm font-semibold text-blue-900 mb-2">📋 Formato:</h4>
                      <code className="text-xs text-blue-800 block font-mono">
                        Nombre de Liga<br />
                        DD/MM HH:MM EquipoLocal-EquipoVisitante<br />
                        DD/MM HH:MM EquipoLocal  EquipoVisitante
                      </code>
                    </div>

                    {/* Área de texto mejorada */}
                    <div className="relative">
                      <textarea
                        className="w-full h-72 p-4 border-2 border-gray-300 rounded-lg resize-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all font-mono text-sm"
                        value={bulkImportText}
                        onChange={(e) => setBulkImportText(e.target.value)}
                        placeholder="Euroliga
23/5 12:00 Fenerbahce-Panathinaikos
23/5 15:00 Olympiacos-Monaco

Italia
15/03 16:00 Virtus Olidata Bologna  EA7 Emporio Armani Milano

Endesa
25/5 8:00 Tenerife-Valencia
25/5 17:00 Barcelona-Girona"
                        style={{ fontFamily: "Fira Code, monospace" }}
                      />
                      <div className="absolute bottom-3 right-3 text-xs text-gray-400">
                        {bulkImportText.split('\n').filter(l => l.trim()).length} líneas
                      </div>
                    </div>

                    {/* Botones mejorados */}
                    <div className="flex gap-3">
                      <Button 
                        variant="outline" 
                        onClick={() => setBulkImportText("")}
                        className="flex-1"
                      >
                        <Trash className="mr-2 h-4 w-4" />
                        Limpiar
                      </Button>
                      <Button 
                        onClick={importFixturesFromText}
                        className="flex-1"
                        disabled={!bulkImportText.trim()}
                      >
                        <Upload className="mr-2 h-4 w-4" />
                        Importar Fixtures
                      </Button>
                    </div>

                    {/* Alertas mejoradas */}
                    {importSuccess && (
                      <div className="bg-green-50 border-l-4 border-green-500 p-4 rounded">
                        <div className="flex items-center">
                          <div className="flex-shrink-0">
                            <svg className="h-5 w-5 text-green-500" viewBox="0 0 20 20" fill="currentColor">
                              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                            </svg>
                          </div>
                          <div className="ml-3">
                            <p className="text-sm font-medium text-green-800">
                              ¡Fixtures importados exitosamente!
                            </p>
                          </div>
                        </div>
                      </div>
                    )}
                    {storageError && (
                      <div className="bg-yellow-50 border-l-4 border-yellow-500 p-4 rounded">
                        <div className="flex items-center">
                          <div className="flex-shrink-0">
                            <svg className="h-5 w-5 text-yellow-500" viewBox="0 0 20 20" fill="currentColor">
                              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                            </svg>
                          </div>
                          <div className="ml-3">
                            <p className="text-sm font-medium text-yellow-800">
                              {storageError}
                            </p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

            <Card className="mt-6">
              <CardHeader>
                <CardTitle>Importar Logos Masivamente</CardTitle>
                <CardDescription>Sube múltiples logos a la vez y edita sus nombres antes de confirmar</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                    <Upload className="mx-auto h-12 w-12 text-gray-400" />
                    <div className="mt-4">
                      <Label htmlFor="bulk-logo-upload" className="cursor-pointer">
                        <span className="mt-2 block text-sm font-medium text-gray-900">
                          Haz clic para seleccionar archivos o arrastra y suelta aquí
                        </span>
                        <span className="mt-1 block text-xs text-gray-500">
                          Puedes editar los nombres de los equipos antes de confirmar
                        </span>
                      </Label>
                      <input
                        id="bulk-logo-upload"
                        type="file"
                        multiple
                        accept="image/*"
                        onChange={handleBulkLogoUpload}
                        className="hidden"
                      />
                    </div>

                    
                  </div>

                  {uploadedLogos.length > 0 && (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <h3 className="text-lg font-semibold">Logos subidos - Edita los nombres antes de confirmar</h3>
                        <Button onClick={confirmAllLogos} variant="default">
                          Confirmar todos los logos ({uploadedLogos.length})
                        </Button>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {uploadedLogos.map((logo) => (
                          <div key={logo.id} className="border rounded p-4 flex items-center space-x-4">
                            <img
                              src={logo.url || "/placeholder.svg"}
                              alt={logo.name}
                              className="h-16 w-16 object-contain"
                            />
                            <div className="flex-1">
                              <Input
                                value={logo.teamName}
                                onChange={(e) => updateLogoTeamName(logo.id, e.target.value)}
                                placeholder="Nombre del equipo"
                                className="mb-2"
                              />
                              <div className="flex space-x-2">
                                <Button size="sm" onClick={() => confirmLogo(logo.id)}>
                                  Confirmar
                                </Button>
                                <Button variant="outline" size="sm" onClick={() => removeLogo(logo.id)}>
                                  Eliminar
                                </Button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card className="mt-6">
              <CardHeader>
                <CardTitle>Consejos para subir logos de equipos</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 text-sm">
                  <p>
                    <strong>Método 1 (Recomendado):</strong> Usa la función "Importar Logos Masivamente" en esta
                    pestaña. Puedes seleccionar múltiples archivos de imagen a la vez y editar los nombres de los
                    equipos antes de confirmarlos.
                  </p>
                  <p>
                    <strong>Método 2:</strong> En la pestaña "Equipos", agrega equipos manualmente con URLs de imágenes.
                    Puedes usar servicios como Imgur o ImgBB para subir tus imágenes y obtener URLs.
                  </p>
                  <p>
                    <strong>Consejos para mejores resultados:</strong>
                  </p>
                  <ul className="list-disc list-inside ml-4 space-y-1">
                    <li>Usa imágenes con fondo transparente (PNG) para mejor apariencia</li>
                    <li>Imágenes cuadradas funcionan mejor (misma altura y anchura)</li>
                    <li>Tamaño recomendado: 200x200 píxeles o mayor</li>
                    <li>Nombra tus archivos con el nombre del equipo para facilitar la importación masiva</li>
                    <li>
                      Si tienes problemas con la exportación, intenta usar logos con URLs públicas en lugar de archivos
                      locales
                    </li>
                  </ul>
                </div>
              </CardContent>
            </Card>
            </div>
          </TabsContent>

	          <TabsContent value="fixtures">
	            <Card>
		              <CardHeader>
		                <CardTitle>Administrar Fixtures</CardTitle>
		                <CardDescription>
		                  Aquí puedes ver y administrar los fixtures. Puedes agregar nuevos fixtures manualmente o importarlos
		                  desde texto.
		                </CardDescription>
		                <div className="mt-4 flex flex-wrap items-center gap-4">
		                  <div className="flex flex-wrap items-center gap-4">
		                    <div className="w-[170px] border rounded-xl overflow-hidden">
		                      <button
		                        type="button"
		                        onClick={() => selectBlockStyle("normal")}
		                        className={`w-full py-3 text-xs font-semibold border-b ${
		                          blockStyle === "normal" ? "bg-primary text-primary-foreground" : "bg-white"
		                        }`}
		                      >
		                        COMPACTO 3
		                      </button>
		                      <div className="flex">
		                        <button
		                          type="button"
		                          onClick={() => {
		                            selectBlockStyle("normal")
		                            applyModeViewPreset("normal", false)
		                          }}
		                          className={`flex-1 py-2 text-sm font-semibold ${
		                            blockStyle === "normal" && !showTeamNames ? "bg-gray-100" : "bg-white"
		                          }`}
		                        >
		                          HOR
		                        </button>
		                        <div className="w-px bg-gray-200" />
		                        <button
		                          type="button"
		                          onClick={() => {
		                            selectBlockStyle("normal")
		                            applyModeViewPreset("normal", true)
		                          }}
		                          className={`flex-1 py-2 text-sm font-semibold ${
		                            blockStyle === "normal" && showTeamNames ? "bg-gray-100" : "bg-white"
		                          }`}
		                        >
		                          NOM
		                        </button>
		                      </div>
		                    </div>

		                    <div className="w-[170px] border rounded-xl overflow-hidden">
		                      <button
		                        type="button"
		                        onClick={() => selectBlockStyle("compact")}
		                        className={`w-full py-3 text-xs font-semibold border-b ${
		                          blockStyle === "compact" ? "bg-primary text-primary-foreground" : "bg-white"
		                        }`}
		                      >
		                        COMPACTO 4
		                      </button>
		                      <div className="flex">
		                        <button
		                          type="button"
		                          onClick={() => {
		                            selectBlockStyle("compact")
		                            applyModeViewPreset("compact", false)
		                          }}
		                          className={`flex-1 py-2 text-sm font-semibold ${
		                            blockStyle === "compact" && !showTeamNames ? "bg-gray-100" : "bg-white"
		                          }`}
		                        >
		                          HOR
		                        </button>
		                        <div className="w-px bg-gray-200" />
		                        <button
		                          type="button"
		                          onClick={() => {
		                            selectBlockStyle("compact")
		                            applyModeViewPreset("compact", true)
		                          }}
		                          className={`flex-1 py-2 text-sm font-semibold ${
		                            blockStyle === "compact" && showTeamNames ? "bg-gray-100" : "bg-white"
		                          }`}
		                        >
		                          NOM
		                        </button>
		                      </div>
		                    </div>

		                    <div className="w-[170px] border rounded-xl overflow-hidden">
		                      <button
		                        type="button"
		                        onClick={() => selectBlockStyle("five-fixtures")}
		                        className={`w-full py-3 text-xs font-semibold border-b ${
		                          blockStyle === "five-fixtures" ? "bg-primary text-primary-foreground" : "bg-white"
		                        }`}
		                      >
		                        COMPACTO 5
		                      </button>
		                      <div className="flex">
		                        <button
		                          type="button"
		                          onClick={() => {
		                            selectBlockStyle("five-fixtures")
		                            applyModeViewPreset("five-fixtures", false)
		                          }}
		                          className={`flex-1 py-2 text-sm font-semibold ${
		                            blockStyle === "five-fixtures" && !showTeamNames ? "bg-gray-100" : "bg-white"
		                          }`}
		                        >
		                          HOR
		                        </button>
		                        <div className="w-px bg-gray-200" />
		                        <button
		                          type="button"
		                          onClick={() => {
		                            selectBlockStyle("five-fixtures")
		                            applyModeViewPreset("five-fixtures", true)
		                          }}
		                          className={`flex-1 py-2 text-sm font-semibold ${
		                            blockStyle === "five-fixtures" && showTeamNames ? "bg-gray-100" : "bg-white"
		                          }`}
		                        >
		                          NOM
		                        </button>
		                      </div>
		                    </div>
		                  </div>

		                  <div className="flex flex-wrap items-center gap-6 ml-auto">
		                    <div className="flex flex-col items-center gap-2">
		                      <Label className="text-xs text-muted-foreground">Nombres / Horarios</Label>
		                      <Switch
		                        checked={showTeamNames}
		                        onCheckedChange={(checked) => applyModeViewPreset(blockStyle, checked)}
		                      />
		                    </div>
		                    <Button
		                      variant="destructive"
		                      onClick={() => setShowDeleteConfirm(true)}
		                      className="rounded-xl px-8"
		                    >
		                      Eliminar todos
		                    </Button>
		                  </div>
		                </div>
		              </CardHeader>
	              <CardContent>
	                <div className="space-y-4">
                  {fixtures.length > 0 ? (
                    <>
                      

                      {/* Sección de exportación unificada */}
                      <div className="p-4 rounded-md border mb-6">
                        <div className="flex items-center justify-between mb-3">
                          <h3 className="text-lg font-semibold">Exportar</h3>
                          <div className="flex items-center gap-2">
                            <Label className="text-sm">Formato</Label>
                            <select
                              className="border rounded px-2 py-1 text-sm"
                              value={exportFormat}
                              onChange={(e) => setExportFormat(e.target.value as any)}
                            >
                              <option value="PNG">Imagen</option>
                              <option value="SVG">SVG (Editable)</option>
                            </select>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                          {Object.keys(fixturesByLeague).map((leagueName) => (
                            <Button
                              key={`export-${leagueName}`}
                              variant="outline"
                              onClick={() => (exportFormat === "SVG" ? exportFixturesAsSVG(leagueName) : exportFixtures(leagueName))}
                              className="flex items-center justify-center"
                            >
                              <Download className="mr-2 h-4 w-4" />
                              {exportFormat === "SVG" ? `${leagueName} SVG` : leagueName}
                            </Button>
                          ))}
                          <Button
                            variant="default"
                            onClick={() => (exportFormat === "SVG" ? exportFixturesAsSVG() : exportFixtures())}
                            className="flex items-center justify-center"
                          >
                            <Download className="mr-2 h-4 w-4" />
                            {exportFormat === "SVG" ? "Todo SVG" : "Exportar Todo"}
                          </Button>
                        </div>
                      </div>

                      {/* Modificar la sección de renderizado de fixtures para mostrar las fechas */}
                      <div className="fixtures-container">
                        {Object.entries(fixturesByLeague).map(([leagueName, dateFixtures]) => (
                          <div
                            key={leagueName}
                            id={`league-container-${leagueName.replace(/\s+/g, "-").toLowerCase()}`}
                            className="mb-6"
                          >
                            <div className="flex items-center justify-between mb-3">
                              <div className="text-lg font-semibold flex items-center gap-2">
                                {!exportMode && (
                                  <div className="flex items-center gap-2 mr-2">
                                    <label
                                      htmlFor={`league-color-${leagueName}`}
                                      className="h-5 w-5 rounded-full cursor-pointer border border-white/40"
                                      style={{
                                        backgroundColor: leagues.find((l) => l.name === leagueName)?.color || "#000000",
                                      }}
                                      title="Cambiar color de liga"
                                    >
                                      <input
                                        id={`league-color-${leagueName}`}
                                        type="color"
                                        className="sr-only"
                                        value={leagues.find((l) => l.name === leagueName)?.color || "#000000"}
                                        onChange={(event) => {
                                          const newColor = event.target.value
                                          setLeagues((prevLeagues) =>
                                            prevLeagues.map((league) =>
                                              league.name === leagueName ? { ...league, color: newColor } : league,
                                            ),
                                          )

                                          setFixtures((prevFixtures) =>
                                            prevFixtures.map((fixture) =>
                                              fixture.league === leagueName
                                                ? { ...fixture, leagueColor: newColor }
                                                : fixture,
                                            ),
                                          )
                                        }}
                                      />
                                    </label>
                                    
                                    <Popover>
                                      <PopoverTrigger asChild>
                                        <button
                                          className="h-5 w-5 rounded flex items-center justify-center hover:bg-gray-100 transition-colors"
                                          title="Configurar gradiente"
                                        >
                                          <Palette className="h-3 w-3" />
                                        </button>
                                      </PopoverTrigger>
                                      <PopoverContent className="w-80">
                                        <div className="space-y-3">
                                          <h4 className="font-semibold text-sm">Gradiente de {leagueName}</h4>
                                          
                                          <div className="flex items-center justify-between">
                                            <Label className="text-sm">Habilitar gradiente</Label>
                                            <Switch
                                              checked={leagues.find((l) => l.name === leagueName)?.gradient?.enabled ?? false}
                                              onCheckedChange={(checked) => {
                                                setLeagues((prev) =>
                                                  prev.map((l) =>
                                                    l.name === leagueName
                                                      ? {
                                                          ...l,
                                                          gradient: checked
                                                            ? {
                                                                enabled: true,
                                                                startColor: l.gradient?.startColor || l.color,
                                                                endColor: l.gradient?.endColor || l.color,
                                                                direction: l.gradient?.direction || "to right",
                                                              }
                                                            : undefined,
                                                        }
                                                      : l,
                                                  ),
                                                )
                                              }}
                                            />
                                          </div>
                                          
                                          {leagues.find((l) => l.name === leagueName)?.gradient?.enabled && (
                                            <>
                                              <div className="flex gap-2">
                                                <div className="flex-1">
                                                  <Label className="text-xs">Color inicial</Label>
                                                  <Input
                                                    type="color"
                                                    value={leagues.find((l) => l.name === leagueName)?.gradient?.startColor || "#000000"}
                                                    onChange={(e) => {
                                                      setLeagues((prev) =>
                                                        prev.map((l) =>
                                                          l.name === leagueName && l.gradient
                                                            ? {
                                                                ...l,
                                                                gradient: { ...l.gradient, startColor: e.target.value },
                                                              }
                                                            : l,
                                                        ),
                                                      )
                                                    }}
                                                    className="h-8"
                                                  />
                                                </div>
                                                <div className="flex-1">
                                                  <Label className="text-xs">Color final</Label>
                                                  <Input
                                                    type="color"
                                                    value={leagues.find((l) => l.name === leagueName)?.gradient?.endColor || "#000000"}
                                                    onChange={(e) => {
                                                      setLeagues((prev) =>
                                                        prev.map((l) =>
                                                          l.name === leagueName && l.gradient
                                                            ? {
                                                                ...l,
                                                                gradient: { ...l.gradient, endColor: e.target.value },
                                                              }
                                                            : l,
                                                        ),
                                                      )
                                                    }}
                                                    className="h-8"
                                                  />
                                                </div>
                                              </div>
                                              <div>
                                                <Label className="text-xs">Dirección</Label>
                                                <select
                                                  className="w-full border rounded px-2 py-1 text-sm mt-1"
                                                  value={leagues.find((l) => l.name === leagueName)?.gradient?.direction || "to right"}
                                                  onChange={(e) => {
                                                    setLeagues((prev) =>
                                                      prev.map((l) =>
                                                        l.name === leagueName && l.gradient
                                                          ? {
                                                              ...l,
                                                              gradient: {
                                                                ...l.gradient,
                                                                direction: e.target.value as any,
                                                              },
                                                            }
                                                          : l,
                                                      ),
                                                    )
                                                  }}
                                                >
                                                  <option value="to right">→ Horizontal</option>
                                                  <option value="to left">← Horizontal invertido</option>
                                                  <option value="to bottom">↓ Vertical</option>
                                                  <option value="to top">↑ Vertical invertido</option>
                                                </select>
                                              </div>
                                            </>
                                          )}
                                        </div>
                                      </PopoverContent>
                                    </Popover>
                                  </div>
                                )}
                                {editingLeagueGroup === leagueName ? (
                                  <select
                                    autoFocus
                                    value={leagueName}
                                    className="border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    onChange={(event) => handleLeagueGroupChange(leagueName, event.target.value)}
                                    onBlur={() => setEditingLeagueGroup(null)}
                                    onKeyDown={(event) => {
                                      if (event.key === "Escape") {
                                        event.preventDefault()
                                        setEditingLeagueGroup(null)
                                      }
                                    }}
                                  >
                                    {leagues.map((leagueOption) => (
                                      <option key={`header-select-${leagueOption.name}`} value={leagueOption.name}>
                                        {leagueOption.name}
                                      </option>
                                    ))}
                                  </select>
                                ) : (
                                  <button
                                    type="button"
                                    className="font-semibold text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
                                    onClick={() => setEditingLeagueGroup(leagueName)}
                                  >
                                    {leagueName}
                                  </button>
                                )}
                              </div>
                              {!exportMode && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => {
                                    const leagueFixtures = fixtures.filter((f) => f.league === leagueName)
                                    const fixtureIds = leagueFixtures.map((f) => f.id)
                                    setFixtures((prev) => prev.filter((f) => !fixtureIds.includes(f.id)))
                                  }}
                                >
                                  Eliminar liga
                                </Button>
                              )}
                            </div>

                            {/* Renderizar cada fixture Con HORARIOSmente con su fecha en la parte superior */}
                            {Object.entries(dateFixtures).map(([date, fixturesForDate], dateIndex) => {
                              const dateFixture = fixturesForDate[0]
                              const dateTextColor = dateFixture?.dateTextColor ?? "white"
                              const dateFontSize = effectiveFixtureDateFontSize
                              // Mostrar la fecha solo para el primer fixture de cada fecha
                              if (blockStyle === "two-column") {
                                return (
                                  <div key={`${leagueName}-${date}`} style={{ fontFamily: "Poppins, sans-serif" }}>
                                    <div
                                      style={{
                                        fontWeight: 700,
                                        textTransform: "uppercase",
                                        color: dateTextColor,
                                        fontSize: `${dateFontSize}%`,
                                        marginTop: `${twoColInterDateGap !== undefined ? twoColInterDateGap : normalInterDateGap}px`,
                                        marginBottom: `${(twoColDateBlockGap !== undefined ? twoColDateBlockGap : normalDateBlockGap) + dateVerticalOffset}px`,
                                        transform: `translate(${twoColDateHorizontalOffset !== undefined ? twoColDateHorizontalOffset : 0}px, ${
                                          twoColDateVerticalOffset !== undefined ? twoColDateVerticalOffset : 0
                                        }px)`,
                                      }}
                                    >
                                      {formatDate(date)}
                                    </div>
                                    <div
                                      style={{
                                        display: "grid",
                                        gridTemplateColumns: "repeat(2, max-content)",
                                        justifyContent: "center",
                                        columnGap: `${Math.max(twoColGapX, 0)}px`,
                                        rowGap: `${twoColGapY}px`,
                                      }}
                                    >
                                      {fixturesForDate.map((fixture, index) => {
                                        const bandWidth = twoColBandWidth > 0 ? twoColBandWidth : undefined
                                        const spacing = Math.max(twoColBandGap, 0)
                                        const hasNameMaxLimit =
                                          twoColNamesMaxWidth !== undefined && twoColNamesMaxWidth > 0
                                        const nameMaxWidthValue = hasNameMaxLimit ? twoColNamesMaxWidth : undefined
                                        const isRightColumn = index % 2 === 1
                                        const centerMinWidth = bandWidth ? `${bandWidth}px` : "0px"
                                        const negativeOverlap = twoColGapX < 0 ? Math.abs(twoColGapX) / 2 : 0
                                        const baseShift = twoColGapX < 0 ? (isRightColumn ? -negativeOverlap : negativeOverlap) : 0
                                        const extraShift = isRightColumn ? twoColColumnOffset : 0
                                        const totalShift = baseShift + extraShift
                                        const rowIndex = Math.floor(index / 2)
                                        const cardMarginTop = twoColGapY < 0 && rowIndex > 0 ? `${twoColGapY}px` : undefined
                                        return (
                                          <div
                                            key={fixture.id}
                                            className="two-col-card"
                                            style={{
                                              display: "flex",
                                              flexDirection: "column",
                                              alignItems: "stretch",
                                              width: twoColCardWidth > 0 ? `${twoColCardWidth}px` : "auto",
                                              transform: totalShift !== 0 ? `translateX(${totalShift}px)` : undefined,
                                              gap: `${spacing}px`,
                                              marginTop: cardMarginTop,
                                            }}
                                          >
                                            <div
                                              style={{
                                                display: "grid",
                                                gridTemplateColumns: `${twoColLogoSize}px minmax(${centerMinWidth}, 1fr) ${twoColLogoSize}px`,
                                                alignItems: "center",
                                                justifyItems: "center",
                                                width: twoColCardWidth > 0 ? `${twoColCardWidth}px` : "100%",
                                                margin: "0 auto",
                                                position: "relative",
                                                top: `${twoColNameOffset}px`,
                                                transform:
                                                  twoColNameHorizontalOffset !== 0
                                                    ? `translateX(${twoColNameHorizontalOffset}px)`
                                                    : undefined,
                                              }}
                                            >
                                              <div aria-hidden="true" style={{ width: `${twoColLogoSize}px`, height: "1px", visibility: "hidden" }} />
                                              <span
                                                style={{
                                                  gridColumn: "2 / span 1",
                                                  fontSize: `${twoColTeamNameFont}px`,
                                                  color: "white",
                                                  fontWeight: 600,
                                                  maxWidth: nameMaxWidthValue ? `${nameMaxWidthValue}px` : undefined,
                                                  lineHeight: 1.2,
                                                  textAlign: "center",
                                                  display: "inline-block",
                                                  whiteSpace: twoColNamesWrap ? "normal" : "nowrap",
                                                  overflow:
                                                    twoColNamesWrap || !hasNameMaxLimit ? "visible" : "hidden",
                                                  textOverflow:
                                                    !twoColNamesWrap && hasNameMaxLimit ? "ellipsis" : "clip",
                                                }}
                                              >
                                                {fixture.homeTeam.name} - {fixture.awayTeam.name}
                                              </span>
                                              <div aria-hidden="true" style={{ width: `${twoColLogoSize}px`, height: "1px", visibility: "hidden" }} />
                                            </div>
                                            <div
                                              style={{
                                                display: "flex",
                                                alignItems: "center",
                                                gap: `${spacing}px`,
                                              }}
                                            >
                                              <div
                                                className="relative flex items-center justify-center bg-white cursor-pointer"
                                                style={{
                                                  width: `${twoColLogoSize}px`,
                                                  height: `${twoColLogoHeight}px`,
                                                  borderRadius: `${Math.max(twoColLogoBorderRadius, 0)}px`,
                                                }}
                                              >
                                                <img
                                                  src={fixture.homeTeam.logo || "/placeholder.svg?height=100&width=100"}
                                                  alt={fixture.homeTeam.name}
                                                  className="object-contain"
                                                  style={{ maxWidth: "90%", maxHeight: "90%" }}
                                                  crossOrigin="anonymous"
                                                />
                                                {!exportMode && (
                                                  <input
                                                    type="file"
                                                    accept="image/*"
                                                    className="absolute inset-0 opacity-0 cursor-pointer"
                                                    title={`Subir logo para ${fixture.homeTeam.name}`}
                                                    onChange={(event) => handleInlineLogoUpload(event, fixture.id, "homeTeam")}
                                                  />
                                                )}
                                              </div>
                                              <div
                                                className="flex items-center justify-center text-white"
                                                style={{
                                                  ...((() => {
                                                    const league = leagues.find((l) => l.name === fixture.league)
                                                    if (league?.gradient?.enabled) {
                                                      return {
                                                        background: `linear-gradient(${league.gradient.direction}, ${league.gradient.startColor}, ${league.gradient.endColor})`,
                                                      }
                                                    }
                                                    return {
                                                      backgroundColor: fixture.leagueColor || league?.color || "#000000",
                                                    }
                                                  })()),
                                                  height: `${twoColBandHeight}px`,
                                                  borderRadius: `${Math.max(twoColBandRadius, 0)}px`,
                                                  display: "flex",
                                                  alignItems: "center",
                                                  justifyContent: "center",
                                                  flex: bandWidth ? `0 0 ${bandWidth}px` : 1,
                                                  width: bandWidth ? `${bandWidth}px` : "100%",
                                                  minWidth: bandWidth ? `${bandWidth}px` : undefined,
                                                  transform:
                                                    twoColTimeHorizontalOffset !== 0
                                                      ? `translateX(${twoColTimeHorizontalOffset}px)`
                                                      : undefined,
                                                }}
                                              >
                                                <div
                                                  style={{
                                                    fontWeight: 800,
                                                    fontSize: `${twoColTimeFont}px`,
                                                    position: "relative",
                                                    top: `${twoColTimeOffset}px`,
                                                    display: "flex",
                                                    flexDirection: "column",
                                                    alignItems: "center",
                                                    gap: "2px",
                                                  }}
                                                >
                                                  <div style={{ fontSize: `${twoColTimeFont * 0.5}px`, fontWeight: 600 }}>
                                                    ECU {fixture.times.ECU}
                                                  </div>
                                                  <div style={{ fontSize: `${twoColTimeFont * 0.5}px`, fontWeight: 600 }}>
                                                    BOL {fixture.times.BOL}
                                                  </div>
                                                  <div style={{ fontSize: `${twoColTimeFont * 0.5}px`, fontWeight: 600 }}>
                                                    BRA {fixture.times.BRA}
                                                  </div>
                                                </div>
                                              </div>
                                              <div
                                                className="relative flex items-center justify-center bg-white cursor-pointer"
                                                style={{
                                                  width: `${twoColLogoSize}px`,
                                                  height: `${twoColLogoHeight}px`,
                                                  borderRadius: `${Math.max(twoColLogoBorderRadius, 0)}px`,
                                                }}
                                              >
                                                <img
                                                  src={fixture.awayTeam.logo || "/placeholder.svg?height=100&width=100"}
                                                  alt={fixture.awayTeam.name}
                                                  className="object-contain"
                                                  style={{ maxWidth: "90%", maxHeight: "90%" }}
                                                  crossOrigin="anonymous"
                                                />
                                                {!exportMode && (
                                                  <input
                                                    type="file"
                                                    accept="image/*"
                                                    className="absolute inset-0 opacity-0 cursor-pointer"
                                                    title={`Subir logo para ${fixture.awayTeam.name}`}
                                                    onChange={(event) => handleInlineLogoUpload(event, fixture.id, "awayTeam")}
                                                  />
                                                )}
                                              </div>
                                            </div>
                                          </div>
                                        )
                                      })}
                                    </div>
                                  </div>
                                )
                              }
                              let lastDate = ""

                              return (
                                <React.Fragment key={`${leagueName}-${date}`}>
                                  {fixturesForDate.map((fixture, index) => {
                                    // Determinar si mostrar la fecha (solo mostrarla si es diferente a la anterior)
                                    const showDate = fixture.date !== lastDate
                                    lastDate = fixture.date
                                    // Determinar si es el último fixture del bloque
                                    const isLastFixtureInBlock = index === fixturesForDate.length - 1
                                    const spacingBetweenDateBlocks =
                                      blockStyle === "five-fixtures"
                                        ? Math.round((fiveBandHeight / 90) * fiveFixtureSpacingBetweenDates)
                                        : fixtureSpacingBetweenDates
                                    const fixtureMarginAdjustByMode =
                                      blockStyle === "compact"
                                        ? compactFixtureMarginAdjust
                                        : blockStyle === "five-fixtures"
                                          ? fiveFixtureMarginAdjust
                                          : 0
                                    const interDateGapByMode =
                                      blockStyle === "compact"
                                        ? compactInterDateGap
                                        : blockStyle === "five-fixtures"
                                          ? fiveInterDateGap
                                          : normalInterDateGap
                                    const dateBlockGapByMode =
                                      blockStyle === "compact"
                                        ? compactDateBlockGap
                                        : blockStyle === "five-fixtures"
                                          ? fiveDateBlockGap
                                          : normalDateBlockGap
                                    const fixtureDateTextColor = fixture.dateTextColor ?? "white"
                                    const fixtureDateFontSize = effectiveFixtureDateFontSize

                                    return (
                                      <div
                                        key={fixture.id}
                                        data-fixture-id={fixture.id}
                                        className="fixture-item mb-4"
                                        style={{
                                          marginTop: `${fixtureMarginTop + fixtureMarginAdjustByMode + (showDate ? interDateGapByMode : 0)}px`,
                                          marginBottom: `${fixtureMarginBottom + fixtureMarginAdjustByMode + (isLastFixtureInBlock ? spacingBetweenDateBlocks : 0)}px`,
                                          padding: "5px",
                                          border: "1px solid transparent",
                                          fontFamily: "Poppins, sans-serif",
                                        }}
                                      >
                                        {/* Franja con fechas encima de los divisores */}
	                                        {showDate && (
	                                          <div
	                                            className="relative w-full flex items-center justify-center"
	                                            style={{
	                                              height: `${fixtureDateFontSize / 100 * 20}px`,
                                              marginBottom: `${dateBlockGapByMode + dateVerticalOffset}px`,
	                                            }}
	                                          >
                                            {/* Fecha original (27) - encima del primer divisor o centrada si no hay cambio de día o ESP deshabilitado */}
                                            <div
                                              data-role="date-primary"
                                              data-date-type="main"
	                                              className="absolute font-bold fixture-date"
	                                              style={{
	                                                fontSize: `${fixtureDateFontSize}%`,
	                                                fontFamily: "Poppins, sans-serif",
	                                                color: fixtureDateTextColor,
                                                left: !fixture.dates?.ESP || !getVisibleTimeZones().find(tz => (tz.name === "ESP" || (tz.label || "").toUpperCase() === "ESP"))
                                                  ? "50%" 
                                                  : `${(blockStyle === "compact" ? 96 + compactBandWidth / 3 : blockStyle === "five-fixtures" ? fiveLogoWidth + fiveBandWidth / 3 : normalLogoWidth + normalBandWidth / 3) + dateOriginalOffsetX}px`,
                                                transform: "translateX(-50%)",
                                              }}
                                            >
                                              {formatDate(fixture.date)}
                                            </div>
                                            {/* Fecha de ESP (28) - encima del segundo divisor, solo si ESP está habilitado y hay cambio de fecha */}
                                            {fixture.dates?.ESP && getVisibleTimeZones().find(tz => (tz.name === "ESP" || (tz.label || "").toUpperCase() === "ESP")) && (
                                              <div
                                                data-role="date-esp"
                                                data-date-type="esp"
	                                                className="absolute font-bold"
	                                                style={{
	                                                  fontSize: `${fixtureDateFontSize}%`,
	                                                  fontFamily: "Poppins, sans-serif",
	                                                  color: fixtureDateTextColor,
                                                  left: `${(blockStyle === "compact" ? 96 + (compactBandWidth * 2) / 3 : blockStyle === "five-fixtures" ? fiveLogoWidth + (fiveBandWidth * 2) / 3 : normalLogoWidth + (normalBandWidth * 2) / 3) + dateESPOffsetX}px`,
                                                  transform: "translateX(-50%)",
                                                }}
                                              >
                                                {formatDate(fixture.dates.ESP)}
                                              </div>
                                            )}
                                          </div>
                                        )}

                                        <div className="flex items-center justify-center fixture-row">
                                          {/* Logo equipo local */}
                                          <div
                                            data-role="logo-home"
                                            data-team-id={fixture.homeTeam.id}
                                            className={`relative flex items-center justify-center bg-white${
                                              exportMode ? "" : " cursor-pointer"
                                            }`}
                                            style={{
                                              width: blockStyle === "compact" ? "96px" : blockStyle === "five-fixtures" ? `${fiveLogoWidth}px` : `${normalLogoWidth}px`,
                                              height: blockStyle === "compact" ? "96px" : blockStyle === "five-fixtures" ? `${fiveLogoHeight}px` : `${normalLogoHeight}px`,
                                              borderRadius: "0",
                                            }}
                                          >
                                            <img
                                              src={fixture.homeTeam.logo || "/placeholder.svg?height=100&width=100"}
                                              alt={fixture.homeTeam.name}
                                              className="object-contain"
                                              style={{
                                                maxWidth: "90%",
                                                maxHeight: "90%",
                                              }}
                                              crossOrigin="anonymous"
                                            />
                                            {!exportMode && (
                                              <input
                                                type="file"
                                                accept="image/*"
                                                className="absolute inset-0 opacity-0 cursor-pointer"
                                                title={`Subir logo para ${fixture.homeTeam.name}`}
                                                onChange={(event) => handleInlineLogoUpload(event, fixture.id, "homeTeam")}
                                              />
                                            )}
                                          </div>

                                          {/* Franja central con horarios */}
                                          <div
                                            data-role="band"
                                            className="flex items-center justify-between text-white relative"
                                            style={{
                                              ...((() => {
                                                const league = leagues.find((l) => l.name === fixture.league)
                                                if (league?.gradient?.enabled) {
                                                  return {
                                                    background: `linear-gradient(${league.gradient.direction}, ${league.gradient.startColor}, ${league.gradient.endColor})`,
                                                  }
                                                }
                                                return {
                                                  backgroundColor: fixture.leagueColor || league?.color || "#000000",
                                                }
                                              })()),
                                              width: blockStyle === "compact" ? `${compactBandWidth}px` : blockStyle === "five-fixtures" ? `${fiveBandWidth}px` : `${normalBandWidth}px`,
                                              height: blockStyle === "compact" ? `${compactBandHeight}px` : blockStyle === "five-fixtures" ? `${fiveBandHeight}px` : `${normalBandHeight}px`,
                                              borderRadius: "0",
                                              position: "relative",
                                              color: fixture.textColor || "white",
                                              fontFamily: "Poppins, sans-serif",
                                            }}
                                          >
                                            {/* Contenido de la franja */}
                                            {showTeamNames ? (
                                              <>
                                                <div className="flex-1 flex items-center justify-center h-full px-3">
                                                  {!exportMinimalMode && (
                                                    <div
                                                      className="text-center"
                                                      data-role="team-name-home"
                                                      style={{
                                                        position: "relative",
                                                        top: `${teamNamesOffset}px`,
                                                        fontSize: `${blockStyle === "compact" ? Math.max(8, teamNamesFontSize + compactTeamNamesFontDelta) : teamNamesFontSize}px`,
                                                        fontFamily: "Poppins, sans-serif",
                                                        lineHeight: "1.2",
                                                        maxWidth: "100%",
                                                        color: fixture.textColor || "white",
                                                        whiteSpace: "normal",
                                                        wordBreak: "normal",
                                                        overflowWrap: "break-word",
                                                        textWrap: "balance",
                                                        hyphens: "none",
                                                      }}
                                                    >
                                                      {fixture.homeTeam.name}
                                                    </div>
                                                  )}
                                                </div>
                                                {showDividers && !exportMinimalMode && (
                                                  <div
                                                    className="w-px bg-white"
                                                    data-role="divider"
                                                    style={{
                                                      height: `${blockStyle === "compact" ? compactDividerHeight : dividerHeight}%`,
                                                      backgroundColor: fixture.textColor || "white",
                                                    }}
                                                  ></div>
                                                )}
                                                <div
                                                  className="flex-1 flex items-center justify-center h-full px-3"
                                                  style={{ transform: `translateX(${horizontalTimeOffset}px)` }}
                                                >
                                                  {!exportMinimalMode && (
                                                    <div
                                                      className="text-center font-bold"
                                                      data-role="time-value"
                                                      data-timezone={exportHorario}
                                                      style={{
                                                        marginTop: `${timeBlockOffset}px`,
                                                        position: "relative",
                                                        top: "-5px",
                                                        fontSize: `${blockStyle === "compact" ? Math.max(10, timesFontSize + compactTimesFontDelta) : timesFontSize}px`,
                                                        color: fixture.textColor || "white",
                                                        fontFamily: "Poppins, sans-serif",
                                                      }}
                                                    >
                                                      {fixture.times[exportHorario as keyof typeof fixture.times] || fixture.time}
                                                    </div>
                                                  )}
                                                </div>
                                                {showDividers && !exportMinimalMode && (
                                                  <div
                                                    className="w-px bg-white"
                                                    data-role="divider"
                                                    style={{
                                                      height: `${blockStyle === "compact" ? compactDividerHeight : dividerHeight}%`,
                                                      backgroundColor: fixture.textColor || "white",
                                                    }}
                                                  ></div>
                                                )}
                                                <div className="flex-1 flex items-center justify-center h-full px-3">
                                                  {!exportMinimalMode && (
                                                    <div
                                                      className="text-center"
                                                      data-role="team-name-away"
                                                      style={{
                                                        position: "relative",
                                                        top: `${teamNamesOffset}px`,
                                                        fontSize: `${blockStyle === "compact" ? Math.max(8, teamNamesFontSize + compactTeamNamesFontDelta) : teamNamesFontSize}px`,
                                                        fontFamily: "Poppins, sans-serif",
                                                        lineHeight: "1.2",
                                                        maxWidth: "100%",
                                                        color: fixture.textColor || "white",
                                                        whiteSpace: "normal",
                                                        wordBreak: "normal",
                                                        overflowWrap: "break-word",
                                                        textWrap: "balance",
                                                        hyphens: "none",
                                                      }}
                                                    >
                                                      {fixture.awayTeam.name}
                                                    </div>
                                                  )}
                                                </div>
                                              </>
                                            ) : (
                                              getVisibleTimeZones().map((tz, i) => (
                                                <React.Fragment key={`${fixture.id}-${tz.name}`}>
                                                  <div
                                                    className="flex-1 flex flex-col items-center justify-center h-full"
                                                    style={{ transform: `translateX(${horizontalTimeOffset}px)` }}
                                                  >
                                                    {!exportMinimalMode && showTimeLabels && (
                                                      <div
                                                        className="text-center mb-1"
                                                        data-role="time-label"
                                                        data-timezone={tz.name}
                                                        style={{
                                                          position: "relative",
                                                          top: `${countryLabelOffset}px`,
                                                          fontSize: `${timeLabelsFontSize}px`,
                                                          color: fixture.textColor || "white",
                                                          fontFamily: "Poppins, sans-serif",
                                                        }}
                                                      >
                                                        {tz.label}
                                                      </div>
                                                    )}
                                                    {!exportMinimalMode && (
                                                      <div
                                                        className="text-center font-bold"
                                                        data-role="time-value"
                                                        data-timezone={tz.name}
                                                        style={{
                                                          marginTop: `${timeBlockOffset}px`,
                                                          position: "relative",
                                                          top: "-5px",
                                                          fontSize: `${blockStyle === "compact" ? Math.max(10, timesFontSize + compactTimesFontDelta) : timesFontSize}px`,
                                                          color: fixture.textColor || "white",
                                                          fontFamily: "Poppins, sans-serif",
                                                        }}
                                                      >
                                                        {fixture.times[tz.name as keyof typeof fixture.times]}
                                                      </div>
                                                    )}
                                                  </div>
                                                  {i < getVisibleTimeZones().length - 1 && showDividers && !exportMinimalMode && (
                                                    <div
                                                      className="w-px bg-white"
                                                      data-role="divider"
                                                      style={{
                                                        height: `${blockStyle === "compact" ? compactDividerHeight : dividerHeight}%`,
                                                        backgroundColor: fixture.textColor || "white",
                                                      }}
                                                    ></div>
                                                  )}
                                                </React.Fragment>
                                              ))
                                            )}
                                          </div>

                                          {/* Logo equipo visitante */}
                                          <div
                                            className={`relative flex items-center justify-center bg-white${
                                              exportMode ? "" : " cursor-pointer"
                                            }`}
                                            style={{
                                              width: blockStyle === "compact" ? "96px" : blockStyle === "five-fixtures" ? `${fiveLogoWidth}px` : `${normalLogoWidth}px`,
                                              height: blockStyle === "compact" ? "96px" : blockStyle === "five-fixtures" ? `${fiveLogoHeight}px` : `${normalLogoHeight}px`,
                                              borderRadius: "0",
                                            }}
                                          >
                                            <img
                                              src={fixture.awayTeam.logo || "/placeholder.svg?height=100&width=100"}
                                              alt={fixture.awayTeam.name}
                                              className="object-contain"
                                              style={{
                                                maxWidth: "90%",
                                                maxHeight: "90%",
                                              }}
                                              crossOrigin="anonymous"
                                            />
                                            {!exportMode && (
                                              <input
                                                type="file"
                                                accept="image/*"
                                                className="absolute inset-0 opacity-0 cursor-pointer"
                                                title={`Subir logo para ${fixture.awayTeam.name}`}
                                                onChange={(event) => handleInlineLogoUpload(event, fixture.id, "awayTeam")}
                                              />
                                            )}
                                          </div>
                                        </div>

                                        {/* Barra de control del fixture - solo visible cuando no está en modo exportación */}
                                        {!exportMode && (
                                          <TooltipProvider>
                                            <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 flex justify-between items-center mt-2 overflow-x-auto fixture-control-bar shadow-sm">
                                              <div className="flex items-center gap-3 flex-wrap">
                                              <Tooltip>
                                                <TooltipTrigger asChild>
                                                  <div className="flex items-center gap-1">
                                                    <Calendar className="h-3 w-3 text-gray-500" />
                                                    <Input
                                                      type="text"
                                                      id={`date-${fixture.id}`}
                                                      value={fixture.date}
                                                      onChange={(e) => updateFixture(fixture.id, "date", e.target.value)}
                                                      className="w-20 h-8 text-xs"
                                                      placeholder="DD-MM"
                                                    />
                                                  </div>
                                                </TooltipTrigger>
                                                <TooltipContent>
                                                  <p>📅 Fecha del partido</p>
                                                </TooltipContent>
                                              </Tooltip>

                                              <Tooltip>
                                                <TooltipTrigger asChild>
                                                  <Input
                                                    type="text"
                                                    id={`time-${fixture.id}`}
                                                    value={fixture.time}
                                                    onChange={(e) => updateFixture(fixture.id, "time", e.target.value)}
                                                    className="w-16 h-8 text-xs"
                                                    placeholder="HH:MM"
                                                  />
                                                </TooltipTrigger>
                                                <TooltipContent>
                                                  <p>⏰ Hora del partido</p>
                                                </TooltipContent>
                                              </Tooltip>

                                              <Label htmlFor={`homeTeam-${fixture.id}`} className="text-sm">
                                                Local
                                              </Label>
                                              <div className="flex items-center">
                                                <select
                                                  id={`homeTeam-${fixture.id}`}
                                                  value={fixture.homeTeam.id}
                                                  onChange={(e) => {
                                                    const selectedTeam = uniqueTeams.find((t) => t.id === e.target.value)
                                                    if (selectedTeam) {
                                                      updateFixture(fixture.id, "homeTeam", selectedTeam)
                                                    }
                                                  }}
                                                  className="w-24 text-sm"
                                                >
                                                  {[...uniqueTeams]
                                                    .sort((a, b) => a.name.localeCompare(b.name))
                                                    .map((team) => (
                                                      <option key={`home-${fixture.id}-${team.id}`} value={team.id}>
                                                        {team.name}
                                                      </option>
                                                    ))}
                                                </select>
                                                <Input
                                                  type="text"
                                                  value={fixture.homeTeam.name}
                                                  onChange={(e) => {
                                                    const updatedTeam = { ...fixture.homeTeam, name: e.target.value }
                                                    updateFixture(fixture.id, "homeTeam", updatedTeam)
                                                  }}
                                                  className="w-24 text-sm ml-1"
                                                  placeholder="Editar nombre"
                                                />
                                              </div>

                                              <Label htmlFor={`awayTeam-${fixture.id}`} className="text-sm">
                                                Visitante
                                              </Label>
                                              <div className="flex items-center">
                                                <select
                                                  id={`awayTeam-${fixture.id}`}
                                                  value={fixture.awayTeam.id}
                                                  onChange={(e) => {
                                                    const selectedTeam = uniqueTeams.find((t) => t.id === e.target.value)
                                                    if (selectedTeam) {
                                                      updateFixture(fixture.id, "awayTeam", selectedTeam)
                                                    }
                                                  }}
                                                  className="w-24 text-sm"
                                                >
                                                  {[...uniqueTeams]
                                                    .sort((a, b) => a.name.localeCompare(b.name))
                                                    .map((team) => (
                                                      <option key={`away-${fixture.id}-${team.id}`} value={team.id}>
                                                        {team.name}
                                                      </option>
                                                    ))}
                                                </select>
                                                <Input
                                                  type="text"
                                                  value={fixture.awayTeam.name}
                                                  onChange={(e) => {
                                                    const updatedTeam = { ...fixture.awayTeam, name: e.target.value }
                                                    updateFixture(fixture.id, "awayTeam", updatedTeam)
                                                  }}
                                                  className="w-24 text-sm ml-1"
                                                  placeholder="Editar nombre"
                                                />
                                              </div>

                                              <Tooltip>
                                                <TooltipTrigger asChild>
                                                  <div className="flex items-center gap-1">
                                                    <Trophy className="h-3 w-3 text-gray-500" />
                                                    <select
                                                      id={`league-${fixture.id}`}
                                                      value={fixture.league}
                                                      onChange={(e) => updateFixture(fixture.id, "league", e.target.value)}
                                                      className="w-24 h-8 text-xs border rounded px-2"
                                                    >
                                                      {leagues.map((league) => (
                                                        <option key={`league-${fixture.id}-${league.name}`} value={league.name}>
                                                          {league.name}
                                                        </option>
                                                      ))}
                                                    </select>
                                                  </div>
                                                </TooltipTrigger>
                                                <TooltipContent>
                                                  <p>🏆 Liga del partido</p>
                                                </TooltipContent>
                                              </Tooltip>

                                              <Tooltip>
                                                <TooltipTrigger asChild>
                                                  <select
                                                    id={`text-color-${fixture.id}`}
                                                    value={fixture.textColor || "white"}
                                                    onChange={(e) => updateFixture(fixture.id, "textColor", e.target.value)}
                                                    className="w-20 h-8 text-xs border rounded px-2"
                                                  >
                                                    <option value="white">⚪ Blanco</option>
                                                    <option value="black">⚫ Negro</option>
                                                  </select>
                                                </TooltipTrigger>
                                                <TooltipContent>
                                                  <p>Color del texto en la franja</p>
                                                </TooltipContent>
                                              </Tooltip>

                                              <Tooltip>
                                                <TooltipTrigger asChild>
                                                  <select
                                                    id={`date-text-color-${fixture.id}`}
                                                    value={fixture.dateTextColor || "white"}
                                                    onChange={(e) => updateFixture(fixture.id, "dateTextColor", e.target.value)}
                                                    className="w-20 h-8 text-xs border rounded px-2"
                                                  >
                                                    <option value="white">📅 Blanco</option>
                                                    <option value="black">📅 Negro</option>
                                                  </select>
                                                </TooltipTrigger>
                                                <TooltipContent>
                                                  <p>Color del texto de la fecha</p>
                                                </TooltipContent>
                                              </Tooltip>

                                              <Tooltip>
                                                <TooltipTrigger asChild>
                                                  <Button
                                                    variant="destructive"
                                                    size="sm"
                                                    onClick={() => removeFixture(fixture.id)}
                                                  >
                                                    <Trash className="h-4 w-4" />
                                                  </Button>
                                                </TooltipTrigger>
                                                <TooltipContent>
                                                  <p>Eliminar fixture</p>
                                                </TooltipContent>
                                              </Tooltip>
                                            </div>
                                            </div>
                                          </TooltipProvider>
                                        )}
                                      </div>
                                    )
                                  })}
                                </React.Fragment>
                              )
                            })}
                          </div>
                        ))}
                      </div>
                    </>
                  ) : (
                    <p>No hay fixtures. Agrega uno o importa desde texto.</p>
                  )}

                  {showDeleteConfirm && (
                    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full">
                      <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
                        <div className="mt-3 text-center">
                          <h3 className="text-lg leading-6 font-medium text-gray-900">Eliminar todos los fixtures</h3>
                          <div className="mt-2 px-7 py-3">
                            <p className="text-sm text-gray-500">
                              ¿Estás seguro de que quieres eliminar todos los fixtures? Esta acción no se puede
                              deshacer.
                            </p>
                          </div>
                          <div className="items-center px-4 py-3">
                            <Button
                              variant="destructive"
                              onClick={deleteAllFixtures}
                              className="px-4 py-2 bg-red-500 text-white text-base font-medium rounded-md w-full shadow-sm hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-300"
                            >
                              Eliminar todos
                            </Button>
                            <Button
                              variant="outline"
                              onClick={() => setShowDeleteConfirm(false)}
                              className="mt-2 px-4 py-2 bg-gray-200 text-gray-800 text-base font-medium rounded-md w-full shadow-sm hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-300"
                            >
                              Cancelar
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="teams">
            <Card>
              <CardHeader>
                <CardTitle>Administrar Equipos</CardTitle>
                <CardDescription>
                  Aquí puedes ver y administrar los equipos. Puedes agregar nuevos equipos manualmente o importarlos
                  desde texto.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex flex-wrap justify-between items-center gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <Button onClick={addTeam} disabled={editingTeam !== null}>
                        {editingTeam ? "Actualizar Equipo" : "Agregar Equipo"}
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => loadLocalLogos({ addMissing: true })}
                        disabled={localLogosStatus === "loading"}
                      >
                        {localLogosStatus === "loading" ? "Cargando logos..." : "Cargar logos locales"}
                      </Button>
                    </div>
                    <Button variant="destructive" onClick={deleteAllTeams}>
                      Eliminar todos
                    </Button>
                  </div>

                  {localLogosStatus === "error" && (
                    <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                      {localLogosError || "No se pudieron cargar los logos locales."}
                    </div>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="team-name">Nombre del equipo</Label>
                      <Input
                        type="text"
                        id="team-name"
                        value={newTeam.name}
                        onChange={(e) => setNewTeam({ ...newTeam, name: e.target.value })}
                        placeholder="Nombre del equipo"
                      />
                    </div>
                    <div>
                      <Label htmlFor="team-logo">URL del logo</Label>
                      <Input
                        type="text"
                        id="team-logo"
                        value={newTeam.logo}
                        onChange={(e) => setNewTeam({ ...newTeam, logo: e.target.value })}
                        placeholder="URL del logo"
                      />
                    </div>
                  </div>

                  <div>
                    <Button onClick={addTeam} disabled={editingTeam !== null}>
                      {editingTeam ? "Actualizar Equipo" : "Agregar Equipo"}
                    </Button>
                    {editingTeam && (
                      <Button variant="outline" onClick={cancelEditTeam}>
                        Cancelar Edición
                      </Button>
                    )}
                  </div>

                  {teams.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {teams.map((team) => (
                        <div key={team.id} className="border rounded p-4">
                          <div className="flex justify-center mb-2">
                            <img
                              src={team.logo || "/placeholder.svg?height=100&width=100"}
                              alt={team.name}
                              className="h-20 w-20 object-contain"
                              crossOrigin="anonymous"
                            />
                          </div>
                          <p className="text-center font-medium">{team.name}</p>
                          <div className="flex justify-between mt-4">
                            <Button variant="outline" size="sm" onClick={() => startEditTeam(team)}>
                              <Edit className="mr-2 h-4 w-4" />
                              Editar
                            </Button>
                            <Button variant="destructive" size="sm" onClick={() => deleteTeam(team.id)}>
                              <Trash className="mr-2 h-4 w-4" />
                              Eliminar
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p>No hay equipos. Agrega uno manualmente o importa logos masivamente.</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="leagues">
            <Card>
              <CardHeader>
                <CardTitle>Administrar Ligas</CardTitle>
                <CardDescription>
                  Aquí puedes ver y administrar las ligas. Puedes agregar nuevas ligas y asignarles un color.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <Button onClick={addLeague} disabled={editingLeague !== null}>
                      {editingLeague ? "Actualizar Liga" : "Agregar Liga"}
                    </Button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="league-name">Nombre de la liga</Label>
                      <Input
                        type="text"
                        id="league-name"
                        value={newLeague.name}
                        onChange={(e) => setNewLeague({ ...newLeague, name: e.target.value })}
                        placeholder="Nombre de la liga"
                      />
                    </div>
                    <div>
                      <Label htmlFor="league-color">Color de la liga</Label>
                      <Input
                        type="color"
                        id="league-color"
                        value={newLeague.color}
                        onChange={(e) => setNewLeague({ ...newLeague, color: e.target.value })}
                      />
                    </div>
                  </div>

                  <div>
                    <Button onClick={addLeague} disabled={editingLeague !== null}>
                      {editingLeague ? "Actualizar Liga" : "Agregar Liga"}
                    </Button>
                    {editingLeague && (
                      <Button variant="outline" onClick={cancelEditLeague}>
                        Cancelar Edición
                      </Button>
                    )}
                  </div>

                  {leagues.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {leagues.map((league) => (
                        <div key={league.name} className="border rounded p-4 space-y-3">
                          <div className="flex items-center justify-between">
                            <p className="font-medium">{league.name}</p>
                            <div className="h-5 w-5 rounded-full" style={{ backgroundColor: league.color }}></div>
                          </div>
                          
                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <Label className="text-sm">Gradiente</Label>
                              <Switch
                                checked={league.gradient?.enabled ?? false}
                                onCheckedChange={(checked) => {
                                  setLeagues((prev) =>
                                    prev.map((l) =>
                                      l.name === league.name
                                        ? {
                                            ...l,
                                            gradient: checked
                                              ? {
                                                  enabled: true,
                                                  startColor: l.color,
                                                  endColor: l.color,
                                                  direction: "to right" as const,
                                                }
                                              : undefined,
                                          }
                                        : l,
                                    ),
                                  )
                                }}
                              />
                            </div>
                            {league.gradient?.enabled && (
                              <>
                                <div className="flex gap-2">
                                  <div className="flex-1">
                                    <Label className="text-xs">Inicio</Label>
                                    <Input
                                      type="color"
                                      value={league.gradient.startColor}
                                      onChange={(e) => {
                                        setLeagues((prev) =>
                                          prev.map((l) =>
                                            l.name === league.name && l.gradient
                                              ? {
                                                  ...l,
                                                  gradient: { ...l.gradient, startColor: e.target.value },
                                                }
                                              : l,
                                          ),
                                        )
                                      }}
                                      className="h-8"
                                    />
                                  </div>
                                  <div className="flex-1">
                                    <Label className="text-xs">Fin</Label>
                                    <Input
                                      type="color"
                                      value={league.gradient.endColor}
                                      onChange={(e) => {
                                        setLeagues((prev) =>
                                          prev.map((l) =>
                                            l.name === league.name && l.gradient
                                              ? {
                                                  ...l,
                                                  gradient: { ...l.gradient, endColor: e.target.value },
                                                }
                                              : l,
                                          ),
                                        )
                                      }}
                                      className="h-8"
                                    />
                                  </div>
                                </div>
                                <select
                                  className="w-full border rounded px-2 py-1 text-sm"
                                  value={league.gradient.direction}
                                  onChange={(e) => {
                                    setLeagues((prev) =>
                                      prev.map((l) =>
                                        l.name === league.name && l.gradient
                                          ? {
                                              ...l,
                                              gradient: {
                                                ...l.gradient,
                                                direction: e.target.value as any,
                                              },
                                            }
                                          : l,
                                      ),
                                    )
                                  }}
                                >
                                  <option value="to right">→</option>
                                  <option value="to left">←</option>
                                  <option value="to bottom">↓</option>
                                  <option value="to top">↑</option>
                                </select>
                              </>
                            )}
                          </div>

                          <div className="flex justify-between pt-2 border-t">
                            <Button variant="outline" size="sm" onClick={() => startEditLeague(league)}>
                              <Edit className="mr-2 h-4 w-4" />
                              Editar
                            </Button>
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() => setShowDeleteLeagueConfirm(league.name)}
                            >
                              <Trash className="mr-2 h-4 w-4" />
                              Eliminar
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p>No hay ligas. Agrega una.</p>
                  )}

                  {showDeleteLeagueConfirm && (
                    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full">
                      <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
                        <div className="mt-3 text-center">
                          <h3 className="text-lg leading-6 font-medium text-gray-900">Eliminar liga</h3>
                          <div className="mt-2 px-7 py-3">
                            <p className="text-sm text-gray-500">
                              ¿Estás seguro de que quieres eliminar la liga "{showDeleteLeagueConfirm}"? Esta acción no
                              se puede deshacer.
                            </p>
                          </div>
                          <div className="items-center px-4 py-3">
                            <Button
                              variant="destructive"
                              onClick={() => deleteLeague(showDeleteLeagueConfirm)}
                              className="px-4 py-2 bg-red-500 text-white text-base font-medium rounded-md w-full shadow-sm hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-300"
                            >
                              Eliminar
                            </Button>
                            <Button
                              variant="outline"
                              onClick={() => setShowDeleteLeagueConfirm(null)}
                              className="mt-2 px-4 py-2 bg-gray-200 text-gray-800 text-base font-medium rounded-md w-full shadow-sm hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-300"
                            >
                              Cancelar
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="settings">
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Settings className="h-5 w-5 text-primary" />
                  <CardTitle>Configuración General</CardTitle>
                </div>
                <CardDescription>Personaliza la apariencia y comportamiento de tus fixtures.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                <input
                  ref={sessionFileInputRef}
                  type="file"
                  accept="application/json"
                  className="hidden"
                  onChange={handleImportSession}
                />

                <div className="bg-muted/30 border border-muted-foreground/20 rounded-lg p-4 flex flex-col gap-3">
                  <div>
                    <h3 className="text-sm font-semibold text-gray-700">Sesiones guardadas</h3>
                    <p className="text-xs text-muted-foreground">
                      Guarda tus configuraciones y fixtures en un archivo JSON para restaurarlos cuando lo necesites.
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button type="button" variant="outline" size="sm" onClick={handleImportSessionClick}>
                      <Upload className="mr-2 h-4 w-4" />
                      Importar sesión
                    </Button>
                    <Button type="button" size="sm" onClick={handleExportSession}>
                      <Download className="mr-2 h-4 w-4" />
                      Exportar sesión
                    </Button>
                    <Button 
                      type="button" 
                      variant="destructive" 
                      size="sm" 
                      onClick={() => {
                        if (window.confirm("¿Estás seguro de que quieres limpiar la sesión guardada?")) {
                          window.localStorage.removeItem(SESSION_STORAGE_KEY)
                          window.localStorage.removeItem(GRAPHIC_STATE_STORAGE_KEY)
                          window.location.reload()
                        }
                      }}
                    >
                      Limpiar sesión
                    </Button>
                  </div>
                </div>

                {/* Sección: Control Maestro */}
	                <div className="space-y-4">
	                  <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
	                    <div className="h-1 w-1 rounded-full bg-primary"></div>
	                    Control Maestro
	                  </h3>
	                  <TooltipProvider>
	                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 pl-3 border-l-2 border-gray-200">
                    <div className="p-3 bg-gray-50 rounded-lg space-y-2">
                      <div className="flex items-center justify-between">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Label htmlFor="master-date-font-size" className="cursor-help">
                              Tamaño fecha
                            </Label>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Tamaño de la fecha en % (se aplica como valor maestro en los fixtures).</p>
                          </TooltipContent>
                        </Tooltip>
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded-full ${
                            dateFontSizeDirty ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700"
                          }`}
                        >
                          {dateFontSizeDirty ? "Pendiente" : "Guardado"}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Input
                          id="master-date-font-size"
                          type="number"
                          value={fixtureDateFontSizeInput}
                          onChange={(e) => setFixtureDateFontSizeInput(Number(e.target.value))}
                          className={dateFontSizeDirty ? "border-amber-400 bg-amber-50" : ""}
                        />
                        <span className="text-xs text-gray-500 w-6 text-right">%</span>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            const previousValue = fixtureDateFontSize
                            const nextValue = fixtureDateFontSizeInput
                            if (previousValue === nextValue) {
                              return
                            }
                            setFixtureDateFontSize(nextValue)
                            setFixtureDateFontSizeInput(nextValue)
                            showUndoToast("Tamaño fecha (%)", previousValue, nextValue, () => {
                              setFixtureDateFontSize(previousValue)
                              setFixtureDateFontSizeInput(previousValue)
                            })
                          }}
                        >
                          Aplicar
                        </Button>
                      </div>
                      <p className="text-xs text-gray-500">Actual: {fixtureDateFontSize}%</p>
                    </div>

                    <div className="p-3 bg-gray-50 rounded-lg space-y-2">
                      <div className="flex items-center justify-between">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Label htmlFor="master-date-vertical-offset" className="cursor-help">
                              Espacio fecha/bloque
                            </Label>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Suma al margen inferior de la fecha (px) para separar del bloque.</p>
                          </TooltipContent>
                        </Tooltip>
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded-full ${
                            dateVerticalOffsetDirty ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700"
                          }`}
                        >
                          {dateVerticalOffsetDirty ? "Pendiente" : "Guardado"}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Input
                          id="master-date-vertical-offset"
                          type="number"
                          value={dateVerticalOffsetInput}
                          onChange={(e) => setDateVerticalOffsetInput(Number(e.target.value))}
                          className={dateVerticalOffsetDirty ? "border-amber-400 bg-amber-50" : ""}
                        />
                        <span className="text-xs text-gray-500 w-6 text-right">px</span>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            const previousValue = dateVerticalOffset
                            const nextValue = dateVerticalOffsetInput
                            if (previousValue === nextValue) {
                              return
                            }
                            setDateVerticalOffset(nextValue)
                            setDateVerticalOffsetInput(nextValue)
                            showUndoToast("Espacio fecha/bloque (px)", previousValue, nextValue, () => {
                              setDateVerticalOffset(previousValue)
                              setDateVerticalOffsetInput(previousValue)
                            })
                          }}
                        >
                          Aplicar
                        </Button>
                      </div>
                      <p className="text-xs text-gray-500">Actual: {dateVerticalOffset}px</p>
                    </div>

                    <div className="p-3 bg-gray-50 rounded-lg space-y-2">
                      <div className="flex items-center justify-between">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Label htmlFor="master-date-block-spacing" className="cursor-help">
                              Espacio entre bloques
                            </Label>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Separación vertical entre bloques de fechas (px).</p>
                          </TooltipContent>
                        </Tooltip>
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded-full ${
                            fixtureSpacingBetweenDatesDirty ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700"
                          }`}
                        >
                          {fixtureSpacingBetweenDatesDirty ? "Pendiente" : "Guardado"}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Input
                          id="master-date-block-spacing"
                          type="number"
                          value={fixtureSpacingBetweenDatesInput}
                          onChange={(e) => setFixtureSpacingBetweenDatesInput(Number(e.target.value))}
                          className={fixtureSpacingBetweenDatesDirty ? "border-amber-400 bg-amber-50" : ""}
                        />
                        <span className="text-xs text-gray-500 w-6 text-right">px</span>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            const previousValue = fixtureSpacingBetweenDates
                            const nextValue = fixtureSpacingBetweenDatesInput
                            if (previousValue === nextValue) {
                              return
                            }
                            setFixtureSpacingBetweenDates(nextValue)
                            setFixtureSpacingBetweenDatesInput(nextValue)
                            setFiveFixtureSpacingBetweenDates(nextValue)
                            showUndoToast("Espacio entre bloques (px)", previousValue, nextValue, () => {
                              setFixtureSpacingBetweenDates(previousValue)
                              setFixtureSpacingBetweenDatesInput(previousValue)
                              setFiveFixtureSpacingBetweenDates(previousValue)
                            })
                          }}
                        >
                          Aplicar
                        </Button>
                      </div>
                      <p className="text-xs text-gray-500">Actual: {fixtureSpacingBetweenDates}px</p>
                    </div>

	                    <div className="p-3 bg-gray-50 rounded-lg space-y-2">
	                      <div className="flex items-center justify-between">
	                        <Tooltip>
	                          <TooltipTrigger asChild>
	                            <Label htmlFor="master-team-names-size" className="cursor-help">
	                              Tamaño nombres
	                            </Label>
	                          </TooltipTrigger>
	                          <TooltipContent>
	                            <p>Tamaño de fuente de los nombres de equipos (px).</p>
	                          </TooltipContent>
	                        </Tooltip>
	                        <span
	                          className={`text-[10px] px-2 py-0.5 rounded-full ${
	                            teamNamesSizeDirty ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700"
	                          }`}
	                        >
                          {teamNamesSizeDirty ? "Pendiente" : "Guardado"}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Input
                          id="master-team-names-size"
                          type="number"
                          value={teamNamesFontSizeInput}
                          onChange={(e) => setTeamNamesFontSizeInput(Number(e.target.value))}
                          className={teamNamesSizeDirty ? "border-amber-400 bg-amber-50" : ""}
                        />
                        <span className="text-xs text-gray-500 w-6 text-right">px</span>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            const previousValue = teamNamesFontSize
                            const nextValue = teamNamesFontSizeInput
                            if (previousValue === nextValue) {
                              return
                            }
                            setTeamNamesFontSize(nextValue)
                            setTeamNamesFontSizeInput(nextValue)
                            showUndoToast("Tamaño nombres (px)", previousValue, nextValue, () => {
                              setTeamNamesFontSize(previousValue)
                              setTeamNamesFontSizeInput(previousValue)
                            })
                          }}
                        >
                          Aplicar
                        </Button>
                      </div>
                      <p className="text-xs text-gray-500">Actual: {teamNamesFontSize}px</p>
                    </div>

	                    <div className="p-3 bg-gray-50 rounded-lg space-y-2">
	                      <div className="flex items-center justify-between">
	                        <Tooltip>
	                          <TooltipTrigger asChild>
	                            <Label htmlFor="master-times-size" className="cursor-help">
	                              Tamaño horarios
	                            </Label>
	                          </TooltipTrigger>
	                          <TooltipContent>
	                            <p>Tamaño de fuente de los horarios (px).</p>
	                          </TooltipContent>
	                        </Tooltip>
	                        <span
	                          className={`text-[10px] px-2 py-0.5 rounded-full ${
	                            timesSizeDirty ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700"
	                          }`}
	                        >
                          {timesSizeDirty ? "Pendiente" : "Guardado"}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Input
                          id="master-times-size"
                          type="number"
                          value={timesFontSizeInput}
                          onChange={(e) => setTimesFontSizeInput(Number(e.target.value))}
                          className={timesSizeDirty ? "border-amber-400 bg-amber-50" : ""}
                        />
                        <span className="text-xs text-gray-500 w-6 text-right">px</span>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            const previousValue = timesFontSize
                            const nextValue = timesFontSizeInput
                            if (previousValue === nextValue) {
                              return
                            }
                            setTimesFontSize(nextValue)
                            setTimesFontSizeInput(nextValue)
                            showUndoToast("Tamaño horarios (px)", previousValue, nextValue, () => {
                              setTimesFontSize(previousValue)
                              setTimesFontSizeInput(previousValue)
                            })
                          }}
                        >
                          Aplicar
                        </Button>
                      </div>
                      <p className="text-xs text-gray-500">Actual: {timesFontSize}px</p>
                    </div>

	                    <div className="p-3 bg-gray-50 rounded-lg space-y-2">
	                      <div className="flex items-center justify-between">
	                        <Tooltip>
	                          <TooltipTrigger asChild>
	                            <Label htmlFor="master-time-labels-size" className="cursor-help">
	                              Tamaño etiquetas
	                            </Label>
	                          </TooltipTrigger>
	                          <TooltipContent>
	                            <p>Tamaño de las etiquetas de zona horaria (px).</p>
	                          </TooltipContent>
	                        </Tooltip>
	                        <span
	                          className={`text-[10px] px-2 py-0.5 rounded-full ${
	                            timeLabelsSizeDirty ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700"
	                          }`}
	                        >
                          {timeLabelsSizeDirty ? "Pendiente" : "Guardado"}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Input
                          id="master-time-labels-size"
                          type="number"
                          value={timeLabelsFontSizeInput}
                          onChange={(e) => setTimeLabelsFontSizeInput(Number(e.target.value))}
                          className={timeLabelsSizeDirty ? "border-amber-400 bg-amber-50" : ""}
                        />
                        <span className="text-xs text-gray-500 w-6 text-right">px</span>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            const previousValue = timeLabelsFontSize
                            const nextValue = timeLabelsFontSizeInput
                            if (previousValue === nextValue) {
                              return
                            }
                            setTimeLabelsFontSize(nextValue)
                            setTimeLabelsFontSizeInput(nextValue)
                            showUndoToast("Tamaño etiquetas (px)", previousValue, nextValue, () => {
                              setTimeLabelsFontSize(previousValue)
                              setTimeLabelsFontSizeInput(previousValue)
                            })
                          }}
                        >
                          Aplicar
                        </Button>
                      </div>
                      <p className="text-xs text-gray-500">Actual: {timeLabelsFontSize}px</p>
                    </div>

	                    <div className="p-3 bg-gray-50 rounded-lg space-y-2">
	                      <div className="flex items-center justify-between">
	                        <Tooltip>
	                          <TooltipTrigger asChild>
	                            <Label htmlFor="master-divider-height" className="cursor-help">
	                              Altura divisores
	                            </Label>
	                          </TooltipTrigger>
	                          <TooltipContent>
	                            <p>Altura de las líneas divisorias (% de la franja).</p>
	                          </TooltipContent>
	                        </Tooltip>
	                        <span
	                          className={`text-[10px] px-2 py-0.5 rounded-full ${
	                            dividerHeightDirty ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700"
	                          }`}
	                        >
                          {dividerHeightDirty ? "Pendiente" : "Guardado"}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Input
                          id="master-divider-height"
                          type="number"
                          value={dividerHeightInput}
                          onChange={(e) => setDividerHeightInput(Number(e.target.value))}
                          className={dividerHeightDirty ? "border-amber-400 bg-amber-50" : ""}
                        />
                        <span className="text-xs text-gray-500 w-6 text-right">%</span>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            const previousValue = dividerHeight
                            const nextValue = dividerHeightInput
                            if (previousValue === nextValue) {
                              return
                            }
                            setDividerHeight(nextValue)
                            setDividerHeightInput(nextValue)
                            showUndoToast("Altura divisores (%)", previousValue, nextValue, () => {
                              setDividerHeight(previousValue)
                              setDividerHeightInput(previousValue)
                            })
                          }}
                        >
                          Aplicar
                        </Button>
                      </div>
                      <p className="text-xs text-gray-500">Actual: {dividerHeight}%</p>
                    </div>

	                    <div className="p-3 bg-gray-50 rounded-lg space-y-2">
	                      <div className="flex items-center justify-between">
	                        <Tooltip>
	                          <TooltipTrigger asChild>
	                            <Label htmlFor="master-horizontal-time-offset" className="cursor-help">
	                              Posición horizontal horarios
	                            </Label>
	                          </TooltipTrigger>
	                          <TooltipContent>
	                            <p>Mueve el bloque de horarios a izquierda/derecha (px).</p>
	                          </TooltipContent>
	                        </Tooltip>
	                        <span
	                          className={`text-[10px] px-2 py-0.5 rounded-full ${
	                            horizontalOffsetDirty ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700"
	                          }`}
	                        >
                          {horizontalOffsetDirty ? "Pendiente" : "Guardado"}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Input
                          id="master-horizontal-time-offset"
                          type="number"
                          value={horizontalTimeOffsetInput}
                          onChange={(e) => setHorizontalTimeOffsetInput(Number(e.target.value))}
                          className={horizontalOffsetDirty ? "border-amber-400 bg-amber-50" : ""}
                        />
                        <span className="text-xs text-gray-500 w-6 text-right">px</span>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            const previousValue = horizontalTimeOffset
                            const nextValue = horizontalTimeOffsetInput
                            if (previousValue === nextValue) {
                              return
                            }
                            setHorizontalTimeOffset(nextValue)
                            setHorizontalTimeOffsetInput(nextValue)
                            showUndoToast("Posición horizontal (px)", previousValue, nextValue, () => {
                              setHorizontalTimeOffset(previousValue)
                              setHorizontalTimeOffsetInput(previousValue)
                            })
                          }}
                        >
                          Aplicar
                        </Button>
                      </div>
                      <p className="text-xs text-gray-500">Actual: {horizontalTimeOffset}px</p>
                    </div>

	                    <div className="p-3 bg-gray-50 rounded-lg space-y-2">
	                      <div className="flex items-center justify-between">
	                        <Tooltip>
	                          <TooltipTrigger asChild>
	                            <Label htmlFor="master-time-block-offset" className="cursor-help">
	                              Posición horarios
	                            </Label>
	                          </TooltipTrigger>
	                          <TooltipContent>
	                            <p>Sube/baja el bloque de horarios (px). Valores negativos lo suben.</p>
	                          </TooltipContent>
	                        </Tooltip>
	                        <span
	                          className={`text-[10px] px-2 py-0.5 rounded-full ${
	                            timeBlockOffsetDirty ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700"
	                          }`}
	                        >
                          {timeBlockOffsetDirty ? "Pendiente" : "Guardado"}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Input
                          id="master-time-block-offset"
                          type="number"
                          value={timeBlockOffsetInput}
                          onChange={(e) => setTimeBlockOffsetInput(Number(e.target.value))}
                          className={timeBlockOffsetDirty ? "border-amber-400 bg-amber-50" : ""}
                        />
                        <span className="text-xs text-gray-500 w-6 text-right">px</span>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            const previousValue = timeBlockOffset
                            const nextValue = timeBlockOffsetInput
                            if (previousValue === nextValue) {
                              return
                            }
                            setTimeBlockOffset(nextValue)
                            setTimeBlockOffsetInput(nextValue)
                            showUndoToast("Posición horarios (px)", previousValue, nextValue, () => {
                              setTimeBlockOffset(previousValue)
                              setTimeBlockOffsetInput(previousValue)
                            })
                          }}
                        >
                          Aplicar
                        </Button>
                      </div>
                      <p className="text-xs text-gray-500">Actual: {timeBlockOffset}px</p>
                    </div>

	                    <div className="p-3 bg-gray-50 rounded-lg space-y-2">
	                      <div className="flex items-center justify-between">
	                        <Tooltip>
	                          <TooltipTrigger asChild>
	                            <Label htmlFor="master-country-label-offset" className="cursor-help">
	                              Posición etiquetas
	                            </Label>
	                          </TooltipTrigger>
	                          <TooltipContent>
	                            <p>Sube/baja las etiquetas de zona horaria (px).</p>
	                          </TooltipContent>
	                        </Tooltip>
	                        <span
	                          className={`text-[10px] px-2 py-0.5 rounded-full ${
	                            countryLabelOffsetDirty ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700"
	                          }`}
	                        >
                          {countryLabelOffsetDirty ? "Pendiente" : "Guardado"}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Input
                          id="master-country-label-offset"
                          type="number"
                          value={countryLabelOffsetInput}
                          onChange={(e) => setCountryLabelOffsetInput(Number(e.target.value))}
                          className={countryLabelOffsetDirty ? "border-amber-400 bg-amber-50" : ""}
                        />
                        <span className="text-xs text-gray-500 w-6 text-right">px</span>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            const previousValue = countryLabelOffset
                            const nextValue = countryLabelOffsetInput
                            if (previousValue === nextValue) {
                              return
                            }
                            setCountryLabelOffset(nextValue)
                            setCountryLabelOffsetInput(nextValue)
                            showUndoToast("Posición etiquetas (px)", previousValue, nextValue, () => {
                              setCountryLabelOffset(previousValue)
                              setCountryLabelOffsetInput(previousValue)
                            })
                          }}
                        >
                          Aplicar
                        </Button>
                      </div>
                      <p className="text-xs text-gray-500">Actual: {countryLabelOffset}px</p>
                    </div>

	                    <div className="p-3 bg-gray-50 rounded-lg space-y-2">
	                      <div className="flex items-center justify-between">
	                        <Tooltip>
	                          <TooltipTrigger asChild>
	                            <Label htmlFor="master-team-names-offset" className="cursor-help">
	                              Posición nombres
	                            </Label>
	                          </TooltipTrigger>
	                          <TooltipContent>
	                            <p>Sube/baja los nombres de equipos (px).</p>
	                          </TooltipContent>
	                        </Tooltip>
	                        <span
	                          className={`text-[10px] px-2 py-0.5 rounded-full ${
	                            teamNamesOffsetDirty ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700"
	                          }`}
	                        >
                          {teamNamesOffsetDirty ? "Pendiente" : "Guardado"}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Input
                          id="master-team-names-offset"
                          type="number"
                          value={teamNamesOffsetInput}
                          onChange={(e) => setTeamNamesOffsetInput(Number(e.target.value))}
                          className={teamNamesOffsetDirty ? "border-amber-400 bg-amber-50" : ""}
                        />
                        <span className="text-xs text-gray-500 w-6 text-right">px</span>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            const previousValue = teamNamesOffset
                            const nextValue = teamNamesOffsetInput
                            if (previousValue === nextValue) {
                              return
                            }
                            setTeamNamesOffset(nextValue)
                            setTeamNamesOffsetInput(nextValue)
                            showUndoToast("Posición nombres (px)", previousValue, nextValue, () => {
                              setTeamNamesOffset(previousValue)
                              setTeamNamesOffsetInput(previousValue)
                            })
                          }}
                        >
                          Aplicar
                        </Button>
	                      </div>
	                      <p className="text-xs text-gray-500">Actual: {teamNamesOffset}px</p>
	                    </div>

	                    <div className="p-3 bg-gray-50 rounded-lg space-y-2">
	                      <div className="flex items-center justify-between">
	                        <Tooltip>
	                          <TooltipTrigger asChild>
	                            <Label htmlFor="master-fixture-spacing" className="cursor-help">
	                              Espacio entre fixtures (web)
	                            </Label>
	                          </TooltipTrigger>
	                          <TooltipContent>
	                            <p>Separación vertical general en la vista web (no afecta exportación).</p>
	                          </TooltipContent>
	                        </Tooltip>
	                        <span
	                          className={`text-[10px] px-2 py-0.5 rounded-full ${
	                            fixtureSpacingDirty ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700"
	                          }`}
	                        >
	                          {fixtureSpacingDirty ? "Pendiente" : "Guardado"}
	                        </span>
	                      </div>
	                      <div className="flex items-center gap-2">
	                        <Input
	                          id="master-fixture-spacing"
	                          type="number"
	                          value={fixtureSpacingInput}
	                          onChange={(e) => setFixtureSpacingInput(Number(e.target.value))}
	                          className={fixtureSpacingDirty ? "border-amber-400 bg-amber-50" : ""}
	                        />
	                        <span className="text-xs text-gray-500 w-6 text-right">px</span>
	                        <Button
	                          variant="outline"
	                          size="sm"
	                          onClick={() => {
	                            const previousValue = fixtureSpacing
	                            const nextValue = fixtureSpacingInput
	                            if (previousValue === nextValue) {
	                              return
	                            }
	                            setFixtureSpacing(nextValue)
	                            setFixtureSpacingInput(nextValue)
	                            showUndoToast("Espacio entre fixtures (web)", previousValue, nextValue, () => {
	                              setFixtureSpacing(previousValue)
	                              setFixtureSpacingInput(previousValue)
	                            })
	                          }}
	                        >
	                          Aplicar
	                        </Button>
	                      </div>
	                      <p className="text-xs text-gray-500">Actual: {fixtureSpacing}px</p>
	                    </div>

	                    <div className="p-3 bg-gray-50 rounded-lg space-y-2">
	                      <div className="flex items-center justify-between">
	                        <Tooltip>
	                          <TooltipTrigger asChild>
	                            <Label htmlFor="master-fixture-margin-top" className="cursor-help">
	                              Margen superior fixture
	                            </Label>
	                          </TooltipTrigger>
	                          <TooltipContent>
	                            <p>Espacio extra arriba de cada fixture (útil cuando no hay fecha en el medio).</p>
	                          </TooltipContent>
	                        </Tooltip>
	                        <span
	                          className={`text-[10px] px-2 py-0.5 rounded-full ${
	                            fixtureMarginTopDirty ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700"
	                          }`}
	                        >
	                          {fixtureMarginTopDirty ? "Pendiente" : "Guardado"}
	                        </span>
	                      </div>
	                      <div className="flex items-center gap-2">
	                        <Input
	                          id="master-fixture-margin-top"
	                          type="number"
	                          value={fixtureMarginTopInput}
	                          onChange={(e) => setFixtureMarginTopInput(Number(e.target.value))}
	                          className={fixtureMarginTopDirty ? "border-amber-400 bg-amber-50" : ""}
	                        />
	                        <span className="text-xs text-gray-500 w-6 text-right">px</span>
	                        <Button
	                          variant="outline"
	                          size="sm"
	                          onClick={() => {
	                            const previousValue = fixtureMarginTop
	                            const nextValue = fixtureMarginTopInput
	                            if (previousValue === nextValue) {
	                              return
	                            }
	                            setFixtureMarginTop(nextValue)
	                            setFixtureMarginTopInput(nextValue)
	                            showUndoToast("Margen superior fixture (px)", previousValue, nextValue, () => {
	                              setFixtureMarginTop(previousValue)
	                              setFixtureMarginTopInput(previousValue)
	                            })
	                          }}
	                        >
	                          Aplicar
	                        </Button>
	                      </div>
	                      <p className="text-xs text-gray-500">Actual: {fixtureMarginTop}px</p>
	                    </div>

	                    <div className="p-3 bg-gray-50 rounded-lg space-y-2">
	                      <div className="flex items-center justify-between">
	                        <Tooltip>
	                          <TooltipTrigger asChild>
	                            <Label htmlFor="master-fixture-margin-bottom" className="cursor-help">
	                              Margen inferior fixture
	                            </Label>
	                          </TooltipTrigger>
	                          <TooltipContent>
	                            <p>Espacio extra debajo de cada fixture (útil cuando no hay fecha en el medio).</p>
	                          </TooltipContent>
	                        </Tooltip>
	                        <span
	                          className={`text-[10px] px-2 py-0.5 rounded-full ${
	                            fixtureMarginBottomDirty ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700"
	                          }`}
	                        >
	                          {fixtureMarginBottomDirty ? "Pendiente" : "Guardado"}
	                        </span>
	                      </div>
	                      <div className="flex items-center gap-2">
	                        <Input
	                          id="master-fixture-margin-bottom"
	                          type="number"
	                          value={fixtureMarginBottomInput}
	                          onChange={(e) => setFixtureMarginBottomInput(Number(e.target.value))}
	                          className={fixtureMarginBottomDirty ? "border-amber-400 bg-amber-50" : ""}
	                        />
	                        <span className="text-xs text-gray-500 w-6 text-right">px</span>
	                        <Button
	                          variant="outline"
	                          size="sm"
	                          onClick={() => {
	                            const previousValue = fixtureMarginBottom
	                            const nextValue = fixtureMarginBottomInput
	                            if (previousValue === nextValue) {
	                              return
	                            }
	                            setFixtureMarginBottom(nextValue)
	                            setFixtureMarginBottomInput(nextValue)
	                            showUndoToast("Margen inferior fixture (px)", previousValue, nextValue, () => {
	                              setFixtureMarginBottom(previousValue)
	                              setFixtureMarginBottomInput(previousValue)
	                            })
	                          }}
	                        >
	                          Aplicar
	                        </Button>
	                      </div>
	                      <p className="text-xs text-gray-500">Actual: {fixtureMarginBottom}px</p>
	                    </div>
		                  </div>
		                  </TooltipProvider>
		                </div>

	                {/* Sección: Opciones de Visualización */}
	                <div className="space-y-4">
	                  <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
	                    <div className="h-1 w-1 rounded-full bg-primary"></div>
	                    Opciones de Visualización
	                  </h3>
	                  <TooltipProvider>
	                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pl-3 border-l-2 border-gray-200">
	                    <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
	                      <div>
	                        <Tooltip>
	                          <TooltipTrigger asChild>
	                            <Label htmlFor="show-time-labels" className="font-medium cursor-help">
	                              Mostrar etiquetas de tiempo
	                            </Label>
	                          </TooltipTrigger>
	                          <TooltipContent>
	                            <p>Muestra las etiquetas de zona horaria en los fixtures.</p>
	                          </TooltipContent>
	                        </Tooltip>
	                      </div>
	                      <Switch
	                        id="show-time-labels"
	                        checked={showTimeLabels}
	                        onCheckedChange={(checked) => setShowTimeLabels(checked)}
	                      />
	                    </div>
	
	                    <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
	                      <div>
	                        <Tooltip>
	                          <TooltipTrigger asChild>
	                            <Label htmlFor="show-dividers" className="font-medium cursor-help">
	                              Mostrar divisores
	                            </Label>
	                          </TooltipTrigger>
	                          <TooltipContent>
	                            <p>Agrega líneas divisoras entre horarios.</p>
	                          </TooltipContent>
	                        </Tooltip>
	                      </div>
	                      <Switch
	                        id="show-dividers"
	                        checked={showDividers}
	                        onCheckedChange={(checked) => setShowDividers(checked)}
	                      />
	                    </div>
	
	                    <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
	                      <div>
	                        <Tooltip>
	                          <TooltipTrigger asChild>
	                            <Label htmlFor="show-team-names" className="font-medium cursor-help">
	                              Mostrar nombres de equipos
	                            </Label>
	                          </TooltipTrigger>
	                          <TooltipContent>
	                            <p>Muestra los nombres de los equipos en lugar de zonas horarias.</p>
	                          </TooltipContent>
	                        </Tooltip>
	                      </div>
	                      <Switch
	                        id="show-team-names"
	                        checked={showTeamNames}
	                        onCheckedChange={(checked) => setShowTeamNames(checked)}
	                      />
	                    </div>
	
	                    <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
	                      <div>
	                        <Tooltip>
	                          <TooltipTrigger asChild>
	                            <Label htmlFor="export-minimal-mode" className="font-medium cursor-help">
	                              Exportar modo minimalista
	                            </Label>
	                          </TooltipTrigger>
	                          <TooltipContent>
	                            <p>Exporta sin nombres de equipos, horarios ni divisores.</p>
	                          </TooltipContent>
	                        </Tooltip>
	                      </div>
	                      <Switch
	                        id="export-minimal-mode"
	                        checked={exportMinimalMode}
	                        onCheckedChange={(checked) => setExportMinimalMode(checked)}
	                      />
	                    </div>
	
	                  </div>
	                  </TooltipProvider>
	                </div>


                <div className="mt-4">
                  <Label className="mb-2 block">Editar zonas horarias</Label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
                    {timeZones.map((tz) => (
                      <div
                        key={`timezone-edit-${tz.name}`}
                        className="flex flex-nowrap items-center gap-2 p-2 bg-gray-50 rounded-lg"
                      >
                        <input
                          type="checkbox"
                          checked={tz.enabled ?? false}
                          onChange={() => toggleTimeZoneEnabled(tz.name)}
                          className="w-4 h-4 cursor-pointer"
                        />
                        <span className="w-10 sm:w-12 text-sm font-medium">{tz.name}</span>
                        <div className="flex items-center gap-1 whitespace-nowrap">
                          <span className="text-xs text-gray-600">H</span>
                          <Input
                            type="number"
                            value={tz.diffHours}
                            onChange={(e) => updateTimeZone(tz.name, Number(e.target.value), tz.label)}
                            placeholder="UTC offset"
                            className="w-14 sm:w-16"
                            step="1"
                          />
                        </div>
                        <Input
                          value={tz.label}
                          onChange={(e) => updateTimeZone(tz.name, tz.diffHours, e.target.value)}
                          placeholder="Etiqueta visible"
                          className="flex-1 min-w-[100px]"
                        />
                      </div>
                    ))}
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">
                    Selecciona qué zonas horarias mostrar, modifica el UTC (ej: +3, -2) y la etiqueta visible.
                  </p>
                </div>

	                {/* Tipografía - Dropdown */}
	                <Collapsible 
	                  open={openDropdowns.tipografia} 
	                  onOpenChange={(open) => setOpenDropdowns({...openDropdowns, tipografia: open})}
                  className="mt-4 border rounded-lg"
                >
                  <CollapsibleTrigger className="w-full p-4 hover:bg-gray-50 flex items-center justify-between">
                    <h3 className="text-lg font-semibold">🔤 Tipografía</h3>
                    <ChevronDown className="h-5 w-5 transition-transform" style={{transform: openDropdowns.tipografia ? 'rotate(180deg)' : 'rotate(0deg)'}} />
                  </CollapsibleTrigger>
                  <CollapsibleContent className="p-4 border-t space-y-4">
                    {/* Tipografía Avanzada */}
                    <div className="border-t pt-4">
                      <h4 className="font-semibold text-sm mb-3">⚙️ Tipografía Avanzada</h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <Label htmlFor="font-family">Familia de Fuente</Label>
                          <select
                            id="font-family"
                            value={fontFamily}
                            onChange={(e) => setFontFamily(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                          >
                            <option value="Poppins">Poppins</option>
                            <option value="Arial">Arial</option>
                            <option value="Helvetica">Helvetica</option>
                            <option value="Times New Roman">Times New Roman</option>
                            <option value="Courier New">Courier New</option>
                            <option value="Georgia">Georgia</option>
                            <option value="Verdana">Verdana</option>
                          </select>
                          <p className="text-xs text-gray-500 mt-1">Actual: {fontFamily}</p>
                        </div>

                        <div>
                          <Label htmlFor="font-weight">Peso de Fuente</Label>
                          <select
                            id="font-weight"
                            value={fontWeight}
                            onChange={(e) => setFontWeight(e.target.value as any)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                          >
                            <option value="normal">Normal (400)</option>
                            <option value="600">Semi-Bold (600)</option>
                            <option value="bold">Bold (700)</option>
                          </select>
                          <p className="text-xs text-gray-500 mt-1">Actual: {fontWeight}</p>
                        </div>

                        <div>
                          <Label htmlFor="letter-spacing">Espaciado entre Letras (px)</Label>
                          <div className="flex items-center gap-2">
                            <Input
                              id="letter-spacing"
                              type="number"
                              value={letterSpacing}
                              onChange={(e) => setLetterSpacing(Number(e.target.value))}
                              step="0.5"
                            />
                            <Button variant="outline" size="sm" onClick={() => setLetterSpacing(0)}>Reiniciar</Button>
                          </div>
                          <p className="text-xs text-gray-500 mt-1">Valor actual: {letterSpacing}px</p>
                        </div>

                        <div>
                          <Label htmlFor="line-height">Altura de Línea</Label>
                          <div className="flex items-center gap-2">
                            <Input
                              id="line-height"
                              type="number"
                              value={lineHeight}
                              onChange={(e) => setLineHeight(Number(e.target.value))}
                              step="0.1"
                              min="0.8"
                              max="3"
                            />
                            <Button variant="outline" size="sm" onClick={() => setLineHeight(1.5)}>Reiniciar</Button>
                          </div>
                          <p className="text-xs text-gray-500 mt-1">Valor actual: {lineHeight}</p>
                        </div>
                      </div>
                      <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg mt-3">
                        <p className="text-xs text-amber-800">
                          💡 <strong>Tip:</strong> Letter-spacing: 0-2px (normal), Line-height: 1.2-1.8 (recomendado)
                        </p>
                      </div>
                    </div>
                  </CollapsibleContent>
                </Collapsible>

                {/* Posición de Fechas y Espacio entre Bloques - Dropdown */}
                <Collapsible 
                  open={openDropdowns.fechas} 
                  onOpenChange={(open) => setOpenDropdowns({...openDropdowns, fechas: open})}
                  className="mt-4 border rounded-lg"
                >
                  <CollapsibleTrigger className="w-full p-4 hover:bg-gray-50 flex items-center justify-between">
                    <h3 className="text-lg font-semibold">Posición de Fechas y Espacio entre Bloques</h3>
                    <ChevronDown className="h-5 w-5 transition-transform" style={{transform: openDropdowns.fechas ? 'rotate(180deg)' : 'rotate(0deg)'}} />
                  </CollapsibleTrigger>
                  <CollapsibleContent className="p-4 border-t space-y-4">
                    {/* Posición de Fechas */}
                    <div>
                      <Label className="mb-2 block font-semibold">Posición de Fechas</Label>
                      <div className="space-y-3">
                        <div className="p-3 bg-gray-50 rounded-lg">
                          <div className="flex items-center justify-between mb-2">
                            <Label className="text-sm font-medium">Fecha Original (27) - Desplazamiento Horizontal</Label>
                            <span className="text-xs text-gray-600">{dateOriginalOffsetX}px</span>
                          </div>
                          <input
                            type="range"
                            min="-300"
                            max="300"
                            value={dateOriginalOffsetX}
                            onChange={(e) => setDateOriginalOffsetX(Number(e.target.value))}
                            className="w-full"
                          />
                          <div className="flex gap-2 mt-2">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => setDateOriginalOffsetX(0)}
                            >
                              Reiniciar
                            </Button>
                          </div>
                        </div>

                        <div className="p-3 bg-gray-50 rounded-lg">
                          <div className="flex items-center justify-between mb-2">
                            <Label className="text-sm font-medium">Fecha ESP (28) - Desplazamiento Horizontal</Label>
                            <span className="text-xs text-gray-600">{dateESPOffsetX}px</span>
                          </div>
                          <input
                            type="range"
                            min="-300"
                            max="300"
                            value={dateESPOffsetX}
                            onChange={(e) => setDateESPOffsetX(Number(e.target.value))}
                            className="w-full"
                          />
                          <div className="flex gap-2 mt-2">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => setDateESPOffsetX(0)}
                            >
                              Reiniciar
                            </Button>
                          </div>
                        </div>
                      </div>
                      <p className="mt-2 text-xs text-muted-foreground">
                        Usa los sliders para ajustar la posición horizontal de las fechas. Valores negativos mueven a la izquierda, positivos a la derecha.
                      </p>
                    </div>

	                  </CollapsibleContent>
	                </Collapsible>

                {/* Presets de Posición */}
                <div className="space-y-4">
                  <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                    <div className="h-1 w-1 rounded-full bg-primary"></div>
                    Presets de Posición
                  </h3>
                  <div className="grid grid-cols-2 gap-3 pl-3">
                    <Button 
                      variant="outline"
                      className="h-auto py-4 flex flex-col items-center gap-2 hover:bg-primary/5 hover:border-primary transition-all"
                      onClick={() => {
                        const timeOffset = blockStyle === "compact" ? scaleFixtureOffset(-30) : scaleFixtureOffset(-35)
                        const labelOffset = blockStyle === "compact" ? scaleFixtureOffset(-30) : scaleFixtureOffset(-35)
                        setTimeBlockOffset(timeOffset);
                        setTimeBlockOffsetInput(timeOffset);
                        setCountryLabelOffset(labelOffset);
                        setCountryLabelOffsetInput(labelOffset);
                        setTeamNamesOffset(scaleFixtureOffset(-45));
                        setTeamNamesOffsetInput(scaleFixtureOffset(-45));
                        setTeamNamesFontSize(18);
                        setTeamNamesFontSizeInput(18);
                        setTimesFontSize(45);
                        setTimesFontSizeInput(45);
                        setDividerHeight(50);
                        setDividerHeightInput(50);
                        setHorizontalTimeOffset(0);
                        setHorizontalTimeOffsetInput(0);
                      }}
                    >
                      <Calendar className="h-5 w-5" />
                      <span className="font-semibold">Con HORARIOS</span>
                      <span className="text-xs text-muted-foreground">Optimizado para mostrar horarios</span>
                    </Button>
                    <Button 
                      variant="outline"
                      className="h-auto py-4 flex flex-col items-center gap-2 hover:bg-primary/5 hover:border-primary transition-all"
                      onClick={() => {
                        setTimeBlockOffset(scaleFixtureOffset(-75));
                        setTimeBlockOffsetInput(scaleFixtureOffset(-75));
                        setCountryLabelOffset(scaleFixtureOffset(-24));
                        setCountryLabelOffsetInput(scaleFixtureOffset(-24));
                        setTeamNamesOffset(scaleFixtureOffset(-45));
                        setTeamNamesOffsetInput(scaleFixtureOffset(-45));
                        setTeamNamesFontSize(18);
                        setTeamNamesFontSizeInput(18);
                        setTimesFontSize(45);
                        setTimesFontSizeInput(45);
                        setDividerHeight(50);
                        setDividerHeightInput(50);
                        setHorizontalTimeOffset(0);
                        setHorizontalTimeOffsetInput(0);
                      }}
                    >
                      <Users className="h-5 w-5" />
                      <span className="font-semibold">Con NOMBRES</span>
                      <span className="text-xs text-muted-foreground">Optimizado para nombres de equipos</span>
                    </Button>
                  </div>
                </div>

                {/* Estilo de bloque */}
                <div className="space-y-4">
                  <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                    <div className="h-1 w-1 rounded-full bg-primary"></div>
                    Estilo de Bloque
                  </h3>
                  <div className="grid grid-cols-2 gap-3 pl-3">
                    <Button
                      variant={blockStyle === "normal" ? "default" : "outline"}
                      onClick={() => selectBlockStyle("normal")}
                      className="h-auto py-3 flex flex-col gap-1"
                    >
                      <span className="font-semibold">Normal</span>
                      <span className="text-xs opacity-70">1-3 partidos</span>
                    </Button>
                    <Button
                      variant={blockStyle === "compact" ? "default" : "outline"}
                      onClick={() => selectBlockStyle("compact")}
                      className="h-auto py-3 flex flex-col gap-1"
                    >
                      <span className="font-semibold">Compacto</span>
                      <span className="text-xs opacity-70">4 partidos</span>
                    </Button>
                    <Button
                      variant={blockStyle === "five-fixtures" ? "default" : "outline"}
                      onClick={() => selectBlockStyle("five-fixtures")}
                      className="h-auto py-3 flex flex-col gap-1"
                    >
                      <span className="font-semibold">Compacto 5 Partidos</span>
                      <span className="text-xs opacity-70">Especial</span>
                    </Button>
                    <Button
                      variant={blockStyle === "two-column" ? "default" : "outline"}
                      onClick={() => selectBlockStyle("two-column")}
                      className="h-auto py-3 flex flex-col gap-1"
                    >
                      <span className="font-semibold">2 Columnas</span>
                      <span className="text-xs opacity-70">6+ partidos</span>
                    </Button>
                  </div>
                </div>

                {/* Ajustes de Modos - Dropdown */}
                <Collapsible 
                  open={openDropdowns.modos} 
                  onOpenChange={(open) => setOpenDropdowns({...openDropdowns, modos: open})}
                  className="mt-6 border rounded-lg"
                >
                  <CollapsibleTrigger className="w-full p-4 hover:bg-gray-50 flex items-center justify-between">
                    <h3 className="text-lg font-semibold">Ajustes Avanzados de Modos</h3>
                    <ChevronDown className="h-5 w-5 transition-transform" style={{transform: openDropdowns.modos ? 'rotate(180deg)' : 'rotate(0deg)'}} />
                  </CollapsibleTrigger>
                  <CollapsibleContent className="p-4 border-t space-y-4">
                    <p className="text-sm text-muted-foreground">
                      Configura dimensiones y espaciados específicos para cada modo de visualización
                    </p>

                  {/* Ajustes modo normal */}
                  <div className="mt-4 border rounded-md p-3">
                    <div className="flex items-center justify-between mb-2">
                      <Label className="text-base">Ajustes modo normal</Label>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <Label htmlFor="normal-logo-width">Ancho logo (px)</Label>
                        <Input
                          id="normal-logo-width"
                          type="number"
                          value={normalLogoWidth}
                          onChange={(e) => setNormalLogoWidth(Number(e.target.value))}
                        />
                      </div>
                      <div>
                        <Label htmlFor="normal-logo-height">Alto logo (px)</Label>
                        <Input
                          id="normal-logo-height"
                          type="number"
                          value={normalLogoHeight}
                          onChange={(e) => setNormalLogoHeight(Number(e.target.value))}
                        />
                      </div>
                      <div>
                        <Label htmlFor="normal-band-width">Ancho franja (px)</Label>
                        <Input
                          id="normal-band-width"
                          type="number"
                          value={normalBandWidth}
                          onChange={(e) => setNormalBandWidth(Number(e.target.value))}
                        />
                      </div>
                      <div>
                        <Label htmlFor="normal-band-height">Alto franja (px)</Label>
                        <Input
                          id="normal-band-height"
                          type="number"
                          value={normalBandHeight}
                          onChange={(e) => setNormalBandHeight(Number(e.target.value))}
                        />
                      </div>
                      <div>
                        <Label htmlFor="normal-interdate-gap">Espacio arriba de cada fecha (px)</Label>
                        <Input
                          id="normal-interdate-gap"
                          type="number"
                          value={normalInterDateGap}
                          onChange={(e) => setNormalInterDateGap(Number(e.target.value))}
                        />
                      </div>
                      <div>
                        <Label htmlFor="normal-date-gap">Espacio entre fecha y bloque (px)</Label>
                        <Input
                          id="normal-date-gap"
                          type="number"
                          value={normalDateBlockGap}
                          onChange={(e) => setNormalDateBlockGap(Number(e.target.value))}
                        />
                      </div>
                      <div>
                        <Label htmlFor="normal-time-offset">Posición de Horarios (px)</Label>
                        <div className="flex items-center gap-2">
                          <Input
                            id="normal-time-offset"
                            type="number"
                            value={ctxTimeBlockOffsetInput}
                            onChange={(e) => ctxSetTimeBlockOffsetInput(Number(e.target.value))}
                          />
                          <div className="flex gap-1">
                            <Button variant="outline" size="sm" onClick={() => ctxSetTimeBlockOffset(ctxTimeBlockOffsetInput)}>
                              Aplicar
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                ctxSetTimeBlockOffset(-80)
                                ctxSetTimeBlockOffsetInput(-80)
                              }}
                            >
                              Restaurar
                            </Button>
                          </div>
                        </div>
                      </div>
                      <div>
                        <Label htmlFor="normal-team-names-offset">Posición de Nombres (px)</Label>
                        <div className="flex items-center gap-2">
                          <Input
                            id="normal-team-names-offset"
                            type="number"
                            value={ctxTeamNamesOffsetInput}
                            onChange={(e) => ctxSetTeamNamesOffsetInput(Number(e.target.value))}
                          />
                          <div className="flex gap-1">
                            <Button variant="outline" size="sm" onClick={() => ctxSetTeamNamesOffset(ctxTeamNamesOffsetInput)}>
                              Aplicar
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                ctxSetTeamNamesOffset(-49)
                                ctxSetTeamNamesOffsetInput(-49)
                              }}
                            >
                              Restaurar
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

	                  {/* Ajustes modo compacto */}
	                  <div className="mt-4 border rounded-md p-3">
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <Label className="text-base">Ajustes modo compacto</Label>
                        <p className="text-xs text-muted-foreground">Preset activo: {compactPresetName}</p>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={applyCompactPresetFixture4}
                        >
                          Fixture 4
                        </Button>
                      </div>
                    </div>
	                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
	                      <div>
	                        <Label htmlFor="compact-band-width">Ancho franja (px)</Label>
	                        <Input
	                          id="compact-band-width"
	                          type="number"
	                          value={compactBandWidth}
	                          onChange={(e) => setCompactBandWidth(Number(e.target.value))}
	                        />
	                      </div>
	                      <div>
	                        <Label htmlFor="compact-band-height">Alto franja (px)</Label>
	                        <Input
	                          id="compact-band-height"
	                          type="number"
	                          value={compactBandHeight}
	                          onChange={(e) => setCompactBandHeight(Number(e.target.value))}
	                        />
	                      </div>
                      <div>
                        <Label htmlFor="compact-fixture-margin">Ajuste márgenes fixture (px)</Label>
                        <Input
                          id="compact-fixture-margin"
                          type="number"
                          value={compactFixtureMarginAdjust}
                          onChange={(e) => setCompactFixtureMarginAdjust(Number(e.target.value))}
                        />
                      </div>
                      <div>
                        <Label htmlFor="compact-interdate-gap">Espacio arriba de cada fecha (px)</Label>
                        <Input
                          id="compact-interdate-gap"
                          type="number"
                          value={compactInterDateGap}
                          onChange={(e) => setCompactInterDateGap(Number(e.target.value))}
                        />
                      </div>
                      <div>
                        <Label htmlFor="compact-date-gap">Espacio entre fecha y bloque (px)</Label>
                        <Input
                          id="compact-date-gap"
                          type="number"
                          value={compactDateBlockGap}
                          onChange={(e) => setCompactDateBlockGap(Number(e.target.value))}
                        />
                      </div>
	                      <div>
	                        <Label htmlFor="compact-time-offset">Posición de Horarios (px)</Label>
	                        <div className="flex items-center gap-2">
	                          <Input
	                            id="compact-time-offset"
	                            type="number"
	                            value={ctxCompactTimeBlockOffsetInput}
	                            onChange={(e) => {
	                              const v = Number(e.target.value)
	                              ctxSetCompactTimeBlockOffsetInput(v)
	                              ctxSetCompactTimeBlockOffset(v)
	                            }}
	                          />
	                        </div>
	                      </div>
	                      <div>
	                        <Label htmlFor="compact-team-names-offset">Posición de Nombres (px)</Label>
	                        <div className="flex items-center gap-2">
	                          <Input
	                            id="compact-team-names-offset"
	                            type="number"
	                            value={ctxCompactTeamNamesOffsetInput}
	                            onChange={(e) => {
	                              const v = Number(e.target.value)
	                              ctxSetCompactTeamNamesOffsetInput(v)
	                              ctxSetCompactTeamNamesOffset(v)
	                            }}
	                          />
	                        </div>
	                      </div>
	                    </div>
	                  </div>
	
	                  {/* Ajustes modo compacto 5 partidos */}
	                  <div className="mt-4 border rounded-md p-3">
		                    <div className="flex items-center justify-between mb-2">
		                      <Label className="text-base">Ajustes modo compacto 5 partidos</Label>
		                    </div>
		                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
	                      <div>
	                        <Label htmlFor="five-band-width">Ancho franja (px)</Label>
	                        <Input
	                          id="five-band-width"
	                          type="number"
	                          value={fiveBandWidth}
	                          onChange={(e) => setFiveBandWidth(Number(e.target.value))}
	                        />
	                      </div>
	                      <div>
	                        <Label htmlFor="five-band-height">Alto franja (px)</Label>
	                        <Input
	                          id="five-band-height"
	                          type="number"
	                          value={fiveBandHeight}
	                          onChange={(e) => setFiveBandHeight(Number(e.target.value))}
	                        />
	                      </div>
	                      <div>
	                        <Label htmlFor="five-fixture-margin">Ajuste márgenes fixture (px)</Label>
	                        <Input
	                          id="five-fixture-margin"
	                          type="number"
	                          value={fiveFixtureMarginAdjust}
	                          onChange={(e) => setFiveFixtureMarginAdjust(Number(e.target.value))}
	                        />
	                      </div>
	                      <div>
	                        <Label htmlFor="five-interdate-gap">Espacio arriba de cada fecha (px)</Label>
	                        <Input
	                          id="five-interdate-gap"
	                          type="number"
	                          value={fiveInterDateGap}
	                          onChange={(e) => setFiveInterDateGap(Number(e.target.value))}
	                        />
	                      </div>
	                      <div>
	                        <Label htmlFor="five-date-gap">Espacio entre fecha y bloque (px)</Label>
	                        <Input
	                          id="five-date-gap"
	                          type="number"
	                          value={fiveDateBlockGap}
	                          onChange={(e) => setFiveDateBlockGap(Number(e.target.value))}
	                        />
	                      </div>
	                      <div>
	                        <Label htmlFor="five-time-offset">Posición de Horarios (px)</Label>
	                        <Input
	                          id="five-time-offset"
	                          type="number"
	                          value={timeBlockOffsetInput}
	                          onChange={(e) => {
	                            const v = Number(e.target.value)
	                            setTimeBlockOffsetInput(v)
	                            setTimeBlockOffset(v)
	                          }}
	                        />
	                      </div>
	                      <div>
	                        <Label htmlFor="five-team-names-offset">Posición de Nombres (px)</Label>
	                        <Input
	                          id="five-team-names-offset"
	                          type="number"
	                          value={teamNamesOffsetInput}
	                          onChange={(e) => {
	                            const v = Number(e.target.value)
	                            setTeamNamesOffsetInput(v)
	                            setTeamNamesOffset(v)
	                          }}
	                        />
	                      </div>
	                      <div className="sm:col-span-2">
	                        <Label className="text-sm font-medium">Espacio entre bloques de fechas (proporcional)</Label>
	                        <div className="p-3 bg-gray-50 rounded-lg mt-2">
	                          <div className="flex items-center justify-between mb-2">
	                            <span className="text-xs text-muted-foreground">
	                              Base (franja 90px): {fiveFixtureSpacingBetweenDates}px
	                            </span>
	                            <span className="text-xs text-gray-600">
	                              {Math.round((fiveBandHeight / 90) * fiveFixtureSpacingBetweenDates)}px
	                            </span>
	                          </div>
	                          <input
	                            type="range"
	                            min="-50"
	                            max="150"
	                            value={fiveFixtureSpacingBetweenDates}
	                            onChange={(e) => setFiveFixtureSpacingBetweenDates(Number(e.target.value))}
	                            className="w-full"
	                          />
	                          <div className="flex gap-2 mt-2">
	                            <Button
	                              type="button"
	                              variant="outline"
	                              size="sm"
	                              onClick={() => setFiveFixtureSpacingBetweenDates(-8)}
	                            >
	                              Reiniciar (-8)
	                            </Button>
	                          </div>
	                        </div>
		                      </div>
		                    </div>
		                  </div>

	                  {/* Ajustes modo 2 columnas */}
	                  <div className="mt-4 border rounded-md p-3">
	                    <div className="flex items-center justify-between mb-2">
	                      <Label className="text-base">Ajustes modo 2 columnas</Label>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <Label htmlFor="two-logo-size">Tamaño logo (px)</Label>
                        <Input
                          id="two-logo-size"
                          type="number"
                          value={twoColLogoSize}
                          onChange={(e) => setTwoColLogoSize(Number(e.target.value))}
                        />
                      </div>
                      <div>
                        <Label htmlFor="two-logo-height">Alto del contenedor de logo (px)</Label>
                        <Input
                          id="two-logo-height"
                          type="number"
                          value={twoColLogoHeight}
                          onChange={(e) => setTwoColLogoHeight(Number(e.target.value))}
                        />
                      </div>
                      <div>
                        <Label htmlFor="two-card-width">Ancho tarjeta (px)</Label>
                        <Input
                          id="two-card-width"
                          type="number"
                          value={twoColCardWidth}
                          onChange={(e) => setTwoColCardWidth(Number(e.target.value))}
                        />
                      </div>
                      <div>
                        <Label htmlFor="two-band-width">Ancho mínimo franja (px)</Label>
                        <Input
                          id="two-band-width"
                          type="number"
                          value={twoColBandWidth}
                          onChange={(e) => setTwoColBandWidth(Number(e.target.value))}
                        />
                      </div>
                      <div>
                        <Label htmlFor="two-band-height">Alto franja (px)</Label>
                        <Input
                          id="two-band-height"
                          type="number"
                          value={twoColBandHeight}
                          onChange={(e) => setTwoColBandHeight(Number(e.target.value))}
                        />
                      </div>
                      <div>
                        <Label htmlFor="two-band-gap">Separación logos/franja (px)</Label>
                        <Input
                          id="two-band-gap"
                          type="number"
                          value={twoColBandGap}
                          onChange={(e) => setTwoColBandGap(Number(e.target.value))}
                        />
                      </div>
                      <div>
                        <Label htmlFor="two-band-radius">Radio franja (px)</Label>
                        <Input
                          id="two-band-radius"
                          type="number"
                          value={twoColBandRadius}
                          onChange={(e) => setTwoColBandRadius(Number(e.target.value))}
                        />
                      </div>
                      <div>
                        <Label htmlFor="two-logo-radius">Radio logos (px)</Label>
                        <Input
                          id="two-logo-radius"
                          type="number"
                          value={twoColLogoBorderRadius}
                          onChange={(e) => setTwoColLogoBorderRadius(Number(e.target.value))}
                        />
                      </div>
                      <div>
                        <Label htmlFor="two-gap-x">Espacio entre columnas (px)</Label>
                        <Input
                          id="two-gap-x"
                          type="number"
                          value={twoColGapX}
                          onChange={(e) => setTwoColGapX(Number(e.target.value))}
                        />
                      </div>
                      <div>
                        <Label htmlFor="two-col-offset">Offset columna derecha (px)</Label>
                        <Input
                          id="two-col-offset"
                          type="number"
                          value={twoColColumnOffset}
                          onChange={(e) => setTwoColColumnOffset(Number(e.target.value))}
                        />
                      </div>
                      <div>
                        <Label htmlFor="two-gap-y">Espacio entre filas (px)</Label>
                        <Input
                          id="two-gap-y"
                          type="number"
                          value={twoColGapY}
                          onChange={(e) => setTwoColGapY(Number(e.target.value))}
                        />
                      </div>
                      <div>
                        <Label htmlFor="two-team-font">Fuente nombres (px)</Label>
                        <Input
                          id="two-team-font"
                          type="number"
                          value={twoColTeamNameFont}
                          onChange={(e) => setTwoColTeamNameFont(Number(e.target.value))}
                        />
                      </div>
                      <div>
                        <Label htmlFor="two-time-font">Fuente hora (px)</Label>
                        <Input
                          id="two-time-font"
                          type="number"
                          value={twoColTimeFont}
                          onChange={(e) => setTwoColTimeFont(Number(e.target.value))}
                        />
                      </div>
                      <div className="flex items-center gap-2">
                        <input
                          id="two-wrap"
                          type="checkbox"
                          checked={twoColNamesWrap}
                          onChange={(e) => setTwoColNamesWrap(e.target.checked)}
                        />
                        <Label htmlFor="two-wrap">Permitir salto de línea en nombres</Label>
                      </div>
                      <div>
                        <Label htmlFor="two-name-maxw">Máx. ancho nombres (px)</Label>
                        <Input
                          id="two-name-maxw"
                          type="number"
                          value={twoColNamesMaxWidth}
                          onChange={(e) => setTwoColNamesMaxWidth(Number(e.target.value))}
                        />
                      </div>
                      <div>
                        <Label htmlFor="two-name-offset">Offset vertical nombres (px)</Label>
                        <Input
                          id="two-name-offset"
                          type="number"
                          value={twoColNameOffset}
                          onChange={(e) => setTwoColNameOffset(Number(e.target.value))}
                        />
                      </div>
                      <div>
                        <Label htmlFor="two-name-offset-x">Offset horizontal nombres (px)</Label>
                        <Input
                          id="two-name-offset-x"
                          type="number"
                          value={twoColNameHorizontalOffset}
                          onChange={(e) => setTwoColNameHorizontalOffset(Number(e.target.value))}
                        />
                      </div>
                      <div>
                        <Label htmlFor="two-time-offset">Offset vertical hora (px)</Label>
                        <Input
                          id="two-time-offset"
                          type="number"
                          value={twoColTimeOffset}
                          onChange={(e) => setTwoColTimeOffset(Number(e.target.value))}
                        />
                      </div>
                      <div>
                        <Label htmlFor="two-time-offset-x">Offset horizontal hora (px)</Label>
                        <Input
                          id="two-time-offset-x"
                          type="number"
                          value={twoColTimeHorizontalOffset}
                          onChange={(e) => setTwoColTimeHorizontalOffset(Number(e.target.value))}
                        />
                      </div>
                      <div>
                        <Label htmlFor="two-date-top">Espacio arriba de la fecha (px)</Label>
                        <Input
                          id="two-date-top"
                          type="number"
                          value={twoColInterDateGap}
                          onChange={(e) => setTwoColInterDateGap(Number(e.target.value))}
                        />
                      </div>
                      <div>
                        <Label htmlFor="two-date-gap">Espacio entre fecha y bloques (px)</Label>
                        <Input
                          id="two-date-gap"
                          type="number"
                          value={twoColDateBlockGap}
                          onChange={(e) => setTwoColDateBlockGap(Number(e.target.value))}
                        />
                      </div>
                      <div>
                        <Label htmlFor="two-date-offset-x">Offset horizontal fecha (px)</Label>
                        <Input
                          id="two-date-offset-x"
                          type="number"
                          value={twoColDateHorizontalOffset}
                          onChange={(e) => setTwoColDateHorizontalOffset(Number(e.target.value))}
                        />
                      </div>
                      <div>
                        <Label htmlFor="two-date-offset-y">Offset vertical fecha (px)</Label>
                        <Input
                          id="two-date-offset-y"
                          type="number"
                          value={twoColDateVerticalOffset}
                          onChange={(e) => setTwoColDateVerticalOffset(Number(e.target.value))}
                        />
                      </div>
                    </div>
                  </div>

                  </CollapsibleContent>
                </Collapsible>

                {/* Gradientes de Franja */}
                <div className="mt-6 border-t pt-4">
                  <h3 className="text-lg font-semibold mb-4">Gradientes de Franja</h3>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="settings-gradient-enabled">Habilitar gradiente (modo compacto)</Label>
                      <Switch
                        id="settings-gradient-enabled"
                        checked={compactGradientEnabled}
                        onCheckedChange={setCompactGradientEnabled}
                      />
                    </div>
                    {compactGradientEnabled && (
                      <>
                        <div>
                          <Label htmlFor="settings-gradient-start">Color inicial</Label>
                          <div className="flex items-center gap-2 mt-1">
                            <Input
                              type="color"
                              id="settings-gradient-start"
                              value={compactGradientStart}
                              onChange={(event) => setCompactGradientStart(event.target.value)}
                              className="w-16 h-10"
                            />
                            <Input
                              type="text"
                              value={compactGradientStart}
                              onChange={(event) => setCompactGradientStart(event.target.value)}
                              className="flex-1"
                            />
                          </div>
                        </div>
                        <div>
                          <Label htmlFor="settings-gradient-end">Color final</Label>
                          <div className="flex items-center gap-2 mt-1">
                            <Input
                              type="color"
                              id="settings-gradient-end"
                              value={compactGradientEnd}
                              onChange={(event) => setCompactGradientEnd(event.target.value)}
                              className="w-16 h-10"
                            />
                            <Input
                              type="text"
                              value={compactGradientEnd}
                              onChange={(event) => setCompactGradientEnd(event.target.value)}
                              className="flex-1"
                            />
                          </div>
                        </div>
                        <div>
                          <Label htmlFor="settings-gradient-direction">Dirección</Label>
                          <select
                            id="settings-gradient-direction"
                            className="w-full border rounded px-3 py-2 mt-1"
                            value={compactGradientDirection}
                            onChange={(event) => setCompactGradientDirection(event.target.value as any)}
                          >
                            <option value="to right">Izquierda → Derecha</option>
                            <option value="to left">Derecha → Izquierda</option>
                            <option value="to bottom">Arriba → Abajo</option>
                            <option value="to top">Abajo → Arriba</option>
                          </select>
                        </div>
                      </>
                    )}
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="border rounded-lg p-4 bg-white">
                    <h3 className="text-lg font-semibold mb-3">Vista Previa</h3>
                    <div className="bg-gray-100 p-4 rounded-lg flex flex-col items-center gap-3">
                      {renderPreview(blockStyle, "full")}
                      <div className="text-xs text-gray-500 text-center">
                        Vista previa basada en configuración actual. Cambios se reflejan aquí al instante.
                      </div>
                    </div>
                  </div>

                  <div className="border rounded-lg p-4 bg-white">
                    <h4 className="text-sm font-semibold mb-3">Modos</h4>
                    <div className="grid grid-cols-2 gap-3">
                      {previewModes.map(({ style, label }) => (
                        <button
                          key={style}
                          type="button"
                          onClick={() => selectBlockStyle(style)}
                          className={`rounded-md border p-2 text-left transition-colors ${
                            blockStyle === style ? "border-primary ring-2 ring-primary/30" : "hover:bg-gray-50"
                          }`}
                        >
                          <div className="text-xs font-semibold mb-2">{label}</div>
                          <div className="flex justify-center">{renderPreview(style, "thumb")}</div>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
              </CardContent>
	            </Card>

	          </TabsContent>

	          <TabsContent value="graficos">
	            <GraphicFixtureTab fixturesOverride={fixtures} timeZonesOverride={timeZones} leaguesOverride={leagues} />
	          </TabsContent>
	        </Tabs>
      </div>
    </main>
  )
}
