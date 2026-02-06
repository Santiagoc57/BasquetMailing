"use client"

import type React from "react"
import { createContext, useContext, useState, useCallback } from "react"
import type { Team, Match, League, TimeZoneConfig, AppState } from "@/types"

interface AppContextType extends AppState {
  // Funciones para actualizar el estado
  setFixtures: (fixtures: Match[] | ((prev: Match[]) => Match[])) => void
  setTeams: (teams: Team[] | ((prev: Team[]) => Team[])) => void
  setLeagues: (leagues: League[] | ((prev: League[]) => League[])) => void
  setTimeZones: (timeZones: TimeZoneConfig[]) => void
  setShowTimeLabels: (show: boolean) => void
  setShowDividers: (show: boolean) => void
  setShowTeamNames: (show: boolean) => void
  setExportTextColorBlack: (black: boolean) => void
  setExportHorario: (horario: string) => void
  setBackgroundColor: (color: string) => void

  // Offsets y tamaños
  setTimeBlockOffset: (offset: number) => void
  timeBlockOffsetInput: number
  setTimeBlockOffsetInput: (offset: number) => void
  setCountryLabelOffset: (offset: number) => void
  countryLabelOffsetInput: number
  setCountryLabelOffsetInput: (offset: number) => void
  setTeamNamesOffset: (offset: number) => void
  teamNamesOffsetInput: number
  setTeamNamesOffsetInput: (offset: number) => void
  compactTimeBlockOffset: number
  setCompactTimeBlockOffset: (offset: number) => void
  compactTimeBlockOffsetInput: number
  setCompactTimeBlockOffsetInput: (offset: number) => void
  compactTeamNamesOffset: number
  setCompactTeamNamesOffset: (offset: number) => void
  compactTeamNamesOffsetInput: number
  setCompactTeamNamesOffsetInput: (offset: number) => void
  setTeamNamesFontSize: (size: number) => void
  teamNamesFontSizeInput: number
  setTeamNamesFontSizeInput: (size: number) => void
  setTimesFontSize: (size: number) => void
  timesFontSizeInput: number
  setTimesFontSizeInput: (size: number) => void
  setDividerHeight: (height: number) => void
  dividerHeightInput: number
  setDividerHeightInput: (height: number) => void
  setHorizontalTimeOffset: (offset: number) => void
  horizontalTimeOffsetInput: number
  setHorizontalTimeOffsetInput: (offset: number) => void

  // Posición de la fecha (vista web)
  dateVerticalOffset: number
  setDateVerticalOffset: (offset: number) => void
  dateVerticalOffsetInput: number
  setDateVerticalOffsetInput: (offset: number) => void

  // Estilo de bloque
  blockStyle: "normal" | "compact"
  setBlockStyle: (style: "normal" | "compact") => void

  // Ajustes modo compacto
  compactBandWidth: number
  setCompactBandWidth: (width: number) => void
  compactBandHeight: number
  setCompactBandHeight: (height: number) => void

  // Espaciados de exportación
  setExportSpacing: (spacing: number) => void
  exportSpacingInput: number
  setExportSpacingInput: (spacing: number) => void
  setExportDateSpacing: (spacing: number) => void
  exportDateSpacingInput: number
  setExportDateSpacingInput: (spacing: number) => void
  setExportDateFontSize: (size: number) => void
  exportDateFontSizeInput: number
  setExportDateFontSizeInput: (size: number) => void
  setFixtureSpacing: (spacing: number) => void
  fixtureSpacingInput: number
  setFixtureSpacingInput: (spacing: number) => void
  setFixtureMarginTop: (margin: number) => void
  fixtureMarginTopInput: number
  setFixtureMarginTopInput: (margin: number) => void
  setFixtureMarginBottom: (margin: number) => void
  fixtureMarginBottomInput: number
  setFixtureMarginBottomInput: (margin: number) => void

  // Estado de exportación
  exportMode: boolean
  setExportMode: (mode: boolean) => void

  // Preset de posiciones
  preset: "Con HORARIOS" | "Con NOMBRES"
  setPreset: (preset: "Con HORARIOS" | "Con NOMBRES") => void

  // Funciones de manipulación de fixtures
  addFixture: () => void
  removeFixture: (id: string) => void
  updateFixture: (id: string, field: string, value: any) => void

  // Funciones de importación/exportación
  importAllData: (event: React.ChangeEvent<HTMLInputElement>) => void
  exportAllData: () => void
  clearAllSavedData: () => void
}

const AppContext = createContext<AppContextType | undefined>(undefined)

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Estado inicial
  const [fixtures, setFixtures] = useState<Match[]>([])
  const [teams, setTeams] = useState<Team[]>([])
  const [leagues, setLeagues] = useState<League[]>([
    { name: "Euroliga", color: "#EB5B27" },
    { name: "Endesa", color: "#EB5B27" },
    // ... otros valores predeterminados
  ])

  // Configuración de zonas horarias
  const [timeZones, setTimeZones] = useState<TimeZoneConfig[]>([
    { name: "ECU", diffHours: -2, label: "ECU" },
    { name: "ARG", diffHours: 0, label: "" },
    { name: "BOL", diffHours: -1, label: "BOL / CHI" },
  ])

  // Configuración de visualización
  const [showTimeLabels, setShowTimeLabels] = useState(true)
  const [showDividers, setShowDividers] = useState(false)
  const [showTeamNames, setShowTeamNames] = useState(false)
  const [backgroundColor, setBackgroundColor] = useState("#FF4500")

  // Offsets y tamaños
  const [timeBlockOffset, setTimeBlockOffset] = useState(-35)
  const [timeBlockOffsetInput, setTimeBlockOffsetInput] = useState(-35)
  const [countryLabelOffset, setCountryLabelOffset] = useState(-35)
  const [countryLabelOffsetInput, setCountryLabelOffsetInput] = useState(-35)
  const [teamNamesOffset, setTeamNamesOffset] = useState(-45)
  const [teamNamesOffsetInput, setTeamNamesOffsetInput] = useState(-45)
  const [compactTimeBlockOffset, setCompactTimeBlockOffset] = useState(-30)
  const [compactTimeBlockOffsetInput, setCompactTimeBlockOffsetInput] = useState(-30)
  const [compactTeamNamesOffset, setCompactTeamNamesOffset] = useState(-40)
  const [compactTeamNamesOffsetInput, setCompactTeamNamesOffsetInput] = useState(-40)
  const [teamNamesFontSize, setTeamNamesFontSize] = useState(20)
  const [teamNamesFontSizeInput, setTeamNamesFontSizeInput] = useState(20)
  const [timesFontSize, setTimesFontSize] = useState(32)
  const [timesFontSizeInput, setTimesFontSizeInput] = useState(32)
  const [dividerHeight, setDividerHeight] = useState(80)
  const [dividerHeightInput, setDividerHeightInput] = useState(80)
  const [horizontalTimeOffset, setHorizontalTimeOffset] = useState(0) // Nuevo offset horizontal
  const [horizontalTimeOffsetInput, setHorizontalTimeOffsetInput] = useState(0) // Nuevo input para offset horizontal

  // Posición de la fecha (vista web)
  const [dateVerticalOffset, setDateVerticalOffset] = useState(0)
  const [dateVerticalOffsetInput, setDateVerticalOffsetInput] = useState(0)

  // Configuración de exportación
  const [exportTextColorBlack, setExportTextColorBlack] = useState(false)
  const [exportHorario, setExportHorario] = useState("BOL")
  const [exportSpacing, setExportSpacing] = useState(20)
  const [exportSpacingInput, setExportSpacingInput] = useState(20)
  const [exportDateSpacing, setExportDateSpacing] = useState(2)
  const [exportDateSpacingInput, setExportDateSpacingInput] = useState(2)
  const [exportDateFontSize, setExportDateFontSize] = useState(32)
  const [exportDateFontSizeInput, setExportDateFontSizeInput] = useState(32)
  const [fixtureSpacing, setFixtureSpacing] = useState(12)
  const [fixtureSpacingInput, setFixtureSpacingInput] = useState(12)
  const [fixtureMarginTop, setFixtureMarginTop] = useState(0)
  const [fixtureMarginTopInput, setFixtureMarginTopInput] = useState(0)
  const [fixtureMarginBottom, setFixtureMarginBottom] = useState(0)
  const [fixtureMarginBottomInput, setFixtureMarginBottomInput] = useState(0)

  // Estado de exportación
  const [exportMode, setExportMode] = useState(false)

  // Preset de posiciones
  const [preset, setPreset] = useState<"Con HORARIOS" | "Con NOMBRES">("Con HORARIOS")

  // Estilo de bloque
  const [blockStyle, setBlockStyle] = useState<"normal" | "compact">("normal")

  // Ajustes modo compacto
  const [compactBandWidth, setCompactBandWidth] = useState<number>(500)
  const [compactBandHeight, setCompactBandHeight] = useState<number>(75)

  // Implementar funciones de manipulación de fixtures, importación/exportación, etc.
  const addFixture = useCallback(() => {
    setFixtures((prevFixtures) => [
      ...prevFixtures,
      {
        id: Math.random().toString(36).substring(2, 15),
        team1: "",
        team2: "",
        time: "",
        league: "Euroliga",
      },
    ])
  }, [setFixtures])

  const removeFixture = useCallback(
    (id: string) => {
      setFixtures((prevFixtures) => prevFixtures.filter((fixture) => fixture.id !== id))
    },
    [setFixtures],
  )

  const updateFixture = useCallback(
    (id: string, field: string, value: any) => {
      setFixtures((prevFixtures) =>
        prevFixtures.map((fixture) => (fixture.id === id ? { ...fixture, [field]: value } : fixture)),
      )
    },
    [setFixtures],
  )

  const importAllData = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0]
      if (!file) return

      const reader = new FileReader()
      reader.onload = (e) => {
        try {
          const data = JSON.parse(e.target?.result as string)
          if (data) {
            setFixtures(data.fixtures || [])
            setTeams(data.teams || [])
            setLeagues(data.leagues || [])
            setTimeZones(data.timeZones || [])
            setShowTimeLabels(data.showTimeLabels !== undefined ? data.showTimeLabels : true)
            setShowDividers(data.showDividers !== undefined ? data.showDividers : false)
            setShowTeamNames(data.showTeamNames !== undefined ? data.showTeamNames : false)
            setBackgroundColor(data.backgroundColor || "#FF4500")
            setTimeBlockOffset(data.timeBlockOffset !== undefined ? data.timeBlockOffset : -35)
            setTimeBlockOffsetInput(data.timeBlockOffsetInput !== undefined ? data.timeBlockOffsetInput : -35)
            setCountryLabelOffset(data.countryLabelOffset !== undefined ? data.countryLabelOffset : -35)
            setCountryLabelOffsetInput(data.countryLabelOffsetInput !== undefined ? data.countryLabelOffsetInput : -35)
            setTeamNamesOffset(data.teamNamesOffset !== undefined ? data.teamNamesOffset : -45)
            setTeamNamesOffsetInput(data.teamNamesOffsetInput !== undefined ? data.teamNamesOffsetInput : -45)
            setCompactTimeBlockOffset(
              data.compactTimeBlockOffset !== undefined ? data.compactTimeBlockOffset : -30,
            )
            setCompactTimeBlockOffsetInput(
              data.compactTimeBlockOffsetInput !== undefined ? data.compactTimeBlockOffsetInput : -30,
            )
            setCompactTeamNamesOffset(
              data.compactTeamNamesOffset !== undefined ? data.compactTeamNamesOffset : -40,
            )
            setCompactTeamNamesOffsetInput(
              data.compactTeamNamesOffsetInput !== undefined ? data.compactTeamNamesOffsetInput : -40,
            )
            setTeamNamesFontSize(data.teamNamesFontSize !== undefined ? data.teamNamesFontSize : 20)
            setTeamNamesFontSizeInput(data.teamNamesFontSizeInput !== undefined ? data.teamNamesFontSizeInput : 20)
            setTimesFontSize(data.timesFontSize !== undefined ? data.timesFontSize : 32)
            setTimesFontSizeInput(data.timesFontSizeInput !== undefined ? data.timesFontSizeInput : 32)
            setDividerHeight(data.dividerHeight !== undefined ? data.dividerHeight : 80)
            setDividerHeightInput(data.dividerHeightInput !== undefined ? data.dividerHeightInput : 80)
            setHorizontalTimeOffset(data.horizontalTimeOffset !== undefined ? data.horizontalTimeOffset : 0)
            setHorizontalTimeOffsetInput(
              data.horizontalTimeOffsetInput !== undefined ? data.horizontalTimeOffsetInput : 0,
            )
            setExportTextColorBlack(data.exportTextColorBlack !== undefined ? data.exportTextColorBlack : false)
            setExportHorario(data.exportHorario || "BOL")
            setExportSpacing(data.exportSpacing !== undefined ? data.exportSpacing : 20)
            setExportSpacingInput(data.exportSpacingInput !== undefined ? data.exportSpacingInput : 20)
            setExportDateSpacing(data.exportDateSpacing !== undefined ? data.exportDateSpacing : 2)
            setExportDateSpacingInput(data.exportDateSpacingInput !== undefined ? data.exportDateSpacingInput : 2)
            setExportDateFontSize(data.exportDateFontSize !== undefined ? data.exportDateFontSize : 32)
            setExportDateFontSizeInput(data.exportDateFontSizeInput !== undefined ? data.exportDateFontSizeInput : 32)
            setFixtureSpacing(data.fixtureSpacing !== undefined ? data.fixtureSpacing : 12)
            setFixtureSpacingInput(data.fixtureSpacingInput !== undefined ? data.fixtureSpacingInput : 12)
            setFixtureMarginTop(data.fixtureMarginTop !== undefined ? data.fixtureMarginTop : 0)
            setFixtureMarginTopInput(data.fixtureMarginTopInput !== undefined ? data.fixtureMarginTopInput : 0)
            setFixtureMarginBottom(data.fixtureMarginBottom !== undefined ? data.fixtureMarginBottom : 0)
            setFixtureMarginBottomInput(data.fixtureMarginBottomInput !== undefined ? data.fixtureMarginBottomInput : 0)
            setExportMode(data.exportMode !== undefined ? data.exportMode : false)
            setPreset(data.preset || "Con HORARIOS")
          }
        } catch (error) {
          console.error("Error parsing JSON:", error)
          alert("Error importing data. Please ensure the file is a valid JSON.")
        }
      }
      reader.readAsText(file)
    },
    [
      setFixtures,
      setTeams,
      setLeagues,
      setTimeZones,
      setShowTimeLabels,
      setShowDividers,
      setShowTeamNames,
      setBackgroundColor,
      setTimeBlockOffset,
      setTimeBlockOffsetInput,
      setCountryLabelOffset,
      setCountryLabelOffsetInput,
      setTeamNamesOffset,
      setTeamNamesOffsetInput,
      setTeamNamesFontSize,
      setTeamNamesFontSizeInput,
      setTimesFontSize,
      setTimesFontSizeInput,
      setDividerHeight,
      setDividerHeightInput,
      setHorizontalTimeOffset,
      setHorizontalTimeOffsetInput,
      setExportTextColorBlack,
      setExportHorario,
      setExportSpacing,
      setExportSpacingInput,
      setExportDateSpacing,
      setExportDateSpacingInput,
      setExportDateFontSize,
      setExportDateFontSizeInput,
      setFixtureSpacing,
      setFixtureSpacingInput,
      setFixtureMarginTop,
      setFixtureMarginTopInput,
      setFixtureMarginBottom,
      setFixtureMarginBottomInput,
      setExportMode,
      setPreset,
    ],
  )

  const exportAllData = useCallback(() => {
    const data = {
      fixtures,
      teams,
      leagues,
      timeZones,
      showTimeLabels,
      showDividers,
      showTeamNames,
      backgroundColor,
      timeBlockOffset,
      timeBlockOffsetInput,
      countryLabelOffset,
      countryLabelOffsetInput,
      teamNamesOffset,
      teamNamesOffsetInput,
      compactTimeBlockOffset,
      compactTimeBlockOffsetInput,
      compactTeamNamesOffset,
      compactTeamNamesOffsetInput,
      teamNamesFontSize,
      teamNamesFontSizeInput,
      timesFontSize,
      timesFontSizeInput,
      dividerHeight,
      dividerHeightInput,
      horizontalTimeOffset,
      horizontalTimeOffsetInput,
      dateVerticalOffset,
      dateVerticalOffsetInput,
      exportTextColorBlack,
      exportHorario,
      exportSpacing,
      exportSpacingInput,
      exportDateSpacing,
      exportDateSpacingInput,
      exportDateFontSize,
      exportDateFontSizeInput,
      fixtureSpacing,
      fixtureSpacingInput,
      fixtureMarginTop,
      fixtureMarginTopInput,
      fixtureMarginBottom,
      fixtureMarginBottomInput,
      exportMode,
      preset,
      blockStyle,
    }

    const json = JSON.stringify(data)
    const blob = new Blob([json], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = "data.json"
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }, [
    fixtures,
    teams,
    leagues,
    timeZones,
    showTimeLabels,
    showDividers,
    showTeamNames,
    backgroundColor,
    timeBlockOffset,
    timeBlockOffsetInput,
    countryLabelOffset,
    countryLabelOffsetInput,
    teamNamesOffset,
    teamNamesOffsetInput,
    compactTimeBlockOffset,
    compactTimeBlockOffsetInput,
    compactTeamNamesOffset,
    compactTeamNamesOffsetInput,
    teamNamesFontSize,
    teamNamesFontSizeInput,
    timesFontSize,
    timesFontSizeInput,
    dividerHeight,
    dividerHeightInput,
    horizontalTimeOffset,
    horizontalTimeOffsetInput,
    exportTextColorBlack,
    exportHorario,
    exportSpacing,
    exportSpacingInput,
    exportDateSpacing,
    exportDateSpacingInput,
    exportDateFontSize,
    exportDateFontSizeInput,
    fixtureSpacing,
    fixtureSpacingInput,
    fixtureMarginTop,
    fixtureMarginTopInput,
    fixtureMarginBottom,
    fixtureMarginBottomInput,
    exportMode,
    preset,
  ])

  const clearAllSavedData = useCallback(() => {
    if (window.confirm("Are you sure you want to clear all saved data? This action cannot be undone.")) {
      setFixtures([])
      setTeams([])
      setLeagues([
        { name: "Euroliga", color: "#EB5B27" },
        { name: "Endesa", color: "#EB5B27" },
      ])
      setTimeZones([
        { name: "ECU", diffHours: -2, label: "ECU" },
        { name: "ARG", diffHours: 0, label: "BRA / URU" },
        { name: "BOL", diffHours: -1, label: "BOL / CHI" },
      ])
      setShowTimeLabels(true)
      setShowDividers(false)
      setShowTeamNames(false)
      setBackgroundColor("#FF4500")
      setTimeBlockOffset(-80)
      setTimeBlockOffsetInput(-80)
      setCountryLabelOffset(-24)
      setCountryLabelOffsetInput(-24)
      setTeamNamesOffset(-49)
      setTeamNamesOffsetInput(-49)
      setCompactTimeBlockOffset(-70)
      setCompactTimeBlockOffsetInput(-70)
      setCompactTeamNamesOffset(-45)
      setCompactTeamNamesOffsetInput(-45)
      setTeamNamesFontSize(20)
      setTeamNamesFontSizeInput(20)
      setTimesFontSize(32)
      setTimesFontSizeInput(32)
      setDividerHeight(80)
      setDividerHeightInput(80)
      setHorizontalTimeOffset(0)
      setHorizontalTimeOffsetInput(0)
      setExportTextColorBlack(false)
      setExportHorario("ARG")
      setExportSpacing(20)
      setExportSpacingInput(20)
      setExportDateSpacing(2)
      setExportDateSpacingInput(2)
      setExportDateFontSize(32)
      setExportDateFontSizeInput(32)
      setFixtureSpacing(12)
      setFixtureSpacingInput(12)
      setFixtureMarginTop(0)
      setFixtureMarginTopInput(0)
      setFixtureMarginBottom(0)
      setFixtureMarginBottomInput(0)
      setExportMode(false)
      setPreset("Con HORARIOS")
      setDateVerticalOffset(0)
      setDateVerticalOffsetInput(0)
      setBlockStyle("normal")
    }
  }, [
    setFixtures,
    setTeams,
    setLeagues,
    setTimeZones,
    setShowTimeLabels,
    setShowDividers,
    setShowTeamNames,
    setBackgroundColor,
    setTimeBlockOffset,
    setTimeBlockOffsetInput,
    setCountryLabelOffset,
    setCountryLabelOffsetInput,
    setTeamNamesOffset,
    setTeamNamesOffsetInput,
    setTeamNamesFontSize,
    setTeamNamesFontSizeInput,
    setTimesFontSize,
    setTimesFontSizeInput,
    setDividerHeight,
    setDividerHeightInput,
    setHorizontalTimeOffset,
    setHorizontalTimeOffsetInput,
    setExportTextColorBlack,
    setExportHorario,
    setExportSpacing,
    setExportSpacingInput,
    setExportDateSpacing,
    setExportDateSpacingInput,
    setExportDateFontSize,
    setExportDateFontSizeInput,
    setFixtureSpacing,
    setFixtureSpacingInput,
    setFixtureMarginTop,
    setFixtureMarginTopInput,
    setFixtureMarginBottom,
    setFixtureMarginBottomInput,
    setExportMode,
    setPreset,
    setDateVerticalOffset,
    setDateVerticalOffsetInput,
    setBlockStyle,
  ])

  const value = {
    fixtures,
    setFixtures,
    teams,
    setTeams,
    leagues,
    setLeagues,
    timeZones,
    setTimeZones,
    showTimeLabels,
    setShowTimeLabels,
    showDividers,
    setShowDividers,
    showTeamNames,
    setShowTeamNames,
    backgroundColor,
    setBackgroundColor,

    // Offsets y tamaños
    timeBlockOffset,
    setTimeBlockOffset,
    timeBlockOffsetInput,
    setTimeBlockOffsetInput,
    countryLabelOffset,
    setCountryLabelOffset,
    countryLabelOffsetInput,
    setCountryLabelOffsetInput,
    teamNamesOffset,
    setTeamNamesOffset,
    teamNamesOffsetInput,
    setTeamNamesOffsetInput,
    compactTimeBlockOffset,
    setCompactTimeBlockOffset,
    compactTimeBlockOffsetInput,
    setCompactTimeBlockOffsetInput,
    compactTeamNamesOffset,
    setCompactTeamNamesOffset,
    compactTeamNamesOffsetInput,
    setCompactTeamNamesOffsetInput,
    teamNamesFontSize,
    setTeamNamesFontSize,
    teamNamesFontSizeInput,
    setTeamNamesFontSizeInput,
    timesFontSize,
    setTimesFontSize,
    timesFontSizeInput,
    setTimesFontSizeInput,
    dividerHeight,
    setDividerHeight,
    dividerHeightInput,
    setDividerHeightInput,
    horizontalTimeOffset, // Nuevo offset horizontal
    setHorizontalTimeOffset,
    horizontalTimeOffsetInput,
    setHorizontalTimeOffsetInput,

    // Fecha (vista web)
    dateVerticalOffset,
    setDateVerticalOffset,
    dateVerticalOffsetInput,
    setDateVerticalOffsetInput,

    // Configuración de exportación
    exportTextColorBlack,
    setExportTextColorBlack,
    exportHorario,
    setExportHorario,
    exportSpacing,
    setExportSpacing,
    exportSpacingInput,
    setExportSpacingInput,
    exportDateSpacing,
    setExportDateSpacing,
    exportDateSpacingInput,
    setExportDateSpacingInput,
    exportDateFontSize,
    setExportDateFontSize,
    exportDateFontSizeInput,
    setExportDateFontSizeInput,
    fixtureSpacing,
    setFixtureSpacing,
    fixtureSpacingInput,
    setFixtureSpacingInput,
    fixtureMarginTop,
    setFixtureMarginTop,
    fixtureMarginTopInput,
    setFixtureMarginTopInput,
    fixtureMarginBottom,
    setFixtureMarginBottom,
    fixtureMarginBottomInput,
    setFixtureMarginBottomInput,

    // Estado de exportación
    exportMode,
    setExportMode,

    // Preset de posiciones
    preset,
    setPreset,

    // Estilo de bloque
    blockStyle,
    setBlockStyle,

    // Ajustes modo compacto
    compactBandWidth,
    setCompactBandWidth,
    compactBandHeight,
    setCompactBandHeight,

    // Funciones de manipulación de fixtures
    addFixture,
    removeFixture,
    updateFixture,

    // Funciones de importación/exportación
    importAllData,
    exportAllData,
    clearAllSavedData,
  }

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}

export const useAppContext = () => {
  const context = useContext(AppContext)
  if (context === undefined) {
    throw new Error("useAppContext must be used within an AppProvider")
  }
  return context
}
